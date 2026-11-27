// Tira o fundo branco da foto do produto (packshot em fundo branco) para ela "sentar" no fundo da
// campanha. Parte das bordas e só avança por pixels quase iguais ao branco do fundo E parecidos com
// o vizinho: assim para no contorno do produto, mesmo quando a embalagem também é branca
// (leite, sabão, tampa). Na dúvida, a foto fica como está. Roda no aparelho, uma vez por foto.
const cache = new Map()

const LADO = 900 // tamanho máximo trabalhado: nítido na página e ainda leve no celular

function carregar(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (!/^data:|^blob:/.test(src)) img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export function tirarFundo(d, w, h) {
  const n = w * h
  const px = (i) => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2], d[i * 4 + 3]]
  // cor do fundo: a média dos pixels claros da borda
  let r0 = 0, g0 = 0, b0 = 0, k = 0, borda = 0
  const bordaIdx = []
  for (let x = 0; x < w; x++) bordaIdx.push(x, (h - 1) * w + x)
  for (let y = 0; y < h; y++) bordaIdx.push(y * w, y * w + w - 1)
  for (const i of bordaIdx) {
    borda++
    const [r, g, b, a] = px(i)
    if (a < 20 || (Math.min(r, g, b) > 228 && Math.max(r, g, b) - Math.min(r, g, b) < 16)) { r0 += a < 20 ? 255 : r; g0 += a < 20 ? 255 : g; b0 += a < 20 ? 255 : b; k++ }
  }
  // só mexe se a borda for mesmo de fundo branco: foto com cenário fica como está
  if (k / borda < 0.75) return false
  r0 /= k; g0 /= k; b0 /= k
  const distFundo = (i) => (d[i * 4 + 3] < 20 ? 0 : Math.max(Math.abs(d[i * 4] - r0), Math.abs(d[i * 4 + 1] - g0), Math.abs(d[i * 4 + 2] - b0)))
  const ehFundo = (i) => distFundo(i) <= 14
  const parecido = (i, j) => Math.abs(d[i * 4] - d[j * 4]) + Math.abs(d[i * 4 + 1] - d[j * 4 + 1]) + Math.abs(d[i * 4 + 2] - d[j * 4 + 2]) <= 9

  const fora = new Uint8Array(n)
  const fila = new Int32Array(n)
  let ini = 0, fim = 0
  for (const i of bordaIdx) if (!fora[i] && ehFundo(i)) { fora[i] = 1; fila[fim++] = i }
  const vai = (de, para) => { if (!fora[para] && ehFundo(para) && parecido(de, para)) { fora[para] = 1; fila[fim++] = para } }
  while (ini < fim) {
    const i = fila[ini++], x = i % w
    if (x > 0) vai(i, i - 1)
    if (x < w - 1) vai(i, i + 1)
    if (i >= w) vai(i, i - w)
    if (i < n - w) vai(i, i + w)
  }
  // Silhueta: o branco da embalagem que encosta no fundo sem contorno (caixa de leite, tampa) fica.
  // Fica todo pixel entre o topo e o pé do produto naquela coluna, e os buracos curtos de uma linha
  // (até 10% da largura). O vão largo entre duas garrafas continua saindo.
  const prod = new Uint8Array(n)
  for (let i = 0; i < n; i++) prod[i] = distFundo(i) > 14 ? 1 : 0
  const topo = new Int32Array(w).fill(h), pe = new Int32Array(w).fill(-1)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (prod[y * w + x]) { if (y < topo[x]) topo[x] = y; pe[x] = y }
  const lim = Math.max(3, Math.round(w * 0.1))
  for (let y = 0; y < h; y++) {
    let ultimo = -1
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (fora[i] && y >= topo[x] && y <= pe[x]) fora[i] = 0
      if (prod[i]) {
        if (ultimo >= 0 && x - ultimo > 1 && x - ultimo <= lim) for (let z = ultimo + 1; z < x; z++) fora[y * w + z] = 0
        ultimo = x
      }
    }
  }
  // sobrou quase nada (ou nada saiu): melhor não arriscar
  let saiu = 0
  for (let i = 0; i < n; i++) saiu += fora[i]
  if (saiu < n * 0.04 || saiu > n * 0.93) return false

  // contorno suave só no que é quase fundo; o produto continua inteiro e opaco
  for (let i = 0; i < n; i++) {
    if (fora[i]) { d[i * 4 + 3] = 0; continue }
    const x = i % w
    const vizinho = (x > 0 && fora[i - 1]) || (x < w - 1 && fora[i + 1]) || (i >= w && fora[i - w]) || (i < n - w && fora[i + w])
    if (vizinho) {
      const dist = distFundo(i)
      if (dist < 30) d[i * 4 + 3] = Math.round(d[i * 4 + 3] * (0.45 + 0.55 * (dist / 30)))
    }
  }
  return true
}

async function processar(src) {
  const img = await carregar(src)
  const k = Math.min(1, LADO / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * k))
  const h = Math.max(1, Math.round(img.naturalHeight * k))
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const g = c.getContext('2d', { willReadFrequently: true })
  g.imageSmoothingQuality = 'high'
  g.drawImage(img, 0, 0, w, h)
  let dados
  try { dados = g.getImageData(0, 0, w, h) } catch (_) { return src } // foto de outro site sem permissão: fica como está
  if (!tirarFundo(dados.data, w, h)) return src
  g.putImageData(dados, 0, 0)
  return c.toDataURL('image/png')
}

// Devolve uma promessa com a foto sem fundo (ou a original, se não der).
export function semFundo(src) {
  if (!src || typeof window === 'undefined') return Promise.resolve(src)
  if (!cache.has(src)) cache.set(src, processar(src).catch(() => src))
  return cache.get(src)
}
export const semFundoPronto = (src) => cache.get(src)
