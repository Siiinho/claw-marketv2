import { useCallback, useEffect, useState } from 'react'
import { Icon, Secao, EmptyState, Indicador } from '../components/ui'
import { lerVisitasNuvem, nuvemAtiva } from '../lib/nuvem'
import { plural } from '../lib/utils'

// Quantas pessoas abriram o site do cliente: o jornal (folhear) e a página de WhatsApp de ofertas.
// Visitante = aparelho que abriu naquele dia (conta uma vez). Aberturas = todas as vezes que abriu.

const hoje = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
const diaCurto = (iso) => {
  const [a, m, d] = iso.split('-').map(Number)
  const nome = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(Date.UTC(a, m - 1, d)).getUTCDay()]
  return { nome, data: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}` }
}

export default function Visitas() {
  const [linhas, setLinhas] = useState(null)
  const [erro, setErro] = useState(null)
  const carregar = useCallback(async () => {
    try { setLinhas((await lerVisitasNuvem(30)) || []); setErro(null) } catch (e) { setErro(e.message) }
  }, [])
  useEffect(() => {
    carregar()
    const t = setInterval(carregar, 60000)
    return () => clearInterval(t)
  }, [carregar])

  if (!nuvemAtiva()) return <EmptyState icon="CloudOff" titulo="Sem nuvem neste aparelho" descricao="As visitas aparecem no app ligado à nuvem (o site no ar)." />

  const dias = []
  for (let i = 13; i >= 0; i--) dias.push(new Date(Date.now() - i * 86400000).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }))
  const soma = (dia, pagina, campo) => (linhas || []).filter((l) => l.dia === dia && (!pagina || l.pagina === pagina)).reduce((s, l) => s + (l[campo] || 0), 0)
  const h = hoje()
  const ontem = dias[dias.length - 2]
  const hojeV = soma(h, null, 'visitantes')
  const ontemV = soma(ontem, null, 'visitantes')
  const maximo = Math.max(1, ...dias.map((d) => soma(d, null, 'visitantes')))
  const semana = dias.slice(-7).reduce((s, d) => s + soma(d, null, 'visitantes'), 0)

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Indicador rotulo="Visitantes hoje" valor={linhas ? hojeV : '…'} icone="Users" cor="var(--color-navy)" detalhe={linhas ? `Ontem: ${ontemV}` : null} />
        <Indicador rotulo="Abriram o jornal hoje" valor={linhas ? soma(h, 'jornal', 'aberturas') : '…'} icone="Newspaper" cor="#d81e29" detalhe={linhas ? plural(soma(h, 'jornal', 'visitantes'), 'pessoa', 'pessoas') : null} />
        <Indicador rotulo="Página do WhatsApp hoje" valor={linhas ? soma(h, 'whatsapp', 'aberturas') : '…'} icone="MessageCircle" cor="#15803d" detalhe={linhas ? plural(soma(h, 'whatsapp', 'visitantes'), 'pessoa', 'pessoas') : null} />
      </div>

      <Secao titulo="Visitantes por dia" descricao={`Últimos 14 dias · ${plural(semana, 'visitante', 'visitantes')} nos últimos 7. Atualiza sozinho a cada minuto.`}
        acao={<button type="button" onClick={carregar} className="inline-flex min-h-10 items-center gap-1.5 font-semibold text-navy hover:underline"><Icon name="RefreshCw" size={15} /> Atualizar</button>}>
        {erro && <p className="mb-3 rounded-lg bg-critical/10 p-3 text-sm font-semibold text-critical">{erro}</p>}
        <div className="flex h-56 items-end gap-1.5 overflow-x-auto pb-1" role="list" aria-label="Visitantes por dia">
          {dias.map((d) => {
            const v = soma(d, null, 'visitantes')
            const { nome, data } = diaCurto(d)
            const ehHoje = d === h
            return (
              <div key={d} role="listitem" aria-label={`${nome} ${data}: ${plural(v, 'visitante', 'visitantes')}`} className="flex min-w-[34px] flex-1 flex-col items-center justify-end gap-1">
                <span className="num-tab text-xs font-bold text-ink">{v || ''}</span>
                <div className={`w-full rounded-t-md ${ehHoje ? 'bg-[#d81e29]' : 'bg-navy/70'}`} style={{ height: `${Math.max(v ? 4 : 2, (v / maximo) * 160)}px`, opacity: v ? 1 : 0.25 }} />
                <span className={`text-[11px] leading-tight ${ehHoje ? 'font-bold text-[#d81e29]' : 'text-ink-soft'}`}>{ehHoje ? 'hoje' : nome}</span>
                <span className="text-[10px] leading-tight text-ink-soft">{data}</span>
              </div>
            )
          })}
        </div>
      </Secao>
      <p className="text-sm text-ink-soft">Visitante conta uma vez por celular por dia. As contas começaram em 27/11/2026.</p>
    </div>
  )
}
