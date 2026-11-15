import type { User } from 'firebase/auth'
import { createContext, useContext } from 'react'
import type { Perfil } from '@/types/modelo'

export type { Perfil }

export type EstadoAuth = {
  /** true enquanto a sessão salva ainda está sendo lida. */
  carregando: boolean
  /** Usuário logado e com e-mail confirmado; null caso contrário. */
  usuario: User | null
  /** null enquanto carrega ou se não foi possível ler o perfil. */
  perfil: Perfil | null
  sair: () => Promise<void>
}

export const ContextoAuth = createContext<EstadoAuth | null>(null)

export function useAuth(): EstadoAuth {
  const valor = useContext(ContextoAuth)
  if (!valor) throw new Error('useAuth precisa estar dentro de <AuthProvider>.')
  return valor
}

/** Nome para exibir: do perfil ou, na falta dele, a parte do e-mail antes do @. */
export function nomeParaExibir(estado: Pick<EstadoAuth, 'perfil' | 'usuario'>): string {
  return estado.perfil?.full_name || estado.usuario?.email?.split('@')[0] || ''
}
