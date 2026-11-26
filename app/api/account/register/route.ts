import bcrypt from "bcryptjs";
import { MongoServerError, ObjectId } from "mongodb";
import { listAppDocuments, writeAppDocument, type AppDocument } from "@/lib/app-data";
import { sendWelcomeEmail } from "@/lib/mailer";
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
    const matches = await listAppDocuments<AppDocument>("users", { email }, async () => {
      const users = getDatabase().collection("users");
      await users.createIndex({ email: 1 }, { unique: true });
      return users.find({ email }, { projection: { _id: 1, email: 1 } }).limit(1).toArray();
    }, 1);
    if (matches.length) return Response.json({ error: "Email này đã được đăng ký." }, { status: 409 });
    const passwordHash = await bcrypt.hash(password, 12);
    await writeAppDocument("users", { _id: new ObjectId(), name, email, emailVerified: null, image: null, passwordHash, createdAt: new Date() });
    const mailResult = await sendWelcomeEmail({ toEmail: email, toName: name });
    return Response.json({ ok: true, emailSent: mailResult.sent }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return Response.json({ error: "Email này đã được đăng ký." }, { status: 409 });
    }
    if (error instanceof MongoServerError && error.code === 11000) {
      return Response.json({ error: "Email này đã được đăng ký." }, { status: 409 });
    }
    return Response.json({ error: "Không thể lưu tài khoản vào Supabase hoặc MongoDB." }, { status: 503 });
  }
}
