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
      cooperadoras: {
        Row: {
          creado_por: string
          created_at: string
          cue: string | null
          cuit: string | null
          ejercicio: number
          id: string
          localidad: string | null
          nombre: string
          saldo_inicial_ejercicio: number
        }
        Insert: {
          creado_por?: string
          created_at?: string
          cue?: string | null
          cuit?: string | null
          ejercicio: number
          id?: string
          localidad?: string | null
          nombre: string
          saldo_inicial_ejercicio?: number
        }
        Update: {
          creado_por?: string
          created_at?: string
          cue?: string | null
          cuit?: string | null
          ejercicio?: number
          id?: string
          localidad?: string | null
          nombre?: string
          saldo_inicial_ejercicio?: number
        }
        Relationships: []
      }
      movimientos: {
        Row: {
          ajusta_movimiento_id: string | null
          comprobante: string | null
          concepto: string
          cooperadora_id: string
          creado_en: string
          creado_por: string
          fecha: string
          id: string
          medio_pago: string | null
          monto: number
          motivo_ajuste: string | null
          observaciones: string | null
          periodo_id: string
          rubro_id: string | null
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
        }
        Insert: {
          ajusta_movimiento_id?: string | null
          comprobante?: string | null
          concepto: string
          cooperadora_id: string
          creado_en?: string
          creado_por?: string
          fecha: string
          id?: string
          medio_pago?: string | null
          monto: number
          motivo_ajuste?: string | null
          observaciones?: string | null
          periodo_id: string
          rubro_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
        }
        Update: {
          ajusta_movimiento_id?: string | null
          comprobante?: string | null
          concepto?: string
          cooperadora_id?: string
          creado_en?: string
          creado_por?: string
          fecha?: string
          id?: string
          medio_pago?: string | null
          monto?: number
          motivo_ajuste?: string | null
          observaciones?: string | null
          periodo_id?: string
          rubro_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_movimiento"]
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_ajusta_movimiento_id_fkey"
            columns: ["ajusta_movimiento_id"]
            isOneToOne: false
            referencedRelation: "movimientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_cooperadora_id_fkey"
            columns: ["cooperadora_id"]
            isOneToOne: false
            referencedRelation: "cooperadoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_periodo_id_fkey"
            columns: ["periodo_id"]
            isOneToOne: false
            referencedRelation: "periodos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_rubro_id_fkey"
            columns: ["rubro_id"]
            isOneToOne: false
            referencedRelation: "rubros"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles: {
        Row: {
          cooperadora_id: string | null
          created_at: string
          email: string | null
          id: string
          nombre: string
        }
        Insert: {
          cooperadora_id?: string | null
          created_at?: string
          email?: string | null
          id: string
          nombre?: string
        }
        Update: {
          cooperadora_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_cooperadora_id_fkey"
            columns: ["cooperadora_id"]
            isOneToOne: false
            referencedRelation: "cooperadoras"
            referencedColumns: ["id"]
          },
        ]
      }
      periodos: {
        Row: {
          anio: number
          cerrado_en: string | null
          cerrado_por: string | null
          cooperadora_id: string
          created_at: string
          estado: string
          id: string
          mes: number
          saldo_inicial_declarado: number
        }
        Insert: {
          anio: number
          cerrado_en?: string | null
          cerrado_por?: string | null
          cooperadora_id: string
          created_at?: string
          estado?: string
          id?: string
          mes: number
          saldo_inicial_declarado?: number
        }
        Update: {
          anio?: number
          cerrado_en?: string | null
          cerrado_por?: string | null
          cooperadora_id?: string
          created_at?: string
          estado?: string
          id?: string
          mes?: number
          saldo_inicial_declarado?: number
        }
        Relationships: [
          {
            foreignKeyName: "periodos_cooperadora_id_fkey"
            columns: ["cooperadora_id"]
            isOneToOne: false
            referencedRelation: "cooperadoras"
            referencedColumns: ["id"]
          },
        ]
      }
      rubros: {
        Row: {
          activo: boolean
          cooperadora_id: string | null
          created_at: string
          id: string
          nombre: string
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
        }
        Insert: {
          activo?: boolean
          cooperadora_id?: string | null
          created_at?: string
          id?: string
          nombre: string
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
        }
        Update: {
          activo?: boolean
          cooperadora_id?: string | null
          created_at?: string
          id?: string
          nombre?: string
          tipo?: Database["public"]["Enums"]["tipo_movimiento"]
        }
        Relationships: [
          {
            foreignKeyName: "rubros_cooperadora_id_fkey"
            columns: ["cooperadora_id"]
            isOneToOne: false
            referencedRelation: "cooperadoras"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      crear_cooperadora: {
        Args: {
          _cue: string
          _cuit: string
          _ejercicio: number
          _localidad: string
          _nombre: string
          _saldo_inicial: number
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mi_cooperadora: { Args: never; Returns: string }
      otorgar_rol_auditor: { Args: { _email: string }; Returns: boolean }
      reclamar_rol_auditor: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "auditor" | "cooperadora"
      tipo_movimiento: "ingreso" | "egreso"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["auditor", "cooperadora"],
      tipo_movimiento: ["ingreso", "egreso"],
    },
  },
} as const
