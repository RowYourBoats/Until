# Until

A personal productivity system built around the concept of **horizons** — projects and commitments organized by temporal proximity. Rather than treating time as a grid of slots, this app treats it as a landscape of approaching deadlines, daily rituals, and focused work sessions.

## Philosophy

- **Horizons, not calendars.** Projects are grouped by how soon they matter: *Short Horizon* (imminent), *Horizon* (weeks to months), *Long Horizon* (six months+), and *Over The Horizon* (overdue). A folded mode strips the view down to what's urgent.
- **Repeating (Rhei).** Recurring practices — things you want to engage with regularly — are tracked not as rigid schedules but as daily choices. Tap to engage, add sub-tasks as the work reveals itself. A short undo window absorbs accidental taps without polluting the engagement history.
- **Pomodoro with intent.** A 35-minute timer that ties each session to a specific task or project. Sessions end with an honest outcome: completed, fresh, postponed, force majeure, or aborted (auto-applied to anything under 60 seconds). The pomodoro is a tracker to force focus on a certain project. Not something that runs at all times.
- **Gardening.** A ritual for reviewing every active horizon one by one — updating descriptions, next actions, and to-dos. The app tracks whether you've gardened today and surfaces never-gardened or stale horizons distinctly in the Over The Horizon view.

## Tech Stack

- **Next.js 14** with React 18 and TypeScript
- **CSS Modules** with CSS variables for light/dark theming
- **Framer Motion** for layout animations
- **File-based JSON storage** — no database, just flat files in `/data/`
- **Lucide** for iconography

## Data

All data lives in the `/data/` directory as JSON files (gitignored — local only):

| File | Contents |
|------|----------|
| `events.json` | Horizons (projects) with due dates, tags, todos (each with `createdAt` / `completedAt`), `nextAction`, `gardenedAt` |
| `daily-tasks.json` | Date-specific tasks, optionally linked to horizons (`linkedEventId`) or Repeating items (`rheiItemId`) |
| `rhei.json` | Repeating items with daily engagement history and optional weekday-scheduled sub-tasks |
| `pomodoro-sessions.json` | Timer session log with outcome, duration, `taskId` / `eventId` / `nowId` cross-refs |

When `data/X.json` is missing, the API routes fall back to `data-example/X.json` — a tracked, fictional seed used by the Vercel deployment so visitors see realistic content. Locally the seed is invisible because your real `data/` files exist.

The Vercel deployment is read-only at runtime — it serves the bundled snapshot but does not persist user writes between cold starts. The app exposes an `isPersonal` flag (`!process.env.NEXT_PUBLIC_VERCEL_ENV`) for future per-version branching.

## Usage

See [`usage.md`](./usage.md) for a feature-by-feature walkthrough — tabs, shortcuts, the Repeating undo window, gardening, pomodoro outcomes, and the bottom-bar buttons.
