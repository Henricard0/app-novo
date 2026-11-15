import { LayoutEntrada } from '@/components/layout/LayoutEntrada'

/** Mostrada quando faltam as variáveis do Firebase no .env.local. */
export function ConfiguracaoAusente() {
  return (
    <LayoutEntrada titulo="Falta configurar o Firebase">
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-ink-2">
        <li>
          Copie <code className="rounded bg-bg px-1">.env.example</code> para{' '}
          <code className="rounded bg-bg px-1">.env.local</code>.
        </li>
        <li>
          Para testar sem conta no Firebase, rode <code className="rounded bg-bg px-1">npm run emuladores</code> e use os
          valores de exemplo. Para um projeto real, copie os valores de Project settings → Your apps → Config.
        </li>
        <li>Reinicie o servidor de desenvolvimento.</li>
      </ol>
    </LayoutEntrada>
  )
}
