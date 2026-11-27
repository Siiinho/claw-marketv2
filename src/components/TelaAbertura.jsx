// Tela de abertura do site do cliente: um jornalzinho folheando enquanto as ofertas chegam.
// A marca vem do último jornal aberto neste celular (fica guardada), então já abre com a logo certa.
import logoBengala from '../assets/logo-bengala-transparente.png'

const CHAVE = 'clawmarket:marca-site'
export function guardarMarcaAbertura(marca) {
  try {
    const leve = marca ? { nome: marca.nome || '', logo: String(marca.logo || '').length < 250000 ? marca.logo || '' : '' } : null
    localStorage.setItem(CHAVE, JSON.stringify(leve))
  } catch (_) { /* sem memória: abre com a logo padrão */ }
}
function marcaGuardada() {
  try { return JSON.parse(localStorage.getItem(CHAVE) || 'null') } catch (_) { return null }
}

function Pagina({ lado }) {
  return (
    <div className={`cm-ab-pag ${lado}`}>
      <div className="cm-ab-faixa" />
      <div className="cm-ab-grade">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="cm-ab-cel">
            <span className="cm-ab-foto" />
            <span className="cm-ab-preco" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TelaAbertura({ texto = 'Abrindo o jornal de ofertas' }) {
  const m = marcaGuardada()
  const logo = m ? m.logo : logoBengala
  return (
    <div className="cm-ab" role="status" aria-live="polite" aria-label={texto}>
      <style>{CSS}</style>
      <div className="cm-ab-luz" aria-hidden="true" />
      <div className="cm-ab-centro">
        {logo
          ? <img src={logo} alt={m?.nome || 'Bengala Supermercado'} className="cm-ab-logo" />
          : <p className="cm-ab-nome">{m?.nome}</p>}
        <div className="cm-ab-jornal" aria-hidden="true">
          <Pagina lado="esq" />
          <Pagina lado="dir" />
          <div className="cm-ab-folha"><Pagina lado="dir" /></div>
          <span className="cm-ab-selo">%</span>
        </div>
        <p className="cm-ab-texto">{texto}<span className="cm-ab-pontos"><i>.</i><i>.</i><i>.</i></span></p>
        <div className="cm-ab-barra" aria-hidden="true"><span /></div>
      </div>
    </div>
  )
}

const CSS = `
.cm-ab { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; overflow: hidden;
  background: radial-gradient(120% 90% at 50% 20%, #1d3c6e 0%, #0b1a33 55%, #050b17 100%); color: #fff; font-family: inherit }
.cm-ab-luz { position: absolute; width: 520px; height: 520px; border-radius: 50%; background: radial-gradient(circle, rgba(255,210,63,.28), transparent 65%); animation: cm-ab-luz 3.2s ease-in-out infinite }
.cm-ab-centro { position: relative; display: flex; flex-direction: column; align-items: center; gap: 22px; padding: 24px }
.cm-ab-logo { height: 84px; width: auto; max-width: 70vw; object-fit: contain; filter: drop-shadow(0 8px 18px rgba(0,0,0,.45)); animation: cm-ab-pop .6s cubic-bezier(.2,1.4,.4,1) both, cm-ab-boia 3s ease-in-out .6s infinite }
.cm-ab-nome { font-size: 30px; font-weight: 900; text-transform: uppercase; color: #ffd23f; animation: cm-ab-pop .6s cubic-bezier(.2,1.4,.4,1) both }
.cm-ab-jornal { position: relative; width: 196px; height: 136px; perspective: 700px; animation: cm-ab-sobe .5s .15s cubic-bezier(.2,.8,.2,1) both }
.cm-ab-pag { position: absolute; top: 0; width: 98px; height: 136px; background: #fbf8f1; padding: 8px 7px; box-sizing: border-box; box-shadow: 0 10px 22px rgba(0,0,0,.4) }
.cm-ab-pag.esq { left: 0; border-radius: 6px 0 0 6px; background: linear-gradient(to left, #e9e4d8, #fbf8f1 18%) }
.cm-ab-pag.dir { left: 98px; border-radius: 0 6px 6px 0; background: linear-gradient(to right, #e9e4d8, #fbf8f1 18%) }
.cm-ab-faixa { height: 16px; border-radius: 3px; background: linear-gradient(90deg, #d81e29, #ff5a3c) }
.cm-ab-grade { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-top: 7px }
.cm-ab-cel { height: 46px; border-radius: 4px; background: #fff; box-shadow: inset 0 0 0 1px #ece6d8; position: relative; overflow: hidden }
.cm-ab-foto { position: absolute; left: 8px; right: 8px; top: 6px; height: 20px; border-radius: 3px; background: linear-gradient(90deg, #e7e2d6 0%, #f6f2e9 50%, #e7e2d6 100%); background-size: 200% 100%; animation: cm-ab-brilho 1.2s linear infinite }
.cm-ab-preco { position: absolute; right: 5px; bottom: 5px; width: 22px; height: 11px; border-radius: 6px; background: #ffd23f }
.cm-ab-folha { position: absolute; left: 98px; top: 0; width: 98px; height: 136px; transform-origin: left center; transform-style: preserve-3d; animation: cm-ab-vira 1.6s cubic-bezier(.45,.05,.3,1) infinite }
.cm-ab-folha .cm-ab-pag { left: 0; backface-visibility: hidden }
.cm-ab-selo { position: absolute; right: -14px; top: -14px; width: 40px; height: 40px; border-radius: 50%; background: #d81e29; color: #fff; font-weight: 900; font-size: 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 14px rgba(0,0,0,.4); animation: cm-ab-pop .5s .45s cubic-bezier(.2,1.6,.4,1) both, cm-ab-gira 2.4s ease-in-out 1s infinite }
.cm-ab-texto { font-size: 17px; font-weight: 700; letter-spacing: .01em; color: rgba(255,255,255,.92); animation: cm-ab-sobe .5s .3s both }
.cm-ab-pontos i { font-style: normal; animation: cm-ab-ponto 1.2s infinite }
.cm-ab-pontos i:nth-child(2) { animation-delay: .2s } .cm-ab-pontos i:nth-child(3) { animation-delay: .4s }
.cm-ab-barra { width: 180px; height: 4px; border-radius: 4px; background: rgba(255,255,255,.15); overflow: hidden }
.cm-ab-barra span { display: block; width: 40%; height: 100%; border-radius: 4px; background: linear-gradient(90deg, #ffd23f, #ff8a3c); animation: cm-ab-corre 1.1s ease-in-out infinite }
@keyframes cm-ab-pop { from { opacity: 0; transform: scale(.6) } }
@keyframes cm-ab-sobe { from { opacity: 0; transform: translateY(14px) } }
@keyframes cm-ab-boia { 50% { transform: translateY(-5px) } }
@keyframes cm-ab-vira { 0%, 12% { transform: rotateY(0) } 62%, 100% { transform: rotateY(-178deg) } }
@keyframes cm-ab-brilho { to { background-position: -200% 0 } }
@keyframes cm-ab-gira { 0%, 100% { transform: rotate(0) scale(1) } 50% { transform: rotate(-12deg) scale(1.08) } }
@keyframes cm-ab-ponto { 0%, 100% { opacity: .2 } 40% { opacity: 1 } }
@keyframes cm-ab-corre { from { transform: translateX(-110%) } to { transform: translateX(260%) } }
@keyframes cm-ab-luz { 50% { transform: scale(1.12); opacity: .75 } }
@media (prefers-reduced-motion: reduce) { .cm-ab *, .cm-ab-luz { animation-duration: .01s !important; animation-iteration-count: 1 !important } }
`
