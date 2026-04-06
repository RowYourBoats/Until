# Task-Based Calendar

A personal productivity system built around the concept of **horizons** — projects and commitments organized by temporal proximity. Rather than treating time as a grid of slots, this app treats it as a landscape of approaching deadlines, daily rituals, and focused work sessions.

## Philosophy

The app is designed around a few core ideas:

- **Horizons, not calendars.** Projects are grouped by how soon they matter: *Short Horizon* (imminent), *Horizon* (weeks to months), *Long Horizon* (six months+), and *Over The Horizon* (overdue). Minimized mode strips away everything except what's urgent.
- **Rhei (flow).** Recurring practices — things you want to engage with regularly — are tracked not as rigid schedules but as daily choices. Tap to engage, add sub-tasks as the work reveals itself.
- **Pomodoro with intent.** A 35-minute timer that ties each session to a specific task or project. Sessions end with an honest outcome: completed, fresh start, postponed, or force majeure.
- **Gardening.** A ritual for reviewing all active projects one by one — updating descriptions, next actions, and to-dos. The app tracks whether you've gardened today.

## Tech Stack

- **Next.js 14** with React 18 and TypeScript
- **CSS Modules** with CSS variables for light/dark theming
- **Framer Motion** for layout animations
- **File-based JSON storage** — no database, just flat files in `/data/`
- **Lucide** for iconography

## Data

All data lives in the `/data/` directory as JSON files:

| File | Contents |
|------|----------|
| `events.json` | Horizons (projects) with due dates, tags, to-dos |
| `daily-tasks.json` | Date-specific tasks, optionally linked to horizons or Rhei items |
| `rhei.json` | Recurring engagement items with daily engagement history |
| `pomodoro-sessions.json` | Timer session log with outcomes |
| `workouts.json` | Workout timestamps |

Project folders are managed in `/projects/` with subdirectories for active, completed, incomplete, and trashed items.
