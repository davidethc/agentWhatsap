import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { resolveIdentity } from "@/server/inbox/identity";
import {
  isKapsoPayload,
  isValidKapsoSignature,
  kapsoContacts,
  kapsoEnvelopes,
  kapsoEventKind,
  kapsoEventName,
  kapsoInboundContent,
  kapsoOutbound,
  kapsoPhoneNumberId,
  kapsoStatusUpdate,
  kapsoToWebhookMessage,
} from "@/server/inbox/kapso";

const headers = (init?: Record<string, string>) => new Headers(init);

describe("detección del payload de Kapso", () => {
  it("lo reconoce por la cabecera X-Webhook-Event", () => {
    expect(
      isKapsoPayload(
        headers({ "x-webhook-event": "whatsapp.message.received" }),
        { message: {} }
      )
    ).toBe(true);
  });

  it("lo reconoce por el sobre batch", () => {
    expect(isKapsoPayload(headers(), { batch: true, data: [] })).toBe(true);
  });

  it("lo reconoce por message.kapso", () => {
    expect(isKapsoPayload(headers(), { message: { kapso: {} } })).toBe(true);
  });

  it("lo reconoce por phone_number_id + message", () => {
    expect(
      isKapsoPayload(headers(), { phone_number_id: "1", message: { id: "x" } })
    ).toBe(true);
  });

  it("NO confunde un payload de Meta con uno de Kapso", () => {
    const meta = {
      object: "whatsapp_business_account",
      entry: [{ id: "1", changes: [{ field: "messages", value: {} }] }],
    };
    expect(isKapsoPayload(headers(), meta)).toBe(false);
  });
});

describe("firma de Kapso (X-Webhook-Signature)", () => {
  const secret = "kapso-secret-de-prueba";
  const body = JSON.stringify({ message: { id: "wamid.1" } });
  const sign = (key: string) =>
    createHmac("sha256", key).update(body, "utf8").digest("hex");

  it("firma hex válida → pasa", () => {
    expect(isValidKapsoSignature(body, sign(secret), secret)).toBe(true);
  });

  it("acepta el prefijo sha256=", () => {
    expect(isValidKapsoSignature(body, `sha256=${sign(secret)}`, secret)).toBe(
      true
    );
  });

  it("firma inválida → rechaza (la ruta responde 401)", () => {
    expect(isValidKapsoSignature(body, sign("otro"), secret)).toBe(false);
  });

  it("header ausente con secreto configurado → rechaza", () => {
    expect(isValidKapsoSignature(body, null, secret)).toBe(false);
  });

  it("sin secreto configurado la capa está desactivada → pasa", () => {
    expect(isValidKapsoSignature(body, null, undefined)).toBe(true);
  });
});

describe("nombre y tipo de evento", () => {
  it("la cabecera manda sobre el body", () => {
    expect(kapsoEventName("whatsapp.message.sent", { type: "otro" })).toBe(
      "whatsapp.message.sent"
    );
  });

  it("sin cabecera usa body.type (batch)", () => {
    expect(kapsoEventName(null, { type: "whatsapp.message.received" })).toBe(
      "whatsapp.message.received"
    );
  });

  it("normaliza el tipo por el último segmento", () => {
    expect(kapsoEventKind("whatsapp.message.received")).toBe("received");
    expect(kapsoEventKind("whatsapp.message.sent")).toBe("sent");
    expect(kapsoEventKind("whatsapp.message.delivered")).toBe("delivered");
    expect(kapsoEventKind("whatsapp.message.read")).toBe("read");
    expect(kapsoEventKind("whatsapp.message.failed")).toBe("failed");
    expect(kapsoEventKind("whatsapp.conversation.created")).toBe("other");
    expect(kapsoEventKind(null)).toBe("other");
  });
});

describe("aplanado del sobre", () => {
  it("un solo evento → un sobre", () => {
    const items = kapsoEnvelopes({ message: { id: "1" } }, "evt");
    expect(items).toHaveLength(1);
    expect(items[0]?.event).toBe("evt");
  });

  it("batch → un sobre por data[i]", () => {
    const items = kapsoEnvelopes(
      {
        type: "whatsapp.message.received",
        batch: true,
        data: [{ message: { id: "1" } }, { message: { id: "2" } }],
      },
      null
    );
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.event)).toEqual([
      "whatsapp.message.received",
      "whatsapp.message.received",
    ]);
  });
});

describe("phone_number_id", () => {
  it("lo lee de la raíz", () => {
    expect(kapsoPhoneNumberId({ phone_number_id: "123" })).toBe("123");
  });

  it("lo lee de conversation.phone_number_id", () => {
    expect(
      kapsoPhoneNumberId({ conversation: { phone_number_id: "456" } })
    ).toBe("456");
  });

  it("ausente → null", () => {
    expect(kapsoPhoneNumberId({ message: {} })).toBeNull();
  });
});

describe("entrante: identidad y contenido", () => {
  const envelope = {
    phone_number_id: "1347989838397545",
    message: {
      id: "wamid.in.1",
      timestamp: "1699999999",
      type: "text",
      from: "5215550000000",
      from_user_id: "BSUID-1",
      text: { body: "hola" },
      kapso: { direction: "inbound", has_media: false },
    },
    conversation: { contact_name: "Juan Pérez", phone_number: "5215550000000" },
  };

  it("resuelve la identidad por teléfono normalizado", () => {
    const msg = kapsoToWebhookMessage(envelope);
    const resolved = resolveIdentity(msg, kapsoContacts(envelope));
    expect(resolved?.identity).toBe("525550000000");
    expect(resolved?.profileName).toBe("Juan Pérez");
  });

  it("usa el body del texto", () => {
    const msg = kapsoToWebhookMessage(envelope);
    expect(kapsoInboundContent(msg, envelope)).toEqual({
      type: "text",
      text: "hola",
    });
  });

  it("cae a la transcripción en notas de voz", () => {
    const audio = {
      ...envelope,
      message: {
        id: "wamid.in.2",
        timestamp: "1699999999",
        type: "audio",
        from: "5215550000000",
        kapso: { transcript: { text: "quiero una cita" } },
      },
    };
    const msg = kapsoToWebhookMessage(audio);
    expect(kapsoInboundContent(msg, audio)).toEqual({
      type: "audio",
      text: "quiero una cita",
    });
  });

  it("descarta tipos no soportados (reacción)", () => {
    const reaction = {
      ...envelope,
      message: { id: "wamid.in.3", type: "reaction", from: "5215550000000" },
    };
    expect(
      kapsoInboundContent(kapsoToWebhookMessage(reaction), reaction)
    ).toBeNull();
  });

  it("descarta mensajes sin id", () => {
    const sinId = {
      ...envelope,
      message: { type: "text", from: "5215550000000", text: { body: "x" } },
    };
    expect(kapsoInboundContent(kapsoToWebhookMessage(sinId), sinId)).toBeNull();
  });
});

describe("saliente del negocio", () => {
  const base = {
    phone_number_id: "1347989838397545",
    conversation: { phone_number: "5215550000000" },
    message: {
      id: "wamid.out.1",
      timestamp: "1699999999",
      type: "text",
      to: "5215550000000",
      text: { body: "claro que sí" },
      kapso: { direction: "outbound", origin: "cloud_api", status: "sent" },
    },
  };

  it("origin cloud_api → ai, sin pausar la IA", () => {
    const out = kapsoOutbound(base);
    expect(out?.origin).toBe("ai");
    expect(out?.pauseAi).toBe(false);
    expect(out?.to).toBe("5215550000000");
    expect(out?.status).toBe("sent");
    expect(out?.text).toBe("claro que sí");
  });

  it("origin business_app → manual, pausa la IA", () => {
    const app = {
      ...base,
      message: { ...base.message, kapso: { origin: "business_app" } },
    };
    const out = kapsoOutbound(app);
    expect(out?.origin).toBe("manual");
    expect(out?.pauseAi).toBe(true);
  });

  it("toma el destinatario de conversation.phone_number si falta to", () => {
    const sinTo = {
      ...base,
      message: { ...base.message, to: undefined },
    };
    expect(kapsoOutbound(sinTo)?.to).toBe("5215550000000");
  });

  it("sin id → null", () => {
    const sinId = { ...base, message: { ...base.message, id: undefined } };
    expect(kapsoOutbound(sinId)).toBeNull();
  });
});

describe("estados de salida", () => {
  it("traduce delivered/read/failed a WebhookStatus", () => {
    const envelope = {
      message: { id: "wamid.out.9", timestamp: "1700000000" },
    };
    expect(kapsoStatusUpdate(envelope, "read")).toEqual({
      id: "wamid.out.9",
      status: "read",
      timestamp: "1700000000",
    });
  });

  it("sin id → null", () => {
    expect(kapsoStatusUpdate({ message: {} }, "delivered")).toBeNull();
  });
});
