// Catálogos usados ao bipar um código de barras:
//  1. Mercadologia do Bengala (preço, estoque e setor reais da loja).
//  2. Base de produtos (28 mil itens com nome, seção e preço sugerido), carregada só quando
//     o código não está no catálogo da loja. Fica em public/catalogo/base-produtos.json.
// A foto vem da pasta de imagens do PC da loja (/api/imagens-produtos/<ean>.jpg) ou de
// VITE_IMAGENS_BASE_URL (ex.: um bucket público), quando a foto existir lá.
let catalogoPromise
let basePromise
const fotoConferida = new Map()

const somenteDigitos = (valor) => String(valor || '').replace(/\D/g, '')
const BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || './'
const IMAGENS_BASE = ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_IMAGENS_BASE_URL) || '/api/imagens-produtos').replace(/\/+$/, '')

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

// Endereço da foto do produto, se ela existir na pasta de imagens (confere uma vez por código).
export async function fotoDoCatalogo(codigo) {
  const c = somenteDigitos(codigo)
  if (!c || typeof fetch !== 'function' || globalThis.location?.protocol === 'file:') return null
  if (fotoConferida.has(c)) return fotoConferida.get(c)
  const url = `${IMAGENS_BASE}/${c}.jpg`
  let achou = null
  try {
    const r = await fetch(url, { method: 'HEAD' })
    if (r.ok && (r.headers.get('content-type') || '').startsWith('image/')) achou = url
  } catch (_) { /* sem pasta de imagens neste endereço */ }
  fotoConferida.set(c, achou)
  return achou
}

async function buscarNaBase(codigoBarras) {
  const { mapa, categorias } = await carregarBase()
  const linha = mapa.get(codigoBarras) || mapa.get(codigoBarras.replace(/^0+/, ''))
  if (!linha) return null
  const [ean, nome, setor, preco, cat] = linha
  return {
    codigoInterno: ean,
    codigoBarras: ean,
    nome,
    setor,
    categoria: categorias[cat] || '',
    unidade: 'UN',
    precoNormal: preco,
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

export async function totalProdutosBengala() {
  const [catalogo, base] = await Promise.all([carregarCatalogo(), carregarBase()])
  return catalogo.size + base.mapa.size
}
