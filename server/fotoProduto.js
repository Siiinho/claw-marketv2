// Foto de produto para o jornal, tratada no SERVIDOR (PC da loja ou função da Vercel): confere as
// regras de qualidade, tira o fundo branco e centraliza num quadrado transparente. Não usa API de
// fora para a foto e não gasta crédito. O app só manda a foto: POST /api/foto-produto.
import sharp from 'sharp'
import { baixarFotoDoLink, ErroLink } from './baixarFoto.js'

const MAX_BYTES = 4 * 1024 * 1024 // a Vercel corta o pedido em 4,5 MB
const MAX_PIXELS = 40_000_000

const LADO = 800
const OCUPA = 0.94
const MAX_FONTE = 1200
// Distância de cor que ainda é fundo. Baixa de propósito: embalagem branca em fundo branco só
// difere por poucos tons, e é melhor sobrar um fio claro do que comer a embalagem.
const TOLERANCIA = 9
const FIO = 3
const SUAVE = 22 // faixa acima da tolerância que vira borda suave

// Regras da foto do jornal.
const REGRAS = {
  ladoMinimo: 450, // px da foto inteira
  produtoMinimo: 300, // px do maior lado só do produto
  ladoLimpo: 0.96, // dois lados opostos precisam ser quase só fundo
  brancoMinimo: 232, // tom do fundo, de 0 a 255
  corMaxima: 14, // diferença entre canais: acima disso o fundo é colorido
  encostaBeirada: 0.03, // a partir daqui o produto está encostando neste lado
  corteJusto: 0.92, // encostar vale se o produto ocupa a foto quase toda nesse sentido
  segundoItem: 0.06, // outro item solto com esta parte do tamanho do produto já reprova
  nitidezMinima: 40,
}

const mediana = (lista) => lista.sort((a, b) => a - b)[lista.length >> 1]

// Tira do RGBA o fundo ligado às bordas. Devolve { ok, borda, cor, itens }: ok só se o fundo é liso.
function tirarFundoLiso(d, w, h) {
  const total = w * h
  let vazios = 0
  for (let p = 0; p < total; p++) if (d[p * 4 + 3] < 20) vazios++
  const borda = []
  for (let x = 0; x < w; x++) borda.push(x, (h - 1) * w + x)
  for (let y = 1; y < h - 1; y++) borda.push(y * w, y * w + w - 1)
  if (vazios / total > 0.04) { // já veio recortada
    return { ok: true, borda: borda.filter((p) => d[p * 4 + 3] < 20).length / borda.length, cor: [255, 255, 255], itens: 1 }
  }
  // a cor do fundo vem dos cantos: num corte justo o produto toma quase toda a beirada
  const lc = Math.max(2, Math.round(Math.min(w, h) * 0.04))
  const cantos = []
  for (let y = 0; y < lc; y++) for (let x = 0; x < lc; x++) cantos.push(y * w + x, y * w + w - 1 - x, (h - 1 - y) * w + x, (h - 1 - y) * w + w - 1 - x)
  const canal = (c) => mediana(cantos.map((p) => d[p * 4 + c]))
  const [r, g, b] = [canal(0), canal(1), canal(2)]
  const dist = (p) => Math.sqrt((d[p * 4] - r) ** 2 + (d[p * 4 + 1] - g) ** 2 + (d[p * 4 + 2] - b) ** 2)
  const lado = (n, ponto) => { let c = 0; for (let k = 0; k < n; k++) if (dist(ponto(k)) <= 24) c++; return c / n }
  const deitado = Math.min(lado(w, (x) => x), lado(w, (x) => (h - 1) * w + x))
  const emPe = Math.min(lado(h, (y) => y * w), lado(h, (y) => y * w + w - 1))
  const medida = { borda: Math.max(deitado, emPe), cor: [r, g, b], itens: 1 }
  if (medida.borda < REGRAS.ladoLimpo) return { ok: false, ...medida }

  const fundo = new Uint8Array(total)
  const fila = new Int32Array(total)
  let ini = 0
  let fim = 0
  const entrar = (p) => { if (!fundo[p] && dist(p) <= TOLERANCIA) { fundo[p] = 1; fila[fim++] = p } }
  borda.forEach(entrar)
  while (ini < fim) {
    const p = fila[ini++]
    const x = p % w
    if (x > 0) entrar(p - 1)
    if (x < w - 1) entrar(p + 1)
    if (p >= w) entrar(p - w)
    if (p < total - w) entrar(p + w)
  }
  if (fim / total < 0.03 || fim / total > 0.985) return { ok: false, ...medida, vazia: fim / total > 0.985 }

  // Fios e sujeirinhas soltas (linha na beirada, ruído do JPEG) saem junto com o fundo.
  const visto = new Uint8Array(total)
  const grupos = []
  for (let s = 0; s < total; s++) {
    if (fundo[s] || visto[s]) continue
    const de = fim
    ini = fim
    visto[s] = 1
    fila[fim++] = s
    while (ini < fim) {
      const p = fila[ini++]
      const x = p % w
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
        if (q >= 0 && q < total && !fundo[q] && !visto[q]) { visto[q] = 1; fila[fim++] = q }
      }
    }
    grupos.push([de, fim])
  }
  const maior = grupos.reduce((m, [a, b]) => Math.max(m, b - a), 0)
  const ehFio = (a, b) => {
    let x0 = w, x1 = 0, y0 = h, y1 = 0
    for (let i = a; i < b; i++) {
      const x = fila[i] % w
      const y = (fila[i] / w) | 0
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
    }
    const naBeirada = x0 < w * 0.03 || x1 > w * 0.97 || y0 < h * 0.03 || y1 > h * 0.97
    return naBeirada && Math.min(x1 - x0, y1 - y0) < Math.max(w, h) * 0.015
  }
  for (const [a, b] of grupos) {
    if (b - a < maior && (b - a < maior * 0.015 || ehFio(a, b))) for (let i = a; i < b; i++) fundo[fila[i]] = 1
  }

  medida.itens = grupos.filter(([a, b]) => b - a === maior || (!fundo[fila[a]] && b - a >= maior * REGRAS.segundoItem)).length

  // Tira o fio claro em volta do produto: no máximo FIO pixels, então não come embalagem branca.
  for (let volta = 0; volta < FIO; volta++) {
    const sai = []
    for (let p = 0; p < total; p++) {
      if (fundo[p] || dist(p) > 70) continue
      const x = p % w
      if ((x > 0 && fundo[p - 1]) || (x < w - 1 && fundo[p + 1]) || (p >= w && fundo[p - w]) || (p < total - w && fundo[p + w])) sai.push(p)
    }
    for (const p of sai) fundo[p] = 1
  }

  // Borda suave: só o contorno encostado no fundo, sem mexer no miolo da embalagem.
  for (let p = 0; p < total; p++) {
    if (fundo[p]) continue
    const x = p % w
    if ((x > 0 && fundo[p - 1]) || (x < w - 1 && fundo[p + 1]) || (p >= w && fundo[p - w]) || (p < total - w && fundo[p + w])) {
      d[p * 4 + 3] = Math.round(255 * Math.min(1, Math.max(0.25, (dist(p) - TOLERANCIA) / (SUAVE * 3))))
    }
  }
  for (let p = 0; p < total; p++) if (fundo[p]) d[p * 4 + 3] = 0
  return { ok: true, ...medida }
}

function areaVisivel(d, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] < 40) continue
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  return x1 < 0 ? { x: 0, y: 0, w, h } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

// Mão, braço ou produto cortado: encosta num lado sem ocupar a foto nesse sentido. Num corte
// justo o produto também encosta, mas vai de ponta a ponta.
function entraPelaBeirada(d, w, h, area) {
  const cheio = (p) => d[p * 4 + 3] > 128
  const encosta = (n, ponto) => { let c = 0; for (let i = 0; i < n; i++) if (cheio(ponto(i))) c++; return c / n > REGRAS.encostaBeirada }
  const vertical = encosta(w, (x) => w + x) || encosta(w, (x) => (h - 2) * w + x)
  const lateral = encosta(h, (y) => y * w + 1) || encosta(h, (y) => y * w + w - 2)
  return (vertical && area.h / h < REGRAS.corteJusto) || (lateral && area.w / w < REGRAS.corteJusto)
}

// Por que a foto não serve para o jornal (lista vazia = aprovada).
function motivosDaRecusa({ bmp, recorte, area, valorNitidez, entra }) {
  const motivos = []
  if (Math.max(bmp.w, bmp.h) < REGRAS.ladoMinimo) motivos.push(`a foto é pequena (${bmp.w}x${bmp.h}); use uma de ${REGRAS.ladoMinimo} px ou mais`)
  if (recorte.vazia) return [...motivos, 'não dá para ver o produto']
  if (!recorte.ok) return [...motivos, 'tem mão, ambiente ou algo além do produto até a beirada']
  const [r, g, b] = recorte.cor
  if (Math.min(r, g, b) < REGRAS.brancoMinimo || Math.max(r, g, b) - Math.min(r, g, b) > REGRAS.corMaxima) motivos.push('o fundo não é branco')
  if (entra) motivos.push('algo entra pela beirada: mão, ambiente ou produto cortado')
  if (recorte.itens > 1) motivos.push('tem mais de um item, selo ou faixa junto do produto')
  if (Math.max(area.w, area.h) < REGRAS.produtoMinimo) motivos.push('o produto está muito longe ou pequeno na foto')
  if (valorNitidez < REGRAS.nitidezMinima) motivos.push('a foto está borrada')
  return motivos
}

// Nitidez do produto (variação do Laplaciano), medida sempre no mesmo tamanho: uma foto esticada
// de uma miniatura fica com poucos detalhes e reprova.
async function nitidez(rgba, w0, h0, area) {
  const k = Math.min(1, 400 / Math.max(area.w, area.h))
  const w = Math.max(3, Math.round(area.w * k))
  const h = Math.max(3, Math.round(area.h * k))
  const y = await sharp(rgba, { raw: { width: w0, height: h0, channels: 4 } })
    .extract({ left: area.x, top: area.y, width: area.w, height: area.h })
    .flatten({ background: '#fff' }).resize(w, h, { fit: 'fill' }).greyscale().toColourspace('b-w').raw().toBuffer()
  let soma = 0, soma2 = 0, n = 0
  // o miolo: o contorno do recorte é sempre nítido e enganaria a medida
  const mx = Math.max(1, Math.round(w * 0.12))
  const my = Math.max(1, Math.round(h * 0.12))
  for (let j = my; j < h - my; j++) for (let i = mx; i < w - mx; i++) {
    const p = j * w + i
    const l = 4 * y[p] - y[p - 1] - y[p + 1] - y[p - w] - y[p + w]
    soma += l; soma2 += l * l; n++
  }
  return n ? soma2 / n - (soma / n) ** 2 : 0
}

// { imagem, semFundo, motivos, medidas }. `motivos` vazio = aprovada; com motivos, não usar.
export async function tratarFotoProduto(bytes, { manterFundo = false } = {}) {
  const meta = await sharp(bytes, { limitInputPixels: MAX_PIXELS }).metadata()
  const virada = (meta.orientation || 1) >= 5
  const tamanho = virada ? { w: meta.height, h: meta.width } : { w: meta.width, h: meta.height }
  const { data: original, info } = await sharp(bytes, { limitInputPixels: MAX_PIXELS }).rotate()
    .resize(MAX_FONTE, MAX_FONTE, { fit: 'inside', withoutEnlargement: true })
    .toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info
  const recortada = Buffer.from(original)
  const recorte = tirarFundoLiso(recortada, w, h)
  let area = recorte.ok ? areaVisivel(recortada, w, h) : { x: 0, y: 0, w, h }
  const valorNitidez = await nitidez(original, w, h, area)
  const entra = recorte.ok && entraPelaBeirada(recortada, w, h, area)
  const motivos = motivosDaRecusa({ bmp: tamanho, recorte, area, valorNitidez, entra })
  const medidas = { borda: recorte.borda, cor: recorte.cor, itens: recorte.itens, entra, nitidez: Math.round(valorNitidez), produto: Math.max(area.w, area.h) }
  if (motivos.length) return { imagem: null, semFundo: false, motivos, medidas }

  if (manterFundo) area = { x: 0, y: 0, w, h }
  const escala = Math.min((LADO * OCUPA) / area.w, (LADO * OCUPA) / area.h, 2) // não estica foto pequena
  const dw = Math.max(1, Math.round(area.w * escala))
  const dh = Math.max(1, Math.round(area.h * escala))
  const produto = await sharp(manterFundo ? original : recortada, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: area.x, top: area.y, width: area.w, height: area.h })
    .resize(dw, dh, { fit: 'fill' }).png().toBuffer()
  const arte = await sharp({ create: { width: LADO, height: LADO, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: produto, left: Math.round((LADO - dw) / 2), top: Math.round((LADO - dh) / 2) }])
    .webp({ quality: 86 }).toBuffer()
  return { imagem: `data:image/webp;base64,${arte.toString('base64')}`, semFundo: !manterFundo, motivos, medidas }
}

// Só quem entrou no app usa: com a nuvem ligada, o login é conferido no Supabase.
async function loginValido(autorizacao) {
  const url = process.env.CLAW_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const anon = process.env.CLAW_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !anon) return !process.env.VERCEL // sem nuvem: vale no PC da loja, nunca na internet
  if (!/^Bearer \S+$/.test(autorizacao || '')) return false
  const r = await fetch(`${url.replace(/\/+$/, '')}/auth/v1/user`, { headers: { apikey: anon, Authorization: autorizacao }, signal: AbortSignal.timeout(8000) })
  return r.ok
}

async function lerCorpo(req) {
  // a Vercel entrega o corpo pronto: Buffer em octet-stream, objeto em JSON
  if (Buffer.isBuffer(req.body)) return req.body
  if (req.body && typeof req.body === 'object') return Buffer.from(JSON.stringify(req.body))
  const partes = []
  let total = 0
  for await (const parte of req) {
    total += parte.length
    if (total > MAX_BYTES) return null
    partes.push(parte)
  }
  return Buffer.concat(partes)
}

// Mesmo código no Vite (dev e preview) e na função da Vercel.
export async function middlewareFotoProduto(req, res) {
  const responder = (status, corpo) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.end(JSON.stringify(corpo))
  }
  try {
    if (req.method !== 'POST') return responder(405, { erro: 'Use POST.' })
    if (Number(req.headers['content-length']) > MAX_BYTES) return responder(413, { erro: 'Foto grande demais. Use uma de até 4 MB.' })
    let logado
    try { logado = await loginValido(req.headers.authorization) } catch (_) { return responder(503, { erro: 'Não foi possível conferir o login agora. Tente de novo.' }) }
    if (!logado) return responder(401, { erro: 'Entre no app para adicionar fotos.' })
    let bytes = await lerCorpo(req)
    if (!bytes || bytes.length > MAX_BYTES) return responder(413, { erro: 'Foto grande demais. Use uma de até 4 MB.' })
    if (!bytes.length) return responder(400, { erro: 'Nenhuma foto recebida.' })
    let origem = null
    if (/^application\/json/i.test(req.headers['content-type'] || '')) {
      let link
      try { link = JSON.parse(bytes.toString('utf8'))?.link } catch (_) { return responder(400, { erro: 'Pedido inválido.' }) }
      try { ({ bytes, origem } = await baixarFotoDoLink(link)) } catch (e) { return responder(422, { erro: e instanceof ErroLink ? e.message : 'Não foi possível baixar a foto desse link.' }) }
    }
    const manterFundo = new URL(req.originalUrl || req.url, 'http://localhost').searchParams.get('fundo') === '1'
    let r
    try { r = await tratarFotoProduto(bytes, { manterFundo }) } catch (_) { return responder(415, { erro: 'Não foi possível ler essa imagem. Tente copiar outra.' }) }
    return responder(r.motivos.length ? 422 : 200, { imagem: r.imagem, semFundo: r.semFundo, motivos: r.motivos, origem })
  } catch (_) {
    return responder(500, { erro: 'Não foi possível tratar a foto agora. Tente de novo.' })
  }
}
