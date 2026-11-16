import { useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { Aviso } from '@/components/ui/Aviso'
import { Botao, LinkBotao } from '@/components/ui/Botao'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { CampoAreaTexto } from '@/components/ui/CampoAreaTexto'
import { CampoSelecao } from '@/components/ui/CampoSelecao'
import { CampoTexto } from '@/components/ui/CampoTexto'
import { TelaCarregando } from '@/components/ui/TelaCarregando'
import {
  buscarPaciente,
  buscarRegistro,
  criarRegistro,
  editarRegistro,
  listarSessoesDoPaciente,
  type Registro,
  type SessaoComRegistros,
} from '@/lib/consultorio/api'
import { ROTULO_STATUS, formatarData, lerDataISO, paraDataISO, paraHora, type StatusSessao } from '@/lib/consultorio/formato'
import { useConsulta } from '@/lib/consultorio/useConsulta'
import { useTituloPagina } from '@/lib/titulo'

/** /pacientes/:id/registros/novo (aceita ?sessao=) e /pacientes/:id/registros/:registroId/editar */
export function FormRegistro() {
  const { id = '', registroId } = useParams()
  const [params] = useSearchParams()
  useTituloPagina(registroId ? 'Editar registro' : 'Novo registro')

  const paciente = useConsulta(`paciente:${id}`, () => buscarPaciente(id))
  const sessoes = useConsulta(`sessoes-paciente:${id}`, () => listarSessoesDoPaciente(id))
  const registro = useConsulta(`registro:${registroId ?? 'novo'}`, () =>
    registroId ? buscarRegistro(registroId) : Promise.resolve({ dados: null, erro: null }),
  )

  if (paciente.carregando || sessoes.carregando || registro.carregando) return <TelaCarregando />
  if (!paciente.dados) return <Aviso tom="erro">{paciente.erro ?? 'Paciente não encontrado.'}</Aviso>
  if (registroId && !registro.dados) return <Aviso tom="erro">{registro.erro ?? 'Registro não encontrado.'}</Aviso>

  return (
    <Formulario
      key={registroId ?? 'novo'}
      pacienteId={id}
      nomePaciente={paciente.dados.full_name}
      sessoes={sessoes.dados ?? []}
      registro={registro.dados}
      sessaoInicial={params.get('sessao')}
    />
  )
}

function Formulario({
  pacienteId,
  nomePaciente,
  sessoes,
  registro,
  sessaoInicial,
}: {
  pacienteId: string
  nomePaciente: string
  sessoes: SessaoComRegistros[]
  registro: Registro | null
  sessaoInicial: string | null
}) {
  const navigate = useNavigate()
  const sessaoEscolhida = sessoes.find((s) => s.id === (registro?.appointment_id ?? sessaoInicial))
  const [sessaoId, setSessaoId] = useState(sessaoEscolhida?.id ?? '')
  const [data, setData] = useState(
    registro?.session_date ?? (sessaoEscolhida ? paraDataISO(new Date(sessaoEscolhida.starts_at)) : paraDataISO(new Date())),
  )
  const [texto, setTexto] = useState(registro?.body ?? '')
  const [erros, setErros] = useState<{ data?: string | null; texto?: string | null }>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  // Sessões que podem receber este registro: as que já começaram e não foram canceladas.
  const agora = new Date()
  const opcoesSessao = sessoes
    .filter((s) => s.id === sessaoEscolhida?.id || (s.status !== 'cancelada' && new Date(s.starts_at) <= agora))
    .slice(0, 30)
    .map((s) => {
      const inicio = new Date(s.starts_at)
      return {
        valor: s.id,
        rotulo: `${formatarData(inicio)} às ${paraHora(inicio)} · ${ROTULO_STATUS[s.status as StatusSessao] ?? s.status}`,
      }
    })

  function escolherSessao(valor: string) {
    setSessaoId(valor)
    const sessao = sessoes.find((s) => s.id === valor)
    if (sessao) setData(paraDataISO(new Date(sessao.starts_at)))
  }

  async function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const novosErros = {
      data: lerDataISO(data) ? null : 'Informe a data do atendimento.',
      texto: texto.trim() ? null : 'Escreva o registro antes de salvar.',
    }
    setErros(novosErros)
    setErroGeral(null)
    if (novosErros.data || novosErros.texto) return

    setEnviando(true)
    const dados = { data, sessaoId: sessaoId || null, texto }
    const { erro } = registro ? await editarRegistro(registro.id, dados) : await criarRegistro(pacienteId, dados)
    setEnviando(false)
    if (erro) {
      setErroGeral(erro)
      return
    }
    navigate(`/pacientes/${pacienteId}`)
  }

  return (
    <>
      <Cabecalho
        titulo={registro ? 'Editar registro' : 'Novo registro'}
        voltar={{ para: `/pacientes/${pacienteId}`, rotulo: nomePaciente }}
        subtitulo="Só você vê o prontuário. Ao editar, a versão anterior fica guardada no histórico."
      />
      <form noValidate onSubmit={aoEnviar} className="flex max-w-3xl flex-col gap-5">
        {erroGeral ? <Aviso tom="erro">{erroGeral}</Aviso> : null}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <CampoSelecao
            rotulo="Sessão"
            opcional
            name="sessao"
            opcoes={opcoesSessao}
            vazio="Sem sessão vinculada"
            value={sessaoId}
            onChange={(e) => escolherSessao(e.target.value)}
          />
          <CampoTexto
            rotulo="Data do atendimento"
            type="date"
            name="data"
            max={paraDataISO(new Date())}
            value={data}
            onChange={(e) => setData(e.target.value)}
            erro={erros.data}
          />
        </div>
        <CampoAreaTexto
          rotulo="Registro"
          name="registro"
          rows={14}
          maxLength={100000}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          erro={erros.texto}
        />
        <div className="flex flex-wrap gap-3">
          <Botao type="submit" carregando={enviando} textoCarregando="Salvando…">
            {registro ? 'Salvar alterações' : 'Salvar registro'}
          </Botao>
          <LinkBotao to={`/pacientes/${pacienteId}`} variante="secundario">
            Cancelar
          </LinkBotao>
        </div>
      </form>
    </>
  )
}
