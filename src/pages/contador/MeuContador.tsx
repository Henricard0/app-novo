import { useState } from 'react'
import { useLocation } from 'react-router'
import { useAuth } from '@/auth/contexto'
import { Aviso } from '@/components/ui/Aviso'
import { Botao, LinkBotao } from '@/components/ui/Botao'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { CampoCaixa } from '@/components/ui/CampoCaixa'
import { Cartao } from '@/components/ui/Cartao'
import { Dialogo } from '@/components/ui/Dialogo'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { TelaCarregando } from '@/components/ui/TelaCarregando'
import { Vazio } from '@/components/ui/Vazio'
import {
  buscarMeuContador,
  cancelarPedido,
  encerrarVinculoContador,
  formatarCrc,
  linkDaGuia,
  listarAcessos,
  listarGuiasEPendencias,
  marcarGuiaPaga,
  mudarAutorizacoes,
  resolverPendencia,
  type Autorizacoes,
  type Guia,
} from '@/lib/contador/api'
import { formatarData, formatarDataHora, paraDataISO } from '@/lib/consultorio/formato'
import { useConsulta } from '@/lib/consultorio/useConsulta'
import { emReais, nomeDoMes } from '@/lib/financeiro/formato'
import { buscarMeuPlano } from '@/lib/planos/api'
import { useTituloPagina } from '@/lib/titulo'

const TIPO_GUIA: Record<string, string> = { das: 'DAS', darf: 'DARF', outro: 'Documento' }

const ESCOPO: Record<string, string> = {
  totais: 'Totais do ano',
  lancamentos: 'Lançamentos detalhados',
  despesas: 'Despesas',
}

const AUTORIZACOES: { campo: keyof Autorizacoes; rotulo: string; detalhe: string }[] = [
  {
    campo: 'share_totals',
    rotulo: 'Totais do mês',
    detalhe: 'Quanto você recebeu, quanto falta receber e quantas sessões foram pagas. Também regime e pró-labore.',
  },
  {
    campo: 'share_entries',
    rotulo: 'Lançamentos detalhados',
    detalhe: 'Data, valor, forma e nome e CPF de quem pagou. Necessário para o carnê-leão e os recibos. Revela quem são seus pacientes.',
  },
  {
    campo: 'share_expenses',
    rotulo: 'Despesas',
    detalhe: 'Aluguel, CRP, supervisão e outras despesas lançadas no Financeiro.',
  },
]

/** Linha de detalhe da guia; a competência só aparece se o título não a mencionar. */
function detalheDaGuia(g: Guia): string {
  const mes = nomeDoMes(new Date(`${g.competence}T12:00:00`))
  return [
    g.title.toLocaleLowerCase('pt-BR').includes(mes.split(' ')[0]!) ? null : `${TIPO_GUIA[g.kind] ?? 'Documento'} de ${mes}`,
    g.due_on ? `vence em ${formatarData(g.due_on)}` : null,
    g.amount !== null ? emReais(g.amount) : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** /meu-contador — o contador do psicólogo, o que ele pode ver, guias e pendências. */
export function MeuContador() {
  useTituloPagina('Contador')
  const { user } = useAuth()
  const location = useLocation()
  const avisoDaNavegacao = (location.state as { aviso?: string } | null)?.aviso ?? null
  const meuId = user?.id ?? ''
  const meu = useConsulta(`meu-contador:${meuId}`, () => buscarMeuContador(meuId))
  const plano = useConsulta('meu-plano', buscarMeuPlano)
  const docs = useConsulta('guias-pendencias', listarGuiasEPendencias)
  const acessos = useConsulta('acessos-contador', listarAcessos)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [encerrando, setEncerrando] = useState(false)
  const [mudancas, setMudancas] = useState<Partial<Autorizacoes>>({})

  if (meu.carregando || plano.carregando || docs.carregando) return <TelaCarregando />
  const vinculo = meu.dados?.vinculo ?? null
  const perfil = meu.dados?.perfil ?? null
  const pendentes = meu.dados?.pendentes ?? []
  const planoPermite = ['essencial', 'profissional', 'teste'].includes(plano.dados?.plano ?? '')
  const guias = docs.dados?.guias ?? []
  const pendencias = docs.dados?.pendencias ?? []
  const hoje = paraDataISO(new Date())

  async function executar(chave: string, acao: () => Promise<{ erro: string | null }>, depois: () => void) {
    setOcupado(chave)
    setErro(null)
    const r = await acao()
    setOcupado(null)
    if (r.erro) setErro(r.erro)
    depois()
  }

  async function alternar(campo: keyof Autorizacoes, valor: boolean) {
    if (!vinculo) return
    setMudancas((m) => ({ ...m, [campo]: valor }))
    const r = await mudarAutorizacoes(vinculo.id, { [campo]: valor })
    if (r.erro) {
      setErro(r.erro)
      setMudancas((m) => ({ ...m, [campo]: !valor }))
    }
  }

  async function abrirGuia(g: Guia) {
    setErro(null)
    // Abre a janela já no clique (senão o navegador bloqueia) e carrega o link depois.
    const janela = window.open('', '_blank')
    if (janela) janela.opener = null
    const r = await linkDaGuia(g.file_path)
    if (r.url && janela) janela.location.href = r.url
    else if (r.url) window.location.assign(r.url)
    else {
      janela?.close()
      setErro(r.erro)
    }
  }

  return (
    <>
      <Cabecalho
        titulo="Contador"
        subtitulo="Seu contador vê só o que você liberar, nunca dados clínicos. O valor do serviço é combinado direto com ele."
        acoes={
          vinculo ? null : (
            <LinkBotao to="/meu-contador/encontrar" variante="secundario">
              Encontrar contador
            </LinkBotao>
          )
        }
      />
      {avisoDaNavegacao ? <Aviso tom="sucesso">{avisoDaNavegacao}</Aviso> : null}
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {meu.erro ? <Aviso tom="erro">{meu.erro}</Aviso> : null}
      {!planoPermite ? (
        <Aviso tom="info">
          O contador está disponível nos planos Essencial e Profissional.{' '}
          {vinculo ? 'Enquanto seu plano não permitir, ele não consegue ver nenhum dado. ' : ''}
          Veja os planos em “Planos”.
        </Aviso>
      ) : null}

      {vinculo ? (
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex flex-[2_1_420px] flex-col gap-6">
            <Cartao titulo="O que o contador pode ver">
              <div className="flex flex-col gap-3">
                {AUTORIZACOES.map((a) => {
                  const ligado = mudancas[a.campo] ?? vinculo[a.campo]
                  return (
                    <div key={a.campo} className="flex flex-col">
                      <CampoCaixa rotulo={a.rotulo} checked={ligado} onChange={(e) => void alternar(a.campo, e.target.checked)} />
                      <p className="pl-8 text-[13px] text-muted">{a.detalhe}</p>
                    </div>
                  )
                })}
                <p className="text-[13px] text-muted">
                  Prontuário, agenda, supervisão e anotações nunca ficam visíveis para o contador.
                </p>
              </div>
            </Cartao>

            <section aria-labelledby="titulo-guias" className="flex flex-col gap-3">
              <h2 id="titulo-guias" className="text-lg font-bold">
                Guias
              </h2>
              {guias.length === 0 ? (
                <Vazio titulo="Nenhuma guia ainda." detalhe="Quando o contador enviar um DAS ou DARF, ele aparece aqui com o vencimento." />
              ) : (
                <ul className="flex flex-col divide-y divide-border-soft rounded-card border border-border bg-surface">
                  {guias.map((g) => {
                    const vencida = !g.paid_on && g.due_on && g.due_on < hoje
                    return (
                      <li key={g.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="font-semibold break-words first-letter:uppercase">{g.title}</span>
                          <span className="text-[13px] text-muted">{detalheDaGuia(g)}</span>
                        </span>
                        <Etiqueta tom={g.paid_on ? 'ok' : vencida ? 'atencao' : 'neutro'}>
                          {g.paid_on ? `Paga em ${formatarData(g.paid_on)}` : vencida ? 'Vencida' : 'A pagar'}
                        </Etiqueta>
                        <Botao variante="secundario" onClick={() => void abrirGuia(g)} aria-label={`Abrir PDF: ${g.title}`}>
                          Abrir PDF
                        </Botao>
                        <Botao
                          variante="secundario"
                          carregando={ocupado === g.id}
                          onClick={() => void executar(g.id, () => marcarGuiaPaga(g.id, !g.paid_on), docs.recarregar)}
                          aria-label={g.paid_on ? `Desmarcar pagamento: ${g.title}` : `Marcar como paga: ${g.title}`}
                        >
                          {g.paid_on ? 'Desmarcar' : 'Marcar como paga'}
                        </Botao>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section aria-labelledby="titulo-pendencias" className="flex flex-col gap-3">
              <h2 id="titulo-pendencias" className="text-lg font-bold">
                Pedidos do contador
              </h2>
              {pendencias.length === 0 ? (
                <Vazio titulo="Nenhum pedido." detalhe="Quando o contador precisar de um comprovante ou informação, o pedido aparece aqui." />
              ) : (
                <ul className="flex flex-col divide-y divide-border-soft rounded-card border border-border bg-surface">
                  {pendencias.map((p) => (
                    <li key={p.id} className="flex flex-col gap-1 px-4 py-3">
                      <CampoCaixa
                        rotulo={p.body}
                        checked={Boolean(p.resolved_at)}
                        disabled={ocupado === p.id}
                        onChange={(e) => void executar(p.id, () => resolverPendencia(p.id, e.target.checked), docs.recarregar)}
                      />
                      <span className="pl-8 text-[13px] text-muted">
                        Pedido em {formatarData(new Date(p.created_at))}
                        {p.resolved_at ? ` · resolvido em ${formatarData(new Date(p.resolved_at))}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="flex flex-[1_1_300px] flex-col gap-6">
            <Cartao titulo="Seu contador">
              <div className="flex flex-col gap-2 text-sm">
                <p className="text-[17px] font-bold">{vinculo.contador?.full_name}</p>
                <p className="text-muted">{[perfil?.firm_name, formatarCrc(perfil)].filter(Boolean).join(' · ')}</p>
                <p className="text-muted">Desde {formatarData(new Date(vinculo.created_at))}</p>
                <Botao variante="secundario" className="mt-2" onClick={() => setEncerrando(true)}>
                  Encerrar vínculo
                </Botao>
              </div>
            </Cartao>
            <Cartao titulo="Acessos do contador">
              {acessos.dados?.length ? (
                <ul className="flex flex-col gap-2 text-sm">
                  {acessos.dados.slice(0, 10).map((a) => (
                    <li key={a.id} className="flex flex-col">
                      <span className="font-semibold text-ink-2">
                        {ESCOPO[a.scope] ?? a.scope} · {a.period}
                      </span>
                      <span className="text-muted">{formatarDataHora(a.accessed_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">O contador ainda não consultou seus dados.</p>
              )}
            </Cartao>
          </div>
        </div>
      ) : (
        <>
          {pendentes.length ? (
            <section aria-labelledby="titulo-pedidos-enviados" className="flex flex-col gap-3">
              <h2 id="titulo-pedidos-enviados" className="text-lg font-bold">
                Pedidos enviados
              </h2>
              <ul className="flex flex-col divide-y divide-border-soft rounded-card border border-border bg-surface">
                {pendentes.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-semibold">{p.contador?.full_name}</span>
                      <span className="text-[13px] text-muted">Enviado em {formatarData(new Date(p.created_at))} · aguardando resposta</span>
                    </span>
                    <Botao
                      variante="secundario"
                      carregando={ocupado === p.id}
                      onClick={() => void executar(p.id, () => cancelarPedido(p.id), meu.recarregar)}
                      aria-label={`Cancelar pedido para ${p.contador?.full_name ?? 'contador'}`}
                    >
                      Cancelar pedido
                    </Botao>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <Vazio
              titulo="Você ainda não tem contador no Tríade."
              detalhe="Encontre um contador que atende psicólogos, envie um pedido e escolha o que ele pode ver. As guias e pedidos dele chegam aqui."
            >
              <LinkBotao to="/meu-contador/encontrar" className="mt-3 w-fit">
                Encontrar contador
              </LinkBotao>
            </Vazio>
          )}
          {guias.length ? (
            <p className="text-sm text-muted">Você tem {guias.length} guia(s) de um contador anterior guardada(s).</p>
          ) : null}
        </>
      )}

      {vinculo ? (
        <Dialogo aberto={encerrando} titulo="Encerrar o vínculo?" aoFechar={() => setEncerrando(false)}>
          <p className="text-[15px] text-ink-2">
            O contador perde o acesso aos seus dados na hora. As guias que ele já enviou continuam com você.
          </p>
          <div className="flex flex-col gap-2">
            <Botao
              className="bg-danger hover:bg-danger"
              carregando={ocupado === 'encerrar'}
              onClick={() =>
                void executar('encerrar', () => encerrarVinculoContador(vinculo.id), () => {
                  setEncerrando(false)
                  setMudancas({})
                  meu.recarregar()
                })
              }
            >
              Encerrar vínculo
            </Botao>
            <Botao variante="secundario" onClick={() => setEncerrando(false)}>
              Manter
            </Botao>
          </div>
        </Dialogo>
      ) : null}
    </>
  )
}
