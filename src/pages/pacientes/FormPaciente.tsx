import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Aviso } from '@/components/ui/Aviso'
import { Botao, LinkBotao } from '@/components/ui/Botao'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { CampoTexto } from '@/components/ui/CampoTexto'
import { TelaCarregando } from '@/components/ui/TelaCarregando'
import { buscarPaciente, salvarPaciente, type DadosContato, type PacienteComContatos } from '@/lib/consultorio/api'
import { lerDataISO, paraDataISO } from '@/lib/consultorio/formato'
import { useConsulta } from '@/lib/consultorio/useConsulta'
import { useTituloPagina } from '@/lib/titulo'
import { validarEmail } from '@/lib/validacao'

/** /pacientes/novo e /pacientes/:id/editar */
export function FormPaciente() {
  const { id } = useParams()
  const consulta = useConsulta(`paciente-form:${id ?? 'novo'}`, () =>
    id ? buscarPaciente(id) : Promise.resolve({ dados: null, erro: null }),
  )
  useTituloPagina(id ? 'Editar paciente' : 'Novo paciente')

  if (id && consulta.carregando) return <TelaCarregando />
  if (id && !consulta.dados) {
    return <Aviso tom="erro">{consulta.erro ?? 'Paciente não encontrado.'}</Aviso>
  }
  // A chave reinicia o formulário quando muda o paciente.
  return <Formulario key={id ?? 'novo'} paciente={consulta.dados} />
}

type LinhaContato = DadosContato & { chave: string }

type Erros = Partial<Record<'nome' | 'email' | 'nascimento' | 'contatos', string | null>>

function Formulario({ paciente }: { paciente: PacienteComContatos | null }) {
  const navigate = useNavigate()
  const [nome, setNome] = useState(paciente?.full_name ?? '')
  const [apelidos, setApelidos] = useState(paciente?.nicknames.join(', ') ?? '')
  const [nascimento, setNascimento] = useState(paciente?.birth_date ?? '')
  const [telefone, setTelefone] = useState(paciente?.phone ?? '')
  const [email, setEmail] = useState(paciente?.email ?? '')
  const [contatos, setContatos] = useState<LinhaContato[]>(
    (paciente?.patient_contacts ?? []).map((c) => ({
      chave: c.id,
      id: c.id,
      nome: c.name,
      parentesco: c.relation,
      telefone: c.phone,
    })),
  )
  const [erros, setErros] = useState<Erros>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  function mudarContato(chave: string, campo: 'nome' | 'parentesco' | 'telefone', valor: string) {
    setContatos((lista) => lista.map((c) => (c.chave === chave ? { ...c, [campo]: valor } : c)))
  }

  async function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const dataNascimento = nascimento ? lerDataISO(nascimento) : null
    const novosErros: Erros = {
      nome: nome.trim() ? null : 'Informe o nome do paciente.',
      email: email.trim() ? validarEmail(email) : null,
      nascimento:
        nascimento && (!dataNascimento || nascimento > paraDataISO(new Date()) || nascimento < '1900-01-01')
          ? 'Confira a data de nascimento.'
          : null,
      contatos: contatos.some((c) => !c.nome.trim()) ? 'Informe o nome de cada contato ou remova a linha.' : null,
    }
    setErros(novosErros)
    setErroGeral(null)
    if (Object.values(novosErros).some(Boolean)) return

    setEnviando(true)
    const resultado = await salvarPaciente(
      paciente?.id ?? null,
      {
        nome: nome.trim(),
        apelidos: apelidos
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean)
          .slice(0, 10),
        nascimento: nascimento || null,
        telefone: telefone.trim() || null,
        email: email.trim() || null,
      },
      contatos.map((c) => ({
        id: c.id,
        nome: c.nome.trim(),
        parentesco: c.parentesco?.trim() || null,
        telefone: c.telefone?.trim() || null,
      })),
      paciente?.patient_contacts ?? [],
    )
    setEnviando(false)
    if (resultado.erro) {
      setErroGeral(resultado.erro)
      return
    }
    navigate(`/pacientes/${resultado.id}`)
  }

  const voltar = paciente ? `/pacientes/${paciente.id}` : '/pacientes'

  return (
    <>
      <Cabecalho
        titulo={paciente ? 'Editar paciente' : 'Novo paciente'}
        voltar={{ para: voltar, rotulo: paciente ? paciente.full_name : 'Pacientes' }}
      />
      <form noValidate onSubmit={aoEnviar} className="flex max-w-2xl flex-col gap-6">
        {erroGeral ? <Aviso tom="erro">{erroGeral}</Aviso> : null}

        <section className="flex flex-col gap-5 rounded-card border border-border bg-surface p-5 sm:p-6">
          <CampoTexto
            rotulo="Nome completo"
            name="nome"
            autoComplete="off"
            maxLength={200}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            erro={erros.nome}
          />
          <CampoTexto
            rotulo="Apelidos"
            opcional
            name="apelidos"
            autoComplete="off"
            value={apelidos}
            onChange={(e) => setApelidos(e.target.value)}
            ajuda="Separe por vírgula. Na supervisão, também são trocados por “o paciente”."
          />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <CampoTexto
              rotulo="Data de nascimento"
              opcional
              type="date"
              name="nascimento"
              min="1900-01-01"
              max={paraDataISO(new Date())}
              value={nascimento}
              onChange={(e) => setNascimento(e.target.value)}
              erro={erros.nascimento}
            />
            <CampoTexto
              rotulo="Telefone"
              opcional
              type="tel"
              name="telefone"
              autoComplete="off"
              inputMode="tel"
              maxLength={40}
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
            />
          </div>
          <CampoTexto
            rotulo="E-mail"
            opcional
            type="email"
            name="email"
            autoComplete="off"
            inputMode="email"
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            erro={erros.email}
          />
        </section>

        <section
          aria-labelledby="titulo-contatos"
          className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5 sm:p-6"
        >
          <div className="flex flex-col gap-1">
            <h2 id="titulo-contatos" className="text-lg font-bold">
              Familiares e contatos
            </h2>
            <p className="text-sm text-muted">Opcional. Os nomes também são removidos dos casos levados à supervisão.</p>
          </div>
          {erros.contatos ? <p className="text-[13px] font-medium text-danger">{erros.contatos}</p> : null}
          {contatos.map((c, i) => (
            <div key={c.chave} className="flex flex-col gap-3 rounded-control border border-border-soft p-4">
              <p className="text-sm font-semibold text-ink-2">Contato {i + 1}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <CampoTexto
                  rotulo="Nome"
                  autoComplete="off"
                  maxLength={200}
                  value={c.nome}
                  onChange={(e) => mudarContato(c.chave, 'nome', e.target.value)}
                />
                <CampoTexto
                  rotulo="Parentesco"
                  opcional
                  autoComplete="off"
                  maxLength={60}
                  value={c.parentesco ?? ''}
                  onChange={(e) => mudarContato(c.chave, 'parentesco', e.target.value)}
                />
                <CampoTexto
                  rotulo="Telefone"
                  opcional
                  type="tel"
                  autoComplete="off"
                  maxLength={40}
                  value={c.telefone ?? ''}
                  onChange={(e) => mudarContato(c.chave, 'telefone', e.target.value)}
                />
              </div>
              <Botao
                variante="secundario"
                className="w-fit"
                onClick={() => setContatos((lista) => lista.filter((x) => x.chave !== c.chave))}
              >
                Remover contato {i + 1}
              </Botao>
            </div>
          ))}
          <Botao
            variante="secundario"
            className="w-fit"
            onClick={() =>
              setContatos((lista) => [...lista, { chave: crypto.randomUUID(), nome: '', parentesco: '', telefone: '' }])
            }
          >
            Adicionar contato
          </Botao>
        </section>

        <div className="flex flex-wrap gap-3">
          <Botao type="submit" carregando={enviando} textoCarregando="Salvando…">
            {paciente ? 'Salvar alterações' : 'Cadastrar paciente'}
          </Botao>
          <LinkBotao to={voltar} variante="secundario">
            Cancelar
          </LinkBotao>
        </div>
      </form>
    </>
  )
}
