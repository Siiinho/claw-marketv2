export const LOJAS = [
  {
    id: 'loja3',
    nome: 'Loja principal',
    cidade: '',
    endereco: '',
    telefone: '',
    whatsapp: '',
  },
]

export const USUARIOS = [
  {
    id: 'u-carlos',
    nome: 'Carlos Mendes',
    email: 'admin@exemplo.local',
    senha: 'demo123',
    papel: 'admin',
    cargo: 'Administrador',
  },
  {
    id: 'u-ana',
    nome: 'Ana Paula Silva',
    email: 'gerente@exemplo.local',
    senha: 'demo123',
    papel: 'gerente',
    cargo: 'Gerente',
  },
  {
    id: 'u-juliana',
    nome: 'Juliana Costa',
    email: 'repositor@exemplo.local',
    senha: 'demo123',
    papel: 'repositor',
    cargo: 'Repositora',
  },
]

// O aplicativo começa vazio. Os produtos entram somente por cadastro ou leitura do código de barras.
export const PRODUTOS_SEED = []

export const CONFIG_SEED = {
  nomeMercado: 'Meu Mercado',
  slogan: 'Preço baixo. Desperdício zero.',
  logoDataUrl: '',
  corPrimaria: '#e4232e',
  corSecundaria: '#082b4f',
  corDestaque: '#ffc928',
  moeda: 'BRL',
  diasAlerta: 7,
  descontoPadrao: 30,
  sugestoesAuto: true,
  jornalUrl: '',
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
  edicao: '',
  titulo: 'Jornal de Ofertas',
  capa: null,
  contracapa: null,
  pdf: '',
  data: '',
  ym: 0,
  historico: [],
}
