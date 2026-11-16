// Planos e assinatura (Fase 3). O preço é calculado no servidor; aqui só para mostrar.
import { traduzirErroBanco } from '@/lib/consultorio/erros'
import type { Resposta } from '@/lib/consultorio/useConsulta'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

export const PRECO_MENSAL = 38.3
export const PRECO_ANUAL = 383
export const LIMITE_GRATUITO = 10

export type Plano = 'gratuito' | 'teste' | 'essencial'
export type MeuPlano = { plano: Plano; trial_ends_at: string | null; pacientes_ativos: number; limite_pacientes: number | null }
export type Assinatura = Tables<'subscriptions'>

const MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export function emReais(valor: number): string {
  return MOEDA.format(valor)
}

export async function buscarMeuPlano(): Promise<Resposta<MeuPlano>> {
  const { data, error } = await supabase.rpc('meu_plano')
  if (error) return { dados: null, erro: traduzirErroBanco(error) }
  const linha = data?.[0]
  if (!linha) return { dados: null, erro: 'Não foi possível ler seu plano.' }
  return { dados: { ...linha, plano: linha.plano as Plano }, erro: null }
}

export async function listarAssinaturas(): Promise<Resposta<Assinatura[]>> {
  const { data, error } = await supabase.from('subscriptions').select('*').order('created_at', { ascending: false })
  return error ? { dados: null, erro: traduzirErroBanco(error) } : { dados: data, erro: null }
}

async function chamarAssinatura<T>(corpo: Record<string, unknown>): Promise<{ erro: string | null; dados: T | null }> {
  const { data, error } = await supabase.functions.invoke('assinatura', { body: corpo })
  if (error) {
    // O corpo da resposta de erro traz a mensagem em português.
    const contexto = (error as { context?: Response }).context
    try {
      const json = contexto ? await contexto.json() : null
      return { erro: json?.erro ?? 'Não foi possível falar com o servidor de pagamentos.', dados: null }
    } catch {
      return { erro: 'Não foi possível falar com o servidor de pagamentos.', dados: null }
    }
  }
  return { erro: null, dados: data as T }
}

/** Cria a assinatura e devolve a página de pagamento do Mercado Pago. */
export function iniciarAssinatura(ciclo: 'mensal' | 'anual', recemFormado: boolean) {
  return chamarAssinatura<{ url: string }>({
    acao: 'criar',
    ciclo,
    recemFormado,
    retorno: `${window.location.origin}/planos?retorno=1`,
  })
}

export function sincronizarAssinatura() {
  return chamarAssinatura<{ situacao: string | null }>({ acao: 'sincronizar' })
}

export function cancelarAssinatura() {
  return chamarAssinatura<{ situacao: string | null }>({ acao: 'cancelar' })
}

/** Dias que faltam no teste grátis (0 se acabou). */
export function diasDeTeste(fim: string | null, agora: Date = new Date()): number {
  if (!fim) return 0
  return Math.max(0, Math.ceil((new Date(fim).getTime() - agora.getTime()) / 864e5))
}
