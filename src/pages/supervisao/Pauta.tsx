import { Link } from 'react-router'
import { useAuth } from '@/auth/contexto'
import { Aviso } from '@/components/ui/Aviso'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { TelaCarregando } from '@/components/ui/TelaCarregando'
import { Vazio } from '@/components/ui/Vazio'
import { formatarDataHora } from '@/lib/consultorio/formato'
import { useConsulta } from '@/lib/consultorio/useConsulta'
import { ROTULO_SITUACAO_CASO, listarCasos, type CasoNaLista } from '@/lib/supervisao/casos'
import { useTituloPagina } from '@/lib/titulo'

/** /supervisao/pauta — casos recebidos pelo supervisor, agrupados por encontro. */
export function Pauta() {
  useTituloPagina('Pauta de supervisão')
  const { user } = useAuth()
  const { carregando, dados, erro } = useConsulta('casos', listarCasos)

  const recebidos = (dados ?? []).filter((c) => c.supervisee_id !== user?.id)
  const abertos = recebidos.filter((c) => c.status === 'na_pauta')
  const concluidos = recebidos.filter((c) => c.status !== 'na_pauta').slice(0, 20)

  const grupos = new Map<string, CasoNaLista[]>()
  for (const c of abertos.sort((a, b) => (a.supervision_meetings?.starts_at ?? '9').localeCompare(b.supervision_meetings?.starts_at ?? '9'))) {
    const chave = c.supervision_meetings
      ? `${formatarDataHora(c.supervision_meetings.starts_at)}${c.supervision_meetings.supervision_groups ? ` · ${c.supervision_meetings.supervision_groups.name}` : ''}`
      : 'Próximo encontro (sem data)'
    grupos.set(chave, [...(grupos.get(chave) ?? []), c])
  }

  return (
    <>
      <Cabecalho
        titulo="Pauta de supervisão"
        voltar={{ para: '/supervisao', rotulo: 'Minha supervisão' }}
        subtitulo="Casos que seus supervisionandos trouxeram, já anonimizados por eles."
      />
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {carregando ? <TelaCarregando /> : null}
      {!carregando && abertos.length === 0 ? <Vazio titulo="Nenhum caso na pauta." detalhe="Quando um supervisionando enviar um caso, ele aparece aqui." /> : null}

      {[...grupos.entries()].map(([quando, casos]) => (
        <section key={quando} aria-label={quando} className="flex flex-col gap-3 rounded-card border border-border border-t-4 border-t-ocre bg-surface p-5 sm:p-6">
          <h2 className="text-base font-bold">{quando}</h2>
          <ul className="flex flex-col">
            {casos.map((c) => (
              <ItemCaso key={c.id} caso={c} />
            ))}
          </ul>
        </section>
      ))}

      {concluidos.length ? (
        <section aria-labelledby="titulo-anteriores" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5 sm:p-6">
          <h2 id="titulo-anteriores" className="text-base font-bold">
            Anteriores
          </h2>
          <ul className="flex flex-col">
            {concluidos.map((c) => (
              <ItemCaso key={c.id} caso={c} />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  )
}

function ItemCaso({ caso }: { caso: CasoNaLista }) {
  const situacao = ROTULO_SITUACAO_CASO[caso.status] ?? ROTULO_SITUACAO_CASO.na_pauta!
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 border-b border-border-soft py-3 first:pt-0 last:border-b-0">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-semibold">
          {caso.case_label}
          <span className="font-normal text-muted"> · trazido por {caso.supervision_links?.supervisionando?.full_name ?? 'supervisionando'}</span>
        </span>
        {caso.question ? <span className="break-words text-[15px] text-ink-2">{caso.question}</span> : null}
      </span>
      <span className="flex items-center gap-3">
        <Etiqueta tom={situacao.tom}>{situacao.texto}</Etiqueta>
        <Link
          to={`/supervisao/casos/${caso.id}`}
          className="inline-flex min-h-11 items-center text-sm font-semibold"
          aria-label={`Abrir na sala: ${caso.case_label}`}
        >
          Abrir na sala
        </Link>
      </span>
    </li>
  )
}
