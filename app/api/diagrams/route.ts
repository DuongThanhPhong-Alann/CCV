import { currentOwnerId } from "@/lib/current-user";
import { listAppDocuments, writeAppDocument, type AppDocument } from "@/lib/app-data";
import { getDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ownerId = await currentOwnerId();
  if (!ownerId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const collection = getDatabase().collection("diagrams");
    const diagrams = await listAppDocuments<AppDocument & { name?: string; taskId?: ObjectId; entities?: unknown[]; relations?: unknown[] }>("diagrams", { ownerId: ownerId.toString() }, () => collection.find({ ownerId }).sort({ updatedAt: -1 }).toArray());
    return Response.json({ diagrams: diagrams.map(({ _id, _revision: _ignoreRevision, taskId, entities, relations, ...diagram }) => ({
      ...diagram,
      id: _id.toString(),
      taskId: taskId?.toString() ?? null,
      entityCount: entities?.length ?? 0,
      relationCount: relations?.length ?? 0,
    })) });
  } catch {
    return Response.json({ error: "Không thể tải danh sách sơ đồ. Kiểm tra kết nối Supabase hoặc MongoDB." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const ownerId = await currentOwnerId();
  if (!ownerId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Thông tin gửi lên không hợp lệ." }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 100) return Response.json({ error: "Tên sơ đồ là bắt buộc (tối đa 100 ký tự)." }, { status: 400 });

  try {
    const now = new Date();
    const id = new ObjectId();
    await writeAppDocument("diagrams", {
      _id: id,
      ownerId,
      name,
      entities: [],
      relations: [],
      decorations: [],
      createdAt: now,
      updatedAt: now,
    });
    return Response.json({ id: id.toString(), name }, { status: 201 });
  } catch {
    return Response.json({ error: "Không thể lưu sơ đồ vào Supabase hoặc MongoDB." }, { status: 503 });
  }
}
