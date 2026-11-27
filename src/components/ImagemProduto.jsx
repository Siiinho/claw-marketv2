import { createContext, useContext, useEffect, useState } from 'react'
import { semFundo } from '../lib/semFundo'

// Como as páginas do encarte desenham a foto do produto. Quem envolve a página decide:
//  - semFundo: tira o fundo branco da foto (jornal para folhear);
//  - marcados: ids que o cliente circulou (lista de compras) ganham a marca de caneta.
export const ContextoEncarte = createContext({ semFundo: false, marcados: null })
export const useContextoEncarte = () => useContext(ContextoEncarte)

export default function ImagemProduto({ src, ...props }) {
  const { semFundo: tirar } = useContext(ContextoEncarte)
  const [limpa, setLimpa] = useState(null)
  useEffect(() => {
    if (!tirar || !src) { setLimpa(null); return undefined }
    let ativo = true
    semFundo(src).then((r) => { if (ativo) setLimpa(r) })
    return () => { ativo = false }
  }, [tirar, src])
  // enquanto prepara, mostra a original (sem piscar vazio). Recortada, ganha sombra para saltar do fundo.
  const recortada = tirar && limpa && limpa !== src
  const style = recortada ? { ...props.style, filter: 'drop-shadow(0 5px 6px rgba(0,0,0,.45)) saturate(1.08) contrast(1.03)' } : props.style
  return <img src={(tirar && limpa) || src} {...props} style={style} />
}

// Marca de caneta em volta do produto que o cliente pôs na lista.
export function MarcaLista({ id }) {
  const { marcados } = useContext(ContextoEncarte)
  if (!marcados?.has?.(String(id))) return null
  return (
    <svg viewBox="0 0 200 160" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" style={{ zIndex: 6 }}>
      <path d="M100 8 C 162 6, 196 40, 192 82 C 188 130, 140 156, 92 152 C 38 148, 6 118, 10 76 C 14 34, 56 12, 114 14" fill="none" stroke="#d81e29" strokeWidth="6" strokeLinecap="round" className="cm-caneta" />
    </svg>
  )
}
