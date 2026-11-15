import { useSearchParams } from 'react-router'
import { LinkBotao } from '@/components/ui/Botao'
import { LayoutEntrada } from '@/components/layout/LayoutEntrada'
import { useTituloPagina } from '@/lib/titulo'
import { ConfirmarEmail } from './ConfirmarEmail'
import { NovaSenha } from './NovaSenha'

/**
 * Destino dos links dos e-mails do Firebase (confirmar e-mail, nova senha).
 * Para os links abrirem aqui, configure no Firebase: Authentication → Templates →
 * editar o modelo → "Customize action URL" → https://<site>/acao
 */
export function AcaoConta() {
  const [params] = useSearchParams()
  const modo = params.get('mode')
  const codigo = params.get('oobCode')

  if (codigo && modo === 'resetPassword') return <NovaSenha codigo={codigo} />
  if (codigo && modo === 'verifyEmail') return <ConfirmarEmail codigo={codigo} />
  return <LinkInvalido />
}

export function LinkInvalido({ pedirNovo = false }: { pedirNovo?: boolean }) {
  useTituloPagina('Link inválido')
  return (
    <LayoutEntrada titulo="Link inválido ou expirado">
      <p className="text-sm text-ink-2">
        {pedirNovo
          ? 'Este link de redefinição não vale mais. Peça um novo e use o link mais recente que chegar no seu e-mail.'
          : 'Este link não vale mais. Se você estava confirmando seu e-mail, tente entrar: enviamos um novo link se precisar.'}
      </p>
      <LinkBotao to={pedirNovo ? '/esqueci-a-senha' : '/entrar'} className="w-full">
        {pedirNovo ? 'Pedir novo link' : 'Ir para Entrar'}
      </LinkBotao>
    </LayoutEntrada>
  )
}
