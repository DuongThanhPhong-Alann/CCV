import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { findAppDocument, patchAppDocument, type AppDocument } from "@/lib/app-data";
import { authOptions } from "@/lib/auth-options";
import { findAvatarOption, resolveUserAvatar } from "@/lib/avatars";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UserDoc = AppDocument & {
  name?: string;
  email?: string;
  image?: string | null;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let image = resolveUserAvatar({
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  });

  if (/^[0-9a-f]{24}$/i.test(session.user.id)) {
    try {
      const userDoc = await findAppDocument<UserDoc>(
        "users",
        session.user.id,
        () => getDatabase().collection("users").findOne({ _id: new ObjectId(session.user.id) }),
      );
      if (userDoc) {
        const storedOption = findAvatarOption(userDoc.image);
        image = resolveUserAvatar({
          id: session.user.id,
          email: userDoc.email ?? session.user.email,
          name: userDoc.name ?? session.user.name,
          image: userDoc.image,
        });
        if (!storedOption || userDoc.image !== image) {
          await patchAppDocument("users", session.user.id, { image }, {});
        }
      }
    } catch {
      // fall back to resolved avatar without failing account load
    }
  }

  return Response.json({
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image,
    },
  });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !/^[0-9a-f]{24}$/i.test(session.user.id)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { image?: unknown };
  try {
    body = (await request.json()) as { image?: unknown };
  } catch {
    return Response.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  const chosen = findAvatarOption(typeof body.image === "string" ? body.image : null);
  if (!chosen) {
    return Response.json({ error: "Ảnh đại diện không hợp lệ. Vui lòng chọn một trong các ảnh có sẵn." }, { status: 400 });
  }

  try {
    const result = await patchAppDocument("users", session.user.id, { image: chosen.src }, {});
    if (!result.updated) {
      return Response.json({ error: "Không tìm thấy tài khoản để cập nhật avatar." }, { status: 404 });
    }
    return Response.json({ ok: true, image: chosen.src, avatar: chosen });
  } catch {
    return Response.json({ error: "Không thể lưu ảnh đại diện. Vui lòng thử lại." }, { status: 503 });
  }
}
