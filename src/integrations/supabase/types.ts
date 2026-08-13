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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      messages: {
        Row: {
          audio_url: string | null
          channel: Database["public"]["Enums"]["chat_channel"]
          content: string | null
          created_at: string
          id: string
          room_id: string
          sender_id: string | null
        }
        Insert: {
          audio_url?: string | null
          channel?: Database["public"]["Enums"]["chat_channel"]
          content?: string | null
          created_at?: string
          id?: string
          room_id: string
          sender_id?: string | null
        }
        Update: {
          audio_url?: string | null
          channel?: Database["public"]["Enums"]["chat_channel"]
          content?: string | null
          created_at?: string
          id?: string
          room_id?: string
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      night_actions: {
        Row: {
          detective_target_user_id: string | null
          doctor_target_user_id: string | null
          id: string
          resolved: boolean
          room_id: string
          round_number: number
          wolf_target_user_id: string | null
        }
        Insert: {
          detective_target_user_id?: string | null
          doctor_target_user_id?: string | null
          id?: string
          resolved?: boolean
          room_id: string
          round_number: number
          wolf_target_user_id?: string | null
        }
        Update: {
          detective_target_user_id?: string | null
          doctor_target_user_id?: string | null
          id?: string
          resolved?: boolean
          room_id?: string
          round_number?: number
          wolf_target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "night_actions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          phone_number: string | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          phone_number?: string | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          phone_number?: string | null
          username?: string
        }
        Relationships: []
      }
      room_players: {
        Row: {
          bot_avatar: string | null
          bot_name: string | null
          card_seen: boolean
          created_at: string
          id: string
          is_alive: boolean
          is_bot: boolean
          is_ready: boolean
          role: Database["public"]["Enums"]["player_role"] | null
          room_id: string
          self_heal_used: boolean
          user_id: string
          wants_vote: boolean
        }
        Insert: {
          bot_avatar?: string | null
          bot_name?: string | null
          card_seen?: boolean
          created_at?: string
          id?: string
          is_alive?: boolean
          is_bot?: boolean
          is_ready?: boolean
          role?: Database["public"]["Enums"]["player_role"] | null
          room_id: string
          self_heal_used?: boolean
          user_id: string
          wants_vote?: boolean
        }
        Update: {
          bot_avatar?: string | null
          bot_name?: string | null
          card_seen?: boolean
          created_at?: string
          id?: string
          is_alive?: boolean
          is_bot?: boolean
          is_ready?: boolean
          role?: Database["public"]["Enums"]["player_role"] | null
          room_id?: string
          self_heal_used?: boolean
          user_id?: string
          wants_vote?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "room_players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          current_phase: Database["public"]["Enums"]["game_phase"] | null
          host_id: string
          id: string
          phase_ends_at: string | null
          room_code: string
          round_number: number
          speaker_index: number
          status: Database["public"]["Enums"]["room_status"]
          winner: string | null
        }
        Insert: {
          created_at?: string
          current_phase?: Database["public"]["Enums"]["game_phase"] | null
          host_id: string
          id?: string
          phase_ends_at?: string | null
          room_code: string
          round_number?: number
          speaker_index?: number
          status?: Database["public"]["Enums"]["room_status"]
          winner?: string | null
        }
        Update: {
          created_at?: string
          current_phase?: Database["public"]["Enums"]["game_phase"] | null
          host_id?: string
          id?: string
          phase_ends_at?: string | null
          room_code?: string
          round_number?: number
          speaker_index?: number
          status?: Database["public"]["Enums"]["room_status"]
          winner?: string | null
        }
        Relationships: []
      }
      votes: {
        Row: {
          created_at: string
          id: string
          room_id: string
          round_number: number
          target_id: string
          voter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          room_id: string
          round_number: number
          target_id: string
          voter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          room_id?: string
          round_number?: number
          target_id?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_bots: {
        Args: { p_count: number; p_room_id: string }
        Returns: undefined
      }
      begin_night: {
        Args: { p_room_id: string; p_round: number }
        Returns: undefined
      }
      cast_vote: {
        Args: { p_room_id: string; p_target: string }
        Returns: undefined
      }
      check_win: { Args: { p_room_id: string }; Returns: string }
      confirm_card: { Args: { p_room_id: string }; Returns: undefined }
      create_room: { Args: never; Returns: string }
      detective_check: {
        Args: { p_room_id: string; p_target: string }
        Returns: boolean
      }
      doctor_heal: {
        Args: { p_room_id: string; p_target: string }
        Returns: undefined
      }
      finish_or_next_night: { Args: { p_room_id: string }; Returns: undefined }
      get_room_state: { Args: { p_room_id: string }; Returns: Json }
      is_room_member: { Args: { p_room_id: string }; Returns: boolean }
      join_room: { Args: { p_code: string }; Returns: string }
      my_role: {
        Args: { p_room_id: string }
        Returns: Database["public"]["Enums"]["player_role"]
      }
      open_voting: { Args: { p_room_id: string }; Returns: undefined }
      pass_turn: { Args: { p_room_id: string }; Returns: undefined }
      ready_to_vote: {
        Args: { p_ready: boolean; p_room_id: string }
        Returns: undefined
      }
      remove_bots: {
        Args: { p_count: number; p_room_id: string }
        Returns: undefined
      }
      resolve_night: { Args: { p_room_id: string }; Returns: undefined }
      resolve_votes: { Args: { p_room_id: string }; Returns: undefined }
      role_counts: {
        Args: { p_total: number }
        Returns: {
          detectives: number
          doctors: number
          wolves: number
        }[]
      }
      room_id_by_code: { Args: { p_code: string }; Returns: string }
      room_is_finished: { Args: { p_room_id: string }; Returns: boolean }
      run_bots: { Args: { p_room_id: string }; Returns: undefined }
      set_ready: {
        Args: { p_ready: boolean; p_room_id: string }
        Returns: undefined
      }
      start_game: { Args: { p_room_id: string }; Returns: undefined }
      tick_room: { Args: { p_room_id: string }; Returns: undefined }
      wolf_vote: {
        Args: { p_room_id: string; p_target: string }
        Returns: undefined
      }
    }
    Enums: {
      chat_channel: "GLOBAL" | "WOLF_PRIVATE" | "DETECTIVE_PRIVATE"
      game_phase:
        | "ROLE_DISTRIBUTION"
        | "NIGHT_WOLVES"
        | "NIGHT_DETECTIVE"
        | "NIGHT_DOCTOR"
        | "NIGHT_RESULT"
        | "DAY_DISCUSSION"
        | "DAY_CONCLUSION"
        | "DAY_VOTING"
      player_role: "WOLF" | "DOCTOR" | "DETECTIVE" | "CIVILIAN"
      room_status: "LOBBY" | "IN_PROGRESS" | "FINISHED"
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
      chat_channel: ["GLOBAL", "WOLF_PRIVATE", "DETECTIVE_PRIVATE"],
      game_phase: [
        "ROLE_DISTRIBUTION",
        "NIGHT_WOLVES",
        "NIGHT_DETECTIVE",
        "NIGHT_DOCTOR",
        "NIGHT_RESULT",
        "DAY_DISCUSSION",
        "DAY_CONCLUSION",
        "DAY_VOTING",
      ],
      player_role: ["WOLF", "DOCTOR", "DETECTIVE", "CIVILIAN"],
      room_status: ["LOBBY", "IN_PROGRESS", "FINISHED"],
    },
  },
} as const
