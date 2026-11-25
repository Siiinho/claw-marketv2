import { useState, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useStore, podeEditar } from '../store/StoreContext'
import { Icon, StatusBadge, ProdutoThumb, EmptyState, Botao, Modal, Campo, inputCls, Pill, Abas, Segmentado, Acao } from '../components/ui'
import {
  SETORES, setorById, formatBRL, formatData, formatDataCurta, arquivoParaDataURL, dataISOmaisDias,
  diasParaVencer, plural, loteResolvido, precisaDecisao, dataCadastro, todasBaixas, regraDaMarca,
} from '../lib/utils'
import {
  buscarImagemProduto,
  buscarProdutoCatalogo,
} from '../lib/produtoApi'
import { importarPlanilha } from '../lib/importarCatalogo'
import ModalBaixa from '../components/ModalBaixa'
import FotoGoogle from '../components/FotoGoogle'
import SugestaoPreco from '../components/SugestaoPreco'

const vazio = {
  nome: '', marca: '', gramagem: '', setor: 'mercearia', estoque: 0, validade: '',
  precoNormal: '', precoPromo: '', codigoBarras: '', imagem: null,
}

const RECENTE_DIAS = 7

const TONS_AVISO = {
  vencido: { borda: 'border-[#7a1010]', fundo: 'bg-[#7a1010]', cor: '#7a1010' },
  critico: { borda: 'border-[#ff9d00]', fundo: 'bg-[#ffb020]', cor: '#3d2600', texto: '#3d2600' },
}
function Aviso({ tom, icone, titulo, texto, acao }) {
  const t = TONS_AVISO[tom]
  return (
    <div role="status" className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 sm:flex-nowrap sm:p-4 ${t.borda} ${t.fundo}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white" style={{ color: t.cor }}>
        <Icon name={icone} size={20} strokeWidth={2.1} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-extrabold leading-snug" style={{ color: t.texto || '#fff' }}>{titulo}</p>
        <p className="mt-0.5 text-sm font-semibold leading-snug" style={{ color: t.texto || '#fff' }}>{texto}</p>
      </div>
      <div className="w-full sm:w-auto [&>button]:w-full">{acao}</div>
    </div>
  )
}

function Explica({ icone, cor, titulo, texto }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-ink-soft/15 bg-white p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cream-200" style={{ color: cor }}><Icon name={icone} size={18} strokeWidth={2} /></span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-ink">{titulo}</p>
        <p className="text-sm leading-snug text-ink-soft">{texto}</p>
      </div>
    </div>
  )
}

function Preco({ p }) {
  return (
    <div className="num-tab whitespace-nowrap">
      <div className={`font-bold ${p.precoPromo ? 'text-success' : 'text-ink'}`}>{formatBRL(p.precoPromo || p.precoNormal)}</div>
      {p.precoPromo ? <div className="text-xs text-ink-soft line-through">{formatBRL(p.precoNormal)}</div> : null}
    </div>
  )
}

// "hoje", "ontem", "há 3 dias" ou a data.
function quando(iso) {
  const t = Date.parse(iso || '')
  if (!Number.isFinite(t)) return ''
  const d = new Date(t)
  const dia = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const n = Math.round((dia(new Date()) - dia(d)) / 86400000)
  if (n <= 0) return `hoje, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  if (n === 1) return 'ontem'
  if (n < 7) return `há ${n} dias`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export default function Produtos() {
  const { produtos, usuario, lojas, lojaAtiva, config, salvarProduto, excluirProduto, desfazerBaixa, toast } = useStore()
  const lojaNome = (id) => lojas.find((l) => l.id === id)?.nome || '—'
  const { busca } = useOutletContext()
  const editavel = podeEditar(usuario.papel)

  const [fSetor, setFSetor] = useState('')
  const [aba, setAba] = useState('todos')
  const [diasJanela, setDiasJanela] = useState(() => Number(config?.diasAlerta) || 7)
  const [baixa, setBaixa] = useState(null) // { produto, tipo: 'troca' | 'perda' }
  const [form, setForm] = useState(null)
  const [excluindo, setExcluindo] = useState(null)
  const [buscandoCatalogo, setBuscandoCatalogo] = useState(false)
  const [importacao, setImportacao] = useState(null) // { texto, res, comImagens, rodando, progresso }

  const abrirImport = () => setImportacao({ texto: '', res: null, comImagens: false, rodando: false, progresso: 0 })

  const lerArquivoImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fr = new FileReader()
    fr.onload = () => analisarImport(String(fr.result))
    fr.readAsText(file, 'utf-8')
  }

  const analisarImport = (texto) => {
    const res = importarPlanilha(texto)
    setImportacao((s) => ({ ...s, texto, res }))
  }

  const confirmarImport = async () => {
    const prods = importacao?.res?.produtos || []
    if (!prods.length) return
    const lojaPadrao = lojaAtiva !== 'todas' ? lojaAtiva : lojas[0].id
    setImportacao((s) => ({ ...s, rodando: true, progresso: 0 }))
    let imgN = 0
    for (let i = 0; i < prods.length; i++) {
      const p = { ...prods[i] }
      if (!p.validade) p.validade = dataISOmaisDias(30)
      if (importacao.comImagens && p.codigoBarras && imgN < 40) {
        imgN++
        try { const cat = await buscarProdutoCatalogo(p.codigoBarras); if (cat?.encontrado && cat.imagem) p.imagem = cat.imagem } catch (_) {}
      }
      salvarProduto({ ...p, loja: lojaPadrao })
      if (i % 10 === 0) setImportacao((s) => ({ ...s, progresso: i + 1 }))
    }
    toast(`${prods.length === 1 ? '1 produto importado' : `${prods.length} produtos importados`} do catálogo!`)
    setImportacao(null)
  }

  const buscarCatalogo = async () => {
    if (!form.codigoBarras) return toast('Digite o código de barras.', 'erro')
    setBuscandoCatalogo(true)
    const res = await buscarProdutoCatalogo(form.codigoBarras)
    setBuscandoCatalogo(false)
    if (!res) return toast('Catálogo indisponível agora.', 'erro')
    if (!res.encontrado) return toast('Produto não encontrado no catálogo.', 'info')
    setForm((f) => ({
      ...f,
      nome: res.nome || f.nome,
      marca: res.marca || f.marca,
      setor: res.setor || f.setor,
      imagem: res.imagem || f.imagem,
      imagemOrigem: res.origem || null,
      imagemOrigemNome: res.origemNome || null,
      imagemOriginal: res.imagemOriginal || null,
      imagemFonteUrl: res.imagemFonteUrl || null,
      imagemPaginaUrl: res.imagemPaginaUrl || null,
      imagemCorrespondencia: res.correspondencia || null,
      imagemAltaResolucao: Boolean(res.imagemAltaResolucao),
      codigoBarras: res.codigoBarras,
    }))
    toast('Produto importado do catálogo!')
  }

  const atualizarEmbalagem = async () => {
    if (!form.codigoBarras) return toast('Informe o código de barras do produto.', 'erro')
    setBuscandoCatalogo(true)
    const foto = await buscarImagemProduto(form, { forcarAtualizacao: true })
    setBuscandoCatalogo(false)
    if (!foto?.imagem) return toast('Nenhuma embalagem exata foi localizada para este código.', 'info')
    setForm((f) => ({
      ...f,
      imagem: foto.imagem,
      imagemOrigem: foto.origem,
      imagemOrigemNome: foto.origemNome,
      imagemOriginal: foto.imagemOriginal,
      imagemFonteUrl: foto.imagemFonteUrl,
      imagemPaginaUrl: foto.imagemPaginaUrl,
      imagemLargura: foto.imagemLargura,
      imagemAltura: foto.imagemAltura,
      imagemAprovada: Boolean(foto.imagemAprovada),
      imagemCorrespondencia: foto.correspondencia,
      imagemAltaResolucao: Boolean(foto.imagemAltaResolucao),
      imagemIlustrativa: false,
      imagemCachePermanente: Boolean(foto.imagemCachePermanente),
      imagemTratada: Boolean(foto.imagemTratada),
      imagemTratamento: foto.imagemTratamento || null,
      imagemSalvaEm: foto.imagemSalvaEm,
    }))
    toast('Nova embalagem conferida e gravada!')
  }

  const RECENTE_MS = RECENTE_DIAS * 86400000
  const ehRecente = (p, agora) => { const c = Date.parse(dataCadastro(p) || ''); return Number.isFinite(c) && c >= agora - RECENTE_MS }
  const naJanela = (p) => { const d = diasParaVencer(p.validade); return d != null && d >= 0 && d <= diasJanela && !loteResolvido(p) }

  const contagem = useMemo(() => {
    const agora = Date.now()
    let recentes = 0, vencendo = 0, vencidos = 0, urgentes = 0
    for (const p of produtos) {
      if (ehRecente(p, agora)) recentes++
      if (naJanela(p)) vencendo++
      if (precisaDecisao(p)) vencidos++
      const d = diasParaVencer(p.validade)
      if (d != null && d >= 0 && d <= 2 && !loteResolvido(p)) urgentes++
    }
    return { recentes, vencendo, vencidos, urgentes }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtos, diasJanela])

  const passaFiltro = (p, b) => {
    if (fSetor && p.setor !== fSetor) return false
    if (b && !`${p.nome} ${p.marca}`.toLowerCase().includes(b)) return false
    return true
  }

  const lista = useMemo(() => {
    const b = (busca || '').toLowerCase().trim()
    const agora = Date.now()
    let r = produtos.filter((p) => {
      if (!passaFiltro(p, b)) return false
      if (aba === 'recentes') return ehRecente(p, agora)
      if (aba === 'vencendo') return naJanela(p)
      if (aba === 'vencidos') return precisaDecisao(p)
      return true
    })
    if (aba === 'recentes') r = [...r].sort((x, y) => String(dataCadastro(y)).localeCompare(String(dataCadastro(x))))
    if (aba === 'vencendo' || aba === 'vencidos') r = [...r].sort((x, y) => diasParaVencer(x.validade) - diasParaVencer(y.validade))
    return r
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtos, fSetor, busca, aba, diasJanela])

  const baixas = useMemo(() => {
    const b = (busca || '').toLowerCase().trim()
    return todasBaixas(produtos).filter((x) => passaFiltro(x.produto, b))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtos, fSetor, busca])
  const somaBaixas = (tipo) => baixas.filter((x) => x.tipo === tipo).reduce((s, x) => s + (Number(x.valor) || 0), 0)
  const contaBaixas = (tipo) => baixas.filter((x) => x.tipo === tipo).reduce((s, x) => s + (Number(x.quantidade) || 0), 0)

  const abrirNovo = () => setForm({ ...vazio, loja: lojaAtiva !== 'todas' ? lojaAtiva : lojas[0].id })
  const abrirEditar = (p) =>
    setForm({ ...p, precoNormal: p.precoNormal ?? '', precoPromo: p.precoPromo ?? '' })

  const salvar = (e) => {
    e.preventDefault()
    if (!form.nome || !form.setor || !form.validade || !form.precoNormal) {
      toast('Preencha nome, setor, validade e preço.', 'erro')
      return
    }
    salvarProduto({
      ...form,
      estoque: Number(form.estoque) || 0,
      precoNormal: Number(form.precoNormal),
      precoPromo: form.precoPromo ? Number(form.precoPromo) : null,
    })
    toast(form.id ? 'Produto atualizado!' : 'Produto cadastrado!')
    setForm(null)
  }

  const confirmarExcluir = () => {
    excluirProduto(excluindo.id)
    toast('Produto excluído.', 'info')
    setExcluindo(null)
  }

  const abrirBaixa = (p, tipo) => setBaixa({ produto: p, tipo })
  const desfazer = (x) => {
    desfazerBaixa(x.produtoId, x.id)
    toast(`Desfeito: ${plural(Number(x.quantidade) || 0, 'unidade voltou', 'unidades voltaram')} ao estoque de ${x.produto.nome}.`, 'info')
  }

  const aoEnviarFoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await arquivoParaDataURL(file)
      setForm((f) => ({
        ...f,
        imagem: dataUrl,
        imagemManual: true,
        imagemAprovada: true,
        imagemTratada: true,
        imagemTratamento: 'imagem-manual-livre-v1',
        imagemAltaResolucao: null,
        imagemOrigem: 'upload-manual',
        imagemOrigemNome: 'Imagem adicionada manualmente',
      }))
    } catch {
      toast('Não foi possível ler a imagem.', 'erro')
    }
  }

  const AcoesProduto = ({ p }) => {
    const vencido = precisaDecisao(p)
    const sugestao = regraDaMarca(config, p.marca)
    return (
      <>
        {vencido ? (
          <>
            {[
              <Acao key="troca" tom="troca" ativo={sugestao === 'troca'} icone="Repeat" onClick={() => abrirBaixa(p, 'troca')} aria-label={`Trocar ${p.nome} no fornecedor`} title={sugestao === 'troca' ? 'Sugerido: a marca aceita troca' : undefined}>Trocar no fornecedor</Acao>,
              <Acao key="perda" tom="perda" ativo={sugestao === 'perda'} icone="PackageX" onClick={() => abrirBaixa(p, 'perda')} aria-label={`Descartar ${p.nome} como perda`} title={sugestao === 'perda' ? 'Sugerido: a marca não aceita troca' : undefined}>Descartar</Acao>,
            ][sugestao === 'perda' ? 'reverse' : 'slice']()}
          </>
        ) : (
          <>
            {naJanela(p) && (
              <Acao tom="troca" icone="Repeat" onClick={() => abrirBaixa(p, 'troca')} aria-label={`Pedir troca de ${p.nome} ao fornecedor`}>Pedir troca</Acao>
            )}
          </>
        )}
        {editavel && <Acao icone="Pencil" onClick={() => abrirEditar(p)} aria-label={`Editar ${p.nome}`}>Editar</Acao>}
      </>
    )
  }

  const opcoesDias = [...new Set([2, 7, 15, 30, Number(config?.diasAlerta) || 7])].sort((a, b) => a - b)
  const abas = [
    { id: 'todos', rotulo: 'Todos', icone: 'LayoutList' },
    { id: 'recentes', rotulo: 'Adicionados recentemente', rotuloCurto: 'Recentes', icone: 'Clock', badge: contagem.recentes },
    { id: 'vencendo', rotulo: `Vence em ${diasJanela} dias`, rotuloCurto: `Vence em ${diasJanela}d`, icone: 'CalendarClock', badge: contagem.vencendo },
    { id: 'vencidos', rotulo: 'Vencidos', icone: 'CalendarX', badge: contagem.vencidos },
    { id: 'baixas', rotulo: 'Trocas e perdas', icone: 'ClipboardList' },
  ]
  const vazioPorAba = {
    todos: ['Nenhum produto encontrado', 'Ajuste o setor ou a busca, ou cadastre um novo produto.'],
    recentes: ['Nada novo nos últimos 7 dias', 'Os produtos cadastrados, importados ou bipados aparecem aqui primeiro.'],
    vencendo: [`Nada vence nos próximos ${diasJanela} dias`, 'Troque a quantidade de dias acima para olhar mais longe.'],
    vencidos: ['Nenhum vencido esperando decisão', 'Quando um produto vencer, ele aparece aqui para você trocar ou descartar.'],
  }

  return (
    <div className="space-y-4">
      <Abas itens={abas} valor={aba} onChange={setAba} rotulo="Listas de produtos" className="flex-wrap md:flex-nowrap" />

      {contagem.vencidos > 0 && aba !== 'vencidos' && aba !== 'baixas' ? (
        <Aviso
          tom="vencido"
          icone="TriangleAlert"
          titulo={`${plural(contagem.vencidos, 'produto vencido', 'produtos vencidos')} esperando decisão`}
          texto="Escolha para cada um: trocar no fornecedor ou descartar como perda."
          acao={<Botao variante="escuro" onClick={() => setAba('vencidos')}>Decidir agora</Botao>}
        />
      ) : contagem.urgentes > 0 && aba === 'todos' ? (
        <Aviso
          tom="critico"
          icone="AlarmClock"
          titulo={`${plural(contagem.urgentes, 'produto vence', 'produtos vencem')} em até 2 dias`}
          texto="Peça troca ao fornecedor ou ponha em oferta no Jornal antes de vencer."
          acao={<Botao variante="escuro" onClick={() => { setDiasJanela(2); setAba('vencendo') }}>Ver quais são</Botao>}
        />
      ) : null}

      {aba === 'vencidos' && lista.length > 0 && (
        <div className="hidden gap-2 sm:grid sm:grid-cols-2">
          <Explica icone="Repeat" cor="var(--color-info)" titulo="Trocar no fornecedor" texto="O fornecedor recolhe ou troca. Sai do estoque e não conta como perda." />
          <Explica icone="PackageX" cor="var(--color-critical)" titulo="Descartar" texto="Sai do estoque e entra como perda nos relatórios e no desperdício." />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <select value={fSetor} onChange={(e) => setFSetor(e.target.value)} aria-label="Setor" className={`${inputCls.replace('w-full ', '')} min-w-0 flex-1 sm:w-auto sm:flex-none`}>
          <option value="">Todos os setores</option>
          {SETORES.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
        {aba === 'vencendo' && (
          <Segmentado
            rotulo="Vence em quantos dias"
            opcoes={opcoesDias.map((n) => [n, `${n} dias`])}
            valor={diasJanela}
            onChange={setDiasJanela}
          />
        )}
        <span className="num-tab text-sm font-semibold text-ink-soft">
          {aba === 'baixas' ? plural(baixas.length, 'registro', 'registros') : plural(lista.length, 'produto', 'produtos')}
        </span>
        {editavel && (
          <div className="grid w-full grid-cols-2 gap-2 sm:ml-auto sm:flex sm:w-auto">
            <Botao variante="contorno" onClick={abrirImport}><Icon name="Upload" size={16} /> <span className="sm:hidden">Importar</span><span className="hidden sm:inline">Importar planilha</span></Botao>
            <Botao onClick={abrirNovo}><Icon name="Plus" size={16} /> Novo produto</Botao>
          </div>
        )}
      </div>

      {aba === 'baixas' ? (
        <div className="card-bengala overflow-hidden">
          {baixas.length === 0 ? (
            <div className="p-6">
              <EmptyState icon="ClipboardList" titulo="Nenhuma troca ou perda registrada" descricao="Na aba Vencidos, cada produto tem os botões Trocar no fornecedor e Descartar." />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 border-b border-ink-soft/10">
                <div className="p-4">
                  <div className="text-sm font-semibold text-ink-soft">Perdas registradas</div>
                  <div className="num-tab display-bengala mt-1 text-[24px] leading-tight text-critical">{formatBRL(somaBaixas('perda'))}</div>
                  <div className="num-tab text-xs text-ink-soft">{plural(contaBaixas('perda'), 'unidade descartada', 'unidades descartadas')}</div>
                </div>
                <div className="border-l border-ink-soft/10 p-4">
                  <div className="text-sm font-semibold text-ink-soft">Trocas no fornecedor</div>
                  <div className="num-tab display-bengala mt-1 text-[24px] leading-tight text-info">{formatBRL(somaBaixas('troca'))}</div>
                  <div className="num-tab text-xs text-ink-soft">{plural(contaBaixas('troca'), 'unidade devolvida', 'unidades devolvidas')}, sem perda</div>
                </div>
              </div>
              <ul className="divide-y divide-ink-soft/8">
                {baixas.map((x) => (
                  <li key={x.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <ProdutoThumb produto={x.produto} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-ink">{x.produto.nome}</div>
                      <div className="text-xs text-ink-soft">
                        {[quando(x.em), x.validade && `validade ${formatDataCurta(x.validade)}`, x.usuarioNome, x.motivo].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <Pill cor={x.tipo === 'perda' ? '#a61f1f' : '#1f5c99'} bg={x.tipo === 'perda' ? '#fbe5e5' : '#e3eefa'}>
                      {x.tipo === 'perda' ? 'Perda' : 'Troca'}
                    </Pill>
                    <div className="num-tab w-24 text-right">
                      <div className="font-bold text-ink">{formatBRL(x.valor)}</div>
                      <div className="text-xs text-ink-soft">{plural(Number(x.quantidade) || 0, 'un', 'un')}</div>
                    </div>
                    {editavel && <Acao icone="Undo2" onClick={() => desfazer(x)} aria-label={`Desfazer registro de ${x.produto.nome}`}>Desfazer</Acao>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : (
        <div className="card-bengala overflow-hidden">
          {lista.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={aba === 'vencidos' ? 'CircleCheck' : 'Inbox'}
                titulo={vazioPorAba[aba][0]}
                descricao={vazioPorAba[aba][1]}
                acao={aba === 'todos' && editavel && <Botao onClick={abrirNovo}><Icon name="Plus" size={16} /> Novo produto</Botao>}
              />
            </div>
          ) : (
            <>
              {/* tabela (telas largas) */}
              <table className="hidden w-full text-sm lg:table">
                <thead>
                  <tr className="border-b border-ink-soft/10 bg-cream/60 text-left text-xs text-ink-soft">
                    <th className="px-4 py-3 font-semibold">Produto</th>
                    <th className="px-4 py-3 text-right font-semibold">Estoque</th>
                    <th className="px-4 py-3 font-semibold">Validade</th>
                    <th className="px-4 py-3 text-right font-semibold">Preço</th>
                    <th className="px-4 py-3 text-right font-semibold">O que fazer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-soft/8">
                  {lista.map((p) => (
                    <tr key={p.id} className="hover:bg-cream-200/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <ProdutoThumb produto={p} size={44} />
                          <div className="min-w-0">
                            <div className="font-semibold text-ink">{p.nome}</div>
                            <div className="text-xs text-ink-soft">
                              {[p.marca, setorById(p.setor).nome, lojas.length > 1 && lojaNome(p.loja), aba === 'recentes' && dataCadastro(p) && `adicionado ${quando(dataCadastro(p))}`].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="num-tab px-4 py-3 text-right font-semibold">{p.estoque ?? 0}<span className="ml-0.5 text-xs font-medium text-ink-soft">un</span></td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge validade={p.validade} />
                        {p.validade && <div className="num-tab mt-1 text-xs text-ink-soft">{formatData(p.validade)}</div>}
                      </td>
                      <td className="px-4 py-3 text-right"><Preco p={p} /></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-1.5"><AcoesProduto p={p} /></div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* cartões (celular e tablet) */}
              <ul className="divide-y divide-ink-soft/10 lg:hidden">
                {lista.map((p) => (
                  <li key={p.id} className="px-3 py-3 sm:px-4">
                    <div className="flex items-start gap-3">
                      <ProdutoThumb produto={p} size={52} />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold leading-snug text-ink">{p.nome}</div>
                        <div className="mt-0.5 text-xs text-ink-soft">
                          {[p.marca, setorById(p.setor).nome, `${p.estoque ?? 0} un`, aba === 'recentes' && dataCadastro(p) && `adicionado ${quando(dataCadastro(p))}`].filter(Boolean).join(' · ')}
                        </div>
                        <div className="mt-1.5"><StatusBadge validade={p.validade} /></div>
                      </div>
                      <div className="shrink-0 text-right"><Preco p={p} /></div>
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-1.5"><AcoesProduto p={p} /></div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* modal novo/editar */}
      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        titulo={form?.id ? 'Editar produto' : 'Novo produto'}
        footer={
          <>
            {form?.id && editavel && (
              <button type="button" onClick={() => { setExcluindo(form); setForm(null) }} className="mr-auto inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[#a61f1f] hover:bg-critical/10">
                <Icon name="Trash2" size={16} /> Excluir produto
              </button>
            )}
            <Botao variante="contorno" onClick={() => setForm(null)}>Cancelar</Botao>
            <Botao onClick={salvar}>Salvar</Botao>
          </>
        }
      >
        {form && (
          <form onSubmit={salvar} className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex items-center gap-3">
              {form.imagem
                ? <img src={form.imagem} alt="" className="h-16 w-16 shrink-0 rounded-lg bg-white object-contain" />
                : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-cream-200 text-ink-soft"><Icon name="ImagePlus" size={22} /></div>}
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex gap-2">
                  <label className="cursor-pointer rounded-lg border border-ink-soft/25 bg-white px-3 py-1.5 text-sm hover:bg-cream-200">
                    <Icon name="Upload" size={14} className="mr-1 inline" /> Enviar foto
                    <input type="file" accept="image/*" className="hidden" onChange={aoEnviarFoto} />
                  </label>
                  {form.nome && (
                    <button
                      type="button"
                      onClick={atualizarEmbalagem}
                      disabled={buscandoCatalogo}
                      className="rounded-lg border border-bengala/25 bg-bengala/5 px-3 py-1.5 text-sm font-medium text-bengala hover:bg-bengala/10 disabled:opacity-50"
                      title="Use somente quando a embalagem do produto tiver mudado"
                    >
                      <Icon name={buscandoCatalogo ? 'LoaderCircle' : 'RefreshCw'} size={14} className={`mr-1 inline ${buscandoCatalogo ? 'animate-spin' : ''}`} />
                      Embalagem mudou
                    </button>
                  )}
                  {form.imagem && <button type="button" onClick={() => setForm({ ...form, imagem: null })} className="rounded-lg px-2 py-1.5 text-sm text-critical hover:bg-critical/10">Remover</button>}
                </div>
                <FotoGoogle produto={form} toast={toast} salvaNaHora={Boolean(form.id)} onFoto={(foto) => { if (form.id) salvarProduto({ id: form.id, ...foto }); setForm((f) => (f ? { ...f, ...foto } : f)) }} />
                {(form.imagemPaginaUrl || form.imagemFonteUrl) && (
                  <a
                    href={form.imagemPaginaUrl || form.imagemFonteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-info underline underline-offset-2"
                  >
                    <Icon name="ExternalLink" size={12} /> Ver origem da imagem
                  </a>
                )}
              </div>
            </div>
            <div className="col-span-2"><Campo label="Nome" obrigatorio><input className={inputCls} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Campo></div>
            <Campo label="Marca"><input className={inputCls} value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} /></Campo>
            <Campo label="Gramagem"><input className={inputCls} value={form.gramagem || ''} onChange={(e) => setForm({ ...form, gramagem: e.target.value })} placeholder="Ex.: 350 g" /></Campo>
            <div className="col-span-2"><Campo label="Setor" obrigatorio>
              <select className={inputCls} value={form.setor} onChange={(e) => setForm({ ...form, setor: e.target.value })}>
                {SETORES.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </Campo></div>
            <div className="col-span-2">
              <Campo label="Loja" obrigatorio>
                <select className={inputCls} value={form.loja || lojas[0].id} onChange={(e) => setForm({ ...form, loja: e.target.value })}>
                  {lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                </select>
              </Campo>
            </div>
            <Campo label="Estoque"><input type="number" className={inputCls} value={form.estoque} onChange={(e) => setForm({ ...form, estoque: e.target.value })} /></Campo>
            <Campo label="Validade" obrigatorio><input type="date" className={inputCls} value={form.validade} onChange={(e) => setForm({ ...form, validade: e.target.value })} /></Campo>
            <Campo label="Preço normal (R$)" obrigatorio><input type="number" step="0.01" className={inputCls} value={form.precoNormal} onChange={(e) => setForm({ ...form, precoNormal: e.target.value })} /></Campo>
            <Campo label="Preço de oferta (R$)"><input type="number" step="0.01" className={inputCls} value={form.precoPromo} onChange={(e) => setForm({ ...form, precoPromo: e.target.value })} /></Campo>
            <SugestaoPreco className="col-span-2" precoNormal={form.precoNormal} validade={form.validade} precoAtual={form.precoPromo} onUsar={(v) => setForm((f) => ({ ...f, precoPromo: v }))} />
            <div className="col-span-2 rounded-lg border border-info/25 bg-info/5 p-2.5">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-info">
                <Icon name="PackageSearch" size={14} /> Importar do catálogo (mercado BR) por código de barras
              </div>
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  value={form.codigoBarras}
                  onChange={(e) => setForm({ ...form, codigoBarras: e.target.value })}
                  placeholder="Ex.: 7894900011517"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscarCatalogo() } }}
                />
                <Botao variante="contorno" type="button" onClick={buscarCatalogo} disabled={buscandoCatalogo} className="shrink-0">
                  <Icon name={buscandoCatalogo ? 'Loader' : 'Search'} size={15} className={buscandoCatalogo ? 'animate-spin' : ''} />
                  {buscandoCatalogo ? '...' : 'Buscar'}
                </Botao>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* modal excluir */}
      <Modal
        open={!!excluindo}
        onClose={() => setExcluindo(null)}
        titulo="Excluir produto"
        footer={
          <>
            <Botao variante="contorno" onClick={() => setExcluindo(null)}>Cancelar</Botao>
            <Botao variante="perigo" onClick={confirmarExcluir}>Excluir</Botao>
          </>
        }
      >
        <p className="text-sm text-ink">
          Excluir <span className="font-medium">{excluindo?.nome}</span>? Esta ação não pode ser desfeita.
        </p>
      </Modal>

      <ModalBaixa pedido={baixa} onClose={() => setBaixa(null)} />

      {/* modal importar planilha (Cartaz Fácil / ERP) */}
      <Modal
        open={!!importacao}
        onClose={() => importacao && !importacao.rodando && setImportacao(null)}
        titulo="Importar catálogo (planilha)"
        largura="max-w-xl"
        footer={importacao && (
          <>
            <Botao variante="contorno" onClick={() => setImportacao(null)} disabled={importacao.rodando}>Cancelar</Botao>
            <Botao onClick={confirmarImport} disabled={importacao.rodando || !importacao.res?.produtos?.length}>
              {importacao.rodando ? 'Importando...' : `Importar ${importacao.res?.produtos?.length || 0}`}
            </Botao>
          </>
        )}
      >
        {importacao && (
          <div className="space-y-3">
            <p className="text-sm text-ink-soft">
              Exporte os produtos do <strong>Cartaz Fácil</strong> ou do ERP (CSV, Excel ou TXT), envie o arquivo
              ou cole o conteúdo. O sistema detecta as colunas (nome, código de barras, preço, setor…).
            </p>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer rounded-lg border border-ink-soft/25 bg-white px-3 py-1.5 text-sm hover:bg-cream-200">
                <Icon name="Upload" size={14} className="mr-1 inline" /> Enviar arquivo (.csv/.txt)
                <input type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={lerArquivoImport} />
              </label>
              <span className="text-xs text-ink-soft">ou cole abaixo</span>
            </div>
            <textarea
              value={importacao.texto}
              onChange={(e) => analisarImport(e.target.value)}
              placeholder={'nome;codigo de barras;preco;setor\nLeite Integral 1L;7898215151708;5,49;laticinios'}
              className={`${inputCls} h-28 font-mono text-xs`}
            />
            {importacao.res?.erro && <p className="text-sm text-critical">{importacao.res.erro}</p>}
            {importacao.res?.produtos?.length > 0 && (
              <div className="rounded-lg border border-success/25 bg-success/5 p-3">
                <p className="text-sm font-medium text-success">{importacao.res.produtos.length === 1 ? '1 produto detectado' : `${importacao.res.produtos.length} produtos detectados`}</p>
                <ul className="mt-1 max-h-28 overflow-y-auto text-xs text-ink-soft">
                  {importacao.res.produtos.slice(0, 8).map((p, i) => (
                    <li key={i} className="truncate">• {p.nome} — {setorById(p.setor).nome} — {formatBRL(p.precoNormal)}</li>
                  ))}
                  {importacao.res.produtos.length > 8 && <li>…e mais {importacao.res.produtos.length - 8}</li>}
                </ul>
                <label className="mt-2 flex items-center gap-2 text-xs text-ink">
                  <input type="checkbox" checked={importacao.comImagens} onChange={(e) => setImportacao((s) => ({ ...s, comImagens: e.target.checked }))} className="h-4 w-4 accent-bengala" />
                  Buscar imagens pelo código de barras (mais lento, até 40)
                </label>
              </div>
            )}
            {importacao.rodando && <p className="text-sm text-ink-soft">Importando… {importacao.progresso}</p>}
          </div>
        )}
      </Modal>
    </div>
  )
}
