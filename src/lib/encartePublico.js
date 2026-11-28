// Encarte digital publicado — o que a tag NFC abre.
//
// O app publica em dois lugares:
//   1. no servidor do PC do mercado (/api/encarte, ver server/encarteServidor.js),
//      que é o que os celulares dos clientes abrem pela tag NFC; e
//   2. neste aparelho (localStorage), como cópia de segurança se o servidor cair.
// A página pública lê do servidor e ouve /api/encarte/eventos: quando sai uma
// versão nova, ela troca sozinha, sem o cliente recarregar.
// Com o Supabase ligado (ver src/lib/nuvem.js), publica também na nuvem: o link funciona pela
// Vercel e pelo 4G, e todo celular aberto recebe a versão nova na hora.
//
// Regra de negócio: a validade do produto NUNCA sai daqui. Só passam os campos
// que o cliente pode ver.
import { restaurarImagensSalvas } from './produtoApi'
import { nuvemAtiva, publicarEncarteNuvem, lerEncarteNuvem, assinarNuvem, mercadoAtual, MERCADO_PADRAO, caminhoDoMercado } from './nuvem'

// Fotos que só existem no PC da loja (/api/...) viram imagem embutida e menor antes de ir para a
// nuvem, para abrir em qualquer celular.
async function fotoPortatil(src) {
  if (!src || typeof src !== 'string' || src.startsWith('data:') || /^https?:/i.test(src)) return src || null
  try {
    const r = await fetch(src)
    if (!r.ok) return null
    const bmp = await createImageBitmap(await r.blob())
    const k = Math.min(1, 600 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
    const g = c.getContext('2d')
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height)
    g.drawImage(bmp, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.82)
  } catch (_) {
    return null
  }
}

const CHAVE_BENGALA = 'clawmarket:encarte-publicado:v1'
// cópia neste aparelho, separada por mercado (o Bengala mantém a chave de sempre)
const chaveLocal = () => (mercadoAtual() === MERCADO_PADRAO ? CHAVE_BENGALA : `${CHAVE_BENGALA}:${mercadoAtual()}`)
const ehBengala = () => mercadoAtual() === MERCADO_PADRAO
const CANAL = 'clawmarket-encarte'

const CAMPOS_PUBLICOS = [
  'id', 'nome', 'marca', 'gramagem', 'setor', 'codigoBarras', 'seloOferta',
  'unidade', 'precoNormal', 'precoJornal', 'descontoJornal', 'origemFila',
  'imagem', 'imagemCachePermanente', 'imagemTratamento', 'ajusteArte', 'encarteMercadoDia', 'soMercado', 'estiloPreco',
]

const soPublico = (item) => {
  const limpo = {}
  for (const campo of CAMPOS_PUBLICOS) if (item[campo] !== undefined) limpo[campo] = item[campo]
  // fotos grandes em data: ficam no banco de imagens do aparelho; a página as restaura pelo código
  if (limpo.imagemCachePermanente && String(limpo.imagem || '').startsWith('data:')) limpo.imagem = null
  return limpo
}

// Template de cada setor, tamanho do logo e fundos por template também vão para o site:
// sem isso cada aba de setor caía no template padrão.
const extrasDoJornal = ({ temasSetor, temasV, escalaLogo, fundos, mostrarGeral, mostrarMercado, pausados, periodosSetor, marca, layoutsSetor }) => ({
  layoutsSetor: layoutsSetor && typeof layoutsSetor === 'object' ? Object.fromEntries(Object.entries(layoutsSetor).filter(([, v]) => ['grade', 'destaque', 'jornal', 'ancorado'].includes(v))) : {},
  // Cadastro do mercado (logo, lojas, pagamentos): o site do cliente mostra a marca dele.
  marca: marca && typeof marca === 'object' ? marca : null,
  // Setor publicado com datas próprias: { padaria: { de, ate } }. Sem isso, vale o período do jornal.
  periodosSetor: periodosSetor && typeof periodosSetor === 'object' ? periodosSetor : {},
  // Setores desligados para ajuste: a aba fica no site com o aviso "Ajustando ofertas".
  pausados: Array.isArray(pausados) ? [...new Set(pausados.filter(Boolean))] : [],
  // Abas do site que a loja pode esconder (sem valor = aparece).
  mostrarGeral: mostrarGeral !== false,
  mostrarMercado: mostrarMercado !== false,
  temasSetor: temasSetor && typeof temasSetor === 'object' ? temasSetor : {},
  temasV: temasV === 2 ? 2 : 1,
  escalaLogo: Number(escalaLogo) || 1,
  fundos: fundos && typeof fundos === 'object' ? fundos : {},
})

export function publicarEncarte({ titulo, mercado, periodoDe, periodoAte, tema, layout, fundo, loja, itens, ...resto }) {
  const encarte = {
    versao: Date.now(),
    publicadoEm: new Date().toISOString(),
    titulo,
    mercado,
    periodoDe,
    periodoAte,
    tema: tema || null,
    layout: layout || 'grade',
    fundo: fundo || null,
    ...extrasDoJornal(resto),
    loja: loja ? { nome: loja.nome, endereco: loja.endereco, cidade: loja.cidade, whatsapp: loja.whatsapp } : null,
    itens: (itens || []).map(soPublico),
  }
  try {
    localStorage.setItem(chaveLocal(), JSON.stringify(encarte))
  } catch (_) {
    // sem espaço: publica sem as fotos embutidas
    encarte.itens = encarte.itens.map((i) => (String(i.imagem || '').startsWith('data:') ? { ...i, imagem: null } : i))
    localStorage.setItem(chaveLocal(), JSON.stringify(encarte))
  }
  try {
    const canal = new BroadcastChannel(CANAL)
    canal.postMessage(encarte.versao)
    canal.close()
  } catch (_) {}
  return encarte
}

// ---------- servidor do encarte (o site da tag NFC) ----------
const API = '/api/encarte'
const CHAVE_SENHA = 'clawmarket:senha-publicacao'

export function lerSenhaPublicacao() {
  try { return localStorage.getItem(CHAVE_SENHA) || '' } catch (_) { return '' }
}
export function salvarSenhaPublicacao(senha) {
  try { senha ? localStorage.setItem(CHAVE_SENHA, senha) : localStorage.removeItem(CHAVE_SENHA) } catch (_) {}
}

const ehJson = (r) => (r.headers.get('content-type') || '').includes('application/json')

// { online, protegido } — se o servidor do encarte está no ar e se pede senha para publicar.
export async function statusSiteEncarte() {
  try {
    const r = await fetch(`${API}?status=1`, { cache: 'no-store' })
    if (!r.ok || !ehJson(r)) return { online: false, protegido: false }
    const j = await r.json()
    return { online: true, protegido: !!j.protegido, enderecos: Array.isArray(j.enderecos) ? j.enderecos : [] }
  } catch (_) {
    return { online: false, protegido: false }
  }
}

// Link que vai gravado na tag NFC. Aberto no próprio PC (localhost), troca pelo IP do PC na
// rede da loja, que é o endereço que o celular do cliente consegue abrir.
export function linkDoEncarte(enderecos = []) {
  const { protocol, hostname, port, pathname } = window.location
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname)
  const host = local && enderecos[0] ? `${enderecos[0]}${port ? `:${port}` : ''}` : window.location.host
  return `${protocol}//${host}${pathname}${caminhoDoMercado('encarte')}`
}

// Manda o encarte (com as fotos) para o servidor. Devolve { versao, publicadoEm, itens }.
export async function enviarEncarteAoSite({ titulo, mercado, periodoDe, periodoAte, tema, layout, fundo, loja, itens, ...resto }) {
  const comFotos = await restaurarImagensSalvas(itens || [])
  const corpo = {
    titulo, mercado, periodoDe, periodoAte, tema, layout, fundo: fundo || null,
    ...extrasDoJornal(resto),
    loja: loja ? { nome: loja.nome, endereco: loja.endereco, cidade: loja.cidade, whatsapp: loja.whatsapp } : null,
    itens: comFotos.map((item) => {
      const limpo = soPublico({ ...item, imagemCachePermanente: false })
      delete limpo.imagemCachePermanente
      delete limpo.imagemTratamento
      return limpo
    }),
  }
  if (nuvemAtiva()) {
    const encarte = {
      ...corpo,
      itens: await Promise.all(corpo.itens.map(async (i) => ({ ...i, imagem: await fotoPortatil(i.imagem) }))),
      versao: Date.now(),
      publicadoEm: new Date().toISOString(),
    }
    try {
      await publicarEncarteNuvem(encarte)
    } catch (_) {
      throw Object.assign(new Error('Não foi possível publicar na nuvem. Confira a internet e tente de novo.'), { codigo: 'erro' })
    }
    // O servidor do PC, se estiver no ar, recebe também (rede da loja); sem ele, tudo bem.
    // Ele é do Bengala: outro mercado nunca escreve nele.
    if (ehBengala()) { try { await enviarAoServidor(corpo) } catch (_) {} }
    return { versao: encarte.versao, publicadoEm: encarte.publicadoEm, itens: encarte.itens.length, origem: 'nuvem' }
  }
  if (!ehBengala()) throw Object.assign(new Error('Sem conexão com a nuvem. Confira a internet e tente de novo.'), { codigo: 'erro' })
  return enviarAoServidor(corpo)
}

async function enviarAoServidor(corpo) {
  const senha = lerSenhaPublicacao()
  let r
  try {
    r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(senha ? { 'x-encarte-token': senha } : {}) },
      body: JSON.stringify(corpo),
    })
  } catch (_) {
    throw Object.assign(new Error('Servidor do encarte fora do ar. Abra o app pelo PC do mercado (npm run dev ou npm run preview).'), { codigo: 'offline' })
  }
  if (!ehJson(r)) throw Object.assign(new Error('Este endereço não tem o servidor do encarte. Abra o app pelo PC do mercado.'), { codigo: 'offline' })
  const j = await r.json()
  if (!r.ok) throw Object.assign(new Error(j.erro || 'Não foi possível publicar no site.'), { codigo: r.status === 401 ? 'senha' : 'erro' })
  return j
}

async function lerDoSite() {
  try {
    const r = await fetch(API, { cache: 'no-store' })
    if (!ehJson(r)) return undefined
    if (r.status === 404) return null
    if (!r.ok) return undefined
    return { ...(await r.json()), origem: 'site' }
  } catch (_) {
    return undefined // sem servidor (ex.: app aberto direto do arquivo)
  }
}

export function lerEncartePublicado() {
  try {
    return JSON.parse(localStorage.getItem(chaveLocal()) || 'null')
  } catch (_) {
    return null
  }
}

// Lê do servidor; se ele não responder (ou ainda não tiver nada), usa a cópia deste aparelho.
// Uma cópia sem ofertas (ou uma leitura que falhou) nunca ganha de outra cópia que tem ofertas:
// o site do cliente não pode ficar vazio por causa de uma fonte só.
const temOfertas = (e) => Array.isArray(e?.itens) && e.itens.length > 0
export async function carregarEncartePublicado() {
  let reserva = null
  if (nuvemAtiva()) {
    const daNuvem = await lerEncarteNuvem()
    if (temOfertas(daNuvem)) return daNuvem
    // outro mercado: só vale a nuvem (o servidor do PC e a cópia do aparelho são do Bengala)
    if (mercadoAtual() !== MERCADO_PADRAO) return daNuvem || null
    // a loja tirou tudo do site de propósito (leitura deu certo e tem versão): vale o vazio
    if (daNuvem && daNuvem.versao) return daNuvem
    reserva = daNuvem || reserva
  }
  const doSite = await lerDoSite()
  if (temOfertas(doSite)) return doSite
  reserva = reserva || doSite || null
  const encarte = lerEncartePublicado()
  if (temOfertas(encarte)) {
    const itens = await restaurarImagensSalvas(encarte.itens || [])
    return { ...encarte, itens }
  }
  return reserva || encarte || null
}

// O encarte que está no ar agora, para publicar um jornal sem apagar os outros. Diferente da leitura
// do cliente, aqui uma falha é erro: publicar achando que não há nada no ar apagaria as ofertas.
export async function lerEncarteNoAr() {
  if (nuvemAtiva()) {
    const daNuvem = await lerEncarteNuvem()
    if (daNuvem === undefined) throw new Error('Não deu para conferir o que está no site agora. Veja a internet e tente de novo.')
    if (daNuvem) return daNuvem
    // outro mercado: o servidor do PC e a cópia deste aparelho são do Bengala, não valem
    if (mercadoAtual() !== MERCADO_PADRAO) return null
  }
  return (await lerDoSite()) || lerEncartePublicado() || null
}

// Chama `aoMudar(versao?)` sempre que uma nova versão for publicada. Devolve a função de cancelar.
// No celular do cliente o aviso vem do servidor (Server-Sent Events). Se a conexão
// cair de vez, confere a cada 30 s. Neste aparelho também ouve o localStorage.
export function assinarEncarte(aoMudar) {
  const naChave = (evento) => { if (evento.key === chaveLocal()) aoMudar() }
  const aoVoltar = () => { if (document.visibilityState === 'visible') aoMudar() }
  window.addEventListener('storage', naChave)
  document.addEventListener('visibilitychange', aoVoltar)
  let canal = null
  try {
    canal = new BroadcastChannel(CANAL)
    canal.onmessage = () => aoMudar()
  } catch (_) {}
  let fonte = null
  try {
    fonte = new EventSource(`${API}/eventos`)
    fonte.addEventListener('versao', (e) => aoMudar(Number(e.data) || undefined))
  } catch (_) {}
  let pararNuvem = null
  if (nuvemAtiva()) {
    try { pararNuvem = assinarNuvem(() => aoMudar(), 'encarte') } catch (_) {}
  }
  const reserva = setInterval(() => {
    if ((!fonte || fonte.readyState === 2) && document.visibilityState === 'visible') aoMudar()
  }, 30000)
  return () => {
    window.removeEventListener('storage', naChave)
    document.removeEventListener('visibilitychange', aoVoltar)
    canal?.close()
    fonte?.close()
    pararNuvem?.()
    clearInterval(reserva)
  }
}

// Fundo do template por tema (imagem exportada do template SEM os produtos).
const chaveFundo = (temaId) => `clawmarket:fundo-template:${temaId}`
export function lerFundoTemplate(temaId) {
  try { return localStorage.getItem(chaveFundo(temaId)) || null } catch (_) { return null }
}
export function salvarFundoTemplate(temaId, dataUrl) {
  try {
    if (dataUrl) localStorage.setItem(chaveFundo(temaId), dataUrl)
    else localStorage.removeItem(chaveFundo(temaId))
    return true
  } catch (_) {
    return false
  }
}
// Reduz a imagem para 1080 × 1350 (formato do post) em JPEG, para caber no aparelho.
export function prepararFundoTemplate(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
    leitor.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Arquivo de imagem inválido.'))
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = 1080
        canvas.height = 1350
        const ctx = canvas.getContext('2d')
        const escala = Math.max(1080 / img.width, 1350 / img.height)
        const w = img.width * escala
        const h = img.height * escala
        ctx.drawImage(img, (1080 - w) / 2, (1350 - h) / 2, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = leitor.result
    }
    leitor.readAsDataURL(arquivo)
  })
}


// Liga ou desliga um setor no site do cliente NA HORA, sem publicar o jornal de novo: pega o
// encarte que já está no ar, troca só a lista de setores em ajuste e grava (nuvem, PC e aparelho).
// Os celulares abertos recebem a mudança como uma versão nova.
export async function atualizarPausadosNoSite(pausados) {
  const lista = [...new Set((pausados || []).filter(Boolean))]
  const atual = await carregarEncartePublicado()
  if (!atual || !Array.isArray(atual.itens) || !atual.itens.length) return { semEncarte: true }
  const { origem: _origem, ...base } = atual
  const encarte = { ...base, pausados: lista, versao: Date.now() }
  let gravou = false
  if (nuvemAtiva()) {
    try { await publicarEncarteNuvem(encarte); gravou = true } catch (_) { /* tenta o PC */ }
  }
  if (ehBengala()) {
    try {
      const { versao: _v, publicadoEm: _p, ...corpo } = encarte
      await enviarAoServidor(corpo)
      gravou = true
    } catch (_) { /* sem servidor do PC: tudo bem se a nuvem gravou */ }
  }
  try {
    const local = lerEncartePublicado()
    if (local) {
      localStorage.setItem(chaveLocal(), JSON.stringify({ ...local, pausados: lista, versao: encarte.versao }))
      gravou = true
      try { const canal = new BroadcastChannel(CANAL); canal.postMessage(encarte.versao); canal.close() } catch (_) {}
    }
  } catch (_) { /* sem espaço */ }
  if (!gravou) throw new Error('Não foi possível avisar o site agora. Confira a internet e tente de novo.')
  return { versao: encarte.versao }
}
