import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon, Logo, PrecoVarejo, ImagemSetor, ImagemAba } from '../components/ui'
import { SETORES, setorById, formatBRL, formatDataCurta, MERCADO_ENCARTE, noMercadoEncarte, dataISOmaisDias, plural } from '../lib/utils'
import { carregarEncartePublicado, assinarEncarte, linkDoEncarte } from '../lib/encartePublico'
import { temaCampanhaById, temasDoSetor, caminhoArte } from '../lib/temasCampanha'
import SeloArte from '../components/SeloArte'
import { SimboloClawMarket } from '../components/MarcaClawMarket'
import { Escalado } from '../components/PaginaTemplate'
import { PaginaEncarte, paginarEncarte, tamanhoPagina, ehFormatoJornal, alturaUsada } from '../components/JornalMercado'
import PrecoArte from '../components/PrecoArte'
import { LOJAS } from '../data/seed'

// Encarte digital público: a página que a tag NFC abre.
// Feita para celular primeiro, com alto contraste e letras grandes.
// Atualiza sozinha quando uma nova versão é publicada no Jornal (o servidor avisa na hora).
// Motion design: as páginas do encarte se montam ao aparecer na tela, o preço pulsa e o
// selo balança. Cada produto abre uma prévia própria (deslize para o lado para ver o próximo),
// com link direto (#/encarte?p=<id>) para compartilhar.

const horaCurta = (iso) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''

// Nomes do cadastro vêm em MAIÚSCULAS ("MARG DELICIA 500G C SAL"). Na tela do cliente
// ficam mais fáceis de ler com só a primeira letra grande ("Marg Delicia 500g c Sal").
// Nome que já tem minúsculas fica como está.
const MINUSCULAS = new Set(['a', 'o', 'e', 'de', 'da', 'do', 'das', 'dos', 'com', 'sem', 'para', 'em', 'na', 'no', 'ao', 'c', 's', 'p', 'c/', 's/', 'p/'])
const UNIDADES = new Set(['g', 'gr', 'kg', 'mg', 'ml', 'l', 'lt', 'un', 'und', 'unid', 'cx', 'pc', 'pct', 'cm', 'm'])
const nomeLegivel = (nome = '') => {
  const texto = String(nome || '').trim()
  if (!texto || /[a-zà-ÿ]/.test(texto)) return texto
  return texto.split(/\s+/).map((palavra, i) => {
    const min = palavra.toLocaleLowerCase('pt-BR')
    const unidade = min.match(/^(\d+(?:[.,]\d+)?)?([a-z]+)$/)
    if (unidade && UNIDADES.has(unidade[2]) && (unidade[1] || i > 0)) return min.replace(/(^|\d)(l|lt)$/, '$1L')
    if (/^\d/.test(min) || (i > 0 && MINUSCULAS.has(min))) return min
    return min.charAt(0).toLocaleUpperCase('pt-BR') + min.slice(1)
  }).join(' ')
}

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

function SeloPreco({ valor, tema, grande = false, estilo }) {
  // Mesmo estilo de preço escolhido no jornal (só o número, faixa…); sem escolha, o balão.
  if (estilo && estilo !== 'oval') {
    return <span className="inline-block"><PrecoArte valor={valor} tema={tema} estilo={estilo} k={grande ? 0.7 : 0.44} semUnidade /></span>
  }
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
          <div className="line-clamp-2 min-h-[2.6em] text-[15px] font-semibold leading-[1.3] text-ink">{nomeLegivel(produto.nome)}</div>
          {produto.gramagem && <div className="mt-0.5 text-[13px] text-ink-soft">{produto.gramagem}</div>}
          <div className="mt-auto flex items-end justify-between gap-2 pt-3">
            <div className="min-w-0">
              {temDe && <div className="text-xs font-semibold text-ink-soft">De <span className="line-through">{formatBRL(produto.precoNormal)}</span></div>}
              <span className="cm-preco-lista"><SeloPreco valor={produto.precoJornal} tema={tema} estilo={produto.estiloPreco} /></span>
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
  const base = 'flex shrink-0 items-center justify-center gap-2 font-bold transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.96] motion-reduce:transition-none'
  if (grande) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); compras.alternar(produto) }}
        aria-pressed={na}
        aria-label={na ? `Adicionado: ${produto.nome}. Toque para remover` : `Adicionar ${produto.nome}`}
        className={`${base} h-14 w-full rounded-2xl px-4 text-[17px] ${na ? 'bg-[#0f7a40] text-white' : 'bg-navy text-white hover:bg-navy-light'}`}
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
      className={`${base} h-10 w-10 rounded-full ${na ? 'bg-[#0f7a40] text-white' : 'bg-cream text-navy hover:bg-cream-200'}`}
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
            <div className="text-2xl font-extrabold tracking-[-0.01em] text-navy">Total estimado <span className="num-tab">{formatBRL(total)}</span></div>
          </div>
          <Icon name="ShoppingCart" size={34} className="text-bengala" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={compartilhar} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-cream px-3 text-sm font-bold text-navy transition-[transform,background-color] duration-150 ease-out hover:bg-cream-200 active:scale-[0.97]"><Icon name="Share2" size={18} /> Enviar lista</button>
          <button type="button" onClick={pegos ? compras.limparPegos : compras.limparTudo} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#fdeeee] px-3 text-sm font-bold text-critical transition-[transform,background-color] duration-150 ease-out hover:bg-[#fbe1e1] active:scale-[0.97]"><Icon name="Trash2" size={18} /> {pegos ? 'Tirar os pegos' : 'Limpar lista'}</button>
        </div>
      </div>
      {grupos.map((g) => (
        <section key={g.setor.id}>
          <h2 className="mb-2 flex items-center gap-2.5 px-1 text-lg font-extrabold text-navy">
            <ImagemSetor id={g.setor.id} size={30} /> {g.setor.nome}
          </h2>
          <div className="space-y-2">
            {g.itens.map((i) => (
              <div key={i.id} className={`flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-black/[0.05] transition-opacity duration-200 ${i.pego ? 'opacity-60' : ''}`}>
                <button type="button" onClick={() => compras.mudar(i.id, { pego: !i.pego })} aria-pressed={i.pego} aria-label={i.pego ? 'Desmarcar' : 'Marcar como pego'}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-[1.5px] transition-colors duration-150 ${i.pego ? 'border-[#0f7a40] bg-[#0f7a40] text-white' : 'border-black/20 bg-white text-transparent'}`}>
                  <Icon name="Check" size={20} />
                </button>
                {i.imagem ? <img src={i.imagem} alt="" className="h-12 w-12 shrink-0 object-contain" /> : null}
                <div className="min-w-0 flex-1">
                  <div className={`text-[15px] font-semibold leading-snug text-ink ${i.pego ? 'line-through' : ''}`}>{nomeLegivel(i.nome)}</div>
                  <div className="num-tab text-sm font-bold text-bengala">{formatBRL(i.preco)}{i.unidade ? ` ${i.unidade}` : ''}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => (i.qtd > 1 ? compras.mudar(i.id, { qtd: i.qtd - 1 }) : compras.remover(i.id))} className="flex h-9 w-9 items-center justify-center rounded-full bg-cream text-navy transition-[transform,background-color] duration-150 ease-out hover:bg-cream-200 active:scale-[0.94]" aria-label={i.qtd > 1 ? 'Menos um' : 'Tirar da lista'}><Icon name={i.qtd > 1 ? 'Minus' : 'Trash2'} size={16} strokeWidth={2.25} /></button>
                  <span className="num-tab w-7 text-center text-base font-bold text-navy">{i.qtd}</span>
                  <button type="button" onClick={() => compras.mudar(i.id, { qtd: i.qtd + 1 })} className="flex h-9 w-9 items-center justify-center rounded-full bg-cream text-navy transition-[transform,background-color] duration-150 ease-out hover:bg-cream-200 active:scale-[0.94]" aria-label="Mais um"><Icon name="Plus" size={16} strokeWidth={2.25} /></button>
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
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-navy transition-[transform,background-color] duration-150 ease-out hover:bg-cream active:scale-[0.94] disabled:pointer-events-none disabled:opacity-25"
    >
      <Icon name={lado > 0 ? 'ChevronRight' : 'ChevronLeft'} size={22} strokeWidth={2.25} />
    </button>
  )
  const temDe = desconto > 0 && Number(produto.precoNormal) > Number(produto.precoJornal)
  const botaoLeve = 'flex h-12 items-center justify-center gap-2 rounded-2xl px-3 text-[15px] font-bold transition-[transform,background-color] duration-150 ease-out active:scale-[0.97]'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overscroll-none bg-black/60 backdrop-blur-[2px] sm:items-center sm:p-6" onClick={onFechar} role="dialog" aria-modal="true" aria-label={nomeLegivel(produto.nome)}>
      <div
        className="cm-folha cm-folha-altura flex w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.35)] sm:max-w-lg sm:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* topo fixo: setor, passar de oferta e fechar ficam sempre à vista */}
        <div className="relative z-10 flex shrink-0 touch-none items-center gap-1 bg-white px-4 pb-2 pt-5 sm:pt-4" onTouchStart={inicioPuxar} onTouchEnd={fimPuxar}>
          <div className="absolute inset-x-0 top-2 mx-auto h-1 w-10 rounded-full bg-black/15 sm:hidden" aria-hidden="true" />
          <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink-soft">
            <ImagemSetor id={setor.id} size={24} /> <span className="truncate">{setor.nome}</span>
          </span>
          {lista.length > 1 && (
            <div className="ml-auto flex items-center">
              {botaoSeta(anterior, -1)}
              <span className="num-tab min-w-[3.75rem] text-center text-sm font-semibold text-ink-soft" aria-live="polite">{indice + 1} de {lista.length}</span>
              {botaoSeta(proximo, 1)}
            </div>
          )}
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className={`${lista.length > 1 ? 'ml-1' : 'ml-auto'} flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cream text-navy transition-[transform,background-color] duration-150 ease-out hover:bg-cream-200 active:scale-[0.94]`}
          >
            <Icon name="X" size={20} strokeWidth={2.25} />
          </button>
        </div>

        {/* só o conteúdo rola, sem arrastar a página de trás */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(1.25rem,env(safe-area-inset-bottom))]" onTouchStart={inicioToque} onTouchEnd={fimToque}>

        <div key={produto.id} className="cm-troca-produto" style={{ '--cm-lado': direcao }}>
          {/* foto sobre fundo claro; o branco da foto some (multiply) e não fica um quadrado branco */}
          <div className="relative mx-4 mt-1 h-[32vh] min-h-52 overflow-hidden rounded-3xl bg-cream p-6 sm:aspect-[4/3] sm:h-auto">
            <div className="cm-foto-preview h-full w-full bg-cream"><FotoProduto produto={produto} className="mix-blend-multiply" /></div>
            {desconto > 0 && (
              <span className="cm-preco-preview num-tab absolute right-3 top-3 rounded-full bg-bengala px-3 py-1.5 text-[15px] font-extrabold text-white">
                -{desconto}%
              </span>
            )}
            <div className="absolute left-2 top-2"><TagSelo produto={produto} /></div>
          </div>

          <div className="px-5 pt-5">
            <h2 className="text-balance text-[22px] font-extrabold leading-[1.2] tracking-[-0.01em] text-ink">{nomeLegivel(produto.nome)}</h2>
            {(produto.marca || produto.gramagem) && (
              <p className="mt-1 text-[15px] text-ink-soft">{[produto.marca, produto.gramagem].filter(Boolean).join(' · ')}</p>
            )}
            <div className="mt-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
              <div>
                {temDe && <p className="text-sm text-ink-soft">De <span className="num-tab line-through">{formatBRL(produto.precoNormal)}</span> por</p>}
                <span className="cm-preco-preview inline-block">
                  <PrecoVarejo valor={produto.precoJornal} className="text-[54px]" cor={tema.precoCor || '#d81e29'} />
                </span>
              </div>
              {economia > 0.009 && (
                <span className="mb-2 rounded-full bg-[#e7f5ec] px-3 py-1.5 text-sm font-bold text-[#0f6b3a]">Você economiza <span className="num-tab">{formatBRL(economia)}</span></span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-2.5 px-5">
          {compras && <BotaoLista produto={produto} compras={compras} grande />}
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" onClick={compartilhar} className={`${botaoLeve} bg-cream text-navy hover:bg-cream-200 ${linkWhats ? '' : 'col-span-2'}`}>
              <Icon name={copiado ? 'Check' : 'Share2'} size={19} strokeWidth={2.25} /> {copiado ? 'Link copiado' : 'Compartilhar'}
            </button>
            {linkWhats && (
              <a href={linkWhats} target="_blank" rel="noreferrer" className={`${botaoLeve} bg-[#e7f5ec] text-[#0f6b3a] hover:bg-[#d9efe2]`}>
                <Icon name="MessageCircle" size={19} strokeWidth={2.25} /> WhatsApp
              </a>
            )}
          </div>
          <p className="pt-2 text-[13px] leading-relaxed text-ink-soft">
            {encarte?.periodoDe ? `Oferta válida de ${formatDataCurta(encarte.periodoDe)} a ${formatDataCurta(encarte.periodoAte)} ou enquanto durarem os estoques.` : 'Oferta válida enquanto durarem os estoques.'} Imagem ilustrativa.
          </p>
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
      aria-label={aba.ajuste ? `${aba.nome}, ajustando ofertas` : `${aba.nome}, ${plural(aba.n, 'oferta', 'ofertas')}`}
      className="group flex w-[78px] shrink-0 flex-col items-center gap-1.5 rounded-2xl px-1 pb-1 pt-2 transition-transform duration-150 ease-out active:scale-[0.96]"
    >
      <span
        className={`relative flex h-14 w-14 items-center justify-center rounded-2xl transition-shadow duration-150 ${ativa ? 'ring-[2.5px] ring-navy ring-offset-2' : ''}`}
        style={{ background: `${aba.cor}1c` }}
      >
        <span className="transition-transform duration-200 ease-out [@media(hover:hover)]:group-hover:-translate-y-0.5">
          <ImagemSetor id={aba.id} size={38} />
        </span>
        {aba.ajuste ? (
          <span className="absolute -right-2 -top-2 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#b3261e] text-white ring-2 ring-white" aria-hidden="true">
            <Icon name="Wrench" size={12} strokeWidth={2.5} />
          </span>
        ) : (
          <span className={`num-tab absolute -right-2 -top-2 min-w-[22px] rounded-full px-1.5 text-center text-[11px] font-black leading-[22px] ring-2 ring-white ${ativa ? 'bg-navy text-white' : 'bg-white text-navy shadow-sm'}`}>
            {aba.n}
          </span>
        )}
      </span>
      <span className={`line-clamp-2 text-center text-[12px] font-extrabold leading-tight ${ativa ? 'text-navy' : 'text-ink-soft'}`}>{aba.nome}</span>
    </button>
  )
}

// Setor desligado pela loja para ajuste de preços: aviso no lugar dos produtos. A página
// atualiza sozinha quando a loja religa o setor.
function AjustandoOfertas({ setor, outras, onEscolher }) {
  return (
    <div className="mx-auto max-w-md rounded-3xl bg-white px-6 py-12 text-center ring-1 ring-black/[0.06]" role="status">
      <span className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-3xl" style={{ background: `${setor?.cor || '#082b4f'}1c` }}>
        <ImagemSetor id={setor?.id || 'geral'} size={64} />
        <span className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#b3261e] text-white ring-4 ring-white">
          <Icon name="Wrench" size={20} strokeWidth={2.25} className="motion-safe:animate-[cm-chave_1.6s_ease-in-out_infinite]" />
        </span>
      </span>
      <p className="mt-6 text-2xl font-black text-navy">Ajustando ofertas</p>
      <p className="mt-2 text-base leading-relaxed text-ink-soft">
        {setor ? <>Estamos atualizando os preços de <strong className="text-navy">{setor.nome}</strong>.</> : 'Estamos atualizando os preços.'} Volte em instantes: esta página muda sozinha quando as ofertas voltarem.
      </p>
      {outras.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-bold text-ink">Enquanto isso, veja:</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {outras.slice(0, 6).map((a) => (
              <button key={a.id} type="button" onClick={() => onEscolher(a.id)}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-cream px-4 text-sm font-bold text-navy ring-1 ring-black/[0.06] transition-transform duration-150 ease-out active:scale-[0.96]">
                <ImagemSetor id={a.id === 'todos' ? 'geral' : a.id} size={22} /> {a.nome}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
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
        <h2 id={idTitulo} className="truncate text-[22px] font-extrabold leading-tight tracking-[-0.01em] text-navy md:text-[26px]">{nome}</h2>
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
      // Leitura vazia ou com erro depois de já mostrar ofertas: mantém o que está na tela.
      if (versaoAtual !== null && !(novo?.itens?.length)) return
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

  // Setores que a loja desligou para ajuste: os produtos deles somem de todas as vistas e a aba
  // do setor mostra "Ajustando ofertas" até a loja religar.
  const todosItens = encarte?.itens || []
  const pausados = useMemo(() => new Set(Array.isArray(encarte?.pausados) ? encarte.pausados : []), [encarte])
  const itens = useMemo(() => (pausados.size ? todosItens.filter((p) => !pausados.has(p.setor)) : todosItens), [todosItens, pausados])
  const temaGeral = temaCampanhaById(encarte?.tema)
  // Cada setor tem o seu jornal, com o template escolhido para ele no Jornal.
  const temaDoSetor = (id) => temaCampanhaById(encarte?.temasSetor?.[id] || temasDoSetor(id)[0]?.id || encarte?.tema)
  // Mercado Encarte: só as ofertas marcadas para hoje (somem sozinhas no dia seguinte).
  const hoje = dataISOmaisDias(0)
  // A loja pode esconder o Geral e o Mercado Encarte do site (chaves no passo 1 do Jornal).
  const geralNoSite = encarte?.mostrarGeral !== false
  const mercadoNoSite = encarte?.mostrarMercado !== false
  const ofertasDoDia = useMemo(() => (mercadoNoSite ? itens.filter((p) => noMercadoEncarte(p, hoje)) : []), [itens, hoje, mercadoNoSite])
  const ehMercado = setorFiltro === MERCADO_ENCARTE.id
  useEffect(() => { if (ehMercado && encarte && !ofertasDoDia.length) setSetorFiltro('todos') }, [ehMercado, encarte, ofertasDoDia.length])
  const tema = setorFiltro !== 'todos' && setorFiltro !== 'compras' ? temaDoSetor(setorFiltro) : temaGeral
  // Fundo enviado no Jornal vale só para o template dele.
  const fundoDoTema = encarte?.fundos?.[tema.id] || (tema.id === encarte?.tema ? encarte?.fundo || null : null)
  const setoresPresentes = useMemo(
    () => SETORES.filter((s) => todosItens.some((p) => p.setor === s.id)),
    [todosItens]
  )
  const setorEmAjuste = pausados.has(setorFiltro)
  const visiveis = ehMercado ? ofertasDoDia : setorFiltro === 'todos' || setorFiltro === 'compras' ? itens : itens.filter((p) => p.setor === setorFiltro)
  const grupos = setorFiltro === 'todos' || setorFiltro === 'compras'
    ? setoresPresentes.filter((s) => !pausados.has(s.id)).map((s) => ({ setor: s, itens: itens.filter((p) => p.setor === s.id) }))
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
    ...(geralNoSite ? [{ id: 'todos', nome: 'Todas', cor: '#082b4f', n: itens.length }] : []),
    ...setoresPresentes.map((s) => ({ id: s.id, nome: s.nome, cor: s.cor, n: itens.filter((p) => p.setor === s.id).length, ajuste: pausados.has(s.id) })),
  ]
  const abaAtual = abas.find((a) => a.id === setorFiltro)
  // Aba escondida pela loja (ou que sumiu): abre a primeira que existe.
  useEffect(() => {
    if (!encarte || setorFiltro === 'compras' || !abas.length || abas.some((a) => a.id === setorFiltro)) return
    setSetorFiltro(abas[0].id)
  }, [encarte, setorFiltro, abas])
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
                    <p className="text-[13px] font-bold text-white/90 md:text-base">Ofertas válidas de</p>
                    <p className="display-bengala text-[clamp(1.9rem,8.5vw,3.25rem)] uppercase leading-none" style={{ color: temaGeral.corDestaque }}>{periodo}</p>
                    <p className="mt-1 text-[13px] font-semibold text-white/90 md:text-base">ou enquanto durarem os estoques</p>
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

      {todosItens.length > 0 && (
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
                    className={`flex h-9 items-center gap-1.5 rounded-full pl-2 pr-4 text-sm font-bold transition-[transform,background-color] duration-150 ease-out active:scale-[0.96] ${vista === id ? 'bg-white text-navy shadow-sm ring-1 ring-black/[0.06]' : 'text-ink-soft hover:text-navy'}`}
                  >
                    <ImagemAba id={id} size={22} />
                    {rotulo}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => escolherVista('compras')}
                aria-pressed={vista === 'compras'}
                aria-label={compras.lista.length ? `Minha lista, ${plural(compras.lista.length, 'item', 'itens')}` : undefined}
                className={`flex h-11 items-center gap-2 rounded-full px-4 text-sm font-black transition-transform duration-150 ease-out active:scale-[0.96] ${vista === 'compras' ? 'bg-[#0f7a40] text-white' : 'bg-white text-[#0f7a40] ring-1 ring-[#0f7a40]/40'}`}
              >
                <ImagemAba id="compras" size={22} /> Minha lista
                {compras.lista.length > 0 && <span className={`num-tab min-w-[22px] rounded-full px-1.5 text-center text-xs leading-[22px] ${vista === 'compras' ? 'bg-white text-[#0f7a40]' : 'bg-[#0f7a40] text-white'}`}>{compras.lista.length}</span>}
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
        ) : vista !== 'compras' && (setorEmAjuste || (!itens.length && todosItens.length > 0)) ? (
          <AjustandoOfertas
            setor={setorEmAjuste ? setorById(setorFiltro) : null}
            outras={abas.filter((a) => !a.ajuste && a.id !== setorFiltro)}
            onEscolher={(id) => mudar(() => setSetorFiltro(id))}
          />
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
      {todosItens.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/[0.08] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          <div className="mx-auto grid max-w-md grid-cols-3" role="group" aria-label="Jeito de ver">
            {[['encarte', 'Encarte'], ['lista', 'Produtos'], ['compras', 'Minha lista']].map(([id, rotulo]) => {
              const ativa = vista === id
              const cor = id === 'compras' ? '#0f7a40' : '#082b4f'
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => escolherVista(id)}
                  aria-pressed={ativa}
                  aria-label={id === 'compras' && compras.lista.length ? `Minha lista, ${plural(compras.lista.length, 'item', 'itens')}` : undefined}
                  className="flex h-[4.5rem] flex-col items-center justify-center gap-1 text-[12px] font-bold transition-transform duration-150 ease-out active:scale-[0.96]"
                  style={{ color: ativa ? cor : '#3b4656' }}
                >
                  <span className="relative flex h-9 w-14 items-center justify-center rounded-full transition-colors duration-150" style={{ background: ativa ? `${cor}17` : 'transparent' }}>
                    <ImagemAba id={id} size={28} className={ativa ? '' : 'opacity-90'} />
                    {id === 'compras' && compras.lista.length > 0 && (
                      <span className="num-tab absolute -right-0.5 -top-1 min-w-[20px] rounded-full bg-[#0f7a40] px-1 text-center text-[11px] leading-[20px] text-white ring-2 ring-white">{compras.lista.length}</span>
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
