# Flows

A walkthrough of each surface in Until — what you actually do, and what each part is for.

Until isn't a task tracker. It's a daily practice surface: a way of looking at the work you've committed to (horizons), the practices you want to keep (repeating), the focused sessions where the work actually happens (pomodoro), and the rituals that keep the system honest (gardening, force majeure). The friction has been deliberately tuned for daily use over months and years.

Each section below describes one surface: how it behaves, what a normal session with it looks like, and the reasoning underneath. Read in order or jump to whichever surface someone is asking about.

---

## Horizons

**What it is.** Your committed work, sorted not alphabetically or by priority but by *temporal proximity*. Every project has a due date, and the app groups them into bands:

| Band | Distance from today | Shown when folded? |
|---|---|---|
| Over The Horizon | Past due | Yes |
| Short Horizon | 0–15 days | Yes |
| Horizon | 16–180 days | No |
| Long Horizon | 180+ days | No |

**What it's for.** Most calendars treat time as a grid of slots. Horizons treats it as a landscape: things approach, pass overhead, or drift past unattended. The bands keep the imminent visible and the distant from crowding it out — without forcing you to delete or hide anything.

**The flow.**

1. Click `New` in the tab row to add a horizon. Name, due date, optional URL, optional description, todos, tags, next action.
2. Click any horizon's name to expand it. You see the description, todos, tags, due date, and a row of action buttons (edit, complete, delete).
3. Click the title to collapse it again.
4. **Star (★)** a horizon to pin a marker beside its name. The star takes precedence over Over The Horizon markers.
5. **Filter by tag** with the filter button in the header. Tags are grouped on three axes — Opportunity (grants, residencies, fellowship, competitions, exhibitions, conference), Modifier (funded), Deliverable (text, images, video, code, portfolio, cv, proposal), Meta (admin).
6. When a horizon is finished, mark it **completed** or **incomplete** to send it to the Archive tab. Nothing is ever deleted from the archive unless you delete it explicitly.

**Over The Horizon markers.** Anything past its due date sits in OTH. Three states are surfaced visually:

- **Red `·`** — the horizon has *never* been gardened. It entered the OTH section without ever having been reviewed.
- **Dimmed `·`** — gardened more than 14 days ago. It's been seen recently enough to count, but it's drifting.
- **No marker** — gardened within the last 14 days. Actively maintained.
- **★** — starred, taking precedence over the other two markers.

This is the system being honest about which overdue work you're actually carrying versus which has fallen off the map. Most overdue work in most systems is invisible. Here it's three distinct states of forgotten-ness.

**Folded mode.** Click `Fold` in the tab row to hide the `Horizon` and `Long Horizon` sections, leaving only OTH and Short. This is the "what matters this fortnight" view. Hold **Space** to peek at the folded sections; double-tap **Space** to lock them open or shut. Fold state persists across reload.

---

## Repeating (Rhei)

**What it is.** A list of recurring practices — exercise, sketching, reading, study, journaling, whatever you've committed to as part of a working life. Each item is engaged with daily by a single tap. Engagement history is a continuous record of which days you showed up.

**What it's for.** Most habit trackers fail because they punish you for missing a day, or because logging is more effort than the practice itself. Repeating doesn't track streaks or guilt. It records when you engaged — that's all. Looking back over a month you can see the shape of your own consistency without the system gamifying it.

The name *Rhei* is from the Greek *panta rhei* — everything flows. The state key and JSON filename still use `rhei`; the visible UI label is "Repeating."

**The flow.**

1. Open the **Repeating** tab.
2. **Tap an item** to engage with it for today. The visual flips immediately — strikethrough, the engagement counter ticks.
3. **2.5-second undo window.** The write is silently debounced. If you tapped by accident, tap again within 2.5 seconds and nothing is committed. The history stays clean.
4. **Sub-tasks.** Once engaged, an `Add sub-task…` input appears under the item. Type something one-off (`finished chapter 4`, `cleaned brushes`) and press Enter. Sub-tasks are scoped to today and also appear in the Today tab.
5. **Scheduled sub-tasks.** Edit a Repeating item (pencil icon) to attach weekday-specific sub-tasks — for example, "stretch shoulders" only on Mon/Wed/Fri. When you engage the item on a matching weekday, today's scheduled sub-tasks are created automatically. They appear as dimmed previews during the 2.5-second pending window so you can see what's about to be committed.
6. **Disengaging.** Tap the engaged item again to disengage. Same 2.5-second undo window.

**Why the undo window exists.** Daily engagement tracking only works if the data is trustworthy. A single mis-tap polluting a month of history makes the record useless. The silent 2.5-second debounce means the dataset reflects deliberate choices, not finger slips. Repeating prioritizes long-term truthfulness over instant durability.

---

## Daily Tasks

**What it is.** A short list of things you intend to do today. Switchable between **Yesterday**, **Today**, **Tomorrow**, and **Repeating** tabs.

**What it's for.** A working surface for the day, separate from the longer-term horizon list. Things land here either by being typed, carried forward from yesterday, linked from a horizon, or generated by engaging a Repeating item.

**The flow.**

1. Type into the input and press Enter to add a task to whichever day's tab is active.
2. **Click the task** (no checkbox) to toggle completion. Completed tasks collapse under a `Completed` header — click it to expand.
3. **Link a task to a horizon** with the link icon. The task gets a `linkedEventId`; the horizon shows the task in its sub-list.
4. **Carry forward.** When yesterday has unchecked tasks, today shows a button to bring them in. Carrying is a *ledger move*: the original stays on its day as a dimmed "carried forward" record, and a fresh copy lands on today. `carriedFrom` records the chain's origin, `carriedTo` the successor — so an undone task's whole lineage is preserved, and "carried (still alive)" stays distinct from "deleted."
5. **Tomorrow tab.** Drafts for the next day — type anything you've already decided about tomorrow so it's there when you wake up.
6. **Repeating tab.** Switches to the Repeating list (see above). It lives in the same tab row because in practice you flip between today's loose tasks and your standing practices constantly.

---

## Pomodoro Timer

**What it is.** A 35-minute focused work timer above the daily tasks section. Every session is tied to a specific task or horizon and ends with an honest outcome.

**What it's for.** Not a productivity gimmick. The pomodoro here is a *deliberate focus session* — not something that runs by default. You pick what you're going to work on, you start, and at the end you tell the system what actually happened. The outcomes are designed to be honest about how focused work actually goes, including the parts most timers refuse to record.

**The flow.**

1. Click `New` on the timer. The picker appears.
2. **Choose what you're working on.** Three options: today's tasks, type a fresh task, or pick a horizon (optionally with one of its todos).
3. **Start** the timer. The progress bar shows 5-minute tick marks. The chosen task is visible above the timer the whole session.
4. When the timer ends — or you stop it early — pick an outcome:
   - **Completed** — the session went the distance. If linked to a task, the task is auto-marked complete.
   - **Fresh** — you got distracted partway. Logs the partial duration as `outcome: fresh` and resets the timer with the same task so you can try again.
   - **Postponed** — pause and come back later. No session is logged.
   - **New** — abandon the timer and pick a different task.
5. **Force Majeure** (bottom bar) — the session was disrupted by something outside your control. Pick a categorized reason; the session is logged as `outcome: forceMajeure`.

**Aborted sessions.** Anything under 60 seconds is auto-marked `outcome: aborted`. This is so a stray tap on Start doesn't get counted as a one-second session and corrupt the stats. The aborted outcome exists; it just isn't a button.

**Why the outcomes matter.** A timer that only logs successful sessions tells you nothing real. The five outcomes — completed, fresh, postponed, force majeure, aborted — let the record reflect what work actually looks like: full sessions, restarts, days you bailed, days something blew up the schedule. Over time the distribution itself becomes useful information.

---

## Gardening

**What it is.** A structured review of every active horizon. Click **Garden** in the bottom bar to start. The app walks you through each horizon one at a time.

**What it's for.** The most important ritual in Until. Project lists rot — descriptions drift out of date, next actions become stale, todos accumulate that no longer matter. Gardening forces a contact with every active commitment on a regular cadence. Items that get gardened stay alive. Items that don't get gardened are visibly marked as drifting (the OTH markers above).

**The flow.**

1. Click **Garden** in the bottom bar.
2. For the first active horizon, you see its description, next action, and todos in an editable form.
3. **Update what's changed.** Edit the description. Update the next action. Check off todos that are done. Add new todos. Each todo records `createdAt` and `completedAt` so you can see the lifecycle.
4. **Save & Next** commits the changes and moves to the next horizon. **Skip** moves on without writing.
5. Continue until every active horizon has been reviewed.
6. The **Garden** button in the bottom bar gets **struck through** once every active horizon has been gardened today. This is the "done for the day" signal — not bold, struck through.

You can also garden a horizon ad-hoc from its expanded view; the same review form is reachable per horizon.

---

## Force Majeure

**What it is.** A day-level log for circumstances beyond your control — illness, no electricity, a family emergency, a holiday you didn't plan for. Click **Force Majeure** in the bottom bar, type a reason, press Enter.

**What it's for.** The honest counterpart to gardening. Some days nothing happens, and the reason matters. Recording "Sick" or "Spring Break" or "Studio Move" against the day means later you can look back and understand why the cadence broke without it looking like a failure of will. Past reasons are suggested for quick reuse.

**The flow.**

1. Click **Force Majeure** in the bottom bar. An input pops up above the bottom buttons.
2. Type a short reason (or click a past suggestion).
3. Press Enter to log.
4. The button strikes through once any Force Majeure session has been logged today.

Force Majeure can also be selected as an outcome from inside a Pomodoro session — same categorized reason, applied to that session rather than the whole day.

---

## Bottom-bar shortcuts

The bottom bar holds three buttons. Two of them are rituals (Garden, Force Majeure, above). The third is a shortcut.

**Worked Out.** Click to log today's workout. This is *not* a separate workouts log — it's a shortcut to engaging the **Exercise** Repeating item. Tapping `Worked Out` is identical to tapping `Exercise` in the Repeating tab, including the 2.5-second undo window. The button strikes through once engaged.

If no `Exercise` Repeating item exists (or you're on Vercel with no real data), the button falls back to a session-only state — visual works within the page but doesn't persist across reload.

The shape of the bottom bar is intentional: the three things you owe a working day are *show up for your practices* (Worked Out as a shortcut), *log what blew up* (Force Majeure), and *tend your commitments* (Garden). Each one strikes through once it's been honored.

---

## Next-action peek

**What it is.** Every horizon can have a `nextAction` — a one-line note for the very next concrete step. By default it's hidden in the list view, because the list would get noisy if every horizon showed its detail.

**The flow.**

- **Hold Shift.** Next actions appear next to every horizon name. Release Shift and they hide again.
- **Double-tap Shift.** Locks the next-action display on (or off, if currently locked).
- **Empty next-action.** If you haven't typed a next action, the placeholder shows the *first incomplete todo* as a fallback. Typed values override the fallback and are persisted; whitespace is trimmed.

**Why peek/lock.** The most useful information about a horizon — what would I do right now if I picked this up — is also the most cluttering when shown all the time. Peek lets you check without committing to the cluttered view. Double-tap lets you commit if you want the cluttered view today.

---

## Folded peek

**Hold Space** to peek at the `Horizon` and `Long Horizon` sections while in folded mode. Release to collapse. **Double-tap Space** to lock folded/unfolded.

Same logic as the next-action peek: a brief look without committing.

---

## Archive

The **Archive** tab in the tab row holds every horizon you've marked completed or incomplete. Nothing leaves on its own. You can re-open any archived horizon's detail; you can also delete from the archive if you want it gone for real.

The distinction between *completed* and *incomplete* matters: completed means you finished it on its terms, incomplete means you stopped working on it without finishing. Both are valid endings for a horizon. The system is built to record the difference, not to hide the incompletes.

---

## Themes

Toggle **Day** / **Night** in the header. CSS variables drive a full light/dark palette across every surface. The mobile browser chrome (theme-color) follows the active theme.

---

## Personal vs. public

A flag in the codebase (`isPersonal = !process.env.NEXT_PUBLIC_VERCEL_ENV`) is `true` when you run Until locally and `false` on the Vercel deployment. It's currently unused at the UI level — both versions look the same — but it's available for future branching.

The public Vercel deployment has a **read-only** filesystem — it never writes to disk and is a pure Google Drive client: the owner signs in and syncs, while a visitor sees an empty, local-only app (and can't sync — OAuth is org-internal). The `data-example/` demo seed is served only when `NEXT_PUBLIC_UNTIL_DEMO=1`, which is off by default. See [Architecture](./Architecture.md) for the full sync model.

---

## What this app isn't

A few things Until intentionally doesn't do:

- **No deadlines as alerts.** Nothing pings you. Horizons surface by approaching, not by interrupting.
- **No streaks.** Repeating tracks engagement history but never shames you for a break.
- **No scoring.** No productivity score, no per-day rating, no graphs of your worth.
- **No multi-user.** This is a single-user tool for a working life. Your devices share one Google Drive file; there are no accounts for anyone else. Showing the app off is done with a separate, populated demo deployment, not by sharing your data.
- **No required fields.** A horizon needs a name and a due date. Everything else — description, tags, todos, next action — is optional and arrives as the work reveals itself.

The shape is closer to a field journal than a task tracker. The point isn't to capture every intention; it's to keep an honest, daily contact with the work you've actually committed to.
