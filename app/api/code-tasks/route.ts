import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import { listAppDocuments, writeAppDocument, type AppDocument } from "@/lib/app-data";
import { authOptions } from "@/lib/auth-options";
import { resolveUserAvatar } from "@/lib/avatars";
import { sanitizeCodeBundle, sanitizeCriteria } from "@/lib/code-grader";
import type {
  CodeAutoGradeResult,
  CodeBundle,
  CodeCriterion,
  CodeRunSnapshot,
  CodeSubmission,
} from "@/lib/code-task-types";
import { currentOwnerId } from "@/lib/current-user";
import { getDatabase } from "@/lib/mongodb";
import { deduplicateTaskDeliveries } from "@/lib/task-dedupe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CodeTaskDoc = {
  taskType?: string;
  title: string;
  description: string;
  category?: string;
  difficulty?: string;
  starterCode?: CodeBundle;
  solutionCode?: CodeBundle;
  criteria?: CodeCriterion[];
  passThreshold?: number;
  createdById: ObjectId;
  createdByName: string;
  createdByEmail: string;
  assignedToId?: ObjectId;
  assignedToName?: string;
  assignedToEmail?: string;
  sourceTaskId?: ObjectId;
  status: "draft" | "invited" | "accepted" | "declined";
  dueAt?: Date | string | null;
  acceptedAt?: Date;
  lastRun?: CodeRunSnapshot | null;
  submission?: CodeSubmission | null;
  grade?: { score: number; feedback: string; gradedAt: Date; submissionVersion: number; auto?: boolean } | null;
  createdAt: Date;
  updatedAt: Date;
};

function summarizeAutoGrade(autoGrade?: CodeAutoGradeResult | null) {
  if (!autoGrade) return null;
  return {
    percentage: autoGrade.percentage,
    earnedPoints: typeof autoGrade.earnedPoints === "number" ? autoGrade.earnedPoints : autoGrade.percentage,
    totalPoints: typeof autoGrade.totalPoints === "number" ? autoGrade.totalPoints : 100,
    passed: autoGrade.passed,
    passedCount: autoGrade.passedCount,
    totalCount: autoGrade.totalCount,
    passThreshold: autoGrade.passThreshold,
  };
}

function serializeCodeTaskSummary(task: CodeTaskDoc & { _id: ObjectId }, includeSolution: boolean) {
  return {
    id: task._id.toString(),
    taskType: "code" as const,
    title: task.title,
    description: task.description,
    ...(task.category ? { category: task.category } : {}),
    ...(task.difficulty ? { difficulty: task.difficulty } : {}),
    starterCode: sanitizeCodeBundle(task.starterCode),
    ...(includeSolution ? { solutionCode: sanitizeCodeBundle(task.solutionCode) } : {}),
    criteria: Array.isArray(task.criteria) ? task.criteria : [],
    passThreshold: typeof task.passThreshold === "number" ? task.passThreshold : 100,
    createdById: task.createdById.toString(),
    createdByName: task.createdByName,
    createdByEmail: task.createdByEmail,
    assignedToId: task.assignedToId?.toString() ?? null,
    assignedToName: task.assignedToName ?? null,
    assignedToEmail: task.assignedToEmail ?? null,
    sourceTaskId: task.sourceTaskId?.toString() ?? null,
    status: task.status,
    dueAt: task.dueAt instanceof Date ? task.dueAt.toISOString() : typeof task.dueAt === "string" ? task.dueAt : null,
    lastRun: task.lastRun
      ? {
          runCount: task.lastRun.runCount,
          ranAt: task.lastRun.ranAt,
          autoGrade: summarizeAutoGrade(task.lastRun.autoGrade),
        }
      : null,
    submission: task.submission
      ? {
          version: task.submission.version,
          submittedAt: task.submission.submittedAt,
          runCount: task.submission.runCount,
          autoGrade: summarizeAutoGrade(task.submission.autoGrade),
        }
      : null,
    grade: task.grade ?? null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export async function GET() {
  const ownerId = await currentOwnerId();
  if (!ownerId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const tasks = getDatabase().collection<CodeTaskDoc>("tasks");
    const [receivedRaw, createdRaw] = await Promise.all([
      listAppDocuments<CodeTaskDoc & AppDocument>(
        "tasks",
        { assignedToId: ownerId.toString() },
        () => tasks.find({ assignedToId: ownerId, taskType: "code" }).sort({ updatedAt: -1 }).toArray(),
      ),
      listAppDocuments<CodeTaskDoc & AppDocument>(
        "tasks",
        { ownerId: ownerId.toString() },
        () => tasks.find({ createdById: ownerId, taskType: "code" }).sort({ updatedAt: -1 }).toArray(),
      ),
    ]);

    const received = deduplicateTaskDeliveries(receivedRaw.filter((task) => task.taskType === "code"));
    const created = createdRaw.filter((task) => task.taskType === "code");
    const sent = deduplicateTaskDeliveries(created.filter((task) => task.status !== "draft"));
    const drafts = created.filter((task) => task.status === "draft");

    const userAvatarById = new Map<string, string>();
    if (sent.length > 0) {
      try {
        const usersRaw = await listAppDocuments<AppDocument & { name?: string; email?: string; image?: string | null }>(
          "users",
          {},
          () => getDatabase().collection("users").find({}, { projection: { _id: 1, name: 1, email: 1, image: 1 } }).toArray(),
          2000,
        );
        for (const u of usersRaw) {
          const uid = u._id.toString();
          userAvatarById.set(
            uid,
            resolveUserAvatar({ id: uid, email: u.email, name: u.name, image: u.image }),
          );
        }
      } catch {
        // fall back to deterministic avatar resolution
      }
    }

    const statsBySource = new Map<string, { assignedCount: number; passedCount: number }>();
    for (const task of sent) {
      if (!task.sourceTaskId) continue;
      const sourceId = task.sourceTaskId.toString();
      const entry = statsBySource.get(sourceId) ?? { assignedCount: 0, passedCount: 0 };
      entry.assignedCount += 1;
      const isPassed = Boolean(task.submission?.autoGrade?.passed || task.lastRun?.autoGrade?.passed);
      if (isPassed) entry.passedCount += 1;
      statsBySource.set(sourceId, entry);
    }

    return Response.json({
      received: received.map((task) => serializeCodeTaskSummary(task, false)),
      sent: sent.map((task) => {
        const serialized = serializeCodeTaskSummary(task, true);
        const assignedToImage =
          (serialized.assignedToId ? userAvatarById.get(serialized.assignedToId) : null) ??
          resolveUserAvatar({
            id: serialized.assignedToId,
            email: serialized.assignedToEmail,
            name: serialized.assignedToName,
          });
        return { ...serialized, assignedToImage };
      }),
      drafts: drafts.map((task) => {
        const stat = statsBySource.get(task._id.toString()) ?? { assignedCount: 0, passedCount: 0 };
        return {
          ...serializeCodeTaskSummary(task, true),
          assignedCount: stat.assignedCount,
          passedDeliveryCount: stat.passedCount,
        };
      }),
    }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch {
    return Response.json({ error: "Không thể tải danh sách bài tập code." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const ownerId = await currentOwnerId();
  if (!ownerId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const session = await getServerSession(authOptions);

  let body: {
    title?: unknown;
    description?: unknown;
    category?: unknown;
    difficulty?: unknown;
    starterCode?: unknown;
    solutionCode?: unknown;
    criteria?: unknown;
    passThreshold?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Thông tin bài tập không hợp lệ." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim().slice(0, 80) : "";
  const difficulty = typeof body.difficulty === "string" ? body.difficulty.trim().slice(0, 40) : "";
  if (title.length < 3 || title.length > 140) {
    return Response.json({ error: "Tên bài tập cần có từ 3 đến 140 ký tự." }, { status: 400 });
  }
  if (description.length < 5 || description.length > 8000) {
    return Response.json({ error: "Đề bài cần có từ 5 đến 8000 ký tự." }, { status: 400 });
  }

  const starterCode = sanitizeCodeBundle(body.starterCode);
  const solutionCode = sanitizeCodeBundle(body.solutionCode);
  const criteria = sanitizeCriteria(body.criteria);
  const rawThreshold = typeof body.passThreshold === "number" ? body.passThreshold : Number(body.passThreshold);
  const passThreshold = Number.isFinite(rawThreshold) ? Math.min(100, Math.max(1, Math.round(rawThreshold))) : 100;

  if (JSON.stringify({ starterCode, solutionCode, criteria }).length > 1_000_000) {
    return Response.json({ error: "Nội dung code vượt quá dung lượng cho phép." }, { status: 413 });
  }

  try {
    const now = new Date();
    const id = new ObjectId();
    await writeAppDocument("tasks", {
      _id: id,
      taskType: "code",
      title,
      description,
      ...(category ? { category } : {}),
      ...(difficulty ? { difficulty } : {}),
      starterCode,
      solutionCode,
      criteria,
      passThreshold,
      createdById: ownerId,
      createdByName: session?.user?.name || session?.user?.email || "Người dùng",
      createdByEmail: session?.user?.email || "",
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    return Response.json({ id: id.toString(), status: "draft" }, { status: 201 });
  } catch {
    return Response.json({ error: "Không thể lưu đề bài code." }, { status: 503 });
  }
}
