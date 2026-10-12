/**
 * Conectar un número de WhatsApp para SOLO RECEPCIÓN, sin credencial de envío.
 *
 * Deja la fila de `meta_credentials` que enruta el webhook por
 * `phone_number_id`, pero con el token VACÍO: el CRM registra los mensajes
 * entrantes y NO puede enviar (quien responde es un cerebro externo —Eli en
 * n8n— por su propio proveedor). También apaga el agente incluido
 * (`agent_profile.enabled = false`) para que no compita por la respuesta.
 *
 * No valida contra Meta ni registra el webhook: eso lo hace el proveedor
 * (Kapso). Usa la MISMA capa de servicio que la UI de Ajustes
 * (`saveCredentials`), así el token se cifra con los helpers del CRM.
 *
 * Uso:
 *   WABA_ID='...' pnpm canal:conectar <phone_number_id>
 */
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { getCredentialsByOrg, saveCredentials } from "@/server/whatsapp/credentials";

const phoneNumberId = (process.argv[2] ?? "").trim();
if (!phoneNumberId) {
  console.error(
    "Falta el phone_number_id.\n  WABA_ID='...' pnpm canal:conectar <phone_number_id>"
  );
  process.exit(1);
}

const db = getDb();

// Organización: la de la instancia (una sola) o `ORG_ID` si hubiera varias.
let organizationId = process.env.ORG_ID?.trim() || "";
if (!organizationId) {
  const orgs = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .limit(2);
  if (orgs.length === 0) {
    console.error(
      "No hay organización en la instancia. Crea el acceso primero (pnpm acceso:crear)."
    );
    process.exit(1);
  }
  if (orgs.length > 1) {
    console.error("Hay más de una organización: indica ORG_ID='...'.");
    process.exit(1);
  }
  organizationId = orgs[0].id;
}

const wabaId = process.env.WABA_ID?.trim() || "kapso";

await saveCredentials({
  organizationId,
  wabaId,
  phoneNumberId,
  token: "", // sin credencial de envío: el CRM no envía, solo registra
});

// Agente incluido apagado: Eli (n8n) es quien responde.
await db
  .update(schema.agentProfile)
  .set({ enabled: false, updatedAt: new Date() })
  .where(scoped(schema.agentProfile.organizationId, organizationId));

const creds = await getCredentialsByOrg(organizationId);
console.log(
  [
    `✓ Canal conectado (solo recepción): phone_number_id=${phoneNumberId}`,
    `  Organización: ${organizationId}`,
    `  WABA (etiqueta): ${creds?.wabaId}`,
    "  Credencial de envío: (vacía — el CRM no envía)",
    "  Agente incluido: APAGADO",
    "  Webhook: apunta el proveedor a /api/webhooks/wa/<META_WEBHOOK_VERIFY_TOKEN>",
  ].join("\n")
);

process.exit(0);
