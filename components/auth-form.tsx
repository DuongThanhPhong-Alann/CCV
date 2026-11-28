"use client";

import Image from "next/image";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import AuthCheckLoader from "@/components/auth-check-loader";
import ThemeToggle from "@/components/theme-toggle";
import { readJsonResponse } from "@/lib/read-json-response";
import {
  cacheAccountName,
  clearSessionActivity,
  getCachedAccountName,
  markPostLoginTransition,
  markSessionActive,
} from "@/lib/session-activity";

const MIN_LOGIN_ANIMATION_MS = 1600;

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [timeoutNotice, setTimeoutNotice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkingPhase, setCheckingPhase] = useState<"idle" | "checking" | "entering">("idle");
  const [loaderName, setLoaderName] = useState<string>("");
  const isRegister = mode === "register";

  useEffect(() => {
    clearSessionActivity();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("reason") === "timeout") {
        setTimeoutNotice(true);
      }
    }
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const startedAt = Date.now();
    const initialKnownName = isRegister
      ? name.trim()
      : getCachedAccountName(email) || "";
    setBusy(true);
    setError("");
    setTimeoutNotice(false);
    setLoaderName(initialKnownName);
    setCheckingPhase("checking");

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

      let resolvedName = initialKnownName;
      try {
        const accountRes = await fetch("/api/account", { cache: "no-store" });
        if (accountRes.ok) {
          const accountData = await readJsonResponse<{
            user?: { name?: string | null; email?: string | null };
          }>(accountRes);
          if (accountData.user?.name?.trim()) {
            resolvedName = accountData.user.name.trim();
          }
          cacheAccountName(accountData.user?.email || email, resolvedName);
        }
      } catch {
        // fallback to initialKnownName
      }
      if (!resolvedName && email.includes("@")) {
        resolvedName = email.split("@")[0].trim();
      }
      if (resolvedName) {
        cacheAccountName(email, resolvedName);
      }

      const revealedNewName = Boolean(resolvedName && resolvedName !== initialKnownName);
      const animAnchor = revealedNewName ? Date.now() : startedAt;

      markSessionActive(Date.now());
      markPostLoginTransition(resolvedName);
      setLoaderName(resolvedName);
      setCheckingPhase("entering");

      const elapsed = Date.now() - animAnchor;
      if (elapsed < MIN_LOGIN_ANIMATION_MS) {
        await new Promise((resolve) => window.setTimeout(resolve, MIN_LOGIN_ANIMATION_MS - elapsed));
      }

      router.replace("/");
      router.refresh();
    } catch (submitError) {
      setCheckingPhase("idle");
      setLoaderName("");
      setBusy(false);
      if (submitError instanceof SyntaxError) {
        setError(isRegister
          ? "Tài khoản có thể đã được tạo, nhưng đăng nhập trả về phản hồi không hợp lệ. Hãy thử đăng nhập lại."
          : "Máy chủ đăng nhập trả về phản hồi không hợp lệ. Hãy thử lại sau.");
      } else {
        setError(submitError instanceof Error ? submitError.message : "Đã xảy ra lỗi. Hãy thử lại.");
      }
    }
  };

  if (checkingPhase !== "idle") {
    return (
      <AuthCheckLoader
        displayName={loaderName}
        message={
          checkingPhase === "entering"
            ? loaderName
              ? `Xin chào ${loaderName}! Đang vào không gian làm việc…`
              : "Đăng nhập thành công! Đang vào không gian làm việc…"
            : isRegister
              ? "Đang tạo tài khoản và kiểm tra đăng nhập…"
              : "Đang kiểm tra đăng nhập…"
        }
      />
    );
  }

  return (
    <main className="auth-page d3oxy-auth-page">
      <div className="auth-theme-corner"><ThemeToggle /></div>
      <section className="d3oxy-auth-card">
        <div className="d3oxy-auth-top">
          <Link className="d3oxy-auth-logo" href="/">
            <Image src="/erd-draw-logo.png" alt="ERD Draw" width={144} height={96} priority unoptimized />
          </Link>
          <span className="d3oxy-auth-badge">ERD DRAW</span>
        </div>

        <form className="d3oxy-form" onSubmit={submit}>
          <p className="d3oxy-title">
            {isRegister ? "Tạo tài khoản," : "Chào mừng trở lại,"}
            <span>
              {isRegister
                ? "đăng ký để lưu & quản lý sơ đồ"
                : "đăng nhập để tiếp tục làm việc"}
            </span>
          </p>

          {timeoutNotice && !isRegister && (
            <div className="auth-timeout-notice d3oxy-notice" role="status">
              ⏱ Phiên đăng nhập đã tự động đăng xuất do không hoạt động quá 30 phút. Vui lòng đăng nhập lại.
            </div>
          )}

          {isRegister && (
            <label className="d3oxy-field">
              <span>Họ và tên</span>
              <input
                className="d3oxy-input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                minLength={2}
                maxLength={80}
                required
                placeholder="Nguyễn Văn An"
              />
            </label>
          )}

          <label className="d3oxy-field">
            <span>Email</span>
            <input
              className="d3oxy-input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              required
              placeholder="ban@congty.com"
            />
          </label>

          <label className="d3oxy-field">
            <span>Mật khẩu</span>
            <input
              className="d3oxy-input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              minLength={8}
              maxLength={100}
              required
              placeholder="Ít nhất 8 ký tự"
            />
          </label>

          {error && (
            <div className="auth-error d3oxy-error" role="alert">
              {error}
            </div>
          )}

          <button className="d3oxy-btn is-primary" type="submit" disabled={busy}>
            <span>{busy ? "Đang xử lý…" : isRegister ? "Tạo tài khoản" : "Tiếp tục đăng nhập"}</span>
            <svg
              className="d3oxy-icon"
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m6 17 5-5-5-5" />
              <path d="m13 17 5-5-5-5" />
            </svg>
          </button>

          <div className="d3oxy-separator" aria-hidden="true">
            <div />
            <span>HOẶC</span>
            <div />
          </div>

          <Link className="d3oxy-btn is-secondary" href={isRegister ? "/login" : "/register"}>
            <span>{isRegister ? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Đăng ký"}</span>
            <svg
              className="d3oxy-icon"
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </form>

        <div className="d3oxy-security">
          <span />
          Mỗi tài khoản chỉ xem và sửa sơ đồ của chính mình
        </div>
      </section>
    </main>
  );
}
