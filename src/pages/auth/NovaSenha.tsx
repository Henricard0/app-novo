import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { conferirLinkNovaSenha, definirNovaSenha } from '@/auth/api'
import { Aviso } from '@/components/ui/Aviso'
import { Botao, LinkBotao } from '@/components/ui/Botao'
import { CampoSenha } from '@/components/ui/CampoSenha'
import { TelaCarregando } from '@/components/ui/TelaCarregando'
import { LayoutEntrada } from '@/components/layout/LayoutEntrada'
import { useTituloPagina } from '@/lib/titulo'
import { REGRA_SENHA, validarSenhaNova } from '@/lib/validacao'
import { LinkInvalido } from './AcaoConta'

/** Aberta pelo link do e-mail de redefinição (via /acao). */
export function NovaSenha({ codigo }: { codigo: string }) {
  useTituloPagina('Nova senha')
  const [link, setLink] = useState<{ codigo: string; email: string | null } | null>(null)
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erros, setErros] = useState<{ senha?: string | null; confirmacao?: string | null }>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [concluido, setConcluido] = useState(false)

  useEffect(() => {
    let ativo = true
    conferirLinkNovaSenha(codigo).then(({ email }) => {
      if (ativo) setLink({ codigo, email })
    })
    return () => {
      ativo = false
    }
  }, [codigo])

  if (!link || link.codigo !== codigo) return <TelaCarregando />
  if (!link.email) return <LinkInvalido pedirNovo />

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
    const { erro } = await definirNovaSenha(codigo, senha)
    setEnviando(false)
    if (erro) setErroGeral(erro)
    else setConcluido(true)
  }

  if (concluido) {
    return (
      <LayoutEntrada titulo="Senha alterada">
        <Aviso tom="sucesso">Pronto. Agora é só entrar com a nova senha.</Aviso>
        <LinkBotao to="/entrar" className="w-full">
          Entrar
        </LinkBotao>
      </LayoutEntrada>
    )
  }

  return (
    <LayoutEntrada titulo="Criar nova senha" subtitulo={`Para a conta ${link.email}.`}>
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
      <Link to="/entrar" className="inline-flex min-h-11 items-center text-sm font-semibold">
        Cancelar
      </Link>
    </LayoutEntrada>
  )
}
