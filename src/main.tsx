import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/App'
import { firebaseConfigurado } from '@/lib/firebase'
import { ConfiguracaoAusente } from '@/pages/ConfiguracaoAusente'
import '@/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{firebaseConfigurado ? <App /> : <ConfiguracaoAusente />}</StrictMode>,
)
