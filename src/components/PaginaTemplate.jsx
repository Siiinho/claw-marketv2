import ImagemProduto, { MarcaLista, useContextoEncarte } from './ImagemProduto'
import { useEffect, useRef, useState } from 'react'
import { Icon } from './ui'
import { formatBRL, formatData, setorById } from '../lib/utils'
import { caminhoArte } from '../lib/temasCampanha'
import SeloArte from './SeloArte'
import PrecoArte from './PrecoArte'
import logoTransparente from '../assets/logo-bengala-transparente.png'

// Logo do mercado direto sobre a arte do tema, sem caixa branca (arquivo PNG transparente).
// `escala` (0,4 a 1,3) vem do controle "Tamanho do logo" de cada jornal.
export function LogoEncarte({ h = 110, escala = 1 }) {
  return <img src={logoTransparente} alt="Bengala Supermercado" className="block w-auto object-contain" style={{ height: h * escala }} />
}

// Ajuste de cada produto na arte (feito no editor, como no Canva): posição em fração da
// célula e escala, para o nome, a foto e o preço. Sem ajuste, tudo fica no lugar padrão.
export const AJUSTE_PADRAO = { nome: { x: 0, y: 0, s: 1 }, foto: { x: 0, y: 0, s: 1 }, preco: { x: 0, y: 0, s: 1 }, selo: { x: 0, y: 0, s: 1 } }
export const ajusteDe = (produto, camada) => ({ ...AJUSTE_PADRAO[camada], ...(produto?.ajusteArte?.[camada] || {}) })

function Camada({ nome, produto, estilo, origem, children }) {
  const a = ajusteDe(produto, nome)
  const mexido = a.x || a.y || a.s !== 1
  return (
    <div data-camada={nome} className="pointer-events-none absolute inset-0" style={mexido ? { transform: `translate(${a.x * estilo.width}px, ${a.y * estilo.height}px) scale(${a.s})`, transformOrigin: origem } : undefined}>
      {children}
    </div>
  )
}

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

export const contornoTexto = (cor, px = 4) =>
  [`-${px}px -${px}px 0 ${cor}`, `${px}px -${px}px 0 ${cor}`, `-${px}px ${px}px 0 ${cor}`, `${px}px ${px}px 0 ${cor}`, `0 ${px * 2}px 0 ${cor}`].join(', ')

// Tamanho de fonte para um texto em caixa alta pesada caber numa largura.
export const fonteQueCabe = (texto, largura, max, fator = 0.62) =>
  Math.min(max, largura / Math.max(1, String(texto || '').length * fator))

export function unidadeDe(produto) {
  if (produto.unidade) return produto.unidade
  return produto.setor === 'hortifruti' ? 'KG' : 'UNI'
}

const temDesconto = (p) => Number(p.precoNormal) > Number(p.precoJornal) + 0.009

function SeloPrecoOval({ produto, tema, k, indice = 0 }) {
  // Estilo do preço escolhido no produto (balão, só o número, faixa…); sem escolha, o balão.
  return (
    <div className="cm-preco absolute" style={{ right: 8 * k + 5 * k, bottom: 8 * k + 7 * k, '--cm-i': indice }}>
      <PrecoArte valor={produto.precoJornal} unidade={unidadeDe(produto)} tema={tema} estilo={produto.estiloPreco || 'oval'} k={k} />
    </div>
  )
}

export function CelulaProduto({ produto, tema, onAbrir, estilo, indice = 0 }) {
  const setor = setorById(produto.setor)
  const { semFundo: soltas } = useContextoEncarte()
  // Fator de escala da célula: cresce com a área, sem deixar o selo de preço sair da célula.
  const k = Math.max(0.8, Math.min(2.6,
    Math.sqrt((estilo.width * estilo.height) / (CELULA_BASE.w * CELULA_BASE.h)),
    estilo.width / 300,
    estilo.height / 220,
  ))
  // Nome maior (2 linhas) e foto ocupando quase toda a célula: o cliente lê de longe.
  const topoFoto = 60 * k
  const raio = 22 * Math.min(k, 1.6)
  return (
    <>
    <div aria-hidden="true" className="cm-celula absolute" style={{ left: estilo.left, top: estilo.top + 6, width: estilo.width, height: estilo.height, borderRadius: raio, background: 'rgba(0,0,0,.18)', '--cm-i': indice }} />
    <button
      type="button"
      onClick={() => onAbrir?.(produto)}
      aria-label={`Ver oferta: ${produto.nome}`}
      className="cm-celula absolute overflow-hidden text-left focus:outline-none focus-visible:ring-8 focus-visible:ring-white"
      style={{ ...estilo, borderRadius: raio, background: soltas ? 'rgba(0,0,0,.2)' : tema.celula || '#ffffff', border: soltas ? `3px solid ${tema.corDestaque}` : undefined, '--cm-i': indice }}
    >
      <Camada nome="nome" produto={produto} estilo={estilo} origem="50% 0%">
      <div
        className="absolute left-0 right-0 top-0 text-center uppercase leading-[0.95]"
        style={{ color: soltas ? '#ffffff' : tema.nomeCor || '#111', textShadow: soltas ? contornoTexto(tema.contorno || '#000', 3) : undefined, fontFamily: 'var(--font-encarte)', fontWeight: 800, letterSpacing: '0.005em', fontSize: 29 * k, height: 62 * k, padding: `${6 * Math.min(k, 1.5)}px ${10 * k}px 0`, overflow: 'hidden' }}
      >
        {produto.nome}
      </div>
      </Camada>
      <Camada nome="foto" produto={produto} estilo={estilo} origem={`50% ${(topoFoto + (estilo.height - topoFoto) / 2) / estilo.height * 100}%`}>
      {produto.imagem ? (
        <ImagemProduto
          src={produto.imagem}
          alt=""
          className="cm-foto absolute object-contain"
          style={{ '--cm-i': indice, left: 4 * k, top: topoFoto, width: `calc(100% - ${8 * k}px)`, height: `calc(100% - ${topoFoto + 2 * k}px)` }}
        />
      ) : (
        <div className="absolute inset-x-0 text-center font-black" style={{ top: 90 * k, fontSize: 70 * k, color: setor.cor }}>•</div>
      )}
      </Camada>
      <Camada nome="selo" produto={produto} estilo={estilo} origem={`${61 * k}px ${topoFoto + 16 * k}px`}>
        <SeloArte produto={produto} largura={118 * k} className="cm-selo absolute" style={{ position: 'absolute', left: 2 * k, top: topoFoto - 4 * k, '--cm-i': indice }} />
      </Camada>
      {k >= 1.2 && temDesconto(produto) && (
        <span
          className="absolute rounded-md bg-white/90 uppercase leading-none text-[#222]"
          style={{ right: 20 * k, bottom: 112 * k, padding: `${3 * k}px ${8 * k}px`, fontSize: 19 * k, fontWeight: 800, fontFamily: 'var(--font-encarte)' }}
        >
          De <span style={{ textDecoration: 'line-through' }}>{formatBRL(produto.precoNormal)}</span> por
        </span>
      )}
      <Camada nome="preco" produto={produto} estilo={estilo} origem={`calc(100% - ${106 * k}px) calc(100% - ${61 * k}px)`}>
        <SeloPrecoOval produto={produto} tema={tema} k={k} indice={indice} />
      </Camada>
      <MarcaLista id={produto.id} />
    </button>
    </>
  )
}

// Rodapé oficial do Bengala (o mesmo do jornal impresso): QR, WhatsApp, lojas, cartões e avisos.
export const RODAPE_OFICIAL = `${import.meta.env.BASE_URL}templates/rodape-oficial-bengala.webp`
const RODAPE_RAZAO = 2160 / 384
// Na largura da página; na TV (deitada) fica mais baixo, centralizado numa faixa branca.
export const alturaRodape = (f) => Math.round(Math.min(f.largura / RODAPE_RAZAO, f.altura * 0.18))

export function RodapeOficial({ altura }) {
  return (
    <div className="absolute inset-x-0 bottom-0 flex justify-center bg-white" style={{ height: altura, zIndex: 1 }}>
      <img src={RODAPE_OFICIAL} alt="Lojas, WhatsApp, redes sociais e cartões aceitos do Bengala" className="block h-full max-w-full object-contain" />
    </div>
  )
}

// Posições das células dentro da área de produtos (acima do rodapé, quando houver).
export function posicoesGrade(formatoId, layout, quantidade, topo, rodape = 0) {
  const f = formatoById(formatoId)
  const y0 = topo || f.topo
  const area = { x: MARGEM, y: y0, w: f.largura - MARGEM * 2, h: f.altura - y0 - (rodape ? rodape + GAP : MARGEM) }
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

// Validade e endereço soltos na arte (sem caixas), em letra de encarte com contorno.
const diaMes = (iso) => formatData(iso).slice(0, 5)

export function FaixaValidade({ encarte, tema, fonte = 24, alinhar = 'left' }) {
  if (!encarte?.periodoDe) return null
  const umDia = encarte.periodoAte === encarte.periodoDe
  return (
    <div className="uppercase leading-[0.92]" style={{ fontFamily: 'var(--font-encarte)', fontWeight: 900, textAlign: alinhar, textShadow: contornoTexto(tema.contorno, Math.max(2, Math.round(fonte / 11))) }}>
      <div style={{ fontSize: fonte * 0.78, color: '#ffffff' }}>{umDia ? 'Ofertas válidas só' : 'Ofertas válidas de'}</div>
      <div style={{ fontSize: fonte * 1.55, color: tema.corDestaque, letterSpacing: '0.01em' }}>{umDia ? `hoje, ${diaMes(encarte.periodoDe)}` : `${diaMes(encarte.periodoDe)} a ${diaMes(encarte.periodoAte)}`}</div>
      <div style={{ fontSize: fonte * 0.62, color: '#ffffff', fontWeight: 700, marginTop: fonte * 0.12 }}>ou enquanto durarem os estoques</div>
    </div>
  )
}

function CaixaLoja({ loja, tema, fonte = 20, alinhar = 'right' }) {
  if (!loja || !(loja.endereco || loja.whatsapp)) return null
  return (
    <div className="uppercase leading-[1]" style={{ fontFamily: 'var(--font-encarte)', textAlign: alinhar, color: '#ffffff', textShadow: contornoTexto(tema?.contorno || '#000', 2) }}>
      {loja.whatsapp && <div style={{ fontSize: fonte * 1.3, fontWeight: 900 }}>WhatsApp {loja.whatsapp}</div>}
      {loja.endereco && <div style={{ fontSize: fonte * 0.85, fontWeight: 700 }}>{loja.endereco}{loja.cidade ? ` · ${loja.cidade}` : ''}</div>}
    </div>
  )
}

function ColunaArte({ tema, encarte, loja, f, topo, escalaLogo = 1 }) {
  const [ax0, ax1] = tema.arteX || [440, 1000]
  const direita = tema.logo === 'd'
  const esquerda = direita ? Math.min(Math.max(ax1 + 8, 520), 740) : MARGEM
  const fim = direita ? f.largura - MARGEM : Math.min(Math.max(ax0 - 8, 340), 560)
  const largura = fim - esquerda
  const linhasChamada = String(tema.chamada || '').length > 16 ? 2 : 1
  // Logo maior; a chamada encolhe um pouco no Feed para tudo caber acima dos produtos.
  const alturaLogo = f.id === 'stories' ? 190 : 150
  const fonteChamada = Math.min(f.id === 'stories' ? 66 : 58, (largura * linhasChamada) / (String(tema.chamada || '').length * 0.46))
  return (
    <div className="absolute flex flex-col gap-2" style={{ left: esquerda, width: largura, top: f.id === 'stories' ? 40 : 24, height: topo - (f.id === 'stories' ? 56 : 36), alignItems: direita ? 'flex-end' : 'flex-start' }}>
      <div className="relative flex shrink-0 items-center" style={{ height: alturaLogo, justifyContent: direita ? 'flex-end' : 'flex-start' }}>
        <LogoEncarte h={alturaLogo} escala={escalaLogo} />
      </div>
      {tema.chamada && (
        <div className="uppercase leading-[0.95] text-white" style={{ fontFamily: 'Bangers, var(--font-sans)', fontSize: fonteChamada, letterSpacing: '0.02em', textAlign: direita ? 'right' : 'left', textShadow: contornoTexto(tema.contorno, 3) }}>
          {tema.chamada}
        </div>
      )}
      <div className="mt-auto flex w-full flex-col gap-2" style={{ alignItems: direita ? 'flex-end' : 'flex-start' }}>
        <FaixaValidade encarte={encarte} tema={tema} fonte={largura < 400 ? 30 : 34} alinhar={direita ? 'right' : 'left'} />
        <CaixaLoja loja={loja} tema={tema} fonte={largura < 400 ? 19 : 21} alinhar={direita ? 'right' : 'left'} />
      </div>
    </div>
  )
}

// `animado`: liga o motion design (só na página pública; as exportações em PNG/PDF saem paradas).
export default function PaginaTemplate({ tema, itens, encarte, loja, fundo, layout = 'grade', formato: formatoId = 'feed', numero, total, onAbrir, animado = false, escalaLogo }) {
  const f = formatoById(formatoId)
  // Tamanho do logo deste jornal: vem do encarte publicado ou do controle do Jornal.
  const logo = Math.min(1.3, Math.max(0.4, Number(escalaLogo ?? encarte?.escalaLogo ?? 1) || 1))
  const contorno = contornoTexto(tema.contorno)
  // Fundo: o enviado pelo mercado (só no Feed, preparado em 4:5) ou a arte do tema no formato.
  const imagemFundo = (f.id === 'feed' && fundo) || caminhoArte(tema, f.id)
  const usarFundo = !!imagemFundo
  // Nos temas com arte, a arte do título desce um pouco mais no Feed.
  const topo = tema.arte && f.id === 'feed' && !fundo ? 500 : f.topo
  const rodape = alturaRodape(f)
  const posicoes = posicoesGrade(f.id, layout, itens.length, topo, rodape)
  // Temas com arte nos formatos altos: logo, chamada, validade e endereço numa coluna ao lado da arte.
  const colunaArte = tema.arte && !f.compacto && !fundo
  const larguraTitulo = f.largura - MARGEM * 2
  // Temas sem arte: o título começa abaixo do logo (não passa por cima dele) e encolhe para
  // caber antes da validade. Logo menor = título mais alto e maior.
  const tituloTop = f.tituloTop ? Math.max(f.tituloTop - 30, 32 + 160 * logo - 6) : 0
  const fonteTitulo = f.tituloTop ? Math.min(1, (topo - 120 - tituloTop) / (f.titulo * 0.9 + f.destaque * 0.95)) : 1
  return (
    <div className={`arte-fixa relative overflow-hidden ${animado ? 'cm-animado' : ''}`} style={{ width: f.largura, height: f.altura, background: tema.fundo, fontFamily: 'var(--font-sans)' }}>
      {usarFundo && <img src={imagemFundo} alt="" className="cm-fundo absolute inset-0 h-full w-full object-cover" />}
      {/* templates de setor: o ícone do setor grande ao fundo */}
      {!usarFundo && tema.icone && (
        <div aria-hidden="true" className="absolute" style={{ right: -f.altura * 0.06, top: -f.altura * 0.04, color: '#ffffff', opacity: 0.13, transform: 'rotate(-14deg)' }}>
          <Icon name={tema.icone} size={Math.round(Math.min(f.largura, f.altura) * 0.62)} strokeWidth={1.6} />
        </div>
      )}

      {/* topo da campanha */}
      <div className="cm-topo absolute left-0 right-0 top-0" style={{ height: topo }}>
        {colunaArte ? (
          <ColunaArte tema={tema} encarte={encarte} loja={loja} f={f} topo={topo} escalaLogo={logo} />
        ) : (
          <div className="absolute" style={{ left: MARGEM, top: f.compacto ? 24 : 32 }}>
            <LogoEncarte h={f.compacto ? 140 : 160} escala={logo} />
          </div>
        )}

        {f.compacto ? !tema.arte && (
          <div
            className="absolute flex items-center whitespace-nowrap font-black uppercase italic leading-none tracking-tight"
            style={{ left: 180, right: MARGEM, top: 24, height: 124, justifyContent: 'center', gap: '0.25em', fontSize: fonteQueCabe(`${tema.titulo} ${tema.destaque}`, f.largura - 180 - MARGEM - 20, f.titulo) }}
          >
            <span style={{ color: tema.corTitulo, textShadow: contorno }}>{tema.titulo}</span>
            <span style={{ color: tema.corDestaque, textShadow: contorno }}>{tema.destaque}</span>
          </div>
        ) : !usarFundo && (
          <>
            <div className="absolute text-center italic" style={{ left: MARGEM, right: MARGEM, top: tituloTop }}>
              <div className="whitespace-nowrap font-black uppercase leading-[0.9] tracking-tight" style={{ fontSize: fonteQueCabe(tema.titulo, larguraTitulo, f.titulo * fonteTitulo), color: tema.corTitulo, textShadow: contorno }}>{tema.titulo}</div>
              <div className="whitespace-nowrap font-black uppercase leading-[0.95] tracking-tight" style={{ fontSize: fonteQueCabe(tema.destaque, larguraTitulo, f.destaque * fonteTitulo), color: tema.corDestaque, textShadow: contorno }}>{tema.destaque}</div>
            </div>
            <div className="absolute text-right font-black uppercase leading-tight text-white" style={{ right: MARGEM, top: 44, width: f.largura - 260, maxWidth: 560, fontSize: 30, textShadow: contornoTexto(tema.contorno, 2) }}>
              {tema.chamada}
            </div>
          </>
        )}

        {!colunaArte && <div className="absolute flex items-end justify-between gap-4" style={{ left: MARGEM, right: MARGEM, bottom: 18 }}>
          <FaixaValidade encarte={encarte} tema={tema} fonte={f.id === 'tv' ? 34 : f.id === 'stories' ? 32 : 27} />
          {f.id === 'tv' && tema.chamada && !tema.arte && (
            <div className="self-center font-black uppercase italic text-white" style={{ fontSize: 40, textShadow: contornoTexto(tema.contorno, 3) }}>{tema.chamada}</div>
          )}
          <CaixaLoja loja={loja} tema={tema} fonte={f.id === 'tv' ? 24 : f.id === 'stories' ? 24 : 20} />
        </div>}
      </div>

      <RodapeOficial altura={rodape} />

      {numero && total > 1 && (
        <div className="absolute rounded-full bg-black/50 px-3 py-1 text-[18px] font-black text-white" style={{ right: 12, bottom: rodape + 6, zIndex: 2 }}>
          {numero}/{total}
        </div>
      )}

      {/* grade de produtos */}
      {itens.map((p, i) => {
        const pos = posicoes[i]
        if (!pos) return null
        return <CelulaProduto key={p.id || i} produto={p} tema={tema} onAbrir={onAbrir} estilo={pos} indice={i} />
      })}
    </div>
  )
}
