import { getServerSession } from "next-auth";
import { isActivityAdminEmail } from "@/lib/activity-types";
import { buildAdminActivitySnapshot } from "@/lib/admin-activity-data";
import { authOptions } from "@/lib/auth-options";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isActivityAdminEmail(session.user.email)) {
    return Response.json({ error: "Bạn không có quyền xem hoạt động của các tài khoản khác." }, { status: 403 });
  }

  try {
    const snapshot = await buildAdminActivitySnapshot(session.user.id);
    return Response.json(snapshot, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (err) {
    console.error("[admin/activity] Failed to load activity overview:", err);
    return Response.json({ error: "Không thể tải dữ liệu hoạt động tài khoản." }, { status: 503 });
  }
}
