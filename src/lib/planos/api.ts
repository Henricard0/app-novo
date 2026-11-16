// Planos e assinatura (Fase 3). O preço é calculado no servidor; aqui só para mostrar.
import { traduzirErroBanco } from '@/lib/consultorio/erros'
import type { Resposta } from '@/lib/consultorio/useConsulta'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

export type PlanoPago = 'basico' | 'essencial' | 'profissional'
export type Plano = 'gratuito' | 'teste' | PlanoPago

export const LIMITE_GRATUITO = 10

/** Preços e recursos de cada plano pago (o servidor recalcula o preço; aqui é só para mostrar). */
export const PLANOS_PAGOS: ReadonlyArray<{
  id: PlanoPago
  nome: string
  mensal: number
  anual: number
  resumo: string
  recursos: string[]
}> = [
  {
    id: 'basico',
    nome: 'Básico',
    mensal: 29.9,
    anual: 299,
    resumo: 'Para quem está crescendo o consultório.',
    recursos: ['Tudo do Gratuito', 'Até 30 pacientes ativos'],
  },
  {
    id: 'essencial',
    nome: 'Essencial',
    mensal: 39.9,
    anual: 399,
    resumo: 'O consultório completo, sem limites.',
    recursos: ['Tudo do Básico', 'Pacientes ilimitados', 'Contador: rede de contadores, guias e pedidos', 'Emissão de NFS-e (em breve)'],
  },
  {
    id: 'profissional',
    nome: 'Profissional',
    mensal: 49.9,
    anual: 499,
    resumo: 'Para quem quer o consultório inteiro num lugar só.',
    recursos: ['Tudo do Essencial', 'Financeiro e recibos (em breve)', 'Declarações em PDF e assinatura digital (em breve)'],
  },
]

export const NOME_DO_PLANO: Record<Plano, string> = {
  gratuito: 'Gratuito',
  teste: 'Teste grátis do Profissional',
  basico: 'Básico',
  essencial: 'Essencial',
  profissional: 'Profissional',
}
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
export function iniciarAssinatura(plano: PlanoPago, ciclo: 'mensal' | 'anual', recemFormado: boolean) {
  return chamarAssinatura<{ url: string }>({
    acao: 'criar',
    plano,
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
