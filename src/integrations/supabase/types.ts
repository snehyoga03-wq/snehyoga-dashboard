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
      attendance: {
        Row: {
          id: number
          created_at: string
          mobile_number: string
        }
        Insert: {
          id?: number
          created_at?: string
          mobile_number: string
        }
        Update: {
          id?: number
          created_at?: string
          mobile_number?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          attachment_type: string | null
          attachment_url: string | null
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          sender_type: string
          user_name: string | null
          user_phone: string
        }
        Insert: {
          attachment_type?: string | null
          attachment_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          sender_type: string
          user_name?: string | null
          user_phone: string
        }
        Update: {
          attachment_type?: string | null
          attachment_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          sender_type?: string
          user_name?: string | null
          user_phone?: string
        }
        Relationships: []
      }
      followup_daily_entries: {
        Row: {
          created_at: string | null
          day_number: number
          entry_date: string | null
          evening_meal: string | null
          id: string
          morning_meal: string | null
          outside_food: boolean | null
          report_id: string | null
          snacking_between_meals: boolean | null
          weight_after_yoga: number | null
          weight_before_sleep: number | null
          yoga_class_attended: boolean | null
        }
        Insert: {
          created_at?: string | null
          day_number: number
          entry_date?: string | null
          evening_meal?: string | null
          id?: string
          morning_meal?: string | null
          outside_food?: boolean | null
          report_id?: string | null
          snacking_between_meals?: boolean | null
          weight_after_yoga?: number | null
          weight_before_sleep?: number | null
          yoga_class_attended?: boolean | null
        }
        Update: {
          created_at?: string | null
          day_number?: number
          entry_date?: string | null
          evening_meal?: string | null
          id?: string
          morning_meal?: string | null
          outside_food?: boolean | null
          report_id?: string | null
          snacking_between_meals?: boolean | null
          weight_after_yoga?: number | null
          weight_before_sleep?: number | null
          yoga_class_attended?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "followup_daily_entries_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "followup_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_reports: {
        Row: {
          admission_date: string | null
          created_at: string | null
          id: string
          image_url: string | null
          starting_weight: number | null
          updated_at: string | null
          user_name: string | null
          user_phone: string
          weight_loss_goal: number | null
        }
        Insert: {
          admission_date?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          starting_weight?: number | null
          updated_at?: string | null
          user_name?: string | null
          user_phone: string
          weight_loss_goal?: number | null
        }
        Update: {
          admission_date?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          starting_weight?: number | null
          updated_at?: string | null
          user_name?: string | null
          user_phone?: string
          weight_loss_goal?: number | null
        }
        Relationships: []
      }
      gift_boxes: {
        Row: {
          box_number: number
          created_at: string | null
          id: string
          is_unlocked: boolean | null
          last_reset_at: string | null
          reward_type: string | null
          screenshot_url: string | null
          unlocked_at: string | null
          user_phone: string
        }
        Insert: {
          box_number: number
          created_at?: string | null
          id?: string
          is_unlocked?: boolean | null
          last_reset_at?: string | null
          reward_type?: string | null
          screenshot_url?: string | null
          unlocked_at?: string | null
          user_phone: string
        }
        Update: {
          box_number?: number
          created_at?: string | null
          id?: string
          is_unlocked?: boolean | null
          last_reset_at?: string | null
          reward_type?: string | null
          screenshot_url?: string | null
          unlocked_at?: string | null
          user_phone?: string
        }
        Relationships: []
      }
      link_clicks: {
        Row: {
          click_type: string | null
          clicked_at: string | null
          clicked_date: string | null
          id: string
          session_link: string | null
          user_name: string | null
          user_phone: string | null
        }
        Insert: {
          click_type?: string | null
          clicked_at?: string | null
          clicked_date?: string | null
          id?: string
          session_link?: string | null
          user_name?: string | null
          user_phone?: string | null
        }
        Update: {
          click_type?: string | null
          clicked_at?: string | null
          clicked_date?: string | null
          id?: string
          session_link?: string | null
          user_name?: string | null
          user_phone?: string | null
        }
        Relationships: []
      }
      main_data_registration: {
        Row: {
          batch_timing: string | null
          created_at: string | null
          days_left: number | null
          id: string
          last_attendance_date: string | null
          last_deduction_date: string | null
          last_order_id: string | null
          last_payment_id: string | null
          mobile_number: string
          name: string
          referral_link: string | null
          subscription_paused: boolean | null
          subscription_plan: string | null
          total_unlocked_boxes: number | null
        }
        Insert: {
          batch_timing?: string | null
          created_at?: string | null
          days_left?: number | null
          id?: string
          last_attendance_date?: string | null
          last_deduction_date?: string | null
          last_order_id?: string | null
          last_payment_id?: string | null
          mobile_number: string
          name: string
          referral_link?: string | null
          subscription_paused?: boolean | null
          subscription_plan?: string | null
          total_unlocked_boxes?: number | null
        }
        Update: {
          batch_timing?: string | null
          created_at?: string | null
          days_left?: number | null
          id?: string
          last_attendance_date?: string | null
          last_deduction_date?: string | null
          last_order_id?: string | null
          last_payment_id?: string | null
          mobile_number?: string
          name?: string
          referral_link?: string | null
          subscription_paused?: boolean | null
          subscription_plan?: string | null
          total_unlocked_boxes?: number | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string | null
          id: string
          referral_code: string
          referred_mobile: string
          referrer_mobile: string
          reward_days: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          referral_code: string
          referred_mobile: string
          referrer_mobile: string
          reward_days?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          referral_code?: string
          referred_mobile?: string
          referrer_mobile?: string
          reward_days?: number | null
        }
        Relationships: []
      }
      session_settings: {
        Row: {
          id: string
          pabbly_reminder_url: string | null
          premium_session_link: string | null
          session_link: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          pabbly_reminder_url?: string | null
          premium_session_link?: string | null
          session_link?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          pabbly_reminder_url?: string | null
          premium_session_link?: string | null
          session_link?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      message_queue: {
        Row: {
          id: string
          phone: string
          user_name: string | null
          template_name: string
          template_id: string | null
          template_category: string | null
          template_params: Json
          batch_id: string
          batch_label: string | null
          status: string
          retry_count: number
          max_retries: number
          last_error: string | null
          created_at: string
          updated_at: string
          processed_at: string | null
          delivered_at: string | null
          next_retry_at: string | null
        }
        Insert: {
          id?: string
          phone: string
          user_name?: string | null
          template_name: string
          template_id?: string | null
          template_category?: string | null
          template_params?: Json
          batch_id: string
          batch_label?: string | null
          status?: string
          retry_count?: number
          max_retries?: number
          last_error?: string | null
          created_at?: string
          updated_at?: string
          processed_at?: string | null
          delivered_at?: string | null
          next_retry_at?: string | null
        }
        Update: {
          id?: string
          phone?: string
          user_name?: string | null
          template_name?: string
          template_id?: string | null
          template_category?: string | null
          template_params?: Json
          batch_id?: string
          batch_label?: string | null
          status?: string
          retry_count?: number
          max_retries?: number
          last_error?: string | null
          created_at?: string
          updated_at?: string
          processed_at?: string | null
          delivered_at?: string | null
          next_retry_at?: string | null
        }
        Relationships: []
      }
      message_batches: {
        Row: {
          id: string
          label: string
          template_name: string | null
          total_messages: number
          delivered_count: number
          failed_count: number
          status: string
          created_at: string
          completed_at: string | null
          created_by: string | null
        }
        Insert: {
          id?: string
          label: string
          template_name?: string | null
          total_messages?: number
          delivered_count?: number
          failed_count?: number
          status?: string
          created_at?: string
          completed_at?: string | null
          created_by?: string | null
        }
        Update: {
          id?: string
          label?: string
          template_name?: string | null
          total_messages?: number
          delivered_count?: number
          failed_count?: number
          status?: string
          created_at?: string
          completed_at?: string | null
          created_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_subscription_days: {
        Args: { days: number; phone: string }
        Returns: boolean
      }
      decrement_subscription_days: { Args: never; Returns: undefined }
      generate_referral_code: {
        Args: { user_id: string; user_name: string }
        Returns: string
      }
      process_referral: {
        Args: { referral_code_input: string; referred_user_id: string }
        Returns: boolean
      }
      publish_messages: {
        Args: {
          p_batch_label: string
          p_template_name: string
          p_template_id: string
          p_template_category: string
          p_users: Json
        }
        Returns: string
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
