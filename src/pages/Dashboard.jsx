import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, podeVer } from '../store/StoreContext'
import { Icon, StatusBadge, ProdutoThumb } from '../components/ui'
import { setorById, diasParaVencer, dataISOmaisDias, parseData, plural, labelDias } from '../lib/utils'
import { remessaDe } from '../lib/remessa'
import PrimeiroAcesso, { mostraPrimeiroAcesso } from '../components/PrimeiroAcesso'

const DIA_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

function saudacao() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export default function Dashboard() {
  const { produtos, usuario, lojas, lojaAtiva, config, nuvemStatus } = useStore()
  const remessa = remessaDe(produtos, usuario?.id)
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

      {/* mercado novo: os passos para deixar o jornal no ar */}
      {/* espera a nuvem chegar: sem isso o guia piscava "0 de 5" e marcar um passo podia se perder */}
      {nuvemStatus !== 'conectando' && mostraPrimeiroAcesso(usuario, config) && <PrimeiroAcesso />}

      {/* as duas ferramentas, cada uma com a sua função */}
      <div className="grid gap-3 md:grid-cols-2">
        {pode('jornal') && (
          <button
            onClick={() => navigate('/jornal')}
            className="group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl bg-bengala p-5 text-left text-white shadow-[0_10px_24px_rgba(216,30,41,.25)] hover:bg-bengala-dark md:p-6"
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white text-bengala">
              <Icon name="Newspaper" size={30} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="display-bengala block text-[28px] leading-none md:text-[32px]">{remessa.length ? 'Continuar o jornal' : 'Montar jornal'}</span>
              <span className="mt-1.5 block text-sm text-white/90 md:text-base">{remessa.length ? `${plural(remessa.length, 'produto bipado', 'produtos bipados')}. Falta publicar.` : 'Bipe os produtos, ponha o preço e publique.'}</span>
            </span>
            <Icon name="ArrowRight" size={24} className="hidden shrink-0 transition-transform duration-200 group-hover:translate-x-1 sm:block" />
          </button>
        )}
        {pode('scanner') && (
          <button
            onClick={() => navigate('/scanner')}
            className="group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border-2 border-navy/30 bg-white p-5 text-left text-navy shadow-[0_2px_0_rgba(8,43,79,.15)] hover:border-navy md:p-6"
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-navy text-white">
              <Icon name="CalendarSearch" size={28} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="display-bengala block text-[28px] leading-none md:text-[32px]">Conferir validade</span>
              <span className="mt-1.5 block text-sm text-ink md:text-base">Bipe da gôndola. O sistema avisa o que vai vencer.</span>
            </span>
            <Icon name="ArrowRight" size={24} className="hidden shrink-0 transition-transform duration-200 group-hover:translate-x-1 sm:block" />
          </button>
        )}
      </div>

      <div className="grid gap-5">
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
      </div>
    </div>
  )
}
