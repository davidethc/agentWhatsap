/**
 * Crear un acceso (correo + contraseña) por CLI, sin UI ni correo.
 *
 * Usa la MISMA puerta que el login: `auth.api.signUpEmail` de Better Auth, con
 * `runInternalSignup` para atravesar el gate de registro cerrado. El hook
 * `onUserCreated` crea la organización (con pipeline y perfil de agente) si es
 * la primera cuenta de la instancia; las cuentas siguientes reciben membresía
 * aparte (Ajustes → Equipo).
 *
 * Se bundlea con esbuild (alias @ → ./src), como el resto de scripts.
 *
 * Uso (bash):
 *   NEW_PASSWORD='...' NEW_NAME='Cody' pnpm acceso:crear codycabreraa@gmail.com
 */
import { eq } from "drizzle-orm";
import { getAuth, runInternalSignup } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";

const MIN_PASSWORD_LENGTH = 8;

const email = (process.argv[2] ?? "").trim().toLowerCase();
// La contraseña por variable de entorno, no por argumento: un argumento queda
// en el historial del shell y es visible en `ps`.
const password = process.env.NEW_PASSWORD ?? "";
const name = process.env.NEW_NAME?.trim() || email.split("@")[0] || "Dueño";

if (!email || !password) {
  console.error(
    "Faltan datos.\n" +
      "  NEW_PASSWORD='...' pnpm acceso:crear correo@ejemplo.com"
  );
  process.exit(1);
}
if (password.length < MIN_PASSWORD_LENGTH) {
  console.error(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  process.exit(1);
}

const db = getDb();

const existing = await db
  .select({ id: schema.user.id })
  .from(schema.user)
  .where(eq(schema.user.email, email))
  .limit(1);

if (existing[0]) {
  console.log(
    `El acceso ${email} ya existe (id=${existing[0].id}).\n` +
      "Para cambiar la contraseña usa: NEW_PASSWORD='...' node scripts/reset-password.mjs " +
      email
  );
  process.exit(0);
}

const auth = getAuth();
const result = await runInternalSignup(() =>
  auth.api.signUpEmail({ body: { email, password, name } })
);

const user = result?.user;
if (!user) {
  console.error("Better Auth no devolvió usuario; revisa la salida anterior.");
  process.exit(1);
}

const membership = await db
  .select({
    organizationId: schema.member.organizationId,
    role: schema.member.role,
  })
  .from(schema.member)
  .where(eq(schema.member.userId, user.id))
  .limit(1);

console.log(
  [
    `✓ Acceso creado: ${user.email} (id=${user.id})`,
    membership[0]
      ? `  Organización: ${membership[0].organizationId} · rol ${membership[0].role}`
      : "  Sin organización (cuenta de equipo: asígnala en Ajustes → Equipo)",
    `  Entra en ${process.env.APP_BASE_URL ?? "https://eli-panel.vercel.app"}/login`,
  ].join("\n")
);

process.exit(0);
