import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

async function captura(el) {
  return html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false })
}

export async function exportarPNG(el, nome = 'cartaz') {
  const canvas = await captura(el)
  const link = document.createElement('a')
  link.download = `${nome}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

export async function exportarPDF(el, nome = 'jornal') {
  const canvas = await captura(el)
  const img = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? 'l' : 'p', unit: 'px', format: [canvas.width, canvas.height] })
  pdf.addImage(img, 'PNG', 0, 0, canvas.width, canvas.height)
  pdf.save(`${nome}.pdf`)
}

export async function exportarPDFPaginas(elementos, nome = 'jornal') {
  const paginas = elementos.filter(Boolean)
  if (!paginas.length) throw new Error('Nenhuma página para exportar.')

  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
  for (let i = 0; i < paginas.length; i += 1) {
    const canvas = await captura(paginas[i])
    const img = canvas.toDataURL('image/png')
    if (i > 0) pdf.addPage('a4', 'p')
    pdf.addImage(img, 'PNG', 0, 0, 210, 297)
  }
  pdf.save(`${nome}.pdf`)
}
