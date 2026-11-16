import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/App'
import { supabaseConfigurado } from '@/lib/supabase'
import { ConfiguracaoAusente } from '@/pages/ConfiguracaoAusente'
import '@/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{supabaseConfigurado ? <App /> : <ConfiguracaoAusente />}</StrictMode>,
)
