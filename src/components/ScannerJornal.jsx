import { useMemo, useRef, useState } from 'react'
import { useStore } from '../store/StoreContext'
import { buscarProdutoBengala } from '../lib/catalogoBengala'
import { ehBuscaPorNome, useBuscaNome } from '../lib/useBuscaNome'
import { buscarImagemProduto, buscarProdutoAutomatizado } from '../lib/produtoApi'
import { dataISOmaisDias, noMercadoEncarte } from '../lib/utils'
import { useLeitorCamera } from '../lib/useLeitorCamera'
import { Botao, Icon, ProdutoThumb, inputCls } from './ui'
import EstrelaMercado, { BotaoEstrela } from './EstrelaMercado'
import CadastroProdutoNovo from './CadastroProdutoNovo'
import SugestoesNome from './SugestoesNome'

const CHAVE_ESTRELA = 'clawmarket.scanner.estrela'
function lerEstrela() {
  try { return localStorage.getItem(CHAVE_ESTRELA) === '1' } catch { return false }
}

const rascunhoVazio = (codigo = '') => ({
  codigoBarras: codigo,
  nome: '',
  marca: '',
  gramagem: '',
  setor: 'mercearia',
  validade: dataISOmaisDias(7),
  estoque: 1,
  precoNormal: '',
  imagem: null,
})

function codigoLimpo(valor) {
  return String(valor || '').replace(/\D/g, '')
}
// `embutido`: vai dentro de um passo do gerador (sem card, sem título e sem a lista de recentes,
// porque a lista do próprio passo já mostra a fila).
export default function ScannerJornal({ embutido = false } = {}) {
  const {
    produtos,
    fila,
    salvarProduto,
    salvarProdutoNaFila,
    registrarLote,
    removerDaFila,
    toast,
  } = useStore()
  const [codigo, setCodigo] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [rascunho, setRascunho] = useState(null)
  const [expandido, setExpandido] = useState(false)
  const inputRef = useRef(null)
  const busca = useBuscaNome(codigo, produtos)
  const { porNome, sugestoes, procurandoNome, destaque, setDestaque } = busca
  const [abrindo, setAbrindo] = useState(null) // código escolhido na lista, até o produto abrir
  // A estrela fica ligada entre um bipe e outro, para mandar vários produtos seguidos ao Mercado Encarte.
  const [estrela, setEstrelaEstado] = useState(lerEstrela)
  const setEstrela = (valor) => {
    setEstrelaEstado(valor)
    try { localStorage.setItem(CHAVE_ESTRELA, valor ? '1' : '0') } catch { /* sem armazenamento */ }
  }
  const comEstrela = (produto) => (estrela ? { ...produto, encarteMercadoDia: dataISOmaisDias(0) } : produto)
  const alternarEstrela = (produto) => {
    const ligar = !noMercadoEncarte(produto)
    salvarProduto({ id: produto.id, encarteMercadoDia: ligar ? dataISOmaisDias(0) : null })
    toast(ligar ? `${produto.nome} entrou nos estrelados (Mercado Encarte de hoje).` : `${produto.nome} saiu dos estrelados.`, 'info')
  }

  const recentes = useMemo(() => [...fila].sort((a, b) =>
    new Date(b.adicionadoFilaEm || 0).getTime() - new Date(a.adicionadoFilaEm || 0).getTime()
  ), [fila])
  const visiveis = expandido ? recentes : recentes.slice(0, 4)
  const restantes = Math.max(0, recentes.length - 4)

  const adicionarConhecido = (produto) => {
    const jaEstava = Boolean(produto.naFila)
    salvarProdutoNaFila(comEstrela(produto), 'scanner-jornal')
    if (produto.validade) {
      registrarLote({
        produtoId: produto.id,
        loja: produto.loja || 'loja3',
        validade: produto.validade,
        quantidade: Math.max(1, Number(produto.estoque) || 1),
      })
    }
    const extra = estrela ? ' Com estrela no Mercado Encarte.' : ''
    toast(jaEstava ? `${produto.nome} já está na fila do jornal.${extra}` : `${produto.nome} adicionado à fila do jornal!${extra}`, jaEstava ? 'info' : 'sucesso')
    setCodigo('')
    inputRef.current?.focus()
  }

  const escolherSugestao = async (item) => {
    if (item.produto) { adicionarConhecido(item.produto); return }
    if (buscando) return
    setAbrindo(item.codigoBarras)
    await buscar(item.codigoBarras)
    setAbrindo(null)
    setCodigo(item.codigoBarras)
  }

  // `escolher`: Enter no teclado pega o item marcado; tocar no botão nunca escolhe por conta própria.
  const buscar = async (valor = codigo, { escolher = false } = {}) => {
    if (ehBuscaPorNome(valor)) {
      if (sugestoes.length && (escolher || sugestoes.length === 1)) return escolherSugestao(sugestoes[destaque])
      return toast(sugestoes.length ? 'Toque no produto certo da lista.' : procurandoNome ? 'Procurando pelo nome...' : 'Nenhum produto com esse nome. Tente outra palavra ou o código de barras.', 'info')
    }
    const c = codigoLimpo(valor)
    if (!c) return toast('Digite o nome, o código ou escaneie o código de barras.', 'erro')
    if (buscando) return
    setBuscando(true)
    setRascunho(null)
    try {
      const existente = produtos.find((produto) => codigoLimpo(produto.codigoBarras) === c)
      if (existente) {
        adicionarConhecido(existente)
        return
      }

      const local = await buscarProdutoBengala(c)
      // com a foto do banco de imagens do mercado, não gasta crédito buscando foto fora
      const fotoLocal = local?.imagem ? { imagem: local.imagem, origem: 'catalogo', origemNome: local.imagemOrigemNome } : null
      const automatizado = fotoLocal ? null : await buscarProdutoAutomatizado(c, local)
      const base = automatizado?.produto || local
      const foto = fotoLocal || automatizado?.foto || (base ? await buscarImagemProduto(base, { ignorarBackend: true }) : null)
      setRascunho({
        ...rascunhoVazio(c),
        ...(base || {}),
        codigoBarras: c,
        imagem: foto?.imagem || base?.imagem || null,
        imagemOrigem: foto?.origem || null,
        imagemOrigemNome: foto?.origemNome || null,
        imagemOriginal: foto?.imagemOriginal || null,
        imagemFonteUrl: foto?.imagemFonteUrl || null,
        imagemPaginaUrl: foto?.imagemPaginaUrl || null,
        imagemManual: Boolean(foto?.imagemManual),
        imagemTratada: Boolean(foto?.imagemTratada),
        imagemTratamento: foto?.imagemTratamento || null,
        imagemAltaResolucao: foto?.imagemAltaResolucao ?? null,
        imagemCachePermanente: Boolean(foto?.imagemCachePermanente),
      })
      if (!base) toast('Código não cadastrado. Complete os dados abaixo.', 'info')
    } catch (_) {
      setRascunho(rascunhoVazio(c))
      toast('Complete o cadastro para adicionar à fila.', 'info')
    } finally {
      setBuscando(false)
    }
  }

  const confirmarNovo = (novo) => {
    const produto = comEstrela(novo)
    salvarProdutoNaFila(produto, 'scanner-jornal')
    if (produto.validade) registrarLote({ produtoId: produto.id, loja: produto.loja, validade: produto.validade, quantidade: produto.estoque })
    toast(`${produto.nome} cadastrado e adicionado à fila do jornal!${estrela ? ' Com estrela no Mercado Encarte.' : ''}`)
    setRascunho(null)
    setCodigo('')
    inputRef.current?.focus()
  }

  const camera = useLeitorCamera(
    (lido) => { setCodigo(lido); buscar(lido) },
    (mensagem) => toast(mensagem, 'erro'),
  )
  const scanning = camera.ativo
  const abrirCamera = () => (camera.ativo ? camera.parar() : camera.abrir())

  return (
    <section id="scanner-jornal" className={embutido ? 'scroll-mt-4' : 'card-bengala scroll-mt-4 p-4'}>
      {!embutido && (
        <div className="mb-3 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bengala text-white"><Icon name="ScanBarcode" size={21} /></span>
          <div>
            <h3 className="font-bold text-ink">Scanner do Gerador de Jornal</h3>
            <p className="text-xs text-ink-soft">Bipe ou digite sem sair desta tela. Produtos conhecidos entram direto na fila.</p>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Icon name={porNome ? 'Search' : 'Barcode'} size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            ref={inputRef}
            value={codigo}
            onChange={(evento) => setCodigo(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === 'Enter') { evento.preventDefault(); buscar(codigo, { escolher: true }) }
              else if (evento.key === 'ArrowDown' && sugestoes.length) { evento.preventDefault(); setDestaque((i) => Math.min(sugestoes.length - 1, i + 1)) }
              else if (evento.key === 'ArrowUp' && sugestoes.length) { evento.preventDefault(); setDestaque((i) => Math.max(0, i - 1)) }
              else if (evento.key === 'Escape') setCodigo('')
            }}
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            role="combobox"
            aria-expanded={sugestoes.length > 0}
            aria-controls="sugestoes-nome"
            aria-activedescendant={sugestoes.length ? `sugestao-${destaque}` : undefined}
            aria-label="Código de barras ou nome do produto"
            placeholder="Código de barras ou nome"
            className={`${inputCls} pl-9`}
          />
        </div>
        <Botao onClick={() => buscar()} disabled={buscando} className="px-3">
          <Icon name={buscando ? 'LoaderCircle' : 'Search'} size={17} className={buscando ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Adicionar</span>
        </Botao>
        <button type="button" onClick={abrirCamera} aria-label={scanning ? 'Parar câmera' : 'Abrir câmera'} className={`flex min-h-10 shrink-0 items-center justify-center rounded-lg border px-3 ${scanning ? 'border-critical bg-critical text-white' : 'border-ink-soft/25 bg-white text-ink hover:bg-cream-200'}`}>
          <Icon name={scanning ? 'CameraOff' : 'Camera'} size={19} />
        </button>
      </div>

      {porNome && <SugestoesNome codigo={codigo} busca={busca} onEscolher={escolherSugestao} carregando={abrindo} onCadastrar={(nome) => { setRascunho({ ...rascunhoVazio(''), nome }); setCodigo('') }} />}

      <EstrelaMercado ativo={estrela} onChange={setEstrela} className="mt-2 w-full" texto="Estrela ao adicionar: entra também no Mercado Encarte de hoje" />

      {scanning ? (
        <div className="relative mt-3 overflow-hidden rounded-xl bg-black">
          <video ref={camera.videoRef} className="max-h-72 w-full object-cover" muted playsInline autoPlay />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-red-500/80 shadow-[0_0_8px_rgba(255,0,0,.8)]" />
          <div className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-center text-xs font-bold text-white">Aproxime o código de barras até ficar nítido</div>
        </div>
      ) : null}

      {rascunho ? (
        <CadastroProdutoNovo
          key={`${rascunho.codigoBarras}|${rascunho.nome}`}
          inicial={rascunho}
          comLote
          titulo={rascunho.nome ? 'Complete o produto' : 'Produto não encontrado. Cadastre agora'}
          textoSalvar="Confirmar e adicionar ao jornal"
          toast={toast}
          onCancelar={() => { setRascunho(null); inputRef.current?.focus() }}
          onSalvar={confirmarNovo}
        />
      ) : null}

      {!embutido && recentes.length ? (
        <div className="mt-4 border-t border-ink-soft/10 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-ink">Adicionados agora há pouco</span>
            {!expandido && restantes > 0 ? <button onClick={() => setExpandido(true)} className="rounded-full bg-bengala px-2 py-0.5 text-xs font-bold text-white">+{restantes}</button> : null}
            {expandido && recentes.length > 4 ? <button onClick={() => setExpandido(false)} className="text-xs font-bold text-bengala">Mostrar 4</button> : null}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {visiveis.map((produto) => (
              <div key={produto.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-ink-soft/10 bg-white p-2">
                <ProdutoThumb produto={produto} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-ink">{produto.nome}</div>
                  <div className="truncate text-xs text-ink-soft">{[produto.marca, produto.gramagem].filter(Boolean).join(' · ') || 'Na fila do jornal'}</div>
                </div>
                <BotaoEstrela ativo={noMercadoEncarte(produto)} onClick={() => alternarEstrela(produto)} nome={produto.nome} />
                <button onClick={() => { removerDaFila(produto.id); toast(`${produto.nome} removido da fila.`, 'info') }} aria-label={`Remover ${produto.nome} da fila`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-soft/70 hover:bg-critical/10 hover:text-critical"><Icon name="X" size={16} /></button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
