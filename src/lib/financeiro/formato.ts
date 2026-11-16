// Valores em reais, CPF e rótulos do financeiro.

const REAIS = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function emReais(valor: number | null | undefined): string {
  return REAIS.format(Number(valor ?? 0))
}

/** Lê "180", "180,5", "1.250,00" ou "R$ 90" e devolve o número; null se vazio ou inválido. */
export function lerReais(texto: string): number | null {
  const limpo = texto.replace(/R\$|\s/g, '').trim()
  if (!limpo) return null
  const normal = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo
  if (!/^\d+(\.\d{1,2})?$/.test(normal)) return null
  return Number(normal)
}

/** Número para o campo de texto: 180 → "180,00". */
export function paraCampoReais(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return ''
  return Number(valor).toFixed(2).replace('.', ',')
}

export function soDigitos(texto: string): string {
  return texto.replace(/\D/g, '')
}

/** Confere os dígitos verificadores do CPF. */
export function cpfValido(texto: string): boolean {
  const d = soDigitos(texto)
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const digito = (ate: number) => {
    let soma = 0
    for (let i = 0; i < ate; i++) soma += Number(d[i]) * (ate + 1 - i)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10])
}

export function formatarCpf(texto: string | null | undefined): string {
  const d = soDigitos(texto ?? '')
  if (d.length !== 11) return texto ?? ''
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export type SituacaoPagamento = 'a_receber' | 'pago' | 'isento'
export type FormaPagamento = 'pix' | 'cartao' | 'dinheiro' | 'transferencia' | 'outro'

export const ROTULO_PAGAMENTO: Record<SituacaoPagamento, string> = {
  a_receber: 'A receber',
  pago: 'Pago',
  isento: 'Sem cobrança',
}

export const ROTULO_FORMA: Record<FormaPagamento, string> = {
  pix: 'Pix',
  cartao: 'Cartão',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência',
  outro: 'Outra',
}

export const OPCOES_FORMA = (Object.keys(ROTULO_FORMA) as FormaPagamento[]).map((f) => ({ valor: f, rotulo: ROTULO_FORMA[f] }))

export type CategoriaDespesa = 'aluguel' | 'conselho' | 'supervisao' | 'material' | 'formacao' | 'impostos' | 'outros'

export const ROTULO_CATEGORIA: Record<CategoriaDespesa, string> = {
  aluguel: 'Aluguel e sala',
  conselho: 'Conselho (CRP)',
  supervisao: 'Supervisão',
  material: 'Material e testes',
  formacao: 'Cursos e formação',
  impostos: 'Impostos e taxas',
  outros: 'Outros',
}

export const OPCOES_CATEGORIA = (Object.keys(ROTULO_CATEGORIA) as CategoriaDespesa[]).map((c) => ({
  valor: c,
  rotulo: ROTULO_CATEGORIA[c],
}))

/** Primeiro dia do mês (data local). */
export function inicioDoMes(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), 1)
}

export function somarMeses(data: Date, meses: number): Date {
  return new Date(data.getFullYear(), data.getMonth() + meses, 1)
}

const MES = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })

/** "novembro de 2026" */
export function nomeDoMes(data: Date): string {
  return MES.format(data)
}

/** "2026-11" a partir de uma data local. */
export function chaveDoMes(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
}

/** Fator R = folha dos últimos 12 meses / receita dos últimos 12 meses. */
export function fatorR(folhaMensal: number | null, receita12Meses: number | null): number | null {
  if (folhaMensal === null || !receita12Meses) return null
  return (folhaMensal * 12) / receita12Meses
}
