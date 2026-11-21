import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/StoreContext'
import { Icon, StatusBadge, ProdutoThumb, Botao, PrecoVarejo, inputCls } from '../components/ui'
import { setorById, formatBRL, formatData, statusValidade, diasParaVencer, regraDoProduto, precoComRegra, labelDias, dataISOmaisDias } from '../lib/utils'
import EstrelaMercado from '../components/EstrelaMercado'

const CHAVE_ESTRELA = 'clawmarket.scanner.estrela'
function lerEstrela() {
  try { return localStorage.getItem(CHAVE_ESTRELA) === '1' } catch { return false }
}
import { buscarProdutoBengala } from '../lib/catalogoBengala'
import { useLeitorCamera } from '../lib/useLeitorCamera'
import { buscarImagemProduto, buscarProdutoAutomatizado, imagemProdutoPrecisaTratamento, prepararProdutoParaJornal } from '../lib/produtoApi'

export default function Scanner() {
  const navigate = useNavigate()
  const {
    produtos,
    salvarProduto,
    salvarProdutoNaFila,
    registrarLote,
    removerDaFila,
    criarOferta,
    excluirOferta,
    ofertaDoProduto,
    toast,
  } = useStore()
  const [codigo, setCodigo] = useState('')
  const [resultado, setResultado] = useState(undefined) // undefined | null | produto
  const [validadeLote, setValidadeLote] = useState('')
  const [codigoLote, setCodigoLote] = useState('')
  const [quantidadeLote, setQuantidadeLote] = useState('1')
  const [novoEstoque, setNovoEstoque] = useState('')
  const [veredito, setVeredito] = useState(null) // { tipo:'jornal'|'ok', desconto, precoNovo, dias }
  const [historico, setHistorico] = useState([]) // sessão de bipes
  // Estrela do Mercado Encarte: fica ligada entre um bipe e outro.
  const [estrela, setEstrelaEstado] = useState(lerEstrela)
  const setEstrela = (valor) => {
    setEstrelaEstado(valor)
    try { localStorage.setItem(CHAVE_ESTRELA, valor ? '1' : '0') } catch { /* sem armazenamento */ }
  }
  const [buscando, setBuscando] = useState(false)
  const inputRef = useRef(null)

  const buscar = async (cod) => {
    const c = (cod ?? codigo).trim()
    if (!c || buscando) return
    setBuscando(true)
    setResultado(undefined)
    setVeredito(null)
    setCodigo(c)

    try {
      let p = produtos.find((x) => x.codigoBarras === c)

      if (p && (!p.imagem || imagemProdutoPrecisaTratamento(p))) {
        if (!p.imagem) {
          const automatizado = await buscarProdutoAutomatizado(c, p)
          const foto = automatizado?.foto || await buscarImagemProduto(p, { ignorarBackend: true })
          if (foto?.imagem) {
            p = {
              ...p,
              marca: foto.marca || p.marca || '',
              imagem: foto.imagem,
              imagemOrigem: foto.origem,
              imagemOrigemNome: foto.origemNome,
              imagemOriginal: foto.imagemOriginal,
              imagemFonteUrl: foto.imagemFonteUrl,
              imagemPaginaUrl: foto.imagemPaginaUrl,
              imagemCorrespondencia: foto.correspondencia,
              imagemAltaResolucao: Boolean(foto.imagemAltaResolucao),
              imagemIlustrativa: Boolean(foto.imagemIlustrativa),
              imagemTratada: Boolean(foto.imagemTratada),
              imagemTratamento: foto.imagemTratamento,
              imagemCachePermanente: Boolean(foto.imagemCachePermanente),
              imagemSalvaEm: foto.imagemSalvaEm,
            }
          }
        } else {
          p = await prepararProdutoParaJornal(p)
        }
        salvarProduto(p)
      }

      if (!p) {
        const catalogoLocal = await buscarProdutoBengala(c)
        // com a foto do banco de imagens do mercado, não gasta crédito buscando foto fora
        const fotoLocal = catalogoLocal?.imagem ? { imagem: catalogoLocal.imagem, origem: 'catalogo', origemNome: catalogoLocal.imagemOrigemNome, imagemAprovada: true } : null
        const automatizado = fotoLocal ? null : await buscarProdutoAutomatizado(c, catalogoLocal)
        const catalogo = automatizado?.produto || catalogoLocal
        if (catalogo) {
          const foto = fotoLocal || automatizado?.foto || await buscarImagemProduto(catalogo, { ignorarBackend: true })
          p = {
            ...catalogo,
            id: `mercadologia-${catalogo.codigoInterno}`,
            loja: 'loja3',
            marca: foto?.marca || '',
            imagem: foto?.imagem || null,
            imagemOrigem: foto?.origem || null,
            imagemOrigemNome: foto?.origemNome || null,
            imagemOriginal: foto?.imagemOriginal || null,
            imagemFonteUrl: foto?.imagemFonteUrl || null,
            imagemPaginaUrl: foto?.imagemPaginaUrl || null,
            imagemLargura: foto?.imagemLargura || null,
            imagemAltura: foto?.imagemAltura || null,
            imagemAprovada: Boolean(foto?.imagemAprovada),
            imagemCorrespondencia: foto?.correspondencia || null,
            imagemAltaResolucao: Boolean(foto?.imagemAltaResolucao),
            imagemIlustrativa: Boolean(foto?.imagemIlustrativa),
            imagemTratada: Boolean(foto?.imagemTratada),
            imagemTratamento: foto?.imagemTratamento || null,
            imagemCachePermanente: Boolean(foto?.imagemCachePermanente),
            imagemSalvaEm: foto?.imagemSalvaEm || null,
            validade: '',
            naFila: false,
            origemFila: null,
          }
          salvarProduto(p)
          toast(
            foto?.imagem
              ? `${p.nome}: mercadologia e imagem vinculadas ao código ${p.codigoBarras}.`
              : `${p.nome}: mercadologia vinculada; imagem exata ainda não localizada.`,
            foto?.imagem ? 'sucesso' : 'info'
          )
        }
      }

      setResultado(p || null)
      setValidadeLote(p?.validade || '')
      setCodigoLote('')
      setQuantidadeLote('1')
      setNovoEstoque(p ? String(p.estoque) : '')
    } catch (_) {
      setResultado(null)
      toast('Não foi possível consultar o catálogo agora.', 'erro')
    } finally {
      setBuscando(false)
    }
  }

  // ---- o coração do fluxo de gôndola ----
  const confirmarComFeedback = () => {
    try {
      navigator.vibrate?.([80, 40, 120])
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (AudioCtx) {
        const ctx = new AudioCtx()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.frequency.value = 880
        gain.gain.setValueAtTime(0.04, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.16)
      }
    } catch (_) {}
  }

  const verificar = () => {
    if (!resultado || !validadeLote) return toast('Informe a validade do lote.', 'erro')
    if (veredito) return

    const quantidade = Math.max(1, Number(quantidadeLote) || 1)
    const dias = diasParaVencer(validadeLote)
    const regra = regraDoProduto(dias, config.regrasPreco || [])
    const origemFila = regra ? 'vencimento' : 'scanner'
    const jaEstavaNaFila = Boolean(resultado.naFila)
    const ofertaExistente = ofertaDoProduto(resultado.id)
    const atualizado = {
      ...resultado,
      loja: 'loja3',
      validade: validadeLote,
      estoque: Math.max(Number(resultado.estoque) || 0, quantidade),
      naFila: true,
      origemFila,
      ...(estrela ? { encarteMercadoDia: dataISOmaisDias(0) } : {}),
    }

    salvarProdutoNaFila(atualizado, origemFila)
    registrarLote({
      produtoId: resultado.id,
      loja: 'loja3',
      validade: validadeLote,
      codigoLote: codigoLote.trim(),
      quantidade,
    })
    if (regra && !ofertaExistente) {
      criarOferta(resultado.id, `Regra de validade · −${regra.desconto}%`, regra.desconto, validadeLote)
    }

    const v = {
      tipo: 'jornal',
      desconto: regra?.desconto || 0,
      precoNovo: regra ? precoComRegra(resultado.precoNormal, regra) : resultado.precoNormal,
      dias,
      jaEstavaNaFila,
      ofertaCriada: Boolean(regra && !ofertaExistente),
    }

    confirmarComFeedback()
    toast(
      jaEstavaNaFila
        ? `${resultado.nome}: validade atualizada; o produto já estava na fila.`
        : `${resultado.nome}: confirmado na fila do jornal da Loja 3.`
    )
    setVeredito(v)
    setResultado(atualizado)
    setHistorico((h) => [
      {
        id: `${resultado.id}-${validadeLote}-${Date.now()}`,
        produtoId: resultado.id,
        nome: resultado.nome,
        imagem: resultado.imagem,
        setor: resultado.setor,
        validade: validadeLote,
        quantidade,
        ...v,
      },
      ...h.filter((item) => item.produtoId !== resultado.id),
    ].slice(0, 20))
  }

  const proximo = () => {
    setResultado(undefined)
    setVeredito(null)
    setCodigo('')
    setValidadeLote('')
    setCodigoLote('')
    setQuantidadeLote('1')
    setNovoEstoque('')
    inputRef.current?.focus()
  }

  const desfazerUltimaConfirmacao = () => {
    if (!resultado || !veredito) return
    removerDaFila(resultado.id)
    const oferta = ofertaDoProduto(resultado.id)
    if (veredito.ofertaCriada && oferta) excluirOferta(oferta.id)
    setResultado((p) => ({ ...p, naFila: false, origemFila: null }))
    setHistorico((h) => h.filter((item) => item.produtoId !== resultado.id))
    setVeredito(null)
    toast('Confirmação desfeita. Confira os dados e confirme novamente.', 'info')
  }

  const atualizarEstoque = () => {
    salvarProduto({ ...resultado, estoque: Number(novoEstoque) || 0 })
    toast('Estoque atualizado!')
  }

  // ---- câmera ----
  const camera = useLeitorCamera(
    (cod) => { buscar(cod); toast(`Código lido: ${cod}`) },
    (mensagem) => toast(mensagem, 'erro'),
  )
  const scanning = camera.ativo
  const escanearCamera = () => (camera.ativo ? camera.parar() : camera.abrir())


  const naFilaSessao = historico.filter((h) => h.tipo === 'jornal').length

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-2xl bg-brick p-4 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-bengala">
            <Icon name="ScanLine" size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-offer px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-navy">
              <Icon name="Store" size={11} /> Piloto · Loja 3
            </div>
            <h2 className="font-bold">Escanear para o jornal</h2>
            <p className="text-sm text-cream/75">Bipe, confirme a validade e siga para o próximo. O resto é automático.</p>
          </div>
          <button onClick={() => navigate('/jornal')} className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/20">
            Ver fila
          </button>
        </div>
      </div>
      {/* busca */}
      <div className="card-bengala p-4">
        <div className="flex flex-wrap gap-2 sm:flex-nowrap">
          <div className="relative min-w-[180px] flex-1 basis-full sm:basis-auto">
            <Icon name="ScanLine" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              ref={inputRef}
              autoFocus
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && buscar()}
              placeholder="Bipe ou digite o código de barras..."
              className={`${inputCls} pl-9`}
            />
          </div>
          <Botao onClick={() => buscar()} disabled={buscando}>
            <Icon name={buscando ? 'LoaderCircle' : 'Search'} size={16} className={buscando ? 'animate-spin' : ''} />
            {buscando ? 'Buscando' : 'Buscar'}
          </Botao>
          <Botao variante={scanning ? 'perigo' : 'coral'} onClick={escanearCamera} title="Ler com a câmera">
            <Icon name={scanning ? 'X' : 'Camera'} size={16} />
            <span className="hidden sm:inline">{scanning ? 'Parar' : 'Câmera'}</span>
          </Botao>
        </div>

        {buscando && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-bengala/5 px-3 py-2 text-sm font-medium text-bengala">
            <Icon name="LoaderCircle" size={16} className="animate-spin" />
            Consultando o catálogo de produtos configurado...
          </div>
        )}

        {scanning && (
          <div className="mt-3 overflow-hidden rounded-xl border border-ink-soft/15 bg-black">
            <video ref={camera.videoRef} className="aspect-video w-full object-cover" muted playsInline autoPlay />
            <div className="flex items-center justify-center gap-2 bg-ink/80 py-1.5 text-xs text-cream">
              <Icon name="ScanLine" size={14} /> Aponte para o código de barras
            </div>
          </div>
        )}

        {produtos.length > 0 && <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-soft">Atalhos rápidos</p>
          <div className="flex flex-wrap gap-1.5">
            {produtos.slice(0, 8).map((p) => (
              <button key={p.id} onClick={() => buscar(p.codigoBarras)} className="rounded-lg bg-cream-200 px-2.5 py-1 text-xs text-ink hover:bg-coral/15 hover:text-coral-dark">
                {p.codigoBarras}
              </button>
            ))}
          </div>
        </div>}
      </div>

      {resultado === null && (
        <div className="anim-in flex items-center gap-3 rounded-xl border border-critical/30 bg-critical/10 px-4 py-3 text-critical">
          <Icon name="SearchX" size={20} /> Produto não encontrado no cadastro.
        </div>
      )}

      {/* produto + verificação de validade */}
      {resultado && (
        <div className="anim-in card-bengala p-5">
          <div className="flex items-center gap-4">
            <ProdutoThumb produto={resultado} size={64} />
            <div className="min-w-0 flex-1">
              <div className="text-lg font-bold text-ink">{resultado.nome}</div>
              <div className="text-sm text-ink-soft">{resultado.marca} · {setorById(resultado.setor).nome} · {formatBRL(resultado.precoNormal)}</div>
              <div className="mt-0.5 text-xs text-ink-soft">
                Código interno {resultado.codigoInterno || '—'} · Barras {resultado.codigoBarras}
              </div>
              <div className="mt-1"><StatusBadge validade={resultado.validade} /></div>
              {!resultado.imagem && (
                <div className="mt-1 text-xs font-medium text-warning">Foto exata ainda não localizada para este código.</div>
              )}
              {resultado.imagem && resultado.imagemCorrespondencia === 'codigo-exato' && (
                <div className="mt-1 flex items-center gap-1 text-xs font-medium text-success">
                  <Icon name="BadgeCheck" size={13} />
                  Foto exata confirmada pelo código de barras
                  {resultado.imagemAltaResolucao ? ' · alta resolução' : ''}
                </div>
              )}
            </div>
          </div>

          {/* passo-chave: validade do lote visto na gôndola */}
          <div className="mt-4 rounded-xl border-2 border-bengala/30 bg-bengala/5 p-3.5">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
              <Icon name="CalendarSearch" size={17} className="text-bengala" />
              Qual a validade impressa na embalagem?
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_100px]">
              <label>
                <span className="mb-1 block text-xs font-medium text-ink-soft">Validade *</span>
                <input
                  type="date"
                  value={validadeLote}
                  onChange={(e) => setValidadeLote(e.target.value)}
                  onInput={(e) => setValidadeLote(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === 'Enter' && verificar()}
                  className={`${inputCls} py-2.5 text-base`}
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-ink-soft">Lote (opcional)</span>
                <input value={codigoLote} onChange={(e) => setCodigoLote(e.target.value)} className={`${inputCls} py-2.5`} placeholder="Ex.: L2407" />
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-ink-soft">Quantidade</span>
                <input type="number" min="1" inputMode="numeric" value={quantidadeLote} onChange={(e) => setQuantidadeLote(e.target.value)} className={`${inputCls} py-2.5`} />
              </label>
            </div>
            <EstrelaMercado ativo={estrela} onChange={setEstrela} className="mt-3 w-full" texto="Estrela: entra também no Mercado Encarte de hoje" />
            <Botao onClick={verificar} disabled={Boolean(veredito)} className="mt-2 min-h-12 w-full justify-center px-5 py-3 text-base">
              <Icon name="Newspaper" size={18} /> {veredito ? 'Produto confirmado na fila' : 'Confirmar e adicionar ao jornal'}
            </Botao>
          </div>

          {/* veredito */}
          {veredito?.tipo === 'jornal' && (
            <div className="anim-in mt-3 overflow-hidden rounded-xl text-white" style={{ background: 'linear-gradient(135deg, #9e1f14, #e23a2e)' }}>
              <div className="flex items-center gap-3 p-4">
                <span className="chip flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
                  <Icon name="Newspaper" size={24} />
                </span>
                <div className="flex-1">
                  <div className="text-base font-bold leading-tight">
                    {veredito.jaEstavaNaFila ? 'Validade atualizada na fila!' : 'Confirmado no jornal da Loja 3!'}
                  </div>
                  <div className="text-sm text-white/85">
                    {labelDias(veredito.dias)}
                    {veredito.desconto > 0 ? ` · regra aplicada: −${veredito.desconto}%` : ' · preço aguardando revisão'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-white/75 line-through">{formatBRL(resultado.precoNormal)}</div>
                  <div className="inline-block rotate-[-2deg] rounded-md bg-white px-2 py-0.5">
                    <PrecoVarejo valor={veredito.precoNovo} className="text-2xl" cor="#c42b2b" />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 bg-black/20 px-4 py-2 text-xs">
                <span>{veredito.ofertaCriada ? 'Fila confirmada + oferta criada automaticamente' : 'Produto disponível imediatamente no Jornal de Ofertas'}</span>
                <div className="flex gap-1.5">
                  <button onClick={desfazerUltimaConfirmacao} className="rounded-lg bg-white/10 px-3 py-1 font-medium hover:bg-white/20">Desfazer</button>
                  <button onClick={() => navigate('/jornal')} className="rounded-lg bg-white/15 px-3 py-1 font-medium hover:bg-white/25">Ver jornal</button>
                  <button onClick={proximo} className="rounded-lg bg-white px-3 py-1 font-bold text-bengala hover:bg-cream">Bipar próximo →</button>
                </div>
              </div>
            </div>
          )}
          {veredito?.tipo === 'ok' && (
            <div className="anim-in mt-3 flex items-center gap-3 rounded-xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #1c6e48, #2e9e6b)' }}>
              <span className="chip flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
                <Icon name="CheckCircle2" size={24} />
              </span>
              <div className="flex-1">
                <div className="text-base font-bold leading-tight">Validade OK — sem ação</div>
                <div className="text-sm text-white/85">{labelDias(veredito.dias)} · fora das faixas de desconto</div>
              </div>
              <button onClick={proximo} className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium hover:bg-white/25">Bipar próximo →</button>
            </div>
          )}

          {/* estoque (secundário) */}
          <div className="mt-4 flex items-end gap-2 border-t border-ink-soft/10 pt-3.5">
            <label className="flex-1">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Ajustar estoque (opcional)</span>
              <input type="number" className={inputCls} value={novoEstoque} onChange={(e) => setNovoEstoque(e.target.value)} />
            </label>
            <Botao variante="contorno" onClick={atualizarEstoque}><Icon name="Check" size={15} /> Salvar</Botao>
          </div>
        </div>
      )}

      {/* sessão de bipes */}
      {historico.length > 0 && (
        <div className="card-bengala overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-soft/10 px-4 py-2.5">
            <h2 className="accent text-sm font-bold text-ink">Bipados nesta sessão</h2>
            <div className="flex gap-2 text-xs">
              <span className="rounded-full bg-cream-200 px-2.5 py-0.5 font-medium text-ink">{historico.length} verificados</span>
              <span className="rounded-full bg-bengala/10 px-2.5 py-0.5 font-medium text-bengala">{naFilaSessao} pro jornal</span>
            </div>
          </div>
          <div className="stagger divide-y divide-ink-soft/8">
            {historico.map((h, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2">
                <ProdutoThumb produto={h} size={32} />
                <span className="min-w-0 flex-1 whitespace-normal break-words text-sm leading-snug text-ink">{h.nome}</span>
                {h.tipo === 'jornal' ? (
                  <span className="flex items-center gap-1 rounded-full bg-bengala/10 px-2 py-0.5 text-xs font-bold text-bengala">
                    <Icon name="Newspaper" size={12} /> {h.desconto > 0 ? `−${h.desconto}% · ` : ''}{h.quantidade} un. → jornal
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                    <Icon name="Check" size={12} /> OK
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-ink-soft/10 bg-cream-200 p-3">
            <Botao onClick={() => navigate('/jornal')} className="w-full justify-center">
              <Icon name="Newspaper" size={16} /> Montar jornal com {naFilaSessao} {naFilaSessao === 1 ? 'produto' : 'produtos'}
            </Botao>
          </div>
        </div>
      )}
    </div>
  )
}
