import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Icon } from '../ui'
import { CAMADAS_CARTAZ, ajusteCartazDe } from './camadas'

// Editor do cartaz, igual ao do jornal: escolha a parte (topo, nome, foto ou preço),
// arraste para mudar de lugar e puxe as setas dos cantos (ou use − e +) para aumentar ou diminuir.
const limitar = (v, min, max) => Math.min(max, Math.max(min, v))

export default function EditorCartaz({ largura: W, altura: H, ajuste, onChange, desenhar, maxLargura = 420 }) {
  const caixaRef = useRef(null)
  const cartazRef = useRef(null)
  const [escala, setEscala] = useState(1)
  const [selecionada, setSelecionada] = useState('preco')
  const [caixas, setCaixas] = useState({})
  const gesto = useRef(null)
  const atual = ajuste || {}
  const camada = (nome) => ajusteCartazDe({ ajusteCartaz: atual }, nome)
  const presentes = CAMADAS_CARTAZ.filter(([id]) => caixas[id])

  useEffect(() => {
    const el = caixaRef.current
    if (!el) return undefined
    const medir = () => setEscala(Math.min(el.clientWidth, maxLargura) / W)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [W, maxLargura])

  // Mede onde cada parte ficou (já com o ajuste) para desenhar a moldura e as setas.
  useLayoutEffect(() => {
    const raiz = cartazRef.current
    const base = raiz?.getBoundingClientRect()
    if (!base) return
    const novas = {}
    for (const [nome] of CAMADAS_CARTAZ) {
      const el = raiz.querySelector(`[data-camada="${nome}"]`)
      if (!el) continue
      const r = el.getBoundingClientRect()
      novas[nome] = { left: (r.left - base.left) / escala, top: (r.top - base.top) / escala, width: r.width / escala, height: r.height / escala }
    }
    // sem lista de dependências: mede depois de cada desenho, e só atualiza se algo mudou
    setCaixas((antes) => (JSON.stringify(antes) === JSON.stringify(novas) ? antes : novas))
  })

  // Se a parte escolhida não existe neste modelo (ex.: foto nos modelos de pincel), escolhe a primeira.
  useEffect(() => {
    if (presentes.length && !caixas[selecionada]) setSelecionada(presentes[presentes.length - 1][0])
  }, [presentes.length, caixas, selecionada]) // eslint-disable-line react-hooks/exhaustive-deps

  const mudar = useCallback((nome, valor) => {
    onChange({ ...atual, [nome]: { ...camada(nome), ...valor } })
  }, [atual, onChange]) // eslint-disable-line react-hooks/exhaustive-deps

  const iniciar = (e, nome, tipo) => {
    e.preventDefault()
    e.stopPropagation()
    setSelecionada(nome)
    const caixa = caixas[nome]
    const base = cartazRef.current.getBoundingClientRect()
    const centro = caixa ? { x: base.left + (caixa.left + caixa.width / 2) * escala, y: base.top + (caixa.top + caixa.height / 2) * escala } : null
    gesto.current = { nome, tipo, x: e.clientX, y: e.clientY, inicio: camada(nome), centro, distancia: centro ? Math.hypot(e.clientX - centro.x, e.clientY - centro.y) || 1 : 1 }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const mover = (e) => {
    const g = gesto.current
    if (!g) return
    if (g.tipo === 'mover') {
      mudar(g.nome, {
        x: limitar(g.inicio.x + (e.clientX - g.x) / escala / W, -0.8, 0.8),
        y: limitar(g.inicio.y + (e.clientY - g.y) / escala / H, -0.8, 0.8),
      })
    } else if (g.centro) {
      const d = Math.hypot(e.clientX - g.centro.x, e.clientY - g.centro.y)
      mudar(g.nome, { s: limitar(Math.round(g.inicio.s * (d / g.distancia) * 100) / 100, 0.3, 3) })
    }
  }
  const soltar = () => { gesto.current = null }

  const sel = camada(selecionada)
  const caixa = caixas[selecionada]
  const seta = (pos, rotacao) => (
    <span
      key={`${pos.left}-${pos.top}`}
      onPointerDown={(e) => iniciar(e, selecionada, 'tamanho')}
      className="absolute flex h-7 w-7 touch-none items-center justify-center rounded-full border-2 border-white bg-bengala text-white shadow"
      style={{ ...pos, cursor: rotacao % 180 === 0 ? 'nwse-resize' : 'nesw-resize', transform: 'translate(-50%, -50%)' }}
      aria-hidden="true"
    >
      <Icon name="MoveDiagonal2" size={14} style={{ transform: `rotate(${rotacao}deg)` }} />
    </span>
  )
  const botao = 'flex h-10 w-10 items-center justify-center rounded-lg border border-ink-soft/25 bg-white text-ink hover:bg-cream-200'
  const tamanho = (delta) => mudar(selecionada, { s: limitar(Math.round((sel.s + delta) * 10) / 10, 0.3, 3) })

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        {presentes.map(([id, rotulo, icone]) => (
          <button key={id} type="button" onClick={() => setSelecionada(id)} aria-pressed={selecionada === id}
            className={`flex min-h-10 flex-1 items-center justify-center gap-1 rounded-lg border px-2 text-xs font-semibold ${selecionada === id ? 'border-navy bg-navy text-white' : 'border-ink-soft/20 bg-white text-ink hover:border-ink-soft/45'}`}>
            <Icon name={icone} size={14} /> {rotulo}
          </button>
        ))}
      </div>
      <div ref={caixaRef} className="w-full">
        <div
          className="relative mx-auto touch-none select-none overflow-hidden rounded-lg border border-ink-soft/15 bg-white"
          style={{ width: W * escala, height: H * escala }}
          onPointerMove={mover}
          onPointerUp={soltar}
          onPointerCancel={soltar}
        >
          <div ref={cartazRef} className="arte-fixa pointer-events-none absolute left-0 top-0" style={{ width: W, height: H, transform: `scale(${escala})`, transformOrigin: 'top left' }}>
            {desenhar(atual)}
          </div>
          {presentes.map(([id, rotulo]) => (
            <div
              key={id}
              onPointerDown={(e) => iniciar(e, id, 'mover')}
              className={`absolute cursor-move rounded ${selecionada === id ? 'border-2 border-dashed border-bengala' : 'border border-transparent hover:border-bengala/40'}`}
              style={{ left: caixas[id].left * escala, top: caixas[id].top * escala, width: caixas[id].width * escala, height: caixas[id].height * escala, zIndex: selecionada === id ? 3 : 2 }}
              aria-label={`Mover ${rotulo}`}
            />
          ))}
          {caixa && (
            <div className="pointer-events-none absolute" style={{ left: caixa.left * escala, top: caixa.top * escala, width: caixa.width * escala, height: caixa.height * escala, zIndex: 4 }}>
              <div className="pointer-events-auto">
                {seta({ left: 0, top: 0 }, 90)}
                {seta({ left: '100%', top: 0 }, 0)}
                {seta({ left: 0, top: '100%' }, 0)}
                {seta({ left: '100%', top: '100%' }, 90)}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => tamanho(-0.1)} className={botao} aria-label="Diminuir"><Icon name="Minus" size={16} /></button>
        <span className="num-tab min-w-24 text-center text-xs font-semibold text-ink">{CAMADAS_CARTAZ.find((c) => c[0] === selecionada)?.[1]}: {Math.round(sel.s * 100)}%</span>
        <button type="button" onClick={() => tamanho(0.1)} className={botao} aria-label="Aumentar"><Icon name="Plus" size={16} /></button>
        <span className="mx-1 h-6 w-px bg-ink-soft/20" aria-hidden="true" />
        {[['ArrowLeft', -0.02, 0, 'esquerda'], ['ArrowUp', 0, -0.02, 'cima'], ['ArrowDown', 0, 0.02, 'baixo'], ['ArrowRight', 0.02, 0, 'direita']].map(([icone, dx, dy, nome]) => (
          <button key={icone} type="button" onClick={() => mudar(selecionada, { x: limitar(sel.x + dx, -0.8, 0.8), y: limitar(sel.y + dy, -0.8, 0.8) })} className={botao} aria-label={`Mover para ${nome}`}>
            <Icon name={icone} size={16} />
          </button>
        ))}
        <button type="button" onClick={() => onChange(null)} className="ml-auto min-h-10 rounded-lg px-2 text-xs font-semibold text-ink-soft hover:bg-cream-200 hover:text-ink">Voltar ao padrão</button>
      </div>
      <p className="text-xs text-ink-soft">Escolha a parte, arraste para mudar de lugar e puxe as setas dos cantos (ou use − e +) para aumentar ou diminuir.</p>
    </div>
  )
}
