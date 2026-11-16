export function saudacao(agora: Date = new Date()): 'Bom dia' | 'Boa tarde' | 'Boa noite' {
  const hora = agora.getHours()
  if (hora >= 5 && hora < 12) return 'Bom dia'
  if (hora >= 12 && hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

const FORMATO_DIA = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

/** "Sexta, 13 de novembro" */
export function dataPorExtenso(data: Date = new Date()): string {
  const texto = FORMATO_DIA.format(data).replace('-feira', '')
  return texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1)
}
