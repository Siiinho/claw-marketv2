import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
import {
  nuvemAtiva, sessaoNuvem, entrarNuvem, criarContaNuvem, sairNuvem, trocarSenhaNuvem,
  listarPerfisNuvem, alterarPapelNuvem, baixarTudoNuvem, gravarNuvem, assinarNuvem,
} from '../lib/nuvem'

const KEY = 'clawmarket:v1'
const LIMPEZA_CATALOGO_KEY = 'clawmarket:catalogo-limpo:2026-07-24'
const PILOTO_LOJA_ID = 'loja3'
const PILOTO_LOJA_KEY = 'clawmarket:piloto-loja3:2026-07-25'
const SESSION_AUTH_KEY = 'clawmarket:sessao-autenticada'
const SESSION_USER_KEY = 'clawmarket:usuario-id'
const CONTAS_KEY = 'clawmarket:contas:v2'
const DADOS_USUARIO_PREFIX = 'clawmarket:dados:v2:'
// Dados da loja: um só conjunto para todos os logins (antes cada login tinha o seu).
const DADOS_LOJA_KEY = 'clawmarket:dados-loja:v3'
// Login master: existe sempre, é administrador e entra sempre com admin / admin (escolha do mercado).
const MASTER = { id: 'master-admin', nome: 'admin', papel: 'admin', cargo: 'Administrador', senha: 'admin', master: true, trocarSenha: false }
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

function comMaster(lista) {
  const outras = lista.filter((c) => !c.master && c.id !== MASTER.id)
  const master = lista.find((c) => c.master || c.id === MASTER.id)
  // Um login comum chamado "admin" criado antes do master passa a se chamar "admin (antigo)".
  const semConflito = outras.map((c) => (c.nome?.toLowerCase() === 'admin' ? { ...c, nome: 'admin (antigo)' } : c))
  return [{ ...MASTER, ...(master || {}), master: true, papel: 'admin', nome: 'admin', senha: 'admin', trocarSenha: false }, ...semConflito]
}

function carregarContas(legado) {
  let lista = []
  try {
    const salvas = JSON.parse(localStorage.getItem(CONTAS_KEY) || '[]')
    if (Array.isArray(salvas)) lista = salvas
  } catch (_) {}
  if (!lista.length && Array.isArray(legado?.usuariosLocais)) lista = legado.usuariosLocais
  const final = comMaster(lista)
  try { localStorage.setItem(CONTAS_KEY, JSON.stringify(final)) } catch (_) {}
  return final
}

// Junta numa lista só os itens de vários logins (o mais recente de cada id vence).
function juntarPorId(listas) {
  const mapa = new Map()
  for (const lista of listas) for (const item of lista || []) if (item?.id) mapa.set(item.id, { ...(mapa.get(item.id) || {}), ...item })
  return [...mapa.values()]
}

function carregarDadosLoja(legado = null) {
  try {
    const salvo = JSON.parse(localStorage.getItem(DADOS_LOJA_KEY) || 'null')
    if (salvo) return salvo
  } catch (_) {}
  // Migração: antes cada login guardava os próprios dados. Junta tudo num conjunto só.
  const dumps = []
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i)
      if (k?.startsWith(DADOS_USUARIO_PREFIX)) {
        const d = JSON.parse(localStorage.getItem(k) || 'null')
        if (d) dumps.push(d)
      }
    }
  } catch (_) {}
  if (legado) dumps.push(legado)
  if (!dumps.length) return null
  const ultimo = dumps[dumps.length - 1]
  return {
    ...ultimo,
    produtos: juntarPorId(dumps.map((d) => d.produtos)),
    ofertas: juntarPorId(dumps.map((d) => d.ofertas)),
    jornais: juntarPorId(dumps.map((d) => d.jornais)).sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || ''))),
    lotes: juntarPorId(dumps.map((d) => d.lotes)),
    auditoria: juntarPorId(dumps.map((d) => d.auditoria)).sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || ''))).slice(0, 1000),
  }
}

// Coleções guardadas na nuvem, uma linha por item.
const COLECOES_LISTA = ['produtos', 'ofertas', 'jornais', 'lotes', 'auditoria']
const produtoParaNuvem = (p) => (p.imagemCachePermanente && String(p.imagem || '').startsWith('data:') ? { ...p, imagemCachePermanente: false } : p)

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
  const nuvem = nuvemAtiva()
  const [usuario, setUsuario] = useState(() =>
    !nuvem && sessionStorage.getItem(SESSION_AUTH_KEY) === '1'
      ? (() => {
          const conta = carregarContas(legado).find((item) => item.id === sessionStorage.getItem(SESSION_USER_KEY))
          if (!conta) return null
          const { senha: _, ...publica } = conta
          return publica
        })()
      : null
  )
  const dadosSessao = carregarDadosLoja(legado) || dadosVazios()
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

  // Persiste o trabalho da loja neste aparelho (o mesmo para todos os logins).
  useEffect(() => {
    const produtosLeves = produtos.map((p) =>
      p.imagemCachePermanente && String(p.imagem || '').startsWith('data:')
        ? { ...p, imagem: null }
        : p
    )
    const dump = { produtos: produtosLeves, ofertas, jornais, lotes, auditoria, config, jornalOficial, lojaAtiva }
    try {
      localStorage.setItem(DADOS_LOJA_KEY, JSON.stringify(dump))
    } catch (_) {}
  }, [produtos, ofertas, jornais, lotes, auditoria, config, jornalOficial, lojaAtiva])

  // ===== toasts =====
  const toast = useCallback((msg, tipo = 'sucesso') => {
    const id = uid()
    setToasts((t) => [...t, { id, msg, tipo }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800)
  }, [])

  // ===== auth =====
  const entrarLocal = (conta) => {
    const { senha: _, ...pub } = conta
    sessionStorage.setItem(SESSION_AUTH_KEY, '1')
    sessionStorage.setItem(SESSION_USER_KEY, conta.id)
    setUsuario(pub)
  }

  // Login por nome de usuário e senha. Devolve uma Promise<boolean>.
  // Os dados da loja não mudam ao trocar de login: são os mesmos para todos.
  const login = useCallback(
    async (identificador, senha) => {
      const id = (identificador || '').toLowerCase().trim()
      if (nuvem) {
        const perfil = await entrarNuvem(id, senha)
        if (!perfil) return false
        setUsuario(perfil)
        return true
      }
      const u = contas.find((x) => x.nome?.toLowerCase() === id)
      if (!u || u.senha !== senha) return false
      entrarLocal(u)
      return true
    },
    [contas, nuvem]
  )

  // Cadastro: nome e senha. Toda conta nova começa como repositor; o admin muda a função
  // na tela Usuários.
  const registrar = useCallback(
    async ({ nome, senha }) => {
      const nomeT = (nome || '').trim()
      if (!nomeT || !senha) return { ok: false, erro: 'Informe nome e senha.' }
      if (nomeT.toLowerCase() === 'admin' || nomeT.toLowerCase().startsWith('admin ')) return { ok: false, erro: 'Esse nome é reservado. Escolha outro.' }
      if (senha.length < 4) return { ok: false, erro: 'A senha precisa de pelo menos 4 caracteres.' }
      if (nuvem) {
        const r = await criarContaNuvem({ nome: nomeT, senha })
        if (r.ok) setUsuario(r.usuario)
        return r
      }
      if (contas.some((x) => x.nome?.toLowerCase() === nomeT.toLowerCase()))
        return { ok: false, erro: 'Já existe um usuário com esse nome.' }
      const novo = { id: uid(), nome: nomeT, papel: 'repositor', cargo: CARGOS.repositor, senha }
      const lista = [...contas, novo]
      setContas(lista)
      localStorage.setItem(CONTAS_KEY, JSON.stringify(lista))
      entrarLocal(novo)
      return { ok: true }
    },
    [contas, nuvem]
  )

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_AUTH_KEY)
    sessionStorage.removeItem(SESSION_USER_KEY)
    if (nuvem) sairNuvem().catch(() => {})
    setUsuario(null)
  }, [nuvem])

  // Troca de senha (a tela só aparece se o perfil estiver marcado para trocar; o master não troca).
  const trocarSenha = useCallback(async (nova) => {
    if (!nova || nova.length < 6) return { ok: false, erro: 'A senha nova precisa de pelo menos 6 caracteres.' }
    if (nova === 'admin') return { ok: false, erro: 'Escolha uma senha diferente de "admin".' }
    if (nuvem) {
      if (!(await trocarSenhaNuvem(nova))) return { ok: false, erro: 'Não foi possível trocar a senha agora.' }
    } else {
      const lista = contas.map((c) => (c.id === usuario?.id ? { ...c, senha: nova, trocarSenha: false } : c))
      setContas(lista)
      localStorage.setItem(CONTAS_KEY, JSON.stringify(lista))
    }
    setUsuario((u) => (u ? { ...u, trocarSenha: false } : u))
    return { ok: true }
  }, [contas, nuvem, usuario?.id])

  // Só o admin muda a função de alguém. O master continua sempre administrador.
  const alterarPapel = useCallback(async (id, papel) => {
    if (usuario?.papel !== 'admin' || !CARGOS[papel]) return false
    if (nuvem) {
      const ok = await alterarPapelNuvem(id, papel)
      if (ok) setContas((lista) => lista.map((c) => (c.id === id ? { ...c, papel, cargo: CARGOS[papel] } : c)))
      return ok
    }
    const lista = contas.map((c) => (c.id === id && !c.master ? { ...c, papel, cargo: CARGOS[papel] } : c))
    setContas(lista)
    localStorage.setItem(CONTAS_KEY, JSON.stringify(lista))
    return true
  }, [contas, nuvem, usuario?.papel])

  // ===== nuvem: mesmos dados em todos os aparelhos e logins =====
  const [nuvemStatus, setNuvemStatus] = useState(nuvem ? 'conectando' : 'desligada')
  // Lista de logins: na nuvem é relida ao abrir a tela Usuários (contas novas de outros aparelhos).
  const recarregarContas = useCallback(async () => {
    if (!nuvem || !usuario?.id) return
    try { setContas(await listarPerfisNuvem()) } catch (_) { /* fica a lista atual */ }
  }, [nuvem, usuario?.id])
  const espelho = useRef(new Map()) // `${colecao}:${id}` -> JSON do que a nuvem já tem
  const pronta = useRef(false)

  // Ao abrir o app, retoma a sessão salva do Supabase.
  const [carregandoSessao, setCarregandoSessao] = useState(nuvem)
  useEffect(() => {
    if (!nuvem) return
    let ativo = true
    sessaoNuvem()
      .then((perfil) => { if (ativo && perfil) setUsuario(perfil) })
      .catch(() => {})
      .finally(() => { if (ativo) setCarregandoSessao(false) })
    return () => { ativo = false }
  }, [nuvem])

  // Logado: baixa tudo da nuvem, sobe o que só existia neste aparelho e passa a ouvir as mudanças.
  useEffect(() => {
    if (!nuvem || !usuario?.id) return undefined
    let ativo = true
    let parar = null
    pronta.current = false
    setNuvemStatus('conectando')
    ;(async () => {
      try {
        const linhas = await baixarTudoNuvem()
        if (!ativo) return
        const mapa = espelho.current
        mapa.clear()
        const remoto = { produtos: new Map(), ofertas: new Map(), jornais: new Map(), lotes: new Map(), auditoria: new Map() }
        let configRemota = null
        let oficialRemoto = null
        for (const l of linhas) {
          mapa.set(`${l.colecao}:${l.id}`, l.excluido ? null : JSON.stringify(l.dados))
          if (l.excluido) continue
          if (remoto[l.colecao]) remoto[l.colecao].set(l.id, l.dados)
          else if (l.colecao === 'config') configRemota = l.dados
          else if (l.colecao === 'jornalOficial') oficialRemoto = l.dados
        }
        // O que só existe neste aparelho (e nunca foi apagado na nuvem) entra junto e sobe.
        const juntar = (local, colecao) => {
          const m = new Map(remoto[colecao])
          for (const item of local) if (item?.id && !m.has(item.id) && !mapa.has(`${colecao}:${item.id}`)) m.set(item.id, item)
          return [...m.values()]
        }
        setProdutos((local) => juntar(local, 'produtos'))
        setOfertas((local) => juntar(local, 'ofertas'))
        setJornais((local) => juntar(local, 'jornais').sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || ''))))
        setLotes((local) => juntar(local, 'lotes'))
        setAuditoria((local) => juntar(local, 'auditoria').sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || ''))).slice(0, 1000))
        if (configRemota) setConfig({ ...CONFIG_SEED, ...configRemota, nomeMercado: CONFIG_SEED.nomeMercado })
        if (oficialRemoto) setJornalOficial(oficialRemoto)
        pronta.current = true
        setNuvemStatus('online')
        listarPerfisNuvem().then((perfis) => { if (ativo) setContas(perfis) }).catch(() => {})
        parar = assinarNuvem((l) => {
          const chave = `${l.colecao}:${l.id}`
          const json = l.excluido ? null : JSON.stringify(l.dados)
          if (espelho.current.get(chave) === json) return // eco da própria gravação
          espelho.current.set(chave, json)
          const aplicar = (set) => set((lista) => {
            const sem = lista.filter((x) => x.id !== l.id)
            return l.excluido ? sem : (lista.some((x) => x.id === l.id) ? lista.map((x) => (x.id === l.id ? l.dados : x)) : [l.dados, ...sem])
          })
          if (l.colecao === 'produtos') aplicar(setProdutos)
          else if (l.colecao === 'ofertas') aplicar(setOfertas)
          else if (l.colecao === 'jornais') aplicar(setJornais)
          else if (l.colecao === 'lotes') aplicar(setLotes)
          else if (l.colecao === 'auditoria') aplicar(setAuditoria)
          else if (l.colecao === 'config' && !l.excluido) setConfig({ ...CONFIG_SEED, ...l.dados, nomeMercado: CONFIG_SEED.nomeMercado })
          else if (l.colecao === 'jornalOficial' && !l.excluido) setJornalOficial(l.dados)
        })
      } catch (_) {
        if (ativo) setNuvemStatus('erro')
      }
    })()
    return () => { ativo = false; parar?.(); pronta.current = false }
  }, [nuvem, usuario?.id])

  // Cada mudança feita aqui sobe para a nuvem (só os itens que mudaram), no máximo meio segundo
  // depois. O cronômetro não reinicia a cada mudança: mesmo com edições seguidas, o envio sai.
  const atuaisNuvem = useRef(null)
  atuaisNuvem.current = { produtos, ofertas, jornais, lotes, auditoria, config, jornalOficial }
  const envioMarcado = useRef(null)
  useEffect(() => () => clearTimeout(envioMarcado.current), [])
  useEffect(() => {
    if (!nuvem || !usuario?.id || !pronta.current || envioMarcado.current) return
    envioMarcado.current = setTimeout(() => {
      envioMarcado.current = null
      if (!pronta.current) return
      const { produtos, ofertas, jornais, lotes, auditoria, config, jornalOficial } = atuaisNuvem.current
      const mapa = espelho.current
      const linhas = []
      const atuais = new Set()
      const conferir = (colecao, id, dados) => {
        const chave = `${colecao}:${id}`
        atuais.add(chave)
        const json = JSON.stringify(dados)
        if (mapa.get(chave) !== json) { linhas.push({ colecao, id, dados, excluido: false }); mapa.set(chave, json) }
      }
      const listas = { produtos: produtos.map(produtoParaNuvem), ofertas, jornais, lotes, auditoria }
      for (const colecao of COLECOES_LISTA) for (const item of listas[colecao]) if (item?.id) conferir(colecao, item.id, item)
      conferir('config', 'loja', config)
      conferir('jornalOficial', 'atual', jornalOficial)
      // Apagado aqui: marca como excluído na nuvem.
      for (const [chave, json] of mapa) {
        const colecao = chave.slice(0, chave.indexOf(':'))
        if (json !== null && COLECOES_LISTA.includes(colecao) && !atuais.has(chave)) {
          linhas.push({ colecao, id: chave.slice(colecao.length + 1), dados: null, excluido: true })
          mapa.set(chave, null)
        }
      }
      if (!linhas.length) return
      gravarNuvem(linhas)
        .then(() => setNuvemStatus('online'))
        .catch(() => {
          // Volta o espelho para tentar de novo na próxima mudança.
          for (const l of linhas) espelho.current.delete(`${l.colecao}:${l.id}`)
          setNuvemStatus('erro')
        })
    }, 500)
  }, [nuvem, usuario?.id, nuvemStatus, produtos, ofertas, jornais, lotes, auditoria, config, jornalOficial])

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
    setProdutos(PRODUTOS_SEED)
    setOfertas(OFERTAS_SEED)
    setJornais(JORNAIS_SEED)
    setLotes([])
    setAuditoria([])
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
    trocarSenha,
    alterarPapel,
    nuvemStatus,
    recarregarContas,
    carregandoSessao,
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
