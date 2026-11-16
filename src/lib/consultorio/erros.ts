import { ERRO_CONEXAO, ERRO_GENERICO } from '@/lib/erros-auth'

type ErroBanco = { code?: string; message?: string; name?: string } | null | undefined

/** Traduz erros do banco (PostgREST) para mensagens em português, sem expor detalhes técnicos. */
export function traduzirErroBanco(erro: unknown): string {
  const e = erro as ErroBanco
  if (!e) return ERRO_GENERICO
  if (e.name === 'TypeError' || /fetch|network/i.test(e.message ?? '')) return ERRO_CONEXAO
  switch (e.code) {
    case '42501':
      return 'Você não tem permissão para fazer isso.'
    case '23514':
    case '22001':
    case '22007':
    case '22008':
      return 'Algum dado está fora do formato aceito. Confira os campos e tente de novo.'
    case 'P0002':
    case 'PGRST116':
      return 'Não encontramos este item. Ele pode ter sido excluído.'
    default:
      return ERRO_GENERICO
  }
}
