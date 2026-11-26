"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import BatchDraftAssignBar from "@/components/batch-draft-assign-bar";
import MailActionsBar from "@/components/mail-actions-bar";
import type { CodeTask } from "@/lib/code-task-types";
import { readJsonResponse } from "@/lib/read-json-response";

type TaskScope = "received" | "drafts" | "sent";
type Account = { id: string; name: string | null; email: string | null };
type CodeTaskItem = CodeTask & { passedDeliveryCount?: number };

function formatDate(value: string) {
  return new Date(value).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });
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
  const initializedScopeRef = useRef(false);

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
    void loadTasks();
  }, []);

  const items = scope === "received" ? received : scope === "drafts" ? drafts : sent;

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
        scope === "drafts"
          ? [...groupItems].sort((a, b) => a.title.localeCompare(b.title, "vi", { numeric: true }))
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
        <span className="loading-spinner" />
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
          <nav className="dashboard-topnav">
            <Link className="topnav-tab" href="/">📁 Sơ đồ của tôi</Link>
            <Link className="topnav-tab" href="/tasks">📝 Bài tập</Link>
            <Link className="topnav-tab active" href="/code-tasks">💻 Code bài tập</Link>
            <Link className="topnav-tab" href="/closure">🔑 Tìm siêu khóa</Link>
          </nav>
        </div>
        <div className="dashboard-user">
          <div className="user-avatar">{(account?.name || account?.email || "U").slice(0, 1).toUpperCase()}</div>
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
            onClick={() => {
              setScope("received");
              setActiveCluster("all");
            }}
          >
            📥 Được giao <span className="tab-counter">{received.length}</span>
          </button>
          <button
            className={scope === "drafts" ? "active" : ""}
            type="button"
            role="tab"
            aria-selected={scope === "drafts"}
            onClick={() => {
              setScope("drafts");
              setActiveCluster("all");
            }}
          >
            📝 Kho đề Code <span className="tab-counter">{drafts.length}</span>
          </button>
          <button
            className={scope === "sent" ? "active" : ""}
            type="button"
            role="tab"
            aria-selected={scope === "sent"}
            onClick={() => {
              setScope("sent");
              setActiveCluster("all");
            }}
          >
            📤 Đã giao & Kết quả <span className="tab-counter">{sent.length}</span>
          </button>
        </div>

        {clusterGroups.length > 0 && (
          <div className="cluster-tabs-bar" role="tablist" aria-label="Lọc theo cụm đề">
            <button
              type="button"
              role="tab"
              aria-selected={currentCluster === "all"}
              className={`cluster-tab-pill ${currentCluster === "all" ? "active" : ""}`}
              onClick={() => setActiveCluster("all")}
            >
              📚 Tất cả cụm <span className="cluster-tab-count">{items.length}</span>
            </button>
            {clusterGroups.map((group) => (
              <button
                key={group.name}
                type="button"
                role="tab"
                aria-selected={currentCluster === group.name}
                className={`cluster-tab-pill ${currentCluster === group.name ? "active" : ""}`}
                onClick={() => setActiveCluster(group.name)}
              >
                <span>{group.name}</span>
                <span className="cluster-tab-count">{group.items.length}</span>
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

        {scope === "sent" && sent.length > 0 && (
          <MailActionsBar onSuccess={setNotice} onError={setError} />
        )}

        {visibleGroups.length ? (
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
                      const autoGrade = getLatestAutoGrade(task);
                      const runCount = task.lastRun?.runCount ?? task.submission?.runCount ?? 0;
                      const personLabel =
                        scope === "received"
                          ? `Người giao: ${task.createdByName} (${task.createdByEmail})`
                          : scope === "drafts"
                            ? `Kho đề Code · ${task.criteria.length} tiêu chí tự động · Ngưỡng Pass ${task.passThreshold}%`
                            : `Người làm: ${task.assignedToName || "Chưa có"} (${task.assignedToEmail || "—"})`;
                      const icon = scope === "received" ? "💻" : scope === "drafts" ? "📝" : "📊";
                      const isSelected = scope === "drafts" && selectedDraftIds.includes(task.id);

                      const card = (
                        <Link className={`task-list-card task-card-${state.tone} ${isSelected ? "is-selected-card" : ""}`} href={`/code-tasks/${task.id}`} key={task.id}>
                          <div className={`task-list-icon task-icon-${state.tone}`}>{icon}</div>
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
