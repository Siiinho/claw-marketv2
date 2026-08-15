import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/StoreContext'
import { USUARIOS } from '../data/seed'
import { Icon, Botao, Logo } from '../components/ui'

const DESTAQUES = [
  { icone: 'TrendingDown', titulo: '38% menos perdas', desc: 'no primeiro mês de uso' },
  { icone: 'MousePointerClick', titulo: '1 clique', desc: 'para gerar cartazes e jornal' },
  { icone: 'BellRing', titulo: 'Tempo real', desc: 'alertas de validade por setor' },
]

export default function Login() {
  const { login, registrar, loginComoVisitante, toast } = useStore()
  const navigate = useNavigate()
  const [modo, setModo] = useState('entrar') // entrar | criar
  const [identificador, setIdentificador] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')
  const [papel, setPapel] = useState('repositor')
  const [erro, setErro] = useState('')

  const CLS = 'w-full rounded-lg border border-ink-soft/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-bengala focus:ring-2 focus:ring-bengala/20'

  const entrar = (e) => {
    e.preventDefault()
    if (login(identificador, senha)) {
      toast(`Bem-vindo, ${identificador.split('@')[0]}!`)
      navigate('/')
    } else setErro('Nome/e-mail ou senha incorretos.')
  }

  const criar = (e) => {
    e.preventDefault()
    const r = registrar({ nome, papel, senha })
    if (r.ok) {
      toast(`Conta criada. Bem-vindo, ${nome}!`)
      navigate('/')
    } else setErro(r.erro)
  }

  const entrarDemo = (u) => {
    if (login(u.nome, 'demo123')) {
      toast(`Bem-vindo, ${u.nome.split(' ')[0]}!`)
      navigate('/')
    }
  }

  const corPapel = { admin: '#2e6fb0', gerente: '#2e9e6b', repositor: '#8a4fa0' }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* lado esquerdo */}
      <div className="relative flex flex-col justify-between bg-brick p-8 text-cream md:w-1/2 md:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{ background: 'linear-gradient(135deg, #7a241b 0%, #b23320 60%, #e23a2e 100%)' }}
        />
        <div className="relative z-10 flex items-center gap-3">
          <Logo h={52} chip />
          <div>
            <div className="text-xl font-bold">ClawMarket</div>
            <div className="text-xs tracking-wide text-coral">por Bengala Supermercado</div>
          </div>
        </div>

        <div className="relative z-10 my-10">
          <h1 className="max-w-md text-3xl font-bold leading-tight md:text-4xl">
            Chega de perder dinheiro com vencimentos
          </h1>
          <p className="mt-3 max-w-md text-cream/80">
            Controle a validade, gere ofertas e monte o jornal de ofertas internas em minutos.
          </p>
          <div className="mt-8 space-y-4">
            {DESTAQUES.map((d) => (
              <div key={d.titulo} className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cream/15 text-coral">
                  <Icon name={d.icone} size={20} />
                </div>
                <div>
                  <div className="font-medium">{d.titulo}</div>
                  <div className="text-sm text-cream/70">{d.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10 text-xs text-cream/50">© Bengala Supermercado · piloto ClawMarket</div>
      </div>

      {/* lado direito */}
      <div className="flex flex-1 items-center justify-center bg-cream p-6 md:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-5 flex gap-1 rounded-lg bg-cream-200 p-1">
            {[['entrar', 'Entrar'], ['criar', 'Criar conta']].map(([id, l]) => (
              <button
                key={id}
                onClick={() => { setModo(id); setErro('') }}
                className={`flex-1 rounded-md py-1.5 text-sm font-medium transition ${modo === id ? 'bg-white text-ink shadow-sm' : 'text-ink-soft'}`}
              >
                {l}
              </button>
            ))}
          </div>

          {modo === 'entrar' ? (
            <form onSubmit={entrar} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Nome ou e-mail</label>
                <input value={identificador} onChange={(e) => setIdentificador(e.target.value)} placeholder="Seu nome" className={CLS} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Senha</label>
                <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••" className={CLS} />
              </div>
              {erro && <p className="text-sm text-critical">{erro}</p>}
              <Botao type="submit" className="w-full py-2.5">Entrar</Botao>
              <button type="button" onClick={() => { loginComoVisitante(); navigate('/') }} className="w-full text-center text-sm text-info hover:underline">
                Explorar como visitante
              </button>
            </form>
          ) : (
            <form onSubmit={criar} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Nome</label>
                <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome completo" className={CLS} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Função</label>
                <select value={papel} onChange={(e) => setPapel(e.target.value)} className={CLS}>
                  <option value="admin">Administrador — acesso total</option>
                  <option value="gerente">Gerente — ofertas, jornal e fila</option>
                  <option value="repositor">Repositor — chão de loja</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Senha</label>
                <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••" className={CLS} />
              </div>
              {erro && <p className="text-sm text-critical">{erro}</p>}
              <Botao type="submit" className="w-full py-2.5">Criar conta e entrar</Botao>
            </form>
          )}

          <div className="mt-8 rounded-xl border border-ink-soft/15 bg-white p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">Contas demo (clique para entrar)</p>
            <div className="space-y-1.5">
              {USUARIOS.map((u) => (
                <button key={u.id} onClick={() => entrarDemo(u)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-cream-200">
                  <span className="h-2 w-2 rounded-full" style={{ background: corPapel[u.papel] }} />
                  <span className="font-medium">{u.nome}</span>
                  <span className="text-ink-soft">· {u.cargo}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-soft">Senha das demo: <code className="rounded bg-cream-200 px-1">demo123</code></p>
          </div>
        </div>
      </div>
    </div>
  )
}
