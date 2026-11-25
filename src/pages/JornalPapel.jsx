import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ImagemSetor } from '../components/ui'
import { SETORES, setorById, formatBRL, formatDataCurta, MERCADO_ENCARTE, noMercadoEncarte, dataISOmaisDias, plural, paraNumero, seloOfertaById } from '../lib/utils'
import { carregarEncartePublicado, assinarEncarte } from '../lib/encartePublico'
import { temaCampanhaById, caminhoArte } from '../lib/temasCampanha'
import { LOJAS } from '../data/seed'
import { useListaCompras } from './EncarteDigital'

// Protótipo: o encarte publicado como um jornal impresso de verdade. O cliente folheia com o dedo,
// circula de caneta o que quer levar e anota no papelzinho da lista. Mesmos dados do site do cliente.

const PW = 560 // página, em pixels de desenho
const PH = 800
const POR_PAGINA = 6
const TINTA = '#1d1a16'
const VERMELHO = '#c8102e'

// Granulado do papel-jornal (sem imagem externa).
const GRAO = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .32 0 0 0 0 .27 0 0 0 0 .18 0 0 0 .55 0"/></filter><rect width="220" height="220" filter="url(#g)"/></svg>')}")`
const PAPEL = { backgroundColor: '#efe6cf', backgroundImage: `${GRAO}, radial-gradient(120% 90% at 50% 40%, rgba(255,255,255,.35), rgba(120,96,50,.14))`, color: TINTA }
const SERIFA = 'Georgia, "Times New Roman", serif'

const extenso = (iso) => {
  const d = iso ? new Date(`${iso}T12:00:00`) : new Date()
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
const nomeBonito = (nome = '') => String(nome).toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase())

// Som curto de papel virando (ruído filtrado), só depois de um toque.
let audio = null
function somDePapel() {
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    audio = audio || new (window.AudioContext || window.webkitAudioContext)()
    const dur = 0.32
    const buf = audio.createBuffer(1, audio.sampleRate * dur, audio.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) { const t = i / d.length; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2) * (0.6 + 0.4 * Math.sin(t * 40)) }
    const src = audio.createBufferSource(); src.buffer = buf
    const f = audio.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 0.7
    const g = audio.createGain(); g.gain.value = 0.18
    src.connect(f); f.connect(g); g.connect(audio.destination); src.start()
  } catch (_) { /* sem som */ }
}

// ---------- páginas ----------
function Cabecalho({ esquerda, centro, numero }) {
  return (
    <div style={{ fontFamily: SERIFA }}>
      <div className="flex items-end justify-between text-[11px] font-bold uppercase tracking-[0.12em]">
        <span>{esquerda}</span><span>{centro}</span><span>Pág. {numero}</span>
      </div>
      <div className="mt-1 border-t-[3px] border-b border-current pb-[2px]" style={{ borderColor: TINTA }} />
    </div>
  )
}

function Circulo() {
  // traço de caneta, meio torto, como quem circula no jornal
  return (
    <svg viewBox="0 0 200 160" preserveAspectRatio="none" className="pointer-events-none absolute -inset-1 h-[calc(100%+8px)] w-[calc(100%+8px)]" aria-hidden="true">
      <path d="M100 10 C 160 8, 194 40, 190 82 C 186 128, 140 154, 92 150 C 40 146, 8 118, 12 76 C 16 36, 56 14, 112 16" fill="none" stroke={VERMELHO} strokeWidth="4.5" strokeLinecap="round" className="jp-caneta" style={{ opacity: 0.88 }} />
    </svg>
  )
}

function Produto({ p, marcado, onMarcar }) {
  const de = paraNumero(p.precoNormal)
  const por = paraNumero(p.precoJornal) || de
  const temDe = de && por && de > por + 0.004
  const selo = seloOfertaById(p.seloOferta)
  const [reais, cent] = formatBRL(por).replace('R$', '').trim().split(',')
  return (
    <button type="button" data-produto onClick={() => onMarcar(p)} aria-pressed={marcado} aria-label={`${p.nome}, ${formatBRL(por)}. ${marcado ? 'Circulado, está na sua lista' : 'Toque para circular e pôr na lista'}`}
      className="relative flex h-full w-full flex-col items-center px-2 pb-1 pt-2 text-center" style={{ fontFamily: SERIFA }}>
      {selo && !selo.nenhum && (
        <span className="absolute left-1 top-1 z-[1] -rotate-6 px-1.5 py-[1px] text-[11px] font-black uppercase tracking-wide text-white" style={{ background: VERMELHO, fontFamily: 'Anton, sans-serif', letterSpacing: '.04em' }}>{selo.texto}</span>
      )}
      <div className="relative h-[118px] w-full">
        {p.imagem
          ? <img src={p.imagem} alt="" draggable="false" loading="lazy" className="h-full w-full object-contain" style={{ mixBlendMode: 'multiply', filter: 'contrast(1.06) saturate(.88) sepia(.08)' }} />
          : <span className="flex h-full items-center justify-center opacity-80" style={{ mixBlendMode: 'multiply' }}><ImagemSetor id={p.setor} size={86} /></span>}
      </div>
      <div className="mt-1 line-clamp-2 text-[14px] font-bold uppercase leading-[1.15]">{nomeBonito(p.nome)}</div>
      {p.gramagem && <div className="text-[11.5px] italic opacity-80">{p.gramagem}</div>}
      <div className="mt-auto flex items-end justify-center gap-2 pt-1">
        {temDe && <span className="mb-[6px] text-[12px] leading-tight opacity-80">de <s>{formatBRL(de)}</s><br />por</span>}
        <span className="relative inline-block px-1 leading-none" style={{ fontFamily: 'Anton, sans-serif', color: VERMELHO }}>
          <span className="absolute inset-x-[-6px] inset-y-[-2px] -z-0 -rotate-2 rounded-[40%]" style={{ background: '#ffd23f', mixBlendMode: 'multiply', opacity: 0.9 }} />
          <span className="relative text-[15px]">R$ </span><span className="relative text-[38px]">{reais}</span><span className="relative align-top text-[19px]">,{cent}</span>
          {p.unidade && p.unidade !== 'UNI' && <span className="relative ml-0.5 text-[12px]">{p.unidade.toLowerCase()}</span>}
        </span>
      </div>
      {marcado && <Circulo />}
      {marcado && <span className="absolute bottom-0 right-0.5 -rotate-6 text-[16px]" style={{ fontFamily: 'Kalam, cursive', color: VERMELHO }}>levar!</span>}
    </button>
  )
}

function PaginaProdutos({ pagina, numero, loja, compras }) {
  const { grupo, itens, continuacao } = pagina
  const ehHoje = grupo.id === MERCADO_ENCARTE.id
  return (
    <div className="flex h-full flex-col px-7 pb-6 pt-6">
      <Cabecalho esquerda={loja.nome} centro={ehHoje ? 'Ofertas do dia' : grupo.id === 'varios' ? grupo.nome : `Caderno ${grupo.nome}`} numero={numero} />
      <div className="mt-3 flex items-center gap-3">
        {ehHoje ? <span className="text-[34px]" aria-hidden="true">★</span> : grupo.id !== 'varios' && <span style={{ mixBlendMode: 'multiply' }}><ImagemSetor id={grupo.id} size={46} /></span>}
        <h2 className="uppercase leading-none" style={{ fontFamily: '"Alfa Slab One", serif', color: ehHoje ? VERMELHO : TINTA, fontSize: grupo.id === 'varios' ? 30 : 44 }}>{ehHoje ? 'Só hoje' : grupo.id === 'varios' ? 'Ofertas da semana' : grupo.nome}</h2>
        {continuacao && <span className="ml-auto text-[12px] italic" style={{ fontFamily: SERIFA }}>continuação</span>}
      </div>
      <div className="mt-2 border-t border-current opacity-60" />
      <div className="mt-2 grid flex-1 grid-cols-2 grid-rows-3">
        {Array.from({ length: POR_PAGINA }, (_, i) => itens[i]).map((p, i) => (
          <div key={p?.id || `v${i}`} className="relative min-h-0" style={{ borderRight: i % 2 === 0 ? `1px solid ${TINTA}40` : 'none', borderBottom: i < 4 ? `1px dashed ${TINTA}55` : 'none' }}>
            {p && grupo.id === 'varios' && p.setor !== itens[i - 1]?.setor && (
              <span className="absolute right-1 top-1 z-[1] text-[10px] font-bold uppercase tracking-[0.12em]" style={{ fontFamily: SERIFA, color: setorById(p.setor).corTag }}>{setorById(p.setor).nome}</span>
            )}
            {p ? <Produto p={p} marcado={compras.tem(p.id)} onMarcar={compras.alternar} /> : null}
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-[10.5px] italic opacity-75" style={{ fontFamily: SERIFA }}>Toque no produto para circular e anotar na sua lista. Imagens ilustrativas.</p>
    </div>
  )
}

function Capa({ encarte, loja, tema, indice, destaques, compras, total }) {
  const arte = caminhoArte(tema, 'titulo')
  return (
    <div className="flex h-full flex-col px-7 pb-6 pt-5" style={{ fontFamily: SERIFA }}>
      <div className="flex justify-between text-[11px] font-bold uppercase tracking-[0.14em]"><span>Distribuição gratuita</span><span>Edição de {formatDataCurta(encarte.publicadoEm?.slice(0, 10) || dataISOmaisDias(0))}</span></div>
      <h1 className="mt-1 whitespace-nowrap text-center uppercase leading-[0.95]" style={{ fontFamily: '"Alfa Slab One", serif', letterSpacing: '-0.01em', fontSize: Math.min(54, Math.floor(880 / Math.max(8, String(loja.nome).length))) }}>{loja.nome}</h1>
      <div className="mt-1 border-y-[3px] border-double py-1 text-center text-[12px] font-bold uppercase tracking-[0.12em]" style={{ borderColor: TINTA }}>
        {extenso(dataISOmaisDias(0))} · {plural(total, 'oferta', 'ofertas')} nesta edição
      </div>
      <div className="relative mt-3 flex items-center gap-3">
        {arte
          ? <img src={arte} alt={`${tema.titulo} ${tema.destaque}`} draggable="false" className="h-[236px] w-[256px] shrink-0 object-contain" style={{ mixBlendMode: 'multiply', filter: 'saturate(.9) contrast(1.04)' }} />
          : <div className="w-[270px] shrink-0 text-[64px] uppercase leading-[0.9]" style={{ fontFamily: 'Anton, sans-serif', color: VERMELHO }}>{tema.titulo}<br />{tema.destaque}</div>}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold uppercase tracking-wide" style={{ color: VERMELHO }}>Manchete</p>
          <p className="text-[30px] leading-[1.02]" style={{ fontFamily: '"Alfa Slab One", serif' }}>{tema.chamada || 'Os preços caíram!'}</p>
          {encarte.periodoDe && <p className="mt-2 text-[15px] leading-snug">Ofertas válidas de <b>{formatDataCurta(encarte.periodoDe)}</b> a <b>{formatDataCurta(encarte.periodoAte)}</b> ou enquanto durarem os estoques.</p>}
        </div>
      </div>
      <div className="mt-3 border-t-2 pt-2" style={{ borderColor: TINTA }}>
        <p className="text-[12px] font-bold uppercase tracking-[0.12em]">Destaques da capa</p>
        <div className="mt-1 grid h-[220px] grid-cols-3">
          {destaques.slice(0, 3).map((p, i) => (
            <div key={p.id} className="relative min-h-0" style={{ borderRight: i < 2 ? `1px solid ${TINTA}40` : 'none' }}>
              <Produto p={p} marcado={compras.tem(p.id)} onMarcar={compras.alternar} />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-auto border-t-2 pt-2" style={{ borderColor: TINTA }}>
        <p className="text-[12px] font-bold uppercase tracking-[0.12em]">Nesta edição</p>
        <p className="mt-0.5 line-clamp-3 text-[13px] leading-snug">{indice.map((x) => `${x.nome}, pág. ${x.pagina}`).join(' · ')}</p>
      </div>
    </div>
  )
}

function Contracapa({ loja, numero }) {
  const whats = String(loja.whatsapp || '').replace(/\D/g, '')
  const linkWhats = whats ? `https://wa.me/${whats.length <= 11 ? `55${whats}` : whats}?text=${encodeURIComponent('Olá! Vi o jornal de ofertas e quero saber mais.')}` : null
  const linkMapa = loja.endereco ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${loja.nome}, ${loja.endereco}, ${loja.cidade || ''}`)}` : null
  return (
    <div className="flex h-full flex-col px-7 pb-6 pt-6" style={{ fontFamily: SERIFA }}>
      <Cabecalho esquerda={loja.nome} centro="Serviço" numero={numero} />
      <h2 className="mt-6 text-center text-[46px] uppercase leading-none" style={{ fontFamily: '"Alfa Slab One", serif' }}>Te esperamos!</h2>
      <p className="mx-auto mt-3 max-w-[400px] text-center text-[17px] leading-snug">Leve este jornal no celular. As ofertas mudam sozinhas quando a loja publica uma edição nova.</p>
      <div className="mx-auto mt-8 w-full max-w-[420px] border-2 border-dashed p-5 text-center" style={{ borderColor: TINTA }}>
        <p className="text-[13px] font-bold uppercase tracking-[0.14em]">Endereço</p>
        <p className="mt-1 text-[19px] font-bold leading-snug">{loja.endereco || loja.nome}{loja.cidade ? ` · ${loja.cidade}` : ''}</p>
        {loja.whatsapp && <p className="mt-3 text-[13px] font-bold uppercase tracking-[0.14em]">WhatsApp</p>}
        {loja.whatsapp && <p className="text-[22px] font-bold">{loja.whatsapp}</p>}
        <div className="mt-4 flex justify-center gap-3">
          {linkWhats && <a href={linkWhats} target="_blank" rel="noreferrer" data-produto className="inline-flex min-h-11 items-center px-4 text-[15px] font-bold uppercase text-white" style={{ background: '#1f7a43' }}>Chamar no WhatsApp</a>}
          {linkMapa && <a href={linkMapa} target="_blank" rel="noreferrer" data-produto className="inline-flex min-h-11 items-center border-2 px-4 text-[15px] font-bold uppercase" style={{ borderColor: TINTA }}>Como chegar</a>}
        </div>
      </div>
      <p className="mt-auto text-center text-[11px] italic opacity-75">Preços válidos enquanto durarem os estoques. Imagens ilustrativas.</p>
    </div>
  )
}

// ---------- o livro ----------
function Folha({ children, verso = false, className = '', style }) {
  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} style={{ ...PAPEL, ...style }}>
      {/* o papel vai junto com o conteúdo: a foto em "multiply" só mistura com o que está no mesmo grupo */}
      <div className="absolute left-0 top-0 origin-top-left" style={{ ...PAPEL, backgroundImage: GRAO, backgroundSize: `${220 / 1}px`, width: PW, height: PH, transform: 'scale(var(--k))' }}>{children}</div>
      {/* sombra da dobra */}
      <div className="pointer-events-none absolute inset-y-0 w-10" style={verso ? { right: 0, background: 'linear-gradient(to left, rgba(60,40,10,.28), transparent)' } : { left: 0, background: 'linear-gradient(to right, rgba(60,40,10,.28), transparent)' }} />
    </div>
  )
}

export default function JornalPapel() {
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

  // ---- monta as páginas ----
  const loja = encarte?.loja || LOJAS[0]
  const tema = temaCampanhaById(encarte?.tema)
  const paginas = useMemo(() => {
    if (!encarte) return []
    const pausados = new Set(encarte.pausados || [])
    const todos = (encarte.itens || []).filter((p) => !pausados.has(p.setor))
    const hoje = dataISOmaisDias(0)
    const grupos = [
      ...(encarte.mostrarMercado !== false ? [{ grupo: { id: MERCADO_ENCARTE.id, nome: 'Ofertas do dia' }, itens: todos.filter((p) => noMercadoEncarte(p, hoje)) }] : []),
      ...SETORES.map((s) => ({ grupo: s, itens: todos.filter((p) => p.setor === s.id && !p.soMercado) })),
    ].filter((g) => g.itens.length)
    const lista = [{ tipo: 'capa' }]
    const indice = []
    const [hojeGrupo, ...setores] = grupos[0]?.grupo.id === MERCADO_ENCARTE.id ? grupos : [null, ...grupos]
    // Ofertas do dia: páginas próprias, logo depois da capa.
    if (hojeGrupo) {
      indice.push({ nome: 'Ofertas do dia', pagina: 2 })
      for (let i = 0; i < hojeGrupo.itens.length; i += POR_PAGINA) lista.push({ tipo: 'produtos', grupo: hojeGrupo.grupo, itens: hojeGrupo.itens.slice(i, i + POR_PAGINA), continuacao: i > 0 })
    }
    // Setores em sequência: um setor pequeno divide a página com o próximo.
    let atual = null
    for (const g of setores) {
      for (const p of g.itens) {
        if (!atual || atual.itens.length === POR_PAGINA) { atual = { tipo: 'produtos', itens: [], setores: [] }; lista.push(atual) }
        if (!atual.setores.includes(g.grupo.id)) {
          atual.setores.push(g.grupo.id)
          if (!indice.some((x) => x.nome === g.grupo.nome)) indice.push({ nome: g.grupo.nome, pagina: lista.length })
        }
        atual.itens.push(p)
      }
    }
    for (const pg of lista) if (pg.setores) pg.grupo = pg.setores.length === 1 ? setorById(pg.setores[0]) : { id: 'varios', nome: pg.setores.map((id) => setorById(id).nome).join(' · ') }
    lista.push({ tipo: 'contracapa' })
    lista[0].indice = indice
    lista[0].destaques = [...todos].sort((a, b) => (Number(b.descontoJornal) || 0) - (Number(a.descontoJornal) || 0)).slice(0, 3)
    lista[0].total = todos.filter((p) => !p.soMercado || noMercadoEncarte(p, hoje)).length
    return lista
  }, [encarte])
  const renderPagina = (i) => {
    const p = paginas[i]
    if (!p) return null
    if (p.tipo === 'capa') return <Capa encarte={encarte} loja={loja} tema={tema} indice={p.indice} destaques={p.destaques} compras={compras} total={p.total} />
    if (p.tipo === 'contracapa') return <Contracapa loja={loja} numero={i + 1} />
    return <PaginaProdutos pagina={p} numero={i + 1} loja={loja} compras={compras} />
  }

  // ---- tamanho: uma página no celular, duas abertas no PC ----
  const palcoRef = useRef(null)
  const [palco, setPalco] = useState({ w: 360, h: 640 })
  useEffect(() => {
    const medir = () => setPalco({ w: window.innerWidth, h: window.innerHeight })
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [])
  const duplo = palco.w >= 900 && palco.w > palco.h
  const k = Math.min((palco.w - (duplo ? 64 : 20)) / (PW * (duplo ? 2 : 1)), (palco.h - 96) / PH)
  const W = Math.round(PW * k)
  const H = Math.round(PH * k)

  // ---- folhas: no celular cada página é uma folha; no PC, frente e verso ----
  const n = paginas.length
  const nFolhas = duplo ? Math.ceil(n / 2) : n
  const frente = (f) => (duplo ? 2 * f : f)
  const verso = (f) => (duplo ? 2 * f + 1 : null)
  const [virada, setVirada] = useState(0) // folhas já viradas
  useEffect(() => { setVirada((v) => Math.min(v, Math.max(0, nFolhas - 1))) }, [nFolhas])
  // mudar de celular para PC mantém a página
  const ultimoDuplo = useRef(duplo)
  useEffect(() => {
    if (ultimoDuplo.current === duplo) return
    setVirada((v) => (duplo ? Math.ceil(v / 2) : Math.max(0, 2 * v - 1)))
    ultimoDuplo.current = duplo
  }, [duplo])

  const reduzido = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  // giro: { folha, angulo (0 = deitada à direita, -180 = virada), animando }
  const [giro, setGiro] = useState(null)
  const arrasto = useRef(null)
  const podeIr = virada < nFolhas - 1
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
    if (reduzido) return setVirada((v) => v + 1)
    setGiro({ folha: virada, angulo: 0, animando: false })
    requestAnimationFrame(() => requestAnimationFrame(() => setGiro((g) => g && { ...g, angulo: -180, animando: true })))
  }, [podeIr, giro, virada, reduzido])
  const voltar = useCallback(() => {
    if (!podeVoltar || giro) return
    somDePapel()
    if (reduzido) return setVirada((v) => v - 1)
    setGiro({ folha: virada - 1, angulo: -180, animando: false, volta: true })
    requestAnimationFrame(() => requestAnimationFrame(() => setGiro((g) => g && { ...g, angulo: 0, animando: true })))
  }, [podeVoltar, giro, virada, reduzido])
  const fimDaAnimacao = () => {
    if (!giro?.animando) return
    setVirada(giro.angulo === -180 ? giro.folha + 1 : giro.folha)
    setGiro(null)
  }
  useEffect(() => {
    const tecla = (e) => { if (e.key === 'ArrowRight') ir(); else if (e.key === 'ArrowLeft') voltar() }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [ir, voltar])

  // arrastar com o dedo: a folha segue o dedo; soltar depois da metade termina a virada
  const aoTocar = (e) => {
    if (giro?.animando) return
    const caixa = palcoRef.current.getBoundingClientRect()
    arrasto.current = { x0: e.clientX, caixa, ativo: false, id: e.pointerId }
  }
  const aoMover = (e) => {
    const a = arrasto.current
    if (!a || a.id !== e.pointerId) return
    const dx = e.clientX - a.x0
    if (!a.ativo) {
      if (Math.abs(dx) < 10) return
      if (dx < 0 && podeIr) a.sentido = 'ir'
      else if (dx > 0 && podeVoltar) a.sentido = 'voltar'
      else { arrasto.current = null; return }
      a.ativo = true
      somDePapel()
      try { palcoRef.current.setPointerCapture(e.pointerId) } catch (_) {}
    }
    const p = Math.max(0, Math.min(1, Math.abs(dx) / (W * (duplo ? 1.6 : 1.1))))
    a.p = p
    setGiro(a.sentido === 'ir'
      ? { folha: virada, angulo: -180 * p, animando: false }
      : { folha: virada - 1, angulo: -180 + 180 * p, animando: false, volta: true })
  }
  const aoSoltar = (e) => {
    const a = arrasto.current
    arrasto.current = null
    if (!a?.ativo) {
      // toque na borda da página também vira (fora dos produtos)
      if (a && !e.target.closest('[data-produto]')) {
        const x = e.clientX - a.caixa.left
        if (x > a.caixa.width * 0.82) ir()
        else if (x < a.caixa.width * 0.18) voltar()
      }
      return
    }
    const passou = a.p > 0.35
    if (a.sentido === 'ir') terminar(passou ? -180 : 0)
    else terminar(passou ? 0 : -180)
  }

  // ---- desenho ----
  const largura = duplo ? W * 2 : W
  const paginaDireita = (f) => (f < nFolhas ? frente(f) : null) // página deitada à direita
  const paginaEsquerda = (f) => (duplo && f > 0 ? verso(f - 1) : null)
  const g = giro
  const baseDireita = g ? (g.volta ? paginaDireita(virada) : paginaDireita(virada + 1)) : paginaDireita(virada)
  const baseEsquerda = g ? (g.volta ? paginaEsquerda(virada - 1) : paginaEsquerda(virada)) : paginaEsquerda(virada)
  const sombra = g ? Math.sin((Math.abs(g.angulo) / 180) * Math.PI) : 0
  // no PC: capa sozinha, depois páginas 2–3, 4–5…
  const numeroAtual = duplo ? (virada === 0 ? 1 : 2 * virada) : virada + 1
  const doisAbertos = duplo && virada > 0 && numeroAtual < n
  const [dica, setDica] = useState(true)
  useEffect(() => { if (virada > 0) setDica(false) }, [virada])
  const [listaAberta, setListaAberta] = useState(false)
  const totalLista = compras.lista.reduce((s, i) => s + (Number(i.preco) || 0) * (Number(i.qtd) || 1), 0)

  return (
    <div className="fixed inset-0 select-none overflow-hidden" style={{ background: 'radial-gradient(120% 80% at 50% 30%, #6b4a2b 0%, #4a321c 55%, #2f1f11 100%)' }}>
      <style>{`
        .jp-caneta { stroke-dasharray: 620; stroke-dashoffset: 620; animation: jp-risco .55s ease-out forwards }
        @keyframes jp-risco { to { stroke-dashoffset: 0 } }
        .jp-entra { animation: jp-entra .9s cubic-bezier(.2,.8,.2,1) both }
        @keyframes jp-entra { from { transform: translateY(40px) rotate(-5deg) scale(.92); opacity: 0 } to { transform: none; opacity: 1 } }
        @media (prefers-reduced-motion: reduce) { .jp-caneta, .jp-entra { animation: none; stroke-dashoffset: 0 } }
      `}</style>
      {/* veios da madeira do balcão */}
      <div className="pointer-events-none absolute inset-0 opacity-25" style={{ backgroundImage: 'repeating-linear-gradient(92deg, rgba(0,0,0,.18) 0 2px, transparent 2px 38px), repeating-linear-gradient(88deg, rgba(255,220,170,.08) 0 1px, transparent 1px 23px)' }} />

      {!encarte ? (
        <p className="absolute inset-0 flex items-center justify-center text-2xl text-[#f3e6cc]" style={{ fontFamily: 'Kalam, cursive' }}>Pegando o jornal de hoje…</p>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pb-2 pt-3">
          <div
            ref={palcoRef}
            onPointerDown={aoTocar}
            onPointerMove={aoMover}
            onPointerUp={aoSoltar}
            onPointerCancel={aoSoltar}
            className="jp-entra relative touch-pan-y"
            style={{ width: largura, height: H, '--k': k, perspective: `${W * 3}px`, filter: 'drop-shadow(0 18px 26px rgba(0,0,0,.45))' }}
            aria-roledescription="jornal"
            aria-label={`Jornal de ofertas, página ${numeroAtual} de ${n}`}
          >
            {/* esquerda (PC): verso da última folha virada */}
            {duplo && baseEsquerda !== null && (
              <div className="absolute inset-y-0 left-0" style={{ width: W }}>
                <Folha verso>{renderPagina(baseEsquerda)}</Folha>
              </div>
            )}
            {/* direita: a página de baixo */}
            {baseDireita !== null && (
              <div className="absolute inset-y-0" style={{ left: duplo ? W : 0, width: W }}>
                <Folha>{renderPagina(baseDireita)}</Folha>
                {g && <div className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(to right, rgba(40,25,5,${0.35 * sombra}), transparent 60%)` }} />}
              </div>
            )}
            {/* a folha que está virando */}
            {g && (
              <div
                onTransitionEnd={fimDaAnimacao}
                className="absolute inset-y-0"
                style={{
                  left: duplo ? W : 0,
                  width: W,
                  transformStyle: 'preserve-3d',
                  transformOrigin: 'left center',
                  transform: `rotateY(${g.angulo}deg)`,
                  transition: g.animando ? 'transform 560ms cubic-bezier(.3,.7,.25,1)' : 'none',
                  zIndex: 5,
                }}
              >
                <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }}>
                  <Folha>{renderPagina(frente(g.folha))}</Folha>
                  <div className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(to left, rgba(255,255,255,${0.25 * sombra}), rgba(40,25,5,${0.3 * sombra}))` }} />
                </div>
                <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                  {duplo && verso(g.folha) !== null && verso(g.folha) < n
                    ? <Folha verso>{renderPagina(verso(g.folha))}</Folha>
                    : (
                      // celular: o verso é o papel, com a tinta da frente aparecendo de leve
                      <Folha verso><div style={{ transform: 'scaleX(-1)', opacity: 0.12, filter: 'blur(.4px)', width: PW, height: PH }}>{renderPagina(frente(g.folha))}</div></Folha>
                    )}
                  <div className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(to right, rgba(255,255,255,${0.2 * sombra}), rgba(40,25,5,${0.28 * sombra}))` }} />
                </div>
              </div>
            )}
            {/* dobra do meio (PC) */}
            {duplo && <div className="pointer-events-none absolute inset-y-0 z-10" style={{ left: W - 1, width: 2, background: 'rgba(40,25,5,.35)' }} />}
            {atualizado && <span className="absolute -top-2 right-3 z-20 rotate-6 border-2 px-2 py-0.5 text-sm font-bold uppercase" style={{ borderColor: VERMELHO, color: VERMELHO, background: '#efe6cfee', fontFamily: 'Anton, sans-serif' }}>Edição atualizada</span>}
          </div>

          <div className="flex items-center gap-5 text-[#f3e6cc]" style={{ fontFamily: 'Kalam, cursive' }}>
            <button type="button" onClick={voltar} disabled={!podeVoltar} aria-label="Página anterior" className="min-h-11 min-w-11 px-2 text-3xl disabled:opacity-25">‹</button>
            <span className="text-lg">{dica && podeIr ? 'arraste para virar a página →' : doisAbertos ? `páginas ${numeroAtual} e ${numeroAtual + 1} de ${n}` : `página ${numeroAtual} de ${n}`}</span>
            <button type="button" onClick={ir} disabled={!podeIr} aria-label="Próxima página" className="min-h-11 min-w-11 px-2 text-3xl disabled:opacity-25">›</button>
          </div>
        </div>
      )}

      {/* papelzinho da lista */}
      {encarte && (
        <button type="button" onClick={() => setListaAberta((v) => !v)} aria-expanded={listaAberta}
          className="absolute bottom-3 right-3 z-30 rotate-3 px-4 py-2 text-left shadow-[0_8px_18px_rgba(0,0,0,.35)]"
          style={{ background: '#ffe98a', fontFamily: 'Kalam, cursive', color: '#2b2412' }}>
          <span className="block text-lg leading-tight">Minha lista</span>
          <span className="block text-sm leading-tight">{compras.lista.length ? `${plural(compras.lista.length, 'item', 'itens')} · ${formatBRL(totalLista)}` : 'circule o que quer levar'}</span>
        </button>
      )}
      {listaAberta && (
        <div className="absolute bottom-20 right-3 z-30 max-h-[70vh] w-[min(330px,calc(100vw-24px))] -rotate-1 overflow-y-auto p-4 shadow-[0_14px_30px_rgba(0,0,0,.4)]"
          style={{ background: '#fffbe6', backgroundImage: 'repeating-linear-gradient(#fffbe6 0 31px, #9ec5e8 31px 32px)', fontFamily: 'Kalam, cursive', color: '#2b2412' }}>
          <div className="flex items-baseline justify-between">
            <p className="text-2xl">Minha lista</p>
            <button type="button" onClick={() => setListaAberta(false)} className="min-h-10 px-2 text-lg">fechar</button>
          </div>
          {compras.lista.length === 0 ? (
            <p className="mt-2 text-lg leading-8">Toque nos produtos do jornal para circular. Eles aparecem aqui.</p>
          ) : (
            <ul className="mt-1">
              {compras.lista.map((i) => (
                <li key={i.id} className="flex min-h-8 items-center gap-2 text-lg leading-8">
                  <button type="button" onClick={() => compras.mudar(i.id, { pego: !i.pego })} aria-label={i.pego ? `Desmarcar ${i.nome}` : `Marcar ${i.nome} como pego`} className="flex h-8 w-8 shrink-0 items-center justify-center text-xl">{i.pego ? '☑' : '☐'}</button>
                  <span className={`min-w-0 flex-1 truncate ${i.pego ? 'line-through opacity-60' : ''}`}>{nomeBonito(i.nome)}</span>
                  <span className="shrink-0">{formatBRL(i.preco)}</span>
                  <button type="button" onClick={() => compras.remover(i.id)} aria-label={`Tirar ${i.nome} da lista`} className="h-8 w-8 shrink-0 text-xl">×</button>
                </li>
              ))}
              <li className="mt-1 flex justify-between border-t border-dashed border-[#2b2412]/40 text-xl leading-9"><span>Total</span><span>{formatBRL(totalLista)}</span></li>
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
