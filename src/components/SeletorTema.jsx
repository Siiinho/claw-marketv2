import { useState } from 'react'
import { Check } from 'lucide-react'
import { GRUPOS_TEMA, TEMAS_CAMPANHA, caminhoArte } from '../lib/temasCampanha'

// Escolha do tema da campanha com miniatura da arte, separada por seção/ocasião.
export default function SeletorTema({ value, onChange, compacto = false }) {
  const atual = TEMAS_CAMPANHA.find((t) => t.id === value)
  const [grupo, setGrupo] = useState(atual?.grupo || 'Todos')
  const lista = grupo === 'Todos' ? TEMAS_CAMPANHA : TEMAS_CAMPANHA.filter((t) => t.grupo === grupo)
  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {['Todos', ...GRUPOS_TEMA].map((g) => (
          <button key={g} type="button" onClick={() => setGrupo(g)} aria-pressed={grupo === g}
            className={`min-h-8 shrink-0 whitespace-nowrap rounded-full border px-3 text-xs font-semibold ${grupo === g ? 'border-navy bg-navy text-white' : 'border-ink-soft/20 bg-white text-ink hover:border-ink-soft/45'}`}>
            {g}
          </button>
        ))}
      </div>
      <div className={`grid gap-2 p-1 ${compacto ? 'max-h-80 grid-cols-2 overflow-y-auto' : 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-6'}`}>
        {lista.map((t) => {
          const mini = caminhoArte(t, 'miniatura')
          const ativo = value === t.id
          return (
            <button key={t.id} type="button" onClick={() => onChange(t.id)} aria-pressed={ativo} title={t.nome}
              className={`group relative flex aspect-[4/3] flex-col overflow-hidden rounded-lg text-left ${ativo ? 'ring-[3px] ring-navy ring-offset-2' : 'ring-1 ring-black/10 hover:ring-black/25'}`}
              style={{ background: t.fundo }}>
              {mini ? (
                <img src={mini} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain p-1" />
              ) : (
                <span className="m-auto px-1 text-center text-sm font-black uppercase italic leading-none text-white" style={{ textShadow: '0 2px 0 rgba(0,0,0,.4)' }}>
                  {t.titulo}<br /><span style={{ color: t.corDestaque }}>{t.destaque}</span>
                </span>
              )}
              {ativo && <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-navy text-white"><Check size={14} strokeWidth={2.5} /></span>}
              <span className="relative mt-auto truncate bg-black/55 px-1.5 py-0.5 text-[11px] font-semibold text-white">{t.nome}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
