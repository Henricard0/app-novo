import { useEffect, useRef, useState } from 'react'

export type Resposta<T> = { dados: T | null; erro: string | null }

/**
 * Busca dados quando `chave` muda. Enquanto recarrega (recarregar()), mantém os
 * dados anteriores na tela para não piscar.
 */
export function useConsulta<T>(chave: string, buscar: () => Promise<Resposta<T>>) {
  const buscarAtual = useRef(buscar)
  const [estado, setEstado] = useState<{ chave: string; dados: T | null; erro: string | null } | null>(null)
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    buscarAtual.current = buscar
  })

  useEffect(() => {
    let ativo = true
    buscarAtual.current().then((r) => {
      if (ativo) setEstado({ chave, dados: r.dados, erro: r.erro })
    })
    return () => {
      ativo = false
    }
  }, [chave, versao])

  const atual = estado && estado.chave === chave ? estado : null
  return {
    carregando: !atual,
    dados: atual?.dados ?? null,
    erro: atual?.erro ?? null,
    recarregar: () => setVersao((v) => v + 1),
  }
}
