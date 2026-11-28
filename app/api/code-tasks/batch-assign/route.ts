import { ObjectId } from "mongodb";
import { findAppDocument, listAppDocuments, writeAppDocument, type AppDocument } from "@/lib/app-data";
import { sanitizeCodeBundle } from "@/lib/code-grader";
import type { CodeBundle, CodeCriterion } from "@/lib/code-task-types";
import { currentOwnerId } from "@/lib/current-user";
import { isMailConfigured, sendTasksAssignedEmail } from "@/lib/mailer";
import { getDatabase } from "@/lib/mongodb";
import { parseDueAtInput, resolveAssignRecipients } from "@/lib/task-assign";

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
    const parsedDue = parseDueAtInput(body.dueAt);
    if (parsedDue.error) {
      return Response.json({ error: parsedDue.error }, { status: 400 });
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

    const existingCreated = await listAppDocuments<
      CodeTaskDoc & AppDocument & { sourceTaskId?: ObjectId; assignedToId?: ObjectId }
    >(
      "tasks",
      { ownerId: ownerId.toString() },
      () => tasksCol.find({ createdById: ownerId, taskType: "code", status: { $ne: "draft" } }).toArray() as Promise<Array<CodeTaskDoc & AppDocument>>,
    );
    const activePairKeys = new Set(
      existingCreated
        .filter((d) => d.taskType === "code" && (d.status === "invited" || d.status === "accepted") && d.sourceTaskId && d.assignedToId)
        .map((d) => `${d.sourceTaskId!.toString()}::${d.assignedToId!.toString()}`),
    );

    const now = new Date();
    const writes: Promise<unknown>[] = [];
    const recipientBatches = new Map<
      string,
      {
        toEmail: string;
        toName: string;
        assignerName: string;
        assignerEmail: string;
        tasks: Array<{ id: string; title: string; category?: string; difficulty?: string; dueAt?: Date | null }>;
      }
    >();

    for (const draft of validDrafts) {
      for (const recipient of resolved.recipients) {
        const pairKey = `${draft._id.toString()}::${recipient._id.toString()}`;
        if (activePairKeys.has(pairKey)) continue;
        activePairKeys.add(pairKey);
        const assignmentId = new ObjectId();
        const assignmentIdStr = assignmentId.toString();
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
            ...(parsedDue.dueAt ? { dueAt: parsedDue.dueAt } : {}),
            createdAt: now,
            updatedAt: now,
          }),
        );
        const recKey = recipient._id.toString();
        const entry = recipientBatches.get(recKey) ?? {
          toEmail: recipient.email,
          toName: recipient.name,
          assignerName: draft.createdByName,
          assignerEmail: draft.createdByEmail,
          tasks: [],
        };
        entry.tasks.push({
          id: assignmentIdStr,
          title: draft.title,
          category: draft.category,
          difficulty: draft.difficulty,
          dueAt: parsedDue.dueAt,
        });
        recipientBatches.set(recKey, entry);
      }
    }

    await Promise.all(writes);
    const mailResults = await Promise.all(
      Array.from(recipientBatches.values()).map((batch) =>
        sendTasksAssignedEmail({
          toEmail: batch.toEmail,
          toName: batch.toName,
          assignerName: batch.assignerName,
          assignerEmail: batch.assignerEmail,
          taskKind: "code",
          tasks: batch.tasks,
        }),
      ),
    );
    const emailSentCount = mailResults.filter((r) => r.sent).length;

    return Response.json(
      {
        ok: true,
        assignedTasks: validDrafts.length,
        recipientCount: resolved.recipients.length,
        totalCreated: writes.length,
        emailSentCount,
        mailConfigured: isMailConfigured(),
      },
      { status: 201 },
    );
  } catch {
    return Response.json({ error: "Không thể giao hàng loạt bài tập code." }, { status: 503 });
  }
}
