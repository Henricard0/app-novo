import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { criarContaContador } from '@/auth/api'
import { Aviso } from '@/components/ui/Aviso'
import { Botao } from '@/components/ui/Botao'
import { CampoSelecao } from '@/components/ui/CampoSelecao'
import { CampoSenha } from '@/components/ui/CampoSenha'
import { CampoTexto } from '@/components/ui/CampoTexto'
import { LayoutEntrada } from '@/components/layout/LayoutEntrada'
import { useTituloPagina } from '@/lib/titulo'
import { OPCOES_UF } from '@/lib/uf'
import { REGRA_SENHA, validarEmail, validarNome, validarSenhaNova } from '@/lib/validacao'

type Erros = Partial<Record<'nome' | 'email' | 'senha' | 'crcUf' | 'crcNumero', string | null>>

/** /contador/cadastro — cria uma conta de contador (separada da conta de psicólogo). */
export function CriarContaContador() {
  useTituloPagina('Cadastro de contador')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [crcUf, setCrcUf] = useState('')
  const [crcNumero, setCrcNumero] = useState('')
  const [categoria, setCategoria] = useState<'contador' | 'tecnico'>('contador')
  const [erros, setErros] = useState<Erros>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [emailEnviado, setEmailEnviado] = useState<string | null>(null)

  async function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const novosErros: Erros = {
      nome: validarNome(nome),
      email: validarEmail(email),
      senha: validarSenhaNova(senha),
      crcUf: crcUf ? null : 'Escolha o estado do CRC.',
      crcNumero: /^\d{1,6}$/.test(crcNumero.trim()) ? null : 'Informe o número do CRC (só números, até 6 dígitos).',
    }
    setErros(novosErros)
    setErroGeral(null)
    if (Object.values(novosErros).some(Boolean)) return

    setEnviando(true)
    const { erro, precisaConfirmar } = await criarContaContador({ nome, email, senha, crcUf, crcNumero, crcCategoria: categoria })
    setEnviando(false)
    if (erro) {
      setErroGeral(erro)
      return
    }
    if (precisaConfirmar) setEmailEnviado(email.trim())
  }

  if (emailEnviado) {
    return (
      <LayoutEntrada titulo="Confira seu e-mail" area="contador">
        <Aviso tom="sucesso">
          Enviamos um link de confirmação para <strong>{emailEnviado}</strong>. Abra o e-mail para ativar sua conta.
        </Aviso>
        <p className="text-sm text-muted">
          Depois de confirmar, é só{' '}
          <Link to="/contador/entrar" className="font-semibold">
            entrar
          </Link>{' '}
          e ativar a verificação em duas etapas.
        </p>
      </LayoutEntrada>
    )
  }

  return (
    <LayoutEntrada
      titulo="Cadastro de contador"
      area="contador"
      subtitulo="Uma conta só para atender psicólogos. Ela não dá acesso a consultório, prontuário nem supervisão."
    >
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
          ajuda="Use um e-mail diferente da sua conta de psicólogo, se tiver uma."
        />
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1.5 text-sm font-semibold text-ink-2">Registro no CRC</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr]">
            <CampoSelecao
              rotulo="Estado"
              name="crc_uf"
              opcoes={OPCOES_UF}
              vazio="Escolha"
              value={crcUf}
              onChange={(e) => setCrcUf(e.target.value)}
              erro={erros.crcUf}
            />
            <CampoTexto
              rotulo="Número"
              name="crc_numero"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={crcNumero}
              onChange={(e) => setCrcNumero(e.target.value.replace(/\D/g, ''))}
              erro={erros.crcNumero}
            />
          </div>
          <CampoSelecao
            rotulo="Categoria"
            name="crc_categoria"
            opcoes={[
              { valor: 'contador', rotulo: 'Contador' },
              { valor: 'tecnico', rotulo: 'Técnico em contabilidade' },
            ]}
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as 'contador' | 'tecnico')}
          />
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
          Criar conta de contador
        </Botao>
      </form>
      <p className="text-sm text-muted">
        Já tem conta?{' '}
        <Link to="/contador/entrar" className="inline-flex min-h-11 items-center font-semibold">
          Entrar
        </Link>
      </p>
    </LayoutEntrada>
  )
}
