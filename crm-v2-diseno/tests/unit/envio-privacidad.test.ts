import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ receipts: [] as Record<string, unknown>[], epoch: 0, enabled: true }));
vi.mock("@/lib/db", async () => {
  const schema = await import("@/lib/db/schema");
  return { schema, getDb: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => state.receipts }) }) }),
    insert: () => ({ values: async (value: Record<string, unknown>) => { state.receipts.push({ ...value }); } }),
    update: () => ({ set: (value: Record<string, unknown>) => ({ where: async () => { Object.assign(state.receipts[0]!, value); } }) }),
  }) };
});
vi.mock("@/server/privacy/service", () => ({
  withConversationLock: async (_org: string, _id: string, action: (c: unknown) => Promise<unknown>) => action({
    createdAt: new Date(), lastMessageAt: new Date(), contentDeletedAt: null,
    controlEpoch: state.epoch, aiEnabled: state.enabled, handoffAt: null, lastInboundAt: new Date("2026-10-01T00:00:00Z"),
  }),
}));
import { acceptConversationSend } from "@/server/privacy/send";

describe("aceptación durable de envío", () => {
  beforeEach(() => { state.receipts = []; state.epoch = 0; state.enabled = true; });
  const input = { organizationId: "org_ficticia", conversationId: "cv_ficticia", aiGenerated: true, expectedEpoch: 0, idempotencyKey: "ficticio-1" };
  it("persiste intención antes del transporte y replay devuelve el mismo id", async () => {
    const send = vi.fn(async () => {
      expect(state.receipts[0]?.status).toBe("pending");
      return { messageId: "msg_ficticio" };
    });
    expect(await acceptConversationSend(input, send)).toEqual({ messageId: "msg_ficticio" });
    expect(await acceptConversationSend(input, send)).toEqual({ messageId: "msg_ficticio" });
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("resultado incierto no autoriza repetir transporte", async () => {
    const send = vi.fn(async (): Promise<{ messageId: string }> => { throw new Error("conexión interrumpida"); });
    await expect(acceptConversationSend(input, send)).rejects.toThrow("conexión interrumpida");
    await expect(acceptConversationSend(input, send)).rejects.toThrow("send_uncertain");
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("intención pendiente tras reinicio no se vuelve a enviar", async () => {
    state.receipts.push({ epoch: 0, status: "pending", requestHash: "otro", id: "recibo" });
    const send = vi.fn();
    // Otra carga con la misma clave es conflicto, nunca permiso para reenviar.
    await expect(acceptConversationSend(input, send)).rejects.toThrow("idempotency_conflict");
    expect(send).not.toHaveBeenCalled();
  });
  it("no acepta una respuesta antigua después de tomar y devolver", async () => {
    state.epoch = 2;
    const send = vi.fn();
    await expect(acceptConversationSend(input, send)).rejects.toThrow("stale_epoch");
    expect(state.receipts).toEqual([]);
    expect(send).not.toHaveBeenCalled();
  });
});
