export function primeiroNome(nomeCompleto: string): string {
  return nomeCompleto.trim().split(/\s+/)[0] ?? ''
}

/** Iniciais para o avatar: primeira letra do primeiro e do último nome. */
export function iniciais(nomeCompleto: string): string {
  const partes = nomeCompleto.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  const primeira = partes[0]!.charAt(0)
  const ultima = partes.length > 1 ? partes[partes.length - 1]!.charAt(0) : ''
  return (primeira + ultima).toLocaleUpperCase('pt-BR')
}
