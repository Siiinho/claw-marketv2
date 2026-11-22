import { forwardRef, useMemo } from 'react'
import { paraNumero } from '../../lib/utils'
import { Cartaz } from '../Cartaz'
import { CamadaCartaz } from './camadas'

// Cartazes "estilo pincel": modelos que imitam os cartazes pintados à mão de supermercado.
// Cada modelo é só um objeto em TEMPLATES_CARTAZ; o desenho (pinceladas, faixa, octógono,
// círculo) sai em SVG e CSS, e o texto se ajusta sozinho ao espaço de cada tamanho.
// A validade do produto nunca aparece: só o período da campanha.

const PX_POR_MM = 96 / 25.4
const MARGEM_MM = 4

export const PAPEIS = {
  A3: { id: 'A3', w: 297, h: 420 },
  A4: { id: 'A4', w: 210, h: 297 },
  A5: { id: 'A5', w: 148, h: 210 },
  A6: { id: 'A6', w: 105, h: 148 },
  A7: { id: 'A7', w: 74, h: 105 },
}

export const ORIENTACOES = [['retrato', 'Em pé'], ['paisagem', 'Deitado']]

// Quantos cartazes cabem na folha (A3 sai em folha A3; o resto em A4, na posição que couber mais).
export function imposicao(tamanho = 'A4', orientacao = 'retrato') {
  const papel = PAPEIS[tamanho] || PAPEIS.A4
  const deitado = orientacao === 'paisagem'
  const cw = deitado ? papel.h : papel.w
  const ch = deitado ? papel.w : papel.h
  const base = tamanho === 'A3' ? PAPEIS.A3 : PAPEIS.A4
  const opcoes = [
    { orientacao: 'retrato', w: base.w, h: base.h },
    { orientacao: 'paisagem', w: base.h, h: base.w },
  ].map((f) => {
    const cols = Math.max(1, Math.floor((f.w + 0.5) / cw))
    const lins = Math.max(1, Math.floor((f.h + 0.5) / ch))
    return { ...f, cols, lins, n: cols * lins }
  })
  opcoes.sort((a, b) => b.n - a.n || +(b.orientacao === orientacao) - +(a.orientacao === orientacao))
  const f = opcoes[0]
  const folha = { formato: base.id.toLowerCase(), orientacao: f.orientacao, largura: Math.round(f.w * PX_POR_MM), altura: Math.round(f.h * PX_POR_MM) }
  const margem = MARGEM_MM * PX_POR_MM
  return {
    folha,
    cols: f.cols,
    lins: f.lins,
    porFolha: f.n,
    margem,
    cartaz: { largura: (folha.largura - margem * 2) / f.cols, altura: (folha.altura - margem * 2) / f.lins },
    desc: f.n === 1 ? `1 por folha ${base.id}` : `${f.n} por folha ${base.id}`,
  }
}

export function paginar(itens, imp) {
  const folhas = []
  for (let i = 0; i < itens.length; i += imp.porFolha) folhas.push(itens.slice(i, i + imp.porFolha))
  return folhas.length ? folhas : [[]]
}

const FONTES = {
  preco: "'Anton', 'Impact', 'Arial Narrow Bold', sans-serif",
  chamada: "'Bangers', 'Impact', sans-serif",
  produto: "'Permanent Marker', 'Comic Sans MS', cursive",
  mao: "'Kalam', 'Comic Sans MS', cursive",
  serifa: "'Alfa Slab One', 'Rockwell Extra Bold', Georgia, serif",
  larga: "'Archivo Black', 'Arial Black', sans-serif",
}

// Tokens de um modelo:
// papel (cor do fundo), moldura (cor da borda grossa, opcional),
// cabecalho: 'pincel' | 'black' | 'letreiro' | 'faixa' | 'tagline',
// chamada: [linha pequena, palavra grande], corChamada, corChamada2, riscosChamada (cores das pinceladas),
// faixa: { cor, cor2, fonte } (cabecalho 'faixa'),
// fonteProduto: 'chamada' | 'produto', coresProduto (alterna por linha),
// detalhe: 'lado' | 'oval' | 'unidade' | 'acougue' | 'linha', corDetalhe, corDetalhe2,
// fontePreco, corPreco, sombraPreco, fundoPreco: 'riscos' | 'octogono' | 'circulo' | null,
// riscosPreco, corCirculo, centavosSublinhado, rotulo ('nenhum' esconde UN/KG), proporcoes [topo, nome].
export const TEMPLATES_CARTAZ = {
  'mega-oferta': {
    id: 'mega-oferta', nome: 'Mega Oferta', desc: 'Branco, pinceladas coloridas',
    papel: '#ffffff', cabecalho: 'pincel', chamada: ['MEGA', 'OFERTA'], corChamada: '#ffe14d',
    riscosChamada: ['#ffe600', '#ff9f1c', '#8fd14f', '#ff6b1a', '#ffe600'],
    fonteProduto: 'chamada', coresProduto: ['#1e88e5'], detalhe: 'lado', corDetalhe: '#1b1b1b',
    corPreco: '#e3122b', fundoPreco: 'riscos', riscosPreco: ['#ffe600', '#ffd400', '#ffe600', '#ffef5c'],
    centavosSublinhado: false, proporcoes: [0.26, 0.2],
  },
  'esquenta-black': {
    id: 'esquenta-black', nome: 'Esquenta Black', desc: 'Black Friday, preço preto',
    papel: '#ffffff', cabecalho: 'black', chamada: ['ESQUENTA', 'BLACK FRIDAY'], corChamada: '#ffe14d', corChamada2: '#7ed957',
    fonteProduto: 'chamada', coresProduto: ['#1e88e5'], detalhe: 'lado', corDetalhe: '#111111',
    corPreco: '#151515', fundoPreco: 'riscos', riscosPreco: ['#ffe600', '#ffc400', '#7ed957', '#ffe600'],
    centavosSublinhado: false, proporcoes: [0.3, 0.15],
  },
  promocao: {
    id: 'promocao', nome: 'Promoção', desc: 'Moldura amarela, preço no recorte',
    papel: '#fbfaf4', moldura: '#ffe14d', cabecalho: 'letreiro', chamada: ['', 'PROMOÇÃO'], corChamada: '#e3122b',
    fonteProduto: 'produto', coresProduto: ['#1a3fb5'], detalhe: 'unidade', corDetalhe: '#1a3fb5',
    corPreco: '#e3122b', fundoPreco: 'octogono', riscosPreco: ['#ffe600', '#ffd23f'],
    centavosSublinhado: true, rotulo: 'nenhum', proporcoes: [0.15, 0.32],
  },
  'oferta-faixa': {
    id: 'oferta-faixa', nome: 'Oferta faixa', desc: 'Amarelo, faixa vermelha com serifa',
    papel: '#ffe600', cabecalho: 'faixa', faixa: { cor: '#d7141f', cor2: '#ff3b3b', fonte: 'serifa' },
    chamada: ['', 'OFERTA'], corChamada: '#ffffff', fonteProduto: 'produto', coresProduto: ['#111111'],
    detalhe: 'oval', corDetalhe: '#111111', corPreco: '#d5121c', fundoPreco: null,
    centavosSublinhado: true, proporcoes: [0.15, 0.3],
  },
  acougue: {
    id: 'acougue', nome: 'Açougue', desc: 'Amarelo, preço com sombra',
    papel: '#ffe500', cabecalho: 'faixa', faixa: { cor: '#e3122b', fonte: 'larga' },
    chamada: ['', 'OFERTA'], corChamada: '#ffffff', fonteProduto: 'produto', coresProduto: ['#111111'],
    detalhe: 'acougue', corDetalhe: '#e3221b', corDetalhe2: '#111111', corPreco: '#e8321e', sombraPreco: '#1e0703',
    fundoPreco: null, centavosSublinhado: false, proporcoes: [0.15, 0.34],
  },
  pop: {
    id: 'pop', nome: 'Pop colorido', desc: 'Letras grandes e círculo de cor',
    papel: '#ffffff', cabecalho: 'tagline', chamada: ['', 'FRESQUINHO'], corChamada: '#1e5fd9',
    fonteProduto: 'chamada', coresProduto: ['#ff2d3d', '#1e5fd9'], detalhe: 'linha', corDetalhe: '#ff2d3d',
    fontePreco: 'chamada', corPreco: '#13244d', fundoPreco: 'circulo', corCirculo: '#ffe600',
    centavosSublinhado: false, proporcoes: [0.07, 0.36],
  },
}

export const templateCartaz = (id) => TEMPLATES_CARTAZ[id] || TEMPLATES_CARTAZ['mega-oferta']

// Todos os modelos da aba Cartazes: o Clássico (com selo e foto) e os de pincel.
export const MODELO_CLASSICO = { id: 'classico', nome: 'Clássico', desc: 'Selo da oferta e foto do produto' }
export const MODELOS_CARTAZ = [MODELO_CLASSICO, ...Object.values(TEMPLATES_CARTAZ)]
export { CAMADAS_CARTAZ, ajusteCartazDe } from './camadas'
export const ehClassico = (id) => !id || id === 'classico'

// Desenha o cartaz no modelo pedido (Clássico ou pincel).
export function CartazModelo({ produto, modelo, w, h, encarte, loja }) {
  if (ehClassico(modelo)) return <Cartaz produto={produto} encarte={encarte} w={w} h={h} />
  return <CartazPincel produto={produto} template={modelo} w={w} h={h} encarte={encarte} loja={loja} />
}

// Largura de um texto (em "ems" de 100 px), medida no canvas com a fonte real.
let ctx = null
const cacheLargura = new Map()
function largura(texto, fonte, peso = 400) {
  const chave = `${fonte}|${peso}|${texto}`
  if (cacheLargura.has(chave)) return cacheLargura.get(chave)
  let l = texto.length * 0.55
  if (typeof document !== 'undefined') {
    ctx = ctx || document.createElement('canvas').getContext('2d')
    ctx.font = `${peso} 100px ${fonte}`
    l = ctx.measureText(texto).width / 100
  }
  cacheLargura.set(chave, l)
  return l
}

// Quebra o texto em até `maxLinhas` linhas equilibradas e acha o maior tamanho que cabe em w × h.
function caber(texto, fonte, w, h, maxLinhas = 3, entrelinha = 1.02, peso = 400) {
  const palavras = String(texto || '').trim().split(/\s+/).filter(Boolean)
  if (!palavras.length || w <= 0 || h <= 0) return { linhas: [], tamanho: 0 }
  const espaco = largura(' ', fonte, peso)
  const larg = palavras.map((p) => largura(p, fonte, peso))
  const n = palavras.length
  const trecho = (a, b) => larg.slice(a, b).reduce((s, x) => s + x, 0) + espaco * (b - a - 1)
  let melhor = null
  for (let linhas = 1; linhas <= Math.min(maxLinhas, n); linhas += 1) {
    const memo = new Map()
    const dividir = (inicio, resto) => {
      const k = `${inicio}|${resto}`
      if (memo.has(k)) return memo.get(k)
      let r
      if (resto === 1) r = { max: trecho(inicio, n), cortes: [n] }
      else {
        r = { max: Infinity, cortes: [] }
        for (let c = inicio + 1; c <= n - resto + 1; c += 1) {
          const sub = dividir(c, resto - 1)
          const m = Math.max(trecho(inicio, c), sub.max)
          if (m < r.max) r = { max: m, cortes: [c, ...sub.cortes] }
        }
      }
      memo.set(k, r)
      return r
    }
    const d = dividir(0, linhas)
    const tamanho = Math.min(w / d.max, h / (linhas * entrelinha))
    if (!melhor || tamanho > melhor.tamanho * 1.04) {
      let ini = 0
      melhor = { tamanho, linhas: d.cortes.map((fim) => { const t = palavras.slice(ini, fim).join(' '); ini = fim; return t }) }
    }
  }
  return melhor
}

// Gerador pseudoaleatório fixo por produto: a pincelada sai igual na tela e no PDF.
function aleatorio(semente) {
  let t = 7
  for (const c of String(semente)) t = (t * 31 + c.charCodeAt(0)) >>> 0
  return () => { t = (t * 1664525 + 1013904223) >>> 0; return t / 4294967296 }
}

const CAMADA = { position: 'absolute', inset: 0, overflow: 'visible' }

function Pinceladas({ w, h, cores, semente, qtd = 5, angulo = -6, espessura = 0.2, opacidade = 0.92 }) {
  if (!cores?.length || w <= 0 || h <= 0) return null
  const rnd = aleatorio(semente)
  const riscos = []
  for (let i = 0; i < qtd; i += 1) {
    const e = h * espessura * (0.75 + rnd() * 0.5)
    const y = (h / (qtd + 0.4)) * (i + 0.7) + (rnd() - 0.5) * h * 0.06
    const x0 = w * (rnd() * 0.12)
    const x1 = w * (0.88 + rnd() * 0.12)
    const pts = []
    for (let j = 0; j <= 6; j += 1) pts.push([x0 + (rnd() - 0.5) * e * 0.5 - (j % 2) * e * 0.22, y - e / 2 + (e * j) / 6])
    for (let j = 6; j >= 0; j -= 1) pts.push([x1 + (rnd() - 0.5) * e * 0.6 + (j % 2) * e * 0.28, y - e / 2 + (e * j) / 6])
    riscos.push(
      <g key={i}>
        <polygon points={pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')} fill={cores[i % cores.length]} opacity={opacidade} />
        {[0.2, 0.45, 0.72].map((f, k) => (
          <line key={k} x1={x0 + e * 0.4} x2={x1 - e * (0.2 + rnd() * 0.6)} y1={y - e / 2 + e * f} y2={y - e / 2 + e * f}
            stroke="#fff" strokeOpacity={0.3} strokeWidth={Math.max(1, e * 0.045)} strokeLinecap="round" />
        ))}
      </g>,
    )
  }
  return (
    <svg width={w} height={h} style={CAMADA} aria-hidden="true">
      <g transform={`rotate(${angulo} ${w / 2} ${h / 2})`}>{riscos}</g>
    </svg>
  )
}

function Mancha({ w, h, semente, cor = '#111' }) {
  const rnd = aleatorio(semente)
  const pts = []
  for (let i = 0; i < 30; i += 1) {
    const a = (Math.PI * 2 * i) / 30
    const r = 0.84 + rnd() * 0.24
    pts.push([w / 2 + Math.cos(a) * (w / 2) * r, h / 2 + Math.sin(a) * (h / 2) * r])
  }
  const traco = h * 0.055
  return (
    <svg width={w} height={h} style={CAMADA} aria-hidden="true">
      <polygon points={pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')} fill={cor} transform={`rotate(-3 ${w / 2} ${h / 2})`} />
      {[[1.02, 0.12, 1.12, 0.04], [1.03, 0.3, 1.16, 0.3], [-0.03, 0.78, -0.12, 0.92], [-0.02, 0.62, -0.13, 0.66]].map(([a, b, c, d], i) => (
        <line key={i} x1={w * a} y1={h * b} x2={w * c} y2={h * d} stroke={cor} strokeWidth={traco} strokeLinecap="round" />
      ))}
    </svg>
  )
}

function partes(v) {
  const [reais, centavos] = Math.max(0, paraNumero(v) || 0).toFixed(2).split('.')
  return { reais: reais.replace(/\B(?=(\d{3})+(?!\d))/g, '.'), centavos }
}
const brl = (v) => (paraNumero(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const diaMes = (d) => (d ? d.split('-').reverse().slice(0, 2).join('/') : '')
const contorno = (cor, px) => [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].map(([x, y]) => `${(x * px).toFixed(1)}px ${(y * px).toFixed(1)}px 0 ${cor}`).join(',')
const unidade = (p) => String(p.unidade || 'UN').toUpperCase()

function Cabecalho({ t, chamada, w, h, semente }) {
  const [pequena, grande] = chamada
  if (t.cabecalho === 'faixa') {
    const fonte = FONTES[t.faixa?.fonte] || FONTES.larga
    const fit = caber(grande, fonte, w * 0.8, h * 0.56, 1, 1)
    const id = `g${semente.replace(/[^a-z0-9]/gi, '')}`
    return (
      <div style={{ position: 'relative', width: w, height: h }}>
        <svg width={w} height={h} style={CAMADA} aria-hidden="true">
          {t.faixa?.cor2 && (
            <defs>
              <radialGradient id={id} cx="50%" cy="38%" r="65%">
                <stop offset="0" stopColor={t.faixa.cor2} />
                <stop offset="1" stopColor={t.faixa.cor} />
              </radialGradient>
            </defs>
          )}
          <polygon points={`0,0 ${w},0 ${w},${h * 0.76} ${w / 2},${h} 0,${h * 0.76}`} fill={t.faixa?.cor2 ? `url(#${id})` : t.faixa?.cor} />
        </svg>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: h * 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fonte, fontSize: fit.tamanho, lineHeight: 1, color: t.corChamada, letterSpacing: '0.03em' }}>{grande}</div>
      </div>
    )
  }
  if (t.cabecalho === 'letreiro') {
    const fit = caber(grande, FONTES.produto, w * 0.94, h * 0.88, 1, 1)
    return <div style={{ width: w, height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONTES.produto, fontSize: fit.tamanho, lineHeight: 1, color: t.corChamada, transform: 'rotate(-1.5deg)' }}>{grande}</div>
  }
  if (t.cabecalho === 'tagline') {
    const fit = caber(grande, FONTES.chamada, w * 0.6, h * 0.9, 1, 1)
    return <div style={{ width: w, height: h, display: 'flex', alignItems: 'flex-end', paddingLeft: w * 0.04, fontFamily: FONTES.chamada, fontSize: fit.tamanho, lineHeight: 1, color: t.corChamada, letterSpacing: '0.04em' }}>{grande}</div>
  }
  if (t.cabecalho === 'black') {
    const f1 = caber(pequena, FONTES.chamada, w * 0.66, h * 0.22, 1, 1)
    const f2 = caber(grande, FONTES.chamada, w * 0.66, h * 0.62, 2, 0.9)
    const passo = Math.max(1, f2.tamanho * 0.035)
    return (
      <div style={{ position: 'relative', width: w, height: h }}>
        <div style={{ position: 'absolute', left: w * 0.12, top: h * 0.27, width: w * 0.76, height: h * 0.71 }}>
          <Mancha w={w * 0.76} h={h * 0.71} semente={`${semente}r`} />
        </div>
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: FONTES.chamada, lineHeight: 0.9, textAlign: 'center', transform: 'rotate(-3deg)' }}>
          <div style={{ fontSize: f1.tamanho, color: '#111', height: h * 0.27, display: 'flex', alignItems: 'flex-end', borderBottom: `${Math.max(1.5, f1.tamanho * 0.08)}px solid #111` }}>{pequena}</div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {f2.linhas.map((l, i) => (
              <div key={i} style={{ fontSize: f2.tamanho, color: t.corChamada, textShadow: `0 ${passo * 2.2}px 0 #ff9f1c, 0 ${passo * 4}px 0 ${t.corChamada2}` }}>{l}</div>
            ))}
          </div>
        </div>
      </div>
    )
  }
  // 'pincel'
  const f1 = caber(pequena, FONTES.chamada, w * 0.55, h * 0.26, 1, 1)
  const f2 = caber(grande, FONTES.chamada, w * 0.8, h * 0.62, 2, 0.92)
  const borda = Math.max(1.5, f2.tamanho * 0.06)
  return (
    <div style={{ position: 'relative', width: w, height: h }}>
      <div style={{ position: 'absolute', left: w * 0.14, top: h * 0.02, width: w * 0.74, height: h * 0.96 }}>
        <Pinceladas w={w * 0.74} h={h * 0.96} cores={t.riscosChamada} semente={`${semente}c`} qtd={7} angulo={-60} espessura={0.09} />
      </div>
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transform: 'rotate(-4deg)', fontFamily: FONTES.chamada, lineHeight: 0.92, textAlign: 'center' }}>
        {pequena && <div style={{ fontSize: f1.tamanho, color: '#111', textShadow: contorno('#fff', f1.tamanho * 0.04) }}>{pequena}</div>}
        {f2.linhas.map((l, i) => (
          <div key={i} style={{ fontSize: f2.tamanho, color: t.corChamada, textShadow: `${contorno('#111', borda)}, ${borda * 1.6}px ${borda * 1.8}px 0 #111` }}>{l}</div>
        ))}
      </div>
    </div>
  )
}

function LinhasProduto({ t, fit }) {
  const cores = t.coresProduto || ['#111']
  const fonte = FONTES[t.fonteProduto] || FONTES.produto
  return (
    <div style={{ fontFamily: fonte, fontSize: fit.tamanho, lineHeight: t.fonteProduto === 'chamada' ? 0.95 : 1.02, transform: 'rotate(-1.5deg)' }}>
      {fit.linhas.map((l, i) => <div key={i} style={{ color: cores[i % cores.length] }}>{l}</div>)}
    </div>
  )
}

function NomeProduto({ t, produto, w, h }) {
  const nome = String(produto.nome || '').toUpperCase()
  const fonte = FONTES[t.fonteProduto] || FONTES.produto
  const entre = t.fonteProduto === 'chamada' ? 0.95 : 1.02
  const caixa = { width: w, height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }
  const extra = [produto.marca, produto.gramagem].filter(Boolean).join(' ').toUpperCase()

  if (t.detalhe === 'lado' && extra) {
    const fit = caber(nome, fonte, w * 0.74, h, 2, entre)
    const palavras = extra.split(/\s+/)
    const maior = palavras.reduce((a, b) => (b.length > a.length ? b : a), '')
    const fd = caber(maior, FONTES.mao, w * 0.22, h * 0.3, 1, 1, 700)
    return (
      <div style={{ ...caixa, gap: w * 0.02 }}>
        <LinhasProduto t={t} fit={fit} />
        <div style={{ fontFamily: FONTES.mao, fontWeight: 700, fontSize: Math.min(fd.tamanho, fit.tamanho * 0.36), lineHeight: 1.05, color: t.corDetalhe, textAlign: 'left', transform: 'rotate(-4deg)' }}>
          {palavras.map((p, i) => <div key={i}>{p}</div>)}
        </div>
      </div>
    )
  }
  if (t.detalhe === 'oval' && produto.gramagem) {
    const fit = caber(nome, fonte, w * 0.74, h * 0.96, 3, entre)
    const g = String(produto.gramagem).toUpperCase()
    const fg = caber(g, FONTES.mao, w * 0.2, h * 0.2, 1, 1, 700)
    const tam = Math.min(fg.tamanho, fit.tamanho * 0.5)
    return (
      <div style={caixa}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: w * 0.015 }}>
          <LinhasProduto t={t} fit={fit} />
          <div style={{ fontFamily: FONTES.mao, fontWeight: 700, fontSize: tam, color: t.corDetalhe, whiteSpace: 'nowrap', border: `${Math.max(1.5, tam * 0.08)}px solid ${t.corDetalhe}`, borderRadius: '50%', padding: `${tam * 0.15}px ${tam * 0.45}px`, marginBottom: fit.tamanho * 0.08, transform: 'rotate(-5deg)' }}>{g}</div>
        </div>
      </div>
    )
  }
  if (t.detalhe === 'unidade') {
    const u = unidade(produto)
    const marca = u !== 'UN' ? u : String(produto.gramagem || '').toUpperCase()
    const fit = caber(nome, fonte, w * 0.94, marca ? h * 0.74 : h, 3, entre)
    const tam = Math.min(fit.tamanho * 0.6, h * 0.2)
    const traco = <span style={{ width: w * 0.3, borderTop: `${Math.max(2, tam * 0.12)}px solid ${t.corDetalhe}` }} />
    return (
      <div style={{ ...caixa, flexDirection: 'column' }}>
        <LinhasProduto t={t} fit={fit} />
        {marca && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4em', fontFamily: FONTES.produto, fontSize: tam, color: t.corDetalhe, marginTop: h * 0.02 }}>
            {traco}{marca}{traco}
          </div>
        )}
      </div>
    )
  }
  if (t.detalhe === 'acougue') {
    const marca = String(produto.marca || '').toUpperCase()
    const g = String(produto.gramagem || '').toUpperCase()
    const fit = caber(nome, fonte, w * 0.94, h * (marca ? 0.62 : g ? 0.8 : 1), 3, entre)
    const fm = caber(marca, FONTES.produto, w * 0.94, h * 0.2, 1, 1)
    const fg = caber(g, FONTES.mao, w * 0.5, h * 0.13, 1, 1, 700)
    return (
      <div style={{ ...caixa, flexDirection: 'column' }}>
        <LinhasProduto t={t} fit={fit} />
        {marca && <div style={{ fontFamily: FONTES.produto, fontSize: Math.min(fm.tamanho, fit.tamanho * 0.62), color: t.corDetalhe, lineHeight: 1.05 }}>{marca}</div>}
        {g && <div style={{ fontFamily: FONTES.mao, fontWeight: 700, fontSize: Math.min(fg.tamanho, fit.tamanho * 0.36), color: t.corDetalhe2, lineHeight: 1.1, letterSpacing: '0.08em' }}>{g}</div>}
      </div>
    )
  }
  const fit = caber(nome, fonte, w * 0.96, extra ? h * 0.8 : h, 3, entre)
  const fe = caber(extra, FONTES.mao, w * 0.8, h * 0.16, 1, 1, 700)
  return (
    <div style={{ ...caixa, flexDirection: 'column' }}>
      <LinhasProduto t={t} fit={fit} />
      {extra && <div style={{ fontFamily: FONTES.mao, fontWeight: 700, fontSize: Math.min(fe.tamanho, fit.tamanho * 0.4), color: t.corDetalhe, transform: 'rotate(-3deg)' }}>{extra}</div>}
    </div>
  )
}

function Preco({ t, produto, w, h, semente }) {
  const valor = produto.precoJornal ?? produto.precoPromo ?? produto.precoNormal
  const { reais, centavos } = partes(valor)
  const temDe = (paraNumero(produto.precoNormal) || 0) > (paraNumero(valor) || 0) + 0.009
  const u = unidade(produto)
  const rotulo = t.rotulo === 'nenhum' ? null : u !== 'UN' ? u : 'À VISTA'
  const fonte = FONTES[t.fontePreco] || FONTES.preco
  const hDe = temDe ? h * 0.12 : 0
  const resto = h - hDe
  const lr = largura(reais, fonte)
  const lc = Math.max(largura(centavos, fonte), 0.9) * 0.46
  const virgula = 0.14
  const alt = fonte === FONTES.preco ? 1.18 : 1.12
  const s = Math.max(4, Math.min((resto * 0.8) / alt, (w * 0.9) / (lr + virgula + lc)))
  const sombra = t.sombraPreco ? [1, 2, 3, 4, 5].map((k) => `${(s * 0.012 * k).toFixed(1)}px ${(s * 0.011 * k).toFixed(1)}px 0 ${t.sombraPreco}`).join(',') : 'none'
  const traco = Math.max(1.5, s * 0.045)
  return (
    <div style={{ position: 'relative', width: w, height: h }}>
      {t.fundoPreco === 'riscos' && (
        <div style={{ position: 'absolute', left: 0, top: h * 0.06, width: w, height: h * 0.9 }}>
          <Pinceladas w={w} h={h * 0.9} cores={t.riscosPreco} semente={`${semente}p`} qtd={6} angulo={-3} espessura={0.15} />
        </div>
      )}
      {t.fundoPreco === 'octogono' && (() => {
        const x = w * 0.05, y = h * 0.03, cw = w * 0.9, ch = h * 0.94, c = Math.min(cw, ch) * 0.15
        return (
          <>
            <svg width={w} height={h} style={CAMADA} aria-hidden="true">
              <polygon points={`${x + c},${y} ${x + cw - c},${y} ${x + cw},${y + c} ${x + cw},${y + ch - c} ${x + cw - c},${y + ch} ${x + c},${y + ch} ${x},${y + ch - c} ${x},${y + c}`} fill="#ffffff" stroke="#cfcabd" strokeWidth={Math.max(1, w * 0.004)} />
            </svg>
            <div style={{ position: 'absolute', left: w * 0.12, top: h * 0.14, width: w * 0.76, height: h * 0.72 }}>
              <Pinceladas w={w * 0.76} h={h * 0.72} cores={t.riscosPreco} semente={`${semente}o`} qtd={4} angulo={-16} espessura={0.16} />
            </div>
          </>
        )
      })()}
      {t.fundoPreco === 'circulo' && (
        <div style={{ position: 'absolute', left: '46%', top: '52%', width: Math.min(w * 0.9, h * 1.05), height: Math.min(w * 0.9, h * 1.05), borderRadius: '50%', background: t.corCirculo, transform: 'translate(-50%,-50%)' }} />
      )}
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {temDe && (
          <div style={{ fontFamily: FONTES.mao, fontWeight: 700, fontSize: hDe * 0.7, color: '#222', lineHeight: 1, height: hDe }}>
            De <span style={{ textDecoration: 'line-through' }}>{brl(produto.precoNormal)}</span> por
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-start', fontFamily: fonte, color: t.corPreco, lineHeight: 1, textShadow: sombra, transform: 'skewX(-6deg)' }}>
          <span style={{ fontSize: s, letterSpacing: '-0.01em' }}>{reais}</span>
          <span style={{ fontSize: s * 0.5, alignSelf: 'flex-end', marginLeft: -s * 0.015, marginBottom: -s * 0.07, width: s * virgula, lineHeight: 0.8 }}>,</span>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: s * 0.05 }}>
            <span style={{ fontSize: s * 0.46, lineHeight: 1 }}>{centavos}</span>
            {t.centavosSublinhado && (
              <span style={{ width: '120%', height: traco * 1.6, background: t.corPreco, marginTop: s * 0.04, borderRadius: traco, boxShadow: sombra === 'none' ? 'none' : `${s * 0.03}px ${s * 0.03}px 0 ${t.sombraPreco}` }} />
            )}
            {rotulo && (
              <span style={{
                fontFamily: FONTES.mao, fontWeight: 700, fontSize: s * 0.13, color: '#111', textShadow: 'none', marginTop: s * 0.05, whiteSpace: 'nowrap', lineHeight: 1.2,
                ...(u !== 'UN' ? { border: `${Math.max(1, s * 0.012)}px solid #111`, borderRadius: '50%', padding: `${s * 0.01}px ${s * 0.07}px` } : { borderBottom: `${Math.max(1, s * 0.01)}px solid #111` }),
              }}>{rotulo}</span>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}

function Rodape({ loja, encarte, w, h }) {
  const fs = Math.max(6, h * 0.42)
  return (
    <div style={{ width: w, height: h, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: fs, color: '#333', textTransform: 'uppercase', lineHeight: 1.1 }}>
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{loja?.nome || ''}</span>
      {encarte?.periodoDe && (
        <span style={{ textAlign: 'right', fontSize: fs * 0.82 }}>Válido de {diaMes(encarte.periodoDe)} a {diaMes(encarte.periodoAte)} · ou enquanto durarem os estoques</span>
      )}
    </div>
  )
}

// Um cartaz. `produto.chamada` troca a palavra grande (OFERTA, QUENTINHO…).
export function CartazPincel({ produto, template = 'mega-oferta', w, h, encarte, loja }) {
  const t = typeof template === 'string' ? templateCartaz(template) : template
  const semente = `${t.id}-${produto.id || produto.nome}`
  const chamada = produto.chamada ? [t.chamada[0], String(produto.chamada).toUpperCase()] : t.chamada
  const moldura = t.moldura ? Math.min(w, h) * 0.035 : 0
  const pad = Math.min(w, h) * 0.045
  const iw = w - moldura * 2
  const ih = h - moldura * 2
  const cw = iw - pad * 2
  const ch = ih - pad * 2
  const hRodape = Math.max(9, Math.min(w, h) * 0.032)
  const faixa = t.cabecalho === 'faixa'
  const deitado = w > h * 1.1
  const [pTopo, pNome] = t.proporcoes || [0.24, 0.25]
  let corpo
  if (deitado) {
    const hFaixa = faixa ? ih * 0.2 : 0
    const topo = faixa ? hFaixa - pad * 0.6 : 0
    const alt = ch - hRodape - topo
    const esq = cw * 0.44
    const dir = cw - esq
    const fracCab = faixa ? 0 : t.cabecalho === 'tagline' ? 0.12 : 0.46
    corpo = (
      <>
        <div style={{ position: 'absolute', left: 0, top: topo, width: esq, height: alt, display: 'flex', flexDirection: 'column' }}>
          {!faixa && <CamadaCartaz nome="topo" produto={produto} w={w} h={h}><Cabecalho t={t} chamada={chamada} w={esq} h={alt * fracCab} semente={semente} /></CamadaCartaz>}
          <CamadaCartaz nome="nome" produto={produto} w={w} h={h}><NomeProduto t={t} produto={produto} w={esq} h={alt * (1 - fracCab)} /></CamadaCartaz>
        </div>
        <div style={{ position: 'absolute', left: esq, top: topo, width: dir, height: alt }}>
          <CamadaCartaz nome="preco" produto={produto} w={w} h={h}><Preco t={t} produto={produto} w={dir} h={alt} semente={semente} /></CamadaCartaz>
        </div>
      </>
    )
  } else {
    const hTopo = ch * pTopo
    const hNome = ch * pNome
    corpo = (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {faixa ? <div style={{ height: hTopo }} /> : <CamadaCartaz nome="topo" produto={produto} w={w} h={h}><Cabecalho t={t} chamada={chamada} w={cw} h={hTopo} semente={semente} /></CamadaCartaz>}
        <CamadaCartaz nome="nome" produto={produto} w={w} h={h}><NomeProduto t={t} produto={produto} w={cw} h={hNome} /></CamadaCartaz>
        <CamadaCartaz nome="preco" produto={produto} w={w} h={h}><Preco t={t} produto={produto} w={cw} h={ch - hTopo - hNome - hRodape} semente={semente} /></CamadaCartaz>
      </div>
    )
  }
  return (
    <div style={{ position: 'relative', width: w, height: h, overflow: 'hidden', background: t.moldura || t.papel }}>
      <div style={{ position: 'absolute', inset: moldura, background: t.papel, overflow: 'hidden' }}>
        {faixa && (
          <CamadaCartaz nome="topo" produto={produto} w={w} h={h} style={{ position: 'absolute', left: 0, top: 0 }}>
            <Cabecalho t={t} chamada={chamada} w={iw} h={deitado ? ih * 0.2 : pad + ch * pTopo - pad * 0.2} semente={semente} />
          </CamadaCartaz>
        )}
        <div style={{ position: 'absolute', left: pad, top: pad, width: cw, height: ch }}>
          {corpo}
          <div style={{ position: 'absolute', left: 0, bottom: 0 }}>
            <Rodape loja={loja} encarte={encarte} w={cw} h={hRodape} />
          </div>
        </div>
      </div>
    </div>
  )
}

// Folha com os cartazes e linha pontilhada de corte. Cada item pode trazer o próprio modelo
// (`modeloCartaz`); sem ele, vale o `template` da folha. `onAbrir` deixa tocar no cartaz da prévia.
export const FolhaCartazesPincel = forwardRef(function FolhaCartazesPincel({ itens, tamanho = 'A4', orientacao = 'retrato', template = 'mega-oferta', encarte, loja, onAbrir }, ref) {
  const imp = useMemo(() => imposicao(tamanho, orientacao), [tamanho, orientacao])
  const { folha, cols, margem, cartaz } = imp
  const borda = imp.porFolha > 1 ? 2 : 0
  // tamanho do selinho "Editar" da prévia (a folha aparece reduzida na tela)
  // canto de baixo, sobre o rodapé, para não cobrir o selo nem o preço
  const chip = Math.min(Math.max(16, folha.largura * 0.028), cartaz.largura * 0.065)
  return (
    <div ref={ref} className="arte-fixa" style={{ position: 'relative', width: folha.largura, height: folha.altura, background: '#fff' }}>
      {itens.map((p, i) => {
        const estilo = {
          position: 'absolute', left: margem + (i % cols) * cartaz.largura, top: margem + Math.floor(i / cols) * cartaz.altura,
          width: cartaz.largura, height: cartaz.altura,
          // linha de corte como borda: o contorno CSS não sai no PNG/PDF
          border: imp.porFolha > 1 ? '1px dashed #9a9a9a' : 'none', boxSizing: 'border-box',
        }
        const conteudo = <CartazModelo produto={p} modelo={p.modeloCartaz || template} w={cartaz.largura - borda} h={cartaz.altura - borda} encarte={encarte} loja={loja} />
        return onAbrir ? (
          <button key={p.id || i} type="button" onClick={() => onAbrir(p)} aria-label={`Editar cartaz: ${p.nome}`} className="group" style={{ ...estilo, padding: 0, cursor: 'pointer', textAlign: 'left', background: 'none' }}>
            {conteudo}
            <span className="opacity-90 group-hover:opacity-100" style={{ position: 'absolute', bottom: chip * 0.4, right: chip * 0.4, display: 'flex', alignItems: 'center', gap: chip * 0.3, padding: `${chip * 0.3}px ${chip * 0.6}px`, borderRadius: chip * 0.4, background: '#082b4f', color: '#fff', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: chip, lineHeight: 1, boxShadow: '0 2px 8px rgba(0,0,0,.25)' }}>
              <svg width={chip} height={chip} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
              Editar
            </span>
          </button>
        ) : <div key={p.id || i} style={estilo}>{conteudo}</div>
      })}
    </div>
  )
})
