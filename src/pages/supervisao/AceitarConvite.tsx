import { useState } from 'react'
import { useParams } from 'react-router'
import { Aviso } from '@/components/ui/Aviso'
import { Botao, LinkBotao } from '@/components/ui/Botao'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { TelaCarregando } from '@/components/ui/TelaCarregando'
import { useConsulta } from '@/lib/consultorio/useConsulta'
import { formatarCrp } from '@/lib/crp'
import { aceitarConvite, verConvite } from '@/lib/supervisao/api'
import { useTituloPagina } from '@/lib/titulo'

/** /convite/:token — quem não está logado passa pela tela de entrar e volta para cá. */
export function AceitarConvite() {
  useTituloPagina('Convite de supervisão')
  const { token = '' } = useParams()
  const convite = useConsulta(`convite:${token}`, () => verConvite(token))
  const [erro, setErro] = useState<string | null>(null)
  const [aceito, setAceito] = useState(false)
  const [enviando, setEnviando] = useState(false)

  if (convite.carregando) return <TelaCarregando />
  const c = convite.dados

  async function aceitar() {
    setEnviando(true)
    setErro(null)
    const r = await aceitarConvite(token)
    setEnviando(false)
    if (r.erro) setErro(r.erro)
    else setAceito(true)
  }

  if (!c || !c.valido) {
    return (
      <>
        <Cabecalho titulo="Convite de supervisão" />
        <Aviso tom="erro">
          {convite.erro ?? 'Este convite não vale mais: ele expirou, já foi usado ou foi criado por você mesmo.'}
        </Aviso>
        <LinkBotao to="/supervisao" variante="secundario" className="w-fit">
          Ir para Minha supervisão
        </LinkBotao>
      </>
    )
  }

  const crp = formatarCrp(c.inviter_crp_region, c.inviter_crp_number)
  const voceSera = c.inviter_role === 'supervisor' ? 'supervisionando(a)' : 'supervisor(a)'

  return (
    <>
      <Cabecalho titulo="Convite de supervisão" />
      <section className="flex max-w-xl flex-col gap-4 rounded-card border border-border border-t-4 border-t-ocre bg-surface p-5 sm:p-6">
        {aceito ? (
          <>
            <Aviso tom="sucesso">Pronto! O vínculo de supervisão com {c.inviter_name} foi criado.</Aviso>
            <LinkBotao to="/supervisao" className="w-fit">
              Ir para Minha supervisão
            </LinkBotao>
          </>
        ) : (
          <>
            <p className="text-[15px] text-ink-2">
              <strong>{c.inviter_name}</strong>
              {crp ? ` (${crp})` : ''} convidou você para ser {voceSera} no Tríade.
            </p>
            <p className="text-sm text-muted">
              Ao aceitar, vocês passam a se ver em “Minha supervisão”. Pacientes e prontuários continuam visíveis só para quem os
              cadastrou: o supervisor só verá casos anonimizados que o supervisionando decidir enviar.
            </p>
            {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
            <div className="flex flex-wrap gap-2">
              <Botao variante="supervisao" carregando={enviando} textoCarregando="Aceitando…" onClick={aceitar}>
                Aceitar convite
              </Botao>
              <LinkBotao to="/inicio" variante="secundario">
                Agora não
              </LinkBotao>
            </div>
          </>
        )}
      </section>
    </>
  )
}
