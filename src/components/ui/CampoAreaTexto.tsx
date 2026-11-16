import { useId, type TextareaHTMLAttributes } from 'react'

type CampoAreaTextoProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & {
  rotulo: string
  ajuda?: string
  erro?: string | null
  opcional?: boolean
}

export function CampoAreaTexto({ rotulo, ajuda, erro, opcional, className = '', rows = 8, ...resto }: CampoAreaTextoProps) {
  const id = useId()
  const idAjuda = ajuda ? `${id}-ajuda` : undefined
  const idErro = erro ? `${id}-erro` : undefined
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold text-ink-2">
        {rotulo}
        {opcional ? <span className="font-normal text-muted"> (opcional)</span> : null}
      </label>
      <textarea
        id={id}
        rows={rows}
        className={
          'block w-full rounded-control border border-input-border bg-surface px-3 py-2.5 text-[15px] leading-relaxed text-ink ' +
          'placeholder:text-muted focus:border-pine focus:outline-2 focus:outline-offset-0 focus:outline-pine/30 ' +
          'aria-invalid:border-danger'
        }
        aria-invalid={erro ? true : undefined}
        aria-describedby={[idErro, idAjuda].filter(Boolean).join(' ') || undefined}
        {...resto}
      />
      {erro ? (
        <p id={idErro} className="text-[13px] font-medium text-danger">
          {erro}
        </p>
      ) : null}
      {ajuda ? (
        <p id={idAjuda} className="text-[13px] text-muted">
          {ajuda}
        </p>
      ) : null}
    </div>
  )
}
