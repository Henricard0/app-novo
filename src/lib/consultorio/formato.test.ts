import { describe, expect, it } from 'vitest'
import { horariosDasSessoes } from './api'
import { idade, inicioDaSemana, juntarDataHora, lerDataISO, paraDataISO, paraHora } from './formato'

describe('datas', () => {
  it('lê e escreve datas AAAA-MM-DD no dia local', () => {
    expect(paraDataISO(lerDataISO('2026-11-16')!)).toBe('2026-11-16')
    expect(lerDataISO('2026-02-30')).toBeNull()
    expect(lerDataISO('16/11/2026')).toBeNull()
  })

  it('a semana começa na segunda-feira', () => {
    expect(paraDataISO(inicioDaSemana(lerDataISO('2026-11-16')!))).toBe('2026-11-16') // segunda
    expect(paraDataISO(inicioDaSemana(lerDataISO('2026-11-22')!))).toBe('2026-11-16') // domingo
    expect(paraDataISO(inicioDaSemana(lerDataISO('2026-11-19')!))).toBe('2026-11-16') // quinta
  })

  it('junta data e horário', () => {
    const d = juntarDataHora('2026-11-16', '14:30')!
    expect(paraDataISO(d)).toBe('2026-11-16')
    expect(paraHora(d)).toBe('14:30')
    expect(juntarDataHora('2026-11-16', '')).toBeNull()
  })

  it('calcula a idade em anos completos', () => {
    const hoje = lerDataISO('2026-11-16')!
    expect(idade('1991-11-16', hoje)).toBe(35)
    expect(idade('1991-11-17', hoje)).toBe(34)
    expect(idade(null, hoje)).toBeNull()
  })
})

describe('sessões semanais', () => {
  it('cria uma sessão por semana, sempre no mesmo horário', () => {
    const horarios = horariosDasSessoes({ data: '2026-11-16', hora: '09:00', duracao: 50, semanas: 4 })
    expect(horarios).toHaveLength(4)
    const inicios = horarios.map((h) => new Date(h.starts_at))
    expect(inicios.map(paraDataISO)).toEqual(['2026-11-16', '2026-11-23', '2026-11-30', '2026-12-07'])
    expect(inicios.every((d) => paraHora(d) === '09:00')).toBe(true)
    expect(new Date(horarios[0]!.ends_at).getTime() - inicios[0]!.getTime()).toBe(50 * 60000)
  })
})
