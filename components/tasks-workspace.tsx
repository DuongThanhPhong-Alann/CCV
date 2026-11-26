"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import BatchDraftAssignBar from "@/components/batch-draft-assign-bar";
import { readJsonResponse } from "@/lib/read-json-response";
import type { AssignmentTask } from "@/lib/task-types";

type TaskScope = "received" | "drafts" | "sent";
type Account = { id: string; name: string | null; email: string | null };

function formatDate(value: string) {
  return new Date(value).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });
}

function taskState(task: AssignmentTask, scope: TaskScope) {
  if (task.status === "draft") return { label: "Trong kho", tone: "draft" };
  if (task.status === "declined") return { label: "Đã từ chối", tone: "declined" };
  if (task.status === "invited") return scope === "received"
    ? { label: "Chờ bạn phản hồi", tone: "waiting" }
    : { label: "Đang chờ chấp nhận", tone: "waiting" };
  if (task.submission && task.grade?.submissionVersion === task.submission.version) return { label: "Đã chấm điểm", tone: "graded" };
  if (task.submission) return { label: "Đã nộp bài", tone: "submitted" };
  return { label: "Đang thực hiện", tone: "active" };
}

export default function TasksWorkspace() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [scope, setScope] = useState<TaskScope>("received");
  const [received, setReceived] = useState<AssignmentTask[]>([]);
  const [sent, setSent] = useState<AssignmentTask[]>([]);
  const [drafts, setDrafts] = useState<AssignmentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const loadTasks = async () => {
    setLoading(true);
    setError("");
    try {
      const accountResponse = await fetch("/api/account", { cache: "no-store" });
      if (accountResponse.status === 401) { router.replace("/login"); return; }
      const accountResult = await readJsonResponse<{ error?: string; user?: Account }>(accountResponse);
      if (accountResult.user) setAccount(accountResult.user);

      const response = await fetch("/api/tasks", { cache: "no-store" });
      if (response.status === 401) { router.replace("/login"); return; }
      const result = await readJsonResponse<{ error?: string; received?: AssignmentTask[]; sent?: AssignmentTask[]; drafts?: AssignmentTask[] }>(response);
      if (!response.ok) throw new Error(result.error || "Không thể tải danh sách bài tập.");
      setReceived(result.received ?? []);
      setSent(result.sent ?? []);
      setDrafts(result.drafts ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải bài tập.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadTasks(); }, []);

  const createTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setError("");
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      const result = await readJsonResponse<{ error?: string; id?: string }>(response);
      if (!response.ok) throw new Error(result.error || "Không thể giao bài tập.");
      setShowCreate(false);
      setTitle("");
      setDescription("");
      setScope("drafts");
      await loadTasks();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Không thể lưu đề bài.");
    } finally {
      setCreating(false);
    }
  };

  const items = scope === "received" ? received : scope === "drafts" ? drafts : sent;

  if (loading) return <div className="dashboard-loading"><span className="loading-spinner" /><p>Đang tải bài tập…</p></div>;

  return <main className="tasks-page">
    <header className="dashboard-topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <Link className="dashboard-brand" href="/"><Image src="/erd-draw-logo.png" alt="ERD Draw" width={144} height={96} priority unoptimized /></Link>
        <nav className="dashboard-topnav">
          <Link className="topnav-tab" href="/">📁 Sơ đồ của tôi</Link>
          <Link className="topnav-tab active" href="/tasks">📝 Bài tập</Link>
          <Link className="topnav-tab" href="/code-tasks">💻 Code bài tập</Link>
          <Link className="topnav-tab" href="/closure">🔑 Tìm siêu khóa</Link>
        </nav>
      </div>
      <div className="dashboard-user">
        <div className="user-avatar">{(account?.name || account?.email || "U").slice(0, 1).toUpperCase()}</div>
        <div className="user-details"><strong>{account?.name || "Tài khoản"}</strong><span>{account?.email}</span></div>
        <button type="button" onClick={() => void signOut({ callbackUrl: "/login" })}>Đăng xuất</button>
      </div>
    </header>

    <section className="tasks-content">
      <div className="tasks-heading">
        <div>
          <span className="dashboard-eyebrow">HỌC TẬP VÀ ĐÁNH GIÁ</span>
          <h1>Bài tập ERD</h1>
          <p>Làm bài tập được giao, hoặc tạo đề bài mới để giao cho học viên.</p>
        </div>
        <button className="create-diagram-button" type="button" onClick={() => { setError(""); setShowCreate(true); }}>
          <span>＋</span> Tạo đề bài mới
        </button>
      </div>

      {error && <div className="dashboard-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")}>Đóng</button></div>}
      {notice && <div className="task-assignment-message" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice("")}>Đóng</button></div>}

      <div className="task-tabs" role="tablist" aria-label="Danh sách bài tập">
        <button className={scope === "received" ? "active" : ""} type="button" role="tab" aria-selected={scope === "received"} onClick={() => setScope("received")}>
          📥 Được giao <span className="tab-counter">{received.length}</span>
        </button>
        <button className={scope === "drafts" ? "active" : ""} type="button" role="tab" aria-selected={scope === "drafts"} onClick={() => setScope("drafts")}>
          📝 Kho đề <span className="tab-counter">{drafts.length}</span>
        </button>
        <button className={scope === "sent" ? "active" : ""} type="button" role="tab" aria-selected={scope === "sent"} onClick={() => setScope("sent")}>
          📤 Đã giao <span className="tab-counter">{sent.length}</span>
        </button>
      </div>

      {scope === "drafts" && (
        <BatchDraftAssignBar
          drafts={drafts.map((d) => ({ id: d.id, title: d.title }))}
          selectedIds={selectedDraftIds}
          onChangeSelected={setSelectedDraftIds}
          endpoint="/api/tasks/batch-assign"
          onError={setError}
          onAssigned={async (msg) => {
            setNotice(msg);
            await loadTasks();
          }}
        />
      )}

      {items.length ? (
        <div className="task-list">
          {items.map((task) => {
            const state = taskState(task, scope);
            const personLabel = scope === "received"
              ? `Người giao: ${task.createdByName} (${task.createdByEmail})`
              : scope === "drafts"
                ? "Kho đề bài · Có thể giao nhiều lần"
                : `Người nhận: ${task.assignedToName || "Chưa có"} (${task.assignedToEmail || "—"})`;
            const icon = scope === "received" ? "📥" : scope === "drafts" ? "📝" : "📤";
            const isSelected = scope === "drafts" && selectedDraftIds.includes(task.id);

            const card = (
              <Link className={`task-list-card task-card-${state.tone} ${isSelected ? "is-selected-card" : ""}`} href={`/tasks/${task.id}`} key={task.id}>
                <div className={`task-list-icon task-icon-${state.tone}`}>{icon}</div>
                <div className="task-list-main">
                  <div className="task-list-title">
                    <h2>{task.title}</h2>
                    <span className={`task-state task-state-${state.tone}`}>
                      <span className="task-state-dot" />
                      {state.label}
                    </span>
                  </div>
                  <p className="task-person-meta">{personLabel}</p>
                  <div className="task-card-meta-row">
                    <span className="task-list-date">🕒 Cập nhật: {formatDate(task.updatedAt)}</span>
                    {task.submission && (
                      <span className="task-sub-count">📄 Bản nộp v{task.submission.version}</span>
                    )}
                    {scope === "drafts" && (
                      <span className="task-sub-count">↗ {task.assignedCount ?? 0} lượt giao</span>
                    )}
                    {task.grade && (
                      <span className="task-grade-pill">⭐️ {task.grade.score}/10 điểm</span>
                    )}
                  </div>
                </div>
                <span className="task-list-arrow">›</span>
              </Link>
            );

            if (scope !== "drafts") return card;

            return (
              <div className={`task-select-row ${isSelected ? "is-selected" : ""}`} key={task.id}>
                <label className="task-select-check" title="Chọn đề này để giao">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() =>
                      setSelectedDraftIds((prev) =>
                        prev.includes(task.id) ? prev.filter((id) => id !== task.id) : [...prev, task.id],
                      )
                    }
                  />
                </label>
                {card}
              </div>
            );
          })}
        </div>
      ) : (
        <section className="tasks-empty">
          <div className="tasks-empty-icon">{scope === "received" ? "📥" : scope === "drafts" ? "📝" : "📤"}</div>
          <h2>{scope === "received" ? "Chưa có bài tập nào được giao cho bạn" : scope === "drafts" ? "Kho đề bài đang trống" : "Bạn chưa giao bài tập nào"}</h2>
          <p>{scope === "received" ? "Khi người khác giao bài tập cho tài khoản của bạn, thông báo và lời mời sẽ xuất hiện ở đây." : scope === "drafts" ? "Tạo đề một lần, lưu trong kho rồi giao cho nhiều học viên hoặc giao lại bất cứ lúc nào." : "Các lượt bài tập đã giao sẽ hiển thị tại đây."}</p>
          {scope !== "received" && (
            <button className="create-diagram-button" type="button" onClick={() => setShowCreate(true)}>
              ＋ Tạo đề bài ngay
            </button>
          )}
        </section>
      )}
    </section>

    {showCreate && (
      <div className="create-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !creating) setShowCreate(false); }}>
        <section className="create-dialog task-create-dialog" role="dialog" aria-modal="true" aria-labelledby="task-create-title">
          <button className="create-close" type="button" aria-label="Đóng" disabled={creating} onClick={() => setShowCreate(false)}>×</button>
          <div className="create-dialog-icon">✎</div>
          <h2 id="task-create-title">Tạo đề bài tập mới</h2>
          <p>Đề bài sẽ được lưu vào mục Nháp. Bạn có thể chọn người nhận và giao bài bất cứ lúc nào.</p>
          <form onSubmit={createTask}>
            <label htmlFor="task-title">Tên bài tập</label>
            <input id="task-title" autoFocus minLength={3} maxLength={120} required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ví dụ: Thiết kế cơ sở dữ liệu hệ thống bán vé máy bay" />
            <label htmlFor="task-description">Nội dung đề bài và yêu cầu</label>
            <textarea id="task-description" minLength={5} maxLength={6000} required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Mô tả chi tiết các thực thể, thuộc tính, ràng buộc và quy tắc nghiệp vụ cần thiết kế..." />
            {error && <div className="auth-error" role="alert">{error}</div>}
            <div className="create-dialog-actions">
              <button type="button" className="cancel-create" disabled={creating} onClick={() => setShowCreate(false)}>Hủy</button>
              <button type="submit" className="create-diagram-button" disabled={creating || title.trim().length < 3 || description.trim().length < 5}>
                {creating ? "Đang lưu…" : "Lưu vào bản nháp"}
              </button>
            </div>
          </form>
        </section>
      </div>
    )}
  </main>;
}
