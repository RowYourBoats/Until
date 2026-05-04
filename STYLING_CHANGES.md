# Task-based Calendar Styling Changes

Scope: `src/components/EventList.tsx` and `src/components/EventList.module.css`. Goal: reduce the task-based calendar UI to a mostly typographic style — no underlines, spacing-driven layout, click-to-toggle tasks, consistent color roles.

## Daily tasks (Yesterday / Today / Tomorrow / Now)

- **Checkbox removed visually.** `.taskCheckbox` → `display: none`. Checkbox `<input>` elements remain in the DOM for state, but completion is triggered by clicking the task text.
- **Click-to-toggle.** Added `onClick={() => handleToggleDailyTask(task.id)}` to the `.taskContent` wrapper in daily tasks, and to the `.rheiAddendumText` span for rhei sub-tasks. `.taskContent` gets `cursor: pointer`.
- **No extra indent on completed.** `.taskTextCompleted` is just `text-decoration: line-through; color: var(--text-secondary);` — no `padding-left`.
- **Task rows indented.** `.taskRow` has `padding-left: 1.5rem` so all tasks in the daily view sit offset from the date nav, input, and section headers.
- **Daily task input.** Removed the `border-bottom` on `.dailyTaskInput`; placeholder uses `var(--text-secondary) / 0.5`. (Cleaned up a duplicate placeholder rule.)
- **"rhei" tab renamed.** Label text changed to `Now` in the button; state key stays `'rhei'` so existing recurring-task data is unaffected.
- **`rheiItemActive` bold removed.** The rule is empty now — no `font-weight: 700`. Engagement is communicated by the sub-tasks that appear, not weight.

## Completed group

- **Split render.** In the daily tasks render block, `visibleTasks` is split into `incompleteTasks` and `allCompleted`. Incomplete list renders first; if `allCompleted.length > 0`, a header row renders; then `completedTasks` (which is `[]` when `hideCompletedTasks`) renders.
- **`Completed` header** (`.completedHeader`): unindented, same `1.15rem` type size as everything else, `color: var(--foreground)`, `padding: 1rem 0 0.25rem 0`, flex row with a small `.completedToggle` span.
- **Inline collapse toggle.** Clicking `.completedHeader` flips `hideCompletedTasks`. The toggle glyph is `–` when expanded, `|` when collapsed — matching the minimize icon style elsewhere.
- **Standalone "Clear completed" button removed.** The old `.clearCompletedBtn` usage was deleted from the JSX.

## Section headers (horizons)

- **`.sectionTitle`** now: `font-size: 1.15rem; font-weight: 400; color: var(--foreground); margin-bottom: 1.25rem;` — previously red / 500 / 10px. `.sectionTitleBlue` also uses `var(--foreground)` now (so the "Over The Horizon" section renders black, same as the others).
- **Projects/events indented.** `.itemWrapper`: `margin-bottom: 1.25rem; padding-left: 1.5rem;` — so project rows sit offset right of the horizon header, mirroring the daily-task indentation pattern.
- **Renamed label.** In the archive-tab render, `renderSection("Archived", groupedEvents.archived, …)` is now `renderSection("Over The Horizon", groupedEvents.archived, …)`. Note: this collides with the existing "Over The Horizon" section used for overdue active events (line ~1687 originally). The user has been told about this; leave it for them to reconcile.

## Tabs and date nav — blue color role

- **`.tabBtn` / `.tabActive`** (On-going / Archive and the `| / –` toggle):
  - `color: #4a90d9`
  - Inactive: `opacity: 0.5`
  - Active: `opacity: 1; font-weight: 500`
  - No `text-decoration`. Removed the old `text-decoration: underline; text-underline-offset; text-decoration-thickness` block from `.tabActive`.
- **`.dateNavBtn` / `.dateNavActive`** (Yesterday / Today / Tomorrow / Now): same treatment — `#4a90d9`, inactive 0.5 opacity, active 1 opacity + weight 500, no underline.
- **New minimize toggle inline with tabs.** Added a third button inside `.tabs` after Archive:
  ```tsx
  <button
    className={`${styles.tabBtn} ${styles.tabActive}`}
    onClick={() => { minimizedLockedRef.current = !minimizedLockedRef.current; setMinimized(minimizedLockedRef.current); }}
  >
    {minimized ? '|' : '–'}
  </button>
  ```
  Wired to the existing `minimized` / `minimizedLockedRef` state. The old minimize button in the header `.headerActions` still exists — consider removing it to avoid duplication.

## Underlines removed globally from task-calendar UI

- `.tabActive` — removed underline rules.
- `.dateNavActive` — removed underline rules.
- `.todayBtn` — removed underline rules.
- `.carryForward` — removed underline rules; added `font-style: italic` so it still reads as a secondary action.
- `.dailyTaskInput` — removed `border-bottom`.

Not touched (still underlined): `.link`, `.completeBtn` / `.incompleteBtn` / `.deleteBtn`, `.submitButton` / `.cancelButton`, `.gardenSaveBtn`, `.addTodoBtn`. Those live in form/detail views outside the main task calendar.

## Spacing bump

- Every `0.5rem` in `EventList.module.css` replaced with `0.667rem` (padding, margin, gap values). Replace-all; no exceptions.
- `.sectionTitle` `margin-bottom` raised from `10px` to `1.25rem`.
- `.itemWrapper` `margin-bottom` raised from `18px` to `1.25rem`.
- `.taskRow` `padding` is `0.667rem 0` plus `padding-left: 1.5rem`.
- `.rheiAddendumRow` `padding` raised from `2px 0` to `4px 0`.

## Pomodoro section — restructure and relocation

Final location: **below** the header / filter / add-form blocks, **immediately above** `<div className={styles.dailyTasksSection}>`. (The user first asked to move it to the top, then asked to move it back.)

Reordered inside the section:

1. `.pomodoroTimeline` (track + fill + marker + ticks) **first** — so the line is the top element of the block.
2. `.pomodoroHeader` row underneath: flex row with `justify-content: space-between`.
   - Left: `.pomodoroTitle` span containing the text "Pomodoro" followed by `.pomodoroDuration` with `MM:SS / 35:00`, and the "Completed at …" note when applicable.
   - Right: `.pomodoroControls` with Start / Resume / Reset / Completed / Postponed / Fresh / New buttons (conditional rendering unchanged).
3. `.pomodoroTaskLabel` (when a task/event is selected).
4. `.pomodoroTaskList` `AnimatePresence` block (task picker — unchanged internals).

CSS adjustments:

```css
.pomodoroSection {
  padding-top: 0;        /* was 10px */
  padding-bottom: 20px;
}
.pomodoroHeader {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-top: 10px;     /* new — the timeline sits above it */
  padding-bottom: 10px;
}
```

The old separate `.pomodoroTime` span rendering `MM:SS + pomodoroDuration + pomodoroCompletedAt` is gone; that content is now inlined inside `.pomodoroTitle`.

## Color reference

- Horizon accent red (`var(--accent-red)`): no longer used by section titles. Still used by `.pomodoroTitle`, `.pomodoroCompletedAt`, `.pomodoroTrackActive`.
- Blue `#4a90d9`: now the role color for daily-task date nav and main On-going/Archive tabs (and the minimize toggle). Still referenced via the (unused-for-section-titles) `.sectionTitleBlue` rule and the completed header definition comment history — both currently resolve to foreground.
- `var(--foreground)`: section titles, Completed header, task text.

## Files touched

- `src/components/EventList.tsx` — JSX reorders, click handlers on `.taskContent` and rhei addendum, daily task render split, `"rhei"` button label → `Now`, `"Archived"` → `"Over The Horizon"` in `renderSection` call, minimize toggle added inside `.tabs`, pomodoro block moved and restructured.
- `src/components/EventList.module.css` — everything above.

No other files (no `globals.css`, no page.tsx, no api routes) were touched.

## How to apply in the other instance

1. Open `src/components/EventList.module.css` and `src/components/EventList.tsx`.
2. Apply the CSS rule changes one section at a time — the selectors listed above are the entire surface area.
3. Apply the JSX changes:
   - `handleToggleDailyTask` click handler on `.taskContent` and on the rhei addendum `<span className={styles.rheiAddendumText}>`.
   - Replace the old `tasksForSelectedDate.filter(...).map(...)` render with the split incomplete/completed version plus the `.completedHeader` row + inline toggle. Remove the old standalone `.clearCompletedBtn` block.
   - Rename `rhei` tab text to `Now` (keep the state key `'rhei'`).
   - Rename the `Archived` section call to `"Over The Horizon"`.
   - Restructure the pomodoro block: timeline first, then header row (title+duration left, controls right), then task label, then task-picker `AnimatePresence`. Move the whole block to sit just above `<div className={styles.dailyTasksSection}>`.
   - Add the `| / –` minimize button as a third child of `<div className={styles.tabs}>`, wired to `minimized` / `minimizedLockedRef`.
4. Run `npx tsc --noEmit` to verify.

## Known follow-ups (not done)

- Two sections now share the title "Over The Horizon": the overdue-active section and the renamed-from-Archived section. Decide whether to rename one.
- The old header-bar minimize button (`<Minus size={20} />` in `.headerActions`) is redundant with the new inline tab toggle. Probably should be removed.
- Several buttons outside the task calendar still use underline styling (`.link`, form submit/cancel, archive complete/incomplete/delete, garden save). If the user wants the whole app typographic, those should follow.
