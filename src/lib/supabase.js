// Cliente Supabase — DORMENTE até as variáveis de ambiente serem preenchidas.
// Enquanto VITE_SUPABASE_URL/ANON_KEY estiverem vazias, `supabase` é null e o app
// segue usando o store local (localStorage). Isto é a base da Fase 2 (sem migrar ainda).
//
// Este arquivo NÃO é importado pelo app ainda — é o ponto de partida da migração.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseAtivo = Boolean(url && anonKey)

export const supabase = supabaseAtivo
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : null

// Quando a Fase 2 começar, o StoreContext troca o localStorage por chamadas a estes
// helpers (exemplos a implementar):
//   export const listarProdutos = () => supabase.from('produtos').select('*')
//   export const salvarProduto  = (p) => supabase.from('produtos').upsert(p)
// As policies de RLS garantem que cada tenant só vê os próprios dados.
