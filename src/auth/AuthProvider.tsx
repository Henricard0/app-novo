import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { auth, db } from '@/lib/firebase'
import type { PerfilDoc } from '@/types/modelo'
import { ContextoAuth, type EstadoAuth, type Perfil } from './contexto'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true)
  const [usuarioFirebase, setUsuarioFirebase] = useState<User | null>(null)
  // Perfil guardado junto com o id de quem ele é, para nunca mostrar o perfil de uma sessão anterior.
  const [perfilLido, setPerfilLido] = useState<{ id: string; perfil: Perfil | null } | null>(null)

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUsuarioFirebase(u)
        setCarregando(false)
      }),
    [],
  )

  // Conta com e-mail ainda não confirmado não conta como sessão: logo após o
  // cadastro o Firebase entra sozinho, e o app não deve tratar isso como login.
  const usuario = usuarioFirebase?.emailVerified ? usuarioFirebase : null
  const idUsuario = usuario?.uid ?? null

  useEffect(() => {
    if (!idUsuario) return
    let ativo = true
    getDoc(doc(db, 'profiles', idUsuario))
      .then((instantaneo) => {
        const dados = instantaneo.data() as PerfilDoc | undefined
        const perfil = dados
          ? { id: idUsuario, full_name: dados.full_name, crp_region: dados.crp_region, crp_number: dados.crp_number }
          : null
        if (ativo) setPerfilLido({ id: idUsuario, perfil })
      })
      .catch(() => {
        if (ativo) setPerfilLido({ id: idUsuario, perfil: null })
      })
    return () => {
      ativo = false
    }
  }, [idUsuario])

  const perfil = perfilLido && perfilLido.id === idUsuario ? perfilLido.perfil : null

  const sair = useCallback(async () => {
    await signOut(auth)
  }, [])

  const valor = useMemo<EstadoAuth>(() => ({ carregando, usuario, perfil, sair }), [carregando, usuario, perfil, sair])

  return <ContextoAuth.Provider value={valor}>{children}</ContextoAuth.Provider>
}
