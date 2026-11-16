import { useId, type InputHTMLAttributes } from 'react'
import { CLASSES_CAMPO } from './campo-estilos'

type CampoTextoProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  rotulo: string
  ajuda?: string
  erro?: string | null
  /** Mostra "(opcional)" ao lado do rótulo. */
  opcional?: boolean
}

export function CampoTexto({ rotulo, ajuda, erro, opcional, className = '', ...resto }: CampoTextoProps) {
  const id = useId()
  const idAjuda = ajuda ? `${id}-ajuda` : undefined
  const idErro = erro ? `${id}-erro` : undefined
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold text-ink-2">
        {rotulo}
        {opcional ? <span className="font-normal text-muted"> (opcional)</span> : null}
      </label>
      <input
        id={id}
        className={CLASSES_CAMPO}
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
