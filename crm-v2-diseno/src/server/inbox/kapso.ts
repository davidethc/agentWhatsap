import { createHmac } from "node:crypto";
import { anuncioDeWhatsapp } from "@/server/attribution/referral";
import {
  contenidoEntrante,
  ingestInboundMessage,
  ingestOutboundMessage,
} from "@/server/inbox/ingest";
import { resolveIdentity } from "@/server/inbox/identity";
import { applyStatusUpdate } from "@/server/inbox/status";
import {
  safeEqual,
  type WebhookMessage,
  type WebhookStatus,
  type WebhookValue,
} from "@/server/inbox/webhook";
import { getCredentialsByPhoneNumberId } from "@/server/whatsapp/credentials";

/**
 * Adaptador de los webhooks de Kapso (proveedor BSP de WhatsApp).
 *
 * Kapso entrega, por la misma URL que Meta, un payload v2 propio (cabecera
 * X-Webhook-Event / X-Webhook-Payload-Version) con su propia firma. El CRM ya
 * habla el dialecto de Meta (`inbox/ingest.ts`): aquí se traduce Kapso a los
 * tipos de Meta y se reutiliza toda la ingesta. Reglas:
 *
 * - Solo se procesan eventos del `phone_number_id` con credenciales guardadas
 *   (mismo enrutado por número que el webhook de Meta); los demás se ignoran.
 * - La idempotencia es la de siempre: `wa_message_id` UNIQUE.
 * - La firma (X-Webhook-Signature, HMAC-SHA256 hex del body crudo) solo se
 *   exige si hay `KAPSO_WEBHOOK_SECRET`.
 *
 * Este módulo mantiene las funciones puras (detección, traducción, firma)
 * separadas de los efectos en BD para poder probarlas sin base de datos.
 */

/* ---------- Detección y lectura del sobre ---------- */

type KapsoRecord = Record<string, unknown>;

function asRecord(value: unknown): KapsoRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as KapsoRecord)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Un request es de Kapso si trae su cabecera o su cuerpo v2 reconocible. */
export function isKapsoPayload(headers: Headers, body: unknown): boolean {
  if (headers.get("x-webhook-event")) return true;
  const obj = asRecord(body);
  if (!obj) return false;
  if (obj.batch === true || obj.batch_info) return true;
  const message = asRecord(obj.message);
  const conversation = asRecord(obj.conversation);
  if (message?.kapso || conversation?.kapso) return true;
  if (obj.phone_number_id && (message || conversation)) return true;
  return false;
}

/**
 * Capa 2 de Kapso: firma HMAC-SHA256 hex del body crudo. Acepta el valor
 * crudo o con prefijo `sha256=`. Devuelve true si no hay secreto configurado.
 */
export function isValidKapsoSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string | undefined
): boolean {
  if (!secret) return true;
  if (!signatureHeader) return false;
  const provided = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice("sha256=".length)
    : signatureHeader;
  const expected = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");
  return safeEqual(provided.toLowerCase(), expected);
}

/** Nombre del evento: la cabecera manda; el body (batch) sirve de respaldo. */
export function kapsoEventName(
  headerEvent: string | null,
  body: unknown
): string | null {
  if (headerEvent) return headerEvent;
  return asString(asRecord(body)?.type);
}

export type KapsoEventKind =
  | "received"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "other";

/** `whatsapp.message.received` → "received". Desconocidos → "other". */
export function kapsoEventKind(event: string | null): KapsoEventKind {
  const tail = event?.split(".").pop()?.toLowerCase();
  switch (tail) {
    case "received":
      return "received";
    case "sent":
      return "sent";
    case "delivered":
      return "delivered";
    case "read":
      return "read";
    case "failed":
      return "failed";
    default:
      return "other";
  }
}

/**
 * Aplana el payload (buffered o `batch: true`) en sobres individuales. En un
 * batch, cada `data[i]` es la forma unbuffered y el evento viene en `type`.
 */
export function kapsoEnvelopes(
  body: unknown,
  headerEvent: string | null
): { event: string | null; envelope: KapsoRecord }[] {
  const obj = asRecord(body);
  if (!obj) return [];
  if (obj.batch === true && Array.isArray(obj.data)) {
    const event = kapsoEventName(headerEvent, obj);
    return obj.data
      .map(asRecord)
      .filter((e): e is KapsoRecord => e !== null)
      .map((envelope) => ({ event, envelope }));
  }
  return [{ event: kapsoEventName(headerEvent, obj), envelope: obj }];
}

/** El `phone_number_id` puede venir en la raíz o dentro de message/conversation. */
export function kapsoPhoneNumberId(envelope: KapsoRecord): string | null {
  const message = asRecord(envelope.message);
  const conversation = asRecord(envelope.conversation);
  return (
    asString(envelope.phone_number_id) ??
    asString(asRecord(message?.kapso)?.phone_number_id) ??
    asString(conversation?.phone_number_id)
  );
}

function kapsoDirection(envelope: KapsoRecord): "inbound" | "outbound" | null {
  const dir = asString(asRecord(asRecord(envelope.message)?.kapso)?.direction);
  if (dir === "inbound" || dir === "outbound") return dir;
  return null;
}

/* ---------- Traducción a los tipos de Meta ---------- */

/** El mensaje de Kapso, reinterpretado como el `WebhookMessage` de Meta. */
export function kapsoToWebhookMessage(envelope: KapsoRecord): WebhookMessage {
  const m = asRecord(envelope.message) ?? {};
  return {
    id: asString(m.id) ?? "",
    timestamp: asString(m.timestamp) ?? String(m.timestamp ?? ""),
    type: asString(m.type) ?? "text",
    from: asString(m.from) ?? undefined,
    from_user_id: asString(m.from_user_id) ?? undefined,
    to: asString(m.to) ?? undefined,
    text: asRecord(m.text) as WebhookMessage["text"],
    image: m.image as WebhookMessage["image"],
    video: m.video as WebhookMessage["video"],
    audio: m.audio as WebhookMessage["audio"],
    document: m.document as WebhookMessage["document"],
    sticker: m.sticker as WebhookMessage["sticker"],
    location: m.location as WebhookMessage["location"],
    contacts: Array.isArray(m.contacts) ? m.contacts : undefined,
    button: m.button as WebhookMessage["button"],
    interactive: m.interactive as WebhookMessage["interactive"],
    context: m.context as WebhookMessage["context"],
    referral: m.referral as WebhookMessage["referral"],
  };
}

/** La forma `contacts[]` que espera `resolveIdentity`, con el nombre del hilo. */
export function kapsoContacts(envelope: KapsoRecord): WebhookValue["contacts"] {
  const m = asRecord(envelope.message) ?? {};
  const conversation = asRecord(envelope.conversation) ?? {};
  const from = asString(m.from);
  const userId = asString(m.from_user_id);
  if (!from && !userId) return undefined;
  const name = asString(conversation.contact_name);
  return [
    { profile: name ? { name } : undefined, wa_id: from ?? undefined, user_id: userId ?? undefined },
  ];
}

const SUPPORTED_TYPES = new Set([
  "text",
  "image",
  "audio",
  "video",
  "document",
  "sticker",
  "location",
  "contacts",
  "button",
  "interactive",
]);

/**
 * Contenido del entrante, tolerando que el texto venga en `body`, en el pie de
 * un adjunto (`caption`) o en la transcripción de una nota de voz. Devuelve
 * null para tipos no soportados (reacciones, sistema…) o mensajes sin id.
 */
export function kapsoInboundContent(
  msg: WebhookMessage,
  envelope: KapsoRecord
): { type: string; text: string | null } | null {
  if (!msg.id || !SUPPORTED_TYPES.has(msg.type)) return null;
  const contenido = contenidoEntrante(msg);
  if (!contenido) return null;
  if (contenido.text) return contenido;

  const m = asRecord(envelope.message) ?? {};
  const kapso = asRecord(m.kapso) ?? {};
  const typeData = asRecord(kapso.message_type_data) ?? {};
  const media = asRecord(m[msg.type]);
  const fallback =
    asString(media?.caption) ??
    asString(typeData.caption) ??
    asString(asRecord(kapso.transcript)?.text) ??
    asString(kapso.content);
  return { type: contenido.type, text: fallback };
}

export type KapsoOutbound = {
  to: string;
  waMessageId: string;
  type: string;
  text: string | null;
  timestamp: string;
  status: "sent" | "delivered" | "read" | "failed";
  origin: "ai" | "operator" | "manual" | "template";
  pauseAi: boolean;
};

/**
 * Traduce un saliente del negocio (`whatsapp.message.sent`). `business_app`
 * es un envío a mano desde el teléfono (equivalente al echo de Meta): entra
 * como `manual` y pausa la IA; el resto son envíos por API → `ai`.
 */
export function kapsoOutbound(envelope: KapsoRecord): KapsoOutbound | null {
  const m = asRecord(envelope.message) ?? {};
  const conversation = asRecord(envelope.conversation) ?? {};
  const kapso = asRecord(m.kapso) ?? {};
  const id = asString(m.id);
  const to = asString(m.to) ?? asString(conversation.phone_number);
  if (!id || !to) return null;

  const type = asString(m.type) ?? "text";
  const typeData = asRecord(kapso.message_type_data) ?? {};
  const media = asRecord(m[type]);
  const text =
    asString(asRecord(m.text)?.body) ??
    asString(media?.caption) ??
    asString(typeData.caption) ??
    asString(asRecord(kapso.transcript)?.text) ??
    null;

  const origin = asString(kapso.origin) === "business_app" ? "manual" : "ai";
  const kstatus = asString(kapso.status);
  const status: KapsoOutbound["status"] =
    kstatus === "delivered" || kstatus === "read" || kstatus === "failed"
      ? kstatus
      : "sent";

  return {
    to,
    waMessageId: id,
    type,
    text,
    timestamp: asString(m.timestamp) ?? String(m.timestamp ?? ""),
    status,
    origin,
    pauseAi: origin === "manual",
  };
}

/** Traduce `delivered`/`read`/`failed` al `WebhookStatus` de la ingesta. */
export function kapsoStatusUpdate(
  envelope: KapsoRecord,
  kind: "delivered" | "read" | "failed"
): WebhookStatus | null {
  const m = asRecord(envelope.message) ?? {};
  const id = asString(m.id);
  if (!id) return null;
  return {
    id,
    status: kind,
    timestamp: asString(m.timestamp) ?? String(m.timestamp ?? ""),
  };
}

/* ---------- Efectos en BD ---------- */

/** Procesa un payload de Kapso completo (un evento o un batch). */
export async function processKapsoPayload(
  body: unknown,
  headerEvent: string | null
): Promise<void> {
  for (const { event, envelope } of kapsoEnvelopes(body, headerEvent)) {
    await processKapsoEnvelope(event, envelope);
  }
}

async function processKapsoEnvelope(
  event: string | null,
  envelope: KapsoRecord
): Promise<void> {
  const phoneNumberId = kapsoPhoneNumberId(envelope);
  if (!phoneNumberId) {
    console.warn("[kapso] evento sin phone_number_id: descartado");
    return;
  }

  const credentials = await getCredentialsByPhoneNumberId(phoneNumberId);
  if (!credentials) {
    console.warn(
      `[kapso] evento para phone_number_id desconocido (${phoneNumberId}): descartado`
    );
    return;
  }
  const organizationId = credentials.organizationId;

  const kind = kapsoEventKind(event);
  if (kind === "received") {
    await ingestKapsoInbound(organizationId, envelope);
    return;
  }
  if (kind === "sent") {
    await ingestKapsoOutbound(organizationId, envelope);
    return;
  }
  if (kind === "delivered" || kind === "read" || kind === "failed") {
    const status = kapsoStatusUpdate(envelope, kind);
    if (status) await applyStatusUpdate(organizationId, status);
    return;
  }

  // Evento sin nombre reconocible: se deduce del sentido del mensaje.
  const direction = kapsoDirection(envelope);
  if (direction === "outbound") await ingestKapsoOutbound(organizationId, envelope);
  else if (direction === "inbound") await ingestKapsoInbound(organizationId, envelope);
  // conversation.*, contact.*, thread.*: ignorar sin error.
}

async function ingestKapsoInbound(
  organizationId: string,
  envelope: KapsoRecord
): Promise<void> {
  const msg = kapsoToWebhookMessage(envelope);
  const contenido = kapsoInboundContent(msg, envelope);
  if (!contenido) {
    console.warn(`[kapso] entrante ${msg.id || "(sin id)"} no soportado: descartado`);
    return;
  }
  const resolved = resolveIdentity(msg, kapsoContacts(envelope));
  if (!resolved) {
    console.warn(`[kapso] entrante ${msg.id} sin identidad utilizable: descartado`);
    return;
  }
  await ingestInboundMessage({
    organizationId,
    identity: resolved,
    waMessageId: msg.id,
    type: contenido.type,
    text: contenido.text,
    timestamp: msg.timestamp,
    // Los adjuntos de Kapso llegan como media_url remota; copiarlos al volumen
    // (mismo modelo que Meta) queda pendiente: por ahora el mensaje entra sin
    // binario, conservando pie/transcripción como texto.
    media: null,
    anuncio: anuncioDeWhatsapp(msg.referral),
  });
}

async function ingestKapsoOutbound(
  organizationId: string,
  envelope: KapsoRecord
): Promise<void> {
  const out = kapsoOutbound(envelope);
  if (!out) {
    console.warn("[kapso] saliente sin id o destinatario: descartado");
    return;
  }
  await ingestOutboundMessage({ organizationId, ...out, media: null });
}
