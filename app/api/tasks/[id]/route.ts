import { ObjectId } from "mongodb";
import { currentOwnerId } from "@/lib/current-user";
import { getDatabase } from "@/lib/mongodb";

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
  status: "draft" | "invited" | "accepted" | "declined";
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
    status: task.status,
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
  return getDatabase().collection<AssignmentDoc>("tasks").findOne({
    _id: new ObjectId(id),
    $or: [{ createdById: ownerId }, { assignedToId: ownerId }],
  });
}

export async function GET(_request: Request, { params }: RouteContext) {
  const ownerId = await currentOwnerId();
  if (!ownerId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const task = await loadAuthorizedTask(id, ownerId);
    if (!task) return Response.json({ error: "Không tìm thấy bài tập." }, { status: 404 });
    return Response.json({ task: serializeTask(task), viewerRole: task.createdById.equals(ownerId) ? "creator" : "assignee" });
  } catch {
    return Response.json({ error: "Không thể tải bài tập. Kiểm tra kết nối MongoDB." }, { status: 503 });
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
    const database = getDatabase();
    const tasks = database.collection<AssignmentDoc>("tasks");
    const task = await loadAuthorizedTask(id, ownerId);
    if (!task) return Response.json({ error: "Không tìm thấy bài tập." }, { status: 404 });
    const taskId = new ObjectId(id);
    const action = body.action;

    if (action === "assign") {
      if (!task.createdById.equals(ownerId)) return Response.json({ error: "Chỉ người tạo đề mới có thể giao bài." }, { status: 403 });
      if (task.status !== "draft") return Response.json({ error: "Chỉ có thể giao bài đang ở trạng thái nháp." }, { status: 409 });
      const recipientId = typeof body.assignedToId === "string" && /^[0-9a-f]{24}$/i.test(body.assignedToId)
        ? new ObjectId(body.assignedToId)
        : null;
      if (!recipientId) return Response.json({ error: "Hãy chọn một tài khoản nhận bài." }, { status: 400 });
      if (recipientId.equals(ownerId)) return Response.json({ error: "Bạn không thể giao bài cho chính mình." }, { status: 400 });
      const recipient = await database.collection<{ _id: ObjectId; name?: string; email?: string }>("users")
        .findOne({ _id: recipientId }, { projection: { _id: 1, name: 1, email: 1 } });
      if (!recipient?.email) return Response.json({ error: "Tài khoản nhận không còn tồn tại." }, { status: 404 });

      const now = new Date();
      const result = await tasks.updateOne(
        { _id: taskId, createdById: ownerId, status: "draft" },
        { $set: { assignedToId: recipient._id, assignedToName: recipient.name || recipient.email, assignedToEmail: recipient.email, status: "invited", updatedAt: now } },
      );
      if (!result.modifiedCount) return Response.json({ error: "Đề bài vừa được giao hoặc thay đổi ở nơi khác. Hãy tải lại trang." }, { status: 409 });
      return Response.json({ ok: true });
    }

    if (action === "accept") {
      if (!task.assignedToId?.equals(ownerId)) return Response.json({ error: "Chỉ người nhận mới có thể chấp nhận bài." }, { status: 403 });
      if (task.status === "accepted" && task.diagramId) return Response.json({ ok: true, diagramId: task.diagramId.toString() });
      if (task.status !== "invited") return Response.json({ error: "Lời mời này đã được xử lý." }, { status: 409 });

      const now = new Date();
      const diagram = await database.collection("diagrams").insertOne({
        ownerId,
        name: task.title,
        taskId,
        entities: [],
        relations: [],
        decorations: [],
        createdAt: now,
        updatedAt: now,
      });
      let updated;
      try {
        updated = await tasks.updateOne(
          { _id: taskId, assignedToId: ownerId, status: "invited" },
          { $set: { status: "accepted", diagramId: diagram.insertedId, acceptedAt: now, updatedAt: now } },
        );
      } catch (error) {
        await database.collection("diagrams").deleteOne({ _id: diagram.insertedId, ownerId, taskId });
        throw error;
      }
      if (!updated.modifiedCount) {
        await database.collection("diagrams").deleteOne({ _id: diagram.insertedId, ownerId, taskId });
        const latest = await tasks.findOne({ _id: taskId, assignedToId: ownerId });
        if (latest?.status === "accepted" && latest.diagramId) return Response.json({ ok: true, diagramId: latest.diagramId.toString() });
        return Response.json({ error: "Bài tập vừa được xử lý ở nơi khác. Hãy tải lại trang." }, { status: 409 });
      }
      return Response.json({ ok: true, diagramId: diagram.insertedId.toString() });
    }

    if (action === "decline") {
      if (!task.assignedToId?.equals(ownerId)) return Response.json({ error: "Chỉ người nhận mới có thể từ chối bài." }, { status: 403 });
      if (task.status === "declined") return Response.json({ ok: true });
      if (task.status !== "invited") return Response.json({ error: "Bài tập đã được chấp nhận, không thể từ chối." }, { status: 409 });
      const result = await tasks.updateOne({ _id: taskId, assignedToId: ownerId, status: "invited" }, { $set: { status: "declined", updatedAt: new Date() } });
      if (result.modifiedCount) return Response.json({ ok: true });
      const latest = await tasks.findOne({ _id: taskId, assignedToId: ownerId }, { projection: { status: 1 } });
      if (latest?.status === "declined") return Response.json({ ok: true });
      return Response.json({ error: "Bài tập vừa được chấp nhận ở nơi khác." }, { status: 409 });
    }

    if (action === "submit") {
      if (!task.assignedToId?.equals(ownerId)) return Response.json({ error: "Chỉ người nhận mới có thể nộp bài." }, { status: 403 });
      if (task.status !== "accepted" || !task.diagramId) return Response.json({ error: "Hãy chấp nhận bài tập trước khi nộp." }, { status: 409 });
      const diagram = await database.collection("diagrams").findOne({ _id: task.diagramId, ownerId, taskId });
      if (!diagram) return Response.json({ error: "Không tìm thấy sơ đồ của bài tập." }, { status: 404 });

      const snapshot: Snapshot = {
        version: (task.submission?.version ?? 0) + 1,
        submittedAt: new Date(),
        diagramName: typeof diagram.name === "string" ? diagram.name : task.title,
        entities: Array.isArray(diagram.entities) ? diagram.entities : [],
        relations: Array.isArray(diagram.relations) ? diagram.relations : [],
        decorations: Array.isArray(diagram.decorations) ? diagram.decorations : [],
      };
      if (JSON.stringify(snapshot).length > 8_000_000) return Response.json({ error: "Bài nộp vượt quá dung lượng cho phép." }, { status: 413 });

      const submissionGuard = task.submission
        ? { "submission.version": task.submission.version }
        : { submission: { $exists: false } };
      const result = await tasks.updateOne(
        { _id: taskId, assignedToId: ownerId, status: "accepted", ...submissionGuard },
        { $set: { submission: snapshot, grade: null, updatedAt: snapshot.submittedAt } },
      );
      if (!result.modifiedCount) return Response.json({ error: "Bài nộp vừa được cập nhật ở nơi khác. Hãy tải lại trang." }, { status: 409 });
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
      const result = await tasks.updateOne(
        { _id: taskId, createdById: ownerId, "submission.version": task.submission.version },
        { $set: { grade, updatedAt: gradedAt } },
      );
      if (!result.modifiedCount) return Response.json({ error: "Bài nộp vừa thay đổi. Hãy tải lại trước khi chấm." }, { status: 409 });
      return Response.json({ ok: true, grade });
    }

    return Response.json({ error: "Thao tác không hợp lệ." }, { status: 400 });
  } catch {
    return Response.json({ error: "Không thể cập nhật bài tập. Kiểm tra kết nối MongoDB." }, { status: 503 });
  }
}
