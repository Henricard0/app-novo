import { useId, useState, type InputHTMLAttributes } from 'react'
import { CLASSES_CAMPO } from './campo-estilos'

type CampoSenhaProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> & {
  rotulo: string
  ajuda?: string
  erro?: string | null
}

export function CampoSenha({ rotulo, ajuda, erro, className = '', ...resto }: CampoSenhaProps) {
  const id = useId()
  const [visivel, setVisivel] = useState(false)
  const idAjuda = ajuda ? `${id}-ajuda` : undefined
  const idErro = erro ? `${id}-erro` : undefined
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold text-ink-2">
        {rotulo}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visivel ? 'text' : 'password'}
          className={`${CLASSES_CAMPO} pr-24`}
          aria-invalid={erro ? true : undefined}
          aria-describedby={[idErro, idAjuda].filter(Boolean).join(' ') || undefined}
          {...resto}
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-controls={id}
          aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
          className="absolute inset-y-0 right-0 min-h-11 min-w-11 rounded-r-control px-3 text-[13px] font-semibold text-pine hover:text-pine-dark"
        >
          {visivel ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
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
