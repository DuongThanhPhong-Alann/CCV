import { ObjectId } from "mongodb";
import { listAppDocuments, type AppDocument } from "@/lib/app-data";
import { resolveUserAvatar } from "@/lib/avatars";
import { currentOwnerId } from "@/lib/current-user";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ownerId = await currentOwnerId();
  if (!ownerId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const searchParams = new URL(request.url).searchParams;
  const query = searchParams.get("query")?.trim() ?? "";
  const listAll = searchParams.get("all") === "1";
  if (!listAll && query.length < 1) return Response.json({ accounts: [] });

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(escaped, "i");

  try {
    const accounts = await listAppDocuments<AppDocument & { name?: string; email?: string; image?: string | null }>(
      "users",
      {
        excludeId: ownerId.toString(),
        nameOrEmailContains: query,
      },
      () =>
        getDatabase()
          .collection<{ _id: ObjectId; name?: string; email?: string; image?: string | null }>("users")
          .find(
            query
              ? { _id: { $ne: ownerId }, $or: [{ name: pattern }, { email: pattern }] }
              : { _id: { $ne: ownerId } },
            { projection: { _id: 1, name: 1, email: 1, image: 1 } },
          )
          .sort({ name: 1, email: 1 })
          .limit(50)
          .toArray(),
      50,
    );

    return Response.json({
      accounts: accounts
        .filter((account) => account.email)
        .map((account) => ({
          id: account._id.toString(),
          name: account.name || account.email,
          email: account.email,
          image: resolveUserAvatar({
            id: account._id.toString(),
            email: account.email,
            name: account.name,
            image: account.image,
          }),
        })),
    });
  } catch {
    return Response.json({ error: "Không thể tìm tài khoản. Kiểm tra kết nối Supabase hoặc MongoDB." }, { status: 503 });
  }
}
