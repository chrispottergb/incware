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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accountant_firms: {
        Row: {
          address: string | null
          city: string | null
          company_id: string
          created_at: string
          email: string | null
          firm_name: string
          id: string
          phone: string | null
          state: string | null
          updated_at: string
          website: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_id: string
          created_at?: string
          email?: string | null
          firm_name: string
          id?: string
          phone?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_id?: string
          created_at?: string
          email?: string | null
          firm_name?: string
          id?: string
          phone?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accountant_firms_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      accountants: {
        Row: {
          accountant_name: string
          company_id: string
          cpa_number: string | null
          created_at: string
          email: string | null
          firm_id: string | null
          id: string
          notes: string | null
          phone: string | null
          specialty: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          accountant_name: string
          company_id: string
          cpa_number?: string | null
          created_at?: string
          email?: string | null
          firm_id?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          specialty?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          accountant_name?: string
          company_id?: string
          cpa_number?: string | null
          created_at?: string
          email?: string | null
          firm_id?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          specialty?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accountants_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accountants_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "accountant_firms"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_oversight_persons: {
        Row: {
          ai_system_id: string
          assigned_date: string | null
          authority_scope: string | null
          competence_description: string | null
          created_at: string
          id: string
          person_name: string
          status: string
          title: string | null
        }
        Insert: {
          ai_system_id: string
          assigned_date?: string | null
          authority_scope?: string | null
          competence_description?: string | null
          created_at?: string
          id?: string
          person_name: string
          status?: string
          title?: string | null
        }
        Update: {
          ai_system_id?: string
          assigned_date?: string | null
          authority_scope?: string | null
          competence_description?: string | null
          created_at?: string
          id?: string
          person_name?: string
          status?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_oversight_persons_ai_system_id_fkey"
            columns: ["ai_system_id"]
            isOneToOne: false
            referencedRelation: "ai_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_risk_incidents: {
        Row: {
          actions_taken: string | null
          ai_system_id: string
          authority_notified: boolean | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          incident_date: string
          provider_notified: boolean | null
          reported_by: string | null
          resolution_date: string | null
          severity: string
          status: string
        }
        Insert: {
          actions_taken?: string | null
          ai_system_id: string
          authority_notified?: boolean | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          incident_date?: string
          provider_notified?: boolean | null
          reported_by?: string | null
          resolution_date?: string | null
          severity?: string
          status?: string
        }
        Update: {
          actions_taken?: string | null
          ai_system_id?: string
          authority_notified?: boolean | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          incident_date?: string
          provider_notified?: boolean | null
          reported_by?: string | null
          resolution_date?: string | null
          severity?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_risk_incidents_ai_system_id_fkey"
            columns: ["ai_system_id"]
            isOneToOne: false
            referencedRelation: "ai_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_risk_incidents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_systems: {
        Row: {
          company_id: string
          created_at: string
          data_categories: string | null
          deployment_date: string | null
          id: string
          instructions_for_use: string | null
          provider: string | null
          purpose: string | null
          risk_level: string
          status: string
          system_name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          data_categories?: string | null
          deployment_date?: string | null
          id?: string
          instructions_for_use?: string | null
          provider?: string | null
          purpose?: string | null
          risk_level?: string
          status?: string
          system_name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          data_categories?: string | null
          deployment_date?: string | null
          id?: string
          instructions_for_use?: string | null
          provider?: string | null
          purpose?: string | null
          risk_level?: string
          status?: string
          system_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_systems_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_logs: {
        Row: {
          affected_persons_notified: boolean | null
          ai_system_id: string
          company_id: string
          created_at: string
          description: string | null
          human_reviewer: string | null
          id: string
          input_summary: string | null
          output_summary: string | null
          review_decision: string | null
          review_notes: string | null
          usage_date: string
          usage_type: string
        }
        Insert: {
          affected_persons_notified?: boolean | null
          ai_system_id: string
          company_id: string
          created_at?: string
          description?: string | null
          human_reviewer?: string | null
          id?: string
          input_summary?: string | null
          output_summary?: string | null
          review_decision?: string | null
          review_notes?: string | null
          usage_date?: string
          usage_type?: string
        }
        Update: {
          affected_persons_notified?: boolean | null
          ai_system_id?: string
          company_id?: string
          created_at?: string
          description?: string | null
          human_reviewer?: string | null
          id?: string
          input_summary?: string | null
          output_summary?: string | null
          review_decision?: string | null
          review_notes?: string | null
          usage_date?: string
          usage_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_ai_system_id_fkey"
            columns: ["ai_system_id"]
            isOneToOne: false
            referencedRelation: "ai_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      attorney_firms: {
        Row: {
          address: string | null
          city: string | null
          company_id: string
          created_at: string
          email: string | null
          firm_name: string
          id: string
          phone: string | null
          state: string | null
          updated_at: string
          website: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_id: string
          created_at?: string
          email?: string | null
          firm_name: string
          id?: string
          phone?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_id?: string
          created_at?: string
          email?: string | null
          firm_name?: string
          id?: string
          phone?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attorney_firms_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      attorneys: {
        Row: {
          attorney_name: string
          bar_number: string | null
          company_id: string
          created_at: string
          email: string | null
          firm_id: string | null
          id: string
          notes: string | null
          phone: string | null
          specialty: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          attorney_name: string
          bar_number?: string | null
          company_id: string
          created_at?: string
          email?: string | null
          firm_id?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          specialty?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          attorney_name?: string
          bar_number?: string | null
          company_id?: string
          created_at?: string
          email?: string | null
          firm_id?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          specialty?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attorneys_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attorneys_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "attorney_firms"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_authorized_signers: {
        Row: {
          bank_id: string
          company_id: string
          created_at: string
          effective_date: string | null
          end_date: string | null
          id: string
          signer_name: string
          title: string | null
        }
        Insert: {
          bank_id: string
          company_id: string
          created_at?: string
          effective_date?: string | null
          end_date?: string | null
          id?: string
          signer_name: string
          title?: string | null
        }
        Update: {
          bank_id?: string
          company_id?: string
          created_at?: string
          effective_date?: string | null
          end_date?: string | null
          id?: string
          signer_name?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_authorized_signers_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "company_banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_authorized_signers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bills_of_sale: {
        Row: {
          buyer_name: string
          certificate_id: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          num_shares: number
          price_per_share: number | null
          sale_date: string
          seller_name: string
          share_class: string
          shareholder_id: string | null
          total_price: number | null
        }
        Insert: {
          buyer_name: string
          certificate_id?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          num_shares?: number
          price_per_share?: number | null
          sale_date?: string
          seller_name: string
          share_class?: string
          shareholder_id?: string | null
          total_price?: number | null
        }
        Update: {
          buyer_name?: string
          certificate_id?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          num_shares?: number
          price_per_share?: number | null
          sale_date?: string
          seller_name?: string
          share_class?: string
          shareholder_id?: string | null
          total_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bills_of_sale_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "stock_certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_of_sale_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_of_sale_shareholder_id_fkey"
            columns: ["shareholder_id"]
            isOneToOne: false
            referencedRelation: "shareholders"
            referencedColumns: ["id"]
          },
        ]
      }
      business_sales: {
        Row: {
          buyer_name: string
          company_id: string
          consideration_type: string
          created_at: string
          financing_terms: string | null
          id: string
          notes: string | null
          property_description: string | null
          sale_date: string
          sale_type: string
          seller_name: string
          status: string
          statute_reference: string | null
          total_price: number | null
          updated_at: string
        }
        Insert: {
          buyer_name: string
          company_id: string
          consideration_type?: string
          created_at?: string
          financing_terms?: string | null
          id?: string
          notes?: string | null
          property_description?: string | null
          sale_date?: string
          sale_type: string
          seller_name: string
          status?: string
          statute_reference?: string | null
          total_price?: number | null
          updated_at?: string
        }
        Update: {
          buyer_name?: string
          company_id?: string
          consideration_type?: string
          created_at?: string
          financing_terms?: string | null
          id?: string
          notes?: string | null
          property_description?: string | null
          sale_date?: string
          sale_type?: string
          seller_name?: string
          status?: string
          statute_reference?: string | null
          total_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_sales_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          accounting_method: string | null
          additional_provisions: string | null
          address: string | null
          annual_report_year: number | null
          authorized_shares: number | null
          business_purpose: string | null
          city: string | null
          corporate_status: string | null
          created_at: string
          delayed_effective_filing_date: string | null
          election_1244: boolean | null
          entity_type: string
          filing_date: string | null
          first_year_annual_meeting: number | null
          fiscal_year_end: string | null
          id: string
          incorporation_date: string | null
          initial_directors_count: number | null
          max_directors_allowed: number | null
          max_vps_allowed: number | null
          name: string
          par_value: number | null
          par_value_type: string | null
          phone: string | null
          registered_agent_address: string | null
          registered_agent_city: string | null
          registered_agent_name: string | null
          registered_agent_state: string | null
          registered_agent_zip: string | null
          s_election_date: string | null
          scheduled_annual_meeting: string | null
          seal_type: string | null
          second_name_choice: string | null
          sic_code: string | null
          state: string | null
          state_of_incorporation: string | null
          status: string | null
          updated_at: string
          user_id: string
          verification_date: string | null
          zip: string | null
        }
        Insert: {
          accounting_method?: string | null
          additional_provisions?: string | null
          address?: string | null
          annual_report_year?: number | null
          authorized_shares?: number | null
          business_purpose?: string | null
          city?: string | null
          corporate_status?: string | null
          created_at?: string
          delayed_effective_filing_date?: string | null
          election_1244?: boolean | null
          entity_type?: string
          filing_date?: string | null
          first_year_annual_meeting?: number | null
          fiscal_year_end?: string | null
          id?: string
          incorporation_date?: string | null
          initial_directors_count?: number | null
          max_directors_allowed?: number | null
          max_vps_allowed?: number | null
          name: string
          par_value?: number | null
          par_value_type?: string | null
          phone?: string | null
          registered_agent_address?: string | null
          registered_agent_city?: string | null
          registered_agent_name?: string | null
          registered_agent_state?: string | null
          registered_agent_zip?: string | null
          s_election_date?: string | null
          scheduled_annual_meeting?: string | null
          seal_type?: string | null
          second_name_choice?: string | null
          sic_code?: string | null
          state?: string | null
          state_of_incorporation?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
          verification_date?: string | null
          zip?: string | null
        }
        Update: {
          accounting_method?: string | null
          additional_provisions?: string | null
          address?: string | null
          annual_report_year?: number | null
          authorized_shares?: number | null
          business_purpose?: string | null
          city?: string | null
          corporate_status?: string | null
          created_at?: string
          delayed_effective_filing_date?: string | null
          election_1244?: boolean | null
          entity_type?: string
          filing_date?: string | null
          first_year_annual_meeting?: number | null
          fiscal_year_end?: string | null
          id?: string
          incorporation_date?: string | null
          initial_directors_count?: number | null
          max_directors_allowed?: number | null
          max_vps_allowed?: number | null
          name?: string
          par_value?: number | null
          par_value_type?: string | null
          phone?: string | null
          registered_agent_address?: string | null
          registered_agent_city?: string | null
          registered_agent_name?: string | null
          registered_agent_state?: string | null
          registered_agent_zip?: string | null
          s_election_date?: string | null
          scheduled_annual_meeting?: string | null
          seal_type?: string | null
          second_name_choice?: string | null
          sic_code?: string | null
          state?: string | null
          state_of_incorporation?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
          verification_date?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      company_assets: {
        Row: {
          address: string | null
          asset_type: string
          company_id: string
          cost: number | null
          created_at: string
          description: string
          escrow: number | null
          finance_company: string | null
          id: string
          make: string | null
          manufacturer: string | null
          model: string | null
          mortgage: number | null
          ownership_type: string | null
          running_hours: number | null
          taxes: number | null
          updated_at: string
          value: number | null
          year: string | null
        }
        Insert: {
          address?: string | null
          asset_type: string
          company_id: string
          cost?: number | null
          created_at?: string
          description: string
          escrow?: number | null
          finance_company?: string | null
          id?: string
          make?: string | null
          manufacturer?: string | null
          model?: string | null
          mortgage?: number | null
          ownership_type?: string | null
          running_hours?: number | null
          taxes?: number | null
          updated_at?: string
          value?: number | null
          year?: string | null
        }
        Update: {
          address?: string | null
          asset_type?: string
          company_id?: string
          cost?: number | null
          created_at?: string
          description?: string
          escrow?: number | null
          finance_company?: string | null
          id?: string
          make?: string | null
          manufacturer?: string | null
          model?: string | null
          mortgage?: number | null
          ownership_type?: string | null
          running_hours?: number | null
          taxes?: number | null
          updated_at?: string
          value?: number | null
          year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_assets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_banks: {
        Row: {
          account_number: string | null
          account_type: string | null
          address: string | null
          bank_name: string
          city: string | null
          company_id: string
          contact_name: string | null
          contact_title: string | null
          created_at: string
          id: string
          notes: string | null
          phone: string | null
          routing_number: string | null
          state: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          account_number?: string | null
          account_type?: string | null
          address?: string | null
          bank_name: string
          city?: string | null
          company_id: string
          contact_name?: string | null
          contact_title?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          phone?: string | null
          routing_number?: string | null
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          account_number?: string | null
          account_type?: string | null
          address?: string | null
          bank_name?: string
          city?: string | null
          company_id?: string
          contact_name?: string | null
          contact_title?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          phone?: string | null
          routing_number?: string | null
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_banks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_relationships: {
        Row: {
          child_company_id: string
          created_at: string
          effective_date: string | null
          id: string
          notes: string | null
          ownership_percentage: number | null
          parent_company_id: string
          relationship_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          child_company_id: string
          created_at?: string
          effective_date?: string | null
          id?: string
          notes?: string | null
          ownership_percentage?: number | null
          parent_company_id: string
          relationship_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          child_company_id?: string
          created_at?: string
          effective_date?: string | null
          id?: string
          notes?: string | null
          ownership_percentage?: number | null
          parent_company_id?: string
          relationship_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_relationships_child_company_id_fkey"
            columns: ["child_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_relationships_parent_company_id_fkey"
            columns: ["parent_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      directors: {
        Row: {
          added_date: string | null
          address: string | null
          city: string | null
          company_id: string
          created_at: string
          id: string
          name: string
          state: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          added_date?: string | null
          address?: string | null
          city?: string | null
          company_id: string
          created_at?: string
          id?: string
          name: string
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          added_date?: string | null
          address?: string | null
          city?: string | null
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "directors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      document_registry: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          document_category: string
          document_type: string
          file_name: string | null
          file_url: string | null
          id: string
          meeting_id: string | null
          status: string
          statute_reference: string | null
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          document_category: string
          document_type: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          meeting_id?: string | null
          status?: string
          statute_reference?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          document_category?: string
          document_type?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          meeting_id?: string | null
          status?: string
          statute_reference?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_registry_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_registry_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_amendments: {
        Row: {
          amendment_text: string
          amendment_type: string
          created_at: string
          id: string
          meeting_id: string
        }
        Insert: {
          amendment_text: string
          amendment_type?: string
          created_at?: string
          id?: string
          meeting_id: string
        }
        Update: {
          amendment_text?: string
          amendment_type?: string
          created_at?: string
          id?: string
          meeting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_amendments_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_assets: {
        Row: {
          asset_type: string
          created_at: string
          description: string
          id: string
          meeting_id: string
          value: number | null
        }
        Insert: {
          asset_type: string
          created_at?: string
          description: string
          id?: string
          meeting_id: string
          value?: number | null
        }
        Update: {
          asset_type?: string
          created_at?: string
          description?: string
          id?: string
          meeting_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_assets_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_authorized_signers: {
        Row: {
          bank_name: string | null
          created_at: string
          id: string
          meeting_id: string
          signer_id: string | null
          signer_name: string
          title: string | null
        }
        Insert: {
          bank_name?: string | null
          created_at?: string
          id?: string
          meeting_id: string
          signer_id?: string | null
          signer_name: string
          title?: string | null
        }
        Update: {
          bank_name?: string | null
          created_at?: string
          id?: string
          meeting_id?: string
          signer_id?: string | null
          signer_name?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_authorized_signers_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_authorized_signers_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "bank_authorized_signers"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_benefits: {
        Row: {
          agent_administrator: string | null
          benefit_description: string
          benefit_type: string | null
          created_at: string
          eligibility_comments: string | null
          id: string
          insurance_agency: string | null
          meeting_id: string
          new_plan_effective_date: string | null
          plan_year: number | null
          provider: string | null
          retirement_contribution: number | null
          transaction_type: string | null
        }
        Insert: {
          agent_administrator?: string | null
          benefit_description: string
          benefit_type?: string | null
          created_at?: string
          eligibility_comments?: string | null
          id?: string
          insurance_agency?: string | null
          meeting_id: string
          new_plan_effective_date?: string | null
          plan_year?: number | null
          provider?: string | null
          retirement_contribution?: number | null
          transaction_type?: string | null
        }
        Update: {
          agent_administrator?: string | null
          benefit_description?: string
          benefit_type?: string | null
          created_at?: string
          eligibility_comments?: string | null
          id?: string
          insurance_agency?: string | null
          meeting_id?: string
          new_plan_effective_date?: string | null
          plan_year?: number | null
          provider?: string | null
          retirement_contribution?: number | null
          transaction_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_benefits_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_counsel: {
        Row: {
          bank_name: string | null
          counsel_name: string | null
          created_at: string
          id: string
          loans: string | null
          meeting_id: string
        }
        Insert: {
          bank_name?: string | null
          counsel_name?: string | null
          created_at?: string
          id?: string
          loans?: string | null
          meeting_id: string
        }
        Update: {
          bank_name?: string | null
          counsel_name?: string | null
          created_at?: string
          id?: string
          loans?: string | null
          meeting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_counsel_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_directors: {
        Row: {
          created_at: string
          director_name: string
          id: string
          meeting_id: string
        }
        Insert: {
          created_at?: string
          director_name: string
          id?: string
          meeting_id: string
        }
        Update: {
          created_at?: string
          director_name?: string
          id?: string
          meeting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_directors_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_financials: {
        Row: {
          created_at: string
          current_cog: number | null
          current_cog_ratio: number | null
          current_gross_profit: number | null
          current_net_income: number | null
          current_total_sales: number | null
          id: string
          meeting_id: string
          previous_cog: number | null
          previous_cog_ratio: number | null
          previous_gross_profit: number | null
          previous_net_income: number | null
          previous_total_sales: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_cog?: number | null
          current_cog_ratio?: number | null
          current_gross_profit?: number | null
          current_net_income?: number | null
          current_total_sales?: number | null
          id?: string
          meeting_id: string
          previous_cog?: number | null
          previous_cog_ratio?: number | null
          previous_gross_profit?: number | null
          previous_net_income?: number | null
          previous_total_sales?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_cog?: number | null
          current_cog_ratio?: number | null
          current_gross_profit?: number | null
          current_net_income?: number | null
          current_total_sales?: number | null
          id?: string
          meeting_id?: string
          previous_cog?: number | null
          previous_cog_ratio?: number | null
          previous_gross_profit?: number | null
          previous_net_income?: number | null
          previous_total_sales?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_financials_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: true
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_officers: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          name: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          name: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          name?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_officers_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_other: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          notes: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          notes: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          notes?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_other_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_resolutions: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          purpose: string
          resolution_text: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          purpose: string
          resolution_text: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          purpose?: string
          resolution_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_resolutions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_shareholders: {
        Row: {
          common_shares: number | null
          created_at: string
          distribution: string | null
          id: string
          meeting_id: string
          preferred_shares: number | null
          shareholder_name: string
        }
        Insert: {
          common_shares?: number | null
          created_at?: string
          distribution?: string | null
          id?: string
          meeting_id: string
          preferred_shares?: number | null
          shareholder_name: string
        }
        Update: {
          common_shares?: number | null
          created_at?: string
          distribution?: string | null
          id?: string
          meeting_id?: string
          preferred_shares?: number | null
          shareholder_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_shareholders_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          chairperson: string | null
          company_address_at_meeting: string | null
          company_city_at_meeting: string | null
          company_id: string
          company_name_at_meeting: string | null
          company_state_at_meeting: string | null
          company_zip_at_meeting: string | null
          created_at: string
          document_status: string | null
          id: string
          meeting_date: string
          meeting_location: string | null
          meeting_time: string | null
          meeting_type: string
          mtg_secretary: string | null
          next_annual_mtg: string | null
          others_present: string | null
          prior_mtg_date: string | null
          sub_type: string | null
          tax_year: number | null
          updated_at: string
        }
        Insert: {
          chairperson?: string | null
          company_address_at_meeting?: string | null
          company_city_at_meeting?: string | null
          company_id: string
          company_name_at_meeting?: string | null
          company_state_at_meeting?: string | null
          company_zip_at_meeting?: string | null
          created_at?: string
          document_status?: string | null
          id?: string
          meeting_date: string
          meeting_location?: string | null
          meeting_time?: string | null
          meeting_type?: string
          mtg_secretary?: string | null
          next_annual_mtg?: string | null
          others_present?: string | null
          prior_mtg_date?: string | null
          sub_type?: string | null
          tax_year?: number | null
          updated_at?: string
        }
        Update: {
          chairperson?: string | null
          company_address_at_meeting?: string | null
          company_city_at_meeting?: string | null
          company_id?: string
          company_name_at_meeting?: string | null
          company_state_at_meeting?: string | null
          company_zip_at_meeting?: string | null
          created_at?: string
          document_status?: string | null
          id?: string
          meeting_date?: string
          meeting_location?: string | null
          meeting_time?: string | null
          meeting_type?: string
          mtg_secretary?: string | null
          next_annual_mtg?: string | null
          others_present?: string | null
          prior_mtg_date?: string | null
          sub_type?: string | null
          tax_year?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      officers: {
        Row: {
          company_id: string
          created_at: string
          id: string
          president: string | null
          secretary: string | null
          treasurer: string | null
          updated_at: string
          vice_president: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          president?: string | null
          secretary?: string | null
          treasurer?: string | null
          updated_at?: string
          vice_president?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          president?: string | null
          secretary?: string | null
          treasurer?: string | null
          updated_at?: string
          vice_president?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "officers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      share_transactions: {
        Row: {
          certificate_id: string | null
          company_id: string
          consideration_type: string | null
          created_at: string
          from_shareholder: string | null
          id: string
          notes: string | null
          num_shares: number
          price_per_share: number | null
          share_class: string
          shareholder_id: string | null
          to_shareholder: string | null
          total_consideration: number | null
          transaction_date: string
          transaction_type: string
        }
        Insert: {
          certificate_id?: string | null
          company_id: string
          consideration_type?: string | null
          created_at?: string
          from_shareholder?: string | null
          id?: string
          notes?: string | null
          num_shares?: number
          price_per_share?: number | null
          share_class?: string
          shareholder_id?: string | null
          to_shareholder?: string | null
          total_consideration?: number | null
          transaction_date?: string
          transaction_type?: string
        }
        Update: {
          certificate_id?: string | null
          company_id?: string
          consideration_type?: string | null
          created_at?: string
          from_shareholder?: string | null
          id?: string
          notes?: string | null
          num_shares?: number
          price_per_share?: number | null
          share_class?: string
          shareholder_id?: string | null
          to_shareholder?: string | null
          total_consideration?: number | null
          transaction_date?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_transactions_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "stock_certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_transactions_shareholder_id_fkey"
            columns: ["shareholder_id"]
            isOneToOne: false
            referencedRelation: "shareholders"
            referencedColumns: ["id"]
          },
        ]
      }
      shareholders: {
        Row: {
          address: string | null
          city: string | null
          company_id: string
          created_at: string
          date_added: string | null
          id: string
          name: string
          ssn_ein: string | null
          state: string | null
          status: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_id: string
          created_at?: string
          date_added?: string | null
          id?: string
          name: string
          ssn_ein?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_id?: string
          created_at?: string
          date_added?: string | null
          id?: string
          name?: string
          ssn_ein?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shareholders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_certificates: {
        Row: {
          cancelled_date: string | null
          cancelled_reason: string | null
          certificate_number: number
          company_id: string
          created_at: string
          id: string
          issue_date: string | null
          num_shares: number
          par_value: number | null
          share_class: string
          shareholder_id: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          cancelled_date?: string | null
          cancelled_reason?: string | null
          certificate_number: number
          company_id: string
          created_at?: string
          id?: string
          issue_date?: string | null
          num_shares?: number
          par_value?: number | null
          share_class?: string
          shareholder_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          cancelled_date?: string | null
          cancelled_reason?: string | null
          certificate_number?: number
          company_id?: string
          created_at?: string
          id?: string
          issue_date?: string | null
          num_shares?: number
          par_value?: number | null
          share_class?: string
          shareholder_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_certificates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_certificates_shareholder_id_fkey"
            columns: ["shareholder_id"]
            isOneToOne: false
            referencedRelation: "shareholders"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_events: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          event_date: string
          event_type: string
          id: string
          title: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          event_date: string
          event_type?: string
          id?: string
          title: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          event_date?: string
          event_type?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff"],
    },
  },
} as const
