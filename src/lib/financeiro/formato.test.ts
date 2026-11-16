import { describe, expect, it } from 'vitest'
import { cpfValido, fatorR, formatarCpf, lerReais, paraCampoReais } from './formato'

describe('financeiro/formato', () => {
  it('lê valores em reais em vários formatos', () => {
    expect(lerReais('180')).toBe(180)
    expect(lerReais('180,5')).toBe(180.5)
    expect(lerReais('1.250,00')).toBe(1250)
    expect(lerReais('R$ 90,90')).toBe(90.9)
    expect(lerReais('')).toBeNull()
    expect(lerReais('abc')).toBeNull()
    expect(lerReais('10,999')).toBeNull()
  })

  it('formata o valor para o campo', () => {
    expect(paraCampoReais(180)).toBe('180,00')
    expect(paraCampoReais(null)).toBe('')
  })

  it('confere CPF', () => {
    expect(cpfValido('123.456.789-09')).toBe(true)
    expect(cpfValido('111.111.111-11')).toBe(false)
    expect(cpfValido('123.456.789-00')).toBe(false)
    expect(formatarCpf('12345678909')).toBe('123.456.789-09')
  })

  it('calcula o Fator R', () => {
    expect(fatorR(3000, 120000)).toBeCloseTo(0.3)
    expect(fatorR(null, 1000)).toBeNull()
    expect(fatorR(1000, 0)).toBeNull()
  })
})
