import { useId, useState, type FormEvent } from 'react'
import { Aviso } from '@/components/ui/Aviso'
import { Botao } from '@/components/ui/Botao'
import { CLASSES_CAMPO } from '@/components/ui/campo-estilos'
import { CampoCaixa } from '@/components/ui/CampoCaixa'
import { CampoTexto } from '@/components/ui/CampoTexto'
import { Cartao } from '@/components/ui/Cartao'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { formatarDataHora, juntarDataHora, paraDataISO } from '@/lib/consultorio/formato'
import { useConsulta } from '@/lib/consultorio/useConsulta'
import { criarGrupo, definirGrupo, listarGrupos, type Grupo, type Vinculo } from '@/lib/supervisao/api'
import {
  listarEncontrosDeGrupo,
  listarHoras,
  marcarEncontroDoGrupo,
  registrarHorasDoEncontro,
  type EncontroComGrupo,
} from '@/lib/supervisao/casos'

/**
 * Grupos de supervisão (visão do supervisor). Decisão "opção B": só o supervisor
 * lê os casos; os colegas do grupo não veem os casos uns dos outros.
 */
export function Grupos({ supervisionandos, aoMudar }: { supervisionandos: Vinculo[]; aoMudar: () => void }) {
  const grupos = useConsulta('grupos', listarGrupos)
  const encontros = useConsulta('encontros-grupo', listarEncontrosDeGrupo)
  const horas = useConsulta('horas', listarHoras)
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function executar(fazer: () => Promise<{ erro: string | null }>, sucesso: string) {
    setOcupado(true)
    setErro(null)
    setAviso(null)
    const r = await fazer()
    setOcupado(false)
    if (r.erro) setErro(r.erro)
    else setAviso(sucesso)
    grupos.recarregar()
    encontros.recarregar()
    horas.recarregar()
    aoMudar()
  }

  async function criar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!nome.trim()) {
      setErro('Dê um nome ao grupo.')
      return
    }
    await executar(() => criarGrupo(nome), `Grupo “${nome.trim()}” criado.`)
    setNome('')
  }

  const lista = grupos.dados ?? []
  const registrados = new Set((horas.dados ?? []).map((h) => `${h.meeting_id}:${h.link_id}`))

  return (
    <Cartao titulo="Grupos de supervisão">
      <p className="text-sm text-muted">
        Junte supervisionandos num grupo e marque encontros para todos. Cada um continua levando os próprios casos, e só você os lê:
        os colegas do grupo não veem os casos uns dos outros.
      </p>
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {aviso ? <Aviso tom="sucesso">{aviso}</Aviso> : null}

      <form onSubmit={criar} className="flex flex-wrap items-end gap-2">
        <CampoTexto rotulo="Nome do novo grupo" maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} className="min-w-0 flex-1" />
        <Botao type="submit" variante="secundario" disabled={ocupado}>
          Criar grupo
        </Botao>
      </form>

      {supervisionandos.length ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-ink-2">Formato de cada supervisionando</h3>
          <ul className="flex flex-col">
            {supervisionandos.map((v) => (
              <SeletorDeGrupo
                key={v.id}
                vinculo={v}
                grupos={lista}
                desabilitado={ocupado}
                aoEscolher={(grupoId) =>
                  executar(() => definirGrupo(v.id, grupoId), grupoId ? 'Supervisionando colocado no grupo.' : 'Supervisão voltou a ser individual.')
                }
              />
            ))}
          </ul>
        </div>
      ) : null}

      {lista.map((g) => {
        const membros = supervisionandos.filter((v) => v.group_id === g.id)
        const doGrupo = (encontros.dados ?? []).filter((m) => m.group_id === g.id)
        return (
          <section key={g.id} aria-label={`Grupo ${g.name}`} className="flex flex-col gap-3 rounded-control border border-border-soft p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold">{g.name}</h3>
              <Etiqueta>{membros.length} {membros.length === 1 ? 'pessoa' : 'pessoas'}</Etiqueta>
            </div>
            <p className="text-sm text-muted">
              {membros.length ? membros.map((m) => m.supervisionando?.full_name).join(', ') : 'Ninguém no grupo ainda.'}
            </p>
            <MarcarEncontro
              desabilitado={ocupado || membros.length === 0}
              aoMarcar={(inicio) => executar(() => marcarEncontroDoGrupo(g.id, inicio), `Encontro do grupo marcado para ${formatarDataHora(inicio)}.`)}
            />
            {doGrupo.map((m) => (
              <EncontroDoGrupo
                key={m.id}
                encontro={m}
                membros={membros}
                jaRegistrado={(linkId) => registrados.has(`${m.id}:${linkId}`)}
                desabilitado={ocupado}
                aoRegistrar={(presentes, minutos) =>
                  executar(() => registrarHorasDoEncontro(m, presentes, minutos), 'Horas registradas para os presentes.')
                }
              />
            ))}
          </section>
        )
      })}
    </Cartao>
  )
}

function SeletorDeGrupo({
  vinculo,
  grupos,
  desabilitado,
  aoEscolher,
}: {
  vinculo: Vinculo
  grupos: Grupo[]
  desabilitado: boolean
  aoEscolher: (grupoId: string | null) => void
}) {
  const id = useId()
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-b border-border-soft py-2 last:border-b-0">
      <label htmlFor={id} className="text-[15px] font-semibold">
        {vinculo.supervisionando?.full_name}
      </label>
      <select
        id={id}
        className={`${CLASSES_CAMPO} w-auto`}
        value={vinculo.group_id ?? ''}
        disabled={desabilitado}
        onChange={(e) => aoEscolher(e.target.value || null)}
      >
        <option value="">Individual</option>
        {grupos.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
    </li>
  )
}

function MarcarEncontro({ desabilitado, aoMarcar }: { desabilitado: boolean; aoMarcar: (inicio: Date) => void }) {
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        const inicio = juntarDataHora(data, hora)
        if (!inicio) {
          setErro('Informe data e horário.')
          return
        }
        setErro(null)
        aoMarcar(inicio)
        setData('')
        setHora('')
      }}
    >
      <CampoTexto rotulo="Data do encontro" type="date" min={paraDataISO(new Date())} value={data} onChange={(e) => setData(e.target.value)} erro={erro} />
      <CampoTexto rotulo="Horário" type="time" step={300} value={hora} onChange={(e) => setHora(e.target.value)} />
      <Botao type="submit" variante="secundario" disabled={desabilitado}>
        Marcar encontro do grupo
      </Botao>
    </form>
  )
}

function EncontroDoGrupo({
  encontro,
  membros,
  jaRegistrado,
  desabilitado,
  aoRegistrar,
}: {
  encontro: EncontroComGrupo
  membros: Vinculo[]
  jaRegistrado: (linkId: string) => boolean
  desabilitado: boolean
  aoRegistrar: (presentes: { linkId: string; supervisionandoId: string }[], minutos: number) => void
}) {
  const pendentes = membros.filter((m) => !jaRegistrado(m.id))
  const [presentes, setPresentes] = useState<string[]>(pendentes.map((m) => m.id))
  const [minutos, setMinutos] = useState('90')
  const [erro, setErro] = useState<string | null>(null)
  const passou = new Date(encontro.starts_at) <= new Date()

  return (
    <div className="flex flex-col gap-2 rounded-control bg-bg p-3">
      <p className="text-sm font-semibold text-ink-2">
        {formatarDataHora(encontro.starts_at)} {encontro.status === 'concluido' ? <Etiqueta tom="ok">Concluído</Etiqueta> : null}
      </p>
      {passou && pendentes.length ? (
        <form
          className="flex flex-col gap-1"
          onSubmit={(e) => {
            e.preventDefault()
            const n = Number(minutos)
            const escolhidos = pendentes.filter((m) => presentes.includes(m.id))
            if (!escolhidos.length) {
              setErro('Marque quem esteve presente.')
              return
            }
            if (!(Number.isInteger(n) && n >= 1 && n <= 600)) {
              setErro('Informe os minutos (de 1 a 600).')
              return
            }
            setErro(null)
            aoRegistrar(
              escolhidos.map((m) => ({ linkId: m.id, supervisionandoId: m.supervisee_id })),
              n,
            )
          }}
        >
          <p className="text-[13px] text-muted">Quem esteve presente?</p>
          {pendentes.map((m) => (
            <CampoCaixa
              key={m.id}
              rotulo={m.supervisionando?.full_name ?? 'Supervisionando'}
              checked={presentes.includes(m.id)}
              onChange={(e) => setPresentes((p) => (e.target.checked ? [...p, m.id] : p.filter((x) => x !== m.id)))}
            />
          ))}
          <div className="flex flex-wrap items-end gap-2">
            <CampoTexto rotulo="Minutos" type="number" inputMode="numeric" min={1} max={600} value={minutos} onChange={(e) => setMinutos(e.target.value)} erro={erro} className="max-w-40" />
            <Botao type="submit" variante="supervisao" disabled={desabilitado}>
              Registrar horas dos presentes
            </Botao>
          </div>
        </form>
      ) : passou ? (
        <p className="text-[13px] text-muted">Horas registradas.</p>
      ) : (
        <p className="text-[13px] text-muted">As horas podem ser registradas depois do encontro.</p>
      )}
    </div>
  )
}
