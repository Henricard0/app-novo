import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/lib/financeiro/api'
import { renderizarRota } from '@/test/renderizar'

vi.mock('@/lib/financeiro/api', async (original) => {
  const real = await original<typeof import('@/lib/financeiro/api')>()
  return {
    ...real,
    buscarMes: vi.fn(),
    buscarDadosFiscais: vi.fn(),
    registrarPagamento: vi.fn(),
    lancarDespesa: vi.fn(),
    removerDespesa: vi.fn(),
    salvarDadosFiscais: vi.fn(),
  }
})
vi.mock('@/lib/supervisao/api', async (original) => {
  const real = await original<typeof import('@/lib/supervisao/api')>()
  return { ...real, contarSolicitacoesRecebidas: vi.fn().mockResolvedValue({ dados: 0, erro: null }) }
})

const m = vi.mocked(api)
const PASSADO = new Date(Date.now() - 3 * 864e5)

function sessao(extra: Partial<api.SessaoFinanceira>): api.SessaoFinanceira {
  return {
    id: 's1',
    starts_at: PASSADO.toISOString(),
    status: 'realizada',
    fee: 180,
    payment_status: 'a_receber',
    paid_on: null,
    payment_method: null,
    patients: { full_name: 'Ana Beatriz Fictícia' },
    ...extra,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  m.buscarDadosFiscais.mockResolvedValue({ dados: null, erro: null })
})

describe('Financeiro', () => {
  it('soma recebido, a receber, despesas e saldo do mês', async () => {
    const paga = sessao({ id: 's2', payment_status: 'pago', paid_on: '2026-11-10', payment_method: 'pix' })
    m.buscarMes.mockResolvedValue({
      dados: {
        sessoes: [sessao({}), paga],
        recebidas: [paga],
        despesas: [
          {
            id: 'd1',
            owner_id: 'u',
            spent_on: '2026-11-05',
            category: 'aluguel',
            description: 'Sala',
            amount: 100,
            created_at: '',
            updated_at: '',
          },
        ],
      },
      erro: null,
    })
    renderizarRota('/financeiro', { logado: true })
    const totais = await screen.findByRole('region', { name: 'Totais do mês' })
    expect(within(totais).getByText('Recebido').nextSibling).toHaveTextContent(/R\$\s*180,00/)
    expect(within(totais).getByText('A receber').nextSibling).toHaveTextContent(/R\$\s*180,00/)
    expect(within(totais).getByText('Despesas').nextSibling).toHaveTextContent(/R\$\s*100,00/)
    expect(within(totais).getByText('Saldo').nextSibling).toHaveTextContent(/R\$\s*80,00/)
    expect(screen.getByText('Aluguel e sala')).toBeInTheDocument()
  })

  it('registra o pagamento de uma sessão', async () => {
    m.buscarMes.mockResolvedValue({ dados: { sessoes: [sessao({})], recebidas: [], despesas: [] }, erro: null })
    m.registrarPagamento.mockResolvedValue({ erro: null })
    const usuario = userEvent.setup()
    renderizarRota('/financeiro', { logado: true })
    await usuario.click(await screen.findByRole('button', { name: /Pagamento da sessão de Ana Beatriz Fictícia/ }))
    await usuario.selectOptions(screen.getByLabelText('Forma'), 'dinheiro')
    await usuario.click(screen.getByRole('button', { name: 'Salvar pagamento' }))
    expect(m.registrarPagamento).toHaveBeenCalledWith('s1', expect.objectContaining({ situacao: 'pago', forma: 'dinheiro' }))
  })

  it('não lança despesa sem valor', async () => {
    m.buscarMes.mockResolvedValue({ dados: { sessoes: [], recebidas: [], despesas: [] }, erro: null })
    const usuario = userEvent.setup()
    renderizarRota('/financeiro', { logado: true })
    await usuario.click(await screen.findByRole('button', { name: 'Lançar despesa' }))
    const dialogo = screen.getByRole('dialog')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Lançar despesa' }))
    expect(within(dialogo).getByText(/Informe o valor/)).toBeInTheDocument()
    expect(m.lancarDespesa).not.toHaveBeenCalled()
  })
})
