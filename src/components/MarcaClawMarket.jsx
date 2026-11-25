import { useId } from 'react'

// Marca da dona do sistema: ClawMarket.
// Símbolo: etiqueta de preço dourada com três marcas de garra ("claw"), sobre azul-marinho.
// A logo do mercado cliente continua no encarte dele; esta marca identifica o sistema.
// O mesmo desenho está em public/favicon.svg e nos ícones pwa-*.png.

const ETIQUETA = 'M13.2 29.6 29.4 13.4A4.8 4.8 0 0 1 32.8 12H47.2A4.8 4.8 0 0 1 52 16.8V31.2A4.8 4.8 0 0 1 50.6 34.6L34.4 50.8A4.8 4.8 0 0 1 27.6 50.8L13.2 36.4A4.8 4.8 0 0 1 13.2 29.6Z'
const GARRAS = [
  'M30.84 21.66Q27.84 31.74 17.76 34.74Q22.89 26.79 30.84 21.66Z',
  'M38.39 25.31Q33.72 37.62 21.41 42.29Q28.2 32.1 38.39 25.31Z',
  'M42.04 32.86Q39.04 42.94 28.96 45.94Q34.09 37.99 42.04 32.86Z',
]

export function SimboloClawMarket({ tamanho = 40, className = '' }) {
  const id = `cm${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <svg viewBox="0 0 64 64" width={tamanho} height={tamanho} className={className} role="img" aria-label="ClawMarket">
      <defs>
        <linearGradient id={`${id}f`} x1="6" y1="0" x2="58" y2="64" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#17406f" /><stop offset=".5" stopColor="#0b2445" /><stop offset="1" stopColor="#050f20" /></linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#fff" stopOpacity=".34" /><stop offset=".45" stopColor="#fff" stopOpacity=".04" /><stop offset="1" stopColor="#8fb6e6" stopOpacity=".16" /></linearGradient>
        <linearGradient id={`${id}o`} x1="46" y1="10" x2="22" y2="52" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#ffe894" /><stop offset=".38" stopColor="#ffc928" /><stop offset="1" stopColor="#e99a00" /></linearGradient>
        <linearGradient id={`${id}v`} x1="38" y1="22" x2="22" y2="46" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#ff5660" /><stop offset=".45" stopColor="#e4232e" /><stop offset="1" stopColor="#a30d18" /></linearGradient>
        <radialGradient id={`${id}h`} cx=".3" cy=".12" r=".8"><stop offset="0" stopColor="#5b9be0" stopOpacity=".5" /><stop offset="1" stopColor="#5b9be0" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${id}f)`} />
      <rect width="64" height="64" rx="15" fill={`url(#${id}h)`} />
      <rect x=".5" y=".5" width="63" height="63" rx="14.5" fill="none" stroke={`url(#${id}b)`} />
      <g transform="translate(32 32) scale(1.07) translate(-32 -32)">
        <path d={ETIQUETA} transform="translate(.5 1.7)" fill="#01060f" opacity=".42" />
        <path d={ETIQUETA} fill={`url(#${id}o)`} />
        <path d="M13.9 30.3 30.1 14.1A3.8 3.8 0 0 1 32.8 13H47.2A3.8 3.8 0 0 1 51 16.8" fill="none" stroke="#fff6d2" strokeOpacity=".85" strokeWidth=".9" strokeLinecap="round" />
        <circle cx="43.6" cy="20.4" r="4.4" fill="#a86a00" opacity=".45" />
        <circle cx="43.6" cy="20.4" r="3.6" fill="#0a2040" />
        {GARRAS.map((d) => (
          <g key={d}>
            <path d={d} transform="translate(.45 .6)" fill="#6e3c00" opacity=".38" />
            <path d={d} fill={`url(#${id}v)`} />
          </g>
        ))}
      </g>
    </svg>
  )
}

// Nome da marca: "Claw" na cor do fundo e "Market" em dourado (fundo escuro) ou vermelho (claro).
export function NomeClawMarket({ claro = true, className = '', style }) {
  const metal = claro ? 'linear-gradient(180deg,#ffe894,#ffc928 52%,#eda200)' : 'linear-gradient(180deg,#f23b45,#c01622)'
  return (
    <span className={className} style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.015em', color: claro ? '#ffffff' : '#0b1f3a', ...style }}>
      Claw<span style={{ backgroundImage: metal, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Market</span>
    </span>
  )
}

export default function MarcaClawMarket({ tamanho = 40, subtitulo, claro = true, className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <SimboloClawMarket tamanho={tamanho} />
      <div className="leading-none">
        <NomeClawMarket claro={claro} className="block leading-[1.1]" style={{ fontSize: Math.round(tamanho * 0.5) }} />
        {subtitulo && (
          <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: claro ? '#c9d8ea' : '#3b4656' }}>
            {subtitulo}
          </div>
        )}
      </div>
    </div>
  )
}
