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
  { id: 'acougue', nome: 'Açougue', cor: '#a4161a', corTag: '#6e0d10', icone: 'Drumstick' },
  { id: 'higiene', nome: 'Higiene e Beleza', cor: '#c2185b', corTag: '#87103f', icone: 'Bath' },
  { id: 'utilidades', nome: 'Utilidades', cor: '#5c6b7a', corTag: '#3b4652', icone: 'House' },
  { id: 'farmacia', nome: 'Farmácia', cor: '#2e6fb0', corTag: '#1d4a78', icone: 'Pill' },
]

export const setorById = (id) => SETORES.find((s) => s.id === id) || SETORES[0]

// Ilustração 3D de cada setor (Fluent Emoji da Microsoft, licença MIT, em public/setores).
// 'todos' é o Geral, 'mercado-encarte' a estrela e 'compras' a lista de compras.
const ILUSTRACAO_EXTRA = { todos: 'geral', compras: 'geral', 'mercado-encarte': 'estrela', outros: 'geral' }
const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'
export const ilustracaoSetor = (id) => `${baseUrl}setores/${ILUSTRACAO_EXTRA[id] || (SETORES.some((s) => s.id === id) ? id : 'geral')}.webp`

// ---- datas ----
// O piloto opera em São Paulo. Usar a data civil da loja evita que um
// coletor configurado em UTC considere um produto que vence hoje como vencido.
const FUSO_LOJA = 'America/Sao_Paulo'

const partesHojeNaLoja = () => {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_LOJA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const valor = (tipo) => Number(partes.find((parte) => parte.type === tipo)?.value)
  return { ano: valor('year'), mes: valor('month'), dia: valor('day') }
}

export const hoje = () => {
  const { ano, mes, dia } = partesHojeNaLoja()
  return new Date(ano, mes - 1, dia)
}

export const parseData = (iso) => {
  if (!iso || typeof iso !== 'string') return null
  const d = new Date(iso + 'T00:00:00')
  return isNaN(d) ? null : d
}

export const diasParaVencer = (iso) => {
  const data = parseData(iso)
  if (!data) return null
  const { ano, mes, dia } = partesHojeNaLoja()
  const alvo = Date.UTC(data.getFullYear(), data.getMonth(), data.getDate())
  const atual = Date.UTC(ano, mes - 1, dia)
  const ms = alvo - atual
  return Math.round(ms / 86400000)
}

export const dataISOmaisDias = (dias) => {
  const { ano, mes, dia } = partesHojeNaLoja()
  const d = new Date(Date.UTC(ano, mes - 1, dia + dias))
  return [d.getUTCFullYear(), String(d.getUTCMonth() + 1).padStart(2, '0'), String(d.getUTCDate()).padStart(2, '0')].join('-')
}

// Mercado Encarte: jornal especial com as ofertas do dia escolhidas pelo próprio mercado.
// Cada produto recebe o dia da oferta (domingo, segunda…); depois que o dia passa, ele sai sozinho.
export const MERCADO_ENCARTE = { id: 'mercado-encarte', nome: 'Mercado Encarte', cor: '#c1121f', corTag: '#c1121f', icone: 'Star' }
export const noMercadoEncarte = (produto, hoje = dataISOmaisDias(0)) => Boolean(produto?.encarteMercadoDia) && produto.encarteMercadoDia >= hoje

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
  if (d == null) return { id: 'sem-validade', label: 'Sem validade', cor: '#3b4656', bg: '#e8edf3', dias: null }
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
// Preço pode chegar como texto ("5,99", "5.99", "R$ 5,99"): vira número; inválido vira null.
export const paraNumero = (v) => {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  let t = String(v).replace(/[^\d,.-]/g, '')
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  const n = Number(t)
  return t && Number.isFinite(n) ? n : null
}

export const formatBRL = (v) =>
  (paraNumero(v) ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// quebra um valor em { reais, centavos } para o preço estilo varejo
export const partesPreco = (v) => {
  const fixed = (paraNumero(v) ?? 0).toFixed(2)
  const [reais, centavos] = fixed.split('.')
  return { reais, centavos }
}

// motor de precificação: faixa de desconto aplicável a um produto (por dias até vencer)
export function regraDoProduto(dias, regras = []) {
  if (dias == null || dias < 0) return null
  const ordenadas = [...regras].sort((a, b) => a.diasMax - b.diasMax)
  return ordenadas.find((r) => dias <= r.diasMax) || null
}

// Preço de oferta SUGERIDO pela validade. Nunca é aplicado sozinho: quem decide é a pessoa.
export function sugestaoDePreco(precoNormal, validade, config = {}) {
  const normal = Number(precoNormal) || 0
  const dias = diasParaVencer(validade)
  if (!(normal > 0) || dias == null || dias < 0) return null
  const regra = regraDoProduto(dias, config.regrasPreco || [])
  if (!regra) return null
  const valor = Math.round(precoComRegra(normal, regra) * 100) / 100
  return valor > 0 && valor < normal ? { valor, desconto: regra.desconto, dias } : null
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
        const ctx = canvas.getContext('2d')
        // PNG sem fundo viraria preto no JPEG
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

// "1 produto" / "3 produtos": evita o "produto(s)" na interface
export const plural = (n, singular, pluralForma) => `${n} ${n === 1 ? singular : pluralForma}`

// ---- selos de oferta (aparecem no encarte impresso e no digital) ----
// A validade do produto NUNCA vai para o encarte: o selo é o que o cliente vê.
export const SELOS_OFERTA = [
  { id: 'oferta', texto: 'Oferta', fundo: '#e4232e', cor: '#ffffff' },
  { id: 'imperdivel', texto: 'Imperdível', fundo: '#ffc928', cor: '#082b4f' },
  { id: 'queima', texto: 'Queima de estoque', fundo: '#082b4f', cor: '#ffc928' },
  { id: 'super', texto: 'Super oferta', fundo: '#bf1721', cor: '#ffc928' },
  { id: 'precobaixo', texto: 'Preço baixo', fundo: '#1c6e48', cor: '#ffffff' },
  { id: 'leve-mais', texto: 'Leve mais, pague menos', fundo: '#d9641f', cor: '#ffffff' },
  { id: 'so-hoje', texto: 'Só hoje', fundo: '#7c2230', cor: '#ffffff' },
  { id: 'exclusivo', texto: 'Exclusivo da loja', fundo: '#2c84b0', cor: '#ffffff' },
  // Escolha do operador para um produto sair sem selo nenhum.
  { id: 'nenhum', texto: 'Sem selo', fundo: '#ffffff', cor: '#5c6b7a', nenhum: true },
]

export const seloOfertaById = (id) => SELOS_OFERTA.find((s) => s.id === id) || null

// Selo do produto: só o que o operador escolheu. Sem escolha, nenhum.
export const SEM_SELO = SELOS_OFERTA.find((s) => s.nenhum)
export const seloDoProduto = (produto) => seloOfertaById(produto?.seloOferta) || SEM_SELO
// O cartaz Clássico é feito em volta do selo do topo: sem escolha ele usa "Oferta".
export const seloDoCartaz = (produto) => seloOfertaById(produto?.seloOferta) || SELOS_OFERTA[0]

// ---- baixas (troca com fornecedor ou perda) ----
// Um vencido fica resolvido quando a baixa zerou o estoque daquela validade.
export const loteResolvido = (p) => Boolean(p?.baixaValidade) && p.baixaValidade === p.validade
export const precisaDecisao = (p) => {
  const d = diasParaVencer(p?.validade)
  return d != null && d < 0 && !loteResolvido(p)
}
export const dataCadastro = (p) => p?.cadastradoEm || p?.adicionadoFilaEm || null
export const todasBaixas = (produtos = []) =>
  produtos
    .flatMap((p) => (p.baixas || []).map((b) => ({ ...b, produtoId: p.id, produto: p })))
    .sort((a, b) => String(b.em).localeCompare(String(a.em)))
export const valorPerdasRegistradas = (produtos = []) =>
  produtos.reduce((s, p) => s + (p.baixas || []).filter((b) => b.tipo === 'perda').reduce((a, b) => a + (Number(b.valor) || 0), 0), 0)

// ---- marcas que aceitam troca ou que são sempre perda (cadastro em Relatórios) ----
// config.marcasTroca = { [chave]: { nome, regra: 'troca' | 'perda' } }
export const chaveMarca = (marca) => String(marca || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ')
export const regraDaMarca = (config, marca) => (config?.marcasTroca || {})[chaveMarca(marca)]?.regra || null
// Produto vencido ou perto de vencer que ainda precisa de troca ou perda.
export const precisaTrocaOuPerda = (p, dias = 7) => {
  const d = diasParaVencer(p?.validade)
  return d != null && d <= dias && !loteResolvido(p)
}
