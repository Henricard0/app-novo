import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { ContextoAuth, type EstadoAuth, type Perfil } from './contexto'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  // Perfil guardado junto com o id de quem ele é, para nunca mostrar o perfil de uma sessão anterior.
  const [versaoPerfil, setVersaoPerfil] = useState(0)
  const [perfilLido, setPerfilLido] = useState<{ id: string; perfil: Perfil | null } | null>(null)

  useEffect(() => {
    let ativo = true

    supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return
      setSession(data.session)
      setCarregando(false)
    })

    // Não chamar o Supabase dentro deste callback (pode travar o cliente):
    // só atualiza o estado; o perfil é lido no efeito abaixo.
    const { data } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      if (!ativo) return
      setSession(novaSessao)
      setCarregando(false)
    })

    return () => {
      ativo = false
      data.subscription.unsubscribe()
    }
  }, [])

  const idUsuario = session?.user.id ?? null

  useEffect(() => {
    if (!idUsuario) return
    let ativo = true
    supabase
      .from('profiles')
      .select('id, full_name, crp_region, crp_number')
      .eq('id', idUsuario)
      .maybeSingle()
      .then(({ data }) => {
        if (ativo) setPerfilLido({ id: idUsuario, perfil: data ?? null })
      })
    return () => {
      ativo = false
    }
  }, [idUsuario, versaoPerfil])

  const perfil = perfilLido && perfilLido.id === idUsuario ? perfilLido.perfil : null

  const sair = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const recarregarPerfil = useCallback(() => setVersaoPerfil((v) => v + 1), [])

  const valor = useMemo<EstadoAuth>(
    () => ({ carregando, session, user: session?.user ?? null, perfil, sair, recarregarPerfil }),
    [carregando, session, perfil, sair, recarregarPerfil],
  )

  return <ContextoAuth.Provider value={valor}>{children}</ContextoAuth.Provider>
}
