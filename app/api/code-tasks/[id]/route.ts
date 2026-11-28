import { ObjectId } from "mongodb";
import { recordUserActivity } from "@/lib/activity-logger";
import {
  deleteAppDocument,
  findAppDocument,
  listAppDocuments,
  patchAppDocument,
  writeAppDocument,
  type AppDocument,
} from "@/lib/app-data";
import { sanitizeCodeBundle, sanitizeCriteria } from "@/lib/code-grader";
import type {
  CodeAutoGradeResult,
  CodeBundle,
  CodeCriterion,
  CodeCriterionResult,
  CodeRunSnapshot,
  CodeSubmission,
} from "@/lib/code-task-types";
import { currentOwnerId } from "@/lib/current-user";
import {
  isMailConfigured,
  sendCodePassedNotificationEmails,
  sendDueDateUpdatedEmail,
  sendTaskGradedEmail,
  sendTasksAssignedEmail,
} from "@/lib/mailer";
import { getDatabase } from "@/lib/mongodb";
import { parseDueAtInput, resolveAssignRecipients } from "@/lib/task-assign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

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
  savedCode?: CodeBundle | null;
  lastRun?: CodeRunSnapshot | null;
  submission?: CodeSubmission | null;
  grade?: { score: number; feedback: string; gradedAt: Date; submissionVersion: number; auto?: boolean } | null;
  createdAt: Date;
  updatedAt: Date;
};

function sanitizeAutoGrade(
  raw: unknown,
  taskCriteria: CodeCriterion[],
  passThreshold: number,
): CodeAutoGradeResult {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rawResults = Array.isArray(input.results) ? input.results : [];
  const byId = new Map<string, Record<string, unknown>>();
  for (const item of rawResults) {
    if (item && typeof item === "object") {
      const rec = item as Record<string, unknown>;
      if (typeof rec.criterionId === "string") byId.set(rec.criterionId, rec);
    }
  }

  const results: CodeCriterionResult[] = taskCriteria.map((criterion) => {
    const match = byId.get(criterion.id);
    const passed = Boolean(match?.passed);
    const actual = typeof match?.actual === "string" ? match.actual.slice(0, 300) : passed ? "Đạt" : "Chưa kiểm tra";
    return {
      criterionId: criterion.id,
      label: criterion.label,
      type: criterion.type,
      passed,
      expected: criterion.expected || (criterion.minCount ? `>= ${criterion.minCount} ${criterion.selector}` : criterion.selector),
      actual,
      weight: criterion.weight > 0 ? criterion.weight : 1,
    };
  });

  const totalWeight = results.reduce((sum, item) => sum + item.weight, 0);
  const earnedWeight = results.reduce((sum, item) => (item.passed ? sum + item.weight : sum), 0);
  const passedCount = results.filter((item) => item.passed).length;
  const percentage = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 100;

  const consoleLogs = Array.isArray(input.consoleLogs)
    ? input.consoleLogs.filter((v): v is string => typeof v === "string").slice(0, 40).map((s) => s.slice(0, 300))
    : [];
  const errors = Array.isArray(input.errors)
    ? input.errors.filter((v): v is string => typeof v === "string").slice(0, 20).map((s) => s.slice(0, 300))
    : [];

  return {
    percentage,
    earnedPoints: Math.round(earnedWeight * 10) / 10,
    totalPoints: Math.round(totalWeight * 10) / 10,
    passed: percentage >= passThreshold,
    passedCount,
    totalCount: results.length,
    passThreshold,
    results,
    consoleLogs,
    errors,
    evaluatedAt: new Date().toISOString(),
  };
}

function serializeCodeTask(task: CodeTaskDoc & { _id: ObjectId }, includeSolution: boolean) {
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
    acceptedAt: task.acceptedAt ?? null,
    savedCode: task.savedCode ? sanitizeCodeBundle(task.savedCode) : null,
    lastRun: task.lastRun ?? null,
    submission: task.submission ?? null,
    grade: task.grade ?? null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

async function loadAuthorizedCodeTask(id: string, ownerId: ObjectId) {
  if (!/^[0-9a-f]{24}$/i.test(id)) return null;
  const task = await findAppDocument<CodeTaskDoc & AppDocument>(
    "tasks",
    id,
    () => getDatabase().collection<CodeTaskDoc>("tasks").findOne({ _id: new ObjectId(id) }),
  );
  if (!task || task.taskType !== "code") return null;
  if (!task.createdById.equals(ownerId) && !task.assignedToId?.equals(ownerId)) return null;
  return task;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const ownerId = await currentOwnerId();
  if (!ownerId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const task = await loadAuthorizedCodeTask(id, ownerId);
    if (!task) return Response.json({ error: "Không tìm thấy bài tập code." }, { status: 404 });
    const isCreator = task.createdById.equals(ownerId);

    const deliveriesRaw = isCreator && task.status === "draft"
      ? await listAppDocuments<CodeTaskDoc & AppDocument>(
          "tasks",
          { sourceId: task._id.toString(), ownerId: ownerId.toString() },
          () =>
            getDatabase()
              .collection<CodeTaskDoc>("tasks")
              .find({ sourceTaskId: task._id, createdById: ownerId, taskType: "code" })
              .sort({ updatedAt: -1 })
              .toArray(),
        )
      : [];
    const deliveries = deliveriesRaw.filter((item) => item.taskType === "code");

    return Response.json({
      task: {
        ...serializeCodeTask(task, isCreator),
        assignedCount: deliveries.length,
        deliveries: deliveries.map((delivery) => ({
          id: delivery._id.toString(),
          assignedToName: delivery.assignedToName ?? null,
          assignedToEmail: delivery.assignedToEmail ?? null,
          status: delivery.status,
          dueAt: delivery.dueAt instanceof Date ? delivery.dueAt.toISOString() : typeof delivery.dueAt === "string" ? delivery.dueAt : null,
          lastRun: delivery.lastRun
            ? {
                percentage: delivery.lastRun.autoGrade.percentage,
                earnedPoints: delivery.lastRun.autoGrade.earnedPoints,
                totalPoints: delivery.lastRun.autoGrade.totalPoints,
                passed: delivery.lastRun.autoGrade.passed,
                passedCount: delivery.lastRun.autoGrade.passedCount,
                totalCount: delivery.lastRun.autoGrade.totalCount,
                runCount: delivery.lastRun.runCount,
                ranAt: delivery.lastRun.ranAt,
              }
            : null,
          submission: delivery.submission
            ? {
                version: delivery.submission.version,
                submittedAt: delivery.submission.submittedAt,
                percentage: delivery.submission.autoGrade.percentage,
                earnedPoints: delivery.submission.autoGrade.earnedPoints,
                totalPoints: delivery.submission.autoGrade.totalPoints,
                passed: delivery.submission.autoGrade.passed,
                passedCount: delivery.submission.autoGrade.passedCount,
                totalCount: delivery.submission.autoGrade.totalCount,
              }
            : null,
          grade: delivery.grade
            ? {
                score: delivery.grade.score,
                submissionVersion: delivery.grade.submissionVersion,
                auto: delivery.grade.auto,
              }
            : null,
          updatedAt: delivery.updatedAt,
        })),
      },
      viewerRole: isCreator ? "creator" : "assignee",
    });
  } catch {
    return Response.json({ error: "Không thể tải bài tập code." }, { status: 503 });
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
    const task = await loadAuthorizedCodeTask(id, ownerId);
    if (!task) return Response.json({ error: "Không tìm thấy bài tập code." }, { status: 404 });
    const taskId = new ObjectId(id);
    const action = body.action;

    if (action === "updateDraft") {
      if (!task.createdById.equals(ownerId)) {
        return Response.json({ error: "Chỉ người tạo đề mới có thể chỉnh sửa đề bài." }, { status: 403 });
      }
      if (task.status !== "draft") {
        return Response.json({ error: "Chỉ có thể chỉnh sửa đề bài đang ở trong kho." }, { status: 409 });
      }

      const title = typeof body.title === "string" ? body.title.trim() : task.title;
      const description = typeof body.description === "string" ? body.description.trim() : task.description;
      if (title.length < 3 || title.length > 140) {
        return Response.json({ error: "Tên bài tập cần có từ 3 đến 140 ký tự." }, { status: 400 });
      }
      if (description.length < 5 || description.length > 8000) {
        return Response.json({ error: "Đề bài cần có từ 5 đến 8000 ký tự." }, { status: 400 });
      }

      const starterCode = body.starterCode !== undefined ? sanitizeCodeBundle(body.starterCode) : sanitizeCodeBundle(task.starterCode);
      const solutionCode = body.solutionCode !== undefined ? sanitizeCodeBundle(body.solutionCode) : sanitizeCodeBundle(task.solutionCode);
      const criteria = body.criteria !== undefined ? sanitizeCriteria(body.criteria) : (task.criteria ?? []);
      const rawThreshold = body.passThreshold !== undefined ? Number(body.passThreshold) : (task.passThreshold ?? 100);
      const passThreshold = Number.isFinite(rawThreshold) ? Math.min(100, Math.max(1, Math.round(rawThreshold))) : 100;

      if (JSON.stringify({ starterCode, solutionCode, criteria }).length > 1_000_000) {
        return Response.json({ error: "Nội dung code vượt quá dung lượng cho phép." }, { status: 413 });
      }

      const updated = await patchAppDocument(
        "tasks",
        taskId.toString(),
        {
          title,
          description,
          starterCode,
          solutionCode,
          criteria,
          passThreshold,
          updatedAt: new Date(),
        },
        { status: "draft", createdById: ownerId.toString() },
      );
      if (!updated.updated) return Response.json({ error: "Không thể cập nhật đề bài." }, { status: 409 });
      return Response.json({ ok: true });
    }

    if (action === "saveAsDraft") {
      if (!task.createdById.equals(ownerId)) return Response.json({ error: "Chỉ người giao bài mới có thể lưu đề vào kho." }, { status: 403 });
      if (task.status === "draft") return Response.json({ ok: true, id: taskId.toString() });
      const now = new Date();
      const draftId = new ObjectId();
      await writeAppDocument("tasks", {
        _id: draftId,
        taskType: "code",
        title: task.title,
        description: task.description,
        starterCode: sanitizeCodeBundle(task.starterCode),
        solutionCode: sanitizeCodeBundle(task.solutionCode),
        criteria: Array.isArray(task.criteria) ? task.criteria : [],
        passThreshold: typeof task.passThreshold === "number" ? task.passThreshold : 100,
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
      if (task.status !== "draft") return Response.json({ error: "Chỉ có thể giao đề đang ở trạng thái trong kho." }, { status: 409 });
      if (!task.criteria?.length) {
        return Response.json({ error: "Đề bài cần có ít nhất 1 tiêu chí chấm tự động trước khi giao." }, { status: 400 });
      }

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
          taskType: "code",
          title: task.title,
          description: task.description,
          ...(task.category ? { category: task.category } : {}),
          ...(task.difficulty ? { difficulty: task.difficulty } : {}),
          starterCode: sanitizeCodeBundle(task.starterCode),
          solutionCode: sanitizeCodeBundle(task.solutionCode),
          criteria: task.criteria ?? [],
          passThreshold: typeof task.passThreshold === "number" ? task.passThreshold : 100,
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
            taskKind: "code",
            tasks: [
              {
                id: createdId,
                title: task.title,
                category: task.category,
                difficulty: task.difficulty,
                dueAt: parsedDue.dueAt,
              },
            ],
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
        const deliveriesRaw = await listAppDocuments<CodeTaskDoc & AppDocument>(
          "tasks",
          { sourceId: taskId.toString(), ownerId: ownerId.toString() },
          () => getDatabase().collection<CodeTaskDoc>("tasks").find({ sourceTaskId: taskId, createdById: ownerId, taskType: "code" }).toArray(),
        );
        const updates = deliveriesRaw.filter((d) => d.taskType === "code" && d.status !== "draft");
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
                  taskKind: "code",
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
          taskKind: "code",
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
      if (task.status === "accepted") return Response.json({ ok: true });
      if (task.status !== "invited") return Response.json({ error: "Lời mời này đã được xử lý." }, { status: 409 });

      const now = new Date();
      const updated = await patchAppDocument(
        "tasks",
        taskId.toString(),
        { status: "accepted", acceptedAt: now, updatedAt: now },
        { status: "invited", assignedToId: ownerId.toString() },
      );
      if (!updated.updated) return Response.json({ error: "Bài tập vừa được xử lý ở nơi khác." }, { status: 409 });
      return Response.json({ ok: true });
    }

    if (action === "decline") {
      if (!task.assignedToId?.equals(ownerId)) return Response.json({ error: "Chỉ người nhận mới có thể từ chối bài." }, { status: 403 });
      if (task.status === "declined") return Response.json({ ok: true });
      if (task.status !== "invited") return Response.json({ error: "Bài tập đã được chấp nhận, không thể từ chối." }, { status: 409 });

      const updated = await patchAppDocument(
        "tasks",
        taskId.toString(),
        { status: "declined", updatedAt: new Date() },
        { status: "invited", assignedToId: ownerId.toString() },
      );
      if (!updated.updated) return Response.json({ error: "Bài tập vừa được xử lý ở nơi khác." }, { status: 409 });
      return Response.json({ ok: true });
    }

    if (action === "saveCode") {
      if (!task.assignedToId?.equals(ownerId)) return Response.json({ error: "Chỉ người làm bài mới có thể lưu code." }, { status: 403 });
      if (task.status !== "accepted") return Response.json({ error: "Hãy chấp nhận bài tập trước khi lưu code." }, { status: 409 });

      const code = sanitizeCodeBundle(body.code);
      if (JSON.stringify(code).length > 500_000) {
        return Response.json({ error: "Mã nguồn vượt quá dung lượng cho phép." }, { status: 413 });
      }
      const now = new Date();
      let updated = await patchAppDocument(
        "tasks",
        taskId.toString(),
        { savedCode: code, updatedAt: now },
        { status: "accepted", assignedToId: ownerId.toString() },
      );
      if (!updated.updated && updated.document?.status === "accepted") {
        updated = await patchAppDocument(
          "tasks",
          taskId.toString(),
          { savedCode: code, updatedAt: now },
          { status: "accepted", assignedToId: ownerId.toString() },
        );
      }
      if (!updated.updated) return Response.json({ error: "Không thể lưu code." }, { status: 409 });
      return Response.json({ ok: true, savedCode: code, savedAt: now.toISOString() });
    }

    if (action === "run") {
      if (!task.assignedToId?.equals(ownerId)) return Response.json({ error: "Chỉ người làm bài mới có thể chạy code." }, { status: 403 });
      if (task.status !== "accepted") return Response.json({ error: "Hãy chấp nhận bài tập trước khi làm bài." }, { status: 409 });

      const code = sanitizeCodeBundle(body.code);
      if (JSON.stringify(code).length > 500_000) {
        return Response.json({ error: "Mã nguồn vượt quá dung lượng cho phép." }, { status: 413 });
      }
      const criteria = Array.isArray(task.criteria) ? task.criteria : [];
      const passThreshold = typeof task.passThreshold === "number" ? task.passThreshold : 100;
      const autoGrade = sanitizeAutoGrade(body.autoGrade, criteria, passThreshold);
      const now = new Date();
      const runCount = (task.lastRun?.runCount ?? 0) + 1;
      const runSnapshot: CodeRunSnapshot = {
        code,
        autoGrade,
        runCount,
        ranAt: now.toISOString(),
      };

      const autoScore = Math.round((autoGrade.percentage / 10) * 10) / 10;
      const autoFeedback = autoGrade.passed
        ? `Tự động chấm (Lần Run #${runCount}): PASS (${autoGrade.earnedPoints}/${autoGrade.totalPoints}đ · ${autoGrade.percentage}% - đạt ${autoGrade.passedCount}/${autoGrade.totalCount} tiêu chí).`
        : `Tự động chấm (Lần Run #${runCount}): CHƯA ĐẠT (${autoGrade.earnedPoints}/${autoGrade.totalPoints}đ · ${autoGrade.percentage}% - đạt ${autoGrade.passedCount}/${autoGrade.totalCount} tiêu chí, yêu cầu >= ${autoGrade.passThreshold}%).`;
      const grade = {
        score: autoScore,
        feedback: autoFeedback,
        gradedAt: now,
        submissionVersion: runCount,
        auto: true,
      };

      const previouslyPassed = Boolean(task.lastRun?.autoGrade?.passed || task.submission?.autoGrade?.passed);
      let updated = await patchAppDocument(
        "tasks",
        taskId.toString(),
        { savedCode: code, lastRun: runSnapshot, grade, updatedAt: now },
        { status: "accepted", assignedToId: ownerId.toString() },
      );
      if (!updated.updated && updated.document?.status === "accepted") {
        updated = await patchAppDocument(
          "tasks",
          taskId.toString(),
          { savedCode: code, lastRun: runSnapshot, grade, updatedAt: now },
          { status: "accepted", assignedToId: ownerId.toString() },
        );
      }
      if (!updated.updated) return Response.json({ error: "Không thể lưu kết quả chạy thử." }, { status: 409 });
      let passEmailSent = false;
      if (!previouslyPassed && autoGrade.passed) {
        const passMailResults = await sendCodePassedNotificationEmails({
          studentEmail: task.assignedToEmail || "",
          studentName: task.assignedToName || "Học viên",
          teacherEmail: task.createdByEmail,
          teacherName: task.createdByName,
          taskId: taskId.toString(),
          title: task.title,
          percentage: autoGrade.percentage,
          passedCount: autoGrade.passedCount,
          totalCount: autoGrade.totalCount,
          earnedPoints: autoGrade.earnedPoints,
          totalPoints: autoGrade.totalPoints,
          runCount,
        });
        passEmailSent = passMailResults.some((r) => r.sent);
      }
      await recordUserActivity({
        userId: ownerId.toString(),
        event: "action",
        kind: "code_task",
        path: `/code-tasks/${taskId.toString()}`,
        targetId: taskId.toString(),
        title: task.title,
        note: `Run #${runCount} · ${autoGrade.passed ? "PASS" : "Chưa đạt"} ${autoGrade.percentage}%`,
      });
      return Response.json({ ok: true, lastRun: runSnapshot, grade, emailSent: passEmailSent });
    }

    if (action === "submit") {
      if (!task.assignedToId?.equals(ownerId)) return Response.json({ error: "Chỉ người làm bài mới có thể nộp bài." }, { status: 403 });
      if (task.status !== "accepted") return Response.json({ error: "Hãy chấp nhận bài tập trước khi nộp." }, { status: 409 });

      const code = sanitizeCodeBundle(body.code);
      if (JSON.stringify(code).length > 500_000) {
        return Response.json({ error: "Bài nộp vượt quá dung lượng cho phép." }, { status: 413 });
      }

      const criteria = Array.isArray(task.criteria) ? task.criteria : [];
      const passThreshold = typeof task.passThreshold === "number" ? task.passThreshold : 100;
      const autoGrade = sanitizeAutoGrade(body.autoGrade, criteria, passThreshold);
      const now = new Date();
      const version = (task.submission?.version ?? 0) + 1;
      const runCount = Math.max(task.lastRun?.runCount ?? 0, 1);

      const submission: CodeSubmission = {
        version,
        submittedAt: now.toISOString(),
        code,
        autoGrade,
        runCount,
      };
      const lastRun: CodeRunSnapshot = {
        code,
        autoGrade,
        runCount,
        ranAt: now.toISOString(),
      };

      const autoScore = Math.round((autoGrade.percentage / 10) * 10) / 10;
      const autoFeedback = autoGrade.passed
        ? `Tự động chấm: PASS (${autoGrade.percentage}% - đạt ${autoGrade.passedCount}/${autoGrade.totalCount} tiêu chí).`
        : `Tự động chấm: CHƯA ĐẠT (${autoGrade.percentage}% - đạt ${autoGrade.passedCount}/${autoGrade.totalCount} tiêu chí, yêu cầu >= ${autoGrade.passThreshold}%).`;

      const grade = {
        score: autoScore,
        feedback: autoFeedback,
        gradedAt: now,
        submissionVersion: version,
        auto: true,
      };

      const updated = await patchAppDocument(
        "tasks",
        taskId.toString(),
        { savedCode: code, submission, lastRun, grade, updatedAt: now },
        {
          status: "accepted",
          assignedToId: ownerId.toString(),
          submissionVersion: task.submission?.version ?? null,
        },
      );
      if (!updated.updated) return Response.json({ error: "Bài nộp vừa được cập nhật ở nơi khác. Hãy tải lại trang." }, { status: 409 });
      await recordUserActivity({
        userId: ownerId.toString(),
        event: "action",
        kind: "code_task",
        path: `/code-tasks/${taskId.toString()}`,
        targetId: taskId.toString(),
        title: task.title,
        note: `Nộp bài v${version} · ${autoGrade.passed ? "PASS" : "Chưa đạt"} ${autoGrade.percentage}%`,
      });
      return Response.json({ ok: true, submission, grade });
    }

    if (action === "grade") {
      if (!task.createdById.equals(ownerId)) return Response.json({ error: "Chỉ người giao bài mới có thể chấm điểm." }, { status: 403 });
      if (!task.lastRun && !task.submission) return Response.json({ error: "Người nhận chưa bấm Run Code lần nào." }, { status: 409 });
      const score = typeof body.score === "number" ? body.score : Number.NaN;
      const feedback = typeof body.feedback === "string" ? body.feedback.trim() : "";
      if (!Number.isFinite(score) || score < 0 || score > 10) return Response.json({ error: "Điểm phải nằm trong khoảng từ 0 đến 10." }, { status: 400 });
      if (feedback.length > 2000) return Response.json({ error: "Nhận xét không được dài quá 2000 ký tự." }, { status: 400 });

      const gradedAt = new Date();
      const latestVersion = task.lastRun?.runCount ?? task.submission?.version ?? 1;
      const grade = { score, feedback, gradedAt, submissionVersion: latestVersion, auto: false };
      const updated = await patchAppDocument(
        "tasks",
        taskId.toString(),
        { grade, updatedAt: gradedAt },
        { createdById: ownerId.toString() },
      );
      if (!updated.updated) return Response.json({ error: "Không thể lưu đánh giá. Hãy tải lại trang." }, { status: 409 });
      let emailSent = false;
      if (task.assignedToEmail) {
        const mailRes = await sendTaskGradedEmail({
          toEmail: task.assignedToEmail,
          toName: task.assignedToName || "Học viên",
          graderName: task.createdByName,
          taskKind: "code",
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
    return Response.json({ error: "Không thể cập nhật bài tập code." }, { status: 503 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const ownerId = await currentOwnerId();
  if (!ownerId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const task = await loadAuthorizedCodeTask(id, ownerId);
    if (!task) return Response.json({ error: "Không tìm thấy bài tập code." }, { status: 404 });
    if (!task.createdById.equals(ownerId)) return Response.json({ error: "Chỉ người tạo đề mới có thể xóa." }, { status: 403 });
    if (task.status !== "draft") return Response.json({ error: "Chỉ có thể xóa đề bài đang ở kho nháp." }, { status: 409 });

    await deleteAppDocument("tasks", id);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Không thể xóa đề bài code." }, { status: 503 });
  }
}
