import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { definirNovaSenha } from '@/auth/api'
import { useAuth } from '@/auth/contexto'
import { Aviso } from '@/components/ui/Aviso'
import { Botao, LinkBotao } from '@/components/ui/Botao'
import { CampoSenha } from '@/components/ui/CampoSenha'
import { TelaCarregando } from '@/components/ui/TelaCarregando'
import { LayoutEntrada } from '@/components/layout/LayoutEntrada'
import { useTituloPagina } from '@/lib/titulo'
import { REGRA_SENHA, validarSenhaNova } from '@/lib/validacao'

/** Aberta pelo link do e-mail de redefinição (que já inicia a sessão). */
export function NovaSenha() {
  useTituloPagina('Nova senha')
  const { carregando, session } = useAuth()
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erros, setErros] = useState<{ senha?: string | null; confirmacao?: string | null }>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [concluido, setConcluido] = useState(false)

  if (carregando) return <TelaCarregando />

  if (!session) {
    return (
      <LayoutEntrada titulo="Link inválido ou expirado">
        <p className="text-sm text-ink-2">
          Este link de redefinição não vale mais. Peça um novo e abra o e-mail no mesmo navegador em que fez o pedido.
        </p>
        <LinkBotao to="/esqueci-a-senha" className="w-full">
          Pedir novo link
        </LinkBotao>
      </LayoutEntrada>
    )
  }

  async function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const novosErros = {
      senha: validarSenhaNova(senha),
      confirmacao: confirmacao === senha ? null : 'As senhas não são iguais.',
    }
    setErros(novosErros)
    setErroGeral(null)
    if (novosErros.senha || novosErros.confirmacao) return

    setEnviando(true)
    const { erro } = await definirNovaSenha(senha)
    setEnviando(false)
    if (erro) setErroGeral(erro)
    else setConcluido(true)
  }

  if (concluido) {
    return (
      <LayoutEntrada titulo="Senha alterada">
        <Aviso tom="sucesso">Pronto. Use a nova senha da próxima vez que entrar.</Aviso>
        <LinkBotao to="/inicio" className="w-full">
          Ir para o início
        </LinkBotao>
      </LayoutEntrada>
    )
  }

  return (
    <LayoutEntrada titulo="Criar nova senha">
      <form noValidate onSubmit={aoEnviar} className="flex flex-col gap-5">
        {erroGeral ? <Aviso tom="erro">{erroGeral}</Aviso> : null}
        <CampoSenha
          rotulo="Nova senha"
          name="nova_senha"
          autoComplete="new-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          erro={erros.senha}
          ajuda={REGRA_SENHA}
        />
        <CampoSenha
          rotulo="Repita a nova senha"
          name="confirmacao_senha"
          autoComplete="new-password"
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          erro={erros.confirmacao}
        />
        <Botao type="submit" carregando={enviando} textoCarregando="Salvando…" className="w-full">
          Salvar nova senha
        </Botao>
      </form>
      <Link to="/inicio" className="inline-flex min-h-11 items-center text-sm font-semibold">
        Cancelar
      </Link>
    </LayoutEntrada>
  )
}
