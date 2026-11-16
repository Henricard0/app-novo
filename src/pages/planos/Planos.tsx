import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Aviso } from '@/components/ui/Aviso'
import { Botao } from '@/components/ui/Botao'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { CampoCaixa } from '@/components/ui/CampoCaixa'
import { Dialogo } from '@/components/ui/Dialogo'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { TelaCarregando } from '@/components/ui/TelaCarregando'
import { formatarData } from '@/lib/consultorio/formato'
import { useConsulta } from '@/lib/consultorio/useConsulta'
import {
  LIMITE_GRATUITO,
  NOME_DO_PLANO,
  PLANOS_PAGOS,
  buscarMeuPlano,
  cancelarAssinatura,
  diasDeTeste,
  emReais,
  iniciarAssinatura,
  listarAssinaturas,
  sincronizarAssinatura,
  type PlanoPago,
} from '@/lib/planos/api'
import { useTituloPagina } from '@/lib/titulo'

const MODO_TESTE = import.meta.env.VITE_PAGAMENTO_TESTE !== 'false'

const RECURSOS_GRATUITO = [
  'Rede de supervisores, pedidos e convites',
  'Levar casos anonimizados, devolutivas e horas',
  'Supervisionar colegas e grupos',
  `Agenda e prontuário para até ${LIMITE_GRATUITO} pacientes ativos`,
]

function Lista({ itens }: { itens: string[] }) {
  return (
    <ul className="flex flex-col gap-2 text-[15px]">
      {itens.map((r) => (
        <li key={r} className="flex gap-2">
          <span aria-hidden="true" className="text-pine">
            ✓
          </span>
          {r}
        </li>
      ))}
    </ul>
  )
}

/** /planos — e volta do Mercado Pago em /planos?retorno=1 */
export function Planos() {
  useTituloPagina('Planos')
  const [params, setParams] = useSearchParams()
  const plano = useConsulta('meu-plano', buscarMeuPlano)
  const assinaturas = useConsulta('assinaturas', listarAssinaturas)
  const [ciclo, setCiclo] = useState<'mensal' | 'anual'>('anual')
  const [recemFormado, setRecemFormado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<PlanoPago | 'cancelar' | null>(null)
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false)
  const voltouDoPagamento = params.get('retorno') === '1'
  const sincronizou = useRef(false)
  const { recarregar: recarregarPlano } = plano
  const { recarregar: recarregarAssinaturas } = assinaturas

  // Ao voltar do Mercado Pago, confere a situação direto com ele (pelo servidor).
  useEffect(() => {
    if (!voltouDoPagamento || sincronizou.current) return
    sincronizou.current = true
    sincronizarAssinatura().then((r) => {
      if (r.erro) setErro(r.erro)
      else
        setAviso(
          r.dados?.situacao === 'ativa'
            ? 'Pagamento confirmado. Seu plano já está ativo!'
            : 'Recebemos sua assinatura. O plano muda assim que o Mercado Pago confirmar o pagamento.',
        )
      setParams({}, { replace: true })
      recarregarPlano()
      recarregarAssinaturas()
    })
  }, [voltouDoPagamento, setParams, recarregarPlano, recarregarAssinaturas])

  if (plano.carregando || assinaturas.carregando) return <TelaCarregando />
  const meu = plano.dados
  const ativa = (assinaturas.dados ?? []).find((a) => a.status === 'ativa' || a.status === 'pausada')
  const fator = recemFormado ? 0.5 : 1

  async function assinar(id: PlanoPago) {
    setOcupado(id)
    setErro(null)
    const r = await iniciarAssinatura(id, ciclo, recemFormado)
    if (r.erro || !r.dados?.url) {
      setOcupado(null)
      setErro(r.erro ?? 'Não foi possível abrir o pagamento.')
      return
    }
    window.location.assign(r.dados.url)
  }

  async function cancelar() {
    setOcupado('cancelar')
    setErro(null)
    const r = await cancelarAssinatura()
    setOcupado(null)
    setConfirmandoCancelamento(false)
    if (r.erro) setErro(r.erro)
    else setAviso('Assinatura cancelada. Você voltou para o plano gratuito.')
    recarregarPlano()
    recarregarAssinaturas()
  }

  return (
    <>
      <Cabecalho titulo="Planos" subtitulo="Menos que uma sessão por mês para organizar o consultório e a supervisão." />
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {aviso ? <Aviso tom="sucesso">{aviso}</Aviso> : null}
      {plano.erro ? <Aviso tom="erro">{plano.erro}</Aviso> : null}

      {meu ? (
        <section aria-label="Seu plano" className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface p-5">
          <span className="text-sm font-semibold text-ink-2">Seu plano:</span>
          <Etiqueta tom={meu.plano === 'gratuito' ? 'neutro' : meu.plano === 'teste' ? 'atencao' : 'ok'}>{NOME_DO_PLANO[meu.plano]}</Etiqueta>
          <span className="text-sm text-muted">
            {meu.plano === 'teste'
              ? `${diasDeTeste(meu.trial_ends_at)} ${diasDeTeste(meu.trial_ends_at) === 1 ? 'dia restante' : 'dias restantes'}. Depois, se não assinar, você continua no Gratuito, sem perder nada.`
              : meu.limite_pacientes
                ? `${meu.pacientes_ativos} de ${meu.limite_pacientes} pacientes ativos`
                : ''}
            {ativa
              ? ` ${ativa.cycle === 'anual' ? 'Anual' : 'Mensal'} · ${emReais(Number(ativa.amount))}${ativa.next_payment_at ? ` · próxima cobrança em ${formatarData(new Date(ativa.next_payment_at))}` : ''}`
              : ''}
          </span>
          {ativa ? (
            <Botao variante="secundario" className="ml-auto" onClick={() => setConfirmandoCancelamento(true)} disabled={Boolean(ocupado)}>
              Cancelar assinatura
            </Botao>
          ) : null}
        </section>
      ) : null}

      <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-semibold text-ink-2">Forma de cobrança</legend>
          <div className="flex flex-wrap gap-x-6">
            {(['anual', 'mensal'] as const).map((c) => (
              <label key={c} className="flex min-h-11 items-center gap-2.5 text-[15px] text-ink-2">
                <input type="radio" name="ciclo" checked={ciclo === c} onChange={() => setCiclo(c)} className="size-5 accent-pine" />
                {c === 'anual' ? 'Anual (2 meses grátis)' : 'Mensal'}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <CampoCaixa
            rotulo="Me formei há menos de 1 ano (50% no primeiro ano)"
            checked={recemFormado}
            onChange={(e) => setRecemFormado(e.target.checked)}
          />
          <p className="text-[13px] text-muted">Podemos pedir a data de inscrição no CRP para confirmar.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <section aria-labelledby="titulo-gratuito" className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5">
          <div className="flex flex-col gap-1">
            <h2 id="titulo-gratuito" className="text-xl font-bold">
              Gratuito
            </h2>
            <p className="text-[26px] font-bold">R$ 0</p>
            <p className="text-sm text-muted">Para quem supervisiona ou está começando.</p>
          </div>
          <Lista itens={RECURSOS_GRATUITO} />
        </section>

        {PLANOS_PAGOS.map((p) => {
          const preco = (ciclo === 'anual' ? p.anual : p.mensal) * fator
          const destaque = p.id === 'essencial'
          const atual = meu?.plano === p.id
          return (
            <section
              key={p.id}
              aria-labelledby={`titulo-${p.id}`}
              className={`flex flex-col gap-4 rounded-card bg-surface p-5 ${destaque ? 'border-2 border-pine' : 'border border-border'}`}
            >
              <div className="flex flex-col gap-1">
                <h2 id={`titulo-${p.id}`} className="flex flex-wrap items-center gap-2 text-xl font-bold">
                  {p.nome}
                  {destaque ? <Etiqueta tom="ok">Mais escolhido</Etiqueta> : null}
                </h2>
                <p className="text-[26px] font-bold">
                  {emReais(preco)}
                  <span className="text-base font-normal text-muted">{ciclo === 'anual' ? '/ano' : '/mês'}</span>
                </p>
                <p className="text-sm text-muted">
                  {ciclo === 'anual' ? `Equivale a ${emReais(preco / 12)} por mês.` : `Ou ${emReais(p.anual * fator)} por ano.`}
                  {recemFormado ? ' Com 50% de desconto no primeiro ano.' : ''}
                </p>
                <p className="text-sm text-ink-2">{p.resumo}</p>
              </div>
              <Lista itens={p.recursos} />
              <div className="mt-auto">
                {atual ? (
                  <Etiqueta tom="ok">Seu plano atual</Etiqueta>
                ) : ativa ? (
                  <p className="text-[13px] text-muted">Para trocar de plano, cancele o atual e assine o novo.</p>
                ) : (
                  <Botao
                    className="w-full"
                    variante={destaque ? 'primario' : 'secundario'}
                    onClick={() => assinar(p.id)}
                    carregando={ocupado === p.id}
                    textoCarregando="Abrindo o Mercado Pago…"
                    disabled={Boolean(ocupado)}
                    aria-label={`Assinar o plano ${p.nome} com Mercado Pago`}
                  >
                    Assinar {p.nome}
                  </Botao>
                )}
              </div>
            </section>
          )
        })}
      </div>

      <p className="text-[13px] text-muted">
        O pagamento acontece na página do Mercado Pago. O Tríade não vê nem guarda os dados do seu cartão. Cancele quando quiser. Funções
        marcadas como “em breve” chegam nas próximas fases, sem mudar o preço.
      </p>

      {MODO_TESTE ? (
        <Aviso tom="info">
          Ambiente de teste: nenhuma cobrança é real. Use a conta de teste “Comprador” e os cartões de teste do Mercado Pago.
        </Aviso>
      ) : null}

      <Dialogo aberto={confirmandoCancelamento} titulo="Cancelar a assinatura?" aoFechar={() => setConfirmandoCancelamento(false)}>
        <p className="text-[15px] text-ink-2">
          Você volta para o plano gratuito. Nada é apagado: pacientes acima de {LIMITE_GRATUITO} continuam guardados, mas só dá para cadastrar ou
          reativar pacientes dentro do limite.
        </p>
        <div className="flex flex-col gap-2">
          <Botao className="bg-danger hover:bg-danger" carregando={ocupado === 'cancelar'} onClick={cancelar}>
            Cancelar assinatura
          </Botao>
          <Botao variante="secundario" onClick={() => setConfirmandoCancelamento(false)}>
            Manter meu plano
          </Botao>
        </div>
      </Dialogo>
    </>
  )
}
