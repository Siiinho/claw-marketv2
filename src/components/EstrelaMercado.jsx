import { Icon } from './ui'

// Interruptor da estrela do Mercado Encarte, usado na hora de mandar o produto para o jornal.
// Ligado: o produto entra também na lista de estrelados (oferta de hoje no Mercado Encarte).
export default function EstrelaMercado({ ativo, onChange, className = '', texto = 'Estrela: Mercado Encarte de hoje' }) {
  return (
    <button
      type="button"
      role="switch"
      onClick={() => onChange(!ativo)}
      aria-checked={ativo}
      title="Produto com estrela entra na lista do Mercado Encarte (oferta de hoje)"
      className={`flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm ${ativo ? 'border-bengala/40 bg-bengala/[0.06]' : 'border-ink-soft/20 bg-white hover:border-ink-soft/40'} ${className}`}
    >
      <Icon name="Star" size={18} fill={ativo ? 'var(--color-offer)' : 'none'} className={`shrink-0 ${ativo ? 'text-bengala' : 'text-ink-soft'}`} />
      <span className="min-w-0 flex-1 font-semibold text-ink">{texto}</span>
      <span aria-hidden="true" className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200 ${ativo ? 'bg-bengala' : 'bg-ink-soft/25'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${ativo ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
      </span>
    </button>
  )
}

// Botão de estrela de um produto (listas do jornal, produtos e scanner). Mesmo desenho em todo lugar.
export function BotaoEstrela({ ativo, onClick, nome, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      aria-label={`${ativo ? 'Tirar a estrela de' : 'Dar estrela para'} ${nome}`}
      title="Estrela: entra no Mercado Encarte (oferta de hoje)"
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${ativo ? 'bg-bengala text-offer' : 'text-ink-soft/70 hover:bg-bengala/10 hover:text-bengala'} ${className}`}
    >
      <Icon name="Star" size={17} fill={ativo ? 'var(--color-offer)' : 'none'} />
    </button>
  )
}
