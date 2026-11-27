import QRCode from 'qrcode'

// QR code do jornal de ofertas online, o mesmo link da tag NFC. Sai no rodapé dos cartazes,
// ao lado da logo, para o cliente apontar a câmera na gôndola e abrir o jornal no celular.
import { caminhoDoMercado, mercadoAtual, MERCADO_PADRAO } from '../../lib/nuvem'

const LINK_BENGALA = import.meta.env.VITE_LINK_ENCARTE || 'https://claw-marketv2.vercel.app/#/encarte'
// Bengala: o link de sempre (está nas tags e cartazes impressos); outro mercado: o endereço dele.
export const linkJornal = () => (mercadoAtual() === MERCADO_PADRAO ? LINK_BENGALA : `https://claw-marketv2.vercel.app/${caminhoDoMercado('encarte')}`)
export const LINK_JORNAL = LINK_BENGALA

const cache = new Map()
function modulos(texto) {
  if (!cache.has(texto)) {
    const qr = QRCode.create(texto, { errorCorrectionLevel: 'M' })
    const n = qr.modules.size
    const borda = 2
    let d = ''
    for (let y = 0; y < n; y += 1) {
      for (let x = 0; x < n; x += 1) if (qr.modules.data[y * n + x]) d += `M${x + borda} ${y + borda}h1v1h-1z`
    }
    cache.set(texto, { total: n + borda * 2, d })
  }
  return cache.get(texto)
}

// Desenhado em SVG (vetor): sai nítido no PNG e no PDF em qualquer tamanho de cartaz.
export function QrCode({ texto, tamanho, cor = '#111111', fundo = '#ffffff' }) {
  const { total, d } = modulos(texto || linkJornal())
  return (
    <svg width={tamanho} height={tamanho} viewBox={`0 0 ${total} ${total}`} shapeRendering="crispEdges" style={{ display: 'block', flexShrink: 0 }} aria-label="QR code do jornal de ofertas">
      <rect width={total} height={total} fill={fundo} />
      <path d={d} fill={cor} />
    </svg>
  )
}

// QR + chamada curta. `altura` é o lado do QR; o texto acompanha.
export function SeloQrJornal({ altura, cor = '#111111' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: altura * 0.14, minWidth: 0 }}>
      <QrCode tamanho={altura} />
      <div style={{ fontFamily: 'Arial, sans-serif', fontWeight: 800, textTransform: 'uppercase', lineHeight: 1.05, color: cor, textAlign: 'left' }}>
        <div style={{ fontSize: altura * 0.15 }}>Aponte a câmera</div>
        <div style={{ fontSize: altura * 0.21 }}>Jornal de</div>
        <div style={{ fontSize: altura * 0.21 }}>ofertas online</div>
      </div>
    </div>
  )
}
