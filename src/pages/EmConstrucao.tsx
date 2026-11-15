import { useTituloPagina } from '@/lib/titulo'

type EmConstrucaoProps = {
  titulo: string
  fase: string
  descricao: string
}

/** Página provisória para áreas que chegam em fases futuras do roadmap. */
export function EmConstrucao({ titulo, fase, descricao }: EmConstrucaoProps) {
  useTituloPagina(titulo)
  return (
    <>
      <h1 className="text-[26px] font-bold tracking-[-0.01em] sm:text-[30px]">{titulo}</h1>
      <section className="flex flex-col gap-2 rounded-card border border-border bg-surface p-5 sm:p-6">
        <p className="w-fit rounded-full bg-chip-neutral px-2.5 py-1 text-xs font-semibold text-chip-neutral-text">
          Em construção · {fase}
        </p>
        <p className="text-[15px] text-ink-2">{descricao}</p>
      </section>
    </>
  )
}
