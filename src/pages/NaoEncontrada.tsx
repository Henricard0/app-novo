import { LinkBotao } from '@/components/ui/Botao'
import { LayoutEntrada } from '@/components/layout/LayoutEntrada'
import { useTituloPagina } from '@/lib/titulo'

export function NaoEncontrada() {
  useTituloPagina('Página não encontrada')
  return (
    <LayoutEntrada titulo="Página não encontrada" subtitulo="O endereço pode ter mudado ou estar incompleto.">
      <LinkBotao to="/inicio" className="w-full">
        Ir para o início
      </LinkBotao>
    </LayoutEntrada>
  )
}
