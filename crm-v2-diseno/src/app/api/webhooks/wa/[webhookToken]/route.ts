import { after } from "next/server";
import { getEnv } from "@/lib/env";
import {
  isValidSignature,
  isValidWebhookToken,
  type WebhookPayload,
} from "@/server/inbox/webhook";
import {
  isKapsoPayload,
  isValidKapsoSignature,
  processKapsoPayload,
} from "@/server/inbox/kapso";
import { processEchoesValue, processMessagesValue } from "@/server/inbox/ingest";
import { processTemplateStatusValue } from "@/server/whatsapp/template-events";

/**
 * Webhook público de WhatsApp (contrato webhook.md).
 * Capa 1: el segmento [webhookToken] debe coincidir (si no → 404 sin efectos).
 * Capa 2: firma x-hub-signature-256 solo si META_APP_SECRET está configurado.
 * El POST siempre responde 200 tras validar; el procesamiento va en after().
 *
 * Además del payload de Meta, esta misma URL acepta los webhooks v2 de Kapso
 * (proveedor BSP): se reconocen por su cabecera X-Webhook-Event y su firma se
 * valida con KAPSO_WEBHOOK_SECRET (opcional). Se traducen a la ingesta común.
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ webhookToken: string }> };

export async function GET(req: Request, { params }: Params) {
  const { webhookToken } = await params;
  const env = getEnv();
  if (!isValidWebhookToken(webhookToken, env.META_WEBHOOK_VERIFY_TOKEN)) {
    return new Response(null, { status: 404 });
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === env.META_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response(null, { status: 403 });
}

export async function POST(req: Request, { params }: Params) {
  const { webhookToken } = await params;
  const env = getEnv();
  if (!isValidWebhookToken(webhookToken, env.META_WEBHOOK_VERIFY_TOKEN)) {
    return new Response(null, { status: 404 });
  }

  const rawBody = await req.text();

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    parsed = null;
  }

  // Kapso primero: trae su propia firma, que no coincide con la de Meta.
  if (parsed !== null && isKapsoPayload(req.headers, parsed)) {
    const ok = isValidKapsoSignature(
      rawBody,
      req.headers.get("x-webhook-signature"),
      env.KAPSO_WEBHOOK_SECRET
    );
    if (!ok) return new Response(null, { status: 401 });

    const eventHeader = req.headers.get("x-webhook-event");
    after(async () => {
      try {
        await processKapsoPayload(parsed, eventHeader);
      } catch (err) {
        console.error("[kapso] error procesando payload:", err);
      }
    });
    return Response.json({ received: true });
  }

  const signature = req.headers.get("x-hub-signature-256");
  if (!isValidSignature(rawBody, signature, env.META_APP_SECRET)) {
    return new Response(null, { status: 401 });
  }

  if (parsed === null) {
    // body ilegible: 200 igualmente (Meta reintenta y termina desactivando)
    return Response.json({ received: true });
  }
  const payload = parsed as WebhookPayload;

  after(async () => {
    try {
      await processPayload(payload);
    } catch (err) {
      console.error("[webhook] error procesando payload:", err);
    }
  });

  return Response.json({ received: true });
}

async function processPayload(payload: WebhookPayload): Promise<void> {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (!change.value) continue;
      if (change.field === "messages") {
        await processMessagesValue(change.value);
      } else if (change.field === "smb_message_echoes") {
        // 008: mensajes enviados a mano desde la app del teléfono (coexistence)
        await processEchoesValue(change.value);
      } else if (change.field === "message_template_status_update") {
        await processTemplateStatusValue(entry.id ?? null, change.value);
      }
      // otros fields: ignorar sin error
    }
  }
}
