import { useId, type ReactNode } from 'react'

type CartaoProps = {
  titulo: string
  /** Texto ou link à direita do título. */
  extra?: ReactNode
  /** Cartões de supervisão levam a borda superior âmbar. */
  destaque?: 'supervisao'
  className?: string
  children: ReactNode
}

export function Cartao({ titulo, extra, destaque, className = '', children }: CartaoProps) {
  const id = useId()
  const borda = destaque === 'supervisao' ? 'border-t-4 border-t-ocre' : ''
  return (
    <section
      aria-labelledby={id}
      className={`flex min-w-0 flex-col gap-4 rounded-card border border-border bg-surface p-5 sm:p-6 ${borda} ${className}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="text-lg font-bold">
          {titulo}
        </h2>
        {extra ? <div className="text-[13px] text-muted">{extra}</div> : null}
      </div>
      {children}
    </section>
  )
}
