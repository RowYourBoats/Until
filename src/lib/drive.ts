/**
 * Google Drive backing store for Until's text data.
 *
 * The whole sync runs in the browser — no server, no client secret. We use the
 * Google Identity Services (GIS) token client for an access token scoped to
 * `drive.file` (the app only ever sees files it created), then read/write a single
 * `until-data.json` holding all four datasets. The PC, MacBook and iPhone all hit
 * the same file, so Drive is the hub and any device can sync from anywhere.
 *
 * Access tokens last ~1h with no refresh token, so we re-request on each sync;
 * always call from a user gesture (the Sync click) so Safari allows the popup.
 */

import { loadLocal, saveLocal, LS_KEYS } from "@/lib/localStore";
import type { AllDatasets } from "@/lib/driveSync";

const SCOPE = "https://www.googleapis.com/auth/drive.file";
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const FILE_NAME = "until-data.json";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";

export interface UntilData extends AllDatasets {
  version: number;
  updatedAt: string;
}

export function emptyData(): UntilData {
  return { version: 1, updatedAt: "", events: [], dailyTasks: [], rhei: [], pomodoroSessions: [] };
}

function normalize(d: any): UntilData {
  return {
    version: 1,
    updatedAt: typeof d?.updatedAt === "string" ? d.updatedAt : "",
    events: Array.isArray(d?.events) ? d.events : [],
    dailyTasks: Array.isArray(d?.dailyTasks) ? d.dailyTasks : [],
    rhei: Array.isArray(d?.rhei) ? d.rhei : [],
    pomodoroSessions: Array.isArray(d?.pomodoroSessions) ? d.pomodoroSessions : [],
  };
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

// --- Auth -----------------------------------------------------------------

let gisPromise: Promise<void> | null = null;
let tokenClient: any = null;
let cachedToken: { token: string; expiresAt: number } | null = null;

/** Inject the GIS script once, lazily (only when the user first syncs). */
export function loadGis(): Promise<void> {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"));
    if ((window as any).google?.accounts?.oauth2) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google sign-in"));
    document.head.appendChild(s);
  });
  return gisPromise;
}

/**
 * Get a Drive access token, reusing the cached one until it nears expiry.
 * `interactive` lets GIS show the account/consent popup as needed; pass false to
 * attempt a silent refresh. Must be called from a user gesture when interactive.
 */
export async function getAccessToken(interactive = true): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) return cachedToken.token;
  if (!CLIENT_ID) throw new Error("Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID");
  await loadGis();
  const google = (window as any).google;
  if (!tokenClient) {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: () => {},
    });
  }
  return new Promise<string>((resolve, reject) => {
    tokenClient.callback = (resp: any) => {
      if (resp.error) return reject(new Error(resp.error));
      cachedToken = { token: resp.access_token, expiresAt: Date.now() + (resp.expires_in ?? 3600) * 1000 };
      resolve(resp.access_token);
    };
    try {
      tokenClient.requestAccessToken({ prompt: interactive ? "" : "none" });
    } catch (e) {
      reject(e as Error);
    }
  });
}

// --- File access ----------------------------------------------------------

/**
 * Find the app's `until-data.json` (creating it if absent) and return its id +
 * current revision. A cached id is verified first to skip the search. With the
 * `drive.file` scope `files.list` only ever returns files this app created.
 */
export async function findOrCreateDataFile(token: string): Promise<{ id: string; headRevisionId?: string }> {
  const cachedId = loadLocal<string | null>(LS_KEYS.driveFileId, null);
  if (cachedId) {
    const r = await fetch(`${API}/files/${cachedId}?fields=id,headRevisionId,trashed`, { headers: auth(token) });
    if (r.ok) {
      const f = await r.json();
      if (!f.trashed) return { id: f.id, headRevisionId: f.headRevisionId };
    }
    // stale id — fall through to a fresh search
  }

  const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
  const list = await fetch(
    `${API}/files?q=${q}&spaces=drive&orderBy=createdTime&fields=files(id,createdTime,headRevisionId)`,
    { headers: auth(token) },
  );
  if (!list.ok) throw new Error(`Drive list failed: ${list.status}`);
  const { files } = await list.json();
  if (files && files.length > 0) {
    if (files.length > 1) {
      // First-run race on two devices can leave duplicates. We keep the earliest
      // (orderBy createdTime) as canonical; the others are harmless but won't
      // converge. Practical fix: do the first-ever sync on a single device.
      console.warn(`[until] ${files.length} until-data.json files in Drive; using the earliest.`);
    }
    saveLocal(LS_KEYS.driveFileId, files[0].id);
    return { id: files[0].id, headRevisionId: files[0].headRevisionId };
  }

  const created = await createDataFile(token);
  saveLocal(LS_KEYS.driveFileId, created.id);
  return created;
}

async function createDataFile(token: string): Promise<{ id: string; headRevisionId?: string }> {
  const res = await fetch(`${API}/files?fields=id`, {
    method: "POST",
    headers: { ...auth(token), "Content-Type": "application/json" },
    body: JSON.stringify({ name: FILE_NAME, mimeType: "application/json" }),
  });
  if (!res.ok) throw new Error(`Drive create failed: ${res.status}`);
  const f = await res.json();
  const w = await writeDataFile(token, f.id, emptyData());
  return { id: f.id, headRevisionId: w.headRevisionId };
}

export async function readDataFile(token: string, id: string): Promise<{ data: UntilData; headRevisionId?: string }> {
  const media = await fetch(`${API}/files/${id}?alt=media`, { headers: auth(token) });
  if (!media.ok) throw new Error(`Drive read failed: ${media.status}`);
  const text = await media.text();
  let data: UntilData;
  try {
    data = normalize(text ? JSON.parse(text) : {});
  } catch {
    data = emptyData();
  }
  return { data, headRevisionId: await getHeadRevisionId(token, id) };
}

/** Current revision id — the cheap token we diff for optimistic concurrency. */
export async function getHeadRevisionId(token: string, id: string): Promise<string | undefined> {
  const r = await fetch(`${API}/files/${id}?fields=headRevisionId`, { headers: auth(token) });
  if (!r.ok) return undefined;
  return (await r.json()).headRevisionId;
}

export async function writeDataFile(
  token: string,
  id: string,
  data: AllDatasets,
): Promise<{ headRevisionId?: string }> {
  const payload: UntilData = { version: 1, updatedAt: new Date().toISOString(), ...data };
  const res = await fetch(`${UPLOAD}/files/${id}?uploadType=media&fields=headRevisionId`, {
    method: "PATCH",
    headers: { ...auth(token), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Drive write failed: ${res.status}`);
  return { headRevisionId: (await res.json()).headRevisionId };
}
