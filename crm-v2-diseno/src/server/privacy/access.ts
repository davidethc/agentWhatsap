import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { SessionContext } from "@/lib/auth/session";

/** Se consulta en cada petición; owner/admin no implica concesión operativa. */
export async function hasOperationalAccess(session: Pick<SessionContext, "userId" | "organizationId">): Promise<boolean> {
  const [grant] = await getDb().select({ id: schema.operationalGrant.id })
    .from(schema.operationalGrant).innerJoin(schema.member, and(
      eq(schema.member.organizationId, schema.operationalGrant.organizationId),
      eq(schema.member.userId, schema.operationalGrant.userId)))
    .where(and(eq(schema.operationalGrant.organizationId, session.organizationId), eq(schema.operationalGrant.userId, session.userId))).limit(1);
  return Boolean(grant);
}
