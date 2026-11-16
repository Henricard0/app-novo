import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { pedirNovaSenha } from '@/auth/api'
import { Aviso } from '@/components/ui/Aviso'
import { Botao } from '@/components/ui/Botao'
import { CampoTexto } from '@/components/ui/CampoTexto'
import { LayoutEntrada } from '@/components/layout/LayoutEntrada'
import { useTituloPagina } from '@/lib/titulo'
import { validarEmail } from '@/lib/validacao'

export function EsqueciSenha() {
  useTituloPagina('Esqueci minha senha')
  const [email, setEmail] = useState('')
  const [erroEmail, setErroEmail] = useState<string | null>(null)
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const erro = validarEmail(email)
    setErroEmail(erro)
    setErroGeral(null)
    if (erro) return

    setEnviando(true)
    const resultado = await pedirNovaSenha(email)
    setEnviando(false)
    if (resultado.erro) setErroGeral(resultado.erro)
    else setEnviado(true)
  }

  return (
    <LayoutEntrada
      titulo="Esqueci minha senha"
      subtitulo="Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha."
    >
      {enviado ? (
        <Aviso tom="sucesso">
          Se houver uma conta com <strong>{email.trim()}</strong>, você vai receber o link em instantes. Ele vale por 1
          hora.
        </Aviso>
      ) : (
        <form noValidate onSubmit={aoEnviar} className="flex flex-col gap-5">
          {erroGeral ? <Aviso tom="erro">{erroGeral}</Aviso> : null}
          <CampoTexto
            rotulo="E-mail"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            erro={erroEmail}
          />
          <Botao type="submit" carregando={enviando} textoCarregando="Enviando…" className="w-full">
            Enviar link
          </Botao>
        </form>
      )}
      <Link to="/entrar" className="inline-flex min-h-11 items-center text-sm font-semibold">
        Voltar para entrar
      </Link>
    </LayoutEntrada>
  )
}
