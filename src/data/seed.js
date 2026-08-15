import capaOficial from '../assets/jornal-oficial-capa.jpg'
import contraOficial from '../assets/jornal-oficial-contra.jpg'

export const LOJAS = [
  {
    id: 'loja3',
    nome: 'Bengala Loja 3',
    cidade: 'Parque Santa Madalena',
    endereco: 'Rua Serra do Navio, nº 355',
    telefone: '(11) 2719-7195',
    whatsapp: '(11) 96607-2187',
  },
]

export const USUARIOS = []

// O aplicativo começa vazio. Os produtos entram somente por cadastro ou leitura do código de barras.
export const PRODUTOS_SEED = []

export const CONFIG_SEED = {
  nomeMercado: 'Bengala Supermercado',
  moeda: 'BRL',
  diasAlerta: 7,
  descontoPadrao: 30,
  sugestoesAuto: true,
  jornalUrl: 'https://bengalasupermercado.com.br/jornal',
  // motor de precificação: faixas de desconto por dias até vencer
  regrasPreco: [
    { id: 'r1', diasMax: 2, desconto: 50 },
    { id: 'r2', diasMax: 5, desconto: 30 },
    { id: 'r3', diasMax: 7, desconto: 15 },
  ],
  usarRegrasNasSugestoes: true, // sugestões de oferta usam o motor (em vez do desconto fixo)
}

export const OFERTAS_SEED = []
export const JORNAIS_SEED = []
export const JORNAL_OFICIAL_SEED = {
  edicao: 'B · 25.06–01.07',
  titulo: 'Jornal de Ofertas SEMANA B!',
  capa: capaOficial,
  contracapa: contraOficial,
  pdf: 'https://bengalasupermercado.com.br/wp-content/uploads/2026/06/JORNAL-SEMANA-B-25.06-a-01.07.26.pdf',
  data: '2026-06-25',
  ym: 202606,
  historico: [],
}
