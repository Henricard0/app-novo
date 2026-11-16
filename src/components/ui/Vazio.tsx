import type { ReactNode } from 'react'

/** Estado vazio de uma lista ou cartão. */
export function Vazio({ titulo, detalhe, children }: { titulo: string; detalhe?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-control bg-bg px-4 py-5">
      <p className="text-[15px] font-semibold text-ink-2">{titulo}</p>
      {detalhe ? <p className="text-sm text-muted">{detalhe}</p> : null}
      {children}
    </div>
  )
}
