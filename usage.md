# Usage

## Getting Started

```bash
npm install
npm run dev
```

Opens at `http://localhost:3000`.

## Horizons

Horizons are projects or commitments with due dates. They're automatically sorted into sections:

| Section | Range | Visible when minimized? |
|---------|-------|------------------------|
| Over The Horizon | Past due | Yes |
| Short Horizon | 0 -- 15 days | Yes |
| Horizon | 16 -- 180 days | No |
| Long Horizon | 180+ days | No |

**To add a horizon:** Click the `+` button in the header. Fill in name, due date, and optionally a URL, next action, description, to-do items, and tags.

**To expand a horizon:** Click its name to reveal details -- due date, description, to-do list, tags, and action buttons (edit, complete, delete).

**Tags:** Filter horizons by tag using the filter button in the header. Available tags: grants, exhibitions, competitions, submissions, residencies, images, text.

**Archiving:** Mark a horizon as completed or incomplete to move it to the Archive tab.

## Daily Tasks

Switch between **Yesterday**, **Today**, **Tomorrow**, and **Rhei** tabs.

- Type in the input and press Enter to add a task
- Check the box to complete
- Link a task to a horizon using the link icon
- **Carry forward:** When unchecked tasks remain from yesterday, a button appears to bring them into today

## Rhei

Rhei items are recurring practices you want to engage with daily.

- **Tap a Rhei item** to engage with it for the day (tap again to disengage)
- **Add sub-tasks** using the input that appears below an engaged item
- Sub-tasks from Rhei items also appear in the Today tab, but the parent item itself stays only in the Rhei tab

## Pomodoro Timer

A 35-minute focused work timer displayed at the top of the view.

1. **Select a task** -- pick from today's tasks, create a new one, or choose a horizon's sub-task
2. **Start** the timer
3. When done, choose an outcome:
   - **Completed** -- full session done (auto-completes the linked task)
   - **Postponed** -- pause and come back later
   - **Fresh** -- distracted; log partial time and reset
   - **New** -- clear everything and pick a different task

The progress bar shows 5-minute tick marks for pacing.

## Gardening

A structured review of every active horizon. Click **Garden** in the bottom bar to start.

For each horizon, you can:
- Read and edit the description
- Update the next action
- Check off or add to-do items
- **Save & Next** to commit changes, or **Skip** to move on

The Garden button goes bold once all active horizons have been reviewed today.

## Force Majeure

For days disrupted by circumstances beyond your control. Click **Force Majeure** in the bottom bar, type a reason (e.g., "Spring Break", "Sick", "No Electricity"), and press Enter. Past reasons are suggested for quick reuse.

## Workouts

Click **Worked Out** in the bottom bar to log a workout for today. The button goes bold once logged.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Hold **Space** | Peek -- temporarily expand minimized sections |
| Double-tap **Space** | Lock/unlock minimized state |
| Hold **Shift** | Peek -- temporarily show next actions |
| Double-tap **Shift** | Lock/unlock next actions display |

## Themes

Toggle between light and dark mode using the **Day** / **Night** button in the header.
