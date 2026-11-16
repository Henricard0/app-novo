import { describe, expect, it } from 'vitest'
import {
  PIXELS_POR_PASSO,
  colunasDeSobreposicao,
  conflitos,
  faixaDeHoras,
  horarioDepoisDeArrastar,
  horarioDepoisDeRedimensionar,
  posicaoNaGrade,
} from './calendario'
import { paraDataISO, paraHora } from './formato'

function sessao(id: string, inicio: string, fim: string, status = 'agendada') {
  return { id, starts_at: new Date(inicio).toISOString(), ends_at: new Date(fim).toISOString(), status }
}

const S = sessao('a', '2026-11-16T09:00:00', '2026-11-16T09:50:00')

describe('calendário', () => {
  it('posiciona a sessão pela hora de início e pela duração', () => {
    expect(posicaoNaGrade(S, 7)).toEqual({ topo: 128, altura: (50 / 60) * 64 })
  })

  it('mostra das 7h às 22h, ampliando para sessões fora da faixa', () => {
    expect(faixaDeHoras([S])).toEqual({ inicio: 7, fim: 22 })
    expect(faixaDeHoras([sessao('b', '2026-11-16T06:30:00', '2026-11-16T07:20:00')]).inicio).toBe(6)
    expect(faixaDeHoras([sessao('c', '2026-11-16T22:30:00', '2026-11-16T23:20:00')]).fim).toBe(24)
  })

  it('arrastar muda dia e horário em passos de 15 minutos, mantendo a duração', () => {
    const quarta = new Date(2026, 10, 18)
    const novo = horarioDepoisDeArrastar(S, quarta, PIXELS_POR_PASSO * 4 + 3)
    expect(paraDataISO(novo.inicio)).toBe('2026-11-18')
    expect(paraHora(novo.inicio)).toBe('10:00')
    expect(paraHora(novo.fim)).toBe('10:50')
  })

  it('puxar a borda muda só a duração, com mínimo de 15 minutos', () => {
    expect(paraHora(horarioDepoisDeRedimensionar(S, PIXELS_POR_PASSO).fim)).toBe('10:05')
    expect(paraHora(horarioDepoisDeRedimensionar(S, -1000).fim)).toBe('09:15')
  })

  it('coloca lado a lado as sessões que se sobrepõem', () => {
    const colunas = colunasDeSobreposicao([
      S,
      sessao('b', '2026-11-16T09:30:00', '2026-11-16T10:20:00'),
      sessao('c', '2026-11-16T11:00:00', '2026-11-16T11:50:00'),
    ])
    expect(colunas.get('a')).toEqual({ coluna: 0, total: 2 })
    expect(colunas.get('b')).toEqual({ coluna: 1, total: 2 })
    expect(colunas.get('c')).toEqual({ coluna: 0, total: 1 })
  })

  it('aponta conflitos, ignorando canceladas e a própria sessão', () => {
    const outras = [
      S,
      sessao('b', '2026-11-16T09:30:00', '2026-11-16T10:20:00'),
      sessao('x', '2026-11-16T09:30:00', '2026-11-16T10:20:00', 'cancelada'),
    ]
    const ids = conflitos(outras, new Date('2026-11-16T09:40:00'), new Date('2026-11-16T10:00:00'), ['a']).map((s) => s.id)
    expect(ids).toEqual(['b'])
  })
})
