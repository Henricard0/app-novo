import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { criarConta } from '@/auth/api'
import { Aviso } from '@/components/ui/Aviso'
import { Botao } from '@/components/ui/Botao'
import { CampoSelecao } from '@/components/ui/CampoSelecao'
import { CampoSenha } from '@/components/ui/CampoSenha'
import { CampoTexto } from '@/components/ui/CampoTexto'
import { LayoutEntrada } from '@/components/layout/LayoutEntrada'
import { REGIOES_CRP } from '@/lib/crp'
import { useTituloPagina } from '@/lib/titulo'
import { REGRA_SENHA, validarCrp, validarEmail, validarNome, validarSenhaNova } from '@/lib/validacao'

type Erros = Partial<Record<'nome' | 'email' | 'senha' | 'crpRegiao' | 'crpNumero', string | null>>

export function CriarConta() {
  useTituloPagina('Criar conta')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [crpRegiao, setCrpRegiao] = useState('')
  const [crpNumero, setCrpNumero] = useState('')
  const [erros, setErros] = useState<Erros>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [emailEnviado, setEmailEnviado] = useState<string | null>(null)

  async function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const crp = validarCrp(crpRegiao, crpNumero)
    const novosErros: Erros = {
      nome: validarNome(nome),
      email: validarEmail(email),
      senha: validarSenhaNova(senha),
      crpRegiao: crp.regiao ?? null,
      crpNumero: crp.numero ?? null,
    }
    setErros(novosErros)
    setErroGeral(null)
    if (Object.values(novosErros).some(Boolean)) return

    setEnviando(true)
    const { erro, precisaConfirmar } = await criarConta({ nome, email, senha, crpRegiao, crpNumero })
    setEnviando(false)
    if (erro) {
      setErroGeral(erro)
      return
    }
    if (precisaConfirmar) setEmailEnviado(email.trim())
    // Sem confirmação de e-mail, a sessão já começa e a rota redireciona sozinha.
  }

  if (emailEnviado) {
    return (
      <LayoutEntrada titulo="Confira seu e-mail">
        <Aviso tom="sucesso">
          Enviamos um link de confirmação para <strong>{emailEnviado}</strong>. Abra o e-mail para ativar sua conta.
        </Aviso>
        <p className="text-sm text-muted">
          Não chegou? Procure na caixa de spam. Depois de confirmar, é só{' '}
          <Link to="/entrar" className="font-semibold">
            entrar
          </Link>
          .
        </p>
      </LayoutEntrada>
    )
  }

  return (
    <LayoutEntrada titulo="Criar conta" subtitulo="Para psicólogos, supervisores e estagiários.">
      <form noValidate onSubmit={aoEnviar} className="flex flex-col gap-5">
        {erroGeral ? <Aviso tom="erro">{erroGeral}</Aviso> : null}
        <CampoTexto
          rotulo="Nome completo"
          name="nome"
          autoComplete="name"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          erro={erros.nome}
        />
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

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1.5 text-sm font-semibold text-ink-2">
            Registro no CRP <span className="font-normal text-muted">(opcional para estagiários)</span>
          </legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1fr]">
            <CampoSelecao
              rotulo="Região"
              name="crp_regiao"
              opcoes={REGIOES_CRP}
              vazio="Escolha"
              value={crpRegiao}
              onChange={(e) => setCrpRegiao(e.target.value)}
              erro={erros.crpRegiao}
            />
            <CampoTexto
              rotulo="Número"
              name="crp_numero"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={crpNumero}
              onChange={(e) => setCrpNumero(e.target.value.replace(/\D/g, ''))}
              erro={erros.crpNumero}
            />
          </div>
        </fieldset>

        <CampoSenha
          rotulo="Senha"
          name="senha"
          autoComplete="new-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          erro={erros.senha}
          ajuda={REGRA_SENHA}
        />
        <Botao type="submit" carregando={enviando} textoCarregando="Criando conta…" className="w-full">
          Criar conta
        </Botao>
      </form>
      <p className="text-sm text-muted">
        Já tem conta?{' '}
        <Link to="/entrar" className="inline-flex min-h-11 items-center font-semibold">
          Entrar
        </Link>
      </p>
    </LayoutEntrada>
  )
}
