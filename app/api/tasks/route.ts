import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import { listAppDocuments, writeAppDocument, type AppDocument } from "@/lib/app-data";
import { authOptions } from "@/lib/auth-options";
import { resolveUserAvatar } from "@/lib/avatars";
import { currentOwnerId } from "@/lib/current-user";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AssignmentDoc = {
  taskType?: string;
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
    sourceTaskId: task.sourceTaskId?.toString() ?? null,
    status: task.status,
    dueAt: task.dueAt instanceof Date ? task.dueAt.toISOString() : typeof task.dueAt === "string" ? task.dueAt : null,
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
    const summaryProjection = {
      taskType: 1,
      title: 1, description: 1,
      createdById: 1, createdByName: 1, createdByEmail: 1,
      assignedToId: 1, assignedToName: 1, assignedToEmail: 1, sourceTaskId: 1,
      status: 1, dueAt: 1, diagramId: 1,
      "submission.version": 1, "submission.submittedAt": 1,
      grade: 1, createdAt: 1, updatedAt: 1,
    };
    const [receivedRaw, createdRaw] = await Promise.all([
      listAppDocuments<AssignmentDoc & AppDocument>("tasks", { assignedToId: ownerId.toString() }, () => tasks.find({ assignedToId: ownerId }, { projection: summaryProjection }).sort({ updatedAt: -1 }).toArray()),
      listAppDocuments<AssignmentDoc & AppDocument>("tasks", { ownerId: ownerId.toString() }, () => tasks.find({ createdById: ownerId }, { projection: summaryProjection }).sort({ updatedAt: -1 }).toArray()),
    ]);
    const received = receivedRaw.filter((task) => task.taskType !== "code");
    const created = createdRaw.filter((task) => task.taskType !== "code");
    const sent = created.filter((task) => task.status !== "draft");
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

    const countsByTaskId = new Map<string, number>();
    for (const task of sent) {
      if (task.sourceTaskId) {
        const sourceId = task.sourceTaskId.toString();
        countsByTaskId.set(sourceId, (countsByTaskId.get(sourceId) ?? 0) + 1);
      }
    }
    return Response.json({
      received: received.map(serializeTask),
      sent: sent.map((task) => {
        const serialized = serializeTask(task);
        const assignedToImage =
          (serialized.assignedToId ? userAvatarById.get(serialized.assignedToId) : null) ??
          resolveUserAvatar({
            id: serialized.assignedToId,
            email: serialized.assignedToEmail,
            name: serialized.assignedToName,
          });
        return { ...serialized, assignedToImage };
      }),
      drafts: drafts.map((task) => ({ ...serializeTask(task), assignedCount: countsByTaskId.get(task._id.toString()) ?? 0 })),
    });
  } catch {
    return Response.json({ error: "Không thể tải bài tập. Kiểm tra kết nối Supabase hoặc MongoDB." }, { status: 503 });
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
    const now = new Date();
    const id = new ObjectId();
    await writeAppDocument("tasks", {
      _id: id,
      title,
      description,
      createdById: ownerId,
      createdByName: session?.user?.name || session?.user?.email || "Người dùng",
      createdByEmail: session?.user?.email || "",
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    return Response.json({ id: id.toString(), status: "draft" }, { status: 201 });
  } catch {
    return Response.json({ error: "Không thể lưu bài tập vào Supabase hoặc MongoDB." }, { status: 503 });
  }
}
