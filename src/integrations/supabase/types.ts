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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agent_config: {
        Row: {
          active: boolean
          agent_name: string
          created_at: string
          id: string
          system_prompt: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          agent_name?: string
          created_at?: string
          id?: string
          system_prompt?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          agent_name?: string
          created_at?: string
          id?: string
          system_prompt?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_knowledge: {
        Row: {
          active: boolean
          answer: string | null
          content: string | null
          created_at: string
          id: string
          question: string | null
          title: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          answer?: string | null
          content?: string | null
          created_at?: string
          id?: string
          question?: string | null
          title?: string | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          answer?: string | null
          content?: string | null
          created_at?: string
          id?: string
          question?: string | null
          title?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      auto_response_config: {
        Row: {
          active: boolean
          created_at: string
          id: string
          updated_at: string
          user_id: string | null
          webhook_url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string | null
          webhook_url?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string | null
          webhook_url?: string
        }
        Relationships: []
      }
      auto_responses: {
        Row: {
          active: boolean
          created_at: string
          id: string
          keyword: string
          response: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          keyword: string
          response: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          keyword?: string
          response?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      campaign_sends: {
        Row: {
          campaign_id: string
          contact_name: string | null
          created_at: string
          delivered_at: string | null
          error_message: string | null
          id: string
          instance_name: string | null
          message_content: string
          phone: string
          sent_at: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          campaign_id: string
          contact_name?: string | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          instance_name?: string | null
          message_content: string
          phone: string
          sent_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          campaign_id?: string
          contact_name?: string | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          instance_name?: string | null
          message_content?: string
          phone?: string
          sent_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          delay_seconds: number | null
          description: string | null
          id: string
          name: string
          recurrence_pattern: string | null
          schedule_type: string | null
          scheduled_at: string | null
          status: string | null
          target_audience: Json | null
          template_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          delay_seconds?: number | null
          description?: string | null
          id?: string
          name: string
          recurrence_pattern?: string | null
          schedule_type?: string | null
          scheduled_at?: string | null
          status?: string | null
          target_audience?: Json | null
          template_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          delay_seconds?: number | null
          description?: string | null
          id?: string
          name?: string
          recurrence_pattern?: string | null
          schedule_type?: string | null
          scheduled_at?: string | null
          status?: string | null
          target_audience?: Json | null
          template_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_automations: {
        Row: {
          active: boolean
          created_at: string
          edges: Json
          id: string
          keyword: string
          name: string
          nodes: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          edges?: Json
          id?: string
          keyword?: string
          name: string
          nodes?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          edges?: Json
          id?: string
          keyword?: string
          name?: string
          nodes?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gateway_funnels: {
        Row: {
          active: boolean
          button_label: string | null
          button_url: string | null
          created_at: string
          delay_seconds: number
          event_label: string
          event_type: string
          id: string
          instance_ids: Json | null
          message_template: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          button_label?: string | null
          button_url?: string | null
          created_at?: string
          delay_seconds?: number
          event_label: string
          event_type: string
          id?: string
          instance_ids?: Json | null
          message_template: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          button_label?: string | null
          button_url?: string | null
          created_at?: string
          delay_seconds?: number
          event_label?: string
          event_type?: string
          id?: string
          instance_ids?: Json | null
          message_template?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gateway_integrations: {
        Row: {
          active: boolean
          auth_token: string | null
          auth_type: string | null
          created_at: string
          headers: Json | null
          id: string
          last_test_status: string | null
          last_tested_at: string | null
          method: string
          name: string
          updated_at: string
          user_id: string
          webhook_url: string
        }
        Insert: {
          active?: boolean
          auth_token?: string | null
          auth_type?: string | null
          created_at?: string
          headers?: Json | null
          id?: string
          last_test_status?: string | null
          last_tested_at?: string | null
          method?: string
          name: string
          updated_at?: string
          user_id: string
          webhook_url: string
        }
        Update: {
          active?: boolean
          auth_token?: string | null
          auth_type?: string | null
          created_at?: string
          headers?: Json | null
          id?: string
          last_test_status?: string | null
          last_tested_at?: string | null
          method?: string
          name?: string
          updated_at?: string
          user_id?: string
          webhook_url?: string
        }
        Relationships: []
      }
      gateway_webhook_logs: {
        Row: {
          created_at: string
          event_type: string | null
          id: string
          message_sent: string | null
          payload: Json | null
          phone: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type?: string | null
          id?: string
          message_sent?: string | null
          payload?: Json | null
          phone?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string | null
          id?: string
          message_sent?: string | null
          payload?: Json | null
          phone?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      group_welcome_config: {
        Row: {
          active: boolean
          created_at: string
          flow_id: string | null
          group_id: string
          group_name: string
          id: string
          message: string
          response_type: string
          template_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          flow_id?: string | null
          group_id: string
          group_name?: string
          id?: string
          message?: string
          response_type?: string
          template_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          flow_id?: string | null
          group_id?: string
          group_name?: string
          id?: string
          message?: string
          response_type?: string
          template_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      message_logs: {
        Row: {
          created_at: string
          id: string
          instance_id: string | null
          keyword_matched: string | null
          message_received: string | null
          phone: string
          response_sent: string | null
          timestamp: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          instance_id?: string | null
          keyword_matched?: string | null
          message_received?: string | null
          phone: string
          response_sent?: string | null
          timestamp?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          instance_id?: string | null
          keyword_matched?: string | null
          message_received?: string | null
          phone?: string
          response_sent?: string | null
          timestamp?: string
          user_id?: string | null
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          active: boolean | null
          buttons: Json | null
          carousel_cards: Json | null
          category: string
          content: string
          created_at: string
          file_name: string | null
          file_type: string | null
          footer: string | null
          header: string | null
          id: string
          list_items: Json | null
          media_url: string | null
          name: string
          type: string | null
          updated_at: string
          usage_count: number | null
          user_id: string | null
          variables: Json | null
        }
        Insert: {
          active?: boolean | null
          buttons?: Json | null
          carousel_cards?: Json | null
          category: string
          content: string
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          footer?: string | null
          header?: string | null
          id?: string
          list_items?: Json | null
          media_url?: string | null
          name: string
          type?: string | null
          updated_at?: string
          usage_count?: number | null
          user_id?: string | null
          variables?: Json | null
        }
        Update: {
          active?: boolean | null
          buttons?: Json | null
          carousel_cards?: Json | null
          category?: string
          content?: string
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          footer?: string | null
          header?: string | null
          id?: string
          list_items?: Json | null
          media_url?: string | null
          name?: string
          type?: string | null
          updated_at?: string
          usage_count?: number | null
          user_id?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          subscription_expires_at: string | null
          subscription_status: string | null
          updated_at: string
          whatsapp: string | null
          zapi_client_token: string | null
          zapi_instance_id: string | null
          zapi_token: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          subscription_expires_at?: string | null
          subscription_status?: string | null
          updated_at?: string
          whatsapp?: string | null
          zapi_client_token?: string | null
          zapi_instance_id?: string | null
          zapi_token?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          subscription_expires_at?: string | null
          subscription_status?: string | null
          updated_at?: string
          whatsapp?: string | null
          zapi_client_token?: string | null
          zapi_instance_id?: string | null
          zapi_token?: string | null
        }
        Relationships: []
      }
      redirect_link_clicks: {
        Row: {
          created_at: string
          group_redirected_to: string | null
          id: string
          ip_address: string | null
          redirect_link_id: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          group_redirected_to?: string | null
          id?: string
          ip_address?: string | null
          redirect_link_id: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          group_redirected_to?: string | null
          id?: string
          ip_address?: string | null
          redirect_link_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "redirect_link_clicks_redirect_link_id_fkey"
            columns: ["redirect_link_id"]
            isOneToOne: false
            referencedRelation: "redirect_links"
            referencedColumns: ["id"]
          },
        ]
      }
      redirect_link_groups: {
        Row: {
          created_at: string
          current_members: number
          group_id: string
          group_name: string
          group_photo: string | null
          id: string
          instance_id: string | null
          invite_link: string | null
          is_full: boolean
          redirect_link_id: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_members?: number
          group_id: string
          group_name?: string
          group_photo?: string | null
          id?: string
          instance_id?: string | null
          invite_link?: string | null
          is_full?: boolean
          redirect_link_id: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_members?: number
          group_id?: string
          group_name?: string
          group_photo?: string | null
          id?: string
          instance_id?: string | null
          invite_link?: string | null
          is_full?: boolean
          redirect_link_id?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "redirect_link_groups_redirect_link_id_fkey"
            columns: ["redirect_link_id"]
            isOneToOne: false
            referencedRelation: "redirect_links"
            referencedColumns: ["id"]
          },
        ]
      }
      redirect_links: {
        Row: {
          active: boolean
          created_at: string
          id: string
          max_members_per_group: number
          name: string
          slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          max_members_per_group?: number
          name: string
          slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          max_members_per_group?: number
          name?: string
          slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_contacts: {
        Row: {
          created_at: string | null
          id: string
          name: string
          phone: string
          profile_picture_url: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name?: string
          phone: string
          profile_picture_url?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          phone?: string
          profile_picture_url?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      welcome_message_config: {
        Row: {
          active: boolean
          created_at: string
          id: string
          message: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          message?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          message?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      welcome_message_sent: {
        Row: {
          id: string
          phone: string
          sent_at: string
          user_id: string | null
        }
        Insert: {
          id?: string
          phone: string
          sent_at?: string
          user_id?: string | null
        }
        Update: {
          id?: string
          phone?: string
          sent_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      zapi_instances: {
        Row: {
          created_at: string
          id: string
          instance_name: string
          is_active: boolean
          is_default: boolean
          updated_at: string
          user_id: string
          zapi_client_token: string
          zapi_instance_id: string
          zapi_token: string
        }
        Insert: {
          created_at?: string
          id?: string
          instance_name?: string
          is_active?: boolean
          is_default?: boolean
          updated_at?: string
          user_id: string
          zapi_client_token: string
          zapi_instance_id: string
          zapi_token: string
        }
        Update: {
          created_at?: string
          id?: string
          instance_name?: string
          is_active?: boolean
          is_default?: boolean
          updated_at?: string
          user_id?: string
          zapi_client_token?: string
          zapi_instance_id?: string
          zapi_token?: string
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
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
