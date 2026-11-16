import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/lib/contador/api'
import * as planos from '@/lib/planos/api'
import { CONTADORA_FICTICIA, PERFIL_FICTICIO, renderizarRota } from '@/test/renderizar'

vi.mock('@/lib/contador/api', async (original) => {
  const real = await original<typeof import('@/lib/contador/api')>()
  return {
    ...real,
    contarAvisosDoContador: vi.fn().mockResolvedValue({ dados: 0, erro: null }),
    situacaoDuasEtapas: vi.fn(),
    buscarMeuContador: vi.fn(),
    listarGuiasEPendencias: vi.fn(),
    listarAcessos: vi.fn(),
    mudarAutorizacoes: vi.fn(),
    listarContadores: vi.fn(),
    listarClientes: vi.fn(),
    listarPedidosRecebidos: vi.fn(),
    responderPedido: vi.fn(),
    marcarGuiaPaga: vi.fn(),
  }
})
vi.mock('@/lib/planos/api', async (original) => {
  const real = await original<typeof import('@/lib/planos/api')>()
  return { ...real, buscarMeuPlano: vi.fn() }
})
vi.mock('@/lib/supervisao/api', async (original) => {
  const real = await original<typeof import('@/lib/supervisao/api')>()
  return { ...real, contarSolicitacoesRecebidas: vi.fn().mockResolvedValue({ dados: 0, erro: null }) }
})

const m = vi.mocked(api)
const p = vi.mocked(planos)
const AGORA = '2026-11-16T12:00:00Z'

const VINCULO = {
  id: 'v1',
  psychologist_id: PERFIL_FICTICIO.id,
  accountant_id: CONTADORA_FICTICIA.id,
  status: 'ativo',
  share_totals: true,
  share_entries: false,
  share_expenses: false,
  created_at: AGORA,
  updated_at: AGORA,
  ended_at: null,
  ended_by: null,
  contador: { full_name: 'Carla Souza' },
}

const PERFIL_CONTADOR = {
  id: CONTADORA_FICTICIA.id,
  crc_state: 'PR',
  crc_number: '12345',
  crc_category: 'contador',
  firm_name: 'Souza Contabilidade',
  bio: 'Contadora fictícia.',
  specialties: ['carne_leao'],
  state: 'PR',
  city: 'Curitiba',
  serves_nationwide: true,
  price_info: null,
  listed: true,
  accepting_new: true,
  created_at: AGORA,
  updated_at: AGORA,
}

beforeEach(() => {
  vi.clearAllMocks()
  m.contarAvisosDoContador.mockResolvedValue({ dados: 0, erro: null })
  p.buscarMeuPlano.mockResolvedValue({
    dados: { plano: 'essencial', trial_ends_at: null, pacientes_ativos: 3, limite_pacientes: null },
    erro: null,
  })
  m.listarGuiasEPendencias.mockResolvedValue({ dados: { guias: [], pendencias: [] }, erro: null })
  m.listarAcessos.mockResolvedValue({ dados: [], erro: null })
})

describe('separação das áreas', () => {
  it('conta de contador que abre o consultório vai para a área do contador', async () => {
    m.situacaoDuasEtapas.mockResolvedValue({ dados: 'confirmada', erro: null })
    m.listarClientes.mockResolvedValue({ dados: [], erro: null })
    m.listarPedidosRecebidos.mockResolvedValue({ dados: [], erro: null })
    const { router } = renderizarRota('/pacientes', { logado: true, perfil: CONTADORA_FICTICIA })
    expect(await screen.findByRole('heading', { level: 1, name: 'Olá, Carla' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/contador')
    expect(screen.queryByRole('link', { name: 'Pacientes' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Clientes' })).toBeInTheDocument()
  })

  it('conta de psicólogo que abre a área do contador volta para o consultório', async () => {
    const { router } = renderizarRota('/contador/clientes/x', { logado: true })
    await waitFor(() => expect(router.state.location.pathname).toBe('/inicio'))
  })

  it('sem a verificação em duas etapas, o contador vai para a tela de segurança', async () => {
    m.situacaoDuasEtapas.mockResolvedValue({ dados: 'falta_ativar', erro: null })
    const { router } = renderizarRota('/contador', { logado: true, perfil: CONTADORA_FICTICIA })
    expect(await screen.findByRole('button', { name: 'Ativar verificação em duas etapas' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/contador/seguranca')
  })
})

describe('Contador (lado do psicólogo)', () => {
  it('sem contador, convida a encontrar um', async () => {
    m.buscarMeuContador.mockResolvedValue({ dados: { vinculo: null, perfil: null, pendentes: [] }, erro: null })
    renderizarRota('/meu-contador', { logado: true })
    expect(await screen.findByText('Você ainda não tem contador no Tríade.')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Encontrar contador' }).length).toBeGreaterThan(0)
  })

  it('no plano gratuito, avisa que o contador fica nos planos Essencial e Profissional', async () => {
    p.buscarMeuPlano.mockResolvedValue({ dados: { plano: 'gratuito', trial_ends_at: null, pacientes_ativos: 3, limite_pacientes: 10 }, erro: null })
    m.buscarMeuContador.mockResolvedValue({ dados: { vinculo: null, perfil: null, pendentes: [] }, erro: null })
    renderizarRota('/meu-contador', { logado: true })
    expect(await screen.findByText(/disponível nos planos Essencial e Profissional/)).toBeInTheDocument()
  })

  it('com contador, liga e desliga o que ele pode ver', async () => {
    m.buscarMeuContador.mockResolvedValue({ dados: { vinculo: VINCULO, perfil: PERFIL_CONTADOR, pendentes: [] }, erro: null })
    m.mudarAutorizacoes.mockResolvedValue({ erro: null })
    const usuario = userEvent.setup()
    renderizarRota('/meu-contador', { logado: true })
    const totais = await screen.findByRole('checkbox', { name: 'Totais do mês' })
    expect(totais).toBeChecked()
    const lancamentos = screen.getByRole('checkbox', { name: 'Lançamentos detalhados' })
    expect(lancamentos).not.toBeChecked()
    await usuario.click(lancamentos)
    expect(m.mudarAutorizacoes).toHaveBeenCalledWith('v1', { share_entries: true })
    expect(lancamentos).toBeChecked()
    expect(screen.getByText('CRC-PR 12345', { exact: false })).toBeInTheDocument()
  })

  it('mostra a guia recebida com vencimento e marca como paga', async () => {
    m.buscarMeuContador.mockResolvedValue({ dados: { vinculo: VINCULO, perfil: PERFIL_CONTADOR, pendentes: [] }, erro: null })
    m.listarGuiasEPendencias.mockResolvedValue({
      dados: {
        guias: [
          {
            id: 'g1',
            link_id: 'v1',
            psychologist_id: PERFIL_FICTICIO.id,
            accountant_id: CONTADORA_FICTICIA.id,
            kind: 'das',
            title: 'DAS outubro',
            competence: '2026-10-01',
            due_on: '2099-11-20',
            amount: 120.5,
            file_path: 'x/y.pdf',
            paid_on: null,
            created_at: AGORA,
          },
        ],
        pendencias: [],
      },
      erro: null,
    })
    m.marcarGuiaPaga.mockResolvedValue({ erro: null })
    const usuario = userEvent.setup()
    renderizarRota('/meu-contador', { logado: true })
    expect(await screen.findByText('DAS outubro')).toBeInTheDocument()
    expect(screen.getByText(/vence em 20\/11\/2099/)).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Marcar como paga: DAS outubro' }))
    expect(m.marcarGuiaPaga).toHaveBeenCalledWith('g1', true)
  })
})

describe('Clientes (lado do contador)', () => {
  it('aceita um pedido recebido', async () => {
    m.situacaoDuasEtapas.mockResolvedValue({ dados: 'confirmada', erro: null })
    m.listarClientes.mockResolvedValue({ dados: [], erro: null })
    m.listarPedidosRecebidos.mockResolvedValue({
      dados: [
        {
          id: 'r1',
          psychologist_id: PERFIL_FICTICIO.id,
          accountant_id: CONTADORA_FICTICIA.id,
          message: 'Preciso de ajuda com o carnê-leão.',
          status: 'pendente',
          created_at: AGORA,
          responded_at: null,
          psicologo: { full_name: 'Marina Costa', crp_region: '08', crp_number: '12345' },
          contador: { full_name: 'Carla Souza' },
        },
      ],
      erro: null,
    })
    m.responderPedido.mockResolvedValue({ erro: null })
    const usuario = userEvent.setup()
    renderizarRota('/contador', { logado: true, perfil: CONTADORA_FICTICIA })
    expect(await screen.findByText('Preciso de ajuda com o carnê-leão.')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Aceitar' }))
    expect(m.responderPedido).toHaveBeenCalledWith('r1', true)
  })
})
