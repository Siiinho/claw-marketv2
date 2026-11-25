import { formatBRL, sugestaoDePreco } from '../lib/utils'
import { useStore } from '../store/StoreContext'
import { Icon } from './ui'

// Sugestão de preço pela validade. Só preenche o campo se a pessoa tocar.
export default function SugestaoPreco({ precoNormal, validade, precoAtual, onUsar, className = '' }) {
  const { config } = useStore()
  const s = sugestaoDePreco(precoNormal, validade, config)
  if (!s) return null
  const usando = Math.abs((Number(String(precoAtual ?? '').replace(',', '.')) || 0) - s.valor) < 0.005
  if (usando) return null
  return (
    <button type="button" onClick={() => onUsar(s.valor)}
      className={`inline-flex min-h-11 items-center gap-2 rounded-lg border-2 border-dashed border-[#b4530f] bg-[#fff4e5] px-3 text-left text-sm font-bold text-[#7a3606] hover:bg-[#ffe8c7] ${className}`}>
      <Icon name="Lightbulb" size={17} className="shrink-0" />
      <span>Sugestão: {formatBRL(s.valor)} <span className="font-semibold">(−{s.desconto}%, vence em {s.dias} {s.dias === 1 ? 'dia' : 'dias'}). Toque para usar.</span></span>
    </button>
  )
}
