import { ObjectId } from "mongodb";
import { findAppDocument, listAppDocuments, patchAppDocument, type AppDocument } from "@/lib/app-data";
import {
  isMailConfigured,
  sendDailyInstructorSummaryEmail,
  sendDeadlineWarningDigestEmail,
} from "@/lib/mailer";
import { getDatabase } from "@/lib/mongodb";

type TaskRecordDoc = AppDocument & {
  taskType?: string;
  title: string;
  createdById: ObjectId;
  createdByName: string;
  createdByEmail: string;
  assignedToId?: ObjectId;
  assignedToName?: string;
  assignedToEmail?: string;
  status: string;
  dueAt?: Date | string | null;
  deadlineReminderForDueAt?: string | null;
  acceptedAt?: Date | string | null;
  lastRun?: {
    runCount: number;
    ranAt: string | Date;
    autoGrade?: {
      percentage: number;
      passed: boolean;
      passedCount: number;
      totalCount: number;
      earnedPoints: number;
      totalPoints: number;
    };
  } | null;
  submission?: {
    version: number;
    submittedAt: string | Date;
    autoGrade?: {
      percentage: number;
      passed: boolean;
      passedCount: number;
      totalCount: number;
      earnedPoints: number;
      totalPoints: number;
    };
  } | null;
  grade?: { score: number; feedback?: string } | null;
};

type UserDigestDoc = AppDocument & {
  name?: string;
  email?: string;
  lastDailyDigestDate?: string | null;
};

export function getVietnamDateParts(date: Date = new Date()) {
  const vnMs = date.getTime() + 7 * 60 * 60 * 1000;
  const d = new Date(vnMs);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hour = d.getUTCHours();
  const minute = d.getUTCMinutes();
  return {
    dateKey: `${year}-${month}-${day}`,
    label: `${day}/${month}/${year}`,
    hour,
    minute,
  };
}

function parseDateValue(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Given a dueAt date, computes 21:30 Vietnam time on the evening BEFORE dueAt's VN calendar date.
 * Example: dueAt = 2026-11-27 (any time) -> reminder starts at 2026-11-26 21:30:00+07:00.
 */
export function getEveningBeforeReminderMs(dueAt: Date): number {
  const { dateKey } = getVietnamDateParts(dueAt);
  const dueMidnightVn = new Date(`${dateKey}T00:00:00+07:00`).getTime();
  return dueMidnightVn - 2.5 * 60 * 60 * 1000;
}

function isTaskCompleted(task: TaskRecordDoc): boolean {
  if (task.taskType === "code") {
    return Boolean(task.lastRun?.autoGrade?.passed || task.submission?.autoGrade?.passed);
  }
  return Boolean(task.submission);
}

async function listAllNonDraftTasks(ownerId?: string): Promise<TaskRecordDoc[]> {
  const col = getDatabase().collection<TaskRecordDoc>("tasks");
  const filters = ownerId ? { ownerId, notStatus: "draft" } : { notStatus: "draft" };
  const rows = await listAppDocuments<TaskRecordDoc>(
    "tasks",
    filters,
    () =>
      col
        .find(
          ownerId
            ? { createdById: new ObjectId(ownerId), status: { $ne: "draft" } }
            : { status: { $ne: "draft" } },
        )
        .sort({ updatedAt: -1 })
        .toArray(),
    5000,
  );
  return rows.filter((t) => t.status !== "draft");
}

export async function runDeadlineWarningSweep(options?: {
  ownerId?: string;
  includeAllUpcoming?: boolean;
}) {
  const now = new Date();
  const nowMs = now.getTime();
  const tasks = await listAllNonDraftTasks(options?.ownerId);

  const byStudent = new Map<
    string,
    {
      toEmail: string;
      toName: string;
      items: Array<{
        task: TaskRecordDoc;
        dueDate: Date;
        dueIso: string;
      }>;
    }
  >();

  for (const task of tasks) {
    if (task.status !== "invited" && task.status !== "accepted") continue;
    if (!task.assignedToEmail) continue;
    if (isTaskCompleted(task)) continue;

    const dueDate = parseDateValue(task.dueAt);
    if (!dueDate) continue;
    const dueMs = dueDate.getTime();
    if (dueMs <= nowMs) continue;

    const reminderStartMs = getEveningBeforeReminderMs(dueDate);
    if (!options?.includeAllUpcoming && nowMs < reminderStartMs) continue;

    const dueIso = dueDate.toISOString();
    if (!options?.includeAllUpcoming && task.deadlineReminderForDueAt === dueIso) continue;

    const key = task.assignedToEmail.toLowerCase();
    const bucket = byStudent.get(key) ?? {
      toEmail: task.assignedToEmail,
      toName: task.assignedToName || task.assignedToEmail,
      items: [],
    };
    bucket.items.push({ task, dueDate, dueIso });
    byStudent.set(key, bucket);
  }

  let emailsSent = 0;
  let tasksNotified = 0;

  for (const group of byStudent.values()) {
    group.items.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    const res = await sendDeadlineWarningDigestEmail({
      toEmail: group.toEmail,
      toName: group.toName,
      tasks: group.items.map((item) => ({
        id: item.task._id.toString(),
        taskKind: item.task.taskType === "code" ? "code" : "erd",
        title: item.task.title,
        dueAt: item.dueDate,
        assignerName: item.task.createdByName,
      })),
    });

    if (res.sent) {
      emailsSent += 1;
      tasksNotified += group.items.length;
      await Promise.all(
        group.items.map((item) =>
          patchAppDocument(
            "tasks",
            item.task._id.toString(),
            { deadlineReminderForDueAt: item.dueIso },
            {},
          ),
        ),
      );
    }
  }

  return {
    studentsMatched: byStudent.size,
    emailsSent,
    tasksNotified,
    mailConfigured: isMailConfigured(),
  };
}

const digestSentInMemory = new Set<string>();

export async function runDailySummarySweep(options?: {
  ownerId?: string;
  force?: boolean;
}) {
  const now = new Date();
  const vnToday = getVietnamDateParts(now);
  const todayKey = vnToday.dateKey;
  const tasks = await listAllNonDraftTasks(options?.ownerId);

  const byCreator = new Map<
    string,
    {
      creatorId: string;
      creatorName: string;
      creatorEmail: string;
      tasks: TaskRecordDoc[];
    }
  >();

  for (const task of tasks) {
    if (!task.createdByEmail) continue;
    const creatorId = task.createdById.toString();
    const entry = byCreator.get(creatorId) ?? {
      creatorId,
      creatorName: task.createdByName,
      creatorEmail: task.createdByEmail,
      tasks: [],
    };
    entry.tasks.push(task);
    byCreator.set(creatorId, entry);
  }

  let emailsSent = 0;
  let creatorsChecked = 0;

  for (const group of byCreator.values()) {
    creatorsChecked += 1;
    const memKey = `${todayKey}:${group.creatorId}`;
    if (!options?.force && digestSentInMemory.has(memKey)) continue;

    if (!options?.force) {
      const userDoc = await findAppDocument<UserDigestDoc>(
        "users",
        group.creatorId,
        () => getDatabase().collection<UserDigestDoc>("users").findOne({ _id: new ObjectId(group.creatorId) }),
      );
      if (userDoc?.lastDailyDigestDate === todayKey) {
        digestSentInMemory.add(memKey);
        continue;
      }
    }

    const studentsMap = new Map<
      string,
      {
        studentName: string;
        studentEmail: string;
        items: Array<{
          taskId: string;
          taskKind: "erd" | "code";
          title: string;
          statusBadge: string;
          statusColor: "green" | "blue" | "amber";
          detailText: string;
        }>;
      }
    >();

    let totalActions = 0;
    let totalPassedOrSubmitted = 0;
    let pendingTotal = 0;

    for (const t of group.tasks) {
      if ((t.status === "invited" || t.status === "accepted") && !isTaskCompleted(t)) {
        pendingTotal += 1;
      }

      const ranAt = parseDateValue(t.lastRun?.ranAt);
      const subAt = parseDateValue(t.submission?.submittedAt);
      const accAt = parseDateValue(t.acceptedAt);

      const ranToday = ranAt ? getVietnamDateParts(ranAt).dateKey === todayKey : false;
      const subToday = subAt ? getVietnamDateParts(subAt).dateKey === todayKey : false;
      const accToday = accAt ? getVietnamDateParts(accAt).dateKey === todayKey : false;

      if (!ranToday && !subToday && !accToday) continue;

      const studentKey = (t.assignedToEmail || t.assignedToId?.toString() || t._id.toString()).toLowerCase();
      const student = studentsMap.get(studentKey) ?? {
        studentName: t.assignedToName || "Học viên",
        studentEmail: t.assignedToEmail || "—",
        items: [],
      };

      const isCode = t.taskType === "code";
      if (isCode) {
        const auto = t.submission?.autoGrade ?? t.lastRun?.autoGrade;
        const passed = Boolean(auto?.passed);
        if (passed) totalPassedOrSubmitted += 1;
        totalActions += 1;
        student.items.push({
          taskId: t._id.toString(),
          taskKind: "code",
          title: t.title,
          statusBadge: auto ? (passed ? `PASS · ${auto.percentage}%` : `CHƯA ĐẠT · ${auto.percentage}%`) : "ĐANG LÀM",
          statusColor: passed ? "green" : auto ? "amber" : "blue",
          detailText: auto
            ? `Chạy ${t.lastRun?.runCount ?? 1} lần · Đạt ${auto.passedCount}/${auto.totalCount} tiêu chí (${auto.earnedPoints}/${auto.totalPoints}đ)`
            : "Đã nhận bài và mở khung code hôm nay",
        });
      } else {
        totalActions += 1;
        if (subToday && t.submission) {
          totalPassedOrSubmitted += 1;
          student.items.push({
            taskId: t._id.toString(),
            taskKind: "erd",
            title: t.title,
            statusBadge: t.grade ? `ĐÃ CHẤM ${t.grade.score}/10` : `ĐÃ NỘP v${t.submission.version}`,
            statusColor: t.grade ? "green" : "blue",
            detailText: `Nộp phiên bản v${t.submission.version} hôm nay`,
          });
        } else {
          student.items.push({
            taskId: t._id.toString(),
            taskKind: "erd",
            title: t.title,
            statusBadge: "ĐANG VẼ ERD",
            statusColor: "blue",
            detailText: "Đã chấp nhận làm bài hôm nay",
          });
        }
      }

      studentsMap.set(studentKey, student);
    }

    const studentsList = Array.from(studentsMap.values());
    if (!options?.force && studentsList.length === 0 && pendingTotal === 0) continue;

    const mailRes = await sendDailyInstructorSummaryEmail({
      toEmail: group.creatorEmail,
      toName: group.creatorName,
      dateLabel: vnToday.label,
      totalActions,
      totalPassedOrSubmitted,
      pendingTotal,
      students: studentsList,
    });

    if (mailRes.sent) {
      emailsSent += 1;
      digestSentInMemory.add(memKey);
      await patchAppDocument("users", group.creatorId, { lastDailyDigestDate: todayKey }, {});
    }
  }

  return {
    dateLabel: vnToday.label,
    creatorsChecked,
    emailsSent,
    mailConfigured: isMailConfigured(),
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __ccvMailSchedulerStarted: boolean | undefined;
  // eslint-disable-next-line no-var
  var __ccvMailSweepRunning: boolean | undefined;
}

export function startMailScheduler() {
  if (globalThis.__ccvMailSchedulerStarted) return;
  globalThis.__ccvMailSchedulerStarted = true;

  const tick = async () => {
    if (globalThis.__ccvMailSweepRunning || !isMailConfigured()) return;
    globalThis.__ccvMailSweepRunning = true;
    try {
      const vn = getVietnamDateParts(new Date());
      if (vn.hour > 21 || (vn.hour === 21 && vn.minute >= 30)) {
        await runDeadlineWarningSweep();
      }
      if (vn.hour >= 22) {
        await runDailySummarySweep();
      }
    } catch (error) {
      console.warn("[mail-scheduler] Lỗi quét gửi mail định kỳ:", error);
    } finally {
      globalThis.__ccvMailSweepRunning = false;
    }
  };

  setTimeout(() => {
    void tick();
  }, 5000);
  const timer = setInterval(() => {
    void tick();
  }, 60_000);
  if (typeof timer.unref === "function") timer.unref();
}
