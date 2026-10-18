/** 90 períodos de 24 horas: UTC, sin meses calendario ni prórroga por lecturas. */
export const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
export function contentAvailable(c: { createdAt: Date; lastMessageAt: Date | null; contentDeletedAt: Date | null }, now = new Date()): boolean {
  return !c.contentDeletedAt && now.getTime() < (c.lastMessageAt ?? c.createdAt).getTime() + RETENTION_MS;
}
export class PrivacyError extends Error {
  constructor(public code: "not_found" | "ai_paused" | "epoch_required" | "stale_epoch" | "idempotency_conflict" | "send_pending" | "send_uncertain" | "human_control_required") { super(code); }
}
export function assertAiEpoch(c: { aiEnabled: boolean; handoffAt: Date | null; controlEpoch: number }, epoch?: number) {
  if (!c.aiEnabled || c.handoffAt) throw new PrivacyError("ai_paused");
  if (epoch === undefined) throw new PrivacyError("epoch_required");
  if (epoch !== c.controlEpoch) throw new PrivacyError("stale_epoch");
}
