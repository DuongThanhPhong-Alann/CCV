import { ObjectId } from "mongodb";
import { findAppDocument, writeAppDocument, type AppDocument } from "@/lib/app-data";
import { sanitizeCodeBundle } from "@/lib/code-grader";
import type { CodeBundle, CodeCriterion } from "@/lib/code-task-types";
import { currentOwnerId } from "@/lib/current-user";
import { getDatabase } from "@/lib/mongodb";
import { resolveAssignRecipients } from "@/lib/task-assign";

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
  status: string;
};

export async function POST(request: Request) {
  const ownerId = await currentOwnerId();
  if (!ownerId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  const rawTaskIds = Array.isArray(body.taskIds) ? body.taskIds : [];
  const uniqueTaskIds = Array.from(
    new Set(rawTaskIds.filter((id): id is string => typeof id === "string" && /^[0-9a-f]{24}$/i.test(id))),
  ).slice(0, 50);

  if (uniqueTaskIds.length === 0) {
    return Response.json({ error: "Hãy chọn ít nhất một đề bài để giao." }, { status: 400 });
  }

  try {
    const resolved = await resolveAssignRecipients(body, ownerId);
    if (resolved.error || resolved.recipients.length === 0) {
      return Response.json(
        { error: resolved.error || "Hãy chọn ít nhất một người nhận." },
        { status: resolved.status ?? 400 },
      );
    }

    const tasksCol = getDatabase().collection<CodeTaskDoc>("tasks");
    const loadedTasks = await Promise.all(
      uniqueTaskIds.map((id) =>
        findAppDocument<CodeTaskDoc & AppDocument>("tasks", id, () => tasksCol.findOne({ _id: new ObjectId(id) })),
      ),
    );

    const validDrafts = loadedTasks.filter(
      (task): task is CodeTaskDoc & AppDocument =>
        Boolean(
          task &&
            task.taskType === "code" &&
            task.status === "draft" &&
            task.createdById.equals(ownerId) &&
            Array.isArray(task.criteria) &&
            task.criteria.length > 0,
        ),
    );

    if (validDrafts.length === 0) {
      return Response.json({ error: "Không có đề code hợp lệ nào trong kho để giao." }, { status: 400 });
    }

    const now = new Date();
    const writes: Promise<unknown>[] = [];

    for (const draft of validDrafts) {
      for (const recipient of resolved.recipients) {
        const assignmentId = new ObjectId();
        writes.push(
          writeAppDocument("tasks", {
            _id: assignmentId,
            taskType: "code",
            title: draft.title,
            description: draft.description,
            ...(draft.category ? { category: draft.category } : {}),
            ...(draft.difficulty ? { difficulty: draft.difficulty } : {}),
            starterCode: sanitizeCodeBundle(draft.starterCode),
            solutionCode: sanitizeCodeBundle(draft.solutionCode),
            criteria: draft.criteria ?? [],
            passThreshold: typeof draft.passThreshold === "number" ? draft.passThreshold : 100,
            createdById: draft.createdById,
            createdByName: draft.createdByName,
            createdByEmail: draft.createdByEmail,
            assignedToId: recipient._id,
            assignedToName: recipient.name,
            assignedToEmail: recipient.email,
            sourceTaskId: draft._id,
            status: "invited",
            createdAt: now,
            updatedAt: now,
          }),
        );
      }
    }

    await Promise.all(writes);
    return Response.json(
      {
        ok: true,
        assignedTasks: validDrafts.length,
        recipientCount: resolved.recipients.length,
        totalCreated: writes.length,
      },
      { status: 201 },
    );
  } catch {
    return Response.json({ error: "Không thể giao hàng loạt bài tập code." }, { status: 503 });
  }
}
