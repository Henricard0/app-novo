import { traduzirErroAuth } from '@/lib/erros-auth'
import { supabase } from '@/lib/supabase'

type Resultado = { erro: string | null }

export async function entrar(email: string, senha: string): Promise<Resultado> {
  try {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
    return { erro: error ? traduzirErroAuth(error) : null }
  } catch (e) {
    return { erro: traduzirErroAuth(e) }
  }
}

export type DadosCadastro = {
  nome: string
  email: string
  senha: string
  crpRegiao: string
  crpNumero: string
}

/** `precisaConfirmar` é true quando o e-mail precisa ser confirmado antes de entrar. */
export async function criarConta(dados: DadosCadastro): Promise<Resultado & { precisaConfirmar: boolean }> {
  try {
    const temCrp = Boolean(dados.crpRegiao && dados.crpNumero.trim())
    const { data, error } = await supabase.auth.signUp({
      email: dados.email.trim(),
      password: dados.senha,
      options: {
        emailRedirectTo: `${window.location.origin}/inicio`,
        data: {
          full_name: dados.nome.trim(),
          crp_region: temCrp ? dados.crpRegiao : null,
          crp_number: temCrp ? dados.crpNumero.trim() : null,
        },
      },
    })
    if (error) return { erro: traduzirErroAuth(error), precisaConfirmar: false }
    return { erro: null, precisaConfirmar: !data.session }
  } catch (e) {
    return { erro: traduzirErroAuth(e), precisaConfirmar: false }
  }
}

export type DadosCadastroContador = {
  nome: string
  email: string
  senha: string
  crcUf: string
  crcNumero: string
  crcCategoria: 'contador' | 'tecnico'
}

/** Cadastro pela área do contador: a conta nasce como "contador" e não muda depois. */
export async function criarContaContador(dados: DadosCadastroContador): Promise<Resultado & { precisaConfirmar: boolean }> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: dados.email.trim(),
      password: dados.senha,
      options: {
        emailRedirectTo: `${window.location.origin}/contador`,
        data: {
          full_name: dados.nome.trim(),
          account_type: 'contador',
          crc_state: dados.crcUf,
          crc_number: dados.crcNumero.trim(),
          crc_category: dados.crcCategoria,
        },
      },
    })
    if (error) return { erro: traduzirErroAuth(error), precisaConfirmar: false }
    return { erro: null, precisaConfirmar: !data.session }
  } catch (e) {
    return { erro: traduzirErroAuth(e), precisaConfirmar: false }
  }
}

export async function pedirNovaSenha(email: string): Promise<Resultado> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/nova-senha`,
    })
    return { erro: error ? traduzirErroAuth(error) : null }
  } catch (e) {
    return { erro: traduzirErroAuth(e) }
  }
}

export async function definirNovaSenha(senha: string): Promise<Resultado> {
  try {
    const { error } = await supabase.auth.updateUser({ password: senha })
    return { erro: error ? traduzirErroAuth(error) : null }
  } catch (e) {
    return { erro: traduzirErroAuth(e) }
  }
}
