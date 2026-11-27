import { useEffect, useState } from 'react'
import { SimboloClawMarket } from './MarcaClawMarket'

// Abertura do ClawMarket: a etiqueta entra, as três garras riscam e o nome aparece.
// Fica pelo menos o tempo da animação e some quando o app termina de carregar a sessão.
const MINIMO = 1600

export default function AberturaApp({ pronto }) {
  const [tempoOk, setTempoOk] = useState(false)
  const [saindo, setSaindo] = useState(false)
  const [fim, setFim] = useState(false)
  useEffect(() => { const t = setTimeout(() => setTempoOk(true), MINIMO); return () => clearTimeout(t) }, [])
  useEffect(() => {
    if (!(pronto && tempoOk)) return undefined
    setSaindo(true)
    const t = setTimeout(() => setFim(true), 450)
    return () => clearTimeout(t)
  }, [pronto, tempoOk])
  if (fim) return null
  return (
    <div className={`cm-ap ${saindo ? 'cm-ap-sai' : ''}`} role="status" aria-label="Abrindo o ClawMarket">
      <style>{CSS}</style>
      <div className="cm-ap-luz" aria-hidden="true" />
      <div className="cm-ap-centro">
        <div className="cm-ap-simbolo">
          <SimboloClawMarket tamanho={96} />
          <svg className="cm-ap-risco" viewBox="0 0 64 64" aria-hidden="true">
            <path d="M31 21 Q27 32 17 35" /><path d="M38.5 25 Q33.5 38 21 42.5" /><path d="M42 33 Q39 43 29 46" />
          </svg>
          <span className="cm-ap-brilho" aria-hidden="true" />
        </div>
        <p className="cm-ap-nome"><span>Claw</span><b>Market</b></p>
        <p className="cm-ap-sub">Encartes digitais para supermercados</p>
        <div className="cm-ap-barra" aria-hidden="true"><span /></div>
      </div>
    </div>
  )
}

const CSS = `
.cm-ap { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; overflow: hidden;
  background: radial-gradient(120% 90% at 50% 25%, #17406f 0%, #0b2445 50%, #050f20 100%); color: #fff; transition: opacity .45s ease, transform .45s ease }
.cm-ap-sai { opacity: 0; transform: scale(1.04); pointer-events: none }
.cm-ap-luz { position: absolute; width: 560px; height: 560px; border-radius: 50%; background: radial-gradient(circle, rgba(255,201,40,.22), transparent 62%); animation: cm-ap-luz 2.8s ease-in-out infinite }
.cm-ap-centro { position: relative; display: flex; flex-direction: column; align-items: center; padding: 24px }
.cm-ap-simbolo { position: relative; width: 96px; height: 96px; border-radius: 22px; filter: drop-shadow(0 14px 28px rgba(0,0,0,.5)); animation: cm-ap-entra .7s cubic-bezier(.2,1.5,.4,1) both, cm-ap-boia 3s ease-in-out 1s infinite }
.cm-ap-risco { position: absolute; inset: 0; width: 96px; height: 96px; overflow: visible }
.cm-ap-risco path { fill: none; stroke: #fff; stroke-width: 2.6; stroke-linecap: round; stroke-dasharray: 30; stroke-dashoffset: 30; opacity: 0; animation: cm-ap-risca .38s ease-out forwards }
.cm-ap-risco path:nth-child(1) { animation-delay: .55s } .cm-ap-risco path:nth-child(2) { animation-delay: .68s } .cm-ap-risco path:nth-child(3) { animation-delay: .81s }
.cm-ap-brilho { position: absolute; inset: 0; border-radius: 22px; overflow: hidden; background: linear-gradient(110deg, transparent 35%, rgba(255,255,255,.35) 50%, transparent 65%); background-size: 250% 100%; background-position: 150% 0; animation: cm-ap-brilha 1.1s ease-in-out 1.05s both }
.cm-ap-nome { margin-top: 20px; font-size: 34px; font-weight: 900; letter-spacing: -.01em; line-height: 1; animation: cm-ap-sobe .5s .9s cubic-bezier(.2,.8,.2,1) both }
.cm-ap-nome b { color: #ffc928 }
.cm-ap-sub { margin-top: 8px; font-size: 12px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: rgba(255,255,255,.7); animation: cm-ap-sobe .5s 1.05s both }
.cm-ap-barra { margin-top: 26px; width: 160px; height: 4px; border-radius: 4px; background: rgba(255,255,255,.14); overflow: hidden; animation: cm-ap-sobe .4s 1.1s both }
.cm-ap-barra span { display: block; width: 40%; height: 100%; border-radius: 4px; background: linear-gradient(90deg, #ffc928, #e4232e); animation: cm-ap-corre 1.1s ease-in-out infinite }
@keyframes cm-ap-entra { from { opacity: 0; transform: scale(.4) rotate(-18deg) } }
@keyframes cm-ap-boia { 50% { transform: translateY(-5px) } }
@keyframes cm-ap-risca { 0% { opacity: .9; stroke-dashoffset: 30 } 70% { opacity: .9; stroke-dashoffset: 0 } 100% { opacity: 0; stroke-dashoffset: 0 } }
@keyframes cm-ap-brilha { from { background-position: 150% 0 } to { background-position: -50% 0 } }
@keyframes cm-ap-sobe { from { opacity: 0; transform: translateY(12px) } }
@keyframes cm-ap-corre { from { transform: translateX(-110%) } to { transform: translateX(260%) } }
@keyframes cm-ap-luz { 50% { transform: scale(1.1); opacity: .7 } }
@media (prefers-reduced-motion: reduce) { .cm-ap *, .cm-ap-luz { animation-duration: .01s !important; animation-delay: 0s !important; animation-iteration-count: 1 !important } }
`
