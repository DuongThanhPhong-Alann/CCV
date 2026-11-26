import { runDailySummarySweep, runDeadlineWarningSweep } from "@/lib/mail-scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (secret) {
    const authHeader = request.headers.get("authorization") || "";
    if (authHeader !== `Bearer ${secret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { searchParams } = new URL(request.url);
  const task = searchParams.get("task") || "all";

  try {
    const warnings =
      task === "warnings" || task === "all" ? await runDeadlineWarningSweep() : null;
    const summary =
      task === "summary" || task === "all" ? await runDailySummarySweep() : null;
    return Response.json({ ok: true, task, warnings, summary });
  } catch {
    return Response.json({ error: "Cron mail job failed" }, { status: 503 });
  }
}
