#!/usr/bin/env node
// Lectura de prueba de Google Calendar (TK-14). Solo LEE; no crea ni cambia nada.
// Sin dependencias: usa solo Node 18+ (crypto y fetch).
//
// Variables de entorno (nunca van en git):
//   GOOGLE_SA_JSON   contenido completo del JSON de la cuenta de servicio
//                    (o, si no está, GOOGLE_SA_JSON_FILE = ruta al archivo .json)
//   GCAL_CALENDAR_ID id del calendario de PRUEBA (Configuración del calendario > Integrar)
//
// Uso (desde la raíz del repo):
//   set -a; source .env; set +a; node scripts/gcal-prueba.mjs
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

const fallo = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

let crudo = process.env.GOOGLE_SA_JSON;
if (!crudo && process.env.GOOGLE_SA_JSON_FILE) {
  try {
    crudo = readFileSync(process.env.GOOGLE_SA_JSON_FILE, "utf8");
  } catch (e) {
    fallo(`No pude leer GOOGLE_SA_JSON_FILE: ${e.message}`);
  }
}
const calendarId = process.env.GCAL_CALENDAR_ID;
if (!crudo) fallo("Falta GOOGLE_SA_JSON (o GOOGLE_SA_JSON_FILE).");
if (!calendarId) fallo("Falta GCAL_CALENDAR_ID.");

let sa;
try {
  sa = JSON.parse(crudo);
} catch {
  fallo("GOOGLE_SA_JSON no es un JSON válido (¿pegaste el archivo completo, en una sola línea?).");
}
if (!sa.client_email || !sa.private_key) {
  fallo("El JSON no parece una clave de cuenta de servicio (faltan client_email o private_key).");
}

const b64url = (x) => Buffer.from(x).toString("base64url");

async function token() {
  const ahora = Math.floor(Date.now() / 1000);
  const cabecera = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const cuerpo = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/calendar",
      aud: "https://oauth2.googleapis.com/token",
      iat: ahora,
      exp: ahora + 3600,
    }),
  );
  const firma = createSign("RSA-SHA256")
    .update(`${cabecera}.${cuerpo}`)
    .sign(sa.private_key, "base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${cabecera}.${cuerpo}.${firma}`,
    }),
  });
  const j = await r.json();
  if (!r.ok) fallo(`Google rechazó la clave: ${j.error} ${j.error_description ?? ""}`);
  return j.access_token;
}

const t = await token();
const url = new URL(
  `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
);
url.search = new URLSearchParams({
  timeMin: new Date().toISOString(),
  maxResults: "10",
  singleEvents: "true",
  orderBy: "startTime",
  timeZone: "America/Guayaquil",
}).toString();

const r = await fetch(url, { headers: { authorization: `Bearer ${t}` } });
const j = await r.json();
if (!r.ok) {
  const pista =
    r.status === 404
      ? " (revisa GCAL_CALENDAR_ID y que el calendario esté compartido con la cuenta de servicio)"
      : r.status === 403
        ? " (¿activaste la API de Google Calendar? ¿diste «Hacer cambios en eventos»?)"
        : "";
  fallo(`Calendar respondió ${r.status}: ${j.error?.message ?? JSON.stringify(j)}${pista}`);
}

console.log(`✓ Conexión correcta con «${j.summary}» (zona ${j.timeZone}).`);
if (!j.items.length) {
  console.log("  No hay eventos próximos. Crea uno de prueba en el calendario y vuelve a correr el script.");
}
for (const e of j.items) {
  const cuando = e.start?.dateTime ?? e.start?.date ?? "?";
  console.log(`  • ${cuando}  ${e.summary ?? "(sin título)"}`);
}
