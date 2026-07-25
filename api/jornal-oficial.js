// Função serverless (estilo Vercel) para sincronizar o jornal oficial em produção.
// A lógica é a mesma do dev (server/jornalOficial.js).
//
// Deploy: na Vercel funciona como /api/jornal-oficial automaticamente.
// Em outras plataformas (Netlify Functions, Cloudflare Workers), adapte o
// invólucro abaixo — o miolo (buscarJornalOficial) é reutilizável.
import { buscarJornalOficial } from '../server/jornalOficial.js'

export default async function handler(_req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate')
  try {
    const dados = await buscarJornalOficial()
    res.status(200).json(dados)
  } catch (e) {
    res.status(502).json({ error: String(e?.message || e) })
  }
}
