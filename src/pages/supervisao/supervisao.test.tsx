import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/lib/supervisao/api'
import { PERFIL_FICTICIO, renderizarRota } from '@/test/renderizar'

vi.mock('@/lib/supervisao/api', async (original) => {
  const real = await original<typeof import('@/lib/supervisao/api')>()
  return {
    CONSULTA_CFP: real.CONSULTA_CFP,
    linkDoConvite: real.linkDoConvite,
    salvarDadosPessoais: vi.fn(),
    buscarMeuPerfilSupervisor: vi.fn(),
    salvarPerfilSupervisor: vi.fn(),
    listarSupervisores: vi.fn(),
    buscarSupervisor: vi.fn(),
    solicitarSupervisao: vi.fn(),
    listarSolicitacoes: vi.fn(),
    contarSolicitacoesRecebidas: vi.fn(),
    responderSolicitacao: vi.fn(),
    cancelarSolicitacao: vi.fn(),
    listarVinculos: vi.fn(),
    encerrarVinculo: vi.fn(),
    criarConvite: vi.fn(),
    listarConvites: vi.fn(),
    apagarConvite: vi.fn(),
    verConvite: vi.fn(),
    aceitarConvite: vi.fn(),
    listarGrupos: vi.fn().mockResolvedValue({ dados: [], erro: null }),
    criarGrupo: vi.fn(),
    definirGrupo: vi.fn(),
  }
})

vi.mock('@/lib/supervisao/casos', async (original) => {
  const real = await original<typeof import('@/lib/supervisao/casos')>()
  return {
    ...real,
    listarCasos: vi.fn().mockResolvedValue({ dados: [], erro: null }),
    listarHoras: vi.fn().mockResolvedValue({ dados: [], erro: null }),
    listarEncontrosDeGrupo: vi.fn().mockResolvedValue({ dados: [], erro: null }),
  }
})

const m = vi.mocked(api)
const AGORA = new Date().toISOString()
const EU = PERFIL_FICTICIO.id

function supervisor(extra: Partial<api.SupervisorNaRede> = {}): api.SupervisorNaRede {
  return {
    id: 'sup1',
    offers_supervision: true,
    accepting_new: true,
    bio: 'Supervisiono em TCC há 10 anos.',
    education: null,
    approaches: ['TCC'],
    areas: ['Ansiedade'],
    years_experience: 12,
    modalities: ['online'],
    formats: ['individual'],
    city: 'Curitiba',
    state: 'PR',
    price_info: null,
    created_at: AGORA,
    updated_at: AGORA,
    profiles: { full_name: 'Paulo Andrade', crp_region: '08', crp_number: '4567' },
    ...extra,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  m.contarSolicitacoesRecebidas.mockResolvedValue({ dados: 0, erro: null })
  m.listarSolicitacoes.mockResolvedValue({ dados: [], erro: null })
  m.listarVinculos.mockResolvedValue({ dados: [], erro: null })
  m.listarConvites.mockResolvedValue({ dados: [], erro: null })
})

describe('Rede de supervisores', () => {
  it('lista supervisores, filtra por abordagem e esconde o próprio perfil', async () => {
    m.listarSupervisores.mockResolvedValue({
      dados: [
        supervisor(),
        supervisor({ id: 'sup2', approaches: ['Psicanálise'], profiles: { full_name: 'Rita Fictícia', crp_region: '06', crp_number: '1' } }),
        supervisor({ id: EU, profiles: { full_name: 'Marina Costa', crp_region: '08', crp_number: '12345' } }),
      ],
      erro: null,
    })
    const usuario = userEvent.setup()
    renderizarRota('/supervisao/encontrar', { logado: true })
    expect(await screen.findByText('Paulo Andrade')).toBeInTheDocument()
    expect(screen.getByText('Rita Fictícia')).toBeInTheDocument()
    expect(screen.queryByText('Marina Costa', { selector: 'span.text-\\[17px\\]' })).not.toBeInTheDocument()
    await usuario.selectOptions(screen.getByLabelText('Abordagem'), 'Psicanálise')
    expect(screen.queryByText('Paulo Andrade')).not.toBeInTheDocument()
    expect(screen.getByText('Rita Fictícia')).toBeInTheDocument()
  })

  it('no perfil do supervisor, envia o pedido com a mensagem e mostra o link de consulta do CFP', async () => {
    m.buscarSupervisor.mockResolvedValue({ dados: supervisor(), erro: null })
    m.solicitarSupervisao.mockResolvedValue({ erro: null })
    const usuario = userEvent.setup()
    renderizarRota('/supervisao/supervisores/sup1', { logado: true })
    expect(await screen.findByRole('heading', { level: 1, name: 'Paulo Andrade' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /consulta pública do CFP/ })).toHaveAttribute('href', api.CONSULTA_CFP)
    await usuario.type(screen.getByLabelText(/Mensagem/), 'Procuro supervisão em TCC.')
    await usuario.click(screen.getByRole('button', { name: 'Enviar pedido' }))
    await waitFor(() => expect(m.solicitarSupervisao).toHaveBeenCalledWith('sup1', 'Procuro supervisão em TCC.'))
    expect(await screen.findByText(/Pedido enviado/)).toBeInTheDocument()
  })

  it('sem vagas, não oferece o formulário de pedido', async () => {
    m.buscarSupervisor.mockResolvedValue({ dados: supervisor({ accepting_new: false }), erro: null })
    renderizarRota('/supervisao/supervisores/sup1', { logado: true })
    expect(await screen.findByText(/não está aceitando novos supervisionandos/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enviar pedido' })).not.toBeInTheDocument()
  })
})

describe('Minha supervisão', () => {
  it('aceita um pedido recebido', async () => {
    m.listarSolicitacoes.mockResolvedValue({
      dados: [
        {
          id: 'ped1',
          requester_id: 'outra',
          supervisor_id: EU,
          message: 'Gostaria de supervisão.',
          status: 'pendente',
          created_at: AGORA,
          responded_at: null,
          link_id: null,
          solicitante: { full_name: 'Bianca Lima', crp_region: null, crp_number: null },
          supervisor: { full_name: 'Marina Costa', crp_region: '08', crp_number: '12345' },
        },
      ],
      erro: null,
    })
    m.responderSolicitacao.mockResolvedValue({ erro: null })
    const usuario = userEvent.setup()
    renderizarRota('/supervisao', { logado: true })
    const cartao = (await screen.findByRole('heading', { name: 'Pedidos recebidos' })).closest('section')!
    expect(within(cartao).getByText('“Gostaria de supervisão.”')).toBeInTheDocument()
    await usuario.click(within(cartao).getByRole('button', { name: 'Aceitar pedido de Bianca Lima' }))
    await waitFor(() => expect(m.responderSolicitacao).toHaveBeenCalledWith('ped1', true))
    expect(await screen.findByText('Agora você supervisiona Bianca Lima.')).toBeInTheDocument()
  })

  it('cria convite por link para o supervisor', async () => {
    m.criarConvite.mockResolvedValue({ erro: null })
    const usuario = userEvent.setup()
    renderizarRota('/supervisao', { logado: true })
    await usuario.click(await screen.findByRole('button', { name: 'Convidar meu supervisor' }))
    await waitFor(() => expect(m.criarConvite).toHaveBeenCalledWith('supervisionando'))
  })

  it('encerrar pede confirmação', async () => {
    m.listarVinculos.mockResolvedValue({
      dados: [
        {
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
        },
      ],
      erro: null,
    })
    m.encerrarVinculo.mockResolvedValue({ erro: null })
    const usuario = userEvent.setup()
    renderizarRota('/supervisao', { logado: true })
    await usuario.click(await screen.findByRole('button', { name: 'Encerrar supervisão com Paulo Andrade' }))
    expect(m.encerrarVinculo).not.toHaveBeenCalled()
    const dialogo = screen.getByRole('dialog', { name: 'Encerrar supervisão?' })
    await usuario.click(within(dialogo).getByRole('button', { name: 'Encerrar supervisão' }))
    await waitFor(() => expect(m.encerrarVinculo).toHaveBeenCalledWith('v1'))
  })
})

describe('Grupos de supervisão', () => {
  it('supervisor cria grupo e coloca o supervisionando nele', async () => {
    const vinculo = {
      id: 'v9',
      supervisor_id: EU,
      supervisee_id: 'outra',
      status: 'ativo',
      format: 'individual',
      origin: 'convite',
      created_at: AGORA,
      ended_at: null,
      ended_by: null,
      group_id: null,
      supervision_groups: null,
      supervisor: { full_name: 'Marina Costa', crp_region: '08', crp_number: '12345' },
      supervisionando: { full_name: 'Bianca Lima', crp_region: null, crp_number: null },
    }
    m.listarVinculos.mockResolvedValue({ dados: [vinculo], erro: null })
    m.listarGrupos.mockResolvedValue({
      dados: [{ id: 'g1', supervisor_id: EU, name: 'Grupo TCC', created_at: AGORA, archived_at: null }],
      erro: null,
    })
    m.criarGrupo.mockResolvedValue({ erro: null })
    m.definirGrupo.mockResolvedValue({ erro: null })
    const usuario = userEvent.setup()
    renderizarRota('/supervisao', { logado: true })
    const cartao = (await screen.findByRole('heading', { name: 'Grupos de supervisão' })).closest('section')!
    expect(within(cartao).getByText(/os colegas do grupo não veem os casos uns dos outros/)).toBeInTheDocument()
    await usuario.type(within(cartao).getByLabelText('Nome do novo grupo'), 'Grupo Infantil')
    await usuario.click(within(cartao).getByRole('button', { name: 'Criar grupo' }))
    await waitFor(() => expect(m.criarGrupo).toHaveBeenCalledWith('Grupo Infantil'))
    await usuario.selectOptions(within(cartao).getByLabelText('Bianca Lima'), 'g1')
    await waitFor(() => expect(m.definirGrupo).toHaveBeenCalledWith('v9', 'g1'))
  })
})

describe('Convite por link', () => {
  it('mostra quem convidou e aceita', async () => {
    m.verConvite.mockResolvedValue({
      dados: { inviter_name: 'Paulo Andrade', inviter_crp_region: '08', inviter_crp_number: '4567', inviter_role: 'supervisor', valido: true },
      erro: null,
    })
    m.aceitarConvite.mockResolvedValue({ erro: null })
    const usuario = userEvent.setup()
    renderizarRota('/convite/abc123', { logado: true })
    expect(await screen.findByText(/convidou você para ser supervisionando/)).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Aceitar convite' }))
    await waitFor(() => expect(m.aceitarConvite).toHaveBeenCalledWith('abc123'))
    expect(await screen.findByText(/vínculo de supervisão com Paulo Andrade foi criado/)).toBeInTheDocument()
  })

  it('sem login, manda para a tela de entrar', async () => {
    const { router } = renderizarRota('/convite/abc123')
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'))
  })
})

describe('Meu perfil', () => {
  it('ativar o perfil de supervisor exige apresentação e salva as escolhas', async () => {
    m.buscarMeuPerfilSupervisor.mockResolvedValue({ dados: null, erro: null })
    m.salvarPerfilSupervisor.mockResolvedValue({ erro: null })
    const usuario = userEvent.setup()
    renderizarRota('/perfil', { logado: true })
    await usuario.click(await screen.findByLabelText('Ofereço supervisão'))
    await usuario.click(screen.getByRole('button', { name: 'Salvar perfil de supervisor' }))
    expect(screen.getByText(/Escreva uma apresentação curta/)).toBeInTheDocument()

    await usuario.type(screen.getByLabelText('Apresentação'), 'Apresentação fictícia.')
    await usuario.type(screen.getByLabelText(/Abordagens/), 'TCC, ACT')
    await usuario.click(screen.getByLabelText('Presencial'))
    await usuario.click(screen.getByRole('button', { name: 'Salvar perfil de supervisor' }))
    await waitFor(() => expect(m.salvarPerfilSupervisor).toHaveBeenCalledOnce())
    const [id, dados, existe] = m.salvarPerfilSupervisor.mock.calls[0]!
    expect(id).toBe(EU)
    expect(existe).toBe(false)
    expect(dados).toMatchObject({
      offers_supervision: true,
      bio: 'Apresentação fictícia.',
      approaches: ['TCC', 'ACT'],
      modalities: ['presencial', 'online'],
      formats: ['individual'],
    })
  })
})
