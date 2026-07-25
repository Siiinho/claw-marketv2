// ===== Helpers centrais do ClawMarket =====

export const SETORES = [
  { id: 'padaria', nome: 'Padaria', cor: '#c77e1a', corTag: '#8a5310', icone: 'Croissant' },
  { id: 'laticinios', nome: 'Laticínios', cor: '#3e86c9', corTag: '#1f5a93', icone: 'Milk' },
  { id: 'frios', nome: 'Frios', cor: '#b23a48', corTag: '#7c2230', icone: 'Beef' },
  { id: 'hortifruti', nome: 'Hortifruti', cor: '#2e9e6b', corTag: '#1c6e48', icone: 'Apple' },
  { id: 'bebidas', nome: 'Bebidas', cor: '#e23a2e', corTag: '#9e2018', icone: 'Wine' },
  { id: 'mercearia', nome: 'Mercearia', cor: '#d9641f', corTag: '#964114', icone: 'ShoppingBasket' },
  { id: 'limpeza', nome: 'Limpeza', cor: '#178f86', corTag: '#0c5f58', icone: 'SprayCan' },
  { id: 'congelados', nome: 'Congelados', cor: '#2c84b0', corTag: '#1a597a', icone: 'Snowflake' },
  { id: 'petshop', nome: 'Pet Shop', cor: '#8a4fa0', corTag: '#5c3070', icone: 'PawPrint' },
]

export const setorById = (id) => SETORES.find((s) => s.id === id) || SETORES[0]

// ---- datas ----
export const hoje = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export const parseData = (iso) => {
  if (!iso || typeof iso !== 'string') return null
  const d = new Date(iso + 'T00:00:00')
  return isNaN(d) ? null : d
}

export const diasParaVencer = (iso) => {
  const data = parseData(iso)
  if (!data) return null
  const ms = data - hoje()
  return Math.round(ms / 86400000)
}

export const dataISOmaisDias = (dias) => {
  const d = hoje()
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

export const formatData = (iso) =>
  parseData(iso)?.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) || '—'

export const formatDataCurta = (iso) =>
  parseData(iso)?.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) || '—'

const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
export const diaSemana = (iso) => {
  const data = parseData(iso)
  return data ? DIAS_SEMANA[data.getDay()] : ''
}

// ---- status de validade (regra única e centralizada) ----
// <= 2 dias: crítico | <= 7 dias: atenção | > 7: normal | < 0: vencido
export function statusValidade(iso) {
  const d = diasParaVencer(iso)
  if (d == null) return { id: 'sem-validade', label: 'Sem validade', cor: '#6b5a54', bg: '#f3ead9', dias: null }
  if (d < 0) return { id: 'vencido', label: 'Vencido', cor: '#7a241b', bg: '#f3dcd8', dias: d }
  if (d <= 2) return { id: 'critico', label: 'Crítico', cor: '#c42b2b', bg: '#fbe5e5', dias: d }
  if (d <= 7) return { id: 'atencao', label: 'Atenção', cor: '#a9740d', bg: '#fdf0d8', dias: d }
  return { id: 'normal', label: 'Normal', cor: '#1c6e48', bg: '#e2f3ea', dias: d }
}

export const labelDias = (dias) => {
  if (dias == null) return 'validade não informada'
  if (dias < 0) return `vencido há ${Math.abs(dias)}d`
  if (dias === 0) return 'vence hoje'
  if (dias === 1) return 'vence amanhã'
  return `vence em ${dias} dias`
}

// ---- dinheiro ----
export const formatBRL = (v) =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// quebra um valor em { reais, centavos } para o preço estilo varejo
export const partesPreco = (v) => {
  const fixed = (v ?? 0).toFixed(2)
  const [reais, centavos] = fixed.split('.')
  return { reais, centavos }
}

// motor de precificação: faixa de desconto aplicável a um produto (por dias até vencer)
export function regraDoProduto(dias, regras = []) {
  if (dias == null || dias < 0) return null
  const ordenadas = [...regras].sort((a, b) => a.diasMax - b.diasMax)
  return ordenadas.find((r) => dias <= r.diasMax) || null
}

export const precoComRegra = (precoNormal, regra) =>
  regra ? precoNormal * (1 - regra.desconto / 100) : precoNormal

export const percentDesc = (normal, promo) => {
  if (!normal || !promo || promo >= normal) return 0
  return Math.round((1 - promo / normal) * 100)
}

export const uid = () => Math.random().toString(36).slice(2, 10)

// ===== ESG / sustentabilidade =====
// fatores (médias do setor de alimentos; ajustáveis em Configurações no futuro)
export const FATOR_CO2 = 2.5 // kg de CO₂e por kg de alimento desperdiçado
export const KG_POR_REFEICAO = 0.4 // kg de alimento ~ 1 refeição

// estima o peso (kg) de UMA unidade a partir do nome (ex.: "500g", "2L", "5kg", "kg")
export function pesoUnitarioKg(nome = '') {
  const n = nome.toLowerCase().replace(',', '.')
  let m
  if ((m = n.match(/(\d+(?:\.\d+)?)\s*kg\b/))) return parseFloat(m[1])
  if ((m = n.match(/(\d+(?:\.\d+)?)\s*ml\b/))) return parseFloat(m[1]) / 1000
  if ((m = n.match(/(\d+(?:\.\d+)?)\s*l\b/))) return parseFloat(m[1]) // litro ~ kg
  if ((m = n.match(/(\d+(?:\.\d+)?)\s*g\b/))) return parseFloat(m[1]) / 1000
  if (/\bkg\b/.test(n)) return 1 // vendido por kg (estoque já está em kg)
  return 0.5 // pacote médio padrão
}

export const pesoTotalKg = (p) => pesoUnitarioKg(p?.nome) * (p?.estoque || 0)

// ---- imagem: lê um arquivo, redimensiona e devolve dataURL (evita estourar o localStorage) ----
export function arquivoParaDataURL(file, max = 480) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const escala = Math.min(1, max / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * escala))
        const h = Math.max(1, Math.round(img.height * escala))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}
