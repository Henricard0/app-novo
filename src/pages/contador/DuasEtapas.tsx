import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useAuth } from '@/auth/contexto'
import { Aviso } from '@/components/ui/Aviso'
import { Botao } from '@/components/ui/Botao'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { CampoTexto } from '@/components/ui/CampoTexto'
import { TelaCarregando } from '@/components/ui/TelaCarregando'
import { confirmarCodigo, iniciarAtivacao, situacaoDuasEtapas } from '@/lib/contador/api'
import { useConsulta } from '@/lib/consultorio/useConsulta'
import { useTituloPagina } from '@/lib/titulo'

type Ativacao = { fatorId: string; qrCode: string; segredo: string }

/** /contador/seguranca — ativa ou confirma a verificação em duas etapas (obrigatória para contadores). */
export function DuasEtapas() {
  useTituloPagina('Verificação em duas etapas')
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const destino = (location.state as { de?: string } | null)?.de
  const situacao = useConsulta(`duas-etapas:${session?.access_token ?? ''}`, situacaoDuasEtapas)
  const [ativacao, setAtivacao] = useState<Ativacao | null>(null)
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  if (situacao.carregando) return <TelaCarregando />

  async function comecar() {
    setErro(null)
    setOcupado(true)
    const r = await iniciarAtivacao()
    setOcupado(false)
    if (r.erro || !r.fatorId || !r.qrCode || !r.segredo) setErro(r.erro ?? 'Não foi possível começar a ativação.')
    else setAtivacao({ fatorId: r.fatorId, qrCode: r.qrCode, segredo: r.segredo })
  }

  async function confirmar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!/^\d{6}$/.test(codigo.replace(/\s/g, ''))) {
      setErro('Digite os 6 números que aparecem no aplicativo.')
      return
    }
    setErro(null)
    setOcupado(true)
    const r = await confirmarCodigo(codigo, ativacao?.fatorId)
    setOcupado(false)
    if (r.erro) {
      setErro(r.erro)
      return
    }
    navigate(destino && destino.startsWith('/contador') ? destino : '/contador', { replace: true })
  }

  const formulario = (
    <form noValidate onSubmit={confirmar} className="flex flex-col gap-4">
      <CampoTexto
        rotulo="Código de 6 números"
        name="codigo"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        className="max-w-48"
      />
      <Botao type="submit" className="w-fit" carregando={ocupado} textoCarregando="Conferindo…">
        Confirmar
      </Botao>
    </form>
  )

  return (
    <>
      <Cabecalho
        titulo="Verificação em duas etapas"
        subtitulo="Contadores acessam dados financeiros de vários clientes. Por isso, além da senha, pedimos um código do aplicativo autenticador."
      />
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {situacao.erro ? <Aviso tom="erro">{situacao.erro}</Aviso> : null}

      <section className="flex max-w-2xl flex-col gap-5 rounded-card border border-border bg-surface p-5 sm:p-6">
        {situacao.dados === 'confirmada' ? (
          <Aviso tom="sucesso">A verificação em duas etapas está ativa e confirmada nesta sessão.</Aviso>
        ) : situacao.dados === 'falta_codigo' ? (
          <>
            <p className="text-[15px] text-ink-2">Abra o aplicativo autenticador e digite o código do Tríade.</p>
            {formulario}
          </>
        ) : ativacao ? (
          <>
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-[15px] text-ink-2">
              <li>No aplicativo autenticador (Google Authenticator, Microsoft Authenticator, 1Password…), adicione uma conta.</li>
              <li>Leia o QR code abaixo ou digite a chave.</li>
              <li>Digite o código de 6 números que aparecer.</li>
            </ol>
            <img src={ativacao.qrCode} alt="QR code para o aplicativo autenticador" className="size-48 rounded-control border border-border bg-white p-2" />
            <p className="text-sm text-muted">
              Chave para digitar: <code className="break-all font-mono text-ink">{ativacao.segredo}</code>
            </p>
            {formulario}
          </>
        ) : (
          <>
            <p className="text-[15px] text-ink-2">
              Para ver seus clientes, ative a verificação em duas etapas. Você vai precisar de um aplicativo autenticador no celular.
            </p>
            <Botao className="w-fit" onClick={() => void comecar()} carregando={ocupado} textoCarregando="Preparando…">
              Ativar verificação em duas etapas
            </Botao>
          </>
        )}
      </section>
    </>
  )
}
