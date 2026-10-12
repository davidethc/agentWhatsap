import { and, eq, inArray, isNull, lte, or } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { getEnv } from "@/lib/env";
import { publish } from "@/server/events/bus";

/**
 * 021 — El outbox del despachador.
 *
 * Hace cumplir «bandeja primero, cerebro después»: el mensaje ya está en
 * `message` antes de que exista una fila aquí. Si el despacho falla, el
 * mensaje sigue en la bandeja; si el proceso muere, el lease expira y el
 * siguiente barrido la retoma.
 *
 * El agrupado de ráfagas NO se implementa con temporizadores: lo hace el
 * índice único parcial `dispatch_conversation_vivo_uq`, que permite como
 * máximo UN despacho vivo por conversación. Encolar cinco mensajes seguidos
 * hace un INSERT y cuatro UPDATE de la ventana. La garantía la da Postgres,
 * así que sobrevive a que alguien reescriba el worker.
 *
 * Puerto de `src/server/dispatch/outbox.ts` de Vocero Cloud.
 */

/**
 * Cuánto se espera desde el último mensaje antes de despachar.
 *
 * Es la MISMA variable que usa el agente incluido (`AGENT_COALESCE_MS`), y a
 * propósito: la pregunta que responde es idéntica —cuánto esperar a que
 * alguien termine de escribir su ráfaga— y los dos caminos nunca están vivos a
 * la vez. Dos nombres para un solo concepto solo servirían para que alguien
 * bajara uno y se preguntara por qué no pasa nada.
 */
export function ventanaCoalesceMs(): number {
  return getEnv().AGENT_COALESCE_MS;
}

/** Cuánto tiempo un worker se reserva una fila antes de que otro pueda tomarla. */
export const LEASE_MS = 180_000;
export const MAX_INTENTOS = 3;
/** Espera tras el intento 1 y tras el 2. El tercero ya no reintenta. */
export const BACKOFF_MS = [1000, 4000];

/** Pura: la espera base antes del siguiente intento. */
export function esperaDeReintento(intentosHechos: number): number {
  const i = Math.min(Math.max(intentosHechos, 1), BACKOFF_MS.length) - 1;
  return BACKOFF_MS[i] ?? 1000;
}

export type FilaDespacho = typeof schema.dispatch.$inferSelect;

/**
 * Encola (o extiende) el despacho de una conversación.
 *
 * Idempotente por construcción: si ya hay uno pendiente, empuja su ventana en
 * vez de crear otro. Devuelve CUÁNDO vence esa ventana, para que quien encola
 * despierte al worker en ese instante en vez de esperar a su siguiente
 * barrido.
 */
export async function encolarDespacho(params: {
  organizationId: string;
  conversationId: string;
  ahora?: Date;
}): Promise<{ id: string; notBefore: Date }> {
  const db = getDb();
  const ahora = params.ahora ?? new Date();
  const notBefore = new Date(ahora.getTime() + ventanaCoalesceMs());

  const [vivo] = await db
    .select()
    .from(schema.dispatch)
    .where(
      and(
        eq(schema.dispatch.conversationId, params.conversationId),
        inArray(schema.dispatch.status, ["pendiente", "en_vuelo"])
      )
    )
    .limit(1);

  if (vivo) {
    if (vivo.status === "pendiente") {
      await db
        .update(schema.dispatch)
        .set({ notBefore, lastMessageAt: ahora, updatedAt: ahora })
        .where(
          and(
            eq(schema.dispatch.id, vivo.id),
            eq(schema.dispatch.status, "pendiente")
          )
        );
      return { id: vivo.id, notBefore };
    }
    // En vuelo: el cerebro ya tiene el evento, sin este mensaje. No se toca
    // la fila; el worker, al entregarla, ve que la ráfaga creció y encola otro
    // despacho (`hayMensajesSinDespachar`).
    return { id: vivo.id, notBefore: vivo.notBefore };
  }

  const id = newId("dispatch");
  try {
    await db.insert(schema.dispatch).values({
      id,
      organizationId: params.organizationId,
      conversationId: params.conversationId,
      status: "pendiente",
      notBefore,
      firstMessageAt: ahora,
      lastMessageAt: ahora,
    });
  } catch (err) {
    // Dos mensajes de la misma conversación entraron a la vez y el otro ganó
    // el índice único: su fila ya cubre a este mensaje.
    if (!esViolacionDeUnicidad(err)) throw err;
  }
  return { id, notBefore };
}

function esViolacionDeUnicidad(err: unknown): boolean {
  const code =
    (err as { code?: string })?.code ??
    (err as { cause?: { code?: string } })?.cause?.code;
  return code === "23505";
}

/**
 * Toma hasta `limite` despachos cuya ventana ya venció.
 *
 * El lease es lo que permite que varios procesos (o el mismo tras reiniciar)
 * no se pisen: se marca `en_vuelo` con `leased_until`, y una fila cuyo lease
 * expiró vuelve a estar disponible aunque siga marcada en vuelo.
 */
export async function tomarPendientes(
  limite = 10,
  ahora: Date = new Date()
): Promise<FilaDespacho[]> {
  const db = getDb();
  const candidatos = await db
    .select()
    .from(schema.dispatch)
    .where(
      or(
        and(
          eq(schema.dispatch.status, "pendiente"),
          lte(schema.dispatch.notBefore, ahora)
        ),
        // Lease vencido: el worker que la tomó murió a mitad.
        and(
          eq(schema.dispatch.status, "en_vuelo"),
          lte(schema.dispatch.leasedUntil, ahora)
        )
      )
    )
    .orderBy(schema.dispatch.notBefore)
    .limit(limite);

  const tomados: FilaDespacho[] = [];
  for (const fila of candidatos) {
    /**
     * La reclamación es este UPDATE, no el SELECT de arriba, y se condiciona
     * al estado y al contador de intentos.
     *
     * Comparar el timestamp parecía un candado más fino, pero es frágil de una
     * forma silenciosa: Postgres guarda microsegundos y el `Date` de JS solo
     * milisegundos, así que el valor releído puede no ser idéntico al
     * almacenado y el UPDATE no casa nunca. El contador entero distingue a dos
     * dueños aunque ambos vean la fila en vuelo.
     */
    const res = await db
      .update(schema.dispatch)
      .set({
        status: "en_vuelo",
        leasedUntil: new Date(ahora.getTime() + LEASE_MS),
        attempts: fila.attempts + 1,
        updatedAt: ahora,
      })
      .where(
        and(
          eq(schema.dispatch.id, fila.id),
          eq(schema.dispatch.status, fila.status),
          eq(schema.dispatch.attempts, fila.attempts),
          fila.status === "en_vuelo"
            ? lte(schema.dispatch.leasedUntil, ahora)
            : lte(schema.dispatch.notBefore, ahora)
        )
      )
      .returning();
    if (res[0]) tomados.push(res[0]);
  }
  return tomados;
}

/** La fila sigue siendo de quien la tomó. */
function propietario(fila: FilaDespacho) {
  return and(
    eq(schema.dispatch.id, fila.id),
    eq(schema.dispatch.status, "en_vuelo"),
    eq(schema.dispatch.attempts, fila.attempts)
  );
}

export async function renovarLease(fila: FilaDespacho): Promise<boolean> {
  const rows = await getDb()
    .update(schema.dispatch)
    .set({ leasedUntil: new Date(Date.now() + LEASE_MS) })
    .where(propietario(fila))
    .returning({ id: schema.dispatch.id });
  return rows.length === 1;
}

export async function marcarEntregado(fila: FilaDespacho): Promise<boolean> {
  const rows = await getDb()
    .update(schema.dispatch)
    .set({
      status: "entregado",
      leasedUntil: null,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(propietario(fila))
    .returning({ id: schema.dispatch.id });
  return rows.length === 1;
}

/**
 * Reprograma un intento más, o caduca si ya no quedan.
 * Devuelve `true` si caducó (quien llama pasa la conversación a un humano).
 */
export async function reintentarOCaducar(
  fila: FilaDespacho,
  detalle: string,
  ahora: Date = new Date()
): Promise<boolean> {
  if (fila.attempts >= MAX_INTENTOS) return caducarAHumano(fila, detalle);

  const base = esperaDeReintento(fila.attempts);
  // Variación: sin ella, N despachos que fallaron a la vez reintentan a la
  // vez y vuelven a tumbar al cerebro que apenas se levantaba.
  const espera = base + Math.floor(Math.random() * base * 0.3);
  await getDb()
    .update(schema.dispatch)
    .set({
      status: "pendiente",
      notBefore: new Date(ahora.getTime() + espera),
      leasedUntil: null,
      lastError: detalle.slice(0, 300),
      updatedAt: ahora,
    })
    .where(propietario(fila));
  return false;
}

/** Caduca sin más intentos. `true` si la fila era nuestra y quedó caducada. */
export async function caducarAHumano(
  fila: FilaDespacho,
  detalle: string
): Promise<boolean> {
  const rows = await getDb()
    .update(schema.dispatch)
    .set({
      status: "caducado_a_humano",
      leasedUntil: null,
      lastError: detalle.slice(0, 300),
      updatedAt: new Date(),
    })
    .where(propietario(fila))
    .returning({ id: schema.dispatch.id });
  return rows.length === 1;
}

/**
 * El turno ya no debe existir: se pausó la IA durante la ventana, alguien
 * contestó a mano, o la conversación ya no está.
 *
 * No es un fallo del cerebro ni necesita aviso. Por eso no pasa por
 * `caducarAHumano`, que cuenta como caída y pausa la conversación.
 */
export async function descartarDespacho(
  fila: FilaDespacho,
  detalle: string
): Promise<void> {
  await getDb()
    .update(schema.dispatch)
    .set({
      status: "descartado",
      leasedUntil: null,
      lastError: detalle.slice(0, 300),
      updatedAt: new Date(),
    })
    .where(propietario(fila));
}

/**
 * El cerebro no pudo recibir el turno: la conversación pasa a un humano.
 *
 * Es el traspaso que ya existe —el mismo que deja `POST /api/bot/handoff` y el
 * mismo motivo (`error`) que usa un cerebro cuando no puede contestar—, y
 * publica el mismo evento, así que la bandeja lo ve en vivo. Solo escribe en
 * la transición: no pisa la hora ni el motivo de un traspaso anterior.
 */
export async function pasarAHumano(
  organizationId: string,
  conversationId: string
): Promise<void> {
  const ahora = new Date();
  const rows = await getDb()
    .update(schema.conversation)
    .set({
      aiEnabled: false,
      handoffAt: ahora,
      handoffReason: "error",
      updatedAt: ahora,
    })
    .where(
      and(
        eq(schema.conversation.id, conversationId),
        eq(schema.conversation.organizationId, organizationId),
        isNull(schema.conversation.handoffAt)
      )
    )
    .returning({ id: schema.conversation.id });
  if (!rows[0]) return;
  publish(organizationId, {
    type: "conversation.updated",
    data: { conversation: { id: conversationId, handoffReason: "error" } },
  });
}
