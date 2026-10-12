import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import {
  armarEvento,
  clasificarRespuesta,
  firmarCuerpo,
  CABECERA_DISPATCH,
  CABECERA_FIRMA,
  CABECERA_ORG,
  type EventoDespacho,
  type MensajeParaEvento,
  type ResultadoEntrega,
} from "@/server/brains/contract";
import type { FilaDespacho } from "@/server/dispatch/outbox";
import { WINDOW_MS, isWindowOpen } from "@/server/inbox/window";

/**
 * 021 — Entrega de un despacho al cerebro: leer la ráfaga, armar el evento y
 * hacer el POST firmado. Puerto de `src/server/brains/deliver.ts` de Vocero
 * Cloud sin tipos de cerebro: aquí hay uno, el de `BRAIN_DISPATCH_URL`.
 */

/** Lo que el CRM espera por el 2xx. Significa «recibido», no «ya contesté». */
export const TIMEOUT_ENTREGA_MS = 20_000;

/** Cuántos mensajes hacia atrás se mira para delimitar la ráfaga. */
const VENTANA_DE_MENSAJES = 20;

/**
 * La ráfaga = lo que el cliente dijo y todavía no se le ha respondido.
 *
 * Se delimita por el último mensaje SALIENTE de la conversación, no por las
 * horas del despacho: `first_message_at` se toma después de persistir el
 * mensaje, así que el primero de la ráfaga podía quedar unos milisegundos
 * ANTES y caerse del evento. Delimitar por la conversación es además robusto
 * frente a relojes desalineados.
 */
export async function rafagaDe(
  organizationId: string,
  conversationId: string
): Promise<MensajeParaEvento[]> {
  const db = getDb();
  const filas = await db
    .select({
      id: schema.message.id,
      direction: schema.message.direction,
      type: schema.message.type,
      text: schema.message.text,
      createdAt: schema.message.createdAt,
      waMediaId: schema.mediaAsset.waMediaId,
      mimeType: schema.mediaAsset.mimeType,
      caption: schema.mediaAsset.caption,
      assetId: schema.mediaAsset.id,
    })
    .from(schema.message)
    .leftJoin(
      schema.mediaAsset,
      eq(schema.mediaAsset.id, schema.message.mediaAssetId)
    )
    .where(
      scoped(
        schema.message.organizationId,
        organizationId,
        eq(schema.message.conversationId, conversationId)
      )
    )
    .orderBy(desc(schema.message.createdAt))
    .limit(VENTANA_DE_MENSAJES);

  const ordenados = filas.slice().reverse();
  const ultimaSalida = ordenados.reduce(
    (idx, m, i) => (m.direction === "out" ? i : idx),
    -1
  );
  return ordenados
    .slice(ultimaSalida + 1)
    .filter((m) => m.direction === "in")
    .map((m) => ({
      id: m.id,
      createdAt: m.createdAt,
      type: m.type,
      text: m.text,
      media: m.assetId
        ? { waMediaId: m.waMediaId, mimeType: m.mimeType, caption: m.caption }
        : null,
    }));
}

/**
 * Pura: ¿la ráfaga de ahora trae algo que el evento entregado no llevaba?
 *
 * Un mensaje que entra mientras su despacho está en vuelo no extiende la fila
 * (el cerebro ya tiene el evento), así que al entregar se vuelve a mirar: si
 * hay algo nuevo, se encola otro despacho. Se compara por id y no por hora por
 * lo mismo que el lease: microsegundos contra milisegundos.
 */
export function hayMensajesSinDespachar(
  entregados: readonly string[],
  rafagaActual: readonly { id: string }[]
): boolean {
  const vistos = new Set(entregados);
  return rafagaActual.some((m) => !vistos.has(m.id));
}

/**
 * Arma el evento normalizado desde la base. `null` si ya no hay turno que
 * entregar: la conversación o el contacto no existen, o la ráfaga está vacía
 * (alguien contestó a mano durante la ventana).
 */
export async function construirEvento(
  fila: FilaDespacho
): Promise<EventoDespacho | null> {
  const db = getDb();
  const [conv] = await db
    .select()
    .from(schema.conversation)
    .where(
      scoped(
        schema.conversation.organizationId,
        fila.organizationId,
        eq(schema.conversation.id, fila.conversationId)
      )
    )
    .limit(1);
  if (!conv) return null;

  const [org] = await db
    .select({ id: schema.organization.id, slug: schema.organization.slug })
    .from(schema.organization)
    .where(eq(schema.organization.id, fila.organizationId))
    .limit(1);
  if (!org) return null;

  const [contact] = await db
    .select()
    .from(schema.contact)
    .where(
      scoped(
        schema.contact.organizationId,
        fila.organizationId,
        eq(schema.contact.id, conv.contactId)
      )
    )
    .limit(1);
  if (!contact) return null;

  const messages = await rafagaDe(fila.organizationId, conv.id);
  if (messages.length === 0) return null;

  return armarEvento({
    dispatchId: fila.id,
    organization: org,
    conversation: {
      id: conv.id,
      channel: conv.channel,
      aiEnabled: conv.aiEnabled,
      windowOpen: isWindowOpen(conv.lastInboundAt),
      windowExpiresAt: conv.lastInboundAt
        ? new Date(conv.lastInboundAt.getTime() + WINDOW_MS)
        : null,
    },
    contact: {
      id: contact.id,
      displayName: contact.name,
      identity: contact.waIdentity,
    },
    messages,
    firstMessageAt: fila.firstMessageAt,
    lastMessageAt: fila.lastMessageAt,
  });
}

/**
 * El POST firmado.
 *
 * Se serializa UNA vez y se firma ese string: firmar un objeto re-serializado
 * produciría una firma que el otro lado no puede reproducir. No se siguen
 * redirecciones —un cerebro no redirige, y seguirlas sería mandarle el turno a
 * donde diga otro—, y ni el cuerpo ni la llave llegan a un log.
 */
export async function entregar(
  evento: EventoDespacho,
  destino: { url: string; secret: string },
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}
): Promise<ResultadoEntrega> {
  const cuerpo = JSON.stringify(evento);
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? TIMEOUT_ENTREGA_MS
  );
  try {
    const res = await (opts.fetchImpl ?? fetch)(destino.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [CABECERA_FIRMA]: firmarCuerpo(cuerpo, destino.secret),
        [CABECERA_DISPATCH]: evento.dispatchId,
        [CABECERA_ORG]: evento.organization.slug ?? evento.organization.id,
      },
      redirect: "manual",
      cache: "no-store",
      body: cuerpo,
      signal: controller.signal,
    });
    await res.body?.cancel().catch(() => {});
    return clasificarRespuesta(res.status);
  } catch {
    // Sin respuesta a tiempo, nombre que no resuelve, conexión rechazada:
    // todo reintentable. El cerebro puede estar reiniciándose.
    return {
      ok: false,
      reintentable: true,
      detalle: controller.signal.aborted
        ? `el cerebro no contestó en ${Math.round((opts.timeoutMs ?? TIMEOUT_ENTREGA_MS) / 1000)} s`
        : "no se pudo conectar con el cerebro",
    };
  } finally {
    clearTimeout(timer);
  }
}
