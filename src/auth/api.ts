import {
  applyActionCode,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  deleteUser,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  verifyPasswordResetCode,
  type User,
} from 'firebase/auth'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { ERRO_EMAIL_NAO_CONFIRMADO, traduzirErroAuth } from '@/lib/erros-auth'
import { auth, db } from '@/lib/firebase'
import type { PerfilDoc } from '@/types/modelo'

type Resultado = { erro: string | null }

/** Depois de confirmar o e-mail ou trocar a senha, o link do e-mail volta para a tela de entrar. */
function configuracaoDoLink() {
  return { url: `${window.location.origin}/entrar` }
}

async function enviarConfirmacao(usuario: User): Promise<boolean> {
  try {
    await sendEmailVerification(usuario, configuracaoDoLink())
    return true
  } catch {
    return false
  }
}

export async function entrar(email: string, senha: string): Promise<Resultado> {
  try {
    const { user } = await signInWithEmailAndPassword(auth, email.trim(), senha)
    if (!user.emailVerified) {
      // Reenvia o link e não deixa a sessão aberta enquanto o e-mail não for confirmado.
      const reenviado = await enviarConfirmacao(user)
      await signOut(auth)
      return {
        erro: reenviado
          ? 'Confirme seu e-mail antes de entrar. Enviamos um novo link para você (veja também o spam).'
          : ERRO_EMAIL_NAO_CONFIRMADO,
      }
    }
    return { erro: null }
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

/** Cria a conta, grava o perfil e envia o e-mail de confirmação. A pessoa só entra depois de confirmar. */
export async function criarConta(dados: DadosCadastro): Promise<Resultado & { precisaConfirmar: boolean }> {
  try {
    const { user } = await createUserWithEmailAndPassword(auth, dados.email.trim(), dados.senha)
    const temCrp = Boolean(dados.crpRegiao && dados.crpNumero.trim())
    const perfil: PerfilDoc = {
      full_name: dados.nome.trim(),
      crp_region: temCrp ? dados.crpRegiao : null,
      crp_number: temCrp ? dados.crpNumero.trim() : null,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    }
    try {
      await setDoc(doc(db, 'profiles', user.uid), perfil)
    } catch (erroPerfil) {
      // Sem perfil a conta fica pela metade: desfaz, para a pessoa poder tentar de novo com o mesmo e-mail.
      await deleteUser(user).catch(() => undefined)
      await signOut(auth).catch(() => undefined)
      throw erroPerfil
    }
    // Se o envio falhar, o link é reenviado na primeira tentativa de entrar.
    await enviarConfirmacao(user)
    await signOut(auth)
    return { erro: null, precisaConfirmar: true }
  } catch (e) {
    return { erro: traduzirErroAuth(e), precisaConfirmar: false }
  }
}

export async function pedirNovaSenha(email: string): Promise<Resultado> {
  try {
    await sendPasswordResetEmail(auth, email.trim(), configuracaoDoLink())
    return { erro: null }
  } catch (e) {
    return { erro: traduzirErroAuth(e) }
  }
}

/** Confere o código do link de nova senha e devolve o e-mail da conta. */
export async function conferirLinkNovaSenha(codigo: string): Promise<{ erro: string | null; email: string | null }> {
  try {
    const email = await verifyPasswordResetCode(auth, codigo)
    return { erro: null, email }
  } catch (e) {
    return { erro: traduzirErroAuth(e), email: null }
  }
}

export async function definirNovaSenha(codigo: string, senha: string): Promise<Resultado> {
  try {
    await confirmPasswordReset(auth, codigo, senha)
    return { erro: null }
  } catch (e) {
    return { erro: traduzirErroAuth(e) }
  }
}

export async function confirmarEmail(codigo: string): Promise<Resultado> {
  try {
    await applyActionCode(auth, codigo)
    return { erro: null }
  } catch (e) {
    return { erro: traduzirErroAuth(e) }
  }
}
