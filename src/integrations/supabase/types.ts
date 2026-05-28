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
    PostgrestVersion: "14.5"
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
      agent_products: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          image_urls: Json
          name: string
          price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          image_urls?: Json
          name: string
          price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          image_urls?: Json
          name?: string
          price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_tools_config: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          id: string
          tool_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          tool_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          tool_name?: string
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
          click_count: number
          clicked_at: string | null
          contact_name: string | null
          created_at: string
          delivered_at: string | null
          error_message: string | null
          id: string
          instance_name: string | null
          message_content: string
          message_id: string | null
          phone: string
          read_at: string | null
          sent_at: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          campaign_id: string
          click_count?: number
          clicked_at?: string | null
          contact_name?: string | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          instance_name?: string | null
          message_content: string
          message_id?: string | null
          phone: string
          read_at?: string | null
          sent_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          campaign_id?: string
          click_count?: number
          clicked_at?: string | null
          contact_name?: string | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          instance_name?: string | null
          message_content?: string
          message_id?: string | null
          phone?: string
          read_at?: string | null
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
      departments: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      device_push_tokens: {
        Row: {
          created_at: string | null
          id: string
          platform: string
          token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          platform?: string
          token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          platform?: string
          token?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      flow_automations: {
        Row: {
          active: boolean
          category: string
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
          category?: string
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
          category?: string
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
      flow_captured_data: {
        Row: {
          captured_data: Json | null
          created_at: string
          email: string | null
          flow_id: string | null
          flow_name: string | null
          id: string
          last_node_id: string | null
          nome: string | null
          phone: string
          source: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          captured_data?: Json | null
          created_at?: string
          email?: string | null
          flow_id?: string | null
          flow_name?: string | null
          id?: string
          last_node_id?: string | null
          nome?: string | null
          phone: string
          source?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          captured_data?: Json | null
          created_at?: string
          email?: string | null
          flow_id?: string | null
          flow_name?: string | null
          id?: string
          last_node_id?: string | null
          nome?: string | null
          phone?: string
          source?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      flow_lead_positions: {
        Row: {
          block_id: string
          contact_name: string | null
          entered_at: string
          flow_id: string
          id: string
          phone: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          block_id: string
          contact_name?: string | null
          entered_at?: string
          flow_id: string
          id?: string
          phone: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          block_id?: string
          contact_name?: string | null
          entered_at?: string
          flow_id?: string
          id?: string
          phone?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gateway_affiliates: {
        Row: {
          affiliate_id: string | null
          created_at: string | null
          id: string
          product_id: string | null
          status: string | null
        }
        Insert: {
          affiliate_id?: string | null
          created_at?: string | null
          id?: string
          product_id?: string | null
          status?: string | null
        }
        Update: {
          affiliate_id?: string | null
          created_at?: string | null
          id?: string
          product_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gateway_affiliates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gateway_products"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_api_keys: {
        Row: {
          created_at: string
          id: string
          public_key: string
          secret_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          public_key: string
          secret_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          public_key?: string
          secret_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gateway_checkouts: {
        Row: {
          config: Json
          conversions: number
          created_at: string
          id: string
          name: string
          product_id: string | null
          slug: string | null
          status: boolean
          updated_at: string
          user_id: string
          visits: number
        }
        Insert: {
          config?: Json
          conversions?: number
          created_at?: string
          id?: string
          name: string
          product_id?: string | null
          slug?: string | null
          status?: boolean
          updated_at?: string
          user_id: string
          visits?: number
        }
        Update: {
          config?: Json
          conversions?: number
          created_at?: string
          id?: string
          name?: string
          product_id?: string | null
          slug?: string | null
          status?: boolean
          updated_at?: string
          user_id?: string
          visits?: number
        }
        Relationships: [
          {
            foreignKeyName: "gateway_checkouts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gateway_products"
            referencedColumns: ["id"]
          },
        ]
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
      gateway_kyc: {
        Row: {
          business_data: Json | null
          created_at: string
          doc_back_url: string | null
          doc_front_url: string | null
          id: string
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_url: string | null
          status: string
          submitted_at: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          business_data?: Json | null
          created_at?: string
          doc_back_url?: string | null
          doc_front_url?: string | null
          id?: string
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          business_data?: Json | null
          created_at?: string
          doc_back_url?: string | null
          doc_front_url?: string | null
          id?: string
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      gateway_landing_pages: {
        Row: {
          created_at: string
          description: string | null
          entry_file: string | null
          files: Json
          id: string
          name: string
          slug: string | null
          status: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          entry_file?: string | null
          files?: Json
          id?: string
          name: string
          slug?: string | null
          status?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          entry_file?: string | null
          files?: Json
          id?: string
          name?: string
          slug?: string | null
          status?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gateway_pixels: {
        Row: {
          active: boolean
          api_token: string
          created_at: string
          events: Json
          extra_config: Json
          id: string
          pixel_id: string
          platform: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          api_token?: string
          created_at?: string
          events?: Json
          extra_config?: Json
          id?: string
          pixel_id?: string
          platform: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          api_token?: string
          created_at?: string
          events?: Json
          extra_config?: Json
          id?: string
          pixel_id?: string
          platform?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gateway_plans: {
        Row: {
          billing_cycle: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          price: number
          product_id: string
          status: boolean | null
        }
        Insert: {
          billing_cycle?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          price?: number
          product_id: string
          status?: boolean | null
        }
        Update: {
          billing_cycle?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          price?: number
          product_id?: string
          status?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "gateway_plans_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gateway_products"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_platform_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      gateway_products: {
        Row: {
          access_buyer_data: boolean | null
          affiliate_description: string | null
          affiliate_enabled: boolean | null
          auto_approve_affiliates: boolean | null
          category: string | null
          commission_rate: number | null
          commission_type: string | null
          commission_value: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          price: number
          sku: string | null
          status: boolean
          thank_you_page_url: string | null
          type: string
          updated_at: string
          user_id: string
          visible_in_store: boolean | null
        }
        Insert: {
          access_buyer_data?: boolean | null
          affiliate_description?: string | null
          affiliate_enabled?: boolean | null
          auto_approve_affiliates?: boolean | null
          category?: string | null
          commission_rate?: number | null
          commission_type?: string | null
          commission_value?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price?: number
          sku?: string | null
          status?: boolean
          thank_you_page_url?: string | null
          type?: string
          updated_at?: string
          user_id: string
          visible_in_store?: boolean | null
        }
        Update: {
          access_buyer_data?: boolean | null
          affiliate_description?: string | null
          affiliate_enabled?: boolean | null
          auto_approve_affiliates?: boolean | null
          category?: string | null
          commission_rate?: number | null
          commission_type?: string | null
          commission_value?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          sku?: string | null
          status?: boolean
          thank_you_page_url?: string | null
          type?: string
          updated_at?: string
          user_id?: string
          visible_in_store?: boolean | null
        }
        Relationships: []
      }
      gateway_transactions: {
        Row: {
          amount: number
          checkout_id: string | null
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          external_id: string | null
          fee: number
          id: string
          metadata: Json | null
          net: number
          payment_method: string
          product_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          checkout_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          external_id?: string | null
          fee?: number
          id?: string
          metadata?: Json | null
          net?: number
          payment_method?: string
          product_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          checkout_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          external_id?: string | null
          fee?: number
          id?: string
          metadata?: Json | null
          net?: number
          payment_method?: string
          product_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_transactions_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "gateway_checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gateway_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gateway_products"
            referencedColumns: ["id"]
          },
        ]
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
      gateway_withdrawals: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          id: string
          pix_key: string
          pix_key_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          id?: string
          pix_key?: string
          pix_key_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          id?: string
          pix_key?: string
          pix_key_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
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
          instance_id: string | null
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
          instance_id?: string | null
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
          instance_id?: string | null
          message?: string
          response_type?: string
          template_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hidden_dispatch_instances: {
        Row: {
          api_provider: string
          created_at: string
          created_by: string | null
          evolution_api_key: string | null
          evolution_api_url: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          zapi_client_token: string
          zapi_instance_id: string
          zapi_token: string
        }
        Insert: {
          api_provider?: string
          created_at?: string
          created_by?: string | null
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          zapi_client_token?: string
          zapi_instance_id?: string
          zapi_token?: string
        }
        Update: {
          api_provider?: string
          created_at?: string
          created_by?: string | null
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          zapi_client_token?: string
          zapi_instance_id?: string
          zapi_token?: string
        }
        Relationships: []
      }
      instagram_automations: {
        Row: {
          active: boolean
          created_at: string
          dm_message: string | null
          id: string
          keyword: string
          name: string
          reply_comment: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          dm_message?: string | null
          id?: string
          keyword?: string
          name?: string
          reply_comment?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          dm_message?: string | null
          id?: string
          keyword?: string
          name?: string
          reply_comment?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      instagram_contacts: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          ig_user_id: string
          profile_pic_url: string | null
          source: string | null
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          ig_user_id?: string
          profile_pic_url?: string | null
          source?: string | null
          updated_at?: string
          user_id: string
          username?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          ig_user_id?: string
          profile_pic_url?: string | null
          source?: string | null
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      instagram_events: {
        Row: {
          comment_text: string | null
          created_at: string
          event_type: string
          id: string
          ig_user_id: string | null
          media_id: string | null
          payload: Json | null
          processed: boolean
          user_id: string
          username: string | null
        }
        Insert: {
          comment_text?: string | null
          created_at?: string
          event_type?: string
          id?: string
          ig_user_id?: string | null
          media_id?: string | null
          payload?: Json | null
          processed?: boolean
          user_id: string
          username?: string | null
        }
        Update: {
          comment_text?: string | null
          created_at?: string
          event_type?: string
          id?: string
          ig_user_id?: string | null
          media_id?: string | null
          payload?: Json | null
          processed?: boolean
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      link_clicks: {
        Row: {
          btn_text: string | null
          campaign_id: string | null
          city: string | null
          country: string | null
          created_at: string
          destination_url: string | null
          flow_name: string | null
          id: string
          ip: string | null
          phone: string | null
          referer: string | null
          region: string | null
          send_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          btn_text?: string | null
          campaign_id?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          destination_url?: string | null
          flow_name?: string | null
          id?: string
          ip?: string | null
          phone?: string | null
          referer?: string | null
          region?: string | null
          send_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          btn_text?: string | null
          campaign_id?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          destination_url?: string | null
          flow_name?: string | null
          id?: string
          ip?: string | null
          phone?: string | null
          referer?: string | null
          region?: string | null
          send_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      message_logs: {
        Row: {
          created_at: string
          id: string
          instance_id: string | null
          keyword_matched: string | null
          message_id: string | null
          message_received: string | null
          phone: string
          response_sent: string | null
          sender_name: string | null
          sender_phone: string | null
          sender_photo: string | null
          timestamp: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          instance_id?: string | null
          keyword_matched?: string | null
          message_id?: string | null
          message_received?: string | null
          phone: string
          response_sent?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          sender_photo?: string | null
          timestamp?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          instance_id?: string | null
          keyword_matched?: string | null
          message_id?: string | null
          message_received?: string | null
          phone?: string
          response_sent?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          sender_photo?: string | null
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
      meta_credentials: {
        Row: {
          access_token: string | null
          app_id: string | null
          business_account_id: string | null
          connected: boolean | null
          created_at: string | null
          fb_user_id: string | null
          fb_user_name: string | null
          id: string
          phone_number_id: string | null
          updated_at: string | null
          user_id: string
          waba_id: string | null
        }
        Insert: {
          access_token?: string | null
          app_id?: string | null
          business_account_id?: string | null
          connected?: boolean | null
          created_at?: string | null
          fb_user_id?: string | null
          fb_user_name?: string | null
          id?: string
          phone_number_id?: string | null
          updated_at?: string | null
          user_id: string
          waba_id?: string | null
        }
        Update: {
          access_token?: string | null
          app_id?: string | null
          business_account_id?: string | null
          connected?: boolean | null
          created_at?: string | null
          fb_user_id?: string | null
          fb_user_name?: string | null
          id?: string
          phone_number_id?: string | null
          updated_at?: string | null
          user_id?: string
          waba_id?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          checkout_id: string | null
          created_at: string
          enabled: boolean
          id: string
          notify_apple_pay: boolean
          notify_boleto_paid: boolean
          notify_credit_card: boolean
          notify_pix_or_boleto_issued: boolean
          notify_pix_paid: boolean
          notify_pix_recurring: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          checkout_id?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          notify_apple_pay?: boolean
          notify_boleto_paid?: boolean
          notify_credit_card?: boolean
          notify_pix_or_boleto_issued?: boolean
          notify_pix_paid?: boolean
          notify_pix_recurring?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          checkout_id?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          notify_apple_pay?: boolean
          notify_boleto_paid?: boolean
          notify_credit_card?: boolean
          notify_pix_or_boleto_issued?: boolean
          notify_pix_paid?: boolean
          notify_pix_recurring?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pipeline_members: {
        Row: {
          created_at: string
          pipeline_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          pipeline_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          pipeline_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_members_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stage_history: {
        Row: {
          contact_phone: string
          from_stage: string | null
          id: string
          moved_at: string
          pipeline_id: string | null
          to_stage: string
          user_id: string
        }
        Insert: {
          contact_phone: string
          from_stage?: string | null
          id?: string
          moved_at?: string
          pipeline_id?: string | null
          to_stage: string
          user_id: string
        }
        Update: {
          contact_phone?: string
          from_stage?: string | null
          id?: string
          moved_at?: string
          pipeline_id?: string | null
          to_stage?: string
          user_id?: string
        }
        Relationships: []
      }
      pipelines: {
        Row: {
          created_at: string
          currency: string
          department: string | null
          id: string
          name: string
          owner_id: string
          stages: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          department?: string | null
          id?: string
          name: string
          owner_id: string
          stages?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          department?: string | null
          id?: string
          name?: string
          owner_id?: string
          stages?: Json
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          custom_domain: string | null
          custom_plan_value: number | null
          document: string | null
          document_type: string | null
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          max_instances: number
          pipeline_stages: Json | null
          pix_acquirer: string | null
          plan_id: string | null
          subscription_expires_at: string | null
          subscription_status: string | null
          uazapi_token: string | null
          uazapi_url: string | null
          updated_at: string
          whatsapp: string | null
          zapi_client_token: string | null
          zapi_instance_id: string | null
          zapi_token: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          custom_domain?: string | null
          custom_plan_value?: number | null
          document?: string | null
          document_type?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          max_instances?: number
          pipeline_stages?: Json | null
          pix_acquirer?: string | null
          plan_id?: string | null
          subscription_expires_at?: string | null
          subscription_status?: string | null
          uazapi_token?: string | null
          uazapi_url?: string | null
          updated_at?: string
          whatsapp?: string | null
          zapi_client_token?: string | null
          zapi_instance_id?: string | null
          zapi_token?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          custom_domain?: string | null
          custom_plan_value?: number | null
          document?: string | null
          document_type?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          max_instances?: number
          pipeline_stages?: Json | null
          pix_acquirer?: string | null
          plan_id?: string | null
          subscription_expires_at?: string | null
          subscription_status?: string | null
          uazapi_token?: string | null
          uazapi_url?: string | null
          updated_at?: string
          whatsapp?: string | null
          zapi_client_token?: string | null
          zapi_instance_id?: string | null
          zapi_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
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
          group_message_enabled: boolean
          group_message_flow_id: string | null
          group_message_instance_id: string | null
          group_message_template_id: string | null
          group_message_text: string
          group_message_type: string
          id: string
          max_members_per_group: number
          name: string
          notify_admin: boolean
          notify_phone: string
          recurrence_pattern: string | null
          schedule_flow_id: string | null
          schedule_instance_id: string | null
          schedule_message_text: string
          schedule_message_type: string
          schedule_template_id: string | null
          schedule_time: string | null
          schedule_type: string
          scheduled_at: string | null
          slug: string
          updated_at: string
          user_id: string
          welcome_flow_id: string | null
          welcome_instance_id: string | null
          welcome_message: string
          welcome_template_id: string | null
          welcome_type: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          group_message_enabled?: boolean
          group_message_flow_id?: string | null
          group_message_instance_id?: string | null
          group_message_template_id?: string | null
          group_message_text?: string
          group_message_type?: string
          id?: string
          max_members_per_group?: number
          name: string
          notify_admin?: boolean
          notify_phone?: string
          recurrence_pattern?: string | null
          schedule_flow_id?: string | null
          schedule_instance_id?: string | null
          schedule_message_text?: string
          schedule_message_type?: string
          schedule_template_id?: string | null
          schedule_time?: string | null
          schedule_type?: string
          scheduled_at?: string | null
          slug: string
          updated_at?: string
          user_id: string
          welcome_flow_id?: string | null
          welcome_instance_id?: string | null
          welcome_message?: string
          welcome_template_id?: string | null
          welcome_type?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          group_message_enabled?: boolean
          group_message_flow_id?: string | null
          group_message_instance_id?: string | null
          group_message_template_id?: string | null
          group_message_text?: string
          group_message_type?: string
          id?: string
          max_members_per_group?: number
          name?: string
          notify_admin?: boolean
          notify_phone?: string
          recurrence_pattern?: string | null
          schedule_flow_id?: string | null
          schedule_instance_id?: string | null
          schedule_message_text?: string
          schedule_message_type?: string
          schedule_template_id?: string | null
          schedule_time?: string | null
          schedule_type?: string
          scheduled_at?: string | null
          slug?: string
          updated_at?: string
          user_id?: string
          welcome_flow_id?: string | null
          welcome_instance_id?: string | null
          welcome_message?: string
          welcome_template_id?: string | null
          welcome_type?: string
        }
        Relationships: []
      }
      report_push_logs: {
        Row: {
          created_at: string
          id: string
          messages_sent: number | null
          sales_amount: number | null
          sales_count: number | null
          slot_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages_sent?: number | null
          sales_amount?: number | null
          sales_count?: number | null
          slot_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages_sent?: number | null
          sales_amount?: number | null
          sales_count?: number | null
          slot_key?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_contacts: {
        Row: {
          agent_stage: string | null
          closing_date: string | null
          community_id: string | null
          created_at: string | null
          deal_metadata: Json | null
          deal_value: number | null
          description: string | null
          id: string
          is_community: boolean | null
          name: string
          phone: string
          pipeline_id: string | null
          priority: string | null
          profile_picture_url: string | null
          responsible_ids: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          agent_stage?: string | null
          closing_date?: string | null
          community_id?: string | null
          created_at?: string | null
          deal_metadata?: Json | null
          deal_value?: number | null
          description?: string | null
          id?: string
          is_community?: boolean | null
          name?: string
          phone: string
          pipeline_id?: string | null
          priority?: string | null
          profile_picture_url?: string | null
          responsible_ids?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          agent_stage?: string | null
          closing_date?: string | null
          community_id?: string | null
          created_at?: string | null
          deal_metadata?: Json | null
          deal_value?: number | null
          description?: string | null
          id?: string
          is_community?: boolean | null
          name?: string
          phone?: string
          pipeline_id?: string | null
          priority?: string | null
          profile_picture_url?: string | null
          responsible_ids?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      skill_contents: {
        Row: {
          attachments: Json
          connected_to_agent: boolean
          content: string
          created_at: string
          folder_id: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attachments?: Json
          connected_to_agent?: boolean
          content?: string
          created_at?: string
          folder_id: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attachments?: Json
          connected_to_agent?: boolean
          content?: string
          created_at?: string
          folder_id?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_contents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "skill_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_folders: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      telegram_bot_commands: {
        Row: {
          bot_id: string
          command: string
          created_at: string
          description: string
          id: string
          sort_order: number
          user_id: string
        }
        Insert: {
          bot_id: string
          command: string
          created_at?: string
          description?: string
          id?: string
          sort_order?: number
          user_id: string
        }
        Update: {
          bot_id?: string
          command?: string
          created_at?: string
          description?: string
          id?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_bot_commands_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "telegram_bots"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_bot_state: {
        Row: {
          bot_id: string
          last_polled_at: string | null
          update_offset: number
          updated_at: string
        }
        Insert: {
          bot_id: string
          last_polled_at?: string | null
          update_offset?: number
          updated_at?: string
        }
        Update: {
          bot_id?: string
          last_polled_at?: string | null
          update_offset?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_bot_state_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: true
            referencedRelation: "telegram_bots"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_bots: {
        Row: {
          active: boolean
          bot_id: number | null
          bot_token: string
          created_at: string
          description: string | null
          first_name: string | null
          id: string
          last_validated_at: string | null
          photo_url: string | null
          short_description: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          active?: boolean
          bot_id?: number | null
          bot_token: string
          created_at?: string
          description?: string | null
          first_name?: string | null
          id?: string
          last_validated_at?: string | null
          photo_url?: string | null
          short_description?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          active?: boolean
          bot_id?: number | null
          bot_token?: string
          created_at?: string
          description?: string | null
          first_name?: string | null
          id?: string
          last_validated_at?: string | null
          photo_url?: string | null
          short_description?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      telegram_messages: {
        Row: {
          bot_id: string
          chat_id: number
          created_at: string
          from_first_name: string | null
          from_user_id: number | null
          from_username: string | null
          id: string
          message_type: string
          raw_update: Json
          text: string | null
          update_id: number
          user_id: string
        }
        Insert: {
          bot_id: string
          chat_id: number
          created_at?: string
          from_first_name?: string | null
          from_user_id?: number | null
          from_username?: string | null
          id?: string
          message_type?: string
          raw_update: Json
          text?: string | null
          update_id: number
          user_id: string
        }
        Update: {
          bot_id?: string
          chat_id?: number
          created_at?: string
          from_first_name?: string | null
          from_user_id?: number | null
          from_username?: string | null
          id?: string
          message_type?: string
          raw_update?: Json
          text?: string | null
          update_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_messages_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "telegram_bots"
            referencedColumns: ["id"]
          },
        ]
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
      warmup_donor_numbers: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          notes: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          notes?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          notes?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      warmup_group_chat_logs: {
        Row: {
          created_at: string
          cycle_id: string
          error_message: string | null
          group_jid: string | null
          http_status: number | null
          id: string
          link_id: string | null
          message_preview: string | null
          sender_instance_id: string | null
          sender_name: string | null
          sender_provider: string | null
          status: string
        }
        Insert: {
          created_at?: string
          cycle_id: string
          error_message?: string | null
          group_jid?: string | null
          http_status?: number | null
          id?: string
          link_id?: string | null
          message_preview?: string | null
          sender_instance_id?: string | null
          sender_name?: string | null
          sender_provider?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          cycle_id?: string
          error_message?: string | null
          group_jid?: string | null
          http_status?: number | null
          id?: string
          link_id?: string | null
          message_preview?: string | null
          sender_instance_id?: string | null
          sender_name?: string | null
          sender_provider?: string | null
          status?: string
        }
        Relationships: []
      }
      warmup_group_joins: {
        Row: {
          created_at: string
          id: string
          instance_id: string
          joined_at_count: number
          link_id: string
          response: Json | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          instance_id: string
          joined_at_count?: number
          link_id: string
          response?: Json | null
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          instance_id?: string
          joined_at_count?: number
          link_id?: string
          response?: Json | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warmup_group_joins_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "warmup_group_links"
            referencedColumns: ["id"]
          },
        ]
      }
      warmup_group_links: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          group_jid: string | null
          id: string
          invite_url: string
          label: string | null
          threshold: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          group_jid?: string | null
          id?: string
          invite_url: string
          label?: string | null
          threshold?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          group_jid?: string | null
          id?: string
          invite_url?: string
          label?: string | null
          threshold?: number
          updated_at?: string
        }
        Relationships: []
      }
      warmup_instance_health: {
        Row: {
          block_type: string
          blocked_until: string | null
          created_at: string
          detail: string | null
          id: string
          instance_ref: string
          last_detected_at: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          block_type?: string
          blocked_until?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          instance_ref: string
          last_detected_at?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          block_type?: string
          blocked_until?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          instance_ref?: string
          last_detected_at?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      warmup_messages: {
        Row: {
          active: boolean
          content: string
          created_at: string
          created_by: string | null
          id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      web_push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string
          p256dh?: string
          user_agent?: string | null
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
          api_provider: string
          created_at: string
          evolution_api_key: string | null
          evolution_api_url: string | null
          id: string
          instance_name: string
          instance_type: string
          is_active: boolean
          is_default: boolean
          updated_at: string
          user_id: string
          zapi_client_token: string | null
          zapi_instance_id: string | null
          zapi_token: string | null
        }
        Insert: {
          api_provider?: string
          created_at?: string
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          id?: string
          instance_name?: string
          instance_type?: string
          is_active?: boolean
          is_default?: boolean
          updated_at?: string
          user_id: string
          zapi_client_token?: string | null
          zapi_instance_id?: string | null
          zapi_token?: string | null
        }
        Update: {
          api_provider?: string
          created_at?: string
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          id?: string
          instance_name?: string
          instance_type?: string
          is_active?: boolean
          is_default?: boolean
          updated_at?: string
          user_id?: string
          zapi_client_token?: string | null
          zapi_instance_id?: string | null
          zapi_token?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      find_profile_id_by_email: { Args: { _email: string }; Returns: string }
      get_pipeline_member_profiles: {
        Args: { _pipeline_id: string }
        Returns: {
          email: string
          full_name: string
          id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_pipeline_member: {
        Args: { _pipeline_id: string; _user_id: string }
        Returns: boolean
      }
      is_pipeline_owner: {
        Args: { _pipeline_id: string; _user_id: string }
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
