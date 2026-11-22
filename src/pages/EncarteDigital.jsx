import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon, Logo, PrecoVarejo, ImagemSetor } from '../components/ui'
import { SETORES, setorById, formatBRL, formatDataCurta, MERCADO_ENCARTE, noMercadoEncarte, dataISOmaisDias, plural } from '../lib/utils'
import { carregarEncartePublicado, assinarEncarte, linkDoEncarte } from '../lib/encartePublico'
import { temaCampanhaById, temasDoSetor, caminhoArte } from '../lib/temasCampanha'
import SeloArte from '../components/SeloArte'
import { SimboloClawMarket } from '../components/MarcaClawMarket'
import { Escalado } from '../components/PaginaTemplate'
import { PaginaEncarte, paginarEncarte, tamanhoPagina, ehFormatoJornal, alturaUsada } from '../components/JornalMercado'
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
    <div className={`flex h-full w-full items-center justify-center rounded-xl ${className}`} style={{ background: `${setor.cor}12` }}>
      <ImagemSetor id={setor.id} size={72} className="opacity-90" />
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
    // A entrada (cm-cartao) fica por fora; o levantar e o apertar ficam no cartão de dentro,
    // para as duas animações não brigarem pela mesma propriedade.
    <div className="cm-cartao h-full" style={{ '--cm-i': Math.min(indice, 12) }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onAbrir(produto)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(produto) } }}
        className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl bg-white text-left shadow-[0_1px_2px_rgba(16,24,40,.06),0_6px_16px_rgba(16,24,40,.06)] ring-1 ring-black/[0.06] transition-[transform,box-shadow] duration-200 ease-out focus:outline-none focus-visible:ring-4 focus-visible:ring-offer active:scale-[0.98] motion-reduce:transition-none [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:shadow-[0_2px_4px_rgba(16,24,40,.06),0_12px_24px_rgba(16,24,40,.10)]"
        aria-label={`Ver oferta: ${produto.nome}`}
      >
        <div className="relative aspect-square w-full p-3">
          <FotoProduto produto={produto} />
          <div className="absolute left-1.5 top-1.5"><TagSelo produto={produto} /></div>
          {desconto > 0 && (
            <span className="num-tab absolute right-2 top-2 rounded-full bg-bengala px-2 py-1 text-xs font-black text-white">
              -{desconto}%
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col px-3 pb-3">
          <div className="line-clamp-2 min-h-[2.5em] text-[14px] font-extrabold uppercase leading-[1.25] text-ink">{produto.nome}</div>
          {produto.gramagem && <div className="mt-0.5 text-xs font-semibold text-ink-soft">{produto.gramagem}</div>}
          <div className="mt-auto flex items-end justify-between gap-2 pt-3">
            <div className="min-w-0">
              {temDe && <div className="text-xs font-semibold text-ink-soft">De <span className="line-through">{formatBRL(produto.precoNormal)}</span></div>}
              <span className="cm-preco-lista"><SeloPreco valor={produto.precoJornal} tema={tema} /></span>
            </div>
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
  const base = 'flex shrink-0 items-center justify-center gap-2 font-black transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.96] motion-reduce:transition-none'
  if (grande) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); compras.alternar(produto) }}
        aria-pressed={na}
        aria-label={na ? `Adicionado: ${produto.nome}. Toque para remover` : `Adicionar ${produto.nome}`}
        className={`${base} w-full rounded-xl px-3 py-3.5 text-base ${na ? 'bg-[#128c4a] text-white' : 'bg-navy text-white hover:bg-navy-light'}`}
      >
        <Icon name={na ? 'CircleCheck' : 'ShoppingCart'} size={20} strokeWidth={2.25} /> {na ? 'Adicionado' : 'Adicionar'}
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); compras.alternar(produto) }}
      aria-pressed={na}
      aria-label={na ? `Remover ${produto.nome}` : `Adicionar ${produto.nome}`}
      className={`${base} h-10 w-10 rounded-full border-2 ${na ? 'border-[#128c4a] bg-[#128c4a] text-white' : 'border-navy/25 bg-white text-navy hover:border-navy'}`}
    >
      <Icon name={na ? 'Check' : 'Plus'} size={20} strokeWidth={2.4} />
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
      <div className="rounded-3xl bg-white px-6 py-14 text-center shadow-sm ring-1 ring-black/5">
        <ImagemSetor id="compras" size={72} className="mx-auto" />
        <p className="mt-4 text-xl font-extrabold text-navy">Sua lista está vazia</p>
        <p className="mx-auto mt-1 max-w-sm text-base text-ink-soft">Toque no <span className="font-bold text-navy">+</span> de uma oferta para guardar o que você vai levar. A lista fica salva neste celular.</p>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
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
          <h2 className="mb-2 flex items-center gap-2.5 px-1 text-lg font-extrabold text-navy">
            <ImagemSetor id={g.setor.id} size={30} /> {g.setor.nome}
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
      <p className="text-center text-xs font-semibold text-ink-soft">Preços do encarte. O total é uma estimativa.{loja?.endereco ? ` ${loja.endereco}.` : ''}</p>
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
          <span className="mt-2 flex items-center gap-1.5 text-sm font-extrabold text-navy"><ImagemSetor id={setor.id} size={26} /> {setor.nome}</span>
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
          <p className="text-sm text-ink-soft">{encarte?.periodoDe ? `Oferta válida de ${formatDataCurta(encarte.periodoDe)} a ${formatDataCurta(encarte.periodoAte)} ou enquanto durarem os estoques.` : 'Oferta válida enquanto durarem os estoques.'} Imagem ilustrativa.</p>
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

// Ação da loja no topo (WhatsApp, mapa). Só uma é a principal: branca e cheia.
function AcaoLoja({ href, icone, principal = false, escuro = '#000000', children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-black transition-transform duration-150 ease-out active:scale-[0.97] ${principal ? 'bg-white text-navy shadow-[0_6px_18px_-8px_rgba(0,0,0,0.5)]' : 'text-white ring-1 ring-white/40'}`}
      style={principal ? undefined : { background: `${escuro}b3` }}
    >
      <Icon name={icone} size={19} strokeWidth={2.25} /> {children}
    </a>
  )
}

// Aba de setor: ilustração grande num quadrado na cor do setor, nome embaixo e o número de ofertas.
function AbaSetor({ aba, ativa, onEscolher }) {
  return (
    <button
      type="button"
      onClick={onEscolher}
      aria-pressed={ativa}
      aria-label={`${aba.nome}, ${plural(aba.n, 'oferta', 'ofertas')}`}
      className="group flex w-[78px] shrink-0 flex-col items-center gap-1.5 rounded-2xl px-1 pb-1 pt-2 transition-transform duration-150 ease-out active:scale-[0.96]"
    >
      <span
        className={`relative flex h-14 w-14 items-center justify-center rounded-2xl transition-shadow duration-150 ${ativa ? 'ring-[2.5px] ring-navy ring-offset-2' : ''}`}
        style={{ background: `${aba.cor}1c` }}
      >
        <span className="transition-transform duration-200 ease-out [@media(hover:hover)]:group-hover:-translate-y-0.5">
          <ImagemSetor id={aba.id} size={38} />
        </span>
        <span className={`num-tab absolute -right-2 -top-2 min-w-[22px] rounded-full px-1.5 text-center text-[11px] font-black leading-[22px] ring-2 ring-white ${ativa ? 'bg-navy text-white' : 'bg-white text-navy shadow-sm'}`}>
          {aba.n}
        </span>
      </span>
      <span className={`line-clamp-2 text-center text-[12px] font-extrabold leading-tight ${ativa ? 'text-navy' : 'text-ink-soft'}`}>{aba.nome}</span>
    </button>
  )
}

// Título de cada bloco de ofertas: ilustração do setor, nome e quantidade.
function TituloSecao({ id, nome, detalhe, idTitulo }) {
  const setor = setorById(id)
  const cor = id === 'mercado-encarte' ? MERCADO_ENCARTE.cor : id === 'todos' ? '#082b4f' : setor.cor
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${cor}1c` }}>
        <ImagemSetor id={id} size={34} />
      </span>
      <div className="min-w-0">
        <h2 id={idTitulo} className="truncate text-xl font-black uppercase tracking-wide text-navy md:text-2xl">{nome}</h2>
        {detalhe && <p className="text-sm font-semibold text-ink-soft">{detalhe}</p>}
      </div>
    </div>
  )
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
  const conteudoRef = useRef(null)
  const navRef = useRef(null)

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
  // Mercado Encarte sempre no formato jornal da semana (um bloco por dia).
  const layout = ehMercado ? 'jornal' : encarte?.layout || 'grade'
  const paginas = paginarEncarte(visiveis, layout)
  const tamanho = tamanhoPagina(layout)
  const diasMercado = ofertasDoDia.map((p) => p.encarteMercadoDia).sort()
  const encarteDaAba = ehMercado && diasMercado.length ? { ...encarte, periodoDe: diasMercado[0], periodoAte: diasMercado[diasMercado.length - 1] } : encarte
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

  const reduzido = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  // Troca de aba: se o cliente já desceu a página, volta para o começo das ofertas (logo abaixo da barra fixa).
  const mudar = (fn) => {
    fn()
    const el = conteudoRef.current
    if (!el) return
    const topo = el.getBoundingClientRect().top + window.scrollY - (navRef.current?.offsetHeight || 0)
    if (window.scrollY > topo) window.scrollTo({ top: topo, behavior: reduzido ? 'auto' : 'smooth' })
  }
  const vista = setorFiltro === 'compras' ? 'compras' : modo
  const escolherVista = (id) => mudar(() => {
    if (id === 'compras') { setSetorFiltro('compras'); return }
    setModo(id)
    if (setorFiltro === 'compras') setSetorFiltro('todos')
  })
  const abas = [
    ...(ofertasDoDia.length ? [{ id: MERCADO_ENCARTE.id, nome: 'Ofertas de hoje', cor: MERCADO_ENCARTE.cor, n: ofertasDoDia.length }] : []),
    { id: 'todos', nome: 'Todas', cor: '#082b4f', n: itens.length },
    ...setoresPresentes.map((s) => ({ id: s.id, nome: s.nome, cor: s.cor, n: itens.filter((p) => p.setor === s.id).length })),
  ]
  const abaAtual = abas.find((a) => a.id === setorFiltro)
  const periodo = encarte?.periodoDe ? `${formatDataCurta(encarte.periodoDe)} a ${formatDataCurta(encarte.periodoAte)}` : ''
  const arteTitulo = caminhoArte(temaGeral, 'titulo')
  const whats = soDigitos(loja?.whatsapp)
  const linkWhats = whats ? `https://wa.me/${whats.length <= 11 ? `55${whats}` : whats}?text=${encodeURIComponent('Olá! Vi o encarte digital e quero saber mais.')}` : null
  const linkMapa = loja?.endereco ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${loja.nome}, ${loja.endereco}, ${loja.cidade || ''}`)}` : null
  const tituloConteudo = vista === 'compras' ? null : ehMercado
    ? { id: 'mercado-encarte', nome: 'Ofertas de hoje', detalhe: diasMercado.length ? `Escolhidas pela loja para ${formatDataCurta(diasMercado[0])}${diasMercado.length > 1 && diasMercado[diasMercado.length - 1] !== diasMercado[0] ? ` a ${formatDataCurta(diasMercado[diasMercado.length - 1])}` : ''}` : '' }
    : setorFiltro === 'todos'
      ? { id: 'todos', nome: 'Todas as ofertas', detalhe: plural(itens.length, 'oferta', 'ofertas') }
      : { id: setorFiltro, nome: setorById(setorFiltro).nome, detalhe: plural(visiveis.length, 'oferta', 'ofertas') }

  return (
    <div className="min-h-screen bg-cream pb-[calc(4.5rem+env(safe-area-inset-bottom))] text-ink md:pb-0">
      {/* Topo: a grande ideia da campanha da semana, o período e as duas ações da loja */}
      <header className="relative overflow-hidden text-white" style={{ background: carregando ? 'linear-gradient(160deg,#082b4f,#123f6b)' : temaGeral.fundo }}>
        <div className="mx-auto max-w-6xl px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))] md:pb-8">
          <div className="flex items-center justify-between gap-3">
            <Logo h={44} chip />
            {encarte?.publicadoEm && (
              <span className="flex shrink-0 items-center gap-2 rounded-full bg-black/30 px-3 py-1.5 text-xs font-bold" role="status">
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7dffa8] opacity-75 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#7dffa8]" />
                </span>
                {acabouDeAtualizar ? 'Atualizado agora' : `Atualizado às ${horaCurta(encarte.publicadoEm)}`}
              </span>
            )}
          </div>

          {carregando ? (
            <div className="mt-6 flex items-center gap-4" aria-hidden="true">
              <div className="h-36 w-40 shrink-0 animate-pulse rounded-2xl bg-white/15 motion-reduce:animate-none md:h-52 md:w-60" />
              <div className="flex-1 space-y-3">
                <div className="h-4 w-2/3 animate-pulse rounded bg-white/15 motion-reduce:animate-none" />
                <div className="h-8 w-full animate-pulse rounded bg-white/15 motion-reduce:animate-none" />
              </div>
            </div>
          ) : (
            <div className="cm-hero-entra mt-5 flex items-center gap-4 md:gap-8">
              {arteTitulo ? (
                <>
                  <h1 className="sr-only">{temaGeral.titulo} {temaGeral.destaque} · {loja.nome}</h1>
                  <img
                    src={arteTitulo}
                    alt=""
                    aria-hidden="true"
                    decoding="async"
                    className="aspect-[565/500] w-[44%] max-w-[260px] shrink-0 select-none rounded-2xl object-cover [mask-image:radial-gradient(120%_100%_at_50%_45%,#000_62%,transparent)] md:w-[260px]"
                  />
                </>
              ) : (
                <h1 className="display-bengala w-[48%] shrink-0 text-[clamp(2.2rem,10vw,4.25rem)] uppercase leading-[0.88] md:w-auto">
                  <span className="block" style={{ color: temaGeral.corTitulo }}>{temaGeral.titulo}</span>
                  <span className="block" style={{ color: temaGeral.corDestaque }}>{temaGeral.destaque}</span>
                </h1>
              )}
              <div className="min-w-0 flex-1">
                {periodo && (
                  <>
                    <p className="text-[13px] font-bold text-white/85 md:text-base">Ofertas válidas de</p>
                    <p className="display-bengala text-[clamp(1.9rem,8.5vw,3.25rem)] uppercase leading-none" style={{ color: temaGeral.corDestaque }}>{periodo}</p>
                    <p className="mt-1 text-[13px] font-semibold text-white/80 md:text-base">ou enquanto durarem os estoques</p>
                  </>
                )}
                <div className="mt-5 hidden flex-wrap gap-2 md:flex">
                  {linkWhats && <AcaoLoja href={linkWhats} icone="MessageCircle" principal>Chamar no WhatsApp</AcaoLoja>}
                  {linkMapa && <AcaoLoja href={linkMapa} icone="MapPin" escuro={temaGeral.contorno}>Como chegar</AcaoLoja>}
                </div>
              </div>
            </div>
          )}

          {!carregando && (linkWhats || linkMapa) && (
            <div className="mt-5 grid grid-cols-2 gap-2 md:hidden">
              {linkWhats && <AcaoLoja href={linkWhats} icone="MessageCircle" principal>WhatsApp</AcaoLoja>}
              {linkMapa && <AcaoLoja href={linkMapa} icone="MapPin" escuro={temaGeral.contorno}>Como chegar</AcaoLoja>}
            </div>
          )}
        </div>
      </header>

      {itens.length > 0 && (
        <nav ref={navRef} className="sticky top-0 z-20 border-b border-black/[0.06] bg-white/95 backdrop-blur" aria-label="Jornais do mercado">
          <div className="mx-auto flex max-w-6xl items-center gap-3 md:px-4">
            {/* Um jornal para cada setor, mais as ofertas de hoje e o jornal com tudo */}
            <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto px-3 py-2.5 [mask-image:linear-gradient(to_right,#000_calc(100%-28px),transparent)] [scrollbar-width:none] md:px-0 md:[mask-image:none] [&::-webkit-scrollbar]:hidden">
              {abas.map((a) => (
                <AbaSetor key={a.id} aba={a} ativa={setorFiltro === a.id} onEscolher={() => mudar(() => setSetorFiltro(a.id))} />
              ))}
            </div>
            <div className="hidden shrink-0 items-center gap-2 md:flex">
              <div className="flex rounded-full bg-cream p-1" role="group" aria-label="Jeito de ver">
                {[['encarte', 'Encarte'], ['lista', 'Produtos']].map(([id, rotulo]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => escolherVista(id)}
                    aria-pressed={vista === id}
                    className={`h-9 rounded-full px-4 text-sm font-black transition-[transform,background-color] duration-150 ease-out active:scale-[0.96] ${vista === id ? 'bg-white text-navy shadow-sm ring-1 ring-black/[0.06]' : 'text-ink-soft hover:text-navy'}`}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => escolherVista('compras')}
                aria-pressed={vista === 'compras'}
                aria-label={compras.lista.length ? `Minha lista, ${plural(compras.lista.length, 'item', 'itens')}` : undefined}
                className={`flex h-11 items-center gap-2 rounded-full px-4 text-sm font-black transition-transform duration-150 ease-out active:scale-[0.96] ${vista === 'compras' ? 'bg-[#128c4a] text-white' : 'bg-white text-[#128c4a] ring-1 ring-[#128c4a]/40'}`}
              >
                <Icon name="ShoppingCart" size={18} /> Minha lista
                {compras.lista.length > 0 && <span className={`num-tab min-w-[22px] rounded-full px-1.5 text-center text-xs leading-[22px] ${vista === 'compras' ? 'bg-white text-[#128c4a]' : 'bg-[#128c4a] text-white'}`}>{compras.lista.length}</span>}
              </button>
            </div>
          </div>
        </nav>
      )}

      <main ref={conteudoRef} className="mx-auto max-w-6xl px-3 py-5 sm:px-4 md:py-7">
        {carregando ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Carregando ofertas">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl bg-white p-3 ring-1 ring-black/[0.06]">
                <div className="aspect-square animate-pulse rounded-xl bg-black/[0.05] motion-reduce:animate-none" />
                <div className="mt-3 h-3.5 w-4/5 animate-pulse rounded bg-black/[0.06] motion-reduce:animate-none" />
                <div className="mt-2 h-3.5 w-1/2 animate-pulse rounded bg-black/[0.06] motion-reduce:animate-none" />
              </div>
            ))}
          </div>
        ) : !itens.length ? (
          <div className="mx-auto max-w-md rounded-3xl bg-white px-6 py-14 text-center ring-1 ring-black/[0.06]">
            <ImagemSetor id="geral" size={88} className="mx-auto" />
            <p className="mt-4 text-xl font-black text-navy">Nenhuma oferta publicada ainda</p>
            <p className="mt-1 text-base text-ink-soft">Assim que o mercado publicar, as ofertas aparecem aqui sozinhas.</p>
          </div>
        ) : vista === 'compras' ? (
          <ListaCompras compras={compras} loja={loja} encarte={encarte} />
        ) : vista === 'encarte' ? (
          <>
            <TituloSecao id={tituloConteudo.id} nome={tituloConteudo.nome} detalhe={paginas.length > 1 ? `${tituloConteudo.detalhe ? `${tituloConteudo.detalhe} · ` : ''}${plural(paginas.length, 'página', 'páginas')}` : tituloConteudo.detalhe} />
            <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
              {paginas.map((pagina, i) => (
                <div key={`${encarte.versao}-${setorFiltro}-${i}`} className="min-w-0 overflow-hidden rounded-2xl shadow-[0_10px_30px_-12px_rgba(8,43,79,0.35)] ring-1 ring-black/[0.06]">
                  <PaginaViva>
                    <Escalado largura={tamanho.largura} altura={ehFormatoJornal(layout) ? alturaUsada(pagina) : tamanho.altura}>
                      <PaginaEncarte animado compacto tema={tema} pagina={pagina} encarte={encarteDaAba} loja={loja} fundo={fundoDoTema} layout={layout} numero={i + 1} total={paginas.length} onAbrir={abrir} />
                    </Escalado>
                  </PaginaViva>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div key={encarte.versao} className="space-y-9">
            {grupos.map((g) => (
              <section key={g.setor.id} aria-labelledby={`sec-${g.setor.id}`}>
                <TituloSecao id={ehMercado ? 'mercado-encarte' : g.setor.id} nome={ehMercado ? 'Ofertas de hoje' : g.setor.nome} detalhe={plural(g.itens.length, 'oferta', 'ofertas')} idTitulo={`sec-${g.setor.id}`} />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {g.itens.map((p, i) => <CartaoProduto key={p.id} produto={p} indice={i} onAbrir={abrir} tema={tema} compras={compras} />)}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-3 pb-10 sm:px-4">
        <div className="rounded-3xl bg-white px-5 py-6 ring-1 ring-black/[0.06] md:flex md:items-start md:justify-between md:gap-8 md:px-8">
          <div className="flex items-start gap-4">
            <Logo h={48} />
            <div className="min-w-0 text-sm leading-relaxed text-ink-soft">
              <p className="text-base font-black text-navy">{loja.nome}</p>
              {loja.endereco && <p>{loja.endereco}{loja.cidade ? ` · ${loja.cidade}` : ''}</p>}
              {(loja.telefone || loja.whatsapp) && (
                <p>
                  {loja.telefone && <>Tel. {loja.telefone}</>}
                  {loja.telefone && loja.whatsapp && ' · '}
                  {loja.whatsapp && <>WhatsApp {loja.whatsapp}</>}
                </p>
              )}
            </div>
          </div>
          <div className="mt-5 border-t border-black/[0.06] pt-4 text-xs leading-relaxed text-ink-soft md:mt-0 md:max-w-sm md:border-0 md:pt-0 md:text-right">
            <p>{periodo ? `Ofertas válidas de ${periodo} ou enquanto durarem os estoques.` : 'Ofertas válidas enquanto durarem os estoques.'} Imagens ilustrativas.</p>
            <p className="mt-3 flex items-center gap-1.5 font-bold text-navy md:justify-end">
              <SimboloClawMarket tamanho={18} /> Encarte digital por ClawMarket
            </p>
            <p className="mt-1">Ilustrações: Fluent Emoji (Microsoft, MIT)</p>
          </div>
        </div>
      </footer>

      {/* Celular: as três vistas ficam no alcance do polegar */}
      {itens.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/[0.08] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          <div className="mx-auto grid max-w-md grid-cols-3" role="group" aria-label="Jeito de ver">
            {[['encarte', 'Encarte', 'Newspaper'], ['lista', 'Produtos', 'LayoutGrid'], ['compras', 'Minha lista', 'ShoppingCart']].map(([id, rotulo, icone]) => {
              const ativa = vista === id
              const cor = id === 'compras' ? '#128c4a' : '#082b4f'
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => escolherVista(id)}
                  aria-pressed={ativa}
                  aria-label={id === 'compras' && compras.lista.length ? `Minha lista, ${plural(compras.lista.length, 'item', 'itens')}` : undefined}
                  className="flex h-[4.5rem] flex-col items-center justify-center gap-1 text-[12px] font-extrabold transition-transform duration-150 ease-out active:scale-[0.96]"
                  style={{ color: ativa ? cor : '#566274' }}
                >
                  <span className="relative flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-150" style={{ background: ativa ? `${cor}17` : 'transparent' }}>
                    <Icon name={icone} size={22} strokeWidth={ativa ? 2.25 : 1.75} />
                    {id === 'compras' && compras.lista.length > 0 && (
                      <span className="num-tab absolute -right-0.5 -top-1 min-w-[20px] rounded-full bg-[#128c4a] px-1 text-center text-[11px] leading-[20px] text-white ring-2 ring-white">{compras.lista.length}</span>
                    )}
                  </span>
                  {rotulo}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {acabouDeAtualizar && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 md:bottom-0 md:pb-6" role="status">
          <div className="cm-faixa-nova flex items-center gap-2 rounded-full bg-navy px-5 py-3 text-sm font-black text-white shadow-2xl">
            <Icon name="Sparkles" size={18} color="#ffc928" /> Ofertas atualizadas agora
          </div>
        </div>
      )}

      <PreviewProduto produto={aberto} lista={listaPreview} onTrocar={abrir} onFechar={fechar} tema={tema} encarte={encarte} loja={loja} compras={compras} />
    </div>
  )
}
