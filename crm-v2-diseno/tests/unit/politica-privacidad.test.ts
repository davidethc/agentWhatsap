import { describe, expect, it } from "vitest";
import { contentAvailable, assertAiEpoch, RETENTION_MS } from "@/server/privacy/policy";

describe("privacidad conversacional", () => {
  const createdAt = new Date("2026-01-01T00:00:00Z");
  it("oculta exactamente a los 90 días, aunque el worker no haya corrido", () => {
    const c = { createdAt, lastMessageAt: null, contentDeletedAt: null };
    expect(contentAvailable(c, new Date("2026-03-31T23:59:59.999Z"))).toBe(true);
    expect(contentAvailable(c, new Date("2026-04-01T00:00:00Z"))).toBe(false);
    expect(RETENTION_MS).toBe(7_776_000_000);
  });
  it("un borrado anticipado no depende de la última actividad", () => {
    expect(contentAvailable({ createdAt, lastMessageAt: createdAt, contentDeletedAt: createdAt }, createdAt)).toBe(false);
  });
  it("una respuesta anterior a tomar y devolver nunca recupera permiso", () => {
    const c = { aiEnabled: true, handoffAt: null, controlEpoch: 2 };
    expect(() => assertAiEpoch(c, 0)).toThrow("stale_epoch");
    expect(() => assertAiEpoch(c, undefined)).toThrow("epoch_required");
    expect(() => assertAiEpoch(c, 2)).not.toThrow();
  });
  it("la pausa vence incluso con epoch vigente", () => {
    expect(() => assertAiEpoch({ aiEnabled: false, handoffAt: null, controlEpoch: 1 }, 1)).toThrow("ai_paused");
  });
});
