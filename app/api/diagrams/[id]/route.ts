import { ObjectId } from "mongodb";
import { deleteAppDocument, findAppDocument, writeAppDocument, type AppDocument } from "@/lib/app-data";
import { currentOwnerId } from "@/lib/current-user";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

async function ownedDiagramFilter(id: string, ownerId: ObjectId) {
  if (!/^[0-9a-f]{24}$/i.test(id)) return null;
  return { _id: new ObjectId(id), ownerId };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const ownerId = await currentOwnerId();
  if (!ownerId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const filter = await ownedDiagramFilter(id, ownerId);
  if (!filter) return Response.json({ error: "Không tìm thấy sơ đồ." }, { status: 404 });

  try {
    const diagram = await findAppDocument<AppDocument & { ownerId: ObjectId; name?: string; taskId?: ObjectId; entities?: unknown[]; relations?: unknown[]; decorations?: unknown[]; updatedAt?: Date }>("diagrams", id, () => getDatabase().collection("diagrams").findOne(filter));
    if (!diagram) return Response.json({ error: "Không tìm thấy sơ đồ." }, { status: 404 });
    if (!diagram.ownerId.equals(ownerId)) return Response.json({ error: "Not found." }, { status: 404 });
    const taskPrompt = diagram.taskId
      ? await findAppDocument<AppDocument & { title?: string; description?: string }>("tasks", diagram.taskId.toString(), () => getDatabase().collection<{ title?: string; description?: string }>("tasks").findOne(
          { _id: diagram.taskId, assignedToId: ownerId },
          { projection: { title: 1, description: 1 } },
        ))
      : null;
    return Response.json({
      id: diagram._id.toString(),
      name: diagram.name,
      taskId: diagram.taskId?.toString() ?? null,
      entities: diagram.entities ?? [],
      relations: diagram.relations ?? [],
      decorations: diagram.decorations ?? [],
      taskPrompt: taskPrompt ? { title: taskPrompt.title ?? "Bài tập", description: taskPrompt.description ?? "" } : null,
      updatedAt: diagram.updatedAt,
    });
  } catch {
    return Response.json({ error: "Không thể tải sơ đồ. Kiểm tra kết nối Supabase hoặc MongoDB." }, { status: 503 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const ownerId = await currentOwnerId();
  if (!ownerId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const filter = await ownedDiagramFilter(id, ownerId);
  if (!filter) return Response.json({ error: "Không tìm thấy sơ đồ." }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Dữ liệu sơ đồ không hợp lệ." }, { status: 400 });
  }
  if (JSON.stringify(body).length > 12_000_000) return Response.json({ error: "Sơ đồ vượt quá dung lượng cho phép." }, { status: 413 });

  const update: Record<string, unknown> = {};
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 100) {
      return Response.json({ error: "Tên sơ đồ là bắt buộc (tối đa 100 ký tự)." }, { status: 400 });
    }
    update.name = body.name.trim();
  }
  for (const field of ["entities", "relations", "decorations"] as const) {
    if (body[field] !== undefined) {
      if (!Array.isArray(body[field])) return Response.json({ error: `Dữ liệu ${field} không hợp lệ.` }, { status: 400 });
      update[field] = body[field];
    }
  }
  if (Object.keys(update).length === 0) return Response.json({ error: "Không có thay đổi để lưu." }, { status: 400 });

  try {
    const diagram = await findAppDocument<AppDocument & { ownerId: ObjectId }>("diagrams", id, () => getDatabase().collection("diagrams").findOne(filter));
    if (!diagram || !diagram.ownerId.equals(ownerId)) return Response.json({ error: "Không tìm thấy sơ đồ." }, { status: 404 });
    const updatedAt = new Date();
    await writeAppDocument("diagrams", { ...diagram, ...update, updatedAt });
    return Response.json({ ok: true, updatedAt: updatedAt.toISOString() });
  } catch {
    return Response.json({ error: "Không thể lưu sơ đồ vào Supabase hoặc MongoDB." }, { status: 503 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const ownerId = await currentOwnerId();
  if (!ownerId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const filter = await ownedDiagramFilter(id, ownerId);
  if (!filter) return Response.json({ error: "Không tìm thấy sơ đồ." }, { status: 404 });

  try {
    const diagram = await findAppDocument<AppDocument & { ownerId: ObjectId; taskId?: ObjectId }>("diagrams", id, () => getDatabase().collection("diagrams").findOne(filter, { projection: { ownerId: 1, taskId: 1 } }));
    if (!diagram) return Response.json({ error: "Không tìm thấy sơ đồ." }, { status: 404 });
    if (!diagram.ownerId.equals(ownerId)) return Response.json({ error: "Không tìm thấy sơ đồ." }, { status: 404 });
    if (diagram.taskId) return Response.json({ error: "Không thể xóa sơ đồ gắn với bài tập." }, { status: 409 });
    await deleteAppDocument("diagrams", id);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Không thể xóa sơ đồ khỏi Supabase hoặc MongoDB." }, { status: 503 });
  }
}
