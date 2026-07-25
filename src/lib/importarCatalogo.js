// Importa um catálogo de produtos a partir de planilha (CSV/Excel exportado em texto).
// Pensado para o export do Cartaz Fácil / ERP: detecta separador, mapeia colunas por
// cabeçalho (com ou sem acento) e infere o setor quando não bate com os 9 do app.
import { SETORES } from './utils'
import { inferirSetor } from './produtoApi'

const norm = (s = '') => s.toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

function detectarDelim(linha) {
  const c = (linha.match(/;/g) || []).length
  const v = (linha.match(/,/g) || []).length
  const t = (linha.match(/\t/g) || []).length
  if (t >= c && t >= v) return '\t'
  return c >= v ? ';' : ','
}

function parseLinha(linha, delim) {
  const out = []
  let cur = '', q = false
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i]
    if (q) {
      if (ch === '"') { if (linha[i + 1] === '"') { cur += '"'; i++ } else q = false }
      else cur += ch
    } else {
      if (ch === '"') q = true
      else if (ch === delim) { out.push(cur); cur = '' }
      else cur += ch
    }
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

const numeroBR = (s = '') => {
  if (s == null) return null
  let t = s.toString().replace(/[^\d.,-]/g, '')
  if (!t) return null
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.') // 1.234,56 -> 1234.56
  const n = parseFloat(t)
  return isNaN(n) ? null : n
}

const dataISO = (s = '') => {
  if (!s) return null
  const br = s.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return iso[0]
  return null
}

// acha o índice da coluna por palavras-chave (na ordem de prioridade)
function acharCol(headers, ...padroes) {
  for (const p of padroes) {
    const i = headers.findIndex((h) => p.test(h))
    if (i >= 0) return i
  }
  return -1
}

function casarSetor(valor, nome) {
  const v = norm(valor)
  if (v) {
    const s = SETORES.find((x) => v.includes(norm(x.nome)) || v === x.id || norm(x.nome).includes(v))
    if (s) return s.id
  }
  return inferirSetor(`${nome} ${valor}`)
}

export function importarPlanilha(texto) {
  const linhas = (texto || '').split(/\r?\n/).filter((l) => l.trim())
  if (linhas.length < 2) return { erro: 'Planilha vazia ou sem cabeçalho.', produtos: [] }
  const delim = detectarDelim(linhas[0])
  const headers = parseLinha(linhas[0], delim).map(norm)

  const iNome = acharCol(headers, /descri|produto|^nome|mercadoria/)
  const iMarca = acharCol(headers, /marca|fabric/)
  const iCod = acharCol(headers, /barr|ean|gtin/, /codigo|cod\b/)
  const iPreco = acharCol(headers, /pre.?o.*(venda|normal|vigente|atual)/, /^pre.?o$/, /valor/)
  const iPromo = acharCol(headers, /promo|oferta/)
  const iSetor = acharCol(headers, /setor|categoria|grupo|departa|sec.?o|secao/)
  const iEstoque = acharCol(headers, /estoque|qtd|quant|saldo/)
  const iValidade = acharCol(headers, /validade|vencim|venc/)

  if (iNome < 0) return { erro: 'Não encontrei a coluna de nome/descrição do produto.', produtos: [], headers }

  const produtos = []
  for (let l = 1; l < linhas.length; l++) {
    const c = parseLinha(linhas[l], delim)
    const nome = (c[iNome] || '').trim()
    if (!nome) continue
    const precoNormal = iPreco >= 0 ? numeroBR(c[iPreco]) : null
    produtos.push({
      nome,
      marca: iMarca >= 0 ? c[iMarca] : '',
      codigoBarras: iCod >= 0 ? (c[iCod] || '').replace(/\D/g, '') : '',
      setor: casarSetor(iSetor >= 0 ? c[iSetor] : '', nome),
      precoNormal: precoNormal ?? 0,
      precoPromo: iPromo >= 0 ? numeroBR(c[iPromo]) : null,
      estoque: iEstoque >= 0 ? numeroBR(c[iEstoque]) || 0 : 0,
      validade: iValidade >= 0 ? dataISO(c[iValidade]) : null,
    })
  }
  return { produtos, headers, colunas: { iNome, iMarca, iCod, iPreco, iSetor, iValidade } }
}
