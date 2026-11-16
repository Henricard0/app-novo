import { useId, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Aviso } from '@/components/ui/Aviso'
import { LinkBotao } from '@/components/ui/Botao'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { CLASSES_CAMPO } from '@/components/ui/campo-estilos'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { TelaCarregando } from '@/components/ui/TelaCarregando'
import { listarSessoesEntre, mudarStatusSessao, type SessaoComRegistros } from '@/lib/consultorio/api'
import {
  OPCOES_STATUS,
  ROTULO_MODALIDADE,
  formatarDiaCurto,
  formatarDiaDaSemana,
  inicioDaSemana,
  lerDataISO,
  mesmoDia,
  paraDataISO,
  paraHora,
  somarDias,
  type Modalidade,
  type StatusSessao,
} from '@/lib/consultorio/formato'
import { useConsulta } from '@/lib/consultorio/useConsulta'
import { useTituloPagina } from '@/lib/titulo'

/** /agenda?semana=AAAA-MM-DD (qualquer dia da semana desejada) */
export function Agenda() {
  useTituloPagina('Agenda')
  const [params] = useSearchParams()
  const hoje = new Date()
  const segunda = inicioDaSemana(lerDataISO(params.get('semana')) ?? hoje)
  const domingo = somarDias(segunda, 6)
  const chave = paraDataISO(segunda)
  const consulta = useConsulta(`agenda:${chave}`, () => listarSessoesEntre(segunda, somarDias(segunda, 7)))
  const [erroAcao, setErroAcao] = useState<string | null>(null)

  const dias = Array.from({ length: 7 }, (_, i) => somarDias(segunda, i))
  const sessoes = consulta.dados ?? []
  const eSemanaAtual = mesmoDia(segunda, inicioDaSemana(hoje))

  async function aoMudarStatus(id: string, status: StatusSessao) {
    setErroAcao(null)
    const { erro } = await mudarStatusSessao(id, status)
    if (erro) setErroAcao(erro)
    consulta.recarregar()
  }

  return (
    <>
      <Cabecalho
        titulo="Agenda"
        subtitulo={`Semana de ${formatarDiaCurto(segunda)} a ${formatarDiaCurto(domingo)}`}
        acoes={<LinkBotao to={`/agenda/nova?data=${paraDataISO(eSemanaAtual ? hoje : segunda)}`}>Nova sessão</LinkBotao>}
      />

      <nav aria-label="Semanas" className="flex flex-wrap gap-2">
        <LinkBotao variante="secundario" to={`/agenda?semana=${paraDataISO(somarDias(segunda, -7))}`}>
          ← Semana anterior
        </LinkBotao>
        {!eSemanaAtual ? (
          <LinkBotao variante="secundario" to="/agenda">
            Esta semana
          </LinkBotao>
        ) : null}
        <LinkBotao variante="secundario" to={`/agenda?semana=${paraDataISO(somarDias(segunda, 7))}`}>
          Próxima semana →
        </LinkBotao>
      </nav>

      {consulta.erro ? <Aviso tom="erro">{consulta.erro}</Aviso> : null}
      {erroAcao ? <Aviso tom="erro">{erroAcao}</Aviso> : null}
      {consulta.carregando ? <TelaCarregando /> : null}

      {!consulta.carregando ? (
        <div className="flex flex-col gap-4">
          {dias.map((dia) => {
            const doDia = sessoes.filter((s) => mesmoDia(new Date(s.starts_at), dia))
            const eHoje = mesmoDia(dia, hoje)
            return (
              <section
                key={paraDataISO(dia)}
                aria-label={formatarDiaDaSemana(dia)}
                className={`flex flex-col gap-3 rounded-card border bg-surface p-4 sm:p-5 ${eHoje ? 'border-pine' : 'border-border'}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-base font-bold">
                    {formatarDiaDaSemana(dia)}
                    {eHoje ? <Etiqueta tom="ok">Hoje</Etiqueta> : null}
                  </h2>
                  <Link
                    to={`/agenda/nova?data=${paraDataISO(dia)}`}
                    className="inline-flex min-h-11 items-center text-sm font-semibold"
                   aria-label={`Agendar sessão em ${formatarDiaDaSemana(dia)}`}>
                    + Sessão
                  </Link>
                </div>
                {doDia.length === 0 ? (
                  <p className="text-sm text-muted">Sem sessões.</p>
                ) : (
                  <ul className="flex flex-col">
                    {doDia.map((s) => (
                      <ItemSessao key={s.id} sessao={s} aoMudarStatus={aoMudarStatus} />
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      ) : null}
    </>
  )
}

function ItemSessao({
  sessao,
  aoMudarStatus,
}: {
  sessao: SessaoComRegistros
  aoMudarStatus: (id: string, status: StatusSessao) => void
}) {
  const idStatus = useId()
  const inicio = new Date(sessao.starts_at)
  const fim = new Date(sessao.ends_at)
  const nome = sessao.patients?.full_name ?? 'Paciente'
  const cancelada = sessao.status === 'cancelada'
  const temRegistro = sessao.clinical_records.length > 0

  return (
    <li className="flex flex-col gap-3 border-b border-border-soft py-3 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className={`flex min-w-0 flex-col gap-0.5 ${cancelada ? 'opacity-60' : ''}`}>
        <span className="text-sm font-semibold text-muted">
          {paraHora(inicio)}–{paraHora(fim)}
        </span>
        <Link to={`/pacientes/${sessao.patient_id}`} className={`font-semibold break-words ${cancelada ? 'line-through' : ''}`}>
          {nome}
        </Link>
        <span className="text-sm break-words text-muted">
          {ROTULO_MODALIDADE[sessao.modality as Modalidade] ?? sessao.modality}
          {sessao.location ? ` · ${sessao.location}` : ''}
          {sessao.series_id ? ' · Semanal' : ''}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <div className="flex items-center gap-2">
          <label htmlFor={idStatus} className="text-sm font-semibold text-ink-2">
            Situação
          </label>
          <select
            id={idStatus}
            aria-label={`Situação da sessão de ${nome} às ${paraHora(inicio)}`}
            className={`${CLASSES_CAMPO} w-auto`}
            value={sessao.status}
            onChange={(e) => aoMudarStatus(sessao.id, e.target.value as StatusSessao)}
          >
            {OPCOES_STATUS.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </div>
        {sessao.status === 'realizada' && !temRegistro ? (
          <Link
            to={`/pacientes/${sessao.patient_id}/registros/novo?sessao=${sessao.id}`}
            className="inline-flex min-h-11 items-center text-sm font-semibold"
           aria-label={`Escrever registro da sessão de ${nome}`}>
            Escrever registro
          </Link>
        ) : null}
        {temRegistro ? (
          <Link to={`/pacientes/${sessao.patient_id}`} className="inline-flex min-h-11 items-center text-sm font-semibold" aria-label={`Ver registro da sessão de ${nome}`}>
            Ver registro
          </Link>
        ) : null}
        <Link to={`/agenda/${sessao.id}/editar`} className="inline-flex min-h-11 items-center text-sm font-semibold" aria-label={`Editar sessão de ${nome}`}>
          Editar
        </Link>
      </div>
    </li>
  )
}
