import { NomeClawMarket, SimboloClawMarket } from './MarcaClawMarket'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useStore, NAV, podeVer } from '../store/StoreContext'
import { Icon, ImagemAba } from './ui'
import { InstallButton, OfflineBadge } from './Pwa'

const SUBTITULOS = {
  dashboard: 'O que precisa de atenção hoje',
  produtos: 'Seus produtos e os que vão vencer',
  ofertas: 'Descontos e promoções ativas',
  precificacao: 'Desconto automático conforme o vencimento',
  cartazes: 'Cartazes e etiquetas de gôndola para imprimir',
  jornal: 'Bipe, coloque o preço, escolha a campanha e publique',
  relatorios: 'Indicadores e perdas',
  esg: 'Impacto ambiental e desperdício evitado',
  scanner: 'Confira a validade dos produtos da gôndola',
  usuarios: 'Equipe e permissões',
  config: 'Estabelecimento e automação',
  mercado: 'Logo, lojas, pagamentos e o modelo do encarte',
}

// Abas da faixa superior (desktop); o resto vai para "Mais".
const MENU_PRINCIPAL = ['dashboard', 'produtos', 'ofertas', 'jornal']
// Barra inferior do celular: o botão de bipar fica no centro, maior.
const MENU_MOBILE = [
  { key: 'dashboard', label: 'Início', path: '/', icone: 'Home', end: true },
  { key: 'produtos', label: 'Produtos', path: '/produtos', icone: 'Package' },
  { key: 'scanner', label: 'Validade', path: '/scanner', icone: 'ScanBarcode', central: true },
  { key: 'jornal', label: 'Jornal', path: '/jornal', icone: 'Newspaper' },
]

function useFecharAoClicarFora(aberto, fechar) {
  const ref = useRef(null)
  useEffect(() => {
    if (!aberto) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) fechar() }
    const onEsc = (e) => e.key === 'Escape' && fechar()
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onEsc)
    }
  }, [aberto, fechar])
  return ref
}

export default function Layout() {
  const { usuario, logout, lojas, lojaAtiva, setLojaAtiva } = useStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [busca, setBusca] = useState('')
  const [maisAberto, setMaisAberto] = useState(false)
  const [contaAberta, setContaAberta] = useState(false)
  const [folhaAberta, setFolhaAberta] = useState(false)

  const atual = NAV.find((n) => n.path === location.pathname) || NAV[0]
  const itensVisiveis = NAV.filter((n) => podeVer(usuario.papel, n.key))
  const itensPrincipais = MENU_PRINCIPAL
    .map((key) => itensVisiveis.find((n) => n.key === key))
    .filter(Boolean)
  const itensSecundarios = itensVisiveis.filter((n) => !MENU_PRINCIPAL.includes(n.key) && n.key !== 'scanner')
  const itensMobile = MENU_MOBILE.filter((n) => podeVer(usuario.papel, n.key))
  const secundariosMobile = itensVisiveis.filter((n) => !MENU_MOBILE.some((m) => m.key === n.key))
  const inicial = (usuario.nome || '?').charAt(0).toUpperCase()
  const atualNoMais = itensSecundarios.some((n) => n.key === atual.key)

  const refMais = useFecharAoClicarFora(maisAberto, () => setMaisAberto(false))
  const refConta = useFecharAoClicarFora(contaAberta, () => setContaAberta(false))

  useEffect(() => {
    setMaisAberto(false)
    setContaAberta(false)
    setFolhaAberta(false)
  }, [location.pathname])

  const sair = () => {
    logout()
    navigate('/login')
  }

  const abaCls = ({ isActive }) =>
    `relative my-2 flex items-center gap-2 rounded-xl pl-2 pr-3.5 text-[15px] font-semibold transition-colors duration-150 ${
      isActive ? 'bg-white/[0.14] text-white' : 'text-white/85 hover:bg-white/[0.07] hover:text-white'
    }`

  const seletorLoja = (escuro) => (
    <div className="relative">
      <Icon name="Store" size={15} className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 ${escuro ? 'text-white/85' : 'text-ink-soft'}`} />
      <select
        value={lojaAtiva}
        onChange={(e) => setLojaAtiva(e.target.value)}
        aria-label="Loja"
        className={`w-full appearance-none rounded-lg py-2 pl-8 pr-7 text-sm font-medium outline-none ${
          escuro
            ? 'border border-white/15 bg-white/8 text-white focus:border-offer [&>option]:text-ink'
            : 'border border-ink-soft/20 bg-white text-ink focus:border-bengala focus:ring-2 focus:ring-bengala/20'
        }`}
      >
        <option value="todas">Todas as lojas</option>
        {lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
      </select>
      <Icon name="ChevronDown" size={14} className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 ${escuro ? 'text-white/85' : 'text-ink-soft'}`} />
    </div>
  )

  return (
    <div className="app-ui flex h-screen h-dvh flex-col overflow-hidden bg-cream">
      {/* faixa superior: azul da marca com o filete vermelho do encarte */}
      <header
        className="relative z-30 shrink-0 bg-navy text-white"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 md:gap-4 md:px-6">
          <NavLink to="/" className="flex shrink-0 items-center gap-2.5 rounded-lg" aria-label="ClawMarket, início">
            <SimboloClawMarket tamanho={34} />
            <NomeClawMarket className="hidden text-[22px] leading-tight sm:inline" />
          </NavLink>

          {/* título da página no celular */}
          <div className="min-w-0 flex-1 md:hidden">
            <p className="display-bengala truncate text-lg leading-none">{atual.label}</p>
          </div>

          {/* abas no desktop */}
          <nav className="ml-2 hidden h-14 items-stretch md:flex" aria-label="Navegação principal">
            {itensPrincipais.map((n) => (
              <NavLink key={n.key} to={n.path} end={n.path === '/'} className={abaCls}>
                {({ isActive }) => (
                  <>
                    <ImagemAba id={n.key} size={24} />
                    <span className="whitespace-nowrap">{n.label}</span>
                    {isActive && <span className="absolute inset-x-3 -bottom-2 h-[3px] rounded-t bg-offer" />}
                  </>
                )}
              </NavLink>
            ))}
            {itensSecundarios.length > 0 && (
              <div ref={refMais} className="relative flex">
                <button
                  onClick={() => setMaisAberto((a) => !a)}
                  aria-expanded={maisAberto}
                  className={`relative my-2 flex items-center gap-2 rounded-xl pl-2 pr-3 text-[15px] font-semibold transition-colors duration-150 ${atualNoMais ? 'bg-white/[0.14] text-white' : 'text-white/85 hover:bg-white/[0.07] hover:text-white'}`}
                >
                  {atualNoMais && <ImagemAba id={atual.key} size={24} />}
                  {atualNoMais ? atual.label : 'Mais'}
                  <Icon name="ChevronDown" size={15} />
                  {atualNoMais && <span className="absolute inset-x-3 -bottom-2 h-[3px] rounded-t bg-offer" />}
                </button>
                {maisAberto && (
                  <div className="menu-in absolute left-0 top-[calc(100%+6px)] w-60 origin-top-left rounded-xl border border-navy/10 bg-white p-1.5 text-ink shadow-[0_12px_32px_rgba(8,43,79,.18)]">
                    {itensSecundarios.map((n) => (
                      <NavLink
                        key={n.key}
                        to={n.path}
                        className={({ isActive }) => `flex items-center gap-3 rounded-lg px-2.5 py-2 text-[15px] font-medium ${isActive ? 'bg-cream-200 font-semibold text-navy' : 'text-ink hover:bg-cream'}`}
                      >
                        <ImagemAba id={n.key} size={26} />
                        {n.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <OfflineBadge />
            <div className="hidden w-48 lg:block">{seletorLoja(true)}</div>
            {podeVer(usuario.papel, 'scanner') && atual.key !== 'scanner' && (
              <button
                onClick={() => navigate('/scanner')}
                className="hidden h-10 items-center gap-2 rounded-lg bg-bengala px-4 text-sm font-semibold text-white hover:bg-bengala-dark md:inline-flex"
              >
                <Icon name="CalendarSearch" size={18} />
                <span className="whitespace-nowrap"><span className="hidden xl:inline">Conferir </span>validade</span>
              </button>
            )}
            <div ref={refConta} className="relative hidden md:block">
              <button
                onClick={() => setContaAberta((a) => !a)}
                aria-label="Conta"
                aria-expanded={contaAberta}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-offer text-sm font-bold text-navy"
              >
                {inicial}
              </button>
              {contaAberta && (
                <div className="menu-in absolute right-0 top-[calc(100%+8px)] w-64 origin-top-right rounded-xl border border-navy/10 bg-white p-3 text-ink shadow-[0_12px_32px_rgba(8,43,79,.18)]">
                  <p className="truncate font-semibold">{usuario.nome}</p>
                  <p className="truncate text-xs text-ink-soft">{usuario.cargo}</p>
                  <div className="mt-3 lg:hidden">{seletorLoja(false)}</div>
                  <div className="mt-3"><InstallButton /></div>
                  <button onClick={sair} className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-ink-soft hover:bg-cream hover:text-ink">
                    <Icon name="LogOut" size={16} /> Sair
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => setFolhaAberta(true)}
              aria-label="Menu"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 md:hidden"
            >
              <Icon name="Menu" size={21} />
            </button>
          </div>
        </div>
        <div className="h-[3px] bg-bengala" />
      </header>

      <main className="flex-1 overflow-x-hidden overflow-y-auto pb-28 md:pb-10">
        <div className="mx-auto max-w-7xl px-4 pt-5 md:px-6 md:pt-7">
          {atual.key !== 'dashboard' && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              {/* o que fazer nesta aba: sempre visível e bem legível, também no celular */}
              <div className="flex min-w-0 items-center gap-3 md:gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-navy/10 md:h-14 md:w-14">
                  <ImagemAba id={atual.key} size={32} />
                </span>
                <div className="min-w-0">
                  <h1 className="display-bengala hidden text-[30px] leading-none text-navy md:block">{atual.label}</h1>
                  <p className="text-[16px] font-semibold leading-snug text-ink md:mt-1.5 md:text-[17px]">{SUBTITULOS[atual.key]}</p>
                </div>
              </div>
              {atual.key === 'produtos' && (
                <div className="relative hidden md:block">
                  <Icon name="Search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar produto..."
                    className="w-72 rounded-lg border border-ink-soft/20 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-bengala focus:ring-2 focus:ring-bengala/20"
                  />
                </div>
              )}
            </div>
          )}
          {atual.key === 'produtos' && (
            <div className="relative mb-4 md:hidden">
              <Icon name="Search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar produto..."
                className="w-full rounded-lg border border-ink-soft/20 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-bengala focus:ring-2 focus:ring-bengala/20"
              />
            </div>
          )}
          <Outlet context={{ busca, setBusca }} />
        </div>
      </main>

      {/* barra inferior do celular, com o botão de bipar em destaque */}
      {itensMobile.length > 1 && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-30 border-t border-navy/10 bg-white px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-1.5 md:hidden"
          aria-label="Navegação principal"
        >
          <div className="grid items-end" style={{ gridTemplateColumns: `repeat(${itensMobile.length}, minmax(0, 1fr))` }}>
            {itensMobile.map((item) =>
              item.central ? (
                <NavLink key={item.path} to={item.path} className="flex flex-col items-center gap-1 text-[12px] font-bold text-bengala">
                  <span className="-mt-6 flex h-15 w-15 items-center justify-center rounded-full border-4 border-white bg-bengala text-white shadow-[0_6px_16px_rgba(216,30,41,.35)]">
                    <Icon name={item.icone} size={26} />
                  </span>
                  {item.label}
                </NavLink>
              ) : (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex min-h-12 flex-col items-center justify-center gap-1 text-[12px] font-bold ${isActive ? 'text-navy' : 'text-ink-soft'}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-150 ${isActive ? 'bg-navy/[0.09]' : ''}`}>
                        <ImagemAba id={item.key} size={26} />
                      </span>
                      {item.label}
                    </>
                  )}
                </NavLink>
              )
            )}
          </div>
        </nav>
      )}

      {/* folha do celular: outras páginas, loja e conta */}
      {folhaAberta && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="overlay-in absolute inset-0 bg-ink/45" onClick={() => setFolhaAberta(false)} />
          <div className="sheet-in absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-cream-200" />
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-offer font-bold text-navy">{inicial}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{usuario.nome}</p>
                <p className="truncate text-xs text-ink-soft">{usuario.cargo}</p>
              </div>
              <button onClick={() => setFolhaAberta(false)} aria-label="Fechar" className="rounded-lg p-2 text-ink-soft hover:bg-cream">
                <Icon name="X" size={20} />
              </button>
            </div>
            <div className="mb-4">{seletorLoja(false)}</div>
            {secundariosMobile.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {secundariosMobile.map((n) => (
                  <NavLink
                    key={n.key}
                    to={n.path}
                    className={({ isActive }) => `flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border p-2 text-center text-xs font-semibold ${isActive ? 'border-navy bg-navy/[0.06] text-navy' : 'border-navy/10 text-ink'}`}
                  >
                    <ImagemAba id={n.key} size={30} />
                    {n.label}
                  </NavLink>
                ))}
              </div>
            )}
            <div className="mt-4"><InstallButton /></div>
            <button onClick={sair} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-ink-soft/20 py-3 text-sm font-semibold text-ink">
              <Icon name="LogOut" size={16} /> Sair
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
