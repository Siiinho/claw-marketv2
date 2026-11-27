import { useState, useRef, useEffect, useCallback } from 'react'
import { useStore } from '../store/StoreContext'
import { Icon, ProdutoThumb, EmptyState, Botao, Campo, inputCls, Modal, Secao, Rotulo, Escolha, ImagemSetor } from '../components/ui'
import ScannerJornal from '../components/ScannerJornal'
import CentralArtes from '../components/CentralArtes'
import {
  SETORES, setorById, formatBRL, MERCADO_ENCARTE,
  percentDesc, dataISOmaisDias, SELOS_OFERTA, plural, paraNumero,
} from '../lib/utils'
import { publicarEncarte, lerEncartePublicado, lerEncarteNoAr, lerFundoTemplate, salvarFundoTemplate, prepararFundoTemplate, enviarEncarteAoSite, atualizarPausadosNoSite, statusSiteEncarte, linkDoEncarte, lerSenhaPublicacao, salvarSenhaPublicacao } from '../lib/encartePublico'
import { remessaDe, precoNoJornal, itensDoDestino, montarPublicacao } from '../lib/remessa'
import { marcaPublica } from '../lib/marca'
import SeletorTema from '../components/SeletorTema'
import SeletorSelo, { BotaoAplicarTodos } from '../components/SeletorSelo'
import PrecoArte, { ESTILOS_PRECO, estiloPrecoById } from '../components/PrecoArte'
import EditorCelula from '../components/EditorCelula'
import { Escalado } from '../components/PaginaTemplate'
import FotoGoogle from '../components/FotoGoogle'
import { PaginaEncarte, paginarEncarte, tamanhoPagina, itensDaPagina, ehFormatoJornal } from '../components/JornalMercado'
import { temaCampanhaById } from '../lib/temasCampanha'
import { imprimirPaginas } from '../lib/exportar'
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

const NOMES_DIA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const rotuloDia = (iso) => {
  const [a, m, d] = String(iso).split('-').map(Number)
  return `${NOMES_DIA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
}
const TITULO_PADRAO = 'Jornal de Ofertas - Bengala Supermercado'

// Escolhas do jornal que está sendo montado, guardadas neste aparelho para não se perderem ao
// recarregar. Os produtos não ficam aqui: ficam na remessa (ver lib/remessa.js).
const CHAVE_RASCUNHO = 'clawmarket:jornal-rascunho:v2'
function lerRascunho() {
  try { return JSON.parse(localStorage.getItem(CHAVE_RASCUNHO) || '{}') || {} } catch (_) { return {} }
}
function salvarRascunho(dados) {
  try { localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(dados)) } catch (_) { /* sem espaço: segue sem guardar */ }
}
const destinoValido = (id) => (id === 'geral' || id === MERCADO_ENCARTE.id || SETORES.some((s) => s.id === id) ? id : 'geral')
// Data guardada de um jornal antigo não volta: o período começa hoje.
const dataValida = (iso, padrao) => (iso && iso >= dataISOmaisDias(0) ? iso : padrao)

const PASSOS = [
  { titulo: 'Bipar', ajuda: 'Bipe ou procure pelo nome. Só os produtos desta lista entram no jornal.' },
  { titulo: 'Preço e selo', ajuda: 'Confira o preço de cada produto. O que estiver escrito aqui sai no jornal.' },
  { titulo: 'Campanha', ajuda: 'Escolha a campanha e depois onde o jornal vai aparecer.' },
  { titulo: 'Publicar', ajuda: 'Confira, publique no site do cliente e imprima.' },
]

export default function Jornal() {
  const store = useStore()
  const { produtos, usuario, config, jornais, salvarProduto, salvarJornal, excluirJornal, removerDaFila, limparFila, toast } = store
  const [tela, setTela] = useState('montar') // montar | artes | historico
  const [passo, setPasso] = useState(0)
  const passosRef = useRef(null)
  const ehAdmin = usuario?.papel === 'admin'
  const inicial = useRef(null)
  if (!inicial.current) inicial.current = { rascunho: lerRascunho(), publicado: lerEncartePublicado() || {} }
  const { rascunho, publicado } = inicial.current

  // ---- o jornal que está sendo montado ----
  const remessa = remessaDe(produtos, usuario?.id)
  const [destino, setDestinoEstado] = useState(() => destinoValido(rascunho.destino))
  const destinoTocado = useRef(false)
  const setDestino = (id) => { destinoTocado.current = true; setDestinoEstado(id) }
  const [trocarTudo, setTrocarTudo] = useState(false)
  const [jornalVendo, setJornalVendo] = useState(null)
  const [jornalApagar, setJornalApagar] = useState(null)
  const [retirando, setRetirando] = useState(null)
  const ehMercado = destino === MERCADO_ENCARTE.id
  const ehSetor = destino !== 'geral' && !ehMercado
  const nomeDestino = ehMercado ? 'Jornal da estrela' : ehSetor ? setorById(destino).nome : 'Jornal geral'
  const [temaId, setTemaId] = useState(() => rascunho.tema || publicado.tema || 'ofertao')
  const [titulo, setTitulo] = useState(() => rascunho.titulo || TITULO_PADRAO)
  const [periodoDe, setPeriodoDe] = useState(() => dataValida(rascunho.periodoDe, dataISOmaisDias(0)))
  const [periodoAte, setPeriodoAte] = useState(() => dataValida(rascunho.periodoAte, dataISOmaisDias(6)))
  const [diaEstrela, setDiaEstrela] = useState(() => dataValida(rascunho.diaEstrela, dataISOmaisDias(0)))
  const [layout, setLayout] = useState(() => rascunho.layout || publicado.layout || 'grade')
  const [escalaLogo, setEscalaLogo] = useState(() => Number(rascunho.escalaLogo) || Number(publicado.escalaLogo) || 1)
  useEffect(() => {
    salvarRascunho({ destino, tema: temaId, titulo, periodoDe, periodoAte, diaEstrela, layout, escalaLogo })
  }, [destino, temaId, titulo, periodoDe, periodoAte, diaEstrela, layout, escalaLogo])

  const [exportando, setExportando] = useState(false)
  const [impresso, setImpresso] = useState(false)
  const [mostrarRevisao, setMostrarRevisao] = useState(false)
  const [confirmarNovo, setConfirmarNovo] = useState(false)
  // Aviso do caixa: o ClawMarket não muda o preço do sistema do mercado.
  const [caixaConferido, setCaixaConferido] = useState(false)
  const pausados = Array.isArray(config.setoresPausados) ? config.setoresPausados : []
  const [mudandoAjuste, setMudandoAjuste] = useState(null)
  const [acabouDePublicar, setAcabouDePublicar] = useState(false)
  const pageRefs = useRef([])
  const historicoRefs = useRef([])
  const revisaoRef = useRef(null)
  const [historicoParaAbrir, setHistoricoParaAbrir] = useState(null)
  const [produtoEditando, setProdutoEditando] = useState(null)
  const [seloEditando, setSeloEditando] = useState(null)
  const [precoEditando, setPrecoEditando] = useState({ normal: '', promo: '' })
  const [ajusteEditando, setAjusteEditando] = useState(null)
  // Ajuste predefinido (foto, preço, nome e etiqueta): vale para todo produto que não tem ajuste próprio.
  const ajustePadrao = config.ajustePadraoArte || null
  const estiloPrecoPadrao = config.estiloPrecoPadrao || null
  const comEstiloPadrao = (p) => (p.estiloPreco || !estiloPrecoPadrao ? p : { ...p, estiloPreco: estiloPrecoPadrao })
  const comAjustePadrao = (p) => comEstiloPadrao(p.ajusteArte || !ajustePadrao ? p : { ...p, ajusteArte: ajustePadrao })
  const [usarComoPadrao, setUsarComoPadrao] = useState(false)
  const produtoAtual = (p) => remessa.find((f) => f.id === p.id) || p
  const abrirProdutoDaPrevia = (produto) => {
    const atual = produtoAtual(produto)
    setPrecoEditando({ normal: atual.precoNormal ?? '', promo: atual.precoPromo ?? '' })
    setAjusteEditando(atual.ajusteArte || ajustePadrao)
    setUsarComoPadrao(!atual.ajusteArte && Boolean(ajustePadrao))
    setSeloEditando(atual)
  }

  const [publicadoEm, setPublicadoEm] = useState(publicado.publicadoEm || null)
  const [publicando, setPublicando] = useState(false)
  const [site, setSite] = useState({ online: null, protegido: false, erro: null })
  const [senhaPublicacao, setSenhaPublicacao] = useState(lerSenhaPublicacao)
  useEffect(() => {
    let ativo = true
    statusSiteEncarte().then((st) => { if (ativo) setSite((s) => ({ ...s, ...st })) })
    return () => { ativo = false }
  }, [])
  const linkEncarte = linkDoEncarte(site.enderecos)
  const [copiado, setCopiado] = useState(null) // 'link' | 'precos'
  const copiar = async (qual, texto) => {
    try { await navigator.clipboard.writeText(texto); setCopiado(qual); setTimeout(() => setCopiado(null), 2500) } catch (_) { window.prompt('Copie:', texto) }
  }
  const [fundo, setFundo] = useState(null)
  useEffect(() => { setFundo(lerFundoTemplate(temaId)) }, [temaId])
  const trocarFundo = async (arquivo) => {
    if (!arquivo) return
    try {
      const dataUrl = await prepararFundoTemplate(arquivo)
      if (!salvarFundoTemplate(temaId, dataUrl)) return toast('Imagem grande demais para guardar neste aparelho.', 'erro')
      setFundo(dataUrl)
      toast('Fundo salvo para esta campanha.')
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
    const pendentes = remessaDe(produtos, usuario?.id).filter((p) => (imagemProdutoPrecisaTratamento(p) || fotoRuimParaJornal(p)) && !fotosTentadas.current.has(chaveFoto(p)))
    if (!pendentes.length) return () => { ativo = false }
    ;(async () => {
      for (const produto of pendentes) {
        fotosTentadas.current.add(chaveFoto(produto))
        const preparado = await prepararProdutoParaJornal(produto)
        if (!ativo) return
        const mudou = preparado !== produto && (preparado.imagem !== produto.imagem || preparado.imagemTratamento !== produto.imagemTratamento || preparado.imagemFonteUrl !== produto.imagemFonteUrl)
        if (preparado.imagemTratada && mudou) {
          // só a foto: o preço pode ter mudado enquanto ela era preparada
          salvarProduto({ id: produto.id, ...Object.fromEntries(Object.entries(preparado).filter(([k, v]) => k.startsWith('imagem') && v !== undefined)) })
        }
      }
    })()
    return () => { ativo = false }
  }, [produtos, usuario?.id, salvarProduto])

  useEffect(() => {
    if (!historicoParaAbrir) return
    let ativo = true
    const timer = requestAnimationFrame(async () => {
      try {
        const paginas = historicoRefs.current.slice(0, paginasDoHistorico(historicoParaAbrir.jornal).length)
        await imprimirPaginas(paginas, historicoParaAbrir.jornal.titulo)
      } catch (erro) {
        if (ativo) toast(erro?.message || 'Não foi possível abrir o jornal salvo.', 'erro')
      } finally {
        if (ativo) setHistoricoParaAbrir(null)
      }
    })
    return () => { ativo = false; cancelAnimationFrame(timer) }
  }, [historicoParaAbrir, toast])

  // ---- montagem do conteúdo ----
  const ordemSetor = (p) => Math.max(0, SETORES.findIndex((s) => s.id === p.setor))
  // Remessa toda de um setor: já vai para o jornal daquele setor (o geral trocaria o site inteiro).
  const setorUnico = remessa.length && remessa.every((p) => p.setor && p.setor === remessa[0].setor) ? remessa[0].setor : null
  useEffect(() => {
    if (setorUnico && !destinoTocado.current && destino === 'geral') setDestinoEstado(setorUnico)
  }, [setorUnico, destino])
  const itensJornal = [...itensDoDestino(remessa, destino)].sort((a, b) => ordemSetor(a) - ordemSetor(b))
  const foraDoSetor = ehSetor ? remessa.filter((p) => p.setor !== destino) : []
  const paraArte = (p) => comAjustePadrao({
    ...p,
    precoJornal: precoNoJornal(p),
    descontoJornal: percentDesc(p.precoNormal, precoNoJornal(p)),
    encarteMercadoDia: ehMercado ? diaEstrela : null,
  })
  const itensArte = itensJornal.map(paraArte)
  // O jornal da estrela sai sempre no formato jornal da semana.
  const layoutAtual = ehMercado ? 'jornal' : layout
  const paginasJornal = paginarEncarte(itensArte, layoutAtual)
  const tamanho = tamanhoPagina(layoutAtual)
  const temaArte = temaCampanhaById(temaId)
  const validadeDe = ehMercado ? diaEstrela : periodoDe
  const validadeAte = ehMercado ? diaEstrela : periodoAte && periodoAte >= periodoDe ? periodoAte : periodoDe
  const encarteArte = { periodoDe: validadeDe, periodoAte: validadeAte }
  const lojaAtual = (store.lojas || []).find((l) => l.id === store.lojaAtiva) || (store.lojas || [])[0]
  const contagemSetor = (id) => remessa.filter((p) => p.setor === id).length
  const proximosDias = Array.from({ length: 7 }, (_, i) => dataISOmaisDias(i))

  const semPreco = remessa.filter((p) => !(precoNoJornal(p) > 0))
  // Erros dos campos de preço do passo 2 (o que está escrito e ainda não foi gravado).
  const [errosPreco, setErrosPreco] = useState({})
  const marcarErro = useCallback((id, erro) => setErrosPreco((atual) => ((atual[id] || null) === erro ? atual : { ...atual, [id]: erro })), [])
  const linhaComErro = remessa.find((p) => errosPreco[p.id])
  const problemas = [
    ...itensJornal.filter((p) => !p.nome?.trim()).map(() => ({ nivel: 'erro', texto: 'Existe um produto sem nome.' })),
    ...itensJornal.filter((p) => !(precoNoJornal(p) > 0)).map((p) => ({ nivel: 'erro', texto: `${p.nome}: falta o preço.` })),
    ...itensJornal.filter((p) => !p.imagem).map((p) => ({ nivel: 'aviso', texto: `${p.nome}: está sem foto.` })),
    ...itensJornal.filter((p) => p.imagem && !imagemCompativelComPDF(p.imagem)).map((p) => ({ nivel: 'aviso', texto: `${p.nome}: a foto pode não sair na impressão.` })),
    ...itensJornal.filter((p) => p.imagem && p.imagemAltaResolucao === false).map((p) => ({ nivel: 'aviso', texto: `${p.nome}: foto com resolução baixa.` })),
  ]
  const bloqueios = problemas.filter((p) => p.nivel === 'erro')
  const ofertas = itensJornal.filter((p) => paraNumero(p.precoPromo))
  const listaDePrecos = itensJornal
    .map((p) => `${p.codigoBarras ? `${p.codigoBarras}  ` : ''}${p.nome}: ${formatBRL(precoNoJornal(p))}`)
    .join('\n')

  // ---- passos ----
  const irPara = (i) => {
    setPasso(i)
    requestAnimationFrame(() => passosRef.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }))
  }
  const focarBusca = () => setTimeout(() => document.querySelector('#scanner-jornal input')?.focus(), 80)
  const irParaScanner = () => { setTela('montar'); irPara(0); focarBusca() }
  const podeIr = (i) => i === 0 || remessa.length > 0
  const avancar = () => {
    if (!remessa.length) { focarBusca(); return toast('Bipe ao menos um produto para continuar.', 'erro') }
    if (passo === 1 && linhaComErro) return toast(`${linhaComErro.nome}: ${errosPreco[linhaComErro.id]}`, 'erro')
    if (passo === 1 && semPreco.length) return toast(`Falta o preço de ${semPreco[0].nome}.`, 'erro')
    irPara(Math.min(PASSOS.length - 1, passo + 1))
  }
  // Remessa esvaziada por outro aparelho: volta para o bipe.
  useEffect(() => { if (passo > 0 && !remessa.length) setPasso(0) }, [passo, remessa.length])
  // O que está no ar muda de passo em diante: conferência do caixa vale só para esta lista.
  const assinaturaPrecos = itensJornal.map((p) => `${p.id}:${precoNoJornal(p)}`).join('|')
  useEffect(() => { setCaixaConferido(false) }, [assinaturaPrecos])

  const tirarDoJornal = (p) => {
    salvarProduto({ id: p.id, remessaPor: null, remessaEm: null })
    removerDaFila(p.id)
    toast(`${p.nome} saiu do jornal.`, 'info')
  }
  const comecarOutro = () => {
    remessa.forEach((p) => salvarProduto({ id: p.id, remessaPor: null, remessaEm: null }))
    setConfirmarNovo(false)
    setAcabouDePublicar(false)
    setImpresso(false)
    destinoTocado.current = false
    setDestinoEstado('geral')
    setTrocarTudo(false)
    setTitulo(TITULO_PADRAO)
    setPeriodoDe(dataISOmaisDias(0))
    setPeriodoAte(dataISOmaisDias(6))
    setDiaEstrela(dataISOmaisDias(0))
    setTela('montar')
    irPara(0)
    focarBusca()
  }

  // ---- imprimir e salvar ----
  const criarSnapshot = () => ({
    titulo,
    tipo: ehSetor ? 'setor' : ehMercado ? 'estrela' : 'geral',
    setor: ehSetor ? destino : null,
    validadeDe,
    validadeAte,
    totalItens: itensJornal.length,
    totalPaginas: paginasJornal.length,
    temaArte: temaId,
    escalaLogo,
    layoutArte: layoutAtual,
    fundoArte: fundo,
    produtos: itensArte.map((p) => ({ ...p, precoJornalCalculado: p.precoJornal, descontoJornalCalculado: p.descontoJornal })),
  })

  const imprimir = async () => {
    if (bloqueios.length) {
      setMostrarRevisao(true)
      requestAnimationFrame(() => revisaoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
      return toast(`Antes de imprimir: ${bloqueios[0].texto}`, 'erro')
    }
    setExportando(true)
    try {
      salvarJornal(criarSnapshot())
      await imprimirPaginas(pageRefs.current.slice(0, paginasJornal.length), titulo)
      setImpresso(true)
    } catch (e) {
      console.error('Erro ao imprimir o jornal:', e)
      toast(e?.message || 'Não foi possível imprimir. Recarregue a página e tente novamente.', 'erro')
    } finally {
      setExportando(false)
    }
  }

  // ---- publicar ----
  const publicar = async () => {
    if (!itensJornal.length) return toast('Este jornal está sem produtos.', 'erro')
    if (bloqueios.length) { setMostrarRevisao(true); return toast(bloqueios[0].texto, 'erro') }
    if (!caixaConferido) return toast('Antes, marque que os preços já estão no caixa.', 'erro')
    setPublicando(true)
    try {
      const noAr = await lerEncarteNoAr()
      const montado = montarPublicacao({ noAr, itens: itensArte, destino, tema: temaId, fundo, periodoDe: validadeDe, periodoAte: validadeAte, layout, escalaLogo, trocarTudo })
      const dados = {
        ...montado,
        titulo: destino === 'geral' ? titulo : noAr?.titulo || titulo,
        mercado: config.nomeMercado,
        mostrarGeral: config.siteMostrarGeral !== false,
        mostrarMercado: config.siteMostrarMercado !== false,
        pausados,
        loja: lojaAtual,
        marca: marcaPublica(config.mercado),
      }
      const r = await enviarEncarteAoSite(dados)
      const local = publicarEncarte(dados)
      setPublicadoEm(r.publicadoEm || local.publicadoEm)
      setSite((s) => ({ ...s, online: true, erro: null, publicadoEm: r.publicadoEm }))
      // A fila acompanha o que está no ar (a aba Cartazes usa a mesma lista).
      const ids = new Set(itensJornal.map((p) => p.id))
      const saem = produtos.filter((p) => p.naFila && !ids.has(p.id) && (destino === 'geral' ? !p.remessaPor || p.remessaPor === usuario?.id : ehSetor && p.setor === destino))
      if (saem.length) limparFila(saem.map((p) => p.id))
      if (ehMercado) {
        produtos.filter((p) => p.encarteMercadoDia && !ids.has(p.id)).forEach((p) => salvarProduto({ id: p.id, encarteMercadoDia: null }))
        itensJornal.forEach((p) => salvarProduto({ id: p.id, encarteMercadoDia: diaEstrela }))
      }
      salvarJornal(criarSnapshot())
      setAcabouDePublicar(true)
      toast(`${nomeDestino} no ar com ${plural(itensJornal.length, 'produto', 'produtos')}.`)
    } catch (erro) {
      setSite((s) => ({ ...s, online: erro.codigo !== 'offline', protegido: s.protegido || erro.codigo === 'senha', erro: erro.message }))
      toast(erro.message, 'erro')
    } finally {
      setPublicando(false)
    }
  }

  // Tira do site as ofertas de um jornal salvo (o resto do site continua). O jornal fica no histórico.
  const retirarDoSite = async (jornal) => {
    setRetirando(jornal.id)
    try {
      const noAr = await lerEncarteNoAr()
      const ids = new Set((jornal.produtos || []).map((p) => p.id))
      const antes = noAr?.itens || []
      const tira = (p) => ids.has(p.id) && (jornal.tipo !== 'setor' || p.setor === jornal.setor)
      const itens = antes.filter((p) => !tira(p))
      if (!noAr || itens.length === antes.length) { toast('As ofertas deste jornal já não estão no site.', 'info'); return }
      const ficam = new Set(itens.map((p) => p.setor))
      const limpar = (obj) => Object.fromEntries(Object.entries(obj || {}).filter(([s]) => s === MERCADO_ENCARTE.id || ficam.has(s)))
      await enviarEncarteAoSite({ ...noAr, itens, temasSetor: limpar(noAr.temasSetor), periodosSetor: limpar(noAr.periodosSetor) })
      toast(`${plural(antes.length - itens.length, 'oferta saiu', 'ofertas saíram')} do site.`)
    } catch (erro) {
      toast(erro?.message || 'Não deu para retirar agora. Tente de novo.', 'erro')
    } finally {
      setRetirando(null)
    }
  }

  // Desliga (ou religa) um setor no site na hora, sem publicar o jornal de novo.
  const alternarAjuste = async (setorId, pausar) => {
    const nome = setorById(setorId).nome
    const novos = pausar ? [...new Set([...pausados, setorId])] : pausados.filter((id) => id !== setorId)
    store.salvarConfig({ setoresPausados: novos })
    setMudandoAjuste(setorId)
    try {
      const r = await atualizarPausadosNoSite(novos)
      toast(r.semEncarte
        ? `Guardado. ${nome} ${pausar ? 'entra em ajuste' : 'volta'} quando o jornal for publicado.`
        : pausar ? `${nome} desligado: o site mostra "Ajustando ofertas" agora.` : `${nome} voltou ao site com as ofertas.`, pausar ? 'info' : 'sucesso')
    } catch (erro) {
      toast(`${erro.message} A chave vale na próxima publicação.`, 'erro')
    } finally {
      setMudandoAjuste(null)
    }
  }

  // ---- edição de produto ----
  const trocarSelo = (produto, seloOferta) => salvarProduto({ id: produto.id, seloOferta })
  const seloEmTodos = (seloOferta) => {
    const id = seloOferta || 'nenhum'
    remessa.filter((p) => (p.seloOferta || 'nenhum') !== id).forEach((p) => salvarProduto({ id: p.id, seloOferta: id }))
    const selo = SELOS_OFERTA.find((s) => s.id === id)
    toast(selo?.nenhum ? 'Todos os produtos ficaram sem selo.' : `Selo "${selo?.texto}" em todos os produtos.`)
  }
  const salvarPrecoDaPrevia = () => {
    const normal = paraNumero(precoEditando.normal)
    const promo = String(precoEditando.promo).trim() ? paraNumero(precoEditando.promo) : null
    if (!(normal > 0)) return toast('Informe o preço normal.', 'erro')
    if (promo !== null && !(promo > 0 && promo < normal)) return toast('O preço da oferta precisa ser menor que o normal.', 'erro')
    if (usarComoPadrao) {
      // Vira o ajuste de todos os produtos sem ajuste próprio; este produto passa a seguir o padrão.
      store.salvarConfig({ ajustePadraoArte: ajusteEditando })
      salvarProduto({ id: seloEditando.id, precoNormal: normal, precoPromo: promo, ajusteArte: null })
    } else {
      salvarProduto({ id: seloEditando.id, precoNormal: normal, precoPromo: promo, ajusteArte: ajusteEditando })
    }
    setSeloEditando(null)
  }
  const estiloPrecoNoJornalTodo = (estiloPreco) => {
    store.salvarConfig({ estiloPrecoPadrao: estiloPreco })
    remessa.filter((p) => p.estiloPreco).forEach((p) => salvarProduto({ id: p.id, estiloPreco: null }))
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
  const salvarProdutoEditado = () => {
    const normal = paraNumero(produtoEditando.precoNormal)
    const promo = paraNumero(produtoEditando.precoPromo)
    if (!produtoEditando?.nome?.trim()) return toast('Informe o nome do produto.', 'erro')
    if (!(normal > 0)) return toast('Informe um preço válido.', 'erro')
    if (promo && promo >= normal) return toast('O preço da oferta precisa ser menor que o normal.', 'erro')
    salvarProduto({ ...produtoEditando, precoNormal: normal, precoPromo: promo || null })
    setProdutoEditando(null)
  }
  const trocarImagem = (arquivo) => {
    if (!arquivo) return
    const leitor = new FileReader()
    leitor.onload = () => setProdutoEditando((produto) => ({
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

  const textoDestino = destino === 'geral'
    ? (trocarTudo ? 'Começa do zero: tira do site os setores que não estão aqui. O jornal da estrela continua.' : 'Troca só os setores destes produtos. Os outros setores que já estão no site continuam.')
    : ehMercado
      ? 'Troca só o jornal da estrela. O geral e os setores continuam.'
      : `Troca só ${nomeDestino}. Os outros setores continuam.`
  const jornalVazio = itensJornal.length === 0

  const previa = (paginas) => paginas.map((itens, indice) => (
    <div key={indice} className="mx-auto w-full max-w-[680px] space-y-1.5">
      {paginasJornal.length > 1 && (
        <div className="flex items-center justify-between px-1 text-xs text-ink-soft">
          <span className="font-semibold text-ink">Página {indice + 1} de {paginasJornal.length}</span>
          <span>{plural(itensDaPagina(itens, layoutAtual).length, 'produto', 'produtos')}</span>
        </div>
      )}
      <div className="overflow-hidden rounded-xl shadow-[0_10px_30px_rgba(8,43,79,.14)] ring-1 ring-black/5">
        <Escalado largura={tamanho.largura} altura={tamanho.altura}>
          <PaginaEncarte tema={temaArte} pagina={itens} encarte={encarteArte} loja={lojaAtual} fundo={fundo} layout={layoutAtual} numero={indice + 1} total={paginasJornal.length} onAbrir={abrirProdutoDaPrevia} escalaLogo={escalaLogo} />
        </Escalado>
      </div>
    </div>
  ))

  const rodape = (
    <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 flex items-center gap-2 rounded-2xl border border-ink-soft/15 bg-white p-2.5 shadow-[0_-6px_24px_rgba(8,43,79,.12)] md:bottom-4">
      {passo > 0 && <Botao variante="contorno" className="min-h-12 px-3 sm:px-4" onClick={() => irPara(passo - 1)} aria-label="Voltar um passo"><Icon name="ArrowLeft" size={18} /> <span className="hidden sm:inline">Voltar</span></Botao>}
      <Botao className="min-h-12 min-w-0 flex-1 text-base" onClick={avancar} disabled={!remessa.length}>
        {passo === 0 && remessa.length ? `Continuar com ${plural(remessa.length, 'produto', 'produtos')}` : `Continuar: ${PASSOS[passo + 1]?.titulo || ''}`} <Icon name="ArrowRight" size={18} />
      </Botao>
    </div>
  )

  return (
    <div className="space-y-4">
      {tela !== 'montar' ? (
        <Botao variante="contorno" onClick={() => setTela('montar')}><Icon name="ArrowLeft" size={17} /> Voltar ao jornal</Botao>
      ) : (
        <>
          <ol ref={passosRef} className="grid scroll-mt-20 grid-cols-4 gap-1.5 md:gap-2" aria-label="Passos para montar o jornal">
            {PASSOS.map((p, i) => {
              const atual = passo === i
              const feito = i < passo
              return (
                <li key={p.titulo} className="min-w-0">
                  <button type="button" onClick={() => irPara(i)} disabled={!podeIr(i)} aria-current={atual ? 'step' : undefined}
                    className={`flex h-full w-full min-w-0 flex-col items-center gap-1 rounded-xl border-2 px-1 py-2 text-center disabled:opacity-45 md:flex-row md:gap-3 md:px-3 md:text-left ${atual ? 'border-navy bg-navy text-white' : 'border-navy/25 bg-white text-ink'}`}>
                    <span className={`num-tab flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base font-bold ${atual ? 'bg-offer text-navy' : feito ? 'bg-success text-white' : 'bg-cream-200 text-ink-soft'}`}>
                      {feito ? <Icon name="Check" size={17} strokeWidth={2.75} /> : i + 1}
                    </span>
                    <span className={`text-[13px] font-extrabold leading-tight md:text-base ${atual ? 'text-white' : 'text-navy'}`}>{p.titulo}</span>
                  </button>
                </li>
              )
            })}
          </ol>
          <p className="px-1 text-base font-semibold text-ink">{PASSOS[passo].ajuda}</p>
        </>
      )}

      {/* ============ 1. BIPAR ============ */}
      {tela === 'montar' && passo === 0 && (
        <div className="mx-auto max-w-3xl space-y-4">
          <Secao>
            <ScannerJornal />
          </Secao>
          {remessa.length > 0 && (
            <Secao
              titulo={`${plural(remessa.length, 'produto', 'produtos')} neste jornal`}
              acao={<button type="button" onClick={() => setConfirmarNovo(true)} className="min-h-10 px-1 text-sm font-bold text-critical hover:underline">Limpar lista</button>}
            >
              <ul className="divide-y divide-ink-soft/10">
                {[...remessa].reverse().map((p) => (
                  <li key={p.id} className="flex min-w-0 items-center gap-3 py-2">
                    <ProdutoThumb produto={p} size={40} />
                    <span className="min-w-0 flex-1 break-words text-base font-semibold leading-snug text-ink">{p.nome}</span>
                    <button type="button" onClick={() => tirarDoJornal(p)} aria-label={`Tirar ${p.nome} do jornal`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-soft hover:bg-critical/10 hover:text-critical"><Icon name="X" size={20} /></button>
                  </li>
                ))}
              </ul>
            </Secao>
          )}
          {remessa.length > 0 && rodape}
          <p className="flex flex-wrap justify-center gap-x-5 gap-y-1 pt-2 text-sm">
            <button type="button" onClick={() => setTela('historico')} className="inline-flex min-h-10 items-center gap-1.5 font-semibold text-navy hover:underline"><Icon name="History" size={16} /> Jornais salvos{jornais.length ? ` (${jornais.length})` : ''}</button>
            <a href="#/encarte" target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1.5 font-semibold text-navy hover:underline"><Icon name="ExternalLink" size={16} /> Ver o site do cliente</a>
          </p>
        </div>
      )}

      {/* ============ 2. PREÇO E SELO ============ */}
      {tela === 'montar' && passo === 1 && (
        <div className="mx-auto max-w-4xl space-y-4">
          <Secao>
            {remessa.length > 1 && (
              <label className="mb-3 flex flex-wrap items-center gap-2 border-b border-ink-soft/10 pb-3 text-sm font-bold text-ink">
                Mesmo selo em todos:
                <select className={`${inputCls.replace('w-full ', '')} min-h-11`} value="" onChange={(e) => e.target.value && seloEmTodos(e.target.value)}>
                  <option value="">Escolher selo</option>
                  {SELOS_OFERTA.map((s) => <option key={s.id} value={s.id}>{s.nenhum ? 'Sem selo' : s.texto}</option>)}
                </select>
              </label>
            )}
            <ul className="divide-y divide-ink-soft/10">
              {remessa.map((p) => (
                <LinhaPreco key={p.id} produto={p} onErro={marcarErro} onSalvar={salvarProduto} onSelo={(id) => trocarSelo(p, id)} onEditar={() => setProdutoEditando({ ...p })} onTirar={() => tirarDoJornal(p)} toast={toast} />
              ))}
            </ul>
          </Secao>
          {rodape}
        </div>
      )}

      {/* ============ 3. TEMPLATE E DESTINO ============ */}
      {tela === 'montar' && passo === 2 && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <div className="min-w-0 space-y-4">
            <Secao titulo="Escolha a campanha">
              <SeletorTema todos value={temaId} onChange={setTemaId} />
            </Secao>
            <Secao titulo="Onde este jornal vai aparecer?" descricao={textoDestino}>
              <div className="grid gap-2 sm:grid-cols-2">
                <Escolha ativo={destino === 'geral'} onClick={() => setDestino('geral')} icone="Store" titulo="Jornal geral" descricao="O jornal principal do mercado" extra={remessa.length} />
                <Escolha ativo={ehMercado} onClick={() => setDestino(MERCADO_ENCARTE.id)} icone="Star" iconeCor="var(--color-bengala)" titulo="Jornal da estrela" descricao="As ofertas especiais do dia" extra={remessa.length} />
              </div>
              {destino === 'geral' && (
                <label className="mt-3 flex min-h-11 items-start gap-2 rounded-xl bg-cream-200/60 p-3 text-sm font-semibold text-ink">
                  <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-navy)]" checked={trocarTudo} onChange={(e) => setTrocarTudo(e.target.checked)} />
                  <span>Começar o jornal do zero <span className="block font-normal text-ink-soft">Tira do site os setores que não estão neste jornal.</span></span>
                </label>
              )}
              <Rotulo className="mt-5">Ou só um setor</Rotulo>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {SETORES.map((s) => {
                  const n = contagemSetor(s.id)
                  const ativo = destino === s.id
                  return (
                    <button key={s.id} type="button" onClick={() => setDestino(s.id)} aria-pressed={ativo}
                      className={`flex min-h-12 min-w-0 items-center gap-2 rounded-lg border-2 px-2.5 text-left text-sm ${ativo ? 'border-navy bg-navy/[0.045] font-bold text-navy' : `border-ink-soft/20 bg-white font-semibold hover:border-ink-soft/45 ${n ? 'text-ink' : 'text-ink-soft'}`}`}>
                      <ImagemSetor id={s.id} size={24} />
                      <span className="min-w-0 flex-1 truncate">{s.nome}</span>
                      {n > 0 && <span className="num-tab shrink-0 text-xs font-bold text-ink">{n}</span>}
                    </button>
                  )
                })}
              </div>
              {foraDoSetor.length > 0 && (
                <div className="mt-3 rounded-xl border-2 border-offer bg-offer/15 p-3 text-sm text-ink">
                  <p className="font-bold">{plural(foraDoSetor.length, 'produto é', 'produtos são')} de outro setor e não {foraDoSetor.length === 1 ? 'entra' : 'entram'} neste jornal:</p>
                  <p className="mt-0.5">{foraDoSetor.slice(0, 4).map((p) => `${p.nome} (${setorById(p.setor).nome})`).join(', ')}{foraDoSetor.length > 4 ? ` e mais ${foraDoSetor.length - 4}` : ''}.</p>
                  <button type="button" onClick={() => foraDoSetor.forEach((p) => salvarProduto({ id: p.id, setor: destino }))} className="mt-1 min-h-10 font-bold text-navy underline underline-offset-2">Passar {foraDoSetor.length === 1 ? 'ele' : 'todos'} para {nomeDestino}</button>
                </div>
              )}
              {ehMercado && (
                <>
                  <Rotulo className="mt-5">Em que dia vale?</Rotulo>
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
                    {proximosDias.map((d, i) => (
                      <button key={d} type="button" onClick={() => setDiaEstrela(d)} aria-pressed={diaEstrela === d}
                        className={`min-h-11 rounded-lg border-2 px-1 text-xs font-bold ${diaEstrela === d ? 'border-bengala bg-bengala text-white' : 'border-ink-soft/20 bg-white text-ink'}`}>
                        {i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : rotuloDia(d)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </Secao>

            <details className="card-bengala p-4">
              <summary className="cursor-pointer text-base font-bold text-navy">Mais ajustes (opcional)</summary>
              {destino === 'geral' && (
                <>
                  <Rotulo className="mt-4">Disposição dos produtos</Rotulo>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      ['grade', 'LayoutGrid', 'Grade 3 × 3', 'Até 9 por página'],
                      ['destaque', 'LayoutPanelTop', '1 destaque + 7', 'O primeiro sai grande'],
                      ['jornal', 'Newspaper', 'Jornal da semana', 'Muitos por página'],
                      ['ancorado', 'LayoutDashboard', 'Ancorado', 'Destaques com a big idea'],
                    ].map(([id, icone, nome, desc]) => (
                      <Escolha key={id} ativo={layout === id} onClick={() => setLayout(id)} icone={icone} titulo={nome} descricao={desc} />
                    ))}
                  </div>
                  <Rotulo className="mt-5" acao={<span className="num-tab text-sm font-semibold text-ink">{Math.round(escalaLogo * 100)}%</span>}>Tamanho do logo</Rotulo>
                  <input type="range" min="0.4" max="1.3" step="0.05" value={escalaLogo} onChange={(e) => setEscalaLogo(Number(e.target.value))} className="w-full accent-navy" aria-label="Tamanho do logo" />
                </>
              )}
              <Rotulo className="mt-5">Fundo próprio para {temaArte.nome}</Rotulo>
              <p className="text-xs text-ink-soft">Arte de 1080 × 1350 sem produtos, sem logo e sem validade.</p>
              <div className="mt-2 flex items-center gap-2">
                {fundo && <img src={fundo} alt="Fundo da campanha" className="h-14 w-11 rounded object-cover ring-1 ring-black/10" />}
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border-2 border-navy/35 bg-white px-3 text-sm font-bold text-navy hover:bg-cream">
                  <Icon name="ImageUp" size={16} /> {fundo ? 'Trocar fundo' : 'Enviar fundo'}
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => { trocarFundo(e.target.files?.[0]); e.target.value = '' }} />
                </label>
                {fundo && <button type="button" className="min-h-11 px-2 text-sm font-semibold text-critical hover:underline" onClick={() => { salvarFundoTemplate(temaId, null); setFundo(null) }}>Remover</button>}
              </div>
              <Rotulo className="mt-5">O que aparece no site do cliente</Rotulo>
              <div className="grid gap-1.5">
                <ChaveSite ligado={config.siteMostrarGeral !== false} titulo="Aba do jornal geral" onChange={(v) => store.salvarConfig({ siteMostrarGeral: v })} />
                <ChaveSite ligado={config.siteMostrarMercado !== false} titulo="Aba do jornal da estrela" onChange={(v) => store.salvarConfig({ siteMostrarMercado: v })} />
              </div>
              {(ehSetor || pausados.length > 0) && (
                <>
                  <Rotulo className="mt-5">Desligar um setor do site para ajustar</Rotulo>
                  <div className="grid gap-1.5">
                    {[...new Set([...(ehSetor ? [destino] : []), ...pausados])].map((id) => (
                      <ChaveAjuste key={id} noAr={!pausados.includes(id)} nome={setorById(id).nome} ocupado={mudandoAjuste === id} onChange={(noAr) => alternarAjuste(id, !noAr)} />
                    ))}
                  </div>
                </>
              )}
            </details>
            {rodape}
          </div>
          <div className="min-w-0 space-y-2 lg:sticky lg:top-4">
            <h2 className="text-base font-bold text-navy">Como vai ficar</h2>
            {jornalVazio
              ? <p className="rounded-xl border-2 border-dashed border-ink-soft/25 bg-white p-5 text-center text-sm text-ink-soft">Nenhum produto deste jornal é de {nomeDestino}.</p>
              : previa(paginasJornal.slice(0, 1))}
            {paginasJornal.length > 1 && <p className="text-center text-xs text-ink-soft">e mais {plural(paginasJornal.length - 1, 'página', 'páginas')} no próximo passo</p>}
          </div>
        </div>
      )}

      {/* ============ 4. PUBLICAR ============ */}
      {tela === 'montar' && passo === 3 && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start">
          <div className="min-w-0 space-y-4">
            {acabouDePublicar ? (
              <Secao>
                <div className="text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success text-white"><Icon name="Check" size={30} strokeWidth={2.75} /></span>
                  <h2 className="mt-3 text-2xl font-extrabold text-navy">{nomeDestino} no ar</h2>
                  <p className="mt-1 text-base font-medium text-ink">Quem abrir o site do cliente já vê.</p>
                </div>
                <div className="mt-5 grid gap-2">
                  <Botao onClick={imprimir} disabled={exportando} className="min-h-12 w-full text-base"><Icon name={exportando ? 'LoaderCircle' : 'Printer'} size={18} className={exportando ? 'animate-spin' : ''} /> {exportando ? 'Preparando…' : impresso ? 'Imprimir de novo' : 'Imprimir jornal'}</Botao>
                  <a href="#/encarte" target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border-2 border-navy/40 bg-white text-sm font-bold text-navy hover:bg-cream"><Icon name="ExternalLink" size={17} /> Ver como o cliente vê</a>
                  <Botao variante="contorno" className="min-h-12" onClick={() => setTela('artes')}><Icon name="Images" size={17} /> Artes para redes sociais</Botao>
                  <Botao variante="escuro" className="min-h-12" onClick={comecarOutro}><Icon name="FilePlus2" size={17} /> Começar outro jornal</Botao>
                  <button type="button" onClick={() => setAcabouDePublicar(false)} className="min-h-10 text-sm font-semibold text-navy hover:underline">Corrigir e publicar de novo</button>
                </div>
              </Secao>
            ) : (
              <Secao>
                <dl className="grid gap-2 text-base">
                  <Resumo rotulo="Jornal" valor={nomeDestino} onMudar={() => irPara(2)} />
                  <Resumo rotulo="Produtos" valor={plural(itensJornal.length, 'produto', 'produtos')} onMudar={() => irPara(1)} />
                  <Resumo rotulo="Campanha" valor={temaArte.nome} onMudar={() => irPara(2)} />
                </dl>
                <p className="mt-2 text-sm text-ink-soft">{textoDestino}</p>

                {ehMercado ? (
                  <p className="mt-4 text-base font-bold text-ink">Vale só em {rotuloDia(diaEstrela)}.</p>
                ) : (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Campo label="Ofertas de"><input type="date" className={`${inputCls} min-h-11`} value={periodoDe} onChange={(e) => setPeriodoDe(e.target.value)} /></Campo>
                    <Campo label="até"><input type="date" className={`${inputCls} min-h-11`} value={periodoAte} min={periodoDe} onChange={(e) => setPeriodoAte(e.target.value)} /></Campo>
                  </div>
                )}

                {problemas.length > 0 && (
                  <div ref={revisaoRef} className={`mt-4 scroll-mt-4 rounded-xl border p-3 ${bloqueios.length ? 'border-critical/30 bg-critical/5' : 'border-warning/40 bg-warning/10'}`}>
                    <button type="button" onClick={() => setMostrarRevisao((v) => !v)} aria-expanded={mostrarRevisao} className="flex w-full items-center gap-2 text-left text-sm font-semibold text-ink">
                      <Icon name={bloqueios.length ? 'TriangleAlert' : 'Info'} size={18} className={`shrink-0 ${bloqueios.length ? 'text-critical' : 'text-[#86590b]'}`} />
                      <span className="min-w-0 flex-1">{bloqueios.length ? plural(bloqueios.length, 'item impede publicar', 'itens impedem publicar') : plural(problemas.length, 'aviso de foto', 'avisos de foto')}</span>
                      <Icon name={mostrarRevisao ? 'ChevronUp' : 'ChevronDown'} size={16} className="shrink-0 text-ink-soft" />
                    </button>
                    {mostrarRevisao && (
                      <ul className="mt-2 space-y-1.5 border-t border-ink-soft/10 pt-2">
                        {problemas.map((x, i) => <li key={`${x.texto}-${i}`} className={`text-xs ${x.nivel === 'erro' ? 'text-critical' : 'text-ink'}`}>{x.texto}</li>)}
                      </ul>
                    )}
                  </div>
                )}

                <div className="mt-4 rounded-xl border-2 border-offer bg-offer/15 p-3">
                  <p className="flex items-start gap-2 text-sm font-bold text-ink"><Icon name="TriangleAlert" size={19} className="mt-0.5 shrink-0 text-[#86590b]" /> O ClawMarket não muda o preço do caixa. Altere também no sistema do mercado.</p>
                  <button type="button" onClick={() => copiar('precos', listaDePrecos)} disabled={jornalVazio} className="mt-1.5 inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-navy underline underline-offset-2 disabled:opacity-50"><Icon name={copiado === 'precos' ? 'Check' : 'Copy'} size={15} /> {copiado === 'precos' ? 'Lista copiada' : `Copiar a lista de preços (${ofertas.length ? plural(ofertas.length, 'oferta', 'ofertas') : plural(itensJornal.length, 'produto', 'produtos')})`}</button>
                  <label className="mt-1.5 flex min-h-12 cursor-pointer items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm font-bold text-ink">
                    <input type="checkbox" checked={caixaConferido} onChange={(e) => setCaixaConferido(e.target.checked)} className="h-6 w-6 shrink-0 accent-navy" />
                    Conferi: estes preços já estão no caixa
                  </label>
                </div>

                {site.protegido && (
                  <div className="mt-4">
                    <Campo label="Senha de publicação">
                      <input type="password" autoComplete="current-password" className={inputCls} value={senhaPublicacao} onChange={(e) => { setSenhaPublicacao(e.target.value); salvarSenhaPublicacao(e.target.value) }} />
                    </Campo>
                  </div>
                )}

                <div className="mt-4 grid gap-2">
                  <Botao onClick={publicar} disabled={publicando || jornalVazio || !caixaConferido} className="min-h-14 w-full text-lg">
                    <Icon name={publicando ? 'LoaderCircle' : 'Send'} size={20} className={publicando ? 'animate-spin' : ''} /> {publicando ? 'Publicando…' : 'Publicar no site do cliente'}
                  </Botao>
                  <div className="grid grid-cols-2 gap-2">
                    <Botao variante="contorno" className="min-h-12" onClick={() => irPara(2)}><Icon name="ArrowLeft" size={17} /> Voltar</Botao>
                    <Botao variante="contorno" className="min-h-12" onClick={imprimir} disabled={exportando || jornalVazio}><Icon name={exportando ? 'LoaderCircle' : 'Printer'} size={17} className={exportando ? 'animate-spin' : ''} /> {exportando ? 'Preparando…' : 'Só imprimir'}</Botao>
                  </div>
                </div>
                {site.erro && <p className="mt-3 rounded-xl bg-critical/10 px-3 py-2.5 text-sm font-semibold text-critical" role="alert">{site.erro}</p>}
              </Secao>
            )}
            {ehAdmin && site.online && !site.erro && (
              <div className="rounded-xl bg-cream-200 px-3 py-2.5 text-xs text-ink">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1"><span className="block font-semibold">Link do jornal (QR code e tag)</span><span className="block break-all text-ink-soft">{linkEncarte}</span></span>
                  <button type="button" onClick={() => copiar('link', linkEncarte)} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-ink-soft/25 bg-white px-2.5 font-semibold text-ink"><Icon name={copiado === 'link' ? 'Check' : 'Copy'} size={14} /> {copiado === 'link' ? 'Copiado' : 'Copiar'}</button>
                </div>
                {publicadoEm && <div className="mt-1.5 text-ink-soft">Última publicação: {new Date(publicadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.</div>}
              </div>
            )}
          </div>
          <div className="min-w-0 space-y-4">
            {jornalVazio
              ? <p className="rounded-xl border-2 border-dashed border-ink-soft/25 bg-white p-5 text-center text-sm text-ink-soft">Nenhum produto deste jornal é de {nomeDestino}. Volte e escolha outro destino.</p>
              : <><p className="text-sm font-semibold text-ink-soft">Toque num produto para ajustar foto, preço e selo.</p>{previa(paginasJornal)}</>}
            {!ehMercado && itensJornal.length > 18 && !ehFormatoJornal(layoutAtual) && destino === 'geral' && (
              <div className="flex items-center gap-3 rounded-xl bg-offer/20 p-3 text-sm">
                <span className="flex-1 font-semibold text-navy">São muitos produtos. O jornal da semana põe todos em menos folhas.</span>
                <Botao variante="escuro" className="min-h-10 shrink-0 px-3" onClick={() => setLayout('jornal')}>Usar</Botao>
              </div>
            )}
          </div>

          {/* cópias em tamanho real, fora da tela, usadas para imprimir */}
          {!jornalVazio && (
            <div className="pointer-events-none fixed top-0" style={{ left: -20000 }} aria-hidden="true">
              {paginasJornal.map((itens, indice) => (
                <div key={indice} ref={(el) => { pageRefs.current[indice] = el }} style={{ width: tamanho.largura, height: tamanho.altura }}>
                  <PaginaEncarte tema={temaArte} pagina={itens} encarte={encarteArte} loja={lojaAtual} fundo={fundo} layout={layoutAtual} numero={indice + 1} total={paginasJornal.length} escalaLogo={escalaLogo} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============ ARTES (Feed, Stories, TV, post) ============ */}
      {tela === 'artes' && (
        <CentralArtes
          saidas={['feed', 'stories', 'tv', 'post']}
          subtitulo="Cartazes e etiquetas para imprimir ficam na aba Cartazes."
          itens={itensArte}
          titulo={titulo}
          encarte={encarteArte}
          loja={lojaAtual}
          temaId={temaId}
          setTemaId={setTemaId}
          escalaLogo={escalaLogo}
          layout={layout}
          setLayout={setLayout}
          fundo={fundo}
          toast={toast}
          onBipar={irParaScanner}
        />
      )}

      {/* ============ HISTÓRICO ============ */}
      {tela === 'historico' && (
        <Secao titulo="Jornais salvos" descricao="Ver: abre o jornal daquele dia. Retirar do site: tira essas ofertas do site do cliente (fica salvo aqui). Lixeira: apaga daqui.">
          {jornais.length === 0 ? (
            <EmptyState icon="History" titulo="Nenhum jornal salvo" descricao="Ao publicar ou imprimir, o jornal aparece aqui." />
          ) : (
            <ul className="divide-y divide-ink-soft/10">
              {jornais.map((jornal) => (
                <li key={jornal.id} className="flex min-w-0 items-center gap-3 py-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cream-200 text-navy"><Icon name="Newspaper" size={19} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-bold text-ink">{jornal.tipo === 'setor' && jornal.setor ? setorById(jornal.setor).nome : jornal.tipo === 'estrela' ? 'Jornal da estrela' : 'Jornal geral'}</span>
                    <span className="block text-sm text-ink-soft">{plural(jornal.totalItens, 'produto', 'produtos')} · {new Date(jornal.criadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  </span>
                  <Botao variante="contorno" className="shrink-0 px-3" onClick={() => setJornalVendo(jornal)} aria-label={`Ver ${jornal.titulo}`}><Icon name="Eye" size={15} /> <span className="hidden sm:inline">Ver</span></Botao>
                  <Botao variante="contorno" className="shrink-0 px-3" disabled={retirando === jornal.id} onClick={() => retirarDoSite(jornal)} aria-label="Retirar estas ofertas do site"><Icon name="EyeOff" size={15} /> <span className="hidden sm:inline">{retirando === jornal.id ? 'Retirando…' : 'Retirar do site'}</span></Botao>
                  <button type="button" onClick={() => setJornalApagar(jornal)} aria-label={`Apagar ${jornal.titulo}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-soft hover:bg-critical/10 hover:text-critical"><Icon name="Trash2" size={16} /></button>
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
                tema={temaCampanhaById(historicoParaAbrir.jornal.temaArte || temaId)}
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
        open={!!jornalVendo}
        onClose={() => setJornalVendo(null)}
        largura="max-w-3xl"
        titulo={jornalVendo ? `${jornalVendo.tipo === 'setor' && jornalVendo.setor ? setorById(jornalVendo.setor).nome : jornalVendo.tipo === 'estrela' ? 'Jornal da estrela' : 'Jornal geral'} · ${new Date(jornalVendo.criadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : ''}
        footer={jornalVendo && <>
          <Botao variante="contorno" onClick={() => setJornalVendo(null)}>Fechar</Botao>
          <Botao variante="escuro" onClick={() => { setHistoricoParaAbrir({ jornal: jornalVendo }) }}><Icon name="Printer" size={15} /> Imprimir</Botao>
        </>}
      >
        {jornalVendo && (
          <div className="space-y-4">
            {paginasDoHistorico(jornalVendo).map((itens, indice, todas) => (
              <div key={indice} className="overflow-hidden rounded-xl shadow ring-1 ring-black/5">
                <Escalado largura={tamanhoPagina(jornalVendo.layoutArte).largura} altura={tamanhoPagina(jornalVendo.layoutArte).altura}>
                  <PaginaEncarte tema={temaCampanhaById(jornalVendo.temaArte || temaId)} pagina={itens} encarte={{ periodoDe: jornalVendo.validadeDe, periodoAte: jornalVendo.validadeAte }} loja={lojaAtual} fundo={jornalVendo.fundoArte || null} layout={jornalVendo.layoutArte || 'grade'} escalaLogo={jornalVendo.escalaLogo} numero={indice + 1} total={todas.length} />
                </Escalado>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={!!jornalApagar}
        onClose={() => setJornalApagar(null)}
        titulo="Apagar este jornal salvo?"
        footer={<>
          <Botao variante="contorno" onClick={() => setJornalApagar(null)}>Cancelar</Botao>
          <Botao variante="escuro" onClick={() => { excluirJornal(jornalApagar.id); setJornalApagar(null); toast('Jornal apagado do histórico.', 'info') }}>Apagar</Botao>
        </>}
      >
        <p className="text-ink">Ele sai só desta lista. Se as ofertas dele estiverem no site, continuam lá (use "Retirar do site" para tirar).</p>
      </Modal>

      <Modal
        open={confirmarNovo}
        onClose={() => setConfirmarNovo(false)}
        titulo="Limpar a lista?"
        footer={<>
          <Botao variante="contorno" onClick={() => setConfirmarNovo(false)}>Cancelar</Botao>
          <Botao variante="escuro" onClick={comecarOutro}>Limpar e começar</Botao>
        </>}
      >
        <p className="text-base text-ink">{plural(remessa.length, 'produto sai', 'produtos saem')} deste jornal. Continuam cadastrados, e o site do cliente não muda.</p>
      </Modal>

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
                produto={{ ...comEstiloPadrao(produtoAtual(seloEditando)), precoJornal: Number(String(precoEditando.promo).replace(',', '.')) || Number(String(precoEditando.normal).replace(',', '.')) || precoNoJornal(seloEditando) }}
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
              const atual = produtoAtual(seloEditando)
              const estilo = atual.estiloPreco || estiloPrecoPadrao || 'oval'
              const noJornalTodo = !atual.estiloPreco && Boolean(estiloPrecoPadrao)
              return (
                <div>
                  <p className="mb-2 text-sm font-semibold text-ink">Estilo do preço</p>
                  <p className="mb-2 text-xs text-ink-soft">Aparece no jornal e nas artes. Muda na hora.</p>
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
                value={(produtoAtual(seloEditando)).seloOferta}
                onChange={(id) => trocarSelo(seloEditando, id)}
              />
              <BotaoAplicarTodos
                total={remessa.length}
                onClick={() => seloEmTodos((produtoAtual(seloEditando)).seloOferta)}
                descricao={`Os ${remessa.length} produtos deste jornal passam a usar este selo. Depois dá para trocar um por um.`}
              >
                Aplicar este selo a todos
              </BotaoAplicarTodos>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(produtoEditando)}
        onClose={() => setProdutoEditando(null)}
        titulo="Corrigir produto"
        footer={<>
          <Botao variante="contorno" onClick={() => setProdutoEditando(null)}>Cancelar</Botao>
          <Botao onClick={salvarProdutoEditado}>Salvar</Botao>
        </>}
      >
        {produtoEditando ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex items-center gap-3">
              <ProdutoThumb produto={produtoEditando} size={58} />
              <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-ink-soft/25 bg-white px-3 text-sm font-semibold text-ink hover:bg-cream-200">
                <Icon name="ImagePlus" size={16} /> Trocar imagem
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(evento) => trocarImagem(evento.target.files?.[0])}
                />
              </label>
            </div>
            <FotoGoogle className="col-span-2" produto={produtoEditando} toast={toast} salvaNaHora onFoto={(foto) => { salvarProduto({ id: produtoEditando.id, ...foto }); setProdutoEditando((p) => (p ? { ...p, ...foto } : p)) }} />
            <div className="col-span-2"><Campo label="Nome"><input className={inputCls} value={produtoEditando.nome || ''} onChange={(e) => setProdutoEditando((p) => ({ ...p, nome: e.target.value }))} /></Campo></div>
            <Campo label="Marca"><input className={inputCls} value={produtoEditando.marca || ''} onChange={(e) => setProdutoEditando((p) => ({ ...p, marca: e.target.value }))} /></Campo>
            <Campo label="Gramagem"><input className={inputCls} value={produtoEditando.gramagem || ''} onChange={(e) => setProdutoEditando((p) => ({ ...p, gramagem: e.target.value }))} /></Campo>
            <div className="col-span-2"><Campo label="Setor (em qual jornal ele entra)"><SeletorSetor value={produtoEditando.setor} onChange={(setor) => setProdutoEditando((p) => ({ ...p, setor }))} /></Campo></div>
            <Campo label="Selo da oferta"><SeletorSelo value={produtoEditando.seloOferta} onChange={(seloOferta) => setProdutoEditando((p) => ({ ...p, seloOferta }))} /></Campo>
            <Campo label="Vendido por"><SeletorUnidade value={produtoEditando.unidade} setor={produtoEditando.setor} onChange={(unidade) => setProdutoEditando((p) => ({ ...p, unidade }))} /></Campo>
            <Campo label="Preço normal"><input type="number" min="0.01" step="0.01" className={inputCls} value={produtoEditando.precoNormal ?? ''} onChange={(e) => setProdutoEditando((p) => ({ ...p, precoNormal: e.target.value }))} /></Campo>
            <Campo label="Preço de oferta"><input type="number" min="0.01" step="0.01" className={inputCls} value={produtoEditando.precoPromo ?? ''} onChange={(e) => setProdutoEditando((p) => ({ ...p, precoPromo: e.target.value }))} /></Campo>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

function Resumo({ rotulo, valor, onMudar }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg bg-cream-200 px-3 py-2">
      <dt className="w-20 shrink-0 text-sm font-semibold text-ink-soft">{rotulo}</dt>
      <dd className="min-w-0 flex-1 truncate font-bold text-ink">{valor}</dd>
      <button type="button" onClick={onMudar} className="min-h-10 shrink-0 text-sm font-bold text-navy underline underline-offset-2">Mudar</button>
    </div>
  )
}

// Uma linha do passo 2: preço normal, preço da oferta e selo. Grava ao sair do campo.
function LinhaPreco({ produto, onSalvar, onSelo, onEditar, onTirar, onErro, toast }) {
  const texto = (v) => (v === null || v === undefined || v === '' ? '' : String(v).replace('.', ','))
  const [normal, setNormal] = useState(() => texto(produto.precoNormal))
  const [promo, setPromo] = useState(() => texto(produto.precoPromo))
  // Mudou por fora (edição completa, outro aparelho): acompanha.
  useEffect(() => { setNormal(texto(produto.precoNormal)) }, [produto.precoNormal])
  useEffect(() => { setPromo(texto(produto.precoPromo)) }, [produto.precoPromo])
  const vNormal = paraNumero(normal)
  const vPromo = paraNumero(promo)
  const promoAlta = Boolean(vPromo) && Boolean(vNormal) && vPromo >= vNormal
  // Campo com erro segura o Continuar: o que está escrito precisa ser o que vai sair.
  const erro = promoAlta ? 'A oferta precisa ser menor que o preço normal.' : !vNormal ? 'Falta o preço normal.' : null
  useEffect(() => { onErro(produto.id, erro); return () => onErro(produto.id, null) }, [erro, produto.id, onErro])
  const gravar = () => {
    if (promoAlta) return toast('O preço da oferta precisa ser menor que o normal.', 'erro')
    if ((vNormal || null) === (paraNumero(produto.precoNormal) || null) && (vPromo || null) === (paraNumero(produto.precoPromo) || null)) return undefined
    return onSalvar({ id: produto.id, precoNormal: vNormal || null, precoPromo: vPromo || null })
  }
  const campo = `${inputCls} num-tab min-h-12 text-lg font-bold`
  const aoTeclar = (e) => { if (e.key === 'Enter') e.currentTarget.blur() }
  return (
    <li className="py-3">
      <div className="flex min-w-0 items-center gap-3">
        <ProdutoThumb produto={produto} size={48} />
        <span className="min-w-0 flex-1 break-words text-base font-bold leading-snug text-ink">{produto.nome}</span>
        <button type="button" onClick={onEditar} aria-label={`Editar ${produto.nome}`} title="Editar nome, foto e setor" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-navy/35 bg-white text-navy hover:bg-cream"><Icon name="Pencil" size={18} /></button>
        <button type="button" onClick={onTirar} aria-label={`Tirar ${produto.nome} do jornal`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-soft hover:bg-critical/10 hover:text-critical"><Icon name="X" size={20} /></button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1.2fr]">
        <Campo label="Preço normal"><input inputMode="decimal" className={`${campo} ${!vNormal ? 'border-critical' : ''}`} value={normal} placeholder="0,00" onChange={(e) => setNormal(e.target.value)} onBlur={gravar} onKeyDown={aoTeclar} /></Campo>
        <Campo label="Preço da oferta"><input inputMode="decimal" className={`${campo} ${promoAlta ? 'border-critical' : vPromo ? 'border-success text-success' : ''}`} value={promo} placeholder="sem oferta" onChange={(e) => setPromo(e.target.value)} onBlur={gravar} onKeyDown={aoTeclar} /></Campo>
        <div className="col-span-2 sm:col-span-1">
          <Campo label="Selo">
            <select className={`${inputCls} min-h-12 text-base`} value={produto.seloOferta || 'nenhum'} onChange={(e) => onSelo(e.target.value)}>
              {SELOS_OFERTA.map((s) => <option key={s.id} value={s.id}>{s.nenhum ? 'Sem selo' : s.texto}</option>)}
            </select>
          </Campo>
        </div>
      </div>
      {erro && <p className="mt-1 text-sm font-semibold text-critical">{erro}</p>}
    </li>
  )
}

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

// Desliga o jornal de um setor no site para ajustar preços: a aba continua lá, com o aviso
// "Ajustando ofertas" no lugar dos produtos. Muda na hora, sem publicar de novo.
function ChaveAjuste({ noAr, nome, ocupado, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={noAr} disabled={ocupado} onClick={() => onChange(!noAr)}
      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left disabled:opacity-60 ${noAr ? 'border-ink-soft/20 bg-white hover:border-ink-soft/45' : 'border-critical/40 bg-critical/5 hover:border-critical/60'}`}>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150 motion-reduce:transition-none ${noAr ? 'bg-success' : 'bg-critical'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-150 motion-reduce:transition-none ${noAr ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{noAr ? 'No ar' : 'Desligado para ajuste'}</span>
        <span className="block text-xs text-ink-soft">{noAr
          ? `Desligue para ajustar ${nome}: o site mostra "Ajustando ofertas" na hora.`
          : `O cliente vê "Ajustando ofertas" em ${nome}. Ligue de novo quando terminar.`}</span>
      </span>
      {ocupado && <Icon name="LoaderCircle" size={16} className="shrink-0 animate-spin text-ink-soft" />}
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
