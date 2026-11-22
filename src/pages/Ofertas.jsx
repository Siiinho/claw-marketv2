import { useState, useMemo } from 'react'
import { useStore, podeEditar } from '../store/StoreContext'
import { Icon, PrecoVarejo, ProdutoThumb, EmptyState, Botao, Modal, Campo, inputCls, Pill, Secao } from '../components/ui'
import { setorById, diasParaVencer, formatBRL, percentDesc, dataISOmaisDias, formatData, regraDoProduto, plural } from '../lib/utils'

export default function Ofertas() {
  const { produtos, ofertas, usuario, config, criarOferta, adicionarNaFila, toggleOferta, excluirOferta, toast } = useStore()
  const editavel = podeEditar(usuario.papel)
  const [modal, setModal] = useState(null) // { produtoId, titulo, desconto, validade }

  const produtoDe = (id) => produtos.find((p) => p.id === id)

  const sugestoes = useMemo(() => {
    const comOferta = new Set(ofertas.filter((o) => o.ativa).map((o) => o.produtoId))
    return produtos
      .filter((p) => {
        const d = diasParaVencer(p.validade)
        return d != null && d >= 0 && d <= 5 && !comOferta.has(p.id)
      })
      .sort((a, b) => diasParaVencer(a.validade) - diasParaVencer(b.validade))
      .slice(0, 4)
  }, [produtos, ofertas])

  const descontoSugerido = (p) => {
    if (config.usarRegrasNasSugestoes) {
      const r = regraDoProduto(diasParaVencer(p.validade), config.regrasPreco || [])
      if (r) return r.desconto
    }
    return config.descontoPadrao || 30
  }

  const criarRapida = (p) => {
    const desc = descontoSugerido(p)
    criarOferta(p.id, `Oferta ${desc}% · vencimento`, desc, dataISOmaisDias(7))
    adicionarNaFila(p.id, 'oferta')
    toast(`Oferta de ${desc}% criada e adicionada ao jornal para ${p.nome}!`)
  }

  const abrirNova = () =>
    setModal({ produtoId: produtos[0]?.id || '', titulo: '', desconto: config.descontoPadrao || 30, validade: dataISOmaisDias(7) })

  const salvarOferta = () => {
    if (!modal.produtoId) return toast('Selecione um produto.', 'erro')
    const p = produtoDe(modal.produtoId)
    criarOferta(modal.produtoId, modal.titulo || `Oferta ${modal.desconto}%`, Number(modal.desconto), modal.validade)
    adicionarNaFila(modal.produtoId, 'oferta')
    toast(`Oferta criada e adicionada à fila do jornal para ${p.nome}!`)
    setModal(null)
  }

  const precoCalc = (normal, desc) => normal * (1 - desc / 100)

  return (
    <div className="space-y-5">
      {/* sugestões automáticas */}
      {config.sugestoesAuto && sugestoes.length > 0 && editavel && (
        <Secao
          titulo="Sugestões para hoje"
          descricao="Produtos perto do vencimento que ainda não têm oferta. Toque para criar."
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {sugestoes.map((p) => (
              <button
                key={p.id}
                onClick={() => criarRapida(p)}
                className="flex min-w-0 items-center gap-3 rounded-xl border border-ink-soft/20 bg-white p-2.5 text-left hover:border-ink-soft/45"
              >
                <ProdutoThumb produto={p} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="break-words text-sm font-semibold leading-snug text-ink">{p.nome}</div>
                  <div className="text-xs text-ink-soft">Desconto sugerido de {descontoSugerido(p)}%</div>
                </div>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bengala text-white"><Icon name="Plus" size={16} strokeWidth={2.25} /></span>
              </button>
            ))}
          </div>
        </Secao>
      )}

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-navy">{ofertas.length ? plural(ofertas.length, 'oferta', 'ofertas') : 'Ofertas'}</h2>
        {editavel && <Botao onClick={abrirNova}><Icon name="Plus" size={16} /> Nova oferta</Botao>}
      </div>

      {ofertas.length === 0 ? (
        <EmptyState
          icon="Tag"
          titulo="Nenhuma oferta criada"
          descricao="Use as sugestões automáticas ou crie uma oferta manualmente."
          acao={editavel && <Botao onClick={abrirNova}><Icon name="Plus" size={16} /> Nova oferta</Botao>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ofertas.map((o) => {
            const p = produtoDe(o.produtoId)
            if (!p) return null
            const novo = precoCalc(p.precoNormal, o.desconto)
            return (
              <div key={o.id} className="card-bengala card-int overflow-hidden">
                <div className="relative flex items-center justify-center bg-cream py-6">
                  <span className="num-tab absolute left-3 top-3 rounded-full bg-bengala px-2.5 py-1 text-sm font-bold text-white">
                    -{o.desconto}%
                  </span>
                  <span className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-xs font-semibold ${o.ativa ? 'bg-success/15 text-[#1c6e48]' : 'bg-ink-soft/15 text-ink-soft'}`}>
                    {o.ativa ? 'Ativa' : 'Inativa'}
                  </span>
                  <ProdutoThumb produto={p} size={72} />
                </div>
                <div className="p-4">
                  <div className="break-words font-semibold leading-snug text-ink">{p.nome}</div>
                  <div className="text-xs text-ink-soft">{o.titulo}</div>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="text-sm text-ink-soft line-through">{formatBRL(p.precoNormal)}</span>
                    <PrecoVarejo valor={novo} className="text-2xl text-bengala" />
                  </div>
                  <div className="mt-1 text-xs text-ink-soft">Válida até {formatData(o.validade)}</div>
                  {editavel && (
                    <div className="mt-3 flex gap-2">
                      <Botao variante="contorno" className="flex-1" onClick={() => toggleOferta(o.id)}>
                        <Icon name={o.ativa ? 'Pause' : 'Play'} size={15} /> {o.ativa ? 'Pausar' : 'Ativar'}
                      </Botao>
                      <button type="button" aria-label={`Excluir oferta de ${p.nome}`} className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-soft hover:bg-critical/10 hover:text-critical" onClick={() => { excluirOferta(o.id); toast('Oferta excluída.', 'info') }}>
                        <Icon name="Trash2" size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* modal nova oferta */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        titulo="Nova oferta"
        footer={<><Botao variante="contorno" onClick={() => setModal(null)}>Cancelar</Botao><Botao onClick={salvarOferta}>Criar oferta</Botao></>}
      >
        {modal && (() => {
          const p = produtoDe(modal.produtoId)
          const novo = p ? precoCalc(p.precoNormal, modal.desconto) : 0
          return (
            <div className="space-y-4">
              <Campo label="Produto" obrigatorio>
                <select className={inputCls} value={modal.produtoId} onChange={(e) => setModal({ ...modal, produtoId: e.target.value })}>
                  {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome} — {formatBRL(p.precoNormal)}</option>)}
                </select>
              </Campo>
              <Campo label="Título da oferta"><input className={inputCls} value={modal.titulo} placeholder="Ex.: Oferta relâmpago" onChange={(e) => setModal({ ...modal, titulo: e.target.value })} /></Campo>
              <div>
                <div className="mb-1 flex items-center justify-between text-sm font-medium">
                  <span>Desconto</span>
                  <span className="text-bengala">{modal.desconto}%</span>
                </div>
                <input type="range" min="5" max="80" step="5" value={modal.desconto} onChange={(e) => setModal({ ...modal, desconto: Number(e.target.value) })} className="w-full accent-navy" />
                {p && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-cream-200 px-3 py-2">
                    <span className="text-sm text-ink-soft line-through">{formatBRL(p.precoNormal)}</span>
                    <Icon name="ArrowRight" size={14} className="text-ink-soft" />
                    <PrecoVarejo valor={novo} className="text-xl text-bengala" />
                  </div>
                )}
              </div>
              <Campo label="Válida até"><input type="date" className={inputCls} value={modal.validade} onChange={(e) => setModal({ ...modal, validade: e.target.value })} /></Campo>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
