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
      attachments: {
        Row: {
          created_at: string
          created_by: string
          height: number | null
          id: string
          message_id: string
          mime_type: string | null
          size: number | null
          storage_path: string
          width: number | null
        }
        Insert: {
          created_at?: string
          created_by: string
          height?: number | null
          id?: string
          message_id: string
          mime_type?: string | null
          size?: number | null
          storage_path: string
          width?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string
          height?: number | null
          id?: string
          message_id?: string
          mime_type?: string | null
          size?: number | null
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          org_id: string | null
          payload: Json
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          org_id?: string | null
          payload?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          org_id?: string | null
          payload?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_participants: {
        Row: {
          call_id: string
          id: string
          joined_at: string
          left_at: string | null
          user_id: string
        }
        Insert: {
          call_id: string
          id?: string
          joined_at?: string
          left_at?: string | null
          user_id: string
        }
        Update: {
          call_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_participants_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          channel_id: string
          ended_at: string | null
          id: string
          initiator_id: string
          kind: Database["public"]["Enums"]["call_kind"]
          started_at: string
          status: Database["public"]["Enums"]["call_status"]
        }
        Insert: {
          channel_id: string
          ended_at?: string | null
          id?: string
          initiator_id: string
          kind?: Database["public"]["Enums"]["call_kind"]
          started_at?: string
          status?: Database["public"]["Enums"]["call_status"]
        }
        Update: {
          channel_id?: string
          ended_at?: string | null
          id?: string
          initiator_id?: string
          kind?: Database["public"]["Enums"]["call_kind"]
          started_at?: string
          status?: Database["public"]["Enums"]["call_status"]
        }
        Relationships: [
          {
            foreignKeyName: "calls_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_members: {
        Row: {
          channel_id: string
          id: string
          joined_at: string
          last_read_at: string
          notif_level: Database["public"]["Enums"]["notif_level"]
          role: string
          user_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          joined_at?: string
          last_read_at?: string
          notif_level?: Database["public"]["Enums"]["notif_level"]
          role?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string
          notif_level?: Database["public"]["Enums"]["notif_level"]
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_archived: boolean
          is_locked: boolean
          name: string
          org_id: string
          topic: string | null
          type: Database["public"]["Enums"]["channel_type"]
          updated_at: string
          visibility: Database["public"]["Enums"]["channel_visibility"]
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_archived?: boolean
          is_locked?: boolean
          name: string
          org_id: string
          topic?: string | null
          type?: Database["public"]["Enums"]["channel_type"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["channel_visibility"]
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          is_locked?: boolean
          name?: string
          org_id?: string
          topic?: string | null
          type?: Database["public"]["Enums"]["channel_type"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["channel_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "channels_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          job_role: Database["public"]["Enums"]["job_role"]
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          job_role?: Database["public"]["Enums"]["job_role"]
          org_id: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          job_role?: Database["public"]["Enums"]["job_role"]
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          author_id: string
          body: string
          channel_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          parent_id: string | null
          slack_message_id: string | null
          ts_search: unknown
        }
        Insert: {
          author_id: string
          body?: string
          channel_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          parent_id?: string | null
          slack_message_id?: string | null
          ts_search?: unknown
        }
        Update: {
          author_id?: string
          body?: string
          channel_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          parent_id?: string | null
          slack_message_id?: string | null
          ts_search?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          org_id: string | null
          payload: Json
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id?: string | null
          payload?: Json
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string | null
          payload?: Json
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          code_verifier: string | null
          created_at: string
          expires_at: string
          org_id: string
          provider: Database["public"]["Enums"]["integration_provider"]
          redirect_to: string | null
          state: string
          user_id: string
        }
        Insert: {
          code_verifier?: string | null
          created_at?: string
          expires_at?: string
          org_id: string
          provider: Database["public"]["Enums"]["integration_provider"]
          redirect_to?: string | null
          state: string
          user_id: string
        }
        Update: {
          code_verifier?: string | null
          created_at?: string
          expires_at?: string
          org_id?: string
          provider?: Database["public"]["Enums"]["integration_provider"]
          redirect_to?: string | null
          state?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_states_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_email_settings: {
        Row: {
          accent_color: string
          brand_name: string
          created_at: string
          id: string
          invite_body: string
          invite_heading: string
          invite_subject: string
          logo_url: string | null
          org_id: string
          signature_company: string
          signature_disclaimer: string
          signature_logo_url: string | null
          signature_name: string
          signature_phone: string
          signature_title: string
          signature_website: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          brand_name?: string
          created_at?: string
          id?: string
          invite_body?: string
          invite_heading?: string
          invite_subject?: string
          logo_url?: string | null
          org_id: string
          signature_company?: string
          signature_disclaimer?: string
          signature_logo_url?: string | null
          signature_name?: string
          signature_phone?: string
          signature_title?: string
          signature_website?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          brand_name?: string
          created_at?: string
          id?: string
          invite_body?: string
          invite_heading?: string
          invite_subject?: string
          logo_url?: string | null
          org_id?: string
          signature_company?: string
          signature_disclaimer?: string
          signature_logo_url?: string | null
          signature_name?: string
          signature_phone?: string
          signature_title?: string
          signature_website?: string
          updated_at?: string
        }
        Relationships: []
      }
      org_integration_secrets: {
        Row: {
          access_token: string
          expires_at: string | null
          integration_id: string
          raw: Json
          refresh_token: string | null
          token_type: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          expires_at?: string | null
          integration_id: string
          raw?: Json
          refresh_token?: string | null
          token_type?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          expires_at?: string | null
          integration_id?: string
          raw?: Json
          refresh_token?: string | null
          token_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_integration_secrets_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: true
            referencedRelation: "org_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_integrations: {
        Row: {
          account_id: string | null
          account_label: string | null
          connected_at: string
          connected_by: string
          id: string
          metadata: Json
          org_id: string
          provider: Database["public"]["Enums"]["integration_provider"]
          scopes: string[]
          status: Database["public"]["Enums"]["integration_status"]
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          account_label?: string | null
          connected_at?: string
          connected_by: string
          id?: string
          metadata?: Json
          org_id: string
          provider: Database["public"]["Enums"]["integration_provider"]
          scopes?: string[]
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          account_label?: string | null
          connected_at?: string
          connected_by?: string
          id?: string
          metadata?: Json
          org_id?: string
          provider?: Database["public"]["Enums"]["integration_provider"]
          scopes?: string[]
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_oauth_credentials: {
        Row: {
          client_id: string
          client_secret: string
          created_at: string
          id: string
          org_id: string
          provider: string
          updated_at: string
        }
        Insert: {
          client_id: string
          client_secret: string
          created_at?: string
          id?: string
          org_id: string
          provider: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          client_secret?: string
          created_at?: string
          id?: string
          org_id?: string
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_oauth_credentials_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_smtp_settings: {
        Row: {
          created_at: string
          from_email: string
          from_name: string
          host: string
          id: string
          imap_port: number
          incoming_host: string
          incoming_protocols: string
          org_id: string
          outgoing_protocols: string
          password: string
          pop3_port: number
          port: number
          updated_at: string
          use_tls: boolean
          username: string
        }
        Insert: {
          created_at?: string
          from_email: string
          from_name?: string
          host: string
          id?: string
          imap_port?: number
          incoming_host?: string
          incoming_protocols?: string
          org_id: string
          outgoing_protocols?: string
          password: string
          pop3_port?: number
          port?: number
          updated_at?: string
          use_tls?: boolean
          username: string
        }
        Update: {
          created_at?: string
          from_email?: string
          from_name?: string
          host?: string
          id?: string
          imap_port?: number
          incoming_host?: string
          incoming_protocols?: string
          org_id?: string
          outgoing_protocols?: string
          password?: string
          pop3_port?: number
          port?: number
          updated_at?: string
          use_tls?: boolean
          username?: string
        }
        Relationships: []
      }
      organisation_members: {
        Row: {
          id: string
          job_role: Database["public"]["Enums"]["job_role"]
          joined_at: string
          org_id: string
          status: Database["public"]["Enums"]["member_status"]
          user_id: string
        }
        Insert: {
          id?: string
          job_role?: Database["public"]["Enums"]["job_role"]
          joined_at?: string
          org_id: string
          status?: Database["public"]["Enums"]["member_status"]
          user_id: string
        }
        Update: {
          id?: string
          job_role?: Database["public"]["Enums"]["job_role"]
          joined_at?: string
          org_id?: string
          status?: Database["public"]["Enums"]["member_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          account_type: string
          created_at: string
          created_by: string
          id: string
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          account_type?: string
          created_at?: string
          created_by: string
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          account_type?: string
          created_at?: string
          created_by?: string
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      pinned_messages: {
        Row: {
          channel_id: string
          id: string
          message_id: string
          pinned_at: string
          pinned_by: string
        }
        Insert: {
          channel_id: string
          id?: string
          message_id: string
          pinned_at?: string
          pinned_by: string
        }
        Update: {
          channel_id?: string
          id?: string
          message_id?: string
          pinned_at?: string
          pinned_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "pinned_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pinned_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      slack_channel_map: {
        Row: {
          channel_id: string
          created_at: string
          org_id: string
          slack_channel_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          org_id: string
          slack_channel_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          org_id?: string
          slack_channel_id?: string
        }
        Relationships: []
      }
      slack_imports: {
        Row: {
          channels_imported: number
          cursor_state: Json
          error_message: string | null
          finished_at: string | null
          history_window: string
          id: string
          members_linked: number
          messages_imported: number
          org_id: string
          scope: string
          started_at: string
          started_by: string
          status: Database["public"]["Enums"]["slack_import_status"]
        }
        Insert: {
          channels_imported?: number
          cursor_state?: Json
          error_message?: string | null
          finished_at?: string | null
          history_window?: string
          id?: string
          members_linked?: number
          messages_imported?: number
          org_id: string
          scope?: string
          started_at?: string
          started_by: string
          status?: Database["public"]["Enums"]["slack_import_status"]
        }
        Update: {
          channels_imported?: number
          cursor_state?: Json
          error_message?: string | null
          finished_at?: string | null
          history_window?: string
          id?: string
          members_linked?: number
          messages_imported?: number
          org_id?: string
          scope?: string
          started_at?: string
          started_by?: string
          status?: Database["public"]["Enums"]["slack_import_status"]
        }
        Relationships: []
      }
      slack_user_map: {
        Row: {
          created_at: string
          org_id: string
          slack_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          org_id: string
          slack_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          org_id?: string
          slack_user_id?: string
          user_id?: string
        }
        Relationships: []
      }
      typing_indicators: {
        Row: {
          channel_id: string
          expires_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          expires_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          expires_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "typing_indicators_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      user_presence: {
        Row: {
          last_seen_at: string
          org_id: string | null
          status: Database["public"]["Enums"]["presence_status"]
          user_id: string
        }
        Insert: {
          last_seen_at?: string
          org_id?: string | null
          status?: Database["public"]["Enums"]["presence_status"]
          user_id: string
        }
        Update: {
          last_seen_at?: string
          org_id?: string | null
          status?: Database["public"]["Enums"]["presence_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_presence_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          account_type: string
          avatar_url: string | null
          created_at: string
          department: string | null
          email: string
          full_name: string | null
          id: string
          job_title: string | null
          presence_status: Database["public"]["Enums"]["presence_status"]
          status_text: string | null
          timezone: string | null
          updated_at: string
          username: string
        }
        Insert: {
          account_type?: string
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email: string
          full_name?: string | null
          id: string
          job_title?: string | null
          presence_status?: Database["public"]["Enums"]["presence_status"]
          status_text?: string | null
          timezone?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          account_type?: string
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string | null
          id?: string
          job_title?: string | null
          presence_status?: Database["public"]["Enums"]["presence_status"]
          status_text?: string | null
          timezone?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          org_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: { Args: { _token: string }; Returns: string }
      can_read_channel: {
        Args: { _channel: string; _user: string }
        Returns: boolean
      }
      channel_org: { Args: { _channel: string }; Returns: string }
      generate_unique_username: { Args: { _seed: string }; Returns: string }
      has_role: {
        Args: {
          _org: string
          _role: Database["public"]["Enums"]["app_role"]
          _user: string
        }
        Returns: boolean
      }
      is_channel_admin: {
        Args: { _channel: string; _user: string }
        Returns: boolean
      }
      is_channel_member: {
        Args: { _channel: string; _user: string }
        Returns: boolean
      }
      is_org_member: { Args: { _org: string; _user: string }; Returns: boolean }
      is_super_admin: { Args: { _user: string }; Returns: boolean }
      message_channel: { Args: { _message: string }; Returns: string }
      slugify_username: { Args: { _input: string }; Returns: string }
    }
    Enums: {
      app_role: "super_admin" | "org_admin" | "manager" | "member" | "guest"
      call_kind: "voice" | "video"
      call_status: "ringing" | "active" | "ended"
      channel_type: "public" | "private" | "group" | "dm"
      channel_visibility: "open" | "restricted"
      integration_provider: "github" | "jira" | "figma"
      integration_status: "connected" | "error" | "expired"
      job_role:
        | "employee"
        | "executive"
        | "manager"
        | "product_manager"
        | "developer"
        | "designer"
        | "marketer"
        | "operations"
        | "sales"
        | "support"
        | "hr"
        | "finance"
        | "legal"
        | "other"
      member_status: "active" | "invited" | "suspended"
      notif_level: "all" | "mentions" | "none"
      presence_status: "online" | "away" | "offline"
      slack_import_status:
        | "pending"
        | "running"
        | "completed"
        | "failed"
        | "cancelled"
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
      app_role: ["super_admin", "org_admin", "manager", "member", "guest"],
      call_kind: ["voice", "video"],
      call_status: ["ringing", "active", "ended"],
      channel_type: ["public", "private", "group", "dm"],
      channel_visibility: ["open", "restricted"],
      integration_provider: ["github", "jira", "figma"],
      integration_status: ["connected", "error", "expired"],
      job_role: [
        "employee",
        "executive",
        "manager",
        "product_manager",
        "developer",
        "designer",
        "marketer",
        "operations",
        "sales",
        "support",
        "hr",
        "finance",
        "legal",
        "other",
      ],
      member_status: ["active", "invited", "suspended"],
      notif_level: ["all", "mentions", "none"],
      presence_status: ["online", "away", "offline"],
      slack_import_status: [
        "pending",
        "running",
        "completed",
        "failed",
        "cancelled",
      ],
    },
  },
} as const
