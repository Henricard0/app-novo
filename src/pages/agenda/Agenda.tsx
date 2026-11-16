import { useId, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Aviso } from '@/components/ui/Aviso'
import { Botao, LinkBotao } from '@/components/ui/Botao'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { CLASSES_CAMPO } from '@/components/ui/campo-estilos'
import { Dialogo } from '@/components/ui/Dialogo'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { TelaCarregando } from '@/components/ui/TelaCarregando'
import { listarSessoesEntre, moverSessao, mudarStatusSessao, type SessaoComRegistros } from '@/lib/consultorio/api'
import { conflitos } from '@/lib/consultorio/calendario'
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
import { useMediaQuery } from '@/lib/useMediaQuery'
import { Calendario } from './Calendario'

type Movimento = { sessao: SessaoComRegistros; inicio: Date; fim: Date }

/**
 * /agenda?semana=AAAA-MM-DD&dia=AAAA-MM-DD&visao=lista
 * Calendário (padrão): arrastar muda o horário; no celular mostra um dia por vez.
 * Lista: a semana por dia, com a situação de cada sessão.
 */
export function Agenda() {
  useTituloPagina('Agenda')
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const telaLarga = useMediaQuery('(min-width: 768px)')
  const hoje = new Date()
  const diaEscolhido = lerDataISO(params.get('dia'))
  const segunda = inicioDaSemana(diaEscolhido ?? lerDataISO(params.get('semana')) ?? hoje)
  const domingo = somarDias(segunda, 6)
  const chave = paraDataISO(segunda)
  const visaoLista = params.get('visao') === 'lista'
  const consulta = useConsulta(`agenda:${chave}`, () => listarSessoesEntre(segunda, somarDias(segunda, 7)))
  const [erroAcao, setErroAcao] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ajustes, setAjustes] = useState<{ semana: string; mapa: Record<string, { starts_at: string; ends_at: string }> }>({
    semana: chave,
    mapa: {},
  })
  const [perguntaSerie, setPerguntaSerie] = useState<Movimento | null>(null)
  const [aberta, setAberta] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const dias = Array.from({ length: 7 }, (_, i) => somarDias(segunda, i))
  const mapa = ajustes.semana === chave ? ajustes.mapa : {}
  const sessoes = (consulta.dados ?? []).map((s) => (mapa[s.id] ? { ...s, ...mapa[s.id] } : s))
  const eSemanaAtual = mesmoDia(segunda, inicioDaSemana(hoje))
  const diaNoCelular = diaEscolhido ?? (eSemanaAtual ? hoje : segunda)
  const sessaoAberta = sessoes.find((s) => s.id === aberta) ?? null

  function endereco(extra: Record<string, string | null>) {
    const novo = new URLSearchParams(params)
    for (const [k, v] of Object.entries(extra)) {
      if (v === null) novo.delete(k)
      else novo.set(k, v)
    }
    const texto = novo.toString()
    return `/agenda${texto ? `?${texto}` : ''}`
  }

  async function aoMudarStatus(id: string, status: StatusSessao) {
    setErroAcao(null)
    const { erro } = await mudarStatusSessao(id, status)
    if (erro) setErroAcao(erro)
    consulta.recarregar()
  }

  function aoSoltar(sessao: SessaoComRegistros, inicio: Date, fim: Date) {
    setErroAcao(null)
    setAviso(null)
    // As seguintes da série ficam em outras semanas (não carregadas): toda sessão semanal pergunta.
    const temSeguintes = Boolean(sessao.series_id) && sessao.status === 'agendada'
    if (temSeguintes) setPerguntaSerie({ sessao, inicio, fim })
    else void executar({ sessao, inicio, fim }, false)
  }

  async function executar(mov: Movimento, seguintes: boolean) {
    setPerguntaSerie(null)
    setSalvando(true)
    // Mostra no novo lugar na hora; se o banco recusar, volta.
    setAjustes((a) => ({
      semana: chave,
      mapa: {
        ...(a.semana === chave ? a.mapa : {}),
        [mov.sessao.id]: { starts_at: mov.inicio.toISOString(), ends_at: mov.fim.toISOString() },
      },
    }))
    const { erro, total } = await moverSessao(mov.sessao.id, mov.inicio, mov.fim, seguintes)
    setSalvando(false)
    if (erro) {
      setAjustes((a) => {
        const novo = { ...a.mapa }
        delete novo[mov.sessao.id]
        return { semana: a.semana, mapa: novo }
      })
      setErroAcao(erro)
      return
    }
    const choques = conflitos(sessoes, mov.inicio, mov.fim, [mov.sessao.id])
    const nome = mov.sessao.patients?.full_name ?? 'Paciente'
    setAviso(
      `${nome}: ${total > 1 ? `${total} sessões movidas, a partir de` : 'sessão movida para'} ${formatarDiaDaSemana(mov.inicio).toLocaleLowerCase('pt-BR')}, ${paraHora(mov.inicio)}–${paraHora(mov.fim)}.` +
        (choques.length
          ? ` Atenção: fica no mesmo horário que ${choques.map((c) => c.patients?.full_name ?? 'outra sessão').join(', ')}.`
          : ''),
    )
    consulta.recarregar()
  }

  const navegacaoSemana = (
    <nav aria-label="Semanas" className="flex flex-wrap gap-2">
      <LinkBotao variante="secundario" to={endereco({ semana: paraDataISO(somarDias(segunda, -7)), dia: null })}>
        ← Semana anterior
      </LinkBotao>
      {!eSemanaAtual ? (
        <LinkBotao variante="secundario" to={endereco({ semana: null, dia: null })}>
          Esta semana
        </LinkBotao>
      ) : null}
      <LinkBotao variante="secundario" to={endereco({ semana: paraDataISO(somarDias(segunda, 7)), dia: null })}>
        Próxima semana →
      </LinkBotao>
    </nav>
  )

  return (
    <>
      <Cabecalho
        titulo="Agenda"
        subtitulo={`Semana de ${formatarDiaCurto(segunda)} a ${formatarDiaCurto(domingo)}`}
        acoes={
          <LinkBotao to={`/agenda/nova?data=${paraDataISO(telaLarga ? (eSemanaAtual ? hoje : segunda) : diaNoCelular)}`}>
            Nova sessão
          </LinkBotao>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        {navegacaoSemana}
        <div className="flex rounded-control border border-border-strong bg-surface p-0.5" role="group" aria-label="Forma de ver a agenda">
          <Link
            to={endereco({ visao: null })}
            aria-current={!visaoLista ? 'page' : undefined}
            className={`inline-flex min-h-10 items-center rounded-[8px] px-3 text-sm font-semibold no-underline ${!visaoLista ? 'bg-pine text-white hover:text-white' : 'text-ink hover:text-ink'}`}
          >
            Calendário
          </Link>
          <Link
            to={endereco({ visao: 'lista' })}
            aria-current={visaoLista ? 'page' : undefined}
            className={`inline-flex min-h-10 items-center rounded-[8px] px-3 text-sm font-semibold no-underline ${visaoLista ? 'bg-pine text-white hover:text-white' : 'text-ink hover:text-ink'}`}
          >
            Lista
          </Link>
        </div>
      </div>

      {consulta.erro ? <Aviso tom="erro">{consulta.erro}</Aviso> : null}
      {erroAcao ? <Aviso tom="erro">{erroAcao}</Aviso> : null}
      {aviso ? <Aviso tom="sucesso">{aviso}</Aviso> : null}
      {salvando ? (
        <p role="status" className="text-sm text-muted">
          Salvando novo horário…
        </p>
      ) : null}
      {consulta.carregando ? <TelaCarregando /> : null}

      {!consulta.carregando && !visaoLista ? (
        <>
          {!telaLarga ? (
            <nav aria-label="Dias da semana" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
              {dias.map((dia) => {
                const escolhido = mesmoDia(dia, diaNoCelular)
                return (
                  <Link
                    key={paraDataISO(dia)}
                    to={endereco({ dia: paraDataISO(dia), semana: null })}
                    aria-current={escolhido ? 'date' : undefined}
                    aria-label={formatarDiaDaSemana(dia)}
                    className={`flex min-h-12 min-w-11 flex-1 flex-col items-center justify-center rounded-control border text-xs font-semibold no-underline ${escolhido ? 'border-pine bg-pine text-white hover:text-white' : 'border-border bg-surface text-ink hover:text-ink'}`}
                  >
                    <span>{new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(dia).replace('.', '')}</span>
                    <span className="text-sm">{dia.getDate()}</span>
                  </Link>
                )
              })}
            </nav>
          ) : null}
          <p className="text-sm text-muted">
            {telaLarga
              ? 'Arraste uma sessão para outro dia ou horário. Puxe a borda de baixo para mudar a duração. Clique numa sessão para ver os detalhes.'
              : 'Segure a sessão e arraste para mudar o horário. Toque nela para ver os detalhes.'}
          </p>
          <Calendario
            dias={telaLarga ? dias : [diaNoCelular]}
            sessoes={sessoes}
            aoSoltar={aoSoltar}
            aoAbrir={(s) => setAberta(s.id)}
            aoCriar={(dia, hora) => navigate(`/agenda/nova?data=${paraDataISO(dia)}&hora=${hora}`)}
          />
        </>
      ) : null}

      {!consulta.carregando && visaoLista ? (
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
                    aria-label={`Agendar sessão em ${formatarDiaDaSemana(dia)}`}
                  >
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

      <Dialogo
        aberto={Boolean(perguntaSerie)}
        titulo="Esta sessão se repete toda semana"
        aoFechar={() => setPerguntaSerie(null)}
      >
        {perguntaSerie ? (
          <>
            <p className="text-[15px] text-ink-2">
              Mover para {formatarDiaDaSemana(perguntaSerie.inicio).toLocaleLowerCase('pt-BR')}, {paraHora(perguntaSerie.inicio)}–
              {paraHora(perguntaSerie.fim)}. O que deve mudar?
            </p>
            <div className="flex flex-col gap-2">
              <Botao onClick={() => void executar(perguntaSerie, false)}>Só esta sessão</Botao>
              <Botao variante="secundario" onClick={() => void executar(perguntaSerie, true)}>
                Esta e as seguintes
              </Botao>
              <Botao variante="secundario" onClick={() => setPerguntaSerie(null)}>
                Cancelar
              </Botao>
            </div>
            <p className="text-[13px] text-muted">“Esta e as seguintes” não mexe em sessões já realizadas, com falta ou canceladas.</p>
          </>
        ) : null}
      </Dialogo>

      <Dialogo
        aberto={Boolean(sessaoAberta)}
        titulo={sessaoAberta?.patients?.full_name ?? 'Sessão'}
        aoFechar={() => setAberta(null)}
      >
        {sessaoAberta ? (
          <DetalhesSessao
            sessao={sessaoAberta}
            aoMudarStatus={aoMudarStatus}
            aoFechar={() => setAberta(null)}
          />
        ) : null}
      </Dialogo>
    </>
  )
}

function DetalhesSessao({
  sessao,
  aoMudarStatus,
  aoFechar,
}: {
  sessao: SessaoComRegistros
  aoMudarStatus: (id: string, status: StatusSessao) => void
  aoFechar: () => void
}) {
  const idStatus = useId()
  const inicio = new Date(sessao.starts_at)
  const fim = new Date(sessao.ends_at)
  const temRegistro = sessao.clinical_records.length > 0
  return (
    <>
      <p className="text-[15px] text-ink-2">
        {formatarDiaDaSemana(inicio)}, {paraHora(inicio)}–{paraHora(fim)}
        <br />
        <span className="text-sm break-words text-muted">
          {ROTULO_MODALIDADE[sessao.modality as Modalidade] ?? sessao.modality}
          {sessao.location ? ` · ${sessao.location}` : ''}
          {sessao.series_id ? ' · Semanal' : ''}
        </span>
      </p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={idStatus} className="text-sm font-semibold text-ink-2">
          Situação
        </label>
        <select
          id={idStatus}
          className={CLASSES_CAMPO}
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
      <div className="flex flex-col gap-2">
        {sessao.status === 'realizada' && !temRegistro ? (
          <LinkBotao to={`/pacientes/${sessao.patient_id}/registros/novo?sessao=${sessao.id}`}>Escrever registro</LinkBotao>
        ) : null}
        <LinkBotao variante="secundario" to={`/agenda/${sessao.id}/editar`}>
          Editar data, horário e local
        </LinkBotao>
        <LinkBotao variante="secundario" to={`/pacientes/${sessao.patient_id}`}>
          {temRegistro ? 'Ver paciente e registro' : 'Ver paciente'}
        </LinkBotao>
        <Botao variante="secundario" onClick={aoFechar}>
          Fechar
        </Botao>
      </div>
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
