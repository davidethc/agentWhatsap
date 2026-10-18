import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), access: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireSession: mocks.session, UnauthorizedError: class UnauthorizedError extends Error {} }));
vi.mock("@/server/privacy/access", () => ({ hasOperationalAccess: mocks.access }));
import { withAuth } from "@/lib/api";
import { UnauthorizedError } from "@/lib/auth/session";
import { PrivacyError } from "@/server/privacy/policy";
describe("frontera HTTP de privacidad", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue({ userId: "tecnico", organizationId: "org_ficticia", role: "owner" }); mocks.access.mockResolvedValue(false); });
  it.each(["conversations", "contacts", "pipeline/board", "analytics/sales", "bookings", "lab/runs", "media/ma_ficticia"])("owner sin grant no puede leer %s", async endpoint => {
    const handler = vi.fn();
    const res = await withAuth(handler)(new Request(`http://localhost/api/${endpoint}`));
    expect(res.status).toBe(403); expect(handler).not.toHaveBeenCalled();
  });
  it("doctora con grant puede entrar", async () => {
    mocks.access.mockResolvedValue(true);
    const res = await withAuth(async () => Response.json({ ok: true }))(new Request("http://localhost/api/conversations"));
    expect(res.status).toBe(200);
  });
  it("anónimo recibe 401", async () => {
    mocks.session.mockRejectedValue(new UnauthorizedError());
    const res = await withAuth(async () => Response.json({ ok: true }))(new Request("http://localhost/api/conversations"));
    expect(res.status).toBe(401);
  });
  it("contenido inexistente se responde sin detalles", async () => {
    mocks.access.mockResolvedValue(true);
    const res = await withAuth(async () => { throw new PrivacyError("not_found"); })(new Request("http://localhost/api/conversations/cv_ficticia"));
    expect(res.status).toBe(404);
  });
  it("la administración técnica conserva ajustes sin permiso clínico", async () => {
    const res = await withAuth(async () => Response.json({ ok: true }))(new Request("http://localhost/api/settings/team"));
    expect(res.status).toBe(200);
  });
});
