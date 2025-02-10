# Focus — Personal Productivity Dashboard

A clean, offline-capable productivity dashboard built with vanilla HTML, CSS, and JavaScript.
No build tools. No frameworks. Open `index.html` and go.

---

## Features

| Widget | Details |
|---|---|
| **Task Manager** | Add tasks with priority (High / Medium / Low) and optional due dates. Filter by All / Active / Done. Overdue highlighting. Persisted to localStorage. |
| **Pomodoro Timer** | 25-min work / 5-min break cycles. Circular SVG ring progress. Session pip counter. Browser notifications. Tab title countdown. |
| **Notes** | Freeform textarea with 600 ms debounced auto-save. Saved indicator feedback. |
| **Daily Quote** | Fetched from `api.quotable.io` on load with a local fallback pool for offline use. |
| **Stats Bar** | Live counts of tasks completed today, pomodoros, total focus time, and active tasks. |
| **Dark / Light Mode** | Respects `prefers-color-scheme` on first visit. Persisted to localStorage on toggle. Zero-flash theme application. |

---

## File Structure

```
productivity-dashboard/
├── index.html
├── css/
│   ├── tokens.css       # Design tokens (colours, type scale, spacing, shadows)
│   ├── layout.css       # CSS Grid dashboard layout + responsive breakpoints
│   └── components.css   # Widget, button, form, and UI component styles
├── js/
│   ├── tasks.js         # TaskManager module
│   ├── timer.js         # PomodoroTimer module
│   ├── notes.js         # Notes module
│   ├── quotes.js        # Quotes module (API + fallback)
│   ├── stats.js         # Stats module
│   └── app.js           # Entry point — init + dark mode
└── README.md
```

---

## Running Locally

```bash
# Option A — just open the file
open index.html

# Option B — local dev server (avoids any browser fetch restrictions)
npx serve .
# or
python3 -m http.server 8080
```

---

## Design System

- **Palette**: Warm slate base (`#f5f3ef` light / `#151412` dark) with amber accent (`#f59e0b`)
- **Display font**: Syne (geometric, editorial)
- **Mono font**: DM Mono (timer, badges, metadata)
- **Body font**: Literata (readable, humanist serif)
- **Grid**: 3-column (tasks span 2) → 2-column (≤1024px) → single column (≤768px)

---

## Architecture

All modules use the **revealing module pattern** — immediately invoked function
expressions (IIFEs) that return a clean public API, exposing no implementation
details to global scope beyond their single global variable (`TaskManager`, etc.).

Modules communicate via:
- **Custom DOM events** (`taskchange`, `pomodorocomplete`) — loose coupling, no imports
- **Direct init-time wiring** in `app.js`

---

## Roadmap (Days 2–5)

- [ ] Day 2: Quotes widget polish, keyboard shortcuts, drag-to-reorder tasks
- [ ] Day 3: Data export (JSON), task categories / tags
- [ ] Day 4: Weekly stats chart (Canvas), streaks
- [ ] Day 5: PWA manifest + service worker for full offline support
