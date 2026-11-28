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

const MAIL_NAVY = "#000241";
const MAIL_FONT_PLAYFUL = "'Comic Sans MS','Chalkboard SE','Trebuchet MS','Segoe UI',Arial,sans-serif";
const MAIL_FONT_BODY = "'Trebuchet MS','Segoe UI',Arial,Helvetica,sans-serif";

const THEMES: Record<
  MailTheme,
  {
    headerBg: string;
    accent: string;
    softBg: string;
    badgeBg: string;
    badgeText: string;
    btnBg: string;
    btnText: string;
  }
> = {
  blue: {
    headerBg: "linear-gradient(180deg,#dbeafe 0%,#eff6ff 100%)",
    accent: "#2563eb",
    softBg: "#eff6ff",
    badgeBg: "#2563eb",
    badgeText: "#ffffff",
    btnBg: "#2563eb",
    btnText: "#ffffff",
  },
  amber: {
    headerBg: "linear-gradient(180deg,#dbeafe 0%,#eff6ff 100%)",
    accent: "#1d4ed8",
    softBg: "#eff6ff",
    badgeBg: "#1d4ed8",
    badgeText: "#ffffff",
    btnBg: "#2563eb",
    btnText: "#ffffff",
  },
  violet: {
    headerBg: "linear-gradient(180deg,#dbeafe 0%,#eff6ff 100%)",
    accent: "#1d4ed8",
    softBg: "#eff6ff",
    badgeBg: "#1e40af",
    badgeText: "#ffffff",
    btnBg: "#2563eb",
    btnText: "#ffffff",
  },
  emerald: {
    headerBg: "linear-gradient(180deg,#dbeafe 0%,#eff6ff 100%)",
    accent: "#2563eb",
    softBg: "#eff6ff",
    badgeBg: "#2563eb",
    badgeText: "#ffffff",
    btnBg: "#2563eb",
    btnText: "#ffffff",
  },
};

const MAIL_DOUBLE_BOX = `border:4px double ${MAIL_NAVY};border-radius:12px;background:#ffffff;box-shadow:2px 3px 0 ${MAIL_NAVY};`;
const MAIL_DOUBLE_BOX_BLUE = `border:4px double ${MAIL_NAVY};border-radius:12px;background:#eff6ff;box-shadow:2px 3px 0 ${MAIL_NAVY};`;

function mailPrimaryButton(href: string, label: string) {
  return `<a href="${escHtml(href)}" style="display:inline-block;padding:11px 24px;border-radius:10px;border:2px solid ${MAIL_NAVY};background-color:#2563eb;color:#ffffff;text-decoration:none;font-family:${MAIL_FONT_PLAYFUL};font-weight:700;font-size:15px;box-shadow:2px 3px 0 ${MAIL_NAVY};">${label}</a>`;
}

function mailMiniButton(href: string, label: string, filled = false) {
  const bg = filled ? "#2563eb" : "#ffffff";
  const fg = filled ? "#ffffff" : "#1d4ed8";
  return `<a href="${escHtml(href)}" style="display:inline-block;padding:7px 13px;border-radius:10px;border:2px solid ${MAIL_NAVY};background-color:${bg};color:${fg};font-family:${MAIL_FONT_PLAYFUL};font-size:12px;font-weight:700;text-decoration:none;box-shadow:2px 3px 0 ${MAIL_NAVY};">${label}</a>`;
}

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
<body style="margin:0;padding:0;background-color:#dbeafe;background-image:radial-gradient(#93c5fd 1.2px, transparent 1.2px);background-size:18px 18px;font-family:${MAIL_FONT_BODY};color:${MAIL_NAVY};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:32px 14px;">
    <tr>
      <td align="center">
        <!-- Main vishal2231179 inspired card (White & Blue dominant) -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background-color:#ffffff;border:2.5px solid ${MAIL_NAVY};border-radius:20px;overflow:hidden;box-shadow:5px 5px 0 ${MAIL_NAVY};">
          <!-- Top Blue Ribbon -->
          <tr>
            <td style="height:8px;background:linear-gradient(90deg,#1d4ed8 0%,#2563eb 50%,#60a5fa 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <!-- Centered Playful Header -->
          <tr>
            <td align="center" style="background:${t.headerBg};padding:26px 28px 22px;border-bottom:4px double ${MAIL_NAVY};">
              <div style="margin-bottom:12px;">
                <span style="display:inline-block;padding:5px 14px;border-radius:10px;background-color:${t.badgeBg};border:2px solid ${MAIL_NAVY};box-shadow:2px 3px 0 ${MAIL_NAVY};color:${t.badgeText};font-family:${MAIL_FONT_PLAYFUL};font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;">
                  &#10022; ${escHtml(badge)} &#10022;
                </span>
              </div>
              <h1 style="margin:0;font-family:${MAIL_FONT_PLAYFUL};font-size:24px;line-height:1.35;font-weight:700;color:${MAIL_NAVY};text-align:center;">
                ${escHtml(title)}
              </h1>
              ${
                subtitle
                  ? `<p style="margin:8px 0 0;font-family:${MAIL_FONT_BODY};font-size:13.5px;line-height:1.5;font-weight:600;color:#1d4ed8;text-align:center;">${escHtml(subtitle)}</p>`
                  : ""
              }
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding:26px 28px 22px;background-color:#ffffff;font-family:${MAIL_FONT_BODY};font-size:14.5px;line-height:1.68;color:#0f172a;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 28px 22px;background-color:#eff6ff;border-top:4px double ${MAIL_NAVY};text-align:center;font-family:${MAIL_FONT_BODY};font-size:12px;line-height:1.6;color:#1e3a8a;">
              <div style="font-family:${MAIL_FONT_PLAYFUL};font-size:13px;font-weight:700;color:${MAIL_NAVY};margin-bottom:2px;">
                ERD Draw &amp; Code Practice Studio
              </div>
              <span style="color:#3b5998;">Thông báo tự động · Hệ thống thực hành Thiết kế Cơ sở dữ liệu &amp; Lập trình Web</span>
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
    <p style="margin-top:0;">Xin chào <strong style="color:${MAIL_NAVY};">${escHtml(params.toName)}</strong>,</p>
    <p>Tài khoản của bạn với email <strong style="color:#1d4ed8;">${escHtml(params.toEmail)}</strong> đã sẵn sàng trên hệ thống thực hành vẽ sơ đồ ERD &amp; lập trình Web.</p>
    <div style="margin:18px 0;padding:15px 18px;${MAIL_DOUBLE_BOX_BLUE}">
      <div style="font-family:${MAIL_FONT_PLAYFUL};font-weight:700;font-size:15px;color:#1d4ed8;margin-bottom:5px;">&#128640; Bắt đầu ngay hôm nay</div>
      <div style="font-size:13.5px;color:#1e293b;">Nhận bài tập từ giảng viên, viết code trực tiếp trên web, chạy kiểm thử tự động và theo dõi tiến độ từng ngày.</div>
    </div>
    <p style="margin:24px 0 6px;text-align:center;">
      ${mailPrimaryButton(`${baseUrl}/login`, "Đăng nhập vào hệ thống &rarr;")}
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
          `<span style="display:inline-block;padding:2px 9px;border-radius:8px;background:#dbeafe;border:1.5px solid ${MAIL_NAVY};color:#1e3a8a;font-size:11px;font-weight:700;margin-right:6px;">${escHtml(t.category)}</span>`,
        );
      }
      if (t.difficulty) {
        chips.push(
          `<span style="display:inline-block;padding:2px 9px;border-radius:8px;background:#ffffff;border:1.5px solid ${MAIL_NAVY};color:${MAIL_NAVY};font-size:11px;font-weight:700;margin-right:6px;">${escHtml(t.difficulty)}</span>`,
        );
      }
      if (itemDue) {
        chips.push(
          `<span style="display:inline-block;padding:2px 9px;border-radius:8px;background:#eff6ff;border:1.5px solid #2563eb;color:#1d4ed8;font-size:11px;font-weight:700;">&#9200; Hạn: ${escHtml(itemDue)}</span>`,
        );
      }
      return `<li style="margin-bottom:12px;padding:13px 15px;${MAIL_DOUBLE_BOX}">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="vertical-align:top;">
              <div style="font-family:${MAIL_FONT_PLAYFUL};font-size:14.5px;font-weight:700;color:${MAIL_NAVY};">${index + 1}. ${escHtml(t.title)}</div>
              ${chips.length ? `<div style="margin-top:7px;">${chips.join("")}</div>` : ""}
            </td>
            <td align="right" style="vertical-align:middle;white-space:nowrap;padding-left:10px;">
              ${mailMiniButton(link, "Làm bài &rarr;")}
            </td>
          </tr>
        </table>
      </li>`;
    })
    .join("");

  const listUrl = `${baseUrl}${routePrefix}`;
  const bodyHtml = `
    <p style="margin-top:0;">Xin chào <strong style="color:${MAIL_NAVY};">${escHtml(params.toName)}</strong>,</p>
    <p><strong style="color:${MAIL_NAVY};">${escHtml(params.assignerName)}</strong> (<span style="color:#2563eb;font-weight:600;">${escHtml(params.assignerEmail)}</span>) vừa giao cho bạn <strong style="color:#1d4ed8;">${params.tasks.length}</strong> ${kindLabel.toLowerCase()}.</p>
    ${
      dueTextBanner
        ? `<div style="margin:15px 0;padding:12px 15px;${MAIL_DOUBLE_BOX_BLUE}color:${MAIL_NAVY};font-size:13.5px;">
            <strong style="color:#1d4ed8;">&#9200; Hạn nộp bài:</strong> <strong>${escHtml(dueTextBanner)}</strong> <span style="color:#3b5998;">(Giờ Việt Nam)</span>
          </div>`
        : ""
    }
    <ul style="list-style:none;padding:0;margin:16px 0;">${itemsHtml}</ul>
    <p style="margin:24px 0 6px;text-align:center;">
      ${mailPrimaryButton(listUrl, "Mở danh sách bài tập &rarr;")}
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
    <p style="margin-top:0;">Xin chào <strong style="color:${MAIL_NAVY};">${escHtml(params.toName)}</strong>,</p>
    <p><strong>${escHtml(params.updaterName)}</strong> vừa điều chỉnh thời hạn làm bài cho <strong style="color:#1d4ed8;">${escHtml(params.title)}</strong>:</p>
    <div style="margin:16px 0;padding:16px 18px;${MAIL_DOUBLE_BOX_BLUE}text-align:center;">
      <div style="font-family:${MAIL_FONT_PLAYFUL};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#1d4ed8;">&#128197; Hạn nộp mới</div>
      <div style="font-family:${MAIL_FONT_PLAYFUL};font-size:19px;font-weight:700;color:${MAIL_NAVY};margin-top:5px;">${escHtml(dueText)}</div>
    </div>
    <p style="margin:22px 0 6px;text-align:center;">
      ${mailPrimaryButton(taskUrl, "Xem chi tiết bài tập &rarr;")}
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
    <p style="margin-top:0;">Xin chào <strong style="color:${MAIL_NAVY};">${escHtml(params.toName)}</strong>,</p>
    <p><strong>${escHtml(params.graderName)}</strong> vừa chấm điểm bài làm của bạn cho ${kindLabel.toLowerCase()} <strong style="color:#1d4ed8;">${escHtml(params.title)}</strong>:</p>
    <div style="margin:18px 0;padding:18px 20px;${MAIL_DOUBLE_BOX_BLUE}text-align:center;">
      <div style="font-family:${MAIL_FONT_PLAYFUL};font-size:12px;font-weight:700;letter-spacing:0.8px;color:#1d4ed8;text-transform:uppercase;">ĐIỂM ĐÁNH GIÁ</div>
      <div style="font-family:${MAIL_FONT_PLAYFUL};font-size:32px;font-weight:700;color:${MAIL_NAVY};margin-top:4px;">${escHtml(params.score)} <span style="font-size:16px;font-weight:700;color:#2563eb;">/ 10 điểm</span></div>
      ${
        params.feedback
          ? `<div style="margin-top:12px;padding-top:12px;border-top:2px dashed #93c5fd;text-align:left;color:#0f172a;font-size:13.5px;"><strong style="color:#1d4ed8;">&#128172; Nhận xét:</strong> ${escHtml(params.feedback)}</div>`
          : ""
      }
    </div>
    <p style="margin:22px 0 6px;text-align:center;">
      ${mailPrimaryButton(taskUrl, "Xem chi tiết kết quả &rarr;")}
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
      <p style="margin-top:0;">Xin chào <strong style="color:${MAIL_NAVY};">${escHtml(params.studentName)}</strong>,</p>
      <p>Chúc mừng bạn đã hoàn thành đạt yêu cầu (<strong style="color:#1d4ed8;">PASS</strong>) bài tập <strong>${escHtml(params.title)}</strong> ở lần chạy thử #${escHtml(params.runCount)}!</p>
      <div style="margin:18px 0;padding:16px 18px;${MAIL_DOUBLE_BOX_BLUE}">
        <div style="font-family:${MAIL_FONT_PLAYFUL};font-size:18px;font-weight:700;color:#1d4ed8;">&#9989; PASS · ${escHtml(params.earnedPoints)}/${escHtml(params.totalPoints)} điểm (${escHtml(params.percentage)}%)</div>
        <div style="margin-top:6px;font-size:13.5px;color:${MAIL_NAVY};">Số tiêu chí đạt: <strong>${escHtml(params.passedCount)}/${escHtml(params.totalCount)}</strong></div>
      </div>
      <p style="text-align:center;margin:22px 0 6px;">${mailPrimaryButton(taskUrl, "Xem lại bài làm &rarr;")}</p>
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
      <p style="margin-top:0;">Xin chào <strong style="color:${MAIL_NAVY};">${escHtml(params.teacherName)}</strong>,</p>
      <p>Học viên <strong>${escHtml(params.studentName)}</strong> (<span style="color:#2563eb;">${escHtml(params.studentEmail)}</span>) vừa đạt <strong style="color:#1d4ed8;">PASS</strong> bài tập <strong>${escHtml(params.title)}</strong>:</p>
      <div style="margin:18px 0;padding:16px 18px;${MAIL_DOUBLE_BOX_BLUE}">
        <div style="font-family:${MAIL_FONT_PLAYFUL};font-weight:700;font-size:16px;color:#1d4ed8;">Kết quả lần Run #${escHtml(params.runCount)}: ${escHtml(params.earnedPoints)}/${escHtml(params.totalPoints)} điểm (${escHtml(params.percentage)}%)</div>
        <div style="margin-top:6px;font-size:13.5px;color:${MAIL_NAVY};">Tiêu chí đạt: <strong>${escHtml(params.passedCount)}/${escHtml(params.totalCount)}</strong></div>
      </div>
      <p style="text-align:center;margin:22px 0 6px;">${mailPrimaryButton(taskUrl, "Xem bài làm &amp; chấm điểm &rarr;")}</p>
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
      return `<li style="margin-bottom:12px;padding:13px 15px;${MAIL_DOUBLE_BOX}">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td>
              <div style="font-family:${MAIL_FONT_PLAYFUL};font-size:14.5px;font-weight:700;color:${MAIL_NAVY};">${idx + 1}. ${escHtml(t.title)}</div>
              <div style="margin-top:7px;">
                <span style="display:inline-block;padding:2px 9px;border-radius:8px;background:#dbeafe;border:1.5px solid ${MAIL_NAVY};color:#1e3a8a;font-size:11px;font-weight:700;margin-right:6px;">${kindBadge}</span>
                <span style="display:inline-block;padding:2px 9px;border-radius:8px;background:#ffffff;border:1.5px solid #2563eb;color:#1d4ed8;font-size:11px;font-weight:700;">&#9200; Hạn: ${escHtml(dueStr)}</span>
              </div>
              <div style="margin-top:5px;font-size:12px;color:#3b5998;">Người giao: ${escHtml(t.assignerName)}</div>
            </td>
            <td align="right" style="vertical-align:middle;white-space:nowrap;padding-left:10px;">
              ${mailMiniButton(url, "Nộp ngay &rarr;", true)}
            </td>
          </tr>
        </table>
      </li>`;
    })
    .join("");

  const bodyHtml = `
    <p style="margin-top:0;">Xin chào <strong style="color:${MAIL_NAVY};">${escHtml(params.toName)}</strong>,</p>
    <div style="margin:14px 0 18px;padding:14px 16px;${MAIL_DOUBLE_BOX_BLUE}color:${MAIL_NAVY};">
      <strong style="color:#1d4ed8;">&#9888;&#65039; Nhắc nhở sắp hết hạn:</strong> Bạn hiện còn <strong style="color:#1d4ed8;">${params.tasks.length}</strong> bài tập chưa hoàn thành và sắp đến hạn nộp. Hãy tranh thủ hoàn thành sớm để tránh trễ hạn nhé!
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
    green: { bg: "#dbeafe", text: "#1e3a8a", border: "#1d4ed8" },
    blue: { bg: "#eff6ff", text: "#1d4ed8", border: "#2563eb" },
    amber: { bg: "#ffffff", text: MAIL_NAVY, border: MAIL_NAVY },
  };

  const studentsHtml = params.students.length
    ? params.students
        .map((st) => {
          const itemsRows = st.items
            .map((it) => {
              const prefix = it.taskKind === "code" ? "/code-tasks" : "/tasks";
              const link = `${baseUrl}${prefix}/${encodeURIComponent(it.taskId)}`;
              const col = badgeColors[it.statusColor];
              return `<div style="padding:9px 12px;margin-top:8px;border-radius:10px;background:#ffffff;border:2px solid ${MAIL_NAVY};">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td>
                      <a href="${escHtml(link)}" style="font-weight:700;color:${MAIL_NAVY};text-decoration:none;">${it.taskKind === "code" ? "💻" : "📝"} ${escHtml(it.title)}</a>
                      <div style="font-size:12px;color:#3b5998;margin-top:2px;">${escHtml(it.detailText)}</div>
                    </td>
                    <td align="right" style="vertical-align:top;white-space:nowrap;padding-left:8px;">
                      <span style="display:inline-block;padding:3px 9px;border-radius:8px;background:${col.bg};border:1.5px solid ${col.border};color:${col.text};font-size:11px;font-weight:700;">${escHtml(it.statusBadge)}</span>
                    </td>
                  </tr>
                </table>
              </div>`;
            })
            .join("");

          return `<div style="margin-bottom:14px;padding:14px 16px;${MAIL_DOUBLE_BOX_BLUE}">
            <div style="font-family:${MAIL_FONT_PLAYFUL};font-size:14.5px;font-weight:700;color:${MAIL_NAVY};">&#128100; ${escHtml(st.studentName)} <span style="font-family:${MAIL_FONT_BODY};font-weight:600;color:#2563eb;font-size:12px;">(${escHtml(st.studentEmail)})</span></div>
            ${itemsRows}
          </div>`;
        })
        .join("")
    : `<div style="padding:16px;${MAIL_DOUBLE_BOX}color:#3b5998;text-align:center;">
        Hôm nay chưa ghi nhận lượt làm/nộp bài mới nào từ học viên.
      </div>`;

  const bodyHtml = `
    <p style="margin-top:0;">Xin chào <strong style="color:${MAIL_NAVY};">${escHtml(params.toName)}</strong>,</p>
    <p>Dưới đây là báo cáo tổng hợp hoạt động làm bài của các học viên trong ngày <strong style="color:#1d4ed8;">${escHtml(params.dateLabel)}</strong>:</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0 20px;">
      <tr>
        <td width="32%" style="padding:12px;${MAIL_DOUBLE_BOX_BLUE}text-align:center;">
          <div style="font-family:${MAIL_FONT_PLAYFUL};font-size:23px;font-weight:700;color:#1d4ed8;">${params.students.length}</div>
          <div style="font-size:11px;font-weight:700;color:${MAIL_NAVY};margin-top:3px;">Học viên hoạt động</div>
        </td>
        <td width="2%">&nbsp;</td>
        <td width="32%" style="padding:12px;${MAIL_DOUBLE_BOX}text-align:center;">
          <div style="font-family:${MAIL_FONT_PLAYFUL};font-size:23px;font-weight:700;color:#2563eb;">${params.totalPassedOrSubmitted}</div>
          <div style="font-size:11px;font-weight:700;color:${MAIL_NAVY};margin-top:3px;">Bài Pass / Đã nộp</div>
        </td>
        <td width="2%">&nbsp;</td>
        <td width="32%" style="padding:12px;${MAIL_DOUBLE_BOX_BLUE}text-align:center;">
          <div style="font-family:${MAIL_FONT_PLAYFUL};font-size:23px;font-weight:700;color:${MAIL_NAVY};">${params.pendingTotal}</div>
          <div style="font-size:11px;font-weight:700;color:#1d4ed8;margin-top:3px;">Bài chưa xong</div>
        </td>
      </tr>
    </table>
    ${studentsHtml}
    <p style="margin:22px 0 6px;text-align:center;">
      ${mailPrimaryButton(`${baseUrl}/code-tasks`, "Mở bảng quản lý kết quả &rarr;")}
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
