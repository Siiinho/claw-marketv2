import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { buscarJornalOficial } from './server/jornalOficial.js'
import { responderEanImages } from './server/eanImages.js'
import { middlewareEncarte } from './server/encarteServidor.js'
import { middlewareImagensProdutos } from './server/imagensProdutos.js'
import { middlewareFotoProduto } from './server/fotoProduto.js'

// Middleware de dev: expõe /api/jornal-oficial rodando no servidor (sem CORS).
// Em produção, a mesma lógica vive em api/jornal-oficial.js (função serverless).
function jornalOficialApi() {
  return {
    name: 'jornal-oficial-api',
    configureServer(server) {
      server.middlewares.use('/api/jornal-oficial', async (_req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Access-Control-Allow-Origin', '*')
        try {
          res.end(JSON.stringify(await buscarJornalOficial()))
        } catch (e) {
          res.statusCode = 502
          res.end(JSON.stringify({ error: String(e?.message || e) }))
        }
      })
    },
  }
}

// /api/eanimages no PC da loja: funciona em `npm run dev` e em `npm run preview`.
// Mantém a chave da EAN Images fora do navegador na chamada à API.
function eanImagesApi() {
  const middleware = async (req, res) => {
    const { status, corpo } = await responderEanImages(req.originalUrl || req.url)
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.end(JSON.stringify(corpo))
  }
  return {
    name: 'ean-images-api',
    configureServer(server) { server.middlewares.use('/api/eanimages', middleware) },
    configurePreviewServer(server) { server.middlewares.use('/api/eanimages', middleware) },
  }
}

// /api/encarte: o site do encarte que a tag NFC abre. O app publica aqui e todos os
// celulares com o link aberto recebem a versão nova na hora (ver server/encarteServidor.js).
function encarteApi() {
  return {
    name: 'encarte-api',
    configureServer(server) {
      server.middlewares.use('/api/foto-produto', middlewareFotoProduto)
      server.middlewares.use('/api/encarte', middlewareEncarte)
      server.middlewares.use('/api/imagens-produtos', middlewareImagensProdutos)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/foto-produto', middlewareFotoProduto)
      server.middlewares.use('/api/encarte', middlewareEncarte)
      server.middlewares.use('/api/imagens-produtos', middlewareImagensProdutos)
    },
  }
}

function chaveSecretaSupabase(chave) {
  if (/^sb_secret_/.test(chave)) return true
  try { return JSON.parse(Buffer.from(chave.split('.')[1], 'base64url').toString()).role === 'service_role' } catch (_) { return false }
}

// base './' lets the production build (dist/index.html) open directly from file://
export default defineConfig(({ mode }) => {
  // Variáveis só do servidor (sem prefixo VITE_): ficam fora do código do navegador.
  const env = loadEnv(mode, process.cwd(), '')
  for (const nome of ['EANIMAGES_API_KEY', 'EANIMAGES_COM_DADOS', 'ENCARTE_TOKEN', 'ENCARTE_DIR', 'IMAGENS_PRODUTOS_DIR']) {
    if (env[nome] && !process.env[nome]) process.env[nome] = env[nome]
  }
  // Supabase: a Vercel ligada ao Supabase cria NEXT_PUBLIC_SUPABASE_URL e _ANON_KEY. Só essas duas
  // (públicas por natureza; quem protege os dados são as regras do banco) vão para o navegador.
  const supabaseUrl = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || ''
  const supabaseAnon = env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || ''
  // A chave secreta do Supabase nunca pode ir para o navegador: para o servidor com o aviso.
  if (chaveSecretaSupabase(supabaseAnon)) throw new Error('VITE_SUPABASE_ANON_KEY está com a chave SECRETA do Supabase. Troque pela pública (sb_publishable_...) no .env.')
  // O backend confere o login com as mesmas duas (ver server/fotoProduto.js).
  process.env.CLAW_SUPABASE_URL = supabaseUrl
  process.env.CLAW_SUPABASE_ANON_KEY = supabaseAnon
  return {
  base: './',
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnon),
  },
  // host: true deixa o celular do cliente abrir o encarte pelo IP do PC na rede da loja.
  // `npm run beta`: o mesmo servidor em https (certificado próprio), para testar a câmera do
  // celular pelo IP do PC — o navegador só libera a câmera em https.
  // O Vite só lê o app (index.html): pastas de outros projetos dentro do repositório, como
  // sites-app/, pediam bibliotecas não instaladas e faziam a página recarregar em branco.
  optimizeDeps: { entries: ['index.html'] },
  server: { host: true, watch: { ignored: ['**/sites-app/**', '**/dados/**', '**/dev-dist/**'] } },
  preview: { host: true },
  plugins: [
    ...(mode === 'beta' ? [basicSsl({ name: 'clawmarket-beta' })] : []),
    react(),
    tailwindcss(),
    jornalOficialApi(),
    eanImagesApi(),
    encarteApi(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      devOptions: { enabled: true },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/api\//],
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin &&
              (/\/templates\//.test(url.pathname) || /\.(?:png|jpe?g|webp|svg)$/i.test(url.pathname)),
            handler: 'CacheFirst',
            options: {
              cacheName: 'clawmarket-imagens-v1',
              expiration: { maxEntries: 180, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.endsWith('/api/jornal-oficial'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'clawmarket-api-v1',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 8, maxAgeSeconds: 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        id: './',
        name: 'ClawMarket — Gestão de ofertas e validade',
        short_name: 'ClawMarket',
        description: 'Gestão de validade e ofertas para supermercados',
        lang: 'pt-BR',
        theme_color: '#0b2445',
        background_color: '#081c36',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        scope: './',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  }
})
