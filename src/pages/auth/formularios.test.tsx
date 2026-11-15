import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/auth/api'
import { renderizarRota } from '@/test/renderizar'

vi.mock('@/auth/api', () => ({
  entrar: vi.fn(),
  criarConta: vi.fn(),
  pedirNovaSenha: vi.fn(),
  definirNovaSenha: vi.fn(),
}))

const mockApi = vi.mocked(api)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Entrar', () => {
  it('todo campo tem rótulo', async () => {
    renderizarRota('/entrar')
    expect(await screen.findByLabelText('E-mail')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password')
  })

  it('valida antes de enviar', async () => {
    const usuario = userEvent.setup()
    renderizarRota('/entrar')
    await usuario.click(await screen.findByRole('button', { name: 'Entrar' }))
    expect(screen.getByText('Informe seu e-mail.')).toBeInTheDocument()
    expect(screen.getByText('Informe sua senha.')).toBeInTheDocument()
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true')
    expect(mockApi.entrar).not.toHaveBeenCalled()
  })

  it('envia e-mail e senha e mostra o erro traduzido', async () => {
    mockApi.entrar.mockResolvedValue({ erro: 'E-mail ou senha incorretos.' })
    const usuario = userEvent.setup()
    renderizarRota('/entrar')
    await usuario.type(await screen.findByLabelText('E-mail'), 'marina.costa@example.com')
    await usuario.type(screen.getByLabelText('Senha'), 'senha-errada-1')
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(mockApi.entrar).toHaveBeenCalledWith('marina.costa@example.com', 'senha-errada-1')
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.')
  })

  it('o botão Mostrar revela a senha', async () => {
    const usuario = userEvent.setup()
    renderizarRota('/entrar')
    const senha = await screen.findByLabelText('Senha')
    await usuario.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(senha).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Ocultar senha' })).toBeInTheDocument()
  })

  it('avisa quando o link do e-mail expirou', async () => {
    renderizarRota('/entrar?error=access_denied&error_code=otp_expired')
    expect(await screen.findByRole('alert')).toHaveTextContent('O link expirou ou já foi usado.')
  })
})

describe('Criar conta', () => {
  async function preencherBasico(usuario: ReturnType<typeof userEvent.setup>) {
    await usuario.type(await screen.findByLabelText('Nome completo'), 'Marina Costa')
    await usuario.type(screen.getByLabelText('E-mail'), 'marina.costa@example.com')
    await usuario.type(screen.getByLabelText('Senha'), 'senha-teste-123')
  }

  it('CRP pela metade não passa', async () => {
    const usuario = userEvent.setup()
    renderizarRota('/criar-conta')
    await preencherBasico(usuario)
    await usuario.selectOptions(screen.getByLabelText('Região'), '08')
    await usuario.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(screen.getByText('Informe o número do CRP ou deixe a região em branco.')).toBeInTheDocument()
    expect(mockApi.criarConta).not.toHaveBeenCalled()
  })

  it('o número do CRP aceita só dígitos', async () => {
    const usuario = userEvent.setup()
    renderizarRota('/criar-conta')
    const numero = await screen.findByLabelText('Número')
    await usuario.type(numero, '12a34-5')
    expect(numero).toHaveValue('12345')
  })

  it('senha fraca não passa', async () => {
    const usuario = userEvent.setup()
    renderizarRota('/criar-conta')
    await usuario.type(await screen.findByLabelText('Nome completo'), 'Marina Costa')
    await usuario.type(screen.getByLabelText('E-mail'), 'marina.costa@example.com')
    await usuario.type(screen.getByLabelText('Senha'), 'curta')
    await usuario.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(screen.getByText(/^Senha fraca/)).toBeInTheDocument()
    expect(mockApi.criarConta).not.toHaveBeenCalled()
  })

  it('cria a conta com CRP e pede para confirmar o e-mail', async () => {
    mockApi.criarConta.mockResolvedValue({ erro: null, precisaConfirmar: true })
    const usuario = userEvent.setup()
    renderizarRota('/criar-conta')
    await preencherBasico(usuario)
    await usuario.selectOptions(screen.getByLabelText('Região'), '08')
    await usuario.type(screen.getByLabelText('Número'), '12345')
    await usuario.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(mockApi.criarConta).toHaveBeenCalledWith({
      nome: 'Marina Costa',
      email: 'marina.costa@example.com',
      senha: 'senha-teste-123',
      crpRegiao: '08',
      crpNumero: '12345',
    })
    expect(await screen.findByRole('heading', { name: 'Confira seu e-mail' })).toBeInTheDocument()
    expect(screen.getByText('marina.costa@example.com')).toBeInTheDocument()
  })

  it('estagiário cria conta sem CRP', async () => {
    mockApi.criarConta.mockResolvedValue({ erro: null, precisaConfirmar: true })
    const usuario = userEvent.setup()
    renderizarRota('/criar-conta')
    await preencherBasico(usuario)
    await usuario.click(screen.getByRole('button', { name: 'Criar conta' }))
    await waitFor(() => expect(mockApi.criarConta).toHaveBeenCalledOnce())
    expect(mockApi.criarConta.mock.calls[0]![0]).toMatchObject({ crpRegiao: '', crpNumero: '' })
  })
})

describe('Esqueci minha senha', () => {
  it('sempre responde do mesmo jeito, sem revelar se a conta existe', async () => {
    mockApi.pedirNovaSenha.mockResolvedValue({ erro: null })
    const usuario = userEvent.setup()
    renderizarRota('/esqueci-a-senha')
    await usuario.type(await screen.findByLabelText('E-mail'), 'alguem@example.com')
    await usuario.click(screen.getByRole('button', { name: 'Enviar link' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Se houver uma conta com alguem@example.com')
  })
})

describe('Nova senha', () => {
  it('sem sessão, o link é tratado como inválido', async () => {
    renderizarRota('/nova-senha')
    expect(await screen.findByRole('heading', { name: 'Link inválido ou expirado' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pedir novo link' })).toHaveAttribute('href', '/esqueci-a-senha')
  })

  it('com sessão, exige as duas senhas iguais', async () => {
    mockApi.definirNovaSenha.mockResolvedValue({ erro: null })
    const usuario = userEvent.setup()
    renderizarRota('/nova-senha', { logado: true })
    await usuario.type(await screen.findByLabelText('Nova senha'), 'nova-senha-456')
    await usuario.type(screen.getByLabelText('Repita a nova senha'), 'nova-senha-457')
    await usuario.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
    expect(screen.getByText('As senhas não são iguais.')).toBeInTheDocument()
    expect(mockApi.definirNovaSenha).not.toHaveBeenCalled()

    await usuario.clear(screen.getByLabelText('Repita a nova senha'))
    await usuario.type(screen.getByLabelText('Repita a nova senha'), 'nova-senha-456')
    await usuario.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
    expect(mockApi.definirNovaSenha).toHaveBeenCalledWith('nova-senha-456')
    expect(await screen.findByRole('heading', { name: 'Senha alterada' })).toBeInTheDocument()
  })
})
