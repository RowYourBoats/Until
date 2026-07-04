# Architecture

## Tech stack

- **Next.js 14** (App Router) with React 18 and TypeScript
- **CSS Modules** with CSS variables for light/dark theming
- **Framer Motion** for layout animations
- **File-based JSON storage** — no database, just flat files in `/data/`
- **Offline PWA** — a service worker (`public/sw.js`) caches the app shell; a localStorage mirror (`src/lib/localStore.ts`) keeps every dataset editable with no network and across reloads
- **Google Drive sync** — a single `until-data.json` in your Drive is the cross-device hub (`src/lib/drive.ts`, `src/lib/driveSync.ts`, `src/lib/useDriveSync.ts`)
- **Lucide** for iconography

## Data model

All data lives in `/data/` as JSON files (gitignored — local only):

| File | Contents |
|------|----------|
| `events.json` | Horizons (projects) with due dates, tags, todos (each with `createdAt` / `completedAt`), `nextAction`, `gardenedAt` |
| `daily-tasks.json` | Date-specific tasks, optionally linked to horizons (`linkedEventId`) or Repeating items (`rheiItemId`) |
| `rhei.json` | Repeating items with daily engagement history and optional weekday-scheduled sub-tasks |
| `pomodoro-sessions.json` | Timer session log with outcome, duration, `taskId` / `eventId` / `nowId` cross-refs |

Every synced item carries `updatedAt`. The `/projects/` folder (≈8.6 GB of Blender/3D/PDF binaries) is **never synced** — it stays on the PC, which reconciles event→folder structure (`src/lib/eventFolders.ts`).

**Demo seed.** `data-example/*.json` is a tracked, fictional seed. It is served **only** when `NEXT_PUBLIC_UNTIL_DEMO=1` (see `loadExampleFallback` in `src/lib/exampleData.ts`); otherwise a deployment with no `data/` files (e.g. Vercel) serves empty and is a pure Drive client. This gating exists because the deployed app is the owner's real client — without it, the demo seed was being synced into the real Drive.

The Vercel deployment has a read-only filesystem (`PERSIST_DISABLED`) and never writes to disk. `isPersonal` (`!process.env.NEXT_PUBLIC_VERCEL_ENV`) is `true` only on a local instance.

## Sync & devices

The four datasets (~260 KB of text) sync across devices (PC, MacBook, iPhone) through one **`until-data.json` in Google Drive**.

- **How it syncs.** Each device edits offline against its localStorage mirror. Pressing **Sync** does a Drive round-trip: read `until-data.json`, merge it with the local snapshot per item (last-write-wins, `src/lib/merge.ts`), then write the result back. Local state is adopted only *after* the write succeeds, so a clobbered write never loses data. Concurrent writes are guarded by re-checking the file's `headRevisionId` and retrying.
- **Sync is manual.** It runs only on the Sync click — never on load or in the background. The first click triggers Google sign-in.
- **Auth.** Browser-side Google Identity Services, scope `drive.file` (the app only ever sees the one file it created). No client secret. Access is gated by the OAuth consent screen's **Internal** audience (or Testing mode) — only the owner's account can sign in, so a visitor can't sync.
- **The PC is special.** Only the PC materializes `data/*.json` and reconciles `/projects/`, via `POST /api/sync`. It's flagged `NEXT_PUBLIC_UNTIL_PC=1`; the phone/MacBook sync to Drive only.
- **Deployed app = pure Drive client.** On a deployed instance the client never overwrites local data from the server — it refreshes from `/api` only to seed a dataset that's empty locally (`isPersonal` gate in `EventList` mount). The PC, with authoritative `data/`, always refreshes.
- **The iPhone uses the Vercel app** over public HTTPS + Drive — no PC running, no LAN, no certificates. The deployment is `noindex`'d (`src/app/robots.ts` + layout metadata).
- **Stealth Sync button.** On the public app the Sync button is camouflaged (transparent label, first in the header actions: `date · [Sync] Night Filter`) so a visitor doesn't see it; the owner knows where it is. The `Synced …` status sits centered in the header.
- **Save-failure indicator.** Every dataset POST checks the response; any failure (network throw or non-2xx) shows `Local only — server not saving` in red in the header until a write lands. The change itself is never lost — state + localStorage are written first. Added after a crash-looping server silently swallowed five days of writes behind the PWA shell.

## Data mutation rules (important)

The sync is a **union-by-id, last-write-wins merge with tombstones** (`src/lib/merge.ts`). This means:

- **Never remove a synced item by array-filtering it out.** An absent item is *not* a deletion to the merge — the other device's copy resurrects it on the next sync. Removals must be **soft**: set `deletedAt` (a tombstone). Tombstones are hidden at display-source filters and purged after 30 days (`purgeTombstones`).
- Deletes (events, daily tasks, rhei) all set `deletedAt`. Nested arrays (e.g. an event's `todos`) ride on their parent's last-write-wins, so editing them in place is fine.
- **Carry-forward uses a ledger, not a delete.** Carrying yesterday's unchecked tasks forward marks the originals `carriedAt` (+ `carriedTo` = successor id) and keeps them as a dimmed, non-interactive "carried forward" record; a fresh row is created for today with `carriedFrom` = the chain's origin date. The marker propagates on sync, so the task isn't resurrected or duplicated, and "carried (still alive)" stays distinct from "deleted." Carried records are *not* tombstones, so they persist as history.
- **A carried mark is trusted only if coherent.** `isCarriedRecord` treats a task as a record only when `carriedAt` falls on a *later local day* than the task's own date — a task can't be carried before it existed. Incoherent marks (an old cached client once spread `{…t}` on carry, so copies inherited their ancestor's mark) render as normal live tasks, keeping them actionable instead of frozen.

## Setup

```bash
npm install
npm run dev          # http://localhost:3000
```

Persistent local server (PM2):

```bash
npm run build
pm2 start ecosystem.config.js
pm2 restart until    # after rebuilding — required for NEXT_PUBLIC_* changes
```

> `NEXT_PUBLIC_*` vars are baked in at **build time**. After changing `.env.local`, rebuild (`npm run build`) — restarting PM2 alone won't pick them up. Same on Vercel: set the var, then redeploy.

> **If saves stop persisting, check the server first.** A missing/stale `.next` makes `next start` crash-loop under PM2 while the PWA keeps serving the cached shell — the UI works, every write dies. Symptoms: red `Local only — server not saving` in the header, stale `data/*.json` mtimes, `↺` climbing in `pm2 status`. Diagnose with `pm2 logs until`; fix with `npm run build && pm2 restart until`.

### Environment variables

See `.env.example`. All are `NEXT_PUBLIC_` (browser-readable, none secret):

| Variable | Where | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | every instance that syncs (Vercel + each device's `.env.local`) | OAuth web client ID for Drive sign-in |
| `NEXT_PUBLIC_UNTIL_PC` | PC's `.env.local` only (`=1`) | Marks the instance that persists `data/*.json` + reconciles `/projects/` |
| `NEXT_PUBLIC_UNTIL_DEMO` | a throwaway demo deployment only (`=1`) | Serve the `data-example/` seed. Leave UNSET on the real app. Never sign in / sync on a demo instance — it would push demo data into your Drive. |

### One-time Google Cloud setup

1. Google Cloud project → enable the **Google Drive API**.
2. **OAuth consent screen:** audience **Internal** (Workspace org — only your `@m-a-r-v-i-n.com` account works) or **External + Testing** with your account as a test user. Add scope `drive.file`. Don't publish.
3. **Credentials → OAuth client ID → Web application.** Authorized JS origins: `https://until-ashy.vercel.app` and `http://localhost:3000`. No redirect URIs (token client uses postMessage). The client secret is unused — ignore it.
4. Put the client ID in `NEXT_PUBLIC_GOOGLE_CLIENT_ID` everywhere; set `NEXT_PUBLIC_UNTIL_PC=1` on the PC only.

> The Drive file `until-data.json` is created automatically on first Sync (root of My Drive). Do the very first sync on a single device, then the others, to avoid a duplicate-file race.

## Public demo (optional)

`until-ashy` is the owner's real app (demo off). To also show a populated demo, deploy a **second** instance with `NEXT_PUBLIC_UNTIL_DEMO=1` at any URL; it needs no OAuth (never sign in there), so it can't reach a real Drive.
