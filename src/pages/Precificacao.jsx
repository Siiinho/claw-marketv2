import { useState, useMemo } from 'react'
import { useStore } from '../store/StoreContext'
import { Icon, Botao, PrecoVarejo, StatusBadge, ProdutoThumb, EmptyState, inputCls, Secao } from '../components/ui'
import {
  setorById, diasParaVencer, formatBRL, regraDoProduto, precoComRegra, uid, plural,
} from '../lib/utils'

export default function Precificacao() {
  const { produtos, config, ofertaDoProduto, criarOferta, salvarConfig, toast } = useStore()
  const [regras, setRegras] = useState(() => [...(config.regrasPreco || [])].sort((a, b) => a.diasMax - b.diasMax))
  const [usarNasSugestoes, setUsarNasSugestoes] = useState(config.usarRegrasNasSugestoes ?? true)

  const candidatos = useMemo(
    () =>
      produtos
        .map((p) => ({ p, dias: diasParaVencer(p.validade), regra: regraDoProduto(diasParaVencer(p.validade), regras) }))
        .filter((x) => x.regra)
        .sort((a, b) => a.dias - b.dias),
    [produtos, regras]
  )

  const semOferta = candidatos.filter((c) => !ofertaDoProduto(c.p.id))

  const salvarRegras = () => {
    const limpas = regras
      .map((r) => ({ ...r, diasMax: Math.max(0, Number(r.diasMax) || 0), desconto: Math.min(90, Math.max(1, Number(r.desconto) || 1)) }))
      .sort((a, b) => a.diasMax - b.diasMax)
    setRegras(limpas)
    salvarConfig({ regrasPreco: limpas, usarRegrasNasSugestoes: usarNasSugestoes })
    toast('Regras de precificação salvas!')
  }

  const addFaixa = () => {
    const maxMax = Math.max(0, ...regras.map((r) => r.diasMax))
    setRegras([...regras, { id: uid(), diasMax: maxMax + 3, desconto: 10 }])
  }
  const removeFaixa = (id) => setRegras(regras.filter((r) => r.id !== id))
  const editFaixa = (id, campo, val) => setRegras(regras.map((r) => (r.id === id ? { ...r, [campo]: val } : r)))

  const aplicarUm = (p, regra) => {
    criarOferta(p.id, `Regra de validade · −${regra.desconto}%`, regra.desconto, p.validade)
    toast(`Oferta de ${regra.desconto}% aplicada em ${p.nome}.`)
  }

  const aplicarTodas = () => {
    let n = 0
    semOferta.forEach(({ p, regra }) => {
      criarOferta(p.id, `Regra de validade · −${regra.desconto}%`, regra.desconto, p.validade)
      n++
    })
    toast(n ? `${n === 1 ? '1 oferta aplicada' : `${n} ofertas aplicadas`} pelas regras!` : 'Nenhuma nova oferta a aplicar.', n ? 'sucesso' : 'info')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-ink-soft">
          Quanto mais perto do vencimento, maior o desconto. Ajuste as faixas, confira a prévia e aplique as ofertas de uma vez.
        </p>
        <Botao onClick={aplicarTodas} disabled={semOferta.length === 0}>
          <Icon name="Wand2" size={16} /> Aplicar {semOferta.length ? plural(semOferta.length, 'oferta', 'ofertas') : 'ofertas'}
        </Botao>
      </div>

      <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start">
        {/* editor de regras */}
        <Secao titulo="Faixas de desconto" descricao="Faltando até tantos dias para vencer, o produto ganha tanto de desconto.">
          <ul className="space-y-2">
            {[...regras].sort((a, b) => a.diasMax - b.diasMax).map((r) => (
              <li key={r.id} className="flex items-center gap-2 rounded-xl border border-ink-soft/15 bg-cream/60 p-2 text-sm text-ink">
                <span className="pl-1">Até</span>
                <input type="number" min="0" aria-label="Dias para vencer" value={r.diasMax} onChange={(e) => editFaixa(r.id, 'diasMax', e.target.value)} className={`${inputCls} num-tab px-2 py-1.5 text-center`} style={{ width: '3.5rem', flex: 'none' }} />
                <span>dias</span>
                <Icon name="ArrowRight" size={15} className="shrink-0 text-ink-soft" />
                <input type="number" min="1" max="90" aria-label="Desconto em porcentagem" value={r.desconto} onChange={(e) => editFaixa(r.id, 'desconto', e.target.value)} className={`${inputCls} num-tab px-2 py-1.5 text-center`} style={{ width: '3.5rem', flex: 'none' }} />
                <span className="font-semibold">% off</span>
                <button onClick={() => removeFaixa(r.id)} aria-label="Remover faixa" className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-soft hover:bg-critical/10 hover:text-critical"><Icon name="Trash2" size={16} /></button>
              </li>
            ))}
          </ul>
          <button onClick={addFaixa} className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-navy hover:bg-cream-200">
            <Icon name="Plus" size={16} /> Adicionar faixa
          </button>

          <label className="mt-4 flex items-start gap-2.5 border-t border-ink-soft/10 pt-4">
            <input type="checkbox" checked={usarNasSugestoes} onChange={(e) => setUsarNasSugestoes(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-navy" />
            <span className="text-sm text-ink">Usar estas faixas nas sugestões de oferta, no lugar do desconto fixo.</span>
          </label>

          <Botao variante="escuro" className="mt-4 w-full" onClick={salvarRegras}><Icon name="Save" size={16} /> Salvar faixas</Botao>
        </Secao>

        {/* prévia de preços */}
        <Secao
          titulo="Prévia de preços"
          descricao={candidatos.length ? `${plural(candidatos.length, 'produto entra', 'produtos entram')} nas faixas` : undefined}
        >
          {candidatos.length === 0 ? (
            <EmptyState icon="Percent" titulo="Nenhum produto nas faixas" descricao="Ajuste as faixas ou espere os produtos chegarem perto do vencimento." />
          ) : (
            <ul className="divide-y divide-ink-soft/10">
              {candidatos.map(({ p, regra }) => {
                const novo = precoComRegra(p.precoNormal, regra)
                const temOferta = ofertaDoProduto(p.id)
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                    <ProdutoThumb produto={p} size={40} />
                    <div className="min-w-0 flex-1 basis-44">
                      <div className="break-words font-semibold leading-snug text-ink">{p.nome}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
                        <StatusBadge validade={p.validade} />
                        <span>faixa de até {regra.diasMax} dias, −{regra.desconto}%</span>
                      </div>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                      <div className="text-right">
                        <div className="num-tab text-xs text-ink-soft line-through">{formatBRL(p.precoNormal)}</div>
                        <PrecoVarejo valor={novo} className="text-xl text-bengala" />
                      </div>
                      {temOferta ? (
                        <span className="inline-flex min-h-10 w-24 items-center justify-center gap-1 text-sm font-semibold text-[#1c6e48]"><Icon name="Check" size={15} strokeWidth={2.25} /> Aplicada</span>
                      ) : (
                        <Botao variante="contorno" className="w-24" onClick={() => aplicarUm(p, regra)}>Aplicar</Botao>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Secao>
      </div>
    </div>
  )
}
