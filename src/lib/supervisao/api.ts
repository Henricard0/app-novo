// Rede de supervisores, solicitações, convites e vínculos (Fase 2a).
// Quem pode ver e fazer o quê é decidido no banco (RLS e funções).

import { traduzirErroBanco } from '@/lib/consultorio/erros'
import type { Resposta } from '@/lib/consultorio/useConsulta'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

export type PerfilSupervisor = Tables<'supervisor_profiles'>
export type PessoaResumo = { full_name: string; crp_region: string | null; crp_number: string | null }
export type SupervisorNaRede = PerfilSupervisor & { profiles: PessoaResumo | null }
export type Solicitacao = Tables<'supervision_requests'> & {
  solicitante: PessoaResumo | null
  supervisor: PessoaResumo | null
}
export type Vinculo = Tables<'supervision_links'> & {
  supervisor: PessoaResumo | null
  supervisionando: PessoaResumo | null
}
export type Convite = Tables<'supervision_invites'>

type Resultado = { erro: string | null }

function ok<T>(dados: T): Resposta<T> {
  return { dados, erro: null }
}
function falha<T>(erro: unknown): Resposta<T> {
  return { dados: null, erro: traduzirErroBanco(erro) }
}
function resultado(error: unknown): Resultado {
  return { erro: error ? traduzirErroBanco(error) : null }
}

const PESSOA = 'full_name, crp_region, crp_number'

// ---------------------------------------------------------------------------
// Meu perfil
// ---------------------------------------------------------------------------

export async function salvarDadosPessoais(
  id: string,
  dados: { nome: string; crpRegiao: string | null; crpNumero: string | null },
): Promise<Resultado> {
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: dados.nome, crp_region: dados.crpRegiao, crp_number: dados.crpNumero })
    .eq('id', id)
  return resultado(error)
}

export async function buscarMeuPerfilSupervisor(id: string): Promise<Resposta<PerfilSupervisor | null>> {
  const { data, error } = await supabase.from('supervisor_profiles').select('*').eq('id', id).maybeSingle()
  return error ? falha(error) : ok(data)
}

export type DadosPerfilSupervisor = Omit<PerfilSupervisor, 'id' | 'created_at' | 'updated_at'>

export async function salvarPerfilSupervisor(id: string, dados: DadosPerfilSupervisor, existe: boolean): Promise<Resultado> {
  const { error } = existe
    ? await supabase.from('supervisor_profiles').update(dados).eq('id', id)
    : await supabase.from('supervisor_profiles').insert({ ...dados, id })
  return resultado(error)
}

// ---------------------------------------------------------------------------
// Rede
// ---------------------------------------------------------------------------

export async function listarSupervisores(): Promise<Resposta<SupervisorNaRede[]>> {
  const { data, error } = await supabase
    .from('supervisor_profiles')
    .select(`*, profiles(${PESSOA})`)
    .eq('offers_supervision', true)
  if (error) return falha(error)
  return ok(
    data
      .filter((s) => s.profiles?.crp_number)
      .sort((a, b) => (a.profiles?.full_name ?? '').localeCompare(b.profiles?.full_name ?? '', 'pt-BR')),
  )
}

export async function buscarSupervisor(id: string): Promise<Resposta<SupervisorNaRede>> {
  const { data, error } = await supabase.from('supervisor_profiles').select(`*, profiles(${PESSOA})`).eq('id', id).maybeSingle()
  if (error) return falha(error)
  if (!data || !data.offers_supervision || !data.profiles?.crp_number) {
    return { dados: null, erro: 'Este perfil não está disponível na rede de supervisores.' }
  }
  return ok(data)
}

// ---------------------------------------------------------------------------
// Solicitações
// ---------------------------------------------------------------------------

export async function solicitarSupervisao(supervisorId: string, mensagem: string): Promise<Resultado> {
  const { error } = await supabase
    .from('supervision_requests')
    .insert({ supervisor_id: supervisorId, message: mensagem.trim() || null })
  if (error && (error as { code?: string }).code === '23505') {
    return { erro: 'Você já tem um pedido pendente para esta pessoa.' }
  }
  if (error && (error as { code?: string }).code === '42501') {
    return { erro: 'Esta pessoa não está aceitando novos supervisionandos no momento.' }
  }
  return resultado(error)
}

export async function listarSolicitacoes(): Promise<Resposta<Solicitacao[]>> {
  const { data, error } = await supabase
    .from('supervision_requests')
    .select(
      `*, solicitante:profiles!supervision_requests_requester_id_fkey(${PESSOA}), supervisor:profiles!supervision_requests_supervisor_id_fkey(${PESSOA})`,
    )
    .order('created_at', { ascending: false })
  return error ? falha(error) : ok(data)
}

export async function contarSolicitacoesRecebidas(meuId: string): Promise<Resposta<number>> {
  const { count, error } = await supabase
    .from('supervision_requests')
    .select('id', { count: 'exact', head: true })
    .eq('supervisor_id', meuId)
    .eq('status', 'pendente')
  return error ? falha(error) : ok(count ?? 0)
}

export async function responderSolicitacao(id: string, aceitar: boolean): Promise<Resultado> {
  const { error } = await supabase.rpc('responder_solicitacao', { p_id: id, p_aceitar: aceitar })
  return resultado(error)
}

export async function cancelarSolicitacao(id: string): Promise<Resultado> {
  const { error } = await supabase.rpc('cancelar_solicitacao', { p_id: id })
  return resultado(error)
}

// ---------------------------------------------------------------------------
// Vínculos
// ---------------------------------------------------------------------------

export async function listarVinculos(): Promise<Resposta<Vinculo[]>> {
  const { data, error } = await supabase
    .from('supervision_links')
    .select(
      `*, supervisor:profiles!supervision_links_supervisor_id_fkey(${PESSOA}), supervisionando:profiles!supervision_links_supervisee_id_fkey(${PESSOA})`,
    )
    .order('created_at', { ascending: false })
  return error ? falha(error) : ok(data)
}

export async function encerrarVinculo(id: string): Promise<Resultado> {
  const { error } = await supabase.rpc('encerrar_vinculo', { p_id: id })
  return resultado(error)
}

// ---------------------------------------------------------------------------
// Convites por link
// ---------------------------------------------------------------------------

export type PapelConvite = 'supervisor' | 'supervisionando'

export async function criarConvite(papel: PapelConvite): Promise<Resultado> {
  const { error } = await supabase.from('supervision_invites').insert({ inviter_role: papel })
  if (error && (error as { code?: string }).code === '42501' && papel === 'supervisor') {
    return { erro: 'Para convidar como supervisor, cadastre seu CRP em “Meu perfil”.' }
  }
  return resultado(error)
}

export async function listarConvites(): Promise<Resposta<Convite[]>> {
  const { data, error } = await supabase
    .from('supervision_invites')
    .select('*')
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  return error ? falha(error) : ok(data)
}

export async function apagarConvite(id: string): Promise<Resultado> {
  const { error } = await supabase.from('supervision_invites').delete().eq('id', id)
  return resultado(error)
}

export type ConviteVisto = {
  inviter_name: string
  inviter_crp_region: string | null
  inviter_crp_number: string | null
  inviter_role: string
  valido: boolean
}

export async function verConvite(token: string): Promise<Resposta<ConviteVisto>> {
  const { data, error } = await supabase.rpc('ver_convite', { p_token: token })
  if (error) return falha(error)
  const convite = data?.[0]
  if (!convite) return { dados: null, erro: 'Convite não encontrado. Confira se o link está completo.' }
  return ok(convite)
}

export async function aceitarConvite(token: string): Promise<Resultado> {
  const { error } = await supabase.rpc('aceitar_convite', { p_token: token })
  if (error && (error as { code?: string }).code === '42501') {
    return { erro: 'Para ser supervisor, cadastre seu CRP em “Meu perfil” e abra o link de novo.' }
  }
  return resultado(error)
}

/** Endereço completo do convite, para copiar e mandar. */
export function linkDoConvite(token: string): string {
  return `${window.location.origin}/convite/${token}`
}

/** Consulta pública de inscritos do Conselho Federal de Psicologia. */
export const CONSULTA_CFP = 'https://cadastro.cfp.org.br/'
