import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

const env = import.meta.env

/** false quando faltam as variáveis de ambiente; o app mostra uma tela explicando o que configurar. */
export const firebaseConfigurado = Boolean(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_APP_ID)

export const usandoEmulador = env.VITE_FIREBASE_EMULADOR === 'true'

// Sem Analytics nem outros serviços de medição (CLAUDE.md, regra 6).
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY || 'configuracao-ausente',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'configuracao-ausente',
  appId: env.VITE_FIREBASE_APP_ID,
})

export const auth = getAuth(app)
// E-mails de confirmação e de nova senha em português.
auth.languageCode = 'pt-BR'

export const db = getFirestore(app)

if (usandoEmulador) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
