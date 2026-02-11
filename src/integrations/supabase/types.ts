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
          asset_type: string
          company_id: string
          created_at: string
          description: string
          id: string
          updated_at: string
          value: number | null
        }
        Insert: {
          asset_type: string
          company_id: string
          created_at?: string
          description: string
          id?: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          asset_type?: string
          company_id?: string
          created_at?: string
          description?: string
          id?: string
          updated_at?: string
          value?: number | null
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
      meeting_amendments: {
        Row: {
          amendment_text: string
          created_at: string
          id: string
          meeting_id: string
        }
        Insert: {
          amendment_text: string
          created_at?: string
          id?: string
          meeting_id: string
        }
        Update: {
          amendment_text?: string
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
      meeting_benefits: {
        Row: {
          benefit_description: string
          created_at: string
          id: string
          meeting_id: string
        }
        Insert: {
          benefit_description: string
          created_at?: string
          id?: string
          meeting_id: string
        }
        Update: {
          benefit_description?: string
          created_at?: string
          id?: string
          meeting_id?: string
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
