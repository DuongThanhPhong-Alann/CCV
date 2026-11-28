export const ACTIVITY_ADMIN_EMAIL = "duongthanhphong1618@gmail.com";

export function isActivityAdminEmail(email?: string | null): boolean {
  return typeof email === "string" && email.trim().toLowerCase() === ACTIVITY_ADMIN_EMAIL;
}

export type ActivityKind =
  | "login"
  | "logout"
  | "code_task"
  | "erd_task"
  | "diagram"
  | "closure"
  | "browse";

export type ActivitySegmentEndReason = "active" | "switch" | "leave" | "logout" | "timeout";

export type ActivitySegment = {
  id: string;
  kind: ActivityKind;
  path: string;
  targetId?: string | null;
  title: string;
  startedAt: string;
  endedAt: string;
  durationSec: number;
  note?: string;
  endedReason?: ActivitySegmentEndReason;
};

export type UserActivityStore = {
  lastSeenAt: string | null;
  lastLoginAt: string | null;
  currentSegment: ActivitySegment | null;
  segments: ActivitySegment[];
};

export type ActivityTaskWorkSummary = {
  key: string;
  kind: "code_task" | "erd_task" | "diagram" | "closure";
  targetId: string | null;
  path: string;
  title: string;
  totalDurationSec: number;
  sessionCount: number;
  firstAt: string;
  lastAt: string;
  latestNote?: string;
};

export type AdminUserTaskEvent = {
  id: string;
  taskType: "code" | "erd";
  title: string;
  status: string;
  acceptedAt: string | null;
  lastRunAt: string | null;
  submittedAt: string | null;
  updatedAt: string;
  runCount: number;
  passed: boolean | null;
  percentage: number | null;
  score: number | null;
};

export type AdminUserActivityOverview = {
  id: string;
  name: string;
  email: string;
  image: string;
  createdAt: string;
  isSelf: boolean;
  isOnline: boolean;
  lastLoginAt: string | null;
  lastSeenAt: string | null;
  currentSegment: ActivitySegment | null;
  todayDurationSec: number;
  weekDurationSec: number;
  totalDurationSec: number;
  segmentCount: number;
  segments: ActivitySegment[];
  taskWorkSummaries: ActivityTaskWorkSummary[];
  recentTaskEvents: AdminUserTaskEvent[];
};
