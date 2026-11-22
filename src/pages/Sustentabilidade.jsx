import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/StoreContext'
import { Icon, Botao, Indicador, Secao } from '../components/ui'
import {
  SETORES, setorById, statusValidade, pesoUnitarioKg, pesoTotalKg, formatBRL,
  FATOR_CO2, KG_POR_REFEICAO,
} from '../lib/utils'
import { exportarPDF } from '../lib/exportar'

const fmtKg = (v) => `${(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`
const fmtN = (v, d = 0) => (v || 0).toLocaleString('pt-BR', { maximumFractionDigits: d })

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

      // Perdas já descartadas pela aba Produtos (as trocas voltam ao fornecedor e não contam).
      for (const b of p.baixas || []) {
        if (b.tipo !== 'perda') continue
        const kgB = pesoUnitarioKg(p.nome) * (Number(b.quantidade) || 0)
        kgDesperdicado += kgB
        vlDesperdicado += Number(b.valor) || 0
        if (setores[p.setor]) setores[p.setor].desp += kgB
      }

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-ink-soft">
          Quanto a gestão de validade evitou de desperdício, em quilos, CO₂ e refeições. Serve como relatório de impacto (ESG) para a rede e para certificações.
        </p>
        <Botao onClick={exportar} disabled={exportando}>
          <Icon name={exportando ? 'LoaderCircle' : 'FileDown'} size={16} className={exportando ? 'animate-spin' : ''} /> {exportando ? 'Gerando…' : 'Baixar relatório PDF'}
        </Botao>
      </div>

      <div ref={ref} className="space-y-5 rounded-2xl bg-cream p-1">
        {/* destaque: taxa de aproveitamento */}
        <div className="overflow-hidden rounded-2xl bg-[#1c6e48] p-5 text-white md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-[#d9f2e6]">
                <Icon name="Leaf" size={16} /> Taxa de aproveitamento
              </div>
              <div className="num-tab display-bengala mt-1 text-[52px] leading-none">{fmtN(d.taxa)}%</div>
              <div className="mt-1.5 text-sm text-[#d9f2e6]">
                {fmtKg(d.kgAproveitado)} recuperados e {fmtKg(d.kgDesperdicado)} desperdiçados
              </div>
            </div>
            <svg width="88" height="88" viewBox="0 0 36 36" className="hidden shrink-0 sm:block" aria-hidden="true">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3.4" />
              <circle
                cx="18" cy="18" r="15.9" fill="none" stroke="#ffffff" strokeWidth="3.4"
                strokeLinecap="round" strokeDasharray={`${d.taxa} ${100 - d.taxa}`} strokeDashoffset="25"
                transform="rotate(-90 18 18)"
              />
            </svg>
          </div>
        </div>

        {/* métricas */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Indicador icone="Recycle" cor="var(--color-success)" valor={fmtKg(d.kgAproveitado)} rotulo="Alimento aproveitado" detalhe={`${formatBRL(d.vlRecuperado)} recuperados`} />
          <Indicador icone="Trash2" cor="var(--color-critical)" valor={fmtKg(d.kgDesperdicado)} rotulo="Alimento desperdiçado" detalhe={`${formatBRL(d.vlDesperdicado)} perdidos`} />
          <Indicador icone="Cloud" cor="var(--color-info)" valor={`${fmtN(d.co2Evitado, 1)} kg`} rotulo="CO₂ evitado" detalhe={`contra ${fmtN(d.co2Emitido, 1)} kg emitidos`} />
          <Indicador icone="Utensils" cor="var(--color-coral-dark)" valor={fmtN(d.refeicoes)} rotulo="Refeições equivalentes" detalhe="ao alimento aproveitado" />
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {/* impacto por setor */}
          <Secao
            className="lg:col-span-2"
            titulo="Impacto por setor"
            acao={(
              <div className="flex items-center gap-4 text-xs text-ink-soft">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-success" /> aproveitado</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-critical" /> desperdiçado</span>
              </div>
            )}
          >
            {d.porSetor.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-soft">Ainda não há dados de perda ou recuperação.</p>
            ) : (
              <div className="space-y-2.5">
                {d.porSetor.map((s) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 truncate text-sm text-ink">{s.nome}</span>
                    <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-cream-200">
                      <div className="h-full bg-success" style={{ width: `${(s.aprov / maxSetor) * 100}%` }} />
                      <div className="h-full bg-critical" style={{ width: `${(s.desp / maxSetor) * 100}%` }} />
                    </div>
                    <span className="num-tab w-16 shrink-0 text-right text-xs font-semibold text-ink">{fmtKg(s.aprov + s.desp)}</span>
                  </div>
                ))}
              </div>
            )}
          </Secao>

          {/* em risco agora */}
          <div className="rounded-[var(--radius-bengala)] border border-warning/50 bg-[#fdf3df] p-4 md:p-5">
            <div className="flex items-center gap-2 text-[#7a5208]">
              <Icon name="TriangleAlert" size={18} />
              <h2 className="text-base font-bold">Em risco agora</h2>
            </div>
            <div className="num-tab display-bengala mt-2 text-[34px] leading-none text-[#7a5208]">{fmtKg(d.kgRisco)}</div>
            <p className="mt-1.5 text-sm text-[#6b4f12]">
              {formatBRL(d.vlRisco)} perto de vencer sem nenhuma ação (oferta, cartaz ou jornal).
            </p>
            <div className="mt-4 grid gap-2">
              <Botao variante="contorno" className="justify-start" onClick={() => navigate('/ofertas')}><Icon name="Tag" size={16} /> Criar ofertas</Botao>
              <Botao variante="contorno" className="justify-start" onClick={() => navigate('/jornal')}><Icon name="Newspaper" size={16} /> Pôr no jornal</Botao>
            </div>
          </div>
        </div>

        {/* metodologia */}
        <p className="px-1 text-xs leading-relaxed text-ink-soft">
          Como calculamos: o peso é estimado pelo nome do produto. Aproveitado são os itens perto do vencimento com alguma ação ativa. Desperdiçado são os itens vencidos. Fatores: {FATOR_CO2} kg de CO₂e por kg de alimento e {KG_POR_REFEICAO} kg para cada refeição.
        </p>
      </div>
    </div>
  )
}
