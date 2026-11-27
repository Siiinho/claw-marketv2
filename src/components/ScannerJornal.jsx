import { useRef, useState } from 'react'
import { useStore } from '../store/StoreContext'
import { buscarProdutoBengala } from '../lib/catalogoBengala'
import { ehBuscaPorNome, useBuscaNome } from '../lib/useBuscaNome'
import { buscarImagemProduto, buscarProdutoAutomatizado } from '../lib/produtoApi'
import { naRemessa } from '../lib/remessa'
import { useLeitorCamera } from '../lib/useLeitorCamera'
import { Botao, Icon, inputCls } from './ui'
import CadastroProdutoNovo from './CadastroProdutoNovo'
import SugestoesNome from './SugestoesNome'

const rascunhoVazio = (codigo = '') => ({
  codigoBarras: codigo,
  nome: '',
  marca: '',
  gramagem: '',
  setor: 'mercearia',
  estoque: 1,
  precoNormal: '',
  imagem: null,
})

function codigoLimpo(valor) {
  return String(valor || '').replace(/\D/g, '')
}

// Passo 1 do gerador: bipa, digita o código ou procura pelo nome. O produto entra na remessa do jornal
// que está sendo montado. Validade e vencimento são de outra aba (Conferir validade e Produtos).
export default function ScannerJornal() {
  const { produtos, usuario, salvarProdutoNaFila, toast } = useStore()
  const [codigo, setCodigo] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [rascunho, setRascunho] = useState(null)
  const inputRef = useRef(null)
  const busca = useBuscaNome(codigo, produtos)
  const { porNome, sugestoes, procurandoNome, destaque, setDestaque } = busca
  const [abrindo, setAbrindo] = useState(null) // código escolhido na lista, até o produto abrir

  const adicionar = (produto) => {
    const jaEstava = naRemessa(produto, usuario?.id)
    if (!jaEstava) salvarProdutoNaFila({ ...produto, remessaPor: usuario?.id, remessaEm: new Date().toISOString() }, 'scanner-jornal')
    toast(jaEstava ? `${produto.nome} já está neste jornal.` : `${produto.nome} entrou no jornal.`, jaEstava ? 'info' : 'sucesso')
    setRascunho(null)
    setCodigo('')
    inputRef.current?.focus()
  }

  const escolherSugestao = async (item) => {
    if (item.produto) { adicionar(item.produto); return }
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
        adicionar(existente)
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
      toast('Complete o cadastro para pôr no jornal.', 'info')
    } finally {
      setBuscando(false)
    }
  }

  const camera = useLeitorCamera(
    (lido) => { setCodigo(lido); buscar(lido) },
    (mensagem) => toast(mensagem, 'erro'),
  )
  const scanning = camera.ativo
  const abrirCamera = () => (camera.ativo ? camera.parar() : camera.abrir())

  return (
    <section id="scanner-jornal" className="scroll-mt-4">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Icon name={porNome ? 'Search' : 'Barcode'} size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft" />
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
            placeholder="Código ou nome"
            className={`${inputCls} min-h-14 pl-10 text-base`}
          />
        </div>
        <Botao onClick={() => buscar()} disabled={buscando} className="min-h-14 px-4">
          <Icon name={buscando ? 'LoaderCircle' : 'Search'} size={17} className={buscando ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Adicionar</span>
        </Botao>
        <button type="button" onClick={abrirCamera} aria-label={scanning ? 'Parar câmera' : 'Abrir câmera'} className={`flex min-h-14 shrink-0 items-center justify-center rounded-lg border-2 px-4 ${scanning ? 'border-critical bg-critical text-white' : 'border-navy/40 bg-white text-navy hover:bg-cream'}`}>
          <Icon name={scanning ? 'CameraOff' : 'Camera'} size={19} />
        </button>
      </div>

      {porNome && <SugestoesNome codigo={codigo} busca={busca} onEscolher={escolherSugestao} carregando={abrindo} onCadastrar={(nome) => { setRascunho({ ...rascunhoVazio(''), nome }); setCodigo('') }} />}

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
          titulo={rascunho.nome ? 'Complete o produto' : 'Produto não encontrado. Cadastre agora'}
          textoSalvar="Cadastrar e pôr no jornal"
          toast={toast}
          onCancelar={() => { setRascunho(null); inputRef.current?.focus() }}
          onSalvar={adicionar}
        />
      ) : null}
    </section>
  )
}
