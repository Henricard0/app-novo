import { useState, type FormEvent } from 'react'
import { useAuth } from '@/auth/contexto'
import { Aviso } from '@/components/ui/Aviso'
import { Botao } from '@/components/ui/Botao'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { CampoAreaTexto } from '@/components/ui/CampoAreaTexto'
import { CampoCaixa } from '@/components/ui/CampoCaixa'
import { CampoSelecao } from '@/components/ui/CampoSelecao'
import { CampoTexto } from '@/components/ui/CampoTexto'
import { TelaCarregando } from '@/components/ui/TelaCarregando'
import { ESPECIALIDADES, buscarMeuPerfilContador, salvarPerfilContador, type PerfilContador as Perfil } from '@/lib/contador/api'
import { useConsulta } from '@/lib/consultorio/useConsulta'
import { salvarDadosPessoais } from '@/lib/supervisao/api'
import { useTituloPagina } from '@/lib/titulo'
import { OPCOES_UF } from '@/lib/uf'
import { validarNome } from '@/lib/validacao'

/** /contador/perfil — dados do contador e como ele aparece na rede. */
export function PerfilContador() {
  useTituloPagina('Meu perfil')
  const auth = useAuth()
  const meuId = auth.user?.id ?? ''
  const consulta = useConsulta(`perfil-contador:${meuId}`, () => buscarMeuPerfilContador(meuId))
  if (consulta.carregando) return <TelaCarregando />
  if (!consulta.dados) return <Aviso tom="erro">{consulta.erro ?? 'Perfil não encontrado.'}</Aviso>
  return <Formulario perfil={consulta.dados} nomeAtual={auth.perfil?.full_name ?? ''} aoSalvar={auth.recarregarPerfil} />
}

function Formulario({ perfil, nomeAtual, aoSalvar }: { perfil: Perfil; nomeAtual: string; aoSalvar: () => void }) {
  const [nome, setNome] = useState(nomeAtual)
  const [crcUf, setCrcUf] = useState(perfil.crc_state ?? '')
  const [crcNumero, setCrcNumero] = useState(perfil.crc_number ?? '')
  const [categoria, setCategoria] = useState(perfil.crc_category ?? 'contador')
  const [escritorio, setEscritorio] = useState(perfil.firm_name ?? '')
  const [bio, setBio] = useState(perfil.bio ?? '')
  const [especialidades, setEspecialidades] = useState<string[]>(perfil.specialties)
  const [uf, setUf] = useState(perfil.state ?? '')
  const [cidade, setCidade] = useState(perfil.city ?? '')
  const [todoBrasil, setTodoBrasil] = useState(perfil.serves_nationwide)
  const [preco, setPreco] = useState(perfil.price_info ?? '')
  const [naRede, setNaRede] = useState(perfil.listed)
  const [aceitando, setAceitando] = useState(perfil.accepting_new)
  const [erros, setErros] = useState<Partial<Record<'nome' | 'crc', string | null>>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [enviando, setEnviando] = useState(false)

  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSalvo(false)
    const temCrc = Boolean(crcUf && crcNumero.trim())
    const novos = {
      nome: validarNome(nome),
      crc:
        (crcUf || crcNumero.trim()) && !(crcUf && /^\d{1,6}$/.test(crcNumero.trim()))
          ? 'Informe estado e número do CRC (só números).'
          : naRede && !temCrc
            ? 'Para aparecer na rede, informe o CRC.'
            : null,
    }
    setErros(novos)
    setErro(null)
    if (novos.nome || novos.crc) return
    setEnviando(true)
    const pessoais = await salvarDadosPessoais(perfil.id, { nome: nome.trim(), crpRegiao: null, crpNumero: null })
    const r = pessoais.erro
      ? pessoais
      : await salvarPerfilContador(perfil.id, {
          crc_state: temCrc ? crcUf : null,
          crc_number: temCrc ? crcNumero.trim() : null,
          crc_category: temCrc ? categoria : null,
          firm_name: escritorio.trim() || null,
          bio: bio.trim() || null,
          specialties: especialidades,
          state: uf || null,
          city: cidade.trim() || null,
          serves_nationwide: todoBrasil,
          price_info: preco.trim() || null,
          listed: naRede,
          accepting_new: aceitando,
        })
    setEnviando(false)
    if (r.erro) setErro(r.erro)
    else {
      setSalvo(true)
      aoSalvar()
    }
  }

  return (
    <>
      <Cabecalho titulo="Meu perfil" subtitulo="É o que os psicólogos veem na rede de contadores." />
      <form noValidate onSubmit={salvar} className="flex max-w-2xl flex-col gap-6">
        {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
        {salvo ? <Aviso tom="sucesso">Perfil salvo.</Aviso> : null}

        <section className="flex flex-col gap-5 rounded-card border border-border bg-surface p-5 sm:p-6">
          <CampoTexto rotulo="Nome completo" name="nome" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} erro={erros.nome} />
          <CampoTexto
            rotulo="Escritório"
            opcional
            name="escritorio"
            maxLength={150}
            autoComplete="organization"
            value={escritorio}
            onChange={(e) => setEscritorio(e.target.value)}
          />
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1.5 text-sm font-semibold text-ink-2">Registro no CRC</legend>
            {erros.crc ? <p className="text-[13px] font-medium text-danger">{erros.crc}</p> : null}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <CampoSelecao rotulo="Estado" name="crc_uf" vazio="Escolha" opcoes={OPCOES_UF} value={crcUf} onChange={(e) => setCrcUf(e.target.value)} />
              <CampoTexto
                rotulo="Número"
                name="crc_numero"
                inputMode="numeric"
                maxLength={6}
                autoComplete="off"
                value={crcNumero}
                onChange={(e) => setCrcNumero(e.target.value.replace(/\D/g, ''))}
              />
              <CampoSelecao
                rotulo="Categoria"
                name="crc_categoria"
                opcoes={[
                  { valor: 'contador', rotulo: 'Contador' },
                  { valor: 'tecnico', rotulo: 'Técnico' },
                ]}
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
              />
            </div>
          </fieldset>
        </section>

        <section className="flex flex-col gap-5 rounded-card border border-border bg-surface p-5 sm:p-6">
          <h2 className="text-lg font-bold">Na rede de contadores</h2>
          <CampoCaixa rotulo="Aparecer na rede para psicólogos" checked={naRede} onChange={(e) => setNaRede(e.target.checked)} />
          <CampoCaixa rotulo="Aceitando novos clientes" checked={aceitando} onChange={(e) => setAceitando(e.target.checked)} />
          <CampoAreaTexto
            rotulo="Apresentação"
            opcional
            name="bio"
            rows={5}
            maxLength={1500}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            ajuda="Como você atende psicólogos, experiência, prazos."
          />
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-semibold text-ink-2">Especialidades</legend>
            {Object.entries(ESPECIALIDADES).map(([valor, rotulo]) => (
              <CampoCaixa
                key={valor}
                rotulo={rotulo}
                checked={especialidades.includes(valor)}
                onChange={(e) =>
                  setEspecialidades((lista) => (e.target.checked ? [...lista, valor] : lista.filter((x) => x !== valor)))
                }
              />
            ))}
          </fieldset>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_2fr]">
            <CampoSelecao rotulo="Estado" name="uf" vazio="Escolha" opcoes={OPCOES_UF} value={uf} onChange={(e) => setUf(e.target.value)} />
            <CampoTexto rotulo="Cidade" opcional name="cidade" maxLength={100} value={cidade} onChange={(e) => setCidade(e.target.value)} />
          </div>
          <CampoCaixa rotulo="Atendo psicólogos de todo o Brasil (online)" checked={todoBrasil} onChange={(e) => setTodoBrasil(e.target.checked)} />
          <CampoTexto
            rotulo="Valores"
            opcional
            name="preco"
            maxLength={200}
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            ajuda="Só informativo. O valor é combinado direto com cada psicólogo."
          />
        </section>

        <Botao type="submit" className="w-fit" carregando={enviando} textoCarregando="Salvando…">
          Salvar perfil
        </Botao>
      </form>
    </>
  )
}
