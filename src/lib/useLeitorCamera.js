// Leitura de código de barras pela câmera do celular, usada nos dois scanners.
//
// O que corrigiu a leitura no celular:
//  - a câmera só liga depois que o <video> aparece na tela (antes ela ligava num vídeo que
//    ainda não existia e nada era lido);
//  - usa o leitor nativo do aparelho (BarcodeDetector, no Chrome do Android) quando existe,
//    e o ZXing com "tentar mais" e só os formatos de mercado (EAN-13, EAN-8, UPC, Code 128);
//  - pede resolução alta e foco contínuo, que é o que faz o EAN pequeno ser lido;
//  - avisa quando a página não é https (o navegador bloqueia a câmera em http://IP).
import { useCallback, useEffect, useRef, useState } from 'react'

const FORMATOS_NATIVOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'itf']

export function motivoSemCamera() {
  if (typeof window === 'undefined') return 'Câmera indisponível.'
  if (!window.isSecureContext) {
    return 'O navegador só libera a câmera em endereço seguro (https). Abra pelo link https do sistema ou digite o código.'
  }
  if (!navigator.mediaDevices?.getUserMedia) return 'Este navegador não dá acesso à câmera. Digite o código.'
  return null
}

async function abrirStream() {
  const pedidos = [
    { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } },
    { audio: false, video: { facingMode: { ideal: 'environment' } } },
    { audio: false, video: true },
  ]
  let ultimoErro
  for (const pedido of pedidos) {
    try { return await navigator.mediaDevices.getUserMedia(pedido) } catch (erro) {
      ultimoErro = erro
      if (erro?.name === 'NotAllowedError' || erro?.name === 'SecurityError') break
    }
  }
  throw ultimoErro
}

async function focoContinuo(stream) {
  const trilha = stream.getVideoTracks()[0]
  const pode = trilha?.getCapabilities?.() || {}
  const avancado = []
  if (pode.focusMode?.includes?.('continuous')) avancado.push({ focusMode: 'continuous' })
  if (pode.exposureMode?.includes?.('continuous')) avancado.push({ exposureMode: 'continuous' })
  if (avancado.length) await trilha.applyConstraints({ advanced: avancado }).catch(() => {})
}

async function leitorNativo() {
  if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return null
  try {
    const suportados = await window.BarcodeDetector.getSupportedFormats()
    const formatos = FORMATOS_NATIVOS.filter((f) => suportados.includes(f))
    return formatos.length ? new window.BarcodeDetector({ formats: formatos }) : null
  } catch (_) {
    return null
  }
}

async function leitorZxing() {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import('@zxing/browser'),
    import('@zxing/library'),
  ])
  const dicas = new Map()
  dicas.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128, BarcodeFormat.ITF,
  ])
  dicas.set(DecodeHintType.TRY_HARDER, true)
  return new BrowserMultiFormatReader(dicas, { delayBetweenScanAttempts: 120 })
}

// aoLer(codigo) é chamado uma vez por leitura; a câmera desliga sozinha depois.
export function useLeitorCamera(aoLer, aoErro) {
  const videoRef = useRef(null)
  const [ativo, setAtivo] = useState(false)
  const pararRef = useRef(null)
  const aoLerRef = useRef(aoLer)
  const aoErroRef = useRef(aoErro)
  aoLerRef.current = aoLer
  aoErroRef.current = aoErro

  const parar = useCallback(() => {
    try { pararRef.current?.() } catch (_) {}
    pararRef.current = null
    setAtivo(false)
  }, [])

  const abrir = useCallback(() => {
    const motivo = motivoSemCamera()
    if (motivo) { aoErroRef.current?.(motivo); return }
    setAtivo(true)
  }, [])

  // Liga a câmera só quando o <video> já está na tela.
  useEffect(() => {
    if (!ativo) return undefined
    let cancelado = false
    let stream
    let temporizador
    let controlesZxing
    const encerrar = () => {
      cancelado = true
      clearTimeout(temporizador)
      try { controlesZxing?.stop() } catch (_) {}
      stream?.getTracks().forEach((t) => t.stop())
    }
    pararRef.current = encerrar
    const lido = (texto) => {
      const codigo = String(texto || '').replace(/\D/g, '')
      if (!codigo || cancelado) return
      encerrar()
      setAtivo(false)
      navigator.vibrate?.(80)
      aoLerRef.current?.(codigo)
    }
    ;(async () => {
      try {
        const video = videoRef.current
        if (!video) throw new Error('sem vídeo')
        const nativo = await leitorNativo()
        if (nativo) {
          stream = await abrirStream()
          if (cancelado) return encerrar()
          await focoContinuo(stream)
          video.srcObject = stream
          video.setAttribute('playsinline', 'true')
          video.muted = true
          await video.play().catch(() => {})
          const passo = async () => {
            if (cancelado) return
            try {
              if (video.readyState >= 2) {
                const achados = await nativo.detect(video)
                if (achados?.[0]?.rawValue) return lido(achados[0].rawValue)
              }
            } catch (_) { /* quadro ruim: tenta o próximo */ }
            temporizador = setTimeout(passo, 120)
          }
          passo()
          return
        }
        const leitor = await leitorZxing()
        stream = await abrirStream()
        if (cancelado) return encerrar()
        await focoContinuo(stream)
        controlesZxing = await leitor.decodeFromStream(stream, video, (resultado) => {
          if (resultado) lido(resultado.getText())
        })
        if (cancelado) encerrar()
      } catch (erro) {
        encerrar()
        setAtivo(false)
        const negado = erro?.name === 'NotAllowedError' || erro?.name === 'SecurityError'
        aoErroRef.current?.(negado
          ? 'A câmera foi bloqueada. Libere a permissão da câmera para este site e tente de novo.'
          : 'Não foi possível abrir a câmera. Digite o código ou tente de novo.')
      }
    })()
    return encerrar
  }, [ativo])

  return { videoRef, ativo, abrir, parar }
}
