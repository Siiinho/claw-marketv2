// Primeiro acesso guiado: o dono de um mercado novo vê, no início, os 5 passos para deixar o
// jornal de ofertas no ar. Cada passo se marca sozinho quando a coisa acontece de verdade
// (logo salva, loja cadastrada, jornal publicado); os dois que não dá para conferir (chamar a
// equipe e divulgar o link) se marcam quando a pessoa copia o código ou o link.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, podeVer } from '../store/StoreContext'
import { Icon } from './ui'
import { lerEncarteNuvem, nuvemAtiva, MERCADO_PADRAO } from '../lib/nuvem'
import { linkJornal } from './cartazes/QrJornal'

const temOfertas = (e) => Array.isArray(e?.itens) && e.itens.length > 0

// só o dono (admin) de um mercado que não é o Bengala, enquanto não esconder o guia
export function mostraPrimeiroAcesso(usuario, config) {
  if (!usuario || usuario.papel !== 'admin' || usuario.master) return false
  if ((usuario.mercadoId || MERCADO_PADRAO) === MERCADO_PADRAO) return false
  return !config?.guiaEscondido
}

export default function PrimeiroAcesso() {
  const { usuario, config, salvarConfig, toast } = useStore()
  const navigate = useNavigate()
  // cada passo numa chave própria: duas marcações seguidas não se apagam
  const chave = (k) => `guia${k[0].toUpperCase()}${k.slice(1)}`
  const guia = { equipe: !!config.guiaEquipe, publicou: !!config.guiaPublicou, divulgou: !!config.guiaDivulgou }
  const marcar = (k) => { if (!guia[k]) salvarConfig({ [chave(k)]: true }) }

  // o jornal está no ar? (o mesmo que o cliente vê; volta a conferir quando a tela ganha foco)
  const [noAr, setNoAr] = useState(!!guia.publicou)
  useEffect(() => {
    if (!nuvemAtiva()) return undefined
    let vivo = true
    const conferir = () => lerEncarteNuvem().then((e) => {
      if (!vivo || e === undefined) return
      setNoAr(temOfertas(e))
    }).catch(() => {})
    conferir()
    window.addEventListener('focus', conferir)
    return () => { vivo = false; window.removeEventListener('focus', conferir) }
  }, [])
  useEffect(() => { if (noAr && !guia.publicou) marcar('publicou') }, [noAr]) // eslint-disable-line react-hooks/exhaustive-deps

  const m = config.mercado || {}
  const nomeMercado = (m.nome || usuario.mercadoNome || '').trim()
  const link = linkJornal()
  const copiar = (texto, aviso, k) => {
    navigator.clipboard?.writeText(texto).then(() => toast(aviso), () => toast('Não deu para copiar. Segure no texto e copie.', 'erro'))
    marcar(k)
  }

  const passos = [
    {
      k: 'marca', feito: !!m.logo && !!nomeMercado, icone: 'Image',
      titulo: 'Coloque a logo e o nome do mercado',
      texto: 'A logo aparece no jornal, nos cartazes e na abertura do site do cliente.',
      acao: <Botao onClick={() => navigate('/mercado')}>Abrir Meu mercado</Botao>,
    },
    {
      k: 'loja', feito: (m.lojas || []).some((l) => (l.endereco || '').trim() && ((l.whatsapp || '').trim() || (l.telefone || '').trim())), icone: 'Store',
      titulo: 'Cadastre a loja: endereço e WhatsApp',
      texto: 'Vai no rodapé do jornal para o cliente saber onde comprar.',
      acao: <Botao onClick={() => navigate('/mercado')}>Cadastrar loja</Botao>,
    },
    {
      k: 'equipe', feito: !!guia.equipe, icone: 'Users', opcional: true,
      titulo: 'Chame a equipe',
      texto: usuario.convite
        ? <>Quem trabalha no mercado entra em <b>Sou da equipe</b> com o código <b className="num-tab tracking-[0.2em] text-navy">{usuario.convite}</b>.</>
        : 'Cada pessoa cria o login dela em "Sou da equipe".',
      acao: (
        <>
          {usuario.convite && <Botao onClick={() => copiar(usuario.convite, 'Código copiado!', 'equipe')}><Icon name="Copy" size={16} /> Copiar código</Botao>}
          <Botao claro onClick={() => marcar('equipe')}>Vou fazer sozinho</Botao>
        </>
      ),
    },
    {
      k: 'publicou', feito: noAr || !!guia.publicou, icone: 'Newspaper',
      titulo: 'Monte e publique o primeiro jornal',
      texto: 'Bipe os produtos, ponha preço e selo, escolha a campanha e publique.',
      acao: podeVer(usuario.papel, 'jornal') && <Botao onClick={() => navigate('/jornal')}>Montar jornal</Botao>,
    },
    {
      k: 'divulgou', feito: !!guia.divulgou, icone: 'Share2',
      titulo: 'Mande o link para os clientes',
      texto: <>O link do seu jornal é <span className="break-all font-semibold text-navy">{link.replace(/^https?:\/\//, '')}</span>. Ele atualiza sozinho a cada jornal novo.</>,
      acao: (
        <>
          <Botao onClick={() => copiar(link, 'Link copiado!', 'divulgou')}><Icon name="Copy" size={16} /> Copiar link</Botao>
          <Botao claro href={link} onClick={() => marcar('divulgou')}><Icon name="ExternalLink" size={16} /> Ver como o cliente</Botao>
          {podeVer(usuario.papel, 'cartazes') && <Botao claro onClick={() => navigate('/cartazes')}><Icon name="QrCode" size={16} /> Cartaz com QR</Botao>}
        </>
      ),
    },
  ]
  const feitos = passos.filter((p) => p.feito).length
  const proximo = passos.find((p) => !p.feito)
  const pronto = !proximo

  return (
    <section className="card-bengala overflow-hidden p-0" aria-labelledby="guia-titulo">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-navy px-4 py-4 text-white md:px-6">
        <div className="min-w-0 flex-1">
          <h2 id="guia-titulo" className="display-bengala text-[26px] leading-none md:text-[30px]">
            {pronto ? 'Tudo pronto!' : `Primeiros passos${nomeMercado ? ` do ${nomeMercado}` : ''}`}
          </h2>
          <p className="mt-1 text-sm text-white/85">
            {pronto ? 'Seu jornal está no ar e os clientes já têm o link.' : `${feitos} de ${passos.length} feitos. Faça na ordem, um de cada vez.`}
          </p>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/20 sm:w-40" role="progressbar" aria-valuemin={0} aria-valuemax={passos.length} aria-valuenow={feitos} aria-label="Passos feitos">
          <span className="block h-full rounded-full bg-offer transition-[width] duration-500" style={{ width: `${(feitos / passos.length) * 100}%` }} />
        </div>
        <button type="button" onClick={() => salvarConfig({ guiaEscondido: true })} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-white/85 hover:bg-white/10 hover:text-white">
          <Icon name={pronto ? 'Check' : 'EyeOff'} size={16} /> {pronto ? 'Fechar' : 'Esconder'}
        </button>
      </div>

      <ol className="divide-y divide-ink-soft/10">
        {passos.map((p, i) => {
          const atual = p === proximo
          return (
            <li key={p.k} className={`flex gap-3 px-4 py-3.5 md:gap-4 md:px-6 ${atual ? 'bg-cream' : ''}`}>
              <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${p.feito ? 'bg-success text-white' : atual ? 'bg-bengala text-white' : 'bg-ink-soft/15 text-ink-soft'}`} aria-hidden="true">
                {p.feito ? <Icon name="Check" size={18} strokeWidth={3} /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`font-bold ${p.feito ? 'text-ink-soft line-through decoration-2' : 'text-ink'}`}>
                  {p.titulo}
                  {p.opcional && !p.feito && <span className="ml-2 text-xs font-semibold text-ink-soft">(se tiver equipe)</span>}
                  <span className="sr-only">{p.feito ? ' (feito)' : ''}</span>
                </p>
                {atual && <p className="mt-0.5 text-sm text-ink">{p.texto}</p>}
                {atual && p.acao && <div className="mt-2.5 flex flex-wrap gap-2">{p.acao}</div>}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function Botao({ claro, href, children, ...props }) {
  const cls = `inline-flex min-h-11 items-center gap-1.5 rounded-lg px-4 text-sm font-bold ${claro ? 'border-2 border-navy/30 bg-white text-navy hover:border-navy' : 'bg-bengala text-white hover:bg-bengala-dark'}`
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" className={cls} {...props}>{children}</a>
  return <button type="button" className={cls} {...props}>{children}</button>
}
