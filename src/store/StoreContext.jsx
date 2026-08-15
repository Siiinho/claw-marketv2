import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import {
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
const SESSION_AUTH_KEY = 'clawmarket:sessao-autenticada'
const SESSION_USER_KEY = 'clawmarket:usuario-id'
const CONTAS_KEY = 'clawmarket:contas:v2'
const DADOS_USUARIO_PREFIX = 'clawmarket:dados:v2:'
const StoreContext = createContext(null)

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

function carregarContas(legado) {
  try {
    const salvas = JSON.parse(localStorage.getItem(CONTAS_KEY) || '[]')
    if (Array.isArray(salvas) && salvas.length) return salvas
  } catch (_) {}
  const migradas = Array.isArray(legado?.usuariosLocais) ? legado.usuariosLocais : []
  if (migradas.length) localStorage.setItem(CONTAS_KEY, JSON.stringify(migradas))
  return migradas
}

function carregarDadosUsuario(usuarioId, legado = null) {
  if (!usuarioId) return null
  try {
    const salvo = JSON.parse(localStorage.getItem(`${DADOS_USUARIO_PREFIX}${usuarioId}`) || 'null')
    if (salvo) return salvo
  } catch (_) {}
  if (legado?.usuario?.id === usuarioId) return legado
  return null
}

const dadosVazios = () => ({
  produtos: PRODUTOS_SEED,
  ofertas: OFERTAS_SEED,
  jornais: JORNAIS_SEED,
  lotes: [],
  auditoria: [],
  config: CONFIG_SEED,
  jornalOficial: JORNAL_OFICIAL_SEED,
  lojaAtiva: PILOTO_LOJA_ID,
})

export function StoreProvider({ children }) {
  const legado = carregar()
  const [contas, setContas] = useState(() => carregarContas(legado))
  const [usuario, setUsuario] = useState(() =>
    sessionStorage.getItem(SESSION_AUTH_KEY) === '1'
      ? (() => {
          const conta = carregarContas(legado).find((item) => item.id === sessionStorage.getItem(SESSION_USER_KEY))
          if (!conta) return null
          const { senha: _, ...publica } = conta
          return publica
        })()
      : null
  )
  const dadosSessao = usuario ? (carregarDadosUsuario(usuario.id, legado) || dadosVazios()) : dadosVazios()
  // garante que todo produto tenha loja (migra instalações anteriores ao multi-filial)
  const [produtos, setProdutos] = useState(() =>
    (dadosSessao.produtos ?? PRODUTOS_SEED).map((p, i) => (p.loja ? p : { ...p, loja: LOJAS[i % LOJAS.length].id }))
  )
  const [lojaAtiva, setLojaAtiva] = useState(() => {
    if (localStorage.getItem(PILOTO_LOJA_KEY) !== '1') {
      localStorage.setItem(PILOTO_LOJA_KEY, '1')
      return PILOTO_LOJA_ID
    }
    return dadosSessao.lojaAtiva ?? PILOTO_LOJA_ID
  })
  const [ofertas, setOfertas] = useState(dadosSessao.ofertas ?? OFERTAS_SEED)
  const [jornais, setJornais] = useState(dadosSessao.jornais ?? JORNAIS_SEED)
  const [lotes, setLotes] = useState(dadosSessao.lotes ?? [])
  const [auditoria, setAuditoria] = useState(dadosSessao.auditoria ?? [])
  // mescla os padrões por baixo do salvo (backfill de chaves novas, ex.: regrasPreco)
  const [config, setConfig] = useState({ ...CONFIG_SEED, ...(dadosSessao.config || {}), nomeMercado: CONFIG_SEED.nomeMercado })
  const [jornalOficial, setJornalOficial] = useState(() => {
    const sj = dadosSessao.jornalOficial
    // migra instalações antigas: capa de 2023 (Outubro Rosa) ou sem o campo `ym`
    // → volta ao seed atual (junho), preciso e com baseline de versão
    if (!sj || !sj.ym || (typeof sj.capa === 'string' && sj.capa.includes('capa-14'))) return JORNAL_OFICIAL_SEED
    return sj
  })
  const [toasts, setToasts] = useState([])

  // Restaura do banco permanente as fotos sem duplicá-las no localStorage.
  useEffect(() => {
    let ativo = true
    restaurarImagensSalvas(produtos).then((restaurados) => {
      if (ativo && restaurados.some((p, i) => p.imagem !== produtos[i]?.imagem)) {
        setProdutos(restaurados)
      }
    })
    return () => { ativo = false }
  }, [usuario?.id])

  useEffect(() => {
    localStorage.setItem(CONTAS_KEY, JSON.stringify(contas))
  }, [contas])

  // Persiste todo o trabalho no espaço isolado da conta autenticada.
  useEffect(() => {
    if (!usuario?.id) return
    const produtosLeves = produtos.map((p) =>
      p.imagemCachePermanente && String(p.imagem || '').startsWith('data:')
        ? { ...p, imagem: null }
        : p
    )
    const dump = { produtos: produtosLeves, ofertas, jornais, lotes, auditoria, config, jornalOficial, lojaAtiva }
    try {
      localStorage.setItem(`${DADOS_USUARIO_PREFIX}${usuario.id}`, JSON.stringify(dump))
    } catch (_) {}
  }, [usuario?.id, produtos, ofertas, jornais, lotes, auditoria, config, jornalOficial, lojaAtiva])

  // ===== toasts =====
  const toast = useCallback((msg, tipo = 'sucesso') => {
    const id = uid()
    setToasts((t) => [...t, { id, msg, tipo }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800)
  }, [])

  // ===== auth =====
  const aplicarDadosDaConta = useCallback((dados) => {
    const base = { ...dadosVazios(), ...(dados || {}) }
    setProdutos((base.produtos || []).map((p, i) => (p.loja ? p : { ...p, loja: LOJAS[i % LOJAS.length].id })))
    setOfertas(base.ofertas || [])
    setJornais(base.jornais || [])
    setLotes(base.lotes || [])
    setAuditoria(base.auditoria || [])
    setConfig({ ...CONFIG_SEED, ...(base.config || {}), nomeMercado: CONFIG_SEED.nomeMercado })
    setJornalOficial(base.jornalOficial || JORNAL_OFICIAL_SEED)
    setLojaAtiva(base.lojaAtiva || PILOTO_LOJA_ID)
  }, [])

  // Login exclusivamente por nome de usuário e senha.
  const login = useCallback(
    (identificador, senha) => {
      const id = (identificador || '').toLowerCase().trim()
      const u = contas.find((x) => x.nome?.toLowerCase() === id)
      if (!u || u.senha !== senha) return false
      const { senha: _, ...pub } = u
      sessionStorage.setItem(SESSION_AUTH_KEY, '1')
      sessionStorage.setItem(SESSION_USER_KEY, u.id)
      aplicarDadosDaConta(carregarDadosUsuario(u.id) || dadosVazios())
      setUsuario(pub)
      return true
    },
    [contas, aplicarDadosDaConta]
  )

  // cadastro simplificado: nome, função (papel) e senha
  const registrar = useCallback(
    ({ nome, papel, senha }) => {
      const nomeT = (nome || '').trim()
      if (!nomeT || !senha) return { ok: false, erro: 'Informe nome e senha.' }
      if (contas.some((x) => x.nome?.toLowerCase() === nomeT.toLowerCase()))
        return { ok: false, erro: 'Já existe um usuário com esse nome.' }
      const novo = { id: uid(), nome: nomeT, papel: papel || 'repositor', cargo: CARGOS[papel] || 'Repositor', senha }
      setContas((lista) => [...lista, novo])
      localStorage.setItem(CONTAS_KEY, JSON.stringify([...contas, novo]))
      const { senha: _, ...pub } = novo
      sessionStorage.setItem(SESSION_AUTH_KEY, '1')
      sessionStorage.setItem(SESSION_USER_KEY, novo.id)
      aplicarDadosDaConta(dadosVazios())
      setUsuario(pub)
      return { ok: true }
    },
    [contas, aplicarDadosDaConta]
  )

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_AUTH_KEY)
    sessionStorage.removeItem(SESSION_USER_KEY)
    setUsuario(null)
    aplicarDadosDaConta(dadosVazios())
  }, [aplicarDadosDaConta])

  const registrarAcao = useCallback((tipo, entidade, entidadeId, detalhe = '') => {
    setAuditoria((lista) => [{
      id: uid(),
      usuarioId: usuario?.id,
      usuarioNome: usuario?.nome,
      tipo,
      entidade,
      entidadeId: entidadeId || null,
      detalhe,
      criadoEm: new Date().toISOString(),
    }, ...lista].slice(0, 1000))
  }, [usuario?.id, usuario?.nome])

  // ===== produtos =====
  const salvarProduto = useCallback(
    (prod) => {
      setProdutos((list) => {
        if (prod.id && list.some((p) => p.id === prod.id)) {
          return list.map((p) => (p.id === prod.id ? { ...p, ...prod } : p))
        }
        const loja = prod.loja || (lojaAtiva !== 'todas' ? lojaAtiva : LOJAS[0].id)
        return [{
          ...prod,
          id: prod.id || uid(),
          loja,
          naFila: Boolean(prod.naFila),
          origemFila: prod.naFila ? (prod.origemFila || 'manual') : null,
          adicionadoFilaEm: prod.naFila ? (prod.adicionadoFilaEm || new Date().toISOString()) : null,
        }, ...list]
      })
      registrarAcao(prod.id ? 'editar' : 'criar', 'produto', prod.id, prod.nome || '')
    },
    [lojaAtiva, registrarAcao]
  )

  const excluirProduto = useCallback((id) => {
    setProdutos((list) => list.filter((p) => p.id !== id))
    setOfertas((list) => list.filter((o) => o.produtoId !== id))
    setLotes((list) => list.filter((l) => l.produtoId !== id))
    registrarAcao('excluir', 'produto', id)
  }, [registrarAcao])

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
    registrarAcao('escanear', 'lote', dados.produtoId, `${dados.quantidade || 1} un. · validade ${dados.validade || 'não informada'}`)
  }, [registrarAcao])

  // ===== fila do jornal =====
  const toggleFila = useCallback((id, origem = 'manual') => {
    setProdutos((list) =>
      list.map((p) =>
        p.id === id
          ? { ...p, naFila: !p.naFila, origemFila: !p.naFila ? origem : null }
          : p
      )
    )
    registrarAcao('alternar-fila', 'produto', id, origem)
  }, [registrarAcao])

  // Usado no fluxo de bipagem: confirmar duas vezes nunca remove o produto da fila.
  const adicionarNaFila = useCallback((id, origem = 'scanner') => {
    setProdutos((list) =>
      list.map((p) =>
        p.id === id
          ? {
              ...p,
              naFila: true,
              origemFila: origem || p.origemFila || 'scanner',
              adicionadoFilaEm: p.adicionadoFilaEm || new Date().toISOString(),
            }
          : p
      )
    )
    registrarAcao('adicionar-fila', 'produto', id, origem)
  }, [registrarAcao])

  // Salva e coloca na fila na mesma atualização. Isso evita que uma gravação
  // atrasada do cadastro sobrescreva `naFila: true` logo depois da bipagem.
  const salvarProdutoNaFila = useCallback((prod, origem = 'scanner') => {
    const id = prod.id || uid()
    const agora = new Date().toISOString()
    setProdutos((list) => {
      const existente = list.find((p) => p.id === id)
      if (existente) {
        return list.map((p) => p.id === id ? {
          ...p,
          ...prod,
          id,
          naFila: true,
          origemFila: origem || p.origemFila || 'scanner',
          adicionadoFilaEm: p.adicionadoFilaEm || agora,
        } : p)
      }
      const loja = prod.loja || (lojaAtiva !== 'todas' ? lojaAtiva : LOJAS[0].id)
      return [{
        ...prod,
        id,
        loja,
        naFila: true,
        origemFila: origem || 'scanner',
        adicionadoFilaEm: agora,
      }, ...list]
    })
    registrarAcao('adicionar-fila', 'produto', id, origem)
    return id
  }, [lojaAtiva, registrarAcao])

  const removerDaFila = useCallback((id) => {
    setProdutos((list) => list.map((p) => (p.id === id ? { ...p, naFila: false, origemFila: null, adicionadoFilaEm: null } : p)))
    registrarAcao('remover-fila', 'produto', id)
  }, [registrarAcao])

  // ===== ofertas =====
  const criarOferta = useCallback((produtoId, titulo, desconto, validade) => {
    setOfertas((list) => [
      { id: uid(), produtoId, titulo, desconto, validade, ativa: true },
      ...list.filter((o) => o.produtoId !== produtoId),
    ])
    registrarAcao('salvar', 'oferta', produtoId, `${titulo || 'Oferta'} · ${desconto}%`)
  }, [registrarAcao])

  const toggleOferta = useCallback((id) => {
    setOfertas((list) => list.map((o) => (o.id === id ? { ...o, ativa: !o.ativa } : o)))
    registrarAcao('alternar', 'oferta', id)
  }, [registrarAcao])

  const excluirOferta = useCallback((id) => {
    setOfertas((list) => list.filter((o) => o.id !== id))
    registrarAcao('excluir', 'oferta', id)
  }, [registrarAcao])

  // ===== jornais gerados =====
  const salvarJornal = useCallback((jornal) => {
    const salvo = { ...jornal, id: uid(), criadoEm: new Date().toISOString() }
    setJornais((list) => [salvo, ...list])
    registrarAcao('salvar', 'jornal', salvo.id, salvo.titulo || '')
    return salvo
  }, [registrarAcao])

  const excluirJornal = useCallback((id) => {
    setJornais((list) => list.filter((j) => j.id !== id))
    registrarAcao('excluir', 'jornal', id)
  }, [registrarAcao])

  // ===== config / jornal oficial =====
  const salvarConfig = useCallback((c) => {
    setConfig((prev) => ({ ...prev, ...c }))
    registrarAcao('editar', 'configuracao', usuario?.id)
  }, [registrarAcao, usuario?.id])

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
    if (usuario?.id) localStorage.removeItem(`${DADOS_USUARIO_PREFIX}${usuario.id}`)
    setProdutos(PRODUTOS_SEED)
    setOfertas(OFERTAS_SEED)
    setJornais(JORNAIS_SEED)
    setLotes([])
    setAuditoria([])
    setConfig(CONFIG_SEED)
    setJornalOficial(JORNAL_OFICIAL_SEED)
    toast('Aplicativo restaurado sem produtos cadastrados.')
  }, [toast, usuario?.id])

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
    auditoria,
    contas: contas.map(({ senha: _, ...conta }) => conta),
    config,
    jornalOficial,
    fila,
    toasts,
    toast,
    login,
    registrar,
    logout,
    salvarProduto,
    excluirProduto,
    registrarLote,
    toggleFila,
    adicionarNaFila,
    salvarProdutoNaFila,
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
