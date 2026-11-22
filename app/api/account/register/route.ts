import bcrypt from "bcryptjs";
import { MongoServerError } from "mongodb";
import { getDatabase } from "@/lib/mongodb";

export async function POST(request: Request) {
  let body: { name?: unknown; email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Thông tin gửi lên không hợp lệ." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (name.length < 2 || name.length > 80) return Response.json({ error: "Tên cần có từ 2 đến 80 ký tự." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Email chưa đúng định dạng." }, { status: 400 });
  if (password.length < 8 || password.length > 100) return Response.json({ error: "Mật khẩu cần có từ 8 đến 100 ký tự." }, { status: 400 });

  try {
    const users = getDatabase().collection("users");
    await users.createIndex({ email: 1 }, { unique: true });
    const existing = await users.findOne({ email }, { projection: { _id: 1 } });
    if (existing) return Response.json({ error: "Email này đã được đăng ký." }, { status: 409 });
    const passwordHash = await bcrypt.hash(password, 12);
    await users.insertOne({ name, email, emailVerified: null, image: null, passwordHash, createdAt: new Date() });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      return Response.json({ error: "Email này đã được đăng ký." }, { status: 409 });
    }
    return Response.json({ error: "Không thể lưu tài khoản. Kiểm tra cấu hình MongoDB." }, { status: 503 });
  }
}
