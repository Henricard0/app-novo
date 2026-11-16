import { Link } from 'react-router'
import { nomeParaExibir, useAuth } from '@/auth/contexto'
import { Aviso } from '@/components/ui/Aviso'
import { LinkBotao } from '@/components/ui/Botao'
import { Cartao } from '@/components/ui/Cartao'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { TelaCarregando } from '@/components/ui/TelaCarregando'
import { Vazio } from '@/components/ui/Vazio'
import { listarPendencias, listarSessoesEntre } from '@/lib/consultorio/api'
import {
  ROTULO_MODALIDADE,
  ROTULO_STATUS,
  formatarData,
  paraDataISO,
  paraHora,
  somarDias,
  tomDoStatus,
  type Modalidade,
  type StatusSessao,
} from '@/lib/consultorio/formato'
import { useConsulta } from '@/lib/consultorio/useConsulta'
import { dataPorExtenso, saudacao } from '@/lib/data'
import { primeiroNome } from '@/lib/texto'
import { buscarMeuPlano, diasDeTeste } from '@/lib/planos/api'
import { useTituloPagina } from '@/lib/titulo'

export function Inicio() {
  useTituloPagina('Início')
  const auth = useAuth()
  const nome = primeiroNome(nomeParaExibir(auth))
  const agora = new Date()
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
  const chaveHoje = paraDataISO(hoje)

  const sessoes = useConsulta(`hoje:${chaveHoje}`, () => listarSessoesEntre(hoje, somarDias(hoje, 1)))
  const pendencias = useConsulta(`pendencias:${chaveHoje}`, () => listarPendencias())
  const deHoje = (sessoes.dados ?? []).filter((s) => s.status !== 'cancelada')
  const plano = useConsulta('meu-plano', buscarMeuPlano)
  const diasRestantes = plano.dados?.plano === 'teste' ? diasDeTeste(plano.dados.trial_ends_at) : null

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm text-muted">{dataPorExtenso(agora)}</p>
        <h1 className="text-[26px] font-bold tracking-[-0.01em] sm:text-[30px]">
          {saudacao(agora)}
          {nome ? `, ${nome}` : ''}
        </h1>
      </div>

      {diasRestantes !== null ? (
        <Aviso tom="info">
          Você está no teste grátis do Profissional: {diasRestantes} {diasRestantes === 1 ? 'dia restante' : 'dias restantes'}.{' '}
          <Link to="/planos" className="font-semibold">
            Ver planos
          </Link>
        </Aviso>
      ) : null}

      <div className="flex flex-wrap items-stretch gap-6">
        <Cartao
          titulo="Sessões de hoje"
          className="flex-[3_1_480px]"
          extra={
            <Link to="/agenda" className="inline-flex min-h-11 items-center font-semibold">
              Ver agenda
            </Link>
          }
        >
          {sessoes.erro ? <Aviso tom="erro">{sessoes.erro}</Aviso> : null}
          {sessoes.carregando ? <TelaCarregando /> : null}
          {!sessoes.carregando && !sessoes.erro && deHoje.length === 0 ? (
            <Vazio titulo="Nenhuma sessão hoje.">
              <LinkBotao to={`/agenda/nova?data=${chaveHoje}`} variante="secundario" className="mt-3 w-fit">
                Agendar sessão
              </LinkBotao>
            </Vazio>
          ) : null}
          {deHoje.length ? (
            <ul className="flex flex-col">
              {deHoje.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border-soft py-3 first:pt-0 last:border-b-0"
                >
                  <span className="flex min-w-0 items-baseline gap-3">
                    <span className="w-12 shrink-0 text-sm font-semibold text-muted">{paraHora(new Date(s.starts_at))}</span>
                    <span className="flex min-w-0 flex-col">
                      <Link to={`/pacientes/${s.patient_id}`} className="font-semibold break-words">
                        {s.patients?.full_name ?? 'Paciente'}
                      </Link>
                      <span className="text-sm text-muted">
                        {ROTULO_MODALIDADE[s.modality as Modalidade] ?? s.modality}
                        {s.location ? ` · ${s.location}` : ''}
                      </span>
                    </span>
                  </span>
                  <Etiqueta tom={tomDoStatus(s.status)}>{ROTULO_STATUS[s.status as StatusSessao] ?? s.status}</Etiqueta>
                </li>
              ))}
            </ul>
          ) : null}
        </Cartao>

        <Cartao titulo="Supervisão" destaque="supervisao" className="flex-[2_1_300px]">
          <Vazio
            titulo="Você ainda não tem supervisão configurada."
            detalhe="Convites, pauta e devolutivas chegam na Fase 2."
          />
        </Cartao>
      </div>

      <Cartao titulo="Pendências" extra={pendencias.dados?.length ? <span>{pendencias.dados.length}</span> : null}>
        {pendencias.erro ? <Aviso tom="erro">{pendencias.erro}</Aviso> : null}
        {pendencias.carregando ? <TelaCarregando /> : null}
        {!pendencias.carregando && !pendencias.erro && (pendencias.dados ?? []).length === 0 ? (
          <Vazio titulo="Nada pendente." detalhe="Sessões sem registro ou sem situação marcada aparecem aqui." />
        ) : null}
        {(pendencias.dados ?? []).length ? (
          <ul className="flex flex-col">
            {(pendencias.dados ?? []).map((s) => {
              const inicio = new Date(s.starts_at)
              const nomePaciente = s.patients?.full_name ?? 'Paciente'
              const semSituacao = s.status === 'agendada'
              return (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border-soft py-3 first:pt-0 last:border-b-0"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="font-semibold break-words">{nomePaciente}</span>
                    <span className="text-sm text-muted">
                      Sessão de {formatarData(inicio)} às {paraHora(inicio)} ·{' '}
                      {semSituacao ? 'falta marcar se aconteceu' : 'sem registro no prontuário'}
                    </span>
                  </span>
                  {semSituacao ? (
                    <Link
                      to={`/agenda?semana=${paraDataISO(inicio)}`}
                      className="inline-flex min-h-11 items-center text-sm font-semibold"
                     aria-label={`Marcar situação da sessão de ${nomePaciente}`}>
                      Marcar situação
                    </Link>
                  ) : (
                    <Link
                      to={`/pacientes/${s.patient_id}/registros/novo?sessao=${s.id}`}
                      className="inline-flex min-h-11 items-center text-sm font-semibold"
                     aria-label={`Escrever registro da sessão de ${nomePaciente}`}>
                      Escrever registro
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        ) : null}
      </Cartao>
    </>
  )
}
