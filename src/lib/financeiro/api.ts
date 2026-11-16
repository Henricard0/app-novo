// Financeiro do psicólogo: valores das sessões, pagamentos, despesas e dados fiscais.
// Só o dono acessa (RLS). O contador lê por funções próprias (src/lib/contador/api.ts).

import { traduzirErroBanco } from '@/lib/consultorio/erros'
import type { Resposta } from '@/lib/consultorio/useConsulta'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'
import { somarMeses, type CategoriaDespesa, type FormaPagamento, type SituacaoPagamento } from './formato'

export type Despesa = Tables<'expenses'>
export type DadosFiscais = Tables<'fiscal_profiles'>
export type SessaoFinanceira = Pick<
  Tables<'appointments'>,
  'id' | 'starts_at' | 'status' | 'fee' | 'payment_status' | 'paid_on' | 'payment_method'
> & { patients: { full_name: string } | null }

type Resultado = { erro: string | null }

function paraISO(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

export type MesFinanceiro = {
  /** Sessões do mês (pela data da sessão), sem as canceladas. */
  sessoes: SessaoFinanceira[]
  /** Sessões pagas dentro do mês (regime de caixa), mesmo que de outro mês. */
  recebidas: SessaoFinanceira[]
  despesas: Despesa[]
}

export async function buscarMes(mes: Date): Promise<Resposta<MesFinanceiro>> {
  const inicio = mes
  const fim = somarMeses(mes, 1)
  const campos = 'id, starts_at, status, fee, payment_status, paid_on, payment_method, patients(full_name)'
  const [sessoes, recebidas, despesas] = await Promise.all([
    supabase
      .from('appointments')
      .select(campos)
      .neq('status', 'cancelada')
      .gte('starts_at', inicio.toISOString())
      .lt('starts_at', fim.toISOString())
      .order('starts_at'),
    supabase
      .from('appointments')
      .select(campos)
      .eq('payment_status', 'pago')
      .gte('paid_on', paraISO(inicio))
      .lt('paid_on', paraISO(fim))
      .order('paid_on'),
    supabase.from('expenses').select('*').gte('spent_on', paraISO(inicio)).lt('spent_on', paraISO(fim)).order('spent_on'),
  ])
  const erro = sessoes.error ?? recebidas.error ?? despesas.error
  if (erro) return { dados: null, erro: traduzirErroBanco(erro) }
  return { dados: { sessoes: sessoes.data ?? [], recebidas: recebidas.data ?? [], despesas: despesas.data ?? [] }, erro: null }
}

export type DadosPagamento = {
  situacao: SituacaoPagamento
  /** AAAA-MM-DD; obrigatório quando pago. */
  pagoEm: string | null
  forma: FormaPagamento | null
}

export async function registrarPagamento(sessaoId: string, dados: DadosPagamento): Promise<Resultado> {
  const pago = dados.situacao === 'pago'
  const { error } = await supabase
    .from('appointments')
    .update({
      payment_status: dados.situacao,
      paid_on: pago ? dados.pagoEm : null,
      payment_method: pago ? dados.forma : null,
    })
    .eq('id', sessaoId)
  return { erro: error ? traduzirErroBanco(error) : null }
}

export type DadosDespesa = { data: string; categoria: CategoriaDespesa; descricao: string | null; valor: number }

export async function lancarDespesa(dados: DadosDespesa): Promise<Resultado> {
  const { error } = await supabase.from('expenses').insert({
    spent_on: dados.data,
    category: dados.categoria,
    description: dados.descricao,
    amount: dados.valor,
  })
  return { erro: error ? traduzirErroBanco(error) : null }
}

export async function removerDespesa(id: string): Promise<Resultado> {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  return { erro: error ? traduzirErroBanco(error) : null }
}

export async function buscarDadosFiscais(): Promise<Resposta<DadosFiscais | null>> {
  const { data, error } = await supabase.from('fiscal_profiles').select('*').maybeSingle()
  return error ? { dados: null, erro: traduzirErroBanco(error) } : { dados: data, erro: null }
}

export async function salvarDadosFiscais(
  dados: { regime: 'pessoa_fisica' | 'simples_nacional'; folhaMensal: number | null },
  existe: boolean,
): Promise<Resultado> {
  const linha = { regime: dados.regime, monthly_payroll: dados.folhaMensal }
  const { error } = existe
    ? await supabase.from('fiscal_profiles').update(linha).not('owner_id', 'is', null)
    : await supabase.from('fiscal_profiles').insert(linha)
  return { erro: error ? traduzirErroBanco(error) : null }
}

/** Soma os valores (ignora nulos). */
export function somar<T>(itens: T[], valor: (item: T) => number | null | undefined): number {
  return itens.reduce((total, item) => total + Number(valor(item) ?? 0), 0)
}

export type ResumoMes = { recebido: number; aReceber: number; despesas: number; saldo: number }

export function resumirMes(mes: MesFinanceiro, agora: Date = new Date()): ResumoMes {
  const recebido = somar(mes.recebidas, (s) => s.fee)
  // A receber: sessões que já aconteceram (realizadas ou faltas) e não foram pagas.
  const aReceber = somar(
    mes.sessoes.filter(
      (s) => s.payment_status === 'a_receber' && (s.status === 'realizada' || s.status === 'faltou') && new Date(s.starts_at) <= agora,
    ),
    (s) => s.fee,
  )
  const despesas = somar(mes.despesas, (d) => d.amount)
  return { recebido, aReceber, despesas, saldo: recebido - despesas }
}
