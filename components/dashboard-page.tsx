"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { readJsonResponse } from "@/lib/read-json-response";

type Account = { id: string; name: string | null; email: string | null };
type DiagramSummary = { id: string; name: string; entityCount: number; relationCount: number; createdAt: string; updatedAt: string; taskId?: string | null };

export default function DashboardPage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [diagrams, setDiagrams] = useState<DiagramSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    setError("");
    try {
      const accountResponse = await fetch("/api/account", { cache: "no-store" });
      if (accountResponse.status === 401) { router.replace("/login"); return; }
      const accountResult = await readJsonResponse<{ error?: string; user?: Account }>(accountResponse);
      if (!accountResponse.ok) throw new Error(accountResult.error || "Không thể kiểm tra tài khoản.");
      if (!accountResult.user) throw new Error("Máy chủ chưa trả về thông tin tài khoản.");
      setAccount(accountResult.user);

      const diagramsResponse = await fetch("/api/diagrams", { cache: "no-store" });
      const diagramsResult = await readJsonResponse<{ error?: string; diagrams?: DiagramSummary[] }>(diagramsResponse);
      if (!diagramsResponse.ok) throw new Error(diagramsResult.error || "Không thể tải sơ đồ.");
      setDiagrams(diagramsResult.diagrams ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải dữ liệu.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadDashboard(); }, []);

  const createDiagram = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError("");
    try {
      const response = await fetch("/api/diagrams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const result = await readJsonResponse<{ error?: string; id?: string }>(response);
      if (!response.ok) throw new Error(result.error || "Không thể tạo sơ đồ.");
      if (!result.id) throw new Error("Máy chủ chưa trả về mã sơ đồ mới.");
      router.push(`/diagrams/${result.id}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Không thể tạo sơ đồ.");
    } finally {
      setCreating(false);
    }
  };

  const deleteDiagram = async (diagram: DiagramSummary) => {
    if (!window.confirm(`Xóa sơ đồ “${diagram.name}”? Thao tác này không thể hoàn tác.`)) return;
    try {
      const response = await fetch(`/api/diagrams/${diagram.id}`, { method: "DELETE" });
      const result = await readJsonResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(result.error || "Không thể xóa sơ đồ.");
      setDiagrams((current) => current.filter((item) => item.id !== diagram.id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Không thể xóa sơ đồ.");
    }
  };

  if (loading) return <div className="dashboard-loading"><span className="loading-spinner" /><p>Đang tải không gian làm việc…</p></div>;

  return <main className="dashboard-page">
    <header className="dashboard-topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <Link className="dashboard-brand" href="/"><Image src="/erd-draw-logo.png" alt="ERD Draw" width={144} height={96} priority unoptimized /></Link>
        <nav className="dashboard-topnav">
          <Link className="topnav-tab active" href="/">📁 Sơ đồ của tôi</Link>
          <Link className="topnav-tab" href="/tasks">📝 Bài tập</Link>
          <Link className="topnav-tab" href="/closure">🔑 Tìm siêu khóa</Link>
        </nav>
      </div>
      <div className="dashboard-user">
        <div className="user-avatar">{(account?.name || account?.email || "U").slice(0, 1).toUpperCase()}</div>
        <div className="user-details"><strong>{account?.name || "Tài khoản"}</strong><span>{account?.email}</span></div>
        <button type="button" onClick={() => void signOut({ callbackUrl: "/login" })}>Đăng xuất</button>
      </div>
    </header>
    <section className="dashboard-content">
      <div className="dashboard-heading"><div><span className="dashboard-eyebrow">KHÔNG GIAN CỦA BẠN</span><h1>Sơ đồ cơ sở dữ liệu</h1><p>Tạo, chỉnh sửa và quản lý các sơ đồ ERD của bạn.</p></div><button className="create-diagram-button" type="button" onClick={() => { setNewName(""); setError(""); setShowCreate(true); }}><span>＋</span> Tạo sơ đồ mới</button></div>
      {error && <div className="dashboard-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")}>Đóng</button></div>}
      {diagrams.length > 0 ? <div className="diagram-grid">{diagrams.map((diagram) => (
        <article className="diagram-card" key={diagram.id}>
          <Link className="diagram-card-open" href={`/diagrams/${diagram.id}`}>
            <div className="diagram-preview"><span className="preview-entity preview-one"><i /><i /><i /></span><span className="preview-entity preview-two"><i /><i /></span><span className="preview-link" /></div>
            <div className="diagram-card-title"><h2>{diagram.name}</h2><span className="card-arrow">↗</span></div>
            {diagram.taskId && <span className="diagram-task-badge">BÀI TẬP</span>}
            <div style={{display:"flex",gap:6,marginTop:8,marginBottom:4}}>
              <span className="card-stat card-stat-tables">🗂 {diagram.entityCount} bảng</span>
              <span className="card-stat card-stat-relations">🔗 {diagram.relationCount} quan hệ</span>
            </div>
            <span className="diagram-card-date">Cập nhật {new Date(diagram.updatedAt).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" })}</span>
          </Link>
          {!diagram.taskId && <button className="diagram-delete" type="button" aria-label={`Xóa sơ đồ ${diagram.name}`} title="Xóa sơ đồ" onClick={() => void deleteDiagram(diagram)}>×</button>}
        </article>
      ))}</div> : <section className="dashboard-empty"><div className="empty-illustration"><span /><span /><span /><i /></div><h2>Bạn chưa có sơ đồ nào</h2><p>Tạo sơ đồ mới và đặt tên trước khi bắt đầu thiết kế.</p><button type="button" className="create-diagram-button" onClick={() => { setNewName(""); setError(""); setShowCreate(true); }}>＋ Tạo sơ đồ đầu tiên</button></section>}
      <footer className="dashboard-footer"><span className="status-indicator" /> Sơ đồ của bạn được lưu tự động trên MongoDB.</footer>
    </section>

    {showCreate && <div className="create-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCreate(false); }}><section className="create-dialog" role="dialog" aria-modal="true" aria-labelledby="create-title">
      <button className="create-close" type="button" aria-label="Đóng" onClick={() => setShowCreate(false)}>×</button><div className="create-dialog-icon">＋</div><h2 id="create-title">Đặt tên sơ đồ mới</h2><p>Tên này sẽ hiển thị trong danh sách và trên màn hình thiết kế.</p>
      <form onSubmit={createDiagram}><label htmlFor="diagram-name">Tên sơ đồ</label><input id="diagram-name" autoFocus maxLength={100} required value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Ví dụ: Quản lý bán hàng" />{error && <div className="auth-error" role="alert">{error}</div>}<div className="create-dialog-actions"><button type="button" className="cancel-create" onClick={() => setShowCreate(false)}>Hủy</button><button type="submit" className="create-diagram-button" disabled={creating || !newName.trim()}>{creating ? "Đang tạo…" : "Tạo và mở sơ đồ"}</button></div></form>
    </section></div>}
  </main>;
}
