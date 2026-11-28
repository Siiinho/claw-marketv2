import * as Lucide from 'lucide-react'
import { useEffect } from 'react'
import { useStore } from '../store/StoreContext'
import { partesPreco, statusValidade, labelDias, setorById, ilustracaoSetor } from '../lib/utils'
import { useMarca, LogoOuNome, ehBengala } from '../lib/marca'
import logoBengala from '../assets/logo.png'
import { mercadoAtual, MERCADO_PADRAO } from '../lib/nuvem'

// ---- ícone dinâmico (lucide) — traço 1.75 p/ um visual mais fino e elegante ----
export function Icon({ name, strokeWidth = 1.75, ...props }) {
  const Cmp = Lucide[name] || Lucide.Circle
  return <Cmp strokeWidth={strokeWidth} {...props} />
}

export function Logo({ h = 36, chip = false, className = '' }) {
  const marca = useMarca()
  const img = <LogoOuNome marca={marca} padrao={logoBengala} style={{ height: h, fontSize: h * 0.42 }} className={`block w-auto max-w-[40vw] object-contain ${className}`} nomeClassName={`text-navy ${className}`} />
  return chip ? <span className="inline-flex items-center justify-center rounded-xl bg-white p-1">{img}</span> : img
}

// ---- preço estilo varejo ----
export function PrecoVarejo({ valor, className = '', cor, style }) {
  const { reais, centavos } = partesPreco(valor)
  return (
    <span className={`preco-varejo ${className}`} style={cor || style ? { ...style, ...(cor ? { color: cor } : null) } : undefined}>
      <span className="moeda">R$ </span>
      {reais}
      <span className="centavos">,{centavos}</span>
    </span>
  )
}

// ---- badge de status de validade ----
// Etiqueta de validade em cor cheia: o alerta precisa saltar aos olhos.
const CORES_VALIDADE = {
  vencido: { background: '#7a1010', color: '#ffffff' },
  critico: { background: '#d81e29', color: '#ffffff' },
  atencao: { background: '#ffb020', color: '#3d2600' },
  normal: { background: '#0f7a40', color: '#ffffff' },
}
export function StatusBadge({ validade, mostrarDias = true }) {
  const s = statusValidade(validade)
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
      style={CORES_VALIDADE[s.id] || { background: s.bg, color: s.cor }}
    >
      <Lucide.Clock size={12} />
      {mostrarDias ? labelDias(s.dias) : s.label}
    </span>
  )
}

// ---- thumbnail do produto (foto ou ícone do setor) ----
export function ProdutoThumb({ produto, size = 44 }) {
  const setor = setorById(produto.setor)
  if (produto.imagem) {
    return (
      <img
        src={produto.imagem}
        alt={produto.nome}
        loading="lazy"
        decoding="async"
        className="shrink-0 rounded-xl border border-black/5 bg-white object-contain"
        style={{
          width: size,
          height: size,
          padding: Math.max(2, Math.round(size * 0.055)),
          boxShadow: size >= 56 ? '0 4px 14px rgba(26, 32, 44, 0.10)' : 'none',
        }}
      />
    )
  }
  return (
    <div
      className="flex items-center justify-center rounded-lg shrink-0"
      style={{ width: size, height: size, background: `${setor.cor}14` }}
    >
      <ImagemSetor id={setor.id} size={Math.round(size * 0.62)} />
    </div>
  )
}

// ---- ícone 3D das abas (decorativo: o rótulo da aba vem sempre ao lado) ----
const ICONE_ABA = { dashboard: 'inicio', compras: 'lista', encarte: 'jornal', lista: 'produtos' }
export function ImagemAba({ id, size = 24, className = '', style }) {
  const marca = useMarca()
  const nome = ICONE_ABA[id] || id
  // "Meu mercado" usa a própria logo do mercado como ícone
  // (outro mercado ainda sem logo fica com o ícone da loja, nunca a logo do Bengala)
  if (id === 'mercado' && (marca?.logo || (ehBengala(marca) && mercadoAtual() === MERCADO_PADRAO))) {
    return <img src={marca?.logo || logoBengala} alt="" aria-hidden="true" draggable={false} className={`shrink-0 select-none rounded-md bg-white object-contain p-px ${className}`} style={{ width: size, height: size, ...style }} />
  }
  if (id === 'mercado') return <Lucide.Store aria-hidden="true" size={size} strokeWidth={1.75} className={`shrink-0 text-navy ${className}`} style={style} />
  return (
    <img
      src={`${import.meta.env.BASE_URL}abas/${nome}.webp`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      decoding="async"
      draggable={false}
      className={`shrink-0 select-none object-contain ${className}`}
      style={{ width: size, height: size, ...style }}
    />
  )
}

// ---- ilustração 3D do setor (decorativa: o nome do setor vem sempre ao lado) ----
export function ImagemSetor({ id, size = 40, className = '', style }) {
  return (
    <img
      src={ilustracaoSetor(id)}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={`shrink-0 select-none object-contain ${className}`}
      style={{ width: size, height: size, ...style }}
    />
  )
}

// ---- selo estrela de desconto (estilo encarte; SVG = export-safe) ----
const STAR_POINTS = (() => {
  const pts = []
  const spikes = 14, cx = 50, cy = 50, outer = 48, inner = 39
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (Math.PI / spikes) * i - Math.PI / 2
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`)
  }
  return pts.join(' ')
})()

export function SeloDesconto({ texto, size = 44, className = '', style }) {
  // texto em HTML sobreposto (não <text> no SVG) — evita travar o html2canvas no export
  return (
    <span className={`inline-flex items-center justify-center ${className}`} style={{ width: size, height: size, position: className.includes('absolute') ? undefined : 'relative', ...style }}>
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0 }}>
        <polygon points={STAR_POINTS} fill="#ffd23f" stroke="#c42b2b" strokeWidth="4" strokeLinejoin="round" />
      </svg>
      <span style={{ position: 'relative', fontSize: size * 0.26, fontWeight: 800, color: '#c42b2b', lineHeight: 1 }}>{texto}</span>
    </span>
  )
}

// ---- pílula genérica ----
export function Pill({ children, cor = '#3b4656', bg = '#e8edf3', className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
      style={{ background: bg, color: cor }}
    >
      {children}
    </span>
  )
}

// ---- estado vazio ----
export function EmptyState({ icon = 'Inbox', titulo, descricao, acao }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ink-soft/25 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cream-200 text-ink-soft">
        <Icon name={icon} size={26} />
      </div>
      <p className="font-semibold text-ink">{titulo}</p>
      {descricao && <p className="max-w-xs text-sm text-ink-soft">{descricao}</p>}
      {acao && <div className="mt-2">{acao}</div>}
    </div>
  )
}

// ---- botão padrão ----
export function Botao({ children, variante = 'primario', className = '', ...props }) {
  const base =
    'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50'
  const v = {
    primario: 'bg-bengala text-white shadow-[0_2px_0_rgba(0,0,0,.25)] hover:bg-bengala-dark',
    coral: 'bg-coral text-white hover:bg-coral-dark',
    contorno: 'border-2 border-navy/40 bg-white text-navy shadow-[0_2px_0_rgba(8,43,79,.15)] hover:border-navy hover:bg-cream',
    escuro: 'bg-navy text-white shadow-[0_2px_0_rgba(0,0,0,.25)] hover:bg-navy-light',
    perigo: 'bg-critical text-white hover:brightness-90',
    fantasma: 'text-ink-soft hover:bg-cream-200',
  }[variante]
  return (
    <button className={`${base} ${v} ${className}`} {...props}>
      {children}
    </button>
  )
}

// ---- modal ----
export function Modal({ open, onClose, titulo, children, footer, largura = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return
    const onEsc = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="overlay-in fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div role="dialog" aria-modal="true" aria-label={titulo} className={`modal-in w-full ${largura} max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl`}>
        <div className="flex items-center justify-between border-b border-ink-soft/10 px-5 py-3.5">
          <h3 className="text-base font-semibold">{titulo}</h3>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-1.5 text-ink-soft hover:bg-cream-200">
            <Lucide.X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-ink-soft/10 px-5 py-3">{footer}</div>
        )}
      </div>
    </div>
  )
}

// ---- container de toasts ----
export function Toasts() {
  const { toasts } = useStore()
  const cor = { sucesso: '#2e9e6b', erro: '#c42b2b', info: '#2e6fb0' }
  const ic = { sucesso: 'CheckCircle2', erro: 'AlertCircle', info: 'Info' }
  return (
    <div aria-live="polite" className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 md:inset-x-auto md:bottom-5 md:right-5 md:items-end">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="toast-in flex max-w-sm items-center gap-2.5 rounded-xl border border-navy/10 bg-white px-4 py-3 text-sm font-medium text-ink shadow-[0_8px_28px_rgba(8,43,79,.16)]"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: `${cor[t.tipo]}1f`, color: cor[t.tipo] }}><Icon name={ic[t.tipo]} size={15} /></span>
          {t.msg}
        </div>
      ))}
    </div>
  )
}

// ---- input/select rotulado ----
export function Campo({ label, children, obrigatorio }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-ink">
        {label} {obrigatorio && <span className="text-bengala">*</span>}
      </span>
      {children}
    </label>
  )
}

export const inputCls =
  'w-full rounded-lg border-2 border-ink-soft/40 bg-white px-3 py-2 text-sm font-medium text-ink outline-none focus:border-bengala focus:ring-2 focus:ring-bengala/20'

// ===== Peças comuns de página: o mesmo desenho em todas as abas =====

// Seção (card) com título, descrição e ação à direita. `numero` vira o passo 1, 2, 3...
export function Secao({ numero, titulo, descricao, acao, children, className = '', corpo = 'mt-4', as: Tag = 'section' }) {
  const temCabecalho = titulo || acao
  return (
    <Tag className={`card-bengala min-w-0 p-4 md:p-5 ${className}`}>
      {temCabecalho && (
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-start gap-3">
            {numero != null && (
              <span className="num-tab flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">{numero}</span>
            )}
            <div className="min-w-0">
              {titulo && <h2 className="text-[21px] font-extrabold leading-7 text-navy">{titulo}</h2>}
              {descricao && <p className="mt-1 text-base font-medium leading-snug text-ink">{descricao}</p>}
            </div>
          </div>
          {acao && <div className="flex shrink-0 flex-wrap items-center gap-2">{acao}</div>}
        </div>
      )}
      {children != null && <div className={temCabecalho ? corpo : ''}>{children}</div>}
    </Tag>
  )
}

// Rótulo de um grupo de campos dentro da seção.
export function Rotulo({ children, acao, className = '' }) {
  return (
    <div className={`mb-2 flex items-center justify-between gap-2 ${className}`}>
      <span className="text-base font-bold text-navy">{children}</span>
      {acao}
    </div>
  )
}

// Abas internas da página (controle segmentado).
export function Abas({ itens, valor, onChange, rotulo, className = '' }) {
  return (
    <div role="tablist" aria-label={rotulo} className={`flex gap-1 overflow-x-auto rounded-xl bg-cream-200 p-1 ${className}`}>
      {itens.map((a) => {
        const ativo = valor === a.id
        return (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={ativo}
            onClick={() => onChange(a.id)}
            className={`flex min-h-10 flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-bold ${ativo ? 'bg-navy text-white shadow-[0_2px_0_rgba(0,0,0,.2)]' : 'text-navy hover:bg-white'}`}
          >
            {a.icone && <Icon name={a.icone} size={17} className="hidden sm:block" />}
            {a.rotuloCurto ? (
              <>
                <span className="sm:hidden">{a.rotuloCurto}</span>
                <span className="hidden sm:inline">{a.rotulo}</span>
              </>
            ) : <span>{a.rotulo}</span>}
            {a.badge > 0 && <span className={`num-tab rounded-full px-2 text-xs font-bold ${ativo ? 'bg-offer text-navy' : 'bg-navy text-white'}`}>{a.badge}</span>}
          </button>
        )
      })}
    </div>
  )
}

// Cartão de escolha: uma opção entre várias. Selecionado = borda azul-marinho.
export function Escolha({ ativo, onClick, icone, titulo, descricao, extra, disabled, className = '', iconeCor }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={ativo}
      className={`flex min-w-0 items-center gap-3 rounded-xl border-2 p-3 text-left disabled:cursor-not-allowed disabled:opacity-50 ${ativo ? 'border-navy bg-navy/[0.045] shadow-[inset_0_0_0_1px_var(--color-navy)]' : 'border-navy/25 bg-white shadow-[0_2px_0_rgba(8,43,79,.12)] hover:border-navy'} ${className}`}
    >
      {icone && (
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${ativo ? 'bg-navy text-white' : 'bg-cream-200 text-navy'}`}
          style={!ativo && iconeCor ? { color: iconeCor } : undefined}
        >
          <Icon name={icone} size={19} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold leading-snug text-ink">{titulo}</span>
        {descricao && <span className="mt-0.5 block text-sm leading-snug text-ink-soft">{descricao}</span>}
      </span>
      {extra != null && <span className="num-tab shrink-0 text-sm font-semibold text-ink-soft">{extra}</span>}
      <Icon name={ativo ? 'CircleCheck' : 'ChevronRight'} size={20} className="shrink-0 text-navy" />
    </button>
  )
}

// Botões lado a lado para escolher um valor (tamanho, arrumação...).
export function Segmentado({ opcoes, valor, onChange, disabled, className = '', rotulo }) {
  return (
    <div role="group" aria-label={rotulo} className={`flex flex-wrap gap-1.5 ${className}`}>
      {opcoes.map(([id, texto, detalhe]) => {
        const ativo = valor === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            disabled={disabled}
            aria-pressed={ativo}
            className={`min-h-11 rounded-lg border-2 px-3 py-1.5 text-sm font-bold disabled:opacity-50 ${ativo ? 'border-navy bg-navy text-white' : 'border-navy/30 bg-white text-navy hover:border-navy'}`}
          >
            {texto}
            {detalhe && <span className={`ml-1 font-normal ${ativo ? 'text-white/75' : 'text-ink-soft'}`}>{detalhe}</span>}
          </button>
        )
      })}
    </div>
  )
}

// Indicador numérico (relatórios, painel, ESG).
export function Indicador({ rotulo, valor, icone, cor = 'var(--color-navy)', detalhe }) {
  return (
    <div className="card-bengala min-w-0 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-ink-soft">{rotulo}</span>
        {icone && <Icon name={icone} size={17} style={{ color: cor }} className="shrink-0" />}
      </div>
      <div className="num-tab display-bengala mt-1.5 truncate text-[26px] leading-tight text-navy md:text-[30px]">{valor}</div>
      {detalhe && <div className="mt-0.5 text-xs text-ink-soft">{detalhe}</div>}
    </div>
  )
}

// Botão de ação de uma linha de produto: sempre com ícone e o nome da ação.
const TONS_ACAO = {
  neutro: () => 'border-ink-soft/25 bg-white text-ink hover:border-navy/45 hover:text-navy',
  jornal: (a) => (a ? 'border-navy bg-navy text-white hover:bg-navy-light' : 'border-navy/35 bg-white text-navy hover:bg-navy/[0.06]'),
  estrela: (a) => (a ? 'border-bengala bg-bengala text-white hover:bg-bengala-dark' : 'border-bengala/35 bg-white text-bengala hover:bg-bengala/[0.06]'),
  troca: (a) => (a ? 'border-[#1f5c99] bg-[#1f5c99] text-white hover:bg-[#184a7c]' : 'border-info/40 bg-white text-[#1f5c99] hover:bg-info/[0.07]'),
  perda: (a) => (a ? 'border-[#a61f1f] bg-[#a61f1f] text-white hover:bg-[#8a1919]' : 'border-critical/40 bg-white text-[#a61f1f] hover:bg-critical/[0.07]'),
}
export function Acao({ icone, children, tom = 'neutro', ativo = false, iconeFill, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-[13px] font-bold transition-colors duration-150 ${TONS_ACAO[tom](ativo)} ${className}`}
      {...props}
    >
      <Icon name={icone} size={16} strokeWidth={2.1} {...(iconeFill ? { fill: iconeFill } : {})} className="shrink-0" />
      {children}
    </button>
  )
}
