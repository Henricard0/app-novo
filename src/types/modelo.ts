// Formato dos documentos do Firestore. As regras de segurança (firestore.rules)
// validam os mesmos campos: ao mudar um, mude o outro.

/** profiles/{uid} — um por usuário. */
export type PerfilDoc = {
  full_name: string
  /** Região do CRP com dois dígitos ("08"). Nulo para estagiários, junto com crp_number. */
  crp_region: string | null
  /** Número de inscrição no CRP, só dígitos. */
  crp_number: string | null
  created_at: unknown
  updated_at: unknown
}

export type Perfil = Pick<PerfilDoc, 'full_name' | 'crp_region' | 'crp_number'> & { id: string }
