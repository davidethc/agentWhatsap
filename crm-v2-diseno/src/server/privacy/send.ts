import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { assertAiEpoch, contentAvailable, PrivacyError } from "./policy";
import { withConversationLock } from "./service";

/** Una intención se confirma ANTES del transporte. Si el proceso cae después
 * de enviar pero antes del acuse, queda pendiente y no se reenvía a ciegas.
 * El proveedor no ofrece exactamente-una-vez: resultado incierto exige revisar.
 */
export async function acceptConversationSend<T extends { messageId: string }>(input: {
  organizationId: string; conversationId: string; aiGenerated?: boolean;
  expectedEpoch?: number; idempotencyKey?: string;
}, send: () => Promise<T>): Promise<T> {
  const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const intent = await withConversationLock(input.organizationId, input.conversationId, async c => {
    if (!contentAvailable(c)) throw new PrivacyError("not_found");
    if (input.aiGenerated) assertAiEpoch(c, input.expectedEpoch);
    else if (c.aiEnabled) throw new PrivacyError("human_control_required");
    const key = input.idempotencyKey ?? `auto:${c.controlEpoch}:${c.lastInboundAt?.getTime()}:${requestHash}`;
    const [receipt] = await getDb().select().from(schema.outboundReceipt).where(scoped(schema.outboundReceipt.organizationId, input.organizationId,
      eq(schema.outboundReceipt.conversationId, input.conversationId), eq(schema.outboundReceipt.key, key))).limit(1);
    if (receipt) {
      if (receipt.epoch !== c.controlEpoch) throw new PrivacyError("stale_epoch");
      if (receipt.requestHash !== requestHash) throw new PrivacyError("idempotency_conflict");
      if (receipt.status !== "sent" || !receipt.messageId) throw new PrivacyError(receipt.status === "uncertain" ? "send_uncertain" : "send_pending");
      return { replay: receipt.messageId, id: receipt.id, epoch: receipt.epoch };
    }
    const id = randomUUID();
    await getDb().insert(schema.outboundReceipt).values({ id, organizationId: input.organizationId, conversationId: input.conversationId,
      epoch: c.controlEpoch, key, requestHash, status: "pending" });
    return { replay: null, id, epoch: c.controlEpoch };
  });
  if (intent.replay) return { messageId: intent.replay } as T;
  try {
    return await withConversationLock(input.organizationId, input.conversationId, async c => {
      if (!contentAvailable(c)) throw new PrivacyError("not_found");
      if (c.controlEpoch !== intent.epoch) throw new PrivacyError("stale_epoch");
      if (input.aiGenerated) assertAiEpoch(c, input.expectedEpoch);
      const result = await send();
      await getDb().update(schema.outboundReceipt).set({ status: "sent", messageId: result.messageId })
        .where(scoped(schema.outboundReceipt.organizationId, input.organizationId, eq(schema.outboundReceipt.id, intent.id)));
      return result;
    });
  } catch (err) {
    await getDb().update(schema.outboundReceipt).set({ status: "uncertain" })
      .where(scoped(schema.outboundReceipt.organizationId, input.organizationId, eq(schema.outboundReceipt.id, intent.id)));
    throw err;
  }
}
