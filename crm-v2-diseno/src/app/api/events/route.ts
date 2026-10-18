import { hasOperationalAccess } from "@/server/privacy/access";
import { getConversation } from "@/server/inbox/queries";
import { requireSession, UnauthorizedError } from "@/lib/auth/session";
import { subscribe } from "@/server/events/bus";

/**
 * Canal SSE de la bandeja (contrato sse.md).
 * Headers exactos + heartbeat ~25s para sobrevivir detrás de Caddy/Traefik.
 * El servidor no garantiza replay: el cliente hace catch-up con `since=`.
 */
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000;
const encoder = new TextEncoder();

export async function GET(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return new Response("No autenticado", { status: 401 });
    }
    throw err;
  }
  if (!(await hasOperationalAccess(session))) return new Response("Acceso reservado a la doctora", { status: 403 });
  const { organizationId } = session;

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup?.();
        }
      };

      send(`: conectado\n\n`);

      let pending = Promise.resolve();
      const unsubscribe = subscribe(organizationId, (event) => {
        pending = pending.then(async () => {
        if (!(await hasOperationalAccess(session))) { cleanup?.(); return; }
        if (event.type === "message.new" || event.type === "message.status") {
          if (!(await getConversation(organizationId, event.data.conversationId))) return;
        }
        send(
          `event: ${event.type}\n` +
            `id: ${Date.now()}\n` +
            `data: ${JSON.stringify(event.type === "conversation.updated" ? { conversation: { id: (event.data.conversation as { id?: string }).id } } : event.data)}\n\n`
        );
        }).catch(() => cleanup?.());
      });

      const heartbeat = setInterval(() => {
        void hasOperationalAccess(session).then(allowed => allowed ? send(`: ping\n\n`) : cleanup?.()).catch(() => cleanup?.());
      }, HEARTBEAT_MS);

      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // ya cerrado
        }
      };

      req.signal.addEventListener("abort", () => cleanup?.());
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}
