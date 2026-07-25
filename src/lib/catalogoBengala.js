let catalogoPromise

const somenteDigitos = (valor) => String(valor || '').replace(/\D/g, '')

async function carregarCatalogo() {
  if (!catalogoPromise) {
    catalogoPromise = import('../data/catalogoMercadologiaBengala.json').then((modulo) => {
      const dados = modulo.default || modulo
      return new Map((dados.produtos || []).map((produto) => [produto.codigoBarras, produto]))
    })
  }
  return catalogoPromise
}

export async function buscarProdutoBengala(codigo) {
  const codigoBarras = somenteDigitos(codigo)
  if (!codigoBarras) return null
  const catalogo = await carregarCatalogo()
  return catalogo.get(codigoBarras) || catalogo.get(codigoBarras.padStart(13, '0')) || null
}

export async function totalProdutosBengala() {
  const catalogo = await carregarCatalogo()
  return catalogo.size
}
