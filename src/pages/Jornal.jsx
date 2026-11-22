import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/StoreContext'
import { Icon, ProdutoThumb, EmptyState, Botao, Campo, inputCls, Modal, Secao, Rotulo, Abas, Escolha, ImagemSetor } from '../components/ui'
import { BotaoEstrela } from '../components/EstrelaMercado'
import ScannerJornal from '../components/ScannerJornal'
import CentralArtes from '../components/CentralArtes'
import {
  SETORES, setorById, formatBRL, MERCADO_ENCARTE, noMercadoEncarte,
  percentDesc, dataISOmaisDias, SELOS_OFERTA, plural, formatDataCurta, paraNumero,
} from '../lib/utils'
import { publicarEncarte, lerEncartePublicado, lerFundoTemplate, salvarFundoTemplate, prepararFundoTemplate, enviarEncarteAoSite, statusSiteEncarte, linkDoEncarte, lerSenhaPublicacao, salvarSenhaPublicacao } from '../lib/encartePublico'
import SeletorTema from '../components/SeletorTema'
import SeletorSelo, { BotaoAplicarTodos } from '../components/SeletorSelo'
import PrecoArte, { ESTILOS_PRECO, estiloPrecoById } from '../components/PrecoArte'
import EditorCelula from '../components/EditorCelula'
import { Escalado } from '../components/PaginaTemplate'
import { PaginaEncarte, paginarEncarte, tamanhoPagina, itensDaPagina, ehFormatoJornal } from '../components/JornalMercado'
import { temaCampanhaById, temasDoSetor, caminhoArte } from '../lib/temasCampanha'
import { abrirJanelaPrevisualizacao, previsualizarImpressaoPaginas } from '../lib/exportar'
import { imagemProdutoPrecisaTratamento, fotoRuimParaJornal, prepararProdutoParaJornal } from '../lib/produtoApi'

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
  // Passo do gerador: 0 jornal, 1 produtos, 2 visual, 3 publicar. Fila vazia começa nos produtos.
  const [passo, setPasso] = useState(() => (fila.length ? 0 : 1))
  const passosRef = useRef(null)
  // Link do encarte (tag NFC), status do site e última publicação: só o admin vê.
  const ehAdmin = store.usuario?.papel === 'admin'

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
  // Ajuste predefinido (foto, preço, nome e etiqueta): vale para todo produto que não tem ajuste próprio.
  const ajustePadrao = config.ajustePadraoArte || null
  // Estilo do preço predefinido: vale para todo produto que não escolheu o seu.
  const estiloPrecoPadrao = config.estiloPrecoPadrao || null
  const comEstiloPadrao = (p) => (p.estiloPreco || !estiloPrecoPadrao ? p : { ...p, estiloPreco: estiloPrecoPadrao })
  const comAjustePadrao = (p) => comEstiloPadrao(p.ajusteArte || !ajustePadrao ? p : { ...p, ajusteArte: ajustePadrao })
  const [usarComoPadrao, setUsarComoPadrao] = useState(false)
  const abrirProdutoDaPrevia = (produto) => {
    const atual = fila.find((f) => f.id === produto.id) || produto
    setPrecoEditando({ normal: atual.precoNormal ?? '', promo: atual.precoPromo ?? '' })
    setAjusteEditando(atual.ajusteArte || ajustePadrao)
    setUsarComoPadrao(!atual.ajusteArte && Boolean(ajustePadrao))
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
    const pendentes = fila.filter((p) => (imagemProdutoPrecisaTratamento(p) || fotoRuimParaJornal(p)) && !fotosTentadas.current.has(chaveFoto(p)))
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
    const promo = paraNumero(p.precoPromo)
    if (promo) return promo
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
  const itensArte = itensJornal.map((p) => comAjustePadrao({ ...p, precoJornal: precoJornal(p), descontoJornal: descJornal(p) }))
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
    const incluido = incluir(p.id)
    return (
      <li key={p.id} className="flex min-w-0 items-center gap-2.5 py-2">
        <input type="checkbox" checked={incluido} onChange={() => toggleIncluir(p.id)} aria-label={`Incluir ${p.nome} neste jornal`} className="h-5 w-5 shrink-0 accent-navy" />
        <span className={`flex min-w-0 flex-1 items-center gap-2.5 ${incluido ? '' : 'opacity-50'}`}>
          <ProdutoThumb produto={p} size={36} />
          <span className="min-w-0 flex-1">
            <span className="block break-words text-sm font-semibold leading-snug text-ink">{p.nome}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-ink-soft">
              {(!ehSetor || ehMercado) && <span className="font-semibold" style={{ color: setorP.corTag || setorP.cor }}>{setorP.nome}</span>}
              <span className="num-tab">{formatBRL(precoJornal(p))}</span>
              {estrelado && <span className="rounded bg-bengala px-1 font-semibold text-white">{rotuloDia(p.encarteMercadoDia)}</span>}
              {p.origemFila === 'vencimento' && <span className="font-semibold text-[#b4530f]">oferta interna</span>}
            </span>
          </span>
        </span>
        <BotaoEstrela ativo={estrelado} onClick={() => alternarMercado(p)} nome={p.nome} />
        <button type="button" onClick={() => setProdutoEditandoGerador({ ...p })} aria-label={`Editar ${p.nome}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-soft hover:bg-cream-200 hover:text-navy"><Icon name="Pencil" size={16} /></button>
      </li>
    )
  }
  const proximosDias = Array.from({ length: 7 }, (_, i) => dataISOmaisDias(i))
  // O site do cliente sempre recebe todos os produtos; cada setor vira uma aba com o template dele.
  const ordenarParaJornal = (lista) => [
    ...lista.filter((p) => p.origemFila === 'vencimento'),
    ...lista.filter((p) => p.origemFila !== 'vencimento').sort((a, b) => ordemSetor(a) - ordemSetor(b)),
  ].map((p) => comAjustePadrao({ ...p, precoJornal: precoJornal(p), descontoJornal: descJornal(p) }))
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
    if (usarComoPadrao) {
      // Vira o ajuste de todos os produtos sem ajuste próprio; este produto passa a seguir o padrão.
      store.salvarConfig({ ajustePadraoArte: ajusteEditando })
      salvarProduto({ id: seloEditando.id, precoNormal: normal, precoPromo: promo, ajusteArte: null })
    } else {
      salvarProduto({ id: seloEditando.id, precoNormal: normal, precoPromo: promo, ajusteArte: ajusteEditando })
    }
    toast(`${seloEditando.nome}: ${promo ? `de ${formatBRL(normal)} por ${formatBRL(promo)}` : formatBRL(normal)}.`)
    setSeloEditando(null)
  }
  const trocarSelo = (produto, seloOferta) => {
    salvarProduto({ id: produto.id, seloOferta })
    const selo = SELOS_OFERTA.find((s) => s.id === seloOferta)
    toast(selo?.nenhum ? `${produto.nome}: sem selo.` : `${produto.nome}: selo "${selo?.texto}".`)
  }
  // Copia o selo para todos os produtos do jornal aberto.
  const seloEmTodos = (seloOferta) => {
    const id = seloOferta || 'oferta'
    ativosDoModelo.filter((p) => (p.seloOferta || 'oferta') !== id).forEach((p) => salvarProduto({ id: p.id, seloOferta: id }))
    const selo = SELOS_OFERTA.find((s) => s.id === id)
    toast(selo?.nenhum ? `Todos os ${ativosDoModelo.length} produtos do jornal ficaram sem selo.` : `Selo "${selo?.texto}" em todos os ${ativosDoModelo.length} produtos do jornal.`)
  }

  // Estilo do preço no jornal todo: o predefinido vale para todos e os estilos próprios saem.
  const estiloPrecoNoJornalTodo = (estiloPreco) => {
    store.salvarConfig({ estiloPrecoPadrao: estiloPreco })
    fila.filter((p) => p.estiloPreco).forEach((p) => salvarProduto({ id: p.id, estiloPreco: null }))
  }
  const trocarEstiloPreco = (produto, estiloPreco, noJornalTodo) => {
    if (noJornalTodo) estiloPrecoNoJornalTodo(estiloPreco)
    else salvarProduto({ id: produto.id, estiloPreco })
    toast(noJornalTodo ? `Preço "${estiloPrecoById(estiloPreco).nome}" no jornal todo.` : `${produto.nome}: preço "${estiloPrecoById(estiloPreco).nome}".`)
  }
  const alternarEstiloNoJornalTodo = (produto, estilo, ligar) => {
    if (ligar) estiloPrecoNoJornalTodo(estilo)
    else salvarProduto({ id: produto.id, estiloPreco: estilo })
    toast(ligar ? `Preço "${estiloPrecoById(estilo).nome}" no jornal todo.` : `O estilo do preço agora vale só para ${produto.nome}.`)
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
      mostrarGeral: config.siteMostrarGeral !== false,
      mostrarMercado: config.siteMostrarMercado !== false,
      layout: layoutDigital,
      fundo: lerFundoTemplate(temaDigital),
      loja: lojaAtual,
      itens: todos.map(comEstiloPadrao),
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

  // ---- passo a passo do gerador ----
  const passos = [
    { id: 'jornal', titulo: 'Jornal', resumo: nomeJornal },
    { id: 'produtos', titulo: 'Produtos', resumo: plural(ativosDoModelo.length, 'produto', 'produtos') },
    { id: 'visual', titulo: 'Visual', resumo: temaArte.nome },
    { id: 'publicar', titulo: 'Publicar', resumo: `${formatDataCurta(validadeDe)} a ${formatDataCurta(validadeAte)}` },
  ]
  const irPara = (i) => {
    setPasso(i)
    requestAnimationFrame(() => passosRef.current?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }))
  }
  const irParaScanner = () => {
    setAba('gerar')
    irPara(1)
    setTimeout(() => document.querySelector('#scanner-jornal input')?.focus(), 80)
  }
  const navegacao = (
    <div className="mt-6 flex items-center justify-between gap-2 border-t border-ink-soft/10 pt-4">
      {passo > 0
        ? <Botao variante="contorno" onClick={() => irPara(passo - 1)}><Icon name="ArrowLeft" size={16} /> Voltar</Botao>
        : <span />}
      {passo < passos.length - 1 && (
        <Botao variante="escuro" onClick={() => irPara(passo + 1)}>
          Próximo: {passos[passo + 1].titulo} <Icon name="ArrowRight" size={16} />
        </Botao>
      )}
    </div>
  )
  const vazioDoPainel = ehMercado
    ? 'Nenhum produto na fila ainda. Bipe acima e ligue a estrela para ele entrar no Mercado Encarte.'
    : ehSetor
      ? `Nenhum produto de ${nomeJornal} na fila. Bipe um produto desse setor, ou corrija o setor de um produto no lápis.`
      : 'Nenhum produto na fila ainda. Bipe o primeiro acima.'
  const temProblema = bloqueiosPDF.length > 0
  const statusRevisao = temProblema
    ? plural(bloqueiosPDF.length, 'item impede a impressão', 'itens impedem a impressão')
    : problemasPDF.length
      ? `${plural(problemasPDF.length, 'aviso', 'avisos')}, impressão liberada`
      : 'Tudo certo para publicar e imprimir'

  return (
    <div className="space-y-5">
      <Abas
        rotulo="Seções do jornal"
        valor={aba}
        onChange={setAba}
        itens={[
          { id: 'gerar', rotulo: 'Montar jornal', rotuloCurto: 'Montar', icone: 'LayoutTemplate' },
          { id: 'artes', rotulo: 'Artes para redes sociais', rotuloCurto: 'Artes', icone: 'Images' },
          { id: 'historico', rotulo: 'Histórico', icone: 'History', badge: jornais.length },
        ]}
      />

      {/* ============ MONTAR (passo a passo) ============ */}
      {aba === 'gerar' && (
        <div className="space-y-5">
          <ol ref={passosRef} className="grid scroll-mt-4 grid-cols-4 gap-1.5 md:gap-2" aria-label="Passos para montar o jornal">
            {passos.map((p, i) => {
              const atual = passo === i
              const feito = i < passo
              return (
                <li key={p.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => irPara(i)}
                    aria-current={atual ? 'step' : undefined}
                    className={`flex h-full w-full min-w-0 flex-col items-start gap-1.5 rounded-xl border px-2 py-2 text-left md:flex-row md:items-center md:gap-3 md:px-3 md:py-2.5 ${atual ? 'border-navy bg-navy text-white' : 'border-ink-soft/15 bg-white text-ink hover:border-ink-soft/40'}`}
                  >
                    <span className={`num-tab flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${atual ? 'bg-offer text-navy' : feito ? 'bg-success text-white' : 'bg-cream-200 text-ink-soft'}`}>
                      {feito ? <Icon name="Check" size={15} strokeWidth={2.5} /> : i + 1}
                    </span>
                    <span className="block w-full min-w-0">
                      <span className="block text-sm font-bold leading-tight">{p.titulo}</span>
                      <span className={`block truncate text-xs ${atual ? 'text-white' : 'text-ink'}`}>{p.resumo}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start">
            <div className="min-w-0">
              {/* 1. qual jornal */}
              {passo === 0 && (
                <Secao titulo="Qual jornal você vai montar?" descricao="O Geral junta todos os produtos. Cada setor também tem o seu jornal.">
                  <div className="grid gap-2">
                    <Escolha ativo={jornalSel === 'geral'} onClick={() => setJornalSel('geral')} icone="Store" titulo="Jornal geral" descricao="Todos os produtos da fila" extra={ativos.length} />
                    <Escolha ativo={ehMercado} onClick={() => setJornalSel(MERCADO_ENCARTE.id)} icone="Star" iconeCor="var(--color-bengala)" titulo="Mercado Encarte" descricao="Só os produtos com estrela, dia a dia" extra={totalMercado} />
                  </div>
                  <Rotulo className="mt-5">Ou o jornal de um setor</Rotulo>
                  <div className="grid grid-cols-2 gap-1.5">
                    {SETORES.map((s) => {
                      const n = contagemSetor(s.id)
                      const ativo = jornalSel === s.id
                      return (
                        <button key={s.id} type="button" onClick={() => setJornalSel(s.id)} aria-pressed={ativo}
                          className={`flex min-h-11 min-w-0 items-center gap-2 rounded-lg border px-2.5 text-left text-sm ${ativo ? 'border-navy bg-navy/[0.045] font-bold text-navy shadow-[inset_0_0_0_1px_var(--color-navy)]' : `border-ink-soft/20 bg-white font-semibold hover:border-ink-soft/45 ${n ? 'text-ink' : 'text-ink-soft'}`}`}>
                          <ImagemSetor id={s.id} size={24} />
                          <span className="min-w-0 flex-1 truncate">{s.nome}</span>
                          <span className={`num-tab shrink-0 text-xs ${n ? 'font-bold text-ink' : 'text-ink-soft'}`}>{n}</span>
                        </button>
                      )
                    })}
                  </div>
                  <p className="mt-3 text-xs text-ink-soft">No site do cliente, o Geral, o Mercado Encarte e cada setor com produto viram abas, cada uma com o seu template.</p>
                  <Rotulo className="mt-5">Aparece no site do cliente?</Rotulo>
                  <div className="grid gap-1.5">
                    <ChaveSite ligado={config.siteMostrarGeral !== false} titulo="Jornal geral" onChange={(v) => { store.salvarConfig({ siteMostrarGeral: v }); toast(v ? 'O Geral volta a aparecer no site depois de publicar.' : 'O Geral sai do site depois de publicar.', 'info') }} />
                    <ChaveSite ligado={config.siteMostrarMercado !== false} titulo="Mercado Encarte" onChange={(v) => { store.salvarConfig({ siteMostrarMercado: v }); toast(v ? 'O Mercado Encarte volta a aparecer no site depois de publicar.' : 'O Mercado Encarte sai do site depois de publicar.', 'info') }} />
                  </div>
                  {navegacao}
                </Secao>
              )}

              {/* 2. produtos */}
              {passo === 1 && (
                <Secao titulo={`Produtos do jornal ${nomeJornal}`} descricao="Bipe ou digite o código. O que o sistema já conhece entra direto na fila.">
                  <ScannerJornal embutido />
                  {filaDoPainel.length === 0 ? (
                    <p className="mt-4 rounded-xl border border-dashed border-ink-soft/25 px-4 py-3 text-sm text-ink-soft">{vazioDoPainel}</p>
                  ) : (
                    <div className="mt-5 space-y-5">
                      {(ehMercado || estreladosPainel.length > 0) && (
                        <div>
                          <Rotulo acao={<span className="num-tab text-sm text-ink-soft">{estreladosPainel.length}</span>}>
                            <span className="inline-flex items-center gap-1.5"><Icon name="Star" size={15} fill="var(--color-offer)" className="text-bengala" /> Com estrela no Mercado Encarte</span>
                          </Rotulo>
                          {estreladosPainel.length
                            ? <ul className="divide-y divide-ink-soft/10 border-y border-ink-soft/10">{estreladosPainel.map(linhaPainel)}</ul>
                            : <p className="text-sm text-ink-soft">Nenhum produto com estrela ainda. Toque na estrela de um produto da fila.</p>}
                        </div>
                      )}
                      <div>
                        <Rotulo acao={<span className="num-tab text-sm text-ink-soft">{outrosPainel.length}</span>}>Na fila</Rotulo>
                        {outrosPainel.length
                          ? <ul className="divide-y divide-ink-soft/10 border-y border-ink-soft/10">{outrosPainel.map(linhaPainel)}</ul>
                          : <p className="text-sm text-ink-soft">Todos os produtos daqui estão com estrela.</p>}
                      </div>
                      <p className="text-xs leading-relaxed text-ink-soft">Desmarque para tirar o produto só deste jornal. A estrela põe no Mercado Encarte de hoje. O lápis corrige nome, preço e setor. Selo e preço também mudam tocando no produto na prévia.</p>
                    </div>
                  )}
                  {navegacao}
                </Secao>
              )}

              {/* 3. visual */}
              {passo === 2 && (
                <Secao titulo={`Visual do jornal ${nomeJornal}`} descricao="O template muda só este jornal. Layout e logo valem para todos.">
                  <Rotulo>Template</Rotulo>
                  {ehSetor ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        {temasDoSetor(jornalSel).map((t) => {
                          const mini = caminhoArte(t, 'miniatura')
                          const ativo = temaAtualId === t.id
                          return (
                            <button key={t.id} type="button" onClick={() => escolherTema(t.id)} aria-pressed={ativo} title={t.nome}
                              className={`relative flex aspect-[4/3] flex-col overflow-hidden rounded-lg text-left ${ativo ? 'ring-[3px] ring-navy ring-offset-2' : 'ring-1 ring-black/10'}`}
                              style={{ background: t.fundo }}>
                              {mini ? <img src={mini} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain p-1" /> : (
                                <span className="relative m-auto flex flex-col items-center px-1 text-center text-sm font-black uppercase italic leading-none text-white" style={{ textShadow: '0 2px 0 rgba(0,0,0,.4)' }}>
                                  {t.icone ? <Icon name={t.icone} size={22} className="mb-1 opacity-80" /> : null}
                                  {t.titulo}<br /><span style={{ color: t.corDestaque }}>{t.destaque}</span>
                                </span>
                              )}
                              {ativo && <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-navy text-white"><Icon name="Check" size={14} strokeWidth={2.5} /></span>}
                              <span className="relative mt-auto truncate bg-black/55 px-1.5 py-0.5 text-[11px] font-semibold text-white">{t.nome}</span>
                            </button>
                          )
                        })}
                      </div>
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm font-semibold text-navy">Usar outro template neste setor</summary>
                        <div className="mt-2"><SeletorTema compacto value={temaAtualId} onChange={escolherTema} /></div>
                      </details>
                    </>
                  ) : (
                    <SeletorTema compacto value={temaDigital} onChange={escolherTema} />
                  )}

                  <Rotulo className="mt-6">Layout</Rotulo>
                  {ehMercado ? (
                    <p className="text-sm text-ink-soft">O Mercado Encarte sai sempre como jornal da semana, com um bloco para cada dia.</p>
                  ) : (
                    <div className="grid gap-2">
                      {[
                        ['grade', 'LayoutGrid', 'Grade 3 × 3', 'Até 9 produtos por página'],
                        ['destaque', 'LayoutPanelTop', '1 destaque + 7', 'O primeiro produto sai grande'],
                        ['jornal', 'Newspaper', 'Jornal da semana', 'Folha A4 com muitos produtos, em blocos por dia ou setor'],
                      ].map(([id, icone, nome, desc]) => (
                        <Escolha key={id} ativo={layoutDigital === id} onClick={() => setLayoutDigital(id)} icone={icone} titulo={nome} descricao={desc} />
                      ))}
                    </div>
                  )}
                  {ativosDoModelo.length > 18 && !ehFormatoJornal(layoutAtual) && (
                    <div className="mt-3 flex items-center gap-3 rounded-xl bg-offer/20 p-3 text-sm">
                      <Icon name="Newspaper" size={18} className="shrink-0 text-navy" />
                      <span className="flex-1 font-semibold text-navy">São muitos produtos. O jornal da semana põe todos em blocos, como no impresso.</span>
                      <Botao variante="escuro" className="min-h-9 shrink-0 px-3" onClick={() => setLayoutDigital('jornal')}>Usar</Botao>
                    </div>
                  )}

                  <Rotulo className="mt-6" acao={<span className="num-tab text-sm font-semibold text-ink">{Math.round(escalaLogo * 100)}%</span>}>Tamanho do logo</Rotulo>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setEscalaLogo((v) => Math.max(0.4, Math.round((v - 0.1) * 10) / 10))} aria-label="Diminuir o logo" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-ink-soft/25 bg-white text-ink hover:bg-cream-200"><Icon name="Minus" size={16} /></button>
                    <input type="range" min="0.4" max="1.3" step="0.05" value={escalaLogo} onChange={(e) => setEscalaLogo(Number(e.target.value))} className="w-full accent-navy" aria-label="Tamanho do logo" />
                    <button type="button" onClick={() => setEscalaLogo((v) => Math.min(1.3, Math.round((v + 0.1) * 10) / 10))} aria-label="Aumentar o logo" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-ink-soft/25 bg-white text-ink hover:bg-cream-200"><Icon name="Plus" size={16} /></button>
                  </div>

                  <details className="mt-6 rounded-xl border border-ink-soft/15 px-3 py-2.5">
                    <summary className="cursor-pointer text-sm font-semibold text-navy">Fundo próprio para o template {temaArte.nome} (opcional)</summary>
                    <p className="mt-2 text-xs text-ink-soft">Arte de 1080 × 1350 sem produtos, sem logo e sem validade. Vale só para este template.</p>
                    <div className="mt-2 flex items-center gap-2">
                      {fundoDigital && <img src={fundoDigital} alt="Fundo do template" className="h-14 w-11 rounded object-cover ring-1 ring-black/10" />}
                      <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-ink-soft/25 bg-white px-3 text-sm font-semibold text-ink hover:bg-cream-200">
                        <Icon name="ImageUp" size={16} /> {fundoDigital ? 'Trocar fundo' : 'Enviar fundo'}
                        <input type="file" accept="image/*" className="sr-only" onChange={(e) => { trocarFundo(e.target.files?.[0]); e.target.value = '' }} />
                      </label>
                      {fundoDigital && (
                        <button type="button" className="min-h-10 px-2 text-sm font-semibold text-critical hover:underline" onClick={() => { salvarFundoTemplate(temaAtualId, null); setFundoDigital(null) }}>Remover</button>
                      )}
                    </div>
                  </details>
                  {navegacao}
                </Secao>
              )}

              {/* 4. revisar e publicar */}
              {passo === 3 && (
                <Secao titulo="Revise e publique" descricao="Confira o período da oferta. Ao publicar, quem tem o link da tag NFC já vê a nova versão.">
                  <Campo label="Título do jornal"><input className={inputCls} value={titulo} onChange={(e) => setTitulo(e.target.value)} /></Campo>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Campo label="Ofertas válidas de"><input type="date" className={inputCls} value={periodoDe} onChange={(e) => setPeriodoDe(e.target.value)} /></Campo>
                    <Campo label="até"><input type="date" className={inputCls} value={periodoAte} min={periodoDe} onChange={(e) => setPeriodoAte(e.target.value)} /></Campo>
                  </div>
                  <p className="mt-1.5 text-xs text-ink-soft">O encarte mostra esse período. A validade de cada produto nunca aparece.</p>

                  {itensJornal.length === 0 ? (
                    <div className="mt-5 rounded-xl border border-dashed border-ink-soft/25 p-4 text-sm text-ink-soft">
                      O jornal {nomeJornal} está sem produtos.
                      <button type="button" onClick={irParaScanner} className="ml-1 font-semibold text-bengala hover:underline">Bipar produtos</button>
                    </div>
                  ) : (
                    <div ref={revisaoRef} className={`mt-5 scroll-mt-4 rounded-xl border p-3 ${temProblema ? 'border-critical/30 bg-critical/5' : problemasPDF.length ? 'border-warning/40 bg-warning/10' : 'border-success/30 bg-success/5'}`}>
                      <button type="button" onClick={() => setMostrarRevisao((v) => !v)} aria-expanded={mostrarRevisao} disabled={!problemasPDF.length} className="flex w-full items-center gap-2 text-left text-sm">
                        <Icon name={temProblema ? 'TriangleAlert' : problemasPDF.length ? 'Info' : 'BadgeCheck'} size={18} className={`shrink-0 ${temProblema ? 'text-critical' : problemasPDF.length ? 'text-[#86590b]' : 'text-success'}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-ink">{plural(itensJornal.length, 'produto', 'produtos')} em {plural(paginasJornal.length, 'página', 'páginas')}</span>
                          <span className="block text-xs text-ink-soft">{statusRevisao}</span>
                        </span>
                        {problemasPDF.length > 0 && <Icon name={mostrarRevisao ? 'ChevronUp' : 'ChevronDown'} size={16} className="shrink-0 text-ink-soft" />}
                      </button>
                      {mostrarRevisao && problemasPDF.length > 0 && (
                        <ul className="mt-2 space-y-1.5 border-t border-ink-soft/10 pt-2">
                          {problemasPDF.map((problema, indice) => (
                            <li key={`${problema.texto}-${indice}`} className={`flex items-start gap-2 text-xs ${problema.nivel === 'erro' ? 'text-critical' : 'text-ink'}`}>
                              <Icon name={problema.nivel === 'erro' ? 'CircleX' : 'ImageOff'} size={13} className="mt-0.5 shrink-0" />
                              <span>{problema.texto}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {site.protegido && (
                    <div className="mt-4">
                      <Campo label="Senha de publicação">
                        <input type="password" autoComplete="current-password" className={inputCls} value={senhaPublicacao}
                          onChange={(e) => { setSenhaPublicacao(e.target.value); salvarSenhaPublicacao(e.target.value) }} />
                      </Campo>
                    </div>
                  )}

                  <div className="mt-5 grid gap-2">
                    <Botao onClick={publicarDigital} disabled={publicando} className="min-h-12 w-full text-base">
                      <Icon name={publicando ? 'LoaderCircle' : 'Send'} size={18} className={publicando ? 'animate-spin' : ''} /> {publicando ? 'Publicando…' : 'Publicar no site do cliente'}
                    </Botao>
                    <p className="text-center text-xs text-ink-soft">Publica todos de uma vez: {[config.siteMostrarGeral !== false && 'o Geral', config.siteMostrarMercado !== false && 'o Mercado Encarte', 'cada setor'].filter(Boolean).join(', ').replace(/, ([^,]*)$/, ' e $1')}.</p>
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      <Botao variante="contorno" onClick={exportar} disabled={exportando || !itensJornal.length}>
                        <Icon name={exportando ? 'LoaderCircle' : 'Printer'} size={16} className={exportando ? 'animate-spin' : ''} /> {exportando ? 'Preparando…' : <><span className="sm:hidden">Imprimir</span><span className="hidden sm:inline">Imprimir ou PDF</span></>}
                      </Botao>
                      <Botao variante="contorno" onClick={salvar}><Icon name="Save" size={16} /> Salvar cópia</Botao>
                    </div>
                    <a href="#/encarte" target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-navy hover:bg-cream-200">
                      <Icon name="ExternalLink" size={15} /> Ver o encarte como o cliente vê
                    </a>
                  </div>

                  {pdfPronto && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-success/30 bg-success/5 p-3 text-sm">
                      <Icon name="BadgeCheck" size={18} className="mt-0.5 shrink-0 text-success" />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-ink">Pré-visualização aberta</div>
                        <div className="mt-0.5 text-xs text-ink-soft">Na janela que abriu, escolha a impressora ou Salvar como PDF.</div>
                        <button type="button" onClick={exportar} className="mt-1.5 text-xs font-semibold text-navy hover:underline">Abrir de novo</button>
                      </div>
                    </div>
                  )}

                  {ehAdmin && (
                    <div className={`mt-4 rounded-xl px-3 py-2.5 text-xs ${site.erro ? 'bg-critical/10 text-critical' : 'bg-cream-200 text-ink'}`} role="status">
                      {site.erro
                        ? site.erro
                        : site.online
                          ? (
                            <div className="flex items-center gap-2">
                              <span className="min-w-0 flex-1">
                                <span className="block font-semibold">Link da tag NFC</span>
                                <span className="block break-all text-ink-soft">{linkEncarte}</span>
                              </span>
                              <button type="button" onClick={copiarLink} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-ink-soft/25 bg-white px-2.5 font-semibold text-ink">
                                <Icon name={linkCopiado ? 'Check' : 'Copy'} size={14} /> {linkCopiado ? 'Copiado' : 'Copiar'}
                              </button>
                            </div>
                          )
                          : site.online === false
                            ? 'Servidor do encarte não encontrado. Publique pelo PC do mercado para os clientes verem.'
                            : 'Verificando o site…'}
                      <div className="mt-1.5 text-ink-soft">
                        {publicadoEm
                          ? `Última publicação: ${new Date(publicadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.`
                          : 'Ainda não publicado.'}
                      </div>
                    </div>
                  )}

                  {itensJornal.length > 0 && itensJornal.length < 3 && (
                    <button type="button" onClick={() => navigate('/cartazes')} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-navy hover:bg-cream-200">
                      <Icon name="Image" size={16} /> Poucos produtos? Faça um cartaz para cada um
                    </button>
                  )}
                  {navegacao}
                </Secao>
              )}
            </div>

            {/* prévia do encarte novo (o mesmo do link da tag NFC e das artes) */}
            <div className="min-w-0 space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 className="text-base font-bold text-navy">Prévia do jornal {nomeJornal}</h2>
                {itensJornal.length > 0 && <span className="text-sm text-ink-soft">Toque num produto para trocar selo e preço</span>}
              </div>
              {!itensJornal.length ? (
                <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ink-soft/20 bg-white p-6 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-cream-200 text-navy"><Icon name="ScanBarcode" size={26} /></span>
                  <div className="mt-3 text-lg font-bold text-navy">O encarte aparece aqui</div>
                  <div className="mt-1 max-w-xs text-sm text-ink-soft">Do jeito que o cliente vai ver. Bipe os produtos para começar.</div>
                  <Botao className="mt-4" onClick={irParaScanner}><Icon name="ScanBarcode" size={17} /> Bipar produtos</Botao>
                </div>
              ) : paginasJornal.map((itens, indice) => (
                <div key={indice} className="mx-auto w-full max-w-[680px] space-y-1.5">
                  <div className="flex items-center justify-between px-1 text-xs text-ink-soft">
                    <span className="font-semibold text-ink">Página {indice + 1} de {paginasJornal.length}</span>
                    <span>{plural(itensDaPagina(itens, layoutAtual).length, 'produto', 'produtos')}</span>
                  </div>
                  <div className="overflow-hidden rounded-xl shadow-[0_10px_30px_rgba(8,43,79,.14)] ring-1 ring-black/5">
                    <Escalado largura={tamanho.largura} altura={tamanho.altura}>
                      <PaginaEncarte tema={temaArte} pagina={itens} encarte={encarteArte} loja={lojaAtual} fundo={fundoDigital} layout={layoutAtual} numero={indice + 1} total={paginasJornal.length} onAbrir={abrirProdutoDaPrevia} escalaLogo={escalaLogo} />
                    </Escalado>
                  </div>
                </div>
              ))}
            </div>
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

      {/* ============ ARTES (Feed, Stories, TV, post) ============ */}
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
          onBipar={irParaScanner}
        />
      )}

      {/* ============ HISTÓRICO ============ */}
      {aba === 'historico' && (
        <Secao titulo="Jornais salvos" descricao="Cada um guarda os produtos, preços e imagens daquele dia.">
          {jornais.length === 0 ? (
            <EmptyState icon="History" titulo="Nenhum jornal salvo" descricao="Ao imprimir ou salvar uma cópia no passo Publicar, o jornal aparece aqui." />
          ) : (
            <ul className="divide-y divide-ink-soft/10">
              {jornais.map((jornal) => (
                <li key={jornal.id} className="flex min-w-0 items-center gap-3 py-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cream-200 text-navy"><Icon name="Newspaper" size={19} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{jornal.titulo}</span>
                    <span className="block text-xs text-ink-soft">{plural(jornal.totalItens, 'produto', 'produtos')} · {plural(jornal.totalPaginas || 1, 'página', 'páginas')} · {new Date(jornal.criadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  </span>
                  <Botao variante="contorno" className="shrink-0 px-3" onClick={() => abrirJornalSalvo(jornal)}><Icon name="Eye" size={15} /> <span className="hidden sm:inline">Abrir</span></Botao>
                  <button type="button" onClick={() => excluirJornal(jornal.id)} aria-label={`Excluir ${jornal.titulo}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-soft hover:bg-critical/10 hover:text-critical"><Icon name="Trash2" size={16} /></button>
                </li>
              ))}
            </ul>
          )}
        </Secao>
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
              <p className="mb-2 text-sm font-semibold text-ink">Preço no encarte</p>
              <div className="grid grid-cols-2 gap-2">
                <Campo label="Preço normal (de)"><input type="number" inputMode="decimal" min="0.01" step="0.01" className={inputCls} value={precoEditando.normal} onChange={(e) => setPrecoEditando((p) => ({ ...p, normal: e.target.value }))} /></Campo>
                <Campo label="Preço da oferta (por)"><input type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="sem oferta" className={inputCls} value={precoEditando.promo} onChange={(e) => setPrecoEditando((p) => ({ ...p, promo: e.target.value }))} /></Campo>
              </div>
              <p className="mt-1 text-xs text-ink-soft">Deixe o preço da oferta vazio para mostrar só o preço normal.</p>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-ink">Ajustar na arte</p>
              <EditorCelula
                produto={{ ...comEstiloPadrao(fila.find((f) => f.id === seloEditando.id) || seloEditando), precoJornal: Number(String(precoEditando.promo).replace(',', '.')) || Number(String(precoEditando.normal).replace(',', '.')) || precoJornal(seloEditando) }}
                tema={temaArte}
                ajuste={ajusteEditando}
                onChange={setAjusteEditando}
              />
              <button
                type="button"
                role="switch"
                aria-checked={usarComoPadrao}
                onClick={() => setUsarComoPadrao((v) => !v)}
                className="mt-3 flex w-full items-center gap-3 rounded-xl border border-ink-soft/20 bg-white px-3 py-2.5 text-left hover:border-ink-soft/45"
              >
                <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150 motion-reduce:transition-none ${usarComoPadrao ? 'bg-success' : 'bg-ink-soft/30'}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-150 motion-reduce:transition-none ${usarComoPadrao ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">Usar como predefinido</span>
                  <span className="block text-xs text-ink-soft">{usarComoPadrao ? 'Ligado: este ajuste vale para todos os produtos sem ajuste próprio.' : 'Desligado: o ajuste vale só para este produto.'}</span>
                </span>
              </button>
            </div>
            {(() => {
              const atual = fila.find((f) => f.id === seloEditando.id) || seloEditando
              const dia = noMercadoEncarte(atual) ? atual.encarteMercadoDia : null
              return (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink"><Icon name="Star" size={16} fill={dia ? 'var(--color-offer)' : 'none'} className="text-bengala" /> Dia da oferta no Mercado Encarte</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {proximosDias.map((d, i) => (
                      <button key={d} type="button" onClick={() => diaDoMercado(atual, d)} aria-pressed={dia === d}
                        className={`min-h-10 rounded-lg border px-1 text-xs font-semibold ${dia === d ? 'border-bengala bg-bengala text-white' : 'border-ink-soft/20 bg-white text-ink hover:border-ink-soft/45'}`}>
                        {i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : rotuloDia(d)}
                      </button>
                    ))}
                    <button type="button" onClick={() => diaDoMercado(atual, null)} disabled={!dia}
                      className="min-h-10 rounded-lg border border-ink-soft/20 bg-white px-1 text-xs font-semibold text-ink-soft disabled:opacity-40">
                      Fora
                    </button>
                  </div>
                </div>
              )
            })()}
            {(() => {
              const atual = fila.find((f) => f.id === seloEditando.id) || seloEditando
              const estilo = atual.estiloPreco || estiloPrecoPadrao || 'oval'
              const noJornalTodo = !atual.estiloPreco && Boolean(estiloPrecoPadrao)
              return (
                <div>
                  <p className="mb-2 text-sm font-semibold text-ink">Estilo do preço</p>
                  <p className="mb-2 text-xs text-ink-soft">Aparece em todos os layouts do jornal, no Mercado Encarte e nas artes. Muda na hora.</p>
                  <SeletorEstiloPreco value={estilo} tema={temaArte} onChange={(id) => trocarEstiloPreco(atual, id, noJornalTodo)} />
                  <button
                    type="button"
                    role="switch"
                    aria-checked={noJornalTodo}
                    onClick={() => alternarEstiloNoJornalTodo(atual, estilo, !noJornalTodo)}
                    className="mt-3 flex w-full items-center gap-3 rounded-xl border border-ink-soft/20 bg-white px-3 py-2.5 text-left hover:border-ink-soft/45"
                  >
                    <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150 motion-reduce:transition-none ${noJornalTodo ? 'bg-success' : 'bg-ink-soft/30'}`}>
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-150 motion-reduce:transition-none ${noJornalTodo ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">Usar no jornal todo</span>
                      <span className="block text-xs text-ink-soft">{noJornalTodo ? 'Ligado: todos os produtos do jornal usam este estilo de preço.' : 'Desligado: o estilo vale só para este produto.'}</span>
                    </span>
                  </button>
                </div>
              )
            })()}
            <div>
              <p className="mb-2 text-sm font-semibold text-ink">Selo</p>
              <p className="mb-2 text-xs text-ink-soft">O selo aparece neste produto no encarte, nas artes e nos cartazes. Muda na hora.</p>
              <SeletorSelo
                value={(fila.find((f) => f.id === seloEditando.id) || seloEditando).seloOferta}
                onChange={(id) => trocarSelo(seloEditando, id)}
              />
              <BotaoAplicarTodos
                total={ativosDoModelo.length}
                onClick={() => seloEmTodos((fila.find((f) => f.id === seloEditando.id) || seloEditando).seloOferta)}
                descricao={`Os ${ativosDoModelo.length} produtos deste jornal passam a usar este selo. Depois dá para trocar um por um.`}
              >
                Aplicar este selo a todos
              </BotaoAplicarTodos>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(produtoEditandoGerador)}
        onClose={() => setProdutoEditandoGerador(null)}
        titulo="Corrigir produto"
        footer={<>
          <button type="button" className="mr-auto inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-critical hover:bg-critical/10" onClick={() => { removerDaFila(produtoEditandoGerador.id); toast(`${produtoEditandoGerador.nome} saiu da fila do jornal.`, 'info'); setProdutoEditandoGerador(null) }}><Icon name="Trash2" size={15} /> Tirar da fila</button>
          <Botao variante="contorno" onClick={() => setProdutoEditandoGerador(null)}>Cancelar</Botao>
          <Botao onClick={salvarProdutoGerador}>Salvar</Botao>
        </>}
      >
        {produtoEditandoGerador ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex items-center gap-3">
              <ProdutoThumb produto={produtoEditandoGerador} size={58} />
              <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-ink-soft/25 bg-white px-3 text-sm font-semibold text-ink hover:bg-cream-200">
                <Icon name="ImagePlus" size={16} /> Trocar imagem
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
            <div className="col-span-2"><Campo label="Validade (uso interno, não aparece no encarte)"><input type="date" className={inputCls} value={produtoEditandoGerador.validade || ''} onChange={(e) => setProdutoEditandoGerador((p) => ({ ...p, validade: e.target.value }))} /></Campo></div>
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

// Liga e desliga uma aba do site do cliente (vale na próxima publicação).
function ChaveSite({ ligado, titulo, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} onClick={() => onChange(!ligado)}
      className="flex w-full items-center gap-3 rounded-xl border border-ink-soft/20 bg-white px-3 py-2.5 text-left hover:border-ink-soft/45">
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150 motion-reduce:transition-none ${ligado ? 'bg-success' : 'bg-ink-soft/30'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-150 motion-reduce:transition-none ${ligado ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{titulo}</span>
        <span className="block text-xs text-ink-soft">{ligado ? 'Ligado: aparece como aba no site.' : 'Desligado: não aparece no site.'}</span>
      </span>
    </button>
  )
}

function SeletorEstiloPreco({ value, tema, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {ESTILOS_PRECO.map((e) => (
        <button key={e.id} type="button" onClick={() => onChange(e.id)} aria-pressed={value === e.id}
          className={`flex h-24 flex-col items-center justify-center gap-1.5 rounded-lg border bg-white px-1 ${value === e.id ? 'border-navy shadow-[inset_0_0_0_1px_var(--color-navy)]' : 'border-ink-soft/20 hover:border-ink-soft/45'}`}>
          <span className="flex h-12 items-center justify-center" aria-hidden="true">
            <PrecoArte valor={9.99} unidade="UNI" tema={tema} estilo={e.id} k={0.4} />
          </span>
          <span className="text-xs font-semibold text-ink">{e.nome}</span>
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
