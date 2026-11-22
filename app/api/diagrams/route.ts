import { currentOwnerId } from "@/lib/current-user";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ownerId = await currentOwnerId();
  if (!ownerId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const collection = getDatabase().collection("diagrams");
    await collection.createIndex({ ownerId: 1, updatedAt: -1 });
    const diagrams = await collection.aggregate([
      { $match: { ownerId } },
      { $project: {
        name: 1,
        createdAt: 1,
        updatedAt: 1,
        entityCount: { $size: { $ifNull: ["$entities", []] } },
        relationCount: { $size: { $ifNull: ["$relations", []] } },
      } },
      { $sort: { updatedAt: -1 } },
    ]).toArray();
    return Response.json({ diagrams: diagrams.map(({ _id, ...diagram }) => ({ ...diagram, id: _id.toString() })) });
  } catch {
    return Response.json({ error: "Không thể tải danh sách sơ đồ. Kiểm tra kết nối MongoDB." }, { status: 503 });
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
    const result = await getDatabase().collection("diagrams").insertOne({
      ownerId,
      name,
      entities: [],
      relations: [],
      decorations: [],
      createdAt: now,
      updatedAt: now,
    });
    return Response.json({ id: result.insertedId.toString(), name }, { status: 201 });
  } catch {
    return Response.json({ error: "Không thể tạo sơ đồ. Kiểm tra kết nối MongoDB." }, { status: 503 });
  }
}
