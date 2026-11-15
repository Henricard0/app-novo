export function Logo({ tamanho = 'normal' }: { tamanho?: 'normal' | 'grande' }) {
  const grande = tamanho === 'grande'
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={grande ? 34 : 28} height={grande ? 34 : 28} viewBox="0 0 28 28" aria-hidden="true">
        <circle cx="14" cy="7" r="4.5" fill="#1E5A48" />
        <circle cx="7" cy="20" r="4.5" fill="#1E5A48" opacity="0.5" />
        <circle cx="21" cy="20" r="4.5" fill="#9A5512" />
      </svg>
      <span className={`font-display font-extrabold tracking-[-0.02em] text-ink ${grande ? 'text-2xl' : 'text-xl'}`}>
        Tríade
      </span>
    </span>
  )
}
