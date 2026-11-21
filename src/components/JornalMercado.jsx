import { PrecoVarejo } from './ui'
import { SETORES, setorById, formatData } from '../lib/utils'
import { caminhoArte } from '../lib/temasCampanha'
import PaginaTemplate, { unidadeDe, paginarTemplate, LARGURA, ALTURA } from './PaginaTemplate'
import logoTransparente from '../assets/logo-bengala-transparente.png'

// Formato "Jornal do mercado", como o jornal impresso do Bengala: página A4 em pé, topo com a
// campanha, blocos "Ofertas válidas somente <dia>" com uma grade cheia de produtos e rodapé com
// os dados da loja. As cores vêm do template escolhido (qualquer tema serve).
//  - Com dia marcado (Mercado Encarte), cada dia vira um bloco.
//  - Sem dia, os blocos são os setores.

export const JORNAL_W = 1080
export const JORNAL_H = 1527 // proporção A4
const COLS = 7
const PAD = 20
const TOPO = 250
const RODAPE = 150
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

// Blocos do jornal: por dia (quando houver) ou por setor.
export function blocosDoJornal(itens) {
  const comDia = itens.filter((p) => p.encarteMercadoDia)
  if (comDia.length) {
    const dias = [...new Set(comDia.map((p) => p.encarteMercadoDia))].sort()
    const blocos = dias.map((dia) => ({
      id: dia,
      titulo: `Ofertas válidas somente ${diaDaSemana(dia)} dia ${formatData(dia)}`,
      itens: comDia.filter((p) => p.encarteMercadoDia === dia),
    }))
    const semDia = itens.filter((p) => !p.encarteMercadoDia)
    if (semDia.length) blocos.push({ id: 'semana', titulo: 'Ofertas da semana', itens: semDia })
    return blocos
  }
  return SETORES
    .map((s) => ({ id: s.id, titulo: `Ofertas de ${s.nome}`, itens: itens.filter((p) => p.setor === s.id) }))
    .concat([{ id: 'outros', titulo: 'Mais ofertas', itens: itens.filter((p) => !SETORES.some((s) => s.id === p.setor)) }])
    .filter((b) => b.itens.length)
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
      const precisa = (parte ? 0 : CAB + BORDA * 2 + INTERNO + GAP) + CELULA_H + 4
      if (precisa > livre) {
        novaPagina()
        parte = null
      }
      if (!parte) {
        parte = { ...bloco, continua: atual.length === 0 && paginas.some((p) => p.some((b) => b.id === bloco.id)), linhas: [] }
        atual.push(parte)
        livre -= CAB + BORDA * 2 + INTERNO + GAP
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
  TOPO + 6 + blocos.reduce((t, b) => t + CAB + BORDA * 2 + INTERNO + GAP + b.linhas.length * (CELULA_H + 4), 0) + RODAPE + PAD))

function Celula({ produto, tema, onAbrir, indice }) {
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
      <div className="absolute inset-x-0 top-0 text-center uppercase leading-[1.02]" style={{ padding: '4px 4px 0', height: 52, overflow: 'hidden', fontFamily: 'var(--font-encarte)', fontWeight: 800, fontSize: fonteNome, color: '#111' }}>
        {produto.nome}
      </div>
      {produto.imagem
        ? <img src={produto.imagem} alt="" className="cm-foto absolute object-contain" style={{ left: 2, top: 52, width: CELULA_W - 4, height: CELULA_H - 52 - 22, '--cm-i': indice }} />
        : <div className="absolute inset-x-0 text-center text-6xl font-black" style={{ top: 70, color: setorById(produto.setor).cor }}>•</div>}
      <div className="cm-preco absolute flex items-end leading-none" style={{ right: 2, bottom: 4, padding: '4px 8px 3px', borderRadius: 8, background: tema.precoCor, border: `3px solid ${tema.precoFundo}`, transform: 'rotate(-3deg)', boxShadow: `3px 3px 0 ${tema.precoSombra}`, '--cm-i': indice }}>
        <PrecoVarejo valor={produto.precoJornal} cor={tema.precoFundo} style={{ fontSize: 34, fontFamily: 'var(--font-encarte)', fontVariantNumeric: 'normal' }} />
        <span style={{ marginLeft: 3, marginBottom: 3, fontSize: 12, fontWeight: 900, color: tema.precoFundo, fontFamily: 'var(--font-encarte)' }}>{unidadeDe(produto)}</span>
      </div>
    </button>
  )
}

export default function PaginaJornalMercado({ tema, blocos, encarte, loja, numero, total, onAbrir, animado = false, escalaLogo = 1, altura = JORNAL_H }) {
  const arte = caminhoArte(tema, 'tv')
  const logo = Math.min(1.3, Math.max(0.4, Number(escalaLogo ?? encarte?.escalaLogo ?? 1) || 1))
  const contorno = `0 3px 0 ${tema.contorno}, 2px 2px 0 ${tema.contorno}, -2px 2px 0 ${tema.contorno}`
  let indice = 0
  return (
    <div className={`relative overflow-hidden ${animado ? 'cm-animado' : ''}`} style={{ width: JORNAL_W, height: altura, background: tema.fundo, fontFamily: 'var(--font-sans)' }}>
      {/* topo da campanha com as cores (ou a arte) do template */}
      <div className="cm-topo absolute inset-x-0 top-0 overflow-hidden" style={{ height: TOPO }}>
        {arte && <img src={arte} alt="" className="absolute right-0 top-0 h-full w-auto object-contain" style={{ maxWidth: '62%' }} />}
        <div className="absolute flex items-center" style={{ left: PAD, top: 18, height: 150 }}>
          <img src={logoTransparente} alt="Bengala Supermercado" className="block w-auto object-contain" style={{ height: 140 * logo }} />
        </div>
        {!arte && (
          <div className="absolute text-right italic" style={{ right: PAD, top: 26, left: 330 }}>
            <div className="whitespace-nowrap font-black uppercase leading-[0.9]" style={{ fontSize: 86, color: tema.corTitulo, textShadow: contorno }}>{tema.titulo}</div>
            <div className="whitespace-nowrap font-black uppercase leading-[0.95]" style={{ fontSize: 76, color: tema.corDestaque, textShadow: contorno }}>{tema.destaque}</div>
          </div>
        )}
        {encarte?.periodoDe && (
          <div className="absolute rounded-full font-black uppercase" style={{ left: PAD, bottom: 14, padding: '6px 18px', fontSize: 24, background: tema.corDestaque, color: tema.contorno }}>
            {encarte.periodoAte && encarte.periodoAte !== encarte.periodoDe ? `Ofertas de ${formatData(encarte.periodoDe).slice(0, 5)} a ${formatData(encarte.periodoAte).slice(0, 5)}` : `Ofertas de ${formatData(encarte.periodoDe).slice(0, 5)}`} · enquanto durarem os estoques
          </div>
        )}
      </div>

      {/* blocos do dia (ou do setor) com a grade de produtos */}
      <div className="absolute flex flex-col" style={{ left: PAD, right: PAD, top: TOPO + 6, gap: GAP }}>
        {blocos.map((bloco) => (
          <section key={bloco.id} className="overflow-hidden" style={{ borderRadius: 20, border: `${BORDA}px solid ${tema.corDestaque}`, background: '#ffffff', paddingBottom: INTERNO }}>
            <div className="flex items-center justify-center text-center font-black uppercase" style={{ height: CAB, margin: `0 0 ${INTERNO / 2}px`, background: `linear-gradient(90deg, ${tema.contorno}, ${tema.precoCor} 18%, ${tema.precoCor} 82%, ${tema.contorno})`, color: '#fff', fontSize: 28, letterSpacing: '0.02em', textShadow: `0 2px 0 ${tema.contorno}` }}>
              {bloco.titulo}{bloco.continua ? ' (continuação)' : ''}
            </div>
            <div className="flex flex-col" style={{ gap: 4, padding: `0 ${INTERNO}px` }}>
              {bloco.linhas.map((linha, l) => (
                <div key={l} className="flex" style={{ gap: 4 }}>
                  {linha.map((p) => <Celula key={p.id} produto={p} tema={tema} onAbrir={onAbrir} indice={indice++} />)}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* rodapé com a loja */}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-4 bg-white" style={{ height: RODAPE, padding: `12px ${PAD}px` }}>
        <img src={logoTransparente} alt="" className="block w-auto object-contain" style={{ height: 90 }} />
        <div className="min-w-0 flex-1 leading-tight text-[#111]">
          {loja?.nome && <div className="font-black uppercase" style={{ fontSize: 24 }}>{loja.nome}</div>}
          {(loja?.endereco || loja?.cidade) && <div style={{ fontSize: 19, fontWeight: 600 }}>{[loja.endereco, loja.cidade].filter(Boolean).join(' · ')}</div>}
          {loja?.whatsapp && <div className="font-black" style={{ fontSize: 22, color: '#128c4a' }}>WhatsApp {loja.whatsapp}</div>}
        </div>
        <div className="max-w-[330px] text-right font-bold uppercase leading-tight text-[#333]" style={{ fontSize: 14 }}>
          Ofertas válidas enquanto durarem os estoques. Reservamo-nos o direito de limitar a quantidade por cliente. Imagens ilustrativas.
        </div>
      </div>

      {numero && total > 1 && (
        <div className="absolute rounded-full bg-black/60 px-3 py-1 text-[18px] font-black text-white" style={{ right: 12, bottom: RODAPE + 6 }}>{numero}/{total}</div>
      )}
    </div>
  )
}

// ---- uma página de encarte em qualquer layout (grade, destaque ou jornal da semana) ----
export const ehFormatoJornal = (layout) => layout === 'jornal'
export const tamanhoPagina = (layout) => (ehFormatoJornal(layout) ? { largura: JORNAL_W, altura: JORNAL_H } : { largura: LARGURA, altura: ALTURA })
export const paginarEncarte = (itens, layout) => (ehFormatoJornal(layout) ? paginarJornal(itens) : paginarTemplate(itens, layout, 'feed'))
export const itensDaPagina = (pagina, layout) => (ehFormatoJornal(layout) ? pagina.flatMap((b) => b.linhas.flat()) : pagina)

// `compacto`: no site do cliente a página do jornal da semana encolhe até o último bloco.
export function PaginaEncarte({ layout, pagina, compacto = false, ...props }) {
  if (ehFormatoJornal(layout)) return <PaginaJornalMercado blocos={pagina} altura={compacto ? alturaUsada(pagina) : JORNAL_H} {...props} />
  return <PaginaTemplate itens={pagina} layout={layout} {...props} />
}
