import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as consultorio from '@/lib/consultorio/api'
import * as rede from '@/lib/supervisao/api'
import * as casos from '@/lib/supervisao/casos'
import { PERFIL_FICTICIO, renderizarRota } from '@/test/renderizar'

vi.mock('@/lib/consultorio/api', () => ({ buscarPaciente: vi.fn(), listarRegistros: vi.fn() }))
vi.mock('@/lib/supervisao/api', () => ({ listarVinculos: vi.fn(), contarSolicitacoesRecebidas: vi.fn() }))
vi.mock('@/lib/supervisao/casos', async (original) => {
  const real = await original<typeof import('@/lib/supervisao/casos')>()
  return {
    ROTULO_SITUACAO_CASO: real.ROTULO_SITUACAO_CASO,
    formatarHoras: real.formatarHoras,
    listarEncontros: vi.fn(),
    criarCaso: vi.fn(),
    buscarCaso: vi.fn(),
    salvarDevolutiva: vi.fn(),
    marcarEncaminhamento: vi.fn(),
    enviarCaso: vi.fn(),
    apagarRascunho: vi.fn(),
    marcarDiscutido: vi.fn(),
  }
})

const mc = vi.mocked(consultorio)
const mr = vi.mocked(rede)
const ms = vi.mocked(casos)
const AGORA = new Date().toISOString()
const EU = PERFIL_FICTICIO.id

const VINCULO: rede.Vinculo = {
  id: 'v1',
  supervisor_id: 'sup1',
  supervisee_id: EU,
  status: 'ativo',
  format: 'individual',
  origin: 'solicitacao',
  created_at: AGORA,
  ended_at: null,
  ended_by: null,
  group_id: null,
  supervision_groups: null,
  supervisor: { full_name: 'Paulo Andrade', crp_region: '08', crp_number: '4567' },
  supervisionando: { full_name: 'Marina Costa', crp_region: '08', crp_number: '12345' },
}

beforeEach(() => {
  vi.clearAllMocks()
  mr.contarSolicitacoesRecebidas.mockResolvedValue({ dados: 0, erro: null })
  mr.listarVinculos.mockResolvedValue({ dados: [VINCULO], erro: null })
  ms.listarEncontros.mockResolvedValue({ dados: [], erro: null })
  mc.buscarPaciente.mockResolvedValue({
    dados: {
      id: 'p1',
      owner_id: EU,
      full_name: 'Ana Beatriz Souza',
      nicknames: ['Bia'],
      birth_date: '1991-03-14',
      phone: null,
      email: null,
      archived_at: null,
      created_at: AGORA,
      updated_at: AGORA,
      patient_contacts: [
        { id: 'c1', owner_id: EU, patient_id: 'p1', name: 'Cláudia Souza', relation: 'Mãe', phone: null, created_at: AGORA },
      ],
    },
    erro: null,
  })
  mc.listarRegistros.mockResolvedValue({
    dados: [
      {
        id: 'r1',
        owner_id: EU,
        patient_id: 'p1',
        appointment_id: null,
        author_id: EU,
        session_date: '2026-11-06',
        body: 'Ana Beatriz contou que a mãe, Cláudia, voltou a morar com ela. Telefone (41) 99999-0000.',
        status: 'final',
        created_at: AGORA,
        updated_at: AGORA,
        updated_by: EU,
        deleted_at: null,
        deleted_by: null,
        deleted_reason: null,
        clinical_record_versions: [],
      },
    ],
    erro: null,
  })
})

describe('Levar caso para supervisão', () => {
  it('mostra lado a lado o original e a versão anonimizada', async () => {
    renderizarRota('/pacientes/p1/supervisao/novo', { logado: true })
    const anonimo = await screen.findByLabelText(/O que o supervisor vai ver/)
    expect(anonimo).toHaveValue('O paciente contou que a mãe, [nome removido], voltou a morar com ela. Telefone [telefone removido].')
    expect(screen.getByText('Ana Beatriz contou que a mãe, Cláudia, voltou a morar com ela. Telefone (41) 99999-0000.', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByText('3 trechos identificáveis encontrados')).toBeInTheDocument()
    expect(screen.getByText(/quem responde pelo sigilo é você/)).toBeInTheDocument()
  })

  it('exige pergunta e revisão antes de enviar; envia só o texto anonimizado', async () => {
    ms.criarCaso.mockResolvedValue({ erro: null, id: 'caso1' })
    ms.buscarCaso.mockResolvedValue({ dados: null, erro: 'x' })
    const usuario = userEvent.setup()
    renderizarRota('/pacientes/p1/supervisao/novo', { logado: true })
    await usuario.click(await screen.findByLabelText('Chamar de “a paciente”'))
    await usuario.click(screen.getByRole('button', { name: 'Enviar para a pauta' }))
    expect(screen.getByText('Escreva o que você quer discutir.')).toBeInTheDocument()
    expect(screen.getByText('Confirme que revisou o texto antes de enviar.')).toBeInTheDocument()
    expect(ms.criarCaso).not.toHaveBeenCalled()

    await usuario.type(screen.getByLabelText('O que você quer discutir com o supervisor?'), 'Como manejar as faltas?')
    await usuario.click(screen.getByLabelText(/Revisei o texto/))
    await usuario.click(screen.getByRole('button', { name: 'Enviar para a pauta' }))
    await waitFor(() => expect(ms.criarCaso).toHaveBeenCalledOnce())
    const dados = ms.criarCaso.mock.calls[0]![0]
    expect(dados).toMatchObject({
      linkId: 'v1',
      rotulo: 'Paciente A., 35 anos',
      pergunta: 'Como manejar as faltas?',
      pacienteId: 'p1',
      registroIds: ['r1'],
      enviar: true,
      encontro: null,
    })
    expect(dados.trechos).toEqual([
      {
        periodo: 'Sessão · nov/2026',
        texto: 'A paciente contou que a mãe, [nome removido], voltou a morar com ela. Telefone [telefone removido].',
      },
    ])
    expect(JSON.stringify(dados.trechos)).not.toMatch(/Ana|Beatriz|Cláudia|99999/)
  })

  it('sem supervisor, oferece encontrar um', async () => {
    mr.listarVinculos.mockResolvedValue({ dados: [], erro: null })
    renderizarRota('/pacientes/p1/supervisao/novo', { logado: true })
    expect(await screen.findByRole('link', { name: 'Encontrar supervisor' })).toHaveAttribute('href', '/supervisao/encontrar')
  })
})

function casoCompleto(extra: Partial<casos.CasoCompleto> = {}): casos.CasoCompleto {
  return {
    id: 'caso1',
    link_id: 'v1',
    supervisee_id: EU,
    meeting_id: null,
    case_label: 'Paciente A., 35 anos',
    question: 'Como manejar as faltas?',
    status: 'na_pauta',
    created_at: AGORA,
    sent_at: AGORA,
    supervision_meetings: null,
    supervision_links: { supervisor: VINCULO.supervisor, supervisionando: VINCULO.supervisionando },
    supervision_case_excerpts: [
      { id: 't1', case_id: 'caso1', position: 0, period_label: 'Sessão · nov/2026', anonymized_body: 'A paciente faltou.', created_at: AGORA },
    ],
    supervision_feedback: null,
    ...extra,
  }
}

describe('Sala de supervisão (supervisor)', () => {
  it('escreve a devolutiva com encaminhamento e registra as horas', async () => {
    ms.buscarCaso.mockResolvedValue({ dados: casoCompleto({ supervisee_id: 'outra-pessoa' }), erro: null })
    ms.salvarDevolutiva.mockResolvedValue({ erro: null })
    const usuario = userEvent.setup()
    renderizarRota('/supervisao/casos/caso1', { logado: true })
    expect(await screen.findByText('A paciente faltou.')).toBeInTheDocument()
    expect(screen.getByText(/Nada daqui entra no prontuário/)).toBeInTheDocument()
    await usuario.type(screen.getByLabelText('O que você observou'), 'Observação fictícia.')
    await usuario.type(screen.getByLabelText('Novo encaminhamento'), 'Retomar o contrato')
    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }))
    await usuario.clear(screen.getByLabelText('Minutos'))
    await usuario.type(screen.getByLabelText('Minutos'), '50')
    await usuario.click(screen.getByRole('button', { name: 'Enviar devolutiva' }))
    await waitFor(() =>
      expect(ms.salvarDevolutiva).toHaveBeenCalledWith(
        'caso1',
        null,
        { observado: 'Observação fictícia.', caminhos: '', encaminhamentos: ['Retomar o contrato'] },
        { minutos: 50 },
      ),
    )
  })
})

describe('Caso visto pelo supervisionando', () => {
  it('mostra a devolutiva e permite marcar o encaminhamento', async () => {
    ms.buscarCaso.mockResolvedValue({
      dados: casoCompleto({
        status: 'devolutiva_recebida',
        supervision_feedback: {
          id: 'f1',
          case_id: 'caso1',
          author_id: 'sup1',
          observed: 'Observação fictícia.',
          paths: null,
          status: 'enviada',
          created_at: AGORA,
          sent_at: AGORA,
          supervision_feedback_tasks: [{ id: 'k1', feedback_id: 'f1', text: 'Retomar o contrato', position: 0, done_at: null, created_at: AGORA }],
        },
      }),
      erro: null,
    })
    ms.marcarEncaminhamento.mockResolvedValue({ erro: null })
    const usuario = userEvent.setup()
    renderizarRota('/supervisao/casos/caso1', { logado: true })
    const cartao = (await screen.findByRole('heading', { name: 'Devolutiva · Paulo Andrade' })).closest('section')!
    expect(within(cartao).getByText('Observação fictícia.')).toBeInTheDocument()
    await usuario.click(within(cartao).getByLabelText('Retomar o contrato'))
    expect(ms.marcarEncaminhamento).toHaveBeenCalledWith('k1', true)
  })
})
