// Anonimização v1 (docs/especificacao.md, seção 5). Determinística e local:
// roda no navegador e nenhum texto clínico sai para API externa (CLAUDE.md, regra 6).
// Ajuda, mas não substitui a revisão do psicólogo, que é sempre obrigatória.

export type TipoTroca =
  | 'Nome do paciente'
  | 'Nome de familiar ou contato'
  | 'E-mail'
  | 'CPF'
  | 'Documento'
  | 'CEP'
  | 'Telefone'
  | 'Endereço'
  | 'Local'
  | 'Data'
  | 'Trecho marcado por você'

export type Troca = { tipo: TipoTroca; original: string; substituto: string }

export type OpcoesAnonimizacao = {
  /** Nome completo e apelidos do paciente. */
  nomesPaciente: string[]
  /** Nomes de familiares e contatos cadastrados. */
  nomesContatos: string[]
  rotuloPaciente: 'A paciente' | 'O paciente'
  /** Troca dd/mm/aaaa por mês/ano. */
  datasMesAno: boolean
  /** Outros trechos que o psicólogo quer remover. */
  termosExtras: string[]
}

const CONECTIVOS = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'di', 'du'])
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const VARIANTES: Record<string, string> = {
  a: 'aáàâãä',
  e: 'eéèêë',
  i: 'iíìîï',
  o: 'oóòôõö',
  u: 'uúùûü',
  c: 'cç',
  n: 'nñ',
}

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

/** Regex que acha o termo inteiro, sem diferenciar maiúsculas nem acentos. */
function padraoDoTermo(termo: string): RegExp {
  const corpo = [...semAcento(termo.trim()).toLowerCase()]
    .map((ch) => {
      if (VARIANTES[ch]) return `[${VARIANTES[ch]}]`
      if (/\s/.test(ch)) return '\\s+'
      return ch.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&')
    })
    .join('')
  return new RegExp(`(?<![\\p{L}\\p{N}])${corpo}(?![\\p{L}\\p{N}])`, 'giu')
}

/** Formas do nome: completo, primeiro + segundo, e cada parte (sem "da", "de"…). */
export function variantesDoNome(nome: string): string[] {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  const formas = new Set<string>()
  if (partes.length) formas.add(partes.join(' '))
  if (partes.length > 2) {
    // Primeiro + segundo nome; se o segundo for "da", "de"…, inclui o seguinte.
    const fim = CONECTIVOS.has((partes[1] ?? '').toLowerCase()) ? 3 : 2
    if (fim < partes.length) formas.add(partes.slice(0, fim).join(' '))
  }
  for (const p of partes) {
    if (p.length >= 3 && !CONECTIVOS.has(p.toLowerCase())) formas.add(p)
  }
  return [...formas]
}

function comecoDeFrase(texto: string, posicao: number): boolean {
  const antes = texto.slice(0, posicao)
  return antes.trim() === '' || /[.!?…:]\s*["“]?\s*$|\n\s*$/.test(antes)
}

export function anonimizar(texto: string, opcoes: OpcoesAnonimizacao): { texto: string; trocas: Troca[] } {
  const trocas: Troca[] = []
  let atual = texto

  function trocar(padrao: RegExp, tipo: TipoTroca, substituto: string | ((original: string, posicao: number, todo: string) => string)) {
    atual = atual.replace(padrao, (...args: unknown[]) => {
      const original = args[0] as string
      const grupos = args.at(-1)
      const posicao = (typeof grupos === 'object' ? args.at(-3) : args.at(-2)) as number
      const todo = (typeof grupos === 'object' ? args.at(-2) : args.at(-1)) as string
      const novo = typeof substituto === 'function' ? substituto(original, posicao, todo) : substituto
      if (novo !== original) trocas.push({ tipo, original, substituto: novo })
      return novo
    })
  }

  // 1. Contatos e documentos (antes dos nomes, que podem aparecer dentro de e-mails).
  trocar(/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu, 'E-mail', '[e-mail removido]')
  trocar(/(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/g, 'CPF', '[CPF removido]')
  trocar(/\bRG\s*(?:n[º°o.]?\s*)?:?\s*[\dxX.-]{5,}/gi, 'Documento', 'RG [documento removido]')
  trocar(/\bCEP\s*:?\s*\d{5}-?\d{3}\b|(?<!\d)\d{5}-\d{3}(?!\d)/gi, 'CEP', '[CEP removido]')
  trocar(/(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?(?<!\d)9?\d{4}[-\s]?\d{4}(?!\d)/g, 'Telefone', '[telefone removido]')

  // 2. Endereços e bairros.
  trocar(
    /\b(?:Rua|R\.|Avenida|Av\.|Travessa|Tv\.|Alameda|Al\.|Rodovia|Praça|Estrada|Largo)\s+[^,.;\n]{2,60}?(?:,?\s*(?:n[º°o.]?\s*)?\d+[A-Za-z]?)?(?=[,.;\n)]|$)/giu,
    'Endereço',
    '[endereço removido]',
  )
  trocar(
    /\b(?:no|na|do|da)?\s*bairro\s+(?:d[aeo]s?\s+)?\p{Lu}[\p{L}'-]+(?:\s+(?:d[aeo]s?\s+)?\p{Lu}[\p{L}'-]+)*/gu,
    'Local',
    (original) => (/^(no|na|do|da)\s/i.test(original) ? `${original.split(/\s/)[0]} [local removido]` : '[local removido]'),
  )

  // 3. Trechos marcados pelo psicólogo.
  for (const termo of opcoes.termosExtras.map((t) => t.trim()).filter((t) => t.length >= 2)) {
    trocar(padraoDoTermo(termo), 'Trecho marcado por você', '[removido]')
  }

  // 4. Nomes de familiares e contatos.
  const formasContatos = opcoes.nomesContatos.flatMap(variantesDoNome).sort((a, b) => b.length - a.length)
  for (const forma of formasContatos) trocar(padraoDoTermo(forma), 'Nome de familiar ou contato', '[nome removido]')

  // 5. Nome e apelidos do paciente.
  const rotulo = opcoes.rotuloPaciente
  const minusculo = rotulo.charAt(0).toLowerCase() + rotulo.slice(1)
  const formasPaciente = opcoes.nomesPaciente.flatMap(variantesDoNome).sort((a, b) => b.length - a.length)
  for (const forma of formasPaciente) {
    trocar(padraoDoTermo(forma), 'Nome do paciente', (_o, posicao, todo) => (comecoDeFrase(todo, posicao) ? rotulo : minusculo))
  }

  // 6. Datas.
  if (opcoes.datasMesAno) {
    trocar(/(?<!\d)(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?!\d)/g, 'Data', (original) => {
      const [, , mes, ano] = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(original) ?? []
      const indice = Number(mes) - 1
      if (!(indice >= 0 && indice < 12) || !ano) return original
      return `${MESES[indice]}/${ano.length === 2 ? `20${ano}` : ano}`
    })
  }

  return { texto: atual, trocas }
}

/** "Paciente A., 34 anos" — inicial do primeiro nome e, se quiser, a idade. */
export function rotuloDoCaso(nomeCompleto: string, idade: number | null, manterIdade: boolean): string {
  const inicial = semAcento(nomeCompleto.trim()).charAt(0).toUpperCase() || 'X'
  return manterIdade && idade !== null ? `Paciente ${inicial}., ${idade} anos` : `Paciente ${inicial}.`
}

/** "Sessão · nov/2026" ou "Sessão · 06/11/2026". */
export function rotuloDoPeriodo(dataISO: string, datasMesAno: boolean): string {
  const [ano, mes, dia] = dataISO.split('-')
  if (!ano || !mes || !dia) return 'Sessão'
  return datasMesAno ? `Sessão · ${MESES[Number(mes) - 1]}/${ano}` : `Sessão · ${dia}/${mes}/${ano}`
}
