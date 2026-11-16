/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** "false" quando o Mercado Pago estiver em produção (cobranças reais). */
  readonly VITE_PAGAMENTO_TESTE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
