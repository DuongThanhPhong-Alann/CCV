import { ObjectId } from "mongodb";
import { findAppDocument, patchAppDocument, type AppDocument } from "@/lib/app-data";
import type {
  ActivityKind,
  ActivitySegment,
  ActivitySegmentEndReason,
  UserActivityStore,
} from "@/lib/activity-types";
import { getDatabase } from "@/lib/mongodb";

const MAX_SEGMENTS_PER_USER = 250;
const MERGE_WINDOW_MS = 5 * 60 * 1000;

type UserDocWithActivity = AppDocument & {
  name?: string;
  email?: string;
  activity?: Partial<UserActivityStore>;
};

function sanitizeActivityStore(raw: unknown): UserActivityStore {
  if (!raw || typeof raw !== "object") {
    return { lastSeenAt: null, lastLoginAt: null, currentSegment: null, segments: [] };
  }
  const obj = raw as Partial<UserActivityStore>;
  const segments = Array.isArray(obj.segments)
    ? obj.segments
        .filter((s): s is ActivitySegment => Boolean(s && typeof s === "object" && typeof s.startedAt === "string"))
        .slice(0, MAX_SEGMENTS_PER_USER)
    : [];
  const currentSegment =
    obj.currentSegment && typeof obj.currentSegment === "object" && typeof obj.currentSegment.startedAt === "string"
      ? (obj.currentSegment as ActivitySegment)
      : null;
  return {
    lastSeenAt: typeof obj.lastSeenAt === "string" ? obj.lastSeenAt : null,
    lastLoginAt: typeof obj.lastLoginAt === "string" ? obj.lastLoginAt : null,
    currentSegment,
    segments,
  };
}

function makeSegmentId(nowMs: number) {
  return `${nowMs.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function defaultTitleForPath(kind: ActivityKind, path: string): string {
  if (kind === "login") return "Đăng nhập vào hệ thống";
  if (kind === "logout") return "Đăng xuất khỏi hệ thống";
  if (kind === "closure") return "Bảng giải tìm khóa & siêu khóa";
  if (kind === "code_task") return "Làm bài tập Code";
  if (kind === "erd_task") return "Làm bài tập ERD";
  if (kind === "diagram") return "Thiết kế sơ đồ ERD";
  if (path === "/code-tasks") return "Xem danh sách Bài tập Code";
  if (path === "/tasks") return "Xem danh sách Bài tập ERD";
  if (path === "/activity") return "Theo dõi hoạt động tài khoản";
  return "Trang chủ · Sơ đồ của tôi";
}

export async function resolveActivityTitle(
  kind: ActivityKind,
  path: string,
  targetId?: string | null,
  fallbackTitle?: string,
): Promise<string> {
  if (targetId && /^[0-9a-f]{24}$/i.test(targetId)) {
    try {
      if (kind === "code_task" || kind === "erd_task") {
        const taskDoc = await findAppDocument<AppDocument & { title?: string }>(
          "tasks",
          targetId,
          () => getDatabase().collection("tasks").findOne({ _id: new ObjectId(targetId) }),
        );
        if (taskDoc && typeof taskDoc.title === "string" && taskDoc.title.trim()) {
          return taskDoc.title.trim();
        }
      } else if (kind === "diagram") {
        const diagDoc = await findAppDocument<AppDocument & { name?: string; taskId?: ObjectId | string }>(
          "diagrams",
          targetId,
          () => getDatabase().collection("diagrams").findOne({ _id: new ObjectId(targetId) }),
        );
        if (diagDoc && typeof diagDoc.name === "string" && diagDoc.name.trim()) {
          if (diagDoc.taskId) {
            const linkedTaskId = diagDoc.taskId instanceof ObjectId ? diagDoc.taskId.toString() : String(diagDoc.taskId);
            if (/^[0-9a-f]{24}$/i.test(linkedTaskId)) {
              const linkedTask = await findAppDocument<AppDocument & { title?: string }>(
                "tasks",
                linkedTaskId,
                () => getDatabase().collection("tasks").findOne({ _id: new ObjectId(linkedTaskId) }),
              );
              if (linkedTask?.title?.trim()) {
                return `Vẽ ERD: ${linkedTask.title.trim()} (${diagDoc.name.trim()})`;
              }
            }
          }
          return `Sơ đồ: ${diagDoc.name.trim()}`;
        }
      }
    } catch {
      // fall through to fallback title
    }
  }
  if (fallbackTitle && fallbackTitle.trim()) return fallbackTitle.trim().slice(0, 140);
  return defaultTitleForPath(kind, path);
}

export type RecordActivityInput = {
  userId: string;
  event: "login" | "enter" | "heartbeat" | "leave" | "logout" | "action";
  kind: ActivityKind;
  path: string;
  targetId?: string | null;
  title?: string;
  note?: string;
  reason?: ActivitySegmentEndReason;
};

export async function recordUserActivity(input: RecordActivityInput): Promise<void> {
  if (!/^[0-9a-f]{24}$/i.test(input.userId)) return;

  try {
    const userDoc = await findAppDocument<UserDocWithActivity>(
      "users",
      input.userId,
      () => getDatabase().collection("users").findOne({ _id: new ObjectId(input.userId) }),
    );
    if (!userDoc) return;

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const store = sanitizeActivityStore(userDoc.activity);
    const segments = [...store.segments];
    const resolvedTitle = await resolveActivityTitle(input.kind, input.path, input.targetId, input.title);
    const cleanTargetId = input.targetId && /^[0-9a-f]{24}$/i.test(input.targetId) ? input.targetId : null;
    const cleanNote = input.note?.trim().slice(0, 180);

    if (input.event === "login") {
      if (segments[0] && segments[0].endedReason === "active") {
        segments[0] = { ...segments[0], endedReason: "switch" };
      }
      const loginSeg: ActivitySegment = {
        id: makeSegmentId(nowMs),
        kind: "login",
        path: "/login",
        targetId: null,
        title: "Đăng nhập vào hệ thống",
        startedAt: nowIso,
        endedAt: nowIso,
        durationSec: 0,
        note: cleanNote,
        endedReason: "switch",
      };
      segments.unshift(loginSeg);
      const nextStore: UserActivityStore = {
        lastSeenAt: nowIso,
        lastLoginAt: nowIso,
        currentSegment: null,
        segments: segments.slice(0, MAX_SEGMENTS_PER_USER),
      };
      await patchAppDocument("users", input.userId, { activity: nextStore }, {});
      return;
    }

    if (input.event === "logout") {
      if (
        segments[0]?.kind === "logout" &&
        nowMs - new Date(segments[0].startedAt).getTime() < 15_000
      ) {
        return;
      }
      const endReason: ActivitySegmentEndReason = input.reason === "timeout" ? "timeout" : "logout";
      if (segments[0] && segments[0].endedReason === "active") {
        const startMs = new Date(segments[0].startedAt).getTime();
        const prevEndMs = new Date(segments[0].endedAt).getTime();
        // Only extend endedAt if the logout happened promptly (not 30m idle timeout)
        const finalEndMs = endReason === "timeout" ? prevEndMs : Math.max(prevEndMs, nowMs);
        segments[0] = {
          ...segments[0],
          endedAt: new Date(finalEndMs).toISOString(),
          durationSec: Math.max(0, Math.round((finalEndMs - startMs) / 1000)),
          endedReason: endReason,
        };
      }
      const logoutSeg: ActivitySegment = {
        id: makeSegmentId(nowMs),
        kind: "logout",
        path: input.path || "/login",
        targetId: null,
        title:
          endReason === "timeout"
            ? "Tự động đăng xuất (không hoạt động >30 phút)"
            : "Đăng xuất khỏi hệ thống",
        startedAt: nowIso,
        endedAt: nowIso,
        durationSec: 0,
        note: cleanNote,
        endedReason: endReason,
      };
      segments.unshift(logoutSeg);
      const nextStore: UserActivityStore = {
        lastSeenAt: endReason === "timeout" ? store.lastSeenAt : nowIso,
        lastLoginAt: store.lastLoginAt,
        currentSegment: null,
        segments: segments.slice(0, MAX_SEGMENTS_PER_USER),
      };
      await patchAppDocument("users", input.userId, { activity: nextStore }, {});
      return;
    }

    // enter / heartbeat / leave / action
    const top = segments[0];
    const topEndMs = top ? new Date(top.endedAt).getTime() : 0;
    const sameActivity =
      Boolean(top) &&
      top.kind === input.kind &&
      top.path === input.path &&
      (top.targetId ?? null) === cleanTargetId &&
      top.endedReason !== "logout" &&
      top.endedReason !== "timeout" &&
      nowMs - topEndMs <= MERGE_WINDOW_MS;

    let activeSeg: ActivitySegment;
    if (sameActivity && top) {
      const startMs = new Date(top.startedAt).getTime();
      const mergedNote = cleanNote
        ? top.note && !top.note.includes(cleanNote)
          ? `${top.note} · ${cleanNote}`.slice(-180)
          : cleanNote
        : top.note;
      activeSeg = {
        ...top,
        title: resolvedTitle || top.title,
        endedAt: nowIso,
        durationSec: Math.max(0, Math.round((nowMs - startMs) / 1000)),
        ...(mergedNote ? { note: mergedNote } : {}),
        endedReason: input.event === "leave" ? "leave" : "active",
      };
      segments[0] = activeSeg;
    } else {
      if (top && top.endedReason === "active") {
        segments[0] = { ...top, endedReason: "switch" };
      }
      activeSeg = {
        id: makeSegmentId(nowMs),
        kind: input.kind,
        path: input.path,
        targetId: cleanTargetId,
        title: resolvedTitle,
        startedAt: nowIso,
        endedAt: nowIso,
        durationSec: 0,
        ...(cleanNote ? { note: cleanNote } : {}),
        endedReason: input.event === "leave" ? "leave" : "active",
      };
      segments.unshift(activeSeg);
    }

    const nextStore: UserActivityStore = {
      lastSeenAt: nowIso,
      lastLoginAt: store.lastLoginAt ?? nowIso,
      currentSegment: input.event === "leave" ? null : activeSeg,
      segments: segments.slice(0, MAX_SEGMENTS_PER_USER),
    };
    await patchAppDocument("users", input.userId, { activity: nextStore }, {});
  } catch (err) {
    console.error("[activity-logger] Failed to record activity:", err);
  }
}

export function extractUserActivityStore(userDoc: Record<string, unknown>): UserActivityStore {
  return sanitizeActivityStore(userDoc.activity);
}
