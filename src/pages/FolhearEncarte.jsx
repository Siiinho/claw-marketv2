import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/ui'
import { SETORES, MERCADO_ENCARTE, formatBRL, noMercadoEncarte, dataISOmaisDias, plural, paraNumero } from '../lib/utils'
import { carregarEncartePublicado, assinarEncarte } from '../lib/encartePublico'
import { temaCampanhaById, temasDoSetor } from '../lib/temasCampanha'
import { PaginaEncarte, paginarEncarte, tamanhoPagina } from '../components/JornalMercado'
import { ContextoEncarte } from '../components/ImagemProduto'
import { LOJAS } from '../data/seed'
import { MarcaContexto, useMarca, LogoOuNome } from '../lib/marca'
import logoPadrao from '../assets/logo.png'
import { useListaCompras } from './EncarteDigital'

// Protótipo: o encarte publicado para folhear como um jornal de verdade. As páginas são as mesmas do
// encarte (big idea, fundo da campanha e rodapé oficial), em qualquer layout. O cliente toca no produto,
// ele é circulado e entra na "nota" — uma nota de conferência que soma o total. Não é cupom fiscal
// nem leva a pagamento: é só para o cliente saber quanto vai gastar antes de chegar no caixa.

const LAYOUTS_VALIDOS = ['jornal', 'ancorado', 'grade', 'destaque']

// Som curto de papel virando (ruído filtrado), só depois de um toque.
let audio = null
function somDePapel() {
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    audio = audio || new (window.AudioContext || window.webkitAudioContext)()
    const dur = 0.3
    const buf = audio.createBuffer(1, audio.sampleRate * dur, audio.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) { const t = i / d.length; d[i] = (Math.random() * 2 - 1) * (1 - t) ** 2 }
    const src = audio.createBufferSource(); src.buffer = buf
    const f = audio.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 0.7
    const g = audio.createGain(); g.gain.value = 0.16
    src.connect(f); f.connect(g); g.connect(audio.destination); src.start()
  } catch (_) { /* sem som */ }
}

// Página do encarte desenhada em tamanho real e reduzida para caber na folha.
function Folha({ children, k, largura, altura, lado = 'direita' }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-white">
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: largura, height: altura, transform: `scale(${k})` }}>{children}</div>
      {/* sombra da dobra do jornal */}
      <div className="pointer-events-none absolute inset-y-0 w-8" style={lado === 'esquerda' ? { right: 0, background: 'linear-gradient(to left, rgba(0,0,0,.28), transparent)' } : { left: 0, background: 'linear-gradient(to right, rgba(0,0,0,.28), transparent)' }} />
    </div>
  )
}

// ---------- setor desativado pela loja ----------
function AjustandoOfertas({ largura, altura, setor, outras, onEscolher }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center rounded-b-xl bg-white px-6 text-center text-[#111]" style={{ width: largura, height: altura }}>
      <svg viewBox="0 0 120 100" className="cm-carrinho h-28 w-32" aria-hidden="true">
        <g transform="rotate(-24 60 70)">
          <path d="M14 22h14l12 44h48l10-32H34" fill="none" stroke="#1f2937" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="46" cy="80" r="7" fill="#1f2937" />
          <circle cx="82" cy="80" r="7" fill="#1f2937" />
        </g>
        <circle cx="96" cy="88" r="5" fill="#d81e29" className="cm-carrinho-item" />
        <rect x="104" y="80" width="9" height="12" rx="2" fill="#ffd23f" className="cm-carrinho-item" style={{ animationDelay: '.15s' }} />
        <line x1="6" y1="96" x2="116" y2="96" stroke="#d1d5db" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <p className="mt-4 text-[26px] font-black leading-tight">Ajustando ofertas</p>
      <p className="mt-2 max-w-[300px] text-[15px] leading-snug text-[#555]">
        {setor ? <>Estamos arrumando as ofertas de <strong className="text-[#111]">{setor.nome}</strong>.</> : 'Estamos arrumando as ofertas.'} Esta página muda sozinha quando elas voltarem.
      </p>
      {outras.length > 0 && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {outras.slice(0, 5).map((a) => (
            <button key={a.id} type="button" onClick={() => onEscolher(a.id)} className="min-h-11 rounded-full bg-[#f1f3f5] px-4 text-[14px] font-bold text-[#111] active:scale-[.97]">{a.nome}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- prévia do produto (antes de anotar) ----------
function PreviaProduto({ produto: p, naNota, onAnotar, onFechar }) {
  const preco = paraNumero(p.precoJornal) || paraNumero(p.precoNormal)
  const de = paraNumero(p.precoNormal)
  const temDe = de > preco + 0.009
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onFechar() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onFechar])
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={p.nome}>
      <button type="button" aria-label="Fechar" onClick={onFechar} className="cm-previa-fundo absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="cm-previa relative w-full max-w-[400px] rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-[#111] shadow-2xl sm:rounded-3xl">
        <button type="button" onClick={onFechar} aria-label="Fechar" className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/5 text-[#333]"><Icon name="X" size={20} /></button>
        <div className="flex h-56 items-center justify-center rounded-2xl bg-white">
          {p.imagem ? <img src={p.imagem} alt={p.nome} className="max-h-full max-w-full object-contain" /> : <Icon name="Package" size={64} className="text-[#999]" />}
        </div>
        <p className="mt-3 text-[17px] font-extrabold uppercase leading-tight">{p.nome}</p>
        {p.gramagem && <p className="text-[14px] text-[#555]">{p.gramagem}</p>}
        <div className="mt-2 flex items-end gap-2">
          {temDe && <span className="pb-1 text-[15px] text-[#777] line-through">{formatBRL(de)}</span>}
          <span className="text-[34px] font-black leading-none text-[#d81e29]">{formatBRL(preco)}</span>
          {p.unidade && <span className="pb-1 text-[14px] text-[#555]">/{p.unidade}</span>}
        </div>
        <button type="button" onClick={onAnotar}
          className={`mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl text-[17px] font-bold ${naNota ? 'border-2 border-[#d81e29] text-[#d81e29]' : 'bg-[#1f2937] text-white'}`}>
          <Icon name={naNota ? 'X' : 'ReceiptText'} size={20} className={naNota ? '' : 'text-[#ffd23f]'} />
          {naNota ? 'Tirar da nota' : 'Anotar na nota'}
        </button>
      </div>
    </div>
  )
}

// ---------- a nota (lista de compras) ----------
function LogoNota() {
  const marca = useMarca()
  if (marca && !marca.logo && !/bengala/i.test(marca.nome || '')) return null
  return <div className="mb-1 flex justify-center"><LogoOuNome marca={marca} padrao={logoPadrao} className="block h-20 w-auto max-w-[75%] object-contain" style={{ filter: "grayscale(1) contrast(1.25)" }} /></div>
}
const linha = (n = 32) => '-'.repeat(n)
const semRS = (v) => formatBRL(v).replace('R$', '').trim()
function Nota({ compras, loja, aberta, setAberta, ultimo, largura, barraRef, pulo }) {
  const total = compras.lista.reduce((s, i) => s + (Number(i.preco) || 0) * (Number(i.qtd) || 1), 0)
  const unidades = compras.lista.reduce((s, i) => s + (Number(i.qtd) || 1), 0)
  const fonte = '"Courier New", ui-monospace, monospace'
  return (
    <>
      {aberta && <button type="button" aria-label="Fechar a nota" onClick={() => setAberta(false)} className="fixed inset-0 z-30 bg-black/40" />}
      <div className="relative z-40" style={{ width: largura }}>
        {/* a nota sai da "impressora" */}
        {aberta && (
          <div className="cm-nota-sai absolute bottom-full left-1/2 mb-[-4px] max-h-[70vh] w-[min(380px,calc(100vw-24px))] -translate-x-1/2 overflow-y-auto bg-[#fdfdf8] px-4 pb-7 pt-4 text-[#222] shadow-[0_10px_30px_rgba(0,0,0,.35)]"
            style={{ fontFamily: fonte, clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 8px), 95% 100%, 90% calc(100% - 8px), 85% 100%, 80% calc(100% - 8px), 75% 100%, 70% calc(100% - 8px), 65% 100%, 60% calc(100% - 8px), 55% 100%, 50% calc(100% - 8px), 45% 100%, 40% calc(100% - 8px), 35% 100%, 30% calc(100% - 8px), 25% 100%, 20% calc(100% - 8px), 15% 100%, 10% calc(100% - 8px), 5% 100%, 0 calc(100% - 8px))' }}>
            <LogoNota />
            <p className="text-center text-[15px] font-bold uppercase">{loja.nome}</p>
            {loja.endereco && <p className="text-center text-[12px] leading-tight">{loja.endereco}</p>}
            <p className="mt-1 text-center text-[12px]">{new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>
            <p className="overflow-hidden whitespace-nowrap text-center text-[12px]">{linha()}</p>
            <p className="text-center text-[13px] font-bold">NOTA DE CONFERÊNCIA</p>
            <p className="text-center text-[11px]">NÃO É DOCUMENTO FISCAL</p>
            <p className="overflow-hidden whitespace-nowrap text-center text-[12px]">{linha()}</p>
            {compras.lista.length === 0 ? (
              <p className="py-4 text-center text-[13px] leading-snug">Toque nos produtos do jornal.<br />Cada um sai aqui, com o preço.</p>
            ) : (
              <ul className="text-[13px] leading-snug">
                {compras.lista.map((i, n) => (
                  <li key={i.id} className={`py-1.5 ${i.id === ultimo ? 'cm-nota-linha' : ''}`}>
                    <div className="flex gap-2"><span>{String(n + 1).padStart(3, '0')}</span><span className="min-w-0 flex-1 uppercase">{i.nome}</span></div>
                    <div className="flex items-center gap-1.5 pl-9">
                      <button type="button" onClick={() => (Number(i.qtd) > 1 ? compras.mudar(i.id, { qtd: Number(i.qtd) - 1 }) : compras.remover(i.id))} aria-label={`Menos ${i.nome}`} className="flex h-9 w-9 items-center justify-center border border-[#222]/40 text-lg">−</button>
                      <span className="w-6 text-center">{i.qtd || 1}</span>
                      <button type="button" onClick={() => compras.mudar(i.id, { qtd: (Number(i.qtd) || 1) + 1 })} aria-label={`Mais ${i.nome}`} className="flex h-9 w-9 items-center justify-center border border-[#222]/40 text-lg">+</button>
                      <span className="ml-1 whitespace-nowrap">x {semRS(i.preco)}</span>
                      <span className="ml-auto whitespace-nowrap font-bold">{semRS((Number(i.preco) || 0) * (Number(i.qtd) || 1))}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="overflow-hidden whitespace-nowrap text-center text-[12px]">{linha()}</p>
            <div className="flex justify-between text-[13px]"><span>QTD. ITENS</span><span>{unidades}</span></div>
            <div className="flex justify-between text-[20px] font-bold"><span>TOTAL R$</span><span>{semRS(total)}</span></div>
            <p className="overflow-hidden whitespace-nowrap text-center text-[12px]">{linha()}</p>
            <p className="text-center text-[11px] leading-snug">Preços do jornal de ofertas, válidos enquanto durarem os estoques. Confira no caixa.</p>
            {compras.lista.length > 0 && (
              <button type="button" onClick={() => { compras.limparTudo(); setAberta(false) }} className="mx-auto mt-3 block min-h-10 px-3 text-[13px] underline">Rasgar a nota e começar de novo</button>
            )}
          </div>
        )}
        {/* a "impressora": sempre à mão, com o total */}
        <button key={pulo} ref={barraRef} type="button" onClick={() => setAberta((v) => !v)} aria-expanded={aberta}
          className={`${pulo ? 'cm-nota-pula ' : ''}relative flex min-h-14 w-full items-center gap-3 rounded-b-2xl bg-[#1f2937] px-4 text-left text-white shadow-[0_8px_20px_rgba(0,0,0,.35)]`}>
          <span aria-hidden="true" className="absolute inset-x-6 top-1.5 h-1 rounded-full bg-black/70" />
          <Icon name="ReceiptText" size={24} className="shrink-0 text-[#ffd23f]" />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold leading-tight">Minha nota</span>
            <span className="block text-[13px] leading-tight text-white/80">{compras.lista.length ? plural(unidades, 'item anotado', 'itens anotados') : 'Toque no produto para anotar'}</span>
          </span>
          <span className="num-tab shrink-0 text-xl font-black text-[#ffd23f]">{formatBRL(total)}</span>
        </button>
      </div>
    </>
  )
}

export default function FolhearEncarte() {
  const [encarte, setEncarte] = useState(null)
  const [atualizado, setAtualizado] = useState(false)
  const compras = useListaCompras()
  useEffect(() => {
    let ativo = true
    let versao = null
    const carregar = async () => {
      const novo = await carregarEncartePublicado()
      if (!ativo || !novo?.itens?.length || novo.versao === versao) return
      if (versao !== null) { setAtualizado(true); setTimeout(() => ativo && setAtualizado(false), 5000) }
      versao = novo.versao
      setEncarte(novo)
    }
    carregar()
    const parar = assinarEncarte(carregar)
    return () => { ativo = false; parar() }
  }, [])

  // O layout é o que a loja escolheu no gerador. O cliente só escolhe o setor, e cada setor sai com a
  // campanha e o período dele, como no site do cliente.
  const loja = encarte?.loja || LOJAS[0]
  const hoje = dataISOmaisDias(0)
  const todos = useMemo(() => {
    if (!encarte) return []
    const pausados = new Set(encarte.pausados || [])
    // ofertas do dia viram uma faixa própria no jornal; a de um dia que já passou volta a ser da semana
    return (encarte.itens || [])
      .filter((p) => !pausados.has(p.setor) && (!p.soMercado || noMercadoEncarte(p, hoje)))
      .map((p) => (noMercadoEncarte(p, hoje) ? p : { ...p, encarteMercadoDia: null }))
  }, [encarte, hoje])
  const pausadosSet = useMemo(() => new Set(encarte?.pausados || []), [encarte])
  const doDia = todos.filter((p) => p.encarteMercadoDia && encarte?.mostrarMercado !== false)
  const daSemana = todos.filter((p) => !p.soMercado)
  const abas = [
    ...(doDia.length ? [{ id: MERCADO_ENCARTE.id, nome: 'Ofertas de hoje', n: doDia.length }] : []),
    ...(encarte?.mostrarGeral !== false && daSemana.length ? [{ id: 'todas', nome: 'Todas', n: daSemana.length }] : []),
    ...SETORES.map((s) => ({ id: s.id, nome: s.nome, n: daSemana.filter((p) => p.setor === s.id).length, ajuste: pausadosSet.has(s.id) && (encarte?.itens || []).some((p) => p.setor === s.id) })).filter((a) => a.n || a.ajuste),
  ]
  const [abaEscolhida, setAba] = useState(null)
  const aba = abas.some((a) => a.id === abaEscolhida) ? abaEscolhida : abas.find((a) => a.id === 'todas')?.id || abas[0]?.id
  const ehHoje = aba === MERCADO_ENCARTE.id
  const emAjuste = abas.find((a) => a.id === aba)?.ajuste || (!abas.some((a) => !a.ajuste) && pausadosSet.size > 0)
  const itens = ehHoje ? doDia : aba === 'todas' ? daSemana : daSemana.filter((p) => p.setor === aba)
  const layout = ehHoje ? 'jornal' : LAYOUTS_VALIDOS.includes(encarte?.layout) ? encarte.layout : 'grade'
  const temaGeral = temaCampanhaById(encarte?.tema)
  const tema = aba && aba !== 'todas'
    ? temaCampanhaById(encarte?.temasSetor?.[aba] || (encarte?.temasV === 2 ? encarte?.tema : temasDoSetor(aba)[0]?.id) || encarte?.tema)
    : temaGeral
  const periodoDaAba = (() => {
    if (ehHoje) { const dias = doDia.map((p) => p.encarteMercadoDia).sort(); return { periodoDe: dias[0], periodoAte: dias[dias.length - 1] } }
    const p = encarte?.periodosSetor?.[aba]
    return p?.de ? { periodoDe: p.de, periodoAte: p.ate || p.de } : { periodoDe: encarte?.periodoDe, periodoAte: encarte?.periodoAte }
  })()
  const paginas = useMemo(() => paginarEncarte(itens, layout), [itens, layout])
  const tamanho = tamanhoPagina(layout)
  const n = paginas.length


  // ---- nota ----
  const [notaAberta, setNotaAberta] = useState(false)
  const [ultimo, setUltimo] = useState(null)
  const marcados = useMemo(() => new Set(compras.lista.map((i) => i.id)), [compras.lista])
  const contexto = useMemo(() => ({ semFundo: false, marcados }), [marcados])
  // Tocar no produto abre a prévia; "Anotar" circula o produto na página e ele voa até a nota.
  const [previa, setPrevia] = useState(null)
  const [voo, setVoo] = useState(null)
  const [notaPulo, setNotaPulo] = useState(0)
  const toque = useRef({ x: 0, y: 0 })
  const notaRef = useRef(null)
  const tocarProduto = useCallback((p) => setPrevia({ produto: p, x: toque.current.x, y: toque.current.y }), [])
  const anotar = useCallback(() => {
    if (!previa) return
    const p = previa.produto
    const tinha = compras.tem(p.id)
    compras.alternar({ ...p, precoJornal: paraNumero(p.precoJornal) || paraNumero(p.precoNormal) })
    setPrevia(null)
    if (tinha) return
    setUltimo(String(p.id))
    try { navigator.vibrate?.(30) } catch (_) { /* sem vibrar */ }
    const alvo = notaRef.current?.getBoundingClientRect()
    const reduzido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!alvo || reduzido) { setNotaPulo((v) => v + 1); return }
    // primeiro a caneta circula (0,5 s), depois a foto voa para a nota
    const id = Date.now()
    setTimeout(() => setVoo({ id, img: p.imagem, de: { x: previa.x, y: previa.y }, para: { x: alvo.left + 34, y: alvo.top + alvo.height / 2 } }), 450)
    setTimeout(() => { setVoo((v) => (v?.id === id ? null : v)); setNotaPulo((v) => v + 1) }, 450 + 700)
  }, [previa, compras])

  // ---- tamanho: uma página no celular, duas abertas no PC ----
  const palcoRef = useRef(null)
  const [tela, setTela] = useState({ w: 360, h: 640 })
  useEffect(() => {
    const medir = () => setTela({ w: window.innerWidth, h: window.innerHeight })
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [])
  const duplo = tela.w >= 900 && tela.w > tela.h
  const k = Math.min((tela.w - (duplo ? 24 : 0)) / (tamanho.largura * (duplo ? 2 : 1)), (tela.h - 40 - 56 - 12) / tamanho.altura)
  const W = Math.round(tamanho.largura * k)
  const H = Math.round(tamanho.altura * k)

  // ---- folhas: no celular cada página é uma folha; no PC, frente e verso ----
  const nFolhas = duplo ? Math.ceil(n / 2) : n
  const frente = (f) => (duplo ? 2 * f : f)
  const verso = (f) => (duplo ? 2 * f + 1 : null)
  const [virada, setVirada] = useState(0)
  useEffect(() => { setVirada(0) }, [aba])
  useEffect(() => { setVirada((v) => Math.min(v, Math.max(0, duplo ? nFolhas : nFolhas - 1))) }, [nFolhas, duplo])
  const ultimoDuplo = useRef(duplo)
  useEffect(() => {
    if (ultimoDuplo.current === duplo) return
    setVirada((v) => (duplo ? Math.ceil(v / 2) : Math.max(0, 2 * v - 1)))
    ultimoDuplo.current = duplo
  }, [duplo])

  const reduzido = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const [giro, setGiro] = useState(null) // { folha, angulo (0 deitada, -180 virada), animando, volta }
  const arrasto = useRef(null)
  // no PC dá para virar a última folha (o verso dela fica aberto à esquerda)
  const podeIr = duplo ? virada < nFolhas && frente(virada) + 1 < n : virada < nFolhas - 1
  const podeVoltar = virada > 0
  const terminar = useCallback((destino) => {
    setGiro((g) => {
      if (!g) return g
      if (reduzido) { setVirada(destino === -180 ? g.folha + 1 : g.folha); return null }
      return { ...g, angulo: destino, animando: true }
    })
  }, [reduzido])
  const ir = useCallback(() => {
    if (!podeIr || giro) return
    somDePapel()
    if (reduzido) { setVirada((v) => v + 1); return }
    setGiro({ folha: virada, angulo: 0, animando: false })
    requestAnimationFrame(() => requestAnimationFrame(() => setGiro((g) => g && { ...g, angulo: -180, animando: true })))
  }, [podeIr, giro, virada, reduzido])
  const voltar = useCallback(() => {
    if (!podeVoltar || giro) return
    somDePapel()
    if (reduzido) { setVirada((v) => v - 1); return }
    setGiro({ folha: virada - 1, angulo: -180, animando: false, volta: true })
    requestAnimationFrame(() => requestAnimationFrame(() => setGiro((g) => g && { ...g, angulo: 0, animando: true })))
  }, [podeVoltar, giro, virada, reduzido])
  const fimDaAnimacao = (e) => {
    if (e.target !== e.currentTarget || !giro?.animando) return
    setVirada(giro.angulo === -180 ? giro.folha + 1 : giro.folha)
    setGiro(null)
  }
  useEffect(() => {
    const tecla = (e) => { if (e.key === 'ArrowRight') ir(); else if (e.key === 'ArrowLeft') voltar() }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [ir, voltar])

  // arrastar: a folha segue o dedo; soltar depois de um terço termina a virada
  const aoTocar = (e) => {
    if (giro?.animando) return
    arrasto.current = { x0: e.clientX, caixa: palcoRef.current.getBoundingClientRect(), ativo: false, id: e.pointerId }
  }
  const aoMover = (e) => {
    const a = arrasto.current
    if (!a || a.id !== e.pointerId) return
    const dx = e.clientX - a.x0
    if (!a.ativo) {
      if (Math.abs(dx) < 12) return
      if (dx < 0 && podeIr) a.sentido = 'ir'
      else if (dx > 0 && podeVoltar) a.sentido = 'voltar'
      else { arrasto.current = null; return }
      a.ativo = true
      somDePapel()
      try { palcoRef.current.setPointerCapture(e.pointerId) } catch (_) { /* segue sem captura */ }
    }
    a.p = Math.max(0, Math.min(1, Math.abs(dx) / (W * (duplo ? 1.6 : 1.1))))
    setGiro(a.sentido === 'ir'
      ? { folha: virada, angulo: -180 * a.p, animando: false }
      : { folha: virada - 1, angulo: -180 + 180 * a.p, animando: false, volta: true })
  }
  const aoSoltar = (e) => {
    const a = arrasto.current
    arrasto.current = null
    if (!a?.ativo) {
      // toque na beirada da página (fora de um produto) também vira
      if (a && !e.target.closest('button')) {
        const x = e.clientX - a.caixa.left
        if (x > a.caixa.width * 0.85) ir()
        else if (x < a.caixa.width * 0.15) voltar()
      }
      return
    }
    // o fim do arrasto não pode virar um toque no produto
    const bloquear = (ev) => { ev.stopPropagation(); ev.preventDefault() }
    window.addEventListener('click', bloquear, { capture: true, once: true })
    setTimeout(() => window.removeEventListener('click', bloquear, { capture: true }), 60)
    const passou = a.p > 0.33
    if (a.sentido === 'ir') terminar(passou ? -180 : 0)
    else terminar(passou ? 0 : -180)
  }

  const encarteDaPagina = encarte ? periodoDaAba : null
  const pagina = (i, lado) => (i === null || i === undefined || i < 0 || i >= n ? null : (
    <Folha k={k} largura={tamanho.largura} altura={tamanho.altura} lado={lado}>
      <PaginaEncarte tema={tema} pagina={paginas[i]} encarte={encarteDaPagina} loja={loja} layout={layout} numero={i + 1} total={n} onAbrir={tocarProduto} escalaLogo={encarte?.escalaLogo} fundo={encarte?.fundos?.[tema.id] || (tema.id === encarte?.tema ? encarte?.fundo : null) || null} />
    </Folha>
  ))
  const paginaDireita = (f) => (f < nFolhas && frente(f) < n ? frente(f) : null)
  const paginaEsquerda = (f) => (duplo && f > 0 ? verso(f - 1) : null)
  const g = giro
  const baseDireita = g ? (g.volta ? paginaDireita(virada) : paginaDireita(virada + 1)) : paginaDireita(virada)
  const baseEsquerda = g ? (g.volta ? paginaEsquerda(virada - 1) : paginaEsquerda(virada)) : paginaEsquerda(virada)
  const sombra = g ? Math.sin((Math.abs(g.angulo) / 180) * Math.PI) : 0
  const numeroAtual = duplo ? (virada === 0 ? 1 : Math.min(n, 2 * virada)) : virada + 1
  const doisAbertos = duplo && virada > 0 && numeroAtual < n
  // jornal fechado (só a capa) ou no fim (só a última): centraliza a página que está aberta
  const soDireita = duplo && !g && virada === 0
  const soEsquerda = duplo && !g && virada > 0 && baseDireita === null
  // abas e nota acompanham a largura do que está aberto (uma página ou as duas)
  const larguraAberta = duplo && !soDireita && !soEsquerda ? W * 2 : W
  const [dica, setDica] = useState(true)
  useEffect(() => { if (virada > 0) setDica(false) }, [virada])

  return (
    <MarcaContexto.Provider value={encarte?.marca || null}>
    <ContextoEncarte.Provider value={contexto}>
      <div className="fixed inset-0 select-none overflow-hidden text-white" style={{ background: tema.fundo }}>
        <style>{`
          .cm-nota-sai { animation: cm-nota-sai .35s cubic-bezier(.2,.8,.2,1) both; transform-origin: bottom }
          @keyframes cm-nota-sai { from { transform: translateY(40px) scaleY(.6); opacity: 0 } to { transform: none; opacity: 1 } }
          .cm-nota-linha { animation: cm-nota-linha .7s ease-out both }
          @keyframes cm-nota-linha { from { background: #fff3b0; clip-path: inset(0 0 100% 0) } to { background: transparent; clip-path: inset(0) } }
          .cm-carrinho g { transform-box: fill-box; transform-origin: 30% 90%; animation: cm-tomba 2.6s ease-in-out infinite }
          @keyframes cm-tomba { 0%, 100% { rotate: 0deg } 50% { rotate: -5deg } }
          .cm-carrinho-item { animation: cm-rola 2.6s ease-in-out infinite }
          @keyframes cm-rola { 0%, 100% { transform: translateX(0) } 50% { transform: translateX(3px) } }
          .cm-nota-pula { animation: cm-nota-pula .45s cubic-bezier(.3,1.6,.5,1) }
          @keyframes cm-nota-pula { 0% { transform: scale(1) } 35% { transform: scale(1.05) } 100% { transform: scale(1) } }
          .cm-previa-fundo { animation: cm-aparece .2s ease-out both }
          .cm-previa { animation: cm-previa .28s cubic-bezier(.2,.9,.25,1) both }
          @keyframes cm-aparece { from { opacity: 0 } }
          @keyframes cm-previa { from { opacity: 0; transform: translateY(24px) scale(.96) } }
          .cm-voo { position: fixed; z-index: 70; width: 84px; height: 84px; pointer-events: none; border-radius: 16px; background: #fff; padding: 6px; box-shadow: 0 10px 24px rgba(0,0,0,.35); offset-rotate: 0deg; animation: cm-voo .7s cubic-bezier(.55,0,.75,.4) forwards }
          @keyframes cm-voo { 0% { offset-distance: 0%; transform: scale(1) } 100% { offset-distance: 100%; transform: scale(.25); opacity: .6 } }
          @media (prefers-reduced-motion: reduce) { .cm-carrinho g, .cm-carrinho-item, .cm-nota-sai, .cm-nota-linha, .cm-nota-pula, .cm-previa, .cm-previa-fundo, .cm-voo { animation: none } }
        `}</style>
        {/* a campanha ao fundo, escurecida, para o jornal saltar */}
        <div className="pointer-events-none absolute inset-0 bg-black/55" />

        {!encarte ? (
          <p className="absolute inset-0 flex items-center justify-center text-lg font-semibold">Abrindo o jornal de hoje…</p>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
            {/* abas presas no topo do jornal: layout (protótipo) e a página */}
            <div className="flex h-11 items-end gap-1.5 overflow-x-auto px-0.5 transition-[width] duration-300 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ width: larguraAberta }}>
              {abas.map((a) => (
                <button key={a.id} type="button" onClick={(e) => { setAba(a.id); e.currentTarget.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }) }} aria-pressed={aba === a.id}
                  className={`shrink-0 whitespace-nowrap rounded-t-2xl border border-b-0 px-3.5 text-[13px] font-bold backdrop-blur-xl backdrop-saturate-150 transition-[background-color,height,color] duration-200 ${aba === a.id ? 'h-10 border-white/70 bg-white/80 text-[#111] shadow-[inset_0_1px_0_rgba(255,255,255,.9)]' : 'h-9 border-white/25 bg-white/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.35)] hover:bg-white/25'}`}>
                  {a.id === MERCADO_ENCARTE.id && <span aria-hidden="true" className="mr-1 text-[#d81e29]">★</span>}{a.nome} {a.ajuste ? <Icon name="Wrench" size={13} className={`inline ${aba === a.id ? 'text-[#b3261e]' : 'text-white/80'}`} aria-label="ajustando" /> : <span className={aba === a.id ? 'text-[#555]' : 'text-white/75'}>{a.n}</span>}
                </button>
              ))}
            </div>
            {emAjuste ? (
              <AjustandoOfertas largura={larguraAberta} altura={H} setor={SETORES.find((s) => s.id === aba)} outras={abas.filter((a) => !a.ajuste)} onEscolher={setAba} />
            ) : (
            <div
              ref={palcoRef}
              onPointerDownCapture={(e) => { toque.current = { x: e.clientX, y: e.clientY } }}
              onPointerDown={aoTocar}
              onPointerMove={aoMover}
              onPointerUp={aoSoltar}
              onPointerCancel={aoSoltar}
              className="relative touch-pan-y"
              style={{ width: duplo ? W * 2 : W, height: H, perspective: `${W * 3}px`, filter: 'drop-shadow(0 14px 24px rgba(0,0,0,.5))', transform: soDireita ? `translateX(${-W / 2}px)` : soEsquerda ? `translateX(${W / 2}px)` : 'none', transition: 'transform .45s ease' }}
              aria-roledescription="jornal"
              aria-label={`Jornal de ofertas, página ${numeroAtual} de ${n}`}
            >
              {duplo && baseEsquerda !== null && <div className="absolute inset-y-0 left-0" style={{ width: W }}>{pagina(baseEsquerda, 'esquerda')}</div>}
              {baseDireita !== null && (
                <div className="absolute inset-y-0" style={{ left: duplo ? W : 0, width: W }}>
                  {pagina(baseDireita)}
                  {g && <div className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(to right, rgba(0,0,0,${0.4 * sombra}), transparent 60%)` }} />}
                </div>
              )}
              {g && (
                <div onTransitionEnd={fimDaAnimacao} className="absolute inset-y-0"
                  style={{ left: duplo ? W : 0, width: W, transformStyle: 'preserve-3d', transformOrigin: 'left center', transform: `rotateY(${g.angulo}deg)`, transition: g.animando ? 'transform 560ms cubic-bezier(.3,.7,.25,1)' : 'none', zIndex: 5 }}>
                  <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }}>
                    {pagina(frente(g.folha))}
                    <div className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(to left, rgba(255,255,255,${0.22 * sombra}), rgba(0,0,0,${0.32 * sombra}))` }} />
                  </div>
                  <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                    {duplo && verso(g.folha) < n
                      ? pagina(verso(g.folha), 'esquerda')
                      : <div className="absolute inset-0 bg-[#f4f1ea]"><div className="absolute inset-0 opacity-[.13]" style={{ transform: 'scaleX(-1)' }}>{pagina(frente(g.folha))}</div></div>}
                    <div className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(to right, rgba(255,255,255,${0.2 * sombra}), rgba(0,0,0,${0.3 * sombra}))` }} />
                  </div>
                </div>
              )}
              {duplo && !soDireita && !soEsquerda && <div className="pointer-events-none absolute inset-y-0 z-10" style={{ left: W - 1, width: 2, background: 'rgba(0,0,0,.35)' }} />}
              {/* setas presas nas laterais do jornal */}
              {podeVoltar && <button type="button" onClick={voltar} aria-label="Página anterior" className="absolute left-1.5 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur-sm hover:bg-black/70"><Icon name="ChevronLeft" size={28} /></button>}
              {podeIr && <button type="button" onClick={ir} aria-label="Próxima página" className="absolute right-1.5 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur-sm hover:bg-black/70"><Icon name="ChevronRight" size={28} /></button>}
              {dica && podeIr && <span style={{ left: duplo ? (soDireita ? W * 1.5 : W) : W / 2 }} className="pointer-events-none absolute bottom-3 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-3 py-1.5 text-[13px] font-semibold text-white">Arraste para virar a página →</span>}
              {n > 1 && <span style={{ right: soDireita ? 8 : soEsquerda ? W + 8 : 8 }} className="pointer-events-none absolute bottom-2 z-20 rounded-full bg-black/60 px-2 py-0.5 text-[12px] font-bold text-white">{doisAbertos ? `${numeroAtual}–${numeroAtual + 1}` : numeroAtual} / {n}</span>}
              {atualizado && <span className="pointer-events-none absolute right-2 top-2 z-20 rounded-full bg-[#ffd23f] px-2.5 py-1 text-[12px] font-bold text-[#222]">Atualizado agora</span>}
            </div>
            )}
            {/* a nota presa embaixo do jornal */}
            <Nota compras={compras} loja={loja} aberta={notaAberta} setAberta={setNotaAberta} ultimo={ultimo} largura={larguraAberta} barraRef={notaRef} pulo={notaPulo} />
          </div>
        )}
        {previa && <PreviaProduto produto={previa.produto} naNota={compras.tem(previa.produto.id)} onAnotar={anotar} onFechar={() => setPrevia(null)} />}
        {voo && (
          <img key={voo.id} src={voo.img} alt="" aria-hidden="true" className="cm-voo object-contain"
            style={{ left: 0, top: 0, offsetPath: `path("M ${voo.de.x} ${voo.de.y} Q ${(voo.de.x + voo.para.x) / 2} ${Math.min(voo.de.y, voo.para.y) - 120} ${voo.para.x} ${voo.para.y}")` }} />
        )}
      </div>
    </ContextoEncarte.Provider>
    </MarcaContexto.Provider>
  )
}
