"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AccountAvatarButton from "@/components/account-avatar-button";
import BoxesLoader from "@/components/boxes-loader";
import IosCheckbox from "@/components/ios-checkbox";
import ThemeToggle from "@/components/theme-toggle";
import TopNavGlass from "@/components/top-nav-glass";
import type {
  ActivityKind,
  ActivitySegment,
  AdminUserActivityOverview,
} from "@/lib/activity-types";
import { readJsonResponse } from "@/lib/read-json-response";

type Account = { id: string; name: string | null; email: string | null; image?: string | null };
type AccountFilter = "all" | "online" | "today";
type RangeFilter = "all" | "today" | "week" | "date";
type KindFilter = "all" | "work" | "auth";

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Chưa có";
  return new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatShortTime(value: string) {
  return new Date(value).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number) {
  const sec = Math.max(0, Math.round(seconds));
  if (sec === 0) return "0 giây";
  if (sec < 60) return `${sec} giây`;
  const totalMinutes = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (totalMinutes < 60) {
    return remSec >= 15 ? `${totalMinutes} phút ${remSec} giây` : `${totalMinutes} phút`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins > 0 ? `${hours} giờ ${mins} phút` : `${hours} giờ`;
}

function localDateKey(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDayHeading(dayKey: string) {
  const todayKey = localDateKey(new Date().toISOString());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = localDateKey(yesterday.toISOString());

  const [y, m, d] = dayKey.split("-").map(Number);
  const dateObj = new Date(y, (m || 1) - 1, d || 1);
  const formatted = dateObj.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  if (dayKey === todayKey) return `Hôm nay · ${formatted}`;
  if (dayKey === yesterdayKey) return `Hôm qua · ${formatted}`;
  return formatted;
}

function kindMeta(kind: ActivityKind, endedReason?: string) {
  if (kind === "login") return { icon: "🔑", label: "Đăng nhập", tone: "active" as const };
  if (kind === "logout") {
    return endedReason === "timeout"
      ? { icon: "⏱", label: "Hết phiên 30p", tone: "waiting" as const }
      : { icon: "🚪", label: "Đăng xuất", tone: "declined" as const };
  }
  if (kind === "code_task") return { icon: "💻", label: "Bài tập Code", tone: "submitted" as const };
  if (kind === "erd_task") return { icon: "📝", label: "Bài tập ERD", tone: "graded" as const };
  if (kind === "diagram") return { icon: "🗂", label: "Vẽ sơ đồ ERD", tone: "active" as const };
  if (kind === "closure") return { icon: "🧮", label: "Tìm siêu khóa", tone: "waiting" as const };
  return { icon: "🌐", label: "Xem trang", tone: "draft" as const };
}

function isWorkKind(kind: ActivityKind) {
  return kind === "code_task" || kind === "erd_task" || kind === "diagram" || kind === "closure";
}

function segmentLinkHref(seg: ActivitySegment): string | null {
  if ((seg.kind === "code_task" || seg.kind === "erd_task" || seg.kind === "diagram") && seg.targetId) {
    return seg.path;
  }
  return null;
}

export default function ActivityMonitor() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [accounts, setAccounts] = useState<AdminUserActivityOverview[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState<AccountFilter>("all");
  const [includeSelf, setIncludeSelf] = useState(false);

  const [rangeFilter, setRangeFilter] = useState<RangeFilter>("all");
  const [pickedDate, setPickedDate] = useState(() => localDateKey(new Date().toISOString()));
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");

  const loadActivity = async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const [accountRes, activityRes] = await Promise.all([
        fetch("/api/account", { cache: "no-store" }),
        fetch("/api/admin/activity", { cache: "no-store" }),
      ]);
      if (accountRes.status === 401 || activityRes.status === 401) {
        router.replace("/login");
        return;
      }
      if (activityRes.status === 403) {
        router.replace("/");
        return;
      }
      const accountJson = await readJsonResponse<{ user?: Account }>(accountRes);
      if (accountJson.user) setAccount(accountJson.user);

      const activityJson = await readJsonResponse<{
        error?: string;
        generatedAt?: string;
        accounts?: AdminUserActivityOverview[];
      }>(activityRes);
      if (!activityRes.ok) throw new Error(activityJson.error || "Không thể tải dữ liệu hoạt động.");
      setAccounts(activityJson.accounts ?? []);
      setGeneratedAt(activityJson.generatedAt ?? new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải dữ liệu hoạt động.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadActivity(false);
  }, []);

  const scopedAccounts = includeSelf ? accounts : accounts.filter((a) => !a.isSelf);
  const onlineCount = scopedAccounts.filter((a) => a.isOnline).length;
  const activeTodayCount = scopedAccounts.filter(
    (a) => a.todayDurationSec > 0 || (a.lastSeenAt && localDateKey(a.lastSeenAt) === localDateKey(new Date().toISOString())),
  ).length;
  const totalTodaySec = scopedAccounts.reduce((sum, a) => sum + a.todayDurationSec, 0);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredAccounts = scopedAccounts.filter((a) => {
    if (accountFilter === "online" && !a.isOnline) return false;
    if (accountFilter === "today") {
      const todayKey = localDateKey(new Date().toISOString());
      const seenToday = Boolean(a.lastSeenAt && localDateKey(a.lastSeenAt) === todayKey);
      if (!seenToday && a.todayDurationSec === 0) return false;
    }
    if (!normalizedQuery) return true;
    return (
      a.name.toLowerCase().includes(normalizedQuery) ||
      a.email.toLowerCase().includes(normalizedQuery)
    );
  });

  const selectedUser = selectedUserId
    ? accounts.find((a) => a.id === selectedUserId) ?? null
    : null;

  // Filter segments for selected user
  const filteredSegments = (() => {
    if (!selectedUser) return [];
    const todayKey = localDateKey(new Date().toISOString());
    const weekCutoffMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return selectedUser.segments.filter((seg) => {
      if (kindFilter === "work" && !isWorkKind(seg.kind)) return false;
      if (kindFilter === "auth" && seg.kind !== "login" && seg.kind !== "logout") return false;
      const segDay = localDateKey(seg.startedAt);
      if (rangeFilter === "today" && segDay !== todayKey) return false;
      if (rangeFilter === "week" && new Date(seg.startedAt).getTime() < weekCutoffMs) return false;
      if (rangeFilter === "date" && pickedDate && segDay !== pickedDate) return false;
      return true;
    });
  })();

  // Group filtered segments by local date key
  const dayGroups = (() => {
    const map = new Map<string, ActivitySegment[]>();
    for (const seg of filteredSegments) {
      const key = localDateKey(seg.startedAt);
      const list = map.get(key) ?? [];
      list.push(seg);
      map.set(key, list);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dayKey, segs]) => {
        const dayWorkSec = segs.reduce(
          (sum, s) => (s.kind === "login" || s.kind === "logout" ? sum : sum + s.durationSec),
          0,
        );
        return { dayKey, segments: segs, dayWorkSec };
      });
  })();

  if (loading) {
    return (
      <div className="dashboard-loading">
        <BoxesLoader />
        <p>Đang tải dữ liệu hoạt động tài khoản…</p>
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
          <TopNavGlass active="activity" showActivity />
        </div>
        <div className="dashboard-user">
          <ThemeToggle />
          <AccountAvatarButton
            account={account}
            onUpdated={(image) => {
              setAccount((prev) => (prev ? { ...prev, image } : prev));
              setAccounts((prev) =>
                prev.map((u) => (u.isSelf ? { ...u, image } : u)),
              );
            }}
          />
          <div className="user-details">
            <strong>{account?.name || "Tài khoản"}</strong>
            <span>{account?.email}</span>
          </div>
          <button type="button" onClick={() => void signOut({ callbackUrl: "/login" })}>Đăng xuất</button>
        </div>
      </header>

      <section className="tasks-content activity-content">
        <div className="tasks-heading">
          <div>
            <span className="dashboard-eyebrow">QUẢN TRỊ · THEO DÕI THỜI GIAN HOẠT ĐỘNG</span>
            <h1>Hoạt động tài khoản</h1>
            <p>
              Xem chi tiết thời điểm đăng nhập, khung giờ làm từng bài tập (từ mấy giờ → tới mấy giờ) và trạng thái trực tuyến của các tài khoản.
            </p>
          </div>
          <div className="activity-head-actions">
            {generatedAt && (
              <span className="activity-updated-tag">Cập nhật: {formatTime(generatedAt)}</span>
            )}
            <button
              type="button"
              className="code-secondary-button"
              disabled={refreshing}
              onClick={() => void loadActivity(true)}
            >
              {refreshing ? "Đang tải lại…" : "🔄 Làm mới"}
            </button>
          </div>
        </div>

        {error && (
          <div className="dashboard-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => setError("")}>Đóng</button>
          </div>
        )}

        {!selectedUser ? (
          <>
            <div className="activity-kpi-grid">
              <div className="activity-kpi-card">
                <span>👥 Tài khoản theo dõi</span>
                <strong>{scopedAccounts.length}</strong>
                <small>Tài khoản học viên khác</small>
              </div>
              <div className="activity-kpi-card is-online">
                <span>🟢 Đang trực tuyến</span>
                <strong>{onlineCount}</strong>
                <small>Đang tương tác trong 2 phút qua</small>
              </div>
              <div className="activity-kpi-card">
                <span>📅 Hoạt động hôm nay</span>
                <strong>{activeTodayCount}</strong>
                <small>Tài khoản đã truy cập hôm nay</small>
              </div>
              <div className="activity-kpi-card">
                <span>⏱ Tổng thời gian hôm nay</span>
                <strong>{formatDuration(totalTodaySec)}</strong>
                <small>Tổng thời gian làm bài hôm nay</small>
              </div>
            </div>

            <div className="assignee-directory-bar activity-toolbar">
              <div className="activity-filter-pills" role="tablist" aria-label="Lọc trạng thái tài khoản">
                <button
                  type="button"
                  className={`cluster-tab-pill ${accountFilter === "all" ? "active" : ""}`}
                  onClick={() => setAccountFilter("all")}
                >
                  Tất cả <span className="cluster-tab-count">{scopedAccounts.length}</span>
                </button>
                <button
                  type="button"
                  className={`cluster-tab-pill ${accountFilter === "online" ? "active" : ""}`}
                  onClick={() => setAccountFilter("online")}
                >
                  🟢 Đang online <span className="cluster-tab-count">{onlineCount}</span>
                </button>
                <button
                  type="button"
                  className={`cluster-tab-pill ${accountFilter === "today" ? "active" : ""}`}
                  onClick={() => setAccountFilter("today")}
                >
                  📅 Hôm nay <span className="cluster-tab-count">{activeTodayCount}</span>
                </button>
              </div>

              <div className="activity-toolbar-right">
                <label className="activity-self-toggle">
                  <IosCheckbox
                    size="sm"
                    checked={includeSelf}
                    ariaLabel="Hiện cả tài khoản của tôi"
                    onChange={setIncludeSelf}
                  />
                  <span>Hiện cả tài khoản của tôi</span>
                </label>
                <div className="assignee-search-box">
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm theo tên hoặc email…"
                    aria-label="Tìm tài khoản"
                  />
                </div>
              </div>
            </div>

            {filteredAccounts.length > 0 ? (
              <div className="task-list">
                {filteredAccounts.map((u) => {
                  const tone = u.isOnline
                    ? "graded"
                    : u.todayDurationSec > 0
                      ? "active"
                      : u.lastSeenAt
                        ? "waiting"
                        : "draft";
                  return (
                    <button
                      type="button"
                      key={u.id}
                      className={`task-list-card assignee-card task-card-${tone}`}
                      onClick={() => {
                        setSelectedUserId(u.id);
                        setRangeFilter("all");
                        setKindFilter("all");
                      }}
                    >
                      <div className={`assignee-avatar assignee-avatar-${tone} activity-avatar-wrap has-photo`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u.image} alt={u.name} className="avatar-img" loading="lazy" />
                        {u.isOnline && <span className="online-pulse-dot" title="Đang hoạt động" />}
                      </div>
                      <div className="task-list-main">
                        <div className="task-list-title">
                          <h2>{u.name}</h2>
                          {u.isSelf && <span className="cluster-difficulty-pill">Bạn</span>}
                          <span className={`task-state task-state-${u.isOnline ? "graded" : "draft"}`}>
                            <span className="task-state-dot" />
                            {u.isOnline ? "Đang hoạt động" : "Ngoại tuyến"}
                          </span>
                        </div>
                        <p className="task-person-meta">{u.email}</p>

                        {u.isOnline && u.currentSegment && (
                          <div className="activity-live-banner">
                            <span className="online-inline-dot" />
                            <span>
                              Đang mở: <strong>{u.currentSegment.title}</strong> (từ {formatShortTime(u.currentSegment.startedAt)})
                            </span>
                          </div>
                        )}

                        <div className="task-card-meta-row">
                          <span className="assignee-count-pill">
                            ⏱ Hôm nay: {formatDuration(u.todayDurationSec)}
                          </span>
                          <span className="assignee-stat-pill">
                            📊 Tổng: {formatDuration(u.totalDurationSec)}
                          </span>
                          <span className="task-sub-count">
                            📝 {u.taskWorkSummaries.length} bài/sơ đồ đã theo dõi
                          </span>
                          {u.lastLoginAt && (
                            <span className="task-list-date">
                              🔑 Đăng nhập gần nhất: {formatDateTime(u.lastLoginAt)}
                            </span>
                          )}
                          <span className="task-list-date">
                            🕒 Hoạt động cuối: {formatDateTime(u.lastSeenAt)}
                          </span>
                        </div>
                      </div>
                      <span className="task-list-arrow">›</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <section className="tasks-empty">
                <div className="tasks-empty-icon">👥</div>
                <h2>Không có tài khoản nào khớp bộ lọc</h2>
                <p>Thử đổi bộ lọc trạng thái hoặc xóa từ khóa tìm kiếm để xem danh sách tài khoản.</p>
                <button
                  type="button"
                  className="code-secondary-button"
                  onClick={() => {
                    setSearchQuery("");
                    setAccountFilter("all");
                  }}
                >
                  Đặt lại bộ lọc
                </button>
              </section>
            )}
          </>
        ) : (
          <div className="activity-detail-stack">
            <section className="selected-assignee-header">
              <div className="selected-assignee-top">
                <button
                  type="button"
                  className="task-back-link assignee-back-btn"
                  onClick={() => setSelectedUserId(null)}
                >
                  ← Quay lại danh sách tài khoản
                </button>
                <span className="selected-assignee-count">
                  {selectedUser.segmentCount} phiên hoạt động đã ghi nhận
                </span>
              </div>

              <div className="selected-assignee-profile">
                <div
                  className={`assignee-avatar assignee-avatar-${selectedUser.isOnline ? "graded" : "active"} activity-avatar-wrap has-photo`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedUser.image} alt={selectedUser.name} className="avatar-img" />
                  {selectedUser.isOnline && <span className="online-pulse-dot" />}
                </div>
                <div className="selected-assignee-info">
                  <div className="selected-assignee-name-row">
                    <h2>{selectedUser.name}</h2>
                    <span className={`task-state task-state-${selectedUser.isOnline ? "graded" : "draft"}`}>
                      <span className="task-state-dot" />
                      {selectedUser.isOnline ? "Đang hoạt động" : "Ngoại tuyến"}
                    </span>
                  </div>
                  <p className="task-person-meta">{selectedUser.email}</p>

                  {selectedUser.isOnline && selectedUser.currentSegment && (
                    <div className="activity-live-banner">
                      <span className="online-inline-dot" />
                      <span>
                        Đang làm ngay lúc này: <strong>{selectedUser.currentSegment.title}</strong> · bắt đầu lúc{" "}
                        {formatTime(selectedUser.currentSegment.startedAt)}
                      </span>
                    </div>
                  )}

                  <div className="task-card-meta-row">
                    <span className="assignee-count-pill">
                      ⏱ Hôm nay: {formatDuration(selectedUser.todayDurationSec)}
                    </span>
                    <span className="task-grade-pill">
                      📅 7 ngày qua: {formatDuration(selectedUser.weekDurationSec)}
                    </span>
                    <span className="assignee-stat-pill">
                      📊 Tổng cộng: {formatDuration(selectedUser.totalDurationSec)}
                    </span>
                    <span className="task-list-date">
                      🔑 Đăng nhập gần nhất: {formatDateTime(selectedUser.lastLoginAt)}
                    </span>
                    <span className="task-list-date">
                      🕒 Hoạt động cuối: {formatDateTime(selectedUser.lastSeenAt)}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Tổng hợp theo từng bài tập / sơ đồ */}
            {selectedUser.taskWorkSummaries.length > 0 && (
              <section className="activity-panel">
                <header className="activity-panel-head">
                  <div>
                    <span className="dashboard-eyebrow">TỔNG HỢP THEO BÀI TẬP &amp; SƠ ĐỒ</span>
                    <h2>Thời gian dành cho từng bài ({selectedUser.taskWorkSummaries.length})</h2>
                  </div>
                </header>
                <div className="activity-work-grid">
                  {selectedUser.taskWorkSummaries.map((w) => {
                    const meta = kindMeta(w.kind);
                    const canOpen = Boolean(w.targetId && w.kind !== "closure");
                    const inner = (
                      <>
                        <div className="activity-work-top">
                          <span className={`task-state task-state-${meta.tone}`}>
                            {meta.icon} {meta.label}
                          </span>
                          <span className="activity-duration-badge">{formatDuration(w.totalDurationSec)}</span>
                        </div>
                        <h3>{w.title}</h3>
                        <div className="activity-work-meta">
                          <span>🔁 {w.sessionCount} lượt làm</span>
                          <span>🕒 Gần nhất: {formatDateTime(w.lastAt)}</span>
                        </div>
                        {w.latestNote && <div className="activity-note-chip">{w.latestNote}</div>}
                      </>
                    );
                    return canOpen ? (
                      <Link key={w.key} href={w.path} className="activity-work-card is-clickable">
                        {inner}
                      </Link>
                    ) : (
                      <div key={w.key} className="activity-work-card">
                        {inner}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Dòng thời gian chi tiết từ mấy giờ -> tới mấy giờ */}
            <section className="activity-panel">
              <header className="activity-panel-head">
                <div>
                  <span className="dashboard-eyebrow">DÒNG THỜI GIAN CHI TIẾT</span>
                  <h2>Nhật ký hoạt động ({filteredSegments.length})</h2>
                </div>
                <div className="activity-detail-filters">
                  <div className="activity-filter-pills">
                    <button
                      type="button"
                      className={`cluster-tab-pill ${rangeFilter === "all" ? "active" : ""}`}
                      onClick={() => setRangeFilter("all")}
                    >
                      Tất cả
                    </button>
                    <button
                      type="button"
                      className={`cluster-tab-pill ${rangeFilter === "today" ? "active" : ""}`}
                      onClick={() => setRangeFilter("today")}
                    >
                      Hôm nay
                    </button>
                    <button
                      type="button"
                      className={`cluster-tab-pill ${rangeFilter === "week" ? "active" : ""}`}
                      onClick={() => setRangeFilter("week")}
                    >
                      7 ngày
                    </button>
                    <input
                      type="date"
                      className="activity-date-input"
                      value={pickedDate}
                      aria-label="Lọc theo ngày cụ thể"
                      onChange={(e) => {
                        setPickedDate(e.target.value);
                        setRangeFilter(e.target.value ? "date" : "all");
                      }}
                    />
                  </div>
                  <div className="activity-filter-pills">
                    <button
                      type="button"
                      className={`picker-chip-btn ${kindFilter === "all" ? "is-active-chip" : ""}`}
                      onClick={() => setKindFilter("all")}
                    >
                      Tất cả loại
                    </button>
                    <button
                      type="button"
                      className={`picker-chip-btn ${kindFilter === "work" ? "is-active-chip" : ""}`}
                      onClick={() => setKindFilter("work")}
                    >
                      💻 Chỉ bài tập &amp; sơ đồ
                    </button>
                    <button
                      type="button"
                      className={`picker-chip-btn ${kindFilter === "auth" ? "is-active-chip" : ""}`}
                      onClick={() => setKindFilter("auth")}
                    >
                      🔑 Đăng nhập / Đăng xuất
                    </button>
                  </div>
                </div>
              </header>

              {dayGroups.length > 0 ? (
                <div className="activity-days-stack">
                  {dayGroups.map((day) => (
                    <div className="activity-day-group" key={day.dayKey}>
                      <div className="cluster-divider-header">
                        <div className="cluster-divider-badge">
                          <span className="cluster-divider-icon">📅</span>
                          <strong className="cluster-divider-title">{formatDayHeading(day.dayKey)}</strong>
                          <span className="cluster-divider-count">
                            {day.segments.length} mục · {formatDuration(day.dayWorkSec)}
                          </span>
                        </div>
                        <span className="cluster-divider-line" aria-hidden="true" />
                      </div>

                      <div className="activity-timeline">
                        {day.segments.map((seg) => {
                          const meta = kindMeta(seg.kind, seg.endedReason);
                          const isPointEvent = seg.kind === "login" || seg.kind === "logout";
                          const href = segmentLinkHref(seg);
                          const isLiveNow =
                            selectedUser.isOnline && selectedUser.currentSegment?.id === seg.id;

                          return (
                            <div className={`activity-timeline-item tone-${meta.tone}`} key={seg.id}>
                              <div className="activity-time-col">
                                {isPointEvent ? (
                                  <span className="activity-time-range">{formatTime(seg.startedAt)}</span>
                                ) : (
                                  <>
                                    <span className="activity-time-range">
                                      {formatShortTime(seg.startedAt)} → {isLiveNow ? "Hiện tại" : formatShortTime(seg.endedAt)}
                                    </span>
                                    <span className="activity-duration-badge">
                                      {isLiveNow ? `Đang làm · ${formatDuration(seg.durationSec)}` : formatDuration(seg.durationSec)}
                                    </span>
                                  </>
                                )}
                              </div>

                              <div className="activity-node-col" aria-hidden="true">
                                <span className={`activity-node-dot tone-${meta.tone}`} />
                              </div>

                              <div className="activity-body-col">
                                <div className="activity-body-top">
                                  <span className={`task-state task-state-${meta.tone}`}>
                                    {meta.icon} {meta.label}
                                  </span>
                                  {href ? (
                                    <Link href={href} className="activity-item-link">
                                      {seg.title} ↗
                                    </Link>
                                  ) : (
                                    <strong className="activity-item-title">{seg.title}</strong>
                                  )}
                                </div>
                                {seg.note && <div className="activity-note-chip">{seg.note}</div>}
                                {!isPointEvent && (
                                  <small className="activity-exact-time">
                                    Từ {formatTime(seg.startedAt)} đến {isLiveNow ? "đang hoạt động" : formatTime(seg.endedAt)}
                                  </small>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="activity-empty-inline">
                  Chưa có phiên hoạt động nào được ghi nhận trong khoảng thời gian đã chọn. Khi tài khoản này đăng nhập và mở bài tập, toàn bộ khung giờ sẽ tự động xuất hiện tại đây.
                </div>
              )}
            </section>

            {/* Lịch sử mốc bài tập từ bảng tasks */}
            {selectedUser.recentTaskEvents.length > 0 && (
              <section className="activity-panel">
                <header className="activity-panel-head">
                  <div>
                    <span className="dashboard-eyebrow">MỐC THỜI GIAN BÀI TẬP ĐƯỢC GIAO</span>
                    <h2>Lịch sử nhận bài, chạy code &amp; nộp bài ({selectedUser.recentTaskEvents.length})</h2>
                  </div>
                </header>
                <div className="task-delivery-list">
                  {selectedUser.recentTaskEvents.map((ev) => (
                    <Link
                      key={ev.id}
                      href={ev.taskType === "code" ? `/code-tasks/${ev.id}` : `/tasks/${ev.id}`}
                      className="task-delivery-row code-delivery-row"
                    >
                      <span>
                        <strong>
                          {ev.taskType === "code" ? "💻" : "📝"} {ev.title}
                        </strong>
                        <small>
                          {ev.acceptedAt ? `Nhận bài: ${formatDateTime(ev.acceptedAt)}` : "Chưa nhận bài"}
                          {ev.lastRunAt ? ` · Run gần nhất: ${formatDateTime(ev.lastRunAt)}` : ""}
                          {ev.submittedAt ? ` · Nộp bài: ${formatDateTime(ev.submittedAt)}` : ""}
                        </small>
                      </span>
                      <div className="code-delivery-metrics">
                        {ev.passed !== null && ev.percentage !== null && (
                          <span className={`code-progress-pill ${ev.passed ? "is-pass" : "is-fail"}`}>
                            {ev.passed ? "PASS" : "CHƯA ĐẠT"} · {ev.percentage}%
                          </span>
                        )}
                        {ev.runCount > 0 && <span className="task-sub-count">▶ {ev.runCount} lần Run</span>}
                        {ev.score !== null && <span className="task-grade-pill">⭐️ {ev.score}/10</span>}
                      </div>
                      <time>{formatDateTime(ev.updatedAt)}</time>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
