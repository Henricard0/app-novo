import {
  DndContext,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type Modifier,
} from '@dnd-kit/core'
import { useRef, useState } from 'react'
import type { SessaoComRegistros } from '@/lib/consultorio/api'
import {
  PIXELS_POR_HORA,
  PIXELS_POR_PASSO,
  colunasDeSobreposicao,
  faixaDeHoras,
  horarioDepoisDeArrastar,
  horarioDepoisDeRedimensionar,
  posicaoNaGrade,
} from '@/lib/consultorio/calendario'
import { ROTULO_STATUS, mesmoDia, paraDataISO, paraHora, type StatusSessao } from '@/lib/consultorio/formato'

type CalendarioProps = {
  dias: Date[]
  sessoes: SessaoComRegistros[]
  /** A sessão foi solta num novo horário (arrastada ou redimensionada). */
  aoSoltar: (sessao: SessaoComRegistros, inicio: Date, fim: Date) => void
  /** Clique (ou Enter) numa sessão. */
  aoAbrir: (sessao: SessaoComRegistros) => void
  /** Clique num horário vazio. */
  aoCriar: (dia: Date, hora: string) => void
}

type Arraste = { id: string; tipo: 'mover' | 'redimensionar'; deltaY: number } | null

// Encaixa o arraste em passos de 15 minutos na vertical.
const encaixarNaGrade: Modifier = ({ transform }) => ({
  ...transform,
  y: Math.round(transform.y / PIXELS_POR_PASSO) * PIXELS_POR_PASSO,
})

const FORMATO_CABECALHO = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric' })

function rotuloDoDia(dia: Date): string {
  const texto = FORMATO_CABECALHO.format(dia).replace('.', '')
  return texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1)
}

function nomeDaSessao(s: SessaoComRegistros): string {
  return s.patients?.full_name ?? 'Paciente'
}

const avisosEmPortugues = (sessoes: SessaoComRegistros[]): Announcements => {
  const nome = (id: string | number) => {
    const sessao = sessoes.find((s) => String(id).endsWith(s.id))
    return sessao ? `sessão de ${nomeDaSessao(sessao)}` : 'sessão'
  }
  return {
    onDragStart: ({ active }) => `Movendo a ${nome(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${nome(active.id)} sobre ${String(over.id).slice(4)}.` : `${nome(active.id)} fora da agenda.`),
    onDragEnd: ({ active, over }) => (over ? `${nome(active.id)} solta.` : `${nome(active.id)} voltou ao lugar.`),
    onDragCancel: ({ active }) => `Arraste cancelado. A ${nome(active.id)} voltou ao lugar.`,
  }
}

export function Calendario({ dias, sessoes, aoSoltar, aoAbrir, aoCriar }: CalendarioProps) {
  const [arraste, setArraste] = useState<Arraste>(null)
  // Depois de soltar, o navegador ainda dispara um clique: este marcador evita abrir a sessão sem querer.
  const acabouDeArrastar = useRef(false)
  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // No toque, é preciso segurar um instante: assim o dedo ainda consegue rolar a página.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  const doPeriodo = sessoes.filter((s) => dias.some((d) => mesmoDia(new Date(s.starts_at), d)))
  const { inicio: horaInicial, fim: horaFinal } = faixaDeHoras(doPeriodo)
  const horas = Array.from({ length: horaFinal - horaInicial }, (_, i) => horaInicial + i)
  const alturaTotal = horas.length * PIXELS_POR_HORA

  function iniciar(e: DragStartEvent) {
    const [tipo, id] = String(e.active.id).split(':') as ['mover' | 'redimensionar', string]
    setArraste({ id, tipo, deltaY: 0 })
  }

  function mover(e: DragMoveEvent) {
    setArraste((a) => (a ? { ...a, deltaY: e.delta.y } : a))
  }

  function terminar(e: DragEndEvent) {
    const atual = arraste
    setArraste(null)
    acabouDeArrastar.current = true
    window.setTimeout(() => (acabouDeArrastar.current = false), 0)
    if (!atual) return
    const sessao = sessoes.find((s) => s.id === atual.id)
    if (!sessao) return

    let novo: { inicio: Date; fim: Date }
    if (atual.tipo === 'redimensionar') {
      novo = horarioDepoisDeRedimensionar(sessao, e.delta.y)
    } else {
      const destino = e.over?.data.current?.dia as Date | undefined
      if (!destino) return
      novo = horarioDepoisDeArrastar(sessao, destino, e.delta.y)
    }
    const mudou =
      novo.inicio.getTime() !== new Date(sessao.starts_at).getTime() ||
      novo.fim.getTime() !== new Date(sessao.ends_at).getTime()
    if (mudou) aoSoltar(sessao, novo.inicio, novo.fim)
  }

  return (
    <DndContext
      sensors={sensores}
      modifiers={[encaixarNaGrade]}
      // O dia de destino é a coluna embaixo do ponteiro (ou do dedo).
      collisionDetection={pointerWithin}
      // Rolagem automática só bem perto da borda, e devagar, para a sessão não "fugir".
      autoScroll={{ threshold: { x: 0, y: 0.08 }, acceleration: 4 }}
      onDragStart={iniciar}
      onDragMove={mover}
      onDragEnd={terminar}
      onDragCancel={() => setArraste(null)}
      accessibility={{
        announcements: avisosEmPortugues(sessoes),
        screenReaderInstructions: {
          draggable: 'Para mudar o horário, abra a sessão e use “Editar”. Com o mouse ou o dedo, arraste a sessão.',
        },
      }}
    >
      <div className="overflow-hidden rounded-card border border-border bg-surface">
        <div
          className="grid border-b border-border"
          style={{ gridTemplateColumns: `3.5rem repeat(${dias.length}, minmax(0, 1fr))` }}
        >
          <div aria-hidden="true" />
          {dias.map((dia) => {
            const hoje = mesmoDia(dia, new Date())
            return (
              <div
                key={paraDataISO(dia)}
                className={`border-l border-border-soft px-1 py-2 text-center text-[13px] font-semibold ${hoje ? 'text-pine' : 'text-ink-2'}`}
              >
                {rotuloDoDia(dia)}
                {hoje ? <span className="sr-only"> (hoje)</span> : null}
              </div>
            )
          })}
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          <div className="grid" style={{ gridTemplateColumns: `3.5rem repeat(${dias.length}, minmax(0, 1fr))` }}>
            <div className="relative" style={{ height: alturaTotal }} aria-hidden="true">
              {horas.map((h, i) => (
                <span
                  key={h}
                  className="absolute right-2 -translate-y-1/2 text-xs text-muted"
                  style={{ top: i * PIXELS_POR_HORA }}
                >
                  {i === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
                </span>
              ))}
            </div>
            {dias.map((dia) => (
              <ColunaDoDia
                key={paraDataISO(dia)}
                dia={dia}
                horas={horas}
                altura={alturaTotal}
                sessoes={sessoes.filter((s) => mesmoDia(new Date(s.starts_at), dia))}
                horaInicial={horaInicial}
                arraste={arraste}
                aoAbrir={(s) => {
                  if (!acabouDeArrastar.current) aoAbrir(s)
                }}
                aoCriar={aoCriar}
              />
            ))}
          </div>
        </div>
      </div>
    </DndContext>
  )
}

function ColunaDoDia({
  dia,
  horas,
  altura,
  sessoes,
  horaInicial,
  arraste,
  aoAbrir,
  aoCriar,
}: {
  dia: Date
  horas: number[]
  altura: number
  sessoes: SessaoComRegistros[]
  horaInicial: number
  arraste: Arraste
  aoAbrir: (s: SessaoComRegistros) => void
  aoCriar: (dia: Date, hora: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `dia:${paraDataISO(dia)}`, data: { dia } })
  const colunas = colunasDeSobreposicao(sessoes.filter((s) => s.status !== 'cancelada'))

  return (
    <div
      ref={setNodeRef}
      className={`relative border-l border-border-soft ${isOver ? 'bg-pine-soft/40' : ''}`}
      style={{
        height: altura,
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${PIXELS_POR_HORA - 1}px, var(--color-border-soft) ${PIXELS_POR_HORA - 1}px, var(--color-border-soft) ${PIXELS_POR_HORA}px)`,
      }}
    >
      {/* Atalho de mouse para criar sessão num horário vazio. Pelo teclado, use "Nova sessão". */}
      {horas.map((h, i) => (
        <button
          key={h}
          type="button"
          tabIndex={-1}
          aria-label={`Nova sessão às ${String(h).padStart(2, '0')}:00`}
          onClick={() => aoCriar(dia, `${String(h).padStart(2, '0')}:00`)}
          className="absolute inset-x-0 cursor-cell hover:bg-bg"
          style={{ top: i * PIXELS_POR_HORA, height: PIXELS_POR_HORA }}
        />
      ))}
      {sessoes.map((s) => (
        <BlocoSessao
          key={s.id}
          sessao={s}
          horaInicial={horaInicial}
          coluna={colunas.get(s.id) ?? { coluna: 0, total: 1 }}
          arraste={arraste && arraste.id === s.id ? arraste : null}
          aoAbrir={aoAbrir}
        />
      ))}
    </div>
  )
}

const CORES: Record<StatusSessao, string> = {
  agendada: 'border-pine bg-pine-soft text-pine-dark',
  realizada: 'border-pine-dark bg-pine text-white',
  faltou: 'border-ocre bg-ocre-soft text-ocre-text',
  cancelada: 'border-border-strong bg-chip-neutral text-muted line-through',
}

function BlocoSessao({
  sessao,
  horaInicial,
  coluna,
  arraste,
  aoAbrir,
}: {
  sessao: SessaoComRegistros
  horaInicial: number
  coluna: { coluna: number; total: number }
  arraste: Arraste
  aoAbrir: (s: SessaoComRegistros) => void
}) {
  const cancelada = sessao.status === 'cancelada'
  const {
    setNodeRef: refMover,
    listeners: ouvintesMover,
    transform: t,
    isDragging: movendo,
  } = useDraggable({ id: `mover:${sessao.id}`, disabled: cancelada })
  const {
    setNodeRef: refRedimensionar,
    listeners: ouvintesRedimensionar,
    isDragging: redimensionando,
  } = useDraggable({ id: `redimensionar:${sessao.id}`, disabled: cancelada })
  const { topo, altura } = posicaoNaGrade(sessao, horaInicial)
  const nome = nomeDaSessao(sessao)

  // Prévia do novo horário enquanto arrasta.
  let inicio = new Date(sessao.starts_at)
  let fim = new Date(sessao.ends_at)
  let alturaAtual = altura
  if (arraste?.tipo === 'redimensionar') {
    fim = horarioDepoisDeRedimensionar(sessao, arraste.deltaY).fim
    alturaAtual = ((fim.getTime() - inicio.getTime()) / 3600000) * PIXELS_POR_HORA
  } else if (arraste?.tipo === 'mover') {
    const previa = horarioDepoisDeArrastar(sessao, inicio, arraste.deltaY)
    inicio = previa.inicio
    fim = previa.fim
  }

  const largura = 100 / coluna.total
  const status = (sessao.status as StatusSessao) in CORES ? (sessao.status as StatusSessao) : 'agendada'
  const rotulo = `${nome}, ${paraHora(inicio)} às ${paraHora(fim)}, ${ROTULO_STATUS[status]}`

  return (
    <div
      className={`absolute px-0.5 ${movendo || redimensionando ? 'z-20' : cancelada ? 'z-0' : 'z-10'}`}
      style={{
        top: topo,
        height: alturaAtual,
        left: `${coluna.coluna * largura}%`,
        width: `${largura}%`,
        transform: t ? `translate3d(${t.x}px, ${t.y}px, 0)` : undefined,
      }}
    >
      <button
        ref={refMover}
        type="button"
        {...ouvintesMover}
        aria-label={rotulo}
        onClick={() => aoAbrir(sessao)}
        className={`flex h-full w-full touch-manipulation flex-col overflow-hidden rounded-[6px] border-l-4 px-1.5 py-1 text-left text-xs leading-tight shadow-sm ${CORES[status]} ${cancelada ? 'cursor-pointer opacity-70' : 'cursor-grab active:cursor-grabbing'} ${movendo ? 'shadow-lg ring-2 ring-pine' : ''}`}
      >
        <span className="font-semibold">{paraHora(inicio)}</span>
        <span className="truncate font-semibold">{nome}</span>
      </button>
      {!cancelada ? (
        <div
          ref={refRedimensionar}
          {...ouvintesRedimensionar}
          aria-hidden="true"
          title="Arraste para mudar a duração"
          className="absolute inset-x-1 bottom-0 h-2.5 cursor-ns-resize touch-none rounded-b-[6px] hover:bg-ink/10"
        />
      ) : null}
    </div>
  )
}
