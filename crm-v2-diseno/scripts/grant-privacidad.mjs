#!/usr/bin/env node
/** Ejecutar con DATABASE_URL explícita; no carga .env ni concede por rol técnico. */
import postgres from "postgres";
import { randomUUID } from "node:crypto";
const [organizationId, userId, mode = "grant"] = process.argv.slice(2);
if (!organizationId || !userId || !["grant", "revoke"].includes(mode) || !process.env.DATABASE_URL) {
  console.error("Uso: DATABASE_URL=… node scripts/grant-privacidad.mjs <orgId> <userId> [grant|revoke]"); process.exit(1);
}
const schema = process.env.DATABASE_SCHEMA || "public";
if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) throw new Error("DATABASE_SCHEMA inválido");
const db = postgres(process.env.DATABASE_URL, { max: 1, connection: { TimeZone: "UTC", search_path: schema } });
try {
  await db.begin(async tx => {
    const members = await tx`select id from member where organization_id=${organizationId} and user_id=${userId}`;
    if (!members.length) throw new Error("El usuario no pertenece a esa organización");
    if (mode === "grant") await tx`insert into operational_grant(id, organization_id, user_id) values (${randomUUID()},${organizationId},${userId}) on conflict do nothing`;
    else await tx`delete from operational_grant where organization_id=${organizationId} and user_id=${userId}`;
    await tx`insert into privacy_audit(id, organization_id, actor_user_id, action) values (${randomUUID()},${organizationId},${userId},${mode === "grant" ? "operational_grant_local" : "operational_revoke_local"})`;
  });
  console.log("Concesión operativa actualizada");
} catch { console.error("No se pudo actualizar la concesión operativa"); process.exitCode = 1; }
finally { await db.end(); }
