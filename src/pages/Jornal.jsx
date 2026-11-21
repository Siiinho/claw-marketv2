import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/StoreContext'
import { Icon, ProdutoThumb, EmptyState, Botao, Campo, inputCls, Pill, Modal } from '../components/ui'
import ScannerJornal from '../components/ScannerJornal'
import CentralArtes from '../components/CentralArtes'
import {
  SETORES, setorById, formatBRL, MERCADO_ENCARTE, noMercadoEncarte,
  percentDesc, dataISOmaisDias, SELOS_OFERTA,
} from '../lib/utils'
import { publicarEncarte, lerEncartePublicado, lerFundoTemplate, salvarFundoTemplate, prepararFundoTemplate, enviarEncarteAoSite, statusSiteEncarte, linkDoEncarte, lerSenhaPublicacao, salvarSenhaPublicacao } from '../lib/encartePublico'
import SeletorTema from '../components/SeletorTema'
import SeloArte from '../components/SeloArte'
import EditorCelula from '../components/EditorCelula'
import { Escalado } from '../components/PaginaTemplate'
import { PaginaEncarte, paginarEncarte, tamanhoPagina, itensDaPagina, ehFormatoJornal } from '../components/JornalMercado'
import { temaCampanhaById, temasDoSetor, caminhoArte } from '../lib/temasCampanha'
import { abrirJanelaPrevisualizacao, previsualizarImpressaoPaginas } from '../lib/exportar'
import { imagemProdutoPrecisaTratamento, prepararProdutoParaJornal } from '../lib/produtoApi'

function imagemCompativelComPDF(src) {
  if (!src || typeof src !== 'string') return false
  if (src.startsWith('data:') || src.startsWith('blob:')) return true
  try {
    return new URL(src, window.location.href).origin === window.location.origin
  } catch {
    return false
  }
}

// Jornal salvo no histórico: reabre no encarte novo, com os preços daquele dia.
function paginasDoHistorico(jornal) {
  const itens = (jornal?.produtos || []).map((p) => ({
    ...p,
    precoJornal: p.precoJornalCalculado ?? p.precoPromo ?? p.precoNormal,
    descontoJornal: p.descontoJornalCalculado ?? 0,
  }))
  return paginarEncarte(itens, jornal?.layoutArte || 'grade')
}

// Escolhas do painel (jornal aberto e template de cada jornal) guardadas neste aparelho,
// para não se perderem ao recarregar antes de publicar.
// Próximos 7 dias para escolher o dia da oferta no Mercado Encarte.
const NOMES_DIA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const rotuloDia = (iso) => {
  const [a, m, d] = String(iso).split('-').map(Number)
  return `${NOMES_DIA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
}

const CHAVE_RASCUNHO = 'clawmarket:jornal-rascunho:v1'
function lerRascunho() {
  try { return JSON.parse(localStorage.getItem(CHAVE_RASCUNHO) || '{}') || {} } catch (_) { return {} }
}
function salvarRascunho(dados) {
  try { localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(dados)) } catch (_) { /* sem espaço: segue sem guardar */ }
}

export default function Jornal() {
  const navigate = useNavigate()
  const store = useStore()
  const { fila, config, jornais, ofertaDoProduto, salvarProduto, salvarJornal, excluirJornal, removerDaFila, toast } = store
  const [aba, setAba] = useState('gerar')

  // ---- config de geração ----
  // Jornal aberto no painel: 'geral' (todos os produtos) ou o id de um setor (só os dele).
  const [jornalSel, setJornalSel] = useState(() => lerRascunho().jornal || 'geral')
  const ehSetor = jornalSel !== 'geral'
  const ehMercado = jornalSel === MERCADO_ENCARTE.id
  const [titulo, setTitulo] = useState('Jornal de Ofertas - Bengala Supermercado')
  const [excluidos, setExcluidos] = useState(() => new Set())
  const [exportando, setExportando] = useState(false)
  const [pdfPronto, setPdfPronto] = useState(null)
  const [mostrarRevisao, setMostrarRevisao] = useState(false)
  const pageRefs = useRef([])
  const historicoRefs = useRef([])
  const revisaoRef = useRef(null)
  const ref = useRef(null)
  const [historicoParaAbrir, setHistoricoParaAbrir] = useState(null)
  const [produtoEditandoGerador, setProdutoEditandoGerador] = useState(null)
  const [seloEditando, setSeloEditando] = useState(null)
  // Preço editado no mesmo painel do selo (toque no produto da prévia).
  const [precoEditando, setPrecoEditando] = useState({ normal: '', promo: '' })
  const [ajusteEditando, setAjusteEditando] = useState(null)
  const abrirProdutoDaPrevia = (produto) => {
    const atual = fila.find((f) => f.id === produto.id) || produto
    setPrecoEditando({ normal: atual.precoNormal ?? '', promo: atual.precoPromo ?? '' })
    setAjusteEditando(atual.ajusteArte || null)
    setSeloEditando(atual)
  }
  // Período da campanha: definido pelo operador, nunca calculado pela validade dos produtos.
  const [periodoDe, setPeriodoDe] = useState(() => dataISOmaisDias(0))
  const [periodoAte, setPeriodoAte] = useState(() => dataISOmaisDias(6))
  const [publicadoEm, setPublicadoEm] = useState(() => lerEncartePublicado()?.publicadoEm || null)
  const [temaDigital, setTemaDigital] = useState(() => lerRascunho().tema || lerEncartePublicado()?.tema || 'ofertao')
  const [layoutDigital, setLayoutDigital] = useState(() => lerEncartePublicado()?.layout || 'grade')
  // Tamanho do logo no jornal (0,4 a 1,3) e o template de cada setor (jornal de cada setor).
  const [escalaLogo, setEscalaLogo] = useState(() => Number(lerEncartePublicado()?.escalaLogo) || 1)
  const [temasSetor, setTemasSetor] = useState(() => ({ ...(lerEncartePublicado()?.temasSetor || {}), ...(lerRascunho().temasSetor || {}) }))
  const temaDoSetor = (id) => temasSetor[id] || temasDoSetor(id)[0]?.id || 'mercado'
  // Template do jornal aberto. Trocar aqui muda só este jornal; os outros continuam como estão.
  const temaAtualId = ehSetor ? temaDoSetor(jornalSel) : temaDigital
  const escolherTema = (id) => {
    if (ehSetor) setTemasSetor((atual) => ({ ...atual, [jornalSel]: id }))
    else setTemaDigital(id)
  }
  useEffect(() => { salvarRascunho({ jornal: jornalSel, tema: temaDigital, temasSetor }) }, [jornalSel, temaDigital, temasSetor])
  const [publicando, setPublicando] = useState(false)
  const [site, setSite] = useState({ online: null, protegido: false, erro: null })
  const [senhaPublicacao, setSenhaPublicacao] = useState(lerSenhaPublicacao)
  useEffect(() => {
    let ativo = true
    statusSiteEncarte().then((st) => { if (ativo) setSite((s) => ({ ...s, ...st })) })
    return () => { ativo = false }
  }, [])
  const linkEncarte = linkDoEncarte(site.enderecos)
  const [linkCopiado, setLinkCopiado] = useState(false)
  const copiarLink = async () => {
    try { await navigator.clipboard.writeText(linkEncarte); setLinkCopiado(true); setTimeout(() => setLinkCopiado(false), 2500) } catch (_) { window.prompt('Copie o link da tag NFC:', linkEncarte) }
  }
  const [fundoDigital, setFundoDigital] = useState(null)
  useEffect(() => { setFundoDigital(lerFundoTemplate(temaAtualId)) }, [temaAtualId])
  const trocarFundo = async (arquivo) => {
    if (!arquivo) return
    try {
      const dataUrl = await prepararFundoTemplate(arquivo)
      if (!salvarFundoTemplate(temaAtualId, dataUrl)) return toast('Imagem grande demais para guardar neste aparelho.', 'erro')
      setFundoDigital(dataUrl)
      toast('Fundo do template salvo para este tema.')
    } catch (erro) {
      toast(erro.message, 'erro')
    }
  }

  // Garante que nenhuma fotografia crua de celular chegue à arte final.
  // Cada foto é tentada uma vez por sessão: sem isso, uma foto que não vira packshot era salva
  // de novo a cada renderização (laço infinito que enchia o histórico e travava o envio à nuvem).
  const fotosTentadas = useRef(new Set())
  useEffect(() => {
    let ativo = true
    const chaveFoto = (p) => `${p.id}|${String(p.imagem || '').slice(-64)}|${p.imagemFonteUrl || ''}`
    const pendentes = fila.filter((p) => imagemProdutoPrecisaTratamento(p) && !fotosTentadas.current.has(chaveFoto(p)))
    if (!pendentes.length) return () => { ativo = false }
    ;(async () => {
      for (const produto of pendentes) {
        fotosTentadas.current.add(chaveFoto(produto))
        const preparado = await prepararProdutoParaJornal(produto)
        if (!ativo) return
        const mudou = preparado !== produto && (preparado.imagem !== produto.imagem || preparado.imagemTratamento !== produto.imagemTratamento || preparado.imagemFonteUrl !== produto.imagemFonteUrl)
        if (preparado.imagemTratada && mudou) salvarProduto(preparado)
      }
    })()
    return () => { ativo = false }
  }, [fila, salvarProduto])

  useEffect(() => {
    if (!historicoParaAbrir) return
    let ativo = true
    const timer = requestAnimationFrame(async () => {
      try {
        const paginas = historicoRefs.current.slice(0, paginasDoHistorico(historicoParaAbrir.jornal).length)
        await previsualizarImpressaoPaginas(paginas, historicoParaAbrir.jornal.titulo, historicoParaAbrir.janela)
      } catch (erro) {
        if (ativo) toast(erro?.message || 'Não foi possível abrir o jornal salvo.', 'erro')
      } finally {
        if (ativo) setHistoricoParaAbrir(null)
      }
    })
    return () => { ativo = false; cancelAnimationFrame(timer) }
  }, [historicoParaAbrir, toast])

  // ---- preço para o jornal ----
  const precoJornal = (p) => {
    // O preço da oferta digitado no produto (ex.: pela prévia) vale mais que a oferta automática.
    if (p.precoPromo) return p.precoPromo
    const o = ofertaDoProduto(p.id)
    if (o) return p.precoNormal * (1 - o.desconto / 100)
    if (p.origemFila === 'vencimento') return p.precoNormal * (1 - (config.descontoPadrao || 30) / 100)
    return p.precoNormal
  }
  const descJornal = (p) => percentDesc(p.precoNormal, precoJornal(p))

  const incluir = (id) => !excluidos.has(id)
  const toggleIncluir = (id) =>
    setExcluidos((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  // ---- montagem do conteúdo ----
  const ativos = fila.filter((p) => incluir(p.id))
  const ativosDoModelo = ehMercado ? ativos.filter((p) => noMercadoEncarte(p)) : ehSetor ? ativos.filter((p) => p.setor === jornalSel) : ativos
  const vencimento = ativosDoModelo.filter((p) => p.origemFila === 'vencimento')
  const regulares = ativosDoModelo.filter((p) => p.origemFila !== 'vencimento')

  // Ordem do encarte: ofertas internas primeiro, depois por setor (ordem de SETORES).
  const ordemSetor = (p) => Math.max(0, SETORES.findIndex((s) => s.id === p.setor))
  const itensJornal = [
    ...vencimento,
    ...[...regulares].sort((a, b) => ordemSetor(a) - ordemSetor(b)),
  ]
  const itensArte = itensJornal.map((p) => ({ ...p, precoJornal: precoJornal(p), descontoJornal: descJornal(p) }))
  // O Mercado Encarte sai sempre no formato jornal da semana (um bloco por dia).
  const layoutAtual = ehMercado ? 'jornal' : layoutDigital
  const paginasJornal = paginarEncarte(itensArte, layoutAtual)
  const tamanho = tamanhoPagina(layoutAtual)
  const temaArte = temaCampanhaById(temaAtualId)
  const nomeJornal = ehMercado ? MERCADO_ENCARTE.nome : ehSetor ? setorById(jornalSel).nome : 'Geral'
  const contagemSetor = (id) => ativos.filter((p) => p.setor === id).length
  // No Mercado Encarte a lista mostra a fila toda, para escolher na estrela o que entra hoje.
  const filaDoPainel = ehSetor && !ehMercado ? fila.filter((p) => p.setor === jornalSel) : fila
  const totalMercado = ativos.filter((p) => noMercadoEncarte(p)).length
  const diaDoMercado = (produto, dia) => {
    salvarProduto({ id: produto.id, encarteMercadoDia: dia })
    toast(dia ? `${produto.nome}: oferta de ${rotuloDia(dia)} no Mercado Encarte.` : `${produto.nome} saiu do Mercado Encarte.`)
  }
  const alternarMercado = (produto) => diaDoMercado(produto, noMercadoEncarte(produto) ? null : dataISOmaisDias(0))
  // Segunda lista: os produtos com estrela ficam separados da fila normal.
  const estreladosPainel = filaDoPainel.filter((p) => noMercadoEncarte(p))
    .sort((a, b) => String(a.encarteMercadoDia).localeCompare(String(b.encarteMercadoDia)))
  const outrosPainel = filaDoPainel.filter((p) => !noMercadoEncarte(p))
  const linhaPainel = (p) => {
    const setorP = setorById(p.setor)
    const estrelado = noMercadoEncarte(p)
    return (
      <div key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-cream-200">
        <input type="checkbox" checked={incluir(p.id)} onChange={() => toggleIncluir(p.id)} aria-label={`Incluir ${p.nome}`} className="h-4 w-4 shrink-0 accent-bengala" />
        <ProdutoThumb produto={p} size={28} />
        <span className="min-w-0 flex-1">
          <span className="block whitespace-normal break-words text-sm leading-snug text-ink">{p.nome}</span>
          <span className="block text-[11px] font-bold" style={{ color: setorP.corTag || setorP.cor }}>
            {(!ehSetor || ehMercado) ? setorP.nome : null}
            {estrelado ? <span className={`${(!ehSetor || ehMercado) ? 'ml-1 ' : ''}rounded bg-[#c1121f] px-1 text-white`}>{rotuloDia(p.encarteMercadoDia)}</span> : null}
          </span>
        </span>
        {p.origemFila === 'vencimento' && <Pill cor="#d9641f" bg="#f47b361a">interna</Pill>}
        <button type="button" onClick={() => alternarMercado(p)} aria-pressed={estrelado} aria-label={`${estrelado ? 'Tirar a estrela de' : 'Dar estrela para'} ${p.nome}`} title="Estrela: Mercado Encarte (oferta de hoje)"
          className={`shrink-0 rounded-lg p-1.5 ${estrelado ? 'bg-[#c1121f] text-[#ffd60a]' : 'text-ink-soft/60 hover:bg-[#c1121f]/10 hover:text-[#c1121f]'}`}>
          <Icon name="Star" size={15} fill={estrelado ? '#ffd60a' : 'none'} />
        </button>
        <button onClick={() => setProdutoEditandoGerador({ ...p })} aria-label={`Editar ${p.nome}`} className="shrink-0 rounded p-1.5 text-info hover:bg-info/10"><Icon name="Pencil" size={15} /></button>
      </div>
    )
  }
  const proximosDias = Array.from({ length: 7 }, (_, i) => dataISOmaisDias(i))
  // O site do cliente sempre recebe todos os produtos; cada setor vira uma aba com o template dele.
  const ordenarParaJornal = (lista) => [
    ...lista.filter((p) => p.origemFila === 'vencimento'),
    ...lista.filter((p) => p.origemFila !== 'vencimento').sort((a, b) => ordemSetor(a) - ordemSetor(b)),
  ].map((p) => ({ ...p, precoJornal: precoJornal(p), descontoJornal: descJornal(p) }))
  const bandas = []
  const validadeDe = periodoDe
  const validadeAte = periodoAte && periodoAte >= periodoDe ? periodoAte : periodoDe
  const codigosRepetidos = new Set(
    itensJornal
      .map((p) => p.codigoBarras)
      .filter((codigo, indice, lista) => codigo && lista.indexOf(codigo) !== indice)
  )
  const problemasPDF = [
    ...itensJornal.filter((p) => !p.nome?.trim()).map(() => ({ nivel: 'erro', texto: 'Existe um produto sem nome.' })),
    ...itensJornal.filter((p) => !(Number(p.precoNormal) > 0)).map((p) => ({ nivel: 'erro', texto: `${p.nome}: informe um preço válido.` })),
    ...itensJornal.filter((p) => !p.imagem).map((p) => ({ nivel: 'aviso', texto: `${p.nome}: será publicado sem imagem.` })),
    ...itensJornal.filter((p) => p.imagem && !imagemCompativelComPDF(p.imagem)).map((p) => ({ nivel: 'aviso', texto: `${p.nome}: a imagem pode não aparecer na impressão.` })),
    ...itensJornal.filter((p) => p.imagem && imagemProdutoPrecisaTratamento(p)).map((p) => ({ nivel: 'aviso', texto: `${p.nome}: imagem ainda não foi padronizada; a exportação está liberada.` })),
    ...itensJornal.filter((p) => p.imagem && p.imagemAltaResolucao === false).map((p) => ({ nivel: 'aviso', texto: `${p.nome}: imagem com resolução baixa; a exportação está liberada.` })),
    ...[...codigosRepetidos].map((codigo) => ({ nivel: 'aviso', texto: `Código ${codigo} aparece mais de uma vez no jornal.` })),
  ]
  const bloqueiosPDF = problemasPDF.filter((p) => p.nivel === 'erro')


  const criarSnapshot = () => ({
    titulo,
    tipo: ehSetor ? 'setor' : 'geral',
    setor: ehSetor ? jornalSel : null,
    validadeDe,
    validadeAte,
    totalItens: itensJornal.length,
    totalPaginas: paginasJornal.length,
    temaArte: temaAtualId,
    escalaLogo,
    layoutArte: layoutAtual,
    fundoArte: fundoDigital,
    produtos: itensJornal.map((produto) => ({
      ...produto,
      precoJornalCalculado: precoJornal(produto),
      descontoJornalCalculado: descJornal(produto),
    })),
  })

  const exportar = async () => {
    setMostrarRevisao(true)
    if (bloqueiosPDF.length) {
      requestAnimationFrame(() => revisaoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
      const primeiraPendencia = bloqueiosPDF[0].texto
      toast(`PDF não gerado: ${primeiraPendencia} Corrija ou retire o produto da fila.`, 'erro')
      return
    }
    setExportando(true)
    setPdfPronto(null)
    let janela
    try {
      janela = abrirJanelaPrevisualizacao(titulo)
      salvarJornal(criarSnapshot())
      await previsualizarImpressaoPaginas(pageRefs.current.slice(0, paginasJornal.length), titulo, janela)
      setPdfPronto({ titulo, paginas: paginasJornal.length })
      toast('Pré-visualização aberta. Use Imprimir ou Salvar como PDF.')
    } catch (e) {
      console.error('Erro ao exportar o jornal:', e)
      toast(e?.message || 'Não foi possível exportar o PDF. Recarregue a página e tente novamente.', 'erro')
    } finally {
      setExportando(false)
    }
  }

  const lojaAtual = (store.lojas || []).find((l) => l.id === store.lojaAtiva) || (store.lojas || [])[0]
  const itensParaArte = () => itensArte
  // O Mercado Encarte vale do primeiro ao último dia marcado.
  const diasMercado = ativosDoModelo.map((p) => p.encarteMercadoDia).filter(Boolean).sort()
  const encarteArte = ehMercado && diasMercado.length ? { periodoDe: diasMercado[0], periodoAte: diasMercado[diasMercado.length - 1] } : { periodoDe: validadeDe, periodoAte: validadeAte }
  const salvarPrecoDaPrevia = () => {
    const normal = Number(String(precoEditando.normal).replace(',', '.'))
    const promo = String(precoEditando.promo).trim() ? Number(String(precoEditando.promo).replace(',', '.')) : null
    if (!(normal > 0)) return toast('Informe o preço normal.', 'erro')
    if (promo !== null && !(promo > 0 && promo < normal)) return toast('O preço da oferta precisa ser menor que o normal.', 'erro')
    salvarProduto({ id: seloEditando.id, precoNormal: normal, precoPromo: promo, ajusteArte: ajusteEditando })
    toast(`${seloEditando.nome}: ${promo ? `de ${formatBRL(normal)} por ${formatBRL(promo)}` : formatBRL(normal)}.`)
    setSeloEditando(null)
  }
  const trocarSelo = (produto, seloOferta) => {
    salvarProduto({ id: produto.id, seloOferta })
    const selo = SELOS_OFERTA.find((s) => s.id === seloOferta)
    toast(selo?.nenhum ? `${produto.nome}: sem selo.` : `${produto.nome}: selo "${selo?.texto}".`)
  }

  const publicarDigital = async () => {
    if (!ativos.length) return toast('Adicione ao menos um produto ao jornal.', 'erro')
    const todos = ordenarParaJornal(ativos)
    const setoresDoJornal = [...new Set(todos.map((p) => p.setor).filter(Boolean)), ...(todos.some((p) => noMercadoEncarte(p)) ? [MERCADO_ENCARTE.id] : [])]
    const dados = {
      titulo,
      mercado: config.nomeMercado,
      periodoDe: validadeDe,
      periodoAte: validadeAte,
      tema: temaDigital,
      temasSetor: Object.fromEntries(setoresDoJornal.map((id) => [id, temaDoSetor(id)])),
      // Fundo enviado só vale para o template dele (antes o fundo do Geral ia para todas as abas).
      fundos: Object.fromEntries([temaDigital, ...setoresDoJornal.map(temaDoSetor)]
        .map((id) => [id, lerFundoTemplate(id)]).filter(([, fundo]) => fundo)),
      escalaLogo,
      layout: layoutDigital,
      fundo: lerFundoTemplate(temaDigital),
      loja: lojaAtual,
      itens: todos,
    }
    const publicado = publicarEncarte(dados)
    setPublicadoEm(publicado.publicadoEm)
    setPublicando(true)
    try {
      const r = await enviarEncarteAoSite(dados)
      setSite((s) => ({ ...s, online: true, erro: null, publicadoEm: r.publicadoEm }))
      toast(`Publicado no site: ${r.itens} produtos. Quem estiver com o link aberto já vê a nova versão.`)
    } catch (erro) {
      setSite((s) => ({ ...s, online: erro.codigo !== 'offline', protegido: s.protegido || erro.codigo === 'senha', erro: erro.message }))
      toast(`Salvo só neste aparelho. ${erro.message}`, 'erro')
    } finally {
      setPublicando(false)
    }
  }

  const salvar = () => {
    if (!itensJornal.length) return toast('Adicione ao menos um produto ao jornal.', 'erro')
    salvarJornal(criarSnapshot())
    toast('Jornal salvo no histórico!')
  }

  const abrirJornalSalvo = (jornal) => {
    const janela = abrirJanelaPrevisualizacao(jornal.titulo)
    setHistoricoParaAbrir({ jornal, janela })
  }

  const salvarProdutoGerador = () => {
    if (!produtoEditandoGerador?.nome?.trim()) return toast('Informe o nome do produto.', 'erro')
    if (!(Number(produtoEditandoGerador.precoNormal) > 0)) return toast('Informe um preço válido.', 'erro')
    salvarProduto({
      ...produtoEditandoGerador,
      estoque: Math.max(0, Number(produtoEditandoGerador.estoque) || 0),
      precoNormal: Number(produtoEditandoGerador.precoNormal),
      precoPromo: produtoEditandoGerador.precoPromo ? Number(produtoEditandoGerador.precoPromo) : null,
      naFila: true,
    })
    setProdutoEditandoGerador(null)
    toast('Produto atualizado no jornal!')
  }

  const trocarImagemProdutoGerador = (arquivo) => {
    if (!arquivo) return
    const leitor = new FileReader()
    leitor.onload = () => setProdutoEditandoGerador((produto) => ({
      ...produto,
      imagem: String(leitor.result || ''),
      imagemManual: true,
      imagemTratada: true,
      imagemTratamento: 'imagem-manual-livre-v1',
      imagemAltaResolucao: null,
      imagemOrigem: 'upload-manual',
    }))
    leitor.onerror = () => toast('Não foi possível ler a imagem.', 'erro')
    leitor.readAsDataURL(arquivo)
  }

  const Tab = ({ id, icone, children, badge }) => (
    <button onClick={() => setAba(id)} aria-pressed={aba === id} className={`relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border-2 px-1.5 py-2 text-center text-[11px] font-bold leading-tight transition sm:shrink-0 sm:flex-row sm:gap-2 sm:rounded-none sm:border-0 sm:border-b-2 sm:px-4 sm:py-2.5 sm:text-sm sm:font-medium ${aba === id ? 'border-bengala bg-bengala/5 text-bengala sm:bg-transparent' : 'border-ink-soft/15 bg-white text-ink-soft hover:text-ink sm:border-transparent sm:bg-transparent'}`}>
      <Icon name={icone} size={18} /> <span>{children}</span>
      {badge > 0 && <span className="absolute right-1 top-1 rounded-full bg-coral px-1.5 text-[10px] font-bold text-white sm:static sm:text-xs">{badge}</span>}
    </button>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-bengala text-white">
          <Icon name="Newspaper" size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-ink">Jornal de ofertas</h2>
          <p className="text-sm text-ink-soft">Bipe os produtos. Cada setor tem o seu jornal, e o Geral junta todos.</p>
        </div>
        <Botao onClick={() => document.getElementById('scanner-jornal')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="shrink-0">
          <Icon name="ScanLine" size={17} /> Escanear
        </Botao>
      </div>

      <ScannerJornal />

      <div className="grid grid-cols-2 gap-1.5 sm:flex sm:gap-1 sm:overflow-x-auto sm:border-b sm:border-ink-soft/10">
        <Tab id="gerar" icone="LayoutTemplate">Montar jornais</Tab>
        <Tab id="artes" icone="Images">Baixar artes</Tab>
        <Tab id="fila" icone="ListChecks" badge={fila.length}>Produtos escaneados</Tab>
        <Tab id="historico" icone="History" badge={jornais.length}>Histórico</Tab>
      </div>

      {/* ============ GERAR ============ */}
      {aba === 'gerar' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          {/* controles */}
          <div className="min-w-0 space-y-4">
            <div className="card-bengala p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">1. Qual jornal você vai montar?</p>
              <button type="button" onClick={() => setJornalSel(MERCADO_ENCARTE.id)} aria-pressed={ehMercado}
                className={`mb-1.5 flex w-full items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-left text-sm font-black ${ehMercado ? 'border-[#c1121f] text-white' : 'border-[#c1121f]/40 bg-white text-[#c1121f]'}`}
                style={ehMercado ? { background: 'linear-gradient(120deg,#c1121f,#fb5607)' } : undefined}>
                <Icon name="Star" size={18} fill={ehMercado ? '#ffd60a' : 'none'} />
                <span className="min-w-0 flex-1">Mercado Encarte <span className={`block text-[11px] font-bold ${ehMercado ? 'text-white/85' : 'text-ink-soft'}`}>Ofertas da semana, dia a dia, no formato do jornal</span></span>
                <span className="text-xs font-bold opacity-80">{totalMercado} {totalMercado === 1 ? 'produto' : 'produtos'}</span>
              </button>
              <button type="button" onClick={() => setJornalSel('geral')} aria-pressed={!ehSetor}
                className={`flex w-full items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-left text-sm font-black ${!ehSetor ? 'border-navy bg-navy text-white' : 'border-navy/20 bg-white text-navy'}`}>
                <Icon name="Store" size={18} />
                <span className="flex-1">Jornal geral</span>
                <span className="text-xs font-bold opacity-80">{ativos.length} {ativos.length === 1 ? 'produto' : 'produtos'}</span>
              </button>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {SETORES.map((s) => {
                  const n = contagemSetor(s.id)
                  const ativo = jornalSel === s.id
                  return (
                    <button key={s.id} type="button" onClick={() => setJornalSel(s.id)} aria-pressed={ativo}
                      className={`flex min-w-0 items-center gap-1.5 rounded-lg border-2 px-2 py-2 text-left text-xs font-bold ${n ? '' : 'opacity-55'}`}
                      style={ativo ? { background: s.cor, borderColor: s.cor, color: '#fff' } : { borderColor: `${s.cor}55`, color: s.corTag || s.cor, background: '#fff' }}>
                      <Icon name={s.icone} size={15} />
                      <span className="min-w-0 flex-1 truncate">{s.nome}</span>
                      <span className="shrink-0 tabular-nums">{n}</span>
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-[11px] leading-snug text-ink-soft">No site do cliente aparece a aba especial Mercado Encarte (quando tiver oferta de hoje), a aba Geral e uma aba para cada setor com produto, cada uma com o template dela.</p>
            </div>

            <div className="card-bengala p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">2. Template do jornal {nomeJornal}</p>
              <p className="mb-2 mt-0.5 text-[11px] text-ink-soft">Muda só este jornal. Os outros continuam com o template deles.</p>
              {ehSetor ? (
                <>
                  <div className="grid grid-cols-2 gap-1.5">
                    {temasDoSetor(jornalSel).map((t) => {
                      const mini = caminhoArte(t, 'miniatura')
                      const ativo = temaAtualId === t.id
                      return (
                        <button key={t.id} type="button" onClick={() => escolherTema(t.id)} aria-pressed={ativo} title={t.nome}
                          className={`relative flex aspect-[4/3] flex-col overflow-hidden rounded-lg text-left ${ativo ? 'ring-4 ring-offer ring-offset-1' : 'ring-1 ring-black/10'}`}
                          style={{ background: t.fundo }}>
                          {mini ? <img src={mini} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain p-1" /> : (
                            <span className="relative m-auto flex flex-col items-center px-1 text-center text-sm font-black uppercase italic leading-none text-white" style={{ textShadow: '0 2px 0 rgba(0,0,0,.4)' }}>
                              {t.icone ? <Icon name={t.icone} size={22} className="mb-1 opacity-80" /> : null}
                              {t.titulo}<br /><span style={{ color: t.corDestaque }}>{t.destaque}</span>
                            </span>
                          )}
                          <span className="relative mt-auto truncate bg-black/55 px-1.5 py-0.5 text-[11px] font-bold text-white">{t.nome}</span>
                        </button>
                      )
                    })}
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-bold text-bengala">Usar outro template neste setor</summary>
                    <div className="mt-2"><SeletorTema compacto value={temaAtualId} onChange={escolherTema} /></div>
                  </details>
                </>
              ) : (
                <SeletorTema compacto value={temaDigital} onChange={escolherTema} />
              )}
            </div>

            <div className="card-bengala p-3">
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">3. Produtos do jornal {nomeJornal} ({ativosDoModelo.length})</p>
                <button onClick={() => document.getElementById('scanner-jornal')?.scrollIntoView({ behavior: 'smooth' })} className="flex items-center gap-1 text-xs font-bold text-bengala hover:underline">
                  <Icon name="ScanLine" size={13} /> Escanear
                </button>
              </div>
              {filaDoPainel.length === 0 ? (
                <p className="px-1 py-3 text-sm text-ink-soft">{ehMercado ? 'Fila vazia. Bipe os produtos com a estrela ligada, ou toque na estrela dos que entram no Mercado Encarte.' : ehSetor ? `Nenhum produto de ${nomeJornal} na fila. Bipe um produto desse setor ou mude o setor dele no lápis.` : 'Fila vazia. Bipe os produtos acima.'}</p>
              ) : (
                <>
                  <div className="mb-2 overflow-hidden rounded-xl border-2 border-[#c1121f]/40">
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-black uppercase tracking-wide text-white" style={{ background: 'linear-gradient(120deg,#c1121f,#fb5607)' }}>
                      <Icon name="Star" size={14} fill="#ffd60a" className="text-[#ffd60a]" />
                      <span className="flex-1">Só estrelas · Mercado Encarte</span>
                      <span className="tabular-nums">{estreladosPainel.length}</span>
                    </div>
                    {estreladosPainel.length ? (
                      <div className="max-h-56 space-y-1 overflow-y-auto bg-[#c1121f]/5 p-1">{estreladosPainel.map(linhaPainel)}</div>
                    ) : (
                      <p className="bg-[#c1121f]/5 px-2.5 py-2 text-[11px] text-ink-soft">Nenhum produto com estrela. Ligue a estrela no scanner ao bipar, ou toque na estrela de um produto da lista abaixo.</p>
                    )}
                  </div>
                  <div className="mb-1 flex items-center gap-1.5 px-1 text-xs font-black uppercase tracking-wide text-navy">
                    <Icon name="ListChecks" size={14} /> <span className="flex-1">Fila do jornal</span><span className="tabular-nums">{outrosPainel.length}</span>
                  </div>
                  {outrosPainel.length ? (
                    <div className="max-h-72 space-y-1 overflow-y-auto">{outrosPainel.map(linhaPainel)}</div>
                  ) : (
                    <p className="px-1 py-2 text-[11px] text-ink-soft">Todos os produtos daqui estão com estrela.</p>
                  )}
                </>
              )}
              <p className="mt-1 px-1 text-[11px] text-ink-soft">Estrela: o produto vai para a lista Só estrelas e entra no Mercado Encarte (hoje; troque o dia tocando no produto na prévia). Sai sozinho depois do dia. Selo, preço e posição na arte: toque no produto na prévia. Setor errado: use o lápis.</p>
            </div>

            <div className="card-bengala space-y-3 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">4. Ajustes de todos os jornais</p>
              <Campo label="Título"><input className={inputCls} value={titulo} onChange={(e) => setTitulo(e.target.value)} /></Campo>
              <div className="grid grid-cols-2 gap-2">
                <Campo label="Ofertas válidas de"><input type="date" className={inputCls} value={periodoDe} onChange={(e) => setPeriodoDe(e.target.value)} /></Campo>
                <Campo label="até"><input type="date" className={inputCls} value={periodoAte} min={periodoDe} onChange={(e) => setPeriodoAte(e.target.value)} /></Campo>
              </div>
              <p className="px-1 text-[11px] text-ink-soft">A validade dos produtos nunca aparece no encarte.</p>
              <div>
                <div className="text-xs font-bold uppercase text-navy">Layout</div>
                <div className="mt-1 grid grid-cols-2 gap-1.5">
                  {[['grade', 'Grade 3×3 (9 produtos)'], ['destaque', '1 destaque + 7'], ['jornal', 'Jornal da semana (A4, muitos produtos, blocos por dia ou setor)']].map(([id, rotulo]) => (
                    <button key={id} type="button" onClick={() => setLayoutDigital(id)} aria-pressed={layoutDigital === id}
                      className={`rounded-lg border-2 px-2 py-2 text-xs font-black ${id === 'jornal' ? 'col-span-2' : ''} ${layoutDigital === id ? 'border-navy bg-navy text-white' : 'border-navy/20 bg-white text-navy'}`}>
                      {rotulo}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs font-bold uppercase text-navy">
                  <span>Tamanho do logo</span><span>{Math.round(escalaLogo * 100)}%</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <button type="button" onClick={() => setEscalaLogo((v) => Math.max(0.4, Math.round((v - 0.1) * 10) / 10))} aria-label="Diminuir o logo" className="h-9 w-9 shrink-0 rounded-lg border-2 border-navy/20 bg-white text-lg font-black text-navy">−</button>
                  <input type="range" min="0.4" max="1.3" step="0.05" value={escalaLogo} onChange={(e) => setEscalaLogo(Number(e.target.value))} className="w-full accent-bengala" aria-label="Tamanho do logo" />
                  <button type="button" onClick={() => setEscalaLogo((v) => Math.min(1.3, Math.round((v + 0.1) * 10) / 10))} aria-label="Aumentar o logo" className="h-9 w-9 shrink-0 rounded-lg border-2 border-navy/20 bg-white text-lg font-black text-navy">+</button>
                </div>
              </div>
              <details>
                <summary className="cursor-pointer text-xs font-bold text-navy">Fundo próprio para o template {temaArte.nome} (opcional)</summary>
                <p className="mt-1 text-[11px] text-ink-soft">Arte 1080 × 1350 sem produtos, sem logo e sem validade. Vale só para este template.</p>
                <div className="mt-1 flex items-center gap-2">
                  {fundoDigital && <img src={fundoDigital} alt="Fundo do template" className="h-14 w-11 rounded object-cover ring-1 ring-black/10" />}
                  <label className="cursor-pointer rounded-lg border-2 border-navy/20 bg-white px-3 py-2 text-xs font-black text-navy">
                    {fundoDigital ? 'Trocar fundo' : 'Enviar fundo'}
                    <input type="file" accept="image/*" className="sr-only" onChange={(e) => { trocarFundo(e.target.files?.[0]); e.target.value = '' }} />
                  </label>
                  {fundoDigital && (
                    <button type="button" className="text-xs font-bold text-critical" onClick={() => { salvarFundoTemplate(temaAtualId, null); setFundoDigital(null) }}>Remover</button>
                  )}
                </div>
              </details>
            </div>

            <div className="rounded-xl border-2 border-navy bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-black text-navy">
                <Icon name="Smartphone" size={16} /> 5. Publicar no site do cliente (tag NFC)
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                Publica de uma vez o Geral e o jornal de cada setor.{' '}
                {publicadoEm
                  ? `Última publicação: ${new Date(publicadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.`
                  : 'Ainda não publicado.'}
              </p>
              {site.protegido && (
                <label className="mt-3 block">
                  <span className="text-xs font-bold uppercase text-navy">Senha de publicação</span>
                  <input type="password" autoComplete="current-password" className={inputCls} value={senhaPublicacao}
                    onChange={(e) => { setSenhaPublicacao(e.target.value); salvarSenhaPublicacao(e.target.value) }} />
                </label>
              )}
              <div className={`mt-2 rounded-lg px-2 py-1.5 text-[11px] font-bold ${site.erro ? 'bg-critical/10 text-critical' : site.online ? 'bg-success/10 text-navy' : 'bg-navy/5 text-ink-soft'}`} role="status">
                {site.erro
                  ? site.erro
                  : site.online
                    ? (
                      <div className="flex items-center justify-between gap-2">
                        <span>Site no ar. Link da tag NFC: <span className="break-all font-black">{linkEncarte}</span></span>
                        <button type="button" onClick={copiarLink} className="shrink-0 rounded-md border-2 border-navy/30 bg-white px-2 py-1 text-[11px] font-black text-navy">{linkCopiado ? 'Copiado' : 'Copiar'}</button>
                      </div>
                    )
                    : site.online === false
                      ? 'Servidor do encarte não encontrado. Publique pelo PC do mercado para os clientes verem.'
                      : 'Verificando o site…'}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" onClick={publicarDigital} disabled={publicando} className="rounded-lg bg-bengala px-3 py-3 text-sm font-black text-white disabled:opacity-60">
                  {publicando ? 'Publicando…' : 'Publicar agora'}
                </button>
                <a href="#/encarte" target="_blank" rel="noreferrer" className="rounded-lg border-2 border-navy px-3 py-3 text-center text-sm font-black text-navy">
                  Abrir encarte
                </a>
              </div>
            </div>

            {ativosDoModelo.length > 18 && !ehFormatoJornal(layoutAtual) && (
              <div className="flex items-center gap-2 rounded-xl border-2 border-offer bg-offer/15 p-3 text-sm">
                <Icon name="Newspaper" size={18} className="shrink-0 text-navy" />
                <span className="flex-1 font-bold text-navy">Muitos produtos? O Jornal da semana põe todos em blocos, como no jornal impresso.</span>
                <button type="button" onClick={() => setLayoutDigital('jornal')} className="shrink-0 rounded-lg bg-navy px-3 py-2 text-xs font-black text-white">Usar</button>
              </div>
            )}

            {itensJornal.length > 0 && (
              <div className="rounded-xl border border-info/20 bg-info/5 p-3 text-sm">
                <div className="flex items-center gap-2 font-bold text-ink">
                  <Icon name="Files" size={16} className="text-info" />
                  {paginasJornal.length} {paginasJornal.length === 1 ? 'página no encarte' : 'páginas no encarte'}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                  {ehFormatoJornal(layoutAtual) ? 'Jornal da semana: 6 produtos por linha, em blocos por dia (ou por setor).' : layoutDigital === 'destaque' ? 'Até 8 produtos por página (1 destaque + 7).' : 'Até 9 produtos por página.'} Na impressão, cada página sai numa folha A4.
                </p>
              </div>
            )}

            {itensJornal.length > 0 && (
              <div ref={revisaoRef} className={`scroll-mt-4 rounded-xl border p-3 text-sm ${bloqueiosPDF.length ? 'border-critical/30 bg-critical/5' : problemasPDF.length ? 'border-warning/30 bg-warning/5' : 'border-success/30 bg-success/5'}`}>
                <button onClick={() => setMostrarRevisao((v) => !v)} className="flex w-full items-center gap-2 text-left font-bold text-ink">
                  <Icon name={bloqueiosPDF.length ? 'TriangleAlert' : problemasPDF.length ? 'Info' : 'BadgeCheck'} size={17} className={bloqueiosPDF.length ? 'text-critical' : problemasPDF.length ? 'text-warning' : 'text-success'} />
                  <span className="flex-1">Revisão antes do PDF</span>
                  <span className="text-xs font-medium text-ink-soft">
                    {bloqueiosPDF.length ? `${bloqueiosPDF.length} bloqueio(s)` : problemasPDF.length ? `${problemasPDF.length} aviso(s), impressão liberada` : 'Tudo pronto'}
                  </span>
                  <Icon name={mostrarRevisao ? 'ChevronUp' : 'ChevronDown'} size={15} />
                </button>
                {mostrarRevisao && (
                  <div className="mt-2 space-y-1.5 border-t border-ink-soft/10 pt-2">
                    {problemasPDF.length === 0 ? (
                      <div className="flex items-center gap-2 text-xs text-success">
                        <Icon name="Check" size={14} /> Preços, validades, imagens e repetições verificados.
                      </div>
                    ) : problemasPDF.map((problema, indice) => (
                      <div key={`${problema.texto}-${indice}`} className={`flex items-start gap-2 text-xs ${problema.nivel === 'erro' ? 'text-critical' : 'text-warning'}`}>
                        <Icon name={problema.nivel === 'erro' ? 'CircleX' : 'ImageOff'} size={13} className="mt-0.5 shrink-0" />
                        <span>{problema.texto}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Botao variante="contorno" className="flex-1" onClick={salvar}><Icon name="Save" size={16} /> Salvar</Botao>
              <Botao className="flex-1" onClick={exportar} disabled={exportando || !itensJornal.length}><Icon name="Printer" size={16} /> {exportando ? 'Preparando...' : 'Pré-visualizar / imprimir'}</Botao>
            </div>
            {pdfPronto && (
              <div className="rounded-xl border border-success/30 bg-success/5 p-3">
                <div className="flex items-start gap-2 text-sm text-success">
                  <Icon name="BadgeCheck" size={18} className="mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">Pré-visualização aberta</div>
                    <div className="mt-0.5 text-xs text-ink-soft">O navegador permite escolher papel, escala, impressora ou Salvar como PDF.</div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={exportar} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-success px-3 py-2 text-sm font-bold text-white">
                    <Icon name="Printer" size={16} /> Abrir novamente
                  </button>
                </div>
              </div>
            )}
            {itensJornal.length > 0 && itensJornal.length < 3 && (
              <button onClick={() => navigate('/cartazes')} className="flex w-full items-center justify-center gap-2 rounded-xl border border-coral/30 bg-coral/10 px-3 py-2.5 text-sm font-medium text-coral-dark hover:bg-coral/15">
                <Icon name="Image" size={16} /> Poucos produtos? Criar cartaz individual
              </button>
            )}
          </div>

          {/* prévia do encarte novo (o mesmo do link da tag NFC e das artes) */}
          <div className="order-first min-w-0 space-y-4 pb-2 lg:order-none">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-ink-soft">
              <span className="font-bold text-ink">Prévia do encarte · {temaArte.nome}</span>
              {itensJornal.length > 0 && <span>Toque num produto para trocar o selo ou o preço</span>}
            </div>
            {!itensJornal.length ? (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border-2 border-dashed border-bengala/40 bg-white p-6 text-center">
                <Icon name="ScanBarcode" size={30} className="text-bengala" />
                <div className="mt-2 text-lg font-black text-navy">Escaneie para começar</div>
                <div className="mt-1 text-sm text-ink-soft">Os produtos aparecem aqui no encarte, do jeito que o cliente vai ver.</div>
              </div>
            ) : paginasJornal.map((itens, indice) => (
              <div key={indice} className="mx-auto w-full max-w-[680px] space-y-1.5">
                <div className="flex items-center justify-between px-1 text-xs text-ink-soft">
                  <span className="font-bold text-ink">Página {indice + 1} de {paginasJornal.length}</span>
                  <span>{itensDaPagina(itens, layoutAtual).length} {itensDaPagina(itens, layoutAtual).length === 1 ? 'produto' : 'produtos'}</span>
                </div>
                <div className="overflow-hidden rounded-xl shadow-lg ring-1 ring-black/5">
                  <Escalado largura={tamanho.largura} altura={tamanho.altura}>
                    <PaginaEncarte tema={temaArte} pagina={itens} encarte={encarteArte} loja={lojaAtual} fundo={fundoDigital} layout={layoutAtual} numero={indice + 1} total={paginasJornal.length} onAbrir={abrirProdutoDaPrevia} escalaLogo={escalaLogo} />
                  </Escalado>
                </div>
              </div>
            ))}
          </div>

          {/* cópias em tamanho real, fora da tela, usadas para imprimir e salvar em PDF */}
          {itensJornal.length > 0 && (
            <div className="pointer-events-none fixed top-0" style={{ left: -20000 }} aria-hidden="true">
              {paginasJornal.map((itens, indice) => (
                <div key={indice} ref={(el) => { pageRefs.current[indice] = el }} style={{ width: tamanho.largura, height: tamanho.altura }}>
                  <PaginaEncarte tema={temaArte} pagina={itens} encarte={encarteArte} loja={lojaAtual} fundo={fundoDigital} layout={layoutAtual} numero={indice + 1} total={paginasJornal.length} escalaLogo={escalaLogo} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============ ARTES (Feed, Stories, TV, post, cartaz, etiqueta) ============ */}
      {aba === 'artes' && (
        <CentralArtes
          saidas={['feed', 'stories', 'tv', 'post']}
          subtitulo="Cartazes e etiquetas para imprimir ficam na aba Cartazes."
          itens={itensParaArte()}
          titulo={titulo}
          encarte={{ periodoDe: validadeDe, periodoAte: validadeAte }}
          loja={lojaAtual}
          temaId={temaAtualId}
          setTemaId={escolherTema}
          escalaLogo={escalaLogo}
          layout={layoutDigital}
          setLayout={setLayoutDigital}
          fundo={fundoDigital}
          toast={toast}
        />
      )}

      {/* ============ FILA ============ */}
      {aba === 'fila' && <FilaView fila={fila} vencimento={fila.filter((p) => p.origemFila === 'vencimento')} remover={removerDaFila} salvarProduto={salvarProduto} toast={toast} />}

      {aba === 'historico' && (
        <div className="card-bengala p-4">
          <h3 className="mb-1 font-bold text-ink">Jornais gerados</h3>
          <p className="mb-3 text-xs text-ink-soft">Cada item guarda os produtos, preços e imagens usados naquele momento.</p>
          {jornais.length === 0 ? (
            <EmptyState icon="History" titulo="Nenhum jornal salvo" descricao="Ao pré-visualizar ou salvar um jornal, ele aparecerá aqui." />
          ) : (
            <div className="space-y-2">
              {jornais.map((jornal) => (
                <div key={jornal.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-soft/10 bg-white p-3">
                  <button onClick={() => abrirJornalSalvo(jornal)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bengala/10 text-bengala"><Icon name="Newspaper" size={19} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">{jornal.titulo}</span>
                      <span className="block text-xs text-ink-soft">{jornal.totalItens} produtos · {jornal.totalPaginas || 1} pág. · {new Date(jornal.criadoEm).toLocaleString('pt-BR')}</span>
                    </span>
                  </button>
                  <button onClick={() => abrirJornalSalvo(jornal)} className="inline-flex items-center gap-1 rounded-lg bg-bengala px-3 py-2 text-xs font-bold text-white"><Icon name="Eye" size={14} /> Visualizar</button>
                  <button onClick={() => excluirJornal(jornal.id)} aria-label={`Excluir ${jornal.titulo}`} className="rounded-lg p-2 text-critical hover:bg-critical/10"><Icon name="Trash2" size={15} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}


      {historicoParaAbrir ? (
        <div className="pointer-events-none fixed top-0" style={{ left: -20000 }} aria-hidden="true">
          {paginasDoHistorico(historicoParaAbrir.jornal).map((itens, indice, todas) => (
            <div key={`${historicoParaAbrir.jornal.id}-${indice}`} ref={(elemento) => { historicoRefs.current[indice] = elemento }} style={{ width: tamanhoPagina(historicoParaAbrir.jornal.layoutArte).largura, height: tamanhoPagina(historicoParaAbrir.jornal.layoutArte).altura }}>
              <PaginaEncarte
                tema={temaCampanhaById(historicoParaAbrir.jornal.temaArte || temaDigital)}
                pagina={itens}
                encarte={{ periodoDe: historicoParaAbrir.jornal.validadeDe, periodoAte: historicoParaAbrir.jornal.validadeAte }}
                loja={lojaAtual}
                fundo={historicoParaAbrir.jornal.fundoArte || null}
                layout={historicoParaAbrir.jornal.layoutArte || 'grade'}
                escalaLogo={historicoParaAbrir.jornal.escalaLogo}
                numero={indice + 1}
                total={todas.length}
              />
            </div>
          ))}
        </div>
      ) : null}

      <Modal
        open={Boolean(seloEditando)}
        onClose={() => setSeloEditando(null)}
        titulo={seloEditando ? seloEditando.nome : 'Selo e preço do produto'}
        footer={<><Botao variante="contorno" onClick={() => setSeloEditando(null)}>Fechar</Botao><Botao onClick={salvarPrecoDaPrevia}><Icon name="Save" size={15} /> Salvar produto</Botao></>}
      >
        {seloEditando && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-bold text-ink">Preço no encarte</p>
              <div className="grid grid-cols-2 gap-2">
                <Campo label="Preço normal (de)"><input type="number" inputMode="decimal" min="0.01" step="0.01" className={inputCls} value={precoEditando.normal} onChange={(e) => setPrecoEditando((p) => ({ ...p, normal: e.target.value }))} /></Campo>
                <Campo label="Preço da oferta (por)"><input type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="sem oferta" className={inputCls} value={precoEditando.promo} onChange={(e) => setPrecoEditando((p) => ({ ...p, promo: e.target.value }))} /></Campo>
              </div>
              <p className="mt-1 text-xs text-ink-soft">Deixe o preço da oferta vazio para mostrar só o preço normal.</p>
            </div>
            <div>
              <p className="mb-2 text-sm font-bold text-ink">Ajustar na arte</p>
              <EditorCelula
                produto={{ ...(fila.find((f) => f.id === seloEditando.id) || seloEditando), precoJornal: Number(String(precoEditando.promo).replace(',', '.')) || Number(String(precoEditando.normal).replace(',', '.')) || precoJornal(seloEditando) }}
                tema={temaArte}
                ajuste={ajusteEditando}
                onChange={setAjusteEditando}
              />
            </div>
            {(() => {
              const atual = fila.find((f) => f.id === seloEditando.id) || seloEditando
              const dia = noMercadoEncarte(atual) ? atual.encarteMercadoDia : null
              return (
                <div className="rounded-xl border-2 border-[#c1121f]/40 p-3">
                  <p className="flex items-center gap-1.5 text-sm font-black text-[#c1121f]"><Icon name="Star" size={16} fill={dia ? '#ffd60a' : 'none'} /> Mercado Encarte: dia da oferta</p>
                  <div className="mt-2 grid grid-cols-4 gap-1.5">
                    {proximosDias.map((d, i) => (
                      <button key={d} type="button" onClick={() => diaDoMercado(atual, d)} aria-pressed={dia === d}
                        className={`rounded-lg border-2 px-1 py-1.5 text-xs font-black ${dia === d ? 'border-[#c1121f] bg-[#c1121f] text-white' : 'border-[#c1121f]/25 bg-white text-[#c1121f]'}`}>
                        {i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : rotuloDia(d)}
                      </button>
                    ))}
                    <button type="button" onClick={() => diaDoMercado(atual, null)} disabled={!dia}
                      className="rounded-lg border-2 border-ink-soft/20 bg-white px-1 py-1.5 text-xs font-black text-ink-soft disabled:opacity-40">
                      Fora
                    </button>
                  </div>
                </div>
              )
            })()}
            <div>
              <p className="mb-2 text-sm font-bold text-ink">Selo</p>
              <p className="mb-2 text-xs text-ink-soft">O selo aparece só neste produto no encarte, nas artes e nos cartazes. Muda na hora.</p>
              <SeletorSelo
                value={(fila.find((f) => f.id === seloEditando.id) || seloEditando).seloOferta}
                onChange={(id) => trocarSelo(seloEditando, id)}
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(produtoEditandoGerador)}
        onClose={() => setProdutoEditandoGerador(null)}
        titulo="Editar produto do jornal"
        footer={<><Botao variante="contorno" onClick={() => setProdutoEditandoGerador(null)}>Cancelar</Botao><Botao onClick={salvarProdutoGerador}>Salvar correção</Botao></>}
      >
        {produtoEditandoGerador ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex items-center gap-3">
              <ProdutoThumb produto={produtoEditandoGerador} size={58} />
              <label className="cursor-pointer rounded-lg border border-ink-soft/20 bg-white px-3 py-2 text-sm font-bold text-ink">
                <Icon name="ImagePlus" size={14} className="mr-1 inline" /> Trocar imagem
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(evento) => trocarImagemProdutoGerador(evento.target.files?.[0])}
                />
              </label>
            </div>
            <div className="col-span-2"><Campo label="Nome"><input className={inputCls} value={produtoEditandoGerador.nome || ''} onChange={(e) => setProdutoEditandoGerador((p) => ({ ...p, nome: e.target.value }))} /></Campo></div>
            <Campo label="Marca"><input className={inputCls} value={produtoEditandoGerador.marca || ''} onChange={(e) => setProdutoEditandoGerador((p) => ({ ...p, marca: e.target.value }))} /></Campo>
            <Campo label="Gramagem"><input className={inputCls} value={produtoEditandoGerador.gramagem || ''} onChange={(e) => setProdutoEditandoGerador((p) => ({ ...p, gramagem: e.target.value }))} /></Campo>
            <div className="col-span-2"><Campo label="Setor (em qual jornal ele entra)"><SeletorSetor value={produtoEditandoGerador.setor} onChange={(setor) => setProdutoEditandoGerador((p) => ({ ...p, setor }))} /></Campo></div>
            <Campo label="Selo da oferta"><SeletorSelo value={produtoEditandoGerador.seloOferta} onChange={(seloOferta) => setProdutoEditandoGerador((p) => ({ ...p, seloOferta }))} /></Campo>
            <Campo label="Vendido por"><SeletorUnidade value={produtoEditandoGerador.unidade} setor={produtoEditandoGerador.setor} onChange={(unidade) => setProdutoEditandoGerador((p) => ({ ...p, unidade }))} /></Campo>
            <Campo label="Quantidade"><input type="number" min="0" className={inputCls} value={produtoEditandoGerador.estoque ?? ''} onChange={(e) => setProdutoEditandoGerador((p) => ({ ...p, estoque: e.target.value }))} /></Campo>
            <Campo label="Preço normal"><input type="number" min="0.01" step="0.01" className={inputCls} value={produtoEditandoGerador.precoNormal ?? ''} onChange={(e) => setProdutoEditandoGerador((p) => ({ ...p, precoNormal: e.target.value }))} /></Campo>
            <Campo label="Preço promocional"><input type="number" min="0.01" step="0.01" className={inputCls} value={produtoEditandoGerador.precoPromo ?? ''} onChange={(e) => setProdutoEditandoGerador((p) => ({ ...p, precoPromo: e.target.value }))} /></Campo>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

// ---- célula de vencimento (grande ideia) — estilo encarte escuro ----
function SeletorSetor({ value, onChange }) {
  return (
    <select value={value || 'mercearia'} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      {SETORES.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
    </select>
  )
}

function SeletorSelo({ value, onChange }) {
  const atual = value || 'oferta'
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      {SELOS_OFERTA.map((s) => (
        <button key={s.id} type="button" onClick={() => onChange(s.id)} aria-pressed={atual === s.id} title={s.texto}
          className={`flex h-16 items-center justify-center rounded-lg border-2 bg-white ${atual === s.id ? 'border-bengala ring-2 ring-bengala/30' : 'border-ink-soft/15'}`}>
          {s.nenhum ? <span className="text-sm font-black uppercase text-ink-soft">Sem selo</span> : <SeloArte selo={s} largura={104} girar={-4} />}
        </button>
      ))}
    </div>
  )
}

function SeletorUnidade({ value, setor, onChange }) {
  const padrao = setor === 'hortifruti' ? 'KG' : 'UNI'
  return (
    <select className={inputCls} value={value || padrao} onChange={(e) => onChange(e.target.value)}>
      {['UNI', 'KG', 'PCT', 'CX', 'BDJ', 'DZ'].map((u) => <option key={u} value={u}>{u}</option>)}
    </select>
  )
}

function FilaView({ fila, vencimento, remover, salvarProduto, toast }) {
  const [editando, setEditando] = useState(null)
  if (fila.length === 0) {
    return <EmptyState icon="ListChecks" titulo="Fila vazia" descricao="Em Produtos ou Ofertas, use o botão de jornal para adicionar produtos aqui." />
  }
  const estrelados = fila.filter((p) => noMercadoEncarte(p))
    .sort((a, b) => String(a.encarteMercadoDia).localeCompare(String(b.encarteMercadoDia)))
  const grupos = SETORES.map((s) => ({ setor: s, itens: fila.filter((p) => p.setor === s.id && !noMercadoEncarte(p)) })).filter((g) => g.itens.length)
  const alternarEstrela = (p) => {
    const ligar = !noMercadoEncarte(p)
    salvarProduto({ id: p.id, encarteMercadoDia: ligar ? dataISOmaisDias(0) : null })
    toast(ligar ? `${p.nome} entrou nos estrelados (Mercado Encarte de hoje).` : `${p.nome} saiu dos estrelados.`, 'info')
  }
  const linhaFila = (p, comSetor = false) => {
    const estrelado = noMercadoEncarte(p)
    const setorP = setorById(p.setor)
    return (
      <div key={p.id} className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
        <ProdutoThumb produto={p} size={36} />
        <div className="min-w-0 flex-1">
          <div className="whitespace-normal break-words text-sm font-medium leading-snug text-ink">{p.nome}</div>
          <div className="text-xs text-ink-soft">
            {comSetor ? <span className="font-bold" style={{ color: setorP.corTag || setorP.cor }}>{setorP.nome} </span> : null}
            {estrelado ? <span className="mr-1 rounded bg-[#c1121f] px-1 font-bold text-white">{rotuloDia(p.encarteMercadoDia)}</span> : null}
            {p.marca}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {p.origemFila === 'vencimento'
              ? <Pill cor="#c42b2b" bg="#fbe5e5">Vencimento</Pill>
              : p.origemFila === 'scanner' || p.origemFila === 'scanner-jornal'
                ? <Pill cor="#1c6e48" bg="#e2f3ea">Confirmado no scanner</Pill>
                : p.origemFila === 'oferta'
                  ? <Pill cor="#2e6fb0" bg="#e6f1fb">Oferta confirmada</Pill>
                : <Pill>Manual</Pill>}
            <span className="text-sm font-medium">{formatBRL(p.precoPromo || p.precoNormal)}</span>
          </div>
        </div>
        <button type="button" onClick={() => alternarEstrela(p)} aria-pressed={estrelado} aria-label={`${estrelado ? 'Tirar a estrela de' : 'Dar estrela para'} ${p.nome}`}
          className={`rounded p-1.5 ${estrelado ? 'bg-[#c1121f] text-[#ffd60a]' : 'text-ink-soft/60 hover:bg-[#c1121f]/10 hover:text-[#c1121f]'}`}>
          <Icon name="Star" size={15} fill={estrelado ? '#ffd60a' : 'none'} />
        </button>
        <button onClick={() => setEditando({ ...p })} aria-label={`Editar ${p.nome}`} className="rounded p-1.5 text-info hover:bg-info/10"><Icon name="Pencil" size={15} /></button>
        <button onClick={() => { remover(p.id); toast('Removido da fila.', 'info') }} aria-label={`Remover ${p.nome} da fila`} className="rounded p-1 text-critical hover:bg-critical/10"><Icon name="X" size={15} /></button>
      </div>
    )
  }
  const salvarEdicao = () => {
    if (!editando?.nome?.trim()) return toast('Informe o nome do produto.', 'erro')
    if (!(Number(editando.precoNormal) > 0)) return toast('Informe um preço válido.', 'erro')
    salvarProduto({
      ...editando,
      estoque: Math.max(0, Number(editando.estoque) || 0),
      precoNormal: Number(editando.precoNormal),
      precoPromo: editando.precoPromo ? Number(editando.precoPromo) : null,
      naFila: true,
    })
    setEditando(null)
    toast('Produto corrigido na fila do jornal!')
  }

  const trocarImagem = (arquivo) => {
    if (!arquivo) return
    const leitor = new FileReader()
    leitor.onload = () => setEditando((produto) => ({
      ...produto,
      imagem: String(leitor.result || ''),
      imagemManual: true,
      imagemTratada: true,
      imagemTratamento: 'imagem-manual-livre-v1',
      imagemAltaResolucao: null,
      imagemOrigem: 'upload-manual',
    }))
    leitor.onerror = () => toast('Não foi possível ler a imagem.', 'erro')
    leitor.readAsDataURL(arquivo)
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card-bengala p-3"><div className="text-xs text-ink-soft">Na fila</div><div className="text-xl font-bold text-ink">{fila.length}</div></div>
        <div className="card-bengala p-3"><div className="text-xs text-ink-soft">De vencimento</div><div className="text-xl font-bold text-critical">{vencimento.length}</div></div>
        <div className="card-bengala p-3"><div className="text-xs text-ink-soft">Com estrela</div><div className="text-xl font-bold text-[#c1121f]">{estrelados.length}</div></div>
      </div>
      <div className="card-bengala overflow-hidden border-2 border-[#c1121f]/40">
        <div className="flex items-center gap-2 px-4 py-2 text-white" style={{ background: 'linear-gradient(120deg,#c1121f,#fb5607)' }}>
          <Icon name="Star" size={16} fill="#ffd60a" className="text-[#ffd60a]" /> <span className="font-bold">Só estrelas · Mercado Encarte</span>
          <span className="text-xs opacity-80">({estrelados.length})</span>
        </div>
        {estrelados.length ? (
          <div className="divide-y divide-ink-soft/8">{estrelados.map((p) => linhaFila(p, true))}</div>
        ) : (
          <p className="px-4 py-3 text-sm text-ink-soft">Nenhum produto com estrela. Ligue a estrela no scanner na hora de adicionar, ou toque na estrela de um produto abaixo.</p>
        )}
      </div>
      {grupos.map((g) => (
        <div key={g.setor.id} className="card-bengala overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2" style={{ background: `${g.setor.cor}14`, color: g.setor.cor }}>
            <Icon name={g.setor.icone} size={16} /> <span className="font-bold">{g.setor.nome}</span>
            <span className="text-xs opacity-70">({g.itens.length})</span>
          </div>
          <div className="divide-y divide-ink-soft/8">{g.itens.map((p) => linhaFila(p))}</div>
        </div>
      ))}
      <Modal
        open={Boolean(editando)}
        onClose={() => setEditando(null)}
        titulo="Editar produto da fila"
        footer={<><Botao variante="contorno" onClick={() => setEditando(null)}>Cancelar</Botao><Botao onClick={salvarEdicao}>Salvar correção</Botao></>}
      >
        {editando ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex items-center gap-3">
              <ProdutoThumb produto={editando} size={58} />
              <label className="cursor-pointer rounded-lg border border-ink-soft/20 bg-white px-3 py-2 text-sm font-bold text-ink">
                <Icon name="ImagePlus" size={14} className="mr-1 inline" /> Trocar imagem
                <input type="file" accept="image/*" className="sr-only" onChange={(evento) => trocarImagem(evento.target.files?.[0])} />
              </label>
            </div>
            <div className="col-span-2"><Campo label="Nome"><input className={inputCls} value={editando.nome || ''} onChange={(e) => setEditando((p) => ({ ...p, nome: e.target.value }))} /></Campo></div>
            <Campo label="Marca"><input className={inputCls} value={editando.marca || ''} onChange={(e) => setEditando((p) => ({ ...p, marca: e.target.value }))} /></Campo>
            <Campo label="Gramagem"><input className={inputCls} value={editando.gramagem || ''} onChange={(e) => setEditando((p) => ({ ...p, gramagem: e.target.value }))} /></Campo>
            <Campo label="Validade (uso interno)"><input type="date" className={inputCls} value={editando.validade || ''} onChange={(e) => setEditando((p) => ({ ...p, validade: e.target.value }))} /></Campo>
            <div className="col-span-2"><Campo label="Setor (em qual jornal ele entra)"><SeletorSetor value={editando.setor} onChange={(setor) => setEditando((p) => ({ ...p, setor }))} /></Campo></div>
            <Campo label="Selo da oferta"><SeletorSelo value={editando.seloOferta} onChange={(seloOferta) => setEditando((p) => ({ ...p, seloOferta }))} /></Campo>
            <Campo label="Vendido por"><SeletorUnidade value={editando.unidade} setor={editando.setor} onChange={(unidade) => setEditando((p) => ({ ...p, unidade }))} /></Campo>
            <Campo label="Quantidade"><input type="number" min="0" className={inputCls} value={editando.estoque ?? ''} onChange={(e) => setEditando((p) => ({ ...p, estoque: e.target.value }))} /></Campo>
            <Campo label="Preço normal"><input type="number" min="0.01" step="0.01" className={inputCls} value={editando.precoNormal ?? ''} onChange={(e) => setEditando((p) => ({ ...p, precoNormal: e.target.value }))} /></Campo>
            <Campo label="Preço promocional"><input type="number" min="0.01" step="0.01" className={inputCls} value={editando.precoPromo ?? ''} onChange={(e) => setEditando((p) => ({ ...p, precoPromo: e.target.value }))} /></Campo>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}


