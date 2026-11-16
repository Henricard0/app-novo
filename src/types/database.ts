// Tipos do banco no formato do `supabase gen types typescript`.
// Regenere com o Supabase local rodando: npm run db:types

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      appointments: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          location: string | null
          modality: string
          owner_id: string
          patient_id: string
          series_id: string | null
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          location?: string | null
          modality?: string
          owner_id?: string
          patient_id: string
          series_id?: string | null
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          location?: string | null
          modality?: string
          owner_id?: string
          patient_id?: string
          series_id?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'appointments_patient_id_fkey'
            columns: ['patient_id']
            isOneToOne: false
            referencedRelation: 'patients'
            referencedColumns: ['id']
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          at: string
          entity: string
          entity_id: string
          id: number
          owner_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          at?: string
          entity: string
          entity_id: string
          id?: never
          owner_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          at?: string
          entity?: string
          entity_id?: string
          id?: never
          owner_id?: string
        }
        Relationships: []
      }
      clinical_record_versions: {
        Row: {
          appointment_id: string | null
          body: string
          created_at: string
          created_by: string | null
          id: string
          record_id: string
          replaced_at: string
          session_date: string
        }
        Insert: {
          appointment_id?: string | null
          body: string
          created_at: string
          created_by?: string | null
          id?: string
          record_id: string
          replaced_at?: string
          session_date: string
        }
        Update: {
          appointment_id?: string | null
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          record_id?: string
          replaced_at?: string
          session_date?: string
        }
        Relationships: [
          {
            foreignKeyName: 'clinical_record_versions_record_id_fkey'
            columns: ['record_id']
            isOneToOne: false
            referencedRelation: 'clinical_records'
            referencedColumns: ['id']
          },
        ]
      }
      clinical_records: {
        Row: {
          appointment_id: string | null
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          id: string
          owner_id: string
          patient_id: string
          session_date: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          appointment_id?: string | null
          author_id?: string
          body: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          id?: string
          owner_id?: string
          patient_id: string
          session_date?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          appointment_id?: string | null
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          id?: string
          owner_id?: string
          patient_id?: string
          session_date?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'clinical_records_appointment_id_fkey'
            columns: ['appointment_id']
            isOneToOne: false
            referencedRelation: 'appointments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'clinical_records_patient_id_fkey'
            columns: ['patient_id']
            isOneToOne: false
            referencedRelation: 'patients'
            referencedColumns: ['id']
          },
        ]
      }
      patient_contacts: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          patient_id: string
          phone: string | null
          relation: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id?: string
          patient_id: string
          phone?: string | null
          relation?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          patient_id?: string
          phone?: string | null
          relation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'patient_contacts_patient_id_fkey'
            columns: ['patient_id']
            isOneToOne: false
            referencedRelation: 'patients'
            referencedColumns: ['id']
          },
        ]
      }
      patients: {
        Row: {
          archived_at: string | null
          birth_date: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          nicknames: string[]
          owner_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          birth_date?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          nicknames?: string[]
          owner_id?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          birth_date?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          nicknames?: string[]
          owner_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          crp_number: string | null
          crp_region: string | null
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          crp_number?: string | null
          crp_region?: string | null
          full_name: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          crp_number?: string | null
          crp_region?: string | null
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      supervision_invites: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          inviter_id: string
          inviter_role: string
          link_id: string | null
          token: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          inviter_id?: string
          inviter_role: string
          link_id?: string | null
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          inviter_id?: string
          inviter_role?: string
          link_id?: string | null
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'supervision_invites_inviter_id_fkey'
            columns: ['inviter_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      supervision_links: {
        Row: {
          created_at: string
          ended_at: string | null
          ended_by: string | null
          format: string
          id: string
          origin: string
          status: string
          supervisee_id: string
          supervisor_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          ended_by?: string | null
          format?: string
          id?: string
          origin: string
          status?: string
          supervisee_id: string
          supervisor_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          ended_by?: string | null
          format?: string
          id?: string
          origin?: string
          status?: string
          supervisee_id?: string
          supervisor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'supervision_links_supervisee_id_fkey'
            columns: ['supervisee_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'supervision_links_supervisor_id_fkey'
            columns: ['supervisor_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      supervision_requests: {
        Row: {
          created_at: string
          id: string
          link_id: string | null
          message: string | null
          requester_id: string
          responded_at: string | null
          status: string
          supervisor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link_id?: string | null
          message?: string | null
          requester_id?: string
          responded_at?: string | null
          status?: string
          supervisor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link_id?: string | null
          message?: string | null
          requester_id?: string
          responded_at?: string | null
          status?: string
          supervisor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'supervision_requests_requester_id_fkey'
            columns: ['requester_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'supervision_requests_supervisor_id_fkey'
            columns: ['supervisor_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      supervisor_profiles: {
        Row: {
          accepting_new: boolean
          approaches: string[]
          areas: string[]
          bio: string | null
          city: string | null
          created_at: string
          education: string | null
          formats: string[]
          id: string
          modalities: string[]
          offers_supervision: boolean
          price_info: string | null
          state: string | null
          updated_at: string
          years_experience: number | null
        }
        Insert: {
          accepting_new?: boolean
          approaches?: string[]
          areas?: string[]
          bio?: string | null
          city?: string | null
          created_at?: string
          education?: string | null
          formats?: string[]
          id: string
          modalities?: string[]
          offers_supervision?: boolean
          price_info?: string | null
          state?: string | null
          updated_at?: string
          years_experience?: number | null
        }
        Update: {
          accepting_new?: boolean
          approaches?: string[]
          areas?: string[]
          bio?: string | null
          city?: string | null
          created_at?: string
          education?: string | null
          formats?: string[]
          id?: string
          modalities?: string[]
          offers_supervision?: boolean
          price_info?: string | null
          state?: string | null
          updated_at?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'supervisor_profiles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aceitar_convite: { Args: { p_token: string }; Returns: string }
      cancelar_solicitacao: { Args: { p_id: string }; Returns: undefined }
      encerrar_vinculo: { Args: { p_id: string }; Returns: undefined }
      responder_solicitacao: { Args: { p_aceitar: boolean; p_id: string }; Returns: string }
      ver_convite: {
        Args: { p_token: string }
        Returns: {
          inviter_crp_number: string | null
          inviter_crp_region: string | null
          inviter_name: string
          inviter_role: string
          valido: boolean
        }[]
      }
      excluir_registro_clinico: {
        Args: { p_id: string; p_motivo?: string }
        Returns: undefined
      }
      mover_sessao: {
        Args: { p_id: string; p_inicio: string; p_fim: string; p_seguintes?: boolean }
        Returns: number
      }
      sessao_combina_com_paciente: {
        Args: { p_appointment: string; p_patient: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
