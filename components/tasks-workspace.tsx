"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import AccountAvatarButton from "@/components/account-avatar-button";
import BatchDraftAssignBar from "@/components/batch-draft-assign-bar";
import BoxesLoader from "@/components/boxes-loader";
import GradientProgressBar from "@/components/gradient-progress-bar";
import IosCheckbox from "@/components/ios-checkbox";
import MailActionsBar from "@/components/mail-actions-bar";
import TaskPedestalIcon, { type PedestalTone } from "@/components/task-pedestal-icon";
import ThemeToggle from "@/components/theme-toggle";
import TopNavGlass from "@/components/top-nav-glass";
import { isActivityAdminEmail } from "@/lib/activity-types";
import { resolveUserAvatar } from "@/lib/avatars";
import { readJsonResponse } from "@/lib/read-json-response";
import type { AssignmentTask } from "@/lib/task-types";

type TaskScope = "received" | "drafts" | "sent";
type Account = { id: string; name: string | null; email: string | null; image?: string | null };
type TaskAssigneeGroup = {
  key: string;
  name: string;
  email: string;
  image: string;
  tasks: AssignmentTask[];
  totalCount: number;
  gradedCount: number;
  submittedPendingCount: number;
  activeCount: number;
  invitedCount: number;
  declinedCount: number;
  submittedCount: number;
  completionRate: number;
  avgScore: number | null;
  latestActivityAt: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });
}

function getAssigneeKey(task: {
  assignedToId: string | null;
  assignedToName: string | null;
  assignedToEmail: string | null;
}) {
  if (task.assignedToId) return `id:${task.assignedToId}`;
  const email = (task.assignedToEmail ?? "").trim().toLowerCase();
  if (email) return `email:${email}`;
  const name = (task.assignedToName ?? "").trim().toLowerCase();
  if (name) return `name:${name}`;
  return "unassigned";
}

function isTaskOverdue(dueAt?: string | null): boolean {
  if (!dueAt) return false;
  const ms = new Date(dueAt).getTime();
  return Number.isFinite(ms) && ms < Date.now();
}

function isErdTaskOverdueUnfinished(task: AssignmentTask): boolean {
  if (task.status === "draft" || task.status === "declined") return false;
  if (task.submission) return false;
  return isTaskOverdue(task.dueAt);
}

function isErdEffectivelyAccepted(task: AssignmentTask): boolean {
  return task.status === "accepted" || Boolean(task.diagramId || task.submission || task.grade);
}

function erdTaskPedestalTone(task: AssignmentTask): PedestalTone {
  if (task.status === "draft") return "slate";
  if (task.submission && task.grade?.submissionVersion === task.submission.version) return "green";
  if (task.status === "declined") return "red";
  if (isErdTaskOverdueUnfinished(task)) return "red";
  if (task.status === "invited" && !isErdEffectivelyAccepted(task)) return "gold";
  return "blue";
}

function taskState(task: AssignmentTask, scope: TaskScope) {
  if (task.status === "draft") return { label: "Trong kho", tone: "draft" };
  if (task.status === "declined") return { label: "Đã từ chối", tone: "declined" };
  if (task.submission && task.grade?.submissionVersion === task.submission.version) return { label: "Đã chấm điểm", tone: "graded" };
  if (task.submission) return { label: "Đã nộp bài", tone: "submitted" };
  if (isErdTaskOverdueUnfinished(task)) {
    return task.status === "invited" && !isErdEffectivelyAccepted(task)
      ? { label: "Quá hạn · Chưa nhận", tone: "overdue" }
      : { label: "Quá hạn · Chưa nộp", tone: "overdue" };
  }
  if (task.status === "invited" && !isErdEffectivelyAccepted(task)) return scope === "received"
    ? { label: "Chờ bạn phản hồi", tone: "waiting" }
    : { label: "Đang chờ chấp nhận", tone: "waiting" };
  return { label: "Đang thực hiện", tone: "active" };
}

function buildTaskAssigneeGroups(tasks: AssignmentTask[]): TaskAssigneeGroup[] {
  const map = new Map<string, AssignmentTask[]>();
  for (const task of tasks) {
    const key = getAssigneeKey(task);
    const list = map.get(key) ?? [];
    list.push(task);
    map.set(key, list);
  }

  return Array.from(map.entries())
    .map(([key, groupTasks]) => {
      const sample = groupTasks[0];
      const name =
        groupTasks.find((t) => t.assignedToName?.trim())?.assignedToName?.trim() ||
        sample.assignedToEmail?.trim() ||
        "Chưa xác định";
      const email =
        groupTasks.find((t) => t.assignedToEmail?.trim())?.assignedToEmail?.trim() || "—";
      const image = resolveUserAvatar({
        id: sample.assignedToId,
        email: email === "—" ? null : email,
        name,
        image: groupTasks.find((t) => t.assignedToImage)?.assignedToImage,
      });

      let gradedCount = 0;
      let submittedPendingCount = 0;
      let activeCount = 0;
      let invitedCount = 0;
      let declinedCount = 0;
      let scoreSum = 0;
      let latestActivityAt = sample.submission?.submittedAt || sample.updatedAt;

      for (const task of groupTasks) {
        const activity = task.submission?.submittedAt || task.updatedAt;
        if (new Date(activity).getTime() > new Date(latestActivityAt).getTime()) {
          latestActivityAt = activity;
        }
        if (task.status === "declined") {
          declinedCount += 1;
        } else if (task.status === "invited") {
          invitedCount += 1;
        } else if (task.submission && task.grade?.submissionVersion === task.submission.version) {
          gradedCount += 1;
          scoreSum += task.grade.score;
        } else if (task.submission) {
          submittedPendingCount += 1;
        } else {
          activeCount += 1;
        }
      }

      const totalCount = groupTasks.length;
      const submittedCount = gradedCount + submittedPendingCount;
      const completionRate = totalCount > 0 ? Math.round((submittedCount / totalCount) * 100) : 0;
      const avgScore = gradedCount > 0 ? Math.round((scoreSum / gradedCount) * 10) / 10 : null;

      return {
        key,
        name,
        email,
        image,
        tasks: groupTasks,
        totalCount,
        gradedCount,
        submittedPendingCount,
        activeCount,
        invitedCount,
        declinedCount,
        submittedCount,
        completionRate,
        avgScore,
        latestActivityAt,
      };
    })
    .sort((a, b) => {
      const diff = new Date(b.latestActivityAt).getTime() - new Date(a.latestActivityAt).getTime();
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name, "vi");
    });
}

function assigneeSummaryState(group: TaskAssigneeGroup) {
  if (group.totalCount > 0 && group.gradedCount === group.totalCount) {
    return { label: `Hoàn thành · ${group.gradedCount}/${group.totalCount} đã chấm`, tone: "graded" as const };
  }
  if (group.submittedPendingCount > 0) {
    return { label: `Chờ chấm · ${group.submittedPendingCount} bài đã nộp`, tone: "submitted" as const };
  }
  if (group.gradedCount > 0) {
    return { label: `Đã chấm ${group.gradedCount}/${group.totalCount} bài`, tone: "graded" as const };
  }
  if (group.activeCount > 0) {
    return { label: `Đang thực hiện · ${group.activeCount} bài`, tone: "active" as const };
  }
  if (group.invitedCount > 0) {
    return { label: `Chờ phản hồi · ${group.invitedCount} bài`, tone: "waiting" as const };
  }
  return { label: "Đã từ chối", tone: "declined" as const };
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
  const [selectedAssigneeKey, setSelectedAssigneeKey] = useState<string | null>(null);
  const [assigneeQuery, setAssigneeQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const syncUrl = (nextScope: TaskScope, nextAssigneeKey: string | null) => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (nextScope === "sent") {
      params.set("scope", "sent");
      if (nextAssigneeKey) params.set("assignee", nextAssigneeKey);
    } else if (nextScope === "drafts") {
      params.set("scope", "drafts");
    }
    const query = params.toString();
    window.history.replaceState(null, "", query ? `/tasks?${query}` : "/tasks");
  };

  const switchScope = (nextScope: TaskScope) => {
    setScope(nextScope);
    setSelectedAssigneeKey(null);
    setAssigneeQuery("");
    syncUrl(nextScope, null);
  };

  const openAssignee = (assigneeKey: string) => {
    setSelectedAssigneeKey(assigneeKey);
    syncUrl("sent", assigneeKey);
  };

  const backToAssignees = () => {
    setSelectedAssigneeKey(null);
    syncUrl("sent", null);
  };

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

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const paramScope = params.get("scope");
      const paramAssignee = params.get("assignee");
      if (paramScope === "received" || paramScope === "drafts" || paramScope === "sent") {
        setScope(paramScope);
        if (paramScope === "sent" && paramAssignee) {
          setSelectedAssigneeKey(paramAssignee);
        }
      }
    }
    void loadTasks();

    const refreshQuietly = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/tasks", { cache: "no-store" });
        if (!res.ok) return;
        const result = await readJsonResponse<{
          received?: AssignmentTask[];
          sent?: AssignmentTask[];
          drafts?: AssignmentTask[];
        }>(res);
        if (Array.isArray(result.received)) setReceived(result.received);
        if (Array.isArray(result.sent)) setSent(result.sent);
        if (Array.isArray(result.drafts)) setDrafts(result.drafts);
      } catch {
        // ignore transient refresh failures
      }
    };

    const intervalId = window.setInterval(() => {
      void refreshQuietly();
    }, 8_000);
    const handleVisible = () => {
      if (document.visibilityState === "visible") void refreshQuietly();
    };
    const handleFocus = () => {
      void refreshQuietly();
    };

    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

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
      switchScope("drafts");
      await loadTasks();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Không thể lưu đề bài.");
    } finally {
      setCreating(false);
    }
  };

  const assigneeGroups = buildTaskAssigneeGroups(sent);
  const selectedAssignee =
    scope === "sent" && selectedAssigneeKey
      ? assigneeGroups.find((group) => group.key === selectedAssigneeKey) ?? null
      : null;
  const showAssigneeDirectory = scope === "sent" && !selectedAssignee;

  const normalizedAssigneeQuery = assigneeQuery.trim().toLowerCase();
  const filteredAssigneeGroups = normalizedAssigneeQuery
    ? assigneeGroups.filter(
        (group) =>
          group.name.toLowerCase().includes(normalizedAssigneeQuery) ||
          group.email.toLowerCase().includes(normalizedAssigneeQuery),
      )
    : assigneeGroups;

  const items =
    scope === "received"
      ? received
      : scope === "drafts"
        ? drafts
        : selectedAssignee
          ? selectedAssignee.tasks
          : [];

  if (loading) return <div className="dashboard-loading"><BoxesLoader /><p>Đang tải bài tập…</p></div>;

  return <main className="tasks-page">
    <header className="dashboard-topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <Link className="dashboard-brand" href="/"><Image src="/erd-draw-logo.png" alt="ERD Draw" width={144} height={96} priority unoptimized /></Link>
        <TopNavGlass active="tasks" showActivity={isActivityAdminEmail(account?.email)} />
      </div>
      <div className="dashboard-user">
        <ThemeToggle />
        <AccountAvatarButton account={account} onUpdated={(image) => setAccount((prev) => (prev ? { ...prev, image } : prev))} />
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
        <button className={scope === "received" ? "active" : ""} type="button" role="tab" aria-selected={scope === "received"} onClick={() => switchScope("received")}>
          📥 Được giao <span className="tab-counter">{received.length}</span>
        </button>
        <button className={scope === "drafts" ? "active" : ""} type="button" role="tab" aria-selected={scope === "drafts"} onClick={() => switchScope("drafts")}>
          📝 Kho đề <span className="tab-counter">{drafts.length}</span>
        </button>
        <button className={scope === "sent" ? "active" : ""} type="button" role="tab" aria-selected={scope === "sent"} onClick={() => switchScope("sent")}>
          📤 Đã giao <span className="tab-counter">{sent.length}</span>
        </button>
      </div>

      {scope === "sent" && selectedAssignee && (
        <section className="selected-assignee-header">
          <div className="selected-assignee-top">
            <button
              type="button"
              className="task-back-link assignee-back-btn"
              onClick={backToAssignees}
            >
              ← Quay lại danh sách người được giao
            </button>
            <span className="selected-assignee-count">
              Đang xem {selectedAssignee.totalCount} bài đã giao
            </span>
          </div>
          <div className="selected-assignee-profile">
            <div className={`assignee-avatar assignee-avatar-${assigneeSummaryState(selectedAssignee).tone} has-photo`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedAssignee.image} alt={selectedAssignee.name} className="avatar-img" />
            </div>
            <div className="selected-assignee-info">
              <div className="selected-assignee-name-row">
                <h2>{selectedAssignee.name}</h2>
                <span className={`task-state task-state-${assigneeSummaryState(selectedAssignee).tone}`}>
                  <span className="task-state-dot" />
                  {assigneeSummaryState(selectedAssignee).label}
                </span>
              </div>
              <p className="task-person-meta">{selectedAssignee.email}</p>
              <div className="task-card-meta-row">
                <span className="assignee-count-pill">📚 {selectedAssignee.totalCount} bài đã giao</span>
                <span className={`code-progress-pill ${selectedAssignee.submittedCount > 0 ? "is-pass" : "is-fail"}`}>
                  📄 {selectedAssignee.submittedCount}/{selectedAssignee.totalCount} đã nộp ({selectedAssignee.completionRate}%)
                </span>
                {selectedAssignee.gradedCount > 0 && (
                  <span className="task-grade-pill">
                    ✅ {selectedAssignee.gradedCount} đã chấm{selectedAssignee.avgScore !== null ? ` · ⭐️ TB ${selectedAssignee.avgScore}/10` : ""}
                  </span>
                )}
                {selectedAssignee.submittedPendingCount > 0 && (
                  <span className="task-sub-count">📝 {selectedAssignee.submittedPendingCount} chờ chấm</span>
                )}
                {selectedAssignee.activeCount > 0 && (
                  <span className="assignee-stat-pill">✏️ {selectedAssignee.activeCount} đang làm</span>
                )}
                {selectedAssignee.invitedCount > 0 && (
                  <span className="due-pill">⏳ {selectedAssignee.invitedCount} chờ phản hồi</span>
                )}
                {selectedAssignee.declinedCount > 0 && (
                  <span className="assignee-stat-declined">✕ {selectedAssignee.declinedCount} từ chối</span>
                )}
              </div>
              <GradientProgressBar
                percentage={selectedAssignee.completionRate}
                size="sm"
                ariaLabel={`Tỉ lệ nộp bài ${selectedAssignee.completionRate}%`}
              />
            </div>
          </div>
        </section>
      )}

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

      {showAssigneeDirectory && sent.length > 0 && (
        <MailActionsBar onSuccess={setNotice} onError={setError} />
      )}

      {showAssigneeDirectory ? (
        sent.length > 0 ? (
          <div className="assignee-directory">
            <div className="assignee-directory-bar">
              <div className="assignee-directory-heading">
                <div className="assignee-directory-title-row">
                  <h2>👥 Danh sách người được giao</h2>
                  <span className="assignee-directory-badge">
                    {assigneeGroups.length} người · {sent.length} bài đã giao
                  </span>
                </div>
                <p>Nhấn vào từng người để xem danh sách bài tập ERD đã giao cho người đó.</p>
              </div>
              {assigneeGroups.length > 1 && (
                <div className="assignee-search-box">
                  <input
                    type="search"
                    value={assigneeQuery}
                    onChange={(event) => setAssigneeQuery(event.target.value)}
                    placeholder="Tìm theo tên hoặc email…"
                    aria-label="Tìm người được giao"
                  />
                </div>
              )}
            </div>

            {filteredAssigneeGroups.length > 0 ? (
              <div className="task-list">
                {filteredAssigneeGroups.map((group) => {
                  const summary = assigneeSummaryState(group);
                  return (
                    <button
                      type="button"
                      key={group.key}
                      className={`task-list-card assignee-card task-card-${summary.tone}`}
                      onClick={() => openAssignee(group.key)}
                    >
                      <div className={`assignee-avatar assignee-avatar-${summary.tone} has-photo`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={group.image} alt={group.name} className="avatar-img" loading="lazy" />
                      </div>
                      <div className="task-list-main">
                        <div className="task-list-title">
                          <h2>{group.name}</h2>
                          <span className={`task-state task-state-${summary.tone}`}>
                            <span className="task-state-dot" />
                            {summary.label}
                          </span>
                        </div>
                        <p className="task-person-meta">{group.email}</p>
                        <div className="task-card-meta-row">
                          <span className="assignee-count-pill">📚 {group.totalCount} bài đã giao</span>
                          <span className={`code-progress-pill ${group.submittedCount > 0 ? "is-pass" : "is-fail"}`}>
                            📄 {group.submittedCount}/{group.totalCount} đã nộp
                          </span>
                          {group.gradedCount > 0 && (
                            <span className="task-grade-pill">
                              ✅ {group.gradedCount} đã chấm{group.avgScore !== null ? ` · ⭐️ TB ${group.avgScore}/10` : ""}
                            </span>
                          )}
                          {group.submittedPendingCount > 0 && (
                            <span className="task-sub-count">📝 {group.submittedPendingCount} chờ chấm</span>
                          )}
                          {group.activeCount > 0 && (
                            <span className="assignee-stat-pill">✏️ {group.activeCount} đang làm</span>
                          )}
                          {group.invitedCount > 0 && (
                            <span className="due-pill">⏳ {group.invitedCount} chờ phản hồi</span>
                          )}
                          {group.declinedCount > 0 && (
                            <span className="assignee-stat-declined">✕ {group.declinedCount} từ chối</span>
                          )}
                          <span className="task-list-date">
                            🕒 Cập nhật gần nhất: {formatDate(group.latestActivityAt)}
                          </span>
                        </div>
                        <GradientProgressBar
                          percentage={group.completionRate}
                          size="sm"
                          ariaLabel={`Tỉ lệ nộp bài ${group.completionRate}%`}
                        />
                      </div>
                      <span className="task-list-arrow">›</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <section className="tasks-empty assignee-search-empty">
                <div className="tasks-empty-icon">🔍</div>
                <h2>Không tìm thấy người được giao phù hợp</h2>
                <p>Không có học viên nào khớp với từ khóa “{assigneeQuery.trim()}”.</p>
                <button
                  type="button"
                  className="code-secondary-button"
                  onClick={() => setAssigneeQuery("")}
                >
                  Xóa từ khóa tìm kiếm
                </button>
              </section>
            )}
          </div>
        ) : (
          <section className="tasks-empty">
            <div className="tasks-empty-icon">📤</div>
            <h2>Bạn chưa giao bài tập nào</h2>
            <p>Các người được giao và danh sách bài tập của từng người sẽ hiển thị tại đây.</p>
            <button className="create-diagram-button" type="button" onClick={() => setShowCreate(true)}>
              ＋ Tạo đề bài ngay
            </button>
          </section>
        )
      ) : items.length ? (
        <div className="task-list">
          {items.map((task) => {
            const state = taskState(task, scope);
            const pedestalTone = erdTaskPedestalTone(task);
            const personLabel = scope === "received"
              ? `Người giao: ${task.createdByName} (${task.createdByEmail})`
              : scope === "drafts"
                ? "Kho đề bài · Có thể giao nhiều lần"
                : `Người nhận: ${task.assignedToName || "Chưa có"} (${task.assignedToEmail || "—"})`;
            const isSelected = scope === "drafts" && selectedDraftIds.includes(task.id);
            const taskHref =
              scope === "sent" && selectedAssignee
                ? `/tasks/${task.id}?assignee=${encodeURIComponent(selectedAssignee.key)}`
                : `/tasks/${task.id}`;

            const card = (
              <Link className={`task-list-card task-card-${state.tone} ${isSelected ? "is-selected-card" : ""}`} href={taskHref} key={task.id}>
                <TaskPedestalIcon tone={pedestalTone} />
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
                    {task.dueAt && (
                      <span className={`due-pill ${isErdTaskOverdueUnfinished(task) ? "is-overdue" : ""}`}>
                        {isErdTaskOverdueUnfinished(task) ? "⚠️ Quá hạn:" : "⏰ Hạn:"} {formatDate(task.dueAt)}
                      </span>
                    )}
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
                  <IosCheckbox
                    checked={isSelected}
                    ariaLabel={`Chọn đề ${task.title}`}
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
