import { useMemo } from 'react'
import { useStore } from '../store/StoreContext'
import { Icon } from '../components/ui'
import { SETORES, setorById, statusValidade, diasParaVencer, formatBRL } from '../lib/utils'

function Stat({ titulo, valor, icone, cor }) {
  return (
    <div className="card-bengala p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-soft">{titulo}</span>
        <Icon name={icone} size={18} style={{ color: cor }} />
      </div>
      <div className="num-tab mt-2 text-xl font-bold text-ink">{valor}</div>
    </div>
  )
}

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
      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat titulo="Valor em estoque" valor={formatBRL(d.valorEstoque)} icone="Wallet" cor="#2e6fb0" />
        <Stat titulo="Economia gerada" valor={formatBRL(d.economia)} icone="PiggyBank" cor="#2e9e6b" />
        <Stat titulo="Perda potencial" valor={formatBRL(d.perda)} icone="TrendingDown" cor="#c42b2b" />
        <Stat titulo="Ofertas criadas" valor={d.totalOfertas} icone="Tag" cor="#d9641f" />
      </div>

      <div className="card-bengala p-5">
        <div className="mb-1 flex items-center gap-2">
          <Icon name="Trophy" size={18} className="text-coral" />
          <h2 className="accent font-bold text-ink">Comparativo entre lojas</h2>
          <span className="text-sm text-ink-soft">— rede, ordenado por menor perda</span>
        </div>
        <div className="mt-3 space-y-2">
          {benchmark.map((b, i) => (
            <button
              key={b.id}
              onClick={() => setLojaAtiva(b.id)}
              className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition hover:border-bengala/40 ${lojaAtiva === b.id ? 'border-bengala/50 bg-bengala/5' : 'border-ink-soft/12'}`}
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-success/15 text-success' : i === benchmark.length - 1 ? 'bg-critical/15 text-critical' : 'bg-cream-200 text-ink-soft'}`}>
                {i + 1}º
              </span>
              <div className="w-36 shrink-0">
                <div className="text-sm font-medium text-ink">{b.nome}</div>
                <div className="text-xs text-ink-soft">{b.cidade} · {b.itens} itens</div>
              </div>
              <div className="hidden flex-1 sm:block">
                <div className="h-4 overflow-hidden rounded-full bg-cream-200">
                  <div className="h-full rounded-full" style={{ width: `${(b.perda / maxPerda) * 100}%`, background: i === 0 ? '#2e9e6b' : '#c42b2b' }} />
                </div>
              </div>
              {b.vencendo > 0 && (
                <span className="hidden rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium text-[#a9740d] md:inline">{b.vencendo} vencendo</span>
              )}
              <div className="w-24 shrink-0 text-right">
                <div className="text-sm font-bold text-ink">{formatBRL(b.perda)}</div>
                <div className="text-xs text-ink-soft">perda</div>
              </div>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-soft">
          <Icon name="Info" size={12} className="mr-1 inline" /> Clique numa loja para focar os relatórios nela. Atual: <span className="font-medium">{lojaAtiva === 'todas' ? 'Todas as lojas' : lojas.find((l) => l.id === lojaAtiva)?.nome}</span>.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card-bengala p-5 lg:col-span-2">
          <h2 className="accent mb-4 font-bold text-ink">Valor por setor</h2>
          <div className="space-y-2.5">
            {d.porSetor.map((s) => (
              <div key={s.id} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm text-ink-soft">{s.nome}</span>
                <div className="h-5 flex-1 overflow-hidden rounded-full bg-cream-200">
                  <div className="h-full rounded-full" style={{ width: `${(s.valor / maxValor) * 100}%`, background: s.cor }} />
                </div>
                <span className="w-24 shrink-0 text-right text-sm font-medium text-ink">{formatBRL(s.valor)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="card-bengala p-5">
            <h2 className="mb-3 font-bold text-ink">Status de validade</h2>
            <div className="space-y-2">
              {statusInfo.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: s.cor }} />
                  <span className="flex-1 text-sm text-ink">{s.l}</span>
                  <span className="font-bold text-ink">{d.status[s.id]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card-bengala p-5">
            <h2 className="mb-3 font-bold text-ink">Top setores em alerta</h2>
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
          </div>
        </div>
      </div>
    </div>
  )
}
