import { recordUserActivity } from "@/lib/activity-logger";
import type { ActivityKind, ActivitySegmentEndReason } from "@/lib/activity-types";
import { currentOwnerId } from "@/lib/current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_EVENTS = new Set(["enter", "heartbeat", "leave", "logout", "action"]);
const ALLOWED_KINDS = new Set<ActivityKind>([
  "login",
  "logout",
  "code_task",
  "erd_task",
  "diagram",
  "closure",
  "browse",
]);

export async function POST(request: Request) {
  const ownerId = await currentOwnerId();
  if (!ownerId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    event?: unknown;
    kind?: unknown;
    path?: unknown;
    targetId?: unknown;
    title?: unknown;
    note?: unknown;
    reason?: unknown;
  };
  try {
    const raw = await request.text();
    body = raw ? (JSON.parse(raw) as typeof body) : {};
  } catch {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const event = typeof body.event === "string" && ALLOWED_EVENTS.has(body.event)
    ? (body.event as "enter" | "heartbeat" | "leave" | "logout" | "action")
    : "heartbeat";
  const kind = typeof body.kind === "string" && ALLOWED_KINDS.has(body.kind as ActivityKind)
    ? (body.kind as ActivityKind)
    : "browse";
  const path = typeof body.path === "string" && body.path.startsWith("/")
    ? body.path.slice(0, 180)
    : "/";
  const targetId = typeof body.targetId === "string" && /^[0-9a-f]{24}$/i.test(body.targetId)
    ? body.targetId
    : null;
  const title = typeof body.title === "string" ? body.title.slice(0, 140) : undefined;
  const note = typeof body.note === "string" ? body.note.slice(0, 180) : undefined;
  const reason: ActivitySegmentEndReason | undefined =
    body.reason === "timeout"
      ? "timeout"
      : body.reason === "logout"
        ? "logout"
        : undefined;

  await recordUserActivity({
    userId: ownerId.toString(),
    event,
    kind,
    path,
    targetId,
    title,
    note,
    reason,
  });

  return Response.json({ ok: true });
}
