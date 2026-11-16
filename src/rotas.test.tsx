import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderizarRota } from '@/test/renderizar'

describe('rotas protegidas', () => {
  it('quem não está logado é levado para Entrar', async () => {
    const { router } = renderizarRota('/inicio')
    expect(await screen.findByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/entrar')
  })

  it('a raiz leva para o início', async () => {
    const { router } = renderizarRota('/', { logado: true })
    expect(await screen.findByRole('heading', { level: 1, name: /Marina/ })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/inicio')
  })

  it('quem já está logado não vê a tela de entrar', async () => {
    const { router } = renderizarRota('/entrar', { logado: true })
    await waitFor(() => expect(router.state.location.pathname).toBe('/inicio'))
  })

  it('depois de entrar, volta para a página que tentou abrir', async () => {
    const { router } = renderizarRota('/pacientes')
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'))
    expect(router.state.location.state).toEqual({ de: '/pacientes' })
  })

  it('mostra "Carregando…" enquanto lê a sessão', () => {
    renderizarRota('/inicio', { carregando: true })
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
  })

  it('endereço desconhecido mostra página não encontrada', async () => {
    renderizarRota('/nao-existe')
    expect(await screen.findByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument()
  })
})

describe('layout do app', () => {
  it('mostra o menu principal com o item da página atual marcado', async () => {
    renderizarRota('/inicio', { logado: true })
    const menu = await screen.findByRole('navigation', { name: 'Menu principal' })
    const itens = within(menu).getAllByRole('link')
    expect(itens.map((i) => i.textContent)).toEqual([
      'Início',
      'Agenda',
      'Pacientes',
      'Supervisão',
      'Financeiro',
      'Documentos',
    ])
    expect(within(menu).getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page')
    expect(within(menu).getByRole('link', { name: 'Agenda' })).not.toHaveAttribute('aria-current')
  })

  it('mostra nome e CRP de quem está logado', async () => {
    renderizarRota('/inicio', { logado: true })
    expect(await screen.findByText('Marina Costa')).toBeInTheDocument()
    expect(screen.getByText('CRP 08/12345')).toBeInTheDocument()
  })

  it('sem CRP, avisa que não há CRP cadastrado', async () => {
    renderizarRota('/inicio', {
      logado: true,
      perfil: { id: 'x', full_name: 'Bianca Lima', crp_region: null, crp_number: null },
    })
    expect(await screen.findByText('Sem CRP cadastrado')).toBeInTheDocument()
  })

  it('o botão Menu abre e fecha o menu no celular', async () => {
    const usuario = userEvent.setup()
    renderizarRota('/inicio', { logado: true })
    const botao = await screen.findByRole('button', { name: 'Menu' })
    expect(botao).toHaveAttribute('aria-expanded', 'false')
    await usuario.click(botao)
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveAttribute('aria-expanded', 'true')
    await usuario.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('navegar pelo menu fecha o menu do celular e abre a página', async () => {
    const usuario = userEvent.setup()
    const { router } = renderizarRota('/inicio', { logado: true })
    await usuario.click(await screen.findByRole('button', { name: 'Menu' }))
    await usuario.click(screen.getByRole('link', { name: 'Financeiro' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Financeiro' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/financeiro')
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText(/Em construção · Fase 5/)).toBeInTheDocument()
  })

  it('o botão Sair encerra a sessão', async () => {
    const usuario = userEvent.setup()
    const { auth } = renderizarRota('/inicio', { logado: true })
    await usuario.click(await screen.findByRole('button', { name: 'Sair' }))
    expect(auth.sair).toHaveBeenCalledOnce()
  })

  it('tem link para pular para o conteúdo', async () => {
    renderizarRota('/inicio', { logado: true })
    expect(await screen.findByRole('link', { name: 'Pular para o conteúdo' })).toHaveAttribute('href', '#conteudo')
  })
})

describe('Início', () => {
  it('cumprimenta pelo primeiro nome e mostra os cartões vazios', async () => {
    renderizarRota('/inicio', { logado: true })
    expect(await screen.findByRole('heading', { level: 1, name: /^(Bom dia|Boa tarde|Boa noite), Marina$/ })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Sessões de hoje' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Supervisão' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Pendências' })).toBeInTheDocument()
  })
})
