import { useMemo, useState } from 'react'
import { useStore, podeEditar } from '../store/StoreContext'
import { Icon, Indicador, Secao, Acao, Pill, ProdutoThumb, StatusBadge, Segmentado, EmptyState, inputCls } from '../components/ui'
import ModalBaixa from '../components/ModalBaixa'
import { SETORES, setorById, statusValidade, diasParaVencer, formatBRL, formatData, plural, valorPerdasRegistradas, loteResolvido, precisaTrocaOuPerda, regraDaMarca, chaveMarca } from '../lib/utils'

export default function Relatorios() {
  const { produtos, ofertas, todosProdutos, lojas, lojaAtiva, setLojaAtiva, config, salvarConfig, usuario } = useStore()
  const editavel = podeEditar(usuario?.papel)
  const [baixa, setBaixa] = useState(null)

  const benchmark = useMemo(
    () =>
      lojas
        .map((l) => {
          const ps = todosProdutos.filter((p) => p.loja === l.id)
          const vencendo = ps.filter((p) => { const d = diasParaVencer(p.validade); return d != null && d >= 0 && d <= 7 }).length
          const perda = ps.filter((p) => diasParaVencer(p.validade) < 0).reduce((s, p) => s + (p.precoNormal || 0) * (p.estoque || 0), 0) + valorPerdasRegistradas(ps)
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
    const perdaRegistrada = valorPerdasRegistradas(produtos)

    const porSetor = SETORES.map((s) => ({
      ...s,
      valor: produtos.filter((p) => p.setor === s.id).reduce((a, p) => a + (p.precoNormal || 0) * (p.estoque || 0), 0),
      alerta: produtos.filter((p) => {
        const dias = diasParaVencer(p.validade)
        return p.setor === s.id && dias != null && dias >= 0 && dias <= 7
      }).length,
    })).filter((s) => s.valor > 0).sort((a, b) => b.valor - a.valor)

    const status = { vencido: 0, critico: 0, atencao: 0, normal: 0 }
    produtos.forEach((p) => { if (!loteResolvido(p)) status[statusValidade(p.validade).id]++ })

    return { valorEstoque, economia, perda: perda + perdaRegistrada, perdaRegistrada, porSetor, status, totalOfertas: ofertas.length }
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
        <Indicador rotulo="Perdas" valor={formatBRL(d.perda)} icone="TrendingDown" cor="var(--color-critical)" detalhe={d.perdaRegistrada > 0 ? `${formatBRL(d.perdaRegistrada)} já descartados; o resto está vencido na loja` : 'Valor dos vencidos ainda na loja'} />
        <Indicador rotulo="Ofertas criadas" valor={d.totalOfertas} icone="Tag" cor="var(--color-coral-dark)" />
      </div>

      <ListaTrocaPerda produtos={produtos} config={config} onBaixa={(produto, tipo) => setBaixa({ produto, tipo })} />
      <CadastroMarcas produtos={produtos} config={config} salvarConfig={salvarConfig} editavel={editavel} />
      <ModalBaixa pedido={baixa} onClose={() => setBaixa(null)} />

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

const REGRAS = {
  troca: { rotulo: 'Aceita troca', cor: '#1f5c99', bg: '#e3eefa' },
  perda: { rotulo: 'Sempre perda', cor: '#a61f1f', bg: '#fbe5e5' },
}

// Lista por setor do que está vencido ou perto de vencer e ainda precisa virar troca ou perda.
// A sugestão vem do cadastro de marcas logo abaixo.
function ListaTrocaPerda({ produtos, config, onBaixa }) {
  const dias = Number(config?.diasAlerta) || 7
  const grupos = useMemo(() => {
    const pendentes = produtos.filter((p) => precisaTrocaOuPerda(p, dias))
    return SETORES.map((s) => {
      const itens = pendentes.filter((p) => p.setor === s.id).sort((a, b) => String(a.validade).localeCompare(String(b.validade)))
      return { setor: s, itens, valor: itens.reduce((t, p) => t + (p.precoNormal || 0) * (p.estoque || 0), 0) }
    }).filter((g) => g.itens.length)
  }, [produtos, dias])
  const total = grupos.reduce((t, g) => t + g.itens.length, 0)

  return (
    <Secao
      titulo="Troca ou perda por setor"
      descricao={`Vencidos e o que vence em até ${dias} dias. A sugestão vem da marca: aceita troca ou sempre perda.`}
      acao={total > 0 && <span className="num-tab text-sm font-semibold text-ink-soft">{plural(total, 'produto', 'produtos')}</span>}
    >
      {total === 0 ? (
        <EmptyState icon="CircleCheck" titulo="Nada para trocar ou perder agora" descricao="Quando um produto vencer ou chegar perto, ele aparece aqui no setor dele." />
      ) : (
        <div className="space-y-5">
          {grupos.map((g) => (
            <div key={g.setor.id}>
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${g.setor.cor}1a`, color: g.setor.cor }}>
                  <Icon name={g.setor.icone} size={15} />
                </span>
                <h3 className="flex-1 text-[15px] font-bold text-ink">{g.setor.nome}</h3>
                <span className="num-tab text-sm text-ink-soft">{plural(g.itens.length, 'item', 'itens')} · {formatBRL(g.valor)}</span>
              </div>
              <ul className="divide-y divide-ink-soft/10 rounded-xl border border-ink-soft/15">
                {g.itens.map((p) => {
                  const regra = regraDaMarca(config, p.marca)
                  return (
                    <li key={p.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                      <ProdutoThumb produto={p} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-ink">{p.nome}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                          <StatusBadge validade={p.validade} />
                          <span className="num-tab">{formatData(p.validade)} · {p.estoque ?? 0} un</span>
                          {p.marca && <span>{p.marca}</span>}
                        </div>
                      </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0">
                      {regra
                        ? <Pill cor={REGRAS[regra].cor} bg={REGRAS[regra].bg}>{regra === 'troca' ? 'Sugestão: troca' : 'Sugestão: perda'}</Pill>
                        : <Pill>{p.marca ? 'Marca sem regra' : 'Sem marca'}</Pill>}
                      <div className="ml-auto flex gap-1.5">
                        <Acao tom="troca" ativo={regra === 'troca'} icone="Repeat" onClick={() => onBaixa(p, 'troca')} aria-label={`Registrar troca de ${p.nome}`}>Troca</Acao>
                        <Acao tom="perda" ativo={regra === 'perda'} icone="PackageX" onClick={() => onBaixa(p, 'perda')} aria-label={`Registrar perda de ${p.nome}`}>Perda</Acao>
                      </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Secao>
  )
}

// Cadastro das marcas: quais o fornecedor troca e quais são sempre perda.
function CadastroMarcas({ produtos, config, salvarConfig, editavel }) {
  const [busca, setBusca] = useState('')
  const [nova, setNova] = useState('')
  const [mostrarTodas, setMostrarTodas] = useState(false)
  const regras = config?.marcasTroca || {}
  const marcas = useMemo(() => {
    const m = new Map()
    for (const p of produtos) {
      const k = chaveMarca(p.marca)
      if (!k) continue
      const atual = m.get(k) || { chave: k, nome: String(p.marca).trim(), itens: 0, alerta: 0 }
      atual.itens++
      if (precisaTrocaOuPerda(p, Number(config?.diasAlerta) || 7)) atual.alerta++
      m.set(k, atual)
    }
    for (const [k, r] of Object.entries(regras)) if (!m.has(k)) m.set(k, { chave: k, nome: r.nome || k, itens: 0, alerta: 0 })
    return [...m.values()].sort((a, b) => b.alerta - a.alerta || (regras[a.chave] ? 1 : 0) - (regras[b.chave] ? 1 : 0) || a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [produtos, regras, config?.diasAlerta])
  const b = chaveMarca(busca)
  const filtradas = marcas.filter((m) => !b || m.chave.includes(b))
  const visiveis = mostrarTodas || b ? filtradas : filtradas.slice(0, 12)
  const definidas = Object.values(regras).filter((r) => r.regra)
  const nTroca = definidas.filter((r) => r.regra === 'troca').length

  const definir = (marca, regra) => {
    const proximo = { ...regras }
    if (!regra) delete proximo[marca.chave]
    else proximo[marca.chave] = { nome: marca.nome, regra }
    salvarConfig({ marcasTroca: proximo })
  }
  const adicionar = (e) => {
    e.preventDefault()
    const k = chaveMarca(nova)
    if (!k) return
    if (!regras[k]) salvarConfig({ marcasTroca: { ...regras, [k]: { nome: nova.trim(), regra: 'troca' } } })
    setNova('')
    setBusca(nova.trim())
  }

  return (
    <Secao
      titulo="Marcas: troca ou perda"
      descricao="Diga quais marcas o fornecedor troca quando vencem e quais são sempre perda. A lista acima e a aba Produtos usam isso para sugerir."
      acao={<span className="num-tab text-sm font-semibold text-ink-soft">{nTroca} trocam · {definidas.length - nTroca} perda</span>}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1 basis-full sm:basis-0">
          <Icon name="Search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar marca" aria-label="Procurar marca" className={`${inputCls} pl-9`} />
        </div>
        {editavel && (
          <form onSubmit={adicionar} className="flex min-w-0 flex-1 basis-full gap-2 sm:basis-0">
            <input value={nova} onChange={(e) => setNova(e.target.value)} placeholder="Marca que ainda não tem produto" aria-label="Nova marca" className={`${inputCls} min-w-0`} />
            <Acao type="submit" icone="Plus">Adicionar</Acao>
          </form>
        )}
      </div>
      {filtradas.length === 0 ? (
        <p className="text-sm text-ink-soft">Nenhuma marca encontrada. Cadastre produtos com a marca preenchida ou adicione a marca acima.</p>
      ) : (
        <ul className="divide-y divide-ink-soft/10 rounded-xl border border-ink-soft/15">
          {visiveis.map((m) => (
            <li key={m.chave} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-ink">{m.nome}</div>
                <div className="text-xs text-ink-soft">
                  {plural(m.itens, 'produto', 'produtos')}{m.alerta > 0 && <span className="font-semibold text-[#a61f1f]"> · {m.alerta} para resolver</span>}
                </div>
              </div>
              <Segmentado
                rotulo={`Regra da marca ${m.nome}`}
                disabled={!editavel}
                valor={regras[m.chave]?.regra || ''}
                onChange={(v) => definir(m, v)}
                opcoes={[['troca', 'Aceita troca'], ['perda', 'Sempre perda'], ['', 'Não sei']]}
              />
            </li>
          ))}
        </ul>
      )}
      {!mostrarTodas && !b && filtradas.length > 12 && (
        <button type="button" onClick={() => setMostrarTodas(true)} className="mt-3 text-sm font-semibold text-navy underline underline-offset-2">
          Ver todas as {filtradas.length} marcas
        </button>
      )}
    </Secao>
  )
}
