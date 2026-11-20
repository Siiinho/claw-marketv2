// Cliente Supabase. Liga quando a URL e a chave pública existem: VITE_SUPABASE_URL/_ANON_KEY no
// .env do PC ou NEXT_PUBLIC_SUPABASE_URL/_ANON_KEY que a integração Supabase cria na Vercel
// (o vite.config.js junta as duas formas). Sem elas, `supabase` é null e tudo fica no aparelho.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseAtivo = Boolean(url && anonKey)

export const supabase = supabaseAtivo
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : null
