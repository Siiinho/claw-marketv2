import { PrecoVarejo } from './ui'

// Estilos do preço na arte (escolhidos por produto, como o selo).
// "oval" é o balão de sempre; os outros não têm balão em volta ou trocam o formato.
export const ESTILOS_PRECO = [
  { id: 'oval', nome: 'Balão' },
  { id: 'numero', nome: 'Só o número' },
  { id: 'sombra', nome: 'Número com sombra' },
  { id: 'contorno', nome: 'Número com contorno' },
  { id: 'faixa', nome: 'Faixa' },
  { id: 'etiqueta', nome: 'Etiqueta' },
]

export const estiloPrecoById = (id) => ESTILOS_PRECO.find((e) => e.id === id) || ESTILOS_PRECO[0]

// Contorno em text-shadow: sai igual na tela e na exportação em PNG.
const contorno = (cor, px) => {
  const p = Math.max(1, px)
  return [`-${p}px -${p}px 0 ${cor}`, `${p}px -${p}px 0 ${cor}`, `-${p}px ${p}px 0 ${cor}`, `${p}px ${p}px 0 ${cor}`,
    `0 -${p}px 0 ${cor}`, `0 ${p}px 0 ${cor}`, `-${p}px 0 0 ${cor}`, `${p}px 0 0 ${cor}`].join(', ')
}

const fonte = { fontFamily: 'var(--font-encarte)', letterSpacing: '-0.01em', fontVariantNumeric: 'normal' }

// Desenha o preço no estilo pedido. k = escala (1 = célula padrão do template).
// Não se posiciona sozinho: quem usa coloca dentro de um bloco absoluto.
export default function PrecoArte({ valor, unidade, tema, estilo = 'oval', k = 1, semUnidade = false }) {
  const tamanho = 60 * k
  const uni = (cor, extra) => (semUnidade || !unidade ? null : (
    <span className="ml-1" style={{ marginBottom: 6 * k, fontSize: 18 * k, fontWeight: 900, ...fonte, color: cor, ...extra }}>{unidade}</span>
  ))

  if (estilo === 'numero' || estilo === 'sombra' || estilo === 'contorno') {
    const grande = tamanho * 1.12
    const cor = estilo === 'contorno' ? tema.precoFundo : tema.precoCor
    const sombra = estilo === 'sombra'
      ? `${4 * k}px ${4 * k}px 0 ${tema.precoFundo}`
      : estilo === 'contorno' ? `${contorno(tema.precoSombra, 4 * k)}, ${3 * k}px ${7 * k}px 0 ${tema.precoSombra}`
        // Só o número: um fio branco para continuar legível quando passa por cima da foto.
        : contorno('#ffffff', 3 * k)
    return (
      <div className="flex items-end leading-none" style={{ transform: estilo === 'numero' ? 'none' : 'rotate(-4deg)' }}>
        <PrecoVarejo valor={valor} cor={cor} style={{ fontSize: grande, ...fonte, textShadow: sombra }} />
        {uni(cor, { textShadow: sombra })}
      </div>
    )
  }

  if (estilo === 'faixa') {
    return (
      <div className="flex items-end leading-none" style={{ background: tema.precoCor, padding: `${6 * k}px ${14 * k}px ${5 * k}px`, borderRadius: 6 * k }}>
        <PrecoVarejo valor={valor} cor={tema.precoFundo} style={{ fontSize: tamanho, ...fonte }} />
        {uni(tema.precoFundo)}
      </div>
    )
  }

  if (estilo === 'etiqueta') {
    // Formato de etiqueta de preço: ponta à esquerda com o furo.
    const ponta = 24 * k
    return (
      <div className="relative flex items-end leading-none" style={{ transform: 'rotate(-4deg)', background: tema.precoFundo, padding: `${7 * k}px ${14 * k}px ${6 * k}px ${ponta + 8 * k}px`, borderRadius: `0 ${8 * k}px ${8 * k}px 0`, clipPath: `polygon(${ponta}px 0, 100% 0, 100% 100%, ${ponta}px 100%, 0 50%)` }}>
        <span aria-hidden="true" className="absolute rounded-full" style={{ left: ponta * 0.55, top: '50%', width: 9 * k, height: 9 * k, marginTop: -4.5 * k, background: tema.precoSombra }} />
        <PrecoVarejo valor={valor} cor={tema.precoCor} style={{ fontSize: tamanho, ...fonte }} />
        {uni(tema.precoCor)}
      </div>
    )
  }

  // Balão oval (o de sempre). A sombra é um elemento próprio: o box-shadow sai errado no PNG.
  const w = 186 * k
  const h = 92 * k
  return (
    <div className="relative" style={{ width: w, height: h, transform: 'rotate(-4deg)' }}>
      <div className="absolute" style={{ left: 5 * k, top: 7 * k, width: w, height: h, borderRadius: '50%', background: tema.precoSombra }} />
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden" style={{ borderRadius: '50%', background: tema.precoFundo, border: `${4 * k}px solid ${tema.precoSombra}` }}>
        <span aria-hidden="true" className="cm-brilho absolute inset-y-0 left-0" style={{ width: '30%', background: 'linear-gradient(100deg, transparent, rgba(255,255,255,.55), transparent)' }} />
        <div className="flex items-end leading-none">
          <PrecoVarejo valor={valor} cor={tema.precoCor} style={{ fontSize: tamanho, ...fonte }} />
          {uni(tema.precoCor)}
        </div>
      </div>
    </div>
  )
}
