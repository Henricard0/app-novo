// Rede de contadores (Fase 6, início). Quem vê e faz o quê é decidido no banco:
// o contador só lê o financeiro por funções que conferem vínculo, plano,
// autorização e verificação em duas etapas.

import { traduzirErroBanco } from '@/lib/consultorio/erros'
import type { Resposta } from '@/lib/consultorio/useConsulta'
import { supabase } from '@/lib/supabase'
import type { Database, Tables } from '@/types/database'

export type PerfilContador = Tables<'accountant_profiles'>
export type PessoaResumo = { full_name: string }
export type ContadorNaRede = PerfilContador & { profiles: PessoaResumo | null }
export type PedidoContador = Tables<'accountant_requests'> & {
  psicologo: { full_name: string; crp_region: string | null; crp_number: string | null } | null
  contador: PessoaResumo | null
}
export type VinculoContador = Tables<'accountant_links'> & { contador: PessoaResumo | null }
export type Guia = Tables<'accountant_documents'>
export type Pendencia = Tables<'accountant_tasks'>
export type Acesso = Tables<'accountant_access_log'>
export type Cliente = Database['public']['Functions']['contador_clientes']['Returns'][number]
export type MesResumo = Database['public']['Functions']['contador_resumo']['Returns'][number]
export type Lancamento = Database['public']['Functions']['contador_lancamentos']['Returns'][number]
export type DespesaCliente = Database['public']['Functions']['contador_despesas']['Returns'][number]

type Resultado = { erro: string | null }

function traduzir(erro: unknown): string {
  const e = erro as { code?: string; message?: string; hint?: string } | null
  const dica = e?.hint ?? ''
  if (dica === 'plano_sem_contador') return 'O contador está disponível nos planos Essencial e Profissional.'
  if (dica === 'contador_indisponivel') return 'Este contador não está aceitando novos clientes agora.'
  if (dica === 'ja_tem_contador') return 'Já existe um contador ligado a este consultório. Encerre o vínculo atual antes.'
  if (dica === 'pedido_repetido') return 'Você já tem um pedido esperando resposta deste contador.'
  if (dica === 'exige_duas_etapas') return 'Confirme a verificação em duas etapas para continuar.'
  return traduzirErroBanco(erro)
}

function ok<T>(dados: T): Resposta<T> {
  return { dados, erro: null }
}
function falha<T>(erro: unknown): Resposta<T> {
  return { dados: null, erro: traduzir(erro) }
}
function resultado(error: unknown): Resultado {
  return { erro: error ? traduzir(error) : null }
}

export const ESPECIALIDADES: Record<string, string> = {
  carne_leao: 'Carnê-leão (pessoa física)',
  simples_nacional: 'Simples Nacional',
  abertura_empresa: 'Abertura de empresa',
  imposto_de_renda: 'Imposto de Renda',
  folha_pro_labore: 'Pró-labore e folha',
  planejamento_tributario: 'Planejamento tributário',
}

export function formatarCrc(perfil: Pick<PerfilContador, 'crc_state' | 'crc_number' | 'crc_category'> | null | undefined): string | null {
  if (!perfil?.crc_state || !perfil.crc_number) return null
  return `CRC-${perfil.crc_state} ${perfil.crc_number}${perfil.crc_category === 'tecnico' ? ' (técnico)' : ''}`
}

// ---------------------------------------------------------------------------
// Lado do psicólogo
// ---------------------------------------------------------------------------

export async function listarContadores(): Promise<Resposta<ContadorNaRede[]>> {
  const { data, error } = await supabase.from('accountant_profiles').select('*, profiles(full_name)').eq('listed', true)
  if (error) return falha(error)
  return ok(
    data
      .filter((c) => c.crc_number)
      .sort((a, b) => (a.profiles?.full_name ?? '').localeCompare(b.profiles?.full_name ?? '', 'pt-BR')),
  )
}

export async function buscarContador(id: string): Promise<Resposta<ContadorNaRede>> {
  const { data, error } = await supabase.from('accountant_profiles').select('*, profiles(full_name)').eq('id', id).maybeSingle()
  if (error) return falha(error)
  if (!data) return { dados: null, erro: 'Contador não encontrado.' }
  return ok(data)
}

export async function pedirContador(contadorId: string, mensagem: string): Promise<Resultado> {
  const { error } = await supabase.rpc('pedir_contador', { p_contador: contadorId, p_mensagem: mensagem })
  return resultado(error)
}

export async function cancelarPedido(id: string): Promise<Resultado> {
  const { error } = await supabase.rpc('cancelar_pedido_contador', { p_id: id })
  return resultado(error)
}

export type MeuContador = {
  vinculo: VinculoContador | null
  perfil: PerfilContador | null
  pendentes: PedidoContador[]
}

export async function buscarMeuContador(meuId: string): Promise<Resposta<MeuContador>> {
  const [vinculos, pedidos] = await Promise.all([
    supabase
      .from('accountant_links')
      .select('*, contador:profiles!accountant_links_accountant_id_fkey(full_name)')
      .eq('psychologist_id', meuId)
      .eq('status', 'ativo')
      .maybeSingle(),
    supabase
      .from('accountant_requests')
      .select(
        '*, psicologo:profiles!accountant_requests_psychologist_id_fkey(full_name, crp_region, crp_number), contador:profiles!accountant_requests_accountant_id_fkey(full_name)',
      )
      .eq('psychologist_id', meuId)
      .eq('status', 'pendente')
      .order('created_at', { ascending: false }),
  ])
  const erro = vinculos.error ?? pedidos.error
  if (erro) return falha(erro)
  let perfil: PerfilContador | null = null
  if (vinculos.data) {
    const r = await supabase.from('accountant_profiles').select('*').eq('id', vinculos.data.accountant_id).maybeSingle()
    perfil = r.data
  }
  return ok({ vinculo: vinculos.data, perfil, pendentes: pedidos.data ?? [] })
}

export type Autorizacoes = Pick<Tables<'accountant_links'>, 'share_totals' | 'share_entries' | 'share_expenses'>

export async function mudarAutorizacoes(vinculoId: string, autorizacoes: Partial<Autorizacoes>): Promise<Resultado> {
  const { error } = await supabase.from('accountant_links').update(autorizacoes).eq('id', vinculoId)
  return resultado(error)
}

export async function encerrarVinculoContador(id: string): Promise<Resultado> {
  const { error } = await supabase.rpc('encerrar_vinculo_contador', { p_id: id })
  return resultado(error)
}

/** Guias e pendências que o psicólogo recebeu (de qualquer vínculo, atual ou antigo). */
export async function listarGuiasEPendencias(): Promise<Resposta<{ guias: Guia[]; pendencias: Pendencia[] }>> {
  const [guias, pendencias] = await Promise.all([
    supabase.from('accountant_documents').select('*').order('due_on', { ascending: false, nullsFirst: false }),
    supabase.from('accountant_tasks').select('*').order('created_at', { ascending: false }),
  ])
  const erro = guias.error ?? pendencias.error
  if (erro) return falha(erro)
  return ok({ guias: guias.data ?? [], pendencias: pendencias.data ?? [] })
}

export async function listarAcessos(): Promise<Resposta<Acesso[]>> {
  const { data, error } = await supabase
    .from('accountant_access_log')
    .select('*')
    .order('accessed_at', { ascending: false })
    .limit(30)
  return error ? falha(error) : ok(data)
}

export async function marcarGuiaPaga(id: string, paga: boolean): Promise<Resultado> {
  const { error } = await supabase.rpc('marcar_guia_paga', { p_id: id, p_paga: paga })
  return resultado(error)
}

export async function resolverPendencia(id: string, resolvida: boolean): Promise<Resultado> {
  const { error } = await supabase.rpc('resolver_pendencia', { p_id: id, p_resolvida: resolvida })
  return resultado(error)
}

/** Link temporário (5 minutos) para abrir o PDF da guia. */
export async function linkDaGuia(caminho: string): Promise<{ url: string | null; erro: string | null }> {
  const { data, error } = await supabase.storage.from('guias').createSignedUrl(caminho, 300)
  return error || !data ? { url: null, erro: 'Não foi possível abrir o arquivo. Tente de novo.' } : { url: data.signedUrl, erro: null }
}

/** Para o aviso no menu: guias a pagar e pendências abertas. */
export async function contarAvisosDoContador(): Promise<Resposta<number>> {
  const [guias, pendencias] = await Promise.all([
    supabase.from('accountant_documents').select('id', { count: 'exact', head: true }).is('paid_on', null),
    supabase.from('accountant_tasks').select('id', { count: 'exact', head: true }).is('resolved_at', null),
  ])
  const erro = guias.error ?? pendencias.error
  if (erro) return falha(erro)
  return ok((guias.count ?? 0) + (pendencias.count ?? 0))
}

// ---------------------------------------------------------------------------
// Lado do contador
// ---------------------------------------------------------------------------

export async function buscarMeuPerfilContador(id: string): Promise<Resposta<PerfilContador | null>> {
  const { data, error } = await supabase.from('accountant_profiles').select('*').eq('id', id).maybeSingle()
  return error ? falha(error) : ok(data)
}

export type DadosPerfilContador = Omit<PerfilContador, 'id' | 'created_at' | 'updated_at'>

export async function salvarPerfilContador(id: string, dados: DadosPerfilContador): Promise<Resultado> {
  const { error } = await supabase.from('accountant_profiles').update(dados).eq('id', id)
  return resultado(error)
}

export async function listarPedidosRecebidos(meuId: string): Promise<Resposta<PedidoContador[]>> {
  const { data, error } = await supabase
    .from('accountant_requests')
    .select(
      '*, psicologo:profiles!accountant_requests_psychologist_id_fkey(full_name, crp_region, crp_number), contador:profiles!accountant_requests_accountant_id_fkey(full_name)',
    )
    .eq('accountant_id', meuId)
    .eq('status', 'pendente')
    .order('created_at')
  return error ? falha(error) : ok(data)
}

export async function responderPedido(id: string, aceitar: boolean): Promise<Resultado> {
  const { error } = await supabase.rpc('responder_pedido_contador', { p_id: id, p_aceitar: aceitar })
  return resultado(error)
}

export async function listarClientes(): Promise<Resposta<Cliente[]>> {
  const { data, error } = await supabase.rpc('contador_clientes')
  return error ? falha(error) : ok(data ?? [])
}

export async function resumoDoAno(psicologoId: string, ano: number): Promise<Resposta<MesResumo[]>> {
  const { data, error } = await supabase.rpc('contador_resumo', { p_psicologo: psicologoId, p_ano: ano })
  return error ? falha(error) : ok(data ?? [])
}

export async function lancamentosDoMes(psicologoId: string, mesISO: string): Promise<Resposta<Lancamento[]>> {
  const { data, error } = await supabase.rpc('contador_lancamentos', { p_psicologo: psicologoId, p_mes: mesISO })
  return error ? falha(error) : ok(data ?? [])
}

export async function despesasDoMes(psicologoId: string, mesISO: string): Promise<Resposta<DespesaCliente[]>> {
  const { data, error } = await supabase.rpc('contador_despesas', { p_psicologo: psicologoId, p_mes: mesISO })
  return error ? falha(error) : ok(data ?? [])
}

export async function guiasEPendenciasDoCliente(
  psicologoId: string,
): Promise<Resposta<{ guias: Guia[]; pendencias: Pendencia[] }>> {
  const [guias, pendencias] = await Promise.all([
    supabase.from('accountant_documents').select('*').eq('psychologist_id', psicologoId).order('created_at', { ascending: false }),
    supabase.from('accountant_tasks').select('*').eq('psychologist_id', psicologoId).order('created_at', { ascending: false }),
  ])
  const erro = guias.error ?? pendencias.error
  if (erro) return falha(erro)
  return ok({ guias: guias.data ?? [], pendencias: pendencias.data ?? [] })
}

export type DadosGuia = {
  tipo: 'das' | 'darf' | 'outro'
  titulo: string
  /** AAAA-MM-01 */
  competencia: string
  vencimento: string | null
  valor: number | null
  arquivo: File
}

export async function enviarGuia(psicologoId: string, dados: DadosGuia): Promise<Resultado> {
  if (dados.arquivo.type !== 'application/pdf') return { erro: 'Envie a guia em PDF.' }
  if (dados.arquivo.size > 10 * 1024 * 1024) return { erro: 'O PDF pode ter até 10 MB.' }
  const caminho = `${psicologoId}/${crypto.randomUUID()}.pdf`
  const envio = await supabase.storage.from('guias').upload(caminho, dados.arquivo, { contentType: 'application/pdf' })
  if (envio.error) return { erro: 'Não foi possível enviar o PDF. Confira a conexão e tente de novo.' }
  const { error } = await supabase.rpc('enviar_guia', {
    p_psicologo: psicologoId,
    p_tipo: dados.tipo,
    p_titulo: dados.titulo,
    p_competencia: dados.competencia,
    p_vencimento: dados.vencimento as string,
    p_valor: dados.valor as number,
    p_arquivo: caminho,
  })
  if (error) {
    await supabase.storage.from('guias').remove([caminho])
    return resultado(error)
  }
  return { erro: null }
}

export async function removerGuia(id: string): Promise<Resultado> {
  const { data, error } = await supabase.rpc('remover_guia', { p_id: id })
  if (error) return resultado(error)
  if (data) await supabase.storage.from('guias').remove([data])
  return { erro: null }
}

export async function criarPendencia(psicologoId: string, texto: string): Promise<Resultado> {
  const { error } = await supabase.rpc('criar_pendencia', { p_psicologo: psicologoId, p_texto: texto })
  return resultado(error)
}

// ---------------------------------------------------------------------------
// Verificação em duas etapas (TOTP)
// ---------------------------------------------------------------------------

export type SituacaoDuasEtapas = 'confirmada' | 'falta_codigo' | 'falta_ativar'

export async function situacaoDuasEtapas(): Promise<Resposta<SituacaoDuasEtapas>> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error || !data) return { dados: null, erro: 'Não foi possível conferir a verificação em duas etapas.' }
  if (data.currentLevel === 'aal2') return ok('confirmada')
  return ok(data.nextLevel === 'aal2' ? 'falta_codigo' : 'falta_ativar')
}

export async function iniciarAtivacao(): Promise<{ erro: string | null; fatorId?: string; qrCode?: string; segredo?: string }> {
  // Remove tentativas anteriores que não foram confirmadas.
  const fatores = await supabase.auth.mfa.listFactors()
  for (const f of fatores.data?.all ?? []) {
    if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id })
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Tríade ${Date.now()}` })
  if (error || !data) return { erro: 'Não foi possível começar a ativação. Tente de novo.' }
  return { erro: null, fatorId: data.id, qrCode: data.totp.qr_code, segredo: data.totp.secret }
}

export async function confirmarCodigo(codigo: string, fatorId?: string): Promise<Resultado> {
  let id = fatorId
  if (!id) {
    const fatores = await supabase.auth.mfa.listFactors()
    id = fatores.data?.totp[0]?.id
  }
  if (!id) return { erro: 'Ative a verificação em duas etapas primeiro.' }
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: id, code: codigo.replace(/\s/g, '') })
  return { erro: error ? 'Código inválido ou vencido. Confira o aplicativo e tente de novo.' : null }
}
