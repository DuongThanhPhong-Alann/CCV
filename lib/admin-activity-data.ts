import type { ObjectId } from "mongodb";
import { extractUserActivityStore } from "@/lib/activity-logger";
import {
  isActivityAdminEmail,
  type ActivityTaskWorkSummary,
  type AdminUserActivityOverview,
  type AdminUserTaskEvent,
} from "@/lib/activity-types";
import { listAppDocuments, type AppDocument } from "@/lib/app-data";
import { resolveUserAvatar } from "@/lib/avatars";
import { getDatabase } from "@/lib/mongodb";

const ONLINE_WINDOW_MS = 3 * 60 * 1000;
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

type UserRecord = AppDocument & {
  name?: string;
  email?: string;
  image?: string | null;
  createdAt?: Date | string;
  activity?: unknown;
};

type TaskRecord = AppDocument & {
  taskType?: string;
  title?: string;
  assignedToId?: ObjectId | string | null;
  status?: string;
  acceptedAt?: Date | string | null;
  lastRun?: {
    runCount?: number;
    ranAt?: string;
    autoGrade?: { passed?: boolean; percentage?: number } | null;
  } | null;
  submission?: {
    version?: number;
    submittedAt?: Date | string;
    runCount?: number;
    autoGrade?: { passed?: boolean; percentage?: number } | null;
  } | null;
  grade?: { score?: number } | null;
  updatedAt?: Date | string;
};

function toIso(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function vnDayKey(ms: number): string {
  const shifted = new Date(ms + VN_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type AdminActivitySnapshot = {
  generatedAt: string;
  accounts: AdminUserActivityOverview[];
};

export async function buildAdminActivitySnapshot(currentUserId: string): Promise<AdminActivitySnapshot> {
  const [usersRaw, tasksRaw] = await Promise.all([
    listAppDocuments<UserRecord>(
      "users",
      {},
      () => getDatabase().collection("users").find({}).sort({ createdAt: -1 }).toArray(),
      2000,
    ),
    listAppDocuments<TaskRecord>(
      "tasks",
      {},
      () => getDatabase().collection("tasks").find({ status: { $ne: "draft" } }).sort({ updatedAt: -1 }).toArray(),
      5000,
    ),
  ]);

  const tasksByAssignee = new Map<string, AdminUserTaskEvent[]>();
  for (const task of tasksRaw) {
    if (task.status === "draft" || !task.assignedToId) continue;
    const assigneeId = typeof task.assignedToId === "string" ? task.assignedToId : task.assignedToId.toString();
    const autoGrade = task.lastRun?.autoGrade ?? task.submission?.autoGrade ?? null;
    const event: AdminUserTaskEvent = {
      id: task._id.toString(),
      taskType: task.taskType === "code" ? "code" : "erd",
      title: typeof task.title === "string" ? task.title : "Bài tập",
      status: typeof task.status === "string" ? task.status : "invited",
      acceptedAt: toIso(task.acceptedAt),
      lastRunAt: toIso(task.lastRun?.ranAt),
      submittedAt: toIso(task.submission?.submittedAt),
      updatedAt: toIso(task.updatedAt) ?? new Date().toISOString(),
      runCount: task.lastRun?.runCount ?? task.submission?.runCount ?? 0,
      passed: typeof autoGrade?.passed === "boolean" ? autoGrade.passed : null,
      percentage: typeof autoGrade?.percentage === "number" ? autoGrade.percentage : null,
      score: typeof task.grade?.score === "number" ? task.grade.score : null,
    };
    const list = tasksByAssignee.get(assigneeId) ?? [];
    list.push(event);
    tasksByAssignee.set(assigneeId, list);
  }

  const nowMs = Date.now();
  const todayKey = vnDayKey(nowMs);
  const weekAgoMs = nowMs - 7 * 24 * 60 * 60 * 1000;

  const accounts: AdminUserActivityOverview[] = usersRaw.map((user) => {
    const id = user._id.toString();
    const email = typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
    const name = typeof user.name === "string" && user.name.trim() ? user.name.trim() : email || "Người dùng";
    const store = extractUserActivityStore(user);

    const lastSeenMs = store.lastSeenAt ? new Date(store.lastSeenAt).getTime() : 0;
    const isOnline = Boolean(
      store.lastSeenAt &&
        !Number.isNaN(lastSeenMs) &&
        nowMs - lastSeenMs <= ONLINE_WINDOW_MS &&
        store.currentSegment !== null,
    );

    let todayDurationSec = 0;
    let weekDurationSec = 0;
    let totalDurationSec = 0;
    const workMap = new Map<string, ActivityTaskWorkSummary>();

    for (const seg of store.segments) {
      if (seg.kind === "login" || seg.kind === "logout") continue;
      const dur = Math.max(0, Number(seg.durationSec) || 0);
      const startMs = new Date(seg.startedAt).getTime();
      totalDurationSec += dur;
      if (!Number.isNaN(startMs)) {
        if (vnDayKey(startMs) === todayKey) todayDurationSec += dur;
        if (startMs >= weekAgoMs) weekDurationSec += dur;
      }

      if (
        seg.kind === "code_task" ||
        seg.kind === "erd_task" ||
        seg.kind === "diagram" ||
        seg.kind === "closure"
      ) {
        const workKey = `${seg.kind}:${seg.targetId || seg.path}`;
        const existing = workMap.get(workKey);
        if (existing) {
          existing.totalDurationSec += dur;
          existing.sessionCount += 1;
          if (seg.startedAt < existing.firstAt) existing.firstAt = seg.startedAt;
          if (seg.endedAt > existing.lastAt) {
            existing.lastAt = seg.endedAt;
            if (seg.note) existing.latestNote = seg.note;
          }
        } else {
          workMap.set(workKey, {
            key: workKey,
            kind: seg.kind,
            targetId: seg.targetId ?? null,
            path: seg.path,
            title: seg.title,
            totalDurationSec: dur,
            sessionCount: 1,
            firstAt: seg.startedAt,
            lastAt: seg.endedAt,
            ...(seg.note ? { latestNote: seg.note } : {}),
          });
        }
      }
    }

    const taskWorkSummaries = Array.from(workMap.values()).sort(
      (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
    );

    const recentTaskEvents = (tasksByAssignee.get(id) ?? [])
      .sort((a, b) => {
        const atA = new Date(a.lastRunAt || a.submittedAt || a.acceptedAt || a.updatedAt).getTime();
        const atB = new Date(b.lastRunAt || b.submittedAt || b.acceptedAt || b.updatedAt).getTime();
        return atB - atA;
      })
      .slice(0, 60);

    return {
      id,
      name,
      email,
      image: resolveUserAvatar({ id, email, name, image: user.image }),
      createdAt: toIso(user.createdAt) ?? new Date().toISOString(),
      isSelf: id === currentUserId || isActivityAdminEmail(email),
      isOnline,
      lastLoginAt: store.lastLoginAt,
      lastSeenAt: store.lastSeenAt,
      currentSegment: isOnline ? store.currentSegment : null,
      todayDurationSec,
      weekDurationSec,
      totalDurationSec,
      segmentCount: store.segments.length,
      segments: store.segments,
      taskWorkSummaries,
      recentTaskEvents,
    };
  });

  accounts.sort((a, b) => {
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
    const seenA = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
    const seenB = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
    if (seenA !== seenB) return seenB - seenA;
    return a.name.localeCompare(b.name, "vi");
  });

  return {
    generatedAt: new Date(nowMs).toISOString(),
    accounts,
  };
}
