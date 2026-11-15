import type { ReactNode } from 'react'

type TomAviso = 'erro' | 'sucesso' | 'info'

const TONS: Record<TomAviso, string> = {
  erro: 'border-danger/30 bg-danger-soft text-danger',
  sucesso: 'border-pine/20 bg-pine-soft text-pine-dark',
  info: 'border-ocre/30 bg-ocre-soft text-ocre-text',
}

/** Mensagem em destaque. Erros são anunciados na hora por leitores de tela. */
export function Aviso({ tom, children }: { tom: TomAviso; children: ReactNode }) {
  return (
    <div role={tom === 'erro' ? 'alert' : 'status'} className={`rounded-control border px-4 py-3 text-sm ${TONS[tom]}`}>
      {children}
    </div>
  )
}
