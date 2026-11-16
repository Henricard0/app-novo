import { Navigate, Outlet, useLocation } from 'react-router'
import { TelaCarregando } from '@/components/ui/TelaCarregando'
import { situacaoDuasEtapas } from '@/lib/contador/api'
import { useConsulta } from '@/lib/consultorio/useConsulta'
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

/** Área do psicólogo: contas de contador vão para a área delas. */
export function ExigePsicologo() {
  const { perfil, perfilCarregando } = useAuth()
  if (perfilCarregando) return <TelaCarregando />
  if (perfil?.account_type === 'contador') return <Navigate to="/contador" replace />
  return <Outlet />
}

/** Área do contador: contas de psicólogo voltam para o consultório. */
export function ExigeContador() {
  const { perfil, perfilCarregando } = useAuth()
  if (perfilCarregando) return <TelaCarregando />
  if (perfil?.account_type !== 'contador') return <Navigate to="/inicio" replace />
  return <Outlet />
}

/** Dentro da área do contador: só com a verificação em duas etapas confirmada. */
export function ExigeDuasEtapas() {
  const { session } = useAuth()
  const location = useLocation()
  const situacao = useConsulta(`duas-etapas:${session?.access_token ?? ''}`, situacaoDuasEtapas)
  if (situacao.carregando) return <TelaCarregando />
  if (situacao.dados !== 'confirmada') {
    return <Navigate to="/contador/seguranca" replace state={{ de: location.pathname + location.search }} />
  }
  return <Outlet />
}
