import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/lib/consultorio/api'
import { paraDataISO } from '@/lib/consultorio/formato'
import { renderizarRota } from '@/test/renderizar'

vi.mock('@/lib/consultorio/api', async (original) => {
  const real = await original<typeof import('@/lib/consultorio/api')>()
  return {
    horariosDasSessoes: real.horariosDasSessoes,
    listarPacientes: vi.fn(),
    buscarPaciente: vi.fn(),
    salvarPaciente: vi.fn(),
    arquivarPaciente: vi.fn(),
    listarSessoesEntre: vi.fn(),
    listarSessoesDoPaciente: vi.fn(),
    buscarSessao: vi.fn(),
    criarSessoes: vi.fn(),
    atualizarSessao: vi.fn(),
    mudarStatusSessao: vi.fn(),
    moverSessao: vi.fn(),
    listarPendencias: vi.fn(),
    listarRegistros: vi.fn(),
    buscarRegistro: vi.fn(),
    criarRegistro: vi.fn(),
    editarRegistro: vi.fn(),
    excluirRegistro: vi.fn(),
    listarVersoes: vi.fn(),
  }
})

const m = vi.mocked(api)
const AGORA = new Date().toISOString()

function paciente(extra: Partial<api.Paciente> = {}): api.Paciente {
  return {
    id: 'p1',
    owner_id: 'u1',
    full_name: 'Ana Beatriz Fictícia',
    nicknames: ['Bia'],
    default_fee: null,
    cpf: null,
    payer_name: null,
    payer_cpf: null,
    birth_date: '1991-03-14',
    phone: null,
    email: null,
    archived_at: null,
    created_at: AGORA,
    updated_at: AGORA,
    ...extra,
  }
}

function registro(extra: Partial<api.RegistroComVersoes> = {}): api.RegistroComVersoes {
  return {
    id: 'r1',
    owner_id: 'u1',
    patient_id: 'p1',
    appointment_id: null,
    author_id: 'u1',
    session_date: '2026-11-09',
    body: 'Registro fictício.',
    status: 'final',
    created_at: AGORA,
    updated_at: AGORA,
    updated_by: 'u1',
    deleted_at: null,
    deleted_by: null,
    deleted_reason: null,
    clinical_record_versions: [],
    ...extra,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  m.listarSessoesEntre.mockResolvedValue({ dados: [], erro: null })
  m.listarPendencias.mockResolvedValue({ dados: [], erro: null })
  m.listarSessoesDoPaciente.mockResolvedValue({ dados: [], erro: null })
  m.listarRegistros.mockResolvedValue({ dados: [], erro: null })
})

describe('Pacientes', () => {
  it('lista os ativos e busca sem diferenciar acento', async () => {
    m.listarPacientes.mockResolvedValue({
      dados: [
        paciente(),
        paciente({ id: 'p2', full_name: 'João Pedro Exemplo', nicknames: [] }),
        paciente({ id: 'p3', full_name: 'Paciente Arquivado', archived_at: AGORA }),
      ],
      erro: null,
    })
    const usuario = userEvent.setup()
    renderizarRota('/pacientes', { logado: true })
    expect(await screen.findByRole('link', { name: /Ana Beatriz Fictícia/ })).toHaveAttribute('href', '/pacientes/p1')
    expect(screen.queryByText('Paciente Arquivado')).not.toBeInTheDocument()
    expect(screen.getByText('2 pacientes ativos')).toBeInTheDocument()

    await usuario.type(screen.getByLabelText('Buscar por nome ou apelido'), 'joao')
    expect(screen.queryByText('Ana Beatriz Fictícia')).not.toBeInTheDocument()
    expect(screen.getByText('João Pedro Exemplo')).toBeInTheDocument()

    await usuario.clear(screen.getByLabelText('Buscar por nome ou apelido'))
    await usuario.click(screen.getByLabelText('Mostrar só os arquivados'))
    expect(screen.getByText('Paciente Arquivado')).toBeInTheDocument()
  })

  it('cadastro exige nome e envia apelidos e contatos', async () => {
    m.salvarPaciente.mockResolvedValue({ erro: null, id: 'novo' })
    m.buscarPaciente.mockResolvedValue({ dados: { ...paciente({ id: 'novo' }), patient_contacts: [] }, erro: null })
    const usuario = userEvent.setup()
    renderizarRota('/pacientes/novo', { logado: true })
    await usuario.click(await screen.findByRole('button', { name: 'Cadastrar paciente' }))
    expect(screen.getByText('Informe o nome do paciente.')).toBeInTheDocument()
    expect(m.salvarPaciente).not.toHaveBeenCalled()

    await usuario.type(screen.getByLabelText('Nome completo'), 'Clara Fictícia')
    await usuario.type(screen.getByLabelText(/Apelidos/), 'Clarinha, Cla')
    await usuario.click(screen.getByRole('button', { name: 'Adicionar contato' }))
    await usuario.type(screen.getByLabelText('Nome'), 'Rita Fictícia')
    await usuario.type(screen.getByLabelText(/Parentesco/), 'Mãe')
    await usuario.click(screen.getByRole('button', { name: 'Cadastrar paciente' }))

    await waitFor(() => expect(m.salvarPaciente).toHaveBeenCalledOnce())
    const [id, dados, contatos] = m.salvarPaciente.mock.calls[0]!
    expect(id).toBeNull()
    expect(dados).toMatchObject({ nome: 'Clara Fictícia', apelidos: ['Clarinha', 'Cla'] })
    expect(contatos).toEqual([{ id: undefined, nome: 'Rita Fictícia', parentesco: 'Mãe', telefone: null }])
  })
})

describe('Ficha do paciente e prontuário', () => {
  beforeEach(() => {
    m.buscarPaciente.mockResolvedValue({ dados: { ...paciente(), patient_contacts: [] }, erro: null })
  })

  it('mostra o prontuário e o link para o histórico quando há versões', async () => {
    m.listarRegistros.mockResolvedValue({
      dados: [registro({ clinical_record_versions: [{ id: 'v1' }, { id: 'v2' }] })],
      erro: null,
    })
    renderizarRota('/pacientes/p1', { logado: true })
    expect(await screen.findByRole('heading', { name: 'Ana Beatriz Fictícia' })).toBeInTheDocument()
    expect(await screen.findByText('Registro fictício.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver histórico (2 versões anteriores)' })).toHaveAttribute(
      'href',
      '/pacientes/p1/registros/r1/historico',
    )
  })

  it('excluir pede confirmação, explica a guarda de 5 anos e envia o motivo', async () => {
    m.listarRegistros.mockResolvedValue({ dados: [registro()], erro: null })
    m.excluirRegistro.mockResolvedValue({ erro: null })
    const usuario = userEvent.setup()
    renderizarRota('/pacientes/p1', { logado: true })
    await screen.findByText('Registro fictício.'); screen.getAllByRole('button').forEach((b) => console.log('BOTAO', JSON.stringify(b.textContent)))
    await usuario.click(await screen.findByRole('button', { name: /^Excluir registro de/ }))
    expect(screen.getByText(/continua guardado por no mínimo 5 anos/)).toBeInTheDocument()
    expect(m.excluirRegistro).not.toHaveBeenCalled()

    await usuario.type(screen.getByLabelText(/Motivo da exclusão/), 'Paciente errado')
    await usuario.click(screen.getByRole('button', { name: 'Excluir registro' }))
    await waitFor(() => expect(m.excluirRegistro).toHaveBeenCalledWith('r1', 'Paciente errado'))
  })

  it('novo registro exige texto e usa a sessão indicada no endereço', async () => {
    const ontem = new Date(Date.now() - 86400000)
    m.listarSessoesDoPaciente.mockResolvedValue({
      dados: [
        {
          id: 's1',
          owner_id: 'u1',
          patient_id: 'p1',
          series_id: null,
          fee: null,
          payment_status: 'a_receber',
          paid_on: null,
          payment_method: null,
          starts_at: ontem.toISOString(),
          ends_at: new Date(ontem.getTime() + 50 * 60000).toISOString(),
          modality: 'presencial',
          location: null,
          status: 'realizada',
          created_at: AGORA,
          updated_at: AGORA,
          patients: { full_name: 'Ana Beatriz Fictícia' },
          clinical_records: [],
        },
      ],
      erro: null,
    })
    m.criarRegistro.mockResolvedValue({ erro: null })
    const usuario = userEvent.setup()
    renderizarRota('/pacientes/p1/registros/novo?sessao=s1', { logado: true })
    await usuario.click(await screen.findByRole('button', { name: 'Salvar registro' }))
    expect(screen.getByText('Escreva o registro antes de salvar.')).toBeInTheDocument()

    expect(screen.getByLabelText(/Sessão/)).toHaveValue('s1')
    expect(screen.getByLabelText('Data do atendimento')).toHaveValue(paraDataISO(ontem))
    await usuario.type(screen.getByLabelText('Registro'), 'Texto fictício do atendimento.')
    await usuario.click(screen.getByRole('button', { name: 'Salvar registro' }))
    await waitFor(() =>
      expect(m.criarRegistro).toHaveBeenCalledWith('p1', {
        data: paraDataISO(ontem),
        sessaoId: 's1',
        texto: 'Texto fictício do atendimento.',
      }),
    )
  })
})

describe('Agenda', () => {
  it('na lista, mostra os 7 dias da semana e permite mudar a situação', async () => {
    const hoje = new Date()
    hoje.setHours(9, 0, 0, 0)
    m.listarSessoesEntre.mockResolvedValue({
      dados: [
        {
          id: 's1',
          owner_id: 'u1',
          patient_id: 'p1',
          series_id: 'serie',
          fee: null,
          payment_status: 'a_receber',
          paid_on: null,
          payment_method: null,
          starts_at: hoje.toISOString(),
          ends_at: new Date(hoje.getTime() + 50 * 60000).toISOString(),
          modality: 'online',
          location: null,
          status: 'agendada',
          created_at: AGORA,
          updated_at: AGORA,
          patients: { full_name: 'Ana Beatriz Fictícia' },
          clinical_records: [],
        },
      ],
      erro: null,
    })
    m.mudarStatusSessao.mockResolvedValue({ erro: null })
    const usuario = userEvent.setup()
    renderizarRota('/agenda?visao=lista', { logado: true })
    expect(await screen.findByRole('link', { name: 'Ana Beatriz Fictícia' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(7)
    expect(screen.getByText(/Online · Semanal/)).toBeInTheDocument()

    await usuario.selectOptions(screen.getByLabelText(/Situação da sessão de Ana Beatriz Fictícia/), 'realizada')
    expect(m.mudarStatusSessao).toHaveBeenCalledWith('s1', 'realizada')
  })

  it('no calendário, clicar na sessão abre os detalhes com a situação e os atalhos', async () => {
    const hoje = new Date()
    hoje.setHours(10, 0, 0, 0)
    m.listarSessoesEntre.mockResolvedValue({
      dados: [
        {
          id: 's9',
          owner_id: 'u1',
          patient_id: 'p1',
          series_id: null,
          fee: null,
          payment_status: 'a_receber',
          paid_on: null,
          payment_method: null,
          starts_at: hoje.toISOString(),
          ends_at: new Date(hoje.getTime() + 50 * 60000).toISOString(),
          modality: 'presencial',
          location: 'Sala 2',
          status: 'realizada',
          created_at: AGORA,
          updated_at: AGORA,
          patients: { full_name: 'Ana Beatriz Fictícia' },
          clinical_records: [],
        },
      ],
      erro: null,
    })
    m.mudarStatusSessao.mockResolvedValue({ erro: null })
    const usuario = userEvent.setup()
    renderizarRota('/agenda', { logado: true })
    const bloco = await screen.findByRole('button', { name: 'Ana Beatriz Fictícia, 10:00 às 10:50, Realizada' })
    await usuario.click(bloco)
    const dialogo = screen.getByRole('dialog', { name: 'Ana Beatriz Fictícia' })
    expect(within(dialogo).getByText(/Presencial · Sala 2/)).toBeInTheDocument()
    expect(within(dialogo).getByRole('link', { name: 'Escrever registro' })).toHaveAttribute(
      'href',
      '/pacientes/p1/registros/novo?sessao=s9',
    )
    await usuario.selectOptions(within(dialogo).getByLabelText('Situação'), 'faltou')
    expect(m.mudarStatusSessao).toHaveBeenCalledWith('s9', 'faltou')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('clicar num horário vazio do calendário abre nova sessão com data e hora', async () => {
    m.listarPacientes.mockResolvedValue({ dados: [paciente()], erro: null })
    const usuario = userEvent.setup()
    const { router } = renderizarRota('/agenda?semana=2026-11-16', { logado: true })
    const vazios = await screen.findAllByRole('button', { name: 'Nova sessão às 09:00' })
    await usuario.click(vazios[0]!)
    expect(router.state.location.pathname).toBe('/agenda/nova')
    expect(router.state.location.search).toBe('?data=2026-11-16&hora=09:00')
    expect(await screen.findByLabelText('Horário')).toHaveValue('09:00')
  })

  it('nova sessão semanal mostra a prévia e cria as sessões', async () => {
    m.listarPacientes.mockResolvedValue({ dados: [paciente()], erro: null })
    m.criarSessoes.mockResolvedValue({ erro: null })
    const usuario = userEvent.setup()
    renderizarRota('/agenda/nova?paciente=p1&data=2026-11-16', { logado: true })
    await usuario.click(await screen.findByRole('button', { name: 'Agendar sessão' }))
    expect(screen.getByText('Informe o horário.')).toBeInTheDocument()

    await usuario.type(screen.getByLabelText('Horário'), '09:00')
    await usuario.click(screen.getByLabelText('Repetir toda semana'))
    await usuario.clear(screen.getByLabelText('Quantas semanas, contando esta'))
    await usuario.type(screen.getByLabelText('Quantas semanas, contando esta'), '4')
    expect(screen.getByText(/4 sessões, de 16\/11\/2026 a 07\/12\/2026/)).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Agendar sessões' }))
    await waitFor(() =>
      expect(m.criarSessoes).toHaveBeenCalledWith({
        pacienteId: 'p1',
        data: '2026-11-16',
        hora: '09:00',
        duracao: 50,
        modalidade: 'presencial',
        local: null,
        semanas: 4,
      }),
    )
  })
})

describe('Início', () => {
  it('lista as pendências com o atalho certo', async () => {
    const semana = new Date(Date.now() - 7 * 86400000)
    const base = {
      owner_id: 'u1',
      patient_id: 'p1',
      series_id: null,
      fee: null,
      payment_status: 'a_receber',
      paid_on: null,
      payment_method: null,
      starts_at: semana.toISOString(),
      ends_at: new Date(semana.getTime() + 50 * 60000).toISOString(),
      modality: 'presencial',
      location: null,
      created_at: AGORA,
      updated_at: AGORA,
      patients: { full_name: 'Ana Beatriz Fictícia' },
      clinical_records: [],
    }
    m.listarPendencias.mockResolvedValue({
      dados: [
        { ...base, id: 's1', status: 'realizada' },
        { ...base, id: 's2', status: 'agendada', patients: { full_name: 'João Pedro Exemplo' } },
      ],
      erro: null,
    })
    renderizarRota('/inicio', { logado: true })
    const cartao = (await screen.findByRole('heading', { name: 'Pendências' })).closest('section')!
    expect(await within(cartao).findByRole('link', { name: 'Escrever registro da sessão de Ana Beatriz Fictícia' })).toHaveAttribute(
      'href',
      '/pacientes/p1/registros/novo?sessao=s1',
    )
    expect(within(cartao).getByRole('link', { name: 'Marcar situação da sessão de João Pedro Exemplo' })).toBeInTheDocument()
  })
})
