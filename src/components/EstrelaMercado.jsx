import { Icon } from './ui'

// Interruptor da estrela do Mercado Encarte, usado na hora de mandar o produto para o jornal.
// Ligado: o produto entra também na lista de estrelados (oferta de hoje no Mercado Encarte).
export default function EstrelaMercado({ ativo, onChange, className = '', texto = 'Estrela: Mercado Encarte de hoje' }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!ativo)}
      aria-pressed={ativo}
      title="Produto com estrela entra na lista do Mercado Encarte (oferta de hoje)"
      className={`flex min-h-11 items-center gap-2 rounded-lg border-2 px-3 py-2 text-left text-sm font-black ${ativo ? 'border-[#c1121f] text-white' : 'border-[#c1121f]/35 bg-white text-[#c1121f]'} ${className}`}
      style={ativo ? { background: 'linear-gradient(120deg,#c1121f,#fb5607)', color: '#fff' } : undefined}
    >
      <Icon name="Star" size={18} fill={ativo ? '#ffd60a' : 'none'} className={ativo ? 'text-[#ffd60a]' : ''} />
      <span className="min-w-0 flex-1">{texto}</span>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${ativo ? 'bg-white/25' : 'bg-[#c1121f]/10'}`}>{ativo ? 'Ligada' : 'Desligada'}</span>
    </button>
  )
}
