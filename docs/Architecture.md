# Architecture

## Tech stack

- **Next.js 14** (App Router) with React 18 and TypeScript
- **CSS Modules** with CSS variables for light/dark theming
- **Framer Motion** for layout animations
- **File-based JSON storage** — no database, just flat files in `/data/`
- **Offline PWA** — a service worker (`public/sw.js`) caches the app shell; a localStorage mirror (`src/lib/localStore.ts`) keeps every dataset editable with no network and across reloads
- **Google Drive sync** — a single `until-data.json` in your Drive is the cross-device hub (`src/lib/drive.ts`, `src/lib/driveSync.ts`)
- **Lucide** for iconography

## Data model

All data lives in `/data/` as JSON files (gitignored — local only):

| File | Contents |
|------|----------|
| `events.json` | Horizons (projects) with due dates, tags, todos (each with `createdAt` / `completedAt`), `nextAction`, `gardenedAt` |
| `daily-tasks.json` | Date-specific tasks, optionally linked to horizons (`linkedEventId`) or Repeating items (`rheiItemId`) |
| `rhei.json` | Repeating items with daily engagement history and optional weekday-scheduled sub-tasks |
| `pomodoro-sessions.json` | Timer session log with outcome, duration, `taskId` / `eventId` / `nowId` cross-refs |

When `data/X.json` is missing, the API routes fall back to `data-example/X.json` — a tracked, fictional seed so the Vercel deployment shows realistic content. Locally the seed is invisible because your real `data/` files exist. Every synced item carries an `updatedAt`; deletes are soft (`deletedAt` tombstones) so a deletion propagates across devices instead of resurrecting.

The Vercel deployment has a read-only filesystem (`PERSIST_DISABLED`) — it never writes to disk. The app exposes an `isPersonal` flag (`!process.env.NEXT_PUBLIC_VERCEL_ENV`) for per-version branching.

## Sync & devices

The four datasets above are ~260 KB of text and sync across devices (PC, MacBook, iPhone) through one **`until-data.json` in Google Drive**. The ~8.6 GB of binary project assets under `/projects/` never sync — they stay on the PC.

- **How it syncs.** Each device edits offline against its localStorage mirror. Pressing **Sync** does a Drive round-trip: read `until-data.json`, merge it with the local snapshot per item (last-write-wins, tombstones kept — `src/lib/merge.ts`), then write the result back. Local state is adopted only *after* the write succeeds, so a clobbered write never loses data — the device's items re-merge and re-push next sync. Concurrent writes are guarded by re-checking the file's `headRevisionId` and retrying.
- **Auth.** Browser-side Google Identity Services, scope `drive.file` — the app only ever sees the single file it created, never the rest of your Drive. No client secret. Access stays gated by leaving the OAuth consent screen in **Testing** mode with only your account as a test user, so no one else can sign in.
- **The PC is special.** Only the PC materializes `data/*.json` and reconciles the `/projects/` folders (`src/lib/eventFolders.ts`), via `POST /api/sync`. It's flagged with `NEXT_PUBLIC_UNTIL_PC=1`; the phone and MacBook sync to Drive only.
- **The iPhone uses the Vercel app** over public HTTPS plus Drive — no PC running, no LAN, no certificates. The deployment is `noindex`'d (`src/app/robots.ts` + layout metadata) so it stays out of search.

## Setup

```bash
npm install
npm run dev          # http://localhost:3000
```

Persistent local server (PM2):

```bash
npm run build
pm2 start ecosystem.config.js
pm2 restart until    # after rebuilding
```

### Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | all envs (Vercel + each device's `.env.local`) | OAuth web client ID for Drive sign-in |
| `NEXT_PUBLIC_UNTIL_PC` | PC's `.env.local` only (`=1`) | Marks the PC as the device that persists `data/*.json` + reconciles `/projects/` |

### One-time Google Cloud setup

1. Create/pick a Google Cloud project → enable the **Google Drive API**.
2. **OAuth consent screen:** External, app name "Until", add scope `drive.file`, add your Google account as a Test user, leave in **Testing** (no verification needed).
3. **Credentials → OAuth client ID → Web application.** Authorized JS origins: `https://until-ashy.vercel.app` and `http://localhost:3000`. No redirect URIs (the token client uses postMessage).
4. Copy the client ID into `NEXT_PUBLIC_GOOGLE_CLIENT_ID` everywhere; set `NEXT_PUBLIC_UNTIL_PC=1` on the PC only.

> Do the very first sync on a single device, then the others — two devices creating the file simultaneously can leave a duplicate.
