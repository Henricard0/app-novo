import { useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { Aviso } from '@/components/ui/Aviso'
import { Botao, LinkBotao } from '@/components/ui/Botao'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { CampoCaixa } from '@/components/ui/CampoCaixa'
import { CampoSelecao } from '@/components/ui/CampoSelecao'
import { CampoTexto } from '@/components/ui/CampoTexto'
import { TelaCarregando } from '@/components/ui/TelaCarregando'
import { Vazio } from '@/components/ui/Vazio'
import {
  atualizarSessao,
  buscarSessao,
  criarSessoes,
  horariosDasSessoes,
  listarPacientes,
  mudarStatusSessao,
  type Paciente,
  type SessaoComPaciente,
} from '@/lib/consultorio/api'
import {
  OPCOES_STATUS,
  ROTULO_MODALIDADE,
  duracaoEmMinutos,
  formatarData,
  juntarDataHora,
  lerDataISO,
  paraDataISO,
  paraHora,
  type Modalidade,
  type StatusSessao,
} from '@/lib/consultorio/formato'
import { useConsulta } from '@/lib/consultorio/useConsulta'
import { registrarPagamento } from '@/lib/financeiro/api'
import {
  OPCOES_FORMA,
  ROTULO_PAGAMENTO,
  lerReais,
  paraCampoReais,
  type FormaPagamento,
  type SituacaoPagamento,
} from '@/lib/financeiro/formato'
import { useTituloPagina } from '@/lib/titulo'

/** /agenda/nova (aceita ?paciente= e ?data=) e /agenda/:id/editar */
export function FormSessao() {
  const { id } = useParams()
  const [params] = useSearchParams()
  useTituloPagina(id ? 'Editar sessão' : 'Nova sessão')
  const pacientes = useConsulta('pacientes', listarPacientes)
  const sessao = useConsulta(`sessao:${id ?? 'nova'}`, () =>
    id ? buscarSessao(id) : Promise.resolve({ dados: null, erro: null }),
  )

  if (pacientes.carregando || sessao.carregando) return <TelaCarregando />
  if (id && !sessao.dados) return <Aviso tom="erro">{sessao.erro ?? 'Sessão não encontrada.'}</Aviso>
  if (pacientes.erro) return <Aviso tom="erro">{pacientes.erro}</Aviso>

  const ativos = (pacientes.dados ?? []).filter((p) => !p.archived_at)
  if (!id && ativos.length === 0) {
    return (
      <>
        <Cabecalho titulo="Nova sessão" voltar={{ para: '/agenda', rotulo: 'Agenda' }} />
        <Vazio titulo="Cadastre um paciente antes de agendar." detalhe="A sessão sempre fica ligada a um paciente.">
          <LinkBotao to="/pacientes/novo" className="mt-3 w-fit">
            Novo paciente
          </LinkBotao>
        </Vazio>
      </>
    )
  }

  return (
    <Formulario
      key={id ?? 'nova'}
      pacientes={ativos}
      sessao={sessao.dados}
      pacienteInicial={params.get('paciente')}
      dataInicial={params.get('data')}
      horaInicial={params.get('hora')}
    />
  )
}

const OPCOES_DURACAO = [30, 40, 45, 50, 60, 90, 120].map((m) => ({ valor: String(m), rotulo: `${m} minutos` }))

type Erros = Partial<Record<'paciente' | 'data' | 'hora' | 'semanas' | 'valor' | 'pagoEm', string | null>>

const OPCOES_PAGAMENTO = (Object.keys(ROTULO_PAGAMENTO) as SituacaoPagamento[]).map((p) => ({ valor: p, rotulo: ROTULO_PAGAMENTO[p] }))

function Formulario({
  pacientes,
  sessao,
  pacienteInicial,
  dataInicial,
  horaInicial,
}: {
  pacientes: Paciente[]
  sessao: SessaoComPaciente | null
  pacienteInicial: string | null
  dataInicial: string | null
  horaInicial: string | null
}) {
  const navigate = useNavigate()
  const inicio = sessao ? new Date(sessao.starts_at) : null
  const [pacienteId, setPacienteId] = useState(
    sessao?.patient_id ?? (pacientes.some((p) => p.id === pacienteInicial) ? pacienteInicial! : ''),
  )
  const [data, setData] = useState(inicio ? paraDataISO(inicio) : lerDataISO(dataInicial) ? dataInicial! : paraDataISO(new Date()))
  const [hora, setHora] = useState(inicio ? paraHora(inicio) : /^\d{2}:\d{2}$/.test(horaInicial ?? '') ? horaInicial! : '')
  const [duracao, setDuracao] = useState(sessao ? String(duracaoEmMinutos(sessao.starts_at, sessao.ends_at)) : '50')
  const [modalidade, setModalidade] = useState<Modalidade>((sessao?.modality as Modalidade) ?? 'presencial')
  const [local, setLocal] = useState(sessao?.location ?? '')
  const [status, setStatus] = useState<StatusSessao>((sessao?.status as StatusSessao) ?? 'agendada')
  const valorDoPaciente = (idPaciente: string) => paraCampoReais(pacientes.find((p) => p.id === idPaciente)?.default_fee)
  const [valor, setValor] = useState(sessao ? paraCampoReais(sessao.fee) : valorDoPaciente(pacienteId))
  const [pagamento, setPagamento] = useState<SituacaoPagamento>((sessao?.payment_status as SituacaoPagamento) ?? 'a_receber')
  const [pagoEm, setPagoEm] = useState(sessao?.paid_on ?? paraDataISO(new Date()))
  const [forma, setForma] = useState<FormaPagamento>((sessao?.payment_method as FormaPagamento) ?? 'pix')
  const [repetir, setRepetir] = useState(false)
  const [semanas, setSemanas] = useState('8')
  const [erros, setErros] = useState<Erros>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const opcoesDuracao = OPCOES_DURACAO.some((o) => o.valor === duracao)
    ? OPCOES_DURACAO
    : [...OPCOES_DURACAO, { valor: duracao, rotulo: `${duracao} minutos` }]
  const quantidade = repetir ? Number(semanas) : 1
  const previa = repetir && Number.isInteger(quantidade) && quantidade >= 2 && quantidade <= 52
    ? horariosDasSessoes({ data, hora, duracao: Number(duracao), semanas: quantidade })
    : []

  async function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const novosErros: Erros = {
      paciente: pacienteId ? null : 'Escolha o paciente.',
      data: lerDataISO(data) ? null : 'Informe a data.',
      hora: juntarDataHora(data, hora) || !lerDataISO(data) ? null : 'Informe o horário.',
      semanas:
        repetir && !(Number.isInteger(quantidade) && quantidade >= 2 && quantidade <= 52)
          ? 'Escolha entre 2 e 52 semanas.'
          : null,
      valor: valor.trim() && lerReais(valor) === null ? 'Use só números, como 180 ou 180,00.' : null,
      pagoEm: sessao && pagamento === 'pago' && !lerDataISO(pagoEm) ? 'Informe a data do pagamento.' : null,
    }
    setErros(novosErros)
    setErroGeral(null)
    if (Object.values(novosErros).some(Boolean)) return

    setEnviando(true)
    const comum = { data, hora, duracao: Number(duracao), modalidade, local: local.trim() || null, valor: lerReais(valor) }
    let erro: string | null
    if (sessao) {
      erro = (await atualizarSessao(sessao.id, comum)).erro
      if (!erro && status !== sessao.status) erro = (await mudarStatusSessao(sessao.id, status)).erro
      const pagamentoMudou =
        pagamento !== sessao.payment_status ||
        (pagamento === 'pago' && (pagoEm !== sessao.paid_on || forma !== sessao.payment_method))
      if (!erro && pagamentoMudou) {
        erro = (await registrarPagamento(sessao.id, { situacao: pagamento, pagoEm, forma })).erro
      }
    } else {
      erro = (await criarSessoes({ ...comum, pacienteId, semanas: quantidade })).erro
    }
    setEnviando(false)
    if (erro) {
      setErroGeral(erro)
      return
    }
    navigate(`/agenda?semana=${data}`)
  }

  const nomeDoPaciente = sessao?.patients?.full_name

  return (
    <>
      <Cabecalho
        titulo={sessao ? 'Editar sessão' : 'Nova sessão'}
        voltar={{ para: '/agenda', rotulo: 'Agenda' }}
        subtitulo={sessao?.series_id ? 'Esta sessão faz parte de uma série semanal. A alteração vale só para ela.' : null}
      />
      <form noValidate onSubmit={aoEnviar} className="flex max-w-2xl flex-col gap-6">
        {erroGeral ? <Aviso tom="erro">{erroGeral}</Aviso> : null}
        <section className="flex flex-col gap-5 rounded-card border border-border bg-surface p-5 sm:p-6">
          {sessao ? (
            <p className="text-[15px]">
              <span className="font-semibold text-ink-2">Paciente: </span>
              {nomeDoPaciente}
            </p>
          ) : (
            <CampoSelecao
              rotulo="Paciente"
              name="paciente"
              vazio="Escolha o paciente"
              opcoes={pacientes.map((p) => ({ valor: p.id, rotulo: p.full_name }))}
              value={pacienteId}
              onChange={(e) => {
                setPacienteId(e.target.value)
                setValor(valorDoPaciente(e.target.value))
              }}
              erro={erros.paciente}
            />
          )}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <CampoTexto
              rotulo="Data"
              type="date"
              name="data"
              value={data}
              onChange={(e) => setData(e.target.value)}
              erro={erros.data}
            />
            <CampoTexto
              rotulo="Horário"
              type="time"
              name="hora"
              step={300}
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              erro={erros.hora}
            />
            <CampoSelecao
              rotulo="Duração"
              name="duracao"
              opcoes={opcoesDuracao}
              value={duracao}
              onChange={(e) => setDuracao(e.target.value)}
            />
          </div>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-sm font-semibold text-ink-2">Modalidade</legend>
            <div className="flex flex-wrap gap-x-6">
              {(['presencial', 'online'] as const).map((m) => (
                <label key={m} className="flex min-h-11 items-center gap-2.5 text-[15px] text-ink-2">
                  <input
                    type="radio"
                    name="modalidade"
                    value={m}
                    checked={modalidade === m}
                    onChange={() => setModalidade(m)}
                    className="size-5 accent-pine"
                  />
                  {ROTULO_MODALIDADE[m]}
                </label>
              ))}
            </div>
          </fieldset>

          <CampoTexto
            rotulo={modalidade === 'online' ? 'Link da chamada' : 'Sala ou endereço'}
            opcional
            name="local"
            autoComplete="off"
            maxLength={500}
            value={local}
            onChange={(e) => setLocal(e.target.value)}
          />

          <CampoTexto
            rotulo="Valor da sessão (R$)"
            opcional
            name="valor"
            inputMode="decimal"
            autoComplete="off"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            erro={erros.valor}
            className="max-w-48"
          />

          {sessao ? (
            <CampoSelecao
              rotulo="Situação"
              name="status"
              opcoes={OPCOES_STATUS}
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusSessao)}
            />
          ) : null}

          {sessao ? (
            <div className="grid grid-cols-1 gap-5 rounded-control bg-bg p-4 sm:grid-cols-3">
              <CampoSelecao
                rotulo="Pagamento"
                name="pagamento"
                opcoes={OPCOES_PAGAMENTO}
                value={pagamento}
                onChange={(e) => setPagamento(e.target.value as SituacaoPagamento)}
              />
              {pagamento === 'pago' ? (
                <>
                  <CampoTexto
                    rotulo="Pago em"
                    type="date"
                    name="pago-em"
                    value={pagoEm}
                    onChange={(e) => setPagoEm(e.target.value)}
                    erro={erros.pagoEm}
                  />
                  <CampoSelecao
                    rotulo="Forma"
                    name="forma"
                    opcoes={OPCOES_FORMA}
                    value={forma}
                    onChange={(e) => setForma(e.target.value as FormaPagamento)}
                  />
                </>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-control bg-bg p-4">
              <CampoCaixa rotulo="Repetir toda semana" checked={repetir} onChange={(e) => setRepetir(e.target.checked)} />
              {repetir ? (
                <>
                  <CampoTexto
                    rotulo="Quantas semanas, contando esta"
                    type="number"
                    name="semanas"
                    inputMode="numeric"
                    min={2}
                    max={52}
                    value={semanas}
                    onChange={(e) => setSemanas(e.target.value)}
                    erro={erros.semanas}
                    className="max-w-48"
                  />
                  {previa.length ? (
                    <p className="text-sm text-muted">
                      {previa.length} sessões, de {formatarData(new Date(previa[0]!.starts_at))} a{' '}
                      {formatarData(new Date(previa[previa.length - 1]!.starts_at))}, sempre às {hora || '—'}.
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
          )}
        </section>

        <div className="flex flex-wrap gap-3">
          <Botao type="submit" carregando={enviando} textoCarregando="Salvando…">
            {sessao ? 'Salvar alterações' : repetir ? 'Agendar sessões' : 'Agendar sessão'}
          </Botao>
          <LinkBotao to="/agenda" variante="secundario">
            Cancelar
          </LinkBotao>
        </div>
      </form>
    </>
  )
}
