import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'
import type { Tables } from '@/types/database'

export type Perfil = Pick<Tables<'profiles'>, 'id' | 'full_name' | 'crp_region' | 'crp_number' | 'account_type'>

export type EstadoAuth = {
  /** true enquanto a sessão salva ainda está sendo lida. */
  carregando: boolean
  session: Session | null
  user: User | null
  /** null enquanto carrega ou se não foi possível ler o perfil. */
  perfil: Perfil | null
  /** true enquanto o perfil de quem está logado ainda está sendo lido. */
  perfilCarregando: boolean
  sair: () => Promise<void>
  /** Lê o perfil de novo do banco (depois de editar nome ou CRP). */
  recarregarPerfil: () => void
}

export const ContextoAuth = createContext<EstadoAuth | null>(null)

export function useAuth(): EstadoAuth {
  const valor = useContext(ContextoAuth)
  if (!valor) throw new Error('useAuth precisa estar dentro de <AuthProvider>.')
  return valor
}

/** Nome para exibir: do perfil, dos dados do cadastro ou do e-mail. */
export function nomeParaExibir(estado: Pick<EstadoAuth, 'perfil' | 'user'>): string {
  const doCadastro = estado.user?.user_metadata?.full_name
  return (
    estado.perfil?.full_name ||
    (typeof doCadastro === 'string' && doCadastro.trim()) ||
    estado.user?.email?.split('@')[0] ||
    ''
  )
}
