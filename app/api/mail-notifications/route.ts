import { currentOwnerId } from "@/lib/current-user";
import { isMailConfigured } from "@/lib/mailer";
import { runDailySummarySweep, runDeadlineWarningSweep } from "@/lib/mail-scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ownerId = await currentOwnerId();
  if (!ownerId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ mailConfigured: isMailConfigured() });
}

export async function POST(request: Request) {
  const ownerId = await currentOwnerId();
  if (!ownerId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { action?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
  }

  const action = body.action;
  try {
    if (action === "sendDeadlineWarnings") {
      const result = await runDeadlineWarningSweep({
        ownerId: ownerId.toString(),
        includeAllUpcoming: true,
      });
      return Response.json({ ok: true, ...result });
    }

    if (action === "sendDailySummary") {
      const result = await runDailySummarySweep({
        ownerId: ownerId.toString(),
        force: true,
      });
      return Response.json({ ok: true, ...result });
    }

    return Response.json({ error: "Thao tác không hợp lệ." }, { status: 400 });
  } catch {
    return Response.json({ error: "Không thể chạy tác vụ gửi email." }, { status: 503 });
  }
}
