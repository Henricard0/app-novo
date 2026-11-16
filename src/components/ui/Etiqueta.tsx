import type { ReactNode } from 'react'

export type TomEtiqueta = 'ok' | 'atencao' | 'neutro'

const TONS: Record<TomEtiqueta, string> = {
  ok: 'bg-pine-soft text-pine',
  atencao: 'bg-ocre-soft text-ocre-text',
  neutro: 'bg-chip-neutral text-chip-neutral-text',
}

/** Chip de status (docs/design.md). */
export function Etiqueta({ tom = 'neutro', children }: { tom?: TomEtiqueta; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${TONS[tom]}`}>
      {children}
    </span>
  )
}
