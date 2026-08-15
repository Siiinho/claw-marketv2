import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/StoreContext'
import { Icon, Botao } from '../components/ui'
import {
  SETORES, setorById, statusValidade, pesoTotalKg, formatBRL,
  FATOR_CO2, KG_POR_REFEICAO,
} from '../lib/utils'
import { exportarPDF } from '../lib/exportar'

const fmtKg = (v) => `${(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`
const fmtN = (v, d = 0) => (v || 0).toLocaleString('pt-BR', { maximumFractionDigits: d })

function Metric({ icone, cor, valor, titulo, sub }) {
  return (
    <div className="card-bengala card-int p-4">
      <div className="chip flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${cor}1a`, color: cor }}>
        <Icon name={icone} size={18} />
      </div>
      <div className="mt-3 text-2xl font-bold text-ink">{valor}</div>
      <div className="text-sm font-medium text-ink">{titulo}</div>
      {sub && <div className="text-xs text-ink-soft">{sub}</div>}
    </div>
  )
}

export default function Sustentabilidade() {
  const { produtos, ofertaDoProduto, config, toast } = useStore()
  const navigate = useNavigate()
  const ref = useRef(null)
  const [exportando, setExportando] = useState(false)

  const d = useMemo(() => {
    let kgAproveitado = 0, kgDesperdicado = 0, kgRisco = 0
    let vlRecuperado = 0, vlDesperdicado = 0, vlRisco = 0
    const setores = Object.fromEntries(SETORES.map((s) => [s.id, { aprov: 0, desp: 0 }]))
    const descPadrao = (config.descontoPadrao || 30) / 100

    produtos.forEach((p) => {
      const s = statusValidade(p.validade)
      const kg = pesoTotalKg(p)
      const acao = !!ofertaDoProduto(p.id) || p.naFila || !!p.precoPromo
      const total = (p.precoNormal || 0) * (p.estoque || 0)

      if (s.id === 'vencido') {
        kgDesperdicado += kg
        vlDesperdicado += total
        setores[p.setor].desp += kg
      } else if (s.id === 'critico' || s.id === 'atencao') {
        if (acao) {
          const o = ofertaDoProduto(p.id)
          const precoEf = o ? p.precoNormal * (1 - o.desconto / 100) : p.precoPromo ?? p.precoNormal * (1 - descPadrao)
          kgAproveitado += kg
          vlRecuperado += precoEf * (p.estoque || 0)
          setores[p.setor].aprov += kg
        } else {
          kgRisco += kg
          vlRisco += total
        }
      }
    })

    const base = kgAproveitado + kgDesperdicado
    const taxa = base > 0 ? (kgAproveitado / base) * 100 : 0
    const co2Evitado = kgAproveitado * FATOR_CO2
    const co2Emitido = kgDesperdicado * FATOR_CO2
    const refeicoes = kgAproveitado / KG_POR_REFEICAO

    const porSetor = SETORES.map((s) => ({ ...s, ...setores[s.id] }))
      .filter((s) => s.aprov > 0 || s.desp > 0)
      .sort((a, b) => b.aprov + b.desp - (a.aprov + a.desp))

    return { kgAproveitado, kgDesperdicado, kgRisco, vlRecuperado, vlDesperdicado, vlRisco, taxa, co2Evitado, co2Emitido, refeicoes, porSetor }
  }, [produtos, ofertaDoProduto, config])

  const maxSetor = Math.max(...d.porSetor.map((s) => s.aprov + s.desp), 1)

  const exportar = async () => {
    setExportando(true)
    try {
      await exportarPDF(ref.current, 'relatorio-esg')
      toast('Relatório ESG exportado em PDF!')
    } catch (_) {
      toast('Erro ao exportar o relatório.', 'erro')
    }
    setExportando(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="max-w-xl text-sm text-ink-soft">
          Quanto a gestão de validade evitou de desperdício de alimentos — em quilos, CO₂ e refeições.
          Use como relatório de impacto (ESG) para a rede e certificações.
        </p>
        <Botao onClick={exportar} disabled={exportando}>
          <Icon name="FileDown" size={16} /> {exportando ? 'Gerando...' : 'Relatório PDF'}
        </Botao>
      </div>

      <div ref={ref} className="space-y-5 rounded-2xl bg-cream p-1">
        {/* destaque: taxa de aproveitamento */}
        <div className="anim-in overflow-hidden rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #1c6e48, #2e9e6b)' }}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm" style={{ color: '#d9f2e6' }}>
                <Icon name="Leaf" size={16} /> Taxa de aproveitamento
              </div>
              <div className="mt-1 text-5xl font-bold">{fmtN(d.taxa)}%</div>
              <div className="text-sm" style={{ color: '#d9f2e6' }}>
                {fmtKg(d.kgAproveitado)} em recuperação · {fmtKg(d.kgDesperdicado)} desperdiçados
              </div>
            </div>
            <svg width="96" height="96" viewBox="0 0 36 36" className="shrink-0">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="3.4" />
              <circle
                cx="18" cy="18" r="15.9" fill="none" stroke="#ffffff" strokeWidth="3.4"
                strokeLinecap="round" strokeDasharray={`${d.taxa} ${100 - d.taxa}`} strokeDashoffset="25"
                transform="rotate(-90 18 18)"
              />
              <text x="18" y="19.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="#ffffff">{fmtN(d.taxa)}%</text>
            </svg>
          </div>
        </div>

        {/* métricas */}
        <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric icone="Recycle" cor="#2e9e6b" valor={fmtKg(d.kgAproveitado)} titulo="Alimento aproveitado" sub={`${formatBRL(d.vlRecuperado)} recuperados`} />
          <Metric icone="Trash2" cor="#c42b2b" valor={fmtKg(d.kgDesperdicado)} titulo="Alimento desperdiçado" sub={`${formatBRL(d.vlDesperdicado)} perdidos`} />
          <Metric icone="Cloud" cor="#2e6fb0" valor={`${fmtN(d.co2Evitado, 1)} kg`} titulo="CO₂ evitado" sub={`vs. ${fmtN(d.co2Emitido, 1)} kg emitidos`} />
          <Metric icone="Utensils" cor="#d9641f" valor={fmtN(d.refeicoes)} titulo="Refeições equivalentes" sub="ao alimento aproveitado" />
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {/* impacto por setor */}
          <div className="card-bengala p-5 lg:col-span-2">
            <h2 className="accent mb-1 font-bold text-ink">Impacto por setor</h2>
            <div className="mb-3 flex items-center gap-4 text-xs text-ink-soft">
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#2e9e6b' }} /> aproveitado</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#c42b2b' }} /> desperdiçado</span>
            </div>
            {d.porSetor.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-soft">Sem dados de perda/recuperação ainda.</p>
            ) : (
              <div className="space-y-2.5">
                {d.porSetor.map((s) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-sm text-ink-soft">{s.nome}</span>
                    <div className="flex h-5 flex-1 overflow-hidden rounded-full" style={{ background: '#f1ece2' }}>
                      <div className="h-full" style={{ width: `${(s.aprov / maxSetor) * 100}%`, background: '#2e9e6b' }} />
                      <div className="h-full" style={{ width: `${(s.desp / maxSetor) * 100}%`, background: '#c42b2b' }} />
                    </div>
                    <span className="w-16 shrink-0 text-right text-xs text-ink-soft">{fmtKg(s.aprov + s.desp)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* em risco agora */}
          <div className="rounded-xl p-5" style={{ background: '#fdf0d8', border: '1px solid #f2d49a' }}>
            <div className="flex items-center gap-2">
              <Icon name="AlertTriangle" size={18} style={{ color: '#a9740d' }} />
              <h2 className="font-bold" style={{ color: '#7a5208' }}>Em risco agora</h2>
            </div>
            <div className="mt-2 text-3xl font-bold" style={{ color: '#7a5208' }}>{fmtKg(d.kgRisco)}</div>
            <p className="text-sm" style={{ color: '#8a6a1a' }}>
              {formatBRL(d.vlRisco)} perto de vencer <strong>sem nenhuma ação</strong> (oferta, cartaz ou jornal).
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <button onClick={() => navigate('/ofertas')} className="rounded-lg px-3 py-2 text-left text-sm font-medium text-ink hover:brightness-95" style={{ background: '#ffffff' }}>
                <Icon name="Tag" size={14} className="mr-1 inline" /> Criar ofertas →
              </button>
              <button onClick={() => navigate('/jornal')} className="rounded-lg px-3 py-2 text-left text-sm font-medium text-ink hover:brightness-95" style={{ background: '#ffffff' }}>
                <Icon name="Newspaper" size={14} className="mr-1 inline" /> Adicionar ao jornal →
              </button>
            </div>
          </div>
        </div>

        {/* metodologia */}
        <p className="px-1 text-xs text-ink-soft">
          <Icon name="Info" size={12} className="mr-1 inline" />
          Metodologia: peso estimado pelo nome do produto; “aproveitado” = itens perto do vencimento com ação ativa;
          “desperdiçado” = itens vencidos. Fatores: {FATOR_CO2} kg CO₂e por kg de alimento · {KG_POR_REFEICAO} kg ≈ 1 refeição.
        </p>
      </div>
    </div>
  )
}
