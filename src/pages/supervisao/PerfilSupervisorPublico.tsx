import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '@/auth/contexto'
import { Aviso } from '@/components/ui/Aviso'
import { Botao, LinkBotao } from '@/components/ui/Botao'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { CampoAreaTexto } from '@/components/ui/CampoAreaTexto'
import { Cartao } from '@/components/ui/Cartao'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { TelaCarregando } from '@/components/ui/TelaCarregando'
import { useConsulta } from '@/lib/consultorio/useConsulta'
import { formatarCrp } from '@/lib/crp'
import {
  CONSULTA_CFP,
  buscarSupervisor,
  listarSolicitacoes,
  listarVinculos,
  solicitarSupervisao,
} from '@/lib/supervisao/api'
import { useTituloPagina } from '@/lib/titulo'

/** /supervisao/supervisores/:id */
export function PerfilSupervisorPublico() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const supervisor = useConsulta(`supervisor:${id}`, () => buscarSupervisor(id))
  const pedidos = useConsulta('solicitacoes', listarSolicitacoes)
  const vinculos = useConsulta('vinculos', listarVinculos)
  useTituloPagina(supervisor.dados?.profiles?.full_name ?? 'Supervisor')

  if (supervisor.carregando || pedidos.carregando || vinculos.carregando) return <TelaCarregando />
  const s = supervisor.dados
  const voltar = { para: '/supervisao/encontrar', rotulo: 'Encontrar supervisor' }
  if (!s) {
    return (
      <>
        <Cabecalho titulo="Supervisor" voltar={voltar} />
        <Aviso tom="erro">{supervisor.erro ?? 'Perfil não encontrado.'}</Aviso>
      </>
    )
  }

  const crp = formatarCrp(s.profiles?.crp_region ?? null, s.profiles?.crp_number ?? null)
  const eu = s.id === user?.id
  const pendente = (pedidos.dados ?? []).find((p) => p.supervisor_id === s.id && p.requester_id === user?.id && p.status === 'pendente')
  const vinculado = (vinculos.dados ?? []).some((v) => v.supervisor_id === s.id && v.supervisee_id === user?.id && v.status === 'ativo')

  return (
    <>
      <Cabecalho
        titulo={s.profiles?.full_name ?? 'Supervisor'}
        voltar={voltar}
        subtitulo={
          <span className="flex flex-wrap items-center gap-2">
            <span>{crp}</span>
            {s.accepting_new ? <Etiqueta tom="ok">Aceitando supervisionandos</Etiqueta> : <Etiqueta>Sem vagas no momento</Etiqueta>}
          </span>
        }
      />

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex flex-[2_1_420px] flex-col gap-6">
          <Cartao titulo="Apresentação">
            <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink-2">{s.bio || 'Sem apresentação.'}</p>
          </Cartao>
          {s.education ? (
            <Cartao titulo="Formação">
              <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink-2">{s.education}</p>
            </Cartao>
          ) : null}
        </div>

        <div className="flex flex-[1_1_300px] flex-col gap-6">
          <Cartao titulo="Supervisão" destaque="supervisao">
            <dl className="flex flex-col gap-3 text-sm">
              {s.approaches.length ? (
                <div>
                  <dt className="font-semibold text-ink-2">Abordagens</dt>
                  <dd className="text-muted">{s.approaches.join(', ')}</dd>
                </div>
              ) : null}
              {s.areas.length ? (
                <div>
                  <dt className="font-semibold text-ink-2">Áreas de atuação</dt>
                  <dd className="text-muted">{s.areas.join(', ')}</dd>
                </div>
              ) : null}
              {s.years_experience !== null ? (
                <div>
                  <dt className="font-semibold text-ink-2">Experiência clínica</dt>
                  <dd className="text-muted">{s.years_experience} anos</dd>
                </div>
              ) : null}
              <div>
                <dt className="font-semibold text-ink-2">Modalidade e formato</dt>
                <dd className="text-muted">
                  {s.modalities.map((m) => (m === 'online' ? 'Online' : 'Presencial')).join(' e ')} ·{' '}
                  {s.formats.map((f) => (f === 'grupo' ? 'em grupo' : 'individual')).join(' e ')}
                </dd>
              </div>
              {s.city || s.state ? (
                <div>
                  <dt className="font-semibold text-ink-2">Local</dt>
                  <dd className="text-muted">{[s.city, s.state].filter(Boolean).join('/')}</dd>
                </div>
              ) : null}
              {s.price_info ? (
                <div>
                  <dt className="font-semibold text-ink-2">Valor (informado pelo supervisor)</dt>
                  <dd className="text-muted">{s.price_info}</dd>
                </div>
              ) : null}
            </dl>
            <p className="text-[13px] text-muted">
              Confira o registro na{' '}
              <a href={CONSULTA_CFP} target="_blank" rel="noreferrer" className="font-semibold">
                consulta pública do CFP
                <span className="sr-only"> (abre em nova aba)</span>
              </a>{' '}
              ({crp}).
            </p>
          </Cartao>

          {eu ? (
            <Aviso tom="info">
              Este é o seu perfil, como os colegas veem. <Link to="/perfil">Editar em “Meu perfil”</Link>.
            </Aviso>
          ) : vinculado ? (
            <Aviso tom="sucesso">Esta pessoa já é sua supervisora.</Aviso>
          ) : pendente ? (
            <Aviso tom="info">Você já enviou um pedido. Aguarde a resposta em “Minha supervisão”.</Aviso>
          ) : s.accepting_new ? (
            <FormularioPedido supervisorId={s.id} aoEnviar={pedidos.recarregar} />
          ) : (
            <Aviso tom="info">Este supervisor não está aceitando novos supervisionandos no momento.</Aviso>
          )}
        </div>
      </div>
    </>
  )
}

function FormularioPedido({ supervisorId, aoEnviar }: { supervisorId: string; aoEnviar: () => void }) {
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setEnviando(true)
    setErro(null)
    const r = await solicitarSupervisao(supervisorId, mensagem)
    setEnviando(false)
    if (r.erro) setErro(r.erro)
    else {
      setEnviado(true)
      aoEnviar()
    }
  }

  if (enviado) {
    return (
      <Aviso tom="sucesso">
        Pedido enviado. Você acompanha a resposta em <Link to="/supervisao">Minha supervisão</Link>.
      </Aviso>
    )
  }

  return (
    <form onSubmit={enviar} aria-labelledby="titulo-pedido" className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5">
      <h2 id="titulo-pedido" className="text-lg font-bold">
        Pedir supervisão
      </h2>
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      <CampoAreaTexto
        rotulo="Mensagem"
        opcional
        rows={4}
        maxLength={1000}
        value={mensagem}
        onChange={(e) => setMensagem(e.target.value)}
        ajuda="Conte o que você procura na supervisão. Não inclua dados de pacientes."
      />
      <p className="text-[13px] text-muted">O supervisor vai ver seu nome, seu CRP e esta mensagem.</p>
      <div className="flex flex-wrap gap-2">
        <Botao type="submit" variante="supervisao" carregando={enviando} textoCarregando="Enviando…">
          Enviar pedido
        </Botao>
        <LinkBotao to="/supervisao/encontrar" variante="secundario">
          Voltar
        </LinkBotao>
      </div>
    </form>
  )
}
