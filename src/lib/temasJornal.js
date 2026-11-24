// Template de cada jornal. O escolhido no Geral vale para todos os setores; o setor que escolheu o
// seu fica com o dele, e trocar um não mexe nos outros. O Mercado Encarte é exclusivo: tem o seu.
export function temaDoJornal(id, { geral, proprios, mercadoId, padraoMercado }) {
  if (id === 'geral') return geral
  return proprios[id] || (id === mercadoId ? padraoMercado : geral)
}

// Escolhas próprias a partir do que já estava salvo. As versões antigas gravavam um template para
// todo setor, mesmo sem ninguém ter escolhido: o que é igual ao padrão do setor volta a seguir o Geral.
export function temasPropriosSalvos({ rascunho = {}, publicado = {}, padraoDoSetor, mercadoId }) {
  const limpar = (temas, geral, novo) => Object.fromEntries(Object.entries(temas || {}).filter(([id, tema]) =>
    tema && (id === mercadoId || (tema !== geral && (novo || tema !== padraoDoSetor(id))))))
  if (rascunho.temasV === 2) return { ...(rascunho.temasSetor || {}) }
  return { ...limpar(publicado.temasSetor, publicado.tema, publicado.temasV === 2), ...limpar(rascunho.temasSetor, rascunho.tema, false) }
}
