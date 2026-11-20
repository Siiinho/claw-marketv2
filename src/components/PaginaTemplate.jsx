import { useEffect, useRef, useState } from 'react'
import { Logo, PrecoVarejo } from './ui'
import { formatBRL, formatData, seloDoProduto, setorById } from '../lib/utils'

// Motor de templates do encarte: a mesma lista de ofertas vira várias artes.
//  - Feed 4:5 (1080 × 1350), Stories 9:16 (1080 × 1920), TV 16:9 (1920 × 1080)
//    e Post por oferta 1:1 (1080 × 1080, um produto por arte).
//  - Topo da campanha: logo, título grande, chamada, faixa de validade e endereço.
//  - Grade de produtos: nome no alto, foto no meio, preço em selo oval embaixo à direita.
// Com `fundo` (imagem do template exportada SEM os produtos), a arte do template vira o
// fundo da página no formato Feed e o sistema só posiciona logo, validade e produtos por cima.
// Cada arte é desenhada no tamanho real e escalada para a tela (celular e PC).

export const FORMATOS = {
  feed: { id: 'feed', nome: 'Feed', proporcao: '4:5', uso: 'Instagram e Facebook', icone: 'RectangleVertical', largura: 1080, altura: 1350, topo: 470, cols: 3, lins: 3, tituloTop: 140, titulo: 118, destaque: 100 },
  stories: { id: 'stories', nome: 'Stories', proporcao: '9:16', uso: 'Status do WhatsApp e Stories', icone: 'Smartphone', largura: 1080, altura: 1920, topo: 620, cols: 2, lins: 3, tituloTop: 190, titulo: 136, destaque: 116 },
  tv: { id: 'tv', nome: 'TV', proporcao: '16:9', uso: 'TV da loja e telão', icone: 'Tv', largura: 1920, altura: 1080, topo: 300, cols: 4, lins: 2, compacto: true, titulo: 124 },
  post: { id: 'post', nome: 'Post por oferta', proporcao: '1:1', uso: 'Uma arte para cada produto', icone: 'Square', largura: 1080, altura: 1080, topo: 300, cols: 1, lins: 1, compacto: true, titulo: 96 },
}

export const formatoById = (id) => FORMATOS[id] || FORMATOS.feed

// Compatibilidade: o formato Feed continua sendo o padrão do encarte digital.
export const LARGURA = FORMATOS.feed.largura
export const ALTURA = FORMATOS.feed.altura
const MARGEM = 36
const GAP = 18
// Célula de referência (Feed 3 × 3): tudo dentro da célula escala a partir dela.
const CELULA_BASE = { w: 324, h: 269 }

const temDestaque = (f, layout) => layout === 'destaque' && f.cols >= 2 && f.lins >= 2

export function produtosPorPagina(layout, formatoId = 'feed') {
  const f = formatoById(formatoId)
  return f.cols * f.lins - (temDestaque(f, layout) ? 1 : 0)
}

export function paginarTemplate(itens, layout, formatoId = 'feed') {
  const n = produtosPorPagina(layout, formatoId)
  const paginas = []
  for (let i = 0; i < itens.length; i += n) paginas.push(itens.slice(i, i + n))
  return paginas.length ? paginas : [[]]
}

// Escala o conteúdo desenhado em tamanho real para caber na largura do contêiner.
export function Escalado({ children, largura = LARGURA, altura = ALTURA, maxLargura = largura }) {
  const ref = useRef(null)
  const [escala, setEscala] = useState(0.3)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const medir = () => setEscala(Math.min(el.clientWidth, maxLargura) / largura)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [maxLargura, largura])
  return (
    <div ref={ref} className="w-full min-w-0 overflow-hidden">
      <div className="mx-auto overflow-hidden" style={{ width: largura * escala, height: altura * escala }}>
        <div style={{ width: largura, height: altura, transform: `scale(${escala})`, transformOrigin: 'top left' }}>{children}</div>
      </div>
    </div>
  )
}

const contornoTexto = (cor, px = 4) =>
  [`-${px}px -${px}px 0 ${cor}`, `${px}px -${px}px 0 ${cor}`, `-${px}px ${px}px 0 ${cor}`, `${px}px ${px}px 0 ${cor}`, `0 ${px * 2}px 0 ${cor}`].join(', ')

// Tamanho de fonte para um texto em caixa alta pesada caber numa largura.
export const fonteQueCabe = (texto, largura, max, fator = 0.62) =>
  Math.min(max, largura / Math.max(1, String(texto || '').length * fator))

export function unidadeDe(produto) {
  if (produto.unidade) return produto.unidade
  return produto.setor === 'hortifruti' ? 'KG' : 'UNI'
}

const temDesconto = (p) => Number(p.precoNormal) > Number(p.precoJornal) + 0.009

function SeloPrecoOval({ produto, tema, k }) {
  const w = 186 * k
  const h = 92 * k
  // Sombra desenhada como elemento próprio: o box-shadow sai errado na exportação em PNG.
  return (
    <div className="absolute" style={{ right: 8 * k + 5 * k, bottom: 8 * k + 7 * k, width: w, height: h, transform: 'rotate(-4deg)' }}>
      <div className="absolute" style={{ left: 5 * k, top: 7 * k, width: w, height: h, borderRadius: '50%', background: tema.precoSombra }} />
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ borderRadius: '50%', background: tema.precoFundo, border: `${4 * k}px solid ${tema.precoSombra}` }}
      >
        <div className="flex items-end leading-none">
          <PrecoVarejo valor={produto.precoJornal} style={{ fontSize: 46 * k }} cor={tema.precoCor} />
          <span className="ml-1 font-black" style={{ marginBottom: 4 * k, fontSize: 15 * k, color: tema.precoCor }}>{unidadeDe(produto)}</span>
        </div>
      </div>
    </div>
  )
}

function CelulaProduto({ produto, tema, onAbrir, estilo }) {
  const selo = seloDoProduto(produto)
  const setor = setorById(produto.setor)
  // Fator de escala da célula: cresce com a área, sem deixar o selo de preço sair da célula.
  const k = Math.max(0.8, Math.min(2.6,
    Math.sqrt((estilo.width * estilo.height) / (CELULA_BASE.w * CELULA_BASE.h)),
    estilo.width / 300,
    estilo.height / 220,
  ))
  const topoFoto = 54 * k
  const raio = 22 * Math.min(k, 1.6)
  return (
    <>
    <div aria-hidden="true" className="absolute" style={{ left: estilo.left, top: estilo.top + 6, width: estilo.width, height: estilo.height, borderRadius: raio, background: 'rgba(0,0,0,.18)' }} />
    <button
      type="button"
      onClick={() => onAbrir?.(produto)}
      aria-label={`Ver oferta: ${produto.nome}`}
      className="absolute overflow-hidden text-left focus:outline-none focus-visible:ring-8 focus-visible:ring-white"
      style={{ ...estilo, borderRadius: raio, background: tema.celula || '#ffffff' }}
    >
      <div
        className="absolute left-0 right-0 top-0 text-center font-black uppercase leading-[1.05]"
        style={{ color: tema.nomeCor || '#111', fontSize: 20 * k, height: 52 * k, padding: `${12 * Math.min(k, 1.5)}px ${16 * k}px 0`, overflow: 'hidden' }}
      >
        {produto.nome}
      </div>
      {produto.imagem ? (
        <img
          src={produto.imagem}
          alt=""
          className="absolute object-contain"
          style={{ left: 10 * k, top: topoFoto, width: `calc(100% - ${20 * k}px)`, height: `calc(100% - ${topoFoto + 10 * k}px)` }}
        />
      ) : (
        <div className="absolute inset-x-0 text-center font-black" style={{ top: 90 * k, fontSize: 70 * k, color: setor.cor }}>•</div>
      )}
      <span
        className="absolute rounded-lg font-black uppercase leading-none"
        style={{ left: 8 * k, top: topoFoto, padding: `${4 * k}px ${10 * k}px`, fontSize: 14 * k, background: selo.fundo, color: selo.cor, transform: 'rotate(-4deg)' }}
      >
        {selo.texto}
      </span>
      {k >= 1.2 && temDesconto(produto) && (
        <span
          className="absolute rounded-md bg-white/90 font-black leading-none text-[#222]"
          style={{ right: 20 * k, bottom: 112 * k, padding: `${3 * k}px ${8 * k}px`, fontSize: 16 * k }}
        >
          De <span style={{ textDecoration: 'line-through' }}>{formatBRL(produto.precoNormal)}</span> por
        </span>
      )}
      <SeloPrecoOval produto={produto} tema={tema} k={k} />
    </button>
    </>
  )
}

// Posições das células dentro da área de produtos.
export function posicoesGrade(formatoId, layout, quantidade) {
  const f = formatoById(formatoId)
  const area = { x: MARGEM, y: f.topo, w: f.largura - MARGEM * 2, h: f.altura - f.topo - MARGEM }
  const montar = (cols, lins) => {
    const w = (area.w - GAP * (cols - 1)) / cols
    const h = (area.h - GAP * (lins - 1)) / lins
    return { w, h, cel: (col, lin, cs = 1, ls = 1) => ({ left: area.x + col * (w + GAP), top: area.y + lin * (h + GAP), width: w * cs + GAP * (cs - 1), height: h * ls + GAP * (ls - 1) }) }
  }
  const n = Math.max(quantidade, 1)

  if (temDestaque(f, layout) && n > 1) {
    const { cel } = montar(f.cols, f.lins)
    const lista = [cel(0, 0, 1, 2)]
    for (let lin = 0; lin < f.lins; lin += 1) {
      for (let col = 0; col < f.cols; col += 1) {
        if (col === 0 && lin < 2) continue
        lista.push(cel(col, lin))
      }
    }
    return lista.slice(0, n)
  }

  // Página cheia usa a grade do formato; com poucas ofertas, escolhe a grade
  // que deixa as células maiores e centraliza a última linha.
  let cols = f.cols
  let lins = f.lins
  if (n < f.cols * f.lins) {
    let melhor = -1
    for (let c = 1; c <= n; c += 1) {
      const l = Math.ceil(n / c)
      const { w, h } = montar(c, l)
      const nota = Math.min(w, h * 1.15) - (c * l - n) * 4
      if (nota > melhor) { melhor = nota; cols = c; lins = l }
    }
  }
  const { w, cel } = montar(cols, lins)
  const lista = []
  for (let i = 0; i < n; i += 1) {
    const lin = Math.floor(i / cols)
    const col = i % cols
    const naLinha = Math.min(cols, n - lin * cols)
    const deslocamento = ((cols - naLinha) * (w + GAP)) / 2
    const c = cel(col, lin)
    lista.push({ ...c, left: c.left + deslocamento })
  }
  return lista
}

function FaixaValidade({ encarte, tema, fonte = 24 }) {
  if (!encarte?.periodoDe) return null
  return (
    <div className="rounded-xl px-5 py-2.5 font-black uppercase leading-tight" style={{ background: tema.faixa, color: tema.faixaTexto, fontSize: fonte }}>
      Ofertas válidas de {formatData(encarte.periodoDe)} a {formatData(encarte.periodoAte)}
      <div style={{ fontSize: fonte * 0.7 }}>ou enquanto durarem os estoques</div>
    </div>
  )
}

function CaixaLoja({ loja, fonte = 20 }) {
  if (!loja || !(loja.endereco || loja.whatsapp)) return null
  return (
    <div className="rounded-xl bg-black/45 px-5 py-2.5 text-right font-bold leading-tight text-white" style={{ fontSize: fonte }}>
      {loja.endereco && <div>{loja.endereco}{loja.cidade ? ` · ${loja.cidade}` : ''}</div>}
      {loja.whatsapp && <div className="font-black" style={{ fontSize: fonte * 1.2 }}>WhatsApp {loja.whatsapp}</div>}
    </div>
  )
}

export default function PaginaTemplate({ tema, itens, encarte, loja, fundo, layout = 'grade', formato: formatoId = 'feed', numero, total, onAbrir }) {
  const f = formatoById(formatoId)
  const contorno = contornoTexto(tema.contorno)
  const posicoes = posicoesGrade(f.id, layout, itens.length)
  // O fundo enviado é preparado em 4:5; nos outros formatos ele cortaria a arte.
  const usarFundo = fundo && f.id === 'feed'
  const larguraTitulo = f.largura - MARGEM * 2
  return (
    <div className="relative overflow-hidden" style={{ width: f.largura, height: f.altura, background: tema.fundo, fontFamily: 'var(--font-sans)' }}>
      {usarFundo && <img src={fundo} alt="" className="absolute inset-0 h-full w-full object-cover" />}

      {/* topo da campanha */}
      <div className="absolute left-0 right-0 top-0" style={{ height: f.topo }}>
        <div className="absolute" style={{ left: MARGEM, top: f.compacto ? 24 : 32 }}>
          <div aria-hidden="true" className="absolute inset-0 rounded-2xl" style={{ top: 6, bottom: -6, background: 'rgba(0,0,0,.2)' }} />
          <div className="relative rounded-2xl bg-white p-3"><Logo h={f.compacto ? 92 : 96} /></div>
        </div>

        {f.compacto ? (
          <div
            className="absolute flex items-center whitespace-nowrap font-black uppercase italic leading-none tracking-tight"
            style={{ left: 180, right: MARGEM, top: 24, height: 124, justifyContent: 'center', gap: '0.25em', fontSize: fonteQueCabe(`${tema.titulo} ${tema.destaque}`, f.largura - 180 - MARGEM - 20, f.titulo) }}
          >
            <span style={{ color: tema.corTitulo, textShadow: contorno }}>{tema.titulo}</span>
            <span style={{ color: tema.corDestaque, textShadow: contorno }}>{tema.destaque}</span>
          </div>
        ) : !usarFundo && (
          <>
            <div className="absolute text-center italic" style={{ left: MARGEM, right: MARGEM, top: f.tituloTop }}>
              <div className="whitespace-nowrap font-black uppercase leading-[0.9] tracking-tight" style={{ fontSize: fonteQueCabe(tema.titulo, larguraTitulo, f.titulo), color: tema.corTitulo, textShadow: contorno }}>{tema.titulo}</div>
              <div className="whitespace-nowrap font-black uppercase leading-[0.95] tracking-tight" style={{ fontSize: fonteQueCabe(tema.destaque, larguraTitulo, f.destaque), color: tema.corDestaque, textShadow: contorno }}>{tema.destaque}</div>
            </div>
            <div className="absolute text-right font-black uppercase leading-tight text-white" style={{ right: MARGEM, top: 44, width: f.largura - 260, maxWidth: 560, fontSize: 30, textShadow: contornoTexto(tema.contorno, 2) }}>
              {tema.chamada}
            </div>
          </>
        )}

        <div className="absolute flex items-end justify-between gap-4" style={{ left: MARGEM, right: MARGEM, bottom: 18 }}>
          <FaixaValidade encarte={encarte} tema={tema} fonte={f.id === 'stories' ? 28 : 24} />
          {f.id === 'tv' && tema.chamada && (
            <div className="self-center font-black uppercase italic text-white" style={{ fontSize: 40, textShadow: contornoTexto(tema.contorno, 3) }}>{tema.chamada}</div>
          )}
          <CaixaLoja loja={loja} fonte={f.id === 'stories' ? 24 : 20} />
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
        return <CelulaProduto key={p.id || i} produto={p} tema={tema} onAbrir={onAbrir} estilo={pos} />
      })}
    </div>
  )
}
