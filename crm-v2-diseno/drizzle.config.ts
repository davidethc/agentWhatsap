import { readFileSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// drizzle-kit corre fuera de Next: carga .env manualmente si hace falta.
function loadEnvVar(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  try {
    const env = readFileSync(".env", "utf8");
    const line = env
      .split(/\r?\n/)
      .find((l) => l.startsWith(`${name}=`));
    if (line) return line.slice(name.length + 1).trim();
  } catch {
    // sin .env: se devolverá vacío y drizzle-kit dará un error claro
  }
  return undefined;
}

function loadDatabaseUrl(): string {
  return loadEnvVar("DATABASE_URL") ?? "";
}

/**
 * Esquema de sesión: mismas tablas en `public` (self-host) o en `vocero`
 * (Supabase compartido de Eli Panel). Es el mismo valor que usa la app en
 * `PG_CONNECTION_OPTIONS` (src/lib/db/index.ts) y `scripts/migrate.mjs`.
 */
const schema = loadEnvVar("DATABASE_SCHEMA")?.trim() || "public";

/**
 * `TimeZone=UTC` (invariante de tiempo) y `search_path=<schema>` viajan como
 * parámetros `options`. OJO: el pooler de Supabase (Supavisor) ignora
 * `options`, así que para migrar contra el pooler hay que usar
 * `pnpm db:migrate` (scripts/migrate.mjs), que fija el search_path en la
 * conexión de postgres.js. Contra un Postgres propio, `drizzle-kit` sí respeta
 * esta URL.
 */
function withSession(url: string): string {
  if (!url) return url;
  if (/[?&](options|TimeZone)=/i.test(url)) return url;
  const opts = `-c%20timezone%3DUTC%20-c%20search_path%3D${encodeURIComponent(schema)}`;
  return `${url}${url.includes("?") ? "&" : "?"}options=${opts}`;
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Solo el esquema de la app: evita que `push`/`studio` toqueteen las tablas
  // del panel que comparten la misma base.
  schemaFilter: [schema],
  dbCredentials: {
    url: withSession(loadDatabaseUrl()),
  },
});

