import nodemailer from "nodemailer";

export type MailSendResult = {
  sent: boolean;
  skipped?: boolean;
  error?: string;
};

let cachedTransporter: nodemailer.Transporter | null = null;
let cachedKey = "";

export const APP_TIMEZONE = "Asia/Ho_Chi_Minh";
export const PRODUCTION_APP_URL = "https://erd-navy.vercel.app";

function resolveAppBaseUrl() {
  const candidates = [
    process.env.MAIL_BASE_URL,
    process.env.APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "",
    process.env.NEXTAUTH_URL,
  ];
  for (const raw of candidates) {
    const cleaned = (raw || "").trim().replace(/\/+$/, "");
    if (cleaned && !/localhost|127\.0\.0\.1/i.test(cleaned)) {
      return cleaned;
    }
  }
  return PRODUCTION_APP_URL;
}

function smtpConfig() {
  const host = (process.env.SMTP_HOST || "smtp.gmail.com").trim();
  const port = Number(process.env.SMTP_PORT || 465) || 465;
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465;
  const user = (process.env.SMTP_USER || "").trim();
  const pass = (process.env.SMTP_PASS || "").replace(/\s+/g, "").trim();
  const from = (process.env.SMTP_FROM || (user ? `ERD & Code Studio <${user}>` : "")).trim();
  const resendKey = (process.env.RESEND_API_KEY || "").trim();
  const baseUrl = resolveAppBaseUrl();
  return { host, port, secure, user, pass, from, resendKey, baseUrl };
}

export function isMailConfigured() {
  const cfg = smtpConfig();
  return Boolean((cfg.user && cfg.pass) || cfg.resendKey);
}

function getTransporter() {
  const cfg = smtpConfig();
  if (!cfg.user || !cfg.pass) return null;
  const key = `${cfg.host}:${cfg.port}:${cfg.secure}:${cfg.user}:${cfg.pass.slice(0, 4)}`;
  if (!cachedTransporter || cachedKey !== key) {
    cachedTransporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      pool: true,
      maxConnections: 3,
      connectionTimeout: 6000,
      greetingTimeout: 6000,
      socketTimeout: 8000,
      auth: {
        user: cfg.user,
        pass: cfg.pass,
      },
    });
    cachedKey = key;
  }
  return cachedTransporter;
}

function escHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatVietnamDateTime(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

type MailTheme = "blue" | "amber" | "violet" | "emerald";

const THEMES: Record<
  MailTheme,
  {
    headerBg: string;
    accent: string;
    softBg: string;
    softBorder: string;
    pillBg: string;
    pillText: string;
    btnBg: string;
  }
> = {
  blue: {
    headerBg: "linear-gradient(135deg,#0f172a 0%,#1d4ed8 58%,#2563eb 100%)",
    accent: "#2563eb",
    softBg: "#eff6ff",
    softBorder: "#bfdbfe",
    pillBg: "rgba(255,255,255,0.18)",
    pillText: "#eff6ff",
    btnBg: "linear-gradient(135deg,#2563eb,#1d4ed8)",
  },
  amber: {
    headerBg: "linear-gradient(135deg,#7c2d12 0%,#d97706 55%,#f59e0b 100%)",
    accent: "#d97706",
    softBg: "#fffbeb",
    softBorder: "#fde68a",
    pillBg: "rgba(255,255,255,0.2)",
    pillText: "#fffbeb",
    btnBg: "linear-gradient(135deg,#d97706,#b45309)",
  },
  violet: {
    headerBg: "linear-gradient(135deg,#312e81 0%,#4f46e5 55%,#7c3aed 100%)",
    accent: "#4f46e5",
    softBg: "#eef2ff",
    softBorder: "#c7d2fe",
    pillBg: "rgba(255,255,255,0.18)",
    pillText: "#eef2ff",
    btnBg: "linear-gradient(135deg,#4f46e5,#6d28d9)",
  },
  emerald: {
    headerBg: "linear-gradient(135deg,#064e3b 0%,#059669 58%,#10b981 100%)",
    accent: "#059669",
    softBg: "#ecfdf5",
    softBorder: "#a7f3d0",
    pillBg: "rgba(255,255,255,0.18)",
    pillText: "#ecfdf5",
    btnBg: "linear-gradient(135deg,#059669,#047857)",
  },
};

function wrapEmailLayout(
  title: string,
  badge: string,
  bodyHtml: string,
  themeName: MailTheme = "blue",
  subtitle?: string,
) {
  const t = THEMES[themeName];
  return `<!DOCTYPE html>
<html lang="vi">
<body style="margin:0;padding:0;background-color:#eef2f7;background-image:radial-gradient(#cbd5e1 1px, transparent 1px);background-size:18px 18px;font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:28px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;background:#ffffff;border:1px solid #cbd5e1;border-radius:18px;overflow:hidden;box-shadow:0 14px 34px rgba(15,23,42,0.10);">
          <!-- Top ornamental ribbon -->
          <tr>
            <td style="height:5px;background:linear-gradient(90deg,#2563eb 0%,#7c3aed 33%,#ec4899 66%,#f59e0b 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <!-- Patterned Hero Header -->
          <tr>
            <td style="background:${t.headerBg};padding:26px 28px 24px;color:#ffffff;position:relative;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${t.pillBg};border:1px solid rgba(255,255,255,0.28);color:${t.pillText};font-size:11px;font-weight:800;letter-spacing:0.9px;text-transform:uppercase;">
                      &#10022; ${escHtml(badge)} &#10022;
                    </span>
                  </td>
                  <td align="right" style="font-size:18px;letter-spacing:4px;opacity:0.45;color:#ffffff;">
                    &#9672; &#10023; &#9672;
                  </td>
                </tr>
              </table>
              <h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;font-weight:800;color:#ffffff;">${escHtml(title)}</h1>
              ${
                subtitle
                  ? `<p style="margin:6px 0 0;font-size:13px;line-height:1.5;color:rgba(255,255,255,0.88);">${escHtml(subtitle)}</p>`
                  : ""
              }
              <div style="margin-top:14px;height:1px;background:linear-gradient(90deg,rgba(255,255,255,0.45),rgba(255,255,255,0.05));"></div>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding:24px 28px;font-size:14px;line-height:1.65;color:#334155;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Decorative Divider + Footer -->
          <tr>
            <td style="padding:0 28px;">
              <div style="text-align:center;color:#94a3b8;font-size:12px;letter-spacing:8px;border-top:1px dashed #cbd5e1;padding-top:12px;">
                &#9672; &#10022; &#9672;
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 28px 20px;background:#ffffff;text-align:center;font-size:12px;line-height:1.6;color:#64748b;">
              Thông báo tự động từ <strong style="color:#1e293b;">ERD Draw &amp; Code Practice Studio</strong><br>
              <span style="color:#94a3b8;">Hệ thống thực hành Thiết kế Cơ sở dữ liệu &amp; Lập trình Web trực tuyến</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendEmailSafe(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<MailSendResult> {
  const to = params.to.trim().toLowerCase();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { sent: false, skipped: true, error: "Email người nhận không hợp lệ." };
  }

  const cfg = smtpConfig();
  if (!isMailConfigured()) {
    console.info(`[mailer] Bỏ qua gửi mail tới ${to} (${params.subject}) vì chưa cấu hình SMTP_USER/SMTP_PASS hoặc RESEND_API_KEY.`);
    return { sent: false, skipped: true };
  }

  if (cfg.resendKey && !(cfg.user && cfg.pass)) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: cfg.from || "ERD & Code Studio <onboarding@resend.dev>",
          to: [to],
          subject: params.subject,
          html: params.html,
          text: params.text,
        }),
      });
      if (!response.ok) {
        const msg = await response.text().catch(() => `HTTP ${response.status}`);
        console.warn(`[mailer] Resend lỗi khi gửi tới ${to}:`, msg);
        return { sent: false, error: msg };
      }
      return { sent: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[mailer] Resend lỗi khi gửi tới ${to}:`, msg);
      return { sent: false, error: msg };
    }
  }

  const transporter = getTransporter();
  if (!transporter) return { sent: false, skipped: true };

  try {
    await transporter.sendMail({
      from: cfg.from || cfg.user,
      to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    return { sent: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[mailer] SMTP lỗi khi gửi tới ${to}:`, msg);
    return { sent: false, error: msg };
  }
}

export async function sendWelcomeEmail(params: { toEmail: string; toName: string }) {
  const { baseUrl } = smtpConfig();
  const subject = "Chào mừng bạn tham gia ERD Draw & Code Studio";
  const bodyHtml = `
    <p style="margin-top:0;">Xin chào <strong style="color:#0f172a;">${escHtml(params.toName)}</strong>,</p>
    <p>Tài khoản của bạn với email <strong>${escHtml(params.toEmail)}</strong> đã sẵn sàng trên hệ thống thực hành vẽ sơ đồ ERD &amp; lập trình Web.</p>
    <div style="margin:16px 0;padding:14px 16px;border-radius:12px;background:#eff6ff;border:1px solid #bfdbfe;">
      <div style="font-weight:700;color:#1d4ed8;margin-bottom:4px;">&#128640; Bắt đầu ngay hôm nay</div>
      <div style="font-size:13px;color:#334155;">Nhận bài tập từ giảng viên, viết code trực tiếp trên web, chạy kiểm thử tự động và theo dõi tiến độ từng ngày.</div>
    </div>
    <p style="margin:22px 0 6px;text-align:center;">
      <a href="${escHtml(baseUrl)}/login" style="display:inline-block;padding:11px 24px;border-radius:10px;background:${THEMES.blue.btnBg};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;">Đăng nhập vào hệ thống &rarr;</a>
    </p>
  `;
  const text = `Xin chào ${params.toName},\nTài khoản (${params.toEmail}) của bạn đã được đăng ký thành công.\nĐăng nhập tại: ${baseUrl}/login`;
  return sendEmailSafe({
    to: params.toEmail,
    subject,
    html: wrapEmailLayout(
      "Đăng ký tài khoản thành công",
      "CHÀO MỪNG THÀNH VIÊN MỚI",
      bodyHtml,
      "blue",
      "Không gian học tập Thiết kế CSDL & Lập trình Web",
    ),
    text,
  });
}

export async function sendTasksAssignedEmail(params: {
  toEmail: string;
  toName: string;
  assignerName: string;
  assignerEmail: string;
  taskKind: "erd" | "code";
  tasks: Array<{ id: string; title: string; category?: string; difficulty?: string; dueAt?: Date | string | null }>;
}) {
  if (params.tasks.length === 0) return { sent: false, skipped: true };
  const { baseUrl } = smtpConfig();
  const routePrefix = params.taskKind === "code" ? "/code-tasks" : "/tasks";
  const kindLabel = params.taskKind === "code" ? "Bài tập Code" : "Bài tập Vẽ ERD";
  const subject =
    params.tasks.length === 1
      ? `[${kindLabel}] Bạn được giao bài mới: ${params.tasks[0].title}`
      : `[${kindLabel}] Bạn được giao ${params.tasks.length} bài tập mới`;

  const commonDue = params.tasks.find((t) => t.dueAt)?.dueAt ?? null;
  const dueTextBanner = commonDue ? formatVietnamDateTime(commonDue) : "";

  const itemsHtml = params.tasks
    .map((t, index) => {
      const link = `${baseUrl}${routePrefix}/${encodeURIComponent(t.id)}`;
      const itemDue = formatVietnamDateTime(t.dueAt);
      const chips: string[] = [];
      if (t.category) {
        chips.push(
          `<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#e0e7ff;color:#3730a3;font-size:11px;font-weight:700;margin-right:6px;">${escHtml(t.category)}</span>`,
        );
      }
      if (t.difficulty) {
        chips.push(
          `<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#f1f5f9;color:#334155;font-size:11px;font-weight:700;margin-right:6px;">${escHtml(t.difficulty)}</span>`,
        );
      }
      if (itemDue) {
        chips.push(
          `<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;">&#9200; Hạn: ${escHtml(itemDue)}</span>`,
        );
      }
      return `<li style="margin-bottom:10px;padding:12px 14px;border:1px solid #dbeafe;border-left:4px solid #2563eb;border-radius:10px;background:#f8fbff;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="vertical-align:top;">
              <div style="font-size:14px;font-weight:800;color:#0f172a;">${index + 1}. ${escHtml(t.title)}</div>
              ${chips.length ? `<div style="margin-top:6px;">${chips.join("")}</div>` : ""}
            </td>
            <td align="right" style="vertical-align:middle;white-space:nowrap;padding-left:10px;">
              <a href="${escHtml(link)}" style="display:inline-block;padding:6px 12px;border-radius:8px;background:#ffffff;border:1px solid #93c5fd;color:#1d4ed8;font-size:12px;font-weight:700;text-decoration:none;">Làm bài &rarr;</a>
            </td>
          </tr>
        </table>
      </li>`;
    })
    .join("");

  const listUrl = `${baseUrl}${routePrefix}`;
  const bodyHtml = `
    <p style="margin-top:0;">Xin chào <strong style="color:#0f172a;">${escHtml(params.toName)}</strong>,</p>
    <p><strong>${escHtml(params.assignerName)}</strong> (<span style="color:#2563eb;">${escHtml(params.assignerEmail)}</span>) vừa giao cho bạn <strong>${params.tasks.length}</strong> ${kindLabel.toLowerCase()}.</p>
    ${
      dueTextBanner
        ? `<div style="margin:14px 0;padding:11px 14px;border-radius:10px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;font-size:13px;">
            <strong>&#9200; Hạn nộp bài:</strong> ${escHtml(dueTextBanner)} <span style="opacity:0.85;">(Giờ Việt Nam)</span>
          </div>`
        : ""
    }
    <ul style="list-style:none;padding:0;margin:16px 0;">${itemsHtml}</ul>
    <p style="margin:22px 0 6px;text-align:center;">
      <a href="${escHtml(listUrl)}" style="display:inline-block;padding:11px 24px;border-radius:10px;background:${THEMES.blue.btnBg};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;">Mở danh sách bài tập &rarr;</a>
    </p>
  `;

  const textList = params.tasks
    .map((t, i) => {
      const due = formatVietnamDateTime(t.dueAt);
      return `${i + 1}. ${t.title}${due ? ` (Hạn: ${due})` : ""} -> ${baseUrl}${routePrefix}/${t.id}`;
    })
    .join("\n");
  const text = `Xin chào ${params.toName},\n${params.assignerName} (${params.assignerEmail}) vừa giao cho bạn ${params.tasks.length} ${kindLabel}:\n${textList}\n\nXem tất cả tại: ${listUrl}`;

  return sendEmailSafe({
    to: params.toEmail,
    subject,
    html: wrapEmailLayout(
      params.tasks.length === 1 ? params.tasks[0].title : `Bạn có ${params.tasks.length} ${kindLabel.toLowerCase()} mới`,
      `${kindLabel.toUpperCase()} ĐƯỢC GIAO`,
      bodyHtml,
      "blue",
      `Người giao: ${params.assignerName}`,
    ),
    text,
  });
}

export async function sendDueDateUpdatedEmail(params: {
  toEmail: string;
  toName: string;
  updaterName: string;
  taskKind: "erd" | "code";
  taskId: string;
  title: string;
  dueAt: Date | string | null;
}) {
  const { baseUrl } = smtpConfig();
  const routePrefix = params.taskKind === "code" ? "/code-tasks" : "/tasks";
  const taskUrl = `${baseUrl}${routePrefix}/${encodeURIComponent(params.taskId)}`;
  const dueText = params.dueAt ? formatVietnamDateTime(params.dueAt) : "Không giới hạn thời gian";
  const subject = `[Cập nhật hạn nộp] ${params.title}`;
  const bodyHtml = `
    <p style="margin-top:0;">Xin chào <strong style="color:#0f172a;">${escHtml(params.toName)}</strong>,</p>
    <p><strong>${escHtml(params.updaterName)}</strong> vừa điều chỉnh thời hạn làm bài cho <strong>${escHtml(params.title)}</strong>:</p>
    <div style="margin:14px 0;padding:14px 16px;border-radius:12px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;">&#128197; Hạn nộp mới</div>
      <div style="font-size:17px;font-weight:800;margin-top:4px;">${escHtml(dueText)}</div>
    </div>
    <p style="margin:20px 0 6px;text-align:center;">
      <a href="${escHtml(taskUrl)}" style="display:inline-block;padding:11px 22px;border-radius:10px;background:${THEMES.amber.btnBg};color:#ffffff;text-decoration:none;font-weight:700;">Xem chi tiết bài tập &rarr;</a>
    </p>
  `;
  const text = `Xin chào ${params.toName},\n${params.updaterName} vừa cập nhật hạn nộp bài "${params.title}" thành: ${dueText}.\nXem tại: ${taskUrl}`;
  return sendEmailSafe({
    to: params.toEmail,
    subject,
    html: wrapEmailLayout(`Cập nhật hạn nộp: ${params.title}`, "THAY ĐỔI HẠN NỘP", bodyHtml, "amber"),
    text,
  });
}

export async function sendTaskGradedEmail(params: {
  toEmail: string;
  toName: string;
  graderName: string;
  taskKind: "erd" | "code";
  taskId: string;
  title: string;
  score: number;
  feedback?: string;
}) {
  const { baseUrl } = smtpConfig();
  const routePrefix = params.taskKind === "code" ? "/code-tasks" : "/tasks";
  const kindLabel = params.taskKind === "code" ? "Bài tập Code" : "Bài tập Vẽ ERD";
  const taskUrl = `${baseUrl}${routePrefix}/${encodeURIComponent(params.taskId)}`;
  const subject = `[Kết quả chấm điểm] ${params.title}: ${params.score}/10 điểm`;

  const bodyHtml = `
    <p style="margin-top:0;">Xin chào <strong style="color:#0f172a;">${escHtml(params.toName)}</strong>,</p>
    <p><strong>${escHtml(params.graderName)}</strong> vừa chấm điểm bài làm của bạn cho ${kindLabel.toLowerCase()} <strong>${escHtml(params.title)}</strong>:</p>
    <div style="margin:16px 0;padding:18px 20px;border-radius:12px;background:#ecfdf5;border:1px solid #a7f3d0;text-align:center;">
      <div style="font-size:12px;font-weight:800;letter-spacing:0.8px;color:#065f46;text-transform:uppercase;">ĐIỂM ĐÁNH GIÁ</div>
      <div style="font-size:30px;font-weight:900;color:#047857;margin-top:4px;">${escHtml(params.score)} <span style="font-size:16px;font-weight:700;color:#059669;">/ 10 điểm</span></div>
      ${
        params.feedback
          ? `<div style="margin-top:12px;padding-top:12px;border-top:1px dashed #6ee7b7;text-align:left;color:#064e3b;font-size:13.5px;"><strong>&#128172; Nhận xét:</strong> ${escHtml(params.feedback)}</div>`
          : ""
      }
    </div>
    <p style="margin:20px 0 6px;text-align:center;">
      <a href="${escHtml(taskUrl)}" style="display:inline-block;padding:11px 24px;border-radius:10px;background:${THEMES.emerald.btnBg};color:#ffffff;text-decoration:none;font-weight:700;">Xem chi tiết kết quả &rarr;</a>
    </p>
  `;
  const text = `Xin chào ${params.toName},\n${params.graderName} vừa chấm điểm bài "${params.title}": ${params.score}/10 điểm.${params.feedback ? `\nNhận xét: ${params.feedback}` : ""}\nXem chi tiết: ${taskUrl}`;

  return sendEmailSafe({
    to: params.toEmail,
    subject,
    html: wrapEmailLayout(
      `Kết quả: ${params.title}`,
      "ĐÃ CHẤM ĐIỂM",
      bodyHtml,
      "emerald",
      `Giảng viên đánh giá: ${params.graderName}`,
    ),
    text,
  });
}

export async function sendCodePassedNotificationEmails(params: {
  studentEmail: string;
  studentName: string;
  teacherEmail: string;
  teacherName: string;
  taskId: string;
  title: string;
  percentage: number;
  passedCount: number;
  totalCount: number;
  earnedPoints: number;
  totalPoints: number;
  runCount: number;
}) {
  const { baseUrl } = smtpConfig();
  const taskUrl = `${baseUrl}/code-tasks/${encodeURIComponent(params.taskId)}`;
  const results: MailSendResult[] = [];

  if (params.studentEmail) {
    const bodyHtml = `
      <p style="margin-top:0;">Xin chào <strong style="color:#0f172a;">${escHtml(params.studentName)}</strong>,</p>
      <p>Chúc mừng bạn đã hoàn thành đạt yêu cầu (<strong>PASS</strong>) bài tập <strong>${escHtml(params.title)}</strong> ở lần chạy thử #${escHtml(params.runCount)}!</p>
      <div style="margin:16px 0;padding:16px 18px;border-radius:12px;background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;">
        <div style="font-size:18px;font-weight:800;color:#047857;">&#9989; PASS · ${escHtml(params.earnedPoints)}/${escHtml(params.totalPoints)} điểm (${escHtml(params.percentage)}%)</div>
        <div style="margin-top:6px;font-size:13px;">Số tiêu chí đạt: <strong>${escHtml(params.passedCount)}/${escHtml(params.totalCount)}</strong></div>
      </div>
      <p style="text-align:center;margin:20px 0 6px;"><a href="${escHtml(taskUrl)}" style="display:inline-block;padding:11px 24px;border-radius:10px;background:${THEMES.emerald.btnBg};color:#ffffff;text-decoration:none;font-weight:700;">Xem lại bài làm &rarr;</a></p>
    `;
    results.push(
      await sendEmailSafe({
        to: params.studentEmail,
        subject: `[PASS ${params.percentage}%] Hoàn thành bài ${params.title}`,
        html: wrapEmailLayout(params.title, "HOÀN THÀNH BÀI CODE · PASS", bodyHtml, "emerald"),
        text: `Chúc mừng ${params.studentName}! Bạn đã đạt PASS (${params.percentage}%, ${params.passedCount}/${params.totalCount} tiêu chí) cho bài "${params.title}". Xem tại: ${taskUrl}`,
      }),
    );
  }

  if (params.teacherEmail && params.teacherEmail.toLowerCase() !== params.studentEmail.toLowerCase()) {
    const bodyHtml = `
      <p style="margin-top:0;">Xin chào <strong style="color:#0f172a;">${escHtml(params.teacherName)}</strong>,</p>
      <p>Học viên <strong>${escHtml(params.studentName)}</strong> (${escHtml(params.studentEmail)}) vừa đạt <strong>PASS</strong> bài tập <strong>${escHtml(params.title)}</strong>:</p>
      <div style="margin:16px 0;padding:16px 18px;border-radius:12px;background:#eff6ff;border:1px solid #bfdbfe;">
        <div style="font-weight:800;color:#1d4ed8;">Kết quả lần Run #${escHtml(params.runCount)}: ${escHtml(params.earnedPoints)}/${escHtml(params.totalPoints)} điểm (${escHtml(params.percentage)}%)</div>
        <div style="margin-top:6px;font-size:13px;color:#334155;">Tiêu chí đạt: <strong>${escHtml(params.passedCount)}/${escHtml(params.totalCount)}</strong></div>
      </div>
      <p style="text-align:center;margin:20px 0 6px;"><a href="${escHtml(taskUrl)}" style="display:inline-block;padding:11px 24px;border-radius:10px;background:${THEMES.blue.btnBg};color:#ffffff;text-decoration:none;font-weight:700;">Xem bài làm &amp; chấm điểm &rarr;</a></p>
    `;
    results.push(
      await sendEmailSafe({
        to: params.teacherEmail,
        subject: `[Học viên PASS] ${params.studentName} - ${params.title} (${params.percentage}%)`,
        html: wrapEmailLayout(`Học viên PASS: ${params.title}`, "BÁO CÁO TIẾN ĐỘ", bodyHtml, "blue"),
        text: `Học viên ${params.studentName} (${params.studentEmail}) vừa đạt PASS (${params.percentage}%) bài "${params.title}". Xem tại: ${taskUrl}`,
      }),
    );
  }

  return results;
}

export async function sendDeadlineWarningDigestEmail(params: {
  toEmail: string;
  toName: string;
  tasks: Array<{
    id: string;
    taskKind: "erd" | "code";
    title: string;
    dueAt: Date | string;
    assignerName: string;
  }>;
}) {
  if (params.tasks.length === 0) return { sent: false, skipped: true };
  const { baseUrl } = smtpConfig();
  const subject =
    params.tasks.length === 1
      ? `[Nhắc hạn nộp] Bài tập "${params.tasks[0].title}" sắp hết hạn`
      : `[Nhắc hạn nộp] Bạn có ${params.tasks.length} bài tập sắp hết hạn`;

  const listHtml = params.tasks
    .map((t, idx) => {
      const prefix = t.taskKind === "code" ? "/code-tasks" : "/tasks";
      const kindBadge = t.taskKind === "code" ? "💻 Code" : "📝 ERD";
      const dueStr = formatVietnamDateTime(t.dueAt);
      const url = `${baseUrl}${prefix}/${encodeURIComponent(t.id)}`;
      return `<li style="margin-bottom:10px;padding:12px 14px;border:1px solid #fde68a;border-left:4px solid #d97706;border-radius:10px;background:#fffdf5;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td>
              <div style="font-size:14px;font-weight:800;color:#0f172a;">${idx + 1}. ${escHtml(t.title)}</div>
              <div style="margin-top:6px;">
                <span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;margin-right:6px;">${kindBadge}</span>
                <span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#fee2e2;color:#b91c1c;font-size:11px;font-weight:700;">&#9200; Hạn: ${escHtml(dueStr)}</span>
              </div>
              <div style="margin-top:4px;font-size:12px;color:#64748b;">Người giao: ${escHtml(t.assignerName)}</div>
            </td>
            <td align="right" style="vertical-align:middle;white-space:nowrap;padding-left:10px;">
              <a href="${escHtml(url)}" style="display:inline-block;padding:7px 12px;border-radius:8px;background:#d97706;color:#ffffff;font-size:12px;font-weight:700;text-decoration:none;">Nộp ngay &rarr;</a>
            </td>
          </tr>
        </table>
      </li>`;
    })
    .join("");

  const bodyHtml = `
    <p style="margin-top:0;">Xin chào <strong style="color:#0f172a;">${escHtml(params.toName)}</strong>,</p>
    <div style="margin:12px 0 16px;padding:13px 16px;border-radius:12px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;">
      <strong>&#9888;&#65039; Nhắc nhở sắp hết hạn:</strong> Bạn hiện còn <strong>${params.tasks.length}</strong> bài tập chưa hoàn thành và sắp đến hạn nộp. Hãy tranh thủ hoàn thành sớm để tránh trễ hạn nhé!
    </div>
    <ul style="list-style:none;padding:0;margin:0 0 18px;">${listHtml}</ul>
  `;
  const textList = params.tasks
    .map((t, i) => {
      const prefix = t.taskKind === "code" ? "/code-tasks" : "/tasks";
      return `${i + 1}. ${t.title} (Hạn: ${formatVietnamDateTime(t.dueAt)}) -> ${baseUrl}${prefix}/${t.id}`;
    })
    .join("\n");
  const text = `Xin chào ${params.toName},\nBạn có ${params.tasks.length} bài tập chưa hoàn thành sắp đến hạn:\n${textList}`;

  return sendEmailSafe({
    to: params.toEmail,
    subject,
    html: wrapEmailLayout(
      params.tasks.length === 1 ? `Sắp hết hạn: ${params.tasks[0].title}` : `${params.tasks.length} bài tập sắp hết hạn nộp`,
      "CẢNH BÁO HẠN NỘP BÀI (21:30)",
      bodyHtml,
      "amber",
      "Tổng hợp tất cả bài tập chưa hoàn thành sắp tới hạn",
    ),
    text,
  });
}

export async function sendDailyInstructorSummaryEmail(params: {
  toEmail: string;
  toName: string;
  dateLabel: string;
  totalActions: number;
  totalPassedOrSubmitted: number;
  pendingTotal: number;
  students: Array<{
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
  }>;
}) {
  const { baseUrl } = smtpConfig();
  const subject = `[Tổng hợp cuối ngày ${params.dateLabel}] ${params.students.length} học viên đã làm bài (${params.totalActions} lượt)`;

  const badgeColors = {
    green: { bg: "#dcfce7", text: "#166534" },
    blue: { bg: "#dbeafe", text: "#1e40af" },
    amber: { bg: "#fef3c7", text: "#92400e" },
  };

  const studentsHtml = params.students.length
    ? params.students
        .map((st) => {
          const itemsRows = st.items
            .map((it) => {
              const prefix = it.taskKind === "code" ? "/code-tasks" : "/tasks";
              const link = `${baseUrl}${prefix}/${encodeURIComponent(it.taskId)}`;
              const col = badgeColors[it.statusColor];
              return `<div style="padding:9px 11px;margin-top:8px;border-radius:8px;background:#ffffff;border:1px solid #e2e8f0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td>
                      <a href="${escHtml(link)}" style="font-weight:700;color:#1e293b;text-decoration:none;">${it.taskKind === "code" ? "💻" : "📝"} ${escHtml(it.title)}</a>
                      <div style="font-size:12px;color:#64748b;margin-top:2px;">${escHtml(it.detailText)}</div>
                    </td>
                    <td align="right" style="vertical-align:top;white-space:nowrap;padding-left:8px;">
                      <span style="display:inline-block;padding:3px 9px;border-radius:999px;background:${col.bg};color:${col.text};font-size:11px;font-weight:800;">${escHtml(it.statusBadge)}</span>
                    </td>
                  </tr>
                </table>
              </div>`;
            })
            .join("");

          return `<div style="margin-bottom:14px;padding:14px 16px;border-radius:12px;background:#f8fafc;border:1px solid #cbd5e1;border-left:4px solid #4f46e5;">
            <div style="font-size:14px;font-weight:800;color:#0f172a;">&#128100; ${escHtml(st.studentName)} <span style="font-weight:500;color:#64748b;font-size:12px;">(${escHtml(st.studentEmail)})</span></div>
            ${itemsRows}
          </div>`;
        })
        .join("")
    : `<div style="padding:16px;border-radius:12px;background:#f8fafc;border:1px dashed #cbd5e1;color:#64748b;text-align:center;">
        Hôm nay chưa ghi nhận lượt làm/nộp bài mới nào từ học viên.
      </div>`;

  const bodyHtml = `
    <p style="margin-top:0;">Xin chào <strong style="color:#0f172a;">${escHtml(params.toName)}</strong>,</p>
    <p>Dưới đây là báo cáo tổng hợp hoạt động làm bài của các học viên trong ngày <strong>${escHtml(params.dateLabel)}</strong>:</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:14px 0 18px;">
      <tr>
        <td width="32%" style="padding:12px;border-radius:10px;background:#eef2ff;border:1px solid #c7d2fe;text-align:center;">
          <div style="font-size:22px;font-weight:900;color:#4338ca;">${params.students.length}</div>
          <div style="font-size:11px;font-weight:700;color:#4f46e5;margin-top:2px;">Học viên hoạt động</div>
        </td>
        <td width="2%">&nbsp;</td>
        <td width="32%" style="padding:12px;border-radius:10px;background:#ecfdf5;border:1px solid #a7f3d0;text-align:center;">
          <div style="font-size:22px;font-weight:900;color:#047857;">${params.totalPassedOrSubmitted}</div>
          <div style="font-size:11px;font-weight:700;color:#059669;margin-top:2px;">Bài Pass / Đã nộp</div>
        </td>
        <td width="2%">&nbsp;</td>
        <td width="32%" style="padding:12px;border-radius:10px;background:#fffbeb;border:1px solid #fde68a;text-align:center;">
          <div style="font-size:22px;font-weight:900;color:#b45309;">${params.pendingTotal}</div>
          <div style="font-size:11px;font-weight:700;color:#d97706;margin-top:2px;">Bài chưa xong</div>
        </td>
      </tr>
    </table>
    ${studentsHtml}
    <p style="margin:20px 0 6px;text-align:center;">
      <a href="${escHtml(baseUrl)}/code-tasks" style="display:inline-block;padding:11px 24px;border-radius:10px;background:${THEMES.violet.btnBg};color:#ffffff;text-decoration:none;font-weight:700;">Mở bảng quản lý kết quả &rarr;</a>
    </p>
  `;

  const textStudents = params.students
    .map(
      (s) =>
        `- ${s.studentName} (${s.studentEmail}):\n` +
        s.items.map((it) => `  * [${it.statusBadge}] ${it.title} — ${it.detailText}`).join("\n"),
    )
    .join("\n");
  const text = `Tổng hợp cuối ngày ${params.dateLabel} cho ${params.toName}:\n${textStudents || "Chưa có hoạt động mới trong ngày."}`;

  return sendEmailSafe({
    to: params.toEmail,
    subject,
    html: wrapEmailLayout(
      `Tổng hợp cuối ngày ${params.dateLabel}`,
      "BÁO CÁO CUỐI NGÀY",
      bodyHtml,
      "violet",
      "Thống kê học viên đã làm và nộp bài trong ngày",
    ),
    text,
  });
}
