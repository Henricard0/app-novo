import { useEffect, useId, useRef, type ReactNode } from 'react'

type DialogoProps = {
  aberto: boolean
  titulo: string
  aoFechar: () => void
  children: ReactNode
}

/**
 * Janela modal com o <dialog> nativo: o navegador prende o foco dentro dela,
 * fecha com Esc e devolve o foco ao botão que a abriu.
 */
export function Dialogo({ aberto, titulo, aoFechar, children }: DialogoProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const idTitulo = useId()

  useEffect(() => {
    const dialogo = ref.current
    if (!dialogo) return
    if (aberto && !dialogo.open) dialogo.showModal()
    if (!aberto && dialogo.open) dialogo.close()
  }, [aberto])

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      onClose={aoFechar}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-card border border-border bg-surface p-0 text-ink shadow-xl backdrop:bg-ink/40"
    >
      {aberto ? (
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <h2 id={idTitulo} className="text-lg font-bold">
            {titulo}
          </h2>
          {children}
        </div>
      ) : null}
    </dialog>
  )
}
