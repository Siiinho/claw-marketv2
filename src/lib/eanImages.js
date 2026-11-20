// Lado do app da integração EAN Images.
// A chave digitada nas Configurações fica só neste aparelho e vai apenas
// para o servidor do próprio ClawMarket (/api/eanimages), que conversa com a EAN Images.
const CHAVE_LS = 'clawmarket:eanimages:chave'
const DADOS_LS = 'clawmarket:eanimages:buscar-dados'

export function lerChaveEanImages() {
  try { return localStorage.getItem(CHAVE_LS) || '' } catch (_) { return '' }
}
export function salvarChaveEanImages(chave) {
  try {
    const limpa = String(chave || '').trim()
    if (limpa) localStorage.setItem(CHAVE_LS, limpa)
    else localStorage.removeItem(CHAVE_LS)
  } catch (_) {}
}
export function lerBuscarDadosEanImages() {
  try { return localStorage.getItem(DADOS_LS) !== '0' } catch (_) { return true }
}
export function salvarBuscarDadosEanImages(ativo) {
  try { localStorage.setItem(DADOS_LS, ativo ? '1' : '0') } catch (_) {}
}

const cabecalhos = () => {
  const chave = lerChaveEanImages()
  return { Accept: 'application/json', ...(chave ? { 'X-EanImages-Key': chave } : {}) }
}

async function lerResposta(r) {
  const tipo = r.headers.get('content-type') || ''
  if (!tipo.includes('application/json')) {
    throw new Error('O servidor do ClawMarket não respondeu. Rode o app com "npm run dev" ou "npm run preview" (ou hospede na Vercel).')
  }
  return r.json()
}

export async function testarChaveEanImages() {
  const r = await fetch('/api/eanimages?conta=1', { headers: cabecalhos() })
  const dados = await lerResposta(r)
  if (!r.ok) throw new Error(dados?.erro || 'Não foi possível validar a chave.')
  return dados
}

// Devolve { encontrado, nome, descricao, imagem (data URL), creditosCobrados, saldo } ou null.
export async function buscarNaEanImages(codigo) {
  if (typeof fetch !== 'function' || globalThis.location?.protocol === 'file:') return null
  const c = String(codigo || '').replace(/\D/g, '')
  if (!c) return null
  try {
    const dados = lerBuscarDadosEanImages() ? '' : '&dados=0'
    const r = await fetch(`/api/eanimages?ean=${encodeURIComponent(c)}${dados}`, { headers: cabecalhos() })
    const json = await lerResposta(r)
    if (!r.ok) return { encontrado: false, erro: json?.erro, codigo: json?.codigo }
    return json
  } catch (_) {
    return null
  }
}
