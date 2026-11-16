import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/auth/contexto'
import { Aviso } from '@/components/ui/Aviso'
import { Botao } from '@/components/ui/Botao'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { TelaCarregando } from '@/components/ui/TelaCarregando'
import { Vazio } from '@/components/ui/Vazio'
import { listarClientes, listarPedidosRecebidos, responderPedido } from '@/lib/contador/api'
import { formatarData } from '@/lib/consultorio/formato'
import { useConsulta } from '@/lib/consultorio/useConsulta'
import { formatarCrp } from '@/lib/crp'
import { primeiroNome } from '@/lib/texto'
import { useTituloPagina } from '@/lib/titulo'

/** /contador — clientes (psicólogos ligados) e pedidos recebidos. */
export function Clientes() {
  useTituloPagina('Clientes')
  const auth = useAuth()
  const meuId = auth.user?.id ?? ''
  const clientes = useConsulta('clientes-contador', listarClientes)
  const pedidos = useConsulta(`pedidos-contador:${meuId}`, () => listarPedidosRecebidos(meuId))
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)

  async function responder(id: string, aceitar: boolean) {
    setOcupado(id)
    setErro(null)
    const r = await responderPedido(id, aceitar)
    setOcupado(null)
    if (r.erro) setErro(r.erro)
    pedidos.recarregar()
    clientes.recarregar()
  }

  if (clientes.carregando || pedidos.carregando) return <TelaCarregando />
  const lista = clientes.dados ?? []
  const recebidos = pedidos.dados ?? []

  return (
    <>
      <Cabecalho
        titulo={`Olá, ${primeiroNome(auth.perfil?.full_name ?? '')}`}
        subtitulo="Psicólogos que escolheram você. Você vê só o que cada um liberou — nunca dados clínicos."
      />
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {clientes.erro ? <Aviso tom="erro">{clientes.erro}</Aviso> : null}

      {recebidos.length ? (
        <section aria-labelledby="titulo-pedidos" className="flex flex-col gap-3">
          <h2 id="titulo-pedidos" className="text-lg font-bold">
            Pedidos novos
          </h2>
          <ul className="flex flex-col gap-3">
            {recebidos.map((p) => (
              <li key={p.id} className="flex flex-col gap-3 rounded-card border border-border border-l-4 border-l-ocre bg-surface p-4">
                <div className="flex flex-col">
                  <span className="font-semibold">{p.psicologo?.full_name}</span>
                  <span className="text-[13px] text-muted">
                    {[formatarCrp(p.psicologo?.crp_region ?? null, p.psicologo?.crp_number ?? null), `pedido em ${formatarData(new Date(p.created_at))}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                {p.message ? <p className="whitespace-pre-wrap break-words text-[15px] text-ink-2">{p.message}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <Botao carregando={ocupado === p.id} onClick={() => void responder(p.id, true)}>
                    Aceitar
                  </Botao>
                  <Botao variante="secundario" disabled={ocupado === p.id} onClick={() => void responder(p.id, false)}>
                    Recusar
                  </Botao>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="titulo-clientes" className="flex flex-col gap-3">
        <h2 id="titulo-clientes" className="text-lg font-bold">
          Clientes
        </h2>
        {lista.length === 0 ? (
          <Vazio
            titulo="Nenhum cliente ainda."
            detalhe="Complete seu perfil e ligue “Aparecer na rede” para que psicólogos encontrem você."
          >
            <Link to="/contador/perfil" className="mt-2 inline-flex min-h-11 items-center font-semibold">
              Completar meu perfil
            </Link>
          </Vazio>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {lista.map((c) => (
              <li key={c.link_id}>
                <Link
                  to={`/contador/clientes/${c.psychologist_id}`}
                  className="flex h-full flex-col gap-2 rounded-card border border-border bg-surface p-5 text-ink no-underline hover:border-border-strong hover:text-ink"
                >
                  <span className="text-[17px] font-bold break-words">{c.full_name}</span>
                  <span className="text-sm text-muted">
                    {[
                      formatarCrp(c.crp_region, c.crp_number),
                      c.regime === 'simples_nacional' ? 'Simples Nacional' : c.regime === 'pessoa_fisica' ? 'Pessoa física' : null,
                      `desde ${formatarData(new Date(c.since))}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {c.plano_ok ? null : <Etiqueta tom="atencao">Plano sem contador</Etiqueta>}
                    {c.share_totals ? <Etiqueta tom="ok">Totais</Etiqueta> : null}
                    {c.share_entries ? <Etiqueta tom="ok">Lançamentos</Etiqueta> : null}
                    {c.share_expenses ? <Etiqueta tom="ok">Despesas</Etiqueta> : null}
                    {!c.share_totals && !c.share_entries && !c.share_expenses ? <Etiqueta>Nada liberado</Etiqueta> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
