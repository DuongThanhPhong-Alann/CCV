import { ObjectId } from "mongodb";
import { deleteAppDocument, findAppDocument, listAppDocuments, patchAppDocument, writeAppDocument, type AppDocument } from "@/lib/app-data";
import { currentOwnerId } from "@/lib/current-user";
import { isMailConfigured, sendDueDateUpdatedEmail, sendTaskGradedEmail, sendTasksAssignedEmail } from "@/lib/mailer";
import { getDatabase } from "@/lib/mongodb";
import { parseDueAtInput, resolveAssignRecipients } from "@/lib/task-assign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type Snapshot = {
  version: number;
  submittedAt: Date;
  diagramName: string;
  entities: unknown[];
  relations: unknown[];
  decorations: unknown[];
};
type AssignmentDoc = {
  title: string;
  description: string;
  createdById: ObjectId;
  createdByName: string;
  createdByEmail: string;
  assignedToId?: ObjectId;
  assignedToName?: string;
  assignedToEmail?: string;
  sourceTaskId?: ObjectId;
  status: "draft" | "invited" | "accepted" | "declined";
  dueAt?: Date | string | null;
  diagramId?: ObjectId;
  acceptedAt?: Date;
  submission?: Snapshot;
  grade?: { score: number; feedback: string; gradedAt: Date; submissionVersion: number } | null;
  createdAt: Date;
  updatedAt: Date;
};

function serializeTask(task: AssignmentDoc & { _id: ObjectId }) {
  return {
    id: task._id.toString(),
    title: task.title,
    description: task.description,
    createdById: task.createdById.toString(),
    createdByName: task.createdByName,
    createdByEmail: task.createdByEmail,
    assignedToId: task.assignedToId?.toString() ?? null,
    assignedToName: task.assignedToName ?? null,
    assignedToEmail: task.assignedToEmail ?? null,
    sourceTaskId: task.sourceTaskId?.toString() ?? null,
    status: task.status,
    dueAt: task.dueAt instanceof Date ? task.dueAt.toISOString() : typeof task.dueAt === "string" ? task.dueAt : null,
    diagramId: task.diagramId?.toString() ?? null,
    acceptedAt: task.acceptedAt ?? null,
    submission: task.submission ?? null,
    grade: task.grade ?? null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

async function loadAuthorizedTask(id: string, ownerId: ObjectId) {
  if (!/^[0-9a-f]{24}$/i.test(id)) return null;
  const task = await findAppDocument<AssignmentDoc & AppDocument>("tasks", id, () => getDatabase().collection<AssignmentDoc>("tasks").findOne({ _id: new ObjectId(id) }));
  if (!task || (!task.createdById.equals(ownerId) && !task.assignedToId?.equals(ownerId))) return null;
  return task;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const ownerId = await currentOwnerId();
  if (!ownerId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const task = await loadAuthorizedTask(id, ownerId);
    if (!task) return Response.json({ error: "Không tìm thấy bài tập." }, { status: 404 });
    const isCreator = task.createdById.equals(ownerId);
    const deliveries = isCreator && task.status === "draft"
      ? await listAppDocuments<AssignmentDoc & AppDocument>("tasks", { sourceId: task._id.toString(), ownerId: ownerId.toString() }, () => getDatabase().collection<AssignmentDoc>("tasks")
          .find({ sourceTaskId: task._id, createdById: ownerId }, { projection: {
            title: 1, description: 1, createdById: 1, createdByName: 1, createdByEmail: 1,
            assignedToId: 1, assignedToName: 1, assignedToEmail: 1, sourceTaskId: 1,
            status: 1, dueAt: 1, diagramId: 1, "submission.version": 1, "submission.submittedAt": 1,
            "grade.score": 1, "grade.submissionVersion": 1, createdAt: 1, updatedAt: 1,
          } }).sort({ updatedAt: -1 }).toArray())
      : [];
    return Response.json({
      task: {
        ...serializeTask(task),
        assignedCount: deliveries.length,
        deliveries: deliveries.map((delivery) => ({
          id: delivery._id.toString(),
          assignedToName: delivery.assignedToName ?? null,
          assignedToEmail: delivery.assignedToEmail ?? null,
          status: delivery.status,
          dueAt: delivery.dueAt instanceof Date ? delivery.dueAt.toISOString() : typeof delivery.dueAt === "string" ? delivery.dueAt : null,
          submission: delivery.submission ? { version: delivery.submission.version, submittedAt: delivery.submission.submittedAt } : null,
          grade: delivery.grade ? { score: delivery.grade.score, submissionVersion: delivery.grade.submissionVersion } : null,
          updatedAt: delivery.updatedAt,
        })),
      },
      viewerRole: isCreator ? "creator" : "assignee",
    });
  } catch {
    return Response.json({ error: "Không thể tải bài tập. Kiểm tra kết nối Supabase hoặc MongoDB." }, { status: 503 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const ownerId = await currentOwnerId();
  if (!ownerId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f]{24}$/i.test(id)) return Response.json({ error: "Không tìm thấy bài tập." }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  try {
    const task = await loadAuthorizedTask(id, ownerId);
    if (!task) return Response.json({ error: "Không tìm thấy bài tập." }, { status: 404 });
    const taskId = new ObjectId(id);
    const action = body.action;

    if (action === "saveAsDraft") {
      if (!task.createdById.equals(ownerId)) return Response.json({ error: "Chỉ người giao bài mới có thể lưu đề vào kho." }, { status: 403 });
      if (task.status === "draft") return Response.json({ ok: true, id: taskId.toString() });
      const now = new Date();
      const draftId = new ObjectId();
      await writeAppDocument("tasks", {
        _id: draftId,
        title: task.title,
        description: task.description,
        createdById: task.createdById,
        createdByName: task.createdByName,
        createdByEmail: task.createdByEmail,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      });
      return Response.json({ ok: true, id: draftId.toString() }, { status: 201 });
    }

    if (action === "assign") {
      if (!task.createdById.equals(ownerId)) return Response.json({ error: "Chỉ người tạo đề mới có thể giao bài." }, { status: 403 });
      if (task.status !== "draft") return Response.json({ error: "Chỉ có thể giao bài đang ở trạng thái nháp." }, { status: 409 });

      const resolved = await resolveAssignRecipients(body, ownerId);
      if (resolved.error || resolved.recipients.length === 0) {
        return Response.json({ error: resolved.error || "Hãy chọn ít nhất một tài khoản nhận bài." }, { status: resolved.status ?? 400 });
      }
      const parsedDue = parseDueAtInput(body.dueAt);
      if (parsedDue.error) {
        return Response.json({ error: parsedDue.error }, { status: 400 });
      }

      const now = new Date();
      const createdIds: string[] = [];
      const mailPromises: Promise<{ sent: boolean }>[] = [];
      for (const recipient of resolved.recipients) {
        const assignmentId = new ObjectId();
        await writeAppDocument("tasks", {
          _id: assignmentId,
          title: task.title,
          description: task.description,
          createdById: task.createdById,
          createdByName: task.createdByName,
          createdByEmail: task.createdByEmail,
          assignedToId: recipient._id,
          assignedToName: recipient.name,
          assignedToEmail: recipient.email,
          sourceTaskId: taskId,
          status: "invited",
          ...(parsedDue.dueAt ? { dueAt: parsedDue.dueAt } : {}),
          createdAt: now,
          updatedAt: now,
        });
        const createdId = assignmentId.toString();
        createdIds.push(createdId);
        mailPromises.push(
          sendTasksAssignedEmail({
            toEmail: recipient.email,
            toName: recipient.name,
            assignerName: task.createdByName,
            assignerEmail: task.createdByEmail,
            taskKind: "erd",
            tasks: [{ id: createdId, title: task.title, dueAt: parsedDue.dueAt }],
          }),
        );
      }
      const mailResults = await Promise.all(mailPromises);
      const emailSentCount = mailResults.filter((r) => r.sent).length;
      return Response.json(
        {
          ok: true,
          id: createdIds[0],
          ids: createdIds,
          assignedCount: createdIds.length,
          dueAt: parsedDue.dueAt ? parsedDue.dueAt.toISOString() : null,
          emailSentCount,
          mailConfigured: isMailConfigured(),
        },
        { status: 201 },
      );
    }

    if (action === "updateDueDate") {
      if (!task.createdById.equals(ownerId)) return Response.json({ error: "Chỉ người giao đề mới có thể chỉnh hạn nộp bài." }, { status: 403 });
      const parsedDue = parseDueAtInput(body.dueAt);
      if (parsedDue.error) return Response.json({ error: parsedDue.error }, { status: 400 });
      const now = new Date();
      const dueValue = parsedDue.dueAt ? parsedDue.dueAt.toISOString() : null;
      const notifyEmail = body.notifyEmail !== false;

      if (task.status === "draft") {
        const deliveries = await listAppDocuments<AssignmentDoc & AppDocument>(
          "tasks",
          { sourceId: taskId.toString(), ownerId: ownerId.toString() },
          () => getDatabase().collection<AssignmentDoc>("tasks").find({ sourceTaskId: taskId, createdById: ownerId }).toArray(),
        );
        const updates = deliveries.filter((d) => d.taskType !== "code" && d.status !== "draft");
        await Promise.all(
          updates.map((d) =>
            patchAppDocument(
              "tasks",
              d._id.toString(),
              { dueAt: parsedDue.dueAt, deadlineReminderForDueAt: null, updatedAt: now },
              { createdById: ownerId.toString() },
            ),
          ),
        );
        let emailSentCount = 0;
        if (notifyEmail) {
          const mailRes = await Promise.all(
            updates
              .filter((d) => Boolean(d.assignedToEmail))
              .map((d) =>
                sendDueDateUpdatedEmail({
                  toEmail: d.assignedToEmail!,
                  toName: d.assignedToName || "Học viên",
                  updaterName: task.createdByName,
                  taskKind: "erd",
                  taskId: d._id.toString(),
                  title: d.title,
                  dueAt: parsedDue.dueAt,
                }),
              ),
          );
          emailSentCount = mailRes.filter((r) => r.sent).length;
        }
        return Response.json({ ok: true, dueAt: dueValue, updatedCount: updates.length, emailSentCount, mailConfigured: isMailConfigured() });
      }

      const updated = await patchAppDocument(
        "tasks",
        taskId.toString(),
        { dueAt: parsedDue.dueAt, deadlineReminderForDueAt: null, updatedAt: now },
        { createdById: ownerId.toString() },
      );
      if (!updated.updated) return Response.json({ error: "Không thể cập nhật hạn nộp bài." }, { status: 409 });
      let emailSent = false;
      if (notifyEmail && task.assignedToEmail) {
        const res = await sendDueDateUpdatedEmail({
          toEmail: task.assignedToEmail,
          toName: task.assignedToName || "Học viên",
          updaterName: task.createdByName,
          taskKind: "erd",
          taskId: taskId.toString(),
          title: task.title,
          dueAt: parsedDue.dueAt,
        });
        emailSent = res.sent;
      }
      return Response.json({ ok: true, dueAt: dueValue, updatedCount: 1, emailSent, mailConfigured: isMailConfigured() });
    }

    if (action === "accept") {
      if (!task.assignedToId?.equals(ownerId)) return Response.json({ error: "Chỉ người nhận mới có thể chấp nhận bài." }, { status: 403 });
      if (task.status === "accepted" && task.diagramId) return Response.json({ ok: true, diagramId: task.diagramId.toString() });
      if (task.status !== "invited") return Response.json({ error: "Lời mời này đã được xử lý." }, { status: 409 });

      const now = new Date();
      const diagramId = new ObjectId();
      await writeAppDocument("diagrams", {
        _id: diagramId,
        ownerId,
        name: task.title,
        taskId,
        entities: [],
        relations: [],
        decorations: [],
        createdAt: now,
        updatedAt: now,
      });
      const updated = await patchAppDocument("tasks", taskId.toString(), { status: "accepted", diagramId, acceptedAt: now, updatedAt: now }, { status: "invited", assignedToId: ownerId.toString() });
      if (!updated.updated) {
        await deleteAppDocument("diagrams", diagramId.toString());
        const latest = await loadAuthorizedTask(taskId.toString(), ownerId);
        if (latest?.status === "accepted" && latest.diagramId) return Response.json({ ok: true, diagramId: latest.diagramId.toString() });
        return Response.json({ error: "Bài tập vừa được xử lý ở nơi khác. Hãy tải lại trang." }, { status: 409 });
      }
      return Response.json({ ok: true, diagramId: diagramId.toString() });
    }

    if (action === "decline") {
      if (!task.assignedToId?.equals(ownerId)) return Response.json({ error: "Chỉ người nhận mới có thể từ chối bài." }, { status: 403 });
      if (task.status === "declined") return Response.json({ ok: true });
      if (task.status !== "invited") return Response.json({ error: "Bài tập đã được chấp nhận, không thể từ chối." }, { status: 409 });
      const updated = await patchAppDocument("tasks", taskId.toString(), { status: "declined", updatedAt: new Date() }, { status: "invited", assignedToId: ownerId.toString() });
      if (updated.updated) return Response.json({ ok: true });
      const latest = await loadAuthorizedTask(taskId.toString(), ownerId);
      if (latest?.status === "declined") return Response.json({ ok: true });
      return Response.json({ error: "Bài tập vừa được chấp nhận ở nơi khác." }, { status: 409 });
    }

    if (action === "submit") {
      if (!task.assignedToId?.equals(ownerId)) return Response.json({ error: "Chỉ người nhận mới có thể nộp bài." }, { status: 403 });
      if (task.status !== "accepted" || !task.diagramId) return Response.json({ error: "Hãy chấp nhận bài tập trước khi nộp." }, { status: 409 });
      const diagram = await findAppDocument<AppDocument & { ownerId: ObjectId; taskId: ObjectId; name?: string; entities?: unknown[]; relations?: unknown[]; decorations?: unknown[] }>("diagrams", task.diagramId.toString(), () => getDatabase().collection("diagrams").findOne({ _id: task.diagramId, ownerId, taskId }));
      if (!diagram || !diagram.ownerId.equals(ownerId) || !diagram.taskId.equals(taskId)) return Response.json({ error: "Không tìm thấy sơ đồ của bài tập." }, { status: 404 });

      const snapshot: Snapshot = {
        version: (task.submission?.version ?? 0) + 1,
        submittedAt: new Date(),
        diagramName: typeof diagram.name === "string" ? diagram.name : task.title,
        entities: Array.isArray(diagram.entities) ? diagram.entities : [],
        relations: Array.isArray(diagram.relations) ? diagram.relations : [],
        decorations: Array.isArray(diagram.decorations) ? diagram.decorations : [],
      };
      if (JSON.stringify(snapshot).length > 8_000_000) return Response.json({ error: "Bài nộp vượt quá dung lượng cho phép." }, { status: 413 });

      const updated = await patchAppDocument("tasks", taskId.toString(), { submission: snapshot, grade: null, updatedAt: snapshot.submittedAt }, {
        status: "accepted",
        assignedToId: ownerId.toString(),
        submissionVersion: task.submission?.version ?? null,
      });
      if (!updated.updated) return Response.json({ error: "Bài nộp vừa được cập nhật ở nơi khác. Hãy tải lại trang." }, { status: 409 });
      return Response.json({ ok: true, version: snapshot.version, submittedAt: snapshot.submittedAt });
    }

    if (action === "grade") {
      if (!task.createdById.equals(ownerId)) return Response.json({ error: "Chỉ người giao bài mới có thể chấm điểm." }, { status: 403 });
      if (!task.submission) return Response.json({ error: "Người nhận chưa nộp bài." }, { status: 409 });
      const score = typeof body.score === "number" ? body.score : Number.NaN;
      const feedback = typeof body.feedback === "string" ? body.feedback.trim() : "";
      if (!Number.isFinite(score) || score < 0 || score > 10) return Response.json({ error: "Điểm phải nằm trong khoảng từ 0 đến 10." }, { status: 400 });
      if (feedback.length > 2000) return Response.json({ error: "Nhận xét không được dài quá 2000 ký tự." }, { status: 400 });

      const gradedAt = new Date();
      const grade = { score, feedback, gradedAt, submissionVersion: task.submission.version };
      const updated = await patchAppDocument("tasks", taskId.toString(), { grade, updatedAt: gradedAt }, {
        createdById: ownerId.toString(),
        submissionVersion: task.submission.version,
      });
      if (!updated.updated) return Response.json({ error: "Bài nộp vừa thay đổi. Hãy tải lại trước khi chấm." }, { status: 409 });
      let emailSent = false;
      if (task.assignedToEmail) {
        const mailRes = await sendTaskGradedEmail({
          toEmail: task.assignedToEmail,
          toName: task.assignedToName || "Học viên",
          graderName: task.createdByName,
          taskKind: "erd",
          taskId: taskId.toString(),
          title: task.title,
          score,
          feedback,
        });
        emailSent = mailRes.sent;
      }
      return Response.json({ ok: true, grade, emailSent, mailConfigured: isMailConfigured() });
    }

    return Response.json({ error: "Thao tác không hợp lệ." }, { status: 400 });
  } catch {
    return Response.json({ error: "Không thể cập nhật bài tập trong Supabase hoặc MongoDB." }, { status: 503 });
  }
}
