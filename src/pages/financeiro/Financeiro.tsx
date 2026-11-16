import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Aviso } from '@/components/ui/Aviso'
import { Botao } from '@/components/ui/Botao'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { CampoSelecao } from '@/components/ui/CampoSelecao'
import { CampoTexto } from '@/components/ui/CampoTexto'
import { Dialogo } from '@/components/ui/Dialogo'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { TelaCarregando } from '@/components/ui/TelaCarregando'
import { Vazio } from '@/components/ui/Vazio'
import { formatarData, lerDataISO, paraDataISO } from '@/lib/consultorio/formato'
import { useConsulta } from '@/lib/consultorio/useConsulta'
import {
  buscarDadosFiscais,
  buscarMes,
  lancarDespesa,
  registrarPagamento,
  removerDespesa,
  resumirMes,
  salvarDadosFiscais,
  type DadosFiscais,
  type SessaoFinanceira,
} from '@/lib/financeiro/api'
import {
  OPCOES_CATEGORIA,
  OPCOES_FORMA,
  ROTULO_CATEGORIA,
  ROTULO_FORMA,
  ROTULO_PAGAMENTO,
  chaveDoMes,
  emReais,
  inicioDoMes,
  lerReais,
  nomeDoMes,
  paraCampoReais,
  somarMeses,
  type CategoriaDespesa,
  type FormaPagamento,
  type SituacaoPagamento,
} from '@/lib/financeiro/formato'
import { useTituloPagina } from '@/lib/titulo'

function Total({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-card border border-border bg-surface p-4">
      <span className="text-sm text-muted">{rotulo}</span>
      <span className={`text-[22px] font-bold ${destaque ? 'text-pine' : ''}`}>{emReais(valor)}</span>
    </div>
  )
}

/** /financeiro — mês a mês: recebido, a receber, despesas e saldo. */
export function Financeiro() {
  useTituloPagina('Financeiro')
  const [mes, setMes] = useState(() => inicioDoMes(new Date()))
  const consulta = useConsulta(`financeiro:${chaveDoMes(mes)}`, () => buscarMes(mes))
  const fiscais = useConsulta('dados-fiscais', buscarDadosFiscais)
  const [pagando, setPagando] = useState<SessaoFinanceira | null>(null)
  const [novaDespesa, setNovaDespesa] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const dados = consulta.dados
  const resumo = dados ? resumirMes(dados) : null

  async function remover(id: string) {
    setErro(null)
    const r = await removerDespesa(id)
    if (r.erro) setErro(r.erro)
    consulta.recarregar()
  }

  return (
    <>
      <Cabecalho
        titulo="Financeiro"
        subtitulo="Valores das sessões, pagamentos e despesas do consultório. Conta pelo dia em que o dinheiro entrou, como no carnê-leão."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Botao variante="secundario" onClick={() => setMes((m) => somarMeses(m, -1))} aria-label="Mês anterior">
          ←
        </Botao>
        <h2 className="min-w-44 text-center text-lg font-bold first-letter:uppercase" aria-live="polite">
          {nomeDoMes(mes)}
        </h2>
        <Botao variante="secundario" onClick={() => setMes((m) => somarMeses(m, 1))} aria-label="Próximo mês">
          →
        </Botao>
      </div>

      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {consulta.erro ? <Aviso tom="erro">{consulta.erro}</Aviso> : null}
      {consulta.carregando && !dados ? <TelaCarregando /> : null}

      {resumo && dados ? (
        <>
          <section aria-label="Totais do mês" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Total rotulo="Recebido" valor={resumo.recebido} destaque />
            <Total rotulo="A receber" valor={resumo.aReceber} />
            <Total rotulo="Despesas" valor={resumo.despesas} />
            <Total rotulo="Saldo" valor={resumo.saldo} />
          </section>

          <section aria-labelledby="titulo-sessoes-mes" className="flex flex-col gap-3">
            <h2 id="titulo-sessoes-mes" className="text-lg font-bold">
              Sessões do mês
            </h2>
            {dados.sessoes.length === 0 ? (
              <Vazio titulo="Nenhuma sessão neste mês." detalhe="Os valores aparecem aqui conforme você agenda." />
            ) : (
              <ul className="flex flex-col divide-y divide-border-soft rounded-card border border-border bg-surface">
                {dados.sessoes.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-semibold break-words">{s.patients?.full_name}</span>
                      <span className="text-[13px] text-muted">
                        {formatarData(new Date(s.starts_at))}
                        {s.status === 'faltou' ? ' · faltou' : s.status === 'agendada' ? ' · agendada' : ''}
                        {s.payment_status === 'pago' && s.paid_on
                          ? ` · pago em ${formatarData(s.paid_on)}${s.payment_method ? ` (${ROTULO_FORMA[s.payment_method as FormaPagamento]})` : ''}`
                          : ''}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums">{s.fee === null ? 'Sem valor' : emReais(s.fee)}</span>
                    <Etiqueta tom={s.payment_status === 'pago' ? 'ok' : s.payment_status === 'isento' ? 'neutro' : 'atencao'}>
                      {ROTULO_PAGAMENTO[s.payment_status as SituacaoPagamento]}
                    </Etiqueta>
                    <Botao
                      variante="secundario"
                      onClick={() => setPagando(s)}
                      aria-label={`Pagamento da sessão de ${s.patients?.full_name ?? 'paciente'} em ${formatarData(new Date(s.starts_at))}`}
                    >
                      {s.payment_status === 'pago' ? 'Editar' : 'Registrar pagamento'}
                    </Botao>
                  </li>
                ))}
              </ul>
            )}
            {dados.recebidas.some((r) => !dados.sessoes.some((s) => s.id === r.id)) ? (
              <p className="text-[13px] text-muted">
                O “Recebido” inclui pagamentos feitos neste mês por sessões de outros meses.
              </p>
            ) : null}
          </section>

          <section aria-labelledby="titulo-despesas" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="titulo-despesas" className="text-lg font-bold">
                Despesas
              </h2>
              <Botao variante="secundario" onClick={() => setNovaDespesa(true)}>
                Lançar despesa
              </Botao>
            </div>
            {dados.despesas.length === 0 ? (
              <Vazio titulo="Nenhuma despesa neste mês." detalhe="Aluguel, CRP, supervisão e material podem ser deduzidos no livro-caixa." />
            ) : (
              <ul className="flex flex-col divide-y divide-border-soft rounded-card border border-border bg-surface">
                {dados.despesas.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-semibold">{ROTULO_CATEGORIA[d.category as CategoriaDespesa]}</span>
                      <span className="text-[13px] text-muted">
                        {formatarData(d.spent_on)}
                        {d.description ? ` · ${d.description}` : ''}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums">{emReais(d.amount)}</span>
                    <Botao
                      variante="secundario"
                      onClick={() => void remover(d.id)}
                      aria-label={`Remover despesa de ${ROTULO_CATEGORIA[d.category as CategoriaDespesa]} de ${formatarData(d.spent_on)}`}
                    >
                      Remover
                    </Botao>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}

      {fiscais.carregando ? null : (
        <DadosFiscaisForm key={fiscais.dados?.updated_at ?? 'novo'} atuais={fiscais.dados} aoSalvar={fiscais.recarregar} />
      )}

      <p className="text-[13px] text-muted">
        Quer ajuda com impostos? Em <Link to="/meu-contador">Contador</Link> você encontra um contador e escolhe o que ele pode ver.
      </p>

      {pagando ? (
        <DialogoPagamento
          sessao={pagando}
          aoFechar={() => setPagando(null)}
          aoSalvar={() => {
            setPagando(null)
            consulta.recarregar()
          }}
        />
      ) : null}
      {novaDespesa ? (
        <DialogoDespesa
          mes={mes}
          aoFechar={() => setNovaDespesa(false)}
          aoSalvar={() => {
            setNovaDespesa(false)
            consulta.recarregar()
          }}
        />
      ) : null}
    </>
  )
}

function DialogoPagamento({
  sessao,
  aoFechar,
  aoSalvar,
}: {
  sessao: SessaoFinanceira
  aoFechar: () => void
  aoSalvar: () => void
}) {
  const [situacao, setSituacao] = useState<SituacaoPagamento>(
    sessao.payment_status === 'a_receber' ? 'pago' : (sessao.payment_status as SituacaoPagamento),
  )
  const [pagoEm, setPagoEm] = useState(sessao.paid_on ?? paraDataISO(new Date()))
  const [forma, setForma] = useState<FormaPagamento>((sessao.payment_method as FormaPagamento) ?? 'pix')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (situacao === 'pago' && !lerDataISO(pagoEm)) {
      setErro('Informe a data do pagamento.')
      return
    }
    setEnviando(true)
    const r = await registrarPagamento(sessao.id, { situacao, pagoEm, forma })
    setEnviando(false)
    if (r.erro) setErro(r.erro)
    else aoSalvar()
  }

  return (
    <Dialogo aberto titulo="Pagamento da sessão" aoFechar={aoFechar}>
      <form noValidate onSubmit={salvar} className="flex flex-col gap-4">
        <p className="text-[15px] text-ink-2">
          {sessao.patients?.full_name} · {formatarData(new Date(sessao.starts_at))}
          {sessao.fee !== null ? ` · ${emReais(sessao.fee)}` : ''}
        </p>
        {sessao.fee === null ? (
          <Aviso tom="info">Esta sessão está sem valor. Edite a sessão na agenda para informar quanto custa.</Aviso>
        ) : null}
        {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
        <CampoSelecao
          rotulo="Situação"
          name="situacao"
          opcoes={(Object.keys(ROTULO_PAGAMENTO) as SituacaoPagamento[]).map((p) => ({ valor: p, rotulo: ROTULO_PAGAMENTO[p] }))}
          value={situacao}
          onChange={(e) => setSituacao(e.target.value as SituacaoPagamento)}
        />
        {situacao === 'pago' ? (
          <>
            <CampoTexto rotulo="Pago em" type="date" name="pago-em" value={pagoEm} onChange={(e) => setPagoEm(e.target.value)} />
            <CampoSelecao
              rotulo="Forma"
              name="forma"
              opcoes={OPCOES_FORMA}
              value={forma}
              onChange={(e) => setForma(e.target.value as FormaPagamento)}
            />
          </>
        ) : null}
        <div className="flex flex-col gap-2">
          <Botao type="submit" carregando={enviando} textoCarregando="Salvando…">
            Salvar pagamento
          </Botao>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
        </div>
      </form>
    </Dialogo>
  )
}

function DialogoDespesa({ mes, aoFechar, aoSalvar }: { mes: Date; aoFechar: () => void; aoSalvar: () => void }) {
  const hoje = new Date()
  const padrao = chaveDoMes(hoje) === chaveDoMes(mes) ? hoje : mes
  const [data, setData] = useState(paraDataISO(padrao))
  const [categoria, setCategoria] = useState<CategoriaDespesa>('aluguel')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [erros, setErros] = useState<{ data?: string | null; valor?: string | null }>({})
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const numero = lerReais(valor)
    const novos = {
      data: lerDataISO(data) ? null : 'Informe a data.',
      valor: numero && numero > 0 ? null : 'Informe o valor, como 900 ou 900,00.',
    }
    setErros(novos)
    if (novos.data || novos.valor || !numero) return
    setEnviando(true)
    const r = await lancarDespesa({ data, categoria, descricao: descricao.trim() || null, valor: numero })
    setEnviando(false)
    if (r.erro) setErro(r.erro)
    else aoSalvar()
  }

  return (
    <Dialogo aberto titulo="Lançar despesa" aoFechar={aoFechar}>
      <form noValidate onSubmit={salvar} className="flex flex-col gap-4">
        {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
        <CampoTexto rotulo="Data" type="date" name="data" value={data} onChange={(e) => setData(e.target.value)} erro={erros.data} />
        <CampoSelecao
          rotulo="Categoria"
          name="categoria"
          opcoes={OPCOES_CATEGORIA}
          value={categoria}
          onChange={(e) => setCategoria(e.target.value as CategoriaDespesa)}
        />
        <CampoTexto
          rotulo="Descrição"
          opcional
          name="descricao"
          maxLength={200}
          autoComplete="off"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
        <CampoTexto
          rotulo="Valor (R$)"
          name="valor"
          inputMode="decimal"
          autoComplete="off"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          erro={erros.valor}
        />
        <div className="flex flex-col gap-2">
          <Botao type="submit" carregando={enviando} textoCarregando="Salvando…">
            Lançar despesa
          </Botao>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
        </div>
      </form>
    </Dialogo>
  )
}

function DadosFiscaisForm({ atuais, aoSalvar }: { atuais: DadosFiscais | null; aoSalvar: () => void }) {
  const [regime, setRegime] = useState<'pessoa_fisica' | 'simples_nacional'>(
    (atuais?.regime as 'pessoa_fisica' | 'simples_nacional') ?? 'pessoa_fisica',
  )
  const [folha, setFolha] = useState(paraCampoReais(atuais?.monthly_payroll))
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [enviando, setEnviando] = useState(false)

  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSalvo(false)
    if (folha.trim() && lerReais(folha) === null) {
      setErro('Use só números no pró-labore, como 1518 ou 1.518,00.')
      return
    }
    setErro(null)
    setEnviando(true)
    const r = await salvarDadosFiscais(
      { regime, folhaMensal: regime === 'simples_nacional' ? lerReais(folha) : null },
      Boolean(atuais),
    )
    setEnviando(false)
    if (r.erro) setErro(r.erro)
    else {
      setSalvo(true)
      aoSalvar()
    }
  }

  return (
    <form
      noValidate
      onSubmit={salvar}
      aria-labelledby="titulo-dados-fiscais"
      className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 id="titulo-dados-fiscais" className="text-lg font-bold">
          Como você recebe
        </h2>
        <p className="text-sm text-muted">Ajuda seu contador a calcular os impostos.</p>
      </div>
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {salvo ? <Aviso tom="sucesso">Dados salvos.</Aviso> : null}
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-semibold text-ink-2">Regime</legend>
        <div className="flex flex-wrap gap-x-6">
          {(
            [
              ['pessoa_fisica', 'Pessoa física (carnê-leão)'],
              ['simples_nacional', 'CNPJ no Simples Nacional'],
            ] as const
          ).map(([valor, rotulo]) => (
            <label key={valor} className="flex min-h-11 items-center gap-2.5 text-[15px] text-ink-2">
              <input
                type="radio"
                name="regime"
                checked={regime === valor}
                onChange={() => setRegime(valor)}
                className="size-5 accent-pine"
              />
              {rotulo}
            </label>
          ))}
        </div>
      </fieldset>
      {regime === 'simples_nacional' ? (
        <CampoTexto
          rotulo="Pró-labore e folha por mês (R$)"
          opcional
          name="folha"
          inputMode="decimal"
          autoComplete="off"
          value={folha}
          onChange={(e) => setFolha(e.target.value)}
          ajuda="Usado só para estimar o Fator R (Anexo III ou V)."
          className="max-w-xs"
        />
      ) : null}
      <Botao type="submit" variante="secundario" className="w-fit" carregando={enviando} textoCarregando="Salvando…">
        Salvar
      </Botao>
    </form>
  )
}
