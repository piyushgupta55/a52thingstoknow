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
      ai_conversations: {
        Row: {
          book_id: string
          chapter_id: string | null
          created_at: string
          id: string
          message: string
          role: string
        }
        Insert: {
          book_id: string
          chapter_id?: string | null
          created_at?: string
          id?: string
          message: string
          role: string
        }
        Update: {
          book_id?: string
          chapter_id?: string | null
          created_at?: string
          id?: string
          message?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      book_ancestry: {
        Row: {
          book_id: string
          content: string | null
          created_at: string
          id: string
          pdf_filename: string | null
          pdf_url: string | null
          status: string
          updated_at: string
          upload_mime_type: string | null
        }
        Insert: {
          book_id: string
          content?: string | null
          created_at?: string
          id?: string
          pdf_filename?: string | null
          pdf_url?: string | null
          status?: string
          updated_at?: string
          upload_mime_type?: string | null
        }
        Update: {
          book_id?: string
          content?: string | null
          created_at?: string
          id?: string
          pdf_filename?: string | null
          pdf_url?: string | null
          status?: string
          updated_at?: string
          upload_mime_type?: string | null
        }
        Relationships: []
      }
      book_family_history: {
        Row: {
          book_id: string
          content: string | null
          created_at: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          book_id: string
          content?: string | null
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          book_id?: string
          content?: string | null
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_family_history_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: true
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      book_print_approvals: {
        Row: {
          approved_at: string
          book_id: string
          created_at: string
          id: string
          snapshot: Json
          user_id: string
        }
        Insert: {
          approved_at?: string
          book_id: string
          created_at?: string
          id?: string
          snapshot?: Json
          user_id: string
        }
        Update: {
          approved_at?: string
          book_id?: string
          created_at?: string
          id?: string
          snapshot?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_print_approvals_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      book_purchases: {
        Row: {
          amount_paid_cents: number
          book_id: string
          comp_granted_by: string | null
          comp_reason: string | null
          created_at: string
          currency: string
          discount_code: string | null
          environment: string
          extra_copies: number
          guarantee_deadline: string
          id: string
          is_comp: boolean
          refund_reason: string | null
          refund_reason_text: string | null
          refunded_at: string | null
          shipping_address: Json | null
          status: string
          stripe_customer_id: string | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          target_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paid_cents: number
          book_id: string
          comp_granted_by?: string | null
          comp_reason?: string | null
          created_at?: string
          currency?: string
          discount_code?: string | null
          environment?: string
          extra_copies?: number
          guarantee_deadline: string
          id?: string
          is_comp?: boolean
          refund_reason?: string | null
          refund_reason_text?: string | null
          refunded_at?: string | null
          shipping_address?: Json | null
          status?: string
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          target_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paid_cents?: number
          book_id?: string
          comp_granted_by?: string | null
          comp_reason?: string | null
          created_at?: string
          currency?: string
          discount_code?: string | null
          environment?: string
          extra_copies?: number
          guarantee_deadline?: string
          id?: string
          is_comp?: boolean
          refund_reason?: string | null
          refund_reason_text?: string | null
          refunded_at?: string | null
          shipping_address?: Json | null
          status?: string
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          target_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_purchases_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      book_status_history: {
        Row: {
          book_id: string
          changed_at: string
          changed_by: string | null
          id: string
          note: string | null
          status: Database["public"]["Enums"]["book_status"]
        }
        Insert: {
          book_id: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          note?: string | null
          status: Database["public"]["Enums"]["book_status"]
        }
        Update: {
          book_id?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["book_status"]
        }
        Relationships: [
          {
            foreignKeyName: "book_status_history_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          author_label: string | null
          carrier: string | null
          consent_granted_at: string | null
          cover_pick: string | null
          created_at: string
          from_label: string | null
          gender: string
          id: string
          ingramspark_job_id: string | null
          milestone_date: string | null
          occasion: string
          onboarding_step: string
          print_sku: string | null
          quantity: number | null
          recipient_gender: string
          recipient_name: string
          relationship: string
          shipping_address: Json | null
          status: Database["public"]["Enums"]["book_status"]
          tracking_number: string | null
          updated_at: string
          user_id: string
          writing_tone: string
        }
        Insert: {
          author_label?: string | null
          carrier?: string | null
          consent_granted_at?: string | null
          cover_pick?: string | null
          created_at?: string
          from_label?: string | null
          gender: string
          id?: string
          ingramspark_job_id?: string | null
          milestone_date?: string | null
          occasion: string
          onboarding_step?: string
          print_sku?: string | null
          quantity?: number | null
          recipient_gender: string
          recipient_name: string
          relationship: string
          shipping_address?: Json | null
          status?: Database["public"]["Enums"]["book_status"]
          tracking_number?: string | null
          updated_at?: string
          user_id: string
          writing_tone?: string
        }
        Update: {
          author_label?: string | null
          carrier?: string | null
          consent_granted_at?: string | null
          cover_pick?: string | null
          created_at?: string
          from_label?: string | null
          gender?: string
          id?: string
          ingramspark_job_id?: string | null
          milestone_date?: string | null
          occasion?: string
          onboarding_step?: string
          print_sku?: string | null
          quantity?: number | null
          recipient_gender?: string
          recipient_name?: string
          relationship?: string
          shipping_address?: Json | null
          status?: Database["public"]["Enums"]["book_status"]
          tracking_number?: string | null
          updated_at?: string
          user_id?: string
          writing_tone?: string
        }
        Relationships: []
      }
      chapter_passage_selections: {
        Row: {
          applied_body: string | null
          book_id: string
          chapter_id: string
          created_at: string
          id: string
          passage_key: string
          previous_content: string | null
          seen_at: string | null
          updated_at: string
          variant_key: string
        }
        Insert: {
          applied_body?: string | null
          book_id: string
          chapter_id: string
          created_at?: string
          id?: string
          passage_key: string
          previous_content?: string | null
          seen_at?: string | null
          updated_at?: string
          variant_key: string
        }
        Update: {
          applied_body?: string | null
          book_id?: string
          chapter_id?: string
          created_at?: string
          id?: string
          passage_key?: string
          previous_content?: string | null
          seen_at?: string | null
          updated_at?: string
          variant_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_passage_selections_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_passage_selections_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      chapter_passage_variants: {
        Row: {
          body: string
          chapter_number: number
          created_at: string
          explanation: string | null
          gender: string
          id: string
          is_default: boolean
          label: string
          passage_key: string
          sort_order: number
          template_key: string | null
          updated_at: string
          variant_key: string
        }
        Insert: {
          body: string
          chapter_number: number
          created_at?: string
          explanation?: string | null
          gender: string
          id?: string
          is_default?: boolean
          label: string
          passage_key: string
          sort_order?: number
          template_key?: string | null
          updated_at?: string
          variant_key: string
        }
        Update: {
          body?: string
          chapter_number?: number
          created_at?: string
          explanation?: string | null
          gender?: string
          id?: string
          is_default?: boolean
          label?: string
          passage_key?: string
          sort_order?: number
          template_key?: string | null
          updated_at?: string
          variant_key?: string
        }
        Relationships: []
      }
      chapter_review_flags: {
        Row: {
          action: string
          chapter_id: string
          created_at: string
          id: string
          tag_index: number
          updated_at: string
        }
        Insert: {
          action?: string
          chapter_id: string
          created_at?: string
          id?: string
          tag_index: number
          updated_at?: string
        }
        Update: {
          action?: string
          chapter_id?: string
          created_at?: string
          id?: string
          tag_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_review_flags_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      chapter_templates: {
        Row: {
          bible_verse_reference: string | null
          bible_verse_text: string | null
          chapter_number: number
          created_at: string
          default_quote_id: string | null
          default_verse_id: string | null
          gender: string
          id: string
          is_photo_chapter: boolean
          quote_attribution: string | null
          quote_text: string | null
          reference_content: string | null
          template_key: string | null
          title: string
        }
        Insert: {
          bible_verse_reference?: string | null
          bible_verse_text?: string | null
          chapter_number: number
          created_at?: string
          default_quote_id?: string | null
          default_verse_id?: string | null
          gender: string
          id?: string
          is_photo_chapter?: boolean
          quote_attribution?: string | null
          quote_text?: string | null
          reference_content?: string | null
          template_key?: string | null
          title: string
        }
        Update: {
          bible_verse_reference?: string | null
          bible_verse_text?: string | null
          chapter_number?: number
          created_at?: string
          default_quote_id?: string | null
          default_verse_id?: string | null
          gender?: string
          id?: string
          is_photo_chapter?: boolean
          quote_attribution?: string | null
          quote_text?: string | null
          reference_content?: string | null
          template_key?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_templates_default_quote_id_fkey"
            columns: ["default_quote_id"]
            isOneToOne: false
            referencedRelation: "quote_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_templates_default_verse_id_fkey"
            columns: ["default_verse_id"]
            isOneToOne: false
            referencedRelation: "verse_library"
            referencedColumns: ["id"]
          },
        ]
      }
      chapter_templates_backup_20260823: {
        Row: {
          bible_verse_reference: string | null
          bible_verse_text: string | null
          chapter_number: number | null
          created_at: string | null
          default_quote_id: string | null
          default_verse_id: string | null
          gender: string | null
          id: string | null
          is_photo_chapter: boolean | null
          quote_attribution: string | null
          quote_text: string | null
          reference_content: string | null
          title: string | null
        }
        Insert: {
          bible_verse_reference?: string | null
          bible_verse_text?: string | null
          chapter_number?: number | null
          created_at?: string | null
          default_quote_id?: string | null
          default_verse_id?: string | null
          gender?: string | null
          id?: string | null
          is_photo_chapter?: boolean | null
          quote_attribution?: string | null
          quote_text?: string | null
          reference_content?: string | null
          title?: string | null
        }
        Update: {
          bible_verse_reference?: string | null
          bible_verse_text?: string | null
          chapter_number?: number | null
          created_at?: string | null
          default_quote_id?: string | null
          default_verse_id?: string | null
          gender?: string | null
          id?: string | null
          is_photo_chapter?: boolean | null
          quote_attribution?: string | null
          quote_text?: string | null
          reference_content?: string | null
          title?: string | null
        }
        Relationships: []
      }
      chapters: {
        Row: {
          bible_verse_reference: string | null
          bible_verse_text: string | null
          book_id: string
          chapter_number: number
          chapter_template: string
          content: string | null
          created_at: string
          id: string
          is_photo_chapter: boolean
          photo_declined: boolean
          photo_layout: string
          photo_urls: string[]
          quote_attribution: string | null
          quote_id: string | null
          quote_text: string | null
          read_at: string | null
          reading_reward_ack_at: string | null
          reading_reward_ack_by: string | null
          reading_reward_decision: string | null
          reference_text: string | null
          review_note: string | null
          review_status: string | null
          seed_content: string | null
          template_key: string | null
          title: string
          triage: string | null
          updated_at: string
          verse_id: string | null
        }
        Insert: {
          bible_verse_reference?: string | null
          bible_verse_text?: string | null
          book_id: string
          chapter_number: number
          chapter_template?: string
          content?: string | null
          created_at?: string
          id?: string
          is_photo_chapter?: boolean
          photo_declined?: boolean
          photo_layout?: string
          photo_urls?: string[]
          quote_attribution?: string | null
          quote_id?: string | null
          quote_text?: string | null
          read_at?: string | null
          reading_reward_ack_at?: string | null
          reading_reward_ack_by?: string | null
          reading_reward_decision?: string | null
          reference_text?: string | null
          review_note?: string | null
          review_status?: string | null
          seed_content?: string | null
          template_key?: string | null
          title: string
          triage?: string | null
          updated_at?: string
          verse_id?: string | null
        }
        Update: {
          bible_verse_reference?: string | null
          bible_verse_text?: string | null
          book_id?: string
          chapter_number?: number
          chapter_template?: string
          content?: string | null
          created_at?: string
          id?: string
          is_photo_chapter?: boolean
          photo_declined?: boolean
          photo_layout?: string
          photo_urls?: string[]
          quote_attribution?: string | null
          quote_id?: string | null
          quote_text?: string | null
          read_at?: string | null
          reading_reward_ack_at?: string | null
          reading_reward_ack_by?: string | null
          reading_reward_decision?: string | null
          reference_text?: string | null
          review_note?: string | null
          review_status?: string | null
          seed_content?: string | null
          template_key?: string | null
          title?: string
          triage?: string | null
          updated_at?: string
          verse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chapters_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapters_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapters_verse_id_fkey"
            columns: ["verse_id"]
            isOneToOne: false
            referencedRelation: "verse_library"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters_status_backup_20260818: {
        Row: {
          backed_up_at: string | null
          book_id: string | null
          chapter_id: string | null
          chapter_number: number | null
          status: string | null
        }
        Insert: {
          backed_up_at?: string | null
          book_id?: string | null
          chapter_id?: string | null
          chapter_number?: number | null
          status?: string | null
        }
        Update: {
          backed_up_at?: string | null
          book_id?: string | null
          chapter_id?: string | null
          chapter_number?: number | null
          status?: string | null
        }
        Relationships: []
      }
      content_pool: {
        Row: {
          book_id: string | null
          created_at: string
          id: string
          origin: Database["public"]["Enums"]["content_origin"]
          placed_in: number[]
          source: string | null
          status: Database["public"]["Enums"]["content_status"]
          text: string
          topic_tags: string[]
          translation: string | null
          type: Database["public"]["Enums"]["content_type"]
          updated_at: string
          word_count: number
        }
        Insert: {
          book_id?: string | null
          created_at?: string
          id?: string
          origin?: Database["public"]["Enums"]["content_origin"]
          placed_in?: number[]
          source?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          text: string
          topic_tags?: string[]
          translation?: string | null
          type: Database["public"]["Enums"]["content_type"]
          updated_at?: string
          word_count?: number
        }
        Update: {
          book_id?: string | null
          created_at?: string
          id?: string
          origin?: Database["public"]["Enums"]["content_origin"]
          placed_in?: number[]
          source?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          text?: string
          topic_tags?: string[]
          translation?: string | null
          type?: Database["public"]["Enums"]["content_type"]
          updated_at?: string
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_pool_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      feedback: {
        Row: {
          created_at: string
          id: string
          issue_type: string
          message: string
          page_url: string | null
          screenshot_url: string | null
          screenshot_urls: string[]
          status: string
          updated_at: string
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          issue_type: string
          message: string
          page_url?: string | null
          screenshot_url?: string | null
          screenshot_urls?: string[]
          status?: string
          updated_at?: string
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          issue_type?: string
          message?: string
          page_url?: string | null
          screenshot_url?: string | null
          screenshot_urls?: string[]
          status?: string
          updated_at?: string
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      memories: {
        Row: {
          book_id: string
          chapter_id: string | null
          contributor_email: string | null
          contributor_name: string
          contributor_type: string
          created_at: string
          entry_type: string | null
          id: string
          memory_text: string
          placed_at: string | null
          seen_by_author_at: string | null
          size_tag: string
          status: string
        }
        Insert: {
          book_id: string
          chapter_id?: string | null
          contributor_email?: string | null
          contributor_name: string
          contributor_type?: string
          created_at?: string
          entry_type?: string | null
          id?: string
          memory_text: string
          placed_at?: string | null
          seen_by_author_at?: string | null
          size_tag?: string
          status?: string
        }
        Update: {
          book_id?: string
          chapter_id?: string | null
          contributor_email?: string | null
          contributor_name?: string
          contributor_type?: string
          created_at?: string
          entry_type?: string | null
          id?: string
          memory_text?: string
          placed_at?: string | null
          seen_by_author_at?: string | null
          size_tag?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "memories_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memories_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_invitees: {
        Row: {
          book_id: string
          created_at: string
          email: string
          id: string
          invite_token: string | null
          last_sent_at: string
          name: string
          sent_at: string
          updated_at: string
        }
        Insert: {
          book_id: string
          created_at?: string
          email: string
          id?: string
          invite_token?: string | null
          last_sent_at?: string
          name: string
          sent_at?: string
          updated_at?: string
        }
        Update: {
          book_id?: string
          created_at?: string
          email?: string
          id?: string
          invite_token?: string | null
          last_sent_at?: string
          name?: string
          sent_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_invitees_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_invites: {
        Row: {
          book_id: string
          created_at: string
          created_by: string
          id: string
          revoked_at: string | null
          token: string
        }
        Insert: {
          book_id: string
          created_at?: string
          created_by: string
          id?: string
          revoked_at?: string | null
          token: string
        }
        Update: {
          book_id?: string
          created_at?: string
          created_by?: string
          id?: string
          revoked_at?: string | null
          token?: string
        }
        Relationships: []
      }
      pending_comps: {
        Row: {
          created_at: string
          email: string
          granted_by: string | null
          id: string
          reason: string | null
          redeemed_at: string | null
          redeemed_book_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          granted_by?: string | null
          id?: string
          reason?: string | null
          redeemed_at?: string | null
          redeemed_book_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          granted_by?: string | null
          id?: string
          reason?: string | null
          redeemed_at?: string | null
          redeemed_book_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_comps_redeemed_book_id_fkey"
            columns: ["redeemed_book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          email_verified: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          email_verified?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          email_verified?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quote_library: {
        Row: {
          attribution: string
          created_at: string
          created_by: string
          id: string
          quote_text: string
          times_used: number
          topic_tags: string[]
        }
        Insert: {
          attribution: string
          created_at?: string
          created_by?: string
          id?: string
          quote_text: string
          times_used?: number
          topic_tags?: string[]
        }
        Update: {
          attribution?: string
          created_at?: string
          created_by?: string
          id?: string
          quote_text?: string
          times_used?: number
          topic_tags?: string[]
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
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
      verse_library: {
        Row: {
          created_at: string
          created_by: string
          id: string
          reference: string
          times_used: number
          topic_tags: string[]
          verse_text: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          reference: string
          times_used?: number
          topic_tags?: string[]
          verse_text: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          reference?: string
          times_used?: number
          topic_tags?: string[]
          verse_text?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_grant_book_comp: {
        Args: { _book_id: string; _reason: string }
        Returns: string
      }
      admin_grant_comp_by_email: {
        Args: { _email: string; _reason: string }
        Returns: Json
      }
      admin_revoke_book_comp: { Args: { _book_id: string }; Returns: undefined }
      book_is_unlocked: { Args: { _book_id: string }; Returns: boolean }
      claim_pending_comp: { Args: { _book_id: string }; Returns: Json }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_invite_context: {
        Args: { _token: string }
        Returns: {
          author_name: string
          book_id: string
          recipient_name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      submit_family_contributions: {
        Args: {
          _entries: Json
          _from_email: string
          _from_name: string
          _token: string
        }
        Returns: number
      }
      submit_memory_via_invite: {
        Args: { _from_name: string; _memory_text: string; _token: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin"
      book_status:
        | "in_progress"
        | "ready"
        | "approved_for_print"
        | "printed"
        | "shipped"
      content_origin:
        | "preloaded"
        | "ai_generated"
        | "author_written"
        | "family_submitted"
        | "tester_contributed"
      content_status: "pending" | "approved" | "deleted"
      content_type: "verse" | "quote" | "memory"
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
      app_role: ["admin"],
      book_status: [
        "in_progress",
        "ready",
        "approved_for_print",
        "printed",
        "shipped",
      ],
      content_origin: [
        "preloaded",
        "ai_generated",
        "author_written",
        "family_submitted",
        "tester_contributed",
      ],
      content_status: ["pending", "approved", "deleted"],
      content_type: ["verse", "quote", "memory"],
    },
  },
} as const
