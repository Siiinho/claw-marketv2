import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon, Logo, PrecoVarejo } from '../components/ui'
import { SETORES, setorById, formatBRL, formatData, MERCADO_ENCARTE, noMercadoEncarte, dataISOmaisDias } from '../lib/utils'
import { carregarEncartePublicado, assinarEncarte, linkDoEncarte } from '../lib/encartePublico'
import { temaCampanhaById, temasDoSetor } from '../lib/temasCampanha'
import SeloArte from '../components/SeloArte'
import { SimboloClawMarket } from '../components/MarcaClawMarket'
import PaginaTemplate, { Escalado, paginarTemplate } from '../components/PaginaTemplate'
import { LOJAS } from '../data/seed'

// Encarte digital público: a página que a tag NFC abre.
// Feita para celular primeiro, com alto contraste e letras grandes.
// Atualiza sozinha quando uma nova versão é publicada no Jornal (o servidor avisa na hora).
// Motion design: as páginas do encarte se montam ao aparecer na tela, o preço pulsa e o
// selo balança. Cada produto abre uma prévia própria (deslize para o lado para ver o próximo),
// com link direto (#/encarte?p=<id>) para compartilhar.

const horaCurta = (iso) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''

function TagSelo({ produto, grande = false }) {
  return <SeloArte produto={produto} largura={grande ? 150 : 96} />
}

function FotoProduto({ produto, className = '' }) {
  const setor = setorById(produto.setor)
  if (produto.imagem) {
    return <img src={produto.imagem} alt={produto.nome} loading="lazy" decoding="async" className={`h-full w-full object-contain ${className}`} />
  }
  return (
    <div className={`flex h-full w-full items-center justify-center ${className}`} style={{ color: setor.cor }}>
      <Icon name={setor.icone} size={48} />
    </div>
  )
}

function SeloPreco({ valor, tema, grande = false }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-[50%] ${grande ? 'px-7 py-3' : 'px-4 py-1.5'}`}
      style={{ background: tema.precoFundo, boxShadow: `3px 4px 0 ${tema.precoSombra}`, transform: 'rotate(-3deg)' }}
    >
      <PrecoVarejo valor={valor} className={grande ? 'text-[44px] leading-none' : 'text-[26px] leading-none'} cor={tema.precoCor} />
    </span>
  )
}

function CartaoProduto({ produto, onAbrir, tema, indice = 0, compras }) {
  const desconto = Number(produto.descontoJornal) || 0
  const temDe = desconto > 0 && Number(produto.precoNormal) > Number(produto.precoJornal)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onAbrir(produto)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(produto) } }}
      className="cm-cartao group cursor-pointer relative flex flex-col overflow-hidden rounded-2xl border-2 border-navy/15 bg-white text-left shadow-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-offer"
      style={{ '--cm-i': Math.min(indice, 12) }}
      aria-label={`Ver oferta: ${produto.nome}`}
    >
      <div className="relative aspect-square w-full bg-white p-3">
        <FotoProduto produto={produto} />
        <div className="absolute left-2 top-2"><TagSelo produto={produto} /></div>
        {desconto > 0 && (
          <span className="absolute right-2 top-2 flex h-12 w-12 items-center justify-center rounded-full bg-bengala text-sm font-black text-white shadow">
            -{desconto}%
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 border-t-2 border-navy/10 p-3">
        <div className="line-clamp-3 text-[15px] font-extrabold uppercase leading-tight text-navy">{produto.nome}</div>
        {produto.gramagem && <div className="text-xs font-semibold text-ink-soft">{produto.gramagem}</div>}
        <div className="mt-auto pt-1">
          {temDe && (
            <div className="text-sm font-bold text-ink-soft">
              De <span className="line-through">{formatBRL(produto.precoNormal)}</span>
            </div>
          )}
          <div className="mt-1 flex items-end justify-between gap-1">
            <span className="cm-preco-lista"><SeloPreco valor={produto.precoJornal} tema={tema} /></span>
            {compras && <BotaoLista produto={produto} compras={compras} />}
          </div>
        </div>
      </div>
    </div>
  )
}

const soDigitos = (v) => String(v || '').replace(/\D/g, '')

// ---- lista de compras do cliente (fica só no celular dele) ----
const CHAVE_LISTA = 'clawmarket:lista-compras:v1'
function lerLista() {
  try { const l = JSON.parse(localStorage.getItem(CHAVE_LISTA) || '[]'); return Array.isArray(l) ? l : [] } catch (_) { return [] }
}
function useListaCompras() {
  const [lista, setLista] = useState(lerLista)
  const gravar = useCallback((fn) => setLista((atual) => {
    const nova = fn(atual)
    try { localStorage.setItem(CHAVE_LISTA, JSON.stringify(nova)) } catch (_) { /* sem espaço: fica só na tela */ }
    return nova
  }), [])
  const tem = useCallback((id) => lista.some((i) => i.id === String(id)), [lista])
  const alternar = useCallback((p) => gravar((atual) => (atual.some((i) => i.id === String(p.id))
    ? atual.filter((i) => i.id !== String(p.id))
    : [...atual, {
      id: String(p.id), nome: p.nome, setor: p.setor, preco: Number(p.precoJornal) || 0, qtd: 1, pego: false,
      unidade: p.unidade || '', imagem: /^https?:|^\//.test(String(p.imagem || '')) ? p.imagem : null,
    }])), [gravar])
  const mudar = useCallback((id, dados) => gravar((atual) => atual.map((i) => (i.id === id ? { ...i, ...dados } : i))), [gravar])
  const remover = useCallback((id) => gravar((atual) => atual.filter((i) => i.id !== id)), [gravar])
  const limparPegos = useCallback(() => gravar((atual) => atual.filter((i) => !i.pego)), [gravar])
  const limparTudo = useCallback(() => gravar(() => []), [gravar])
  return { lista, tem, alternar, mudar, remover, limparPegos, limparTudo }
}

function BotaoLista({ produto, compras, grande = false }) {
  const na = compras.tem(produto.id)
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); compras.alternar(produto) }}
      aria-pressed={na}
      className={`flex items-center justify-center gap-1.5 rounded-xl border-2 font-black ${grande ? 'px-3 py-3 text-base' : 'px-2 py-1.5 text-xs'} ${na ? 'border-[#128c4a] bg-[#128c4a] text-white' : 'border-navy bg-white text-navy'}`}
    >
      <Icon name={na ? 'ListChecks' : 'ListPlus'} size={grande ? 20 : 15} /> {na ? 'Na lista' : grande ? 'Pôr na lista de compras' : 'Lista'}
    </button>
  )
}

function ListaCompras({ compras, loja, encarte }) {
  const { lista } = compras
  const total = lista.reduce((t, i) => t + i.preco * (Number(i.qtd) || 1), 0)
  const pegos = lista.filter((i) => i.pego).length
  const grupos = SETORES.map((s) => ({ setor: s, itens: lista.filter((i) => i.setor === s.id) })).filter((g) => g.itens.length)
  const semSetor = lista.filter((i) => !SETORES.some((s) => s.id === i.setor))
  if (semSetor.length) grupos.push({ setor: { id: 'outros', nome: 'Outros', cor: '#334155', icone: 'ShoppingBag' }, itens: semSetor })
  const texto = [
    `Minha lista de compras${encarte?.mercado ? ` - ${encarte.mercado}` : ''}`,
    ...lista.map((i) => `${i.pego ? '[x]' : '[ ]'} ${i.qtd}x ${i.nome} - ${formatBRL(i.preco)}`),
    `Total estimado: ${formatBRL(total)}`,
  ].join('\n')
  const compartilhar = async () => {
    try { if (navigator.share) { await navigator.share({ title: 'Minha lista de compras', text: texto }); return } } catch (e) { if (e?.name === 'AbortError') return }
    try { await navigator.clipboard.writeText(texto) } catch (_) { window.prompt('Copie sua lista:', texto) }
  }
  if (!lista.length) {
    return (
      <div className="rounded-3xl bg-white px-4 py-14 text-center">
        <Icon name="ListPlus" size={48} className="mx-auto text-navy" />
        <p className="mt-3 text-xl font-black text-navy">Sua lista de compras está vazia</p>
        <p className="mt-1 text-base text-ink-soft">Toque em "Lista" nas ofertas para guardar o que você vai levar. Ela fica salva neste celular.</p>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-ink-soft">{lista.length} {lista.length === 1 ? 'item' : 'itens'} · {pegos} no carrinho</div>
            <div className="text-2xl font-black text-navy">Total estimado {formatBRL(total)}</div>
          </div>
          <Icon name="ShoppingCart" size={34} className="text-bengala" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={compartilhar} className="flex items-center justify-center gap-2 rounded-xl border-2 border-navy px-3 py-2.5 text-sm font-black text-navy"><Icon name="Share2" size={18} /> Enviar lista</button>
          <button type="button" onClick={pegos ? compras.limparPegos : compras.limparTudo} className="flex items-center justify-center gap-2 rounded-xl border-2 border-critical/40 px-3 py-2.5 text-sm font-black text-critical"><Icon name="Trash2" size={18} /> {pegos ? 'Tirar os pegos' : 'Limpar lista'}</button>
        </div>
      </div>
      {grupos.map((g) => (
        <section key={g.setor.id}>
          <h2 className="mb-2 flex items-center gap-2 rounded-xl px-4 py-2 text-base font-black uppercase text-white" style={{ background: g.setor.cor }}>
            <Icon name={g.setor.icone} size={20} /> {g.setor.nome}
          </h2>
          <div className="space-y-2">
            {g.itens.map((i) => (
              <div key={i.id} className={`flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ${i.pego ? 'opacity-60' : ''}`}>
                <button type="button" onClick={() => compras.mudar(i.id, { pego: !i.pego })} aria-pressed={i.pego} aria-label={i.pego ? 'Desmarcar' : 'Marcar como pego'}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 ${i.pego ? 'border-[#128c4a] bg-[#128c4a] text-white' : 'border-navy/30 bg-white text-transparent'}`}>
                  <Icon name="Check" size={20} />
                </button>
                {i.imagem ? <img src={i.imagem} alt="" className="h-12 w-12 shrink-0 object-contain" /> : null}
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-extrabold uppercase leading-tight text-navy ${i.pego ? 'line-through' : ''}`}>{i.nome}</div>
                  <div className="text-sm font-bold text-bengala">{formatBRL(i.preco)}{i.unidade ? ` ${i.unidade}` : ''}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => (i.qtd > 1 ? compras.mudar(i.id, { qtd: i.qtd - 1 }) : compras.remover(i.id))} className="h-8 w-8 rounded-lg border-2 border-navy/20 text-lg font-black text-navy" aria-label="Menos">−</button>
                  <span className="w-6 text-center text-base font-black text-navy">{i.qtd}</span>
                  <button type="button" onClick={() => compras.mudar(i.id, { qtd: i.qtd + 1 })} className="h-8 w-8 rounded-lg border-2 border-navy/20 text-lg font-black text-navy" aria-label="Mais">+</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      <p className="text-center text-xs font-semibold text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,.5)' }}>Preços do encarte. O total é uma estimativa.{loja?.endereco ? ` ${loja.endereco}.` : ''}</p>
    </div>
  )
}

function PreviewProduto({ produto, lista, onTrocar, onFechar, tema, encarte, loja, compras }) {
  const indice = produto ? lista.findIndex((p) => p.id === produto.id) : -1
  const anterior = indice > 0 ? lista[indice - 1] : null
  const proximo = indice >= 0 && indice < lista.length - 1 ? lista[indice + 1] : null
  const toque = useRef(null)
  const puxar = useRef(null)
  const [copiado, setCopiado] = useState(false)
  const [direcao, setDirecao] = useState(0)

  const ir = useCallback((alvo, lado) => { if (alvo) { setDirecao(lado); onTrocar(alvo) } }, [onTrocar])

  useEffect(() => {
    if (!produto) return undefined
    const teclas = (e) => {
      if (e.key === 'Escape') onFechar()
      else if (e.key === 'ArrowRight') ir(proximo, 1)
      else if (e.key === 'ArrowLeft') ir(anterior, -1)
    }
    window.addEventListener('keydown', teclas)
    // Trava a página de trás (no iPhone só o body não basta).
    const antes = [document.body.style.overflow, document.documentElement.style.overflow]
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', teclas)
      document.body.style.overflow = antes[0]
      document.documentElement.style.overflow = antes[1]
    }
  }, [produto, onFechar, ir, proximo, anterior])

  useEffect(() => { setCopiado(false) }, [produto?.id])

  if (!produto) return null
  const setor = setorById(produto.setor)
  const desconto = Number(produto.descontoJornal) || 0
  const economia = Number(produto.precoNormal) - Number(produto.precoJornal)
  const linkProduto = `${linkDoEncarte()}?p=${encodeURIComponent(produto.id)}`
  const textoOferta = `${produto.nome}${produto.gramagem ? ` ${produto.gramagem}` : ''} por ${formatBRL(produto.precoJornal)}${encarte?.mercado ? ` no ${encarte.mercado}` : ''}`
  const whats = soDigitos(loja?.whatsapp)
  const linkWhats = whats ? `https://wa.me/${whats.length <= 11 ? `55${whats}` : whats}?text=${encodeURIComponent(`Olá! Vi no encarte: ${textoOferta}.`)}` : null

  const compartilhar = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: produto.nome, text: textoOferta, url: linkProduto })
        return
      }
    } catch (erro) {
      if (erro?.name === 'AbortError') return
    }
    try {
      await navigator.clipboard.writeText(`${textoOferta}\n${linkProduto}`)
      setCopiado(true)
    } catch (_) {
      window.prompt('Copie o link da oferta:', linkProduto)
    }
  }

  const inicioToque = (e) => { const t = e.touches[0]; toque.current = { x: t.clientX, y: t.clientY } }
  // Puxar o topo da janela para baixo fecha, como nos apps.
  const inicioPuxar = (e) => { puxar.current = e.touches[0].clientY }
  const fimPuxar = (e) => {
    if (puxar.current == null) return
    const dy = e.changedTouches[0].clientY - puxar.current
    puxar.current = null
    if (dy > 70) onFechar()
  }
  const fimToque = (e) => {
    if (!toque.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - toque.current.x
    const dy = t.clientY - toque.current.y
    toque.current = null
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) ir(dx < 0 ? proximo : anterior, dx < 0 ? 1 : -1)
  }

  const botaoSeta = (alvo, lado) => (
    <button
      type="button"
      onClick={() => ir(alvo, lado)}
      disabled={!alvo}
      aria-label={lado > 0 ? 'Próxima oferta' : 'Oferta anterior'}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy text-white disabled:opacity-25"
    >
      <Icon name={lado > 0 ? 'ChevronRight' : 'ChevronLeft'} size={26} />
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overscroll-none bg-black/70 backdrop-blur-sm sm:items-center sm:p-6" onClick={onFechar} role="dialog" aria-modal="true" aria-label={produto.nome}>
      <div
        className="cm-folha cm-folha-altura flex w-full flex-col overflow-hidden rounded-t-3xl bg-white sm:max-w-lg sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* topo fixo: o botão de fechar fica sempre à vista */}
        <div className="relative z-10 flex shrink-0 touch-none items-center justify-between gap-2 border-b border-navy/10 bg-white px-4 pb-2 pt-3" onTouchStart={inicioPuxar} onTouchEnd={fimPuxar}>
          <div className="mx-auto mb-1 h-1.5 w-12 rounded-full bg-navy/20 sm:hidden" aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: 6 }} />
          <span className="mt-2 rounded-full px-3 py-1 text-xs font-black uppercase text-white" style={{ background: setor.cor }}>{setor.nome}</span>
          {lista.length > 1 && <span className="mt-2 text-sm font-black text-navy" aria-live="polite">{indice + 1} de {lista.length}</span>}
          <button type="button" onClick={onFechar} className="mt-2 flex h-11 shrink-0 items-center justify-center gap-1 rounded-full bg-navy px-4 text-sm font-black text-white" aria-label="Fechar">
            <Icon name="X" size={20} /> Fechar
          </button>
        </div>

        {/* só o conteúdo rola, sem arrastar a página de trás */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]" onTouchStart={inicioToque} onTouchEnd={fimToque}>

        <div key={produto.id} className="cm-troca-produto" style={{ '--cm-lado': direcao }}>
          <div className="relative mx-4 mt-3 h-[30vh] min-h-48 overflow-hidden rounded-2xl sm:aspect-square sm:h-auto border-2 border-navy/10 bg-white p-4" style={{ background: `radial-gradient(circle at 50% 45%, #fff 0 45%, ${setor.cor}1f 100%)` }}>
            <div className="cm-foto-preview h-full w-full"><FotoProduto produto={produto} /></div>
            {desconto > 0 && (
              <span className="cm-preco-preview absolute right-3 top-3 flex h-16 w-16 items-center justify-center rounded-full bg-bengala text-lg font-black text-white shadow-lg">
                -{desconto}%
              </span>
            )}
            <div className="absolute left-2 top-2"><TagSelo produto={produto} /></div>
          </div>
          <div className="space-y-3 px-5 pt-4">
            <h2 className="text-2xl font-black uppercase leading-tight text-navy">{produto.nome}</h2>
            {(produto.marca || produto.gramagem) && (
              <p className="text-base font-semibold text-ink-soft">{[produto.marca, produto.gramagem].filter(Boolean).join(' · ')}</p>
            )}
            <div className="relative overflow-hidden rounded-2xl p-4 text-white" style={{ background: tema.fundo }}>
              {desconto > 0 && (
                <div className="text-base font-bold text-white/85">
                  De <span className="line-through">{formatBRL(produto.precoNormal)}</span> por
                </div>
              )}
              <div className="mt-1"><span className="cm-preco-preview inline-block"><SeloPreco valor={produto.precoJornal} tema={tema} grande /></span></div>
              {economia > 0.009 && (
                <div className="mt-3 text-base font-black" style={{ color: tema.corDestaque }}>Você economiza {formatBRL(economia)}</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3 px-5 pt-4">
          {compras && <BotaoLista produto={produto} compras={compras} grande />}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={compartilhar} className="flex items-center justify-center gap-2 rounded-xl border-2 border-navy px-3 py-3 text-base font-black text-navy">
              <Icon name={copiado ? 'Check' : 'Share2'} size={20} /> {copiado ? 'Link copiado' : 'Compartilhar'}
            </button>
            {linkWhats ? (
              <a href={linkWhats} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-[#128c4a] px-3 py-3 text-base font-black text-white">
                <Icon name="MessageCircle" size={20} /> WhatsApp
              </a>
            ) : <span />}
          </div>
          {lista.length > 1 && (
            <div className="flex items-center justify-between gap-3">
              {botaoSeta(anterior, -1)}
              <span className="text-center text-xs font-bold text-ink-soft">Deslize para o lado para ver outras ofertas</span>
              {botaoSeta(proximo, 1)}
            </div>
          )}
          <p className="text-sm text-ink-soft">Oferta válida enquanto durar o estoque. Imagem ilustrativa.</p>
          <button type="button" onClick={onFechar} className="w-full rounded-xl border-2 border-navy/20 px-3 py-3 text-base font-black text-navy">
            Voltar ao encarte
          </button>
        </div>
        </div>
      </div>
    </div>
  )
}

// Liga a animação de uma página do encarte só quando ela aparece na tela.
function PaginaViva({ children }) {
  const ref = useRef(null)
  const [visivel, setVisivel] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setVisivel(true); return undefined }
    const io = new IntersectionObserver(([e]) => setVisivel(e.isIntersecting), { threshold: 0.15 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return <div ref={ref} className={visivel ? '' : 'cm-pausado'}>{children}</div>
}

export default function EncarteDigital() {
  const [encarte, setEncarte] = useState(null)
  const [carregando, setCarregando] = useState(true)
  // Aba: 'todos' (jornal geral), o id de um setor (jornal daquele setor) ou 'compras'.
  const [setorFiltro, setSetorFiltro] = useState('todos')
  const compras = useListaCompras()
  const [params, setParams] = useSearchParams()
  const [acabouDeAtualizar, setAcabouDeAtualizar] = useState(false)
  const [modo, setModo] = useState('encarte')

  useEffect(() => {
    let ativo = true
    let versaoAtual = null
    const recarregar = async (versaoAvisada) => {
      if (versaoAvisada && versaoAvisada === versaoAtual) return
      const novo = await carregarEncartePublicado()
      if (!ativo) return
      setCarregando(false)
      if (novo?.versao === versaoAtual) return
      if (versaoAtual !== null) {
        setAcabouDeAtualizar(true)
        setTimeout(() => ativo && setAcabouDeAtualizar(false), 6000)
      }
      versaoAtual = novo?.versao ?? null
      setEncarte(novo)
    }
    recarregar()
    const cancelar = assinarEncarte(recarregar)
    return () => { ativo = false; cancelar() }
  }, [])

  const itens = encarte?.itens || []
  const temaGeral = temaCampanhaById(encarte?.tema)
  // Cada setor tem o seu jornal, com o template escolhido para ele no Jornal.
  const temaDoSetor = (id) => temaCampanhaById(encarte?.temasSetor?.[id] || temasDoSetor(id)[0]?.id || encarte?.tema)
  // Mercado Encarte: só as ofertas marcadas para hoje (somem sozinhas no dia seguinte).
  const hoje = dataISOmaisDias(0)
  const ofertasDoDia = useMemo(() => itens.filter((p) => noMercadoEncarte(p, hoje)), [itens, hoje])
  const ehMercado = setorFiltro === MERCADO_ENCARTE.id
  useEffect(() => { if (ehMercado && encarte && !ofertasDoDia.length) setSetorFiltro('todos') }, [ehMercado, encarte, ofertasDoDia.length])
  const tema = setorFiltro !== 'todos' && setorFiltro !== 'compras' ? temaDoSetor(setorFiltro) : temaGeral
  // Fundo enviado no Jornal vale só para o template dele.
  const fundoDoTema = encarte?.fundos?.[tema.id] || (tema.id === encarte?.tema ? encarte?.fundo || null : null)
  const setoresPresentes = useMemo(
    () => SETORES.filter((s) => itens.some((p) => p.setor === s.id)),
    [itens]
  )
  const visiveis = ehMercado ? ofertasDoDia : setorFiltro === 'todos' || setorFiltro === 'compras' ? itens : itens.filter((p) => p.setor === setorFiltro)
  const grupos = setorFiltro === 'todos' || setorFiltro === 'compras'
    ? setoresPresentes.map((s) => ({ setor: s, itens: itens.filter((p) => p.setor === s.id) }))
    : [{ setor: ehMercado ? MERCADO_ENCARTE : setorById(setorFiltro), itens: visiveis }]
  const layout = encarte?.layout || 'grade'
  const paginas = paginarTemplate(visiveis, layout)
  const loja = encarte?.loja || LOJAS[0]

  // produto aberto fica no endereço (#/encarte?p=<id>): dá para compartilhar e o botão voltar fecha
  const idAberto = params.get('p')
  const aberto = idAberto ? itens.find((p) => String(p.id) === idAberto) || null : null
  const abrir = useCallback((produto) => {
    setParams((atual) => {
      const novo = new URLSearchParams(atual)
      novo.set('p', String(produto.id))
      return novo
    }, { replace: params.has('p') })
  }, [setParams, params])
  const fechar = useCallback(() => {
    setParams((atual) => {
      const novo = new URLSearchParams(atual)
      novo.delete('p')
      return novo
    }, { replace: true })
  }, [setParams])
  const listaPreview = aberto && !visiveis.some((p) => p.id === aberto.id) ? itens : visiveis

  return (
    <div className="min-h-screen" style={{ background: tema.fundo, backgroundAttachment: 'fixed' }}>
      <header className="bg-black/30 text-white backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pb-3 pt-[max(.75rem,env(safe-area-inset-top))]">
          <div className="flex min-w-0 items-center gap-3">
            <Logo h={40} chip />
            <div className="min-w-0">
              <div className="truncate text-base font-black uppercase sm:text-lg">{tema.titulo} {tema.destaque}</div>
              {ehMercado
                ? <div className="text-xs font-bold text-white/85 sm:text-sm">Ofertas válidas só hoje, {formatData(hoje)}</div>
                : encarte?.periodoDe && <div className="text-xs font-bold text-white/85 sm:text-sm">Válido de {formatData(encarte.periodoDe)} a {formatData(encarte.periodoAte)}</div>}
            </div>
          </div>
          {encarte?.publicadoEm && (
            <span className="flex shrink-0 items-center gap-2 rounded-full bg-black/35 px-3 py-1.5 text-xs font-bold">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
              </span>
              <span className="hidden sm:inline">{acabouDeAtualizar ? 'Atualizado agora' : `Atualizado às ${horaCurta(encarte.publicadoEm)}`}</span>
              <span className="sm:hidden">{acabouDeAtualizar ? 'Agora' : horaCurta(encarte.publicadoEm)}</span>
            </span>
          )}
        </div>
      </header>

      {itens.length > 0 && (
        <nav className="sticky top-0 z-20 border-b-2 border-navy/10 bg-white/95 backdrop-blur" aria-label="Jornais do mercado">
          {/* 1ª linha: um jornal para cada setor, mais o Geral com tudo */}
          <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-2 pt-3">
            {ofertasDoDia.length > 0 && (
              <button
                type="button"
                onClick={() => setSetorFiltro(MERCADO_ENCARTE.id)}
                aria-pressed={ehMercado}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border-2 px-4 py-2 text-sm font-black uppercase shadow ${ehMercado ? 'border-[#ffd60a] text-[#ffd60a] ring-2 ring-[#c1121f]' : 'border-[#c1121f] text-white'}`}
                style={{ background: 'linear-gradient(120deg,#c1121f,#fb5607)' }}
              >
                <Icon name="Star" size={16} fill="#ffd60a" color="#ffd60a" /> Mercado Encarte ({ofertasDoDia.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => setSetorFiltro('todos')}
              aria-pressed={setorFiltro === 'todos'}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border-2 px-4 py-2 text-sm font-black ${setorFiltro === 'todos' ? 'border-navy bg-navy text-white' : 'border-navy/20 bg-white text-navy'}`}
            >
              <Icon name="Store" size={16} /> Geral ({itens.length})
            </button>
            {setoresPresentes.map((s) => {
              const n = itens.filter((p) => p.setor === s.id).length
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSetorFiltro(s.id)}
                  aria-pressed={setorFiltro === s.id}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border-2 px-4 py-2 text-sm font-black"
                  style={setorFiltro === s.id ? { background: s.cor, borderColor: s.cor, color: '#fff' } : { borderColor: `${s.cor}66`, color: s.corTag, background: '#fff' }}
                >
                  <Icon name={s.icone} size={16} /> {s.nome} ({n})
                </button>
              )
            })}
          </div>
          {/* 2ª linha: jeito de ver e a lista de compras */}
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 pb-3">
            <div className="flex shrink-0 overflow-hidden rounded-full border-2 border-navy" role="group" aria-label="Modo de visualização">
              {[['encarte', 'Encarte'], ['lista', 'Produtos']].map(([id, rotulo]) => (
                <button key={id} type="button" onClick={() => { setModo(id); if (setorFiltro === 'compras') setSetorFiltro('todos') }} aria-pressed={modo === id && setorFiltro !== 'compras'} className={`px-3 py-1.5 text-sm font-black ${modo === id && setorFiltro !== 'compras' ? 'bg-navy text-white' : 'bg-white text-navy'}`}>
                  {rotulo}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSetorFiltro('compras')}
              aria-pressed={setorFiltro === 'compras'}
              className={`ml-auto flex shrink-0 items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm font-black ${setorFiltro === 'compras' ? 'border-[#128c4a] bg-[#128c4a] text-white' : 'border-[#128c4a]/50 bg-white text-[#128c4a]'}`}
            >
              <Icon name="ShoppingCart" size={16} /> Minha lista{compras.lista.length ? ` (${compras.lista.length})` : ''}
            </button>
          </div>
        </nav>
      )}

      <main className="mx-auto max-w-6xl px-3 py-5 sm:px-4">
        {carregando ? (
          <p className="py-20 text-center text-lg font-bold text-white">Carregando ofertas…</p>
        ) : !itens.length ? (
          <div className="rounded-3xl bg-white px-4 py-16 text-center">
            <Icon name="Newspaper" size={48} className="mx-auto text-navy" />
            <p className="mt-3 text-xl font-black text-navy">Nenhuma oferta publicada ainda.</p>
            <p className="mt-1 text-base text-ink-soft">Assim que o mercado publicar, as ofertas aparecem aqui.</p>
          </div>
        ) : setorFiltro === 'compras' ? (
          <ListaCompras compras={compras} loja={loja} encarte={encarte} />
        ) : modo === 'encarte' ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {paginas.map((pagina, i) => (
              <div key={`${encarte.versao}-${setorFiltro}-${i}`} className="min-w-0 overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/10">
                <PaginaViva>
                  <Escalado>
                    <PaginaTemplate animado tema={tema} itens={pagina} encarte={ehMercado ? { ...encarte, periodoDe: hoje, periodoAte: hoje } : encarte} loja={loja} fundo={fundoDoTema} layout={layout} numero={i + 1} total={paginas.length} onAbrir={abrir} />
                  </Escalado>
                </PaginaViva>
              </div>
            ))}
          </div>
        ) : (
          <div key={encarte.versao} className="space-y-8">
            {grupos.map((g) => (
              <section key={g.setor.id} aria-labelledby={`sec-${g.setor.id}`}>
                <h2 id={`sec-${g.setor.id}`} className="mb-3 flex items-center gap-2 rounded-xl px-4 py-2.5 text-lg font-black uppercase tracking-wide text-white" style={{ background: g.setor.cor }}>
                  <Icon name={g.setor.icone} size={22} /> {g.setor.nome}
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {g.itens.map((p, i) => <CartaoProduto key={p.id} produto={p} indice={i} onAbrir={abrir} tema={tema} compras={compras} />)}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-2 text-center text-sm font-semibold text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,.5)' }}>
        Ofertas válidas enquanto durar o estoque. Imagens ilustrativas.
        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs font-bold text-white/90">
          <SimboloClawMarket tamanho={18} /> Encarte digital por ClawMarket
        </div>
      </footer>

      {acabouDeAtualizar && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]" role="status">
          <div className="cm-faixa-nova flex items-center gap-2 rounded-full bg-offer px-5 py-3 text-base font-black uppercase text-navy shadow-2xl ring-4 ring-white">
            <Icon name="Sparkles" size={20} /> Ofertas atualizadas agora!
          </div>
        </div>
      )}

      <PreviewProduto produto={aberto} lista={listaPreview} onTrocar={abrir} onFechar={fechar} tema={tema} encarte={encarte} loja={loja} compras={compras} />
    </div>
  )
}
