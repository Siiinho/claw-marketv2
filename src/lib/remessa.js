// Remessa: os produtos que a pessoa bipou para o jornal que está montando agora. O gerador só usa
// estes. Fica no próprio produto (remessaPor, remessaEm), então quem bipa no celular termina no PC
// com o mesmo login, e duas pessoas não misturam os jornais.
import { MERCADO_ENCARTE, noMercadoEncarte, paraNumero } from './utils'
import { temasDoSetor } from './temasCampanha'

export const naRemessa = (produto, usuarioId) => Boolean(usuarioId) && produto?.remessaPor === usuarioId

// Na ordem em que foram bipados.
export const remessaDe = (produtos, usuarioId) => (produtos || [])
  .filter((p) => naRemessa(p, usuarioId))
  .sort((a, b) => String(a.remessaEm || '').localeCompare(String(b.remessaEm || '')))

// Preço do jornal: o que a pessoa escreveu no passo 2. Validade e regra nenhuma mexem nele.
export const precoNoJornal = (p) => paraNumero(p?.precoPromo) || paraNumero(p?.precoNormal) || 0

// Produtos da remessa que entram no jornal escolhido: um setor só leva os dele.
export const itensDoDestino = (remessa, destino) =>
  (destino === 'geral' || destino === MERCADO_ENCARTE.id ? remessa : remessa.filter((p) => p.setor === destino))

// O que vai para o site ao publicar `destino`, sem mexer nos outros jornais que já estão no ar:
//  - geral: troca os setores que vieram nesta remessa; os outros setores e a estrela continuam.
//    Só com `trocarTudo` ele começa do zero (tira os outros setores);
//  - mercado-encarte (estrela): troca só o jornal da estrela;
//  - setor: troca só aquele setor.
// `noAr` é o encarte publicado (ou null); `itens` já vêm com preço e, na estrela, com o dia.
export function montarPublicacao({ noAr, itens, destino, tema, fundo, periodoDe, periodoAte, layout, escalaLogo, trocarTudo = false }) {
  const antigos = Array.isArray(noAr?.itens) ? noAr.itens : []
  const novos = new Map(itens.map((p) => [p.id, p]))
  const base = {
    tema: noAr?.tema || tema,
    layout: noAr?.layout || layout,
    escalaLogo: noAr?.escalaLogo || escalaLogo,
    periodoDe: noAr?.periodoDe || periodoDe,
    periodoAte: noAr?.periodoAte || periodoAte,
    fundo: noAr?.fundo || null,
    fundos: { ...(noAr?.fundos || {}), ...(fundo ? { [tema]: fundo } : {}) },
    temasSetor: temasResolvidos(noAr),
    periodosSetor: { ...(noAr?.periodosSetor || {}) },
    temasV: 2,
  }
  if (destino === 'geral' && !trocarTudo) {
    // os setores que ficam guardam a campanha e o período que já mostram hoje
    const setoresNovos = new Set(itens.map((p) => p.setor))
    const ficam = antigos.filter((p) => !novos.has(p.id) && !setoresNovos.has(p.setor) && !p.soMercado)
    const temasSetor = { ...base.temasSetor }
    const periodosSetor = { ...base.periodosSetor }
    for (const s of setoresNovos) { delete temasSetor[s]; delete periodosSetor[s] }
    for (const s of new Set(ficam.map((p) => p.setor).filter(Boolean))) {
      if (!temasSetor[s]) temasSetor[s] = noAr?.tema || tema
      if (!periodosSetor[s] && noAr?.periodoDe) periodosSetor[s] = { de: noAr.periodoDe, ate: noAr.periodoAte || noAr.periodoDe }
    }
    return {
      ...base,
      tema,
      layout,
      escalaLogo,
      periodoDe,
      periodoAte,
      fundo: fundo || null,
      temasSetor,
      periodosSetor,
      itens: [
        ...ficam,
        // da estrela que não veio agora: continua só na estrela
        ...antigos.filter((p) => !novos.has(p.id) && !ficam.includes(p) && noMercadoEncarte(p)).map((p) => ({ ...p, soMercado: true })),
        ...itens.map((p) => semEstrela(p, antigos.find((a) => a.id === p.id && noMercadoEncarte(a))?.encarteMercadoDia)),
      ],
    }
  }
  if (destino === 'geral') {
    const estrelaAtual = antigos.filter((p) => noMercadoEncarte(p))
    const doMercado = base.temasSetor[MERCADO_ENCARTE.id]
    return {
      ...base,
      tema,
      layout,
      escalaLogo,
      periodoDe,
      periodoAte,
      fundo: fundo || null,
      temasSetor: doMercado ? { [MERCADO_ENCARTE.id]: doMercado } : {},
      periodosSetor: {},
      itens: [
        ...itens.map((p) => {
          const antes = estrelaAtual.find((a) => a.id === p.id)
          return semEstrela(p, antes?.encarteMercadoDia)
        }),
        ...estrelaAtual.filter((p) => !novos.has(p.id)).map((p) => ({ ...p, soMercado: true })),
      ],
    }
  }
  if (destino === MERCADO_ENCARTE.id) {
    return {
      ...base,
      temasSetor: { ...base.temasSetor, [destino]: tema },
      itens: [
        // fora da estrela nova: o que só existia nela sai; o resto continua na sua aba
        ...antigos.filter((p) => !novos.has(p.id) && !p.soMercado).map((p) => semEstrela(p)),
        // já estava em outra aba: continua lá, com o preço novo
        ...itens.map((p) => ({ ...p, soMercado: !antigos.some((a) => a.id === p.id && !a.soMercado) })),
      ],
    }
  }
  return {
    ...base,
    // sem nada no ar, a capa usa o template deste setor
    temasSetor: { ...base.temasSetor, [destino]: tema },
    periodosSetor: { ...base.periodosSetor, [destino]: { de: periodoDe, ate: periodoAte } },
    itens: [
      ...antigos.filter((p) => !novos.has(p.id)).flatMap((p) => (
        p.setor !== destino || p.soMercado ? [p] : noMercadoEncarte(p) ? [{ ...p, soMercado: true }] : []
      )),
      ...itens.map((p) => semEstrela(p, antigos.find((a) => a.id === p.id && noMercadoEncarte(a))?.encarteMercadoDia)),
    ],
  }
}

const semEstrela = (p, dia = null) => ({ ...p, encarteMercadoDia: dia || null, soMercado: false })

// Encartes antigos não diziam o template de cada setor: guarda o que o site já mostra hoje.
function temasResolvidos(noAr) {
  const temas = { ...(noAr?.temasSetor || {}) }
  if (!noAr || noAr.temasV === 2) return temas
  for (const setor of new Set((noAr.itens || []).map((p) => p.setor).filter(Boolean))) {
    if (!temas[setor]) temas[setor] = temasDoSetor(setor)[0]?.id || noAr.tema
  }
  return temas
}
