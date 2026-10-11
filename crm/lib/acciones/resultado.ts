import { ErrorDatos } from "@/lib/data/interfaz"

/** Lo que devuelven las Server Actions al cliente: nunca lanzan, para poder mostrar el mensaje. */
export type Resultado<T = undefined> = { ok: true; datos: T } | { ok: false; error: string }

export async function ejecutar<T>(fn: () => Promise<T>): Promise<Resultado<T>> {
  try {
    return { ok: true, datos: await fn() }
  } catch (e) {
    if (e instanceof ErrorDatos) return { ok: false, error: e.message }
    console.error(e)
    return { ok: false, error: "Algo salió mal. Intenta de nuevo." }
  }
}
