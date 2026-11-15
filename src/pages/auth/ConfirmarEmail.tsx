import { useEffect, useState } from 'react'
import { confirmarEmail } from '@/auth/api'
import { Aviso } from '@/components/ui/Aviso'
import { LinkBotao } from '@/components/ui/Botao'
import { TelaCarregando } from '@/components/ui/TelaCarregando'
import { LayoutEntrada } from '@/components/layout/LayoutEntrada'
import { useTituloPagina } from '@/lib/titulo'
import { LinkInvalido } from './AcaoConta'

// Um código só pode ser usado uma vez; guardar o pedido evita a segunda chamada
// que o React faz em desenvolvimento (StrictMode).
const pedidos = new Map<string, ReturnType<typeof confirmarEmail>>()

export function ConfirmarEmail({ codigo }: { codigo: string }) {
  useTituloPagina('Confirmar e-mail')
  const [resultado, setResultado] = useState<{ codigo: string; erro: string | null } | null>(null)

  useEffect(() => {
    let ativo = true
    let pedido = pedidos.get(codigo)
    if (!pedido) {
      pedido = confirmarEmail(codigo)
      pedidos.set(codigo, pedido)
    }
    pedido.then(({ erro }) => {
      if (ativo) setResultado({ codigo, erro })
    })
    return () => {
      ativo = false
    }
  }, [codigo])

  if (!resultado || resultado.codigo !== codigo) return <TelaCarregando />
  if (resultado.erro) return <LinkInvalido />

  return (
    <LayoutEntrada titulo="E-mail confirmado">
      <Aviso tom="sucesso">Pronto, sua conta está ativa.</Aviso>
      <LinkBotao to="/entrar" className="w-full">
        Entrar
      </LinkBotao>
    </LayoutEntrada>
  )
}
