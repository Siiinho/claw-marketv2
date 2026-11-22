import { useMemo, useRef, useState } from 'react'
import { Icon, Botao, EmptyState, Secao, Rotulo, Escolha, Segmentado } from './ui'
import PaginaTemplate, { Escalado, FORMATOS, paginarTemplate } from './PaginaTemplate'
import { FolhaCartazes, FOLHA_A4, paginarCartazes } from './Cartaz'
import { FolhaCartazesPincel, CartazModelo, MODELOS_CARTAZ, ORIENTACOES, imposicao, paginar } from './cartazes/cartazPincel'
import { temaCampanhaById } from '../lib/temasCampanha'
import { plural } from '../lib/utils'
import SeletorTema from './SeletorTema'
import { exportarPNG, exportarPDFPaginas, gerarPNG } from '../lib/exportar'

// Central de artes: a mesma lista de ofertas vira Feed, Stories, TV, post por oferta,
// cartazes A4 a A7 e etiquetas de gôndola. Cada arte baixa em PNG (ou PDF para imprimir)
// e, no celular, pode ser compartilhada direto no WhatsApp ou Instagram.

const SAIDAS = [
  ...Object.values(FORMATOS).map((f) => ({ id: f.id, nome: f.nome, sub: `${f.proporcao} · ${f.uso}`, icone: f.icone })),
  { id: 'cartaz', nome: 'Cartaz', sub: 'A3 a A7, 7 modelos para imprimir', icone: 'FileText' },
  { id: 'etiqueta', nome: 'Etiquetas', sub: 'Preço de gôndola, 24 por folha', icone: 'Tags' },
]

const TAMANHOS = ['A3', 'A4', 'A5', 'A6', 'A7']
// Produto de exemplo para as miniaturas dos modelos quando a lista está vazia.
const EXEMPLO = { id: 'exemplo', nome: 'Arroz tipo 1', marca: 'Camil', gramagem: '5 kg', unidade: 'UN', precoNormal: 27.9, precoJornal: 22.99 }

const slug = (t) => String(t || 'arte').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'arte'
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

// `saidas` limita as opções: o Jornal mostra só as artes de rede social e a aba Cartazes,
// só cartazes e etiquetas para imprimir.
// `cartaz` (opcional) controla o modelo e a orientação dos cartazes e abre a edição:
// { modelo, onModelo, orientacao, onOrientacao, onAbrir }.
export default function CentralArtes({ itens, titulo, encarte, loja, temaId, setTemaId, layout, setLayout, fundo, toast, saidas: idsSaidas, saidaInicial, subtitulo, escalaLogo, ajustes, onBipar, cartaz: ctrlCartaz }) {
  const opcoes = idsSaidas ? SAIDAS.filter((s) => idsSaidas.includes(s.id)) : SAIDAS
  const [saida, setSaida] = useState(saidaInicial || opcoes[0].id)
  const [tamanho, setTamanho] = useState('A5')
  const [excluidos, setExcluidos] = useState(() => new Set())
  const [ocupado, setOcupado] = useState(null)
  const [progresso, setProgresso] = useState(null)
  const refs = useRef([])
  const tema = temaCampanhaById(temaId)

  const [orientacaoLocal, setOrientacaoLocal] = useState('retrato')
  const [modeloLocal, setModeloLocal] = useState('classico')
  const modelo = ctrlCartaz?.modelo || modeloLocal
  const orientacao = ctrlCartaz?.orientacao || orientacaoLocal
  const trocarModelo = ctrlCartaz?.onModelo || setModeloLocal
  const trocarOrientacao = ctrlCartaz?.onOrientacao || setOrientacaoLocal

  const impressao = saida === 'cartaz' || saida === 'etiqueta'
  const ehCartaz = saida === 'cartaz'
  const tamanhoAtual = saida === 'etiqueta' ? 'etiqueta' : tamanho
  const imp = useMemo(() => imposicao(tamanho, orientacao), [tamanho, orientacao])
  const dim = ehCartaz ? imp.folha : impressao ? FOLHA_A4 : FORMATOS[saida]
  const selecionados = itens.filter((p) => !excluidos.has(p.id))
  const paginas = useMemo(
    () => (ehCartaz ? paginar(selecionados, imp) : impressao ? paginarCartazes(selecionados, tamanhoAtual) : paginarTemplate(selecionados, layout, saida)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ehCartaz, imp, impressao, tamanhoAtual, layout, saida, selecionados.map((p) => `${p.id}:${p.nome}:${p.marca}:${p.gramagem}:${p.chamada}:${p.modeloCartaz}:${p.precoNormal}:${p.precoJornal}:${p.seloOferta}:${p.estiloPreco}:${p.unidade}:${p.imagem?.length || 0}:${JSON.stringify(p.ajusteCartaz || '')}`).join('|')],
  )
  const temConteudo = selecionados.length > 0
  const podeCompartilhar = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'

  const nomeArquivo = (i) => {
    if (saida === 'post') return `oferta-${slug(paginas[i]?.[0]?.nome)}`
    const base = `${slug(titulo)}-${impressao ? (saida === 'etiqueta' ? 'etiquetas' : `cartaz-${tamanho.toLowerCase()}${orientacao === 'paisagem' ? '-deitado' : ''}`) : saida}`
    return paginas.length > 1 ? `${base}-${i + 1}` : base
  }
  // Redes sociais: tamanho exato do formato. Impressão: alta resolução.
  const opcoesPNG = impressao ? undefined : { escala: 1 }

  const executar = async (rotulo, fn) => {
    if (ocupado) return
    setOcupado(rotulo)
    try {
      await fn()
    } catch (erro) {
      if (erro?.name !== 'AbortError') toast(erro?.message || 'Não foi possível gerar a arte.', 'erro')
    } finally {
      setOcupado(null)
      setProgresso(null)
    }
  }

  const baixar = (i) => executar(`png-${i}`, async () => {
    const r = await exportarPNG(refs.current[i], nomeArquivo(i), opcoesPNG)
    setTimeout(() => URL.revokeObjectURL(r.url), 60000)
  })

  const baixarTodas = () => executar('todas', async () => {
    // Guarda as páginas e os nomes do momento do clique.
    const els = refs.current.slice(0, paginas.length)
    const nomes = paginas.map((_, i) => nomeArquivo(i))
    for (let i = 0; i < els.length; i += 1) {
      const r = await exportarPNG(els[i], nomes[i], opcoesPNG)
      setTimeout(() => URL.revokeObjectURL(r.url), 60000)
      await esperar(400)
    }
    toast(`${paginas.length} ${paginas.length === 1 ? 'arte baixada' : 'artes baixadas'}.`)
  })

  const compartilhar = (indices) => executar('compartilhar', async () => {
    const arquivos = []
    for (const i of indices) {
      const blob = await gerarPNG(refs.current[i], opcoesPNG)
      arquivos.push(new File([blob], `${nomeArquivo(i)}.png`, { type: 'image/png' }))
    }
    if (!navigator.canShare?.({ files: arquivos })) throw new Error('Este aparelho não permite compartilhar imagens. Use Baixar PNG.')
    await navigator.share({ files: arquivos, title: titulo })
  })

  const baixarPDF = () => executar('pdf', async () => {
    const r = await exportarPDFPaginas(refs.current.slice(0, paginas.length), impressao ? nomeArquivo(0).replace(/-\d+$/, '') : `${slug(titulo)}-${saida}`, { formato: ehCartaz ? imp.folha.formato : 'a4', onProgresso: (i, n) => setProgresso(n > 1 ? `${i} de ${n}` : null) })
    setTimeout(() => URL.revokeObjectURL(r.url), 60000)
  })

  const alternar = (id) => setExcluidos((s) => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })

  const renderPagina = (pagina, i, comRef) => (ehCartaz ? (
    <FolhaCartazesPincel ref={comRef ? (el) => { refs.current[i] = el } : undefined} itens={pagina} tamanho={tamanho} orientacao={orientacao} template={modelo} encarte={encarte} loja={loja}
      onAbrir={!comRef && ctrlCartaz?.onAbrir && !ocupado ? ctrlCartaz.onAbrir : undefined} />
  ) : impressao ? (
    <FolhaCartazes ref={comRef ? (el) => { refs.current[i] = el } : undefined} itens={pagina} tamanho={tamanhoAtual} encarte={encarte} />
  ) : (
    <div ref={comRef ? (el) => { refs.current[i] = el } : undefined} style={{ width: dim.largura, height: dim.altura }}>
      <PaginaTemplate tema={tema} itens={pagina} encarte={encarte} loja={loja} fundo={fundo} layout={layout} formato={saida} numero={saida === 'post' ? null : i + 1} total={paginas.length} escalaLogo={escalaLogo} />
    </div>
  ))

  const colunasPrevia = saida === 'tv' ? 'lg:grid-cols-2' : saida === 'stories' ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-2 xl:grid-cols-3'

  return (
    <div className="space-y-5">
      {/* 1. formato */}
      <Secao numero={1} titulo="O que você quer gerar?" descricao={subtitulo}>
        <div className={`grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 ${opcoes.length > 3 ? 'lg:grid-cols-4' : ''}`}>
          {opcoes.map((s) => (
            <Escolha key={s.id} ativo={saida === s.id} onClick={() => setSaida(s.id)} disabled={!!ocupado} icone={s.icone} titulo={s.nome} descricao={s.sub} />
          ))}
        </div>

        {ehCartaz && (
          <div className="mt-5 space-y-5">
            <div>
              <Rotulo>Modelo do cartaz</Rotulo>
              <div role="group" aria-label="Modelo do cartaz" className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                {MODELOS_CARTAZ.map((m) => {
                  const ativo = modelo === m.id
                  return (
                    <button key={m.id} type="button" onClick={() => trocarModelo(m.id)} disabled={!!ocupado} aria-pressed={ativo} title={m.desc}
                      className={`min-w-0 rounded-xl border p-1.5 text-left disabled:opacity-50 ${ativo ? 'border-navy bg-navy/[0.045] shadow-[inset_0_0_0_1px_var(--color-navy)]' : 'border-ink-soft/20 bg-white hover:border-ink-soft/45'}`}>
                      <span className="block overflow-hidden rounded-md border border-ink-soft/10">
                        <Escalado largura={397} altura={562}>
                          <CartazModelo produto={{ ...(selecionados[0] || EXEMPLO), modeloCartaz: undefined }} modelo={m.id} w={397} h={562} encarte={encarte} loja={loja} />
                        </Escalado>
                      </span>
                      <span className="mt-1.5 block truncate px-0.5 text-xs font-semibold text-ink">{m.nome}</span>
                      <span className="block truncate px-0.5 text-[11px] text-ink-soft">{m.desc}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-4">
              <div>
                <Rotulo>Tamanho do cartaz</Rotulo>
                <Segmentado rotulo="Tamanho do cartaz" valor={tamanho} onChange={setTamanho} disabled={!!ocupado}
                  opcoes={TAMANHOS.map((id) => [id, id, `· ${imposicao(id, orientacao).desc}`])} />
              </div>
              <div>
                <Rotulo>Posição</Rotulo>
                <Segmentado rotulo="Posição do cartaz" valor={orientacao} onChange={trocarOrientacao} disabled={!!ocupado} opcoes={ORIENTACOES} />
              </div>
            </div>
          </div>
        )}

        {!impressao && (
          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0">
              <Rotulo>Campanha</Rotulo>
              <SeletorTema value={temaId} onChange={setTemaId} />
            </div>
            {saida !== 'post' && (
              <div>
                <Rotulo>Arrumação</Rotulo>
                <Segmentado rotulo="Arrumação" valor={layout} onChange={setLayout} className="md:flex-col" opcoes={[['grade', 'Todos iguais'], ['destaque', '1 em destaque']]} />
              </div>
            )}
          </div>
        )}

        {ajustes && <div className="mt-5">{ajustes}</div>}
      </Secao>

      {/* 2. produtos */}
      <Secao
        numero={2}
        titulo="Quais ofertas entram?"
        descricao={`${selecionados.length} de ${itens.length} marcadas`}
        acao={itens.length > 0 && (
          <div className="flex gap-1 text-sm font-semibold">
            <button type="button" className="min-h-9 rounded-lg px-2 text-navy hover:bg-cream-200" onClick={() => setExcluidos(new Set())}>Marcar todas</button>
            <button type="button" className="min-h-9 rounded-lg px-2 text-ink-soft hover:bg-cream-200" onClick={() => setExcluidos(new Set(itens.map((p) => p.id)))}>Desmarcar</button>
          </div>
        )}
      >
        {itens.length === 0 ? (
          <EmptyState
            icon="ScanBarcode"
            titulo="Nenhuma oferta na lista"
            descricao="Bipe os produtos. Eles aparecem aqui para virar arte."
            acao={onBipar ? <Botao onClick={onBipar}><Icon name="ScanBarcode" size={17} /> Bipar produtos</Botao> : null}
          />
        ) : (
          <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
            {itens.map((p) => {
              const ativo = !excluidos.has(p.id)
              return (
                <button key={p.id} type="button" onClick={() => alternar(p.id)} disabled={!!ocupado} aria-pressed={ativo}
                  className={`inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border px-3 text-sm font-semibold ${ativo ? 'border-navy/30 bg-navy/[0.07] text-navy' : 'border-ink-soft/20 bg-white text-ink-soft hover:border-ink-soft/45'}`}>
                  <Icon name={ativo ? 'Check' : 'Plus'} size={14} strokeWidth={2.25} />
                  <span className="truncate">{p.nome}</span>
                </button>
              )
            })}
          </div>
        )}
      </Secao>

      {/* 3. prévia e download */}
      <Secao
        numero={3}
        titulo="Baixe ou compartilhe"
        descricao={plural(temConteudo ? paginas.length : 0, impressao ? 'folha' : 'arte', impressao ? 'folhas' : 'artes')}
        acao={impressao ? (
          <Botao onClick={baixarPDF} disabled={!temConteudo || !!ocupado}>
            <Icon name={ocupado === 'pdf' ? 'LoaderCircle' : 'Printer'} size={17} className={ocupado === 'pdf' ? 'animate-spin' : ''} /> {ocupado === 'pdf' ? (progresso ? `Gerando folha ${progresso}` : 'Gerando PDF…') : 'Baixar PDF para imprimir'}
          </Botao>
        ) : (
          <>
            {podeCompartilhar && (
              <Botao variante="contorno" onClick={() => compartilhar(paginas.map((_, i) => i))} disabled={!temConteudo || !!ocupado}>
                <Icon name={ocupado === 'compartilhar' ? 'LoaderCircle' : 'Share2'} size={17} className={ocupado === 'compartilhar' ? 'animate-spin' : ''} /> Compartilhar todas
              </Botao>
            )}
            <Botao onClick={baixarTodas} disabled={!temConteudo || !!ocupado}>
              <Icon name={ocupado === 'todas' ? 'LoaderCircle' : 'Download'} size={17} className={ocupado === 'todas' ? 'animate-spin' : ''} /> Baixar todas
            </Botao>
          </>
        )}
      >
        {!temConteudo ? (
          <p className="rounded-xl border border-dashed border-ink-soft/25 p-6 text-center text-sm text-ink-soft">Marque ao menos uma oferta para ver as artes.</p>
        ) : (
          <div className={`grid gap-5 ${colunasPrevia}`}>
            {paginas.map((pagina, i) => (
              <div key={i} className="min-w-0 overflow-hidden rounded-xl border border-ink-soft/10 bg-cream p-2">
                <Escalado largura={dim.largura} altura={dim.altura}>{renderPagina(pagina, i, false)}</Escalado>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
                  <span className="min-w-0 truncate text-xs font-semibold text-ink-soft">
                    {saida === 'post' ? pagina[0]?.nome : `${impressao ? 'Folha' : 'Arte'} ${i + 1} de ${paginas.length}`}
                  </span>
                  <div className="flex gap-1.5">
                    {podeCompartilhar && !impressao && (
                      <button type="button" onClick={() => compartilhar([i])} disabled={!!ocupado} aria-label="Compartilhar esta arte"
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-soft/25 bg-white text-ink hover:bg-cream-200 disabled:opacity-50">
                        <Icon name="Share2" size={16} />
                      </button>
                    )}
                    <button type="button" onClick={() => baixar(i)} disabled={!!ocupado}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-navy px-3 text-xs font-semibold text-white hover:bg-navy-light disabled:opacity-50">
                      <Icon name={ocupado === `png-${i}` ? 'LoaderCircle' : 'Download'} size={15} className={ocupado === `png-${i}` ? 'animate-spin' : ''} /> PNG
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-ink-soft">
          {impressao
            ? `${ehCartaz && ctrlCartaz?.onAbrir ? 'Toque num cartaz para mudar o preço, o texto ou o tamanho de cada parte. ' : ''}O PDF sai em folha ${ehCartaz ? imp.folha.formato.toUpperCase() : 'A4'}${ehCartaz && imp.porFolha > 1 ? ' com linhas pontilhadas para recortar' : ''}. A validade dos produtos não aparece, só o período da campanha.`
            : `As artes saem no tamanho certo (${dim.largura} × ${dim.altura} px). No celular, use Compartilhar para mandar direto no WhatsApp ou Instagram.`}
        </p>
      </Secao>

      {/* cópias em tamanho real, fora da tela, usadas para gerar os arquivos */}
      {temConteudo && (
        <div className="pointer-events-none fixed top-0" style={{ left: -20000 }} aria-hidden="true">
          {paginas.map((pagina, i) => <div key={i}>{renderPagina(pagina, i, true)}</div>)}
        </div>
      )}
    </div>
  )
}
