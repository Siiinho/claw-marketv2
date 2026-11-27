import { useLayoutEffect, useRef } from 'react'
import { QrCode } from './cartazes/QrJornal'
import { linkWhatsapp, ehBengala } from '../lib/marca'
import logoBengala from '../assets/logo-bengala-transparente.png'

// Rodapé no modelo do jornal impresso do Bengala (o já validado), montado com o cadastro do mercado.
// Desenhado numa prancheta de 2000×356 e escalado para a altura pedida, como a imagem oficial.
export const RODAPE_W = 2000
export const RODAPE_H = 356

const base = import.meta.env.BASE_URL
export const LOGO_PAGAMENTO = {
  Visa: 'visa', Mastercard: 'mastercard', Elo: 'elo', Hipercard: 'hipercard', 'American Express': 'amex', Cabal: 'cabal', Sorocred: 'sorocred', 'Mais!': 'mais',
  Alelo: 'alelo', Ben: 'ben', 'Good Card': 'good', Ticket: 'ticket', Up: 'up', VR: 'vr', 'Pluxee (Sodexo)': 'sodexo', VeroCard: 'verocard',
}
const srcPagamento = (nome) => (LOGO_PAGAMENTO[nome] ? `${base}templates/pagamentos/${LOGO_PAGAMENTO[nome]}.webp` : null)

export const TEXTOS_PADRAO = {
  avisoLimite: 'Nos reservamos o direito de limitar a 3 unidades/kg de cada produto por cliente.',
  avisoValidade: 'Ofertas válidas enquanto durarem os estoques dos dias',
  whatsSubtitulo: 'Ofertas e jornais direto para você!',
  legal: 'Não jogue este impresso em via pública. Mantenha a cidade limpa. Reservamo-nos o direito de corrigir ou não comercializar produtos publicados com erro gráfico. Fotos fora de escala e meramente ilustrativas. Não vendemos por atacado. Verifique no balcão a quantidade limite de produtos disponíveis anunciados por compra. Não vendemos bebidas alcoólicas para menores de 18 anos.',
}

const VERMELHO = '#e3141b'
const AZUL = '#1d4fa3'
const NARROW = '"Archivo Narrow", "Arial Narrow", Arial, sans-serif'

// Uma linha que nunca quebra: se o texto for maior que o espaço, ela é condensada (como no impresso).
function Linha({ children, style, className = '' }) {
  const caixa = useRef(null)
  const texto = useRef(null)
  useLayoutEffect(() => {
    const c = caixa.current
    const t = texto.current
    if (!c || !t) return
    t.style.transform = ''
    const k = Math.min(1, c.clientWidth / Math.max(1, t.scrollWidth))
    t.style.transform = k < 1 ? `scaleX(${k})` : ''
  })
  return (
    <div ref={caixa} className={`overflow-hidden whitespace-nowrap ${className}`} style={style}>
      <span ref={texto} style={{ display: 'inline-block', transformOrigin: 'left center' }}>{children}</span>
    </div>
  )
}

function Loja({ l, nomeMercado, style }) {
  const titulo = [l.nome || nomeMercado, l.endereco, l.cidade].filter(Boolean).join(' - ')
  return (
    <div style={{ position: 'absolute', border: '2px dashed #555', borderRadius: 10, padding: '4px 8px', boxSizing: 'border-box', overflow: 'hidden', fontFamily: NARROW, color: '#222', lineHeight: 1.1, background: '#fff', ...style }}>
      <Linha style={{ fontSize: 20, fontWeight: 700 }}>{titulo}</Linha>
      <Linha style={{ fontSize: 18 }}>
        {l.telefone && <>Tel.: {l.telefone}</>}
        {l.estacionamento && <span style={{ color: VERMELHO, fontWeight: 700 }}>{l.telefone ? ' – ' : ''}Estacionamento no local</span>}
      </Linha>
      {l.whatsapp && <Linha style={{ fontSize: 23, fontWeight: 700, background: '#fff200', margin: '2px -4px', padding: '0 4px' }}>WhatsApp de ofertas: {l.whatsapp}</Linha>}
      {(l.horario || l.horario2) && <Linha style={{ fontSize: 21, fontWeight: 700, color: AZUL }}>Horário de Atendimento</Linha>}
      {l.horario && <Linha style={{ fontSize: 18 }}>{l.horario}</Linha>}
      {l.horario2 && <Linha style={{ fontSize: 18 }}>{l.horario2}</Linha>}
    </div>
  )
}

function LogoMercado({ marca, style }) {
  const src = marca?.logo || (ehBengala(marca) ? logoBengala : null)
  return (
    <div style={{ position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}>
      {src
        ? <img src={src} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        : <span style={{ fontFamily: NARROW, fontWeight: 900, fontSize: 34, color: VERMELHO, textAlign: 'center', lineHeight: 1, textTransform: 'uppercase' }}>{marca?.nome}</span>}
    </div>
  )
}

// Onde cada loja fica, conforme quantas são (até 3, como no impresso).
const POSICOES = {
  1: [{ left: 790, top: 120, width: 440, height: 150 }],
  2: [{ left: 705, top: 66, width: 298, height: 140 }, { left: 1010, top: 66, width: 298, height: 140 }],
  3: [{ left: 705, top: 66, width: 298, height: 140 }, { left: 1010, top: 66, width: 298, height: 140 }, { left: 858, top: 212, width: 298, height: 134 }],
}
const LOGOS_LOJAS = {
  1: [{ left: 705, top: 110, width: 80, height: 170 }, { left: 1235, top: 110, width: 80, height: 170 }],
  2: [{ left: 790, top: 214, width: 440, height: 130 }],
  3: [{ left: 705, top: 214, width: 148, height: 130 }, { left: 1162, top: 214, width: 148, height: 130 }],
}

function CaixaPagamentos({ nomes, style }) {
  const logos = nomes.filter(srcPagamento)
  const texto = nomes.filter((n) => !srcPagamento(n))
  return (
    <div style={{ position: 'absolute', border: '2px solid #bbb', borderRadius: 10, padding: 6, display: 'flex', flexWrap: 'wrap', alignContent: 'center', justifyContent: 'center', gap: 6, ...style }}>
      {logos.map((n) => <img key={n} src={srcPagamento(n)} alt={n} title={n} style={{ height: 50, width: 'auto', maxWidth: 128, objectFit: 'contain' }} />)}
      {texto.map((n) => <span key={n} style={{ height: 50, display: 'inline-flex', alignItems: 'center', padding: '0 12px', borderRadius: 8, background: n === 'Pix' ? '#32bcad' : '#2f7d32', color: '#fff', fontFamily: NARROW, fontSize: 28, fontWeight: 800 }}>{n}</span>)}
    </div>
  )
}

export function RodapeModeloCorpo({ marca }) {
  const t = { ...TEXTOS_PADRAO, ...Object.fromEntries(Object.entries(marca || {}).filter(([, v]) => v)) }
  const lojas = (marca?.lojas || []).filter((l) => l.nome || l.endereco).slice(0, 3)
  const n = Math.max(1, lojas.length)
  const linkRedes = marca?.redesLink || (marca?.instagram ? `https://instagram.com/${String(marca.instagram).replace(/^@/, '')}` : null)
  const linkWhats = marca?.whatsLink || linkWhatsapp(marca?.whatsappOfertas)
  const nomeCurto = (marca?.nome || '').replace(/\s*supermercados?\s*/i, ' ').trim().toUpperCase()
  const credito = [...(marca?.pagamentos?.credito || []), ...(marca?.pagamentos?.outros || [])]
  const vales = marca?.pagamentos?.alimentacao || []
  const pagW = vales.length && credito.length ? 290 : 590

  return (
    <div style={{ position: 'relative', width: RODAPE_W, height: RODAPE_H, background: '#fff', overflow: 'hidden', fontFamily: NARROW, borderTop: `7px solid ${VERMELHO}`, borderBottom: `7px solid ${VERMELHO}`, boxSizing: 'border-box' }}>
      {/* redes sociais */}
      <div style={{ position: 'absolute', left: 50, top: 14, width: 248, textAlign: 'center', fontSize: 40, fontWeight: 800, lineHeight: 1, color: '#2b2b2b' }}>Nos siga nas<br />redes sociais:</div>
      <div style={{ position: 'absolute', left: 58, top: 100, width: 232, height: 232, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {linkRedes
          ? <><QrCode texto={linkRedes} tamanho={226} /><LogoMercado marca={marca} style={{ left: 86, top: 86, width: 60, height: 60, background: '#fff', borderRadius: 8, padding: 3 }} /></>
          : <LogoMercado marca={marca} style={{ inset: 0 }} />}
      </div>

      {/* faixa cinza de aviso */}
      <div style={{ position: 'absolute', left: 297, top: 18, width: 1015, height: 38, borderRadius: 19, background: '#dcdcdc', padding: '0 24px' }}>
        <Linha style={{ fontSize: 29, fontWeight: 800, lineHeight: '38px', color: '#333', textAlign: 'center' }}>{t.avisoLimite}</Linha>
      </div>

      {/* WhatsApp de ofertas */}
      <div style={{ position: 'absolute', left: 303, top: 66, width: 394, height: 276, overflow: 'hidden', background: 'linear-gradient(135deg, #0b5d36 0%, #167a45 45%, #9fd36a 100%)' }}>
        <Linha style={{ position: 'absolute', left: 8, top: 6, width: 378, fontSize: 52, fontWeight: 900, fontStyle: 'italic', color: VERMELHO, WebkitTextStroke: '2px #fff', paintOrder: 'stroke', lineHeight: 1, textTransform: 'uppercase' }}>{t.whatsTitulo || `WhatsApp ${nomeCurto}`}</Linha>
        <div style={{ position: 'absolute', left: 0, top: 60, width: 394, height: 30, background: '#0d3b25' }}>
          <Linha style={{ padding: '0 10px', fontSize: 22, fontWeight: 800, fontStyle: 'italic', color: '#fff', lineHeight: '30px', textTransform: 'uppercase', textAlign: 'center' }}>{t.whatsSubtitulo}</Linha>
        </div>
        {ehBengala(marca) || marca?.whatsFoto
          ? <img src={marca?.whatsFoto || `${base}templates/pagamentos/pessoa.webp`} alt="" style={{ position: 'absolute', left: 0, bottom: 0, height: 186, width: 'auto' }} />
          : <div style={{ position: 'absolute', left: 22, bottom: 24, width: 150, textAlign: 'center', color: '#fff', fontSize: 30, fontWeight: 900, lineHeight: 1.05, textTransform: 'uppercase' }}>Aponte a câmera e receba as ofertas</div>}
        {linkWhats && (
          <div style={{ position: 'absolute', left: 188, top: 96, width: 196, height: 172, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <QrCode texto={linkWhats} tamanho={164} />
          </div>
        )}
      </div>

      {/* lojas */}
      {lojas.map((l, i) => <Loja key={`${l.nome}-${i}`} l={l} nomeMercado={marca?.nome} style={POSICOES[n][i]} />)}
      {LOGOS_LOJAS[n].map((p, i) => <LogoMercado key={i} marca={marca} style={p} />)}

      {/* divisória */}
      <div style={{ position: 'absolute', left: 1320, top: 66, width: 3, height: 276, background: VERMELHO }} />

      {/* faixa amarela */}
      <div style={{ position: 'absolute', left: 1335, top: 18, width: 595, height: 38, borderRadius: 19, background: '#fff200', padding: '0 20px' }}>
        <Linha style={{ fontSize: 29, fontWeight: 800, lineHeight: '38px', color: '#222', textAlign: 'center' }}>{t.avisoValidade}</Linha>
      </div>

      {/* pagamentos */}
      {credito.length > 0 && (
        <>
          <div style={{ position: 'absolute', left: 1335, top: 60, width: pagW, textAlign: 'center', color: VERMELHO, fontSize: 36, fontWeight: 800, lineHeight: 1 }}>
            <Linha>Aceitamos cartões</Linha><Linha>de crédito e débito</Linha>
          </div>
          <CaixaPagamentos nomes={credito} style={{ left: 1335, top: 134, width: pagW, height: 166 }} />
        </>
      )}
      {vales.length > 0 && (
        <>
          <div style={{ position: 'absolute', left: credito.length ? 1630 : 1335, top: 60, width: pagW, textAlign: 'center', color: VERMELHO, fontSize: 36, fontWeight: 800, lineHeight: 1 }}>
            <Linha>Aceitamos cartões</Linha><Linha>alimentação e refeição</Linha>
          </div>
          <CaixaPagamentos nomes={vales} style={{ left: credito.length ? 1630 : 1335, top: 134, width: pagW, height: 166 }} />
        </>
      )}

      {/* texto legal */}
      <div style={{ position: 'absolute', left: 1335, top: 304, width: 590, height: 40, overflow: 'hidden', fontSize: 11.5, lineHeight: 1.15, color: '#333', textAlign: 'justify', fontFamily: 'Arial, sans-serif' }}>{t.legal}</div>
    </div>
  )
}

// Escala a prancheta para a altura pedida (centralizada, como a imagem oficial).
export default function RodapeModelo({ marca, altura }) {
  const k = altura / RODAPE_H
  return (
    <div className="absolute inset-x-0 bottom-0 flex justify-center overflow-hidden bg-white" style={{ height: altura, zIndex: 1 }}>
      <div style={{ width: RODAPE_W * k, height: altura, flexShrink: 0 }}>
        <div style={{ transform: `scale(${k})`, transformOrigin: 'top left' }}>
          <RodapeModeloCorpo marca={marca} />
        </div>
      </div>
    </div>
  )
}
