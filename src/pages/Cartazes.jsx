import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/StoreContext'
import { Icon, EmptyState, Botao, Campo, Rotulo, inputCls, Modal, Segmentado } from '../components/ui'
import CentralArtes from '../components/CentralArtes'
import { Escalado } from '../components/PaginaTemplate'
import SeletorSelo, { BotaoAplicarTodos } from '../components/SeletorSelo'
import { CartazModelo, MODELOS_CARTAZ, ehClassico, templateCartaz } from '../components/cartazes/cartazPincel'
import { percentDesc, dataISOmaisDias, paraNumero, SELOS_OFERTA } from '../lib/utils'

// Cartazes para imprimir (A3 a A7, Clássico ou estilo pincel) e etiquetas de gôndola.
// Tocar num cartaz da prévia abre a edição: modelo, palavra grande, textos, preço e selo,
// com "aplicar a todos" no modelo e no selo, como no jornal.
// O texto mudado aqui fica só no cartaz (campo `cartaz` do produto); preço, unidade e selo
// valem para o produto todo (jornal, artes e cartazes).

const paraCampo = (v) => (v == null || v === '' ? '' : String(Number(v).toFixed(2)).replace('.', ','))

export default function Cartazes() {
  const navigate = useNavigate()
  const store = useStore()
  const { produtos, ofertaDoProduto, toast, salvarProduto, salvarConfig, config } = store
  const [periodoDe, setPeriodoDe] = useState(() => dataISOmaisDias(0))
  const [periodoAte, setPeriodoAte] = useState(() => dataISOmaisDias(6))
  const [editando, setEditando] = useState(null) // id do produto
  const [rascunho, setRascunho] = useState(null)

  const modeloPadrao = config?.cartazModelo || 'classico'
  const orientacao = config?.cartazOrientacao || 'retrato'

  const precoNovo = (p) => {
    const o = ofertaDoProduto(p.id)
    if (o) return p.precoNormal * (1 - o.desconto / 100)
    return p.precoPromo ?? p.precoNormal
  }

  // O cartaz usa os textos próprios quando existem (p.cartaz) e o modelo escolhido para ele.
  const comAjustesDoCartaz = (p) => {
    const c = p.cartaz || {}
    const precoJornal = precoNovo(p)
    return {
      ...p,
      nome: c.nome || p.nome,
      marca: c.marca ?? p.marca,
      gramagem: c.gramagem ?? p.gramagem,
      chamada: c.chamada || undefined,
      modeloCartaz: c.modelo || undefined,
      precoJornal,
      descontoJornal: percentDesc(p.precoNormal, precoJornal),
    }
  }

  const originais = useMemo(
    () => produtos.filter((p) => p.precoPromo || ofertaDoProduto(p.id) || p.naFila),
    [produtos, ofertaDoProduto],
  )
  const itens = useMemo(
    () => originais.map(comAjustesDoCartaz),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [originais],
  )
  const loja = (store.lojas || []).find((l) => l.id === store.lojaAtiva) || (store.lojas || [])[0]
  const encarte = { periodoDe, periodoAte: periodoAte >= periodoDe ? periodoAte : periodoDe }

  const original = editando ? originais.find((p) => p.id === editando) : null
  const temOferta = original ? Boolean(ofertaDoProduto(original.id)) : false

  const abrir = (item) => {
    const p = originais.find((o) => o.id === item.id)
    if (!p) return
    const c = p.cartaz || {}
    setEditando(p.id)
    setRascunho({
      modelo: c.modelo || '',
      chamada: c.chamada || '',
      nome: c.nome || p.nome || '',
      marca: c.marca ?? p.marca ?? '',
      gramagem: c.gramagem ?? p.gramagem ?? '',
      unidade: p.unidade || (p.setor === 'hortifruti' ? 'KG' : 'UN'),
      precoNormal: paraCampo(p.precoNormal),
      precoPromo: paraCampo(p.precoPromo),
      seloOferta: p.seloOferta || 'oferta',
    })
  }
  const fechar = () => { setEditando(null); setRascunho(null) }
  const mudar = (campo, valor) => setRascunho((r) => ({ ...r, [campo]: valor }))

  const modeloDoRascunho = rascunho?.modelo || modeloPadrao
  const previa = original && rascunho ? comAjustesDoCartaz({
    ...original,
    unidade: rascunho.unidade,
    precoNormal: paraNumero(rascunho.precoNormal) ?? original.precoNormal,
    precoPromo: rascunho.precoPromo === '' ? null : (paraNumero(rascunho.precoPromo) ?? original.precoPromo),
    seloOferta: rascunho.seloOferta,
    cartaz: { nome: rascunho.nome.trim(), marca: rascunho.marca, gramagem: rascunho.gramagem, chamada: rascunho.chamada.trim(), modelo: rascunho.modelo },
  }) : null

  const salvar = () => {
    const normal = paraNumero(rascunho.precoNormal)
    const promo = rascunho.precoPromo === '' ? null : paraNumero(rascunho.precoPromo)
    if (normal == null || normal <= 0) return toast('Digite o preço normal (ex.: 12,90).', 'erro')
    if (promo != null && promo >= normal) return toast('O preço de oferta precisa ser menor que o normal.', 'erro')
    const nome = rascunho.nome.trim()
    salvarProduto({
      id: original.id,
      precoNormal: normal,
      ...(temOferta ? {} : { precoPromo: promo }),
      // A unidade só é gravada quando foi trocada (sem ela, o jornal usa a do setor).
      ...(rascunho.unidade !== (original.unidade || (original.setor === 'hortifruti' ? 'KG' : 'UN')) ? { unidade: rascunho.unidade } : {}),
      seloOferta: rascunho.seloOferta,
      cartaz: {
        // Guarda só o que difere do cadastro, para o cartaz acompanhar o produto.
        nome: nome && nome !== original.nome ? nome : '',
        marca: rascunho.marca !== (original.marca ?? '') ? rascunho.marca : undefined,
        gramagem: rascunho.gramagem !== (original.gramagem ?? '') ? rascunho.gramagem : undefined,
        chamada: rascunho.chamada.trim(),
        modelo: rascunho.modelo,
      },
    })
    toast(`Cartaz de ${nome || original.nome} salvo.`)
    fechar()
  }

  const voltarAoOriginal = () => {
    salvarProduto({ id: original.id, cartaz: null })
    toast(`O cartaz de ${original.nome} voltou ao texto do cadastro.`, 'info')
    fechar()
  }

  // Aplicar a todos: o modelo vira o padrão da aba e os modelos próprios saem.
  const modeloEmTodos = (id) => {
    salvarConfig({ cartazModelo: id })
    originais.filter((p) => p.cartaz?.modelo).forEach((p) => salvarProduto({ id: p.id, cartaz: { ...p.cartaz, modelo: '' } }))
    mudar('modelo', '')
    const m = MODELOS_CARTAZ.find((x) => x.id === id)
    toast(`Modelo "${m?.nome}" em todos os ${originais.length} cartazes.`)
  }
  const seloEmTodos = (id) => {
    originais.filter((p) => (p.seloOferta || 'oferta') !== id).forEach((p) => salvarProduto({ id: p.id, seloOferta: id }))
    const selo = SELOS_OFERTA.find((s) => s.id === id)
    toast(selo?.nenhum ? `Os ${originais.length} cartazes ficaram sem selo.` : `Selo "${selo?.texto}" em todos os ${originais.length} cartazes.`)
  }

  if (itens.length === 0) {
    return (
      <EmptyState
        icon="Image"
        titulo="Nenhum produto em oferta"
        descricao="Bipe um produto e coloque na fila do jornal ou numa oferta para criar o cartaz."
        acao={
          <div className="flex flex-wrap justify-center gap-2">
            <Botao onClick={() => navigate('/scanner')}><Icon name="ScanLine" size={16} /> Escanear produto</Botao>
            <Botao variante="contorno" onClick={() => navigate('/ofertas')}><Icon name="Tag" size={16} /> Ver ofertas</Botao>
          </div>
        }
      />
    )
  }

  const palavraModelo = ehClassico(modeloDoRascunho) ? '' : templateCartaz(modeloDoRascunho).chamada[1]

  return (
    <>
      <CentralArtes
        saidas={['cartaz', 'etiqueta']}
        saidaInicial="cartaz"
        subtitulo="Escolha o modelo e o tamanho. Toque num cartaz da prévia para mudar o texto, o preço ou o selo."
        itens={itens}
        titulo="Cartazes de oferta"
        encarte={encarte}
        loja={loja}
        toast={toast}
        onBipar={() => navigate('/scanner')}
        cartaz={{
          modelo: modeloPadrao,
          onModelo: (id) => salvarConfig({ cartazModelo: id }),
          orientacao,
          onOrientacao: (id) => salvarConfig({ cartazOrientacao: id }),
          onAbrir: abrir,
        }}
        ajustes={(
          <>
            <Rotulo>Oferta válida</Rotulo>
            <div className="grid max-w-md grid-cols-2 gap-2">
              <Campo label="De"><input type="date" className={inputCls} value={periodoDe} onChange={(e) => setPeriodoDe(e.target.value)} /></Campo>
              <Campo label="Até"><input type="date" className={inputCls} value={periodoAte} min={periodoDe} onChange={(e) => setPeriodoAte(e.target.value)} /></Campo>
            </div>
          </>
        )}
      />

      <Modal
        open={Boolean(original && rascunho)}
        onClose={fechar}
        titulo={original ? `Cartaz: ${original.nome}` : 'Editar cartaz'}
        largura="max-w-3xl"
        footer={original && rascunho && (
          <>
            {original.cartaz && (
              <button type="button" onClick={voltarAoOriginal} className="mr-auto inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-ink-soft hover:bg-cream-200">
                <Icon name="RotateCcw" size={15} /> Voltar ao cadastro
              </button>
            )}
            <Botao variante="contorno" onClick={fechar}>Cancelar</Botao>
            <Botao onClick={salvar}>Salvar cartaz</Botao>
          </>
        )}
      >
        {original && rascunho && previa && (
          <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
            <div className="md:sticky md:top-0 md:self-start">
              <div className="mx-auto max-w-[220px] overflow-hidden rounded-lg border border-ink-soft/15 bg-white">
                <Escalado largura={397} altura={562}>
                  <CartazModelo produto={previa} modelo={modeloDoRascunho} w={397} h={562} encarte={encarte} loja={loja} />
                </Escalado>
              </div>
              <p className="mt-2 text-center text-xs text-ink-soft">Prévia. Muda enquanto você digita.</p>
            </div>

            <div className="min-w-0 space-y-5">
              <div>
                <p className="mb-2 text-sm font-semibold text-ink">Modelo deste cartaz</p>
                <div role="group" aria-label="Modelo deste cartaz" className="flex flex-wrap gap-1.5">
                  {MODELOS_CARTAZ.map((m) => {
                    const ativo = modeloDoRascunho === m.id
                    return (
                      <button key={m.id} type="button" onClick={() => mudar('modelo', m.id === modeloPadrao ? '' : m.id)} aria-pressed={ativo}
                        className={`min-h-10 rounded-lg border px-3 py-1.5 text-sm font-semibold ${ativo ? 'border-navy bg-navy text-white' : 'border-ink-soft/20 bg-white text-ink hover:border-ink-soft/45'}`}>
                        {m.nome}
                      </button>
                    )
                  })}
                </div>
                <BotaoAplicarTodos total={originais.length} onClick={() => modeloEmTodos(modeloDoRascunho)}
                  descricao={`Os ${originais.length} cartazes passam a usar "${MODELOS_CARTAZ.find((m) => m.id === modeloDoRascunho)?.nome}".`}>
                  Usar este modelo em todos
                </BotaoAplicarTodos>
              </div>

              {!ehClassico(modeloDoRascunho) && (
                <Campo label="Palavra grande do topo">
                  <input className={inputCls} value={rascunho.chamada} maxLength={18} placeholder={palavraModelo} onChange={(e) => mudar('chamada', e.target.value)} />
                </Campo>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Campo label="Nome no cartaz">
                    <input className={inputCls} value={rascunho.nome} maxLength={60} onChange={(e) => mudar('nome', e.target.value)} />
                  </Campo>
                </div>
                <Campo label="Marca">
                  <input className={inputCls} value={rascunho.marca} maxLength={30} onChange={(e) => mudar('marca', e.target.value)} />
                </Campo>
                <Campo label="Peso ou tamanho">
                  <input className={inputCls} value={rascunho.gramagem} maxLength={20} placeholder="ex.: 5 kg, 900 ml" onChange={(e) => mudar('gramagem', e.target.value)} />
                </Campo>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-ink">Preço</p>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Normal (De)">
                    <input className={inputCls} inputMode="decimal" value={rascunho.precoNormal} onChange={(e) => mudar('precoNormal', e.target.value)} />
                  </Campo>
                  <Campo label="Oferta (Por)">
                    <input className={inputCls} inputMode="decimal" value={rascunho.precoPromo} disabled={temOferta} placeholder={temOferta ? 'vem da oferta' : 'sem oferta'} onChange={(e) => mudar('precoPromo', e.target.value)} />
                  </Campo>
                </div>
                {temOferta && <p className="mt-1.5 text-xs text-ink-soft">Este produto está numa oferta da aba Ofertas: o preço de oferta sai do desconto dela.</p>}
                <div className="mt-3">
                  <Segmentado rotulo="Vendido por" valor={rascunho.unidade} onChange={(v) => mudar('unidade', v)} opcoes={[['UN', 'Por unidade'], ['KG', 'Por quilo (KG)'], ...(original.unidade && !['UN', 'KG'].includes(original.unidade) ? [[original.unidade, `Por ${original.unidade}`]] : [])]} />
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-ink">Selo</p>
                <p className="mb-2 text-xs text-ink-soft">O selo sai no modelo Clássico, no jornal e nas artes. Nos modelos de pincel, quem faz esse papel é a palavra grande do topo.</p>
                <SeletorSelo value={rascunho.seloOferta} onChange={(id) => mudar('seloOferta', id)} />
                <BotaoAplicarTodos total={originais.length} onClick={() => seloEmTodos(rascunho.seloOferta)}
                  descricao={`Os ${originais.length} cartazes e o jornal passam a usar este selo.`}>
                  Aplicar este selo a todos
                </BotaoAplicarTodos>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
