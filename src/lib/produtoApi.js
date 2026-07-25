// Integração de catálogo de produtos do mercado brasileiro (por código de barras / GTIN-EAN).
// Fonte: Open Food Facts (grátis, sem chave, muitos produtos BR, permite uso no frontend).
// Simula o efeito de "puxar do PDV": digita/escaneia o código e o produto vem preenchido.
const CATALOGOS_PUBLICOS = [
  { id: 'open-food-facts', dominio: 'world.openfoodfacts.org', nome: 'Open Food Facts' },
  { id: 'open-beauty-facts', dominio: 'world.openbeautyfacts.org', nome: 'Open Beauty Facts' },
  { id: 'open-products-facts', dominio: 'world.openproductsfacts.org', nome: 'Open Products Facts' },
  { id: 'open-pet-food-facts', dominio: 'world.openpetfoodfacts.org', nome: 'Open Pet Food Facts' },
]
const CAMPOS_CATALOGO = [
  'code',
  'product_name',
  'product_name_pt',
  'generic_name_pt',
  'brands',
  'brand_owner',
  'quantity',
  'categories',
  'categories_tags',
  'image_front_url',
  'image_url',
  'selected_images',
].join(',')
const CACHE_CATALOGO = new Map()
const BANCO_IMAGENS = 'clawmarket-imagens-produtos'
const LOJA_IMAGENS = 'imagens'
const REVALIDAR_EMBALAGEM_MS = 30 * 24 * 60 * 60 * 1000
const TRATAMENTO_PACKSHOT = 'packshot-estudio-v5'
let promessaBancoImagens
const IMAGENS_LOCAIS = import.meta.glob([
  '../assets/produtos/*.jpg',
  '../assets/produtos/*.jpeg',
  '../assets/produtos/*.png',
  '../assets/produtos/*.webp',
], {
  eager: true,
  query: '?url',
  import: 'default',
})

// heurística: mapeia o produto para um dos 9 setores do app
const SETOR_REGRAS = [
  { re: /bebida|refrigerante|suco|água|agua|cerveja|drink|beverage|refresco|energ|chá|cha\b|isoton/, setor: 'bebidas' },
  { re: /congelad|frozen|sorvete|pizza|lasanha|nugget|hamb[uú]rg/, setor: 'congelados' },
  { re: /queijo|presunto|mortadela|salame|frios|embutido|lingu[ií]ça|salsicha|sausage|bacon|\bham\b|peito de peru/, setor: 'frios' },
  { re: /leite|iogurte|yogurt|requeij|dairy|latic[ií]n|manteiga|creme de leite|condensado|nata/, setor: 'laticinios' },
  { re: /p[ãa]o|bread|padaria|bolo|biscoito|torrada|bisnaga|bakery|rosca|croissant/, setor: 'padaria' },
  { re: /fruta|verdura|legume|hortifr|fruit|vegetable|salada|tomate|banana|maçã|maca\b/, setor: 'hortifruti' },
  { re: /limpeza|detergente|sab[ãa]o|amaciante|desinfet|cleaning|sanit[áa]ria|alvejante|multiuso|esponja/, setor: 'limpeza' },
  { re: /\bpet\b|ra[çc][ãa]o|cachorro|gato|\bdog\b|cat food|petisco animal/, setor: 'petshop' },
]

export function inferirSetor(texto = '') {
  const t = texto.toLowerCase()
  for (const r of SETOR_REGRAS) if (r.re.test(t)) return r.setor
  return 'mercearia'
}

function codigoComparavel(codigo) {
  return String(codigo || '').replace(/\D/g, '').replace(/^0+/, '') || '0'
}

function catalogosPorSetor(setor) {
  if (setor === 'petshop') {
    return [CATALOGOS_PUBLICOS[3], CATALOGOS_PUBLICOS[2], CATALOGOS_PUBLICOS[0], CATALOGOS_PUBLICOS[1]]
  }
  if (setor === 'limpeza') {
    return [CATALOGOS_PUBLICOS[2], CATALOGOS_PUBLICOS[1], CATALOGOS_PUBLICOS[0], CATALOGOS_PUBLICOS[3]]
  }
  return CATALOGOS_PUBLICOS
}

function imagemFrontalAlta(p = {}) {
  const frontal = p.selected_images?.front
  const display = frontal?.display || {}
  const idioma =
    display.pt ||
    display['pt-br'] ||
    display.en ||
    display.es ||
    Object.values(display)[0]
  const url = idioma || p.image_front_url || p.image_url || null
  if (!url) return null
  // A base publica oferece a mesma fotografia selecionada em tamanho completo.
  return url.replace(/\.(?:100|200|400)\.jpg(?:\?.*)?$/i, '.full.jpg')
}

function distanciaCor(r, g, b, cor) {
  const dr = r - cor[0]
  const dg = g - cor[1]
  const db = b - cor[2]
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

function corMedia(imageData, largura, altura, cx, cy) {
  const raio = Math.max(2, Math.round(Math.min(largura, altura) * 0.012))
  let r = 0, g = 0, b = 0, n = 0
  for (let y = Math.max(0, cy - raio); y <= Math.min(altura - 1, cy + raio); y++) {
    for (let x = Math.max(0, cx - raio); x <= Math.min(largura - 1, cx + raio); x++) {
      const i = (y * largura + x) * 4
      r += imageData[i]
      g += imageData[i + 1]
      b += imageData[i + 2]
      n++
    }
  }
  return [r / n, g / n, b / n]
}

// Remove somente o fundo conectado às bordas da fotografia.
// Isso evita apagar detalhes escuros ou brancos que pertencem à embalagem.
function recortarProdutoDaFoto(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const largura = canvas.width
  const altura = canvas.height
  const pixels = ctx.getImageData(0, 0, largura, altura)
  const d = pixels.data
  const margemX = Math.max(1, Math.round(largura * 0.02))
  const margemY = Math.max(1, Math.round(altura * 0.02))
  const paleta = [
    corMedia(d, largura, altura, margemX, margemY),
    corMedia(d, largura, altura, largura - 1 - margemX, margemY),
    corMedia(d, largura, altura, margemX, altura - 1 - margemY),
    corMedia(d, largura, altura, largura - 1 - margemX, altura - 1 - margemY),
  ]
  const total = largura * altura
  const fundo = new Uint8Array(total)
  const fila = new Int32Array(total)
  let inicio = 0
  let fim = 0
  const limite = 58

  const distanciaPaleta = (indicePixel) => {
    const i = indicePixel * 4
    let menor = Infinity
    for (const cor of paleta) {
      menor = Math.min(menor, distanciaCor(d[i], d[i + 1], d[i + 2], cor))
    }
    return menor
  }
  const adicionarBorda = (indice) => {
    if (!fundo[indice] && distanciaPaleta(indice) <= limite + 20) {
      fundo[indice] = 1
      fila[fim++] = indice
    }
  }

  for (let x = 0; x < largura; x++) {
    adicionarBorda(x)
    adicionarBorda((altura - 1) * largura + x)
  }
  for (let y = 1; y < altura - 1; y++) {
    adicionarBorda(y * largura)
    adicionarBorda(y * largura + largura - 1)
  }

  const tentar = (atual, proximo) => {
    if (proximo < 0 || proximo >= total || fundo[proximo]) return
    const global = distanciaPaleta(proximo)
    // A cor também precisa continuar próxima ao fundo original.
    // Não propagamos apenas pela semelhança com o pixel vizinho, pois isso pode
    // atravessar gradualmente o rótulo e apagar partes da embalagem.
    if (global <= limite + 18) {
      fundo[proximo] = 1
      fila[fim++] = proximo
    }
  }

  while (inicio < fim) {
    const atual = fila[inicio++]
    const x = atual % largura
    if (x > 0) tentar(atual, atual - 1)
    if (x < largura - 1) tentar(atual, atual + 1)
    if (atual >= largura) tentar(atual, atual - largura)
    if (atual < total - largura) tentar(atual, atual + largura)
  }

  const proporcaoRemovida = fim / total
  if (proporcaoRemovida < 0.02 || proporcaoRemovida > 0.96) {
    return { canvas, x: 0, y: 0, largura, altura }
  }

  // Embalagens plásticas e brilhantes podem refletir a mesma cor do fundo.
  // Preservamos todo o conteúdo entre as bordas esquerda/direita da silhueta
  // para não criar buracos dentro do rótulo.
  const esquerda = new Int32Array(altura)
  const direita = new Int32Array(altura)
  esquerda.fill(largura)
  direita.fill(-1)
  for (let p = 0; p < total; p++) {
    if (fundo[p]) continue
    const x = p % largura
    const y = Math.floor(p / largura)
    if (x < esquerda[y]) esquerda[y] = x
    if (x > direita[y]) direita[y] = x
  }
  for (let y = 0; y < altura; y++) {
    if (direita[y] < esquerda[y]) continue
    const folgaLinha = Math.max(1, Math.round((direita[y] - esquerda[y]) * 0.01))
    const de = Math.max(0, esquerda[y] - folgaLinha)
    const ate = Math.min(largura - 1, direita[y] + folgaLinha)
    for (let x = de; x <= ate; x++) fundo[y * largura + x] = 0
  }

  let minX = largura, minY = altura, maxX = 0, maxY = 0
  for (let p = 0; p < total; p++) {
    const i = p * 4
    if (fundo[p]) {
      d[i + 3] = 0
      continue
    }
    const x = p % largura
    const y = Math.floor(p / largura)
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y

    // Suaviza um pixel da borda para o recorte não ficar serrilhado na impressão.
    const tocaFundo =
      (x > 0 && fundo[p - 1]) ||
      (x < largura - 1 && fundo[p + 1]) ||
      (y > 0 && fundo[p - largura]) ||
      (y < altura - 1 && fundo[p + largura])
    if (tocaFundo) d[i + 3] = 185
  }
  ctx.putImageData(pixels, 0, 0)
  const folga = Math.round(Math.max(maxX - minX, maxY - minY) * 0.025)
  return {
    canvas,
    x: Math.max(0, minX - folga),
    y: Math.max(0, minY - folga),
    largura: Math.min(largura, maxX + folga) - Math.max(0, minX - folga) + 1,
    altura: Math.min(altura, maxY + folga) - Math.max(0, minY - folga) + 1,
  }
}

// Baixa a fotografia e transforma em packshot de estúdio, pronto para o jornal.
async function imagemParaDataURL(url) {
  try {
    const r = await fetch(url)
    if (!r.ok) return url
    const blob = await r.blob()
    const bitmap = await createImageBitmap(blob)
    const max = 1400
    const escala = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
    const largura = Math.max(1, Math.round(bitmap.width * escala))
    const altura = Math.max(1, Math.round(bitmap.height * escala))
    const origem = document.createElement('canvas')
    origem.width = largura
    origem.height = altura
    const origemCtx = origem.getContext('2d')
    origemCtx.imageSmoothingEnabled = true
    origemCtx.imageSmoothingQuality = 'high'
    origemCtx.drawImage(bitmap, 0, 0, largura, altura)
    bitmap.close?.()

    const recorte = recortarProdutoDaFoto(origem)
    const lado = 1000
    const canvas = document.createElement('canvas')
    canvas.width = lado
    canvas.height = lado
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, lado, lado)

    const limiteProduto = lado * 0.82
    const escalaProduto = Math.min(limiteProduto / recorte.largura, limiteProduto / recorte.altura)
    const destinoW = Math.max(1, Math.round(recorte.largura * escalaProduto))
    const destinoH = Math.max(1, Math.round(recorte.altura * escalaProduto))
    const destinoX = Math.round((lado - destinoW) / 2)
    const destinoY = Math.round((lado - destinoH) / 2 - lado * 0.015)

    ctx.save()
    ctx.shadowColor = 'rgba(8,43,79,.18)'
    ctx.shadowBlur = 24
    ctx.shadowOffsetY = 14
    ctx.drawImage(
      recorte.canvas,
      recorte.x, recorte.y, recorte.largura, recorte.altura,
      destinoX, destinoY, destinoW, destinoH
    )
    ctx.restore()
    ctx.drawImage(
      recorte.canvas,
      recorte.x, recorte.y, recorte.largura, recorte.altura,
      destinoX, destinoY, destinoW, destinoH
    )
    return canvas.toDataURL('image/jpeg', 0.92)
  } catch (_) {
    return url
  }
}

function abrirBancoImagens() {
  if (!globalThis.indexedDB) return Promise.resolve(null)
  if (promessaBancoImagens) return promessaBancoImagens
  promessaBancoImagens = new Promise((resolve) => {
    const req = globalThis.indexedDB.open(BANCO_IMAGENS, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(LOJA_IMAGENS)) {
        req.result.createObjectStore(LOJA_IMAGENS, { keyPath: 'codigoBarras' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
  })
  return promessaBancoImagens
}

async function lerImagemSalva(codigo) {
  const db = await abrirBancoImagens()
  if (!db) return null
  return new Promise((resolve) => {
    const req = db.transaction(LOJA_IMAGENS, 'readonly').objectStore(LOJA_IMAGENS).get(codigo)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => resolve(null)
  })
}

async function gravarImagemSalva(registro) {
  const db = await abrirBancoImagens()
  if (!db) return false
  return new Promise((resolve) => {
    const tx = db.transaction(LOJA_IMAGENS, 'readwrite')
    tx.objectStore(LOJA_IMAGENS).put(registro)
    tx.oncomplete = () => resolve(true)
    tx.onerror = () => resolve(false)
  })
}

function respostaImagemSalva(registro) {
  if (!registro?.imagem) return null
  return {
    imagem: registro.imagem,
    marca: registro.marca,
    setor: registro.setor,
    origem: registro.origem,
    origemNome: registro.origemNome,
    imagemOriginal: registro.imagemOriginal,
    correspondencia: 'codigo-exato',
    imagemAltaResolucao: registro.imagemAltaResolucao,
    imagemIlustrativa: false,
    imagemCachePermanente: true,
    imagemTratada: registro.tratamento === TRATAMENTO_PACKSHOT,
    imagemTratamento: registro.tratamento,
    imagemSalvaEm: registro.salvoEm,
  }
}

export async function restaurarImagensSalvas(produtos = []) {
  return Promise.all(
    produtos.map(async (produto) => {
      if (
        produto.imagem &&
        produto.imagemTratamento === TRATAMENTO_PACKSHOT
      ) return produto
      if (!produto.imagemCachePermanente || !produto.codigoBarras) return produto
      const salvo = await lerImagemSalva(String(produto.codigoBarras).replace(/\D/g, ''))
      const foto = respostaImagemSalva(salvo)
      return foto ? { ...produto, ...foto } : produto
    })
  )
}

async function consultarCatalogoExato(codigo, setor = '', opcoes = {}) {
  const c = String(codigo || '').replace(/\D/g, '').trim()
  if (!c) return null
  const chaveCache = `${c}:${setor}`
  if (!opcoes.ignorarCache && CACHE_CATALOGO.has(chaveCache)) return CACHE_CATALOGO.get(chaveCache)

  for (const catalogo of catalogosPorSetor(setor)) {
    try {
      const endpoint =
        `https://${catalogo.dominio}/api/v2/product/${encodeURIComponent(c)}.json` +
        `?fields=${encodeURIComponent(CAMPOS_CATALOGO)}&lc=pt&cc=br`
      const r = await fetch(endpoint, { signal: AbortSignal.timeout(8000) })
      if (!r.ok) continue
      const j = await r.json()
      if (j.status !== 1 || !j.product) continue

      const p = j.product
      // Não aceita resultado aproximado: o GTIN/EAN precisa ser exatamente o mesmo.
      if (codigoComparavel(p.code || c) !== codigoComparavel(c)) continue

      const baseNome = p.product_name_pt || p.product_name || p.generic_name_pt || ''
      const nome = [baseNome, p.quantity].filter(Boolean).join(' ').trim()
      const textoSetor = `${baseNome} ${p.categories || ''} ${(p.categories_tags || []).join(' ')}`
      const imagemOriginal = imagemFrontalAlta(p)
      const resultado = {
        encontrado: true,
        nome: nome || `Produto ${c}`,
        marca: (p.brands || p.brand_owner || '').split(',')[0].trim(),
        setor: inferirSetor(textoSetor),
        imagem: imagemOriginal && opcoes.baixarImagem !== false ? await imagemParaDataURL(imagemOriginal) : null,
        imagemOriginal,
        imagemAltaResolucao: Boolean(imagemOriginal),
        imagemIlustrativa: false,
        correspondencia: 'codigo-exato',
        codigoBarras: c,
        origem: catalogo.id,
        origemNome: catalogo.nome,
      }
      if (opcoes.baixarImagem !== false) CACHE_CATALOGO.set(chaveCache, resultado)
      return resultado
    } catch (_) {
      // Segue para o próximo banco público.
    }
  }
  const ausente = { encontrado: false, codigoBarras: c }
  if (!opcoes.ignorarCache) CACHE_CATALOGO.set(chaveCache, ausente)
  return ausente
}

export async function buscarProdutoCatalogo(codigo, opcoes = {}) {
  return consultarCatalogoExato(codigo, opcoes.setor || '', opcoes)
}

function imagemLocalPorCodigo(codigo) {
  const codigos = [String(codigo), String(codigo).padStart(13, '0')]
  const entrada = Object.entries(IMAGENS_LOCAIS).find(([caminho]) => {
    const nome = caminho.split('/').pop()?.replace(/\.(jpg|jpeg|png|webp)$/i, '')
    return codigos.includes(nome)
  })
  return entrada?.[1] || null
}

// Retorna somente fotografia associada ao código exato.
// Primeiro usa os arquivos locais e depois quatro bancos públicos especializados.
export async function buscarImagemProduto(produtoOuCodigo, opcoes = {}) {
  const dados = typeof produtoOuCodigo === 'object' ? produtoOuCodigo : { codigoBarras: produtoOuCodigo }
  const c = String(dados.codigoBarras || '').replace(/\D/g, '').trim()
  if (!c) return null

  const salva = await lerImagemSalva(c)
  const agora = Date.now()
  const cacheAtual =
    salva &&
    salva.tratamento === TRATAMENTO_PACKSHOT &&
    agora - new Date(salva.verificadoEm || salva.salvoEm || 0).getTime() < REVALIDAR_EMBALAGEM_MS

  if (salva && cacheAtual && !opcoes.forcarAtualizacao) return respostaImagemSalva(salva)

  const local = imagemLocalPorCodigo(c)
  if (local && !opcoes.forcarAtualizacao) {
    const imagem = await imagemParaDataURL(local)
    const registroLocal = {
      codigoBarras: c,
      imagem,
      marca: dados.marca || '',
      setor: dados.setor || '',
      origem: 'catalogo-local',
      origemNome: 'Catálogo local Bengala',
      imagemOriginal: `catalogo-local:${c}`,
      correspondencia: 'codigo-exato',
      imagemAltaResolucao: true,
      imagemIlustrativa: false,
      tratamento: TRATAMENTO_PACKSHOT,
      salvoEm: new Date().toISOString(),
      verificadoEm: new Date().toISOString(),
    }
    if (String(imagem).startsWith('data:')) await gravarImagemSalva(registroLocal)
    return respostaImagemSalva(registroLocal)
  }

  if (salva && salva.tratamento !== TRATAMENTO_PACKSHOT && !opcoes.forcarAtualizacao) {
    const imagemTratada = await imagemParaDataURL(salva.imagem)
    const atualizada = {
      ...salva,
      imagem: imagemTratada,
      tratamento: TRATAMENTO_PACKSHOT,
      salvoEm: new Date().toISOString(),
      verificadoEm: new Date().toISOString(),
    }
    if (String(imagemTratada).startsWith('data:')) await gravarImagemSalva(atualizada)
    return respostaImagemSalva(atualizada)
  }

  // Consulta apenas os metadados primeiro. A URL contém a revisão da embalagem.
  const catalogo = await buscarProdutoCatalogo(c, {
    setor: dados.setor,
    baixarImagem: false,
    ignorarCache: true,
  })
  if (!catalogo?.imagemOriginal) return respostaImagemSalva(salva)

  if (salva && salva.imagemOriginal === catalogo.imagemOriginal && !opcoes.forcarAtualizacao) {
    const confirmado = { ...salva, verificadoEm: new Date().toISOString() }
    await gravarImagemSalva(confirmado)
    return respostaImagemSalva(confirmado)
  }

  // Só baixa e prepara outra imagem quando a revisão pública da embalagem mudou
  // ou quando o gerente confirma manualmente a troca.
  const imagem = await imagemParaDataURL(catalogo.imagemOriginal)
  if (!imagem) return respostaImagemSalva(salva)
  const permanente = String(imagem).startsWith('data:')
  const registro = {
    codigoBarras: c,
    imagem,
    marca: catalogo.marca,
    setor: catalogo.setor,
    origem: catalogo.origem,
    origemNome: catalogo.origemNome,
    imagemOriginal: catalogo.imagemOriginal,
    correspondencia: catalogo.correspondencia,
    imagemAltaResolucao: catalogo.imagemAltaResolucao,
    imagemIlustrativa: false,
    tratamento: TRATAMENTO_PACKSHOT,
    salvoEm: new Date().toISOString(),
    verificadoEm: new Date().toISOString(),
  }
  if (permanente) await gravarImagemSalva(registro)
  return {
    ...respostaImagemSalva(registro),
    imagemCachePermanente: permanente,
  }
}

export function imagemProdutoPrecisaTratamento(produto) {
  return Boolean(produto?.imagem && produto.imagemTratamento !== TRATAMENTO_PACKSHOT)
}

export async function prepararProdutoParaJornal(produto) {
  if (!imagemProdutoPrecisaTratamento(produto)) return produto
  const chave = String(produto.codigoBarras || produto.id || '').replace(/\s/g, '')
  if (!chave) return produto

  const salva = await lerImagemSalva(chave)
  if (salva?.tratamento === TRATAMENTO_PACKSHOT) {
    return { ...produto, ...respostaImagemSalva(salva) }
  }

  const local = imagemLocalPorCodigo(chave)
  const fonteOriginal =
    local ||
    (String(produto.imagemOriginal || '').startsWith('http') ? produto.imagemOriginal : null) ||
    produto.imagem
  const imagem = await imagemParaDataURL(fonteOriginal)
  if (!String(imagem).startsWith('data:')) return produto
  const registro = {
    codigoBarras: chave,
    imagem,
    marca: produto.marca || '',
    setor: produto.setor || '',
    origem: produto.imagemOrigem || 'imagem-do-produto',
    origemNome: produto.imagemOrigemNome || 'Imagem cadastrada',
    imagemOriginal: produto.imagemOriginal || `cadastro:${chave}`,
    correspondencia: produto.imagemCorrespondencia || 'codigo-exato',
    imagemAltaResolucao: true,
    imagemIlustrativa: false,
    tratamento: TRATAMENTO_PACKSHOT,
    salvoEm: new Date().toISOString(),
    verificadoEm: new Date().toISOString(),
  }
  await gravarImagemSalva(registro)
  return { ...produto, ...respostaImagemSalva(registro) }
}
