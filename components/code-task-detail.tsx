"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import AccountAvatarButton from "@/components/account-avatar-button";
import BoxesLoader from "@/components/boxes-loader";
import CodeEditorPane from "@/components/code-editor-pane";
import ThemeToggle from "@/components/theme-toggle";
import TopNavGlass from "@/components/top-nav-glass";
import { DueDateAssignField, DueDateEditorCard, localDateTimeInputToIso } from "@/components/due-date-control";
import CodePreviewFrame, {
  analyzeCodeInSandbox,
  evaluateCodeInSandbox,
} from "@/components/code-preview-frame";
import MultiRecipientPicker, { type RecipientAccount } from "@/components/multi-recipient-picker";
import RunCodeOverlay from "@/components/run-code-overlay";
import { isActivityAdminEmail } from "@/lib/activity-types";
import { CRITERION_TYPE_LABELS, createCriterionId, EMPTY_CODE_BUNDLE } from "@/lib/code-grader";
import { playSound } from "@/lib/sound-fx";
import type {
  CodeAutoGradeResult,
  CodeBundle,
  CodeCriterion,
  CodeCriterionType,
  CodeTask,
} from "@/lib/code-task-types";
import { readJsonResponse } from "@/lib/read-json-response";

type ViewerRole = "creator" | "assignee";
type Account = { id: string; name: string | null; email: string | null; image?: string | null };

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

function taskStatusLabel(task: {
  status: CodeTask["status"];
  lastRun?: { autoGrade?: { percentage: number; passed: boolean } | null } | null;
  submission?: { autoGrade?: { percentage: number; passed: boolean } | null } | null;
}) {
  if (task.status === "draft") return { label: "Trong kho", tone: "draft" };
  if (task.status === "declined") return { label: "Đã từ chối", tone: "declined" };
  if (task.status === "invited") return { label: "Đang chờ nhận", tone: "waiting" };
  const autoGrade = task.submission?.autoGrade ?? task.lastRun?.autoGrade ?? null;
  if (autoGrade) {
    return autoGrade.passed
      ? { label: `PASS · ${autoGrade.percentage}%`, tone: "graded" }
      : { label: `Chưa đạt · ${autoGrade.percentage}%`, tone: "submitted" };
  }
  return { label: "Đang làm bài", tone: "active" };
}

function CriterionListTable({
  result,
  criteria,
}: {
  result: CodeAutoGradeResult | null;
  criteria: CodeCriterion[];
}) {
  if (!criteria.length) {
    return <div className="task-notice">Đề bài này chưa có tiêu chí chấm tự động nào.</div>;
  }

  const resultMap = new Map((result?.results ?? []).map((item) => [item.criterionId, item]));

  return (
    <div className="code-criteria-results">
      {criteria.map((criterion, index) => {
        const res = resultMap.get(criterion.id);
        const stateClass = !res ? "is-pending" : res.passed ? "is-pass" : "is-fail";
        const checkState = !res ? "is-pending" : res.passed ? "is-passed" : "is-failed";
        return (
          <div className={`code-criterion-result-row ${stateClass}`} key={criterion.id || index}>
            <div
              className={`criterion-check-3d ${checkState}`}
              aria-label={!res ? "Chưa kiểm tra" : res.passed ? "Đạt tiêu chí" : "Chưa đạt tiêu chí"}
            >
              <div className="criterion-check-box" />
            </div>
            <div className="criterion-result-main">
              <div className="criterion-result-top">
                <strong>{criterion.label}</strong>
                <span className="criterion-type-chip">{CRITERION_TYPE_LABELS[criterion.type]}</span>
              </div>
              <div className="criterion-result-details">
                <span>
                  Yêu cầu: <code>{res?.expected || criterion.expected || criterion.selector}</code>
                </span>
                {res && (
                  <span className={res.passed ? "detail-pass" : "detail-fail"}>
                    Thực tế: {res.actual}
                  </span>
                )}
              </div>
            </div>
            <span className="criterion-weight-tag">
              {res?.passed ? `+${criterion.weight}` : `${criterion.weight}`}đ
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function CodeTaskDetail({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [task, setTask] = useState<CodeTask | null>(null);
  const [viewerRole, setViewerRole] = useState<ViewerRole>("assignee");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [returnAssignee, setReturnAssignee] = useState("");

  // Creator draft editing state
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftThreshold, setDraftThreshold] = useState(100);
  const [draftStarter, setDraftStarter] = useState<CodeBundle>({ ...EMPTY_CODE_BUNDLE });
  const [draftSolution, setDraftSolution] = useState<CodeBundle>({ ...EMPTY_CODE_BUNDLE });
  const [draftCriteria, setDraftCriteria] = useState<CodeCriterion[]>([]);
  const [draftEditorTab, setDraftEditorTab] = useState<"solution" | "starter">("solution");
  const [draftRunSignal, setDraftRunSignal] = useState(1);
  const [draftExecutedCode, setDraftExecutedCode] = useState<CodeBundle>({ ...EMPTY_CODE_BUNDLE });
  const [draftGradeResult, setDraftGradeResult] = useState<CodeAutoGradeResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [assignDueAtLocal, setAssignDueAtLocal] = useState("");

  // Assignee IDE state
  const [studentCode, setStudentCode] = useState<CodeBundle>({ ...EMPTY_CODE_BUNDLE });
  const [executedCode, setExecutedCode] = useState<CodeBundle>({ ...EMPTY_CODE_BUNDLE });
  const [runSignal, setRunSignal] = useState(1);
  const [autoGradeResult, setAutoGradeResult] = useState<CodeAutoGradeResult | null>(null);
  const [previewLogs, setPreviewLogs] = useState<{ consoleLogs: string[]; errors: string[] }>({
    consoleLogs: [],
    errors: [],
  });
  const [running, setRunning] = useState(false);
  const [savingCode, setSavingCode] = useState(false);
  const [lastSavedLabel, setLastSavedLabel] = useState("");
  const dirtyRef = useRef(false);
  const autoSaveTimerRef = useRef<number | null>(null);

  // Creator viewing assignee submission
  const [creatorCompareTab, setCreatorCompareTab] = useState<"student" | "solution" | "both">("both");
  const [creatorPreviewSignal, setCreatorPreviewSignal] = useState(1);
  const [manualScore, setManualScore] = useState("");
  const [manualFeedback, setManualFeedback] = useState("");

  const loadTask = async () => {
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

      const response = await fetch(`/api/code-tasks/${taskId}`, { cache: "no-store" });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      const result = await readJsonResponse<{ error?: string; task?: CodeTask; viewerRole?: ViewerRole }>(response);
      if (!response.ok || !result.task || !result.viewerRole) {
        throw new Error(result.error || "Không thể tải bài tập code.");
      }
      const loaded = result.task;
      setTask(loaded);
      setViewerRole(result.viewerRole);

      if (result.viewerRole === "creator") {
        setDraftTitle(loaded.title);
        setDraftDescription(loaded.description);
        setDraftThreshold(loaded.passThreshold ?? 100);
        setDraftStarter(loaded.starterCode ?? { ...EMPTY_CODE_BUNDLE });
        const sol = loaded.solutionCode ?? { ...EMPTY_CODE_BUNDLE };
        setDraftSolution(sol);
        setDraftExecutedCode(sol);
        setDraftCriteria(loaded.criteria ?? []);
        setDraftRunSignal((v) => v + 1);
        setCreatorPreviewSignal((v) => v + 1);
        setManualScore(loaded.grade?.score?.toString() ?? "");
        setManualFeedback(loaded.grade?.feedback ?? "");
        if (loaded.status === "draft" && (loaded.criteria?.length ?? 0) > 0) {
          void evaluateCodeInSandbox(sol, loaded.criteria ?? [], loaded.passThreshold ?? 100).then(setDraftGradeResult);
        }
      } else {
        const storageKey = `code_task_draft_${loaded.id}`;
        let initialCode =
          loaded.savedCode ??
          loaded.lastRun?.code ??
          loaded.submission?.code ??
          loaded.starterCode ??
          { ...EMPTY_CODE_BUNDLE };
        try {
          const savedLocal = window.localStorage.getItem(storageKey);
          if (savedLocal) {
            const parsed = JSON.parse(savedLocal) as CodeBundle;
            if (parsed && (Array.isArray(parsed.files) || typeof parsed.html === "string")) {
              initialCode = parsed;
            }
          }
        } catch {
          // ignore localStorage errors
        }
        setStudentCode(initialCode);
        setExecutedCode(initialCode);
        setAutoGradeResult(loaded.lastRun?.autoGrade ?? loaded.submission?.autoGrade ?? null);
        setRunSignal((v) => v + 1);
        dirtyRef.current = false;
        if (loaded.savedCode || loaded.lastRun) {
          setLastSavedLabel("Đã đồng bộ trên hệ thống");
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
      setReturnAssignee(params.get("assignee") ?? "");
    }
    void loadTask();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  useEffect(() => {
    if (viewerRole !== "assignee" || !task || task.status !== "accepted") return;
    try {
      window.localStorage.setItem(`code_task_draft_${task.id}`, JSON.stringify(studentCode));
    } catch {
      // ignore quota error
    }
    if (!dirtyRef.current || running || busy || savingCode) return;
    if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null;
      void saveStudentCode(true);
    }, 2500);
    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentCode, task?.id, task?.status, viewerRole]);

  // Creator Draft Actions
  const extractCriteriaFromSolution = async () => {
    setAnalyzing(true);
    setError("");
    setNotice("");
    try {
      const analysis = await analyzeCodeInSandbox(draftSolution);
      if (!analysis.criteria.length) {
        setError("Không trích xuất được tiêu chí nào từ code đáp án. Hãy kiểm tra lại code hoặc thêm tiêu chí thủ công.");
        return;
      }
      setDraftCriteria(analysis.criteria);
      setDraftExecutedCode(draftSolution);
      setDraftRunSignal((v) => v + 1);
      const res = await evaluateCodeInSandbox(draftSolution, analysis.criteria, draftThreshold);
      setDraftGradeResult(res);
      setNotice(`Đã tự động trích xuất ${analysis.criteria.length} tiêu chí từ kết quả trang web đáp án.`);
    } finally {
      setAnalyzing(false);
    }
  };

  const testSolutionCode = async () => {
    setDraftExecutedCode(draftSolution);
    setDraftRunSignal((v) => v + 1);
    const res = await evaluateCodeInSandbox(draftSolution, draftCriteria, draftThreshold);
    setDraftGradeResult(res);
    playSound(res.passed ? "pass" : "wrong");
  };

  const addEmptyCriterion = () => {
    setDraftCriteria((prev) => [
      ...prev,
      {
        id: createCriterionId(),
        type: "text_contains",
        label: "Kiểm tra nội dung mới",
        selector: "*",
        expected: "",
        weight: 10,
      },
    ]);
  };

  const updateCriterion = (index: number, patch: Partial<CodeCriterion>) => {
    setDraftCriteria((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeCriterion = (index: number) => {
    setDraftCriteria((prev) => prev.filter((_, i) => i !== index));
  };

  const saveDraftChanges = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/code-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateDraft",
          title: draftTitle,
          description: draftDescription,
          passThreshold: draftThreshold,
          starterCode: draftStarter,
          solutionCode: draftSolution,
          criteria: draftCriteria,
        }),
      });
      const result = await readJsonResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(result.error || "Không thể lưu đề bài.");
      setNotice("Đã lưu cập nhật đề bài, đáp án và bộ tiêu chí chấm tự động.");
      await loadTask();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu đề bài.");
    } finally {
      setBusy(false);
    }
  };

  const deleteDraft = async () => {
    if (!window.confirm("Xóa đề bài code này khỏi kho? Thao tác này không thể hoàn tác.")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/code-tasks/${taskId}`, { method: "DELETE" });
      const result = await readJsonResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(result.error || "Không thể xóa đề bài.");
      router.push("/code-tasks");
    } catch (delError) {
      setError(delError instanceof Error ? delError.message : "Không thể xóa đề bài.");
      setBusy(false);
    }
  };

  const assignTask = async (selectedRecipients: RecipientAccount[]) => {
    if (!selectedRecipients.length) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/code-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign",
          assignedToIds: selectedRecipients.map((item) => item.id),
          dueAt: localDateTimeInputToIso(assignDueAtLocal),
        }),
      });
      const result = await readJsonResponse<{ error?: string; assignedCount?: number; emailSentCount?: number; mailConfigured?: boolean }>(response);
      if (!response.ok) throw new Error(result.error || "Không thể giao bài tập.");
      const names = selectedRecipients.map((item) => item.name).join(", ");
      const mailNote =
        result.mailConfigured === false
          ? ""
          : typeof result.emailSentCount === "number"
            ? ` Đã gửi mail cho ${result.emailSentCount}/${result.assignedCount ?? selectedRecipients.length} học viên.`
            : "";
      setNotice(`Đã giao bài tập code cho ${result.assignedCount ?? selectedRecipients.length} người (${names}). Kết quả làm bài sẽ tự động cập nhật ở bảng bên dưới.${mailNote}`);
      await loadTask();
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : "Không thể giao bài tập.");
    } finally {
      setBusy(false);
    }
  };

  const updateDueDate = async (isoDueAt: string | null) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/code-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateDueDate", dueAt: isoDueAt }),
      });
      const result = await readJsonResponse<{ error?: string; updatedCount?: number; emailSentCount?: number; emailSent?: boolean }>(response);
      if (!response.ok) throw new Error(result.error || "Không thể cập nhật hạn nộp bài.");
      const sentInfo =
        result.emailSent || (result.emailSentCount ?? 0) > 0
          ? " Đã gửi email thông báo hạn mới tới học viên."
          : "";
      setNotice(`Đã cập nhật hạn nộp bài cho ${result.updatedCount ?? 1} lượt làm bài.${sentInfo}`);
      await loadTask();
    } catch (dueError) {
      setError(dueError instanceof Error ? dueError.message : "Không thể cập nhật hạn nộp bài.");
    } finally {
      setBusy(false);
    }
  };

  const saveAsDraft = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/code-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "saveAsDraft" }),
      });
      const result = await readJsonResponse<{ error?: string; id?: string }>(response);
      if (!response.ok || !result.id) throw new Error(result.error || "Không thể lưu vào kho.");
      router.push(`/code-tasks/${result.id}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu vào kho.");
      setBusy(false);
    }
  };

  // Assignee actions
  const respondInvitation = async (action: "accept" | "decline") => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/code-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await readJsonResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(result.error || "Không thể phản hồi lời mời.");
      await loadTask();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể phản hồi lời mời.");
    } finally {
      setBusy(false);
    }
  };

  const saveStudentCode = async (silent = false) => {
    if (!task || task.status !== "accepted" || viewerRole !== "assignee") return;
    setSavingCode(true);
    if (!silent) setError("");
    try {
      const response = await fetch(`/api/code-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "saveCode", code: studentCode }),
      });
      const result = await readJsonResponse<{ error?: string; savedAt?: string }>(response);
      if (!response.ok) throw new Error(result.error || "Không thể lưu code.");
      dirtyRef.current = false;
      setLastSavedLabel(
        `Đã lưu lúc ${new Date(result.savedAt || Date.now()).toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}`,
      );
      if (!silent) setNotice("Đã lưu toàn bộ file code của bạn lên hệ thống.");
    } catch (saveErr) {
      if (!silent) setError(saveErr instanceof Error ? saveErr.message : "Không thể lưu code.");
    } finally {
      setSavingCode(false);
    }
  };

  const triggerRun = async () => {
    if (!task) return;
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    const startedAt = Date.now();
    dirtyRef.current = false;
    setError("");
    setNotice("");
    setRunning(true);
    const snapshotCode = { ...studentCode };
    setExecutedCode(snapshotCode);
    setRunSignal((v) => v + 1);

    try {
      const result = await evaluateCodeInSandbox(snapshotCode, task.criteria, task.passThreshold);

      const response = await fetch(`/api/code-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "run",
          code: snapshotCode,
          autoGrade: result,
        }),
      });
      const payload = await readJsonResponse<{
        error?: string;
        lastRun?: CodeTask["lastRun"];
        grade?: CodeTask["grade"];
      }>(response);
      if (!response.ok) throw new Error(payload.error || "Không thể lưu kết quả chạy code.");

      const elapsed = Date.now() - startedAt;
      if (elapsed < 900) {
        await new Promise((resolve) => window.setTimeout(resolve, 900 - elapsed));
      }

      const finalGrade = payload.lastRun?.autoGrade ?? result;
      setAutoGradeResult(finalGrade);
      playSound(finalGrade.passed ? "pass" : "wrong");

      if (payload.lastRun) {
        setTask((prev) =>
          prev
            ? {
                ...prev,
                savedCode: snapshotCode,
                lastRun: payload.lastRun ?? null,
                grade: payload.grade ?? prev.grade,
              }
            : prev,
        );
        dirtyRef.current = false;
        setLastSavedLabel("Đã lưu & chấm tự động");
        const ptsText = `${payload.lastRun.autoGrade.earnedPoints}/${payload.lastRun.autoGrade.totalPoints} điểm`;
        setNotice(
          payload.lastRun.autoGrade.passed
            ? `🎉 PASS! Kết quả lần Run #${payload.lastRun.runCount} đạt ${ptsText} (${payload.lastRun.autoGrade.percentage}% · ${payload.lastRun.autoGrade.passedCount}/${payload.lastRun.autoGrade.totalCount} tiêu chí).`
            : `Đã Run #${payload.lastRun.runCount}: đạt ${ptsText} (${payload.lastRun.autoGrade.percentage}% · ${payload.lastRun.autoGrade.passedCount}/${payload.lastRun.autoGrade.totalCount} tiêu chí). Xem chi tiết tiêu chí còn thiếu bên dưới.`,
        );
      }
    } catch (runErr) {
      setError(runErr instanceof Error ? runErr.message : "Không thể chạy và chấm bài.");
    } finally {
      setRunning(false);
    }
  };

  const resetStarterCode = () => {
    if (!task) return;
    if (!window.confirm("Khôi phục code và danh sách file về mẫu ban đầu của đề bài?")) return;
    const reset = task.starterCode ?? { ...EMPTY_CODE_BUNDLE };
    dirtyRef.current = true;
    setStudentCode(reset);
    setExecutedCode(reset);
    setRunSignal((v) => v + 1);
  };

  const submitManualGrade = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!manualScore || Number(manualScore) < 0 || Number(manualScore) > 10) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/code-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "grade",
          score: Number(manualScore),
          feedback: manualFeedback,
        }),
      });
      const result = await readJsonResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(result.error || "Không thể lưu điểm.");
      setNotice("Đã cập nhật điểm và nhận xét cho bài nộp.");
      await loadTask();
    } catch (gradeError) {
      setError(gradeError instanceof Error ? gradeError.message : "Không thể lưu điểm.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <BoxesLoader />
        <p>Đang tải bài tập code…</p>
      </div>
    );
  }

  if (!task) {
    return (
      <main className="task-detail-page">
        <div className="task-detail-error">
          <h1>Không mở được bài tập code</h1>
          <p>{error || "Không tìm thấy bài tập."}</p>
          <Link href="/code-tasks">Về danh sách bài tập code</Link>
        </div>
      </main>
    );
  }

  const isCreator = viewerRole === "creator";
  const state = taskStatusLabel(task);
  const studentDisplayCode =
    task.lastRun?.code ?? task.submission?.code ?? task.savedCode ?? task.starterCode ?? EMPTY_CODE_BUNDLE;
  const studentDisplayGrade = task.lastRun?.autoGrade ?? task.submission?.autoGrade ?? null;
  const latestRunCount = task.lastRun?.runCount ?? task.submission?.runCount ?? 0;
  const latestRunAt = task.lastRun?.ranAt ?? task.submission?.submittedAt ?? null;
  const deliveries = task.deliveries ?? [];
  const passedDeliveriesCount = deliveries.filter((d) => d.submission?.passed || d.lastRun?.passed).length;

  const mergedConsoleErrors = Array.from(
    new Set([...(autoGradeResult?.errors ?? []), ...previewLogs.errors]),
  );
  const mergedConsoleLogs = Array.from(
    new Set([...(autoGradeResult?.consoleLogs ?? []), ...previewLogs.consoleLogs]),
  );

  return (
    <main className="task-detail-page">
      <header className="dashboard-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link className="dashboard-brand" href="/">
            <Image src="/erd-draw-logo.png" alt="ERD Draw" width={144} height={96} priority unoptimized />
          </Link>
          <TopNavGlass active="code-tasks" showActivity={isActivityAdminEmail(account?.email)} breadcrumb="Chi tiết" />
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

      <section className="task-detail-content code-detail-content">
        <div className="task-detail-top-nav">
          <Link
            className="task-back-link"
            href={returnAssignee ? `/code-tasks?scope=sent&assignee=${encodeURIComponent(returnAssignee)}` : "/code-tasks"}
          >
            {returnAssignee
              ? `← Quay lại bài đã giao cho ${task.assignedToName || "người này"}`
              : "← Quay lại danh sách bài tập code"}
          </Link>
          <span className={`task-state task-state-${state.tone}`}>
            <span className="task-state-dot" />
            {state.label}
          </span>
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

        <article className="task-detail-card">
          <div className="task-detail-heading">
            <div>
              <span className="dashboard-eyebrow">BÀI TẬP CODE WEB · CHẤM HÀNH VI & ĐẦU RA TỰ ĐỘNG</span>
              <h1>{task.title}</h1>
            </div>
            <div className="task-detail-dates-col">
              <span className="task-detail-date">🕒 Ngày tạo: {formatDate(task.createdAt)}</span>
              {task.dueAt && <span className="due-pill">⏰ Hạn nộp: {formatDate(task.dueAt)}</span>}
            </div>
          </div>

          <div className="task-description-box">
            <div className="task-description-header">
              <span>📋 ĐỀ BÀI & YÊU CẦU ({task.criteria.length} TIÊU CHÍ · NGƯỠNG PASS {task.passThreshold}%)</span>
            </div>
            <p>{task.description}</p>
          </div>

          <div className="task-people-grid">
            <div className="task-person-card">
              <span className="person-role-tag">👤 NGƯỜI GIAO ĐỀ</span>
              <strong>{task.createdByName}</strong>
              <small>{task.createdByEmail}</small>
            </div>
            <div className="task-person-card">
              <span className="person-role-tag">🎯 NGƯỜI LÀM BÀI</span>
              <strong>{task.assignedToName || "Chưa chọn người nhận"}</strong>
              <small>{task.assignedToEmail || "Đề gốc trong kho · Có thể giao cho nhiều người"}</small>
            </div>
          </div>

          {/* ─── CREATOR: DRAFT STUDIO ────────────────────────────── */}
          {isCreator && task.status === "draft" && (
            <>
              <section className="code-studio-section">
                <div className="code-studio-header">
                  <div>
                    <span className="dashboard-eyebrow">STUDIO SOẠN ĐỀ & ĐÁP ÁN MẪU (VS CODE MULTI-FILE)</span>
                    <h2>Thiết lập đề bài, code đáp án chuẩn và tiêu chí chấm tự động</h2>
                  </div>
                  <div className="code-studio-actions">
                    <button
                      type="button"
                      className="code-secondary-button"
                      disabled={busy}
                      onClick={() => void deleteDraft()}
                    >
                      🗑 Xóa đề
                    </button>
                    <button
                      type="button"
                      className="create-diagram-button"
                      disabled={busy}
                      onClick={() => void saveDraftChanges()}
                    >
                      {busy ? "Đang lưu…" : "💾 Lưu thay đổi đề"}
                    </button>
                  </div>
                </div>

                <div className="code-draft-fields">
                  <div className="code-field-row">
                    <div className="code-field-grow">
                      <label htmlFor="draft-title">Tên đề bài</label>
                      <input
                        id="draft-title"
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        minLength={3}
                        maxLength={140}
                      />
                    </div>
                    <div className="code-field-small">
                      <label htmlFor="draft-threshold">Ngưỡng Pass (%)</label>
                      <input
                        id="draft-threshold"
                        type="number"
                        min={1}
                        max={100}
                        value={draftThreshold}
                        onChange={(e) => setDraftThreshold(Math.min(100, Math.max(1, Number(e.target.value) || 100)))}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="draft-description">Nội dung đề bài & yêu cầu</label>
                    <textarea
                      id="draft-description"
                      value={draftDescription}
                      onChange={(e) => setDraftDescription(e.target.value)}
                      rows={5}
                    />
                  </div>
                </div>

                <div className="code-editor-toolbar">
                  <div className="code-subtabs">
                    <button
                      type="button"
                      className={draftEditorTab === "solution" ? "active" : ""}
                      onClick={() => setDraftEditorTab("solution")}
                    >
                      ✅ Code đáp án mẫu (ẩn với học viên)
                    </button>
                    <button
                      type="button"
                      className={draftEditorTab === "starter" ? "active" : ""}
                      onClick={() => setDraftEditorTab("starter")}
                    >
                      🧩 Code khởi tạo cho học viên (Starter)
                    </button>
                  </div>
                  <div className="code-subtab-actions">
                    <button
                      type="button"
                      className="code-secondary-button"
                      disabled={analyzing}
                      onClick={() => void extractCriteriaFromSolution()}
                    >
                      {analyzing ? "Đang phân tích…" : "✨ Tự động trích xuất tiêu chí từ đáp án"}
                    </button>
                    <button type="button" className="code-run-button" onClick={() => void testSolutionCode()}>
                      ▶ Chạy thử & chấm đáp án
                    </button>
                  </div>
                </div>

                <div className="code-ide-grid">
                  <div>
                    <CodeEditorPane
                      value={draftEditorTab === "solution" ? draftSolution : draftStarter}
                      onChange={(next) => {
                        if (draftEditorTab === "solution") setDraftSolution(next);
                        else setDraftStarter(next);
                      }}
                      onRunShortcut={() => void testSolutionCode()}
                      height={400}
                      label={draftEditorTab === "solution" ? "Đáp án chuẩn" : "Khung code ban đầu"}
                      workspaceName={draftEditorTab === "solution" ? "SOLUTION" : "STARTER"}
                    />
                  </div>
                  <div className="code-preview-panel">
                    <div className="code-preview-header">
                      <span>🌐 Xem trước trang web đáp án</span>
                      {draftGradeResult && (
                        <span className={`code-progress-pill ${draftGradeResult.passed ? "is-pass" : "is-fail"}`}>
                          {draftGradeResult.passed ? "PASS" : "CHƯA ĐẠT"} · {draftGradeResult.earnedPoints}/{draftGradeResult.totalPoints}đ ({draftGradeResult.percentage}%)
                        </span>
                      )}
                    </div>
                    <CodePreviewFrame
                      code={draftExecutedCode}
                      criteria={draftCriteria}
                      passThreshold={draftThreshold}
                      runSignal={draftRunSignal}
                      title="Xem trước đáp án mẫu"
                      height={400}
                    />
                  </div>
                </div>

                {/* Criteria Builder */}
                <div className="code-criteria-builder">
                  <div className="code-criteria-builder-head">
                    <div>
                      <h3>Bộ tiêu chí chấm điểm tự động ({draftCriteria.length} tiêu chí)</h3>
                      <p>Chấm theo sản phẩm đầu ra và hành vi tương tác thực tế (không phụ thuộc tên biến hay cách đặt class/id của học viên).</p>
                    </div>
                    <button type="button" className="code-secondary-button" onClick={addEmptyCriterion}>
                      ＋ Thêm tiêu chí
                    </button>
                  </div>

                  {draftCriteria.length ? (
                    <div className="code-criteria-edit-list">
                      {draftCriteria.map((criterion, index) => (
                        <div className="code-criterion-edit-card" key={criterion.id}>
                          <div className="criterion-edit-top">
                            <input
                              className="criterion-label-input"
                              value={criterion.label}
                              onChange={(e) => updateCriterion(index, { label: e.target.value })}
                              placeholder="Mô tả tiêu chí cho học viên..."
                            />
                            <button
                              type="button"
                              className="criterion-delete-btn"
                              onClick={() => removeCriterion(index)}
                              title="Xóa tiêu chí"
                            >
                              ×
                            </button>
                          </div>
                          <div className="criterion-edit-grid">
                            <label>
                              <span>Loại kiểm tra</span>
                              <select
                                value={criterion.type}
                                onChange={(e) =>
                                  updateCriterion(index, {
                                    type: e.target.value as CodeCriterionType,
                                    property:
                                      e.target.value === "style_color"
                                        ? criterion.property || "color"
                                        : e.target.value === "style_property"
                                          ? criterion.property || "fontWeight"
                                          : undefined,
                                    attribute:
                                      e.target.value === "attribute_check"
                                        ? criterion.attribute || "href"
                                        : undefined,
                                  })
                                }
                              >
                                {(Object.keys(CRITERION_TYPE_LABELS) as CodeCriterionType[]).map((t) => (
                                  <option key={t} value={t}>
                                    {CRITERION_TYPE_LABELS[t]}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label>
                              <span>Bộ chọn CSS (Selector)</span>
                              <input
                                value={criterion.selector}
                                onChange={(e) => updateCriterion(index, { selector: e.target.value })}
                                placeholder="*, h1, body, .card, button..."
                              />
                            </label>

                            {(criterion.type === "style_color" || criterion.type === "style_property") && (
                              <label>
                                <span>Thuộc tính CSS</span>
                                <input
                                  value={criterion.property ?? ""}
                                  onChange={(e) => updateCriterion(index, { property: e.target.value })}
                                  placeholder={criterion.type === "style_color" ? "color / backgroundColor" : "borderRadius / fontWeight"}
                                />
                              </label>
                            )}

                            {criterion.type === "attribute_check" && (
                              <label>
                                <span>Thuộc tính HTML</span>
                                <input
                                  value={criterion.attribute ?? ""}
                                  onChange={(e) => updateCriterion(index, { attribute: e.target.value })}
                                  placeholder="src / href / alt"
                                />
                              </label>
                            )}

                            {criterion.type === "element_exists" ? (
                              <label>
                                <span>Số lượng tối thiểu</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={criterion.minCount ?? 1}
                                  onChange={(e) =>
                                    updateCriterion(index, { minCount: Math.max(1, Number(e.target.value) || 1) })
                                  }
                                />
                              </label>
                            ) : (
                              <label>
                                <span>Giá trị yêu cầu</span>
                                <input
                                  value={criterion.expected}
                                  onChange={(e) => updateCriterion(index, { expected: e.target.value })}
                                  placeholder={
                                    criterion.type === "style_color"
                                      ? "#2563eb hoặc rgb(...)"
                                      : criterion.type === "style_align"
                                        ? "center / left / right"
                                        : "Giá trị cần có..."
                                  }
                                />
                              </label>
                            )}

                            <label className="criterion-weight-field">
                              <span>Điểm (Weight)</span>
                              <input
                                type="number"
                                min={1}
                                max={100}
                                value={criterion.weight}
                                onChange={(e) =>
                                  updateCriterion(index, { weight: Math.max(1, Number(e.target.value) || 1) })
                                }
                              />
                            </label>
                          </div>
                          {criterion.type === "behavior_test" && criterion.steps?.length ? (
                            <div className="criterion-behavior-note">
                              ⚡ Kịch bản kiểm thử tự động gồm {criterion.steps.length} bước thao tác & đối chiếu DOM.
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="task-notice notice-waiting">
                      Chưa có tiêu chí nào. Hãy nhập code đáp án ở trên rồi bấm <strong>“✨ Tự động trích xuất tiêu chí từ đáp án”</strong> hoặc thêm tiêu chí thủ công.
                    </div>
                  )}

                  {draftGradeResult && (
                    <div style={{ marginTop: 16 }}>
                      <h4 style={{ margin: "0 0 8px", fontSize: 12, color: "var(--ink)" }}>
                        Kết quả kiểm tra thử đáp án mẫu:
                      </h4>
                      <CriterionListTable result={draftGradeResult} criteria={draftCriteria} />
                    </div>
                  )}
                </div>
              </section>

              {/* Assign panel */}
              <section className="task-action-panel task-assign-panel">
                <div className="task-assign-copy">
                  <h2>Giao bài tập code cho nhiều học viên</h2>
                  <p>Chọn một hoặc nhiều học viên để giao cùng lúc. Hãy nhớ bấm “Lưu thay đổi đề” trước nếu bạn vừa sửa tiêu chí hoặc code.</p>
                  <DueDateAssignField
                    value={assignDueAtLocal}
                    onChange={setAssignDueAtLocal}
                    disabled={busy}
                    inputId="code-assign-due-at"
                  />
                </div>
                <MultiRecipientPicker
                  busy={busy}
                  disabled={draftCriteria.length === 0}
                  alreadyAssignedEmails={deliveries.map((d) => d.assignedToEmail ?? "").filter(Boolean)}
                  onAssign={assignTask}
                  inputId="code-recipient-search"
                />
              </section>

              {/* Deliveries & Results Dashboard */}
              {deliveries.length > 0 && (
                <section className="task-deliveries">
                  <header>
                    <div>
                      <span className="dashboard-eyebrow">KẾT QUẢ NGƯỜI LÀM BÀI ĐÃ GIAO</span>
                      <h2>
                        {deliveries.length} lượt giao · {passedDeliveriesCount}/{deliveries.length} đã Pass
                      </h2>
                    </div>
                    <Link href="/code-tasks?scope=sent">Xem tất cả bài đã giao →</Link>
                  </header>
                  <DueDateEditorCard
                    currentDueAt={deliveries[0]?.dueAt ?? null}
                    busy={busy}
                    label={`Hạn nộp chung cho ${deliveries.length} lượt đã giao`}
                    onSave={updateDueDate}
                  />
                  <div className="task-delivery-list">
                    {deliveries.map((delivery) => {
                      const dGrade = delivery.submission ?? delivery.lastRun;
                      const dState = taskStatusLabel({
                        status: delivery.status,
                        lastRun: delivery.lastRun ? { autoGrade: delivery.lastRun } : null,
                        submission: delivery.submission ? { autoGrade: delivery.submission } : null,
                      });
                      return (
                        <Link key={delivery.id} href={`/code-tasks/${delivery.id}`} className="task-delivery-row code-delivery-row">
                          <span>
                            <strong>{delivery.assignedToName || "Người nhận"}</strong>
                            <small>{delivery.assignedToEmail || "—"}</small>
                          </span>
                          <div className="code-delivery-metrics">
                            {dGrade ? (
                              <>
                                <span className={`code-progress-pill ${dGrade.passed ? "is-pass" : "is-fail"}`}>
                                  {dGrade.passed ? "PASS" : "CHƯA ĐẠT"} · {dGrade.percentage}% ({dGrade.passedCount}/{dGrade.totalCount} tiêu chí)
                                </span>
                                {delivery.lastRun?.runCount ? (
                                  <span className="task-sub-count">▶ {delivery.lastRun.runCount} lần Run</span>
                                ) : null}
                              </>
                            ) : (
                              <span className={`task-state task-state-${dState.tone}`}>
                                <span className="task-state-dot" />
                                {dState.label}
                              </span>
                            )}
                          </div>
                          <time>{formatDate(delivery.updatedAt)}</time>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}

          {isCreator && task.status !== "draft" && (
            <DueDateEditorCard
              currentDueAt={task.dueAt}
              busy={busy}
              label="Hạn nộp lượt bài này"
              onSave={updateDueDate}
            />
          )}

          {/* ─── CREATOR VIEWING ASSIGNED TASK: REUSE / LINK ──────── */}
          {isCreator && task.status !== "draft" && task.sourceTaskId && (
            <div className="task-notice notice-active">
              Đây là lượt làm bài đã giao cho <strong>{task.assignedToName}</strong>.{" "}
              <Link href={`/code-tasks/${task.sourceTaskId}`}>Quay lại đề gốc trong kho để xem tất cả học viên →</Link>
            </div>
          )}

          {isCreator && task.status !== "draft" && !task.sourceTaskId && (
            <section className="task-action-panel task-reuse-panel">
              <div>
                <h2>Lưu đề này vào kho</h2>
                <p>Tạo bản đề gốc trong kho để giao lại cho nhiều học viên khác.</p>
              </div>
              <button className="create-diagram-button" type="button" disabled={busy} onClick={() => void saveAsDraft()}>
                {busy ? "Đang lưu…" : "Đưa đề vào kho"}
              </button>
            </section>
          )}

          {/* ─── ASSIGNEE: INVITED ────────────────────────────────── */}
          {!isCreator && task.status === "invited" && (
            <section className="task-action-panel invitation-panel">
              <div>
                <h2>Lời mời làm bài tập Code</h2>
                <p>Khi chấp nhận, bạn có thể tạo nhiều file (HTML, CSS, JS) như VS Code, bấm Run để chạy thử và tự động chấm điểm hành vi + đầu ra.</p>
              </div>
              <div className="task-action-buttons">
                <button
                  className="task-decline-button"
                  type="button"
                  disabled={busy}
                  onClick={() => void respondInvitation("decline")}
                >
                  Từ chối
                </button>
                <button
                  className="create-diagram-button"
                  type="button"
                  disabled={busy}
                  onClick={() => void respondInvitation("accept")}
                >
                  {busy ? "Đang mở…" : "Chấp nhận và bắt đầu code"}
                </button>
              </div>
            </section>
          )}

          {/* ─── ASSIGNEE: WORKING VS CODE IDE ────────────────────── */}
          {!isCreator && task.status === "accepted" && (
            <section className="code-workspace-section">
              <RunCodeOverlay visible={running} label="Đang chạy code & chấm điểm…" />
              <div className="code-workspace-bar">
                <div className="code-workspace-score">
                  {autoGradeResult ? (
                    <>
                      <span className={`code-big-badge ${autoGradeResult.passed ? "is-pass" : "is-fail"}`}>
                        {autoGradeResult.passed ? "PASS" : "CHƯA ĐẠT"} · {autoGradeResult.earnedPoints}/{autoGradeResult.totalPoints}đ ({autoGradeResult.percentage}%)
                      </span>
                      <span className="code-score-detail">
                        Đạt {autoGradeResult.passedCount}/{autoGradeResult.totalCount} tiêu chí (Ngưỡng Pass ≥ {task.passThreshold}%)
                        {task.lastRun?.runCount ? ` · Run ${task.lastRun.runCount} lần` : ""}
                      </span>
                    </>
                  ) : (
                    <span className="code-score-detail">
                      Tạo/chỉnh sửa file trong Explorer rồi bấm <strong>▶ Run Code</strong> để xem kết quả và chấm tự động.
                    </span>
                  )}
                  {lastSavedLabel && <span className="code-saved-chip">☁ {savingCode ? "Đang lưu…" : lastSavedLabel}</span>}
                </div>
                <div className="code-workspace-buttons">
                  <button
                    type="button"
                    className="code-kbd-btn btn-white"
                    disabled={busy || running}
                    onClick={resetStarterCode}
                  >
                    <span className="btn-txt">Khôi phục mẫu</span>
                    <kbd className="btn-kbd">↺</kbd>
                  </button>
                  <button
                    type="button"
                    className="code-kbd-btn btn-green"
                    disabled={busy || savingCode}
                    onClick={() => void saveStudentCode(false)}
                  >
                    <span className="btn-txt">{savingCode ? "Đang lưu…" : "Lưu code"}</span>
                    <kbd className="btn-kbd">Ctrl+S</kbd>
                  </button>
                  <button
                    type="button"
                    className="code-kbd-btn btn-blue"
                    disabled={busy || running}
                    onClick={() => void triggerRun()}
                  >
                    <span className="btn-txt">{running ? "Đang chạy & chấm…" : "Run Code"}</span>
                    <kbd className="btn-kbd">Ctrl+↵</kbd>
                  </button>
                </div>
              </div>

              {autoGradeResult && (
                <div className="code-progress-bar-wrap">
                  <div className="code-progress-bar-track">
                    <div
                      className={`code-progress-bar-fill ${autoGradeResult.passed ? "is-pass" : "is-fail"}`}
                      style={{ width: `${autoGradeResult.percentage}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="code-ide-grid">
                <div>
                  <CodeEditorPane
                    value={studentCode}
                    onChange={(next) => {
                      dirtyRef.current = true;
                      setStudentCode(next);
                    }}
                    onRunShortcut={() => void triggerRun()}
                    onSaveShortcut={() => void saveStudentCode(false)}
                    height={430}
                    label="Code bài làm"
                    workspaceName="MY-PROJECT"
                  />
                </div>
                <div className="code-preview-panel">
                  <div className="code-preview-header">
                    <span>🌐 Kết quả hiển thị trang web (tương tác trực tiếp)</span>
                    {latestRunCount > 0 && (
                      <span className="task-sub-count">▶ Đã Run {latestRunCount} lần</span>
                    )}
                  </div>
                  <CodePreviewFrame
                    code={executedCode}
                    criteria={task.criteria}
                    passThreshold={task.passThreshold}
                    runSignal={runSignal}
                    title="Kết quả code bài làm"
                    height={430}
                    onPreviewLogs={setPreviewLogs}
                  />
                </div>
              </div>

              {(autoGradeResult || mergedConsoleErrors.length > 0 || mergedConsoleLogs.length > 0) && (
                <div className="code-console-box">
                  <strong>Console / Lỗi JS:</strong>
                  {mergedConsoleErrors.map((errMsg, i) => (
                    <div className="console-line is-error" key={`err_${i}`}>✕ {errMsg}</div>
                  ))}
                  {mergedConsoleLogs.map((logMsg, i) => (
                    <div className="console-line" key={`log_${i}`}>› {logMsg}</div>
                  ))}
                  {mergedConsoleErrors.length === 0 && mergedConsoleLogs.length === 0 && (
                    <div className="console-line" style={{ color: "#94a3b8" }}>
                      (Console trống — hãy dùng console.log(...) để in kết quả)
                    </div>
                  )}
                </div>
              )}

              <div className="code-criteria-section">
                <h3>Chi tiết chấm tự động theo yêu cầu đầu ra ({task.criteria.length} tiêu chí)</h3>
                <CriterionListTable result={autoGradeResult} criteria={task.criteria} />
              </div>
            </section>
          )}

          {/* ─── GRADE CARD (after latest Run) ────────────────────── */}
          {task.grade && (task.lastRun || task.submission) && (
            <div className="task-grade-result-card" style={{ marginTop: 22 }}>
              <div className="grade-badge-side">
                <span className="grade-score-number">{task.grade.score}</span>
                <span className="grade-score-scale">/ 10 ĐIỂM</span>
              </div>
              <div className="grade-feedback-side">
                <strong>{task.grade.auto ? "Kết quả chấm tự động (lần Run gần nhất):" : "Nhận xét từ người giao đề:"}</strong>
                <p>{task.grade.feedback || "Chưa có nhận xét chi tiết."}</p>
                <small>Ghi nhận tại lần Run #{latestRunCount || task.grade.submissionVersion}</small>
              </div>
            </div>
          )}

          {/* ─── STATUS NOTICES ──────────────────────────────────── */}
          {task.status === "declined" && (
            <div className="task-notice notice-declined">
              ⚠️ {isCreator ? `${task.assignedToName} đã từ chối lời mời làm bài này.` : "Bạn đã từ chối lời mời làm bài này."}
            </div>
          )}
          {isCreator && task.status === "invited" && (
            <div className="task-notice notice-waiting">
              ⏳ Đang chờ {task.assignedToName} chấp nhận lời mời làm bài.
            </div>
          )}
          {isCreator && task.status === "accepted" && !studentDisplayGrade && (
            <div className="task-notice notice-active">
              ✏️ {task.assignedToName} đã nhận bài và chưa bấm Run Code lần nào.
            </div>
          )}

          {/* ─── CREATOR VIEWING STUDENT LATEST RUN RESULT ──────── */}
          {isCreator && task.status !== "draft" && (task.lastRun || task.submission) && (
            <section className="submission-section">
              <div className="submission-heading">
                <div>
                  <span className="dashboard-eyebrow">
                    KẾT QUẢ LẦN RUN GẦN NHẤT (LẦN #{latestRunCount || 1})
                  </span>
                  <h2>Kết quả làm bài của {task.assignedToName}</h2>
                </div>
                <time>
                  🕒 Run gần nhất: {formatDate(latestRunAt)}
                </time>
              </div>

              {studentDisplayGrade && (
                <div className="code-creator-summary-card">
                  <div className="code-creator-kpi">
                    <span className={`code-big-badge ${studentDisplayGrade.passed ? "is-pass" : "is-fail"}`}>
                      {studentDisplayGrade.passed ? "PASS" : "CHƯA ĐẠT"} · {studentDisplayGrade.earnedPoints ?? studentDisplayGrade.percentage}/{studentDisplayGrade.totalPoints ?? 100}đ ({studentDisplayGrade.percentage}%)
                    </span>
                    <div>
                      <strong>
                        Đạt {studentDisplayGrade.passedCount}/{studentDisplayGrade.totalCount} tiêu chí
                      </strong>
                      <small>
                        Ngưỡng Pass: {studentDisplayGrade.passThreshold}% · Tổng lượt Run: {task.submission?.runCount ?? task.lastRun?.runCount ?? 0}
                      </small>
                    </div>
                  </div>
                  <div className="code-progress-bar-track">
                    <div
                      className={`code-progress-bar-fill ${studentDisplayGrade.passed ? "is-pass" : "is-fail"}`}
                      style={{ width: `${studentDisplayGrade.percentage}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="code-criteria-section" style={{ marginBottom: 22 }}>
                <h3>Chi tiết chấm tự động từng tiêu chí</h3>
                <CriterionListTable result={studentDisplayGrade} criteria={task.criteria} />
              </div>

              <div className="code-compare-header">
                <h3>So sánh kết quả trang web trực quan</h3>
                <div className="code-subtabs">
                  <button
                    type="button"
                    className={creatorCompareTab === "both" ? "active" : ""}
                    onClick={() => setCreatorCompareTab("both")}
                  >
                    Song song
                  </button>
                  <button
                    type="button"
                    className={creatorCompareTab === "student" ? "active" : ""}
                    onClick={() => setCreatorCompareTab("student")}
                  >
                    Bài của học viên
                  </button>
                  <button
                    type="button"
                    className={creatorCompareTab === "solution" ? "active" : ""}
                    onClick={() => setCreatorCompareTab("solution")}
                  >
                    Đáp án mẫu
                  </button>
                </div>
              </div>

              <div className={`code-compare-grid ${creatorCompareTab === "both" ? "is-split" : "is-single"}`}>
                {(creatorCompareTab === "both" || creatorCompareTab === "student") && (
                  <div className="code-preview-panel">
                    <div className="code-preview-header">
                      <span>👤 Trang web của {task.assignedToName}</span>
                    </div>
                    <CodePreviewFrame
                      code={studentDisplayCode}
                      criteria={task.criteria}
                      passThreshold={task.passThreshold}
                      runSignal={creatorPreviewSignal}
                      title="Bài làm của học viên"
                      height={360}
                    />
                  </div>
                )}
                {(creatorCompareTab === "both" || creatorCompareTab === "solution") && (
                  <div className="code-preview-panel">
                    <div className="code-preview-header">
                      <span>✅ Trang web đáp án mẫu</span>
                    </div>
                    <CodePreviewFrame
                      code={task.solutionCode ?? EMPTY_CODE_BUNDLE}
                      criteria={task.criteria}
                      passThreshold={task.passThreshold}
                      runSignal={creatorPreviewSignal}
                      title="Đáp án mẫu"
                      height={360}
                    />
                  </div>
                )}
              </div>

              <div style={{ marginTop: 20 }}>
                <h3 style={{ margin: "0 0 10px", fontSize: 13 }}>Mã nguồn học viên đã viết (các file trong workspace)</h3>
                <CodeEditorPane
                  value={studentDisplayCode}
                  readOnly
                  height={320}
                  label="Chế độ xem"
                  workspaceName="STUDENT-CODE"
                />
              </div>
            </section>
          )}

          {/* ─── CREATOR MANUAL OVERRIDE GRADE ────────────────────── */}
          {isCreator && (task.lastRun || task.submission) && (
            <section className="task-grade-panel">
              <div>
                <span className="dashboard-eyebrow">ĐIỀU CHỈNH ĐIỂM & NHẬN XÉT</span>
                <h2>Ghi nhận xét hoặc cập nhật điểm thủ công</h2>
                <p>Hệ thống đã tự động quy đổi điểm theo tỷ lệ thành công. Bạn có thể bổ sung nhận xét riêng nếu muốn.</p>
              </div>
              <form onSubmit={submitManualGrade}>
                <label htmlFor="code-manual-score">Điểm số (Thang điểm 10)</label>
                <input
                  id="code-manual-score"
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  required
                  value={manualScore}
                  onChange={(e) => setManualScore(e.target.value)}
                  placeholder="Ví dụ: 9.5"
                />
                <label htmlFor="code-manual-feedback">Lời nhận xét</label>
                <textarea
                  id="code-manual-feedback"
                  maxLength={2000}
                  value={manualFeedback}
                  onChange={(e) => setManualFeedback(e.target.value)}
                  placeholder="Nhận xét thêm về cách viết HTML, CSS, bố cục hoặc JS..."
                />
                <button
                  className="create-diagram-button"
                  type="submit"
                  disabled={busy || manualScore === "" || Number(manualScore) < 0 || Number(manualScore) > 10}
                >
                  {busy ? "Đang lưu…" : "Lưu điểm và nhận xét"}
                </button>
              </form>
            </section>
          )}
        </article>
      </section>
    </main>
  );
}
