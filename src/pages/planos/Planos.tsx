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
  PRECO_ANUAL,
  PRECO_MENSAL,
  buscarMeuPlano,
  cancelarAssinatura,
  diasDeTeste,
  emReais,
  iniciarAssinatura,
  listarAssinaturas,
  sincronizarAssinatura,
} from '@/lib/planos/api'
import { useTituloPagina } from '@/lib/titulo'

const MODO_TESTE = import.meta.env.VITE_PAGAMENTO_TESTE !== 'false'

const RECURSOS_GRATUITO = [
  'Rede de supervisores, pedidos e convites',
  'Levar casos anonimizados, devolutivas e horas',
  'Supervisionar colegas e grupos',
  `Agenda e prontuário para até ${LIMITE_GRATUITO} pacientes ativos`,
]
const RECURSOS_ESSENCIAL = ['Tudo do plano gratuito', 'Pacientes ilimitados', 'Financeiro, recibos e documentos (em breve)']

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
  const [ocupado, setOcupado] = useState(false)
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false)
  const voltouDoPagamento = params.get('retorno') === '1'
  const sincronizou = useRef(false)

  // Ao voltar do Mercado Pago, confere a situação direto com ele (pelo servidor).
  useEffect(() => {
    if (!voltouDoPagamento || sincronizou.current) return
    sincronizou.current = true
    sincronizarAssinatura().then((r) => {
      if (r.erro) setErro(r.erro)
      else
        setAviso(
          r.dados?.situacao === 'ativa'
            ? 'Pagamento confirmado. Bem-vindo ao Essencial!'
            : 'Recebemos sua assinatura. O plano muda assim que o Mercado Pago confirmar o pagamento.',
        )
      setParams({}, { replace: true })
      plano.recarregar()
      assinaturas.recarregar()
    })
  }, [voltouDoPagamento, setParams, plano, assinaturas])

  if (plano.carregando || assinaturas.carregando) return <TelaCarregando />
  const meu = plano.dados
  const ativa = (assinaturas.dados ?? []).find((a) => a.status === 'ativa' || a.status === 'pausada')
  const valorMensal = PRECO_MENSAL * (recemFormado ? 0.5 : 1)
  const valorAnual = PRECO_ANUAL * (recemFormado ? 0.5 : 1)

  async function assinar() {
    setOcupado(true)
    setErro(null)
    const r = await iniciarAssinatura(ciclo, recemFormado)
    if (r.erro || !r.dados?.url) {
      setOcupado(false)
      setErro(r.erro ?? 'Não foi possível abrir o pagamento.')
      return
    }
    window.location.assign(r.dados.url)
  }

  async function cancelar() {
    setOcupado(true)
    setErro(null)
    const r = await cancelarAssinatura()
    setOcupado(false)
    setConfirmandoCancelamento(false)
    if (r.erro) setErro(r.erro)
    else setAviso('Assinatura cancelada. Você voltou para o plano gratuito.')
    plano.recarregar()
    assinaturas.recarregar()
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
          {meu.plano === 'essencial' ? (
            <>
              <Etiqueta tom="ok">Essencial</Etiqueta>
              {ativa ? (
                <span className="text-sm text-muted">
                  {ativa.cycle === 'anual' ? 'Anual' : 'Mensal'} · {emReais(Number(ativa.amount))}
                  {ativa.next_payment_at ? ` · próxima cobrança em ${formatarData(new Date(ativa.next_payment_at))}` : ''}
                </span>
              ) : null}
            </>
          ) : meu.plano === 'teste' ? (
            <>
              <Etiqueta tom="atencao">Teste grátis do Essencial</Etiqueta>
              <span className="text-sm text-muted">
                {diasDeTeste(meu.trial_ends_at)} {diasDeTeste(meu.trial_ends_at) === 1 ? 'dia restante' : 'dias restantes'}. Depois, se não assinar,
                você continua no gratuito, sem perder nada.
              </span>
            </>
          ) : (
            <>
              <Etiqueta>Gratuito</Etiqueta>
              <span className="text-sm text-muted">
                {meu.pacientes_ativos} de {LIMITE_GRATUITO} pacientes ativos
              </span>
            </>
          )}
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section aria-labelledby="titulo-gratuito" className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5 sm:p-6">
          <div className="flex flex-col gap-1">
            <h2 id="titulo-gratuito" className="text-xl font-bold">
              Gratuito
            </h2>
            <p className="text-[28px] font-bold">R$ 0</p>
            <p className="text-sm text-muted">Para quem supervisiona ou está começando.</p>
          </div>
          <ul className="flex flex-col gap-2 text-[15px]">
            {RECURSOS_GRATUITO.map((r) => (
              <li key={r} className="flex gap-2">
                <span aria-hidden="true" className="text-pine">✓</span>
                {r}
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="titulo-essencial"
          className="flex flex-col gap-4 rounded-card border-2 border-pine bg-surface p-5 sm:p-6"
        >
          <div className="flex flex-col gap-1">
            <h2 id="titulo-essencial" className="flex items-center gap-2 text-xl font-bold">
              Essencial <Etiqueta tom="ok">30 dias grátis</Etiqueta>
            </h2>
            <p className="text-[28px] font-bold">
              {ciclo === 'anual' ? emReais(valorAnual) : emReais(valorMensal)}
              <span className="text-base font-normal text-muted">{ciclo === 'anual' ? '/ano' : '/mês'}</span>
            </p>
            <p className="text-sm text-muted">
              {ciclo === 'anual'
                ? `Equivale a ${emReais(valorAnual / 12)} por mês: dois meses grátis.`
                : `Ou ${emReais(valorAnual)} por ano, com dois meses grátis.`}
              {recemFormado ? ' Valor com 50% de desconto no primeiro ano.' : ''}
            </p>
          </div>
          <ul className="flex flex-col gap-2 text-[15px]">
            {RECURSOS_ESSENCIAL.map((r) => (
              <li key={r} className="flex gap-2">
                <span aria-hidden="true" className="text-pine">✓</span>
                {r}
              </li>
            ))}
          </ul>

          {meu?.plano === 'essencial' && ativa ? (
            <Botao variante="secundario" onClick={() => setConfirmandoCancelamento(true)} disabled={ocupado}>
              Cancelar assinatura
            </Botao>
          ) : (
            <>
              <fieldset className="flex flex-col gap-1">
                <legend className="mb-1 text-sm font-semibold text-ink-2">Forma de cobrança</legend>
                <div className="flex flex-wrap gap-x-6">
                  {(['anual', 'mensal'] as const).map((c) => (
                    <label key={c} className="flex min-h-11 items-center gap-2.5 text-[15px] text-ink-2">
                      <input
                        type="radio"
                        name="ciclo"
                        checked={ciclo === c}
                        onChange={() => setCiclo(c)}
                        className="size-5 accent-pine"
                      />
                      {c === 'anual' ? `Anual (${emReais(PRECO_ANUAL)})` : `Mensal (${emReais(PRECO_MENSAL)})`}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div>
                <CampoCaixa
                  rotulo="Me formei há menos de 1 ano (50% de desconto no primeiro ano)"
                  checked={recemFormado}
                  onChange={(e) => setRecemFormado(e.target.checked)}
                />
                <p className="text-[13px] text-muted">Podemos pedir a data de inscrição no CRP para confirmar.</p>
              </div>
              <Botao onClick={assinar} carregando={ocupado} textoCarregando="Abrindo o Mercado Pago…">
                Assinar com Mercado Pago
              </Botao>
              <p className="text-[13px] text-muted">
                O pagamento acontece na página do Mercado Pago. O Tríade não vê nem guarda os dados do seu cartão. Cancele quando quiser.
              </p>
            </>
          )}
        </section>
      </div>

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
          <Botao className="bg-danger hover:bg-danger" carregando={ocupado} onClick={cancelar}>
            Cancelar assinatura
          </Botao>
          <Botao variante="secundario" onClick={() => setConfirmandoCancelamento(false)}>
            Manter o Essencial
          </Botao>
        </div>
      </Dialogo>
    </>
  )
}
