"use client";

import Image from "next/image";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { readJsonResponse } from "@/lib/read-json-response";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isRegister = mode === "register";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (isRegister) {
        const response = await fetch("/api/account/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const result = await readJsonResponse<{ error?: string }>(response);
        if (!response.ok) throw new Error(result.error || "Không thể tạo tài khoản.");
      }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (!result?.ok || result.error) throw new Error(isRegister ? "Tạo tài khoản xong nhưng chưa đăng nhập được. Hãy thử đăng nhập." : "Email hoặc mật khẩu chưa đúng.");
      router.replace("/");
      router.refresh();
    } catch (submitError) {
      if (submitError instanceof SyntaxError) {
        setError(isRegister
          ? "Tài khoản có thể đã được tạo, nhưng đăng nhập trả về phản hồi không hợp lệ. Hãy thử đăng nhập lại."
          : "Máy chủ đăng nhập trả về phản hồi không hợp lệ. Hãy thử lại sau.");
      } else {
        setError(submitError instanceof Error ? submitError.message : "Đã xảy ra lỗi. Hãy thử lại.");
      }
    } finally {
      setBusy(false);
    }
  };

  return <main className="auth-page">
    <div className="auth-glow auth-glow-one" /><div className="auth-glow auth-glow-two" />
    <section className="auth-card">
      <Link className="auth-logo" href="/"><Image src="/erd-draw-logo.png" alt="ERD Draw" width={144} height={96} priority unoptimized /></Link>
      <div className="auth-heading"><span className="auth-eyebrow">ERD DRAW WORKSPACE</span><h1>{isRegister ? "Tạo tài khoản của bạn" : "Chào mừng trở lại"}</h1><p>{isRegister ? "Đăng ký để lưu và quản lý sơ đồ cơ sở dữ liệu." : "Đăng nhập để tiếp tục thiết kế sơ đồ của bạn."}</p></div>
      <form className="auth-form" onSubmit={submit}>
        {isRegister && <label>Họ và tên<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" minLength={2} maxLength={80} required placeholder="Nguyễn Văn An" /></label>}
        <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required placeholder="ban@congty.com" /></label>
        <label>Mật khẩu<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={isRegister ? "new-password" : "current-password"} minLength={8} maxLength={100} required placeholder="Ít nhất 8 ký tự" /></label>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Đang xử lý…" : isRegister ? "Tạo tài khoản" : "Đăng nhập"}</button>
      </form>
      <div className="auth-switch">{isRegister ? "Đã có tài khoản?" : "Chưa có tài khoản?"} <Link href={isRegister ? "/login" : "/register"}>{isRegister ? "Đăng nhập" : "Tạo tài khoản mới"}</Link></div>
      <div className="auth-security"><span />Mỗi tài khoản chỉ xem và sửa sơ đồ của chính mình</div>
    </section>
  </main>;
}
