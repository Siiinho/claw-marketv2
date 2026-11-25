import html2canvas from 'html2canvas-pro'
import { snapdom } from '@zumer/snapdom'
import jsPDF from 'jspdf'

const proximoFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))
const LIMITE_PIXELS_CANVAS = 24_000_000
// 3x a folha de 96 px = ~290 dpi, qualidade de gráfica. Mais que isso só deixava o PDF lento.
const ESCALA_IMPRESSAO = 3
// Página do PDF em JPEG de alta qualidade: o jsPDF grava o JPEG direto, sem recomprimir,
// o que deixa a geração bem mais rápida que PNG (que ele decodifica e comprime de novo).
const QUALIDADE_PDF = 0.95

async function aguardarImagem(img) {
  if (img.complete && img.naturalWidth > 0) return

  try {
    if (typeof img.decode === 'function') {
      await Promise.race([
        img.decode(),
        new Promise((resolve) => setTimeout(resolve, 8000)),
      ])
      return
    }
  } catch {
    // O evento load/error abaixo ainda permite que a exportação continue.
  }

  await Promise.race([
    new Promise((resolve) => {
      img.addEventListener('load', resolve, { once: true })
      img.addEventListener('error', resolve, { once: true })
    }),
    new Promise((resolve) => setTimeout(resolve, 8000)),
  ])
}

async function aguardarRecursos(el) {
  if (document.fonts?.ready) await document.fonts.ready
  await Promise.all([...el.querySelectorAll('img')].map(aguardarImagem))
  const imagemComFalha = [...el.querySelectorAll('img')].find((img) => !img.complete || img.naturalWidth <= 0)
  if (imagemComFalha) {
    throw new Error(`A imagem "${imagemComFalha.alt || 'do produto'}" não terminou de carregar.`)
  }
  await proximoFrame()
  await proximoFrame()
}

async function captura(el, { escala } = {}) {
  if (!el || !el.isConnected) {
    throw new Error('A página do jornal ainda não está pronta. Aguarde a prévia aparecer e tente novamente.')
  }

  if (!el.offsetWidth || !el.offsetHeight) {
    throw new Error('A prévia do jornal está vazia. Adicione um produto antes de exportar.')
  }

  await aguardarRecursos(el)

  let ultimoErro
  // Usa as dimensões reais do modelo. scrollWidth/scrollHeight podem incluir
  // conteúdo responsivo e alterar a proporção da página durante a captura.
  const retangulo = el.getBoundingClientRect()
  const largura = Math.max(1, Math.round(retangulo.width || el.offsetWidth))
  const altura = Math.max(1, Math.round(retangulo.height || el.offsetHeight))
  const escalaSegura = Math.sqrt(LIMITE_PIXELS_CANVAS / Math.max(largura * altura, 1))
  const escalas = escala ? [escala, Math.min(escala, 2), 1].filter((v, i, l) => l.indexOf(v) === i) : [...new Set([
    Math.min(ESCALA_IMPRESSAO, escalaSegura),
    Math.min(2, escalaSegura),
  ])]
    .filter((scale) => Number.isFinite(scale) && scale >= 1)
  // `escala` fixa: artes de rede social saem no tamanho exato do formato (1080 px etc.).

  // A segunda tentativa, mais leve, permite exportar também em coletores e
  // celulares com pouca memória sem reduzir a qualidade nos aparelhos comuns.
  // As fontes dos cartazes precisam estar carregadas, senão o arquivo sai com a fonte reserva.
  try { await document.fonts?.ready } catch { /* sem suporte: segue */ }
  for (const scale of escalas.length ? escalas : [1]) {
    // snapdom (github.com/zumerlab/snapdom): captura a página pelo próprio navegador,
    // várias vezes mais rápido que o html2canvas e fiel às fontes e aos SVGs.
    // Sem cache: o React reaproveita os elementos ao trocar de modelo, e o cache devolvia as cores
    // e molduras do modelo anterior (cartaz impresso diferente do escolhido).
    // Se falhar (navegador antigo, imagem bloqueada), cai no html2canvas.
    try {
      const canvas = await snapdom.toCanvas(el, { scale, backgroundColor: '#ffffff', cache: 'disabled' })
      if (canvas?.width > 1 && canvas?.height > 1) return canvas
    } catch (erro) {
      ultimoErro = erro
    }
    try {
      return await html2canvas(el, {
        scale,
        width: largura,
        height: altura,
        windowWidth: Math.max(document.documentElement.clientWidth, largura),
        windowHeight: Math.max(document.documentElement.clientHeight, altura),
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        imageTimeout: 15000,
        logging: false,
        removeContainer: true,
      })
    } catch (erro) {
      ultimoErro = erro
    }
  }

  console.error('Falha ao capturar a página do jornal:', ultimoErro)
  const detalhe = String(ultimoErro?.message || '')
  if (/unsupported color function/i.test(detalhe)) {
    throw new Error('O modelo usa uma cor incompatível com o gerador de PDF. Atualize a página e tente novamente.')
  }
  throw new Error('Não foi possível preparar o jornal. Feche outros aplicativos e tente novamente.')
}

function canvasParaBlob(canvas, tipo, qualidade) {
  if (typeof canvas.toBlob !== 'function') {
    const dataUrl = canvas.toDataURL(tipo, qualidade)
    const [cabecalho, base64] = dataUrl.split(',')
    const mime = cabecalho.match(/data:([^;]+)/)?.[1] || tipo
    const binario = atob(base64)
    const bytes = new Uint8Array(binario.length)
    for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i)
    return Promise.resolve(new Blob([bytes], { type: mime }))
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Não foi possível criar o arquivo.')),
      tipo,
      qualidade
    )
  })
}

function blobParaBytes(blob) {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer().then((buffer) => new Uint8Array(buffer))
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result))
    reader.onerror = () => reject(reader.error || new Error('Não foi possível ler a página do PDF.'))
    reader.readAsArrayBuffer(blob)
  })
}

function oferecerArquivo(blob, nome) {
  if (!(blob instanceof Blob) || blob.size < 100 || blob.type !== 'application/pdf' && !nome.endsWith('.png')) {
    throw new Error('O arquivo gerado ficou inválido. Atualize a página e tente novamente.')
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nome
  link.target = '_blank'
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()

  // A URL continua ativa para o botão manual "Abrir/baixar". Quem chama
  // esta função deve revogá-la quando gerar outro arquivo ou sair da tela.
  return { blob, url, nome }
}

export async function exportarPNG(el, nome = 'cartaz', opcoes) {
  const blob = await gerarPNG(el, opcoes)
  return oferecerArquivo(blob, `${nome}.png`)
}

// Gera o PNG sem baixar (para compartilhar pelo celular no WhatsApp/Instagram).
export async function gerarPNG(el, opcoes) {
  const canvas = await captura(el, opcoes)
  try {
    return await canvasParaBlob(canvas, 'image/png')
  } finally {
    canvas.width = 1
    canvas.height = 1
  }
}

export async function exportarPDF(el, nome = 'jornal') {
  const canvas = await captura(el)
  try {
    const blobPagina = await canvasParaBlob(canvas, 'image/jpeg', QUALIDADE_PDF)
    const bytesPagina = await blobParaBytes(blobPagina)
    const orientacao = canvas.width > canvas.height ? 'l' : 'p'
    const pdf = new jsPDF({ orientation: orientacao, unit: 'mm', format: 'a4', compress: true })
    const larguraA4 = orientacao === 'l' ? 297 : 210
    const alturaA4 = orientacao === 'l' ? 210 : 297
    const escala = Math.min(larguraA4 / canvas.width, alturaA4 / canvas.height)
    const largura = canvas.width * escala
    const altura = canvas.height * escala
    pdf.addImage(bytesPagina, 'JPEG', (larguraA4 - largura) / 2, (alturaA4 - altura) / 2, largura, altura, undefined, 'NONE')
    return oferecerArquivo(pdf.output('blob'), `${nome}.pdf`)
  } finally {
    canvas.width = 1
    canvas.height = 1
  }
}

// Folhas em mm. Cartaz sai 1 por folha, na folha do tamanho dele.
const PAPEL_MM = { a3: [297, 420], a4: [210, 297], a5: [148, 210], a6: [105, 148], a7: [74, 105] }

export async function exportarPDFPaginas(elementos, nome = 'jornal', { formato = 'a4', onProgresso } = {}) {
  const papel = PAPEL_MM[formato] ? formato : 'a4'
  const [curto, longo] = PAPEL_MM[papel]
  const paginas = elementos.filter(Boolean)
  if (!paginas.length) throw new Error('Nenhuma página pronta para exportar.')

  let pdf
  for (let i = 0; i < paginas.length; i += 1) {
    onProgresso?.(i + 1, paginas.length)
    // Deixa a tela respirar entre as páginas (o botão mostra o progresso).
    await proximoFrame()
    const canvas = await captura(paginas[i])
    try {
      const larguraCanvas = canvas.width
      const alturaCanvas = canvas.height
      const orientacao = larguraCanvas > alturaCanvas ? 'l' : 'p'
      const larguraA4 = orientacao === 'l' ? longo : curto
      const alturaA4 = orientacao === 'l' ? curto : longo
      // JPEG 95% em ~290 dpi: sem marcas visíveis no papel e muito mais rápido que PNG.
      const blobPagina = await canvasParaBlob(canvas, 'image/jpeg', QUALIDADE_PDF)
      const bytesPagina = await blobParaBytes(blobPagina)
      const escalaA4 = Math.min(larguraA4 / larguraCanvas, alturaA4 / alturaCanvas)
      const largura = larguraCanvas * escalaA4
      const altura = alturaCanvas * escalaA4
      const x = (larguraA4 - largura) / 2
      const y = (alturaA4 - altura) / 2

      if (!pdf) pdf = new jsPDF({ orientation: orientacao, unit: 'mm', format: papel, compress: true })
      else pdf.addPage(papel, orientacao)
      pdf.addImage(bytesPagina, 'JPEG', x, y, largura, altura, undefined, 'NONE')
    } finally {
      // Libera os pixels mesmo quando uma página falha no meio da exportação.
      canvas.width = 1
      canvas.height = 1
    }
  }
  return oferecerArquivo(pdf.output('blob'), `${nome}.pdf`)
}

// Impressão direta: a caixa de impressão do navegador abre na própria tela, sem aba nova, pop-up
// nem arquivo baixado. As páginas entram escondidas e só elas aparecem no papel.
const ID_IMPRESSAO = 'cm-impressao'
const ESTILO_IMPRESSAO = `
  #${ID_IMPRESSAO} { position: fixed; left: -100000px; top: 0; width: 210mm; }
  #${ID_IMPRESSAO} img { display: block; width: 210mm; height: 297mm; object-fit: contain; }
  @media print {
    @page { size: A4 portrait; margin: 0; }
    html, body { margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 0 !important; overflow: visible !important; background: #fff !important; }
    body > *:not(#${ID_IMPRESSAO}) { display: none !important; }
    #${ID_IMPRESSAO} { position: static !important; left: auto; width: auto; }
    /* 296,5 mm: com a folha cheia, o arredondamento de alguns navegadores soltava uma página em branco */
    #${ID_IMPRESSAO} img { width: 210mm; height: 296.5mm; break-after: page; page-break-after: always; break-inside: avoid; }
    #${ID_IMPRESSAO} img:last-child { break-after: auto; page-break-after: auto; }
  }
`
let limparImpressao = () => {}

export async function imprimirPaginas(elementos, titulo = 'Jornal de ofertas') {
  const paginas = elementos.filter(Boolean)
  if (!paginas.length) throw new Error('Nenhuma página pronta para imprimir.')
  if (typeof window.print !== 'function') throw new Error('Este navegador não imprime. Abra o jornal no Chrome ou no Safari.')
  limparImpressao()

  const caixa = document.createElement('div')
  caixa.id = ID_IMPRESSAO
  caixa.setAttribute('aria-hidden', 'true')
  const estilo = document.createElement('style')
  estilo.textContent = ESTILO_IMPRESSAO
  const urls = []
  const tituloAntes = document.title
  let limpo = false
  const limpar = () => {
    if (limpo) return
    limpo = true
    caixa.remove()
    estilo.remove()
    urls.forEach((u) => URL.revokeObjectURL(u))
    if (document.title === titulo) document.title = tituloAntes
  }
  limparImpressao = limpar

  try {
    for (const [indice, pagina] of paginas.entries()) {
      const canvas = await captura(pagina)
      try {
        const url = URL.createObjectURL(await canvasParaBlob(canvas, 'image/jpeg', QUALIDADE_PDF))
        urls.push(url)
        const img = new Image()
        img.alt = `Página ${indice + 1}`
        img.src = url
        await img.decode() // só abre a impressão com a página inteira na memória
        caixa.append(img)
      } finally {
        canvas.width = 1
        canvas.height = 1
      }
    }
    if (limpo) return // outra impressão começou no meio
    document.head.append(estilo)
    document.body.append(caixa)
    document.title = titulo // nome sugerido se a pessoa escolher "Salvar como PDF"
    await proximoFrame()
    await proximoFrame()
    // No celular a tela de impressão continua aberta depois do aviso de "terminou": espera mais.
    const toque = window.matchMedia('(pointer: coarse)').matches
    window.addEventListener('afterprint', () => setTimeout(limpar, toque ? 60000 : 500), { once: true })
    window.print()
  } catch (erro) {
    limpar()
    throw erro
  }
}
