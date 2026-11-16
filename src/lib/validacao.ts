export const REGRA_SENHA = 'Mínimo de 8 caracteres, com letras e números.'

export function validarEmail(email: string): string | null {
  const valor = email.trim()
  if (!valor) return 'Informe seu e-mail.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) return 'Digite um e-mail válido, como nome@exemplo.com.'
  return null
}

export function validarSenhaNova(senha: string): string | null {
  if (!senha) return 'Crie uma senha.'
  if (senha.length < 8 || !/[A-Za-zÀ-ÿ]/.test(senha) || !/[0-9]/.test(senha)) return `Senha fraca. ${REGRA_SENHA}`
  return null
}

export function validarNome(nome: string): string | null {
  const valor = nome.trim()
  if (!valor) return 'Informe seu nome.'
  if (valor.length > 200) return 'Use no máximo 200 caracteres.'
  return null
}

/** CRP é opcional (estagiários não têm), mas região e número vão juntos. */
export function validarCrp(regiao: string, numero: string): { regiao?: string; numero?: string } {
  const n = numero.trim()
  if (!regiao && !n) return {}
  if (regiao && !n) return { numero: 'Informe o número do CRP ou deixe a região em branco.' }
  if (!regiao && n) return { regiao: 'Escolha a região do CRP.' }
  if (!/^[0-9]{1,6}$/.test(n)) return { numero: 'Use só números, até 6 dígitos.' }
  return {}
}
