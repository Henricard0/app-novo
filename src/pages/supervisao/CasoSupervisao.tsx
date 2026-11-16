import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { useAuth } from '@/auth/contexto'
import { Aviso } from '@/components/ui/Aviso'
import { Botao } from '@/components/ui/Botao'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { CampoAreaTexto } from '@/components/ui/CampoAreaTexto'
import { CampoCaixa } from '@/components/ui/CampoCaixa'
import { CampoTexto } from '@/components/ui/CampoTexto'
import { Cartao } from '@/components/ui/Cartao'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { TelaCarregando } from '@/components/ui/TelaCarregando'
import { formatarDataHora } from '@/lib/consultorio/formato'
import { useConsulta } from '@/lib/consultorio/useConsulta'
import { primeiroNome } from '@/lib/texto'
import {
  ROTULO_SITUACAO_CASO,
  apagarRascunho,
  buscarCaso,
  enviarCaso,
  marcarDiscutido,
  marcarEncaminhamento,
  salvarDevolutiva,
  type CasoCompleto,
} from '@/lib/supervisao/casos'
import { useTituloPagina } from '@/lib/titulo'

/** /supervisao/casos/:id — sala de supervisão (supervisor) ou acompanhamento do caso (supervisionando). */
export function CasoSupervisao() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const consulta = useConsulta(`caso:${id}`, () => buscarCaso(id))
  const [aviso, setAviso] = useState<string | null>((location.state as { aviso?: string } | null)?.aviso ?? null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const caso = consulta.dados
  useTituloPagina(caso?.case_label ?? 'Caso')

  if (consulta.carregando) return <TelaCarregando />
  if (!caso) {
    return (
      <>
        <Cabecalho titulo="Caso" voltar={{ para: '/supervisao', rotulo: 'Minha supervisão' }} />
        <Aviso tom="erro">{consulta.erro ?? 'Caso não encontrado.'}</Aviso>
      </>
    )
  }

  const souSupervisionando = caso.supervisee_id === user?.id
  const situacao = ROTULO_SITUACAO_CASO[caso.status] ?? ROTULO_SITUACAO_CASO.rascunho!
  const supervisionando = caso.supervision_links?.supervisionando?.full_name ?? 'Supervisionando'
  const supervisor = caso.supervision_links?.supervisor?.full_name ?? 'Supervisor'
  const encontro = caso.supervision_meetings ? formatarDataHora(caso.supervision_meetings.starts_at) : 'Próximo encontro'

  async function acao(fazer: () => Promise<{ erro: string | null }>, sucesso: string, depois?: () => void) {
    setOcupado(true)
    setErro(null)
    setAviso(null)
    const r = await fazer()
    setOcupado(false)
    if (r.erro) setErro(r.erro)
    else {
      setAviso(sucesso)
      if (depois) depois()
      else consulta.recarregar()
    }
  }

  return (
    <>
      <Cabecalho
        titulo={caso.case_label}
        voltar={souSupervisionando ? { para: '/supervisao', rotulo: 'Minha supervisão' } : { para: '/supervisao/pauta', rotulo: 'Pauta' }}
        subtitulo={
          <span className="flex flex-wrap items-center gap-2">
            <Etiqueta tom={situacao.tom}>{situacao.texto}</Etiqueta>
            <span>
              {encontro} · {souSupervisionando ? `com ${supervisor}` : `trazido por ${supervisionando}`}
            </span>
          </span>
        }
      />
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {aviso ? <Aviso tom="sucesso">{aviso}</Aviso> : null}

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[3_1_420px] flex-col gap-6">
          <Cartao titulo={souSupervisionando ? 'Sua pergunta' : `Pergunta de ${primeiroNome(supervisionando)}`} destaque="supervisao">
            <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{caso.question || 'Sem pergunta ainda.'}</p>
          </Cartao>
          <Cartao
            titulo="Trechos anonimizados"
            extra={<span>{souSupervisionando ? 'É isto que o supervisor vê' : `${caso.supervision_case_excerpts.length} trecho(s)`}</span>}
          >
            <ol className="flex flex-col gap-4">
              {caso.supervision_case_excerpts.map((t) => (
                <li key={t.id} className="flex flex-col gap-1.5">
                  <p className="text-sm font-semibold text-muted">{t.period_label}</p>
                  <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{t.anonymized_body}</p>
                </li>
              ))}
            </ol>
            {!souSupervisionando ? (
              <p className="text-[13px] text-muted">
                {primeiroNome(supervisionando)} escolheu compartilhar {caso.supervision_case_excerpts.length} registro(s), já anonimizados.
              </p>
            ) : null}
          </Cartao>
        </div>

        <div className="flex min-w-0 flex-[2_1_340px] flex-col gap-6">
          {souSupervisionando ? (
            caso.status === 'rascunho' ? (
              <Cartao titulo="Rascunho">
                <p className="text-sm text-muted">Só você vê este caso. Ao enviar, o texto fica congelado e vai para a pauta.</p>
                <div className="flex flex-wrap gap-2">
                  <Botao variante="supervisao" carregando={ocupado} onClick={() => acao(() => enviarCaso(caso.id), 'Caso enviado para a pauta.')}>
                    Enviar para a pauta
                  </Botao>
                  <Botao
                    variante="secundario"
                    disabled={ocupado}
                    onClick={() => acao(() => apagarRascunho(caso.id), 'Rascunho apagado.', () => navigate('/supervisao'))}
                  >
                    Apagar rascunho
                  </Botao>
                </div>
              </Cartao>
            ) : (
              <DevolutivaRecebida caso={caso} supervisor={supervisor} aoMudar={consulta.recarregar} aoErro={setErro} />
            )
          ) : (
            <SalaDevolutiva caso={caso} supervisionando={supervisionando} aoSalvar={(msg) => {
              setErro(null)
              setAviso(msg)
              consulta.recarregar()
            }} aoErro={setErro} />
          )}
        </div>
      </div>
    </>
  )
}

function DevolutivaRecebida({
  caso,
  supervisor,
  aoMudar,
  aoErro,
}: {
  caso: CasoCompleto
  supervisor: string
  aoMudar: () => void
  aoErro: (e: string | null) => void
}) {
  const devolutiva = caso.supervision_feedback
  // Marca na hora; se o banco recusar, volta ao que era.
  const [marcados, setMarcados] = useState<Record<string, boolean>>({})
  if (!devolutiva || devolutiva.status !== 'enviada') {
    return (
      <Cartao titulo="Devolutiva" destaque="supervisao">
        <p className="text-sm text-muted">
          {caso.status === 'discutido' ? 'O caso foi discutido no encontro, sem devolutiva escrita.' : `Aguardando a devolutiva de ${supervisor}.`}
        </p>
      </Cartao>
    )
  }
  return (
    <Cartao titulo={`Devolutiva · ${supervisor}`} destaque="supervisao" extra={devolutiva.sent_at ? <span>{formatarDataHora(devolutiva.sent_at)}</span> : null}>
      {devolutiva.observed ? (
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-muted">O que observou</h3>
          <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{devolutiva.observed}</p>
        </div>
      ) : null}
      {devolutiva.paths ? (
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-muted">Hipóteses e caminhos</h3>
          <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{devolutiva.paths}</p>
        </div>
      ) : null}
      {devolutiva.supervision_feedback_tasks.length ? (
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-muted">Encaminhamentos</h3>
          <ul className="flex flex-col">
            {devolutiva.supervision_feedback_tasks.map((t) => (
              <li key={t.id}>
                <CampoCaixa
                  rotulo={t.text}
                  checked={marcados[t.id] ?? Boolean(t.done_at)}
                  onChange={async (e) => {
                    const feito = e.target.checked
                    setMarcados((m) => ({ ...m, [t.id]: feito }))
                    const r = await marcarEncaminhamento(t.id, feito)
                    aoErro(r.erro)
                    if (r.erro) setMarcados((m) => ({ ...m, [t.id]: !feito }))
                    else aoMudar()
                  }}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-[13px] text-muted">A devolutiva fica aqui, no seu espaço de supervisão. Ela não entra no prontuário.</p>
    </Cartao>
  )
}

function SalaDevolutiva({
  caso,
  supervisionando,
  aoSalvar,
  aoErro,
}: {
  caso: CasoCompleto
  supervisionando: string
  aoSalvar: (mensagem: string) => void
  aoErro: (e: string | null) => void
}) {
  const atual = caso.supervision_feedback
  const enviada = atual?.status === 'enviada'
  const [observado, setObservado] = useState(atual?.observed ?? '')
  const [caminhos, setCaminhos] = useState(atual?.paths ?? '')
  const [encaminhamentos, setEncaminhamentos] = useState<string[]>(atual?.supervision_feedback_tasks.map((t) => t.text) ?? [])
  const [novo, setNovo] = useState('')
  const [registrarHora, setRegistrarHora] = useState(true)
  const [minutos, setMinutos] = useState('60')
  const [ocupado, setOcupado] = useState<'rascunho' | 'enviar' | 'discutido' | null>(null)
  const nome = primeiroNome(supervisionando)

  if (enviada && atual) {
    return (
      <Cartao titulo="Devolutiva enviada" destaque="supervisao" extra={atual.sent_at ? <span>{formatarDataHora(atual.sent_at)}</span> : null}>
        {atual.observed ? <p className="whitespace-pre-wrap break-words text-[15px]"><strong>O que você observou: </strong>{atual.observed}</p> : null}
        {atual.paths ? <p className="whitespace-pre-wrap break-words text-[15px]"><strong>Hipóteses e caminhos: </strong>{atual.paths}</p> : null}
        {atual.supervision_feedback_tasks.length ? (
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px]">
            {atual.supervision_feedback_tasks.map((t) => (
              <li key={t.id}>
                {t.text} {t.done_at ? <Etiqueta tom="ok">Feito</Etiqueta> : <Etiqueta>A fazer</Etiqueta>}
              </li>
            ))}
          </ul>
        ) : null}
      </Cartao>
    )
  }

  async function salvar(enviar: boolean) {
    const numero = Number(minutos)
    if (enviar && !observado.trim() && !caminhos.trim()) {
      aoErro('Escreva a devolutiva antes de enviar.')
      return
    }
    if (enviar && registrarHora && !(Number.isInteger(numero) && numero >= 1 && numero <= 600)) {
      aoErro('Informe os minutos de supervisão (de 1 a 600).')
      return
    }
    setOcupado(enviar ? 'enviar' : 'rascunho')
    const r = await salvarDevolutiva(
      caso.id,
      atual,
      { observado, caminhos, encaminhamentos },
      enviar ? { minutos: registrarHora ? numero : 0 } : null,
    )
    setOcupado(null)
    if (r.erro) aoErro(r.erro)
    else aoSalvar(enviar ? `Devolutiva enviada para ${nome}.` : 'Rascunho da devolutiva salvo.')
  }

  return (
    <section aria-labelledby="titulo-devolutiva" className="flex flex-col gap-4 rounded-card border border-border border-t-4 border-t-ocre bg-surface p-5 sm:p-6">
      <h2 id="titulo-devolutiva" className="text-lg font-bold">
        Devolutiva
      </h2>
      <CampoAreaTexto rotulo="O que você observou" rows={5} maxLength={10000} value={observado} onChange={(e) => setObservado(e.target.value)} />
      <CampoAreaTexto rotulo="Hipóteses e caminhos" rows={5} maxLength={10000} value={caminhos} onChange={(e) => setCaminhos(e.target.value)} />
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-ink-2">Encaminhamentos para {nome}</p>
        {encaminhamentos.length ? (
          <ul className="flex flex-col gap-1">
            {encaminhamentos.map((t, i) => (
              <li key={`${i}-${t}`} className="flex items-center justify-between gap-2 rounded-control bg-bg px-3">
                <span className="text-[15px]">{t}</span>
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-danger"
                  aria-label={`Remover encaminhamento: ${t}`}
                  onClick={() => setEncaminhamentos((l) => l.filter((_, j) => j !== i))}
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap items-end gap-2">
          <CampoTexto rotulo="Novo encaminhamento" maxLength={500} value={novo} onChange={(e) => setNovo(e.target.value)} className="min-w-0 flex-1" />
          <Botao
            variante="secundario"
            onClick={() => {
              if (!novo.trim()) return
              setEncaminhamentos((l) => [...l, novo.trim()])
              setNovo('')
            }}
          >
            Adicionar
          </Botao>
        </div>
      </div>
      <div className="flex flex-col gap-2 rounded-control bg-bg p-3">
        <CampoCaixa rotulo={`Registrar a supervisão nas horas de ${nome}`} checked={registrarHora} onChange={(e) => setRegistrarHora(e.target.checked)} />
        {registrarHora ? (
          <CampoTexto rotulo="Minutos" type="number" inputMode="numeric" min={1} max={600} value={minutos} onChange={(e) => setMinutos(e.target.value)} className="max-w-40" />
        ) : null}
      </div>
      <p className="text-[13px] text-muted">A devolutiva vai para o espaço de supervisão de {nome}. Nada daqui entra no prontuário do paciente.</p>
      <div className="flex flex-wrap gap-2">
        <Botao variante="supervisao" carregando={ocupado === 'enviar'} textoCarregando="Enviando…" disabled={Boolean(ocupado)} onClick={() => salvar(true)}>
          Enviar devolutiva
        </Botao>
        <Botao variante="secundario" carregando={ocupado === 'rascunho'} disabled={Boolean(ocupado)} onClick={() => salvar(false)}>
          Salvar rascunho
        </Botao>
      </div>
      {caso.status === 'na_pauta' ? (
        <button
          type="button"
          className="inline-flex min-h-11 w-fit items-center text-sm font-semibold"
          disabled={Boolean(ocupado)}
          onClick={async () => {
            setOcupado('discutido')
            const r = await marcarDiscutido(caso.id)
            setOcupado(null)
            if (r.erro) aoErro(r.erro)
            else aoSalvar('Caso marcado como discutido.')
          }}
        >
          Marcar como discutido, sem devolutiva escrita
        </button>
      ) : null}
    </section>
  )
}
