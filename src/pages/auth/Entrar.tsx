import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { entrar } from '@/auth/api'
import { Aviso } from '@/components/ui/Aviso'
import { Botao } from '@/components/ui/Botao'
import { CampoSenha } from '@/components/ui/CampoSenha'
import { CampoTexto } from '@/components/ui/CampoTexto'
import { LayoutEntrada } from '@/components/layout/LayoutEntrada'
import { useTituloPagina } from '@/lib/titulo'
import { validarEmail } from '@/lib/validacao'

/** Links de e-mail que falharam voltam com error_code na URL (query ou hash). */
function erroDoLink(search: string, hash: string): string | null {
  const params = new URLSearchParams(search)
  const doHash = new URLSearchParams(hash.replace(/^#/, ''))
  const codigo = params.get('error_code') ?? doHash.get('error_code')
  if (!codigo && !params.get('error') && !doHash.get('error')) return null
  return 'O link expirou ou já foi usado. Entre com sua senha ou peça um novo link.'
}

export function Entrar({ area }: { area?: 'contador' }) {
  const contador = area === 'contador'
  useTituloPagina(contador ? 'Entrar na área do contador' : 'Entrar')
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erros, setErros] = useState<{ email?: string | null; senha?: string | null }>({})
  const [erroGeral, setErroGeral] = useState<string | null>(() => erroDoLink(location.search, location.hash))
  const [enviando, setEnviando] = useState(false)

  async function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const novosErros = { email: validarEmail(email), senha: senha ? null : 'Informe sua senha.' }
    setErros(novosErros)
    setErroGeral(null)
    if (novosErros.email || novosErros.senha) return

    setEnviando(true)
    const { erro } = await entrar(email, senha)
    setEnviando(false)
    if (erro) setErroGeral(erro)
    // Com sucesso, a sessão muda e a rota redireciona sozinha.
  }

  return (
    <LayoutEntrada
      titulo="Entrar"
      area={area}
      subtitulo={contador ? 'Acesse seus clientes psicólogos.' : 'Acesse seu consultório e sua supervisão.'}
    >
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
          erro={erros.email}
        />
        <CampoSenha
          rotulo="Senha"
          name="senha"
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          erro={erros.senha}
        />
        <Botao type="submit" carregando={enviando} textoCarregando="Entrando…" className="w-full">
          Entrar
        </Botao>
      </form>
      <div className="flex flex-col gap-1 text-sm">
        <Link to="/esqueci-a-senha" className="inline-flex min-h-11 items-center font-semibold">
          Esqueci minha senha
        </Link>
        <p className="text-muted">
          Ainda não tem conta?{' '}
          <Link to={contador ? '/contador/cadastro' : '/criar-conta'} className="inline-flex min-h-11 items-center font-semibold">
            {contador ? 'Cadastrar como contador' : 'Criar conta'}
          </Link>
        </p>
        <p className="text-muted">
          {contador ? 'É psicólogo? ' : 'É contador? '}
          <Link to={contador ? '/entrar' : '/contador/entrar'} className="inline-flex min-h-11 items-center font-semibold">
            {contador ? 'Entrar no consultório' : 'Acessar a área do contador'}
          </Link>
        </p>
      </div>
    </LayoutEntrada>
  )
}
