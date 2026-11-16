import { useId, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { Aviso } from '@/components/ui/Aviso'
import { Botao, LinkBotao } from '@/components/ui/Botao'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { CampoAreaTexto } from '@/components/ui/CampoAreaTexto'
import { Cartao } from '@/components/ui/Cartao'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { TelaCarregando } from '@/components/ui/TelaCarregando'
import { Vazio } from '@/components/ui/Vazio'
import {
  arquivarPaciente,
  buscarPaciente,
  excluirRegistro,
  listarRegistros,
  listarSessoesDoPaciente,
  type RegistroComVersoes,
  type SessaoComRegistros,
} from '@/lib/consultorio/api'
import {
  ROTULO_MODALIDADE,
  ROTULO_STATUS,
  formatarData,
  formatarDataHora,
  idade,
  paraHora,
  tomDoStatus,
  type Modalidade,
  type StatusSessao,
} from '@/lib/consultorio/formato'
import { useConsulta } from '@/lib/consultorio/useConsulta'
import { useTituloPagina } from '@/lib/titulo'

export function FichaPaciente() {
  const { id = '' } = useParams()
  const paciente = useConsulta(`paciente:${id}`, () => buscarPaciente(id))
  const sessoes = useConsulta(`sessoes-paciente:${id}`, () => listarSessoesDoPaciente(id))
  const registros = useConsulta(`registros:${id}`, () => listarRegistros(id))
  const [erroAcao, setErroAcao] = useState<string | null>(null)
  const [arquivando, setArquivando] = useState(false)
  useTituloPagina(paciente.dados?.full_name ?? 'Paciente')

  if (paciente.carregando) return <TelaCarregando />
  const p = paciente.dados
  if (!p) {
    return (
      <>
        <Cabecalho titulo="Paciente" voltar={{ para: '/pacientes', rotulo: 'Pacientes' }} />
        <Aviso tom="erro">{paciente.erro ?? 'Paciente não encontrado.'}</Aviso>
      </>
    )
  }

  async function alternarArquivo() {
    if (!p) return
    setArquivando(true)
    setErroAcao(null)
    const { erro } = await arquivarPaciente(p.id, !p.archived_at)
    setArquivando(false)
    if (erro) setErroAcao(erro)
    else paciente.recarregar()
  }

  const anos = idade(p.birth_date)
  const agora = new Date()
  const todas = sessoes.dados ?? []
  const proximas = todas.filter((s) => new Date(s.starts_at) >= agora).reverse().slice(0, 5)
  const anteriores = todas.filter((s) => new Date(s.starts_at) < agora).slice(0, 5)

  return (
    <>
      <Cabecalho
        titulo={p.full_name}
        voltar={{ para: '/pacientes', rotulo: 'Pacientes' }}
        subtitulo={
          <span className="flex flex-wrap items-center gap-2">
            {p.archived_at ? <Etiqueta>Arquivado</Etiqueta> : null}
            <span>
              {[
                anos !== null && p.birth_date ? `${anos} anos (${formatarData(p.birth_date)})` : null,
                p.nicknames.length ? `Apelidos: ${p.nicknames.join(', ')}` : null,
              ]
                .filter(Boolean)
                .join(' · ') || 'Sem data de nascimento'}
            </span>
          </span>
        }
        acoes={
          <>
            <LinkBotao to={`/pacientes/${p.id}/registros/novo`}>Novo registro</LinkBotao>
            <LinkBotao to={`/pacientes/${p.id}/supervisao/novo`} variante="supervisao">
              Levar para supervisão
            </LinkBotao>
            <LinkBotao to={`/agenda/nova?paciente=${p.id}`} variante="secundario">
              Agendar sessão
            </LinkBotao>
            <LinkBotao to={`/pacientes/${p.id}/editar`} variante="secundario">
              Editar dados
            </LinkBotao>
          </>
        }
      />

      {erroAcao ? <Aviso tom="erro">{erroAcao}</Aviso> : null}

      <div className="flex flex-wrap items-start gap-6">
        <Cartao titulo="Contato" className="flex-[1_1_280px]">
          <dl className="flex flex-col gap-3 text-sm">
            <div>
              <dt className="font-semibold text-ink-2">Telefone</dt>
              <dd className="text-muted">{p.phone || 'Não informado'}</dd>
            </div>
            <div>
              <dt className="font-semibold text-ink-2">E-mail</dt>
              <dd className="break-words text-muted">{p.email || 'Não informado'}</dd>
            </div>
            {p.patient_contacts.map((c) => (
              <div key={c.id}>
                <dt className="font-semibold text-ink-2">
                  {c.name}
                  {c.relation ? <span className="font-normal text-muted"> · {c.relation}</span> : null}
                </dt>
                <dd className="text-muted">{c.phone || 'Sem telefone'}</dd>
              </div>
            ))}
          </dl>
          <Botao variante="secundario" className="w-fit" carregando={arquivando} onClick={alternarArquivo}>
            {p.archived_at ? 'Reativar paciente' : 'Arquivar paciente'}
          </Botao>
          {!p.archived_at ? (
            <p className="text-[13px] text-muted">
              Arquivar tira o paciente da lista principal. Nada é apagado: prontuário e sessões continuam guardados.
            </p>
          ) : null}
        </Cartao>

        <Cartao titulo="Sessões" className="flex-[2_1_380px]">
          {sessoes.erro ? <Aviso tom="erro">{sessoes.erro}</Aviso> : null}
          {sessoes.carregando ? <TelaCarregando /> : null}
          {!sessoes.carregando && todas.length === 0 ? (
            <Vazio titulo="Nenhuma sessão agendada." detalhe="Use “Agendar sessão” para marcar a primeira." />
          ) : null}
          {proximas.length ? <ListaSessoes titulo="Próximas" sessoes={proximas} /> : null}
          {anteriores.length ? <ListaSessoes titulo="Anteriores" sessoes={anteriores} /> : null}
        </Cartao>
      </div>

      <Cartao titulo="Prontuário" extra={<span>Visível só para você</span>}>
        {registros.erro ? <Aviso tom="erro">{registros.erro}</Aviso> : null}
        {registros.carregando ? <TelaCarregando /> : null}
        {!registros.carregando && (registros.dados ?? []).length === 0 ? (
          <Vazio titulo="Nenhum registro ainda." detalhe="Use “Novo registro” para escrever a evolução de uma sessão." />
        ) : null}
        <ol className="flex flex-col gap-4">
          {(registros.dados ?? []).map((r) => (
            <ItemRegistro key={r.id} pacienteId={p.id} registro={r} aoExcluir={registros.recarregar} />
          ))}
        </ol>
      </Cartao>
    </>
  )
}

function ListaSessoes({ titulo, sessoes }: { titulo: string; sessoes: SessaoComRegistros[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-muted">{titulo}</h3>
      <ul className="flex flex-col">
        {sessoes.map((s) => {
          const inicio = new Date(s.starts_at)
          return (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-border-soft py-2 last:border-b-0"
            >
              <span className="text-sm">
                <span className="font-semibold">
                  {formatarData(inicio)} · {paraHora(inicio)}
                </span>
                <span className="text-muted"> · {ROTULO_MODALIDADE[s.modality as Modalidade] ?? s.modality}</span>
              </span>
              <span className="flex items-center gap-2">
                <Etiqueta tom={tomDoStatus(s.status)}>{ROTULO_STATUS[s.status as StatusSessao] ?? s.status}</Etiqueta>
                <Link to={`/agenda/${s.id}/editar`} className="inline-flex min-h-11 items-center px-1 text-sm font-semibold" aria-label={`Editar sessão de ${formatarData(inicio)}`}>
                  Editar
                </Link>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ItemRegistro({
  pacienteId,
  registro,
  aoExcluir,
}: {
  pacienteId: string
  registro: RegistroComVersoes
  aoExcluir: () => void
}) {
  const [confirmando, setConfirmando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [excluindo, setExcluindo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const idTitulo = useId()
  const versoes = registro.clinical_record_versions.length

  async function confirmar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setExcluindo(true)
    setErro(null)
    const resultado = await excluirRegistro(registro.id, motivo.trim())
    setExcluindo(false)
    if (resultado.erro) setErro(resultado.erro)
    else aoExcluir()
  }

  return (
    <li aria-labelledby={idTitulo} className="flex flex-col gap-3 rounded-control border border-border-soft p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={idTitulo} className="text-[15px] font-bold">
          Atendimento de {formatarData(registro.session_date)}
        </h3>
        <span className="text-[13px] text-muted">
          {versoes
            ? `Editado em ${formatarDataHora(registro.updated_at)}`
            : `Escrito em ${formatarDataHora(registro.created_at)}`}
        </span>
      </div>
      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink">{registro.body}</p>
      <div className="flex flex-wrap gap-x-4">
        <Link
          to={`/pacientes/${pacienteId}/registros/${registro.id}/editar`}
          className="inline-flex min-h-11 items-center text-sm font-semibold"
         aria-label={`Editar registro de ${formatarData(registro.session_date)}`}>
          Editar
        </Link>
        {versoes ? (
          <Link
            to={`/pacientes/${pacienteId}/registros/${registro.id}/historico`}
            className="inline-flex min-h-11 items-center text-sm font-semibold"
          >
            Ver histórico ({versoes} {versoes === 1 ? 'versão anterior' : 'versões anteriores'})
          </Link>
        ) : null}
        {!confirmando ? (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            aria-label={`Excluir registro de ${formatarData(registro.session_date)}`}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-danger"
          >
            Excluir
          </button>
        ) : null}
      </div>
      {confirmando ? (
        <form onSubmit={confirmar} className="flex flex-col gap-3 rounded-control bg-danger-soft p-4">
          <p className="text-sm text-ink-2">
            O registro sai do prontuário, mas continua guardado por no mínimo 5 anos, como exige a Res. CFP 01/2009.
          </p>
          {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
          <CampoAreaTexto
            rotulo="Motivo da exclusão"
            opcional
            rows={2}
            maxLength={500}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Botao type="submit" carregando={excluindo} textoCarregando="Excluindo…" className="bg-danger hover:bg-danger">
              Excluir registro
            </Botao>
            <Botao variante="secundario" onClick={() => setConfirmando(false)}>
              Cancelar
            </Botao>
          </div>
        </form>
      ) : null}
    </li>
  )
}
