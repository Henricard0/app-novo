import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { traduzirErroBanco } from '@/lib/consultorio/erros'
import * as api from '@/lib/planos/api'
import { renderizarRota } from '@/test/renderizar'

vi.mock('@/lib/planos/api', async (original) => {
  const real = await original<typeof import('@/lib/planos/api')>()
  return {
    ...real,
    buscarMeuPlano: vi.fn(),
    listarAssinaturas: vi.fn(),
    iniciarAssinatura: vi.fn(),
    sincronizarAssinatura: vi.fn(),
    cancelarAssinatura: vi.fn(),
  }
})
vi.mock('@/lib/supervisao/api', () => ({ contarSolicitacoesRecebidas: vi.fn().mockResolvedValue({ dados: 0, erro: null }) }))

const m = vi.mocked(api)
const irPara = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  m.listarAssinaturas.mockResolvedValue({ dados: [], erro: null })
  vi.stubGlobal('location', { ...window.location, assign: irPara, origin: 'http://localhost:3000' })
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Planos', () => {
  it('no teste grátis, mostra os dias restantes e os dois planos', async () => {
    m.buscarMeuPlano.mockResolvedValue({
      dados: { plano: 'teste', trial_ends_at: new Date(Date.now() + 12 * 864e5 - 1000).toISOString(), pacientes_ativos: 3, limite_pacientes: null },
      erro: null,
    })
    renderizarRota('/planos', { logado: true })
    expect(await screen.findByText(/12 dias restantes/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Gratuito' })).toBeInTheDocument()
    expect(screen.getByText('Agenda e prontuário para até 10 pacientes ativos')).toBeInTheDocument()
    expect(screen.getByText(/R\$\s*383,00/, { selector: 'p' })).toBeInTheDocument()
  })

  it('assinar calcula o desconto na tela e abre o Mercado Pago', async () => {
    m.buscarMeuPlano.mockResolvedValue({ dados: { plano: 'gratuito', trial_ends_at: null, pacientes_ativos: 10, limite_pacientes: 10 }, erro: null })
    m.iniciarAssinatura.mockResolvedValue({ erro: null, dados: { url: 'https://www.mercadopago.com.br/subscriptions/checkout?x=1' } })
    const usuario = userEvent.setup()
    renderizarRota('/planos', { logado: true })
    expect(await screen.findByText('10 de 10 pacientes ativos')).toBeInTheDocument()
    await usuario.click(screen.getByLabelText(/Mensal/))
    await usuario.click(screen.getByLabelText(/Me formei há menos de 1 ano/))
    expect(screen.getByText(/R\$\s*19,15/, { selector: 'p' })).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Assinar com Mercado Pago' }))
    await waitFor(() => expect(m.iniciarAssinatura).toHaveBeenCalledWith('mensal', true))
    expect(irPara).toHaveBeenCalledWith('https://www.mercadopago.com.br/subscriptions/checkout?x=1')
  })

  it('erro do servidor de pagamento aparece em português', async () => {
    m.buscarMeuPlano.mockResolvedValue({ dados: { plano: 'gratuito', trial_ends_at: null, pacientes_ativos: 1, limite_pacientes: 10 }, erro: null })
    m.iniciarAssinatura.mockResolvedValue({ erro: 'O Mercado Pago não aceitou criar a assinatura. Tente de novo em instantes.', dados: null })
    const usuario = userEvent.setup()
    renderizarRota('/planos', { logado: true })
    await usuario.click(await screen.findByRole('button', { name: 'Assinar com Mercado Pago' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('O Mercado Pago não aceitou criar a assinatura')
    expect(irPara).not.toHaveBeenCalled()
  })

  it('ao voltar do Mercado Pago, confere a situação', async () => {
    m.buscarMeuPlano.mockResolvedValue({ dados: { plano: 'essencial', trial_ends_at: null, pacientes_ativos: 1, limite_pacientes: null }, erro: null })
    m.sincronizarAssinatura.mockResolvedValue({ erro: null, dados: { situacao: 'ativa' } })
    renderizarRota('/planos?retorno=1', { logado: true })
    expect(await screen.findByText('Pagamento confirmado. Bem-vindo ao Essencial!')).toBeInTheDocument()
    expect(m.sincronizarAssinatura).toHaveBeenCalledOnce()
  })
})

describe('limite do plano gratuito', () => {
  it('o erro do banco vira uma mensagem que explica o que fazer', () => {
    expect(traduzirErroBanco({ code: 'P0001', message: 'limite de pacientes do plano gratuito' })).toMatch(
      /limite de 10 pacientes ativos do plano gratuito.*Essencial/,
    )
  })
})
