import { nomeParaExibir, useAuth } from '@/auth/contexto'
import { Cartao } from '@/components/ui/Cartao'
import { dataPorExtenso, saudacao } from '@/lib/data'
import { primeiroNome } from '@/lib/texto'
import { useTituloPagina } from '@/lib/titulo'

function Vazio({ titulo, detalhe }: { titulo: string; detalhe: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-control bg-bg px-4 py-5">
      <p className="text-[15px] font-semibold text-ink-2">{titulo}</p>
      <p className="text-sm text-muted">{detalhe}</p>
    </div>
  )
}

export function Inicio() {
  useTituloPagina('Início')
  const auth = useAuth()
  const nome = primeiroNome(nomeParaExibir(auth))
  const agora = new Date()

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm text-muted">{dataPorExtenso(agora)}</p>
        <h1 className="text-[26px] font-bold tracking-[-0.01em] sm:text-[30px]">
          {saudacao(agora)}
          {nome ? `, ${nome}` : ''}
        </h1>
      </div>

      <div className="flex flex-wrap items-stretch gap-6">
        <Cartao titulo="Sessões de hoje" className="flex-[3_1_480px]">
          <Vazio titulo="Nenhuma sessão por enquanto." detalhe="A agenda chega na Fase 1 (consultório mínimo)." />
        </Cartao>

        <Cartao titulo="Supervisão" destaque="supervisao" className="flex-[2_1_300px]">
          <Vazio
            titulo="Você ainda não tem supervisão configurada."
            detalhe="Convites, pauta e devolutivas chegam na Fase 2."
          />
        </Cartao>
      </div>

      <Cartao titulo="Pendências">
        <Vazio titulo="Nada pendente." detalhe="Evoluções a registrar e outros lembretes vão aparecer aqui." />
      </Cartao>
    </>
  )
}
