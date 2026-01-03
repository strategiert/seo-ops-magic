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
      articles: {
        Row: {
          brief_id: string | null
          content_html: string | null
          content_markdown: string | null
          created_at: string
          faq_json: Json | null
          id: string
          meta_description: string | null
          meta_title: string | null
          outline_json: Json | null
          primary_keyword: string | null
          project_id: string
          status: string | null
          title: string
          updated_at: string
          version: number | null
        }
        Insert: {
          brief_id?: string | null
          content_html?: string | null
          content_markdown?: string | null
          created_at?: string
          faq_json?: Json | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          outline_json?: Json | null
          primary_keyword?: string | null
          project_id: string
          status?: string | null
          title: string
          updated_at?: string
          version?: number | null
        }
        Update: {
          brief_id?: string | null
          content_html?: string | null
          content_markdown?: string | null
          created_at?: string
          faq_json?: Json | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          outline_json?: Json | null
          primary_keyword?: string | null
          project_id?: string
          status?: string | null
          title?: string
          updated_at?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "content_briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      changelog: {
        Row: {
          created_at: string | null
          entries: Json
          id: string
          release_date: string
          title: string
          version: string
        }
        Insert: {
          created_at?: string | null
          entries?: Json
          id?: string
          release_date?: string
          title: string
          version: string
        }
        Update: {
          created_at?: string | null
          entries?: Json
          id?: string
          release_date?: string
          title?: string
          version?: string
        }
        Relationships: []
      }
      content_briefs: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          nw_guidelines: Json | null
          nw_query_id: string | null
          primary_keyword: string
          priority_score: number | null
          project_id: string
          search_intent: string | null
          status: string | null
          target_audience: string | null
          target_length: number | null
          title: string
          tonality: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          nw_guidelines?: Json | null
          nw_query_id?: string | null
          primary_keyword: string
          priority_score?: number | null
          project_id: string
          search_intent?: string | null
          status?: string | null
          target_audience?: string | null
          target_length?: number | null
          title: string
          tonality?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          nw_guidelines?: Json | null
          nw_query_id?: string | null
          primary_keyword?: string
          priority_score?: number | null
          project_id?: string
          search_intent?: string | null
          status?: string | null
          target_audience?: string | null
          target_length?: number | null
          title?: string
          tonality?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_briefs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      elementor_templates: {
        Row: {
          article_id: string | null
          created_at: string
          design_preset: string | null
          id: string
          name: string
          project_id: string
          template_json: Json
          updated_at: string
        }
        Insert: {
          article_id?: string | null
          created_at?: string
          design_preset?: string | null
          id?: string
          name: string
          project_id: string
          template_json: Json
          updated_at?: string
        }
        Update: {
          article_id?: string | null
          created_at?: string
          design_preset?: string | null
          id?: string
          name?: string
          project_id?: string
          template_json?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "elementor_templates_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "elementor_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      html_exports: {
        Row: {
          article_id: string | null
          created_at: string
          design_variant: string | null
          html_content: string
          id: string
          name: string
          project_id: string
          updated_at: string
        }
        Insert: {
          article_id?: string | null
          created_at?: string
          design_variant?: string | null
          html_content: string
          id?: string
          name: string
          project_id: string
          updated_at?: string
        }
        Update: {
          article_id?: string | null
          created_at?: string
          design_variant?: string | null
          html_content?: string
          id?: string
          name?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "html_exports_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "html_exports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          created_at: string
          credentials_encrypted: string | null
          id: string
          is_connected: boolean | null
          last_sync_at: string | null
          nw_engine: string | null
          nw_language: string | null
          nw_project_id: string | null
          nw_project_name: string | null
          project_id: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credentials_encrypted?: string | null
          id?: string
          is_connected?: boolean | null
          last_sync_at?: string | null
          nw_engine?: string | null
          nw_language?: string | null
          nw_project_id?: string | null
          nw_project_name?: string | null
          project_id: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credentials_encrypted?: string | null
          id?: string
          is_connected?: boolean | null
          last_sync_at?: string | null
          nw_engine?: string | null
          nw_language?: string | null
          nw_project_id?: string | null
          nw_project_name?: string | null
          project_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          default_country: string | null
          default_design_preset: string | null
          default_language: string | null
          default_target_audience: string | null
          default_tonality: string | null
          domain: string | null
          id: string
          name: string
          updated_at: string
          workspace_id: string
          wp_url: string | null
        }
        Insert: {
          created_at?: string
          default_country?: string | null
          default_design_preset?: string | null
          default_language?: string | null
          default_target_audience?: string | null
          default_tonality?: string | null
          domain?: string | null
          id?: string
          name: string
          updated_at?: string
          workspace_id: string
          wp_url?: string | null
        }
        Update: {
          created_at?: string
          default_country?: string | null
          default_design_preset?: string | null
          default_language?: string | null
          default_target_audience?: string | null
          default_tonality?: string | null
          domain?: string | null
          id?: string
          name?: string
          updated_at?: string
          workspace_id?: string
          wp_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
