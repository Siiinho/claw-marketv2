import { useMemo } from 'react'
import { useStore } from '../store/StoreContext'
import { Icon, Indicador, Secao } from '../components/ui'
import { SETORES, setorById, statusValidade, diasParaVencer, formatBRL } from '../lib/utils'

export default function Relatorios() {
  const { produtos, ofertas, todosProdutos, lojas, lojaAtiva, setLojaAtiva } = useStore()

  const benchmark = useMemo(
    () =>
      lojas
        .map((l) => {
          const ps = todosProdutos.filter((p) => p.loja === l.id)
          const vencendo = ps.filter((p) => { const d = diasParaVencer(p.validade); return d != null && d >= 0 && d <= 7 }).length
          const perda = ps.filter((p) => diasParaVencer(p.validade) < 0).reduce((s, p) => s + (p.precoNormal || 0) * (p.estoque || 0), 0)
          const valorEstoque = ps.reduce((s, p) => s + (p.precoNormal || 0) * (p.estoque || 0), 0)
          return { ...l, itens: ps.length, vencendo, perda, valorEstoque }
        })
        .sort((a, b) => a.perda - b.perda),
    [todosProdutos, lojas]
  )
  const maxPerda = Math.max(...benchmark.map((b) => b.perda), 1)

  const d = useMemo(() => {
    const valorEstoque = produtos.reduce((s, p) => s + (p.precoNormal || 0) * (p.estoque || 0), 0)
    const economia = ofertas
      .filter((o) => o.ativa)
      .reduce((s, o) => {
        const p = produtos.find((x) => x.id === o.produtoId)
        return p ? s + (p.precoNormal * (o.desconto / 100)) * (p.estoque || 1) : s
      }, 0)
    const perda = produtos.filter((p) => diasParaVencer(p.validade) < 0).reduce((s, p) => s + (p.precoNormal || 0) * (p.estoque || 0), 0)

    const porSetor = SETORES.map((s) => ({
      ...s,
      valor: produtos.filter((p) => p.setor === s.id).reduce((a, p) => a + (p.precoNormal || 0) * (p.estoque || 0), 0),
      alerta: produtos.filter((p) => {
        const dias = diasParaVencer(p.validade)
        return p.setor === s.id && dias != null && dias >= 0 && dias <= 7
      }).length,
    })).filter((s) => s.valor > 0).sort((a, b) => b.valor - a.valor)

    const status = { vencido: 0, critico: 0, atencao: 0, normal: 0 }
    produtos.forEach((p) => { status[statusValidade(p.validade).id]++ })

    return { valorEstoque, economia, perda, porSetor, status, totalOfertas: ofertas.length }
  }, [produtos, ofertas])

  const maxValor = Math.max(...d.porSetor.map((s) => s.valor), 1)
  const statusInfo = [
    { id: 'vencido', l: 'Vencidos', cor: '#7a241b' },
    { id: 'critico', l: 'Crítico', cor: '#c42b2b' },
    { id: 'atencao', l: 'Atenção', cor: '#f2a93b' },
    { id: 'normal', l: 'Normal', cor: '#2e9e6b' },
  ]
  const topAlerta = [...d.porSetor].filter((s) => s.alerta > 0).sort((a, b) => b.alerta - a.alerta)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Valor em estoque" valor={formatBRL(d.valorEstoque)} icone="Wallet" cor="var(--color-info)" />
        <Indicador rotulo="Economia gerada" valor={formatBRL(d.economia)} icone="PiggyBank" cor="var(--color-success)" />
        <Indicador rotulo="Perda potencial" valor={formatBRL(d.perda)} icone="TrendingDown" cor="var(--color-critical)" />
        <Indicador rotulo="Ofertas criadas" valor={d.totalOfertas} icone="Tag" cor="var(--color-coral-dark)" />
      </div>

      <Secao titulo="Comparativo entre lojas" descricao="Da loja com menor perda para a de maior perda. Toque numa loja para ver os relatórios dela.">
        <div className="space-y-2">
          {benchmark.map((b, i) => (
            <button
              key={b.id}
              onClick={() => setLojaAtiva(b.id)}
              aria-pressed={lojaAtiva === b.id}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${lojaAtiva === b.id ? 'border-navy bg-navy/[0.045] shadow-[inset_0_0_0_1px_var(--color-navy)]' : 'border-ink-soft/20 hover:border-ink-soft/45'}`}
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-success/15 text-success' : i === benchmark.length - 1 ? 'bg-critical/15 text-critical' : 'bg-cream-200 text-ink-soft'}`}>
                {i + 1}º
              </span>
              <div className="min-w-0 flex-1 sm:w-40 sm:flex-none">
                <div className="truncate text-sm font-semibold text-ink">{b.nome}</div>
                <div className="text-xs text-ink-soft">{b.cidade} · {b.itens} itens</div>
              </div>
              <div className="hidden flex-1 sm:block">
                <div className="h-3 overflow-hidden rounded-full bg-cream-200">
                  <div className="h-full rounded-full" style={{ width: `${(b.perda / maxPerda) * 100}%`, background: i === 0 ? '#2e9e6b' : '#c42b2b' }} />
                </div>
              </div>
              {b.vencendo > 0 && (
                <span className="hidden rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium text-[#a9740d] md:inline">{b.vencendo} vencendo</span>
              )}
              <div className="w-24 shrink-0 text-right">
                <div className="num-tab text-sm font-bold text-ink">{formatBRL(b.perda)}</div>
                <div className="text-xs text-ink-soft">perda</div>
              </div>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-soft">
          Vendo agora: <span className="font-semibold text-ink">{lojaAtiva === 'todas' ? 'Todas as lojas' : lojas.find((l) => l.id === lojaAtiva)?.nome}</span>
        </p>
      </Secao>

      <div className="grid gap-5 lg:grid-cols-3">
        <Secao titulo="Valor em estoque por setor" className="lg:col-span-2">
          <div className="space-y-2.5">
            {d.porSetor.map((s) => (
              <div key={s.id} className="flex items-center gap-3">
                <span className="w-24 shrink-0 truncate text-sm text-ink">{s.nome}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-cream-200">
                  <div className="h-full rounded-full" style={{ width: `${(s.valor / maxValor) * 100}%`, background: s.cor }} />
                </div>
                <span className="num-tab w-24 shrink-0 text-right text-sm font-semibold text-ink">{formatBRL(s.valor)}</span>
              </div>
            ))}
          </div>
        </Secao>

        <div className="space-y-5">
          <Secao titulo="Status de validade">
            <div className="space-y-2">
              {statusInfo.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: s.cor }} />
                  <span className="flex-1 text-sm text-ink">{s.l}</span>
                  <span className="num-tab font-bold text-ink">{d.status[s.id]}</span>
                </div>
              ))}
            </div>
          </Secao>

          <Secao titulo="Setores com mais vencimentos">
            {topAlerta.length === 0 ? (
              <p className="text-sm text-ink-soft">Nenhum setor em alerta.</p>
            ) : (
              <div className="space-y-2">
                {topAlerta.map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${s.cor}1a`, color: s.cor }}>
                      <Icon name={s.icone} size={15} />
                    </span>
                    <span className="flex-1 text-sm text-ink">{s.nome}</span>
                    <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium text-[#a9740d]">{s.alerta} vencendo</span>
                  </div>
                ))}
              </div>
            )}
          </Secao>
        </div>
      </div>
    </div>
  )
}
