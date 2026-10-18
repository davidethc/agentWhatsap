import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { availableContent } from "./service";
export async function mediaContentAvailable(org: string, assetId: string): Promise<boolean> {
  const db = getDb();
  const [message] = await db.select({ id: schema.message.id }).from(schema.message)
    .innerJoin(schema.conversation, and(eq(schema.message.conversationId, schema.conversation.id), eq(schema.message.organizationId, schema.conversation.organizationId)))
    .where(scoped(schema.message.organizationId, org, eq(schema.message.mediaAssetId, assetId), availableContent())).limit(1);
  if (message) return true;
  const [ad] = await db.select({ id: schema.adAttribution.id }).from(schema.adAttribution)
    .innerJoin(schema.conversation, and(eq(schema.adAttribution.conversationId, schema.conversation.id), eq(schema.adAttribution.organizationId, schema.conversation.organizationId)))
    .where(scoped(schema.adAttribution.organizationId, org, eq(schema.adAttribution.imageAssetId, assetId), availableContent())).limit(1);
  return Boolean(ad);
}
