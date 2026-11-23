// Catálogos usados ao bipar um código de barras:
//  1. Mercadologia do Bengala (preço, estoque e setor reais da loja). Os produtos que também
//     estão na base de 28 mil ganharam a descrição completa e a foto dela (`foto: 1`); o preço
//     continua sempre o da loja. Gerado por scripts/mesclar-mercadologia.py.
//  2. Base de produtos (descrição, seção e foto, SEM preço), carregada só quando o código não
//     está no catálogo da loja. Fica em public/catalogo/base-produtos.json.
// A foto vem da pasta de imagens do PC da loja (/api/imagens-produtos/<ean>.jpg) ou de
// VITE_IMAGENS_BASE_URL (ex.: um bucket público), quando a foto existir lá.
let catalogoPromise
let basePromise
const fotoConferida = new Map()

const somenteDigitos = (valor) => String(valor || '').replace(/\D/g, '')
const BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || './'
const ENV = (typeof import.meta !== 'undefined' && import.meta.env) || {}
// Cópia das fotos na nuvem: a pasta pública "produtos" do Supabase (ou VITE_IMAGENS_BASE_URL).
const IMAGENS_BASE = (ENV.VITE_IMAGENS_BASE_URL || (ENV.VITE_SUPABASE_URL ? `${ENV.VITE_SUPABASE_URL}/storage/v1/object/public/produtos` : '/api/imagens-produtos')).replace(/\/+$/, '')

async function carregarCatalogo() {
  if (!catalogoPromise) {
    catalogoPromise = import('../data/catalogoMercadologiaBengala.json').then((modulo) => {
      const dados = modulo.default || modulo
      return new Map((dados.produtos || []).map((produto) => [produto.codigoBarras, produto]))
    })
  }
  return catalogoPromise
}

async function carregarBase() {
  if (!basePromise) {
    basePromise = fetch(`${BASE_URL}catalogo/base-produtos.json`, { cache: 'force-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((dados) => {
        if (!dados?.produtos) return { mapa: new Map(), categorias: [] }
        return { mapa: new Map(dados.produtos.map((linha) => [linha[0], linha])), categorias: dados.meta?.categorias || [] }
      })
      .catch(() => { basePromise = null; return { mapa: new Map(), categorias: [] } })
  }
  return basePromise
}

// Pastas onde procurar a foto, na ordem: a pasta de imagens do PC da loja (servida pelo próprio
// PC em /api/imagens-produtos) e a cópia na nuvem (VITE_IMAGENS_BASE_URL), que vale em qualquer
// aparelho para os produtos que o PC já enviou.
const PASTAS_FOTOS = [...new Set(['/api/imagens-produtos', IMAGENS_BASE])]
export const ehFotoDaPastaLocal = (url) => String(url || '').startsWith('/api/imagens-produtos/')

async function existeFoto(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-store' })
    return r.ok && (r.headers.get('content-type') || '').startsWith('image/')
  } catch (_) {
    return false
  }
}

// Endereço da foto do produto, se ela existir na pasta de imagens (confere uma vez por código).
export async function fotoDoCatalogo(codigo) {
  const c = somenteDigitos(codigo)
  if (!c || typeof fetch !== 'function' || globalThis.location?.protocol === 'file:') return null
  if (fotoConferida.has(c)) return fotoConferida.get(c)
  const tentativa = (async () => {
    for (const pasta of PASTAS_FOTOS) {
      const nomes = c.length < 13 ? [c, c.padStart(13, '0')] : [c]
      for (const nome of nomes) {
        for (const ext of pasta.startsWith('/api/') ? ['jpg'] : ['jpg', 'png', 'webp']) {
          const url = `${pasta}/${nome}.${ext}`
          if (await existeFoto(url)) return url
        }
      }
    }
    return null
  })()
  fotoConferida.set(c, tentativa)
  return tentativa
}

async function buscarNaBase(codigoBarras) {
  const { mapa, categorias } = await carregarBase()
  const linha = mapa.get(codigoBarras) || mapa.get(codigoBarras.replace(/^0+/, ''))
  if (!linha) return null
  const [ean, nome, setor, , cat] = linha
  return {
    codigoInterno: ean,
    codigoBarras: ean,
    nome,
    setor,
    categoria: categorias[cat] || '',
    unidade: 'UN',
    // O preço é sempre o da loja: produto fora da mercadologia pede o preço na hora de bipar.
    precoNormal: '',
    estoque: 0,
    origemCatalogo: 'base-produtos',
  }
}

export async function buscarProdutoBengala(codigo) {
  const codigoBarras = somenteDigitos(codigo)
  if (!codigoBarras) return null
  const catalogo = await carregarCatalogo()
  const produto = catalogo.get(codigoBarras) || catalogo.get(codigoBarras.padStart(13, '0')) || await buscarNaBase(codigoBarras)
  if (!produto) return null
  const imagem = await fotoDoCatalogo(produto.codigoBarras || codigoBarras)
  return imagem ? { ...produto, imagem, imagemOrigem: 'catalogo', imagemOrigemNome: 'Banco de imagens do mercado', imagemAprovada: true } : produto
}

// Códigos da mercadologia da loja que têm foto na base: são as fotos que o PC envia à nuvem
// para aparecerem em qualquer celular (a base inteira passaria do espaço grátis).
export async function codigosComFotoDaLoja() {
  const catalogo = await carregarCatalogo()
  return [...catalogo.values()].filter((p) => p.foto).map((p) => p.codigoBarras)
}

export async function totalProdutosBengala() {
  const [catalogo, base] = await Promise.all([carregarCatalogo(), carregarBase()])
  return catalogo.size + base.mapa.size
}

// ---------- busca pelo nome ----------
// Procura nos dois catálogos (mercadologia da loja + base de 28 mil) por todas as palavras
// digitadas, sem ligar para acento nem maiúscula. "arroz tio 5" acha "ARROZ TIO JOÃO 5KG".
export const normalizarBusca = (texto) => String(texto || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

let indicePromise
async function carregarIndiceNomes() {
  if (!indicePromise) {
    indicePromise = Promise.all([carregarCatalogo(), carregarBase()]).then(([catalogo, base]) => {
      const lista = []
      const vistos = new Set()
      for (const p of catalogo.values()) {
        vistos.add(p.codigoBarras)
        vistos.add(String(p.codigoBarras).replace(/^0+/, ''))
        lista.push({ codigoBarras: p.codigoBarras, nome: p.nome, setor: p.setor, precoNormal: p.precoNormal ?? null, origem: 'loja', chave: normalizarBusca(p.nome) })
      }
      for (const linha of base.mapa.values()) {
        const [ean, nome, setor] = linha
        if (vistos.has(ean) || vistos.has(String(ean).replace(/^0+/, ''))) continue
        lista.push({ codigoBarras: ean, nome, setor, precoNormal: null, origem: 'base', chave: normalizarBusca(nome) })
      }
      return lista
    }).catch((erro) => { indicePromise = null; throw erro })
  }
  return indicePromise
}

// Devolve até `limite` produtos. Os da loja (com preço) vêm primeiro; depois, os que começam
// com a primeira palavra digitada e os de nome mais curto (mais perto do que foi digitado).
export async function buscarProdutosPorNome(termo, { limite = 12 } = {}) {
  const palavras = normalizarBusca(termo).split(' ').filter(Boolean)
  if (!palavras.length || palavras.join('').length < 2) return []
  const indice = await carregarIndiceNomes()
  const achados = []
  for (const item of indice) {
    if (palavras.every((p) => item.chave.includes(p))) achados.push(item)
  }
  const pontos = (item) => (item.origem === 'loja' ? 0 : 1000) + (item.chave.startsWith(palavras[0]) ? 0 : 500) + item.chave.length
  return achados.sort((a, b) => pontos(a) - pontos(b)).slice(0, limite).map(({ chave: _, ...item }) => item)
}
