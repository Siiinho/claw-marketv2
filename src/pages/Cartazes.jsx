import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/StoreContext'
import { Icon, EmptyState, Botao, Campo, Rotulo, inputCls, Modal, Segmentado } from '../components/ui'
import CentralArtes from '../components/CentralArtes'
import { BotaoAplicarTodos } from '../components/SeletorSelo'
import EditorCartaz from '../components/cartazes/EditorCartaz'
import { CartazModelo, MODELOS_CARTAZ, ehClassico, templateCartaz } from '../components/cartazes/cartazPincel'
import { percentDesc, dataISOmaisDias, paraNumero } from '../lib/utils'

// Cartazes para imprimir (A3 a A7, Clássico ou estilo pincel) e etiquetas de gôndola.
// Tocar num cartaz da prévia abre a edição, como no jornal: preço, ajuste de cada parte
// (arrastar, aumentar e diminuir), modelo, palavra grande e textos.
// O texto e o ajuste ficam só no cartaz (campos `cartaz` e `ajusteCartaz` do produto);
// preço e unidade valem para o produto todo (jornal, artes e cartazes).

const paraCampo = (v) => (v == null || v === '' ? '' : String(Number(v).toFixed(2)).replace('.', ','))

export default function Cartazes() {
  const navigate = useNavigate()
  const store = useStore()
  const { produtos, ofertaDoProduto, toast, salvarProduto, salvarConfig, config } = store
  const [periodoDe, setPeriodoDe] = useState(() => dataISOmaisDias(0))
  const [periodoAte, setPeriodoAte] = useState(() => dataISOmaisDias(6))
  const [editando, setEditando] = useState(null) // id do produto
  const [rascunho, setRascunho] = useState(null)
  const [usarComoPadrao, setUsarComoPadrao] = useState(false)

  const modeloPadrao = config?.cartazModelo || 'classico'
  const orientacao = config?.cartazOrientacao || 'retrato'
  const ajustePadrao = config?.ajusteCartazPadrao || null

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
      ajusteCartaz: p.ajusteCartaz || ajustePadrao || undefined,
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
    [originais, ajustePadrao],
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
      ajuste: p.ajusteCartaz || ajustePadrao,
    })
    setUsarComoPadrao(!p.ajusteCartaz && Boolean(ajustePadrao))
  }
  const fechar = () => { setEditando(null); setRascunho(null) }
  const mudar = (campo, valor) => setRascunho((r) => ({ ...r, [campo]: valor }))

  const modeloDoRascunho = rascunho?.modelo || modeloPadrao
  const previa = original && rascunho ? comAjustesDoCartaz({
    ...original,
    unidade: rascunho.unidade,
    precoNormal: paraNumero(rascunho.precoNormal) ?? original.precoNormal,
    precoPromo: rascunho.precoPromo === '' ? null : (paraNumero(rascunho.precoPromo) ?? original.precoPromo),
    ajusteCartaz: rascunho.ajuste || undefined,
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
      // Predefinido: o ajuste vale para todos os cartazes que não têm ajuste próprio.
      ajusteCartaz: usarComoPadrao ? null : (rascunho.ajuste || null),
      cartaz: {
        // Guarda só o que difere do cadastro, para o cartaz acompanhar o produto.
        nome: nome && nome !== original.nome ? nome : '',
        marca: rascunho.marca !== (original.marca ?? '') ? rascunho.marca : undefined,
        gramagem: rascunho.gramagem !== (original.gramagem ?? '') ? rascunho.gramagem : undefined,
        chamada: rascunho.chamada.trim(),
        modelo: rascunho.modelo,
      },
    })
    if (usarComoPadrao) salvarConfig({ ajusteCartazPadrao: rascunho.ajuste || null })
    toast(usarComoPadrao ? `Cartaz salvo. O ajuste vale para todos os cartazes.` : `Cartaz de ${nome || original.nome} salvo.`)
    fechar()
  }

  const voltarAoOriginal = () => {
    salvarProduto({ id: original.id, cartaz: null, ajusteCartaz: null })
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
        subtitulo="Escolha o modelo e o tamanho. Toque num cartaz da prévia para mudar o preço, aumentar, diminuir ou mover cada parte."
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
        largura="max-w-4xl"
        footer={original && rascunho && (
          <>
            {(original.cartaz || original.ajusteCartaz) && (
              <button type="button" onClick={voltarAoOriginal} className="mr-auto inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-ink-soft hover:bg-cream-200">
                <Icon name="RotateCcw" size={15} /> Voltar ao cadastro
              </button>
            )}
            <Botao variante="contorno" onClick={fechar}>Cancelar</Botao>
            <Botao onClick={salvar}><Icon name="Save" size={15} /> Salvar cartaz</Botao>
          </>
        )}
      >
        {original && rascunho && previa && (
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-5">
              <div>
                <p className="mb-2 text-sm font-semibold text-ink">Preço no cartaz</p>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Preço normal (de)">
                    <input className={inputCls} inputMode="decimal" value={rascunho.precoNormal} onChange={(e) => mudar('precoNormal', e.target.value)} />
                  </Campo>
                  <Campo label="Preço da oferta (por)">
                    <input className={inputCls} inputMode="decimal" value={rascunho.precoPromo} disabled={temOferta} placeholder={temOferta ? 'vem da oferta' : 'sem oferta'} onChange={(e) => mudar('precoPromo', e.target.value)} />
                  </Campo>
                </div>
                <p className="mt-1.5 text-xs text-ink-soft">{temOferta ? 'Este produto está numa oferta da aba Ofertas: o preço de oferta sai do desconto dela.' : 'Deixe o preço da oferta vazio para mostrar só o preço normal.'}</p>
                <div className="mt-3">
                  <Segmentado rotulo="Vendido por" valor={rascunho.unidade} onChange={(v) => mudar('unidade', v)} opcoes={[['UN', 'Por unidade'], ['KG', 'Por quilo (KG)'], ...(original.unidade && !['UN', 'KG'].includes(original.unidade) ? [[original.unidade, `Por ${original.unidade}`]] : [])]} />
                </div>
              </div>

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
            </div>

            <div className="min-w-0 md:sticky md:top-0 md:self-start">
              <p className="mb-2 text-sm font-semibold text-ink">Ajustar no cartaz</p>
              <EditorCartaz
                largura={orientacao === 'paisagem' ? 562 : 397}
                altura={orientacao === 'paisagem' ? 397 : 562}
                ajuste={rascunho.ajuste}
                onChange={(a) => mudar('ajuste', a)}
                desenhar={(a) => <CartazModelo produto={{ ...previa, ajusteCartaz: a || ajustePadrao || undefined }} modelo={modeloDoRascunho} w={orientacao === 'paisagem' ? 562 : 397} h={orientacao === 'paisagem' ? 397 : 562} encarte={encarte} loja={loja} />}
              />
              <button
                type="button"
                role="switch"
                aria-checked={usarComoPadrao}
                onClick={() => setUsarComoPadrao((v) => !v)}
                className="mt-3 flex w-full items-center gap-3 rounded-xl border border-ink-soft/20 bg-white px-3 py-2.5 text-left hover:border-ink-soft/45"
              >
                <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150 motion-reduce:transition-none ${usarComoPadrao ? 'bg-success' : 'bg-ink-soft/30'}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-150 motion-reduce:transition-none ${usarComoPadrao ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">Usar como predefinido</span>
                  <span className="block text-xs text-ink-soft">{usarComoPadrao ? 'Ligado: este ajuste vale para todos os cartazes que não têm ajuste próprio.' : 'Desligado: o ajuste vale só para este cartaz.'}</span>
                </span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
