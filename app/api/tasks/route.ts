import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import { authOptions } from "@/lib/auth-options";
import { currentOwnerId } from "@/lib/current-user";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  submission?: { version: number; submittedAt: Date };
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
    submission: task.submission ?? null,
    grade: task.grade ?? null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export async function GET() {
  const ownerId = await currentOwnerId();
  if (!ownerId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const tasks = getDatabase().collection<AssignmentDoc>("tasks");
    await Promise.all([
      tasks.createIndex({ assignedToId: 1, updatedAt: -1 }),
      tasks.createIndex({ createdById: 1, updatedAt: -1 }),
    ]);
    const summaryProjection = {
      title: 1, description: 1,
      createdById: 1, createdByName: 1, createdByEmail: 1,
      assignedToId: 1, assignedToName: 1, assignedToEmail: 1,
      status: 1, diagramId: 1,
      "submission.version": 1, "submission.submittedAt": 1,
      grade: 1, createdAt: 1, updatedAt: 1,
    };
    const [received, sent, drafts] = await Promise.all([
      tasks.find({ assignedToId: ownerId }, { projection: summaryProjection }).sort({ updatedAt: -1 }).toArray(),
      tasks.find({ createdById: ownerId, status: { $ne: "draft" } }, { projection: summaryProjection }).sort({ updatedAt: -1 }).toArray(),
      tasks.find({ createdById: ownerId, status: "draft" }, { projection: summaryProjection }).sort({ updatedAt: -1 }).toArray(),
    ]);
    return Response.json({
      received: received.map(serializeTask),
      sent: sent.map(serializeTask),
      drafts: drafts.map(serializeTask),
    });
  } catch {
    return Response.json({ error: "Không thể tải bài tập. Kiểm tra kết nối MongoDB." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const ownerId = await currentOwnerId();
  if (!ownerId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const session = await getServerSession(authOptions);

  let body: { title?: unknown; description?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Thông tin bài tập không hợp lệ." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (title.length < 3 || title.length > 120) return Response.json({ error: "Tên bài tập cần có từ 3 đến 120 ký tự." }, { status: 400 });
  if (description.length < 5 || description.length > 6000) return Response.json({ error: "Đề bài cần có từ 5 đến 6000 ký tự." }, { status: 400 });

  try {
    const database = getDatabase();
    const now = new Date();
    const result = await database.collection<AssignmentDoc>("tasks").insertOne({
      title,
      description,
      createdById: ownerId,
      createdByName: session?.user?.name || session?.user?.email || "Người dùng",
      createdByEmail: session?.user?.email || "",
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    return Response.json({ id: result.insertedId.toString(), status: "draft" }, { status: 201 });
  } catch {
    return Response.json({ error: "Không thể giao bài tập. Kiểm tra kết nối MongoDB." }, { status: 503 });
  }
}
