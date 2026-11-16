import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const chave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/** false quando faltam as variáveis de ambiente; o app mostra uma tela explicando o que configurar. */
export const supabaseConfigurado = Boolean(url && chave)

export const supabase = createClient<Database>(
  url || 'http://configuracao-ausente.invalid',
  chave || 'configuracao-ausente',
  {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
