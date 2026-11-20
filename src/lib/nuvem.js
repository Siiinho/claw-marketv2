// Nuvem (Supabase): logins e dados da loja iguais em todos os aparelhos.
// Só liga quando VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão preenchidas (na Vercel e no
// .env do PC). Sem elas o app continua guardando tudo no próprio aparelho.
// A tabela e as regras de acesso estão em supabase/clawmarket.sql.
import { supabase as clienteReal, supabaseAtivo } from './supabase'

// Os testes automáticos trocam o cliente por um falso (window.__clawmarketSupabase).
const cliente = () => (typeof window !== 'undefined' && window.__clawmarketSupabase) || clienteReal
export const nuvemAtiva = () => Boolean(cliente()) && (supabaseAtivo || Boolean(typeof window !== 'undefined' && window.__clawmarketSupabase))

const TABELA = 'cm_itens'
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
    if (data) return perfilParaUsuario(data)
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

export async function criarContaNuvem({ nome, senha }) {
  const usuario = normalizarUsuario(nome)
  const { data, error } = await cliente().auth.signUp({
    email: emailDoUsuario(usuario),
    password: senhaNuvem(senha),
    options: { data: { usuario, nome: String(nome).trim() } },
  })
  if (error) {
    const msg = /registered|exists|duplicate|saving new user/i.test(error.message || '') ? 'Já existe um usuário com esse nome.' : 'Não foi possível criar a conta agora.'
    return { ok: false, erro: msg }
  }
  if (!data?.session) return { ok: false, erro: 'Conta criada, mas o Supabase pediu confirmação de e-mail. Desligue "Confirm email" no Supabase.' }
  return { ok: true, usuario: await lerPerfil(data.user.id) }
}

export async function sairNuvem() {
  await cliente().auth.signOut()
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
    linhas.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return linhas
}

export async function gravarNuvem(linhas) {
  for (let i = 0; i < linhas.length; i += 200) {
    const { error } = await cliente().from(TABELA).upsert(linhas.slice(i, i + 200))
    if (error) throw error
  }
}

// Avisa `aoMudar(linha)` a cada gravação de qualquer aparelho. Devolve a função de cancelar.
export function assinarNuvem(aoMudar, filtroColecao) {
  const canal = cliente()
    .channel(`cm-${filtroColecao || 'tudo'}-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: TABELA, ...(filtroColecao ? { filter: `colecao=eq.${filtroColecao}` } : {}) }, (m) => {
      if (m.new && m.new.colecao) aoMudar(m.new)
    })
    .subscribe()
  return () => { try { cliente().removeChannel(canal) } catch (_) {} }
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

// ---------- encarte publicado (o cliente lê sem login) ----------
export async function publicarEncarteNuvem(encarte) {
  await gravarNuvem([{ colecao: 'encarte', id: 'publicado', dados: encarte, excluido: false }])
}

export async function lerEncarteNuvem() {
  const { data, error } = await cliente().from(TABELA).select('dados').eq('colecao', 'encarte').eq('id', 'publicado').maybeSingle()
  if (error) return undefined
  return data?.dados ? { ...data.dados, origem: 'nuvem' } : null
}
