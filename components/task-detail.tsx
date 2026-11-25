"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { readJsonResponse } from "@/lib/read-json-response";
import type { AssignmentTask } from "@/lib/task-types";

type ViewerRole = "creator" | "assignee";
type RecipientAccount = { id: string; name: string; email: string };
type Account = { id: string; name: string | null; email: string | null };

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

function statusLabel(task: { status: AssignmentTask["status"]; submission: { version: number } | null; grade: { submissionVersion: number } | null }) {
  if (task.status === "draft") return { label: "Trong kho", tone: "draft" };
  if (task.status === "declined") return { label: "Đã từ chối", tone: "declined" };
  if (task.status === "invited") return { label: "Đang chờ phản hồi", tone: "waiting" };
  if (task.submission && task.grade?.submissionVersion === task.submission.version) return { label: "Đã chấm điểm", tone: "graded" };
  if (task.submission) return { label: "Đã nộp bài", tone: "submitted" };
  return { label: "Đang thực hiện", tone: "active" };
}

export default function TaskDetail({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [task, setTask] = useState<AssignmentTask | null>(null);
  const [viewerRole, setViewerRole] = useState<ViewerRole>("assignee");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [assignmentNotice, setAssignmentNotice] = useState("");
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipients, setRecipients] = useState<RecipientAccount[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<RecipientAccount | null>(null);
  const [searchingRecipients, setSearchingRecipients] = useState(false);

  const loadTask = async () => {
    setLoading(true);
    setError("");
    try {
      const accountResponse = await fetch("/api/account", { cache: "no-store" });
      if (accountResponse.status === 401) { router.replace("/login"); return; }
      const accountResult = await readJsonResponse<{ error?: string; user?: Account }>(accountResponse);
      if (accountResult.user) setAccount(accountResult.user);

      const response = await fetch(`/api/tasks/${taskId}`, { cache: "no-store" });
      if (response.status === 401) { router.replace("/login"); return; }
      const result = await readJsonResponse<{ error?: string; task?: AssignmentTask; viewerRole?: ViewerRole }>(response);
      if (!response.ok) throw new Error(result.error || "Không thể tải bài tập.");
      if (!result.task || !result.viewerRole) throw new Error("Máy chủ chưa trả về nội dung bài tập.");
      setTask(result.task);
      setViewerRole(result.viewerRole);
      setScore(result.task.grade?.score.toString() ?? "");
      setFeedback(result.task.grade?.feedback ?? "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải bài tập.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadTask(); }, [taskId]);

  useEffect(() => {
    const query = recipientQuery.trim();
    if (viewerRole !== "creator" || task?.status !== "draft" || query.length < 2) {
      setRecipients([]);
      setSearchingRecipients(false);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearchingRecipients(true);
      try {
        const response = await fetch(`/api/tasks/recipients?query=${encodeURIComponent(query)}`, { cache: "no-store", signal: controller.signal });
        const result = await readJsonResponse<{ accounts?: RecipientAccount[] }>(response);
        if (response.ok) setRecipients(result.accounts ?? []);
      } catch {
        if (!controller.signal.aborted) setRecipients([]);
      } finally {
        if (!controller.signal.aborted) setSearchingRecipients(false);
      }
    }, 220);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [recipientQuery, task?.id, task?.status, viewerRole]);

  const assignTask = async () => {
    if (!selectedRecipient) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign", assignedToId: selectedRecipient.id }),
      });
      const result = await readJsonResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(result.error || "Không thể giao bài tập.");
      setSelectedRecipient(null);
      setRecipientQuery("");
      setAssignmentNotice(`Đã giao đề cho ${selectedRecipient.name}. Đề gốc vẫn nằm trong kho để bạn giao tiếp.`);
      await loadTask();
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : "Không thể giao bài tập.");
    } finally {
      setBusy(false);
    }
  };

  const saveAsDraft = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "saveAsDraft" }),
      });
      const result = await readJsonResponse<{ error?: string; id?: string }>(response);
      if (!response.ok || !result.id) throw new Error(result.error || "Không thể đưa đề vào kho.");
      router.push(`/tasks/${result.id}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể đưa đề vào kho.");
    } finally {
      setBusy(false);
    }
  };

  const respond = async (action: "accept" | "decline") => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await readJsonResponse<{ error?: string; diagramId?: string }>(response);
      if (!response.ok) throw new Error(result.error || "Không thể cập nhật lời mời.");
      if (action === "accept" && result.diagramId) { router.push(`/diagrams/${result.diagramId}`); return; }
      await loadTask();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Không thể cập nhật bài tập.");
    } finally {
      setBusy(false);
    }
  };

  const gradeTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!score || Number(score) < 0 || Number(score) > 10) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "grade", score: Number(score), feedback }),
      });
      const result = await readJsonResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(result.error || "Không thể lưu điểm.");
      await loadTask();
    } catch (gradeError) {
      setError(gradeError instanceof Error ? gradeError.message : "Không thể lưu điểm.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="dashboard-loading"><span className="loading-spinner" /><p>Đang tải bài tập…</p></div>;
  if (!task) return <main className="task-detail-page"><div className="task-detail-error"><h1>Không mở được bài tập</h1><p>{error || "Không tìm thấy bài tập."}</p><Link href="/tasks">Về danh sách bài tập</Link></div></main>;

  const isCreator = viewerRole === "creator";
  const submission = task.submission;
  const state = statusLabel(task);
  const entityNames = new Map((submission?.entities ?? []).map((entity) => [entity.id ?? "", entity.name || "Bảng chưa đặt tên"]));

  return <main className="task-detail-page">
    <header className="dashboard-topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <Link className="dashboard-brand" href="/"><Image src="/erd-draw-logo.png" alt="ERD Draw" width={144} height={96} priority unoptimized /></Link>
        <nav className="dashboard-topnav">
          <Link className="topnav-tab" href="/">📁 Sơ đồ của tôi</Link>
          <Link className="topnav-tab active" href="/tasks">📝 Bài tập</Link>
          <Link className="topnav-tab" href="/closure">🔑 Tìm siêu khóa</Link>
          <span className="topnav-breadcrumb">› Chi tiết</span>
        </nav>
      </div>
      <div className="dashboard-user">
        <div className="user-avatar">{(account?.name || account?.email || "U").slice(0, 1).toUpperCase()}</div>
        <div className="user-details"><strong>{account?.name || "Tài khoản"}</strong><span>{account?.email}</span></div>
        <button type="button" onClick={() => void signOut({ callbackUrl: "/login" })}>Đăng xuất</button>
      </div>
    </header>

    <section className="task-detail-content">
      <div className="task-detail-top-nav">
        <Link className="task-back-link" href="/tasks">← Quay lại danh sách bài tập</Link>
        <span className={`task-state task-state-${state.tone}`}>
          <span className="task-state-dot" />
          {state.label}
        </span>
      </div>

      {error && <div className="dashboard-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")}>Đóng</button></div>}
      {assignmentNotice && <div className="task-assignment-message" role="status"><span>{assignmentNotice}</span><button type="button" onClick={() => setAssignmentNotice("")}>Đóng</button></div>}

      <article className="task-detail-card">
        <div className="task-detail-heading">
          <div>
            <span className="dashboard-eyebrow">CHI TIẾT BÀI TẬP</span>
            <h1>{task.title}</h1>
          </div>
          <span className="task-detail-date">🕒 Ngày tạo: {formatDate(task.createdAt)}</span>
        </div>

        {/* Task description box */}
        <div className="task-description-box">
          <div className="task-description-header">
            <span>📋 NỘI DUNG ĐỀ BÀI</span>
          </div>
          <p>{task.description}</p>
        </div>

        {/* People involved */}
        <div className="task-people-grid">
          <div className="task-person-card">
            <span className="person-role-tag">👤 NGƯỜI GIAO ĐỀ</span>
            <strong>{task.createdByName}</strong>
            <small>{task.createdByEmail}</small>
          </div>
          <div className="task-person-card">
            <span className="person-role-tag">🎯 NGƯỜI LÀM BÀI</span>
            <strong>{task.assignedToName || "Chưa chọn người nhận"}</strong>
            <small>{task.assignedToEmail || "Đề trong kho · Chưa giao"}</small>
          </div>
        </div>

        {/* Action Panel: Creator assigning draft */}
        {isCreator && task.status === "draft" && (
          <section className="task-action-panel task-assign-panel">
            <div className="task-assign-copy">
              <h2>Giao bài tập cho tài khoản</h2>
              <p>Mỗi lần giao sẽ tạo một lượt làm bài riêng. Đề gốc vẫn ở trong kho để bạn giao cho nhiều người hoặc giao lại sau.</p>
            </div>
            <div className="recipient-picker">
              {selectedRecipient ? (
                <div className="recipient-selected">
                  <span>
                    <strong>{selectedRecipient.name}</strong>
                    <small>{selectedRecipient.email}</small>
                  </span>
                  <button type="button" disabled={busy} onClick={() => { setSelectedRecipient(null); setRecipientQuery(""); }}>Đổi người khác</button>
                </div>
              ) : (
                <>
                  <label htmlFor="recipient-search">Tìm tài khoản học viên</label>
                  <input id="recipient-search" type="search" autoComplete="off" value={recipientQuery} onChange={(event) => setRecipientQuery(event.target.value)} placeholder="Nhập tên hoặc email học viên để tìm…" />
                  {recipientQuery.trim().length >= 2 && (
                    <div className="recipient-results" role="listbox" aria-label="Tài khoản phù hợp">
                      {searchingRecipients ? (
                        <p>Đang tìm tài khoản…</p>
                      ) : recipients.length ? (
                        recipients.map((recipient) => (
                          <button type="button" role="option" aria-selected={false} key={recipient.id} onClick={() => { setSelectedRecipient(recipient); setRecipientQuery(""); setRecipients([]); }}>
                            <strong>{recipient.name}</strong>
                            <small>{recipient.email}</small>
                          </button>
                        ))
                      ) : (
                        <p>Không tìm thấy tài khoản phù hợp.</p>
                      )}
                    </div>
                  )}
                </>
              )}
              <button className="create-diagram-button" type="button" disabled={busy || !selectedRecipient} onClick={() => void assignTask()}>
                {busy ? "Đang xử lý…" : "Giao bài tập ngay"}
              </button>
            </div>
          </section>
        )}

        {isCreator && task.status === "draft" && task.deliveries?.length ? (
          <section className="task-deliveries">
            <header>
              <div><span className="dashboard-eyebrow">CÁC LƯỢT ĐÃ GIAO</span><h2>{task.deliveries.length} lượt làm bài</h2></div>
              <Link href="/tasks">Xem danh sách đã giao →</Link>
            </header>
            <div className="task-delivery-list">
              {task.deliveries.map((delivery) => {
                const deliveryState = statusLabel(delivery);
                return <Link key={delivery.id} href={`/tasks/${delivery.id}`} className="task-delivery-row">
                  <span><strong>{delivery.assignedToName || "Người nhận"}</strong><small>{delivery.assignedToEmail || "—"}</small></span>
                  <span className={`task-state task-state-${deliveryState.tone}`}><span className="task-state-dot" />{deliveryState.label}</span>
                  <time>{formatDate(delivery.updatedAt)}</time>
                </Link>;
              })}
            </div>
          </section>
        ) : null}

        {isCreator && task.status !== "draft" && task.sourceTaskId && (
          <div className="task-notice notice-active">Đây là một lượt làm bài riêng. <Link href={`/tasks/${task.sourceTaskId}`}>Mở đề gốc trong kho để giao thêm lượt →</Link></div>
        )}

        {isCreator && task.status !== "draft" && !task.sourceTaskId && (
          <section className="task-action-panel task-reuse-panel">
            <div><h2>Lưu đề này vào kho</h2><p>Tạo một bản đề gốc để bạn có thể giao bài này cho nhiều học viên.</p></div>
            <button className="create-diagram-button" type="button" disabled={busy} onClick={() => void saveAsDraft()}>
              {busy ? "Đang lưu…" : "Đưa đề vào kho"}
            </button>
          </section>
        )}

        {/* Action Panel: Assignee invited */}
        {!isCreator && task.status === "invited" && (
          <section className="task-action-panel invitation-panel">
            <div>
              <h2>Lời mời làm bài tập ERD</h2>
              <p>Khi chấp nhận, hệ thống sẽ tự động tạo một sơ đồ ERD mới trong tài khoản của bạn để bắt đầu làm bài.</p>
            </div>
            <div className="task-action-buttons">
              <button className="task-decline-button" type="button" disabled={busy} onClick={() => void respond("decline")}>
                Từ chối
              </button>
              <button className="create-diagram-button" type="button" disabled={busy} onClick={() => void respond("accept")}>
                {busy ? "Đang mở sơ đồ…" : "Chấp nhận và làm bài"}
              </button>
            </div>
          </section>
        )}

        {/* Action Panel: Assignee accepted / working */}
        {!isCreator && task.status === "accepted" && (
          <section className="task-action-panel working-panel">
            <div>
              <h2>Không gian làm bài tập</h2>
              <p>{submission ? `Bạn đã nộp phiên bản ${submission.version} lúc ${formatDate(submission.submittedAt)}. Bạn vẫn có thể tiếp tục chỉnh sửa và nộp lại bất cứ lúc nào.` : "Nhấn nút bên cạnh để mở khung vẽ ERD và thiết kế các bảng theo yêu cầu đề bài. Sơ đồ tự động lưu khi thao tác."}</p>
            </div>
            {task.diagramId && (
              <Link className="create-diagram-button action-btn-link" href={`/diagrams/${task.diagramId}`}>
                {submission ? "Mở sơ đồ & nộp lại ↗" : "Mở sơ đồ làm bài ↗"}
              </Link>
            )}
          </section>
        )}

        {/* Grade Result Card */}
        {task.grade && (!submission || task.grade.submissionVersion === submission.version) && (
          <div className="task-grade-result-card">
            <div className="grade-badge-side">
              <span className="grade-score-number">{task.grade.score}</span>
              <span className="grade-score-scale">/ 10 ĐIỂM</span>
            </div>
            <div className="grade-feedback-side">
              <strong>Nhận xét từ người giao đề:</strong>
              <p>{task.grade.feedback || "Chưa có nhận xét chi tiết."}</p>
              <small>Chấm cho bài nộp phiên bản {task.grade.submissionVersion}</small>
            </div>
          </div>
        )}

        {/* Status notice boxes */}
        {task.status === "declined" && (
          <div className="task-notice notice-declined">
            ⚠️ {isCreator ? `${task.assignedToName} đã từ chối lời mời làm bài này.` : "Bạn đã từ chối lời mời làm bài này."}
          </div>
        )}
        {isCreator && task.status === "invited" && (
          <div className="task-notice notice-waiting">
            ⏳ Đang chờ người nhận phản hồi lời mời làm bài.
          </div>
        )}
        {isCreator && task.status === "accepted" && !submission && (
          <div className="task-notice notice-active">
            ✏️ {task.assignedToName} đã chấp nhận bài tập và đang thực hiện thiết kế sơ đồ.
          </div>
        )}

        {/* Submission preview section */}
        {submission && (
          <section className="submission-section">
            <div className="submission-heading">
              <div>
                <span className="dashboard-eyebrow">BÀI LÀM ĐÃ NỘP (PHIÊN BẢN {submission.version})</span>
                <h2>{isCreator ? "Mô hình ERD của học viên" : "Bản chụp sơ đồ bạn đã nộp gần nhất"}</h2>
              </div>
              <time>🕒 Nộp lúc: {formatDate(submission.submittedAt)}</time>
            </div>

            {submission.entities.length ? (
              <div className="submission-tables">
                {submission.entities.map((entity, index) => {
                  const hasPk = entity.columns?.some((c) => c.pk);
                  return (
                    <article className={`submission-table ${hasPk ? "table-is-pk" : ""}`} key={entity.id || index}>
                      <div className="submission-table-header">
                        <span className="submission-table-icon">🗂</span>
                        <h3>{entity.name || "Bảng chưa đặt tên"}</h3>
                        {hasPk && <span className="table-role-tag pk-tag">Khóa chính</span>}
                      </div>
                      {entity.columns?.length ? (
                        <div className="submission-column-list">
                          {entity.columns.map((column, columnIndex) => (
                            <div className={`submission-column ${column.pk ? "is-pk-column" : ""}`} key={column.id || columnIndex}>
                              <span className="col-key-icon">{column.pk ? "🔑" : "•"}</span>
                              <strong>{column.name || "cột_chưa_đặt_tên"}</strong>
                              <code>{column.type || "—"}</code>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="submission-no-columns">Chưa có thuộc tính nào.</p>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="task-notice">Bài nộp hiện chưa có bảng nào.</div>
            )}

            {submission.relations.length > 0 && (
              <div className="submission-relations">
                <h3>Các mối quan hệ đã thiết lập ({submission.relations.length})</h3>
                <div className="submission-rel-grid">
                  {submission.relations.map((relation, index) => {
                    const relType = relation.label?.trim() || "1 : N";
                    const relClass = relType === "1 : 1" ? "rel-1-1" : relType === "1 : N" ? "rel-1-n" : "rel-n-m";
                    return (
                      <div className="submission-rel-row" key={relation.id || index}>
                        <strong>{entityNames.get(relation.from ?? "") || "Bảng nguồn"}</strong>
                        <span className={`submission-rel-badge ${relClass}`}>{relType}</span>
                        <strong>{entityNames.get(relation.to ?? "") || "Bảng đích"}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Grading panel for creator */}
        {isCreator && submission && (
          <section className="task-grade-panel">
            <div>
              <span className="dashboard-eyebrow">CHẤM ĐIỂM & ĐÁNH GIÁ</span>
              <h2>{task.grade?.submissionVersion === submission.version ? "Cập nhật điểm và nhận xét" : "Chấm điểm bài nộp"}</h2>
              <p>Điểm số và lời nhận xét sẽ được gửi ngay đến người làm bài tập.</p>
            </div>
            <form onSubmit={gradeTask}>
              <label htmlFor="task-score">Điểm số (Thang điểm 10)</label>
              <input id="task-score" type="number" min="0" max="10" step="0.5" required value={score} onChange={(event) => setScore(event.target.value)} placeholder="Ví dụ: 8.5" />
              <label htmlFor="task-feedback">Lời nhận xét chi tiết</label>
              <textarea id="task-feedback" maxLength={2000} value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Nhận xét về cấu trúc bảng, khóa chính, khóa ngoại và mối quan hệ..." />
              <button className="create-diagram-button" type="submit" disabled={busy || score === "" || Number(score) < 0 || Number(score) > 10}>
                {busy ? "Đang lưu…" : task.grade?.submissionVersion === submission.version ? "Cập nhật đánh giá" : "Lưu điểm và nhận xét"}
              </button>
            </form>
          </section>
        )}
      </article>
    </section>
  </main>;
}
