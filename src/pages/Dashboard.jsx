import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, podeVer } from '../store/StoreContext'
import { Icon, StatusBadge, ProdutoThumb } from '../components/ui'
import { setorById, diasParaVencer, dataISOmaisDias, parseData, plural, labelDias } from '../lib/utils'

const DIA_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

function saudacao() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export default function Dashboard() {
  const { produtos, ofertas, fila, usuario, lojas, lojaAtiva } = useStore()
  const navigate = useNavigate()
  const pode = (k) => podeVer(usuario.papel, k)

  // próximos 7 dias, um bloco por dia (hoje + 6)
  const semana = useMemo(() => {
    const dias = Array.from({ length: 7 }, (_, i) => {
      const iso = dataISOmaisDias(i)
      return { i, iso, data: parseData(iso), itens: [] }
    })
    produtos.forEach((p) => {
      const d = diasParaVencer(p.validade)
      if (d != null && d >= 0 && d <= 6) dias[d].itens.push(p)
    })
    return dias
  }, [produtos])

  const vencendo = semana.flatMap((d) => d.itens.map((p) => ({ p, dias: d.i })))
  const criticos = vencendo.filter((x) => x.dias <= 2).length
  const maxDia = Math.max(1, ...semana.map((d) => d.itens.length))
  const ofertasAtivas = ofertas.filter((o) => o.ativa).length
  const nomeLoja = lojaAtiva === 'todas' ? 'Todas as lojas' : lojas.find((l) => l.id === lojaAtiva)?.nome
  const hojeExtenso = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const primeiroNome = (usuario.nome || '').split(' ')[0]

  const resumo = vencendo.length === 0
    ? 'Nada vence nos próximos 7 dias.'
    : criticos > 0
      ? `${plural(criticos, 'produto vence', 'produtos vencem')} em até 2 dias.`
      : `${plural(vencendo.length, 'produto vence', 'produtos vencem')} esta semana.`

  return (
    <div className="space-y-5 md:space-y-6">
      {/* saudação + estado do dia em uma frase */}
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="text-sm text-ink-soft first-letter:uppercase">{hojeExtenso}{nomeLoja ? ` · ${nomeLoja}` : ''}</p>
          <h1 className="display-bengala mt-1 text-[34px] leading-[0.95] text-navy md:text-[44px]">
            {saudacao()}, {primeiroNome}
          </h1>
        </div>
        <p className={`flex items-center gap-2 text-sm font-semibold ${criticos > 0 ? 'text-critical' : 'text-ink'}`}>
          <span className={`h-2.5 w-2.5 rounded-full ${criticos > 0 ? 'bg-critical' : vencendo.length ? 'bg-warning' : 'bg-success'}`} />
          {resumo}
        </p>
      </header>

      {/* ação principal do chão de loja */}
      {pode('scanner') && (
        <button
          onClick={() => navigate('/scanner')}
          className="group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl bg-bengala p-5 text-left text-white shadow-[0_10px_24px_rgba(216,30,41,.25)] hover:bg-bengala-dark md:gap-6 md:p-7"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white text-bengala md:h-16 md:w-16">
            <Icon name="ScanBarcode" size={30} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="display-bengala block text-[28px] leading-none md:text-[34px]">Bipar produto</span>
            <span className="mt-1.5 block text-sm text-white/85 md:text-base">Leia o código, confirme a validade e ele entra na fila do jornal.</span>
          </span>
          <Icon name="ArrowRight" size={24} className="hidden shrink-0 transition-transform duration-200 group-hover:translate-x-1 sm:block" />
        </button>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* semana de vencimentos */}
        <section className="card-bengala min-w-0 p-4 md:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-bold text-navy">Vencimentos da semana</h2>
            {pode('produtos') && (
              <button onClick={() => navigate('/produtos')} className="shrink-0 text-sm font-semibold text-bengala hover:underline">
                Ver produtos
              </button>
            )}
          </div>

          <ol className="mt-4 grid grid-cols-7 gap-1.5 md:gap-2" aria-label="Produtos que vencem em cada um dos próximos 7 dias">
            {semana.map((d) => {
              const n = d.itens.length
              const cor = d.i <= 2 ? 'bg-critical' : 'bg-warning'
              return (
                <li
                  key={d.iso}
                  className={`flex flex-col items-center rounded-xl px-1 pb-2 pt-2.5 ${d.i === 0 ? 'bg-navy text-white' : 'bg-cream'}`}
                  aria-label={`${DIA_CURTO[d.data.getDay()]} ${d.data.getDate()}: ${plural(n, 'produto', 'produtos')}`}
                >
                  <span className={`text-[11px] font-semibold uppercase ${d.i === 0 ? 'text-offer' : 'text-ink-soft'}`}>
                    {d.i === 0 ? 'hoje' : DIA_CURTO[d.data.getDay()]}
                  </span>
                  <span className="num-tab display-bengala text-xl leading-tight">{d.data.getDate()}</span>
                  <span className="mt-2 flex h-14 w-full items-end justify-center">
                    <span
                      className={`w-3/5 rounded-t-md ${n ? cor : d.i === 0 ? 'bg-white/20' : 'bg-ink-soft/15'}`}
                      style={{ height: n ? `${Math.max(18, (n / maxDia) * 100)}%` : '4px' }}
                    />
                  </span>
                  <span className={`num-tab mt-1 text-sm font-bold ${n ? '' : 'opacity-40'}`}>{n}</span>
                </li>
              )
            })}
          </ol>

          {vencendo.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-ink-soft/25 px-4 py-3 text-sm text-ink-soft">
              Bipe os produtos da gôndola e a validade de cada um aparece aqui, separada por dia.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-ink-soft/10">
              {vencendo.slice(0, 5).map(({ p, dias }) => (
                <li key={p.id} className="flex min-w-0 items-center gap-3 py-2.5">
                  <ProdutoThumb produto={p} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{p.nome}</p>
                    <p className="text-xs text-ink-soft">{setorById(p.setor).nome} · {p.estoque} un · {labelDias(dias)}</p>
                  </div>
                  <StatusBadge validade={p.validade} mostrarDias={false} />
                </li>
              ))}
              {vencendo.length > 5 && (
                <li className="pt-2.5 text-sm text-ink-soft">e mais {plural(vencendo.length - 5, 'produto', 'produtos')}</li>
              )}
            </ul>
          )}
        </section>

        {/* fila do jornal */}
        <section className="card-bengala flex min-w-0 flex-col self-start p-4 md:p-6">
          <h2 className="text-lg font-bold text-navy">Fila do jornal</h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            {fila.length === 0 ? 'Nenhum produto ainda.' : `${plural(fila.length, 'produto pronto', 'produtos prontos')} para o encarte.`}
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {fila.length === 0
              ? [0, 1, 2].map((i) => (
                <div key={i} className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-ink-soft/20 text-ink-soft/40">
                  <Icon name="Tag" size={22} />
                </div>
              ))
              : fila.slice(0, 6).map((p) => (
                <div key={p.id} className="flex aspect-square items-center justify-center rounded-xl bg-cream p-1.5" title={p.nome}>
                  <ProdutoThumb produto={p} size={72} />
                </div>
              ))}
          </div>
          {fila.length > 6 && <p className="mt-2 text-xs text-ink-soft">+ {plural(fila.length - 6, 'produto', 'produtos')}</p>}

          <div className="pt-5">
            {pode('jornal') ? (
              <button
                onClick={() => navigate('/jornal')}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-navy text-sm font-semibold text-white hover:bg-navy-light"
              >
                <Icon name="Newspaper" size={17} /> {fila.length ? 'Montar jornal' : 'Abrir o jornal'}
              </button>
            ) : (
              <p className="text-xs text-ink-soft">O gerente monta o jornal com os produtos que você bipar.</p>
            )}
            {pode('ofertas') && (
              <button onClick={() => navigate('/ofertas')} className="mt-3 flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-sm text-ink hover:text-bengala">
                <span className="flex items-center gap-2"><Icon name="Tag" size={16} className="text-success" /> Ofertas ativas</span>
                <span className="num-tab font-bold">{ofertasAtivas}</span>
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
