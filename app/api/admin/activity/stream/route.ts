import { getServerSession } from "next-auth";
import { subscribeActivityUpdates } from "@/lib/activity-pubsub";
import { isActivityAdminEmail } from "@/lib/activity-types";
import { buildAdminActivitySnapshot } from "@/lib/admin-activity-data";
import { authOptions } from "@/lib/auth-options";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_SYNC_MS = 3_000;
const KEEPALIVE_MS = 15_000;
const PUSH_DEBOUNCE_MS = 180;

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isActivityAdminEmail(session.user.email)) {
    return Response.json({ error: "Bạn không có quyền xem hoạt động của các tài khoản khác." }, { status: 403 });
  }

  const currentUserId = session.user.id;
  const encoder = new TextEncoder();

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let inFlight = false;
      let pendingImmediate = false;
      let lastSignature = "";
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      let pollTimer: ReturnType<typeof setInterval> | null = null;
      let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          teardown();
        }
      };

      const pushSnapshot = async (force = false) => {
        if (closed) return;
        if (inFlight) {
          pendingImmediate = true;
          return;
        }
        inFlight = true;
        try {
          const snapshot = await buildAdminActivitySnapshot(currentUserId);
          if (closed) return;
          const sig = JSON.stringify(snapshot.accounts);
          if (force || sig !== lastSignature) {
            lastSignature = sig;
            safeEnqueue(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
          }
        } catch {
          // transient DB hiccup: keep stream alive for next tick
        } finally {
          inFlight = false;
          if (pendingImmediate && !closed) {
            pendingImmediate = false;
            scheduleImmediatePush();
          }
        }
      };

      const scheduleImmediatePush = () => {
        if (closed || debounceTimer) return;
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          void pushSnapshot(false);
        }, PUSH_DEBOUNCE_MS);
      };

      const unsubscribe = subscribeActivityUpdates(() => {
        scheduleImmediatePush();
      });

      const teardown = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        if (debounceTimer) clearTimeout(debounceTimer);
        if (pollTimer) clearInterval(pollTimer);
        if (keepaliveTimer) clearInterval(keepaliveTimer);
        request.signal.removeEventListener("abort", teardown);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      cleanup = teardown;
      request.signal.addEventListener("abort", teardown);

      // Push initial snapshot right away
      safeEnqueue("retry: 2000\n\n");
      void pushSnapshot(true);

      // Periodic DB check handles multi-instance / serverless setups & expiry transitions
      pollTimer = setInterval(() => {
        void pushSnapshot(false);
      }, POLL_SYNC_MS);

      // Keepalive comment prevents proxy/idle disconnects
      keepaliveTimer = setInterval(() => {
        safeEnqueue(`: keepalive ${Date.now()}\n\n`);
      }, KEEPALIVE_MS);
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
