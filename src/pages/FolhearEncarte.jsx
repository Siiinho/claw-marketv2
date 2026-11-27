import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/ui'
import { SETORES, MERCADO_ENCARTE, formatBRL, noMercadoEncarte, dataISOmaisDias, plural, paraNumero } from '../lib/utils'
import { carregarEncartePublicado, assinarEncarte } from '../lib/encartePublico'
import { temaCampanhaById, temasDoSetor } from '../lib/temasCampanha'
import { PaginaEncarte, paginarEncarte, tamanhoPagina } from '../components/JornalMercado'
import { ContextoEncarte } from '../components/ImagemProduto'
import { semFundo } from '../lib/semFundo'
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

// ---------- a nota (lista de compras) ----------
function LogoNota() {
  const marca = useMarca()
  if (marca && !marca.logo && !/bengala/i.test(marca.nome || '')) return null
  return <div className="mb-1 flex justify-center"><LogoOuNome marca={marca} padrao={logoPadrao} className="block h-20 w-auto max-w-[75%] object-contain" style={{ filter: "grayscale(1) contrast(1.25)" }} /></div>
}
const linha = (n = 32) => '-'.repeat(n)
const semRS = (v) => formatBRL(v).replace('R$', '').trim()
function Nota({ compras, loja, aberta, setAberta, ultimo, largura }) {
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
        <button type="button" onClick={() => setAberta((v) => !v)} aria-expanded={aberta}
          className="relative flex min-h-14 w-full items-center gap-3 rounded-b-2xl bg-[#1f2937] px-4 text-left text-white shadow-[0_8px_20px_rgba(0,0,0,.35)]">
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
  const doDia = todos.filter((p) => p.encarteMercadoDia && encarte?.mostrarMercado !== false)
  const daSemana = todos.filter((p) => !p.soMercado)
  const abas = [
    ...(doDia.length ? [{ id: MERCADO_ENCARTE.id, nome: 'Ofertas de hoje', n: doDia.length }] : []),
    ...(encarte?.mostrarGeral !== false && daSemana.length ? [{ id: 'todas', nome: 'Todas', n: daSemana.length }] : []),
    ...SETORES.map((s) => ({ id: s.id, nome: s.nome, n: daSemana.filter((p) => p.setor === s.id).length })).filter((a) => a.n),
  ]
  const [abaEscolhida, setAba] = useState(null)
  const aba = abas.some((a) => a.id === abaEscolhida) ? abaEscolhida : abas.find((a) => a.id === 'todas')?.id || abas[0]?.id
  const ehHoje = aba === MERCADO_ENCARTE.id
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

  // fotos sem fundo: prepara antes, para a página já abrir limpa
  useEffect(() => { itens.slice(0, 60).forEach((p) => p.imagem && semFundo(p.imagem)) }, [itens])

  // ---- nota ----
  const [notaAberta, setNotaAberta] = useState(false)
  const [ultimo, setUltimo] = useState(null)
  const marcados = useMemo(() => new Set(compras.lista.map((i) => i.id)), [compras.lista])
  const contexto = useMemo(() => ({ semFundo: true, marcados }), [marcados])
  const tocarProduto = useCallback((p) => {
    const tinha = compras.tem(p.id)
    compras.alternar({ ...p, precoJornal: paraNumero(p.precoJornal) || paraNumero(p.precoNormal) })
    if (!tinha) { setUltimo(String(p.id)); try { navigator.vibrate?.(30) } catch (_) { /* sem vibrar */ } }
  }, [compras])

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
          @media (prefers-reduced-motion: reduce) { .cm-nota-sai, .cm-nota-linha { animation: none } }
        `}</style>
        {/* a campanha ao fundo, escurecida, para o jornal saltar */}
        <div className="pointer-events-none absolute inset-0 bg-black/55" />

        {!encarte ? (
          <p className="absolute inset-0 flex items-center justify-center text-lg font-semibold">Abrindo o jornal de hoje…</p>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
            {/* abas presas no topo do jornal: layout (protótipo) e a página */}
            <div className="flex h-10 items-end gap-1 overflow-x-auto transition-[width] duration-300 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ width: larguraAberta }}>
              {abas.map((a) => (
                <button key={a.id} type="button" onClick={(e) => { setAba(a.id); e.currentTarget.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }) }} aria-pressed={aba === a.id}
                  className={`h-9 shrink-0 whitespace-nowrap rounded-t-xl px-3 text-[13px] font-bold ${aba === a.id ? 'h-10 bg-white text-[#111]' : 'bg-black/45 text-white hover:bg-black/60'}`}>
                  {a.id === MERCADO_ENCARTE.id && <span aria-hidden="true" className="mr-1 text-[#d81e29]">★</span>}{a.nome} <span className={aba === a.id ? 'text-[#666]' : 'text-white/70'}>{a.n}</span>
                </button>
              ))}
            </div>
            <div
              ref={palcoRef}
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
            {/* a nota presa embaixo do jornal */}
            <Nota compras={compras} loja={loja} aberta={notaAberta} setAberta={setNotaAberta} ultimo={ultimo} largura={larguraAberta} />
          </div>
        )}
      </div>
    </ContextoEncarte.Provider>
    </MarcaContexto.Provider>
  )
}
