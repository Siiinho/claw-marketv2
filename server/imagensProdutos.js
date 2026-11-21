// Fotos dos produtos guardadas numa pasta do PC da loja (ex.: o HD externo A:\imagens),
// com o nome igual ao código de barras: 7896003740226.jpg.
//
//   GET /api/imagens-produtos/<ean>.jpg   → a foto (jpg, png ou webp, o que existir)
//   GET /api/imagens-produtos?status=1    → { ativo } — se a pasta está configurada
//
// Configure no .env do PC:  IMAGENS_PRODUTOS_DIR=A:\imagens
// Só lê arquivos com nome de código de barras; nada fora da pasta é acessível.
import { createReadStream, promises as fs } from 'node:fs'
import path from 'node:path'

const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
const pasta = () => process.env.IMAGENS_PRODUTOS_DIR || ''

async function acharArquivo(ean) {
  const dir = pasta()
  if (!dir) return null
  // A mercadologia guarda alguns códigos com zero na frente (0751320708991), mas a foto
  // pode estar sem ele (751320708991.jpg), ou o contrário: tenta as formas do código.
  const semZeros = ean.replace(/^0+/, '')
  const nomes = [...new Set([ean, semZeros, semZeros.padStart(13, '0'), semZeros.padStart(12, '0')])].filter((n) => n.length >= 8)
  for (const nome of nomes) {
    for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'JPG', 'PNG']) {
      const arquivo = path.join(dir, `${nome}.${ext}`)
      try {
        const info = await fs.stat(arquivo)
        if (info.isFile()) return { arquivo, tipo: MIME[ext.toLowerCase()], tamanho: info.size }
      } catch (_) { /* tenta a próxima forma */ }
    }
  }
  return null
}

// Middleware no formato connect (Vite). `req.url` chega sem o prefixo /api/imagens-produtos.
export async function middlewareImagensProdutos(req, res) {
  const url = new URL(req.url || '/', 'http://local')
  if (url.searchParams.get('status')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    return res.end(JSON.stringify({ ativo: !!pasta() }))
  }
  const m = url.pathname.match(/^\/(\d{8,14})(?:\.(?:jpe?g|png|webp))?$/i)
  const achado = m && (req.method === 'GET' || req.method === 'HEAD') ? await acharArquivo(m[1]) : null
  if (!achado) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    return res.end(JSON.stringify({ erro: 'Foto não encontrada.' }))
  }
  res.writeHead(200, { 'Content-Type': achado.tipo, 'Content-Length': achado.tamanho, 'Cache-Control': 'public, max-age=604800' })
  if (req.method === 'HEAD') return res.end()
  createReadStream(achado.arquivo).on('error', () => res.destroy()).pipe(res)
}
