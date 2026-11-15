import type { ReactNode } from 'react'
import { Logo } from '@/components/ui/Logo'

/** Moldura das telas de entrada, cadastro e senha. */
export function LayoutEntrada({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center bg-bg px-4 py-10 sm:py-16">
      <div className="flex w-full max-w-[440px] flex-col gap-8">
        <div className="flex justify-center">
          <Logo tamanho="grande" />
        </div>
        <main className="flex flex-col gap-6 rounded-card border border-border bg-surface p-6 sm:p-8">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold tracking-[-0.01em]">{titulo}</h1>
            {subtitulo ? <p className="text-sm text-muted">{subtitulo}</p> : null}
          </div>
          {children}
        </main>
        <p className="text-center text-[13px] text-muted">Consultório e supervisão clínica no mesmo lugar.</p>
      </div>
    </div>
  )
}
