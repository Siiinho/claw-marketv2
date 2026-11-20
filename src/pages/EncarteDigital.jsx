import { useEffect, useMemo, useState } from 'react'
import { Icon, Logo, PrecoVarejo } from '../components/ui'
import { SETORES, setorById, formatBRL, formatData, seloDoProduto } from '../lib/utils'
import { carregarEncartePublicado, assinarEncarte } from '../lib/encartePublico'
import { temaCampanhaById } from '../lib/temasCampanha'
import { SimboloClawMarket } from '../components/MarcaClawMarket'

// Encarte digital público: a página que a tag NFC abre.
// Feita para celular primeiro, com alto contraste e letras grandes.
// Atualiza sozinha quando uma nova versão é publicada no Jornal.

const horaCurta = (iso) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''

function TagSelo({ produto, grande = false }) {
  const selo = seloDoProduto(produto)
  return (
    <span
      className={`inline-block rounded-md font-black uppercase leading-none tracking-wide ${grande ? 'px-3 py-1.5 text-sm' : 'px-2 py-1 text-[11px]'}`}
      style={{ background: selo.fundo, color: selo.cor }}
    >
      {selo.texto}
    </span>
  )
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

function CartaoProduto({ produto, onAbrir, tema }) {
  const desconto = Number(produto.descontoJornal) || 0
  const temDe = desconto > 0 && Number(produto.precoNormal) > Number(produto.precoJornal)
  return (
    <button
      type="button"
      onClick={() => onAbrir(produto)}
      className="group relative flex flex-col overflow-hidden rounded-2xl border-2 border-navy/15 bg-white text-left shadow-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-offer"
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
          <div className="mt-1"><SeloPreco valor={produto.precoJornal} tema={tema} /></div>
        </div>
      </div>
    </button>
  )
}

function PreviewProduto({ produto, onFechar, tema }) {
  useEffect(() => {
    if (!produto) return undefined
    const esc = (e) => { if (e.key === 'Escape') onFechar() }
    window.addEventListener('keydown', esc)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', esc); document.body.style.overflow = overflow }
  }, [produto, onFechar])

  if (!produto) return null
  const setor = setorById(produto.setor)
  const desconto = Number(produto.descontoJornal) || 0
  const economia = Number(produto.precoNormal) - Number(produto.precoJornal)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-6" onClick={onFechar} role="dialog" aria-modal="true" aria-label={produto.nome}>
      <div
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white px-4 pb-2 pt-4">
          <span className="rounded-full px-3 py-1 text-xs font-black uppercase text-white" style={{ background: setor.cor }}>{setor.nome}</span>
          <button type="button" onClick={onFechar} className="flex h-11 w-11 items-center justify-center rounded-full bg-navy text-white" aria-label="Fechar">
            <Icon name="X" size={22} />
          </button>
        </div>
        <div className="relative mx-4 aspect-square rounded-2xl border-2 border-navy/10 bg-white p-4">
          <FotoProduto produto={produto} />
          {desconto > 0 && (
            <span className="absolute right-3 top-3 flex h-16 w-16 items-center justify-center rounded-full bg-bengala text-lg font-black text-white shadow-lg">
              -{desconto}%
            </span>
          )}
        </div>
        <div className="space-y-3 px-5 pt-4">
          <TagSelo produto={produto} grande />
          <h2 className="text-2xl font-black uppercase leading-tight text-navy">{produto.nome}</h2>
          {(produto.marca || produto.gramagem) && (
            <p className="text-base font-semibold text-ink-soft">{[produto.marca, produto.gramagem].filter(Boolean).join(' · ')}</p>
          )}
          <div className="rounded-2xl p-4 text-white" style={{ background: tema.fundo }}>
            {desconto > 0 && (
              <div className="text-base font-bold text-white/80">
                De <span className="line-through">{formatBRL(produto.precoNormal)}</span> por
              </div>
            )}
            <div className="mt-1"><SeloPreco valor={produto.precoJornal} tema={tema} grande /></div>
            {economia > 0.009 && (
              <div className="mt-3 text-base font-black" style={{ color: tema.corDestaque }}>Você economiza {formatBRL(economia)}</div>
            )}
          </div>
          <p className="text-sm text-ink-soft">Oferta válida enquanto durar o estoque. Imagem ilustrativa.</p>
        </div>
      </div>
    </div>
  )
}

export default function EncarteDigital() {
  const [encarte, setEncarte] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [setorFiltro, setSetorFiltro] = useState('todos')
  const [aberto, setAberto] = useState(null)
  const [acabouDeAtualizar, setAcabouDeAtualizar] = useState(false)

  useEffect(() => {
    let ativo = true
    let versaoAtual = null
    const recarregar = async () => {
      const novo = await carregarEncartePublicado()
      if (!ativo) return
      setCarregando(false)
      if (novo?.versao === versaoAtual) return
      if (versaoAtual !== null) {
        setAcabouDeAtualizar(true)
        setTimeout(() => ativo && setAcabouDeAtualizar(false), 4000)
      }
      versaoAtual = novo?.versao ?? null
      setEncarte(novo)
    }
    recarregar()
    const cancelar = assinarEncarte(recarregar)
    return () => { ativo = false; cancelar() }
  }, [])

  const itens = encarte?.itens || []
  const tema = temaCampanhaById(encarte?.tema)
  const contorno = `-2px -2px 0 ${tema.contorno}, 2px -2px 0 ${tema.contorno}, -2px 2px 0 ${tema.contorno}, 2px 2px 0 ${tema.contorno}, 0 5px 0 ${tema.contorno}`
  const setoresPresentes = useMemo(
    () => SETORES.filter((s) => itens.some((p) => p.setor === s.id)),
    [itens]
  )
  const visiveis = setorFiltro === 'todos' ? itens : itens.filter((p) => p.setor === setorFiltro)
  const grupos = setorFiltro === 'todos'
    ? setoresPresentes.map((s) => ({ setor: s, itens: itens.filter((p) => p.setor === s.id) }))
    : [{ setor: setorById(setorFiltro), itens: visiveis }]

  return (
    <div className="min-h-screen" style={{ background: tema.fundo, backgroundAttachment: 'fixed' }}>
      <header style={{ background: tema.fundo }} className="text-white">
        <div className="mx-auto max-w-6xl px-4 pb-5 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="flex items-center justify-between gap-3">
            <Logo h={46} chip />
            {encarte?.publicadoEm && (
              <span className="flex items-center gap-2 rounded-full bg-black/35 px-3 py-1.5 text-xs font-bold">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
                </span>
                {acabouDeAtualizar ? 'Atualizado agora' : `Atualizado às ${horaCurta(encarte.publicadoEm)}`}
              </span>
            )}
          </div>
          <div className="mt-4 text-center sm:mt-6">
            <div className="text-[13vw] font-black uppercase italic leading-[0.9] tracking-tight sm:text-7xl" style={{ color: tema.corTitulo, textShadow: contorno }}>
              {tema.titulo}
            </div>
            <div className="text-[11vw] font-black uppercase italic leading-[0.95] tracking-tight sm:text-6xl" style={{ color: tema.corDestaque, textShadow: contorno }}>
              {tema.destaque}
            </div>
            <p className="mt-3 text-lg font-extrabold drop-shadow sm:text-xl">{tema.chamada}</p>
          </div>
          {encarte?.periodoDe && (
            <div className="mx-auto mt-4 w-fit rounded-xl px-4 py-2 text-center text-sm font-black uppercase" style={{ background: tema.faixa, color: tema.faixaTexto }}>
              Ofertas válidas de {formatData(encarte.periodoDe)} a {formatData(encarte.periodoAte)}
              <span className="block text-[11px] font-bold normal-case">ou enquanto durarem os estoques</span>
            </div>
          )}
        </div>
      </header>

      {setoresPresentes.length > 1 && (
        <nav className="sticky top-0 z-20 border-b-2 border-navy/10 bg-white/95 backdrop-blur" aria-label="Seções do mercado">
          <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3">
            <button
              type="button"
              onClick={() => setSetorFiltro('todos')}
              className={`shrink-0 rounded-full border-2 px-4 py-2 text-sm font-black ${setorFiltro === 'todos' ? 'border-navy bg-navy text-white' : 'border-navy/20 bg-white text-navy'}`}
            >
              Todas ({itens.length})
            </button>
            {setoresPresentes.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSetorFiltro(s.id)}
                className="shrink-0 rounded-full border-2 px-4 py-2 text-sm font-black"
                style={setorFiltro === s.id ? { background: s.cor, borderColor: s.cor, color: '#fff' } : { borderColor: `${s.cor}66`, color: s.corTag, background: '#fff' }}
              >
                {s.nome}
              </button>
            ))}
          </div>
        </nav>
      )}

      <main className="mx-auto max-w-6xl px-4 py-5">
        {carregando ? (
          <p className="py-20 text-center text-lg font-bold text-white">Carregando ofertas…</p>
        ) : !itens.length ? (
          <div className="rounded-3xl bg-white px-4 py-16 text-center">
            <Icon name="Newspaper" size={48} className="mx-auto text-navy" />
            <p className="mt-3 text-xl font-black text-navy">Nenhuma oferta publicada ainda.</p>
            <p className="mt-1 text-base text-ink-soft">Assim que o mercado publicar, as ofertas aparecem aqui.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {grupos.map((g) => (
              <section key={g.setor.id} aria-labelledby={`sec-${g.setor.id}`}>
                <h2 id={`sec-${g.setor.id}`} className="mb-3 flex items-center gap-2 rounded-xl px-4 py-2.5 text-lg font-black uppercase tracking-wide text-white" style={{ background: g.setor.cor }}>
                  <Icon name={g.setor.icone} size={22} /> {g.setor.nome}
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {g.itens.map((p) => <CartaoProduto key={p.id} produto={p} onAbrir={setAberto} tema={tema} />)}
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

      <PreviewProduto produto={aberto} onFechar={() => setAberto(null)} tema={tema} />
    </div>
  )
}
