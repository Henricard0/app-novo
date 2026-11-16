import type { ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router'
import { classesBotao, type VarianteBotao } from './estilos-botao'

type BotaoProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBotao
  /** Mostra o texto de carregamento e bloqueia novos cliques. */
  carregando?: boolean
  textoCarregando?: string
}

export function Botao({
  variante = 'primario',
  carregando = false,
  textoCarregando = 'Aguarde…',
  className = '',
  type = 'button',
  disabled,
  children,
  ...resto
}: BotaoProps) {
  return (
    <button
      type={type}
      className={classesBotao(variante, className)}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      {...resto}
    >
      {carregando ? textoCarregando : children}
    </button>
  )
}

export function LinkBotao({ variante = 'primario', className = '', ...resto }: LinkProps & { variante?: VarianteBotao }) {
  return <Link className={classesBotao(variante, className)} {...resto} />
}
