// Levanta el Google falso para probar la Edge Function «calendario» de verdad (Docker + Supabase local).
//   node supabase/functions/calendario/pruebas/servidor-falso.ts <puerto> <archivo.env>
// Escribe en <archivo.env> las variables que la función lee (GOOGLE_SA_JSON, GCAL_CALENDAR_ID y las dos
// de prueba GCAL_API_BASE / GCAL_TOKEN_URI) y se queda escuchando. Todo es inventado y local: la
// clave RSA se genera al arrancar y no vale en ningún sitio.
import { writeFileSync } from "node:fs";
import { GoogleFalso } from "./google-falso.ts";

const puerto = Number(process.argv[2] ?? 0);
const archivo = process.argv[3];
if (!archivo) {
  console.error("Uso: node servidor-falso.ts <puerto> <archivo.env>");
  process.exit(1);
}

const google = new GoogleFalso();
// Desde el contenedor de las Edge Functions el host se ve como host.docker.internal.
await google.iniciar(puerto, "0.0.0.0", "host.docker.internal");

writeFileSync(
  archivo,
  [
    `GOOGLE_SA_JSON='${JSON.stringify(google.cuentaServicio())}'`,
    `GCAL_CALENDAR_ID=${google.calendarioId}`,
    `GCAL_API_BASE=${google.apiBase}`,
    `GCAL_TOKEN_URI=${google.base}/token`,
    "",
  ].join("\n"),
  { mode: 0o600 },
);
console.log(`Google falso en ${google.base} (control: ${google.base}/__control/eventos). Variables en ${archivo}`);
