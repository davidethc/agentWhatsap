
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "auditoria": {
                  Row: {
                    "accion": string,"actor": Database["public"]['Enums']["actor"],"antes": Json | null,"despues": Json | null,"en": string,"fila_id": number,"id": number,"personal_id": string | null,"tabla": string
                  }
                  Insert: {
                    "accion": string,"actor": Database["public"]['Enums']["actor"],"antes"?: Json | null,"despues"?: Json | null,"en"?: string,"fila_id": number,"id"?: never,"personal_id"?: string | null,"tabla": string
                  }
                  Update: {
                    "accion"?: string,"actor"?: Database["public"]['Enums']["actor"],"antes"?: Json | null,"despues"?: Json | null,"en"?: string,"fila_id"?: number,"id"?: never,"personal_id"?: string | null,"tabla"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cambios_etapa": {
                  Row: {
                    "a": Database["public"]['Enums']["etapa"],"actor": Database["public"]['Enums']["actor"],"de": Database["public"]['Enums']["etapa"] | null,"en": string,"id": number,"motivo_perdido": Database["public"]['Enums']["motivo_perdido"] | null,"paciente_id": number,"personal_id": string | null
                  }
                  Insert: {
                    "a": Database["public"]['Enums']["etapa"],"actor": Database["public"]['Enums']["actor"],"de"?: Database["public"]['Enums']["etapa"] | null,"en"?: string,"id"?: never,"motivo_perdido"?: Database["public"]['Enums']["motivo_perdido"] | null,"paciente_id": number,"personal_id"?: string | null
                  }
                  Update: {
                    "a"?: Database["public"]['Enums']["etapa"],"actor"?: Database["public"]['Enums']["actor"],"de"?: Database["public"]['Enums']["etapa"] | null,"en"?: string,"id"?: never,"motivo_perdido"?: Database["public"]['Enums']["motivo_perdido"] | null,"paciente_id"?: number,"personal_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "cambios_etapa_paciente_id_fkey"
      columns: ["paciente_id"]
isOneToOne: false
      referencedRelation: "pacientes"
      referencedColumns: ["id"]
    }
                  ]
                },"citas": {
                  Row: {
                    "created_at": string,"estado": Database["public"]['Enums']["estado_cita"],"gcal_etag": string | null,"gcal_event_id": string | null,"id": number,"inicia_en": string,"origen": Database["public"]['Enums']["origen_cita"],"paciente_id": number | null,"servicio": string | null,"sync": string,"sync_error": string | null,"termina_en": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"estado"?: Database["public"]['Enums']["estado_cita"],"gcal_etag"?: string | null,"gcal_event_id"?: string | null,"id"?: never,"inicia_en": string,"origen": Database["public"]['Enums']["origen_cita"],"paciente_id"?: number | null,"servicio"?: string | null,"sync"?: string,"sync_error"?: string | null,"termina_en": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"estado"?: Database["public"]['Enums']["estado_cita"],"gcal_etag"?: string | null,"gcal_event_id"?: string | null,"id"?: never,"inicia_en"?: string,"origen"?: Database["public"]['Enums']["origen_cita"],"paciente_id"?: number | null,"servicio"?: string | null,"sync"?: string,"sync_error"?: string | null,"termina_en"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "citas_paciente_id_fkey"
      columns: ["paciente_id"]
isOneToOne: false
      referencedRelation: "pacientes"
      referencedColumns: ["id"]
    }
                  ]
                },"conversaciones": {
                  Row: {
                    "created_at": string,"id": number,"nombre_whatsapp": string | null,"telefono": string,"turnos_entrantes": number,"ultimo_entrante_en": string | null,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: never,"nombre_whatsapp"?: string | null,"telefono": string,"turnos_entrantes"?: number,"ultimo_entrante_en"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"nombre_whatsapp"?: string | null,"telefono"?: string,"turnos_entrantes"?: number,"ultimo_entrante_en"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"datos_clinicos": {
                  Row: {
                    "alergias": string | null,"created_at": string,"embarazo": boolean | null,"enfermedades": string | null,"miedo": string | null,"paciente_id": number,"updated_at": string
                  }
                  Insert: {
                    "alergias"?: string | null,"created_at"?: string,"embarazo"?: boolean | null,"enfermedades"?: string | null,"miedo"?: string | null,"paciente_id": number,"updated_at"?: string
                  }
                  Update: {
                    "alergias"?: string | null,"created_at"?: string,"embarazo"?: boolean | null,"enfermedades"?: string | null,"miedo"?: string | null,"paciente_id"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "datos_clinicos_paciente_id_fkey"
      columns: ["paciente_id"]
isOneToOne: true
      referencedRelation: "pacientes"
      referencedColumns: ["id"]
    }
                  ]
                },"errores_integracion": {
                  Row: {
                    "detalle": NonNullable<Json>,"en": string,"id": number,"origen": string
                  }
                  Insert: {
                    "detalle": NonNullable<Json>,"en"?: string,"id"?: never,"origen": string
                  }
                  Update: {
                    "detalle"?: NonNullable<Json>,"en"?: string,"id"?: never,"origen"?: string
                  }
                  Relationships: [
                    
                  ]
                },"horario": {
                  Row: {
                    "abre": string,"cierra": string,"created_at": string,"dia_semana": number,"updated_at": string
                  }
                  Insert: {
                    "abre": string,"cierra": string,"created_at"?: string,"dia_semana": number,"updated_at"?: string
                  }
                  Update: {
                    "abre"?: string,"cierra"?: string,"created_at"?: string,"dia_semana"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"mensajes": {
                  Row: {
                    "conversacion_id": number,"created_at": string,"direccion": string,"enviado_en": string,"id": number,"id_externo": string,"texto": string
                  }
                  Insert: {
                    "conversacion_id": number,"created_at"?: string,"direccion": string,"enviado_en": string,"id"?: never,"id_externo": string,"texto": string
                  }
                  Update: {
                    "conversacion_id"?: number,"created_at"?: string,"direccion"?: string,"enviado_en"?: string,"id"?: never,"id_externo"?: string,"texto"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mensajes_conversacion_id_fkey"
      columns: ["conversacion_id"]
isOneToOne: false
      referencedRelation: "conversaciones"
      referencedColumns: ["id"]
    }
                  ]
                },"pacientes": {
                  Row: {
                    "cedula": string | null,"consentimiento_firmado_en": string | null,"conversacion_id": number | null,"correo": string | null,"created_at": string,"etapa": Database["public"]['Enums']["etapa"],"etapa_cambiada_en": string,"fecha_nacimiento": string | null,"id": number,"motivo_perdido": Database["public"]['Enums']["motivo_perdido"] | null,"nombre": string,"origen": Database["public"]['Enums']["origen_paciente"],"responsable_id": number | null,"updated_at": string,"volver_el": string | null
                  }
                  Insert: {
                    "cedula"?: string | null,"consentimiento_firmado_en"?: string | null,"conversacion_id"?: number | null,"correo"?: string | null,"created_at"?: string,"etapa"?: Database["public"]['Enums']["etapa"],"etapa_cambiada_en"?: string,"fecha_nacimiento"?: string | null,"id"?: never,"motivo_perdido"?: Database["public"]['Enums']["motivo_perdido"] | null,"nombre": string,"origen": Database["public"]['Enums']["origen_paciente"],"responsable_id"?: number | null,"updated_at"?: string,"volver_el"?: string | null
                  }
                  Update: {
                    "cedula"?: string | null,"consentimiento_firmado_en"?: string | null,"conversacion_id"?: number | null,"correo"?: string | null,"created_at"?: string,"etapa"?: Database["public"]['Enums']["etapa"],"etapa_cambiada_en"?: string,"fecha_nacimiento"?: string | null,"id"?: never,"motivo_perdido"?: Database["public"]['Enums']["motivo_perdido"] | null,"nombre"?: string,"origen"?: Database["public"]['Enums']["origen_paciente"],"responsable_id"?: number | null,"updated_at"?: string,"volver_el"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "pacientes_conversacion_id_fkey"
      columns: ["conversacion_id"]
isOneToOne: false
      referencedRelation: "conversaciones"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pacientes_responsable_id_fkey"
      columns: ["responsable_id"]
isOneToOne: false
      referencedRelation: "pacientes"
      referencedColumns: ["id"]
    }
                  ]
                },"personal": {
                  Row: {
                    "created_at": string,"nombre": string,"rol": Database["public"]['Enums']["rol_personal"],"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"nombre": string,"rol": Database["public"]['Enums']["rol_personal"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"nombre"?: string,"rol"?: Database["public"]['Enums']["rol_personal"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"sync_calendario": {
                  Row: {
                    "calendario_id": string,"created_at": string,"sync_token": string | null,"ultima_sync_en": string | null,"updated_at": string
                  }
                  Insert: {
                    "calendario_id": string,"created_at"?: string,"sync_token"?: string | null,"ultima_sync_en"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "calendario_id"?: string,"created_at"?: string,"sync_token"?: string | null,"ultima_sync_en"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "cancelar_cita":
{ Args: { "p_cita_id": number }; Returns: {
              "created_at": string,
"estado": Database["public"]['Enums']["estado_cita"],
"gcal_etag": string | null,
"gcal_event_id": string | null,
"id": number,
"inicia_en": string,
"origen": Database["public"]['Enums']["origen_cita"],
"paciente_id": number | null,
"servicio": string | null,
"sync": string,
"sync_error": string | null,
"termina_en": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "citas"
        isOneToOne: true
        isSetofReturn: false
      } },
"crear_paciente":
{ Args: { "p_cedula"?: string,"p_correo"?: string,"p_fecha_nacimiento"?: string,"p_nombre": string,"p_origen": Database["public"]['Enums']["origen_paciente"],"p_responsable_id"?: number,"p_telefono"?: string }; Returns: Json
                           },
"guardar_cita":
{ Args: { "p_cita_id"?: number,"p_inicia_en": string,"p_paciente_id": number,"p_servicio"?: string,"p_termina_en"?: string }; Returns: {
              "created_at": string,
"estado": Database["public"]['Enums']["estado_cita"],
"gcal_etag": string | null,
"gcal_event_id": string | null,
"id": number,
"inicia_en": string,
"origen": Database["public"]['Enums']["origen_cita"],
"paciente_id": number | null,
"servicio": string | null,
"sync": string,
"sync_error": string | null,
"termina_en": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "citas"
        isOneToOne: true
        isSetofReturn: false
      } },
"marcar_asistencia":
{ Args: { "p_asistio": boolean,"p_cita_id": number,"p_volver_el"?: string }; Returns: {
              "created_at": string,
"estado": Database["public"]['Enums']["estado_cita"],
"gcal_etag": string | null,
"gcal_event_id": string | null,
"id": number,
"inicia_en": string,
"origen": Database["public"]['Enums']["origen_cita"],
"paciente_id": number | null,
"servicio": string | null,
"sync": string,
"sync_error": string | null,
"termina_en": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "citas"
        isOneToOne: true
        isSetofReturn: false
      } },
"mover_etapa":
{ Args: { "p_etapa": Database["public"]['Enums']["etapa"],"p_motivo"?: Database["public"]['Enums']["motivo_perdido"],"p_paciente_id": number }; Returns: {
              "cedula": string | null,
"consentimiento_firmado_en": string | null,
"conversacion_id": number | null,
"correo": string | null,
"created_at": string,
"etapa": Database["public"]['Enums']["etapa"],
"etapa_cambiada_en": string,
"fecha_nacimiento": string | null,
"id": number,
"motivo_perdido": Database["public"]['Enums']["motivo_perdido"] | null,
"nombre": string,
"origen": Database["public"]['Enums']["origen_paciente"],
"responsable_id": number | null,
"updated_at": string,
"volver_el": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "pacientes"
        isOneToOne: true
        isSetofReturn: false
      } },
"registrar_evento_eli":
{ Args: { "p_evento": Json }; Returns: Json
                           },
"resumen_del_dia":
{ Args: { "p_fecha"?: string }; Returns: Json
                           }
          }
          Enums: {
            "actor": "personal"|"eli"|"sistema"|"calendario","estado_cita": "agendada"|"asistio"|"no_asistio"|"cancelada","etapa": "nuevo"|"conversando"|"agendo"|"asistio"|"seguimiento"|"perdido","motivo_perdido": "no_respondio"|"indeciso"|"no_asistio","origen_cita": "eli"|"panel"|"calendario","origen_paciente": "whatsapp"|"llamada"|"presencial"|"referido","rol_personal": "doctora"|"admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "actor": ["personal", "eli", "sistema", "calendario"],"estado_cita": ["agendada", "asistio", "no_asistio", "cancelada"],"etapa": ["nuevo", "conversando", "agendo", "asistio", "seguimiento", "perdido"],"motivo_perdido": ["no_respondio", "indeciso", "no_asistio"],"origen_cita": ["eli", "panel", "calendario"],"origen_paciente": ["whatsapp", "llamada", "presencial", "referido"],"rol_personal": ["doctora", "admin"]
          }
        }
} as const
