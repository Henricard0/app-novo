// Acesso ao banco para pacientes, agenda e prontuário. Quem decide o que cada
// pessoa pode ver é o banco (RLS); aqui só montamos as consultas.

import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'
import { traduzirErroBanco } from './erros'
import { juntarDataHora, somarDias, type Modalidade, type StatusSessao } from './formato'
import type { Resposta } from './useConsulta'

export type Paciente = Tables<'patients'>
export type Contato = Tables<'patient_contacts'>
export type Sessao = Tables<'appointments'>
export type Registro = Tables<'clinical_records'>
export type VersaoRegistro = Tables<'clinical_record_versions'>

export type SessaoComPaciente = Sessao & { patients: { full_name: string } | null }
export type SessaoComRegistros = SessaoComPaciente & { clinical_records: { id: string }[] }
export type PacienteComContatos = Paciente & { patient_contacts: Contato[] }

type Resultado = { erro: string | null }

function ok<T>(dados: T): Resposta<T> {
  return { dados, erro: null }
}

function falha<T>(erro: unknown): Resposta<T> {
  return { dados: null, erro: traduzirErroBanco(erro) }
}

// ---------------------------------------------------------------------------
// Pacientes
// ---------------------------------------------------------------------------

export async function listarPacientes(): Promise<Resposta<Paciente[]>> {
  const { data, error } = await supabase.from('patients').select('*').order('full_name')
  return error ? falha(error) : ok(data)
}

export async function buscarPaciente(id: string): Promise<Resposta<PacienteComContatos>> {
  const { data, error } = await supabase
    .from('patients')
    .select('*, patient_contacts(*)')
    .eq('id', id)
    .order('created_at', { referencedTable: 'patient_contacts' })
    .maybeSingle()
  if (error) return falha(error)
  if (!data) return { dados: null, erro: 'Paciente não encontrado.' }
  return ok(data)
}

export type DadosPaciente = {
  nome: string
  apelidos: string[]
  nascimento: string | null
  telefone: string | null
  email: string | null
}

export type DadosContato = { id?: string; nome: string; parentesco: string | null; telefone: string | null }

/** Cria ou atualiza o paciente e sincroniza os contatos. Devolve o id do paciente. */
export async function salvarPaciente(
  id: string | null,
  dados: DadosPaciente,
  contatos: DadosContato[],
  contatosAntigos: Contato[] = [],
): Promise<{ erro: string | null; id: string | null }> {
  const linha = {
    full_name: dados.nome,
    nicknames: dados.apelidos,
    birth_date: dados.nascimento,
    phone: dados.telefone,
    email: dados.email,
  }

  let pacienteId = id
  if (pacienteId) {
    const { error } = await supabase.from('patients').update(linha).eq('id', pacienteId)
    if (error) return { erro: traduzirErroBanco(error), id: null }
  } else {
    const { data, error } = await supabase.from('patients').insert(linha).select('id').single()
    if (error) return { erro: traduzirErroBanco(error), id: null }
    pacienteId = data.id
  }

  const mantidos = new Set(contatos.map((c) => c.id).filter(Boolean))
  const removidos = contatosAntigos.filter((c) => !mantidos.has(c.id)).map((c) => c.id)
  if (removidos.length) {
    const { error } = await supabase.from('patient_contacts').delete().in('id', removidos)
    if (error) return { erro: traduzirErroBanco(error), id: pacienteId }
  }
  for (const c of contatos) {
    const campos = { name: c.nome, relation: c.parentesco, phone: c.telefone }
    const { error } = c.id
      ? await supabase.from('patient_contacts').update(campos).eq('id', c.id)
      : await supabase.from('patient_contacts').insert({ ...campos, patient_id: pacienteId })
    if (error) return { erro: traduzirErroBanco(error), id: pacienteId }
  }
  return { erro: null, id: pacienteId }
}

export async function arquivarPaciente(id: string, arquivar: boolean): Promise<Resultado> {
  const { error } = await supabase
    .from('patients')
    .update({ archived_at: arquivar ? new Date().toISOString() : null })
    .eq('id', id)
  return { erro: error ? traduzirErroBanco(error) : null }
}

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------

const COM_PACIENTE = '*, patients(full_name)'

export async function listarSessoesEntre(inicio: Date, fim: Date): Promise<Resposta<SessaoComRegistros[]>> {
  const { data, error } = await supabase
    .from('appointments')
    .select(`${COM_PACIENTE}, clinical_records(id)`)
    .gte('starts_at', inicio.toISOString())
    .lt('starts_at', fim.toISOString())
    .order('starts_at')
  return error ? falha(error) : ok(data)
}

export async function listarSessoesDoPaciente(pacienteId: string): Promise<Resposta<SessaoComRegistros[]>> {
  const { data, error } = await supabase
    .from('appointments')
    .select(`${COM_PACIENTE}, clinical_records(id)`)
    .eq('patient_id', pacienteId)
    .order('starts_at', { ascending: false })
  return error ? falha(error) : ok(data)
}

export async function buscarSessao(id: string): Promise<Resposta<SessaoComPaciente>> {
  const { data, error } = await supabase.from('appointments').select(COM_PACIENTE).eq('id', id).maybeSingle()
  if (error) return falha(error)
  if (!data) return { dados: null, erro: 'Sessão não encontrada.' }
  return ok(data)
}

export type DadosSessao = {
  pacienteId: string
  data: string
  hora: string
  duracao: number
  modalidade: Modalidade
  local: string | null
  /** Quantas semanas seguidas criar (1 = só esta). */
  semanas: number
}

/** Monta os horários das sessões, uma por semana a partir da data escolhida. */
export function horariosDasSessoes(dados: Pick<DadosSessao, 'data' | 'hora' | 'duracao' | 'semanas'>) {
  const primeira = juntarDataHora(dados.data, dados.hora)
  if (!primeira) return []
  return Array.from({ length: dados.semanas }, (_, i) => {
    const inicio = somarDias(primeira, i * 7)
    inicio.setHours(primeira.getHours(), primeira.getMinutes(), 0, 0)
    const fim = new Date(inicio.getTime() + dados.duracao * 60000)
    return { starts_at: inicio.toISOString(), ends_at: fim.toISOString() }
  })
}

export async function criarSessoes(dados: DadosSessao): Promise<Resultado> {
  const serie = dados.semanas > 1 ? crypto.randomUUID() : null
  const linhas = horariosDasSessoes(dados).map((h) => ({
    ...h,
    patient_id: dados.pacienteId,
    series_id: serie,
    modality: dados.modalidade,
    location: dados.local,
  }))
  const { error } = await supabase.from('appointments').insert(linhas)
  return { erro: error ? traduzirErroBanco(error) : null }
}

export async function atualizarSessao(id: string, dados: Omit<DadosSessao, 'pacienteId' | 'semanas'>): Promise<Resultado> {
  const [h] = horariosDasSessoes({ ...dados, semanas: 1 })
  if (!h) return { erro: 'Data ou horário inválido.' }
  const { error } = await supabase
    .from('appointments')
    .update({ ...h, modality: dados.modalidade, location: dados.local })
    .eq('id', id)
  return { erro: error ? traduzirErroBanco(error) : null }
}

/** Muda o horário da sessão (e, se pedido, das seguintes da série). Devolve quantas mudaram. */
export async function moverSessao(
  id: string,
  inicio: Date,
  fim: Date,
  seguintes: boolean,
): Promise<{ erro: string | null; total: number }> {
  const { data, error } = await supabase.rpc('mover_sessao', {
    p_id: id,
    p_inicio: inicio.toISOString(),
    p_fim: fim.toISOString(),
    p_seguintes: seguintes,
  })
  return error ? { erro: traduzirErroBanco(error), total: 0 } : { erro: null, total: data ?? 1 }
}

export async function mudarStatusSessao(id: string, status: StatusSessao): Promise<Resultado> {
  const { error } = await supabase.from('appointments').update({ status }).eq('id', id)
  return { erro: error ? traduzirErroBanco(error) : null }
}

/**
 * Pendências dos últimos 60 dias: sessões que já passaram e continuam "agendadas"
 * (falta marcar se aconteceram) e sessões realizadas ainda sem registro.
 */
export async function listarPendencias(agora: Date = new Date()): Promise<Resposta<SessaoComRegistros[]>> {
  const { data, error } = await supabase
    .from('appointments')
    .select(`${COM_PACIENTE}, clinical_records(id)`)
    .in('status', ['agendada', 'realizada'])
    .gte('starts_at', somarDias(agora, -60).toISOString())
    .lt('starts_at', agora.toISOString())
    .order('starts_at', { ascending: false })
  if (error) return falha(error)
  return ok(
    data.filter((s) =>
      s.status === 'agendada' ? new Date(s.ends_at) <= agora : s.clinical_records.length === 0,
    ),
  )
}

// ---------------------------------------------------------------------------
// Prontuário
// ---------------------------------------------------------------------------

export type RegistroComVersoes = Registro & { clinical_record_versions: { id: string }[] }

export async function listarRegistros(pacienteId: string): Promise<Resposta<RegistroComVersoes[]>> {
  const { data, error } = await supabase
    .from('clinical_records')
    .select('*, clinical_record_versions(id)')
    .eq('patient_id', pacienteId)
    .order('session_date', { ascending: false })
    .order('created_at', { ascending: false })
  return error ? falha(error) : ok(data)
}

export async function buscarRegistro(id: string): Promise<Resposta<Registro>> {
  const { data, error } = await supabase.from('clinical_records').select('*').eq('id', id).maybeSingle()
  if (error) return falha(error)
  if (!data) return { dados: null, erro: 'Registro não encontrado. Ele pode ter sido excluído.' }
  return ok(data)
}

export type DadosRegistro = { data: string; sessaoId: string | null; texto: string }

export async function criarRegistro(pacienteId: string, dados: DadosRegistro): Promise<Resultado> {
  const { error } = await supabase.from('clinical_records').insert({
    patient_id: pacienteId,
    appointment_id: dados.sessaoId,
    session_date: dados.data,
    body: dados.texto,
  })
  return { erro: error ? traduzirErroBanco(error) : null }
}

export async function editarRegistro(id: string, dados: DadosRegistro): Promise<Resultado> {
  const { error } = await supabase
    .from('clinical_records')
    .update({ appointment_id: dados.sessaoId, session_date: dados.data, body: dados.texto })
    .eq('id', id)
  return { erro: error ? traduzirErroBanco(error) : null }
}

export async function excluirRegistro(id: string, motivo: string): Promise<Resultado> {
  const { error } = await supabase.rpc('excluir_registro_clinico', { p_id: id, p_motivo: motivo })
  return { erro: error ? traduzirErroBanco(error) : null }
}

export async function listarVersoes(registroId: string): Promise<Resposta<VersaoRegistro[]>> {
  const { data, error } = await supabase
    .from('clinical_record_versions')
    .select('*')
    .eq('record_id', registroId)
    .order('created_at', { ascending: false })
  return error ? falha(error) : ok(data)
}
