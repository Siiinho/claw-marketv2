import { lazy, Suspense, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useStore, podeVer } from './store/StoreContext'
import { MarcaContexto, marcaPublica } from './lib/marca'
import AberturaApp from './components/AberturaApp'
import { Icon, Toasts } from './components/ui'
import Layout from './components/Layout'
import Login from './pages/Login'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Produtos = lazy(() => import('./pages/Produtos'))
const Ofertas = lazy(() => import('./pages/Ofertas'))
const Precificacao = lazy(() => import('./pages/Precificacao'))
const Cartazes = lazy(() => import('./pages/Cartazes'))
const Jornal = lazy(() => import('./pages/Jornal'))
const Relatorios = lazy(() => import('./pages/Relatorios'))
const Sustentabilidade = lazy(() => import('./pages/Sustentabilidade'))
const Scanner = lazy(() => import('./pages/Scanner'))
const Usuarios = lazy(() => import('./pages/Usuarios'))
const Config = lazy(() => import('./pages/Config'))
const EncarteDigital = lazy(() => import('./pages/EncarteDigital'))
const Mercado = lazy(() => import('./pages/Mercado'))
const Visitas = lazy(() => import('./pages/Visitas'))
const JornalPapel = lazy(() => import('./pages/FolhearEncarte'))
const WhatsappOfertas = lazy(() => import('./pages/WhatsappOfertas'))

function Carregando() {
  return (
    <div className="flex min-h-48 items-center justify-center gap-2 text-sm font-medium text-bengala">
      <Icon name="LoaderCircle" size={20} className="animate-spin" /> Carregando…
    </div>
  )
}

function Protegida({ chave, children }) {
  const { usuario, carregandoSessao } = useStore()
  const location = useLocation()
  if (carregandoSessao) return <Carregando />
  if (!usuario) return <Navigate to="/login" replace state={{ from: location }} />
  // Login master no primeiro acesso: troca a senha antes de liberar o resto.
  if (usuario.trocarSenha) return <TrocarSenhaObrigatoria />
  if (chave && !podeVer(usuario.papel, chave)) return <Navigate to="/" replace />
  return children
}

function TrocarSenhaObrigatoria() {
  const { trocarSenha, logout, toast } = useStore()
  const [nova, setNova] = useState('')
  const [repetir, setRepetir] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const enviar = async (e) => {
    e.preventDefault()
    if (nova !== repetir) return setErro('As duas senhas não são iguais.')
    setEnviando(true)
    const r = await trocarSenha(nova)
    setEnviando(false)
    if (!r.ok) return setErro(r.erro)
    toast('Senha do administrador trocada.')
  }
  const cls = 'w-full rounded-lg border border-ink-soft/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-bengala focus:ring-2 focus:ring-bengala/20'
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream p-4">
      <form onSubmit={enviar} className="w-full max-w-sm space-y-3 rounded-2xl bg-white p-6 shadow-lg">
        <h1 className="text-xl font-black text-ink">Crie a senha do administrador</h1>
        <p className="text-sm text-ink-soft">Este é o primeiro acesso do login master. Troque a senha "admin" por uma só sua, com pelo menos 6 caracteres.</p>
        <label className="block text-sm font-medium" htmlFor="nova-senha">Senha nova</label>
        <input id="nova-senha" type="password" autoComplete="new-password" className={cls} value={nova} onChange={(e) => setNova(e.target.value)} />
        <label className="block text-sm font-medium" htmlFor="repetir-senha">Repita a senha nova</label>
        <input id="repetir-senha" type="password" autoComplete="new-password" className={cls} value={repetir} onChange={(e) => setRepetir(e.target.value)} />
        {erro && <p className="text-sm font-bold text-critical" role="alert">{erro}</p>}
        <button type="submit" disabled={enviando} className="w-full rounded-lg bg-bengala py-2.5 text-sm font-black text-white disabled:opacity-60">{enviando ? 'Salvando…' : 'Salvar senha e entrar'}</button>
        <button type="button" onClick={logout} className="w-full text-sm font-bold text-ink-soft">Sair</button>
      </form>
    </div>
  )
}

export default function App() {
  const { usuario, carregandoSessao, config } = useStore()
  // abertura animada só ao entrar no app (o site do cliente abre direto no jornal)
  const [comAbertura] = useState(() => typeof window === 'undefined' || !/^#\/(encarte|folhear|whatsapp)/.test(window.location.hash))
  return (
    <MarcaContexto.Provider value={marcaPublica(config?.mercado)}>
      {comAbertura && <AberturaApp pronto={!carregandoSessao} />}
      <Suspense fallback={<Carregando />}>
        <Routes>
          {/* público: o link da tag NFC abre aqui, sem login */}
          <Route path="/encarte" element={<JornalPapel />} />
          {/* a versão em lista, para comparar */}
          <Route path="/encarte-lista" element={<EncarteDigital />} />
          {/* protótipo: o mesmo encarte com cara de jornal impresso */}
          <Route path="/folhear" element={<JornalPapel />} />
          {/* público: o QR verde do rodapé abre aqui (escolher a loja e entrar no grupo de ofertas) */}
          <Route path="/whatsapp" element={<WhatsappOfertas />} />
          <Route path="/login" element={carregandoSessao ? <Carregando /> : usuario ? <Navigate to="/" replace /> : <Login />} />
          <Route element={<Protegida><Layout /></Protegida>}>
            <Route index element={<Dashboard />} />
            <Route path="produtos" element={<Protegida chave="produtos"><Produtos /></Protegida>} />
            <Route path="ofertas" element={<Protegida chave="ofertas"><Ofertas /></Protegida>} />
            <Route path="precificacao" element={<Protegida chave="precificacao"><Precificacao /></Protegida>} />
            <Route path="cartazes" element={<Protegida chave="cartazes"><Cartazes /></Protegida>} />
            <Route path="jornal" element={<Protegida chave="jornal"><Jornal /></Protegida>} />
            <Route path="relatorios" element={<Protegida chave="relatorios"><Relatorios /></Protegida>} />
            <Route path="sustentabilidade" element={<Protegida chave="esg"><Sustentabilidade /></Protegida>} />
            <Route path="scanner" element={<Protegida chave="scanner"><Scanner /></Protegida>} />
            <Route path="usuarios" element={<Protegida chave="usuarios"><Usuarios /></Protegida>} />
            <Route path="config" element={<Protegida chave="config"><Config /></Protegida>} />
            <Route path="mercado" element={<Protegida chave="mercado"><Mercado /></Protegida>} />
            <Route path="visitas" element={<Protegida chave="visitas"><Visitas /></Protegida>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toasts />
    </MarcaContexto.Provider>
  )
}
