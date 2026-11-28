"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AccountAvatarButton from "@/components/account-avatar-button";
import BatchDraftAssignBar from "@/components/batch-draft-assign-bar";
import BoxesLoader from "@/components/boxes-loader";
import IosCheckbox from "@/components/ios-checkbox";
import MailActionsBar from "@/components/mail-actions-bar";
import TaskPedestalIcon, { type PedestalTone } from "@/components/task-pedestal-icon";
import ThemeToggle from "@/components/theme-toggle";
import TopNavGlass from "@/components/top-nav-glass";
import { isActivityAdminEmail } from "@/lib/activity-types";
import { resolveUserAvatar } from "@/lib/avatars";
import type { CodeTask } from "@/lib/code-task-types";
import { readJsonResponse } from "@/lib/read-json-response";

type TaskScope = "received" | "drafts" | "sent";
type Account = { id: string; name: string | null; email: string | null; image?: string | null };
type CodeTaskItem = CodeTask & { passedDeliveryCount?: number };
type CodeAssigneeGroup = {
  key: string;
  name: string;
  email: string;
  image: string;
  tasks: CodeTaskItem[];
  totalCount: number;
  passedCount: number;
  failedCount: number;
  inProgressCount: number;
  invitedCount: number;
  declinedCount: number;
  totalRuns: number;
  passRate: number;
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

function getLatestActivityTime(task: CodeTaskItem) {
  return task.lastRun?.ranAt || task.submission?.submittedAt || task.updatedAt;
}

const DEFAULT_CLUSTER = "Bài tập Code khác";
const CLUSTER_ORDER = [
  "JavaScript Cơ bản",
  "JavaScript – Toán tử",
  "JavaScript – Câu lệnh điều kiện",
  "JavaScript – Vòng lặp",
  "JavaScript – Hàm (Function)",
  "JavaScript – Mảng (Array)",
  "JavaScript – Đối tượng (Object)",
  "JavaScript – DOM và Sự kiện",
];

function getTaskCluster(task: CodeTaskItem): string {
  if (task.category && task.category.trim()) return task.category.trim();
  const t = task.title.toLowerCase();
  if (
    t.includes("giới thiệu bản thân") ||
    t.includes("cộng hai số") ||
    t.includes("đổi màu nền") ||
    t.includes("danh sách công việc") ||
    t.includes("hệ thống đăng ký khóa học")
  ) {
    return "JavaScript – DOM và Sự kiện";
  }
  if (t.includes("(object)") || t.includes("giỏ hàng")) {
    return "JavaScript – Đối tượng (Object)";
  }
  if (
    t.includes("danh sách sinh viên") ||
    t.includes("danh sách sản phẩm") ||
    t.includes("tính toán điểm sinh viên") ||
    t.includes("kho hàng") ||
    t.includes("quản lý điểm sinh viên")
  ) {
    return "JavaScript – Mảng (Array)";
  }
  if (
    t.includes("hàm ") ||
    t.includes("bằng function")
  ) {
    return "JavaScript – Hàm (Function)";
  }
  if (
    t.includes("dãy số tự nhiên") ||
    t.includes("tính tổng các số") ||
    t.includes("bảng cửu chương") ||
    t.includes("số nguyên tố") ||
    t.includes("đăng nhập tài khoản")
  ) {
    return "JavaScript – Vòng lặp";
  }
  if (
    t.includes("xếp loại học lực") ||
    t.includes("số chẵn và số lẻ") ||
    t.includes("máy tính bỏ túi") ||
    t.includes("tiền điện") ||
    t.includes("quản lý đơn hàng")
  ) {
    return "JavaScript – Câu lệnh điều kiện";
  }
  if (
    t.includes("tính toán cơ bản") ||
    t.includes("điểm trung bình") ||
    t.includes("điều kiện mua hàng") ||
    t.includes("tính lương nhân viên") ||
    t.includes("đăng ký khóa học")
  ) {
    return "JavaScript – Toán tử";
  }
  if (
    t.includes("thông tin cá nhân") ||
    t.includes("quản lý sản phẩm") ||
    t.includes("quản lý khóa học") ||
    t.includes("thông tin nhân viên") ||
    t.includes("tài khoản ngân hàng")
  ) {
    return "JavaScript Cơ bản";
  }
  return DEFAULT_CLUSTER;
}

function sortClusterNames(a: string, b: string) {
  if (a === DEFAULT_CLUSTER) return 1;
  if (b === DEFAULT_CLUSTER) return -1;
  const ia = CLUSTER_ORDER.indexOf(a);
  const ib = CLUSTER_ORDER.indexOf(b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.localeCompare(b, "vi");
}

function getLatestAutoGrade(task: CodeTaskItem) {
  return task.lastRun?.autoGrade ?? task.submission?.autoGrade ?? null;
}

function codeTaskPedestalTone(task: CodeTaskItem): PedestalTone {
  if (task.status === "draft") return "slate";
  const autoGrade = getLatestAutoGrade(task);
  if (autoGrade?.passed) return "green";
  if (task.status === "declined") return "red";
  const isOverdue = Boolean(task.dueAt && new Date(task.dueAt).getTime() < Date.now());
  if (isOverdue) return "red";
  if (task.status === "invited") return "gold";
  return "blue";
}

function codeTaskState(task: CodeTaskItem, scope: TaskScope) {
  if (task.status === "draft") return { label: "Trong kho", tone: "draft" };
  if (task.status === "declined") return { label: "Đã từ chối", tone: "declined" };
  if (task.status === "invited") {
    return scope === "received"
      ? { label: "Chờ bạn nhận bài", tone: "waiting" }
      : { label: "Đang chờ nhận", tone: "waiting" };
  }
  const autoGrade = getLatestAutoGrade(task);
  if (autoGrade) {
    if (autoGrade.passed) return { label: `PASS · ${autoGrade.percentage}%`, tone: "graded" };
    return { label: `Chưa đạt · ${autoGrade.percentage}%`, tone: "submitted" };
  }
  return { label: "Đang code", tone: "active" };
}

function buildCodeAssigneeGroups(tasks: CodeTaskItem[]): CodeAssigneeGroup[] {
  const map = new Map<string, CodeTaskItem[]>();
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

      let passedCount = 0;
      let failedCount = 0;
      let inProgressCount = 0;
      let invitedCount = 0;
      let declinedCount = 0;
      let totalRuns = 0;
      let latestActivityAt = getLatestActivityTime(sample);

      for (const task of groupTasks) {
        const activity = getLatestActivityTime(task);
        if (new Date(activity).getTime() > new Date(latestActivityAt).getTime()) {
          latestActivityAt = activity;
        }
        totalRuns += task.lastRun?.runCount ?? task.submission?.runCount ?? 0;

        if (task.status === "declined") {
          declinedCount += 1;
        } else if (task.status === "invited") {
          invitedCount += 1;
        } else {
          const autoGrade = getLatestAutoGrade(task);
          if (autoGrade?.passed) passedCount += 1;
          else if (autoGrade) failedCount += 1;
          else inProgressCount += 1;
        }
      }

      const totalCount = groupTasks.length;
      const passRate = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

      return {
        key,
        name,
        email,
        image,
        tasks: groupTasks,
        totalCount,
        passedCount,
        failedCount,
        inProgressCount,
        invitedCount,
        declinedCount,
        totalRuns,
        passRate,
        latestActivityAt,
      };
    })
    .sort((a, b) => {
      const diff = new Date(b.latestActivityAt).getTime() - new Date(a.latestActivityAt).getTime();
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name, "vi");
    });
}

function assigneeSummaryState(group: CodeAssigneeGroup) {
  if (group.totalCount > 0 && group.passedCount === group.totalCount) {
    return { label: `Hoàn thành · ${group.passedCount}/${group.totalCount} PASS`, tone: "graded" as const };
  }
  if (group.passedCount > 0) {
    return { label: `Đạt ${group.passedCount}/${group.totalCount} bài (${group.passRate}%)`, tone: "active" as const };
  }
  if (group.failedCount > 0) {
    return { label: `Chưa đạt · ${group.failedCount} bài đã Run`, tone: "submitted" as const };
  }
  if (group.inProgressCount > 0) {
    return { label: `Đang code · ${group.inProgressCount} bài`, tone: "active" as const };
  }
  if (group.invitedCount > 0) {
    return { label: `Chờ nhận · ${group.invitedCount} bài`, tone: "waiting" as const };
  }
  return { label: "Đã từ chối", tone: "declined" as const };
}

export default function CodeTasksWorkspace() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [scope, setScope] = useState<TaskScope>("received");
  const [received, setReceived] = useState<CodeTaskItem[]>([]);
  const [sent, setSent] = useState<CodeTaskItem[]>([]);
  const [drafts, setDrafts] = useState<CodeTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);
  const [activeCluster, setActiveCluster] = useState<string>("all");
  const [selectedAssigneeKey, setSelectedAssigneeKey] = useState<string | null>(null);
  const [assigneeQuery, setAssigneeQuery] = useState("");
  const initializedScopeRef = useRef(false);

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
    window.history.replaceState(null, "", query ? `/code-tasks?${query}` : "/code-tasks");
  };

  const switchScope = (nextScope: TaskScope) => {
    setScope(nextScope);
    setActiveCluster("all");
    setSelectedAssigneeKey(null);
    setAssigneeQuery("");
    syncUrl(nextScope, null);
  };

  const openAssignee = (assigneeKey: string) => {
    setSelectedAssigneeKey(assigneeKey);
    setActiveCluster("all");
    syncUrl("sent", assigneeKey);
  };

  const backToAssignees = () => {
    setSelectedAssigneeKey(null);
    setActiveCluster("all");
    syncUrl("sent", null);
  };

  const loadTasks = async () => {
    setLoading(true);
    setError("");
    try {
      const accountResponse = await fetch("/api/account", { cache: "no-store" });
      if (accountResponse.status === 401) {
        router.replace("/login");
        return;
      }
      const accountResult = await readJsonResponse<{ error?: string; user?: Account }>(accountResponse);
      if (accountResult.user) setAccount(accountResult.user);

      const response = await fetch("/api/code-tasks", { cache: "no-store" });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      const result = await readJsonResponse<{
        error?: string;
        received?: CodeTaskItem[];
        sent?: CodeTaskItem[];
        drafts?: CodeTaskItem[];
      }>(response);
      if (!response.ok) throw new Error(result.error || "Không thể tải danh sách bài tập code.");
      const nextReceived = result.received ?? [];
      const nextSent = result.sent ?? [];
      const nextDrafts = result.drafts ?? [];
      setReceived(nextReceived);
      setSent(nextSent);
      setDrafts(nextDrafts);
      if (!initializedScopeRef.current) {
        initializedScopeRef.current = true;
        if (nextReceived.length === 0 && nextDrafts.length > 0) {
          setScope("drafts");
        }
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải bài tập code.");
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
        initializedScopeRef.current = true;
        setScope(paramScope);
        if (paramScope === "sent" && paramAssignee) {
          setSelectedAssigneeKey(paramAssignee);
        }
      }
    }
    void loadTasks();
  }, []);

  const assigneeGroups = buildCodeAssigneeGroups(sent);
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

  const clusterMap = new Map<string, CodeTaskItem[]>();
  for (const task of items) {
    const cluster = getTaskCluster(task);
    const list = clusterMap.get(cluster) ?? [];
    list.push(task);
    clusterMap.set(cluster, list);
  }
  const clusterGroups = Array.from(clusterMap.entries())
    .sort(([a], [b]) => sortClusterNames(a, b))
    .map(([name, groupItems]) => ({
      name,
      items:
        scope === "drafts" || (scope === "sent" && selectedAssignee)
          ? [...groupItems].sort((a, b) => {
              const titleDiff = a.title.localeCompare(b.title, "vi", { numeric: true });
              if (titleDiff !== 0) return titleDiff;
              return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            })
          : groupItems,
    }));

  const currentCluster =
    activeCluster !== "all" && clusterMap.has(activeCluster) ? activeCluster : "all";
  const visibleGroups =
    currentCluster === "all"
      ? clusterGroups
      : clusterGroups.filter((group) => group.name === currentCluster);

  const toggleClusterSelection = (clusterIds: string[]) => {
    const allChecked = clusterIds.length > 0 && clusterIds.every((id) => selectedDraftIds.includes(id));
    setSelectedDraftIds((prev) =>
      allChecked
        ? prev.filter((id) => !clusterIds.includes(id))
        : Array.from(new Set([...prev, ...clusterIds])),
    );
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <BoxesLoader />
        <p>Đang tải bài tập code…</p>
      </div>
    );
  }

  return (
    <main className="tasks-page">
      <header className="dashboard-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link className="dashboard-brand" href="/">
            <Image src="/erd-draw-logo.png" alt="ERD Draw" width={144} height={96} priority unoptimized />
          </Link>
          <TopNavGlass active="code-tasks" showActivity={isActivityAdminEmail(account?.email)} />
        </div>
        <div className="dashboard-user">
          <ThemeToggle />
          <AccountAvatarButton account={account} onUpdated={(image) => setAccount((prev) => (prev ? { ...prev, image } : prev))} />
          <div className="user-details">
            <strong>{account?.name || "Tài khoản"}</strong>
            <span>{account?.email}</span>
          </div>
          <button type="button" onClick={() => void signOut({ callbackUrl: "/login" })}>Đăng xuất</button>
        </div>
      </header>

      <section className="tasks-content">
        <div className="tasks-heading">
          <div>
            <span className="dashboard-eyebrow">THỰC HÀNH & CHẤM ĐIỂM TỰ ĐỘNG</span>
            <h1>Bài tập Code Web</h1>
            <p>Làm bài tập code HTML/CSS/JS trực tiếp trên web và bấm Run Code để chấm điểm tự động theo kết quả mới nhất.</p>
          </div>
        </div>

        {error && (
          <div className="dashboard-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => setError("")}>Đóng</button>
          </div>
        )}
        {notice && (
          <div className="task-assignment-message" role="status">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice("")}>Đóng</button>
          </div>
        )}

        <div className="task-tabs" role="tablist" aria-label="Danh sách bài tập code">
          <button
            className={scope === "received" ? "active" : ""}
            type="button"
            role="tab"
            aria-selected={scope === "received"}
            onClick={() => switchScope("received")}
          >
            📥 Được giao <span className="tab-counter">{received.length}</span>
          </button>
          <button
            className={scope === "drafts" ? "active" : ""}
            type="button"
            role="tab"
            aria-selected={scope === "drafts"}
            onClick={() => switchScope("drafts")}
          >
            📝 Kho đề Code <span className="tab-counter">{drafts.length}</span>
          </button>
          <button
            className={scope === "sent" ? "active" : ""}
            type="button"
            role="tab"
            aria-selected={scope === "sent"}
            onClick={() => switchScope("sent")}
          >
            📤 Đã giao & Kết quả <span className="tab-counter">{sent.length}</span>
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
                  <span className={`code-progress-pill ${selectedAssignee.passedCount > 0 ? "is-pass" : "is-fail"}`}>
                    ✅ {selectedAssignee.passedCount}/{selectedAssignee.totalCount} Pass ({selectedAssignee.passRate}%)
                  </span>
                  {selectedAssignee.failedCount > 0 && (
                    <span className="code-progress-pill is-fail">⚠️ {selectedAssignee.failedCount} chưa đạt</span>
                  )}
                  {selectedAssignee.inProgressCount > 0 && (
                    <span className="assignee-stat-pill">💻 {selectedAssignee.inProgressCount} đang code</span>
                  )}
                  {selectedAssignee.invitedCount > 0 && (
                    <span className="due-pill">⏳ {selectedAssignee.invitedCount} chờ nhận</span>
                  )}
                  {selectedAssignee.declinedCount > 0 && (
                    <span className="assignee-stat-declined">✕ {selectedAssignee.declinedCount} từ chối</span>
                  )}
                  {selectedAssignee.totalRuns > 0 && (
                    <span className="task-sub-count">▶ {selectedAssignee.totalRuns} lượt Run</span>
                  )}
                </div>
                <div className="code-mini-bar-track" aria-hidden="true">
                  <div
                    className={`code-mini-bar-fill ${selectedAssignee.passedCount === selectedAssignee.totalCount && selectedAssignee.totalCount > 0 ? "is-pass" : "is-fail"}`}
                    style={{ width: `${selectedAssignee.passRate}%` }}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {clusterGroups.length > 0 && (
          <div className="cluster-tabs-bar" role="tablist" aria-label="Lọc theo cụm đề">
            <button
              type="button"
              role="tab"
              aria-selected={currentCluster === "all"}
              className={`cluster-3d-btn ${currentCluster === "all" ? "active" : ""}`}
              onClick={() => setActiveCluster("all")}
            >
              <span className="cluster-3d-top">
                <span>📚 Tất cả cụm</span>
                <span className="cluster-3d-count">{items.length}</span>
              </span>
              <span className="cluster-3d-bottom" aria-hidden="true" />
              <span className="cluster-3d-base" aria-hidden="true" />
            </button>
            {clusterGroups.map((group) => (
              <button
                key={group.name}
                type="button"
                role="tab"
                aria-selected={currentCluster === group.name}
                className={`cluster-3d-btn ${currentCluster === group.name ? "active" : ""}`}
                onClick={() => setActiveCluster(group.name)}
              >
                <span className="cluster-3d-top">
                  <span>{group.name}</span>
                  <span className="cluster-3d-count">{group.items.length}</span>
                </span>
                <span className="cluster-3d-bottom" aria-hidden="true" />
                <span className="cluster-3d-base" aria-hidden="true" />
              </button>
            ))}
          </div>
        )}

        {scope === "drafts" && (
          <BatchDraftAssignBar
            drafts={drafts.map((d) => ({ id: d.id, title: d.title }))}
            selectedIds={selectedDraftIds}
            onChangeSelected={setSelectedDraftIds}
            endpoint="/api/code-tasks/batch-assign"
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
                  <p>Nhấn vào từng người để xem chi tiết danh sách bài đã giao và kết quả làm bài.</p>
                </div>
                {assigneeGroups.length > 1 && (
                  <div className="assignee-search-box">
                    <input
                      type="search"
                      value={assigneeQuery}
                      onChange={(e) => setAssigneeQuery(e.target.value)}
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
                            <span className={`code-progress-pill ${group.passedCount > 0 ? "is-pass" : "is-fail"}`}>
                              ✅ {group.passedCount}/{group.totalCount} Pass
                            </span>
                            {group.failedCount > 0 && (
                              <span className="code-progress-pill is-fail">⚠️ {group.failedCount} chưa đạt</span>
                            )}
                            {group.inProgressCount > 0 && (
                              <span className="assignee-stat-pill">💻 {group.inProgressCount} đang code</span>
                            )}
                            {group.invitedCount > 0 && (
                              <span className="due-pill">⏳ {group.invitedCount} chờ nhận</span>
                            )}
                            {group.declinedCount > 0 && (
                              <span className="assignee-stat-declined">✕ {group.declinedCount} từ chối</span>
                            )}
                            {group.totalRuns > 0 && (
                              <span className="task-sub-count">▶ {group.totalRuns} lượt Run</span>
                            )}
                            <span className="task-list-date">
                              🕒 Hoạt động gần nhất: {formatDate(group.latestActivityAt)}
                            </span>
                          </div>
                          <div className="code-mini-bar-track" aria-hidden="true">
                            <div
                              className={`code-mini-bar-fill ${group.passedCount === group.totalCount && group.totalCount > 0 ? "is-pass" : "is-fail"}`}
                              style={{ width: `${group.passRate}%` }}
                            />
                          </div>
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
              <h2>Bạn chưa giao bài tập code nào</h2>
              <p>Các người được giao cùng kết quả làm bài của từng người sẽ hiển thị tại đây.</p>
            </section>
          )
        ) : visibleGroups.length ? (
          <div className="cluster-groups-stack">
            {visibleGroups.map((group) => {
              const clusterIds = group.items.map((t) => t.id);
              const allClusterSelected =
                scope === "drafts" && clusterIds.length > 0 && clusterIds.every((id) => selectedDraftIds.includes(id));

              return (
                <section className="cluster-section" key={group.name}>
                  <div className="cluster-divider-header">
                    <div className="cluster-divider-badge">
                      <span className="cluster-divider-icon">📂</span>
                      <strong className="cluster-divider-title">{group.name}</strong>
                      <span className="cluster-divider-count">{group.items.length} bài</span>
                    </div>
                    <span className="cluster-divider-line" aria-hidden="true" />
                    {scope === "drafts" && (
                      <button
                        type="button"
                        className={`cluster-select-btn ${allClusterSelected ? "is-selected" : ""}`}
                        onClick={() => toggleClusterSelection(clusterIds)}
                      >
                        {allClusterSelected
                          ? `✓ Đã chọn cả cụm (${clusterIds.length})`
                          : `☑ Chọn cả cụm (${clusterIds.length})`}
                      </button>
                    )}
                  </div>

                  <div className="task-list">
                    {group.items.map((task) => {
                      const state = codeTaskState(task, scope);
                      const pedestalTone = codeTaskPedestalTone(task);
                      const autoGrade = getLatestAutoGrade(task);
                      const runCount = task.lastRun?.runCount ?? task.submission?.runCount ?? 0;
                      const personLabel =
                        scope === "received"
                          ? `Người giao: ${task.createdByName} (${task.createdByEmail})`
                          : scope === "drafts"
                            ? `Kho đề Code · ${task.criteria.length} tiêu chí tự động · Ngưỡng Pass ${task.passThreshold}%`
                            : `Người làm: ${task.assignedToName || "Chưa có"} (${task.assignedToEmail || "—"})`;
                      const isSelected = scope === "drafts" && selectedDraftIds.includes(task.id);
                      const taskHref =
                        scope === "sent" && selectedAssignee
                          ? `/code-tasks/${task.id}?assignee=${encodeURIComponent(selectedAssignee.key)}`
                          : `/code-tasks/${task.id}`;

                      const card = (
                        <Link className={`task-list-card task-card-${state.tone} ${isSelected ? "is-selected-card" : ""}`} href={taskHref} key={task.id}>
                          <TaskPedestalIcon tone={pedestalTone} />
                          <div className="task-list-main">
                            <div className="task-list-title">
                              <h2>{task.title}</h2>
                              {task.difficulty && (
                                <span className="cluster-difficulty-pill">{task.difficulty}</span>
                              )}
                              <span className={`task-state task-state-${state.tone}`}>
                                <span className="task-state-dot" />
                                {state.label}
                              </span>
                            </div>
                            <p className="task-person-meta">{personLabel}</p>
                            <div className="task-card-meta-row">
                              <span className="task-list-date">
                                🕒 {task.lastRun?.ranAt ? `Run gần nhất: ${formatDate(task.lastRun.ranAt)}` : `Cập nhật: ${formatDate(task.updatedAt)}`}
                              </span>
                              {task.dueAt && (
                                <span className="due-pill">⏰ Hạn: {formatDate(task.dueAt)}</span>
                              )}
                              {scope === "drafts" && (
                                <>
                                  <span className="task-sub-count">↗ {task.assignedCount ?? 0} lượt giao</span>
                                  {(task.assignedCount ?? 0) > 0 && (
                                    <span className="task-grade-pill">
                                      ✅ {task.passedDeliveryCount ?? 0}/{task.assignedCount ?? 0} Pass
                                    </span>
                                  )}
                                </>
                              )}
                              {scope !== "drafts" && autoGrade && (
                                <>
                                  <span className={`code-progress-pill ${autoGrade.passed ? "is-pass" : "is-fail"}`}>
                                    {autoGrade.passed ? "PASS" : "CHƯA ĐẠT"} · {autoGrade.passedCount}/{autoGrade.totalCount} tiêu chí ({autoGrade.percentage}%)
                                  </span>
                                  {runCount > 0 && <span className="task-sub-count">▶ {runCount} lần Run</span>}
                                </>
                              )}
                              {task.grade && (
                                <span className="task-grade-pill">⭐️ {task.grade.score}/10 điểm</span>
                              )}
                            </div>
                            {scope !== "drafts" && autoGrade && (
                              <div className="code-mini-bar-track" aria-hidden="true">
                                <div
                                  className={`code-mini-bar-fill ${autoGrade.passed ? "is-pass" : "is-fail"}`}
                                  style={{ width: `${autoGrade.percentage}%` }}
                                />
                              </div>
                            )}
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
                </section>
              );
            })}
          </div>
        ) : (
          <section className="tasks-empty">
            <div className="tasks-empty-icon">{scope === "received" ? "💻" : scope === "drafts" ? "📝" : "📤"}</div>
            <h2>
              {scope === "received"
                ? "Chưa có bài tập code nào được giao cho bạn"
                : scope === "drafts"
                  ? "Kho đề Code đang trống"
                  : "Bạn chưa giao bài tập code nào"}
            </h2>
            <p>
              {scope === "received"
                ? "Khi người tạo đề giao bài tập code cho tài khoản của bạn, bài tập sẽ hiển thị tại đây để bạn code trực tiếp và Run chấm tự động."
                : scope === "drafts"
                  ? "Các đề bài code được thêm vào hệ thống sẽ xuất hiện tại đây để bạn chọn và giao cho học viên."
                  : "Các bài đã giao cùng kết quả lần Run gần nhất của từng người làm sẽ hiển thị tại đây."}
            </p>
          </section>
        )}
      </section>
    </main>
  );
}
