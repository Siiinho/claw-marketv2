import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/StoreContext'
import { Icon, StatusBadge, ProdutoThumb, Botao, PrecoVarejo, inputCls, Secao, Campo } from '../components/ui'
import { setorById, formatBRL, formatData, statusValidade, diasParaVencer, regraDoProduto, percentDesc, labelDias, dataISOmaisDias, plural } from '../lib/utils'
import EstrelaMercado from '../components/EstrelaMercado'
import CadastroProdutoNovo from '../components/CadastroProdutoNovo'
import FotoGoogle from '../components/FotoGoogle'
import SugestoesNome from '../components/SugestoesNome'
import SugestaoPreco from '../components/SugestaoPreco'
import { ehBuscaPorNome, useBuscaNome } from '../lib/useBuscaNome'

const CHAVE_ESTRELA = 'clawmarket.scanner.estrela'
function lerEstrela() {
  try { return localStorage.getItem(CHAVE_ESTRELA) === '1' } catch { return false }
}
import { buscarProdutoBengala } from '../lib/catalogoBengala'
import { useLeitorCamera } from '../lib/useLeitorCamera'
import { buscarImagemProduto, buscarProdutoAutomatizado, imagemProdutoPrecisaTratamento, prepararProdutoParaJornal } from '../lib/produtoApi'

export default function Scanner() {
  const navigate = useNavigate()
  const {
    produtos,
    salvarProduto,
    salvarProdutoNaFila,
    registrarLote,
    removerDaFila,
    ofertaDoProduto,
    config,
    toast,
  } = useStore()
  const [codigo, setCodigo] = useState('')
  const [codigoNovo, setCodigoNovo] = useState('') // código bipado que não existe em lugar nenhum
  const [nomeNovo, setNomeNovo] = useState('') // nome digitado que não existe
  const [resultado, setResultado] = useState(undefined) // undefined | null | produto
  const [validadeLote, setValidadeLote] = useState('')
  const [codigoLote, setCodigoLote] = useState('')
  const [quantidadeLote, setQuantidadeLote] = useState('1')
  const [novoEstoque, setNovoEstoque] = useState('')
  const [veredito, setVeredito] = useState(null) // { tipo:'jornal'|'ok', desconto, precoNovo, dias }
  const [historico, setHistorico] = useState([]) // sessão de bipes
  // Estrela do Mercado Encarte: fica ligada entre um bipe e outro.
  const [estrela, setEstrelaEstado] = useState(lerEstrela)
  const setEstrela = (valor) => {
    setEstrelaEstado(valor)
    try { localStorage.setItem(CHAVE_ESTRELA, valor ? '1' : '0') } catch { /* sem armazenamento */ }
  }
  const [buscando, setBuscando] = useState(false)
  const inputRef = useRef(null)
  const buscaNome = useBuscaNome(codigo, produtos)
  const { porNome, sugestoes, procurandoNome, destaque, setDestaque } = buscaNome
  const [abrindo, setAbrindo] = useState(null) // código escolhido na lista, até o produto abrir

  const escolherSugestao = async (item) => {
    if (buscando) return
    if (!item.codigoBarras) return toast('Esse produto está sem código de barras. Corrija em Produtos.', 'info')
    setAbrindo(item.codigoBarras)
    await buscar(item.codigoBarras)
    setAbrindo(null)
  }

  // `escolher`: Enter pega o item marcado da lista; tocar no botão nunca escolhe por conta própria.
  const buscar = async (cod, { escolher = false } = {}) => {
    const c = (cod ?? codigo).trim()
    if (!c || buscando) return undefined
    if (ehBuscaPorNome(c)) {
      if (sugestoes.length && (escolher || sugestoes.length === 1)) return escolherSugestao(sugestoes[destaque])
      return toast(sugestoes.length ? 'Toque no produto certo da lista.' : procurandoNome ? 'Procurando pelo nome...' : 'Nenhum produto com esse nome. Tente outra palavra ou o código de barras.', 'info')
    }
    // O produto anterior continua na tela, travado, até o novo chegar: nada some e volta.
    setBuscando(true)

    try {
      let p = produtos.find((x) => x.codigoBarras === c)

      if (p && (!p.imagem || imagemProdutoPrecisaTratamento(p))) {
        if (!p.imagem) {
          const automatizado = await buscarProdutoAutomatizado(c, p)
          const foto = automatizado?.foto || await buscarImagemProduto(p, { ignorarBackend: true })
          if (foto?.imagem) {
            p = {
              ...p,
              marca: foto.marca || p.marca || '',
              imagem: foto.imagem,
              imagemOrigem: foto.origem,
              imagemOrigemNome: foto.origemNome,
              imagemOriginal: foto.imagemOriginal,
              imagemFonteUrl: foto.imagemFonteUrl,
              imagemPaginaUrl: foto.imagemPaginaUrl,
              imagemCorrespondencia: foto.correspondencia,
              imagemAltaResolucao: Boolean(foto.imagemAltaResolucao),
              imagemIlustrativa: Boolean(foto.imagemIlustrativa),
              imagemTratada: Boolean(foto.imagemTratada),
              imagemTratamento: foto.imagemTratamento,
              imagemCachePermanente: Boolean(foto.imagemCachePermanente),
              imagemSalvaEm: foto.imagemSalvaEm,
            }
          }
        } else {
          p = await prepararProdutoParaJornal(p)
        }
        salvarProduto(p)
      }

      if (!p) {
        const catalogoLocal = await buscarProdutoBengala(c)
        // com a foto do banco de imagens do mercado, não gasta crédito buscando foto fora
        const fotoLocal = catalogoLocal?.imagem ? { imagem: catalogoLocal.imagem, origem: 'catalogo', origemNome: catalogoLocal.imagemOrigemNome, imagemAprovada: true } : null
        const automatizado = fotoLocal ? null : await buscarProdutoAutomatizado(c, catalogoLocal)
        const catalogo = automatizado?.produto || catalogoLocal
        if (catalogo) {
          const foto = fotoLocal || automatizado?.foto || await buscarImagemProduto(catalogo, { ignorarBackend: true })
          p = {
            ...catalogo,
            id: `mercadologia-${catalogo.codigoInterno}`,
            loja: 'loja3',
            marca: foto?.marca || '',
            imagem: foto?.imagem || null,
            imagemOrigem: foto?.origem || null,
            imagemOrigemNome: foto?.origemNome || null,
            imagemOriginal: foto?.imagemOriginal || null,
            imagemFonteUrl: foto?.imagemFonteUrl || null,
            imagemPaginaUrl: foto?.imagemPaginaUrl || null,
            imagemLargura: foto?.imagemLargura || null,
            imagemAltura: foto?.imagemAltura || null,
            imagemAprovada: Boolean(foto?.imagemAprovada),
            imagemCorrespondencia: foto?.correspondencia || null,
            imagemAltaResolucao: Boolean(foto?.imagemAltaResolucao),
            imagemIlustrativa: Boolean(foto?.imagemIlustrativa),
            imagemTratada: Boolean(foto?.imagemTratada),
            imagemTratamento: foto?.imagemTratamento || null,
            imagemCachePermanente: Boolean(foto?.imagemCachePermanente),
            imagemSalvaEm: foto?.imagemSalvaEm || null,
            validade: '',
            naFila: false,
            origemFila: null,
          }
          salvarProduto(p)
          toast(
            foto?.imagem
              ? `${p.nome}: mercadologia e imagem vinculadas ao código ${p.codigoBarras}.`
              : `${p.nome}: mercadologia vinculada; imagem exata ainda não localizada.`,
            foto?.imagem ? 'sucesso' : 'info'
          )
        }
      }

      setCodigo(c)
      setVeredito(null)
      setNomeNovo('')
      setResultado(p || null)
      setCodigoNovo(p ? '' : c)
      setValidadeLote(p?.validade || '')
      setCodigoLote('')
      setQuantidadeLote('1')
      setNovoEstoque(p ? String(p.estoque) : '')
    } catch (_) {
      setCodigo(c)
      setVeredito(null)
      setResultado(null)
      setCodigoNovo(c)
      toast('Não foi possível consultar o catálogo agora.', 'erro')
    } finally {
      setBuscando(false)
    }
  }

  // ---- o coração do fluxo de gôndola ----
  const confirmarComFeedback = () => {
    try {
      navigator.vibrate?.([80, 40, 120])
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (AudioCtx) {
        const ctx = new AudioCtx()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.frequency.value = 880
        gain.gain.setValueAtTime(0.04, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.16)
      }
    } catch (_) {}
  }

  // O preço do jornal é sempre o que a pessoa escreveu. A validade só sugere.
  const precoEscrito = (p) => Number(p.precoPromo) || (ofertaDoProduto(p.id) ? p.precoNormal * (1 - ofertaDoProduto(p.id).desconto / 100) : Number(p.precoNormal) || 0)
  const usarSugestao = (valor) => {
    salvarProduto({ id: resultado.id, precoPromo: valor })
    setResultado((p) => ({ ...p, precoPromo: valor }))
    setVeredito((v) => (v ? { ...v, precoNovo: valor, desconto: percentDesc(resultado.precoNormal, valor) } : v))
    toast(`${resultado.nome}: preço de oferta ${formatBRL(valor)}.`)
  }

  const verificar = () => {
    if (!resultado || !validadeLote) return toast('Informe a validade do lote.', 'erro')
    if (veredito) return

    const quantidade = Math.max(1, Number(quantidadeLote) || 1)
    const dias = diasParaVencer(validadeLote)
    const regra = regraDoProduto(dias, config?.regrasPreco || [])
    const origemFila = regra ? 'vencimento' : 'scanner'
    const jaEstavaNaFila = Boolean(resultado.naFila)
    const atualizado = {
      ...resultado,
      loja: 'loja3',
      validade: validadeLote,
      estoque: Math.max(Number(resultado.estoque) || 0, quantidade),
      naFila: true,
      origemFila,
      ...(estrela ? { encarteMercadoDia: dataISOmaisDias(0) } : {}),
    }

    salvarProdutoNaFila(atualizado, origemFila)
    registrarLote({
      produtoId: resultado.id,
      loja: 'loja3',
      validade: validadeLote,
      codigoLote: codigoLote.trim(),
      quantidade,
    })

    const v = {
      tipo: 'jornal',
      desconto: percentDesc(resultado.precoNormal, precoEscrito(resultado)),
      precoNovo: precoEscrito(resultado),
      dias,
      jaEstavaNaFila,
    }

    confirmarComFeedback()
    toast(
      jaEstavaNaFila
        ? `${resultado.nome}: validade atualizada; o produto já estava na fila.`
        : `${resultado.nome}: confirmado na fila do jornal.`
    )
    setVeredito(v)
    setResultado(atualizado)
    setHistorico((h) => [
      {
        id: `${resultado.id}-${validadeLote}-${Date.now()}`,
        produtoId: resultado.id,
        nome: resultado.nome,
        imagem: resultado.imagem,
        setor: resultado.setor,
        validade: validadeLote,
        quantidade,
        ...v,
      },
      ...h.filter((item) => item.produtoId !== resultado.id),
    ].slice(0, 20))
  }

  const corrigir = (dados) => setResultado((p) => (p ? { ...p, ...dados } : p))
  const gravarCorrecao = () => {
    const nome = resultado?.nome?.trim()
    const salvo = produtos.find((p) => p.id === resultado?.id)
    if (!salvo) return
    if (!nome) return corrigir({ nome: salvo.nome })
    if (nome === salvo.nome && (resultado.gramagem || '') === (salvo.gramagem || '')) return
    salvarProduto({ id: resultado.id, nome, gramagem: (resultado.gramagem || '').trim() })
    toast('Descrição corrigida.')
  }

  const proximo = () => {
    setResultado(undefined)
    setVeredito(null)
    setCodigo('')
    setValidadeLote('')
    setCodigoLote('')
    setQuantidadeLote('1')
    setNovoEstoque('')
    inputRef.current?.focus()
  }

  const desfazerUltimaConfirmacao = () => {
    if (!resultado || !veredito) return
    removerDaFila(resultado.id)
    setResultado((p) => ({ ...p, naFila: false, origemFila: null }))
    setHistorico((h) => h.filter((item) => item.produtoId !== resultado.id))
    setVeredito(null)
    toast('Confirmação desfeita. Confira os dados e confirme novamente.', 'info')
  }

  const atualizarEstoque = () => {
    salvarProduto({ ...resultado, estoque: Number(novoEstoque) || 0 })
    toast('Estoque atualizado!')
  }

  // ---- câmera ----
  const camera = useLeitorCamera(
    (cod) => { buscar(cod); toast(`Código lido: ${cod}`) },
    (mensagem) => toast(mensagem, 'erro'),
  )
  const scanning = camera.ativo
  const escanearCamera = () => (camera.ativo ? camera.parar() : camera.abrir())


  const naFilaSessao = historico.filter((h) => h.tipo === 'jornal').length

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
    <div className="min-w-0 space-y-4">
      {/* busca */}
      <Secao
        titulo="Bipe o produto"
        descricao="Confira a validade na embalagem e confirme. Ele entra na fila do jornal."
        acao={<Botao variante="contorno" className="px-3" onClick={() => navigate('/jornal')}><Icon name="Newspaper" size={16} /> Ver jornal</Botao>}
      >
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Icon name="ScanLine" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              ref={inputRef}
              autoFocus
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); buscar(undefined, { escolher: true }) }
                else if (e.key === 'ArrowDown' && sugestoes.length) { e.preventDefault(); setDestaque((i) => Math.min(sugestoes.length - 1, i + 1)) }
                else if (e.key === 'ArrowUp' && sugestoes.length) { e.preventDefault(); setDestaque((i) => Math.max(0, i - 1)) }
              }}
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              aria-label="Código de barras ou nome do produto"
              placeholder="Código de barras ou nome"
              className={`${inputCls} min-h-11 pl-9 text-base`}
            />
          </div>
          <Botao onClick={() => buscar()} disabled={buscando} className="min-h-11 px-3 sm:px-4">
            <Icon name={buscando ? 'LoaderCircle' : 'Search'} size={17} className={buscando ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{buscando ? 'Buscando' : 'Buscar'}</span>
          </Botao>
          <Botao variante={scanning ? 'perigo' : 'contorno'} onClick={escanearCamera} aria-label={scanning ? 'Parar a câmera' : 'Ler com a câmera'} className="min-h-11 px-3 sm:px-4">
            <Icon name={scanning ? 'X' : 'Camera'} size={17} />
            <span className="hidden sm:inline">{scanning ? 'Parar' : 'Câmera'}</span>
          </Botao>
        </div>

        {porNome && <SugestoesNome codigo={codigo} busca={buscaNome} onEscolher={escolherSugestao} carregando={abrindo} onCadastrar={(nome) => { setCodigoNovo(''); setNomeNovo(nome); setVeredito(null); setResultado(null); setCodigo('') }} />}

        {buscando && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-cream-200 px-3 py-2 text-sm font-medium text-ink">
            <Icon name="LoaderCircle" size={16} className="animate-spin text-navy" />
            Consultando o catálogo de produtos…
          </div>
        )}

        {scanning && (
          <div className="mt-3 overflow-hidden rounded-xl border border-ink-soft/15 bg-black">
            <video ref={camera.videoRef} className="aspect-video w-full object-cover" muted playsInline autoPlay />
            <div className="flex items-center justify-center gap-2 bg-ink/80 py-1.5 text-xs text-cream">
              <Icon name="ScanLine" size={14} /> Aponte para o código de barras
            </div>
          </div>
        )}

        {produtos.length > 0 && <div className="mt-4">
          <p className="mb-1.5 text-sm font-semibold text-ink">Atalhos da loja</p>
          <div className="flex flex-wrap gap-1.5">
            {produtos.slice(0, 8).map((p) => (
              <button key={p.id} onClick={() => buscar(p.codigoBarras)} title={p.nome} className="num-tab min-h-8 rounded-full border border-ink-soft/20 bg-white px-3 text-xs text-ink hover:border-ink-soft/45">
                {p.codigoBarras}
              </button>
            ))}
          </div>
        </div>}
      </Secao>

      {resultado === null && (
        // Código que não existe em lugar nenhum: passo de cadastro e depois segue para validade e jornal.
        <CadastroProdutoNovo
          key={`${codigoNovo}|${nomeNovo}`}
          inicial={{ codigoBarras: codigoNovo.replace(/\D/g, ''), nome: nomeNovo }}
          toast={toast}
          textoSalvar="Cadastrar e seguir para o jornal"
          onCancelar={() => { setResultado(undefined); setCodigo(''); inputRef.current?.focus() }}
          onSalvar={(novo) => {
            const produto = { ...novo, validade: '', naFila: false, origemFila: null }
            salvarProduto(produto)
            setResultado(produto)
            setValidadeLote('')
            setCodigoLote('')
            setQuantidadeLote('1')
            setNovoEstoque(String(produto.estoque))
            toast(`${produto.nome} cadastrado. Agora informe a validade e confirme no jornal.`)
          }}
        />
      )}

      {/* produto + verificação de validade */}
      {resultado && (
        <div aria-busy={buscando} className={`anim-in card-bengala p-4 md:p-5 ${buscando ? 'pointer-events-none opacity-60' : ''}`}>
          <div className="flex items-center gap-4">
            <ProdutoThumb produto={resultado} size={64} />
            <div className="min-w-0 flex-1">
              <div className="text-lg font-bold leading-snug text-navy">{resultado.nome}</div>
              <div className="text-sm text-ink-soft">{[resultado.marca, setorById(resultado.setor).nome, formatBRL(resultado.precoNormal)].filter(Boolean).join(' · ')}</div>
              <div className="num-tab mt-0.5 text-xs text-ink-soft">
                {resultado.codigoInterno ? `Código interno ${resultado.codigoInterno} · ` : ''}Barras {resultado.codigoBarras}
              </div>
              <div className="mt-1"><StatusBadge validade={resultado.validade} /></div>
              {!resultado.imagem && (
                <div className="mt-1 text-xs font-medium text-[#86590b]">Foto exata ainda não encontrada para este código.</div>
              )}
              {resultado.imagem && resultado.imagemCorrespondencia === 'codigo-exato' && (
                <div className="mt-1 flex items-center gap-1 text-xs font-medium text-success">
                  <Icon name="BadgeCheck" size={13} />
                  Foto exata confirmada pelo código de barras
                  {resultado.imagemAltaResolucao ? ' · alta resolução' : ''}
                </div>
              )}
            </div>
          </div>

          {/* foto ou descrição ruim: resolve aqui mesmo, sem sair do bipe */}
          <details key={resultado.id} className="mt-3 rounded-xl border border-ink-soft/15 bg-white px-3 py-2" open={!resultado.imagem || undefined}>
            <summary className="flex min-h-9 cursor-pointer items-center gap-2 text-sm font-bold text-navy"><Icon name="ImagePlus" size={16} /> {resultado.imagem ? 'Trocar foto ou descrição' : 'Colocar foto do produto'}</summary>
            <div className="mt-2 grid gap-2 pb-1 sm:grid-cols-[1fr_130px]">
              <Campo label="Descrição"><input className={inputCls} value={resultado.nome || ''} onChange={(e) => corrigir({ nome: e.target.value })} onBlur={gravarCorrecao} /></Campo>
              <Campo label="Gramagem"><input className={inputCls} value={resultado.gramagem || ''} onChange={(e) => corrigir({ gramagem: e.target.value })} onBlur={gravarCorrecao} placeholder="350 g" /></Campo>
            </div>
            <FotoGoogle className="mb-2" produto={resultado} toast={toast} salvaNaHora onFoto={(foto) => { salvarProduto({ id: resultado.id, ...foto }); corrigir(foto) }} />
          </details>

          {/* passo-chave: validade do lote visto na gôndola */}
          <div className="mt-4 rounded-xl border border-navy/15 bg-cream p-3.5">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-navy">
              <Icon name="CalendarSearch" size={17} />
              Qual a validade impressa na embalagem?
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_100px]">
              <label>
                <span className="mb-1 block text-sm font-medium text-ink">Validade <span className="text-bengala">*</span></span>
                <input
                  type="date"
                  value={validadeLote}
                  onChange={(e) => setValidadeLote(e.target.value)}
                  onInput={(e) => setValidadeLote(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === 'Enter' && verificar()}
                  className={`${inputCls} py-2.5 text-base`}
                />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium text-ink">Lote (opcional)</span>
                <input value={codigoLote} onChange={(e) => setCodigoLote(e.target.value)} className={`${inputCls} py-2.5`} placeholder="Ex.: L2407" />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium text-ink">Quantidade</span>
                <input type="number" min="1" inputMode="numeric" value={quantidadeLote} onChange={(e) => setQuantidadeLote(e.target.value)} className={`${inputCls} py-2.5`} />
              </label>
            </div>
            <EstrelaMercado ativo={estrela} onChange={setEstrela} className="mt-3 w-full" texto="Estrela: entra também no Mercado Encarte de hoje" />
            <Botao onClick={verificar} disabled={Boolean(veredito)} className="mt-2 min-h-12 w-full justify-center px-5 py-3 text-base">
              <Icon name="Newspaper" size={18} /> {veredito ? 'Produto confirmado na fila' : 'Confirmar e adicionar ao jornal'}
            </Botao>
          </div>

          {veredito && <SugestaoPreco className="mt-3 w-full" precoNormal={resultado.precoNormal} validade={resultado.validade} precoAtual={resultado.precoPromo} onUsar={usarSugestao} />}

          {/* veredito */}
          {veredito?.tipo === 'jornal' && (
            <div className="anim-in mt-3 overflow-hidden rounded-xl bg-bengala text-white">
              <div className="flex items-center gap-3 p-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
                  <Icon name="Newspaper" size={24} />
                </span>
                <div className="flex-1">
                  <div className="text-base font-bold leading-tight">
                    {veredito.jaEstavaNaFila ? 'Validade atualizada na fila' : 'Confirmado na fila do jornal'}
                  </div>
                  <div className="text-sm text-white/85">
                    {labelDias(veredito.dias)}
                    {veredito.desconto > 0 ? ` · ${veredito.desconto}% de desconto` : ' · preço que você cadastrou'}
                  </div>
                </div>
                <div className="text-right">
                  {veredito.desconto > 0 && <div className="text-xs text-white line-through">{formatBRL(resultado.precoNormal)}</div>}
                  <div className="inline-block rotate-[-2deg] rounded-md bg-white px-2 py-0.5">
                    <PrecoVarejo valor={veredito.precoNovo} className="text-2xl" cor="#c42b2b" />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 bg-black/20 px-4 py-2.5 text-xs">
                <span>Já aparece no Jornal de Ofertas.</span>
                <div className="flex gap-1.5">
                  <button onClick={desfazerUltimaConfirmacao} className="min-h-9 rounded-lg bg-white/10 px-3 font-semibold hover:bg-white/20">Desfazer</button>
                  <button onClick={() => navigate('/jornal')} className="min-h-9 rounded-lg bg-white/15 px-3 font-semibold hover:bg-white/25">Ver jornal</button>
                  <button onClick={proximo} className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-white px-3 font-bold text-bengala hover:bg-cream">Bipar próximo <Icon name="ArrowRight" size={14} /></button>
                </div>
              </div>
            </div>
          )}
          {veredito?.tipo === 'ok' && (
            <div className="anim-in mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-[#1c6e48] p-4 text-white">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
                <Icon name="CheckCircle2" size={24} />
              </span>
              <div className="flex-1">
                <div className="text-base font-bold leading-tight">Validade boa, nada a fazer</div>
                <div className="text-sm text-white/85">{labelDias(veredito.dias)} · fora das faixas de desconto</div>
              </div>
              <button onClick={proximo} className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-white px-3 text-xs font-bold text-[#1c6e48] hover:bg-cream">Bipar próximo <Icon name="ArrowRight" size={14} /></button>
            </div>
          )}

          {/* estoque (secundário) */}
          <div className="mt-4 flex items-end gap-2 border-t border-ink-soft/10 pt-3.5">
            <label className="flex-1">
              <span className="mb-1 block text-sm font-medium text-ink">Ajustar estoque (opcional)</span>
              <input type="number" className={inputCls} value={novoEstoque} onChange={(e) => setNovoEstoque(e.target.value)} />
            </label>
            <Botao variante="contorno" onClick={atualizarEstoque}><Icon name="Check" size={15} /> Salvar</Botao>
          </div>
        </div>
      )}

    </div>

      {/* sessão de bipes */}
      <Secao
        titulo="Bipados agora"
        descricao={historico.length ? `${plural(historico.length, 'conferido', 'conferidos')}, ${plural(naFilaSessao, 'foi para o jornal', 'foram para o jornal')}` : 'Os produtos que você conferir aparecem aqui.'}
        corpo="mt-3"
      >
        {historico.length > 0 ? (
          <>
            <ul className="divide-y divide-ink-soft/10">
              {historico.map((h, i) => (
                <li key={i} className="flex items-center gap-3 py-2">
                  <ProdutoThumb produto={h} size={32} />
                  <span className="min-w-0 flex-1 break-words text-sm leading-snug text-ink">{h.nome}</span>
                  {h.tipo === 'jornal' ? (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-bengala/10 px-2 py-0.5 text-xs font-semibold text-bengala">
                      <Icon name="Newspaper" size={12} /> {h.desconto > 0 ? `−${h.desconto}% · ` : ''}{h.quantidade} un.
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-[#1c6e48]">
                      <Icon name="Check" size={12} /> OK
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {naFilaSessao > 0 && (
              <Botao variante="escuro" onClick={() => navigate('/jornal')} className="mt-3 w-full">
                <Icon name="Newspaper" size={16} /> Montar jornal com {plural(naFilaSessao, 'produto', 'produtos')}
              </Botao>
            )}
          </>
        ) : null}
      </Secao>
    </div>
  )
}
