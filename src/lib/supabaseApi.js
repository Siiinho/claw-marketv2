// Camada de acesso ao Supabase (Fase 2). Usada pelo StoreContext quando supabaseAtivo.
// Traduz snake_case (banco) <-> camelCase (app) e concentra auth + onboarding + CRUD.
import { supabase } from './supabase'
import { PRODUTOS_SEED } from '../data/seed'

// ---------- mapeadores produto ----------
export const rowToProduto = (r) => ({
  id: r.id,
  loja: r.loja_id,
  nome: r.nome,
  marca: r.marca,
  setor: r.setor,
  estoque: Number(r.estoque) || 0,
  validade: r.validade,
  precoNormal: r.preco_normal != null ? Number(r.preco_normal) : null,
  precoPromo: r.preco_promo != null ? Number(r.preco_promo) : null,
  codigoBarras: r.codigo_barras,
  imagem: r.imagem,
  naFila: !!r.na_fila,
  origemFila: r.origem_fila,
})

export const produtoToRow = (p, tenantId) => {
  const row = {
    tenant_id: tenantId,
    loja_id: p.loja,
    nome: p.nome,
    marca: p.marca ?? null,
    setor: p.setor,
    estoque: Number(p.estoque) || 0,
    validade: p.validade,
    preco_normal: p.precoNormal != null ? Number(p.precoNormal) : null,
    preco_promo: p.precoPromo != null ? Number(p.precoPromo) : null,
    codigo_barras: p.codigoBarras ?? null,
    imagem: p.imagem ?? null,
    na_fila: !!p.naFila,
    origem_fila: p.origemFila ?? null,
  }
  // só envia id quando for um uuid já existente no banco
  if (p.id && /^[0-9a-f-]{36}$/i.test(p.id)) row.id = p.id
  return row
}

// ---------- auth ----------
export const signIn = (email, senha) => supabase.auth.signInWithPassword({ email, password: senha })
export const signUp = (email, senha, nome) =>
  supabase.auth.signUp({ email, password: senha, options: { data: { nome } } })
export const signOut = () => supabase.auth.signOut()
export const getSession = async () => (await supabase.auth.getSession()).data.session
export const onAuthChange = (cb) => supabase.auth.onAuthStateChange((_e, session) => cb(session))

export const getProfile = async () => {
  const { data } = await supabase.from('profiles').select('*').maybeSingle()
  return data
}

// ---------- onboarding ----------
// cria tenant + perfil admin + lojas + config (via função SQL), e popula o demo
export const criarTenant = async (nomeMercado, nomeUsuario) => {
  const { data: tid, error } = await supabase.rpc('criar_tenant', {
    nome_mercado: nomeMercado,
    nome_usuario: nomeUsuario,
  })
  if (error) throw error
  return tid
}

// popula os produtos de demonstração distribuídos entre as 3 lojas do tenant
export const seedProdutosDemo = async (tenantId) => {
  const { data: lojas } = await supabase.from('lojas').select('id').order('nome')
  if (!lojas?.length) return
  const linhas = PRODUTOS_SEED.map((p, i) => {
    const row = produtoToRow({ ...p, loja: lojas[i % lojas.length].id }, tenantId)
    delete row.id
    return row
  })
  await supabase.from('produtos').insert(linhas)
}

// ---------- CRUD ----------
export const listarProdutos = async () => {
  const { data, error } = await supabase.from('produtos').select('*').order('validade')
  if (error) throw error
  return (data || []).map(rowToProduto)
}

export const salvarProdutoDB = async (p, tenantId) => {
  const row = produtoToRow(p, tenantId)
  const { data, error } = await supabase.from('produtos').upsert(row).select().single()
  if (error) throw error
  return rowToProduto(data)
}

export const excluirProdutoDB = (id) => supabase.from('produtos').delete().eq('id', id)

export const listarOfertas = async () => {
  const { data } = await supabase.from('ofertas').select('*')
  return (data || []).map((o) => ({
    id: o.id, produtoId: o.produto_id, titulo: o.titulo, desconto: Number(o.desconto), validade: o.validade, ativa: o.ativa,
  }))
}

export const getConfig = async () => {
  const { data } = await supabase.from('configuracoes').select('*').maybeSingle()
  if (!data) return null
  return {
    nomeMercado: data.nome_mercado, moeda: data.moeda, diasAlerta: data.dias_alerta,
    descontoPadrao: data.desconto_padrao, sugestoesAuto: data.sugestoes_auto,
    usarRegrasNasSugestoes: data.usar_regras_nas_sugestoes, regrasPreco: data.regras_preco || [],
    jornalUrl: data.jornal_url,
  }
}

export const listarLojas = async () => {
  const { data } = await supabase.from('lojas').select('*').order('nome')
  return (data || []).map((l) => ({ id: l.id, nome: l.nome, cidade: l.cidade }))
}
