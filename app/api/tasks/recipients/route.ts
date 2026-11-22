import { ObjectId } from "mongodb";
import { currentOwnerId } from "@/lib/current-user";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ownerId = await currentOwnerId();
  if (!ownerId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const query = new URL(request.url).searchParams.get("query")?.trim() ?? "";
  if (query.length < 2) return Response.json({ accounts: [] });
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(escaped, "i");

  try {
    const accounts = await getDatabase().collection<{ _id: ObjectId; name?: string; email?: string }>("users")
      .find({ _id: { $ne: ownerId }, $or: [{ name: pattern }, { email: pattern }] }, { projection: { _id: 1, name: 1, email: 1 } })
      .sort({ name: 1, email: 1 })
      .limit(20)
      .toArray();

    return Response.json({ accounts: accounts.filter((account) => account.email).map((account) => ({
      id: account._id.toString(),
      name: account.name || account.email,
      email: account.email,
    })) });
  } catch {
    return Response.json({ error: "Không thể tìm tài khoản. Kiểm tra kết nối MongoDB." }, { status: 503 });
  }
}
