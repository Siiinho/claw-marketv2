// Tira o fundo branco da foto do produto (packshot em fundo branco) para ela "sentar" no fundo da
// campanha. Preenche a partir das bordas tudo o que é quase branco; o branco de dentro do produto
// (rótulo, embalagem) fica, porque não encosta na borda. Roda no aparelho, uma vez por foto.
const cache = new Map()

const LADO = 480 // tamanho máximo trabalhado: leve no celular e nítido na página

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

async function processar(src) {
  const img = await carregar(src)
  const k = Math.min(1, LADO / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * k))
  const h = Math.max(1, Math.round(img.naturalHeight * k))
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const g = c.getContext('2d', { willReadFrequently: true })
  g.drawImage(img, 0, 0, w, h)
  let dados
  try { dados = g.getImageData(0, 0, w, h) } catch (_) { return src } // foto de outro site sem permissão: fica como está
  const d = dados.data
  const n = w * h
  // fundo: claro e sem cor (ou já transparente)
  const claro = (i) => d[i * 4 + 3] < 20 || (Math.min(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) > 232 && Math.max(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) - Math.min(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) < 18)
  // só tira se a borda for mesmo branca: foto com cenário não é mexida
  let bordaClara = 0, borda = 0
  for (let x = 0; x < w; x += 2) { borda += 2; bordaClara += claro(x) + claro((h - 1) * w + x) }
  for (let y = 0; y < h; y += 2) { borda += 2; bordaClara += claro(y * w) + claro(y * w + w - 1) }
  if (bordaClara / borda < 0.7) return src
  const fora = new Uint8Array(n)
  const fila = new Int32Array(n)
  let ini = 0, fim = 0
  const entra = (i) => { if (!fora[i] && claro(i)) { fora[i] = 1; fila[fim++] = i } }
  for (let x = 0; x < w; x++) { entra(x); entra((h - 1) * w + x) }
  for (let y = 0; y < h; y++) { entra(y * w); entra(y * w + w - 1) }
  while (ini < fim) {
    const i = fila[ini++], x = i % w
    if (x > 0) entra(i - 1)
    if (x < w - 1) entra(i + 1)
    if (i >= w) entra(i - w)
    if (i < n - w) entra(i + w)
  }
  // borda suave: pixel do produto encostado no fundo fica meio transparente conforme o quanto é claro
  for (let i = 0; i < n; i++) {
    if (fora[i]) { d[i * 4 + 3] = 0; continue }
    const x = i % w
    const vizinho = (x > 0 && fora[i - 1]) || (x < w - 1 && fora[i + 1]) || (i >= w && fora[i - w]) || (i < n - w && fora[i + w])
    if (vizinho) {
      const l = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3
      d[i * 4 + 3] = Math.round(d[i * 4 + 3] * Math.min(1, Math.max(0.35, (255 - l) / 60)))
    }
  }
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
