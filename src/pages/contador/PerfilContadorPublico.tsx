import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useAuth } from '@/auth/contexto'
import { Aviso } from '@/components/ui/Aviso'
import { Botao, LinkBotao } from '@/components/ui/Botao'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { CampoAreaTexto } from '@/components/ui/CampoAreaTexto'
import { Cartao } from '@/components/ui/Cartao'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { TelaCarregando } from '@/components/ui/TelaCarregando'
import { ESPECIALIDADES, buscarContador, buscarMeuContador, formatarCrc, pedirContador } from '@/lib/contador/api'
import { useConsulta } from '@/lib/consultorio/useConsulta'
import { useTituloPagina } from '@/lib/titulo'

/** /meu-contador/contadores/:id — perfil do contador e pedido. */
export function PerfilContadorPublico() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const contador = useConsulta(`contador:${id}`, () => buscarContador(id))
  const meu = useConsulta(`meu-contador:${user?.id ?? ''}`, () => buscarMeuContador(user?.id ?? ''))
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  useTituloPagina(contador.dados?.profiles?.full_name ?? 'Contador')

  if (contador.carregando || meu.carregando) return <TelaCarregando />
  const c = contador.dados
  const voltar = { para: '/meu-contador/encontrar', rotulo: 'Encontrar contador' }
  if (!c) {
    return (
      <>
        <Cabecalho titulo="Contador" voltar={voltar} />
        <Aviso tom="erro">{contador.erro ?? 'Perfil não encontrado.'}</Aviso>
      </>
    )
  }

  const jaEhMeu = meu.dados?.vinculo?.accountant_id === c.id
  const temOutro = Boolean(meu.dados?.vinculo) && !jaEhMeu
  const pendente = meu.dados?.pendentes.some((p) => p.accountant_id === c.id)

  async function pedir(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    const r = await pedirContador(id, mensagem.trim())
    setEnviando(false)
    if (r.erro) setErro(r.erro)
    else navigate('/meu-contador', { state: { aviso: 'Pedido enviado. Você recebe a resposta aqui no Tríade.' } })
  }

  return (
    <>
      <Cabecalho
        titulo={c.profiles?.full_name ?? 'Contador'}
        voltar={voltar}
        subtitulo={
          <span className="flex flex-wrap items-center gap-2">
            <span>{[c.firm_name, formatarCrc(c)].filter(Boolean).join(' · ')}</span>
            {c.accepting_new ? <Etiqueta tom="ok">Aceitando novos clientes</Etiqueta> : <Etiqueta>Sem vagas no momento</Etiqueta>}
          </span>
        }
      />

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex flex-[2_1_420px] flex-col gap-6">
          <Cartao titulo="Apresentação">
            <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink-2">{c.bio || 'Sem apresentação.'}</p>
          </Cartao>
          <Cartao titulo="O que o contador vai ver">
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] text-ink-2">
              <li>Só o que você liberar: no começo, apenas os totais do mês (recebido, a receber e sessões pagas).</li>
              <li>Lançamentos com nome e CPF de quem pagou, e despesas, só se você ligar essas opções.</li>
              <li>Nunca: prontuário, agenda, nomes fora dos recibos, supervisão.</li>
              <li>Cada consulta dele fica registrada e você pode encerrar o vínculo quando quiser.</li>
            </ul>
          </Cartao>
        </div>

        <div className="flex flex-[1_1_300px] flex-col gap-6">
          <Cartao titulo="Atendimento">
            <dl className="flex flex-col gap-3 text-sm">
              {c.specialties.length ? (
                <div>
                  <dt className="font-semibold text-ink-2">Especialidades</dt>
                  <dd className="text-muted">{c.specialties.map((e) => ESPECIALIDADES[e] ?? e).join(', ')}</dd>
                </div>
              ) : null}
              <div>
                <dt className="font-semibold text-ink-2">Onde</dt>
                <dd className="text-muted">
                  {[c.city && c.state ? `${c.city}/${c.state}` : c.state, c.serves_nationwide ? 'atende todo o Brasil' : null]
                    .filter(Boolean)
                    .join(' · ') || 'Não informado'}
                </dd>
              </div>
              {c.price_info ? (
                <div>
                  <dt className="font-semibold text-ink-2">Valores (informativo)</dt>
                  <dd className="text-muted">{c.price_info}</dd>
                </div>
              ) : null}
              <div>
                <dt className="font-semibold text-ink-2">Registro</dt>
                <dd className="text-muted">
                  {formatarCrc(c)}. Confira na consulta cadastral do CRC do estado antes de contratar.
                </dd>
              </div>
            </dl>
          </Cartao>

          {jaEhMeu ? (
            <Aviso tom="sucesso">Este é o seu contador.</Aviso>
          ) : pendente ? (
            <Aviso tom="info">Você já enviou um pedido. Aguarde a resposta.</Aviso>
          ) : temOutro ? (
            <Aviso tom="info">Você já tem um contador. Para trocar, encerre o vínculo atual em “Contador”.</Aviso>
          ) : c.accepting_new && c.id !== user?.id ? (
            <form noValidate onSubmit={pedir} className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5">
              <h2 className="text-lg font-bold">Pedir atendimento</h2>
              {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
              <CampoAreaTexto
                rotulo="Mensagem"
                opcional
                name="mensagem"
                maxLength={1000}
                rows={4}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                ajuda="Ex.: sou pessoa física e preciso de ajuda com o carnê-leão. Não escreva nada sobre pacientes."
              />
              <Botao type="submit" carregando={enviando} textoCarregando="Enviando…">
                Enviar pedido
              </Botao>
              {erro?.includes('Essencial') ? (
                <LinkBotao to="/planos" variante="secundario">
                  Ver planos
                </LinkBotao>
              ) : null}
            </form>
          ) : null}
        </div>
      </div>
    </>
  )
}
