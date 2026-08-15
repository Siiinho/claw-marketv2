import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import {
  USUARIOS,
  LOJAS,
  PRODUTOS_SEED,
  OFERTAS_SEED,
  JORNAIS_SEED,
  CONFIG_SEED,
  JORNAL_OFICIAL_SEED,
} from '../data/seed'
import { uid, statusValidade } from '../lib/utils'
import { restaurarImagensSalvas } from '../lib/produtoApi'

const KEY = 'clawmarket:v1'
const LIMPEZA_CATALOGO_KEY = 'clawmarket:catalogo-limpo:2026-07-24'
const PILOTO_LOJA_ID = 'loja3'
const PILOTO_LOJA_KEY = 'clawmarket:piloto-loja3:2026-07-25'
const StoreContext = createContext(null)

function escurecerHex(cor, fator = 0.82) {
  const valor = String(cor || '').replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(valor)) return '#99151d'
  const canais = [0, 2, 4].map((inicio) => Math.min(255, Math.round(parseInt(valor.slice(inicio, inicio + 2), 16) * fator)))
  return `#${canais.map((canal) => canal.toString(16).padStart(2, '0')).join('')}`
}

// ===== Permissões por papel =====
export const NAV = [
  { key: 'dashboard', label: 'Início', path: '/', icone: 'Home' },
  { key: 'produtos', label: 'Produtos', path: '/produtos', icone: 'Package' },
  { key: 'ofertas', label: 'Ofertas', path: '/ofertas', icone: 'Tag' },
  { key: 'precificacao', label: 'Precificação', path: '/precificacao', icone: 'Percent' },
  { key: 'cartazes', label: 'Cartazes', path: '/cartazes', icone: 'Image' },
  { key: 'jornal', label: 'Jornal de Ofertas', path: '/jornal', icone: 'Newspaper' },
  { key: 'relatorios', label: 'Relatórios', path: '/relatorios', icone: 'BarChart3' },
  { key: 'esg', label: 'Sustentabilidade', path: '/sustentabilidade', icone: 'Leaf' },
  { key: 'scanner', label: 'Escanear', path: '/scanner', icone: 'ScanLine' },
  { key: 'usuarios', label: 'Usuários', path: '/usuarios', icone: 'Users' },
  { key: 'config', label: 'Configurações', path: '/config', icone: 'Settings' },
]

export const PERMISSOES = {
  // Administrador: acesso total (inclui Precificação, que envolve custo, Relatórios, Usuários, Config)
  admin: NAV.map((n) => n.key),
  // Gerente: monta ofertas/cartazes/jornal e adiciona produtos à fila — SEM precificação por custo
  gerente: ['dashboard', 'produtos', 'ofertas', 'cartazes', 'jornal', 'scanner'],
  // Repositor: operação de chão de loja
  repositor: ['dashboard', 'scanner'],
}

export const CARGOS = { admin: 'Administrador', gerente: 'Gerente', repositor: 'Repositor' }

export const podeVer = (papel, key) => (PERMISSOES[papel] || []).includes(key)
export const podeEditar = (papel) => papel === 'admin' || papel === 'gerente'

function carregar() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      localStorage.setItem(LIMPEZA_CATALOGO_KEY, '1')
      return null
    }
    if (raw) {
      const salvo = JSON.parse(raw)
      if (localStorage.getItem(LIMPEZA_CATALOGO_KEY) !== '1') {
        const limpo = { ...salvo, produtos: [], ofertas: [], jornais: [] }
        localStorage.setItem(KEY, JSON.stringify(limpo))
        localStorage.setItem(LIMPEZA_CATALOGO_KEY, '1')
        return limpo
      }
      return salvo
    }
  } catch (_) {}
  return null
}

export function StoreProvider({ children }) {
  const salvo = carregar()
  const [usuario, setUsuario] = useState(salvo?.usuario ?? null)
  // garante que todo produto tenha loja (migra instalações anteriores ao multi-filial)
  const [produtos, setProdutos] = useState(() =>
    (salvo?.produtos ?? PRODUTOS_SEED).map((p, i) => (p.loja ? p : { ...p, loja: LOJAS[i % LOJAS.length].id }))
  )
  const [lojaAtiva, setLojaAtiva] = useState(() => {
    if (localStorage.getItem(PILOTO_LOJA_KEY) !== '1') {
      localStorage.setItem(PILOTO_LOJA_KEY, '1')
      return PILOTO_LOJA_ID
    }
    return salvo?.lojaAtiva ?? PILOTO_LOJA_ID
  })
  const [usuariosLocais, setUsuariosLocais] = useState(salvo?.usuariosLocais ?? [])
  const [ofertas, setOfertas] = useState(salvo?.ofertas ?? OFERTAS_SEED)
  const [jornais, setJornais] = useState(salvo?.jornais ?? JORNAIS_SEED)
  const [lotes, setLotes] = useState(salvo?.lotes ?? [])
  // mescla os padrões por baixo do salvo (backfill de chaves novas, ex.: regrasPreco)
  const [config, setConfig] = useState({ ...CONFIG_SEED, ...(salvo?.config || {}) })
  const [jornalOficial, setJornalOficial] = useState(() => {
    const sj = salvo?.jornalOficial
    // migra instalações antigas: capa de 2023 (Outubro Rosa) ou sem o campo `ym`
    // → volta ao seed atual (junho), preciso e com baseline de versão
    if (!sj || !sj.ym || (typeof sj.capa === 'string' && sj.capa.includes('capa-14'))) return JORNAL_OFICIAL_SEED
    return sj
  })
  const [toasts, setToasts] = useState([])

  // A identidade visual é configuração de cada cliente. As classes existentes
  // usam estas variáveis, portanto toda a interface e os materiais acompanham a marca.
  useEffect(() => {
    const raiz = document.documentElement
    const primaria = config.corPrimaria || CONFIG_SEED.corPrimaria
    const secundaria = config.corSecundaria || CONFIG_SEED.corSecundaria
    const destaque = config.corDestaque || CONFIG_SEED.corDestaque
    raiz.style.setProperty('--color-bengala', primaria)
    raiz.style.setProperty('--color-bengala-dark', escurecerHex(primaria))
    raiz.style.setProperty('--color-coral', primaria)
    raiz.style.setProperty('--color-coral-dark', escurecerHex(primaria))
    raiz.style.setProperty('--color-brick', secundaria)
    raiz.style.setProperty('--color-brick-light', escurecerHex(secundaria, 1.18))
    raiz.style.setProperty('--color-navy', secundaria)
    raiz.style.setProperty('--color-navy-light', escurecerHex(secundaria, 1.18))
    raiz.style.setProperty('--color-offer', destaque)
  }, [config.corPrimaria, config.corSecundaria, config.corDestaque])

  // Restaura do banco permanente as fotos sem duplicá-las no localStorage.
  useEffect(() => {
    let ativo = true
    restaurarImagensSalvas(produtos).then((restaurados) => {
      if (ativo && restaurados.some((p, i) => p.imagem !== produtos[i]?.imagem)) {
        setProdutos(restaurados)
      }
    })
    return () => { ativo = false }
  }, [])

  // persiste tudo (menos toasts)
  useEffect(() => {
    const produtosLeves = produtos.map((p) =>
      p.imagemCachePermanente && String(p.imagem || '').startsWith('data:')
        ? { ...p, imagem: null }
        : p
    )
    const dump = { usuario, produtos: produtosLeves, ofertas, jornais, lotes, config, jornalOficial, lojaAtiva, usuariosLocais }
    try {
      localStorage.setItem(KEY, JSON.stringify(dump))
    } catch (_) {}
  }, [usuario, produtos, ofertas, jornais, lotes, config, jornalOficial, lojaAtiva, usuariosLocais])

  // ===== toasts =====
  const toast = useCallback((msg, tipo = 'sucesso') => {
    const id = uid()
    setToasts((t) => [...t, { id, msg, tipo }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800)
  }, [])

  // ===== auth =====
  // login por nome OU e-mail (aceita contas demo e contas criadas localmente)
  const login = useCallback(
    (identificador, senha) => {
      const id = (identificador || '').toLowerCase().trim()
      const u = [...USUARIOS, ...usuariosLocais].find(
        (x) => (x.email && x.email.toLowerCase() === id) || (x.nome && x.nome.toLowerCase() === id)
      )
      if (!u || u.senha !== senha) return false
      const { senha: _, ...pub } = u
      setUsuario(pub)
      return true
    },
    [usuariosLocais]
  )

  // cadastro simplificado: nome, função (papel) e senha
  const registrar = useCallback(
    ({ nome, papel, senha }) => {
      const nomeT = (nome || '').trim()
      if (!nomeT || !senha) return { ok: false, erro: 'Informe nome e senha.' }
      if ([...USUARIOS, ...usuariosLocais].some((x) => x.nome?.toLowerCase() === nomeT.toLowerCase()))
        return { ok: false, erro: 'Já existe um usuário com esse nome.' }
      const novo = { id: uid(), nome: nomeT, papel: papel || 'repositor', cargo: CARGOS[papel] || 'Repositor', senha, email: '' }
      setUsuariosLocais((l) => [...l, novo])
      const { senha: _, ...pub } = novo
      setUsuario(pub)
      return { ok: true }
    },
    [usuariosLocais]
  )

  const loginComoVisitante = useCallback(() => {
    setUsuario({ id: 'visitante', nome: 'Visitante', cargo: 'Visitante', papel: 'repositor', email: '' })
  }, [])

  const logout = useCallback(() => setUsuario(null), [])

  // ===== produtos =====
  const salvarProduto = useCallback(
    (prod) => {
      setProdutos((list) => {
        if (prod.id && list.some((p) => p.id === prod.id)) {
          return list.map((p) => (p.id === prod.id ? { ...p, ...prod } : p))
        }
        const loja = prod.loja || (lojaAtiva !== 'todas' ? lojaAtiva : LOJAS[0].id)
        return [{ ...prod, id: prod.id || uid(), loja, naFila: false, origemFila: null }, ...list]
      })
    },
    [lojaAtiva]
  )

  const excluirProduto = useCallback((id) => {
    setProdutos((list) => list.filter((p) => p.id !== id))
    setOfertas((list) => list.filter((o) => o.produtoId !== id))
    setLotes((list) => list.filter((l) => l.produtoId !== id))
  }, [])

  const registrarLote = useCallback((dados) => {
    const agora = new Date().toISOString()
    setLotes((list) => {
      const existente = list.find(
        (l) =>
          l.produtoId === dados.produtoId &&
          l.loja === (dados.loja || PILOTO_LOJA_ID) &&
          l.validade === dados.validade &&
          (l.codigoLote || '') === (dados.codigoLote || '')
      )
      if (existente) {
        return list.map((l) =>
          l.id === existente.id
            ? { ...l, ...dados, quantidade: Number(dados.quantidade) || 1, atualizadoEm: agora }
            : l
        )
      }
      return [
        {
          id: uid(),
          loja: dados.loja || PILOTO_LOJA_ID,
          quantidade: Number(dados.quantidade) || 1,
          escaneadoEm: agora,
          ...dados,
        },
        ...list,
      ]
    })
  }, [])

  // ===== fila do jornal =====
  const toggleFila = useCallback((id, origem = 'manual') => {
    setProdutos((list) =>
      list.map((p) =>
        p.id === id
          ? { ...p, naFila: !p.naFila, origemFila: !p.naFila ? origem : null }
          : p
      )
    )
  }, [])

  // Usado no fluxo de bipagem: confirmar duas vezes nunca remove o produto da fila.
  const adicionarNaFila = useCallback((id, origem = 'scanner') => {
    setProdutos((list) =>
      list.map((p) =>
        p.id === id
          ? { ...p, naFila: true, origemFila: origem || p.origemFila || 'scanner' }
          : p
      )
    )
  }, [])

  const removerDaFila = useCallback((id) => {
    setProdutos((list) => list.map((p) => (p.id === id ? { ...p, naFila: false, origemFila: null } : p)))
  }, [])

  // ===== ofertas =====
  const criarOferta = useCallback((produtoId, titulo, desconto, validade) => {
    setOfertas((list) => [
      { id: uid(), produtoId, titulo, desconto, validade, ativa: true },
      ...list.filter((o) => o.produtoId !== produtoId),
    ])
  }, [])

  const toggleOferta = useCallback((id) => {
    setOfertas((list) => list.map((o) => (o.id === id ? { ...o, ativa: !o.ativa } : o)))
  }, [])

  const excluirOferta = useCallback((id) => {
    setOfertas((list) => list.filter((o) => o.id !== id))
  }, [])

  // ===== jornais gerados =====
  const salvarJornal = useCallback((jornal) => {
    setJornais((list) => [{ ...jornal, id: uid(), criadoEm: new Date().toISOString() }, ...list])
  }, [])

  const excluirJornal = useCallback((id) => {
    setJornais((list) => list.filter((j) => j.id !== id))
  }, [])

  // ===== config / jornal oficial =====
  const salvarConfig = useCallback((c) => setConfig((prev) => ({ ...prev, ...c })), [])

  const atualizarJornalOficial = useCallback((dados) => {
    setJornalOficial((prev) => {
      const novaEdicao = dados.edicao && dados.edicao !== prev.edicao
      const historico = novaEdicao
        ? [{ edicao: prev.edicao, capa: prev.capa, data: prev.data }, ...(prev.historico || [])].slice(0, 8)
        : prev.historico
      return { ...prev, ...dados, novo: !!novaEdicao, historico }
    })
  }, [])

  const resetar = useCallback(() => {
    localStorage.removeItem(KEY)
    setProdutos(PRODUTOS_SEED)
    setOfertas(OFERTAS_SEED)
    setJornais(JORNAIS_SEED)
    setLotes([])
    setConfig(CONFIG_SEED)
    setJornalOficial(JORNAL_OFICIAL_SEED)
    toast('Aplicativo restaurado sem produtos cadastrados.')
  }, [toast])

  // ===== derivados úteis =====
  const ofertaDoProduto = useCallback(
    (produtoId) => ofertas.find((o) => o.produtoId === produtoId && o.ativa) || null,
    [ofertas]
  )

  // produtos da loja ativa ('todas' = rede consolidada)
  const produtosVisiveis = useMemo(
    () => (lojaAtiva === 'todas' ? produtos : produtos.filter((p) => p.loja === lojaAtiva)),
    [produtos, lojaAtiva]
  )

  const fila = useMemo(() => produtosVisiveis.filter((p) => p.naFila), [produtosVisiveis])

  const value = {
    usuario,
    produtos: produtosVisiveis,
    todosProdutos: produtos,
    lojas: LOJAS,
    lojaAtiva,
    setLojaAtiva,
    ofertas,
    jornais,
    lotes,
    config,
    jornalOficial,
    fila,
    toasts,
    toast,
    login,
    registrar,
    loginComoVisitante,
    logout,
    salvarProduto,
    excluirProduto,
    registrarLote,
    toggleFila,
    adicionarNaFila,
    removerDaFila,
    criarOferta,
    toggleOferta,
    excluirOferta,
    ofertaDoProduto,
    salvarJornal,
    excluirJornal,
    salvarConfig,
    atualizarJornalOficial,
    resetar,
    statusValidade,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export const useStore = () => {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore deve ser usado dentro de StoreProvider')
  return ctx
}
