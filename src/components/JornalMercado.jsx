import { Icon, PrecoVarejo } from './ui'
import { SETORES, setorById, formatData } from '../lib/utils'
import { caminhoArte } from '../lib/temasCampanha'
import PaginaTemplate, { unidadeDe, paginarTemplate, fonteQueCabe, contornoTexto, FaixaValidade, LogoEncarte, RodapeOficial, ajusteDe, LARGURA, ALTURA } from './PaginaTemplate'
import SeloArte from './SeloArte'
import ImagemProduto, { MarcaLista, useContextoEncarte } from './ImagemProduto'
import PrecoArte from './PrecoArte'

// Formato "Jornal do mercado", como o jornal impresso do Bengala: página A4 em pé, topo com a
// campanha, blocos "Ofertas válidas somente <dia>" com uma grade cheia de produtos e rodapé com
// os dados da loja. Fundo, arte do título e cores vêm do template escolhido, sem criar arte nova:
// nos temas com arte, o fundo é o mesmo do template (public/temas/<id>/jornal.webp) e a arte do
// título (titulo.webp) vai centralizada no topo; nos temas de setor, o fundo em CSS com o ícone.
//  - Com dia marcado (Mercado Encarte), cada dia vira um bloco.
//  - Sem dia, todos ficam juntos num bloco só, por setor e do menor preço para o maior.

export const JORNAL_W = 1080
export const JORNAL_H = 1527 // proporção A4
const COLS = 7
const PAD = 20
const TOPO = 330
const RODAPE = 192 // rodapé oficial (2160x384) na largura da página
const CAB = 48 // faixa do bloco
const GAP = 8
const BORDA = 6 // moldura do bloco
const INTERNO = 8 // respiro dentro do bloco
const CELULA_W = (JORNAL_W - PAD * 2 - BORDA * 2 - INTERNO * 2 - 4 * (COLS - 1)) / COLS
const CELULA_H = 176
const CORPO = JORNAL_H - TOPO - RODAPE - PAD

const SEMANA = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO']
const diaDaSemana = (iso) => {
  const [a, m, d] = String(iso).split('-').map(Number)
  return SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]
}

// Ordem dentro do bloco: setor (na ordem da loja) e, em cada setor, do menor preço para o maior.
const posSetor = (p) => { const i = SETORES.findIndex((s) => s.id === p.setor); return i < 0 ? SETORES.length : i }
const precoDe = (p) => Number(p.precoJornal ?? p.precoPromo ?? p.precoNormal) || 0
export const ordenarBloco = (itens) => [...itens].sort((a, b) => posSetor(a) - posSetor(b) || precoDe(a) - precoDe(b))

// Blocos do jornal: todos juntos, lado a lado. Só separa quando a data da oferta é diferente.
export function blocosDoJornal(itens) {
  const dias = [...new Set(itens.map((p) => p.encarteMercadoDia).filter(Boolean))].sort()
  const blocos = dias.map((dia) => ({
    id: dia,
    titulo: `Ofertas válidas somente ${diaDaSemana(dia)} dia ${formatData(dia)}`,
    itens: ordenarBloco(itens.filter((p) => p.encarteMercadoDia === dia)),
  }))
  const semDia = itens.filter((p) => !p.encarteMercadoDia)
  if (semDia.length) blocos.push({ id: 'semana', titulo: 'Ofertas da semana', itens: ordenarBloco(semDia) })
  return blocos
}

// Divide os blocos em páginas A4: linhas de 6 produtos; um bloco que não cabe continua na próxima.
export function paginarJornal(itens) {
  const paginas = []
  let atual = []
  let livre = CORPO
  const novaPagina = () => { if (atual.length) paginas.push(atual); atual = []; livre = CORPO }
  for (const bloco of blocosDoJornal(itens)) {
    const linhas = []
    for (let i = 0; i < bloco.itens.length; i += COLS) linhas.push(bloco.itens.slice(i, i + COLS))
    let parte = null
    for (const linha of linhas) {
      const precisa = (parte ? 0 : CAB + BORDA * 2 + INTERNO * 1.5 + GAP) + CELULA_H + 4
      if (precisa > livre) {
        novaPagina()
        parte = null
      }
      if (!parte) {
        parte = { ...bloco, continua: atual.length === 0 && paginas.some((p) => p.some((b) => b.id === bloco.id)), linhas: [] }
        atual.push(parte)
        livre -= CAB + BORDA * 2 + INTERNO * 1.5 + GAP
      }
      parte.linhas.push(linha)
      livre -= CELULA_H + 4
    }
  }
  novaPagina()
  return paginas.length ? paginas : [[]]
}

// Altura que a página usa de fato (no site do cliente a página encolhe quando tem poucos produtos).
export const alturaUsada = (blocos) => Math.min(JORNAL_H, Math.max(TOPO + RODAPE + 260,
  TOPO + 6 + blocos.reduce((t, b) => t + CAB + BORDA * 2 + INTERNO * 1.5 + GAP + b.linhas.length * (CELULA_H + 4), 0) + RODAPE + PAD))

function Celula({ produto, tema, onAbrir, indice, largura = CELULA_W }) {
  const CELULA_W = largura
  const { semFundo: soltas } = useContextoEncarte()
  const nome = String(produto.nome || '')
  const fonteNome = nome.length > 34 ? 13 : nome.length > 22 ? 15 : 17
  return (
    <button
      type="button"
      onClick={() => onAbrir?.(produto)}
      aria-label={`Ver oferta: ${produto.nome}`}
      className="cm-celula relative overflow-hidden text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-black/30"
      style={{ width: CELULA_W, height: CELULA_H, background: 'transparent', '--cm-i': indice }}
    >
      <div className="absolute inset-x-0 top-0 text-center uppercase leading-[1.02]" style={{ padding: '4px 4px 0', height: 52, overflow: 'hidden', fontFamily: 'var(--font-encarte)', fontWeight: 800, fontSize: fonteNome, color: soltas ? '#ffffff' : '#111', textShadow: soltas ? contornoTexto(tema.contorno || '#000', 2) : undefined }}>
        {produto.nome}
      </div>
      {produto.imagem
        ? <ImagemProduto src={produto.imagem} alt="" className="cm-foto absolute object-contain" style={{ left: 2, top: 52, width: CELULA_W - 4, height: CELULA_H - 52 - 22, '--cm-i': indice }} />
        : <div className="absolute inset-x-0 text-center text-6xl font-black" style={{ top: 70, color: setorById(produto.setor).cor }}>•</div>}
      {/* Selo escolhido para o produto ("Oferta", "Só hoje"…), com o tamanho e a posição do editor. */}
      {(() => {
        const a = ajusteDe(produto, 'selo')
        return (
          <div className="pointer-events-none absolute inset-0" style={{ transform: `translate(${a.x * CELULA_W}px, ${a.y * CELULA_H}px) scale(${a.s})`, transformOrigin: '38px 66px' }}>
            <SeloArte produto={produto} largura={76} className="cm-selo absolute" style={{ position: 'absolute', left: 0, top: 50, '--cm-i': indice }} />
          </div>
        )
      })()}
      {produto.estiloPreco ? (
        // Estilo escolhido no produto (só o número, faixa…), no tamanho da célula do jornal.
        <div className="cm-preco absolute" style={{ right: 4, bottom: 6, '--cm-i': indice }}>
          <PrecoArte valor={produto.precoJornal} unidade={unidadeDe(produto)} tema={tema} estilo={produto.estiloPreco} k={0.56} />
        </div>
      ) : (
        <div className="cm-preco absolute flex items-end leading-none" style={{ right: 2, bottom: 4, padding: '4px 8px 3px', borderRadius: 8, background: tema.precoCor, border: `3px solid ${tema.precoFundo}`, transform: 'rotate(-3deg)', boxShadow: `3px 3px 0 ${tema.precoSombra}`, '--cm-i': indice }}>
          <PrecoVarejo valor={produto.precoJornal} cor={tema.precoFundo} style={{ fontSize: 34, fontFamily: 'var(--font-encarte)', fontVariantNumeric: 'normal' }} />
          <span style={{ marginLeft: 3, marginBottom: 3, fontSize: 12, fontWeight: 900, color: tema.precoFundo, fontFamily: 'var(--font-encarte)' }}>{unidadeDe(produto)}</span>
        </div>
      )}
      <MarcaLista id={produto.id} />
    </button>
  )
}

// ---- layout "Ancorado", como o jornal do Bengala: em cada faixa, produtos em destaque com a big
// idea da campanha (os ancorados) e o resto das ofertas em volta. Alterna três desenhos:
//  - colunas: duas colunas, cada uma com 1 ancorado e 3 ofertas embaixo;
//  - tres: 3 ancorados lado a lado e uma linha de ofertas;
//  - um: 1 ancorado grande à esquerda e 8 ofertas à direita.
const ANC_H = 228
const DESENHOS = [{ tipo: 'colunas', ancoras: 2, resto: 6 }, { tipo: 'tres', ancoras: 3, resto: COLS }, { tipo: 'um', ancoras: 1, resto: 8 }]
const FAIXA = CAB + BORDA * 2 + INTERNO * 1.5 + GAP
const alturaSegmento = (s) => FAIXA + (s.tipo === 'um' ? 2 * (CELULA_H + 4) : ANC_H + (s.resto.length ? 4 + CELULA_H + 4 : 0))

export function paginarAncorado(itens) {
  const segmentos = []
  for (const bloco of blocosDoJornal(itens)) {
    // ancorados: os de maior desconto do bloco (os que mais chamam o cliente)
    const ordem = [...bloco.itens].sort((a, b) => (Number(b.descontoJornal) || 0) - (Number(a.descontoJornal) || 0))
    const usados = new Set()
    let d = 0
    while (usados.size < bloco.itens.length) {
      const desenho = DESENHOS[d++ % DESENHOS.length]
      const ancoras = ordem.filter((p) => !usados.has(p.id)).slice(0, desenho.ancoras)
      ancoras.forEach((p) => usados.add(p.id))
      const resto = bloco.itens.filter((p) => !usados.has(p.id)).slice(0, desenho.resto)
      resto.forEach((p) => usados.add(p.id))
      // poucos produtos: o desenho de 1 ancorado é o que melhor fecha a faixa
      const tipo = ancoras.length === 1 && desenho.tipo !== 'um' ? 'um' : ancoras.length === 2 && desenho.tipo === 'tres' ? 'colunas' : desenho.tipo
      segmentos.push({ id: `${bloco.id}-${d}`, titulo: bloco.titulo, tipo, ancoras, resto })
    }
  }
  const paginas = []
  let atual = []
  let livre = CORPO
  for (const s of segmentos) {
    const h = alturaSegmento(s)
    if (h > livre && atual.length) { paginas.push(atual); atual = []; livre = CORPO }
    atual.push(s)
    livre -= h
  }
  if (atual.length) paginas.push(atual)
  return paginas.length ? paginas : [[]]
}

function Ancorado({ produto, tema, onAbrir, largura, altura, indice }) {
  const { semFundo: soltas } = useContextoEncarte()
  const arte = caminhoArte(tema, 'titulo')
  const nome = String(produto.nome || '')
  const desconto = Number(produto.descontoJornal) || 0
  return (
    <button type="button" onClick={() => onAbrir?.(produto)} aria-label={`Ver oferta em destaque: ${produto.nome}`}
      className="cm-celula relative overflow-hidden text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-black/30"
      style={{ width: largura, height: altura, borderRadius: 16, background: soltas ? 'rgba(0,0,0,.18)' : '#fff8e6', border: `3px solid ${tema.corDestaque}`, '--cm-i': indice }}>
      {/* a big idea da campanha em cada ancorado, como o "Especial Semana Black" do impresso */}
      {arte
        ? <img src={arte} alt="" className="absolute object-contain" style={{ left: 4, top: 2, height: 78, width: 104, zIndex: 2 }} />
        : <span className="absolute uppercase leading-none" style={{ left: 8, top: 8, zIndex: 2, padding: '4px 8px', borderRadius: 6, background: tema.faixa, color: tema.faixaTexto, fontFamily: 'Bangers, var(--font-sans)', fontSize: 20 }}>Especial {tema.destaque}</span>}
      {produto.imagem
        ? <ImagemProduto src={produto.imagem} alt="" className="cm-foto absolute object-contain" style={{ left: largura * 0.06, top: 34, width: largura * 0.6, height: altura - 34 - 46, '--cm-i': indice }} />
        : <div className="absolute text-center text-7xl font-black" style={{ left: 30, top: 70, color: setorById(produto.setor).cor }}>•</div>}
      <div className="absolute uppercase leading-[1.02]" style={{ left: 10, right: largura * 0.36, bottom: 8, fontFamily: 'var(--font-encarte)', fontWeight: 900, fontSize: nome.length > 28 ? 16 : 19, color: soltas ? '#ffffff' : '#111', textShadow: soltas ? contornoTexto(tema.contorno || '#000', 2) : undefined, maxHeight: 44, overflow: 'hidden' }}>{nome}</div>
      {/* preço em estouro, grande */}
      <div className="cm-preco absolute flex flex-col items-center justify-center" style={{ right: -6, bottom: 6, width: Math.min(176, largura * 0.5), height: Math.min(150, altura * 0.62), '--cm-i': indice }}>
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <polygon points="50,2 58,16 74,8 74,25 92,22 84,38 98,48 84,58 92,74 74,72 74,90 58,82 50,98 42,82 26,90 26,72 8,74 16,58 2,48 16,38 8,22 26,25 26,8 42,16" fill={tema.precoFundo} stroke={tema.precoSombra || '#000'} strokeWidth="2.5" />
        </svg>
        {desconto > 0 && <span className="relative uppercase leading-none" style={{ fontFamily: 'var(--font-encarte)', fontWeight: 900, fontSize: 16, color: tema.precoCor }}>-{desconto}%</span>}
        <PrecoVarejo valor={produto.precoJornal} cor={tema.precoCor} style={{ position: 'relative', fontSize: 50, lineHeight: 0.9, fontFamily: 'var(--font-encarte)', fontVariantNumeric: 'normal' }} />
        <span className="relative" style={{ fontSize: 13, fontWeight: 900, color: tema.precoCor, fontFamily: 'var(--font-encarte)' }}>{unidadeDe(produto)}</span>
      </div>
      <SeloArte produto={produto} largura={86} className="cm-selo absolute" style={{ position: 'absolute', left: 6, top: 82, zIndex: 2 }} />
      <MarcaLista id={produto.id} />
    </button>
  )
}

function SegmentoAncorado({ s, tema, onAbrir, contar }) {
  const interno = JORNAL_W - PAD * 2 - BORDA * 2 - INTERNO * 2
  const linha = (itens, largura) => (
    <div className="flex" style={{ gap: 4 }}>
      {itens.map((p) => <Celula key={p.id} produto={p} tema={tema} onAbrir={onAbrir} indice={contar()} largura={largura} />)}
    </div>
  )
  if (s.tipo === 'colunas') {
    const colW = (interno - 8) / 2
    const pequena = (colW - 8) / 3
    return (
      <div className="flex" style={{ gap: 8 }}>
        {[0, 1].map((c) => (
          <div key={c} className="flex flex-col" style={{ width: colW, gap: 4 }}>
            {s.ancoras[c] && <Ancorado produto={s.ancoras[c]} tema={tema} onAbrir={onAbrir} largura={colW} altura={ANC_H} indice={contar()} />}
            {s.resto.length > 0 && linha(s.resto.slice(c * 3, c * 3 + 3), pequena)}
          </div>
        ))}
      </div>
    )
  }
  if (s.tipo === 'tres') {
    const w = (interno - 8) / 3
    return (
      <div className="flex flex-col" style={{ gap: 4 }}>
        <div className="flex" style={{ gap: 4 }}>{s.ancoras.map((p) => <Ancorado key={p.id} produto={p} tema={tema} onAbrir={onAbrir} largura={w} altura={ANC_H} indice={contar()} />)}</div>
        {s.resto.length > 0 && linha(s.resto, (interno - 4 * (COLS - 1)) / COLS)}
      </div>
    )
  }
  const ancW = (interno - 4 * (COLS - 1)) / COLS * 3 + 8
  const pequena = (interno - ancW - 8 - 12) / 4
  return (
    <div className="flex" style={{ gap: 8 }}>
      {s.ancoras[0] && <Ancorado produto={s.ancoras[0]} tema={tema} onAbrir={onAbrir} largura={ancW} altura={2 * (CELULA_H + 4) - 4} indice={contar()} />}
      <div className="flex flex-col" style={{ gap: 4 }}>
        {linha(s.resto.slice(0, 4), pequena)}
        {s.resto.length > 4 && linha(s.resto.slice(4, 8), pequena)}
      </div>
    </div>
  )
}

export default function PaginaJornalMercado({ tema, blocos, encarte, loja, fundo, numero, total, onAbrir, animado = false, escalaLogo = 1, altura = JORNAL_H }) {
  const logo = Math.min(1.3, Math.max(0.4, Number(escalaLogo ?? encarte?.escalaLogo ?? 1) || 1))
  const contorno = contornoTexto(tema.contorno, 3)
  // Fundo: o enviado pelo mercado, ou o fundo do template (temas com arte), ou o fundo em CSS do tema.
  const imagemFundo = fundo || caminhoArte(tema, 'jornal')
  const arteTitulo = !fundo && caminhoArte(tema, 'titulo')
  const LADO = 300 // colunas do logo e da validade, ao lado da arte do título
  const periodo = encarte?.periodoDe
    ? (encarte.periodoAte && encarte.periodoAte !== encarte.periodoDe
      ? `Ofertas de ${formatData(encarte.periodoDe).slice(0, 5)} a ${formatData(encarte.periodoAte).slice(0, 5)}`
      : `Ofertas de ${formatData(encarte.periodoDe).slice(0, 5)}`)
    : ''
  let indice = 0
  const { semFundo: soltas } = useContextoEncarte()
  return (
    <div className={`arte-fixa relative overflow-hidden ${animado ? 'cm-animado' : ''}`} style={{ width: JORNAL_W, height: altura, background: tema.fundo, fontFamily: 'var(--font-sans)' }}>
      {imagemFundo && <img src={imagemFundo} alt="" className="cm-fundo absolute inset-x-0 top-0 w-full object-cover object-top" style={{ height: JORNAL_H }} />}
      {!imagemFundo && tema.icone && (
        <div aria-hidden="true" className="absolute" style={{ right: -90, top: -60, color: '#ffffff', opacity: 0.13, transform: 'rotate(-14deg)' }}>
          <Icon name={tema.icone} size={660} strokeWidth={1.6} />
        </div>
      )}

      {/* big idea: a arte do título do template centralizada, logo de um lado e validade do outro */}
      <div className="cm-topo absolute inset-x-0 top-0" style={{ height: TOPO }}>
        {arteTitulo ? (
          <>
            <img src={arteTitulo} alt={`${tema.titulo} ${tema.destaque}`} className="absolute object-contain" style={{ left: PAD + LADO, right: PAD + LADO, top: 4, height: TOPO - 14, width: JORNAL_W - (PAD + LADO) * 2 }} />
            <div className="absolute flex flex-col items-start gap-2" style={{ left: PAD, top: 18, width: LADO - 10 }}>
              <LogoEncarte h={130} escala={logo} />
              {tema.chamada && (
                <div className="uppercase leading-[0.95] text-white" style={{ fontFamily: 'Bangers, var(--font-sans)', fontSize: Math.min(40, fonteQueCabe(tema.chamada, (LADO - 10) * 2, 40, 0.5)), letterSpacing: '0.02em', textShadow: contorno }}>{tema.chamada}</div>
              )}
            </div>
            {encarte?.periodoDe && (
              <div className="absolute" style={{ right: PAD, top: 40, width: LADO - 10 }}>
                <FaixaValidade encarte={encarte} tema={tema} fonte={30} alinhar="right" />
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-x-0 top-0 flex flex-col items-center text-center" style={{ paddingTop: 14 }}>
            <LogoEncarte h={100} escala={logo} />
            {!fundo && (
              <div className="flex items-baseline justify-center whitespace-nowrap font-black uppercase italic leading-[0.95] tracking-tight" style={{ gap: '0.22em', marginTop: 4, fontSize: fonteQueCabe(`${tema.titulo} ${tema.destaque}`, 760, 88) }}>
                <span style={{ color: tema.corTitulo, textShadow: contorno }}>{tema.titulo}</span>
                <span style={{ color: tema.corDestaque, textShadow: contorno }}>{tema.destaque}</span>
              </div>
            )}
            {!fundo && tema.chamada && (
              <div className="uppercase leading-none text-white" style={{ marginTop: 4, fontFamily: 'Bangers, var(--font-sans)', fontSize: 36, letterSpacing: '0.03em', textShadow: contorno }}>{tema.chamada}</div>
            )}
            {periodo && (
              <div className="uppercase" style={{ marginTop: 8, fontFamily: 'var(--font-encarte)', fontWeight: 900, fontSize: 28, color: tema.corDestaque, textShadow: contorno }}>
                {periodo} · <span style={{ color: '#ffffff' }}>enquanto durarem os estoques</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* blocos do dia (ou do setor) com a grade de produtos */}
      <div className="absolute flex flex-col" style={{ left: PAD, right: PAD, top: TOPO + 6, gap: GAP }}>
        {blocos.map((bloco) => (
          <section key={bloco.id} className="overflow-hidden" style={{ borderRadius: 20, border: `${BORDA}px solid ${tema.corDestaque}`, background: soltas ? 'rgba(0,0,0,.22)' : '#ffffff', paddingBottom: INTERNO }}>
            <div className="flex items-center justify-center text-center uppercase" style={{ height: CAB, margin: `${INTERNO / 2}px ${INTERNO}px ${INTERNO / 2}px`, clipPath: 'polygon(0 50%, 2.6% 0, 97.4% 0, 100% 50%, 97.4% 100%, 2.6% 100%)', background: `linear-gradient(90deg, ${tema.contorno}, ${tema.precoCor} 12%, ${tema.precoCor} 88%, ${tema.contorno})`, color: '#fff', fontFamily: 'var(--font-encarte)', fontWeight: 900, fontSize: 30, letterSpacing: '0.03em', textShadow: `0 2px 0 ${tema.contorno}` }}>
              {bloco.titulo}{bloco.continua ? ' (continuação)' : ''}
            </div>
            {bloco.tipo ? (
              <div style={{ padding: `0 ${INTERNO}px` }}><SegmentoAncorado s={bloco} tema={tema} onAbrir={onAbrir} contar={() => indice++} /></div>
            ) : (
            <div className="flex flex-col" style={{ gap: 4, padding: `0 ${INTERNO}px` }}>
              {bloco.linhas.map((linha, l) => (
                <div key={l} className="flex" style={{ gap: 4 }}>
                  {linha.map((p) => <Celula key={p.id} produto={p} tema={tema} onAbrir={onAbrir} indice={indice++} />)}
                </div>
              ))}
            </div>
            )}
          </section>
        ))}
      </div>

      {/* rodapé oficial do jornal impresso do Bengala (QR, WhatsApp, lojas, cartões e avisos) */}
      <RodapeOficial altura={RODAPE} />

      {numero && total > 1 && (
        <div className="absolute rounded-full bg-black/60 px-3 py-1 text-[18px] font-black text-white" style={{ right: 12, bottom: RODAPE + 6 }}>{numero}/{total}</div>
      )}
    </div>
  )
}

// ---- uma página de encarte em qualquer layout (grade, destaque ou jornal da semana) ----
export const ehFormatoJornal = (layout) => layout === 'jornal' || layout === 'ancorado'
export const tamanhoPagina = (layout) => (ehFormatoJornal(layout) ? { largura: JORNAL_W, altura: JORNAL_H } : { largura: LARGURA, altura: ALTURA })
export const paginarEncarte = (itens, layout) => (layout === 'ancorado' ? paginarAncorado(itens) : ehFormatoJornal(layout) ? paginarJornal(itens) : paginarTemplate(itens, layout, 'feed'))
export const itensDaPagina = (pagina, layout) => (layout === 'ancorado' ? pagina.flatMap((s) => [...s.ancoras, ...s.resto]) : ehFormatoJornal(layout) ? pagina.flatMap((b) => b.linhas.flat()) : pagina)

// Altura que a página de jornal usa de fato (o site do cliente encolhe a página até o último bloco).
export const alturaDaPagina = (pagina, layout) => (layout === 'ancorado' ? Math.min(JORNAL_H, TOPO + 6 + pagina.reduce((t, s) => t + alturaSegmento(s), 0) + RODAPE + PAD) : alturaUsada(pagina))

// `compacto`: no site do cliente a página do jornal da semana encolhe até o último bloco.
export function PaginaEncarte({ layout, pagina, compacto = false, ...props }) {
  if (ehFormatoJornal(layout)) return <PaginaJornalMercado blocos={pagina} altura={compacto ? alturaDaPagina(pagina, layout) : JORNAL_H} {...props} />
  return <PaginaTemplate itens={pagina} layout={layout} {...props} />
}
