// Tipos do banco no formato do `supabase gen types typescript`.
// Regenere com o Supabase local rodando: npm run db:types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      accountant_access_log: {
        Row: {
          accessed_at: string
          accountant_id: string
          id: number
          link_id: string
          period: string
          psychologist_id: string
          scope: string
        }
        Insert: {
          accessed_at?: string
          accountant_id: string
          id?: never
          link_id: string
          period: string
          psychologist_id: string
          scope: string
        }
        Update: {
          accessed_at?: string
          accountant_id?: string
          id?: never
          link_id?: string
          period?: string
          psychologist_id?: string
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "accountant_access_log_accountant_id_fkey"
            columns: ["accountant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accountant_access_log_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "accountant_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accountant_access_log_psychologist_id_fkey"
            columns: ["psychologist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      accountant_documents: {
        Row: {
          accountant_id: string
          amount: number | null
          competence: string
          created_at: string
          due_on: string | null
          file_path: string
          id: string
          kind: string
          link_id: string
          paid_on: string | null
          psychologist_id: string
          title: string
        }
        Insert: {
          accountant_id: string
          amount?: number | null
          competence: string
          created_at?: string
          due_on?: string | null
          file_path: string
          id?: string
          kind: string
          link_id: string
          paid_on?: string | null
          psychologist_id: string
          title: string
        }
        Update: {
          accountant_id?: string
          amount?: number | null
          competence?: string
          created_at?: string
          due_on?: string | null
          file_path?: string
          id?: string
          kind?: string
          link_id?: string
          paid_on?: string | null
          psychologist_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "accountant_documents_accountant_id_fkey"
            columns: ["accountant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accountant_documents_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "accountant_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accountant_documents_psychologist_id_fkey"
            columns: ["psychologist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      accountant_links: {
        Row: {
          accountant_id: string
          created_at: string
          ended_at: string | null
          ended_by: string | null
          id: string
          psychologist_id: string
          share_entries: boolean
          share_expenses: boolean
          share_totals: boolean
          status: string
          updated_at: string
        }
        Insert: {
          accountant_id: string
          created_at?: string
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          psychologist_id: string
          share_entries?: boolean
          share_expenses?: boolean
          share_totals?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          accountant_id?: string
          created_at?: string
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          psychologist_id?: string
          share_entries?: boolean
          share_expenses?: boolean
          share_totals?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accountant_links_accountant_id_fkey"
            columns: ["accountant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accountant_links_ended_by_fkey"
            columns: ["ended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accountant_links_psychologist_id_fkey"
            columns: ["psychologist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      accountant_profiles: {
        Row: {
          accepting_new: boolean
          bio: string | null
          city: string | null
          crc_category: string | null
          crc_number: string | null
          crc_state: string | null
          created_at: string
          firm_name: string | null
          id: string
          listed: boolean
          price_info: string | null
          serves_nationwide: boolean
          specialties: string[]
          state: string | null
          updated_at: string
        }
        Insert: {
          accepting_new?: boolean
          bio?: string | null
          city?: string | null
          crc_category?: string | null
          crc_number?: string | null
          crc_state?: string | null
          created_at?: string
          firm_name?: string | null
          id: string
          listed?: boolean
          price_info?: string | null
          serves_nationwide?: boolean
          specialties?: string[]
          state?: string | null
          updated_at?: string
        }
        Update: {
          accepting_new?: boolean
          bio?: string | null
          city?: string | null
          crc_category?: string | null
          crc_number?: string | null
          crc_state?: string | null
          created_at?: string
          firm_name?: string | null
          id?: string
          listed?: boolean
          price_info?: string | null
          serves_nationwide?: boolean
          specialties?: string[]
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accountant_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      accountant_requests: {
        Row: {
          accountant_id: string
          created_at: string
          id: string
          message: string | null
          psychologist_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          accountant_id: string
          created_at?: string
          id?: string
          message?: string | null
          psychologist_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          accountant_id?: string
          created_at?: string
          id?: string
          message?: string | null
          psychologist_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "accountant_requests_accountant_id_fkey"
            columns: ["accountant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accountant_requests_psychologist_id_fkey"
            columns: ["psychologist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      accountant_tasks: {
        Row: {
          accountant_id: string
          body: string
          created_at: string
          id: string
          link_id: string
          psychologist_id: string
          resolved_at: string | null
        }
        Insert: {
          accountant_id: string
          body: string
          created_at?: string
          id?: string
          link_id: string
          psychologist_id: string
          resolved_at?: string | null
        }
        Update: {
          accountant_id?: string
          body?: string
          created_at?: string
          id?: string
          link_id?: string
          psychologist_id?: string
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accountant_tasks_accountant_id_fkey"
            columns: ["accountant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accountant_tasks_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "accountant_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accountant_tasks_psychologist_id_fkey"
            columns: ["psychologist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          created_at: string
          ends_at: string
          fee: number | null
          id: string
          location: string | null
          modality: string
          owner_id: string
          paid_on: string | null
          patient_id: string
          payment_method: string | null
          payment_status: string
          series_id: string | null
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          fee?: number | null
          id?: string
          location?: string | null
          modality?: string
          owner_id?: string
          paid_on?: string | null
          patient_id: string
          payment_method?: string | null
          payment_status?: string
          series_id?: string | null
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          fee?: number | null
          id?: string
          location?: string | null
          modality?: string
          owner_id?: string
          paid_on?: string | null
          patient_id?: string
          payment_method?: string | null
          payment_status?: string
          series_id?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
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
            foreignKeyName: "clinical_record_versions_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "clinical_records"
            referencedColumns: ["id"]
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
            foreignKeyName: "clinical_records_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          id: string
          owner_id: string
          spent_on: string
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description?: string | null
          id?: string
          owner_id?: string
          spent_on: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          owner_id?: string
          spent_on?: string
          updated_at?: string
        }
        Relationships: []
      }
      fiscal_profiles: {
        Row: {
          monthly_payroll: number | null
          owner_id: string
          regime: string
          updated_at: string
        }
        Insert: {
          monthly_payroll?: number | null
          owner_id?: string
          regime?: string
          updated_at?: string
        }
        Update: {
          monthly_payroll?: number | null
          owner_id?: string
          regime?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_profiles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
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
            foreignKeyName: "patient_contacts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          archived_at: string | null
          birth_date: string | null
          cpf: string | null
          created_at: string
          default_fee: number | null
          email: string | null
          full_name: string
          id: string
          nicknames: string[]
          owner_id: string
          payer_cpf: string | null
          payer_name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          default_fee?: number | null
          email?: string | null
          full_name: string
          id?: string
          nicknames?: string[]
          owner_id?: string
          payer_cpf?: string | null
          payer_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          default_fee?: number | null
          email?: string | null
          full_name?: string
          id?: string
          nicknames?: string[]
          owner_id?: string
          payer_cpf?: string | null
          payer_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type: string
          created_at: string
          crp_number: string | null
          crp_region: string | null
          full_name: string
          id: string
          plan: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          account_type?: string
          created_at?: string
          crp_number?: string | null
          crp_region?: string | null
          full_name: string
          id: string
          plan?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: string
          created_at?: string
          crp_number?: string | null
          crp_region?: string | null
          full_name?: string
          id?: string
          plan?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number
          created_at: string
          cycle: string
          discount_until: string | null
          id: string
          new_graduate_discount: boolean
          next_payment_at: string | null
          plan: string
          provider: string
          provider_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          cycle: string
          discount_until?: string | null
          id?: string
          new_graduate_discount?: boolean
          next_payment_at?: string | null
          plan: string
          provider?: string
          provider_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          cycle?: string
          discount_until?: string | null
          id?: string
          new_graduate_discount?: boolean
          next_payment_at?: string | null
          plan?: string
          provider?: string
          provider_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supervision_case_excerpts: {
        Row: {
          anonymized_body: string
          case_id: string
          created_at: string
          id: string
          period_label: string | null
          position: number
        }
        Insert: {
          anonymized_body: string
          case_id: string
          created_at?: string
          id?: string
          period_label?: string | null
          position?: number
        }
        Update: {
          anonymized_body?: string
          case_id?: string
          created_at?: string
          id?: string
          period_label?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "supervision_case_excerpts_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "supervision_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      supervision_case_sources: {
        Row: {
          case_id: string
          created_at: string
          patient_id: string
          record_ids: string[]
        }
        Insert: {
          case_id: string
          created_at?: string
          patient_id: string
          record_ids?: string[]
        }
        Update: {
          case_id?: string
          created_at?: string
          patient_id?: string
          record_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "supervision_case_sources_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "supervision_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervision_case_sources_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      supervision_cases: {
        Row: {
          case_label: string
          created_at: string
          id: string
          link_id: string
          meeting_id: string | null
          question: string | null
          sent_at: string | null
          status: string
          supervisee_id: string
        }
        Insert: {
          case_label: string
          created_at?: string
          id?: string
          link_id: string
          meeting_id?: string | null
          question?: string | null
          sent_at?: string | null
          status?: string
          supervisee_id?: string
        }
        Update: {
          case_label?: string
          created_at?: string
          id?: string
          link_id?: string
          meeting_id?: string | null
          question?: string | null
          sent_at?: string | null
          status?: string
          supervisee_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supervision_cases_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "supervision_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervision_cases_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "supervision_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervision_cases_supervisee_id_fkey"
            columns: ["supervisee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supervision_feedback: {
        Row: {
          author_id: string
          case_id: string
          created_at: string
          id: string
          observed: string | null
          paths: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          author_id?: string
          case_id: string
          created_at?: string
          id?: string
          observed?: string | null
          paths?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          author_id?: string
          case_id?: string
          created_at?: string
          id?: string
          observed?: string | null
          paths?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "supervision_feedback_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervision_feedback_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "supervision_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      supervision_feedback_tasks: {
        Row: {
          created_at: string
          done_at: string | null
          feedback_id: string
          id: string
          position: number
          text: string
        }
        Insert: {
          created_at?: string
          done_at?: string | null
          feedback_id: string
          id?: string
          position?: number
          text: string
        }
        Update: {
          created_at?: string
          done_at?: string | null
          feedback_id?: string
          id?: string
          position?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "supervision_feedback_tasks_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "supervision_feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      supervision_groups: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          name: string
          supervisor_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name: string
          supervisor_id?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name?: string
          supervisor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supervision_groups_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supervision_hours: {
        Row: {
          created_at: string
          id: string
          link_id: string
          meeting_id: string | null
          minutes: number
          occurred_on: string
          registered_by: string
          supervisee_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link_id: string
          meeting_id?: string | null
          minutes: number
          occurred_on?: string
          registered_by?: string
          supervisee_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link_id?: string
          meeting_id?: string | null
          minutes?: number
          occurred_on?: string
          registered_by?: string
          supervisee_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supervision_hours_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "supervision_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervision_hours_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "supervision_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervision_hours_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervision_hours_supervisee_id_fkey"
            columns: ["supervisee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "supervision_invites_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervision_invites_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "supervision_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervision_invites_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supervision_links: {
        Row: {
          created_at: string
          ended_at: string | null
          ended_by: string | null
          format: string
          group_id: string | null
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
          group_id?: string | null
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
          group_id?: string | null
          id?: string
          origin?: string
          status?: string
          supervisee_id?: string
          supervisor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supervision_links_ended_by_fkey"
            columns: ["ended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervision_links_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "supervision_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervision_links_supervisee_id_fkey"
            columns: ["supervisee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervision_links_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supervision_meetings: {
        Row: {
          created_at: string
          created_by: string
          duration_min: number
          group_id: string | null
          id: string
          link_id: string | null
          starts_at: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          duration_min?: number
          group_id?: string | null
          id?: string
          link_id?: string | null
          starts_at: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          duration_min?: number
          group_id?: string | null
          id?: string
          link_id?: string | null
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "supervision_meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervision_meetings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "supervision_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervision_meetings_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "supervision_links"
            referencedColumns: ["id"]
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
            foreignKeyName: "supervision_requests_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "supervision_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervision_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervision_requests_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
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
            foreignKeyName: "supervisor_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aceitar_convite: { Args: { p_token: string }; Returns: string }
      cancelar_pedido_contador: { Args: { p_id: string }; Returns: undefined }
      cancelar_solicitacao: { Args: { p_id: string }; Returns: undefined }
      contador_atende: { Args: { p_psicologo: string }; Returns: string }
      contador_atende_pasta: { Args: { p_pasta: string }; Returns: boolean }
      contador_clientes: {
        Args: never
        Returns: {
          crp_number: string
          crp_region: string
          full_name: string
          link_id: string
          monthly_payroll: number
          plano_ok: boolean
          psychologist_id: string
          receita_12_meses: number
          regime: string
          share_entries: boolean
          share_expenses: boolean
          share_totals: boolean
          since: string
        }[]
      }
      contador_despesas: {
        Args: { p_mes: string; p_psicologo: string }
        Returns: {
          categoria: string
          data: string
          descricao: string
          valor: number
        }[]
      }
      contador_lancamentos: {
        Args: { p_mes: string; p_psicologo: string }
        Returns: {
          forma: string
          pagador_cpf: string
          pagador_nome: string
          pago_em: string
          valor: number
        }[]
      }
      contador_pode_ver_perfil: { Args: { p_id: string }; Returns: boolean }
      contador_resumo: {
        Args: { p_ano: number; p_psicologo: string }
        Returns: {
          a_receber: number
          despesas: number
          mes: string
          recebido: number
          sessoes_pagas: number
        }[]
      }
      criar_pendencia: {
        Args: { p_psicologo: string; p_texto: string }
        Returns: string
      }
      definir_grupo: {
        Args: { p_group: string; p_link: string }
        Returns: undefined
      }
      duas_etapas_ok: { Args: never; Returns: boolean }
      e_contador: { Args: never; Returns: boolean }
      e_contador_visivel: { Args: { p_id: string }; Returns: boolean }
      e_membro_do_grupo: { Args: { p_group: string }; Returns: boolean }
      e_ponta_do_vinculo: {
        Args: { p_link: string; p_so_ativo?: boolean }
        Returns: boolean
      }
      e_psicologo: { Args: never; Returns: boolean }
      e_supervisor_do_grupo: { Args: { p_group: string }; Returns: boolean }
      e_supervisor_do_vinculo: { Args: { p_link: string }; Returns: boolean }
      e_supervisor_visivel: { Args: { p_id: string }; Returns: boolean }
      encerrar_vinculo: { Args: { p_id: string }; Returns: undefined }
      encerrar_vinculo_contador: { Args: { p_id: string }; Returns: undefined }
      encontro_do_vinculo: {
        Args: { p_link: string; p_meeting: string }
        Returns: boolean
      }
      enviar_caso: { Args: { p_case: string }; Returns: undefined }
      enviar_devolutiva: {
        Args: { p_feedback: string; p_minutos?: number }
        Returns: undefined
      }
      enviar_guia: {
        Args: {
          p_arquivo: string
          p_competencia: string
          p_psicologo: string
          p_tipo: string
          p_titulo: string
          p_valor: number
          p_vencimento: string
        }
        Returns: string
      }
      excluir_registro_clinico: {
        Args: { p_id: string; p_motivo?: string }
        Returns: undefined
      }
      limite_de_pacientes: { Args: { p_plano: string }; Returns: number }
      marcar_caso_discutido: { Args: { p_case: string }; Returns: undefined }
      marcar_encaminhamento: {
        Args: { p_feito: boolean; p_task: string }
        Returns: undefined
      }
      marcar_guia_paga: {
        Args: { p_id: string; p_paga: boolean }
        Returns: undefined
      }
      meu_plano: {
        Args: never
        Returns: {
          limite_pacientes: number
          pacientes_ativos: number
          plano: string
          trial_ends_at: string
        }[]
      }
      mover_sessao: {
        Args: {
          p_fim: string
          p_id: string
          p_inicio: string
          p_seguintes?: boolean
        }
        Returns: number
      }
      pedir_contador: {
        Args: { p_contador: string; p_mensagem: string }
        Returns: string
      }
      plano_efetivo: { Args: { p_user: string }; Returns: string }
      plano_permite_contador: {
        Args: { p_psicologo: string }
        Returns: boolean
      }
      pode_ver_perfil: { Args: { p_id: string }; Returns: boolean }
      psicologo_pode_ver_contador: { Args: { p_id: string }; Returns: boolean }
      registrar_acesso_contador: {
        Args: {
          p_escopo: string
          p_link: string
          p_periodo: string
          p_psicologo: string
        }
        Returns: undefined
      }
      remover_guia: { Args: { p_id: string }; Returns: string }
      resolver_pendencia: {
        Args: { p_id: string; p_resolvida: boolean }
        Returns: undefined
      }
      responder_pedido_contador: {
        Args: { p_aceitar: boolean; p_id: string }
        Returns: string
      }
      responder_solicitacao: {
        Args: { p_aceitar: boolean; p_id: string }
        Returns: string
      }
      sessao_combina_com_paciente: {
        Args: { p_appointment: string; p_patient: string }
        Returns: boolean
      }
      tem_crp: { Args: { p_id: string }; Returns: boolean }
      tipo_de_conta: { Args: never; Returns: string }
      ver_convite: {
        Args: { p_token: string }
        Returns: {
          inviter_crp_number: string
          inviter_crp_region: string
          inviter_name: string
          inviter_role: string
          valido: boolean
        }[]
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

