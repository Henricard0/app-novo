import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useAuth } from '@/auth/contexto'
import { Aviso } from '@/components/ui/Aviso'
import { Botao, LinkBotao } from '@/components/ui/Botao'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { CampoAreaTexto } from '@/components/ui/CampoAreaTexto'
import { CampoCaixa } from '@/components/ui/CampoCaixa'
import { CampoSelecao } from '@/components/ui/CampoSelecao'
import { CampoTexto } from '@/components/ui/CampoTexto'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { TelaCarregando } from '@/components/ui/TelaCarregando'
import { Vazio } from '@/components/ui/Vazio'
import { buscarPaciente, listarRegistros, type PacienteComContatos, type RegistroComVersoes } from '@/lib/consultorio/api'
import { formatarData, formatarDataHora, idade, juntarDataHora, paraDataISO } from '@/lib/consultorio/formato'
import { useConsulta } from '@/lib/consultorio/useConsulta'
import { listarVinculos, type Vinculo } from '@/lib/supervisao/api'
import { anonimizar, rotuloDoCaso, rotuloDoPeriodo, type Troca } from '@/lib/supervisao/anonimizar'
import { criarCaso, listarEncontros } from '@/lib/supervisao/casos'
import { useTituloPagina } from '@/lib/titulo'

/** /pacientes/:id/supervisao/novo — tela de referência: LevarCaso.dc.html */
export function LevarCaso() {
  useTituloPagina('Levar caso para supervisão')
  const { id = '' } = useParams()
  const { user } = useAuth()
  const paciente = useConsulta(`paciente:${id}`, () => buscarPaciente(id))
  const registros = useConsulta(`registros:${id}`, () => listarRegistros(id))
  const vinculos = useConsulta('vinculos', listarVinculos)

  if (paciente.carregando || registros.carregando || vinculos.carregando) return <TelaCarregando />
  if (!paciente.dados) return <Aviso tom="erro">{paciente.erro ?? 'Paciente não encontrado.'}</Aviso>

  const meusSupervisores = (vinculos.dados ?? []).filter((v) => v.status === 'ativo' && v.supervisee_id === user?.id)
  const voltar = { para: `/pacientes/${id}`, rotulo: paciente.dados.full_name }

  if (meusSupervisores.length === 0) {
    return (
      <>
        <Cabecalho titulo="Levar caso para supervisão" voltar={voltar} />
        <Vazio titulo="Você ainda não tem supervisor no Tríade." detalhe="Encontre um na rede ou convide o seu por link.">
          <LinkBotao to="/supervisao/encontrar" variante="supervisao" className="mt-3 w-fit">
            Encontrar supervisor
          </LinkBotao>
        </Vazio>
      </>
    )
  }
  if ((registros.dados ?? []).length === 0) {
    return (
      <>
        <Cabecalho titulo="Levar caso para supervisão" voltar={voltar} />
        <Vazio titulo="Este paciente ainda não tem registros no prontuário." detalhe="O caso é montado a partir dos registros." />
      </>
    )
  }

  return <Formulario paciente={paciente.dados} registros={registros.dados ?? []} supervisores={meusSupervisores} />
}

function Formulario({
  paciente,
  registros,
  supervisores,
}: {
  paciente: PacienteComContatos
  registros: RegistroComVersoes[]
  supervisores: Vinculo[]
}) {
  const navigate = useNavigate()
  const [escolhidos, setEscolhidos] = useState<string[]>(registros.slice(0, 1).map((r) => r.id))
  const [rotuloPaciente, setRotuloPaciente] = useState<'A paciente' | 'O paciente'>('O paciente')
  const [manterIdade, setManterIdade] = useState(true)
  const [datasMesAno, setDatasMesAno] = useState(true)
  const [extras, setExtras] = useState('')
  const [edicoes, setEdicoes] = useState<Record<string, string>>({})
  const [linkId, setLinkId] = useState(supervisores[0]!.id)
  const [encontro, setEncontro] = useState('')
  const [novaData, setNovaData] = useState('')
  const [novaHora, setNovaHora] = useState('')
  const [pergunta, setPergunta] = useState('')
  const [revisei, setRevisei] = useState(false)
  const [erros, setErros] = useState<Partial<Record<'registros' | 'pergunta' | 'revisei' | 'encontro', string | null>>>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState<'rascunho' | 'enviar' | null>(null)
  const grupoDoVinculo = supervisores.find((v) => v.id === linkId)?.group_id ?? null
  const encontros = useConsulta(`encontros:${linkId}`, () => listarEncontros(linkId, grupoDoVinculo))

  const opcoes = {
    nomesPaciente: [paciente.full_name, ...paciente.nicknames],
    nomesContatos: [...paciente.patient_contacts.map((c) => c.name), ...(paciente.payer_name ? [paciente.payer_name] : [])],
    rotuloPaciente,
    datasMesAno,
    termosExtras: extras.split(',').map((t) => t.trim()).filter(Boolean),
  }
  const selecionados = registros.filter((r) => escolhidos.includes(r.id)).sort((a, b) => a.session_date.localeCompare(b.session_date))
  const trechos = selecionados.map((r) => {
    const auto = anonimizar(r.body, opcoes)
    return { registro: r, auto, texto: edicoes[r.id] ?? auto.texto, editado: r.id in edicoes }
  })
  const trocas: Troca[] = trechos.flatMap((t) => t.auto.trocas)
  const resumoTrocas = [...new Map(trocas.map((t) => [`${t.tipo}|${t.original.toLowerCase()}`, t])).values()]
  const rotulo = rotuloDoCaso(paciente.full_name, idade(paciente.birth_date), manterIdade)
  const supervisorEscolhido = supervisores.find((v) => v.id === linkId)

  function alternar(id: string, marcado: boolean) {
    setEscolhidos((atual) => (marcado ? [...atual, id] : atual.filter((x) => x !== id)))
  }

  async function salvar(e: FormEvent<HTMLFormElement>, enviar: boolean) {
    e.preventDefault()
    const inicioNovo = encontro === 'novo' ? juntarDataHora(novaData, novaHora) : null
    const novos = {
      registros: selecionados.length ? null : 'Escolha pelo menos um registro.',
      pergunta: enviar && !pergunta.trim() ? 'Escreva o que você quer discutir.' : null,
      revisei: enviar && !revisei ? 'Confirme que revisou o texto antes de enviar.' : null,
      encontro: encontro === 'novo' && !inicioNovo ? 'Informe a data e o horário do encontro.' : null,
    }
    setErros(novos)
    setErroGeral(null)
    if (Object.values(novos).some(Boolean)) return
    if (trechos.some((t) => !t.texto.trim())) {
      setErroGeral('Um dos trechos ficou vazio. Escreva algo ou desmarque o registro.')
      return
    }

    setEnviando(enviar ? 'enviar' : 'rascunho')
    const r = await criarCaso({
      linkId,
      encontro: encontro === 'novo' && inicioNovo ? { inicio: inicioNovo } : encontro ? { id: encontro } : null,
      rotulo,
      pergunta,
      pacienteId: paciente.id,
      registroIds: selecionados.map((s) => s.id),
      trechos: trechos.map((t) => ({ periodo: rotuloDoPeriodo(t.registro.session_date, datasMesAno), texto: t.texto })),
      enviar,
    })
    setEnviando(null)
    if (r.erro && !r.id) {
      setErroGeral(r.erro)
      return
    }
    navigate(`/supervisao/casos/${r.id}`, { state: { aviso: r.erro ?? (enviar ? 'Caso enviado para a pauta.' : 'Rascunho salvo.') } })
  }

  return (
    <>
      <Cabecalho
        titulo="Levar caso para supervisão"
        voltar={{ para: `/pacientes/${paciente.id}`, rotulo: paciente.full_name }}
        subtitulo="O supervisor recebe uma cópia anonimizada, revisada por você. O prontuário continua só seu."
      />
      <form noValidate onSubmit={(e) => salvar(e, true)} className="flex flex-col gap-6">
        {erroGeral ? <Aviso tom="erro">{erroGeral}</Aviso> : null}

        <section aria-labelledby="passo-1" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5 sm:p-6">
          <h2 id="passo-1" className="text-lg font-bold">
            1 · Registros que você quer levar
          </h2>
          {erros.registros ? <p className="text-[13px] font-medium text-danger">{erros.registros}</p> : null}
          <ul className="flex flex-col">
            {registros.slice(0, 20).map((r) => (
              <li key={r.id} className="border-b border-border-soft last:border-b-0">
                <CampoCaixa
                  rotulo={`Atendimento de ${formatarData(r.session_date)} — ${r.body.slice(0, 70)}${r.body.length > 70 ? '…' : ''}`}
                  checked={escolhidos.includes(r.id)}
                  onChange={(e) => alternar(r.id, e.target.checked)}
                />
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="passo-2" className="flex flex-col gap-4 rounded-card border border-border border-t-4 border-t-ocre bg-surface p-5 sm:p-6">
          <h2 id="passo-2" className="text-lg font-bold">
            2 · Revisar o que o supervisor vai ver
          </h2>

          <fieldset className="flex flex-col gap-1 rounded-control bg-bg p-4">
            <legend className="sr-only">Ajustes de privacidade</legend>
            <p className="text-sm font-semibold text-ink-2">Ajustes de privacidade</p>
            <div className="flex flex-wrap gap-x-6">
              {(['O paciente', 'A paciente'] as const).map((r) => (
                <label key={r} className="flex min-h-11 items-center gap-2.5 text-[15px] text-ink-2">
                  <input
                    type="radio"
                    name="rotulo"
                    checked={rotuloPaciente === r}
                    onChange={() => setRotuloPaciente(r)}
                    className="size-5 accent-pine"
                  />
                  Chamar de “{r.toLowerCase()}”
                </label>
              ))}
            </div>
            <CampoCaixa rotulo={`Manter a idade (${rotulo})`} checked={manterIdade} onChange={(e) => setManterIdade(e.target.checked)} />
            <CampoCaixa rotulo="Trocar datas exatas por mês e ano" checked={datasMesAno} onChange={(e) => setDatasMesAno(e.target.checked)} />
            <p className="flex min-h-11 items-center gap-3 text-[15px] text-muted">
              <span aria-hidden="true">✓</span> Remover nomes, contatos e endereços (sempre)
            </p>
            <CampoTexto
              rotulo="Outros trechos para remover"
              opcional
              autoComplete="off"
              value={extras}
              onChange={(e) => setExtras(e.target.value)}
              ajuda="Separe por vírgula. Ex.: nome da empresa, da escola, de um lugar."
            />
          </fieldset>

          {resumoTrocas.length ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-ink-2">
                {resumoTrocas.length} {resumoTrocas.length === 1 ? 'trecho identificável encontrado' : 'trechos identificáveis encontrados'}
              </p>
              <ul className="flex flex-col gap-1 text-sm">
                {resumoTrocas.map((t) => (
                  <li key={`${t.tipo}|${t.original}`} className="flex flex-wrap gap-x-2">
                    <span className="font-semibold text-ink-2">{t.tipo}:</span>
                    <span className="text-muted line-through">{t.original}</span>
                    <span className="text-muted">→ {t.substituto}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted">Nenhum trecho identificável encontrado automaticamente.</p>
          )}
          <Aviso tom="info">Revise sempre: a detecção ajuda, mas quem responde pelo sigilo é você.</Aviso>

          {trechos.map((t) => (
            <div key={t.registro.id} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink-2">
                  No prontuário <Etiqueta>Só você vê</Etiqueta>
                </p>
                <p className="text-[13px] text-muted">Atendimento de {formatarData(t.registro.session_date)}</p>
                <p className="min-h-32 whitespace-pre-wrap break-words rounded-control border border-border-soft bg-bg p-3 text-[15px] leading-relaxed">
                  {t.registro.body}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <CampoAreaTexto
                  rotulo={`O que o supervisor vai ver · ${rotuloDoPeriodo(t.registro.session_date, datasMesAno)}`}
                  rows={7}
                  maxLength={20000}
                  value={t.texto}
                  onChange={(e) => setEdicoes((ed) => ({ ...ed, [t.registro.id]: e.target.value }))}
                  ajuda="Você pode editar livremente: apague ou reescreva o que ainda identificar o paciente."
                />
                {t.editado ? (
                  <button
                    type="button"
                    className="inline-flex min-h-11 w-fit items-center text-sm font-semibold"
                    onClick={() =>
                      setEdicoes((ed) => {
                        const novo = { ...ed }
                        delete novo[t.registro.id]
                        return novo
                      })
                    }
                  >
                    Desfazer minhas edições neste trecho
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </section>

        <section aria-labelledby="passo-3" className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5 sm:p-6">
          <h2 id="passo-3" className="text-lg font-bold">
            3 · Enviar para a pauta
          </h2>
          {supervisores.length > 1 ? (
            <CampoSelecao
              rotulo="Supervisor"
              opcoes={supervisores.map((v) => ({ valor: v.id, rotulo: v.supervisor?.full_name ?? 'Supervisor' }))}
              value={linkId}
              onChange={(e) => {
                setLinkId(e.target.value)
                setEncontro('')
              }}
            />
          ) : (
            <p className="text-[15px]">
              <span className="font-semibold text-ink-2">Supervisor: </span>
              {supervisorEscolhido?.supervisor?.full_name}
            </p>
          )}
          <CampoSelecao
            rotulo="Encontro"
            vazio="Próximo encontro (sem data marcada)"
            opcoes={[
              ...(encontros.dados ?? []).map((m) => ({
                valor: m.id,
                rotulo: `${formatarDataHora(m.starts_at)}${m.supervision_groups ? ` · ${m.supervision_groups.name}` : ''}`,
              })),
              { valor: 'novo', rotulo: 'Marcar novo encontro…' },
            ]}
            value={encontro}
            onChange={(e) => setEncontro(e.target.value)}
            erro={erros.encontro}
          />
          {encontro === 'novo' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CampoTexto rotulo="Data do encontro" type="date" min={paraDataISO(new Date())} value={novaData} onChange={(e) => setNovaData(e.target.value)} />
              <CampoTexto rotulo="Horário do encontro" type="time" step={300} value={novaHora} onChange={(e) => setNovaHora(e.target.value)} />
            </div>
          ) : null}
          <CampoAreaTexto
            rotulo="O que você quer discutir com o supervisor?"
            rows={3}
            maxLength={2000}
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            erro={erros.pergunta}
            ajuda="Compartilhe só o necessário para discutir o caso."
          />
          <div>
            <CampoCaixa
              rotulo="Revisei o texto e não há dados que identifiquem o paciente."
              checked={revisei}
              onChange={(e) => setRevisei(e.target.checked)}
            />
            {erros.revisei ? <p className="text-[13px] font-medium text-danger">{erros.revisei}</p> : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <Botao type="submit" variante="supervisao" carregando={enviando === 'enviar'} textoCarregando="Enviando…" disabled={Boolean(enviando)}>
              Enviar para a pauta
            </Botao>
            <Botao
              variante="secundario"
              carregando={enviando === 'rascunho'}
              textoCarregando="Salvando…"
              disabled={Boolean(enviando)}
              onClick={(e) => salvar(e as unknown as FormEvent<HTMLFormElement>, false)}
            >
              Salvar rascunho
            </Botao>
            <LinkBotao to={`/pacientes/${paciente.id}`} variante="secundario">
              Cancelar
            </LinkBotao>
          </div>
        </section>
      </form>
    </>
  )
}
