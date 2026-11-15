/** Conselhos Regionais de Psicologia (CRP). */
export const REGIOES_CRP: ReadonlyArray<{ valor: string; rotulo: string }> = [
  { valor: '01', rotulo: '01 · Distrito Federal' },
  { valor: '02', rotulo: '02 · Pernambuco' },
  { valor: '03', rotulo: '03 · Bahia' },
  { valor: '04', rotulo: '04 · Minas Gerais' },
  { valor: '05', rotulo: '05 · Rio de Janeiro' },
  { valor: '06', rotulo: '06 · São Paulo' },
  { valor: '07', rotulo: '07 · Rio Grande do Sul' },
  { valor: '08', rotulo: '08 · Paraná' },
  { valor: '09', rotulo: '09 · Goiás' },
  { valor: '10', rotulo: '10 · Pará e Amapá' },
  { valor: '11', rotulo: '11 · Ceará' },
  { valor: '12', rotulo: '12 · Santa Catarina' },
  { valor: '13', rotulo: '13 · Paraíba' },
  { valor: '14', rotulo: '14 · Mato Grosso do Sul' },
  { valor: '15', rotulo: '15 · Alagoas' },
  { valor: '16', rotulo: '16 · Espírito Santo' },
  { valor: '17', rotulo: '17 · Rio Grande do Norte' },
  { valor: '18', rotulo: '18 · Mato Grosso' },
  { valor: '19', rotulo: '19 · Sergipe' },
  { valor: '20', rotulo: '20 · Amazonas e Roraima' },
  { valor: '21', rotulo: '21 · Piauí' },
  { valor: '22', rotulo: '22 · Maranhão' },
  { valor: '23', rotulo: '23 · Tocantins' },
  { valor: '24', rotulo: '24 · Rondônia e Acre' },
]

/** "CRP 08/12345", ou null se o perfil não tem CRP. */
export function formatarCrp(regiao: string | null | undefined, numero: string | null | undefined): string | null {
  if (!regiao || !numero) return null
  return `CRP ${regiao}/${numero}`
}
