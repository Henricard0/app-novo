import type { Session, User } from '@supabase/supabase-js'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { ContextoAuth, type EstadoAuth, type Perfil } from '@/auth/contexto'
import { rotas } from '@/rotas'

export const PERFIL_FICTICIO: Perfil = {
  id: 'a1b2c3d4-0000-4000-8000-000000000001',
  full_name: 'Marina Costa',
  crp_region: '08',
  crp_number: '12345',
}

export function sessaoFicticia(): Session {
  const user = {
    id: PERFIL_FICTICIO.id,
    email: 'marina.costa@example.com',
    user_metadata: { full_name: 'Marina Costa' },
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2026-11-15T00:00:00Z',
  } as User
  return {
    access_token: 'token-ficticio',
    refresh_token: 'refresh-ficticio',
    expires_in: 3600,
    token_type: 'bearer',
    user,
  }
}

type Opcoes = { logado?: boolean; carregando?: boolean; perfil?: Perfil | null }

/** Monta o app numa rota, com um estado de autenticação de mentira. */
export function renderizarRota(caminho: string, opcoes: Opcoes = {}) {
  const { logado = false, carregando = false, perfil = PERFIL_FICTICIO } = opcoes
  const session = logado ? sessaoFicticia() : null
  const auth: EstadoAuth = {
    carregando,
    session,
    user: session?.user ?? null,
    perfil: logado ? perfil : null,
    sair: vi.fn().mockResolvedValue(undefined),
    recarregarPerfil: vi.fn(),
  }
  const router = createMemoryRouter(rotas, { initialEntries: [caminho] })
  const resultado = render(
    <ContextoAuth.Provider value={auth}>
      <RouterProvider router={router} />
    </ContextoAuth.Provider>,
  )
  return { ...resultado, router, auth }
}
