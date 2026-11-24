// Lado do app da foto de produto: só envia a foto (ou o link dela) e devolve a resposta do servidor.
// Download, regras e retirada de fundo ficam em server/fotoProduto.js e server/baixarFoto.js.
import { tokenNuvem } from './nuvem'

// `fonte`: um arquivo/Blob, ou { link }.
export async function tratarFotoNoServidor(fonte, { manterFundo = false } = {}) {
  const token = await tokenNuvem()
  const ehLink = Boolean(fonte?.link)
  let r
  try {
    r = await fetch(`/api/foto-produto${manterFundo ? '?fundo=1' : ''}`, {
      method: 'POST',
      headers: { 'Content-Type': ehLink ? 'application/json' : 'application/octet-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: ehLink ? JSON.stringify({ link: fonte.link }) : fonte,
    })
  } catch (_) {
    throw new Error('Sem conexão com o servidor. A foto não foi adicionada.')
  }
  const dados = await r.json().catch(() => null)
  if (r.status === 422 && dados?.motivos?.length) return dados
  if (!r.ok || !dados?.imagem) throw new Error(dados?.erro || 'Não foi possível tratar a foto agora. Tente de novo.')
  return dados
}
