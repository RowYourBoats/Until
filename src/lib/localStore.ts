/**
 * Tiny localStorage wrapper for client-side dataset persistence.
 *
 * The app is server-authoritative online (GET on load, POST on every change),
 * but on a phone that is out of range of the PC there is no server. Mirroring
 * each dataset here lets the app launch and stay fully editable offline, and
 * survive reloads — the PC remains the source of truth, reconciled via /api/sync.
 *
 * All calls are SSR/no-window safe and never throw (a full or disabled
 * localStorage must not break a save that already updated React state).
 */

export function loadLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveLocal(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded / private mode — state is still held in memory */
  }
}

export const LS_KEYS = {
  events: "until.events",
  dailyTasks: "until.dailyTasks",
  rhei: "until.rhei",
  pomodoroSessions: "until.pomodoroSessions",
  lastSync: "until.lastSync",
  driveFileId: "until.driveFileId",
} as const;
