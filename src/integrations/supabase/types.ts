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
      attendance_requests: {
        Row: {
          created_at: string
          current_status: string | null
          date_key: string
          day: string
          end_time: string | null
          id: string
          reason: string | null
          rejection_reason: string | null
          requested_status: string
          requester_name: string
          reviewed_at: string | null
          reviewed_by: string | null
          start_time: string | null
          status: string
          worker_name: string
        }
        Insert: {
          created_at?: string
          current_status?: string | null
          date_key: string
          day: string
          end_time?: string | null
          id?: string
          reason?: string | null
          rejection_reason?: string | null
          requested_status: string
          requester_name: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_time?: string | null
          status?: string
          worker_name: string
        }
        Update: {
          created_at?: string
          current_status?: string | null
          date_key?: string
          day?: string
          end_time?: string | null
          id?: string
          reason?: string | null
          rejection_reason?: string | null
          requested_status?: string
          requester_name?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_time?: string | null
          status?: string
          worker_name?: string
        }
        Relationships: []
      }
      day_offs: {
        Row: {
          created_at: string
          date_key: string
          id: string
        }
        Insert: {
          created_at?: string
          date_key: string
          id?: string
        }
        Update: {
          created_at?: string
          date_key?: string
          id?: string
        }
        Relationships: []
      }
      equipment_rotation_playlist: {
        Row: {
          created_at: string
          id: string
          is_dummy: boolean
          position: number
          updated_at: string
          worker_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_dummy?: boolean
          position?: number
          updated_at?: string
          worker_name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_dummy?: boolean
          position?: number
          updated_at?: string
          worker_name?: string
        }
        Relationships: []
      }
      foreman_rotation_playlist: {
        Row: {
          created_at: string
          id: string
          is_dummy: boolean
          position: number
          updated_at: string
          worker_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_dummy?: boolean
          position?: number
          updated_at?: string
          worker_name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_dummy?: boolean
          position?: number
          updated_at?: string
          worker_name?: string
        }
        Relationships: []
      }
      inspection_rotation_playlist: {
        Row: {
          created_at: string
          id: string
          is_dummy: boolean
          position: number
          updated_at: string
          worker_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_dummy?: boolean
          position?: number
          updated_at?: string
          worker_name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_dummy?: boolean
          position?: number
          updated_at?: string
          worker_name?: string
        }
        Relationships: []
      }
      logistics_mid_rotation_playlist: {
        Row: {
          created_at: string
          id: string
          is_dummy: boolean
          position: number
          updated_at: string
          worker_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_dummy?: boolean
          position?: number
          updated_at?: string
          worker_name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_dummy?: boolean
          position?: number
          updated_at?: string
          worker_name?: string
        }
        Relationships: []
      }
      logistics_rotation_playlist: {
        Row: {
          created_at: string
          id: string
          is_dummy: boolean
          position: number
          updated_at: string
          worker_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_dummy?: boolean
          position?: number
          updated_at?: string
          worker_name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_dummy?: boolean
          position?: number
          updated_at?: string
          worker_name?: string
        }
        Relationships: []
      }
      notice_memos: {
        Row: {
          content: string
          id: string
          is_public: boolean
          updated_at: string
        }
        Insert: {
          content?: string
          id?: string
          is_public?: boolean
          updated_at?: string
        }
        Update: {
          content?: string
          id?: string
          is_public?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      package_rotation_playlist: {
        Row: {
          created_at: string
          id: string
          is_dummy: boolean
          position: number
          updated_at: string
          worker_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_dummy?: boolean
          position?: number
          updated_at?: string
          worker_name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_dummy?: boolean
          position?: number
          updated_at?: string
          worker_name?: string
        }
        Relationships: []
      }
      pattern_rules: {
        Row: {
          action: string
          applied_at: string
          applied_by: string | null
          changes: Json
          command: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          previous_state: Json | null
        }
        Insert: {
          action: string
          applied_at?: string
          applied_by?: string | null
          changes?: Json
          command: string
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          previous_state?: Json | null
        }
        Update: {
          action?: string
          applied_at?: string
          applied_by?: string | null
          changes?: Json
          command?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          previous_state?: Json | null
        }
        Relationships: []
      }
      production_schedules: {
        Row: {
          created_at: string
          created_by: string | null
          current_quantity: number
          end_date: string
          good_quantity: number
          id: string
          model_name: string
          start_date: string
          target_quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_quantity?: number
          end_date: string
          good_quantity?: number
          id?: string
          model_name: string
          start_date: string
          target_quantity?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_quantity?: number
          end_date?: string
          good_quantity?: number
          id?: string
          model_name?: string
          start_date?: string
          target_quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      rotation_settings: {
        Row: {
          id: boolean
          mode: string
          updated_at: string
        }
        Insert: {
          id?: boolean
          mode?: string
          updated_at?: string
        }
        Update: {
          id?: boolean
          mode?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      schedule_data: {
        Row: {
          created_at: string
          date_key: string
          department: string
          id: string
          shift: string
          updated_at: string
          workers: string[]
        }
        Insert: {
          created_at?: string
          date_key: string
          department: string
          id?: string
          shift: string
          updated_at?: string
          workers?: string[]
        }
        Update: {
          created_at?: string
          date_key?: string
          department?: string
          id?: string
          shift?: string
          updated_at?: string
          workers?: string[]
        }
        Relationships: []
      }
      special_workdays: {
        Row: {
          created_at: string
          date_key: string
          id: string
        }
        Insert: {
          created_at?: string
          date_key: string
          id?: string
        }
        Update: {
          created_at?: string
          date_key?: string
          id?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          display_order: number
          id: string
          role: string
          team: string
          updated_at: string
          worker_name: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          role: string
          team: string
          updated_at?: string
          worker_name: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          role?: string
          team?: string
          updated_at?: string
          worker_name?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
      weekend_availability: {
        Row: {
          id: string
          is_available: boolean
          updated_at: string
          week_key: string
          worker_name: string
        }
        Insert: {
          id?: string
          is_available?: boolean
          updated_at?: string
          week_key?: string
          worker_name: string
        }
        Update: {
          id?: string
          is_available?: boolean
          updated_at?: string
          week_key?: string
          worker_name?: string
        }
        Relationships: []
      }
      worker_statuses: {
        Row: {
          created_at: string
          date_key: string
          id: string
          status: string
          updated_at: string
          worker_name: string
        }
        Insert: {
          created_at?: string
          date_key: string
          id?: string
          status?: string
          updated_at?: string
          worker_name: string
        }
        Update: {
          created_at?: string
          date_key?: string
          id?: string
          status?: string
          updated_at?: string
          worker_name?: string
        }
        Relationships: []
      }
      working_saturdays: {
        Row: {
          created_at: string
          date_key: string
          id: string
        }
        Insert: {
          created_at?: string
          date_key: string
          id?: string
        }
        Update: {
          created_at?: string
          date_key?: string
          id?: string
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
