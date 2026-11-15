export type VarianteBotao = 'primario' | 'secundario' | 'supervisao'

const BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 text-sm font-semibold no-underline ' +
  'transition-colors disabled:cursor-not-allowed disabled:opacity-60'

const VARIANTES: Record<VarianteBotao, string> = {
  primario: 'bg-pine text-white hover:bg-pine-dark hover:text-white',
  secundario: 'border border-border-strong bg-surface text-ink hover:bg-bg hover:text-ink',
  supervisao: 'border border-ocre bg-surface text-ocre-text hover:bg-ocre-soft hover:text-ocre-text',
}

export function classesBotao(variante: VarianteBotao = 'primario', extra = ''): string {
  return [BASE, VARIANTES[variante], extra].filter(Boolean).join(' ')
}
