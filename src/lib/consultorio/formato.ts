// Datas, horários e rótulos do consultório. Tudo no fuso do navegador.

export type StatusSessao = 'agendada' | 'realizada' | 'faltou' | 'cancelada'
export type Modalidade = 'presencial' | 'online'

export const ROTULO_STATUS: Record<StatusSessao, string> = {
  agendada: 'Agendada',
  realizada: 'Realizada',
  faltou: 'Faltou',
  cancelada: 'Cancelada',
}

export const OPCOES_STATUS = (Object.keys(ROTULO_STATUS) as StatusSessao[]).map((valor) => ({
  valor,
  rotulo: ROTULO_STATUS[valor],
}))

export const ROTULO_MODALIDADE: Record<Modalidade, string> = { presencial: 'Presencial', online: 'Online' }

export function tomDoStatus(status: string): 'ok' | 'atencao' | 'neutro' {
  if (status === 'realizada') return 'ok'
  if (status === 'faltou') return 'atencao'
  return 'neutro'
}

function doisDigitos(n: number): string {
  return String(n).padStart(2, '0')
}

/** Date → "2026-11-16" (dia local). */
export function paraDataISO(data: Date): string {
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`
}

/** "2026-11-16" → Date à meia-noite local. Devolve null se o texto não for uma data válida. */
export function lerDataISO(texto: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto ?? '')
  if (!m) return null
  const data = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return data.getMonth() === Number(m[2]) - 1 ? data : null
}

/** Date → "14:30" */
export function paraHora(data: Date): string {
  return `${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}`
}

/** Junta "2026-11-16" e "14:30" num instante local. */
export function juntarDataHora(dataISO: string, hora: string): Date | null {
  const dia = lerDataISO(dataISO)
  const m = /^(\d{2}):(\d{2})$/.exec(hora)
  if (!dia || !m) return null
  dia.setHours(Number(m[1]), Number(m[2]), 0, 0)
  return dia
}

export function somarDias(data: Date, dias: number): Date {
  const nova = new Date(data)
  nova.setDate(nova.getDate() + dias)
  return nova
}

/** Segunda-feira da semana da data, à meia-noite. */
export function inicioDaSemana(data: Date): Date {
  const dia = new Date(data.getFullYear(), data.getMonth(), data.getDate())
  const deslocamento = (dia.getDay() + 6) % 7
  return somarDias(dia, -deslocamento)
}

export function mesmoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

const FORMATO_DATA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const FORMATO_DIA_SEMANA = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
const FORMATO_DIA_CURTO = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' })
const FORMATO_DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** "16/11/2026" */
export function formatarData(data: Date | string): string {
  const d = typeof data === 'string' ? (lerDataISO(data) ?? new Date(data)) : data
  return FORMATO_DATA.format(d)
}

/** "Segunda, 16 de novembro" */
export function formatarDiaDaSemana(data: Date): string {
  const texto = FORMATO_DIA_SEMANA.format(data).replace('-feira', '')
  return texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1)
}

/** "16 de nov." */
export function formatarDiaCurto(data: Date): string {
  return FORMATO_DIA_CURTO.format(data)
}

/** "16/11/2026, 14:30" */
export function formatarDataHora(instante: string | Date): string {
  return FORMATO_DATA_HORA.format(typeof instante === 'string' ? new Date(instante) : instante)
}

/** Idade em anos completos na data de referência. */
export function idade(nascimentoISO: string | null, hoje: Date = new Date()): number | null {
  const nascimento = lerDataISO(nascimentoISO)
  if (!nascimento) return null
  let anos = hoje.getFullYear() - nascimento.getFullYear()
  const fezAniversario =
    hoje.getMonth() > nascimento.getMonth() ||
    (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() >= nascimento.getDate())
  if (!fezAniversario) anos -= 1
  return anos
}

/** Minutos entre dois instantes. */
export function duracaoEmMinutos(inicio: string, fim: string): number {
  return Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 60000)
}
