import type {
  Cita,
  Etapa,
  EntradaCita,
  FichaPaciente,
  FiltroPacientes,
  Mensaje,
  MotivoPerdido,
  NuevoPaciente,
  Paciente,
  ResultadoCrearPaciente,
  Resumen,
} from "./tipos"

/**
 * Lo único que las pantallas conocen del acceso a datos.
 * Las escrituras pasan SIEMPRE por funciones de la base (reglas del embudo en un solo lugar).
 * Dos implementaciones: `supabase.ts` (real) y `falso.ts` (datos inventados, para pruebas y desarrollo).
 */
export interface Datos {
  pacientes: {
    /** Para el kanban: todos los pacientes (con filtro opcional). */
    listar(filtro?: FiltroPacientes): Promise<Paciente[]>
    obtener(id: number): Promise<FichaPaciente | null>
    /** Si el teléfono ya existe devuelve `duplicado: true` y no crea nada. */
    crear(entrada: NuevoPaciente): Promise<ResultadoCrearPaciente>
    /** Perdido exige `motivo`. */
    moverEtapa(id: number, etapa: Etapa, motivo?: MotivoPerdido): Promise<Paciente>
  }
  citas: {
    /** Citas de un día (zona America/Guayaquil). */
    delDia(dia: Date): Promise<Cita[]>
    /** Citas desde `desde` (inclusive) hasta `hasta` (exclusive). */
    entre(desde: Date, hasta: Date): Promise<Cita[]>
    /** Crea o edita (con `citaId`). Paciente → Agendó. */
    guardar(entrada: EntradaCita): Promise<Cita>
    cancelar(citaId: number): Promise<Cita>
    /**
     * `volverEl` solo cuenta si asistió: omitido = en 6 meses, fecha yyyy-MM-dd = esa fecha,
     * `null` = sin retorno.
     */
    marcarAsistencia(citaId: number, asistio: boolean, volverEl?: string | null): Promise<Cita>
  }
  resumen: {
    /** `dia` por defecto: hoy (Guayaquil). */
    delDia(dia?: Date): Promise<Resumen>
  }
  mensajes: {
    /** Conversación con Eli (solo lectura), de más antiguo a más nuevo. */
    deConversacion(conversacionId: number): Promise<Mensaje[]>
  }
}

/** Error con mensaje ya en español, listo para mostrar a la doctora. */
export class ErrorDatos extends Error {
  constructor(
    mensaje: string,
    readonly codigo?: string
  ) {
    super(mensaje)
    this.name = "ErrorDatos"
  }
}
