import { useEffect, useRef, useState } from 'react'
import { Logo, PrecoVarejo } from './ui'
import { formatData, seloDoProduto, setorById } from '../lib/utils'

// Página do encarte no formato dos templates de supermercado (post 4:5, 1080 × 1350):
//  - topo da campanha: logo, título grande, chamada, faixa de validade e endereço;
//  - grade 3 × 3 de produtos: nome no alto, foto no meio, preço em selo oval embaixo à direita.
// Com `fundo` (imagem do template exportada SEM os produtos), a arte do template vira o
// fundo da página e o sistema só posiciona logo, validade e produtos por cima.
// A página é desenhada em 1080 px e escalada para a largura disponível (celular e PC).

export const LARGURA = 1080
export const ALTURA = 1350
const TOPO = 470
const MARGEM = 36
const GAP = 18

export function produtosPorPagina(layout) {
  return layout === 'destaque' ? 8 : 9
}

export function paginarTemplate(itens, layout) {
  const n = produtosPorPagina(layout)
  const paginas = []
  for (let i = 0; i < itens.length; i += n) paginas.push(itens.slice(i, i + n))
  return paginas.length ? paginas : [[]]
}

// Escala o conteúdo de 1080 px para caber na largura do contêiner.
export function Escalado({ children, maxLargura = LARGURA }) {
  const ref = useRef(null)
  const [escala, setEscala] = useState(0.35)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const medir = () => setEscala(Math.min(el.clientWidth, maxLargura) / LARGURA)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [maxLargura])
  return (
    <div ref={ref} className="w-full min-w-0 overflow-hidden">
      <div className="mx-auto overflow-hidden" style={{ width: LARGURA * escala, height: ALTURA * escala }}>
        <div style={{ width: LARGURA, height: ALTURA, transform: `scale(${escala})`, transformOrigin: 'top left' }}>{children}</div>
      </div>
    </div>
  )
}

const contornoTexto = (cor, px = 4) =>
  [`-${px}px -${px}px 0 ${cor}`, `${px}px -${px}px 0 ${cor}`, `-${px}px ${px}px 0 ${cor}`, `${px}px ${px}px 0 ${cor}`, `0 ${px * 2}px 0 ${cor}`].join(', ')

function unidadeDe(produto) {
  if (produto.unidade) return produto.unidade
  return produto.setor === 'hortifruti' ? 'KG' : 'UNI'
}

function SeloPrecoOval({ produto, tema, grande }) {
  const w = grande ? 270 : 186
  const h = grande ? 132 : 92
  return (
    <div
      className="absolute flex items-center justify-center"
      style={{
        right: 8, bottom: 8, width: w, height: h, borderRadius: '50%',
        background: tema.precoFundo, boxShadow: `5px 7px 0 ${tema.precoSombra}`,
        border: `4px solid ${tema.precoSombra}`, transform: 'rotate(-4deg)',
      }}
    >
      <div className="flex items-end leading-none">
        <PrecoVarejo valor={produto.precoJornal} className={grande ? 'text-[68px]' : 'text-[46px]'} cor={tema.precoCor} />
        <span className="mb-1 ml-1 font-black" style={{ fontSize: grande ? 20 : 15, color: tema.precoCor }}>{unidadeDe(produto)}</span>
      </div>
    </div>
  )
}

function CelulaProduto({ produto, tema, grande, onAbrir, estilo }) {
  const selo = seloDoProduto(produto)
  const setor = setorById(produto.setor)
  return (
    <button
      type="button"
      onClick={() => onAbrir?.(produto)}
      aria-label={`Ver oferta: ${produto.nome}`}
      className="absolute overflow-hidden text-left focus:outline-none focus-visible:ring-8 focus-visible:ring-white"
      style={{ ...estilo, borderRadius: 22, background: tema.celula || 'rgba(255,255,255,.92)', boxShadow: '0 6px 0 rgba(0,0,0,.18)' }}
    >
      <div
        className="absolute left-0 right-0 top-0 px-4 pt-3 text-center font-black uppercase leading-[1.05]"
        style={{ color: tema.nomeCor || '#111', fontSize: grande ? 28 : 20, height: grande ? 74 : 52, overflow: 'hidden' }}
      >
        {produto.nome}
      </div>
      {produto.imagem ? (
        <img
          src={produto.imagem}
          alt=""
          className="absolute object-contain"
          style={grande
            ? { left: 20, top: 80, width: 'calc(100% - 40px)', height: 'calc(100% - 100px)' }
            : { left: 10, top: 54, width: 'calc(100% - 20px)', height: 'calc(100% - 64px)' }}
        />
      ) : (
        <div className="absolute inset-x-0 text-center font-black" style={{ top: grande ? 160 : 90, fontSize: grande ? 120 : 70, color: setor.cor }}>•</div>
      )}
      <span
        className="absolute rounded-lg px-2.5 py-1 font-black uppercase leading-none"
        style={{ left: 8, top: grande ? 80 : 54, fontSize: grande ? 20 : 14, background: selo.fundo, color: selo.cor, transform: 'rotate(-4deg)' }}
      >
        {selo.texto}
      </span>
      <SeloPrecoOval produto={produto} tema={tema} grande={grande} />
    </button>
  )
}

function posicoesGrade(layout, quantidade) {
  const larg = (LARGURA - MARGEM * 2 - GAP * 2) / 3
  const alt = (ALTURA - TOPO - MARGEM - GAP * 2) / 3
  const x = (col) => MARGEM + col * (larg + GAP)
  const y = (lin) => TOPO + lin * (alt + GAP)
  const cel = (col, lin, cols = 1, lins = 1) => ({
    left: x(col), top: y(lin), width: larg * cols + GAP * (cols - 1), height: alt * lins + GAP * (lins - 1), grande: cols > 1 || lins > 1,
  })
  if (layout === 'destaque') {
    return [cel(0, 0, 1, 2), cel(1, 0), cel(2, 0), cel(1, 1), cel(2, 1), cel(0, 2), cel(1, 2), cel(2, 2)].slice(0, Math.max(quantidade, 1))
  }
  const todas = []
  for (let lin = 0; lin < 3; lin += 1) for (let col = 0; col < 3; col += 1) todas.push(cel(col, lin))
  // poucas ofertas: as células crescem para preencher a grade
  if (quantidade === 1) return [cel(0, 0, 3, 3)]
  if (quantidade === 2) return [cel(0, 0, 3, 1.5 + 0), cel(0, 1.5, 3, 1.5)].map((c) => ({ ...c, top: c.top, grande: true }))
  return todas.slice(0, quantidade)
}

export default function PaginaTemplate({ tema, itens, encarte, loja, fundo, layout = 'grade', numero, total, onAbrir }) {
  const contorno = contornoTexto(tema.contorno)
  const posicoes = posicoesGrade(layout, itens.length)
  return (
    <div className="relative overflow-hidden" style={{ width: LARGURA, height: ALTURA, background: tema.fundo, fontFamily: 'var(--font-sans)' }}>
      {fundo && <img src={fundo} alt="" className="absolute inset-0 h-full w-full object-cover" />}

      {/* topo da campanha */}
      <div className="absolute left-0 right-0 top-0" style={{ height: TOPO }}>
        <div className="absolute rounded-2xl bg-white p-3" style={{ left: MARGEM, top: 32, boxShadow: '0 6px 0 rgba(0,0,0,.2)' }}>
          <Logo h={96} />
        </div>
        {!fundo && (
          <div className="absolute text-center italic" style={{ left: MARGEM, right: MARGEM, top: 140 }}>
            <div className="font-black uppercase leading-[0.9] tracking-tight" style={{ fontSize: 118, color: tema.corTitulo, textShadow: contorno }}>{tema.titulo}</div>
            <div className="font-black uppercase leading-[0.95] tracking-tight" style={{ fontSize: 100, color: tema.corDestaque, textShadow: contorno }}>{tema.destaque}</div>
          </div>
        )}
        {!fundo && (
          <div className="absolute text-right font-black uppercase leading-tight text-white" style={{ right: MARGEM, top: 44, width: 560, fontSize: 30, textShadow: contornoTexto(tema.contorno, 2) }}>
            {tema.chamada}
          </div>
        )}
        <div className="absolute flex items-end justify-between gap-4" style={{ left: MARGEM, right: MARGEM, bottom: 18 }}>
          {encarte?.periodoDe && (
            <div className="rounded-xl px-5 py-2.5 font-black uppercase leading-tight" style={{ background: tema.faixa, color: tema.faixaTexto, fontSize: 24 }}>
              Ofertas válidas de {formatData(encarte.periodoDe)} a {formatData(encarte.periodoAte)}
              <div style={{ fontSize: 17 }}>ou enquanto durarem os estoques</div>
            </div>
          )}
          {loja && (loja.endereco || loja.whatsapp) && (
            <div className="rounded-xl bg-black/45 px-5 py-2.5 text-right font-bold leading-tight text-white" style={{ fontSize: 20 }}>
              {loja.endereco && <div>{loja.endereco}{loja.cidade ? ` · ${loja.cidade}` : ''}</div>}
              {loja.whatsapp && <div className="font-black" style={{ fontSize: 24 }}>WhatsApp {loja.whatsapp}</div>}
            </div>
          )}
        </div>
      </div>

      {numero && total > 1 && (
        <div className="absolute rounded-full bg-black/50 px-3 py-1 text-[18px] font-black text-white" style={{ right: 12, bottom: 6, zIndex: 2 }}>
          {numero}/{total}
        </div>
      )}

      {/* grade de produtos */}
      {itens.map((p, i) => {
        const pos = posicoes[i]
        if (!pos) return null
        const { grande, ...estilo } = pos
        return <CelulaProduto key={p.id || i} produto={p} tema={tema} grande={grande} onAbrir={onAbrir} estilo={estilo} />
      })}
    </div>
  )
}
