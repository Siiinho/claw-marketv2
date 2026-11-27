// Nuvem (Supabase): logins e dados da loja iguais em todos os aparelhos.
// Só liga quando VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão preenchidas (na Vercel e no
// .env do PC). Sem elas o app continua guardando tudo no próprio aparelho.
// A tabela e as regras de acesso estão em supabase/clawmarket.sql.
import { supabase as clienteReal, supabaseAtivo } from './supabase'

// Os testes automáticos trocam o cliente por um falso (window.__clawmarketSupabase).
const cliente = () => (typeof window !== 'undefined' && window.__clawmarketSupabase) || clienteReal
export const nuvemAtiva = () => Boolean(cliente()) && (supabaseAtivo || Boolean(typeof window !== 'undefined' && window.__clawmarketSupabase))

const TABELA = 'cm_itens'

// ---------- vários mercados ----------
// Cada login é de um mercado (cm_perfis.mercado_id) e a nuvem só deixa ver e gravar o dele.
// O Bengala (primeiro cliente) guarda os ids como sempre; os outros mercados guardam
// "<mercado>~<id>", assim o mesmo "config/loja" ou "encarte/publicado" existe para cada um.
export const MERCADO_PADRAO = 'bengala'
const SLUG = /^[a-z0-9][a-z0-9-]{1,39}$/
let mercadoLogin = MERCADO_PADRAO
let mercadoSite = null // site do cliente aberto por #/m/<mercado>/...
export const mercadoDoLogin = () => mercadoLogin
export const mercadoAtual = () => mercadoSite || mercadoLogin
export function definirMercadoSite(slug) { mercadoSite = slug && SLUG.test(slug) ? slug : null }
const prefixo = (m) => (m && m !== MERCADO_PADRAO ? `${m}~` : '')
const comPrefixo = (id, m = mercadoLogin) => `${prefixo(m)}${id}`
const semPrefixo = (id, m = mercadoLogin) => {
  const p = prefixo(m)
  return p && String(id).startsWith(p) ? String(id).slice(p.length) : id
}
// Endereço público de uma página do mercado: o jornal fica no endereço exclusivo dele
// (#/bom-preco) e o WhatsApp em #/bom-preco/whatsapp. O Bengala segue em #/encarte e #/whatsapp.
export function caminhoDoMercado(pagina, m = mercadoAtual()) {
  if (!m || m === MERCADO_PADRAO) return `#/${pagina}`
  return pagina === 'encarte' || pagina === 'folhear' ? `#/${m}` : `#/${m}/${pagina}`
}

// Endereço a partir do nome ("Mercado Bom Preço" -> "mercado-bom-preco"), igual à nuvem.
export const enderecoDoNome = (nome) => String(nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32)
const RESERVADOS = new Set(['encarte', 'encarte-lista', 'folhear', 'whatsapp', 'login', 'm', 'produtos', 'ofertas', 'precificacao',
  'cartazes', 'jornal', 'relatorios', 'sustentabilidade', 'scanner', 'usuarios', 'config', 'mercado', 'visitas', 'api', 'admin',
  'assets', 'clawmarket', 'app', 'site', 'www', 'teste'])
export const enderecoValido = (e) => SLUG.test(e || '') && !RESERVADOS.has(e)
// O endereço está livre? (null = não deu para conferir agora)
export async function enderecoLivre(e) {
  if (!enderecoValido(e)) return false
  if (!nuvemAtiva()) return null
  const { data, error } = await cliente().rpc('cm_endereco_livre', { p_endereco: e })
  return error ? null : Boolean(data)
}
const DOMINIO = 'usuarios.clawmarket.app'

// O Supabase entra por e-mail: o nome de usuário vira um e-mail interno (ninguém recebe nada).
export const normalizarUsuario = (u) => String(u || '').trim().toLowerCase()
export function emailDoUsuario(usuario) {
  const base = normalizarUsuario(usuario).normalize('NFD').replace(/[̀-ͯ]/g, '')
  const local = base.replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'usuario'
  // sufixo com o código do nome original: "João" e "joao" não viram o mesmo login
  let h = 0
  for (const ch of normalizarUsuario(usuario)) h = (h * 31 + ch.codePointAt(0)) >>> 0
  return `${local}.${h.toString(36)}@${DOMINIO}`
}
// O Supabase exige 6 caracteres; o prefixo deixa senhas curtas (como a inicial do admin) valerem.
const senhaNuvem = (senha) => `cm-${senha}`

const perfilParaUsuario = (p) => p && ({
  id: p.id,
  mercadoId: p.mercado_id || MERCADO_PADRAO,
  nome: p.nome || p.usuario,
  usuario: p.usuario,
  papel: p.papel,
  master: !!p.master,
  trocarSenha: !!p.trocar_senha,
  cargo: { admin: 'Administrador', gerente: 'Gerente', repositor: 'Repositor' }[p.papel] || 'Repositor',
})

async function lerPerfil(id) {
  for (let tentativa = 0; tentativa < 5; tentativa += 1) {
    const { data } = await cliente().from('cm_perfis').select('*').eq('id', id).maybeSingle()
    if (data) {
      const perfil = perfilParaUsuario(data)
      mercadoLogin = perfil.mercadoId
      const { data: m } = await cliente().from('cm_mercados').select('id,nome,convite').eq('id', perfil.mercadoId).maybeSingle()
      return { ...perfil, mercadoNome: m?.nome || null, convite: m?.convite || null }
    }
    await new Promise((r) => setTimeout(r, 300)) // o perfil é criado por gatilho logo após o cadastro
  }
  return null
}

export async function sessaoNuvem() {
  const { data } = await cliente().auth.getSession()
  const id = data?.session?.user?.id
  return id ? lerPerfil(id) : null
}

export async function entrarNuvem(usuario, senha) {
  const email = emailDoUsuario(usuario)
  let { data, error } = await cliente().auth.signInWithPassword({ email, password: senhaNuvem(senha) })
  // Primeiro acesso do login master: cria a conta "admin" (o banco a marca como administrador
  // e pede a troca da senha).
  if (error && normalizarUsuario(usuario) === 'admin' && senha === 'admin') {
    const r = await cliente().auth.signUp({ email, password: senhaNuvem(senha), options: { data: { usuario: 'admin', nome: 'admin' } } })
    if (!r.error && r.data?.session) ({ data, error } = { data: r.data, error: null })
  }
  if (error || !data?.user) return null
  return lerPerfil(data.user.id)
}

// Conta nova: com `mercadoNome` cria um mercado (a pessoa é a dona); com `convite` entra na equipe.
export async function criarContaNuvem({ nome, senha, mercadoNome, mercadoEndereco, convite }) {
  const usuario = normalizarUsuario(nome)
  const extras = mercadoNome ? { mercado_nome: String(mercadoNome).trim(), ...(mercadoEndereco ? { mercado_endereco: mercadoEndereco } : {}) } : convite ? { convite: String(convite).trim().toLowerCase() } : {}
  const { data, error } = await cliente().auth.signUp({
    email: emailDoUsuario(usuario),
    password: senhaNuvem(senha),
    options: { data: { usuario, nome: String(nome).trim(), ...extras } },
  })
  if (error) {
    const texto = error.message || ''
    const msg = /registered|exists|duplicate|already/i.test(texto) ? 'Já existe um usuário com esse nome. Escolha outro.'
      : /saving new user|database error/i.test(texto) && convite ? 'Código do mercado não encontrado.'
      : 'Não foi possível criar a conta agora.'
    return { ok: false, erro: msg }
  }
  if (!data?.session) return { ok: false, erro: 'Conta criada, mas o Supabase pediu confirmação de e-mail. Desligue "Confirm email" no Supabase.' }
  return { ok: true, usuario: await lerPerfil(data.user.id) }
}

export async function sairNuvem() {
  await cliente().auth.signOut()
  mercadoLogin = MERCADO_PADRAO
}

// Código para entrar na equipe: devolve o nome do mercado (ou null se não existir).
export async function nomeDoConvite(codigo) {
  const c = String(codigo || '').trim().toLowerCase()
  if (!c || !nuvemAtiva()) return null
  const { data, error } = await cliente().rpc('cm_convite_mercado', { p_convite: c })
  return error ? null : data || null
}

export async function trocarSenhaNuvem(nova) {
  const { error } = await cliente().auth.updateUser({ password: senhaNuvem(nova) })
  if (error) return false
  await cliente().rpc('cm_senha_trocada')
  return true
}

export async function listarPerfisNuvem() {
  const { data } = await cliente().from('cm_perfis').select('*').order('criado_em')
  return (data || []).map(perfilParaUsuario)
}

export async function alterarPapelNuvem(id, papel) {
  const { error } = await cliente().from('cm_perfis').update({ papel }).eq('id', id)
  return !error
}

// ---------- dados da loja ----------
// Cada item vira uma linha (colecao, id, dados). Apagar marca `excluido`.
export async function baixarTudoNuvem() {
  const linhas = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await cliente().from(TABELA).select('colecao,id,dados,excluido').range(de, de + 999)
    if (error) throw error
    linhas.push(...(data || []).map((l) => ({ ...l, id: semPrefixo(l.id) })))
    if (!data || data.length < 1000) break
  }
  return linhas
}

export async function gravarNuvem(linhas) {
  for (let i = 0; i < linhas.length; i += 200) {
    const { error } = await cliente().from(TABELA).upsert(linhas.slice(i, i + 200).map((l) => ({ ...l, id: comPrefixo(l.id) })))
    if (error) throw error
  }
}

// Avisa `aoMudar(linha)` a cada gravação de qualquer aparelho. Devolve a função de cancelar.
export function assinarNuvem(aoMudar, filtroColecao) {
  const canal = cliente()
    .channel(`cm-${filtroColecao || 'tudo'}-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: TABELA, ...(filtroColecao ? { filter: `colecao=eq.${filtroColecao}` } : {}) }, (m) => {
      if (m.new && m.new.colecao) aoMudar({ ...m.new, id: semPrefixo(m.new.id) })
    })
    .subscribe()
  return () => { try { cliente().removeChannel(canal) } catch (_) {} }
}

// Login atual, para o servidor do ClawMarket conferir quem está pedindo.
export async function tokenNuvem() {
  if (!nuvemAtiva()) return null
  const { data } = await cliente().auth.getSession()
  return data?.session?.access_token || null
}

// ---------- fotos dos produtos (pasta pública "produtos" do Supabase Storage) ----------
const PASTA_FOTOS = 'produtos'

// Sobe a foto que está na pasta de imagens do PC (ex.: /api/imagens-produtos/789.jpg) para a
// nuvem e devolve o endereço público, que abre em qualquer aparelho.
export async function enviarFotoNuvem(ean, urlLocal) {
  const armazenamento = cliente()?.storage
  if (!armazenamento || !ean || !urlLocal) return null
  try {
    const r = await fetch(urlLocal)
    if (!r.ok) return null
    const blob = await r.blob()
    if (!String(blob.type || '').startsWith('image/')) return null
    const extensao = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'
    const caminho = `${ean}.${extensao}`
    const { error } = await armazenamento.from(PASTA_FOTOS).upload(caminho, blob, { upsert: true, contentType: blob.type, cacheControl: '86400' })
    if (error) return null
    return armazenamento.from(PASTA_FOTOS).getPublicUrl(caminho)?.data?.publicUrl || null
  } catch (_) {
    return null
  }
}

// Códigos que já têm foto na nuvem (para o envio em lote não repetir o que já subiu).
async function fotosJaNaNuvem() {
  const pasta = cliente()?.storage?.from(PASTA_FOTOS)
  const nomes = new Set()
  if (!pasta) return nomes
  for (let inicio = 0; inicio < 100000; inicio += 1000) {
    const { data, error } = await pasta.list('', { limit: 1000, offset: inicio, sortBy: { column: 'name', order: 'asc' } })
    if (error || !data?.length) break
    data.forEach((arquivo) => nomes.add(String(arquivo.name).replace(/\.[a-z]+$/i, '')))
    if (data.length < 1000) break
  }
  return nomes
}

// Envia de uma vez as fotos da pasta do PC (A:\imagens) dos produtos da mercadologia, para
// que o celular e a Vercel achem a foto ao bipar. Só funciona no PC da loja (logado), que é
// quem tem /api/imagens-produtos. `aoProgresso({ feitos, total, enviados, semFoto })`.
export async function enviarFotosCatalogoNuvem(codigos, aoProgresso = () => {}, sinal = {}) {
  if (!nuvemAtiva()) throw new Error('A nuvem não está ligada neste aparelho.')
  const { data } = await cliente().auth.getSession()
  if (!data?.session) throw new Error('Entre com um login para enviar as fotos.')
  const jaTem = await fotosJaNaNuvem()
  const fila = codigos.filter((c) => !jaTem.has(c))
  const estado = { feitos: codigos.length - fila.length, total: codigos.length, enviados: 0, semFoto: 0, jaNaNuvem: codigos.length - fila.length }
  aoProgresso({ ...estado })
  let i = 0
  const trabalhador = async () => {
    while (i < fila.length && !sinal.parar) {
      const ean = fila[i++]
      const url = await enviarFotoNuvem(ean, `/api/imagens-produtos/${ean}.jpg`)
      if (url) estado.enviados += 1
      else estado.semFoto += 1
      estado.feitos += 1
      aoProgresso({ ...estado })
    }
  }
  await Promise.all([trabalhador(), trabalhador(), trabalhador(), trabalhador(), trabalhador(), trabalhador()])
  return estado
}

// ---------- visitas do site do cliente ----------
// Conta uma abertura por vez que a página abre, e um visitante na primeira abertura do dia no aparelho.
const hojeSP = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
export async function registrarVisita(pagina) {
  if (!nuvemAtiva()) return
  const chave = `clawmarket:visita:${mercadoAtual()}:${pagina}:${hojeSP()}`
  let novo = true
  try { novo = !localStorage.getItem(chave); localStorage.setItem(chave, '1') } catch (_) { /* sem memória: conta como novo */ }
  try { await cliente().rpc('cm_registrar_visita', { p_pagina: pagina, p_novo: novo, p_mercado: mercadoAtual() }) } catch (_) { /* sem internet: não conta */ }
}
export async function lerVisitasNuvem(dias = 30) {
  if (!nuvemAtiva()) return null
  const desde = new Date(Date.now() - dias * 86400000).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  const { data, error } = await cliente().from('cm_visitas').select('dia,pagina,visitantes,aberturas').gte('dia', desde).order('dia')
  if (error) throw new Error('Não deu para ler as visitas agora.')
  return data || []
}

// ---------- encarte publicado (o cliente lê sem login) ----------
export async function publicarEncarteNuvem(encarte) {
  await gravarNuvem([{ colecao: 'encarte', id: 'publicado', dados: encarte, excluido: false }])
}

export async function lerEncarteNuvem() {
  const { data, error } = await cliente().from(TABELA).select('dados').eq('colecao', 'encarte').eq('id', comPrefixo('publicado', mercadoAtual())).maybeSingle()
  if (error) return undefined
  return data?.dados ? { ...data.dados, origem: 'nuvem' } : null
}
