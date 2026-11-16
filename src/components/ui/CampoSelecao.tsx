import { useId, type SelectHTMLAttributes } from 'react'
import { CLASSES_CAMPO } from './campo-estilos'

type CampoSelecaoProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
  rotulo: string
  opcoes: ReadonlyArray<{ valor: string; rotulo: string }>
  /** Texto da primeira opção, vazia. */
  vazio?: string
  erro?: string | null
  opcional?: boolean
}

export function CampoSelecao({ rotulo, opcoes, vazio, erro, opcional, className = '', ...resto }: CampoSelecaoProps) {
  const id = useId()
  const idErro = erro ? `${id}-erro` : undefined
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold text-ink-2">
        {rotulo}
        {opcional ? <span className="font-normal text-muted"> (opcional)</span> : null}
      </label>
      <select
        id={id}
        className={CLASSES_CAMPO}
        aria-invalid={erro ? true : undefined}
        aria-describedby={idErro}
        {...resto}
      >
        {vazio !== undefined ? <option value="">{vazio}</option> : null}
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
      {erro ? (
        <p id={idErro} className="text-[13px] font-medium text-danger">
          {erro}
        </p>
      ) : null}
    </div>
  )
}
