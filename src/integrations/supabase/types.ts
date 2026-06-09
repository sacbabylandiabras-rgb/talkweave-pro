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
      affiliate_connections: {
        Row: {
          access_token: string | null
          account_id: string | null
          account_nickname: string | null
          affiliate_source_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          metadata: Json | null
          provider: string
          raw: Json | null
          refresh_token: string | null
          scope: string | null
          token_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          account_id?: string | null
          account_nickname?: string | null
          affiliate_source_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          provider: string
          raw?: Json | null
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          account_id?: string | null
          account_nickname?: string | null
          affiliate_source_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          provider?: string
          raw?: Json | null
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_config: {
        Row: {
          active: boolean
          agent_name: string
          created_at: string
          disable_in_groups: boolean
          elevenlabs_api_key: string | null
          elevenlabs_voice_id: string | null
          elevenlabs_voice_name: string | null
          id: string
          model: string | null
          provider: string | null
          system_prompt: string
          updated_at: string
          user_id: string
          voice: string | null
          voice_provider: string | null
        }
        Insert: {
          active?: boolean
          agent_name?: string
          created_at?: string
          disable_in_groups?: boolean
          elevenlabs_api_key?: string | null
          elevenlabs_voice_id?: string | null
          elevenlabs_voice_name?: string | null
          id?: string
          model?: string | null
          provider?: string | null
          system_prompt?: string
          updated_at?: string
          user_id: string
          voice?: string | null
          voice_provider?: string | null
        }
        Update: {
          active?: boolean
          agent_name?: string
          created_at?: string
          disable_in_groups?: boolean
          elevenlabs_api_key?: string | null
          elevenlabs_voice_id?: string | null
          elevenlabs_voice_name?: string | null
          id?: string
          model?: string | null
          provider?: string | null
          system_prompt?: string
          updated_at?: string
          user_id?: string
          voice?: string | null
          voice_provider?: string | null
        }
        Relationships: []
      }
      agent_deliverables: {
        Row: {
          active: boolean
          caption: string | null
          content_text: string | null
          created_at: string
          description: string | null
          id: string
          media_type: string
          media_url: string | null
          order_index: number
          product_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          caption?: string | null
          content_text?: string | null
          created_at?: string
          description?: string | null
          id?: string
          media_type?: string
          media_url?: string | null
          order_index?: number
          product_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          caption?: string | null
          content_text?: string | null
          created_at?: string
          description?: string | null
          id?: string
          media_type?: string
          media_url?: string | null
          order_index?: number
          product_id?: string | null
          title?: string
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
      agent_social_proof: {
        Row: {
          active: boolean
          caption: string | null
          category: string | null
          created_at: string
          description: string | null
          id: string
          media_type: string
          media_url: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          caption?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          media_type?: string
          media_url: string
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          caption?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          media_type?: string
          media_url?: string
          tags?: string[]
          title?: string
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
        Relationships: []
      }
      campaigns: {
        Row: {
          created_at: string | null
          delay_seconds: number | null
          description: string | null
          id: string
          instance_id: string | null
          message: string
          name: string
          recurrence_pattern: string | null
          schedule_type: string | null
          scheduled_at: string | null
          status: string | null
          target_audience: Json | null
          template_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          delay_seconds?: number | null
          description?: string | null
          id?: string
          instance_id?: string | null
          message: string
          name: string
          recurrence_pattern?: string | null
          schedule_type?: string | null
          scheduled_at?: string | null
          status?: string | null
          target_audience?: Json | null
          template_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          delay_seconds?: number | null
          description?: string | null
          id?: string
          instance_id?: string | null
          message?: string
          name?: string
          recurrence_pattern?: string | null
          schedule_type?: string | null
          scheduled_at?: string | null
          status?: string | null
          target_audience?: Json | null
          template_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "zapi_instances"
            referencedColumns: ["id"]
          },
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
      email_domain_verifications: {
        Row: {
          created_at: string
          dkim_records: Json | null
          domain: string
          id: string
          resend_domain_id: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dkim_records?: Json | null
          domain: string
          id?: string
          resend_domain_id?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dkim_records?: Json | null
          domain?: string
          id?: string
          resend_domain_id?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      flow_automations: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          keyword: string | null
          name: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          keyword?: string | null
          name: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          keyword?: string | null
          name?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      flow_captured_data: {
        Row: {
          contact_id: string | null
          created_at: string | null
          data: Json | null
          flow_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          data?: Json | null
          flow_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          data?: Json | null
          flow_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flow_captured_data_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flow_automations"
            referencedColumns: ["id"]
          },
        ]
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
          buyer_data_access: boolean | null
          category: string | null
          commission_rate: number | null
          commission_type: string | null
          commission_value: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          marketplace_visible: boolean | null
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
          buyer_data_access?: boolean | null
          category?: string | null
          commission_rate?: number | null
          commission_type?: string | null
          commission_value?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          marketplace_visible?: boolean | null
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
          buyer_data_access?: boolean | null
          category?: string | null
          commission_rate?: number | null
          commission_type?: string | null
          commission_value?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          marketplace_visible?: boolean | null
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
      ml_affiliate_link_cache: {
        Row: {
          created_at: string
          id: string
          original_url: string
          short_url: string
          source_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          original_url: string
          short_url: string
          source_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          original_url?: string
          short_url?: string
          source_id?: string
          user_id?: string
        }
        Relationships: []
      }
      ml_webhook_config: {
        Row: {
          configured_at: string | null
          created_at: string | null
          id: number
          subscriptions: Json | null
          updated_at: string | null
          user_id: string
          webhook_url: string
        }
        Insert: {
          configured_at?: string | null
          created_at?: string | null
          id?: number
          subscriptions?: Json | null
          updated_at?: string | null
          user_id: string
          webhook_url: string
        }
        Update: {
          configured_at?: string | null
          created_at?: string | null
          id?: number
          subscriptions?: Json | null
          updated_at?: string | null
          user_id?: string
          webhook_url?: string
        }
        Relationships: []
      }
      ml_webhook_events: {
        Row: {
          created_at: string | null
          data: Json | null
          id: number
          processed_at: string | null
          resource: string | null
          topic: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          id?: number
          processed_at?: string | null
          resource?: string | null
          topic: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          id?: number
          processed_at?: string | null
          resource?: string | null
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      ml_webhook_items: {
        Row: {
          created_at: string | null
          data: Json
          id: number
          item_id: string
          price: number | null
          status: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data: Json
          id?: number
          item_id: string
          price?: number | null
          status?: string | null
          title?: string | null
          updated_at: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json
          id?: number
          item_id?: string
          price?: number | null
          status?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ml_webhook_promotions: {
        Row: {
          created_at: string | null
          data: Json
          id: number
          promotion_id: string
          status: string | null
          type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data: Json
          id?: number
          promotion_id: string
          status?: string | null
          type?: string | null
          updated_at: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json
          id?: number
          promotion_id?: string
          status?: string | null
          type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ml_webhook_stats: {
        Row: {
          events_failed: number | null
          events_processed: number | null
          events_received: number | null
          id: number
          last_event_at: string | null
          topic: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          events_failed?: number | null
          events_processed?: number | null
          events_received?: number | null
          id?: number
          last_event_at?: string | null
          topic: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          events_failed?: number | null
          events_processed?: number | null
          events_received?: number | null
          id?: number
          last_event_at?: string | null
          topic?: string
          updated_at?: string | null
          user_id?: string
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
          team_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          pipeline_id: string
          role?: string
          team_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          pipeline_id?: string
          role?: string
          team_id?: string | null
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
          {
            foreignKeyName: "pipeline_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
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
          boss_email: string | null
          created_at: string
          custom_domain: string | null
          custom_plan_value: number | null
          document: string | null
          document_type: string | null
          email: string | null
          email_sender_address: string | null
          email_sender_name: string | null
          full_name: string | null
          id: string
          is_active: boolean
          max_instances: number
          max_team_members: number | null
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
          boss_email?: string | null
          created_at?: string
          custom_domain?: string | null
          custom_plan_value?: number | null
          document?: string | null
          document_type?: string | null
          email?: string | null
          email_sender_address?: string | null
          email_sender_name?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          max_instances?: number
          max_team_members?: number | null
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
          boss_email?: string | null
          created_at?: string
          custom_domain?: string | null
          custom_plan_value?: number | null
          document?: string | null
          document_type?: string | null
          email?: string | null
          email_sender_address?: string | null
          email_sender_name?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          max_instances?: number
          max_team_members?: number | null
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
      resend_webhook_events: {
        Row: {
          created_at: string
          email_id: string | null
          event_type: string
          id: string
          raw_payload: Json
          recipient: string | null
          sender: string | null
          subject: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email_id?: string | null
          event_type: string
          id?: string
          raw_payload?: Json
          recipient?: string | null
          sender?: string | null
          subject?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email_id?: string | null
          event_type?: string
          id?: string
          raw_payload?: Json
          recipient?: string | null
          sender?: string | null
          subject?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      saved_contacts: {
        Row: {
          created_at: string | null
          id: string
          name: string | null
          phone: string
          tags: string[] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name?: string | null
          phone: string
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string | null
          phone?: string
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      sent_emails_mapping: {
        Row: {
          created_at: string
          email_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email_id?: string
          user_id?: string | null
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
      team_invites: {
        Row: {
          accepted_at: string | null
          allowed_instance_ids: string[]
          created_at: string
          email: string
          expires_at: string
          id: string
          role_id: string | null
          team_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          allowed_instance_ids?: string[]
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          role_id?: string | null
          team_id: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          allowed_instance_ids?: string[]
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          role_id?: string | null
          team_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invites_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "team_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invites_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          allowed_instance_ids: string[] | null
          created_at: string | null
          id: string
          permissions: Json | null
          role: string | null
          status: string | null
          team_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          allowed_instance_ids?: string[] | null
          created_at?: string | null
          id?: string
          permissions?: Json | null
          role?: string | null
          status?: string | null
          team_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          allowed_instance_ids?: string[] | null
          created_at?: string | null
          id?: string
          permissions?: Json | null
          role?: string | null
          status?: string | null
          team_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_roles: {
        Row: {
          created_at: string
          id: string
          name: string
          permissions: Json
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          permissions?: Json
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          permissions?: Json
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_roles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string | null
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
      telegram_channel_posts: {
        Row: {
          bot_id: string
          buttons: Json
          chat_id: number | null
          content_type: string
          created_at: string
          id: string
          last_error: string | null
          last_sent_at: string | null
          media_url: string | null
          mode: string
          next_run_at: string | null
          recurring_interval_minutes: number | null
          scheduled_at: string | null
          sent_count: number
          status: string
          template_id: string | null
          text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bot_id: string
          buttons?: Json
          chat_id?: number | null
          content_type?: string
          created_at?: string
          id?: string
          last_error?: string | null
          last_sent_at?: string | null
          media_url?: string | null
          mode?: string
          next_run_at?: string | null
          recurring_interval_minutes?: number | null
          scheduled_at?: string | null
          sent_count?: number
          status?: string
          template_id?: string | null
          text?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bot_id?: string
          buttons?: Json
          chat_id?: number | null
          content_type?: string
          created_at?: string
          id?: string
          last_error?: string | null
          last_sent_at?: string | null
          media_url?: string | null
          mode?: string
          next_run_at?: string | null
          recurring_interval_minutes?: number | null
          scheduled_at?: string | null
          sent_count?: number
          status?: string
          template_id?: string | null
          text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_channel_posts_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "telegram_bots"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_flow_sessions: {
        Row: {
          bot_id: string
          chat_id: number
          created_at: string
          current_node_id: string | null
          flow_id: string | null
          id: string
          last_error: string | null
          last_update_id: number | null
          resume_at: string | null
          status: string
          updated_at: string
          user_id: string
          variables: Json
          waiting_for: string | null
          waiting_var: string | null
        }
        Insert: {
          bot_id: string
          chat_id: number
          created_at?: string
          current_node_id?: string | null
          flow_id?: string | null
          id?: string
          last_error?: string | null
          last_update_id?: number | null
          resume_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          variables?: Json
          waiting_for?: string | null
          waiting_var?: string | null
        }
        Update: {
          bot_id?: string
          chat_id?: number
          created_at?: string
          current_node_id?: string | null
          flow_id?: string | null
          id?: string
          last_error?: string | null
          last_update_id?: number | null
          resume_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          variables?: Json
          waiting_for?: string | null
          waiting_var?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_flow_sessions_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "telegram_bots"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_free_channels: {
        Row: {
          approval_delay_seconds: number
          bot_id: string
          chat_id: number | null
          created_at: string
          flow_id: string | null
          response_type: string
          template_id: string | null
          title: string | null
          updated_at: string
          user_id: string
          welcome_message: string
        }
        Insert: {
          approval_delay_seconds?: number
          bot_id: string
          chat_id?: number | null
          created_at?: string
          flow_id?: string | null
          response_type?: string
          template_id?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          welcome_message?: string
        }
        Update: {
          approval_delay_seconds?: number
          bot_id?: string
          chat_id?: number | null
          created_at?: string
          flow_id?: string | null
          response_type?: string
          template_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          welcome_message?: string
        }
        Relationships: []
      }
      telegram_free_join_requests: {
        Row: {
          approve_at: string
          bot_id: string
          chat_id: number
          from_first_name: string | null
          from_user_id: number
          from_username: string | null
          id: string
          last_error: string | null
          processed_at: string | null
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          approve_at: string
          bot_id: string
          chat_id: number
          from_first_name?: string | null
          from_user_id: number
          from_username?: string | null
          id?: string
          last_error?: string | null
          processed_at?: string | null
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          approve_at?: string
          bot_id?: string
          chat_id?: number
          from_first_name?: string | null
          from_user_id?: number
          from_username?: string | null
          id?: string
          last_error?: string | null
          processed_at?: string | null
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      telegram_group_flow_runs: {
        Row: {
          bot_id: string
          chat_id: number
          context: Json
          created_at: string
          current_node_id: string | null
          flow_id: string
          id: string
          last_error: string | null
          next_run_at: string | null
          status: string
          step_count: number
          trigger_source: string | null
          triggered_by_user_id: number | null
          triggered_by_username: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bot_id: string
          chat_id: number
          context?: Json
          created_at?: string
          current_node_id?: string | null
          flow_id: string
          id?: string
          last_error?: string | null
          next_run_at?: string | null
          status?: string
          step_count?: number
          trigger_source?: string | null
          triggered_by_user_id?: number | null
          triggered_by_username?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bot_id?: string
          chat_id?: number
          context?: Json
          created_at?: string
          current_node_id?: string | null
          flow_id?: string
          id?: string
          last_error?: string | null
          next_run_at?: string | null
          status?: string
          step_count?: number
          trigger_source?: string | null
          triggered_by_user_id?: number | null
          triggered_by_username?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_group_flow_runs_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "telegram_group_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_group_flows: {
        Row: {
          bot_id: string
          chat_id: number | null
          created_at: string
          edges: Json
          id: string
          is_active: boolean
          last_run_at: string | null
          name: string
          next_run_at: string | null
          nodes: Json
          start_node_id: string | null
          trigger_config: Json
          trigger_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bot_id: string
          chat_id?: number | null
          created_at?: string
          edges?: Json
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          nodes?: Json
          start_node_id?: string | null
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bot_id?: string
          chat_id?: number | null
          created_at?: string
          edges?: Json
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          nodes?: Json
          start_node_id?: string | null
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_group_flows_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "telegram_bots"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_message_templates: {
        Row: {
          active: boolean
          buttons: Json
          content: string
          created_at: string
          id: string
          name: string
          parse_mode: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          buttons?: Json
          content?: string
          created_at?: string
          id?: string
          name: string
          parse_mode?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          buttons?: Json
          content?: string
          created_at?: string
          id?: string
          name?: string
          parse_mode?: string
          updated_at?: string
          user_id?: string
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
      telegram_redirect_links: {
        Row: {
          active: boolean
          click_count: number
          cloaker: boolean
          cloaker_anti_share: boolean
          cloaker_block_ads: boolean
          cloaker_block_method: string
          cloaker_redirect_url: string
          cloaker_v2: boolean
          created_at: string
          destination_bot_id: string | null
          destination_channel: string | null
          destination_type: string
          flow_ids: string[]
          id: string
          mode: string
          page_config: Json
          page_enabled: boolean
          slug: string
          slug_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          click_count?: number
          cloaker?: boolean
          cloaker_anti_share?: boolean
          cloaker_block_ads?: boolean
          cloaker_block_method?: string
          cloaker_redirect_url?: string
          cloaker_v2?: boolean
          created_at?: string
          destination_bot_id?: string | null
          destination_channel?: string | null
          destination_type?: string
          flow_ids?: string[]
          id?: string
          mode?: string
          page_config?: Json
          page_enabled?: boolean
          slug: string
          slug_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          click_count?: number
          cloaker?: boolean
          cloaker_anti_share?: boolean
          cloaker_block_ads?: boolean
          cloaker_block_method?: string
          cloaker_redirect_url?: string
          cloaker_v2?: boolean
          created_at?: string
          destination_bot_id?: string | null
          destination_channel?: string | null
          destination_type?: string
          flow_ids?: string[]
          id?: string
          mode?: string
          page_config?: Json
          page_enabled?: boolean
          slug?: string
          slug_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      telegram_sales_codes: {
        Row: {
          click_count: number
          code: string
          created_at: string
          id: string
          link_id: string
          name: string
          sales_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          click_count?: number
          code: string
          created_at?: string
          id?: string
          link_id: string
          name: string
          sales_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          click_count?: number
          code?: string
          created_at?: string
          id?: string
          link_id?: string
          name?: string
          sales_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_sales_codes_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "telegram_redirect_links"
            referencedColumns: ["id"]
          },
        ]
      }
      user_email_templates: {
        Row: {
          category: string | null
          created_at: string
          html: string
          id: string
          name: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          html?: string
          id?: string
          name: string
          subject?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          html?: string
          id?: string
          name?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_email_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          api_provider: string | null
          client_token: string | null
          created_at: string | null
          evolution_api_key: string | null
          evolution_api_url: string | null
          id: string
          instance_id: string | null
          instance_name: string | null
          instance_token: string | null
          instance_type: string | null
          is_active: boolean | null
          is_default: boolean | null
          name: string | null
          provider: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
          zapi_client_token: string | null
          zapi_instance_id: string | null
          zapi_token: string | null
        }
        Insert: {
          api_provider?: string | null
          client_token?: string | null
          created_at?: string | null
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          id?: string
          instance_id?: string | null
          instance_name?: string | null
          instance_token?: string | null
          instance_type?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string | null
          provider?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          zapi_client_token?: string | null
          zapi_instance_id?: string | null
          zapi_token?: string | null
        }
        Update: {
          api_provider?: string | null
          client_token?: string | null
          created_at?: string | null
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          id?: string
          instance_id?: string | null
          instance_name?: string | null
          instance_token?: string | null
          instance_type?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string | null
          provider?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
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
      check_is_team_owner: { Args: { t_id: string }; Returns: boolean }
      find_profile_id_by_email: { Args: { _email: string }; Returns: string }
      get_effective_user_id: { Args: { _user_id: string }; Returns: string }
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
      is_team_member_of_owner: {
        Args: { _caller_id: string; _owner_id: string }
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
