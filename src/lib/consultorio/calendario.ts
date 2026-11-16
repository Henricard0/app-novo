// Contas do calendário da agenda: posição das sessões na grade, encaixe de
// 15 em 15 minutos ao arrastar e colunas para sessões que se sobrepõem.

export const MINUTOS_POR_PASSO = 15
export const PIXELS_POR_HORA = 64
export const PIXELS_POR_PASSO = (PIXELS_POR_HORA / 60) * MINUTOS_POR_PASSO
export const HORA_INICIAL_PADRAO = 7
export const HORA_FINAL_PADRAO = 22

type ComHorario = { id: string; starts_at: string; ends_at: string }

function minutosDoDia(instante: Date): number {
  return instante.getHours() * 60 + instante.getMinutes()
}

/** Faixa de horas mostrada: 7h às 22h, ampliada se houver sessão fora disso. */
export function faixaDeHoras(sessoes: ComHorario[]): { inicio: number; fim: number } {
  let inicio = HORA_INICIAL_PADRAO
  let fim = HORA_FINAL_PADRAO
  for (const s of sessoes) {
    const a = new Date(s.starts_at)
    const b = new Date(s.ends_at)
    inicio = Math.min(inicio, a.getHours())
    const fimDaSessao = b.getDate() !== a.getDate() ? 24 : Math.ceil(minutosDoDia(b) / 60)
    fim = Math.max(fim, fimDaSessao)
  }
  return { inicio, fim: Math.min(24, Math.max(fim, inicio + 1)) }
}

/** Posição vertical (topo e altura, em pixels) de uma sessão na coluna do dia. */
export function posicaoNaGrade(sessao: ComHorario, horaInicial: number): { topo: number; altura: number } {
  const inicio = new Date(sessao.starts_at)
  const fim = new Date(sessao.ends_at)
  const minutosInicio = minutosDoDia(inicio) - horaInicial * 60
  const duracao = Math.max(MINUTOS_POR_PASSO, (fim.getTime() - inicio.getTime()) / 60000)
  return {
    topo: (minutosInicio / 60) * PIXELS_POR_HORA,
    altura: (duracao / 60) * PIXELS_POR_HORA,
  }
}

/** Arredonda um deslocamento vertical (pixels) para passos de 15 minutos. */
export function passosDoDeslocamento(deltaY: number): number {
  return Math.round(deltaY / PIXELS_POR_PASSO)
}

/**
 * Novo horário depois de arrastar: mesmo horário do dia mais o deslocamento
 * vertical, no dia da coluna onde a sessão foi solta. A duração não muda.
 */
export function horarioDepoisDeArrastar(sessao: ComHorario, diaDestino: Date, deltaY: number) {
  const inicio = new Date(sessao.starts_at)
  const duracao = new Date(sessao.ends_at).getTime() - inicio.getTime()
  const minutos = minutosDoDia(inicio) + passosDoDeslocamento(deltaY) * MINUTOS_POR_PASSO
  const limitado = Math.min(Math.max(minutos, 0), 24 * 60 - MINUTOS_POR_PASSO)
  const novoInicio = new Date(diaDestino.getFullYear(), diaDestino.getMonth(), diaDestino.getDate(), 0, limitado)
  return { inicio: novoInicio, fim: new Date(novoInicio.getTime() + duracao) }
}

/** Nova duração depois de puxar a borda de baixo: mínimo de 15 minutos, máximo de 8 horas. */
export function horarioDepoisDeRedimensionar(sessao: ComHorario, deltaY: number) {
  const inicio = new Date(sessao.starts_at)
  const duracaoAtual = (new Date(sessao.ends_at).getTime() - inicio.getTime()) / 60000
  const nova = Math.min(8 * 60, Math.max(MINUTOS_POR_PASSO, duracaoAtual + passosDoDeslocamento(deltaY) * MINUTOS_POR_PASSO))
  return { inicio, fim: new Date(inicio.getTime() + nova * 60000) }
}

/**
 * Distribui sessões que se sobrepõem lado a lado: devolve, para cada id, a
 * coluna (0, 1, …) e quantas colunas o grupo de sobreposição tem.
 */
export function colunasDeSobreposicao(sessoes: ComHorario[]): Map<string, { coluna: number; total: number }> {
  const ordenadas = [...sessoes].sort((a, b) => a.starts_at.localeCompare(b.starts_at) || b.ends_at.localeCompare(a.ends_at))
  const resultado = new Map<string, { coluna: number; total: number }>()
  let grupo: { id: string; coluna: number }[] = []
  let fimDoGrupo = 0
  let finsPorColuna: number[] = []

  const fecharGrupo = () => {
    const total = Math.max(1, ...grupo.map((g) => g.coluna + 1))
    for (const g of grupo) resultado.set(g.id, { coluna: g.coluna, total })
    grupo = []
    finsPorColuna = []
  }

  for (const s of ordenadas) {
    const inicio = new Date(s.starts_at).getTime()
    const fim = new Date(s.ends_at).getTime()
    if (grupo.length && inicio >= fimDoGrupo) fecharGrupo()
    let coluna = finsPorColuna.findIndex((f) => f <= inicio)
    if (coluna === -1) coluna = finsPorColuna.length
    finsPorColuna[coluna] = fim
    grupo.push({ id: s.id, coluna })
    fimDoGrupo = Math.max(fimDoGrupo, fim)
  }
  if (grupo.length) fecharGrupo()
  return resultado
}

/** Sessões (não canceladas) que se sobrepõem a um horário, exceto as indicadas. */
export function conflitos<T extends ComHorario & { status: string }>(
  sessoes: T[],
  inicio: Date,
  fim: Date,
  ignorar: string[],
): T[] {
  return sessoes.filter(
    (s) =>
      !ignorar.includes(s.id) &&
      s.status !== 'cancelada' &&
      new Date(s.starts_at) < fim &&
      new Date(s.ends_at) > inicio,
  )
}
