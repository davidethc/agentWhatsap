/**
 * Regenera las capturas del README (docs/screenshots/*.png) con la interfaz
 * actual, para que la portada no envejezca respecto al producto.
 *
 * Corre contra una app LOCAL con los mocks encendidos (WA_MOCK_ENABLED=true y
 * META_GRAPH_BASE_URL apuntando al wa-mock, ver el quickstart) y una base
 * recién migrada o con la demo ya cargada:
 *
 *   node --env-file=.env scripts/screenshots.mjs
 *
 * Requiere Playwright (devDependency) con su Chromium instalado:
 *
 *   pnpm exec playwright install chromium
 *
 * Lo que hace: entra (o crea al propietario si la base está vacía), carga el
 * negocio demo, conecta un número de prueba por el mock y deja la marca por
 * defecto; después captura las cinco pantallas de la portada a 1440×900 en
 * tema claro. No toca ninguna API real: todo sale del mock.
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.APP_BASE_URL ?? "http://localhost:3000";
const OUT = "docs/screenshots";
const VIEWPORT = { width: 1440, height: 900 };
const EMAIL = process.env.SCREENSHOTS_EMAIL ?? "capturas@vocero.test";
const PASSWORD = process.env.SCREENSHOTS_PASSWORD ?? "capturas-vocero-123";

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 1,
  locale: "es-MX",
  timezoneId: "America/Mexico_City",
  colorScheme: "light",
  reducedMotion: "reduce",
});

// La Bandeja abre el panel de detalles según esta preferencia de escritorio.
await context.addInitScript(() => {
  try {
    localStorage.setItem("vocero.panelOpen", "true");
  } catch {
    // sin almacenamiento no hay preferencia que recordar
  }
});

// --- Sesión. La API y el navegador comparten las cookies del contexto, así
// que entrar por la API deja al navegador ya autenticado.
const api = context.request;
const call = (path, init = {}) =>
  api.fetch(`${BASE}${path}`, {
    ...init,
    // En dev la primera visita de una ruta compila en caliente y 30s no bastan.
    timeout: 90_000,
    // Better Auth valida Origin (CSRF) en los endpoints de auth.
    headers: { origin: BASE, ...(init.headers ?? {}) },
  });

let session = await call("/api/auth/sign-up/email", {
  method: "POST",
  data: { email: EMAIL, password: PASSWORD, name: "Kevin" },
});
if (!session.ok()) {
  session = await call("/api/auth/sign-in/email", {
    method: "POST",
    data: { email: EMAIL, password: PASSWORD },
  });
}
if (!session.ok()) {
  console.error("No se pudo entrar:", session.status(), await session.text());
  process.exit(1);
}

// Demo (409 si ya hay datos: no pasa nada), número de prueba por el mock y la
// marca tal cual sale de la caja.
await call("/api/seed/demo", { method: "POST" });
await call("/api/settings/whatsapp", {
  method: "PUT",
  data: { wabaId: "waba-demo", phoneNumberId: "pn-demo-001", token: "token-demo" },
});
await call("/api/settings/branding", {
  method: "PUT",
  data: { name: "EliDental", accent: "#0e7490", currency: "USD" },
});
// El Laboratorio se dibuja vacío sin proveedor de IA activo: se configura
// contra el ai-mock local (quickstart) para que la corrida demo se vea.
await call("/api/settings/ai", {
  method: "PUT",
  data: {
    provider: "openai_compatible",
    baseUrl: "http://localhost:3000/api/dev/ai-mock/v1",
    model: "mock-gpt-4o-mini",
    token: "token-demo",
  },
});

const page = await context.newPage();

/**
 * Navega, espera lo que identifica la pantalla y captura. `load` y no
 * `networkidle`: la Bandeja mantiene abierta la conexión SSE de /api/events y
 * la red jamás queda ociosa.
 */
async function shoot(path, file, ready) {
  // El autocompiled de Next en dev tarda en la primera visita de cada ruta:
  // 30s no alcanzan con muchas pestañas compilándose a la vez.
  await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 90_000 });
  // El indicador de desarrollo de Next no es parte del producto.
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await ready();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${file}`, animations: "disabled" });
  console.log("  ✓", file);
}

await shoot("/inbox", "bandeja.png", async () => {
  const fernanda = page.getByText("María Fernanda López").first();
  await fernanda.waitFor({ timeout: 60_000 });
  await fernanda.click();
  await page.getByText("¿Tienen precio de esa limpieza?").waitFor({ timeout: 60_000 });
  await page.getByText("Etapa del pipeline").waitFor({ timeout: 60_000 });
});

await shoot("/pipeline", "pipeline.png", async () => {
  await page.getByText("Interesado").first().waitFor({ timeout: 90_000 });
  await page.getByText("María Fernanda López").first().waitFor({ timeout: 90_000 });
});

await shoot("/lab", "laboratorio.png", async () => {
  await page.getByText(/Score/).first().waitFor({ timeout: 90_000 });
  // El reporte de la corrida llega en un segundo fetch: se espera a que el
  // hueco "elige una corrida" desaparezca, no un tiempo fijo.
  await page
    .getByText("Elige una corrida del historial")
    .waitFor({ state: "hidden", timeout: 30_000 });
});

await shoot("/settings/branding", "marca.png", async () => {
  await page.getByText("Marca del CRM").waitFor({ timeout: 90_000 });
  await page.getByText("Logo del negocio").waitFor({ timeout: 90_000 });
});

await shoot("/settings/whatsapp", "wizard-whatsapp.png", async () => {
  await page.getByText(/Número conectado/).waitFor({ timeout: 90_000 });
});

await browser.close();
console.log(`Listo: ${OUT}/*.png a ${VIEWPORT.width}×${VIEWPORT.height}`);
