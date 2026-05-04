# Usage

## Getting Started

```bash
npm install
npm run dev
```

Opens at `http://localhost:3000`.

For a persistent local server (PM2):

```bash
npm run build
pm2 start ecosystem.config.js
pm2 restart until   # after rebuilding
```

## Horizons

Horizons are projects or commitments with due dates. They're automatically sorted into sections:

| Section | Range | Visible when minimized? |
|---------|-------|------------------------|
| Over The Horizon | Past due | Yes |
| Short Horizon | 0 -- 15 days | Yes |
| Horizon | 16 -- 180 days | No |
| Long Horizon | 180+ days | No |

**Adding a horizon:** Click `New` in the tab row. Fill in name, due date, and optionally a URL, next action, description, to-do items, and tags. Click `New` again (now `×`) to cancel.

**Expanding a horizon:** Click its name to reveal due date, description, to-do list, tags, and action buttons (edit, complete, delete).

**Star (★):** Star a horizon to pin a marker beside its name in the list.

**Over The Horizon markers:**
- A red `·` prefix means the horizon has **never been gardened**.
- A dimmed `·` prefix means it was **gardened more than 14 days ago** (stale).
- Recently-gardened horizons get no marker.
- A starred horizon shows the ★ instead — star takes precedence.

**Tags:** Filter horizons by tag using the filter button in the header. Available tags grouped by axis:
- *Opportunity:* `grants`, `residencies`, `fellowship`, `competitions`, `exhibitions`, `conference`
- *Modifier:* `funded`
- *Deliverable:* `text`, `images`, `video`, `code`, `portfolio`, `cv`, `proposal`
- *Meta:* `admin`

**Archiving:** Mark a horizon as completed or incomplete to move it to the Archive tab.

## Tab row

Below the filter bar:

| Button | Action |
|--------|--------|
| `On-going` / `Archive` | Switch between active horizons and the archive |
| `New` (`×` while open) | Open / cancel the new-horizon form |
| `Fold` / `Unfold` | Hide or show the `Horizon` and `Long Horizon` sections (state persists across tab/window blur) |

## Daily Tasks

Switch between **Yesterday**, **Today**, **Tomorrow**, and **Repeating** tabs.

- Type in the input and press Enter to add a task.
- Click a task to toggle completion (no checkbox needed).
- Link a task to a horizon using the link icon.
- **Carry forward:** When unchecked tasks remain from yesterday, a button appears to bring them into today.
- **Completed group:** Completed tasks collapse under a `Completed` header. Click the header to expand/collapse.

## Repeating (Rhei)

Repeating items are recurring practices you want to engage with daily.

- **Tap a Repeating item** to engage with it for the day. Tap again to disengage.
- **2.5-second undo window:** Each tap is silently debounced. The visual flips immediately, but the actual write (engagement + auto-created sub-tasks) waits 2.5 seconds. Tap again within the window to cancel — nothing gets committed. Useful for fixing fat-finger taps without polluting history.
- **Sub-tasks:** When engaged, an `Add sub-task...` input appears. Type a one-off sub-task and press Enter. Sub-tasks are scoped to today.
- **Scheduled sub-tasks:** Repeating items can have weekday-specific sub-tasks (configured via the edit pencil). When you engage the item, today's scheduled sub-tasks are created automatically. During the 2.5-second pending window they appear as dimmed previews.
- Sub-tasks also appear in the Today tab, but the parent Repeating item itself stays only in the Repeating tab.

## Pomodoro Timer

A 35-minute focused work timer above the daily tasks section.

1. **Pick a task** with `New` — choose from today's tasks, type a fresh one, or pick a horizon's sub-task.
2. **Start** the timer.
3. When done, choose an outcome:
   - **Completed** — full session done. Auto-marks the linked task complete.
   - **Postponed** — pause and come back later (no session logged).
   - **Fresh** — distracted; logs the partial duration as `outcome: fresh` and resets the timer with the same task.
   - **New** — clear everything and pick a different task.
4. **Force Majeure** (bottom bar) — log the session as disrupted with a categorized reason.

The progress bar shows 5-minute tick marks for pacing.

**Sessions under 60 seconds** are auto-marked `outcome: aborted` to prevent stray taps from polluting stats.

## Gardening

A structured review of every active horizon. Click **Garden** in the bottom bar to start.

For each horizon, you can:
- Read and edit the description
- Update the next action
- Check off or add to-do items (todos record `createdAt` and `completedAt`)
- **Save & Next** to commit changes, or **Skip** to move on

The Garden button strikes through once every active horizon has been reviewed today.

## Force Majeure

For days disrupted by circumstances beyond your control. Click **Force Majeure** in the bottom bar, type a reason (e.g., "Spring Break", "Sick", "No Electricity"), and press Enter. Past reasons are suggested for quick reuse. The button strikes through once any Force Majeure session has been logged today.

## Worked Out

Click **Worked Out** in the bottom bar to log a workout for today. The button strikes through once logged. It's a shortcut to the `Exercise` Repeating item — tapping it adds the same engagement that tapping `Exercise` in the Repeating tab would, and respects the same 2.5-second undo window. If no `Exercise` Repeating item exists, the button uses a session-only state (visual works within the page; doesn't persist across reload).

## Next Actions

Toggle the next-action field's visibility next to each horizon name:
- **Hold Shift** to peek (auto-hides on release).
- **Double-tap Shift** to lock the display on or off.

When the field is empty, the placeholder shows the first incomplete todo as a fallback. Typed values override the fallback and are persisted; whitespace is trimmed.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Hold **Space** | Peek — temporarily expand minimized sections |
| Double-tap **Space** | Lock/unlock fold state |
| Hold **Shift** | Peek — temporarily show next actions |
| Double-tap **Shift** | Lock/unlock next actions display |

## Themes

Toggle between light and dark mode using the **Day** / **Night** button in the header.

## Personal vs. public version

The codebase exposes an `isPersonal` flag (`!process.env.NEXT_PUBLIC_VERCEL_ENV`) that is `true` locally and `false` on Vercel. It's currently unused at the UI level — both versions look the same — but kept available for future per-version branching. The Vercel deployment is read-only at runtime; data writes do not persist between cold starts.

When the local `data/` directory is empty (as on Vercel), the API routes fall back to a tracked `data-example/` folder containing fictional but plausible content. Visitors see a working, populated UI; nothing they do persists.
