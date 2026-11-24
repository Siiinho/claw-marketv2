import { useEffect, useState } from 'react'
import { buscarProdutosPorNome, normalizarBusca } from './catalogoBengala'

const codigoLimpo = (valor) => String(valor || '').replace(/\D/g, '')
// Com letra no campo, a busca é pelo nome; só números, é o código de barras.
export const ehBuscaPorNome = (valor) => /[a-zA-ZÀ-ÿ]/.test(String(valor || ''))

// Busca pelo nome: produtos já cadastrados no app primeiro, depois a mercadologia da loja e a base
// de 28 mil. Usada no Scanner e no scanner do Jornal.
export function useBuscaNome(codigo, produtos) {
  const [sugestoes, setSugestoes] = useState([])
  const [procurandoNome, setProcurandoNome] = useState(false)
  const [destaque, setDestaque] = useState(0)
  const porNome = ehBuscaPorNome(codigo)
  // Texto novo volta para o primeiro da lista; mudança nos produtos (nuvem) não mexe na escolha.
  useEffect(() => { setDestaque(0) }, [codigo])
  useEffect(() => {
    if (!porNome || normalizarBusca(codigo).length < 2) { setSugestoes([]); setProcurandoNome(false); return undefined }
    let ativo = true
    setProcurandoNome(true)
    const espera = setTimeout(async () => {
      const palavras = normalizarBusca(codigo).split(' ').filter(Boolean)
      const cadastrados = produtos
        .filter((p) => p.nome && palavras.every((w) => normalizarBusca(p.nome).includes(w)))
        .slice(0, 6)
        .map((p) => ({ codigoBarras: p.codigoBarras, nome: p.nome, setor: p.setor, precoNormal: p.precoNormal, origem: 'cadastrado', produto: p }))
      let doCatalogo = []
      try { doCatalogo = await buscarProdutosPorNome(codigo, { limite: 12 }) } catch (_) { /* catálogo fora do ar: fica só com os cadastrados */ }
      if (!ativo) return
      const jaListados = new Set(cadastrados.map((p) => codigoLimpo(p.codigoBarras).replace(/^0+/, '')).filter(Boolean))
      // Nome que começa com a primeira palavra vem antes; depois o que já está no app, a mercadologia
      // da loja e a base de 28 mil; por fim o nome mais curto (mais perto do que foi digitado).
      const peso = { cadastrado: 0, loja: 100, base: 1000 }
      const pontos = (p) => (normalizarBusca(p.nome).startsWith(palavras[0]) ? 0 : 5000) + (peso[p.origem] ?? 1000) + normalizarBusca(p.nome).length
      setSugestoes([...cadastrados, ...doCatalogo.filter((p) => !jaListados.has(codigoLimpo(p.codigoBarras).replace(/^0+/, '')))]
        .sort((x, y) => pontos(x) - pontos(y))
        .slice(0, 12))
      setProcurandoNome(false)
    }, 180)
    return () => { ativo = false; clearTimeout(espera) }
  }, [codigo, porNome, produtos])
  return { porNome, sugestoes, procurandoNome, destaque: Math.min(destaque, Math.max(0, sugestoes.length - 1)), setDestaque }
}
