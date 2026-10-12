import { mockGuard } from "@/lib/dev-guard";
import { aiMockAuthFailure, aiMockCompletion } from "@/server/dev/ai-mock";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const guard = mockGuard();
  if (guard) return guard;

  // Como el wa-mock con su sufijo `-invalid`: una llave con sufijo conocido
  // se rechaza con el código que daría el proveedor, para ejercitar la pausa.
  const rechazo = aiMockAuthFailure(req.headers.get("authorization"));
  if (rechazo) return Response.json(rechazo.body, { status: rechazo.status });

  const body = (await req.json().catch(() => ({}))) as {
    messages?: { role: string; content: string }[];
  };
  const content = aiMockCompletion(body.messages ?? []);
  return Response.json({
    id: "aimock",
    choices: [{ index: 0, message: { role: "assistant", content } }],
  });
}
