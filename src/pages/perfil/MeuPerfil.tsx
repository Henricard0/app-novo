import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useAuth, type Perfil } from '@/auth/contexto'
import { Aviso } from '@/components/ui/Aviso'
import { Botao } from '@/components/ui/Botao'
import { Cabecalho } from '@/components/ui/Cabecalho'
import { CampoAreaTexto } from '@/components/ui/CampoAreaTexto'
import { CampoCaixa } from '@/components/ui/CampoCaixa'
import { CampoSelecao } from '@/components/ui/CampoSelecao'
import { CampoTexto } from '@/components/ui/CampoTexto'
import { TelaCarregando } from '@/components/ui/TelaCarregando'
import { useConsulta } from '@/lib/consultorio/useConsulta'
import { REGIOES_CRP } from '@/lib/crp'
import {
  buscarMeuPerfilSupervisor,
  salvarDadosPessoais,
  salvarPerfilSupervisor,
  type PerfilSupervisor,
} from '@/lib/supervisao/api'
import { useTituloPagina } from '@/lib/titulo'
import { OPCOES_UF } from '@/lib/uf'
import { validarCrp } from '@/lib/validacao'

/** /perfil — dados pessoais, CRP e perfil de supervisor (opcional). */
export function MeuPerfil() {
  useTituloPagina('Meu perfil')
  const { user, perfil } = useAuth()
  const id = user?.id ?? ''
  const supervisor = useConsulta(`perfil-supervisor:${id}`, () => buscarMeuPerfilSupervisor(id))

  if (!perfil || supervisor.carregando) return <TelaCarregando />
  return (
    <>
      <Cabecalho titulo="Meu perfil" />
      <DadosPessoais perfil={perfil} />
      {supervisor.erro ? <Aviso tom="erro">{supervisor.erro}</Aviso> : null}
      <PerfilDeSupervisor
        id={id}
        temCrp={Boolean(perfil.crp_number)}
        atual={supervisor.dados}
        aoSalvar={supervisor.recarregar}
      />
    </>
  )
}

function DadosPessoais({ perfil }: { perfil: Perfil }) {
  const { recarregarPerfil } = useAuth()
  const [nome, setNome] = useState(perfil.full_name)
  const [regiao, setRegiao] = useState(perfil.crp_region ?? '')
  const [numero, setNumero] = useState(perfil.crp_number ?? '')
  const [erros, setErros] = useState<{ nome?: string | null; regiao?: string | null; numero?: string | null }>({})
  const [mensagem, setMensagem] = useState<{ tom: 'erro' | 'sucesso'; texto: string } | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const crp = validarCrp(regiao, numero)
    const novos = { nome: nome.trim() ? null : 'Informe seu nome.', regiao: crp.regiao ?? null, numero: crp.numero ?? null }
    setErros(novos)
    setMensagem(null)
    if (Object.values(novos).some(Boolean)) return
    setEnviando(true)
    const temCrp = Boolean(regiao && numero.trim())
    const { erro } = await salvarDadosPessoais(perfil.id, {
      nome: nome.trim(),
      crpRegiao: temCrp ? regiao : null,
      crpNumero: temCrp ? numero.trim() : null,
    })
    setEnviando(false)
    if (erro) setMensagem({ tom: 'erro', texto: erro })
    else {
      setMensagem({ tom: 'sucesso', texto: 'Dados salvos.' })
      recarregarPerfil()
    }
  }

  return (
    <form
      noValidate
      onSubmit={aoEnviar}
      aria-labelledby="titulo-dados"
      className="flex max-w-2xl flex-col gap-5 rounded-card border border-border bg-surface p-5 sm:p-6"
    >
      <h2 id="titulo-dados" className="text-lg font-bold">
        Dados pessoais
      </h2>
      {mensagem ? <Aviso tom={mensagem.tom}>{mensagem.texto}</Aviso> : null}
      <CampoTexto
        rotulo="Nome completo"
        name="nome"
        autoComplete="name"
        maxLength={200}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        erro={erros.nome}
      />
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1.5 text-sm font-semibold text-ink-2">
          Registro no CRP <span className="font-normal text-muted">(opcional para estagiários)</span>
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1fr]">
          <CampoSelecao
            rotulo="Região"
            name="crp_regiao"
            opcoes={REGIOES_CRP}
            vazio="Escolha"
            value={regiao}
            onChange={(e) => setRegiao(e.target.value)}
            erro={erros.regiao}
          />
          <CampoTexto
            rotulo="Número"
            name="crp_numero"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={numero}
            onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))}
            erro={erros.numero}
          />
        </div>
      </fieldset>
      <Botao type="submit" carregando={enviando} textoCarregando="Salvando…" className="w-fit">
        Salvar dados pessoais
      </Botao>
    </form>
  )
}

function lista(texto: string, maximo: number): string[] {
  return texto
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, maximo)
}

/** Chaves marcadas; se nenhuma, usa o padrão (o banco exige pelo menos uma). */
function escolhidos(opcoes: Record<string, boolean>, padrao: string): string[] {
  const marcados = Object.keys(opcoes).filter((k) => opcoes[k])
  return marcados.length ? marcados : [padrao]
}

function PerfilDeSupervisor({
  id,
  temCrp,
  atual,
  aoSalvar,
}: {
  id: string
  temCrp: boolean
  atual: PerfilSupervisor | null
  aoSalvar: () => void
}) {
  const [oferece, setOferece] = useState(atual?.offers_supervision ?? false)
  const [aceitando, setAceitando] = useState(atual?.accepting_new ?? true)
  const [bio, setBio] = useState(atual?.bio ?? '')
  const [formacao, setFormacao] = useState(atual?.education ?? '')
  const [abordagens, setAbordagens] = useState(atual?.approaches.join(', ') ?? '')
  const [areas, setAreas] = useState(atual?.areas.join(', ') ?? '')
  const [anos, setAnos] = useState(atual?.years_experience?.toString() ?? '')
  const [presencial, setPresencial] = useState(atual?.modalities.includes('presencial') ?? false)
  const [online, setOnline] = useState(atual?.modalities.includes('online') ?? true)
  const [individual, setIndividual] = useState(atual?.formats.includes('individual') ?? true)
  const [grupo, setGrupo] = useState(atual?.formats.includes('grupo') ?? false)
  const [cidade, setCidade] = useState(atual?.city ?? '')
  const [uf, setUf] = useState(atual?.state ?? '')
  const [valor, setValor] = useState(atual?.price_info ?? '')
  const [erros, setErros] = useState<Partial<Record<'anos' | 'modalidade' | 'formato' | 'bio', string | null>>>({})
  const [mensagem, setMensagem] = useState<{ tom: 'erro' | 'sucesso'; texto: string } | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function aoEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const numeroAnos = anos.trim() ? Number(anos) : null
    const novos = {
      anos: numeroAnos !== null && !(Number.isInteger(numeroAnos) && numeroAnos >= 0 && numeroAnos <= 70) ? 'Use um número de 0 a 70.' : null,
      modalidade: oferece && !presencial && !online ? 'Escolha pelo menos uma modalidade.' : null,
      formato: oferece && !individual && !grupo ? 'Escolha pelo menos um formato.' : null,
      bio: oferece && !bio.trim() ? 'Escreva uma apresentação curta: é o que os colegas leem primeiro.' : null,
    }
    setErros(novos)
    setMensagem(null)
    if (Object.values(novos).some(Boolean)) return
    setEnviando(true)
    const { erro } = await salvarPerfilSupervisor(
      id,
      {
        offers_supervision: oferece,
        accepting_new: aceitando,
        bio: bio.trim() || null,
        education: formacao.trim() || null,
        approaches: lista(abordagens, 10),
        areas: lista(areas, 15),
        years_experience: numeroAnos,
        modalities: escolhidos({ presencial, online }, 'online'),
        formats: escolhidos({ individual, grupo }, 'individual'),
        city: cidade.trim() || null,
        state: uf || null,
        price_info: valor.trim() || null,
      },
      Boolean(atual),
    )
    setEnviando(false)
    if (erro) setMensagem({ tom: 'erro', texto: erro })
    else {
      setMensagem({
        tom: 'sucesso',
        texto: oferece
          ? temCrp
            ? 'Perfil salvo. Você aparece na rede de supervisores.'
            : 'Perfil salvo. Para aparecer na rede, cadastre seu CRP em “Dados pessoais”.'
          : 'Perfil salvo. Você não aparece na rede de supervisores.',
      })
      aoSalvar()
    }
  }

  return (
    <form
      noValidate
      onSubmit={aoEnviar}
      aria-labelledby="titulo-supervisor"
      className="flex max-w-2xl flex-col gap-5 rounded-card border border-border border-t-4 border-t-ocre bg-surface p-5 sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="titulo-supervisor" className="text-lg font-bold">
          Perfil de supervisor
        </h2>
        <p className="text-sm text-muted">
          Opcional. Se você oferece supervisão, colegas que usam o Tríade podem encontrar seu perfil e pedir supervisão. Só
          usuários logados veem a rede.
        </p>
      </div>
      {mensagem ? <Aviso tom={mensagem.tom}>{mensagem.texto}</Aviso> : null}
      {!temCrp ? (
        <Aviso tom="info">Para aparecer na rede de supervisores é preciso ter o CRP cadastrado em “Dados pessoais”.</Aviso>
      ) : null}
      <CampoCaixa rotulo="Ofereço supervisão" checked={oferece} onChange={(e) => setOferece(e.target.checked)} />

      {oferece ? (
        <>
          <CampoCaixa
            rotulo="Estou aceitando novos supervisionandos"
            checked={aceitando}
            onChange={(e) => setAceitando(e.target.checked)}
          />
          <CampoAreaTexto
            rotulo="Apresentação"
            name="bio"
            rows={4}
            maxLength={1500}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            erro={erros.bio}
            ajuda="Sua experiência e como você conduz a supervisão. Siga as normas do CFP sobre divulgação profissional."
          />
          <CampoAreaTexto
            rotulo="Formação"
            opcional
            name="formacao"
            rows={3}
            maxLength={1500}
            value={formacao}
            onChange={(e) => setFormacao(e.target.value)}
          />
          <CampoTexto
            rotulo="Abordagens"
            opcional
            name="abordagens"
            autoComplete="off"
            value={abordagens}
            onChange={(e) => setAbordagens(e.target.value)}
            ajuda="Separe por vírgula. Ex.: TCC, Psicanálise, Sistêmica."
          />
          <CampoTexto
            rotulo="Áreas de atuação"
            opcional
            name="areas"
            autoComplete="off"
            value={areas}
            onChange={(e) => setAreas(e.target.value)}
            ajuda="Separe por vírgula. Ex.: Clínica infantil, Luto, Ansiedade."
          />
          <CampoTexto
            rotulo="Anos de experiência clínica"
            opcional
            type="number"
            name="anos"
            inputMode="numeric"
            min={0}
            max={70}
            value={anos}
            onChange={(e) => setAnos(e.target.value)}
            erro={erros.anos}
            className="max-w-56"
          />
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-semibold text-ink-2">Modalidade</legend>
            <div className="flex flex-wrap gap-x-6">
              <CampoCaixa rotulo="Online" checked={online} onChange={(e) => setOnline(e.target.checked)} />
              <CampoCaixa rotulo="Presencial" checked={presencial} onChange={(e) => setPresencial(e.target.checked)} />
            </div>
            {erros.modalidade ? <p className="text-[13px] font-medium text-danger">{erros.modalidade}</p> : null}
          </fieldset>
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-semibold text-ink-2">Formato</legend>
            <div className="flex flex-wrap gap-x-6">
              <CampoCaixa rotulo="Individual" checked={individual} onChange={(e) => setIndividual(e.target.checked)} />
              <CampoCaixa rotulo="Em grupo" checked={grupo} onChange={(e) => setGrupo(e.target.checked)} />
            </div>
            {erros.formato ? <p className="text-[13px] font-medium text-danger">{erros.formato}</p> : null}
          </fieldset>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-[2fr_1fr]">
            <CampoTexto
              rotulo="Cidade"
              opcional
              name="cidade"
              autoComplete="address-level2"
              maxLength={100}
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
            />
            <CampoSelecao rotulo="Estado" opcional name="uf" vazio="—" opcoes={OPCOES_UF} value={uf} onChange={(e) => setUf(e.target.value)} />
          </div>
          <CampoTexto
            rotulo="Valor da supervisão"
            opcional
            name="valor"
            autoComplete="off"
            maxLength={200}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            ajuda="Só informativo. Ex.: R$ 150 por sessão individual. O pagamento é combinado entre vocês."
          />
        </>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <Botao type="submit" carregando={enviando} textoCarregando="Salvando…" variante="supervisao">
          Salvar perfil de supervisor
        </Botao>
        {atual?.offers_supervision && temCrp ? (
          <Link to={`/supervisao/supervisores/${id}`} className="inline-flex min-h-11 items-center text-sm font-semibold">
            Ver como os colegas veem
          </Link>
        ) : null}
      </div>
    </form>
  )
}
