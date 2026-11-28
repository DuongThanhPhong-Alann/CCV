import type { ObjectId } from "mongodb";

type DeliveryLike = {
  _id: ObjectId;
  title?: string;
  sourceTaskId?: ObjectId | string | null;
  assignedToId?: ObjectId | string | null;
  assignedToEmail?: string | null;
  status?: string;
  acceptedAt?: Date | string | null;
  diagramId?: ObjectId | string | null;
  lastRun?: {
    runCount?: number;
    autoGrade?: { passed?: boolean; percentage?: number } | null;
  } | null;
  submission?: {
    version?: number;
    autoGrade?: { passed?: boolean; percentage?: number } | null;
  } | null;
  grade?: { score?: number; submissionVersion?: number } | null;
  updatedAt?: Date | string;
};

function idToStr(val?: ObjectId | string | null): string {
  if (!val) return "";
  return typeof val === "string" ? val : val.toString();
}

function normalizedTitle(title?: string): string {
  return (title ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function deliveryDedupeKey(task: DeliveryLike): string {
  const assignee =
    idToStr(task.assignedToId) ||
    (task.assignedToEmail ?? "").trim().toLowerCase() ||
    task._id.toString();
  const source = idToStr(task.sourceTaskId) || `title:${normalizedTitle(task.title)}`;
  return `${assignee}::${source}`;
}

export function deliveryProgressRank(task: DeliveryLike): number {
  if (task.status === "draft") return 0;
  const autoPassed = Boolean(task.lastRun?.autoGrade?.passed || task.submission?.autoGrade?.passed);
  const gradedLatest = Boolean(
    task.submission &&
      typeof task.submission.version === "number" &&
      task.grade?.submissionVersion === task.submission.version,
  );
  if (autoPassed || gradedLatest) return 5;
  if (task.submission || (task.lastRun?.runCount ?? 0) > 0) return 4;
  if (task.status === "accepted" || Boolean(task.diagramId) || Boolean(task.acceptedAt)) return 3;
  if (task.status === "invited") return 2;
  if (task.status === "declined") return 1;
  return 0;
}

function updatedMs(task: DeliveryLike): number {
  if (!task.updatedAt) return 0;
  const t = task.updatedAt instanceof Date ? task.updatedAt.getTime() : new Date(task.updatedAt).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * When the same task draft was delivered multiple times to the same assignee,
 * keeps the single delivery with the highest student progress (passed/graded > submitted/ran > accepted > invited > declined),
 * breaking ties by latest updatedAt. Preserves descending updatedAt ordering.
 */
export function deduplicateTaskDeliveries<T extends DeliveryLike>(items: T[]): T[] {
  const bestByKey = new Map<string, T>();
  for (const item of items) {
    const key = deliveryDedupeKey(item);
    const existing = bestByKey.get(key);
    if (!existing) {
      bestByKey.set(key, item);
      continue;
    }
    const rankDiff = deliveryProgressRank(item) - deliveryProgressRank(existing);
    if (rankDiff > 0 || (rankDiff === 0 && updatedMs(item) > updatedMs(existing))) {
      bestByKey.set(key, item);
    }
  }
  return Array.from(bestByKey.values()).sort((a, b) => updatedMs(b) - updatedMs(a));
}
