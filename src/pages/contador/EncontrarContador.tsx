import { useState } from 'react'
import { Link } from 'react-router'
import { Aviso } from '@/components/ui/Aviso'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { CampoSelecao } from '@/components/ui/CampoSelecao'
import { CampoTexto } from '@/components/ui/CampoTexto'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { TelaCarregando } from '@/components/ui/TelaCarregando'
import { Vazio } from '@/components/ui/Vazio'
import { ESPECIALIDADES, formatarCrc, listarContadores } from '@/lib/contador/api'
import { useConsulta } from '@/lib/consultorio/useConsulta'
import { useTituloPagina } from '@/lib/titulo'
import { OPCOES_UF } from '@/lib/uf'

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR')
}

/** /meu-contador/encontrar — rede de contadores (só para psicólogos). */
export function EncontrarContador() {
  useTituloPagina('Encontrar contador')
  const { carregando, dados, erro } = useConsulta('rede-contadores', listarContadores)
  const [busca, setBusca] = useState('')
  const [especialidade, setEspecialidade] = useState('')
  const [uf, setUf] = useState('')

  const todos = dados ?? []
  const termo = normalizar(busca.trim())
  const filtrados = todos.filter(
    (c) =>
      (!termo || normalizar([c.profiles?.full_name, c.firm_name, c.bio, c.city].filter(Boolean).join(' ')).includes(termo)) &&
      (!especialidade || c.specialties.includes(especialidade)) &&
      (!uf || c.state === uf || c.serves_nationwide),
  )

  return (
    <>
      <Cabecalho
        titulo="Encontrar contador"
        voltar={{ para: '/meu-contador', rotulo: 'Contador' }}
        subtitulo="Contadores com CRC que atendem psicólogos. O valor do serviço é combinado direto com o contador."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CampoTexto
          rotulo="Buscar"
          type="search"
          name="busca"
          autoComplete="off"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          ajuda="Nome, escritório ou cidade"
        />
        <CampoSelecao
          rotulo="Especialidade"
          name="especialidade"
          vazio="Todas"
          opcoes={Object.entries(ESPECIALIDADES).map(([valor, rotulo]) => ({ valor, rotulo }))}
          value={especialidade}
          onChange={(e) => setEspecialidade(e.target.value)}
        />
        <CampoSelecao rotulo="Estado" name="uf" vazio="Todos" opcoes={OPCOES_UF} value={uf} onChange={(e) => setUf(e.target.value)} />
      </div>

      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {carregando ? <TelaCarregando /> : null}
      {!carregando && !erro && filtrados.length === 0 ? (
        todos.length === 0 ? (
          <Vazio titulo="Ainda não há contadores na rede." detalhe="Indique o seu: ele se cadastra pela área do contador." />
        ) : (
          <Vazio titulo="Nenhum contador com esses filtros." detalhe="Tente tirar algum filtro." />
        )
      ) : null}

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filtrados.map((c) => (
          <li key={c.id}>
            <Link
              to={`/meu-contador/contadores/${c.id}`}
              className="flex h-full flex-col gap-3 rounded-card border border-border border-t-4 border-t-pine bg-surface p-5 text-ink no-underline hover:border-border-strong hover:text-ink"
            >
              <span className="flex flex-wrap items-start justify-between gap-2">
                <span className="flex min-w-0 flex-col">
                  <span className="text-[17px] font-bold break-words">{c.profiles?.full_name}</span>
                  <span className="text-sm text-muted">{[c.firm_name, formatarCrc(c)].filter(Boolean).join(' · ')}</span>
                </span>
                {c.accepting_new ? <Etiqueta tom="ok">Aceitando</Etiqueta> : <Etiqueta>Sem vagas</Etiqueta>}
              </span>
              {c.specialties.length ? (
                <span className="flex flex-wrap gap-1.5">
                  {c.specialties.map((e) => (
                    <Etiqueta key={e} tom="atencao">
                      {ESPECIALIDADES[e] ?? e}
                    </Etiqueta>
                  ))}
                </span>
              ) : null}
              {c.bio ? <span className="line-clamp-3 text-sm text-ink-2">{c.bio}</span> : null}
              <span className="text-[13px] text-muted">
                {[c.city && c.state ? `${c.city}/${c.state}` : c.state, c.serves_nationwide ? 'Atende todo o Brasil' : null, c.price_info]
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
