import { describe, expect, it } from 'vitest'
import { formatarCrp, REGIOES_CRP } from './crp'
import { dataPorExtenso, saudacao } from './data'
import { ERRO_CONEXAO, ERRO_GENERICO, traduzirErroAuth } from './erros-auth'
import { iniciais, primeiroNome } from './texto'
import { validarCrp, validarEmail, validarNome, validarSenhaNova } from './validacao'

describe('saudacao', () => {
  it.each([
    [5, 'Bom dia'],
    [11, 'Bom dia'],
    [12, 'Boa tarde'],
    [17, 'Boa tarde'],
    [18, 'Boa noite'],
    [2, 'Boa noite'],
  ])('às %ih diz "%s"', (hora, esperado) => {
    expect(saudacao(new Date(2026, 10, 13, hora, 30))).toBe(esperado)
  })
})

describe('dataPorExtenso', () => {
  it('escreve o dia como no protótipo, sem "-feira"', () => {
    expect(dataPorExtenso(new Date(2026, 10, 13, 15))).toBe('Sexta, 13 de novembro')
  })
  it('funciona no fim de semana', () => {
    expect(dataPorExtenso(new Date(2026, 10, 15, 15))).toBe('Domingo, 15 de novembro')
  })
})

describe('texto', () => {
  it('pega o primeiro nome', () => {
    expect(primeiroNome('  Marina   Costa ')).toBe('Marina')
  })
  it('monta iniciais do primeiro e do último nome', () => {
    expect(iniciais('Marina de Souza Costa')).toBe('MC')
    expect(iniciais('bianca')).toBe('B')
    expect(iniciais('')).toBe('?')
  })
})

describe('CRP', () => {
  it('tem as 24 regiões com dois dígitos', () => {
    expect(REGIOES_CRP).toHaveLength(24)
    expect(REGIOES_CRP.every((r) => /^\d{2}$/.test(r.valor))).toBe(true)
  })
  it('formata como "CRP 08/12345"', () => {
    expect(formatarCrp('08', '12345')).toBe('CRP 08/12345')
    expect(formatarCrp(null, null)).toBeNull()
    expect(formatarCrp('08', null)).toBeNull()
  })
})

describe('validação', () => {
  it('e-mail', () => {
    expect(validarEmail('')).toBe('Informe seu e-mail.')
    expect(validarEmail('marina@')).toMatch(/e-mail válido/)
    expect(validarEmail(' marina.costa@example.com ')).toBeNull()
  })
  it('senha precisa de 8 caracteres, letras e números', () => {
    expect(validarSenhaNova('')).toBe('Crie uma senha.')
    expect(validarSenhaNova('abc123')).toMatch(/Senha fraca/)
    expect(validarSenhaNova('abcdefgh')).toMatch(/Senha fraca/)
    expect(validarSenhaNova('12345678')).toMatch(/Senha fraca/)
    expect(validarSenhaNova('senha-teste-123')).toBeNull()
  })
  it('nome', () => {
    expect(validarNome('   ')).toBe('Informe seu nome.')
    expect(validarNome('Marina Costa')).toBeNull()
  })
  it('CRP é opcional, mas região e número vão juntos', () => {
    expect(validarCrp('', '')).toEqual({})
    expect(validarCrp('08', '12345')).toEqual({})
    expect(validarCrp('08', '').numero).toBeTruthy()
    expect(validarCrp('', '12345').regiao).toBeTruthy()
    expect(validarCrp('08', '1234567').numero).toMatch(/até 6 dígitos/)
  })
})

describe('traduzirErroAuth', () => {
  it('usa o código do erro do Firebase', () => {
    expect(traduzirErroAuth({ code: 'auth/invalid-credential', message: 'Firebase: Error' })).toBe(
      'E-mail ou senha incorretos.',
    )
    expect(traduzirErroAuth({ code: 'auth/email-already-in-use' })).toBe('Já existe uma conta com este e-mail.')
    expect(traduzirErroAuth({ code: 'auth/expired-action-code' })).toMatch(/link expirou/)
  })
  it('reconhece falha de conexão', () => {
    expect(traduzirErroAuth({ code: 'auth/network-request-failed' })).toBe(ERRO_CONEXAO)
    expect(traduzirErroAuth({ name: 'TypeError', message: 'Failed to fetch' })).toBe(ERRO_CONEXAO)
  })
  it('nunca mostra a mensagem em inglês', () => {
    expect(traduzirErroAuth({ code: 'auth/algo-novo', message: 'Something unexpected' })).toBe(ERRO_GENERICO)
    expect(traduzirErroAuth(null)).toBe(ERRO_GENERICO)
  })
})
