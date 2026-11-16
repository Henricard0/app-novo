import { useParams } from 'react-router'
import { Aviso } from '@/components/ui/Aviso'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { TelaCarregando } from '@/components/ui/TelaCarregando'
import { buscarRegistro, listarVersoes } from '@/lib/consultorio/api'
import { formatarData, formatarDataHora } from '@/lib/consultorio/formato'
import { useConsulta } from '@/lib/consultorio/useConsulta'
import { useTituloPagina } from '@/lib/titulo'

/** /pacientes/:id/registros/:registroId/historico */
export function HistoricoRegistro() {
  const { id = '', registroId = '' } = useParams()
  useTituloPagina('Histórico do registro')
  const registro = useConsulta(`registro:${registroId}`, () => buscarRegistro(registroId))
  const versoes = useConsulta(`versoes:${registroId}`, () => listarVersoes(registroId))

  const voltar = { para: `/pacientes/${id}`, rotulo: 'Voltar ao paciente' }
  if (registro.carregando || versoes.carregando) return <TelaCarregando />
  const atual = registro.dados
  if (!atual) {
    return (
      <>
        <Cabecalho titulo="Histórico do registro" voltar={voltar} />
        <Aviso tom="erro">{registro.erro ?? 'Registro não encontrado.'}</Aviso>
      </>
    )
  }

  const itens = [
    { id: 'atual', atual: true, texto: atual.body, data: atual.session_date, escritoEm: atual.updated_at },
    ...(versoes.dados ?? []).map((v) => ({
      id: v.id,
      atual: false,
      texto: v.body,
      data: v.session_date,
      escritoEm: v.created_at,
    })),
  ]

  return (
    <>
      <Cabecalho
        titulo="Histórico do registro"
        voltar={voltar}
        subtitulo="Cada edição guarda a versão anterior. Versões antigas não podem ser alteradas nem apagadas."
      />
      {versoes.erro ? <Aviso tom="erro">{versoes.erro}</Aviso> : null}
      <ol className="flex flex-col gap-4">
        {itens.map((v, i) => (
          <li key={v.id} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15px] font-bold">
                {v.atual ? 'Versão atual' : `Versão ${itens.length - i}`}
                <span className="font-normal text-muted"> · atendimento de {formatarData(v.data)}</span>
              </h2>
              <span className="flex items-center gap-2 text-[13px] text-muted">
                {v.atual ? <Etiqueta tom="ok">Em uso</Etiqueta> : null}
                Escrita em {formatarDataHora(v.escritoEm)}
              </span>
            </div>
            <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{v.texto}</p>
          </li>
        ))}
      </ol>
    </>
  )
}
