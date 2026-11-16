import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Aviso } from '@/components/ui/Aviso'
import { Botao } from '@/components/ui/Botao'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { CampoAreaTexto } from '@/components/ui/CampoAreaTexto'
import { CampoSelecao } from '@/components/ui/CampoSelecao'
import { CampoTexto } from '@/components/ui/CampoTexto'
import { Cartao } from '@/components/ui/Cartao'
import { Dialogo } from '@/components/ui/Dialogo'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { TelaCarregando } from '@/components/ui/TelaCarregando'
import { Vazio } from '@/components/ui/Vazio'
import {
  criarPendencia,
  despesasDoMes,
  encerrarVinculoContador,
  enviarGuia,
  guiasEPendenciasDoCliente,
  lancamentosDoMes,
  listarClientes,
  removerGuia,
  resumoDoAno,
  type DespesaCliente,
  type Lancamento,
} from '@/lib/contador/api'
import { baixarCsv, montarCsv } from '@/lib/contador/csv'
import { formatarData } from '@/lib/consultorio/formato'
import { useConsulta } from '@/lib/consultorio/useConsulta'
import { formatarCrp } from '@/lib/crp'
import {
  ROTULO_CATEGORIA,
  ROTULO_FORMA,
  emReais,
  fatorR,
  formatarCpf,
  lerReais,
  nomeDoMes,
  type CategoriaDespesa,
  type FormaPagamento,
} from '@/lib/financeiro/formato'
import { useTituloPagina } from '@/lib/titulo'

const TIPOS_GUIA = [
  { valor: 'das', rotulo: 'DAS (Simples Nacional)' },
  { valor: 'darf', rotulo: 'DARF (carnê-leão)' },
  { valor: 'outro', rotulo: 'Outro documento' },
]

function dataDoMes(iso: string): Date {
  return new Date(`${iso}T12:00:00`)
}

/** /contador/clientes/:id — o que o psicólogo liberou, guias e pedidos. */
export function ClienteContador() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const anoAtual = new Date().getFullYear()
  const [ano, setAno] = useState(anoAtual)
  const clientes = useConsulta('clientes-contador', listarClientes)
  const cliente = (clientes.dados ?? []).find((c) => c.psychologist_id === id) ?? null
  const podeTotais = Boolean(cliente?.share_totals && cliente.plano_ok)
  const resumo = useConsulta(`resumo:${id}:${ano}:${podeTotais}`, () =>
    podeTotais ? resumoDoAno(id, ano) : Promise.resolve({ dados: null, erro: null }),
  )
  const docs = useConsulta(`docs-cliente:${id}:${Boolean(cliente)}`, () =>
    cliente ? guiasEPendenciasDoCliente(id) : Promise.resolve({ dados: null, erro: null }),
  )
  const [detalhe, setDetalhe] = useState<{ mes: string; lancamentos: Lancamento[] | null; despesas: DespesaCliente[] | null } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [encerrando, setEncerrando] = useState(false)
  useTituloPagina(cliente?.full_name ?? 'Cliente')

  if (clientes.carregando) return <TelaCarregando />
  const voltar = { para: '/contador', rotulo: 'Clientes' }
  if (!cliente) {
    return (
      <>
        <Cabecalho titulo="Cliente" voltar={voltar} />
        <Aviso tom="erro">{clientes.erro ?? 'Este psicólogo não está entre os seus clientes.'}</Aviso>
      </>
    )
  }

  const meses = resumo.dados ?? []
  const fator = cliente.regime === 'simples_nacional' ? fatorR(cliente.monthly_payroll, cliente.receita_12_meses) : null

  async function verMes(mes: string) {
    setErro(null)
    const [l, d] = await Promise.all([
      cliente?.share_entries ? lancamentosDoMes(id, mes) : Promise.resolve({ dados: null, erro: null }),
      cliente?.share_expenses ? despesasDoMes(id, mes) : Promise.resolve({ dados: null, erro: null }),
    ])
    if (l.erro || d.erro) setErro(l.erro ?? d.erro)
    setDetalhe({ mes, lancamentos: l.dados, despesas: d.dados })
  }

  function exportarAno() {
    const csv = montarCsv(
      ['Mês', 'Recebido', 'Sessões pagas', 'A receber', 'Despesas'],
      meses.map((m) => [m.mes.slice(0, 7), Number(m.recebido), m.sessoes_pagas, Number(m.a_receber), m.despesas === null ? null : Number(m.despesas)]),
    )
    baixarCsv(`triade-totais-${ano}.csv`, csv)
  }

  function exportarMes() {
    if (!detalhe) return
    const linhas = [
      ...(detalhe.lancamentos ?? []).map((l) => [
        'Receita',
        l.pago_em,
        Number(l.valor),
        l.forma ? ROTULO_FORMA[l.forma as FormaPagamento] : '',
        l.pagador_nome,
        l.pagador_cpf ? formatarCpf(l.pagador_cpf) : '',
      ]),
      ...(detalhe.despesas ?? []).map((d) => [
        'Despesa',
        d.data,
        Number(d.valor),
        ROTULO_CATEGORIA[d.categoria as CategoriaDespesa] ?? d.categoria,
        d.descricao ?? '',
        '',
      ]),
    ]
    baixarCsv(`triade-${detalhe.mes.slice(0, 7)}.csv`, montarCsv(['Tipo', 'Data', 'Valor', 'Forma/Categoria', 'Pagador/Descrição', 'CPF'], linhas))
  }

  async function encerrar() {
    const r = await encerrarVinculoContador(cliente!.link_id)
    if (r.erro) {
      setErro(r.erro)
      setEncerrando(false)
      return
    }
    navigate('/contador', { replace: true })
  }

  return (
    <>
      <Cabecalho
        titulo={cliente.full_name}
        voltar={voltar}
        subtitulo={[
          formatarCrp(cliente.crp_region, cliente.crp_number),
          cliente.regime === 'simples_nacional' ? 'CNPJ no Simples Nacional' : cliente.regime === 'pessoa_fisica' ? 'Pessoa física (carnê-leão)' : null,
          `cliente desde ${formatarData(new Date(cliente.since))}`,
        ]
          .filter(Boolean)
          .join(' · ')}
      />
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {!cliente.plano_ok ? (
        <Aviso tom="info">O plano deste psicólogo não inclui contador agora. Os dados voltam a aparecer quando ele mudar de plano.</Aviso>
      ) : null}

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[2_1_480px] flex-col gap-6">
          <section aria-labelledby="titulo-totais" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="titulo-totais" className="text-lg font-bold">
                Totais por mês
              </h2>
              <div className="flex flex-wrap items-end gap-2">
                <CampoSelecao
                  rotulo="Ano"
                  name="ano"
                  opcoes={[anoAtual, anoAtual - 1, anoAtual - 2].map((a) => ({ valor: String(a), rotulo: String(a) }))}
                  value={String(ano)}
                  onChange={(e) => {
                    setAno(Number(e.target.value))
                    setDetalhe(null)
                  }}
                />
                {meses.length ? (
                  <Botao variante="secundario" onClick={exportarAno}>
                    Exportar CSV
                  </Botao>
                ) : null}
              </div>
            </div>
            {!cliente.share_totals ? (
              <Vazio titulo="Os totais não estão liberados." detalhe="Peça ao psicólogo para liberar “Totais do mês” na tela Contador dele." />
            ) : resumo.carregando ? (
              <TelaCarregando />
            ) : resumo.erro ? (
              <Aviso tom="erro">{resumo.erro}</Aviso>
            ) : meses.length ? (
              <div className="overflow-x-auto rounded-card border border-border bg-surface">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <caption className="sr-only">Totais de {ano}, pelo dia do pagamento</caption>
                  <thead className="border-b border-border text-ink-2">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">Mês</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Recebido</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Sessões pagas</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">A receber</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Despesas</th>
                      <th scope="col" className="px-4 py-3"><span className="sr-only">Detalhes</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-soft">
                    {meses.map((m) => (
                      <tr key={m.mes}>
                        <th scope="row" className="px-4 py-2 font-medium capitalize">
                          {nomeDoMes(dataDoMes(m.mes)).replace(/ de \d{4}$/, '')}
                        </th>
                        <td className="px-4 py-2 text-right tabular-nums">{emReais(m.recebido)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{m.sessoes_pagas}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{emReais(m.a_receber)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{m.despesas === null ? '—' : emReais(m.despesas)}</td>
                        <td className="px-2 py-1 text-right">
                          {cliente.share_entries || cliente.share_expenses ? (
                            <Botao
                              variante="secundario"
                              onClick={() => void verMes(m.mes)}
                              aria-label={`Ver detalhes de ${nomeDoMes(dataDoMes(m.mes))}`}
                            >
                              Detalhes
                            </Botao>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {cliente.share_totals && cliente.share_expenses === false ? (
              <p className="text-[13px] text-muted">As despesas não foram liberadas por este psicólogo.</p>
            ) : null}
          </section>

          {detalhe ? (
            <section aria-labelledby="titulo-detalhe" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="titulo-detalhe" className="text-lg font-bold first-letter:uppercase">
                  {nomeDoMes(dataDoMes(detalhe.mes))}
                </h2>
                <Botao variante="secundario" onClick={exportarMes}>
                  Exportar mês em CSV
                </Botao>
              </div>
              {detalhe.lancamentos ? (
                detalhe.lancamentos.length ? (
                  <ul className="flex flex-col divide-y divide-border-soft rounded-card border border-border bg-surface">
                    {detalhe.lancamentos.map((l, i) => (
                      <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm">
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="font-semibold break-words">{l.pagador_nome}</span>
                          <span className="text-muted">
                            {[formatarData(l.pago_em), l.forma ? ROTULO_FORMA[l.forma as FormaPagamento] : null, l.pagador_cpf ? `CPF ${formatarCpf(l.pagador_cpf)}` : 'sem CPF']
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>
                        <span className="font-semibold tabular-nums">{emReais(l.valor)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">Nenhum pagamento recebido neste mês.</p>
                )
              ) : (
                <p className="text-sm text-muted">Os lançamentos detalhados não foram liberados.</p>
              )}
              {detalhe.despesas ? (
                detalhe.despesas.length ? (
                  <ul className="flex flex-col divide-y divide-border-soft rounded-card border border-border bg-surface">
                    {detalhe.despesas.map((d, i) => (
                      <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm">
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="font-semibold">{ROTULO_CATEGORIA[d.categoria as CategoriaDespesa] ?? d.categoria}</span>
                          <span className="text-muted">
                            {formatarData(d.data)}
                            {d.descricao ? ` · ${d.descricao}` : ''}
                          </span>
                        </span>
                        <span className="font-semibold tabular-nums">{emReais(d.valor)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">Nenhuma despesa neste mês.</p>
                )
              ) : null}
            </section>
          ) : null}

          <FormGuia psicologoId={id} aoEnviar={docs.recarregar} />
        </div>

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-6">
          {cliente.regime === 'simples_nacional' && cliente.share_totals ? (
            <Cartao titulo="Fator R (estimativa)">
              {fator === null ? (
                <p className="text-sm text-muted">O psicólogo ainda não informou o pró-labore, ou não há receita nos últimos 12 meses.</p>
              ) : (
                <div className="flex flex-col gap-1 text-sm">
                  <p className="text-[22px] font-bold">{(fator * 100).toFixed(1).replace('.', ',')}%</p>
                  <p className="text-muted">
                    {fator >= 0.28 ? 'Acima de 28%: tende ao Anexo III.' : 'Abaixo de 28%: tende ao Anexo V.'} Receita de 12 meses:{' '}
                    {emReais(cliente.receita_12_meses)}. Pró-labore informado: {emReais(cliente.monthly_payroll)} por mês.
                  </p>
                </div>
              )}
            </Cartao>
          ) : null}

          <Cartao titulo="Guias enviadas">
            {docs.dados?.guias.length ? (
              <ul className="flex flex-col gap-3 text-sm">
                {docs.dados.guias.map((g) => (
                  <li key={g.id} className="flex flex-col gap-1">
                    <span className="font-semibold break-words">{g.title}</span>
                    <span className="text-muted">
                      {[g.due_on ? `vence em ${formatarData(g.due_on)}` : null, g.amount !== null ? emReais(g.amount) : null].filter(Boolean).join(' · ')}
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      <Etiqueta tom={g.paid_on ? 'ok' : 'neutro'}>{g.paid_on ? 'Paga' : 'A pagar'}</Etiqueta>
                      {g.paid_on ? null : (
                        <Botao
                          variante="secundario"
                          onClick={async () => {
                            const r = await removerGuia(g.id)
                            if (r.erro) setErro(r.erro)
                            docs.recarregar()
                          }}
                          aria-label={`Remover guia: ${g.title}`}
                        >
                          Remover
                        </Botao>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Nenhuma guia enviada ainda.</p>
            )}
          </Cartao>

          <Pendencias psicologoId={id} pendencias={docs.dados?.pendencias ?? []} aoCriar={docs.recarregar} />

          <Botao variante="secundario" onClick={() => setEncerrando(true)}>
            Encerrar atendimento
          </Botao>
        </div>
      </div>

      <Dialogo aberto={encerrando} titulo="Encerrar o atendimento?" aoFechar={() => setEncerrando(false)}>
        <p className="text-[15px] text-ink-2">Você deixa de ver os dados deste psicólogo na hora. As guias enviadas continuam com ele.</p>
        <div className="flex flex-col gap-2">
          <Botao className="bg-danger hover:bg-danger" onClick={() => void encerrar()}>
            Encerrar atendimento
          </Botao>
          <Botao variante="secundario" onClick={() => setEncerrando(false)}>
            Voltar
          </Botao>
        </div>
      </Dialogo>
    </>
  )
}

function FormGuia({ psicologoId, aoEnviar }: { psicologoId: string; aoEnviar: () => void }) {
  const hoje = new Date()
  const mesPassado = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
  const [tipo, setTipo] = useState<'das' | 'darf' | 'outro'>('das')
  const [titulo, setTitulo] = useState('')
  const [competencia, setCompetencia] = useState(
    `${mesPassado.getFullYear()}-${String(mesPassado.getMonth() + 1).padStart(2, '0')}`,
  )
  const [vencimento, setVencimento] = useState('')
  const [valor, setValor] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [chaveArquivo, setChaveArquivo] = useState(0)
  const [erros, setErros] = useState<Partial<Record<'competencia' | 'valor' | 'arquivo', string | null>>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSucesso(false)
    const novos = {
      competencia: /^\d{4}-\d{2}$/.test(competencia) ? null : 'Informe o mês de competência.',
      valor: valor.trim() && lerReais(valor) === null ? 'Use só números, como 120,50.' : null,
      arquivo: arquivo ? null : 'Escolha o PDF da guia.',
    }
    setErros(novos)
    setErro(null)
    if (Object.values(novos).some(Boolean) || !arquivo) return
    setEnviando(true)
    const tituloPadrao = `${TIPOS_GUIA.find((t) => t.valor === tipo)?.rotulo.split(' ')[0] ?? 'Guia'} ${nomeDoMes(new Date(`${competencia}-01T12:00:00`))}`
    const r = await enviarGuia(psicologoId, {
      tipo,
      titulo: titulo.trim() || tituloPadrao,
      competencia: `${competencia}-01`,
      vencimento: vencimento || null,
      valor: lerReais(valor),
      arquivo,
    })
    setEnviando(false)
    if (r.erro) {
      setErro(r.erro)
      return
    }
    setTitulo('')
    setValor('')
    setVencimento('')
    setArquivo(null)
    setChaveArquivo((k) => k + 1)
    setSucesso(true)
    aoEnviar()
  }

  return (
    <form
      noValidate
      onSubmit={enviar}
      aria-labelledby="titulo-enviar-guia"
      className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 id="titulo-enviar-guia" className="text-lg font-bold">
          Enviar guia
        </h2>
        <p className="text-sm text-muted">O psicólogo recebe o aviso no menu e vê o vencimento.</p>
      </div>
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {sucesso ? <Aviso tom="sucesso">Guia enviada.</Aviso> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CampoSelecao
          rotulo="Tipo"
          name="tipo"
          opcoes={TIPOS_GUIA}
          value={tipo}
          onChange={(e) => setTipo(e.target.value as 'das' | 'darf' | 'outro')}
        />
        <CampoTexto
          rotulo="Competência"
          type="month"
          name="competencia"
          value={competencia}
          onChange={(e) => setCompetencia(e.target.value)}
          erro={erros.competencia}
        />
        <CampoTexto
          rotulo="Vencimento"
          opcional
          type="date"
          name="vencimento"
          value={vencimento}
          onChange={(e) => setVencimento(e.target.value)}
        />
        <CampoTexto
          rotulo="Valor (R$)"
          opcional
          name="valor-guia"
          inputMode="decimal"
          autoComplete="off"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          erro={erros.valor}
        />
      </div>
      <CampoTexto
        rotulo="Título"
        opcional
        name="titulo"
        maxLength={150}
        autoComplete="off"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        ajuda="Se ficar em branco, usamos o tipo e o mês."
      />
      <CampoTexto
        key={chaveArquivo}
        rotulo="Arquivo PDF"
        type="file"
        name="arquivo"
        accept="application/pdf"
        onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
        erro={erros.arquivo}
        ajuda="Até 10 MB."
      />
      <Botao type="submit" className="w-fit" carregando={enviando} textoCarregando="Enviando…">
        Enviar guia
      </Botao>
    </form>
  )
}

function Pendencias({
  psicologoId,
  pendencias,
  aoCriar,
}: {
  psicologoId: string
  pendencias: { id: string; body: string; created_at: string; resolved_at: string | null }[]
  aoCriar: () => void
}) {
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function criar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!texto.trim()) {
      setErro('Escreva o que você precisa.')
      return
    }
    setErro(null)
    setEnviando(true)
    const r = await criarPendencia(psicologoId, texto.trim())
    setEnviando(false)
    if (r.erro) setErro(r.erro)
    else {
      setTexto('')
      aoCriar()
    }
  }

  return (
    <Cartao titulo="Pedidos ao psicólogo">
      <div className="flex flex-col gap-4">
        {pendencias.length ? (
          <ul className="flex flex-col gap-2 text-sm">
            {pendencias.map((p) => (
              <li key={p.id} className="flex flex-col gap-1">
                <span className="break-words text-ink-2">{p.body}</span>
                <span className="flex items-center gap-2 text-muted">
                  {formatarData(new Date(p.created_at))}
                  <Etiqueta tom={p.resolved_at ? 'ok' : 'atencao'}>{p.resolved_at ? 'Resolvido' : 'Aberto'}</Etiqueta>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <form noValidate onSubmit={criar} className="flex flex-col gap-3">
          {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
          <CampoAreaTexto
            rotulo="Novo pedido"
            name="pendencia"
            rows={3}
            maxLength={1000}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            ajuda="Ex.: envie o comprovante do aluguel de outubro."
          />
          <Botao type="submit" variante="secundario" className="w-fit" carregando={enviando} textoCarregando="Enviando…">
            Enviar pedido
          </Botao>
        </form>
      </div>
    </Cartao>
  )
}
