import { useEffect } from 'react'

/** Define o título da aba: "Início · Tríade". */
export function useTituloPagina(titulo: string) {
  useEffect(() => {
    document.title = titulo ? `${titulo} · Tríade` : 'Tríade'
  }, [titulo])
}
