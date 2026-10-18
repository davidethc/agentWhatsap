import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { getEnv } from "@/lib/env";
import { scoped } from "@/lib/db/tenant";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { deleteMediaFile } from "@/server/whatsapp/media";
import { purgeExpiredContent } from "./service";

let running = false;
let timer: ReturnType<typeof setInterval> | undefined;
/** Reintenta archivos aunque el registro del adjunto ya no exista. */
export async function runPrivacyMaintenance(): Promise<void> {
  if (running) return;
  running = true;
  try {
    // Tandas acotadas; la siguiente pasada continúa desde el estado persistente.
    while (await purgeExpiredContent() === 100) { /* continuar */ }
    await purgeOrphanFiles();
    const jobs = await getDb().select().from(schema.mediaPurgeJob).limit(1000);
    for (const job of jobs) {
      try {
        await deleteMediaFile(job.organizationId, job.assetId);
        await getDb().delete(schema.mediaPurgeJob).where(eq(schema.mediaPurgeJob.id, job.id));
      } catch { console.error("[privacidad] archivo pendiente de purga"); }
    }
  } catch { console.error("[privacidad] mantenimiento pendiente; se reintentará"); }
  finally { running = false; }
}
export function startPrivacyMaintenance() {
  if (timer) return;
  void runPrivacyMaintenance();
  timer = setInterval(() => { void runPrivacyMaintenance(); }, 24 * 60 * 60 * 1000);
  timer.unref?.();
}

/** Archivos de una escritura abortada: solo IDs de adjunto, nunca favicon.
 * La gracia de 24 h evita competir con un upload que aún no insertó su fila.
 */
export async function purgeOrphanFiles(): Promise<void> {
  const root = getEnv().MEDIA_DIR;
  const orgs = await readdir(root, { withFileTypes: true }).catch(() => []);
  for (const org of orgs) {
    if (!org.isDirectory() || !/^[\w.-]+$/.test(org.name)) continue;
    const dir = path.join(root, org.name);
    for (const file of await readdir(dir, { withFileTypes: true })) {
      if (!file.isFile() || !/^ma_[a-z0-9]{20}$/.test(file.name)) continue;
      const info = await stat(path.join(dir, file.name));
      if (Date.now() - info.mtimeMs < 24 * 60 * 60 * 1000) continue;
      const [asset] = await getDb().select({ id: schema.mediaAsset.id }).from(schema.mediaAsset)
        .where(scoped(schema.mediaAsset.organizationId, org.name, eq(schema.mediaAsset.id, file.name))).limit(1);
      if (!asset) await deleteMediaFile(org.name, file.name);
    }
  }
}
