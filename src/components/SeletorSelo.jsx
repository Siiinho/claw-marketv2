import { SELOS_OFERTA } from '../lib/utils'
import SeloArte from './SeloArte'
import { Icon } from './ui'

// Grade com os selos de oferta (usada no jornal e nos cartazes).
export default function SeletorSelo({ value, onChange }) {
  const atual = value || 'nenhum'
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      {SELOS_OFERTA.map((s) => (
        <button key={s.id} type="button" onClick={() => onChange(s.id)} aria-pressed={atual === s.id} title={s.texto}
          className={`flex h-16 items-center justify-center rounded-lg border bg-white ${atual === s.id ? 'border-navy shadow-[inset_0_0_0_1px_var(--color-navy)]' : 'border-ink-soft/20 hover:border-ink-soft/45'}`}>
          {s.nenhum ? <span className="text-sm font-semibold text-ink-soft">Sem selo</span> : <SeloArte selo={s} largura={104} girar={-4} />}
        </button>
      ))}
    </div>
  )
}

// Botão "aplicar a todos": copia a escolha deste produto para os outros da lista.
export function BotaoAplicarTodos({ total, onClick, children, descricao }) {
  return (
    <button type="button" onClick={onClick} disabled={total < 2}
      className="mt-3 flex w-full items-center gap-3 rounded-xl border border-ink-soft/20 bg-white px-3 py-2.5 text-left hover:border-ink-soft/45 disabled:opacity-50">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy/[0.07] text-navy"><Icon name="CopyCheck" size={18} /></span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{children}</span>
        <span className="block text-xs text-ink-soft">{descricao}</span>
      </span>
    </button>
  )
}
