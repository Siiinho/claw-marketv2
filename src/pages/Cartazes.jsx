import { useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/StoreContext'
import { Icon, ProdutoThumb, EmptyState, Botao, PrecoVarejo, SeloDesconto } from '../components/ui'
import { setorById, formatBRL, percentDesc, formatData, dataISOmaisDias } from '../lib/utils'
import { exportarPNG } from '../lib/exportar'

const MODELOS = [
  { id: 'oficial', nome: 'Bengala Oficial', fundo: '#141414', faixa: '#000000', destaque: '#ffd23f', texto: '#ffffff', borda: '#d4a94e' },
  { id: 'classico', nome: 'Bengala Clássico', fundo: '#7a241b', faixa: '#e23a2e', destaque: '#f47b36', texto: '#fbf6ee', borda: 'transparent' },
  { id: 'vermelho', nome: 'Vermelho Vivo', fundo: '#e23a2e', faixa: '#c42e23', destaque: '#ffd23f', texto: '#ffffff', borda: 'transparent' },
  { id: 'minimal', nome: 'Minimalista', fundo: '#ffffff', faixa: '#f3ead9', destaque: '#e23a2e', texto: '#2a1a16', borda: '#e6ddcd' },
]

export default function Cartazes() {
  const navigate = useNavigate()
  const { produtos, fila, ofertaDoProduto, toast } = useStore()
  const ref = useRef(null)
  const [modo, setModo] = useState('unico') // unico | placa
  const [modelo, setModelo] = useState(MODELOS[0])
  const [exportando, setExportando] = useState(false)

  const elegiveis = useMemo(
    () => produtos.filter((p) => p.precoPromo || ofertaDoProduto(p.id) || p.naFila),
    [produtos, ofertaDoProduto]
  )
  const [sel, setSel] = useState(elegiveis[0]?.id || null)
  const [selMulti, setSelMulti] = useState(() => new Set(fila.slice(0, 4).map((p) => p.id)))

  const produto = elegiveis.find((p) => p.id === sel) || elegiveis[0]
  const produtosPlaca = elegiveis.filter((p) => selMulti.has(p.id)).slice(0, 8)

  const precoNovo = (p) => {
    const o = ofertaDoProduto(p.id)
    if (o) return p.precoNormal * (1 - o.desconto / 100)
    return p.precoPromo ?? p.precoNormal * 0.7
  }
  const descDe = (p) => ofertaDoProduto(p.id)?.desconto ?? percentDesc(p.precoNormal, precoNovo(p))

  const toggleMulti = (id) =>
    setSelMulti((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const salvar = async () => {
    setExportando(true)
    try {
      await exportarPNG(ref.current, modo === 'placa' ? 'placa-ofertas-bengala' : `cartaz-${produto?.nome?.slice(0, 20) || 'bengala'}`)
      toast(modo === 'placa' ? 'Placa de ofertas exportada!' : 'Cartaz exportado em PNG!')
    } catch (e) {
      toast('Erro ao exportar.', 'erro')
    }
    setExportando(false)
  }

  if (elegiveis.length === 0) {
    return (
      <EmptyState
        icon="Image"
        titulo="Nenhum produto elegível"
        descricao="Bipe um produto e confirme a validade para criar o cartaz ou adicioná-lo ao jornal."
        acao={
          <div className="flex flex-wrap justify-center gap-2">
            <Botao onClick={() => navigate('/scanner')}><Icon name="ScanLine" size={16} /> Escanear produto</Botao>
            <Botao variante="contorno" onClick={() => navigate('/ofertas')}><Icon name="Tag" size={16} /> Ver ofertas</Botao>
          </div>
        }
      />
    )
  }

  const minimal = modelo.id === 'minimal'
  const oficial = modelo.id === 'oficial'

  return (
    <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
      {/* coluna esquerda */}
      <div className="space-y-4">
        {/* modo */}
        <div className="card-bengala flex gap-1.5 p-2">
          {[['unico', 'Cartaz único', 'Image'], ['placa', 'Placa de ofertas', 'LayoutGrid']].map(([id, l, ic]) => (
            <button
              key={id}
              onClick={() => setModo(id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition ${modo === id ? 'bg-bengala text-cream' : 'text-ink-soft hover:bg-cream-200'}`}
            >
              <Icon name={ic} size={15} /> {l}
            </button>
          ))}
        </div>

        <div className="card-bengala p-3">
          <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-ink-soft">
            {modo === 'placa' ? `Produtos da placa (${produtosPlaca.length}/8)` : 'Produtos elegíveis'}
          </p>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {elegiveis.map((p) => {
              const marcado = modo === 'placa' ? selMulti.has(p.id) : sel === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => (modo === 'placa' ? toggleMulti(p.id) : setSel(p.id))}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left ${marcado ? 'bg-bengala/10 ring-1 ring-bengala/30' : 'hover:bg-cream-200'}`}
                >
                  {modo === 'placa' && (
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${marcado ? 'border-bengala bg-bengala text-white' : 'border-ink-soft/30'}`}>
                      {marcado && <Icon name="Check" size={11} />}
                    </span>
                  )}
                  <ProdutoThumb produto={p} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{p.nome}</div>
                    <div className="text-xs text-ink-soft"><span className="line-through">{formatBRL(p.precoNormal)}</span> → {formatBRL(precoNovo(p))}</div>
                  </div>
                  <span className="rounded bg-coral px-1.5 py-0.5 text-xs font-bold text-white">-{descDe(p)}%</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="card-bengala p-3">
          <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-ink-soft">Modelo</p>
          <div className="stagger grid grid-cols-2 gap-2">
            {MODELOS.map((m) => (
              <button key={m.id} onClick={() => setModelo(m)} className={`rounded-lg border-2 p-2 text-left ${modelo.id === m.id ? 'border-bengala' : 'border-transparent hover:border-ink-soft/20'}`}>
                <div className="mb-1 flex gap-1">
                  <span className="h-4 w-4 rounded" style={{ background: m.fundo, border: '1px solid #0002' }} />
                  <span className="h-4 w-4 rounded" style={{ background: m.faixa, border: '1px solid #0002' }} />
                  <span className="h-4 w-4 rounded" style={{ background: m.destaque }} />
                </div>
                <span className="text-xs font-medium text-ink">{m.nome}</span>
              </button>
            ))}
          </div>
        </div>

        <Botao onClick={salvar} disabled={exportando || (modo === 'placa' && produtosPlaca.length === 0)} className="w-full">
          <Icon name="Download" size={16} /> {exportando ? 'Gerando...' : 'Salvar PNG'}
        </Botao>
      </div>

      {/* preview */}
      <div className="flex justify-center">
        {modo === 'unico' && produto && (
          <div ref={ref} className="h-fit w-full max-w-sm overflow-hidden rounded-2xl" style={{ background: modelo.fundo, color: modelo.texto, border: `1.5px solid ${modelo.borda}` }}>
            <div className="px-5 py-3 text-center" style={{ background: modelo.faixa, borderBottom: oficial ? '1px solid #d4a94e' : 'none' }}>
              <div className="text-lg font-bold" style={{ color: minimal ? '#7a241b' : oficial ? '#ffd23f' : modelo.texto }}>Bengala Supermercado</div>
              <div className="text-xs font-bold italic tracking-wide" style={{ color: minimal ? '#6b5a54' : oficial ? '#ff4436' : modelo.texto, opacity: oficial ? 1 : 0.85 }}>SUPER OFERTA!</div>
            </div>

            <div className="px-6 py-6 text-center">
              <div className="text-sm font-medium" style={{ opacity: 0.85 }}>{setorById(produto.setor).nome}</div>
              <div className="mb-4 text-xl font-bold uppercase">{produto.nome}</div>

              <div className="relative mx-auto mb-4 flex h-36 w-36 items-center justify-center rounded-2xl bg-white p-2">
                <ProdutoThumb produto={produto} size={116} />
                <SeloDesconto texto={`-${descDe(produto)}%`} size={62} className="absolute -right-4 -top-4" />
              </div>

              <div className="text-sm line-through" style={{ opacity: 0.7 }}>de {formatBRL(produto.precoNormal)}</div>
              <div className="mt-1 inline-block rotate-[-2deg] rounded-lg bg-white px-4 py-1" style={{ boxShadow: '3px 3px 0 rgba(0,0,0,0.25)' }}>
                <PrecoVarejo valor={precoNovo(produto)} className="text-5xl" cor="#c42b2b" />
              </div>
              <div className="mt-2 text-sm" style={{ opacity: 0.85 }}>{produto.estoque} unidades disponíveis</div>
            </div>

            <div className="px-6 pb-5 text-center">
              <div className="mx-auto inline-block rounded bg-white px-4 py-1.5">
                <div className="font-mono text-xs tracking-widest text-ink">{produto.codigoBarras}</div>
              </div>
            </div>
          </div>
        )}

        {modo === 'placa' && (
          <div ref={ref} className="h-fit w-full max-w-sm overflow-hidden rounded-2xl" style={{ background: '#141414', border: '1.5px solid #d4a94e' }}>
            {/* cabeçalho da placa */}
            <div className="px-4 pb-2 pt-4 text-center">
              <div className="flex items-center justify-center gap-3">
                <Logo h={40} chip />
                <div className="text-left leading-none">
                  <div className="text-[11px] italic text-white">Aproveite as nossas...</div>
                  <div className="text-[26px] font-extrabold italic tracking-tight" style={{ color: '#ffd23f', textShadow: '2px 2px 0 #c42b2b' }}>OFERTAS!</div>
                </div>
              </div>
              <div className="mx-auto mt-2 inline-block rounded-full px-3 py-0.5 text-[10px] font-bold text-white" style={{ background: 'linear-gradient(90deg, #9e1f14, #e23a2e, #9e1f14)' }}>
                VÁLIDO ATÉ {formatData(dataISOmaisDias(3))}
              </div>
            </div>

            {produtosPlaca.length === 0 ? (
              <div className="p-8 text-center text-sm" style={{ color: '#b8a99f' }}>Marque produtos na lista ao lado.</div>
            ) : (
              <div className={`grid gap-2 p-3 ${produtosPlaca.length <= 2 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {produtosPlaca.map((p) => (
                  <div key={p.id} className="relative rounded-lg px-2 pb-2.5 pt-3 text-center" style={{ background: '#211c15', border: '1px solid #4a3f2c' }}>
                    <SeloDesconto texto={`-${descDe(p)}%`} size={40} className="absolute -right-1.5 -top-2 z-10" />
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-white p-1">
                      <ProdutoThumb produto={p} size={56} />
                    </div>
                    <div className="mt-1 min-h-[22px] text-[9px] font-semibold uppercase leading-tight text-white">{p.nome}</div>
                    <div className="text-[9px] line-through" style={{ color: '#9b8b83' }}>{formatBRL(p.precoNormal)}</div>
                    <div className="mt-0.5 inline-block rotate-[-2deg] rounded-md bg-white px-2.5 py-0.5" style={{ boxShadow: '2px 2px 0 #c42b2b' }}>
                      <PrecoVarejo valor={precoNovo(p)} className="text-2xl" cor="#c42b2b" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between px-4 py-2" style={{ background: '#000', borderTop: '1px solid #d4a94e' }}>
              <div className="text-[8px]" style={{ color: '#b8a99f' }}>Ofertas válidas enquanto durar o estoque.</div>
              <div className="text-[9px] font-bold" style={{ color: '#ffd23f' }}>BENGALA SUPERMERCADO</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
