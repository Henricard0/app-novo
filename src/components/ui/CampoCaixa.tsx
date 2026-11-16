import { useId, type InputHTMLAttributes } from 'react'

type CampoCaixaProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> & { rotulo: string }

/** Caixa de marcar com área de toque de 44 px. */
export function CampoCaixa({ rotulo, className = '', ...resto }: CampoCaixaProps) {
  const id = useId()
  return (
    <div className={`flex min-h-11 items-center gap-3 ${className}`}>
      <input id={id} type="checkbox" className="size-5 shrink-0 accent-pine" {...resto} />
      <label htmlFor={id} className="text-[15px] text-ink-2">
        {rotulo}
      </label>
    </div>
  )
}
