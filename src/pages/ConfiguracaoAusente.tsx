import { LayoutEntrada } from '@/components/layout/LayoutEntrada'

/** Mostrada quando faltam as variáveis do Supabase no .env.local. */
export function ConfiguracaoAusente() {
  return (
    <LayoutEntrada titulo="Falta configurar o Supabase">
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-ink-2">
        <li>
          Rode <code className="rounded bg-bg px-1">npm run db:start</code>.
        </li>
        <li>
          Copie <code className="rounded bg-bg px-1">.env.example</code> para{' '}
          <code className="rounded bg-bg px-1">.env.local</code> e preencha com os valores de{' '}
          <code className="rounded bg-bg px-1">npx supabase status</code>.
        </li>
        <li>Reinicie o servidor de desenvolvimento.</li>
      </ol>
    </LayoutEntrada>
  )
}
