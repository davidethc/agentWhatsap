import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const EMAIL = "capturas@vocero.test";
const PASSWORD = "capturas-vocero-123";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "es-MX" });
const api = context.request;
const call = (p, i = {}) => api.fetch(BASE + p, { ...i, timeout: 90000, headers: { origin: BASE, ...(i.headers ?? {}) } });
let s = await call("/api/auth/sign-in/email", { method: "POST", data: { email: EMAIL, password: PASSWORD } });
if (!s.ok()) { s = await call("/api/auth/sign-up/email", { method: "POST", data: { email: EMAIL, password: PASSWORD, name: "Kevin" } }); }
console.log("session", s.status());
const page = await context.newPage();
await page.goto(BASE + "/lab", { waitUntil: "load", timeout: 90000 });
await page.waitForTimeout(15000);
const txt = await page.evaluate(() => document.body.innerText);
console.log("has Score:", txt.includes("Score"), "has Reporte:", txt.includes("Reporte"));
console.log(txt.slice(0, 1200));
await browser.close();
