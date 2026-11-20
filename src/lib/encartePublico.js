// Encarte digital publicado — o que a tag NFC abre.
//
// Hoje a publicação fica neste aparelho (localStorage) e se propaga ao vivo
// para todas as abas abertas nele (evento `storage` + BroadcastChannel).
// Quando o Supabase for ligado, só estas três funções mudam: `publicarEncarte`
// grava na tabela, `lerEncartePublicado` lê a versão mais nova e
// `assinarEncarte` usa o Realtime. A página pública não precisa mudar.
//
// Regra de negócio: a validade do produto NUNCA sai daqui. Só passam os campos
// que o cliente pode ver.
import { restaurarImagensSalvas } from './produtoApi'

const CHAVE = 'clawmarket:encarte-publicado:v1'
const CANAL = 'clawmarket-encarte'

const CAMPOS_PUBLICOS = [
  'id', 'nome', 'marca', 'gramagem', 'setor', 'codigoBarras', 'seloOferta',
  'precoNormal', 'precoJornal', 'descontoJornal', 'origemFila',
  'imagem', 'imagemCachePermanente', 'imagemTratamento',
]

const soPublico = (item) => {
  const limpo = {}
  for (const campo of CAMPOS_PUBLICOS) if (item[campo] !== undefined) limpo[campo] = item[campo]
  // fotos grandes em data: ficam no banco de imagens do aparelho; a página as restaura pelo código
  if (limpo.imagemCachePermanente && String(limpo.imagem || '').startsWith('data:')) limpo.imagem = null
  return limpo
}

export function publicarEncarte({ titulo, mercado, periodoDe, periodoAte, tema, itens }) {
  const encarte = {
    versao: Date.now(),
    publicadoEm: new Date().toISOString(),
    titulo,
    mercado,
    periodoDe,
    periodoAte,
    tema: tema || null,
    itens: (itens || []).map(soPublico),
  }
  try {
    localStorage.setItem(CHAVE, JSON.stringify(encarte))
  } catch (_) {
    // sem espaço: publica sem as fotos embutidas
    encarte.itens = encarte.itens.map((i) => (String(i.imagem || '').startsWith('data:') ? { ...i, imagem: null } : i))
    localStorage.setItem(CHAVE, JSON.stringify(encarte))
  }
  try {
    const canal = new BroadcastChannel(CANAL)
    canal.postMessage(encarte.versao)
    canal.close()
  } catch (_) {}
  return encarte
}

export function lerEncartePublicado() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) || 'null')
  } catch (_) {
    return null
  }
}

export async function carregarEncartePublicado() {
  const encarte = lerEncartePublicado()
  if (!encarte) return null
  const itens = await restaurarImagensSalvas(encarte.itens || [])
  return { ...encarte, itens }
}

// Chama `aoMudar` sempre que uma nova versão for publicada. Devolve a função de cancelar.
export function assinarEncarte(aoMudar) {
  const naChave = (evento) => { if (evento.key === CHAVE) aoMudar() }
  const aoVoltar = () => { if (document.visibilityState === 'visible') aoMudar() }
  window.addEventListener('storage', naChave)
  document.addEventListener('visibilitychange', aoVoltar)
  let canal = null
  try {
    canal = new BroadcastChannel(CANAL)
    canal.onmessage = () => aoMudar()
  } catch (_) {}
  return () => {
    window.removeEventListener('storage', naChave)
    document.removeEventListener('visibilitychange', aoVoltar)
    canal?.close()
  }
}
