import { useState } from 'react'
import { Link } from 'react-router'
import { Aviso } from '@/components/ui/Aviso'
import { LinkBotao } from '@/components/ui/Botao'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { CampoCaixa } from '@/components/ui/CampoCaixa'
import { CampoTexto } from '@/components/ui/CampoTexto'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { TelaCarregando } from '@/components/ui/TelaCarregando'
import { Vazio } from '@/components/ui/Vazio'
import { listarPacientes } from '@/lib/consultorio/api'
import { idade } from '@/lib/consultorio/formato'
import { useConsulta } from '@/lib/consultorio/useConsulta'
import { NOME_DO_PLANO, buscarMeuPlano } from '@/lib/planos/api'
import { useTituloPagina } from '@/lib/titulo'

/** Compara sem acento e sem diferenciar maiúsculas. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR')
}

export function ListaPacientes() {
  useTituloPagina('Pacientes')
  const { carregando, dados, erro } = useConsulta('pacientes', listarPacientes)
  const plano = useConsulta('meu-plano', buscarMeuPlano)
  const limite = plano.dados?.limite_pacientes ?? null
  const [busca, setBusca] = useState('')
  const [verArquivados, setVerArquivados] = useState(false)

  const termo = normalizar(busca.trim())
  const pacientes = (dados ?? []).filter(
    (p) =>
      Boolean(p.archived_at) === verArquivados &&
      (!termo || normalizar([p.full_name, ...p.nicknames].join(' ')).includes(termo)),
  )
  const totalAtivos = (dados ?? []).filter((p) => !p.archived_at).length

  return (
    <>
      <Cabecalho
        titulo="Pacientes"
        subtitulo={dados ? `${totalAtivos} ${totalAtivos === 1 ? 'paciente ativo' : 'pacientes ativos'}` : null}
        acoes={<LinkBotao to="/pacientes/novo">Novo paciente</LinkBotao>}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-6">
        <CampoTexto
          rotulo="Buscar por nome ou apelido"
          type="search"
          name="busca"
          autoComplete="off"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="sm:max-w-sm sm:flex-1"
        />
        <CampoCaixa
          rotulo="Mostrar só os arquivados"
          checked={verArquivados}
          onChange={(e) => setVerArquivados(e.target.checked)}
        />
      </div>

      {limite && plano.dados ? (
        <Aviso tom="info">
          Plano {NOME_DO_PLANO[plano.dados.plano]}: {totalAtivos} de {limite} pacientes ativos. Pacientes arquivados não contam.{' '}
          <Link to="/planos" className="font-semibold">
            Ver planos
          </Link>
        </Aviso>
      ) : null}
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {carregando ? <TelaCarregando /> : null}

      {!carregando && !erro && pacientes.length === 0 ? (
        termo ? (
          <Vazio titulo="Nenhum paciente encontrado." detalhe="Confira a grafia ou busque por outro nome." />
        ) : verArquivados ? (
          <Vazio titulo="Nenhum paciente arquivado." />
        ) : (
          <Vazio titulo="Você ainda não cadastrou pacientes." detalhe="Comece pelo botão “Novo paciente”." />
        )
      ) : null}

      {pacientes.length > 0 ? (
        <ul className="flex flex-col overflow-hidden rounded-card border border-border bg-surface">
          {pacientes.map((p) => {
            const anos = idade(p.birth_date)
            return (
              <li key={p.id} className="border-b border-border-soft last:border-b-0">
                <Link
                  to={`/pacientes/${p.id}`}
                  className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-ink no-underline hover:bg-bg hover:text-ink sm:px-5"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="font-semibold break-words">{p.full_name}</span>
                    <span className="text-sm text-muted">
                      {[anos !== null ? `${anos} anos` : null, p.nicknames.length ? `“${p.nicknames.join('”, “')}”` : null]
                        .filter(Boolean)
                        .join(' · ') || 'Sem data de nascimento'}
                    </span>
                  </span>
                  {p.archived_at ? <Etiqueta>Arquivado</Etiqueta> : null}
                </Link>
              </li>
            )
          })}
        </ul>
      ) : null}
    </>
  )
}
