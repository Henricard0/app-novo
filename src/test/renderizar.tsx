import type { User } from 'firebase/auth'
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

export function usuarioFicticio(): User {
  return {
    uid: PERFIL_FICTICIO.id,
    email: 'marina.costa@example.com',
    emailVerified: true,
  } as User
}

type Opcoes = { logado?: boolean; carregando?: boolean; perfil?: Perfil | null }

/** Monta o app numa rota, com um estado de autenticação de mentira. */
export function renderizarRota(caminho: string, opcoes: Opcoes = {}) {
  const { logado = false, carregando = false, perfil = PERFIL_FICTICIO } = opcoes
  const auth: EstadoAuth = {
    carregando,
    usuario: logado ? usuarioFicticio() : null,
    perfil: logado ? perfil : null,
    sair: vi.fn().mockResolvedValue(undefined),
  }
  const router = createMemoryRouter(rotas, { initialEntries: [caminho] })
  const resultado = render(
    <ContextoAuth.Provider value={auth}>
      <RouterProvider router={router} />
    </ContextoAuth.Provider>,
  )
  return { ...resultado, router, auth }
}
