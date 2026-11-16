import type { ReactNode } from 'react'
import { Link } from 'react-router'

type CabecalhoProps = {
  titulo: string
  subtitulo?: ReactNode
  /** Link de volta, acima do título. */
  voltar?: { para: string; rotulo: string }
  /** Botões à direita (ou abaixo, no celular). */
  acoes?: ReactNode
}

export function Cabecalho({ titulo, subtitulo, voltar, acoes }: CabecalhoProps) {
  return (
    <div className="flex flex-col gap-3">
      {voltar ? (
        <Link to={voltar.para} className="inline-flex min-h-11 w-fit items-center text-sm font-semibold">
          ← {voltar.rotulo}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-[26px] font-bold tracking-[-0.01em] break-words sm:text-[30px]">{titulo}</h1>
          {subtitulo ? <div className="text-sm text-muted">{subtitulo}</div> : null}
        </div>
        {acoes ? <div className="flex flex-wrap gap-2">{acoes}</div> : null}
      </div>
    </div>
  )
}
