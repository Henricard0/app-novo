// Casos levados à supervisão, pauta, devolutivas e horas (Fase 2b).
// A anonimização acontece antes, no navegador (anonimizar.ts). Aqui só vai
// para o banco o texto já revisado pelo psicólogo.

import { traduzirErroBanco } from '@/lib/consultorio/erros'
import type { Resposta } from '@/lib/consultorio/useConsulta'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'
import type { PessoaResumo } from './api'

export type Encontro = Tables<'supervision_meetings'>
export type Caso = Tables<'supervision_cases'>
export type Trecho = Tables<'supervision_case_excerpts'>
export type Devolutiva = Tables<'supervision_feedback'>
export type Encaminhamento = Tables<'supervision_feedback_tasks'>
export type Hora = Tables<'supervision_hours'>

export type CasoNaLista = Caso & {
  supervision_meetings: Pick<Encontro, 'starts_at' | 'status'> | null
  supervision_links: {
    supervisor: PessoaResumo | null
    supervisionando: PessoaResumo | null
  } | null
}

export type CasoCompleto = CasoNaLista & {
  supervision_case_excerpts: Trecho[]
  supervision_feedback: (Devolutiva & { supervision_feedback_tasks: Encaminhamento[] }) | null
}

type Resultado = { erro: string | null }

const PESSOA = 'full_name, crp_region, crp_number'
const VINCULO = `supervision_links(supervisor:profiles!supervision_links_supervisor_id_fkey(${PESSOA}), supervisionando:profiles!supervision_links_supervisee_id_fkey(${PESSOA}))`

function falha<T>(erro: unknown): Resposta<T> {
  return { dados: null, erro: traduzirErroBanco(erro) }
}

export async function listarEncontros(linkId: string): Promise<Resposta<Encontro[]>> {
  const { data, error } = await supabase
    .from('supervision_meetings')
    .select('*')
    .eq('link_id', linkId)
    .eq('status', 'agendado')
    .gte('starts_at', new Date(Date.now() - 6 * 3600000).toISOString())
    .order('starts_at')
  return error ? falha(error) : { dados: data, erro: null }
}

export type NovoCaso = {
  linkId: string
  /** Encontro existente, ou um novo (data e hora), ou nenhum. */
  encontro: { id: string } | { inicio: Date } | null
  rotulo: string
  pergunta: string
  pacienteId: string
  registroIds: string[]
  trechos: { periodo: string; texto: string }[]
  enviar: boolean
}

/** Cria o caso com a origem (só o supervisionando vê) e os trechos anonimizados. */
export async function criarCaso(dados: NovoCaso): Promise<{ erro: string | null; id: string | null }> {
  let encontroId: string | null = null
  if (dados.encontro && 'id' in dados.encontro) encontroId = dados.encontro.id
  if (dados.encontro && 'inicio' in dados.encontro) {
    const { data, error } = await supabase
      .from('supervision_meetings')
      .insert({ link_id: dados.linkId, starts_at: dados.encontro.inicio.toISOString() })
      .select('id')
      .single()
    if (error) return { erro: traduzirErroBanco(error), id: null }
    encontroId = data.id
  }

  const { data: caso, error: erroCaso } = await supabase
    .from('supervision_cases')
    .insert({ link_id: dados.linkId, meeting_id: encontroId, case_label: dados.rotulo, question: dados.pergunta.trim() || null })
    .select('id')
    .single()
  if (erroCaso) return { erro: traduzirErroBanco(erroCaso), id: null }

  const desfazer = async (erro: unknown) => {
    await supabase.from('supervision_cases').delete().eq('id', caso.id)
    return { erro: traduzirErroBanco(erro), id: null }
  }

  const { error: erroOrigem } = await supabase
    .from('supervision_case_sources')
    .insert({ case_id: caso.id, patient_id: dados.pacienteId, record_ids: dados.registroIds })
  if (erroOrigem) return desfazer(erroOrigem)

  const { error: erroTrechos } = await supabase.from('supervision_case_excerpts').insert(
    dados.trechos.map((t, i) => ({ case_id: caso.id, position: i, period_label: t.periodo, anonymized_body: t.texto })),
  )
  if (erroTrechos) return desfazer(erroTrechos)

  if (dados.enviar) {
    const { error } = await supabase.rpc('enviar_caso', { p_case: caso.id })
    if (error) return { erro: `O rascunho foi salvo, mas não foi enviado: ${traduzirErroBanco(error)}`, id: caso.id }
  }
  return { erro: null, id: caso.id }
}

export async function enviarCaso(id: string): Promise<Resultado> {
  const { error } = await supabase.rpc('enviar_caso', { p_case: id })
  return { erro: error ? traduzirErroBanco(error) : null }
}

export async function apagarRascunho(id: string): Promise<Resultado> {
  const { error } = await supabase.from('supervision_cases').delete().eq('id', id)
  return { erro: error ? traduzirErroBanco(error) : null }
}

const COM_ENCONTRO_E_VINCULO = `*, supervision_meetings(starts_at, status), ${VINCULO}`

/** Casos que eu levei (supervisionando) ou recebi (supervisor), conforme a RLS. */
export async function listarCasos(): Promise<Resposta<CasoNaLista[]>> {
  const { data, error } = await supabase
    .from('supervision_cases')
    .select(COM_ENCONTRO_E_VINCULO)
    .order('created_at', { ascending: false })
  return error ? falha(error) : { dados: data, erro: null }
}

export async function buscarCaso(id: string): Promise<Resposta<CasoCompleto>> {
  const { data, error } = await supabase
    .from('supervision_cases')
    .select(`${COM_ENCONTRO_E_VINCULO}, supervision_case_excerpts(*), supervision_feedback(*, supervision_feedback_tasks(*))`)
    .eq('id', id)
    .order('position', { referencedTable: 'supervision_case_excerpts' })
    .maybeSingle()
  if (error) return falha(error)
  if (!data) return { dados: null, erro: 'Caso não encontrado.' }
  const devolutiva = data.supervision_feedback
  if (devolutiva) devolutiva.supervision_feedback_tasks.sort((a, b) => a.position - b.position)
  return { dados: data, erro: null }
}

export type DadosDevolutiva = { observado: string; caminhos: string; encaminhamentos: string[] }

/** Salva a devolutiva (cria ou atualiza o rascunho) e, se pedido, envia. */
export async function salvarDevolutiva(
  casoId: string,
  atual: Devolutiva | null,
  dados: DadosDevolutiva,
  enviar: { minutos: number } | null,
): Promise<Resultado> {
  let id = atual?.id
  const campos = { observed: dados.observado.trim() || null, paths: dados.caminhos.trim() || null }
  if (id) {
    const { error } = await supabase.from('supervision_feedback').update(campos).eq('id', id)
    if (error) return { erro: traduzirErroBanco(error) }
  } else {
    const { data, error } = await supabase.from('supervision_feedback').insert({ ...campos, case_id: casoId }).select('id').single()
    if (error) return { erro: traduzirErroBanco(error) }
    id = data.id
  }

  // Encaminhamentos: regrava a lista inteira enquanto é rascunho.
  const { error: erroApagar } = await supabase.from('supervision_feedback_tasks').delete().eq('feedback_id', id)
  if (erroApagar) return { erro: traduzirErroBanco(erroApagar) }
  const textos = dados.encaminhamentos.map((t) => t.trim()).filter(Boolean)
  if (textos.length) {
    const { error } = await supabase
      .from('supervision_feedback_tasks')
      .insert(textos.map((text, position) => ({ feedback_id: id, text, position })))
    if (error) return { erro: traduzirErroBanco(error) }
  }

  if (enviar) {
    const { error } = await supabase.rpc('enviar_devolutiva', { p_feedback: id, p_minutos: enviar.minutos })
    if (error) return { erro: traduzirErroBanco(error) }
  }
  return { erro: null }
}

export async function marcarDiscutido(casoId: string): Promise<Resultado> {
  const { error } = await supabase.rpc('marcar_caso_discutido', { p_case: casoId })
  return { erro: error ? traduzirErroBanco(error) : null }
}

export async function marcarEncaminhamento(id: string, feito: boolean): Promise<Resultado> {
  const { error } = await supabase.rpc('marcar_encaminhamento', { p_task: id, p_feito: feito })
  return { erro: error ? traduzirErroBanco(error) : null }
}

export async function listarHoras(): Promise<Resposta<Hora[]>> {
  const { data, error } = await supabase.from('supervision_hours').select('*').order('occurred_on', { ascending: false })
  return error ? falha(error) : { dados: data, erro: null }
}

export const ROTULO_SITUACAO_CASO: Record<string, { texto: string; tom: 'ok' | 'atencao' | 'neutro' }> = {
  rascunho: { texto: 'Rascunho', tom: 'neutro' },
  na_pauta: { texto: 'Na pauta', tom: 'atencao' },
  discutido: { texto: 'Discutido', tom: 'neutro' },
  devolutiva_recebida: { texto: 'Devolutiva enviada', tom: 'ok' },
}

/** "38h", "1h30" — total de minutos em horas. */
export function formatarHoras(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  if (h === 0) return `${m} min`
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}
