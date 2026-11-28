import MarcaClawMarket from '../components/MarcaClawMarket'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/StoreContext'
import { Icon, Botao } from '../components/ui'
import { enderecoDoNome, enderecoValido, enderecoLivre } from '../lib/nuvem'

const DESTAQUES = [
  { icone: 'TrendingDown', titulo: 'Venda antes de vencer', desc: 'a validade avisa e vira oferta' },
  { icone: 'MousePointerClick', titulo: '1 clique', desc: 'para gerar cartazes e jornal' },
  { icone: 'BellRing', titulo: 'Tempo real', desc: 'alertas de validade por setor' },
]

export default function Login() {
  const { login, registrar, toast } = useStore()
  const navigate = useNavigate()
  const [modo, setModo] = useState('entrar') // entrar | mercado | equipe
  const [mercadoNome, setMercadoNome] = useState('')
  const [convite, setConvite] = useState('')
  // endereço exclusivo do jornal, sai do nome do mercado (dá para trocar)
  const [endereco, setEndereco] = useState('')
  const [enderecoMexido, setEnderecoMexido] = useState(false)
  const [livre, setLivre] = useState(null)
  const enderecoFinal = enderecoMexido ? endereco : enderecoDoNome(mercadoNome)
  useEffect(() => {
    if (modo !== 'mercado' || !enderecoFinal) { setLivre(null); return undefined }
    let ativo = true
    const t = setTimeout(() => enderecoLivre(enderecoFinal).then((v) => { if (ativo) setLivre(v) }), 350)
    return () => { ativo = false; clearTimeout(t) }
  }, [enderecoFinal, modo])
  const [identificador, setIdentificador] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  const CLS = 'w-full rounded-lg border border-ink-soft/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-bengala focus:ring-2 focus:ring-bengala/20'

  const entrar = async (e) => {
    e.preventDefault()
    if (enviando) return
    setEnviando(true)
    setErro('')
    try {
      if (await login(identificador, senha)) {
        toast(`Bem-vindo, ${identificador.split('@')[0]}!`)
        navigate('/')
      } else setErro('Nome de usuário ou senha incorretos.')
    } catch (_) {
      setErro('Sem conexão com o servidor. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  const criar = async (e) => {
    e.preventDefault()
    if (enviando) return
    setEnviando(true)
    setErro('')
    try {
      if (modo === 'mercado' && (!enderecoValido(enderecoFinal) || livre === false)) { setErro('Escolha outro endereço para o jornal.'); return }
      const r = await registrar(modo === 'mercado' ? { nome, senha, mercadoNome, mercadoEndereco: enderecoFinal } : { nome, senha, convite })
      if (r.ok) {
        toast(modo === 'mercado' ? `${mercadoNome.trim()} cadastrado! Agora coloque a logo e as lojas.` : `Conta criada. Bem-vindo, ${nome}!`)
        navigate(modo === 'mercado' ? '/mercado' : '/')
      } else setErro(r.erro)
    } catch (_) {
      setErro('Sem conexão com o servidor. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="app-ui flex min-h-screen flex-col md:flex-row">
      {/* lado esquerdo */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-brick p-8 text-cream md:w-1/2 md:p-12">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1.5 bg-bengala" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full border-[44px] border-offer/12" />
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{ background: 'linear-gradient(165deg, #082b4f 0%, #0b345e 62%, #123f6b 100%)' }}
        />
        <div className="relative z-10 flex items-center gap-3">
          <MarcaClawMarket tamanho={52} subtitulo="Encartes digitais para supermercados" />
        </div>

        <div className="relative z-10 my-6 md:my-10">
          <h1 className="display-bengala max-w-md text-[2rem] leading-[1.02] md:text-[3.2rem]">
            Chega de perder dinheiro com vencimentos
          </h1>
          <p className="mt-4 max-w-md text-[1.05rem] leading-relaxed text-cream/85">
            Controle a validade, gere ofertas e monte o jornal de ofertas internas em minutos.
          </p>
          <div className="mt-8 hidden space-y-4 md:block">
            {DESTAQUES.map((d) => (
              <div key={d.titulo} className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-offer">
                  <Icon name={d.icone} size={20} />
                </div>
                <div>
                  <div className="font-semibold">{d.titulo}</div>
                  <div className="text-sm text-cream/70">{d.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10 hidden text-xs text-cream/60 md:block">© 2026 ClawMarket · cliente piloto: Bengala Supermercado</div>
      </div>

      {/* lado direito */}
      <div className="flex flex-1 items-start justify-center bg-cream p-6 md:items-center md:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-5 flex gap-1 rounded-lg bg-cream-200 p-1">
            {[['entrar', 'Entrar'], ['mercado', 'Novo mercado'], ['equipe', 'Sou da equipe']].map(([id, l]) => (
              <button
                key={id}
                onClick={() => { setModo(id); setErro('') }}
                className={`min-h-10 flex-1 rounded-md py-2 text-sm font-semibold ${modo === id ? 'bg-white text-ink shadow-sm' : 'text-ink-soft hover:text-ink'}`}
              >
                {l}
              </button>
            ))}
          </div>

          {modo === 'entrar' ? (
            <form onSubmit={entrar} className="space-y-4">
              <div>
                <label htmlFor="login-usuario" className="mb-1 block text-sm font-medium">Nome de usuário</label>
                <input id="login-usuario" value={identificador} onChange={(e) => setIdentificador(e.target.value)} placeholder="Seu nome de usuário" autoComplete="username" className={CLS} />
              </div>
              <div>
                <label htmlFor="login-senha" className="mb-1 block text-sm font-medium">Senha</label>
                <input id="login-senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••" autoComplete="current-password" className={CLS} />
              </div>
              {erro && <p className="text-sm text-critical">{erro}</p>}
              <Botao type="submit" className="w-full py-2.5" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</Botao>
            </form>
          ) : (
            <form onSubmit={criar} className="space-y-4">
              {modo === 'mercado' ? (
                <>
                  <div>
                    <label htmlFor="criar-mercado" className="mb-1 block text-sm font-medium">Nome do mercado</label>
                    <input id="criar-mercado" value={mercadoNome} onChange={(e) => setMercadoNome(e.target.value)} placeholder="Ex.: Supermercado Bom Preço" autoComplete="organization" className={CLS} />
                  </div>
                  <div>
                    <label htmlFor="criar-endereco" className="mb-1 block text-sm font-medium">Endereço exclusivo do seu jornal</label>
                    <div className="flex items-stretch overflow-hidden rounded-lg border border-ink-soft/20 bg-white focus-within:border-bengala focus-within:ring-2 focus-within:ring-bengala/20">
                      <span className="flex items-center bg-cream-200 px-2 text-xs text-ink-soft">…vercel.app/#/</span>
                      <input id="criar-endereco" value={enderecoFinal} onChange={(e) => { setEnderecoMexido(true); setEndereco(e.target.value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-/, '').slice(0, 40)) }} placeholder="seu-mercado" autoCapitalize="none" className="min-w-0 flex-1 px-2 py-2.5 text-sm outline-none" />
                    </div>
                    {enderecoFinal && (
                      <p className={`mt-1 text-xs font-semibold ${!enderecoValido(enderecoFinal) || livre === false ? 'text-critical' : livre ? 'text-success' : 'text-ink-soft'}`}>
                        {!enderecoValido(enderecoFinal) ? 'Use letras, números e hífen (mínimo 2).' : livre === false ? 'Esse endereço já é de outro mercado. Escolha outro.' : livre ? 'Endereço livre! Os clientes abrem o jornal por ele.' : 'Conferindo…'}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div>
                  <label htmlFor="criar-convite" className="mb-1 block text-sm font-medium">Código do mercado</label>
                  <input id="criar-convite" value={convite} onChange={(e) => setConvite(e.target.value)} placeholder="6 letras e números" autoCapitalize="none" className={`${CLS} tracking-widest`} />
                </div>
              )}
              <div>
                <label htmlFor="criar-usuario" className="mb-1 block text-sm font-medium">{modo === 'mercado' ? 'Seu nome de usuário (dono)' : 'Seu nome de usuário'}</label>
                <input id="criar-usuario" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Crie seu nome de usuário" autoComplete="username" className={CLS} />
              </div>
              <p className="rounded-lg bg-cream-200 px-3 py-2 text-xs text-ink-soft">
                {modo === 'mercado'
                  ? 'Você vira o dono (administrador) do mercado. Depois, passe o código do mercado para a sua equipe entrar.'
                  : 'O dono do mercado vê o código na tela Usuários. Você entra como Repositor e o dono muda a sua função.'}
              </p>
              <div>
                <label htmlFor="criar-senha" className="mb-1 block text-sm font-medium">Senha</label>
                <input id="criar-senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••" autoComplete="new-password" className={CLS} />
              </div>
              {erro && <p className="text-sm text-critical">{erro}</p>}
              <Botao type="submit" className="w-full py-2.5" disabled={enviando}>{enviando ? 'Criando…' : modo === 'mercado' ? 'Cadastrar meu mercado' : 'Entrar na equipe'}</Botao>
            </form>
          )}
          <p className="mt-6 text-center text-xs text-ink-soft">Cada mercado tem os próprios produtos, ofertas, jornais e site. Um mercado não vê o outro.</p>
        </div>
      </div>
    </div>
  )
}
