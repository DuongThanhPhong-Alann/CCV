export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const ACTIVITY_STORAGE_KEY = "ccv_last_activity_at";
export const LOGOUT_BROADCAST_KEY = "ccv_logout_broadcast";
const POST_LOGIN_ANIM_KEY = "ccv_post_login_anim_at";
const POST_LOGIN_NAME_KEY = "ccv_post_login_name";
const KNOWN_NAMES_KEY = "ccv_known_account_names";

export function readLastActivityAt(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACTIVITY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function markSessionActive(timestamp = Date.now()) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVITY_STORAGE_KEY, String(timestamp));
  } catch {
    // ignore storage errors
  }
}

export function clearSessionActivity() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ACTIVITY_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

export function broadcastIdleLogout() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOGOUT_BROADCAST_KEY, String(Date.now()));
  } catch {
    // ignore storage errors
  }
}

export function markPostLoginTransition(displayName?: string | null) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(POST_LOGIN_ANIM_KEY, String(Date.now()));
    if (displayName && displayName.trim()) {
      window.sessionStorage.setItem(POST_LOGIN_NAME_KEY, displayName.trim());
    } else {
      window.sessionStorage.removeItem(POST_LOGIN_NAME_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export function readPostLoginDisplayName(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(POST_LOGIN_NAME_KEY);
    return raw && raw.trim() ? raw.trim() : null;
  } catch {
    return null;
  }
}

export function hasRecentPostLoginTransition(maxAgeMs = 15_000): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(POST_LOGIN_ANIM_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts <= maxAgeMs;
  } catch {
    return false;
  }
}

export function clearPostLoginTransition() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(POST_LOGIN_ANIM_KEY);
    window.sessionStorage.removeItem(POST_LOGIN_NAME_KEY);
  } catch {
    // ignore storage errors
  }
}

export function cacheAccountName(email?: string | null, name?: string | null) {
  if (typeof window === "undefined") return;
  const cleanEmail = email?.trim().toLowerCase();
  const cleanName = name?.trim();
  if (!cleanEmail || !cleanName) return;
  try {
    const raw = window.localStorage.getItem(KNOWN_NAMES_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[cleanEmail] = cleanName;
    const entries = Object.entries(map).slice(-30);
    window.localStorage.setItem(KNOWN_NAMES_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // ignore storage errors
  }
}

export function getCachedAccountName(email?: string | null): string | null {
  if (typeof window === "undefined") return null;
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail) return null;
  try {
    const raw = window.localStorage.getItem(KNOWN_NAMES_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    const found = map[cleanEmail];
    return typeof found === "string" && found.trim() ? found.trim() : null;
  } catch {
    return null;
  }
}
