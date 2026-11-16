import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/auth/contexto'
import { Aviso } from '@/components/ui/Aviso'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { CampoSelecao } from '@/components/ui/CampoSelecao'
import { CampoTexto } from '@/components/ui/CampoTexto'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { TelaCarregando } from '@/components/ui/TelaCarregando'
import { Vazio } from '@/components/ui/Vazio'
import { useConsulta } from '@/lib/consultorio/useConsulta'
import { formatarCrp } from '@/lib/crp'
import { listarSupervisores } from '@/lib/supervisao/api'
import { useTituloPagina } from '@/lib/titulo'
import { OPCOES_UF } from '@/lib/uf'

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR')
}

/** /supervisao/encontrar — rede de supervisores, só para usuários logados. */
export function EncontrarSupervisor() {
  useTituloPagina('Encontrar supervisor')
  const { user } = useAuth()
  const { carregando, dados, erro } = useConsulta('rede-supervisores', listarSupervisores)
  const [busca, setBusca] = useState('')
  const [abordagem, setAbordagem] = useState('')
  const [modalidade, setModalidade] = useState('')
  const [uf, setUf] = useState('')

  const todos = (dados ?? []).filter((s) => s.id !== user?.id)
  const abordagens = [...new Set(todos.flatMap((s) => s.approaches))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const termo = normalizar(busca.trim())
  const filtrados = todos.filter(
    (s) =>
      (!termo ||
        normalizar([s.profiles?.full_name, s.bio, ...s.approaches, ...s.areas, s.city].filter(Boolean).join(' ')).includes(termo)) &&
      (!abordagem || s.approaches.includes(abordagem)) &&
      (!modalidade || s.modalities.includes(modalidade)) &&
      (!uf || s.state === uf),
  )

  return (
    <>
      <Cabecalho
        titulo="Encontrar supervisor"
        voltar={{ para: '/supervisao', rotulo: 'Minha supervisão' }}
        subtitulo="Colegas do Tríade que oferecem supervisão. Veja o perfil, confira o CRP e envie um pedido."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CampoTexto
          rotulo="Buscar"
          type="search"
          name="busca"
          autoComplete="off"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          ajuda="Nome, abordagem, área ou cidade"
        />
        <CampoSelecao
          rotulo="Abordagem"
          name="abordagem"
          vazio="Todas"
          opcoes={abordagens.map((a) => ({ valor: a, rotulo: a }))}
          value={abordagem}
          onChange={(e) => setAbordagem(e.target.value)}
        />
        <CampoSelecao
          rotulo="Modalidade"
          name="modalidade"
          vazio="Todas"
          opcoes={[
            { valor: 'online', rotulo: 'Online' },
            { valor: 'presencial', rotulo: 'Presencial' },
          ]}
          value={modalidade}
          onChange={(e) => setModalidade(e.target.value)}
        />
        <CampoSelecao rotulo="Estado" name="uf" vazio="Todos" opcoes={OPCOES_UF} value={uf} onChange={(e) => setUf(e.target.value)} />
      </div>

      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {carregando ? <TelaCarregando /> : null}
      {!carregando && !erro && filtrados.length === 0 ? (
        todos.length === 0 ? (
          <Vazio
            titulo="Ainda não há supervisores na rede."
            detalhe="Se você oferece supervisão, ative seu perfil em “Meu perfil” e seja o primeiro."
          />
        ) : (
          <Vazio titulo="Nenhum supervisor com esses filtros." detalhe="Tente tirar algum filtro." />
        )
      ) : null}

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filtrados.map((s) => (
          <li key={s.id}>
            <Link
              to={`/supervisao/supervisores/${s.id}`}
              className="flex h-full flex-col gap-3 rounded-card border border-border border-t-4 border-t-ocre bg-surface p-5 text-ink no-underline hover:border-border-strong hover:text-ink"
            >
              <span className="flex flex-wrap items-start justify-between gap-2">
                <span className="flex min-w-0 flex-col">
                  <span className="text-[17px] font-bold break-words">{s.profiles?.full_name}</span>
                  <span className="text-sm text-muted">{formatarCrp(s.profiles?.crp_region ?? null, s.profiles?.crp_number ?? null)}</span>
                </span>
                {s.accepting_new ? <Etiqueta tom="ok">Aceitando</Etiqueta> : <Etiqueta>Sem vagas</Etiqueta>}
              </span>
              {s.approaches.length ? (
                <span className="flex flex-wrap gap-1.5">
                  {s.approaches.map((a) => (
                    <Etiqueta key={a} tom="atencao">
                      {a}
                    </Etiqueta>
                  ))}
                </span>
              ) : null}
              {s.bio ? <span className="line-clamp-3 text-sm text-ink-2">{s.bio}</span> : null}
              <span className="text-[13px] text-muted">
                {[
                  s.modalities.map((m) => (m === 'online' ? 'Online' : 'Presencial')).join(' e '),
                  s.city && s.state ? `${s.city}/${s.state}` : s.state,
                  s.years_experience !== null ? `${s.years_experience} anos de experiência` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
