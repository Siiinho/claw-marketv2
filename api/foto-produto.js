// Função da Vercel: /api/foto-produto (regra de qualidade e retirada de fundo da foto do produto).
import { middlewareFotoProduto } from '../server/fotoProduto.js'

export const config = { maxDuration: 30 }
export default middlewareFotoProduto
