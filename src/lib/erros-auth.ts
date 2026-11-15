/** Traduz erros do Supabase Auth para mensagens em português. */
type ErroComCodigo = { code?: string; name?: string; message?: string; status?: number }

const MENSAGENS: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  email_not_confirmed: 'Confirme seu e-mail antes de entrar. Procure a mensagem que enviamos para você.',
  user_already_exists: 'Já existe uma conta com este e-mail.',
  email_exists: 'Já existe uma conta com este e-mail.',
  weak_password: 'Senha fraca. Use pelo menos 8 caracteres, com letras e números.',
  same_password: 'A nova senha precisa ser diferente da atual.',
  over_email_send_rate_limit: 'Muitos e-mails enviados em pouco tempo. Aguarde alguns minutos e tente de novo.',
  over_request_rate_limit: 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.',
  signup_disabled: 'Novos cadastros estão desativados no momento.',
  email_address_invalid: 'Este e-mail não é válido.',
  session_not_found: 'Sua sessão expirou. Entre de novo.',
  session_expired: 'Sua sessão expirou. Entre de novo.',
  reauthentication_needed: 'Por segurança, entre de novo antes de trocar a senha.',
  otp_expired: 'O link expirou ou já foi usado. Peça um novo.',
}

const POR_TEXTO: Array<[RegExp, string]> = [
  [/invalid login credentials/i, MENSAGENS.invalid_credentials!],
  [/email not confirmed/i, MENSAGENS.email_not_confirmed!],
  [/user already registered/i, MENSAGENS.user_already_exists!],
  [/password should/i, MENSAGENS.weak_password!],
  [/rate limit/i, MENSAGENS.over_request_rate_limit!],
]

export const ERRO_CONEXAO = 'Não foi possível conectar ao servidor. Verifique sua internet e tente de novo.'
export const ERRO_GENERICO = 'Algo deu errado. Tente de novo em instantes.'

export function traduzirErroAuth(erro: unknown): string {
  if (!erro || typeof erro !== 'object') return ERRO_GENERICO
  const e = erro as ErroComCodigo

  if (e.code && MENSAGENS[e.code]) return MENSAGENS[e.code]!
  if (e.name === 'AuthRetryableFetchError' || e.status === 0 || e.name === 'TypeError') return ERRO_CONEXAO

  const texto = e.message ?? ''
  for (const [padrao, mensagem] of POR_TEXTO) {
    if (padrao.test(texto)) return mensagem
  }
  return ERRO_GENERICO
}
