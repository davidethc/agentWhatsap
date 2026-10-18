import { publish } from "@/server/events/bus";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { getDb, inDbTransaction, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { contentAvailable, PrivacyError } from "./policy";

export const availableContent = () => and(
  isNull(schema.conversation.contentDeletedAt),
  sql`coalesce(${schema.conversation.lastMessageAt}, ${schema.conversation.createdAt}) + interval '90 days' > now()`
);

/** Bloqueo compartido por ingesta, aceptación de envío, pausa y borrado.
 * Nunca incluye generación LLM. El transporte se mantiene dentro de esta
 * sección para ordenar su aceptación frente al acuse de tomar/borrar.
 */
export async function withConversationLock<T>(org: string, id: string, action: (conversation: typeof schema.conversation.$inferSelect) => Promise<T>): Promise<T> {
  const effects: (() => void)[] = [];
  const result = await getDb().transaction(async tx => inDbTransaction(tx, async () => {
    const [c] = await tx.select().from(schema.conversation)
      .where(scoped(schema.conversation.organizationId, org, eq(schema.conversation.id, id))).for("update").limit(1);
    if (!c) throw new PrivacyError("not_found");
    return action(c);
  }, effects));
  for (const effect of effects) effect();
  return result;
}

async function audit(org: string, id: string, action: string, actor: string | null) {
  await getDb().insert(schema.privacyAudit).values({ id: randomUUID(), organizationId: org, conversationId: id, actorUserId: actor, action });
}

async function cancelJobs(org: string, id: string) {
  await getDb().update(schema.dispatch).set({ status: "descartado", leasedUntil: null, lastError: null, updatedAt: new Date() })
    .where(scoped(schema.dispatch.organizationId, org, eq(schema.dispatch.conversationId, id), inArray(schema.dispatch.status, ["pendiente", "en_vuelo"])));
}

export async function setConversationControl(org: string, id: string, enabled: boolean, actor: string) {
  return withConversationLock(org, id, async c => {
    if (!contentAvailable(c)) throw new PrivacyError("not_found");
    // Repetir la misma intención es idempotente; devolver limpia el handoff.
    if (c.aiEnabled === enabled && (!enabled || !c.handoffAt)) return c;
    const [updated] = await getDb().update(schema.conversation).set({ aiEnabled: enabled,
      handoffAt: enabled ? null : new Date(), handoffReason: null,
      controlEpoch: c.controlEpoch + 1, updatedAt: new Date() })
      .where(scoped(schema.conversation.organizationId, org, eq(schema.conversation.id, id))).returning();
    await cancelJobs(org, id);
    await audit(org, id, enabled ? "returned_to_eli" : "taken_by_doctor", actor);
    return updated!;
  });
}

/** Oculta en el commit del 202; la purga queda persistida, reanudable. */
export async function requestContentDeletion(org: string, id: string, actor: string | null) {
  return withConversationLock(org, id, async c => {
    if (c.contentDeletedAt) return;
    await getDb().update(schema.conversation).set({ contentDeletedAt: new Date(), contentPurgePending: true,
      controlEpoch: c.controlEpoch + 1, aiEnabled: false, handoffAt: new Date(), handoffReason: null, unreadCount: 0, updatedAt: new Date() })
      .where(scoped(schema.conversation.organizationId, org, eq(schema.conversation.id, id)));
    await cancelJobs(org, id);
    await audit(org, id, actor ? "deletion_requested" : "retention_expired", actor);
  });
}

/** Se llama con el bloqueo tomado. No borra contacto, ficha, lead ni citas. */
export async function purgeLocked(c: typeof schema.conversation.$inferSelect): Promise<void> {
  const db = getDb(); const org = c.organizationId; const id = c.id;
  const messages = await db.select().from(schema.message).where(scoped(schema.message.organizationId, org, eq(schema.message.conversationId, id)));
  for (const m of messages) {
    if (m.waMessageId) await db.insert(schema.messageReceipt).values({ id: randomUUID(), organizationId: org, waMessageId: m.waMessageId }).onConflictDoNothing();
  }
  const ads = await db.select({ assetId: schema.adAttribution.imageAssetId }).from(schema.adAttribution).where(scoped(schema.adAttribution.organizationId, org, eq(schema.adAttribution.conversationId, id)));
  const assetIds = [...new Set([...messages.map(m => m.mediaAssetId), ...ads.map(a => a.assetId)].filter((id): id is string => Boolean(id)))];
  // El anuncio y su raw pertenecen a esta generación de contenido.
  await db.delete(schema.adAttribution).where(scoped(schema.adAttribution.organizationId, org, eq(schema.adAttribution.conversationId, id)));
  await db.delete(schema.message).where(scoped(schema.message.organizationId, org, eq(schema.message.conversationId, id)));
  for (const assetId of assetIds) {
    const [shared] = await db.select({ id: schema.message.id }).from(schema.message).where(scoped(schema.message.organizationId, org, eq(schema.message.mediaAssetId, assetId))).limit(1);
    const [sharedAd] = await db.select({ id: schema.adAttribution.id }).from(schema.adAttribution).where(scoped(schema.adAttribution.organizationId, org, eq(schema.adAttribution.imageAssetId, assetId))).limit(1);
    if (shared || sharedAd) continue;
    await db.insert(schema.mediaPurgeJob).values({ id: randomUUID(), organizationId: org, assetId }).onConflictDoNothing();
    await db.delete(schema.mediaAsset).where(scoped(schema.mediaAsset.organizationId, org, eq(schema.mediaAsset.id, assetId)));
  }
  await db.update(schema.agentTestCase).set({ transcript: null, hallazgos: null }).where(scoped(schema.agentTestCase.organizationId, org, eq(schema.agentTestCase.conversationId, id)));
  await db.delete(schema.outboundReceipt).where(scoped(schema.outboundReceipt.organizationId, org, eq(schema.outboundReceipt.conversationId, id)));
  await db.delete(schema.offeredSlot).where(scoped(schema.offeredSlot.organizationId, org, eq(schema.offeredSlot.conversationId, id)));
  await cancelJobs(org, id);
  await db.update(schema.conversation).set({ contentPurgePending: false, handoffReason: null, unreadCount: 0 })
    .where(scoped(schema.conversation.organizationId, org, eq(schema.conversation.id, id)));
}

/** Antes de cualquier nuevo entrante: jamás prorrogar contenido ya vencido. */
export async function prepareInbound(c: typeof schema.conversation.$inferSelect, waMessageId: string, timestamp: Date): Promise<boolean> {
  const db = getDb(); const org = c.organizationId;
  const [receipt] = await db.select({ id: schema.messageReceipt.id }).from(schema.messageReceipt)
    .where(scoped(schema.messageReceipt.organizationId, org, eq(schema.messageReceipt.waMessageId, waMessageId))).limit(1);
  if (receipt) return false;
  // Un webhook viejo no revive un borrado ni amplía una ventana de conservación.
  if (timestamp.getTime() <= Date.now() - 90 * 86400000 || (c.contentDeletedAt && timestamp <= c.contentDeletedAt)) return false;
  if (!contentAvailable(c)) {
    await purgeLocked(c);
    const [again] = await db.select({ id: schema.messageReceipt.id }).from(schema.messageReceipt)
      .where(scoped(schema.messageReceipt.organizationId, org, eq(schema.messageReceipt.waMessageId, waMessageId))).limit(1);
    if (again) return false;
    await db.update(schema.conversation).set({ contentDeletedAt: null, contentPurgePending: false, controlEpoch: c.controlEpoch + 1 })
      .where(scoped(schema.conversation.organizationId, org, eq(schema.conversation.id, c.id)));
    await audit(org, c.id, "new_content_generation", null);
  }
  return true;
}

export async function purgeExpiredContent(): Promise<number> {
  const db = getDb();
  const rows = await db.select().from(schema.conversation).where(or(eq(schema.conversation.contentPurgePending, true), and(isNull(schema.conversation.contentDeletedAt), lte(sql`coalesce(${schema.conversation.lastMessageAt}, ${schema.conversation.createdAt}) + interval '90 days'`, sql`now()`)))).limit(100);
  for (const c of rows) {
    await withConversationLock(c.organizationId, c.id, async current => {
      // Revalidar tras esperar el bloqueo: una actividad reciente puede haber ganado.
      if (contentAvailable(current)) return;
      if (!current.contentDeletedAt) {
        await getDb().update(schema.conversation).set({ contentDeletedAt: new Date(), controlEpoch: current.controlEpoch + 1, aiEnabled: false, contentPurgePending: true })
          .where(scoped(schema.conversation.organizationId, current.organizationId, eq(schema.conversation.id, current.id)));
        await audit(current.organizationId, current.id, "retention_expired", null);
      }
      await purgeLocked(current);
    });
    publish(c.organizationId, { type: "conversation.updated", data: { conversation: { id: c.id } } });
  }
  return rows.length;
}
