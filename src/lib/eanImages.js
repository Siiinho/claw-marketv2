// Lado do app da integração EAN Images.
// O app NÃO conhece a chave: ele só chama o servidor do próprio ClawMarket
// (/api/eanimages), que lê EANIMAGES_API_KEY do arquivo .env e fala com a EAN Images.

// A chave está configurada no servidor? (consulta grátis, feita uma vez por sessão)
let configurada = null
export async function eanImagesConfigurada() {
  if (configurada !== null) return configurada
  if (typeof fetch !== 'function' || globalThis.location?.protocol === 'file:') return (configurada = false)
  try {
    const r = await fetch('/api/eanimages?status=1', { headers: { Accept: 'application/json' } })
    configurada = r.ok && Boolean((await r.json())?.configurada)
  } catch (_) {
    configurada = false
  }
  return configurada
}

// Código de barras comercial (EAN-8/12/13/14 com dígito verificador certo). Códigos internos e
// de balança (começam com 2 ou com muitos zeros) não existem na EAN Images: não gastam consulta.
export function eanComercial(codigo) {
  const c = String(codigo || '').replace(/\D/g, '')
  if (![8, 12, 13, 14].includes(c.length) || /^0{5}/.test(c) || (c.length === 13 && c[0] === '2')) return false
  const digitos = c.split('').map(Number)
  const dv = digitos.pop()
  const soma = digitos.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (soma % 10)) % 10 === dv
}

// Códigos já tentados na EAN Images (não acharam foto): só tenta de novo depois de 7 dias,
// para não gastar crédito a cada vez que o jornal abre.
const CHAVE_TENTADOS = 'clawmarket:eanimages-tentados:v1'
const ESPERA_MS = 7 * 24 * 60 * 60 * 1000
function lerTentados() {
  try { return JSON.parse(localStorage.getItem(CHAVE_TENTADOS) || '{}') } catch (_) { return {} }
}
export function eanImagesJaTentado(codigo) {
  const quando = lerTentados()[String(codigo)]
  return Boolean(quando) && Date.now() - quando < ESPERA_MS
}
export function marcarEanImagesTentado(codigo) {
  try {
    const t = lerTentados()
    t[String(codigo)] = Date.now()
    localStorage.setItem(CHAVE_TENTADOS, JSON.stringify(t))
  } catch (_) { /* sem armazenamento: tenta de novo na próxima sessão */ }
}

// Devolve { encontrado, nome, descricao, imagem (data URL), creditosCobrados, saldo } ou null.
export async function buscarNaEanImages(codigo) {
  if (typeof fetch !== 'function' || globalThis.location?.protocol === 'file:') return null
  const c = String(codigo || '').replace(/\D/g, '')
  if (!c) return null
  try {
    const r = await fetch(`/api/eanimages?ean=${encodeURIComponent(c)}`, { headers: { Accept: 'application/json' } })
    if (!(r.headers.get('content-type') || '').includes('application/json')) return null
    const json = await r.json()
    if (!r.ok) return { encontrado: false, erro: json?.erro, codigo: json?.codigo }
    return json
  } catch (_) {
    return null
  }
}
