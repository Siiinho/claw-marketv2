import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/StoreContext'
import { buscarProdutoBengala } from '../lib/catalogoBengala'
import { buscarImagemProduto, buscarProdutoAutomatizado } from '../lib/produtoApi'
import { dataISOmaisDias } from '../lib/utils'
import { useLeitorCamera } from '../lib/useLeitorCamera'
import { Botao, Campo, Icon, ProdutoThumb, inputCls } from './ui'

const rascunhoVazio = (codigo = '') => ({
  codigoBarras: codigo,
  nome: '',
  marca: '',
  gramagem: '',
  setor: 'mercearia',
  validade: dataISOmaisDias(7),
  estoque: 1,
  precoNormal: '',
  imagem: null,
})

function codigoLimpo(valor) {
  return String(valor || '').replace(/\D/g, '')
}

export default function ScannerJornal() {
  const {
    produtos,
    fila,
    salvarProdutoNaFila,
    registrarLote,
    removerDaFila,
    toast,
  } = useStore()
  const [codigo, setCodigo] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [rascunho, setRascunho] = useState(null)
  const [expandido, setExpandido] = useState(false)
  const inputRef = useRef(null)

  const recentes = useMemo(() => [...fila].sort((a, b) =>
    new Date(b.adicionadoFilaEm || 0).getTime() - new Date(a.adicionadoFilaEm || 0).getTime()
  ), [fila])
  const visiveis = expandido ? recentes : recentes.slice(0, 4)
  const restantes = Math.max(0, recentes.length - 4)

  const adicionarConhecido = (produto) => {
    const jaEstava = Boolean(produto.naFila)
    salvarProdutoNaFila(produto, 'scanner-jornal')
    if (produto.validade) {
      registrarLote({
        produtoId: produto.id,
        loja: produto.loja || 'loja3',
        validade: produto.validade,
        quantidade: Math.max(1, Number(produto.estoque) || 1),
      })
    }
    toast(jaEstava ? `${produto.nome} já está na fila do jornal.` : `${produto.nome} adicionado à fila do jornal!`, jaEstava ? 'info' : 'sucesso')
    setCodigo('')
    inputRef.current?.focus()
  }

  const buscar = async (valor = codigo) => {
    const c = codigoLimpo(valor)
    if (!c) return toast('Digite ou escaneie o código de barras.', 'erro')
    if (buscando) return
    setBuscando(true)
    setRascunho(null)
    try {
      const existente = produtos.find((produto) => codigoLimpo(produto.codigoBarras) === c)
      if (existente) {
        adicionarConhecido(existente)
        return
      }

      const local = await buscarProdutoBengala(c)
      // com a foto do banco de imagens do mercado, não gasta crédito buscando foto fora
      const fotoLocal = local?.imagem ? { imagem: local.imagem, origem: 'catalogo', origemNome: local.imagemOrigemNome } : null
      const automatizado = fotoLocal ? null : await buscarProdutoAutomatizado(c, local)
      const base = automatizado?.produto || local
      const foto = fotoLocal || automatizado?.foto || (base ? await buscarImagemProduto(base, { ignorarBackend: true }) : null)
      setRascunho({
        ...rascunhoVazio(c),
        ...(base || {}),
        codigoBarras: c,
        imagem: foto?.imagem || base?.imagem || null,
        imagemOrigem: foto?.origem || null,
        imagemOrigemNome: foto?.origemNome || null,
        imagemOriginal: foto?.imagemOriginal || null,
        imagemFonteUrl: foto?.imagemFonteUrl || null,
        imagemPaginaUrl: foto?.imagemPaginaUrl || null,
        imagemManual: Boolean(foto?.imagemManual),
        imagemTratada: Boolean(foto?.imagemTratada),
        imagemTratamento: foto?.imagemTratamento || null,
        imagemAltaResolucao: foto?.imagemAltaResolucao ?? null,
        imagemCachePermanente: Boolean(foto?.imagemCachePermanente),
      })
      if (!base) toast('Código não cadastrado. Complete os dados abaixo.', 'info')
    } catch (_) {
      setRascunho(rascunhoVazio(c))
      toast('Complete o cadastro para adicionar à fila.', 'info')
    } finally {
      setBuscando(false)
    }
  }

  const confirmarNovo = () => {
    if (!rascunho?.nome?.trim()) return toast('Informe o nome do produto.', 'erro')
    if (!(Number(rascunho.precoNormal) > 0)) return toast('Informe um preço válido.', 'erro')
    const produto = {
      ...rascunho,
      id: rascunho.id || globalThis.crypto?.randomUUID?.() || `produto-${Date.now()}`,
      loja: rascunho.loja || 'loja3',
      estoque: Math.max(1, Number(rascunho.estoque) || 1),
      precoNormal: Number(rascunho.precoNormal),
    }
    salvarProdutoNaFila(produto, 'scanner-jornal')
    if (produto.validade) registrarLote({ produtoId: produto.id, loja: produto.loja, validade: produto.validade, quantidade: produto.estoque })
    toast(`${produto.nome} cadastrado e adicionado à fila do jornal!`)
    setRascunho(null)
    setCodigo('')
    inputRef.current?.focus()
  }

  const enviarImagem = (arquivo) => {
    if (!arquivo) return
    const leitor = new FileReader()
    leitor.onload = () => setRascunho((atual) => ({
      ...atual,
      imagem: String(leitor.result || ''),
      imagemManual: true,
      imagemTratada: true,
      imagemTratamento: 'imagem-manual-livre-v1',
      imagemAltaResolucao: null,
      imagemOrigem: 'upload-manual',
    }))
    leitor.onerror = () => toast('Não foi possível ler a imagem.', 'erro')
    leitor.readAsDataURL(arquivo)
  }

  const camera = useLeitorCamera(
    (lido) => { setCodigo(lido); buscar(lido) },
    (mensagem) => toast(mensagem, 'erro'),
  )
  const scanning = camera.ativo
  const abrirCamera = () => (camera.ativo ? camera.parar() : camera.abrir())

  return (
    <section id="scanner-jornal" className="card-bengala scroll-mt-4 p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bengala text-white"><Icon name="ScanBarcode" size={21} /></span>
        <div>
          <h3 className="font-bold text-ink">Scanner do Gerador de Jornal</h3>
          <p className="text-xs text-ink-soft">Bipe ou digite sem sair desta tela. Produtos conhecidos entram direto na fila.</p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Icon name="Barcode" size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            ref={inputRef}
            value={codigo}
            onChange={(evento) => setCodigo(evento.target.value)}
            onKeyDown={(evento) => { if (evento.key === 'Enter') { evento.preventDefault(); buscar() } }}
            inputMode="numeric"
            placeholder="Digite ou bipe o código"
            className={`${inputCls} pl-9`}
          />
        </div>
        <Botao onClick={() => buscar()} disabled={buscando} className="px-3">
          <Icon name={buscando ? 'LoaderCircle' : 'Search'} size={17} className={buscando ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Adicionar</span>
        </Botao>
        <button type="button" onClick={abrirCamera} aria-label={scanning ? 'Parar câmera' : 'Abrir câmera'} className={`rounded-lg border px-3 ${scanning ? 'border-critical bg-critical text-white' : 'border-bengala/25 bg-bengala/5 text-bengala'}`}>
          <Icon name={scanning ? 'CameraOff' : 'Camera'} size={19} />
        </button>
      </div>

      {scanning ? (
        <div className="relative mt-3 overflow-hidden rounded-xl bg-black">
          <video ref={camera.videoRef} className="max-h-72 w-full object-cover" muted playsInline autoPlay />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-red-500/80 shadow-[0_0_8px_rgba(255,0,0,.8)]" />
          <div className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-center text-xs font-bold text-white">Aproxime o código de barras até ficar nítido</div>
        </div>
      ) : null}

      {rascunho ? (
        <div className="mt-4 rounded-xl border border-info/25 bg-info/5 p-3">
          <div className="mb-3 flex items-center gap-3">
            <ProdutoThumb produto={rascunho} size={54} />
            <div className="min-w-0 flex-1">
              <div className="font-bold text-ink">Complete o produto</div>
              <div className="text-xs text-ink-soft">Ele será salvo e colocado diretamente na fila.</div>
            </div>
            <label className="cursor-pointer rounded-lg border border-ink-soft/20 bg-white px-2.5 py-1.5 text-xs font-bold text-ink">
              <Icon name="ImagePlus" size={13} className="mr-1 inline" /> Imagem
              <input type="file" accept="image/*" className="sr-only" onChange={(evento) => enviarImagem(evento.target.files?.[0])} />
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="sm:col-span-2"><Campo label="Nome"><input className={inputCls} value={rascunho.nome || ''} onChange={(e) => setRascunho((p) => ({ ...p, nome: e.target.value }))} /></Campo></div>
            <Campo label="Marca"><input className={inputCls} value={rascunho.marca || ''} onChange={(e) => setRascunho((p) => ({ ...p, marca: e.target.value }))} /></Campo>
            <Campo label="Gramagem"><input className={inputCls} value={rascunho.gramagem || ''} onChange={(e) => setRascunho((p) => ({ ...p, gramagem: e.target.value }))} placeholder="350 g" /></Campo>
            <Campo label="Validade"><input type="date" className={inputCls} value={rascunho.validade || ''} onChange={(e) => setRascunho((p) => ({ ...p, validade: e.target.value }))} /></Campo>
            <Campo label="Quantidade"><input type="number" min="1" className={inputCls} value={rascunho.estoque || 1} onChange={(e) => setRascunho((p) => ({ ...p, estoque: e.target.value }))} /></Campo>
            <Campo label="Preço (R$)"><input type="number" min="0.01" step="0.01" className={inputCls} value={rascunho.precoNormal || ''} onChange={(e) => setRascunho((p) => ({ ...p, precoNormal: e.target.value }))} /></Campo>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Botao variante="contorno" onClick={() => setRascunho(null)}>Cancelar</Botao>
            <Botao onClick={confirmarNovo}><Icon name="Newspaper" size={15} /> Confirmar e adicionar</Botao>
          </div>
        </div>
      ) : null}

      {recentes.length ? (
        <div className="mt-4 border-t border-ink-soft/10 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">Adicionados recentemente</span>
            {!expandido && restantes > 0 ? <button onClick={() => setExpandido(true)} className="rounded-full bg-bengala px-2 py-0.5 text-xs font-bold text-white">+{restantes}</button> : null}
            {expandido && recentes.length > 4 ? <button onClick={() => setExpandido(false)} className="text-xs font-bold text-bengala">Mostrar 4</button> : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {visiveis.map((produto) => (
              <div key={produto.id} className="flex items-center gap-2 rounded-lg border border-ink-soft/10 bg-white p-2">
                <ProdutoThumb produto={produto} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-ink">{produto.nome}</div>
                  <div className="truncate text-xs text-ink-soft">{[produto.marca, produto.gramagem].filter(Boolean).join(' · ') || 'Na fila do jornal'}</div>
                </div>
                <button onClick={() => { removerDaFila(produto.id); toast(`${produto.nome} removido da fila.`, 'info') }} aria-label={`Remover ${produto.nome} da fila`} className="rounded p-1.5 text-critical hover:bg-critical/10"><Icon name="X" size={15} /></button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
