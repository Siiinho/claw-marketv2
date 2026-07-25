// Busca a edição mais recente do jornal oficial da Bengala direto no WordPress.
// Roda no SERVIDOR (Vite dev middleware ou função serverless) — sem CORS.
//
// Observações sobre o site (descobertas na prática):
//  - A página pública /jornal fica desatualizada (ainda referencia a capa de 2023),
//    mas a imagem MAIS NOVA que ela referencia é a capa atual (/2026/06/...).
//  - A pasta /uploads/AAAA/MM/ é a data de UPLOAD, não do encarte.
//  - O período real do encarte está no NOME do PDF (ex.: 25.06-a-01.07.26).
// Por isso usamos a capa mais nova (por ano/mês de upload) como sinal da edição
// atual, e o nome do PDF para o período. O campo `ym` (ano*100+mês) deixa o app
// decidir se a edição encontrada é realmente mais nova que a já salva.

const BASE = 'https://bengalasupermercado.com.br'
const RE_UPLOAD = /\/wp-content\/uploads\/(\d{4})\/(\d{2})\/([^"'()\s\\]+?\.(?:jpe?g|png|pdf))/gi
const RE_PERIODO = /(\d{2})\.(\d{2})\s*-?\s*[aAàÀ]\s*-?\s*(\d{2})\.(\d{2})\.(\d{2})/
const MESES = ['', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

async function getJSON(url, ms = 9000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'ClawMarket/1.0', Accept: 'application/json' } })
    if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`)
    return await r.json()
  } finally {
    clearTimeout(t)
  }
}

function coletarUrls(texto) {
  const out = []
  if (!texto) return out
  let m
  RE_UPLOAD.lastIndex = 0
  while ((m = RE_UPLOAD.exec(texto))) {
    const nome = m[3]
    out.push({ url: BASE + m[0], ano: +m[1], mes: +m[2], nome, ext: nome.split('.').pop().toLowerCase() })
  }
  return out
}

// mais recente por mês de upload (ano, mês) e depois nome
const maisRecente = (a, b) => b.ano - a.ano || b.mes - a.mes || b.nome.localeCompare(a.nome)

function periodoDoNome(nome) {
  const m = nome.match(RE_PERIODO)
  if (!m) return null
  const [, d1, mes1, d2, mes2, yy] = m
  return { periodo: `${d1}.${mes1}–${d2}.${mes2}`, fimISO: `20${yy}-${mes2}-${d2}` }
}

export async function buscarJornalOficial() {
  const pool = []
  let modified = null

  try {
    const pages = await getJSON(`${BASE}/wp-json/wp/v2/pages?slug=jornal`)
    const page = Array.isArray(pages) ? pages[0] : pages
    pool.push(...coletarUrls(page?.content?.rendered))
    modified = (page?.modified || '').slice(0, 10) || null
  } catch (_) {}

  try {
    const media = await getJSON(`${BASE}/wp-json/wp/v2/media?per_page=80&orderby=date&order=desc`)
    if (Array.isArray(media)) media.forEach((it) => pool.push(...coletarUrls(it?.source_url)))
  } catch (_) {}

  if (!pool.length) throw new Error('Não encontrei arquivos do jornal na API da Bengala.')

  const vistos = new Set()
  const urls = pool.filter((u) => u && u.url && !vistos.has(u.url) && vistos.add(u.url))

  const imgs = urls.filter((u) => u.ext !== 'pdf').sort(maisRecente)
  const pdfs = urls.filter((u) => u.ext === 'pdf' && /jornal|semana|encarte|bengala/i.test(u.nome))

  // capa = imagem "capa" mais nova por mês de upload (a página aponta a atual)
  const capa = imgs.find((u) => /capa/i.test(u.nome)) || imgs[0] || null
  const ym = capa ? capa.ano * 100 + capa.mes : 0

  // contracapa: mesma pasta da capa; senão derivada de "capa"->"contra"
  let contra = imgs.find((u) => /contra/i.test(u.nome) && capa && u.ano === capa.ano && u.mes === capa.mes) || null
  if (!contra && capa && /capa/i.test(capa.url)) {
    const derivada = capa.url.replace(/capa/i, 'contra')
    if (derivada !== capa.url) contra = { url: derivada, ano: capa.ano, mes: capa.mes, nome: 'derivada' }
  }

  // PDF: o do mesmo mês da capa dá o período exato; senão anexamos o mais recente
  // só como link, mas o RÓTULO segue o mês da capa (evita "junho" com período de maio).
  const pdfsComData = pdfs.map((p) => ({ ...p, per: periodoDoNome(p.nome) })).filter((p) => p.per)
  pdfsComData.sort((a, b) => b.per.fimISO.localeCompare(a.per.fimISO))
  const pdfMesCapa = pdfsComData.find((p) => capa && p.ano === capa.ano && p.mes === capa.mes) || null
  const pdf = pdfMesCapa || pdfsComData[0] || pdfs.slice().sort(maisRecente)[0] || null
  const per = pdfMesCapa ? pdfMesCapa.per : null

  const data = per?.fimISO || (capa ? `${capa.ano}-${String(capa.mes).padStart(2, '0')}-01` : modified)
  const edicao = per ? `B · ${per.periodo}` : capa ? `${MESES[capa.mes]}/${capa.ano}` : 'atual'

  return {
    edicao,
    titulo: 'Jornal de Ofertas SEMANA B!',
    data,
    ym,
    capa: capa?.url || null,
    contracapa: contra?.url || null,
    pdf: pdf?.url || null,
    fonte: `${BASE}/jornal`,
    atualizadoEm: new Date().toISOString(),
  }
}
