import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/auth/contexto'
import { Aviso } from '@/components/ui/Aviso'
import { Botao, LinkBotao } from '@/components/ui/Botao'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { Cartao } from '@/components/ui/Cartao'
import { Dialogo } from '@/components/ui/Dialogo'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { TelaCarregando } from '@/components/ui/TelaCarregando'
import { Vazio } from '@/components/ui/Vazio'
import { formatarData, formatarDataHora } from '@/lib/consultorio/formato'
import { useConsulta } from '@/lib/consultorio/useConsulta'
import { formatarCrp } from '@/lib/crp'
import {
  apagarConvite,
  cancelarSolicitacao,
  criarConvite,
  encerrarVinculo,
  linkDoConvite,
  listarConvites,
  listarSolicitacoes,
  listarVinculos,
  responderSolicitacao,
  type PapelConvite,
  type PessoaResumo,
  type Vinculo,
} from '@/lib/supervisao/api'
import { ROTULO_SITUACAO_CASO, formatarHoras, listarCasos, listarHoras } from '@/lib/supervisao/casos'
import { useTituloPagina } from '@/lib/titulo'
import { Grupos } from './Grupos'

function Pessoa({ pessoa }: { pessoa: PessoaResumo | null }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="font-semibold break-words">{pessoa?.full_name ?? 'Pessoa'}</span>
      <span className="text-sm text-muted">{formatarCrp(pessoa?.crp_region ?? null, pessoa?.crp_number ?? null) ?? 'Sem CRP'}</span>
    </span>
  )
}

const ROTULO_PEDIDO: Record<string, { texto: string; tom: 'ok' | 'atencao' | 'neutro' }> = {
  pendente: { texto: 'Aguardando resposta', tom: 'atencao' },
  aceita: { texto: 'Aceito', tom: 'ok' },
  recusada: { texto: 'Recusado', tom: 'neutro' },
  cancelada: { texto: 'Cancelado', tom: 'neutro' },
}

/** /supervisao — pedidos, vínculos e convites. Pauta e devolutivas chegam na Fase 2b. */
export function MinhaSupervisao() {
  useTituloPagina('Minha supervisão')
  const { user } = useAuth()
  const eu = user?.id
  const pedidos = useConsulta('solicitacoes', listarSolicitacoes)
  const vinculos = useConsulta('vinculos', listarVinculos)
  const convites = useConsulta('convites', listarConvites)
  const casos = useConsulta('casos', listarCasos)
  const horas = useConsulta('horas', listarHoras)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [encerrando, setEncerrando] = useState<Vinculo | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)

  if (pedidos.carregando || vinculos.carregando || convites.carregando || casos.carregando || horas.carregando) {
    return <TelaCarregando />
  }

  const recebidos = (pedidos.dados ?? []).filter((p) => p.supervisor_id === eu && p.status === 'pendente')
  const enviados = (pedidos.dados ?? []).filter((p) => p.requester_id === eu).slice(0, 10)
  const ativos = (vinculos.dados ?? []).filter((v) => v.status === 'ativo')
  const meusSupervisores = ativos.filter((v) => v.supervisee_id === eu)
  const meusSupervisionandos = ativos.filter((v) => v.supervisor_id === eu)
  const casosLevados = (casos.dados ?? []).filter((c) => c.supervisee_id === eu)
  const naPauta = (casos.dados ?? []).filter((c) => c.supervisee_id !== eu && c.status === 'na_pauta')
  const anoAtual = new Date().getFullYear()
  const minhasHoras = (horas.dados ?? []).filter((h) => h.supervisee_id === eu)
  const minutosNoAno = minhasHoras.filter((h) => h.occurred_on.startsWith(String(anoAtual))).reduce((t, h) => t + h.minutes, 0)
  const minutosPorVinculo = (linkId: string) => (horas.dados ?? []).filter((h) => h.link_id === linkId).reduce((t, h) => t + h.minutes, 0)

  async function executar(chave: string, acao: () => Promise<{ erro: string | null }>, sucesso: string) {
    setOcupado(chave)
    setErro(null)
    setAviso(null)
    const r = await acao()
    setOcupado(null)
    if (r.erro) setErro(r.erro)
    else setAviso(sucesso)
    pedidos.recarregar()
    vinculos.recarregar()
    convites.recarregar()
  }

  async function copiar(token: string) {
    try {
      await navigator.clipboard.writeText(linkDoConvite(token))
      setCopiado(token)
    } catch {
      setCopiado(null)
      setErro('Não foi possível copiar. Selecione o link e copie manualmente.')
    }
  }

  return (
    <>
      <Cabecalho
        titulo="Minha supervisão"
        subtitulo="Seus supervisores, seus supervisionandos e os pedidos de supervisão."
        acoes={
          <>
            <LinkBotao to="/supervisao/encontrar" variante="supervisao">
              Encontrar supervisor
            </LinkBotao>
            <LinkBotao to="/perfil" variante="secundario">
              Meu perfil de supervisor
            </LinkBotao>
          </>
        }
      />

      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {aviso ? <Aviso tom="sucesso">{aviso}</Aviso> : null}

      {recebidos.length ? (
        <Cartao titulo="Pedidos recebidos" destaque="supervisao" extra={<span>{recebidos.length}</span>}>
          <ul className="flex flex-col gap-4">
            {recebidos.map((p) => (
              <li key={p.id} className="flex flex-col gap-3 rounded-control border border-border-soft p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <Pessoa pessoa={p.solicitante} />
                  <span className="text-[13px] text-muted">Recebido em {formatarDataHora(p.created_at)}</span>
                </div>
                {p.message ? <p className="whitespace-pre-wrap break-words text-[15px] text-ink-2">“{p.message}”</p> : null}
                <div className="flex flex-wrap gap-2">
                  <Botao
                    carregando={ocupado === `aceitar:${p.id}`}
                    onClick={() =>
                      executar(`aceitar:${p.id}`, () => responderSolicitacao(p.id, true), `Agora você supervisiona ${p.solicitante?.full_name ?? 'esta pessoa'}.`)
                    }
                    aria-label={`Aceitar pedido de ${p.solicitante?.full_name ?? 'supervisão'}`}
                  >
                    Aceitar
                  </Botao>
                  <Botao
                    variante="secundario"
                    carregando={ocupado === `recusar:${p.id}`}
                    onClick={() => executar(`recusar:${p.id}`, () => responderSolicitacao(p.id, false), 'Pedido recusado.')}
                    aria-label={`Recusar pedido de ${p.solicitante?.full_name ?? 'supervisão'}`}
                  >
                    Recusar
                  </Botao>
                </div>
              </li>
            ))}
          </ul>
        </Cartao>
      ) : null}

      <div className="flex flex-wrap items-start gap-6">
        <Cartao titulo="Meus supervisores" className="flex-[1_1_320px]">
          {meusSupervisores.length === 0 ? (
            <Vazio titulo="Você ainda não tem supervisor no Tríade." detalhe="Encontre um na rede ou convide o seu por link." />
          ) : (
            <ListaVinculos
              vinculos={meusSupervisores}
              pessoa={(v) => v.supervisor}
              aoEncerrar={setEncerrando}
              minutos={minutosPorVinculo}
            />
          )}
        </Cartao>
        <Cartao titulo="Meus supervisionandos" className="flex-[1_1_320px]">
          {meusSupervisionandos.length === 0 ? (
            <Vazio
              titulo="Você ainda não supervisiona ninguém pelo Tríade."
              detalhe="Ative seu perfil de supervisor para aparecer na rede, ou convide por link."
            />
          ) : (
            <ListaVinculos
              vinculos={meusSupervisionandos}
              pessoa={(v) => v.supervisionando}
              aoEncerrar={setEncerrando}
              minutos={minutosPorVinculo}
            />
          )}
        </Cartao>
      </div>

      <Cartao titulo="Convidar por link">
        <p className="text-sm text-muted">
          Para quem já tem supervisor (ou supervisionando) fora da rede. Gere um link e mande pelo WhatsApp ou e-mail. Ele vale
          por 14 dias e só pode ser usado uma vez.
        </p>
        <div className="flex flex-wrap gap-2">
          {(['supervisionando', 'supervisor'] as PapelConvite[]).map((papel) => (
            <Botao
              key={papel}
              variante="secundario"
              carregando={ocupado === `convite:${papel}`}
              onClick={() => executar(`convite:${papel}`, () => criarConvite(papel), 'Link criado. Copie e mande para a pessoa.')}
            >
              {papel === 'supervisionando' ? 'Convidar meu supervisor' : 'Convidar um supervisionando'}
            </Botao>
          ))}
        </div>
        {(convites.dados ?? []).length ? (
          <ul className="flex flex-col gap-3">
            {(convites.dados ?? []).map((c) => (
              <li key={c.id} className="flex flex-col gap-2 rounded-control border border-border-soft p-3">
                <span className="text-sm font-semibold text-ink-2">
                  {c.inviter_role === 'supervisionando' ? 'Para o seu supervisor' : 'Para um supervisionando'} · vale até{' '}
                  {formatarData(new Date(c.expires_at))}
                </span>
                <code className="block break-all rounded bg-bg px-2 py-1.5 text-[13px]">{linkDoConvite(c.token)}</code>
                <div className="flex flex-wrap gap-2">
                  <Botao variante="secundario" onClick={() => copiar(c.token)}>
                    {copiado === c.token ? 'Copiado!' : 'Copiar link'}
                  </Botao>
                  <Botao
                    variante="secundario"
                    carregando={ocupado === `apagar:${c.id}`}
                    onClick={() => executar(`apagar:${c.id}`, () => apagarConvite(c.id), 'Link apagado. Ele não funciona mais.')}
                  >
                    Apagar link
                  </Botao>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </Cartao>

      {enviados.length ? (
        <Cartao titulo="Pedidos que você enviou">
          <ul className="flex flex-col">
            {enviados.map((p) => {
              const r = ROTULO_PEDIDO[p.status] ?? ROTULO_PEDIDO.pendente!
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft py-3 first:pt-0 last:border-b-0"
                >
                  <Pessoa pessoa={p.supervisor} />
                  <span className="flex flex-wrap items-center gap-2">
                    <Etiqueta tom={r.tom}>{r.texto}</Etiqueta>
                    {p.status === 'pendente' ? (
                      <Botao
                        variante="secundario"
                        carregando={ocupado === `cancelar:${p.id}`}
                        onClick={() => executar(`cancelar:${p.id}`, () => cancelarSolicitacao(p.id), 'Pedido cancelado.')}
                        aria-label={`Cancelar pedido para ${p.supervisor?.full_name ?? 'supervisor'}`}
                      >
                        Cancelar
                      </Botao>
                    ) : null}
                  </span>
                </li>
              )
            })}
          </ul>
        </Cartao>
      ) : null}

      {meusSupervisionandos.length ? (
        <Cartao
          titulo="Pauta"
          destaque="supervisao"
          extra={
            <Link to="/supervisao/pauta" className="inline-flex min-h-11 items-center font-semibold">
              Abrir pauta
            </Link>
          }
        >
          <p className="text-[15px] text-ink-2">
            {naPauta.length
              ? `${naPauta.length} ${naPauta.length === 1 ? 'caso esperando' : 'casos esperando'} sua devolutiva.`
              : 'Nenhum caso esperando devolutiva.'}
          </p>
        </Cartao>
      ) : null}

      {meusSupervisionandos.length ? <Grupos supervisionandos={meusSupervisionandos} aoMudar={vinculos.recarregar} /> : null}

      {meusSupervisores.length || casosLevados.length ? (
        <div className="flex flex-wrap items-start gap-6">
          <Cartao titulo="Horas de supervisão" className="flex-[1_1_240px]">
            <p className="text-[30px] font-bold text-pine">{formatarHoras(minutosNoAno)}</p>
            <p className="text-sm text-muted">em {anoAtual}. Cada encontro registrado pelo supervisor entra aqui automaticamente.</p>
          </Cartao>
          <Cartao titulo="Casos levados à supervisão" className="flex-[3_1_420px]">
            {casosLevados.length === 0 ? (
              <Vazio titulo="Você ainda não levou casos." detalhe="Abra um paciente e use “Levar para supervisão”." />
            ) : (
              <ul className="flex flex-col">
                {casosLevados.map((c) => {
                  const sit = ROTULO_SITUACAO_CASO[c.status] ?? ROTULO_SITUACAO_CASO.rascunho!
                  return (
                    <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-border-soft py-3 first:pt-0 last:border-b-0">
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <Link to={`/supervisao/casos/${c.id}`} className="font-semibold">
                          {c.case_label}
                        </Link>
                        {c.question ? <span className="break-words text-sm text-ink-2">{c.question}</span> : null}
                        <span className="text-[13px] text-muted">
                          {c.sent_at ? `Enviado em ${formatarData(new Date(c.sent_at))}` : 'Não enviado'} · {c.supervision_links?.supervisor?.full_name}
                        </span>
                      </span>
                      <Etiqueta tom={sit.tom}>{c.status === 'devolutiva_recebida' ? 'Devolutiva recebida' : sit.texto}</Etiqueta>
                    </li>
                  )
                })}
              </ul>
            )}
          </Cartao>
        </div>
      ) : null}

      <Dialogo aberto={Boolean(encerrando)} titulo="Encerrar supervisão?" aoFechar={() => setEncerrando(null)}>
        {encerrando ? (
          <>
            <p className="text-[15px] text-ink-2">
              O vínculo com{' '}
              <strong>{(encerrando.supervisor_id === eu ? encerrando.supervisionando : encerrando.supervisor)?.full_name}</strong> será
              encerrado. Para voltar, é preciso um novo pedido ou convite.
            </p>
            <div className="flex flex-col gap-2">
              <Botao
                className="bg-danger hover:bg-danger"
                carregando={ocupado === `encerrar:${encerrando.id}`}
                onClick={async () => {
                  const alvo = encerrando
                  await executar(`encerrar:${alvo.id}`, () => encerrarVinculo(alvo.id), 'Supervisão encerrada.')
                  setEncerrando(null)
                }}
              >
                Encerrar supervisão
              </Botao>
              <Botao variante="secundario" onClick={() => setEncerrando(null)}>
                Voltar
              </Botao>
            </div>
          </>
        ) : null}
      </Dialogo>
    </>
  )
}

function ListaVinculos({
  vinculos,
  pessoa,
  aoEncerrar,
  minutos,
}: {
  vinculos: Vinculo[]
  pessoa: (v: Vinculo) => PessoaResumo | null
  aoEncerrar: (v: Vinculo) => void
  minutos: (linkId: string) => number
}) {
  return (
    <ul className="flex flex-col">
      {vinculos.map((v) => (
        <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft py-3 first:pt-0 last:border-b-0">
          <span className="flex flex-col gap-0.5">
            <Pessoa pessoa={pessoa(v)} />
            <span className="text-[13px] text-muted">
              Desde {formatarData(new Date(v.created_at))} · {v.origin === 'convite' ? 'por convite' : 'pela rede'}
              {v.supervision_groups ? ` · ${v.supervision_groups.name}` : ''}
              {minutos(v.id) ? ` · ${formatarHoras(minutos(v.id))} de supervisão` : ''}
            </span>
          </span>
          <button
            type="button"
            onClick={() => aoEncerrar(v)}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-danger"
            aria-label={`Encerrar supervisão com ${pessoa(v)?.full_name ?? 'esta pessoa'}`}
          >
            Encerrar
          </button>
        </li>
      ))}
    </ul>
  )
}
