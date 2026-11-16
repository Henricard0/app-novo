import { describe, expect, it } from 'vitest'
import { anonimizar, rotuloDoCaso, rotuloDoPeriodo, variantesDoNome, type OpcoesAnonimizacao } from './anonimizar'

const BASE: OpcoesAnonimizacao = {
  nomesPaciente: ['Ana Beatriz Souza', 'Bia'],
  nomesContatos: ['Cláudia Souza'],
  rotuloPaciente: 'A paciente',
  datasMesAno: true,
  termosExtras: [],
}

describe('anonimização (dados fictícios)', () => {
  it('troca o nome da paciente, com maiúscula só no começo da frase', () => {
    const { texto } = anonimizar('Ana Beatriz relatou cansaço. Depois, Bia disse que ana voltaria.', BASE)
    expect(texto).toBe('A paciente relatou cansaço. Depois, a paciente disse que a paciente voltaria.')
  })

  it('não confunde partes de outras palavras', () => {
    const { texto } = anonimizar('Ela fez uma análise com a banana.', { ...BASE, nomesPaciente: ['Ana'] })
    expect(texto).toBe('Ela fez uma análise com a banana.')
  })

  it('ignora acentos e maiúsculas ao procurar nomes', () => {
    const { texto } = anonimizar('A mãe, CLAUDIA, voltou a morar com ela.', BASE)
    expect(texto).toBe('A mãe, [nome removido], voltou a morar com ela.')
  })

  it('remove contatos, documentos e endereços', () => {
    const { texto, trocas } = anonimizar(
      'Contato: ana.souza@example.com, (41) 99999-0000, CPF 123.456.789-09, RG 12.345.678-9. Mora na Rua das Flores, 123, no bairro Água Verde, CEP 80000-000.',
      BASE,
    )
    expect(texto).not.toMatch(/example\.com|99999|123\.456|12\.345|Flores|Água Verde|80000/)
    expect(texto).toContain('[e-mail removido]')
    expect(texto).toContain('[telefone removido]')
    expect(texto).toContain('[CPF removido]')
    expect(texto).toContain('[endereço removido]')
    expect(texto).toContain('no [local removido]')
    expect(trocas.map((t) => t.tipo)).toEqual(expect.arrayContaining(['E-mail', 'Telefone', 'CPF', 'Documento', 'CEP', 'Endereço', 'Local']))
  })

  it('troca datas exatas por mês e ano, se pedido', () => {
    expect(anonimizar('Em 06/11/2026 ela faltou.', BASE).texto).toBe('Em nov/2026 ela faltou.')
    expect(anonimizar('Em 06/11/26 ela faltou.', BASE).texto).toBe('Em nov/2026 ela faltou.')
    expect(anonimizar('Em 06/11/2026 ela faltou.', { ...BASE, datasMesAno: false }).texto).toBe('Em 06/11/2026 ela faltou.')
  })

  it('remove os trechos marcados pelo psicólogo', () => {
    const { texto } = anonimizar('Trabalha na Transportes Ribeiro desde 2020.', { ...BASE, termosExtras: ['Transportes Ribeiro'] })
    expect(texto).toBe('Trabalha na [removido] desde 2020.')
  })

  it('lista o que foi trocado', () => {
    const { trocas } = anonimizar('Ana Beatriz e Cláudia vieram.', BASE)
    expect(trocas).toEqual([
      { tipo: 'Nome de familiar ou contato', original: 'Cláudia', substituto: '[nome removido]' },
      { tipo: 'Nome do paciente', original: 'Ana Beatriz', substituto: 'A paciente' },
    ])
  })

  it('formas do nome ignoram "da", "de", "dos"', () => {
    expect(variantesDoNome('Maria da Silva Santos')).toEqual(['Maria da Silva Santos', 'Maria da Silva', 'Maria', 'Silva', 'Santos'])
  })

  it('rótulos do caso e do período', () => {
    expect(rotuloDoCaso('Ana Beatriz Souza', 34, true)).toBe('Paciente A., 34 anos')
    expect(rotuloDoCaso('Élida', 34, false)).toBe('Paciente E.')
    expect(rotuloDoPeriodo('2026-11-06', true)).toBe('Sessão · nov/2026')
    expect(rotuloDoPeriodo('2026-11-06', false)).toBe('Sessão · 06/11/2026')
  })
})
