import { useEffect, useRef, useState } from 'react'
import { tratarFotoNoServidor } from '../lib/fotoProduto'
import { urlBuscaGoogleImagens } from '../lib/produtoApi'
import { Icon, inputCls } from './ui'

const imagemDoTransfer = (dados) => {
  const item = [...(dados?.items || [])].find((i) => i.kind === 'file' && i.type.startsWith('image/'))
  return item?.getAsFile() || [...(dados?.files || [])].find((f) => f.type.startsWith('image/')) || null
}
const linkDoTexto = (texto) => {
  const t = String(texto || '').trim()
  return /^(https?:\/\/\S+|data:image\/[a-z+.-]+;base64,\S+)$/i.test(t) ? t : null
}

// Abre o Google Imagens já com o nome do produto. A pessoa copia a foto certa lá e volta: o app
// recebe a foto pelo botão Colar, por Ctrl+V ou arrastando. O servidor confere as regras, tira o
// fundo e centraliza para o jornal (server/fotoProduto.js): aqui não há regra nenhuma.
// `salvaNaHora`: o produto já existe, então quem usa grava a foto em onFoto, sem esperar o Salvar.
export default function FotoGoogle({ produto, onFoto, toast, salvaNaHora = false, className = '' }) {
  const [ocupado, setOcupado] = useState(false)
  const ocupadoRef = useRef(false)
  const [ultima, setUltima] = useState(null) // foto recém-colada: permite voltar o fundo
  const [link, setLink] = useState('')
  const [recusa, setRecusa] = useState([]) // por que a última foto não serviu
  const pronto = Boolean(produto?.nome?.trim())

  const receber = async (tarefa) => {
    if (ocupadoRef.current) return
    ocupadoRef.current = true
    setOcupado(true)
    try {
      const { foto, aviso } = await tarefa()
      onFoto(foto)
      toast?.(`${aviso} ${salvaNaHora ? 'Já está salva no produto.' : 'Confira e toque em salvar.'}`)
    } catch (erro) {
      toast?.(erro?.message || 'Não foi possível usar essa foto.', 'erro')
    } finally {
      ocupadoRef.current = false
      setOcupado(false)
    }
  }

  // `fonte`: arquivo ou { link }. O servidor baixa o link, confere e devolve a foto pronta.
  const tratar = async (fonte, manterFundo = false) => {
    setRecusa([])
    const r = await tratarFotoNoServidor(fonte, { manterFundo })
    setRecusa(r.motivos)
    if (r.motivos.length) throw new Error('Essa foto não serve para o jornal. Veja o motivo e escolha outra.')
    setUltima({ fonte, semFundo: r.semFundo })
    setLink('')
    return {
      aviso: manterFundo ? 'Foto com o fundo original.' : 'Foto adicionada sem fundo.',
      foto: {
        imagem: r.imagem,
        imagemManual: true,
        imagemAprovada: true,
        imagemTratada: true,
        imagemTratamento: 'imagem-manual-livre-v1',
        imagemCorrespondencia: 'confirmado-manualmente',
        imagemAltaResolucao: null,
        imagemIlustrativa: false,
        imagemCachePermanente: false,
        imagemOrigem: 'google-imagens-confirmado',
        imagemOrigemNome: 'Google Imagens (escolhida por você)',
        imagemOriginal: r.origem || null,
        imagemFonteUrl: r.origem || null,
        imagemPaginaUrl: null,
      },
    }
  }
  const usarArquivo = (arquivo) => receber(() => tratar(arquivo))
  const usarLink = (texto) => receber(() => tratar({ link: texto }))

  const usarTransfer = (dados) => {
    const arquivo = imagemDoTransfer(dados)
    if (arquivo) { usarArquivo(arquivo); return true }
    const link = linkDoTexto(dados?.getData?.('text/uri-list') || dados?.getData?.('text/plain'))
    if (link) { usarLink(link); return true }
    return false
  }

  const colar = async () => {
    if (!navigator.clipboard?.read) return toast?.('Este navegador não deixa colar pelo botão. Use Ctrl+V.', 'erro')
    let itens
    try {
      itens = await navigator.clipboard.read()
    } catch (_) {
      return toast?.('Permita o acesso à área de transferência ou use Ctrl+V.', 'erro')
    }
    for (const item of itens) {
      const tipo = item.types.find((t) => t.startsWith('image/'))
      if (tipo) return usarArquivo(await item.getType(tipo))
    }
    for (const item of itens) {
      if (!item.types.includes('text/plain')) continue
      const link = linkDoTexto(await (await item.getType('text/plain')).text())
      if (link) return usarLink(link)
    }
    return toast?.('Nada copiado. No Google, segure (ou clique com o botão direito) na foto e copie o endereço da imagem.', 'erro')
  }

  // Ctrl+V com uma imagem vale na tela toda enquanto o produto está aberto. Texto colado num
  // campo continua sendo só texto.
  const aoColar = useRef(null)
  aoColar.current = (e) => {
    if (!pronto) return
    const digitando = e.target?.closest?.('input, textarea, [contenteditable="true"]')
    if (digitando && !imagemDoTransfer(e.clipboardData)) return
    if (usarTransfer(e.clipboardData)) e.preventDefault()
  }
  useEffect(() => {
    const ouvir = (e) => aoColar.current(e)
    document.addEventListener('paste', ouvir)
    return () => document.removeEventListener('paste', ouvir)
  }, [])

  return (
    <div
      className={`rounded-lg border border-dashed border-ink-soft/30 bg-white p-2.5 ${className}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); if (pronto && !usarTransfer(e.dataTransfer)) toast?.('Arraste a foto do produto, não a página.', 'erro') }}
    >
      <div className="flex flex-wrap gap-2">
        {pronto ? (
          <a href={urlBuscaGoogleImagens(produto)} target="_blank" rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-info/25 bg-info/5 px-3 text-sm font-bold text-info hover:bg-info/10">
            <Icon name="Search" size={16} /> Buscar no Google
          </a>
        ) : (
          <span className="inline-flex min-h-11 items-center gap-1.5 px-1 text-sm text-ink-soft"><Icon name="Search" size={16} /> Escreva o nome para buscar no Google</span>
        )}
        {pronto && (
          <button type="button" onClick={colar} disabled={ocupado}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-bengala px-3 text-sm font-bold text-white disabled:opacity-50">
            <Icon name={ocupado ? 'LoaderCircle' : 'ClipboardPaste'} size={16} className={ocupado ? 'animate-spin' : ''} /> Colar
          </button>
        )}
        {ultima && (
          <button type="button" disabled={ocupado} onClick={() => receber(() => tratar(ultima.fonte, ultima.semFundo))}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-ink-soft/25 bg-white px-3 text-sm font-semibold text-ink disabled:opacity-50">
            <Icon name="RotateCcw" size={16} /> {ultima.semFundo ? 'Voltar o fundo' : 'Tirar o fundo'}
          </button>
        )}
      </div>
      {pronto && (
        <div className="mt-2 flex gap-2">
          <input value={link} onChange={(e) => setLink(e.target.value)} inputMode="url" autoComplete="off" aria-label="Link da foto" placeholder="Cole aqui o link da foto"
            onPaste={(e) => { const l = linkDoTexto(e.clipboardData.getData('text/plain')); if (l) { e.preventDefault(); setLink(l.startsWith('data:') ? '' : l); usarLink(l) } }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const l = linkDoTexto(link); if (l) usarLink(l); else toast?.('Cole um link que comece com https://', 'erro') } }}
            className={`${inputCls} min-h-11 min-w-0 flex-1`} />
          <button type="button" disabled={ocupado || !linkDoTexto(link)} onClick={() => usarLink(linkDoTexto(link))}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-ink-soft/25 bg-white px-3 text-sm font-bold text-ink disabled:opacity-50">
            <Icon name={ocupado ? 'LoaderCircle' : 'Download'} size={16} className={ocupado ? 'animate-spin' : ''} /> Usar
          </button>
        </div>
      )}
      {recusa.length > 0 && (
        <div role="alert" className="mt-2 rounded-lg border border-critical/30 bg-critical/5 px-2.5 py-2 text-sm text-ink">
          <p className="font-bold">Foto recusada:</p>
          <ul className="list-disc pl-5">{recusa.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      )}
      {pronto && <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">No Google, abra a foto, copie o endereço da imagem (ou a própria imagem), volte e toque em Colar.</p>}
    </div>
  )
}
