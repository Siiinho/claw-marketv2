import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CelulaProduto, AJUSTE_PADRAO, ajusteDe } from './PaginaTemplate'
import { Icon } from './ui'

// Editor de um produto na arte, como no Canva: toque no nome, na foto, no preço ou na etiqueta de oferta,
// arraste para mudar de lugar e puxe as setas dos cantos para aumentar ou diminuir.
// O ajuste vale para o encarte, as artes (Feed, Stories, TV) e o site do cliente.
const W = 360
const H = 300
const CAMADAS = [
  ['foto', 'Foto', 'Image'],
  ['preco', 'Preço', 'BadgeDollarSign'],
  ['nome', 'Nome', 'Type'],
  ['selo', 'Etiqueta', 'Tag'],
]
const limitar = (v, min, max) => Math.min(max, Math.max(min, v))

export default function EditorCelula({ produto, tema, ajuste, onChange }) {
  const caixaRef = useRef(null)
  const celulaRef = useRef(null)
  const [escala, setEscala] = useState(1)
  const [selecionada, setSelecionada] = useState('foto')
  const [caixas, setCaixas] = useState({})
  const gesto = useRef(null)
  const atual = { ...AJUSTE_PADRAO, ...(ajuste || {}) }
  const camada = (nome) => ajusteDe({ ajusteArte: atual }, nome)

  useEffect(() => {
    const el = caixaRef.current
    if (!el) return undefined
    const medir = () => setEscala(Math.min(el.clientWidth, 460) / W)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Mede onde cada parte ficou (já com o ajuste) para desenhar a moldura e as setas.
  useLayoutEffect(() => {
    const base = celulaRef.current?.getBoundingClientRect()
    if (!base) return
    const novas = {}
    for (const [nome] of CAMADAS) {
      const el = celulaRef.current.querySelector(`[data-camada="${nome}"] > *`)
      if (!el) continue
      const r = el.getBoundingClientRect()
      novas[nome] = { left: (r.left - base.left) / escala, top: (r.top - base.top) / escala, width: r.width / escala, height: r.height / escala }
    }
    setCaixas(novas)
  }, [ajuste, escala, produto?.imagem, produto?.nome])

  const mudar = useCallback((nome, valor) => {
    onChange({ ...atual, [nome]: { ...camada(nome), ...valor } })
  }, [atual, onChange]) // eslint-disable-line react-hooks/exhaustive-deps

  const iniciar = (e, nome, tipo) => {
    e.preventDefault()
    e.stopPropagation()
    setSelecionada(nome)
    const caixa = caixas[nome]
    const base = celulaRef.current.getBoundingClientRect()
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
      mudar(g.nome, { s: limitar(Math.round(g.inicio.s * (d / g.distancia) * 100) / 100, 0.4, 2.5) })
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

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        {CAMADAS.map(([id, rotulo, icone]) => (
          <button key={id} type="button" onClick={() => setSelecionada(id)} aria-pressed={selecionada === id}
            className={`flex min-h-9 flex-1 items-center justify-center gap-1 rounded-lg border px-2 text-xs font-semibold ${selecionada === id ? 'border-navy bg-navy text-white' : 'border-ink-soft/20 bg-white text-ink hover:border-ink-soft/45'}`}>
            <Icon name={icone} size={14} /> {rotulo}
          </button>
        ))}
      </div>
      <div ref={caixaRef} className="w-full">
        <div
          className="relative mx-auto touch-none select-none overflow-hidden rounded-xl"
          style={{ width: W * escala, height: H * escala, background: tema.fundo }}
          onPointerMove={mover}
          onPointerUp={soltar}
          onPointerCancel={soltar}
        >
          <div ref={celulaRef} className="arte-fixa pointer-events-none absolute left-0 top-0" style={{ width: W, height: H, transform: `scale(${escala})`, transformOrigin: 'top left' }}>
            <CelulaProduto produto={{ ...produto, ajusteArte: atual }} tema={tema} estilo={{ left: 0, top: 0, width: W, height: H }} />
          </div>
          {CAMADAS.map(([id]) => caixas[id] && (
            <div
              key={id}
              onPointerDown={(e) => iniciar(e, id, 'mover')}
              className={`absolute cursor-move rounded ${selecionada === id ? 'border-2 border-dashed border-bengala' : 'border border-transparent hover:border-bengala/40'}`}
              style={{ left: caixas[id].left * escala, top: caixas[id].top * escala, width: caixas[id].width * escala, height: caixas[id].height * escala, zIndex: selecionada === id ? 3 : 2 }}
              aria-label={`Mover ${id}`}
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
        <span className="num-tab text-xs font-semibold text-ink">{CAMADAS.find((c) => c[0] === selecionada)[1]}: {Math.round(sel.s * 100)}%</span>
        <button type="button" onClick={() => mudar(selecionada, { s: limitar(Math.round((sel.s - 0.1) * 10) / 10, 0.4, 2.5) })} className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-soft/25 bg-white text-ink hover:bg-cream-200" aria-label="Diminuir"><Icon name="Minus" size={14} /></button>
        <button type="button" onClick={() => mudar(selecionada, { s: limitar(Math.round((sel.s + 0.1) * 10) / 10, 0.4, 2.5) })} className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-soft/25 bg-white text-ink hover:bg-cream-200" aria-label="Aumentar"><Icon name="Plus" size={14} /></button>
        {[['ArrowLeft', -0.03, 0], ['ArrowUp', 0, -0.03], ['ArrowDown', 0, 0.03], ['ArrowRight', 0.03, 0]].map(([icone, dx, dy]) => (
          <button key={icone} type="button" onClick={() => mudar(selecionada, { x: limitar(sel.x + dx, -0.8, 0.8), y: limitar(sel.y + dy, -0.8, 0.8) })} className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-soft/25 bg-white text-ink hover:bg-cream-200" aria-label={`Mover ${icone}`}>
            <Icon name={icone} size={14} />
          </button>
        ))}
        <button type="button" onClick={() => onChange(null)} className="ml-auto min-h-9 rounded-lg px-2 text-xs font-semibold text-ink-soft hover:bg-cream-200 hover:text-ink">Voltar ao padrão</button>
      </div>
      <p className="text-xs text-ink-soft">Arraste a parte escolhida para mudar de lugar e puxe as setas dos cantos para aumentar ou diminuir. Ex.: foto maior e preço menor.</p>
    </div>
  )
}
