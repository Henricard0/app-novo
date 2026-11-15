import { Navigate, Outlet, useLocation } from 'react-router'
import { TelaCarregando } from '@/components/ui/TelaCarregando'
import { useAuth } from './contexto'

/** Só deixa passar quem está logado; os demais vão para /entrar. */
export function ExigeLogin() {
  const { carregando, session } = useAuth()
  const location = useLocation()
  if (carregando) return <TelaCarregando />
  if (!session) return <Navigate to="/entrar" replace state={{ de: location.pathname + location.search }} />
  return <Outlet />
}

/** Telas de entrada e cadastro: quem já está logado vai para onde queria ir (ou /inicio). */
export function SomenteVisitante() {
  const { carregando, session } = useAuth()
  const location = useLocation()
  if (carregando) return <TelaCarregando />
  if (session) {
    const de = (location.state as { de?: string } | null)?.de
    return <Navigate to={de && de.startsWith('/') && !de.startsWith('//') ? de : '/inicio'} replace />
  }
  return <Outlet />
}
