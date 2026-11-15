/** Traduz erros do Firebase (Authentication e Firestore) para mensagens em português. */
type ErroComCodigo = { code?: string; name?: string; message?: string }

export const ERRO_CONEXAO = 'Não foi possível conectar ao servidor. Verifique sua internet e tente de novo.'
export const ERRO_GENERICO = 'Algo deu errado. Tente de novo em instantes.'
export const ERRO_EMAIL_NAO_CONFIRMADO =
  'Confirme seu e-mail antes de entrar. Procure a mensagem que enviamos para você (veja também o spam).'
export const ERRO_LINK = 'O link expirou ou já foi usado. Peça um novo.'

const MENSAGENS: Record<string, string> = {
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/invalid-login-credentials': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'E-mail ou senha incorretos.',
  'auth/missing-password': 'Informe sua senha.',
  'auth/invalid-email': 'Este e-mail não é válido.',
  'auth/missing-email': 'Informe seu e-mail.',
  'auth/user-disabled': 'Esta conta está desativada. Fale com o suporte.',
  'auth/email-already-in-use': 'Já existe uma conta com este e-mail.',
  'auth/weak-password': 'Senha fraca. Use pelo menos 8 caracteres, com letras e números.',
  'auth/password-does-not-meet-requirements': 'Senha fraca. Use pelo menos 8 caracteres, com letras e números.',
  'auth/too-many-requests': 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.',
  'auth/quota-exceeded': 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.',
  'auth/operation-not-allowed': 'O login por e-mail e senha não está ativado no Firebase.',
  'auth/admin-restricted-operation': 'Novos cadastros estão desativados no momento.',
  'auth/expired-action-code': ERRO_LINK,
  'auth/invalid-action-code': ERRO_LINK,
  'auth/requires-recent-login': 'Por segurança, entre de novo antes de trocar a senha.',
  'auth/user-token-expired': 'Sua sessão expirou. Entre de novo.',
  'auth/network-request-failed': ERRO_CONEXAO,
  'auth/unauthorized-continue-uri': 'Este endereço do site não está liberado no Firebase (Authorized domains).',
  'auth/unauthorized-domain': 'Este endereço do site não está liberado no Firebase (Authorized domains).',
  'auth/invalid-api-key': 'A configuração do Firebase está incorreta (chave da API).',
  'permission-denied': 'Você não tem permissão para fazer isso.',
  unavailable: ERRO_CONEXAO,
}

export function traduzirErroAuth(erro: unknown): string {
  if (!erro || typeof erro !== 'object') return ERRO_GENERICO
  const e = erro as ErroComCodigo
  if (e.code && MENSAGENS[e.code]) return MENSAGENS[e.code]!
  if (e.name === 'TypeError') return ERRO_CONEXAO
  return ERRO_GENERICO
}
