# AP127 Command Center — Project Reference

> **Keep this file updated** after every significant change.  
> GitHub repo: `https://github.com/nuguitar/AP127_Command_Center`  
> Live URL: `https://nuguitar.github.io/AP127_Command_Center/`

---

## Project Purpose

A real-time flight-schedule dashboard for a flight training academy.  
Highlights batch **AP-127** (the "focus" cohort) across five views:  
Board · Gantt · Weekly · Analytics · Roster.

Data is scraped every 30 minutes via GitHub Actions → committed to the repo → deployed to GitHub Pages automatically.

---

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Runtime | React 18 (CDN UMD) | No build step; loaded via `unpkg.com` |
| Transpiler | Babel Standalone 7.29 | `<script type="text/babel">` in-browser |
| Fonts | Inter + JetBrains Mono | Google Fonts |
| Scraper | Playwright (Python 3.11) | Headless Chromium |
| CI/CD | GitHub Actions | Cron every 30 min, deploys Pages |
| Hosting | GitHub Pages | Serves repo root as static site |

---

## File Structure

```
/
├── index.html                  # Shell: App component, Sidebar, MobileTopBar, VIEWS array
├── flight-data.js              # AUTO-GENERATED — do not edit (run generate_flight_data.py)
├── requirements.txt            # playwright>=1.50.0
├── .github/workflows/          # fetch-and-deploy.yml — cron + Pages deploy
├── data/
│   └── flight_schedule.json   # Raw scraped data (source of truth)
├── scripts/
│   ├── fetch_schedule.py      # Playwright scraper → data/flight_schedule.json
│   └── generate_flight_data.py # Transforms JSON → flight-data.js
└── js/
    ├── app-shared.js          # Context, helpers, shared components
    ├── view-board.js          # BOARD view — sortable ops table
    ├── view-gantt.js          # GANTT view — timeline bars
    ├── view-weekly.js         # WEEKLY view — date columns with cards
    ├── view-summary.js        # ANALYTICS view — stats, pie chart, breakdowns
    └── view-roster.js         # ROSTER view — instructor × date heat-map
```

> `js/view-mobile.js` exists but is **unused** (replaced by responsive layout in Round 5+).

---

## Architecture Patterns

### No-build React
- All scripts loaded via CDN `<script>` tags in `index.html`
- View files use `type="text/babel"` and export via `window.*`
- `index.html` inline `<script type="text/babel" data-presets="env,react">` boots the app
- Load order matters: `app-shared.js` → all views → `index.html` inline script

### Global exports pattern
Every view/shared file attaches its components to `window`:
```js
// app-shared.js
Object.assign(window, { AppCtx, AppProvider, useApp, ThemeStyle, ... });

// view-board.js
window.OpsBoard = OpsBoard;
```

### `useMemo` aliasing per file (avoid name collisions)
```js
const { useMemo: useM_b } = React;   // view-board.js
const { useMemo: useM_g } = React;   // view-gantt.js
const { useMemo: useM_w } = React;   // view-weekly.js
const { useMemo: useM_s, useState: useS_s } = React;  // view-summary.js
const { useMemo: useM_r, useState: useS_r } = React;  // view-roster.js
```

### AppContext (app-shared.js)
Central state provided by `<AppProvider>` in `index.html`:

| Key | Type | Description |
|-----|------|-------------|
| `date` | string | Selected date (YYYY-MM-DD) |
| `setDate` | fn | Change selected date |
| `filters` | object | `{ batch, instructor, tail, status, search }` |
| `setFilters` | fn | |
| `drawer` | string\|null | Flight ID shown in slide-over Drawer |
| `setDrawer` | fn | |
| `highlightAP127` | bool | AP-127 focus mode |
| `setHighlightAP127` | fn | |
| `hideOthers` | bool | Show only AP-127 flights |
| `setHideOthers` | fn | |
| `tweaks` | object | `{ theme, showSim, showStandby, groupBy }` |
| `setTweak` | fn | `setTweak(key, value\|updaterFn)` |
| `dayFlights` | array | Flights for selected date, filtered |
| `flightById` | fn | `id => Flight\|undefined` |
| `isMobile` | bool | True if phone/small viewport |

### Mobile detection
```js
// In App component (index.html)
const isMobile = windowW < 768 || (windowW < 1100 && windowH < 560);
```
Handles both portrait AND landscape phones (landscape width > 768 but height < 560).

---

## Data Pipeline

### Source: `data/flight_schedule.json`
```json
{
  "fetched_at": "2026-05-12T18:50:57Z",
  "timezone": "Asia/Bangkok",
  "schedules": {
    "2026-05-12": [ { flight objects... } ],
    ...
  },
  "instructors": [...],
  "resources": [...],
  "leaves": [...]
}
```

### Raw flight fields (from scraper)
```
id, date, rowIdx, status, isActual, isSimulator, isStandby,
start, end, duration, durationMin, student, instructor,
batch, lesson, condition, type, tail, actualType,
tkoff, ldgTime, airborne, ldg, to, inst
```

### Transformed fields in `flight-data.js`
```
id, date, status, isSim, isStandby, start, end, durMin, duration,
student, instructor, batch, lesson, cond, type, tail
```
**Completed flights only** also get:
```
tkoff, ldgTime, airborne, to (takeoff count), ldg (landing count), inst (instrument approaches)
```

### Key constants (app-shared.js)
```js
const FLIGHTS         = window.FLIGHT_DATA.flights;
const HIGHLIGHT_BATCH = 'AP-127';
const ALL_DATES       = [...];   // every calendar day between first and last flight
const DEFAULT_DATE    = ...;     // today if in range, else nearest future date
```

---

## Themes

Three themes via CSS custom properties on `body[data-theme="..."]`:

| Token | Cockpit (dark) | Light | Board (dark warm) |
|-------|----------------|-------|-------------------|
| `--bg` | near-black | near-white | jet black |
| `--col-pending` | amber | dark amber | bright amber |
| `--col-done` | green | dark green | bright green |
| `--col-cancel` | red-orange | dark red | bright red |
| `--col-sim` | pink/magenta | dark magenta | bright pink |
| `--col-stby` | blue | dark blue | bright blue |
| `--highlight` | pink (AP-127) | dark pink | bright pink |

Color space: `oklch()` + `color-mix(in oklch, ...)` throughout.

---

## Views

### A — BOARD (`view-board.js`)
Sortable table of all flights for selected date.
- Columns: STATUS · BATCH · STUDENT · INSTRUCTOR · LESSON · START · DUR · END · A/C · TAIL
- Stat hero tiles: TOTAL · PENDING · COMPLETED · CANCELED · AP-127 · STANDBY · SIM
- DateStrip + FilterBar above table
- FocusControls (◆ AP-127 + HIDE) in header top-right

### B — GANTT (`view-gantt.js`)
Timeline bars for selected date, grouped by INSTRUCTOR / TAIL / BATCH.
- `FOCUS` label (renamed from "GROUP") with chip toggle
- Default group: **instructor**
- Time ruler: 06:00 – 18:00
- Track widths responsive: 190/180px desktop → 90/64px mobile
- Right column: DUTY PERIOD (instructor) or FLT HRS (tail/batch)
- Clicking a bar opens Drawer

### C — WEEKLY (`view-weekly.js`)
All dates as columns; flight cards scrollable per column.
- Each column header shows date + P/C/X/S counts
- Cards show time · batch · student · tail
- Horizontal scroll; columns are 192px wide

### D — ANALYTICS (`view-summary.js`)
Aggregate stats with date-range filter (default: last 7 days → today).
- **SumTiles**: TOTAL · PENDING · COMPLETED · CANCELED · STANDBY · SIM
- **AP BATCH COMPARISON**: SVG donut chart, AP-xxx batches only
  - AP-127 always gets `var(--highlight)` (pink); other batches use `BATCH_COLORS[]` (no pink)
  - `BATCH_COLORS`: blue · green · amber · red-orange · teal · purple · mint
- **◆ AP-127 STUDENTS**: Breakdown bar chart for AP-127 cohort
- **BATCH BREAKDOWN**: All batches bar chart
- **INSTRUCTOR BREAKDOWN**: All instructors bar chart
- **STUDENT BREAKDOWN**: All students bar chart

### E — ROSTER (`view-roster.js`)
**PM tool** — workload heat-map.
- Rows: instructors (or batches, toggle VIEW chip)
- Columns: ALL_DATES
- Cell color = load: green (1 flt) · amber (2–3) · red (4+)
- ◆ badge on cells with AP-127 flights
- DAILY TOTAL footer row
- Respects `highlightAP127` / `hideOthers` (opacity dimming)
- Sticky first column + sticky header row
- Click cell → sets date (for Gantt/Board cross-navigation)

---

## Shared Components (app-shared.js)

| Component | Description |
|-----------|-------------|
| `ThemeStyle` | Injects CSS custom-property theme rules |
| `ArtboardShell` | Wrapper div: `position:relative; width/height:100%` |
| `DateStrip` | Horizontal date pill selector; collapsible (collapsed by default on mobile) |
| `FilterBar` | SEARCH + BATCH + INSTRUCTOR + AIRCRAFT + STATUS dropdowns |
| `FocusControls` | Compact `◆ AP-127` + `HIDE` chips — used in every view header (top-right) |
| `ViewIcon` | SVG icon per view id: `board` · `gantt` · `weekly` · `summary` · `roster` |
| `Drawer` | Slide-over flight detail panel (right side, 380px wide) |
| `StatusPill` | Colored rounded status badge |
| `StandbyTag` | Dashed STBY badge |
| `FlightDot` | 7px colored square dot |
| `ConditionTag` | Small condition text pill |
| `Tag` | Generic text badge |
| `HighlightBar` | Left-edge highlight stripe for AP-127 rows |
| `InlineSettings` | Legacy settings bar — exported but no longer used in any view |

### Drawer — Completed flight rows
For `status === 'Completed'`, shows two additional rows:
- **ACTUAL TIMES**: `tkoff` (T/O time) · `ldgTime` (LDG time) · `airborne` (duration)
- **T/O · LDG · INST**: `to` count · `ldg` count · `inst` count

### Helper functions
```js
minutesOf(hhmm)    // "06:30" → 390
fmtDay(dateStr)    // "2026-05-12" → { wd:"MON", mo:"MAY", day:12, y:2026 }
fmtHM(hhmm)        // identity or "—"
isPast(dateStr)    // bool
isToday(dateStr)   // bool
STATUS_COLOR(f)    // returns CSS var string
flightAlpha(f, hlOn) // 0.22 if dimmed, 1.0 otherwise
```

---

## Layout (index.html App component)

```
<AppProvider>
  <ThemeStyle/>
  <div flex row height:100%>

    [DESKTOP only]
    <Sidebar width=sidebarW/>          ← persistent, drag-resizable 180–360px
    <ResizeHandle 5px cursor:ew-resize/>

    [MOBILE only, when sidebarOpen]
    <Backdrop/>
    <Sidebar mobile onClose/>          ← fixed overlay, 256px wide

    <main flex:1 column>
      [MOBILE only] <MobileTopBar/>    ← hamburger + wordmark + current view icon/label
      <ViewContainer flex:1>
        {view === 'board'   → <OpsBoard/>}
        {view === 'gantt'   → <GanttBoard/>}
        {view === 'weekly'  → <WeeklyBoard/>}
        {view === 'summary' → <SummaryBoard/>}
        {view === 'roster'  → <RosterBoard/>}
      </ViewContainer>
    </main>

  </div>
</AppProvider>
```

### Sidebar sections (both desktop and mobile overlay)
1. Wordmark: green pulse dot · "AP127 CMD" · ✕ (mobile only)
2. Nav: A–E buttons with `ViewIcon` + label
3. Settings: THEME chips (COCKPIT · LIGHT · BOARD)
4. Flex spacer
5. Footer: "LAST UPDATE · TH" + `formatTH(fetchedAt)` + timezone

> **AP-127 FOCUS** and **HIDE OTHERS** were moved OUT of the sidebar into each view's header (`FocusControls` component).  
> **SIM** and **STBY** toggle chips were removed entirely.

---

## Styling Conventions

```css
.mono  { font-family: 'JetBrains Mono', monospace; }
.num   { font-variant-numeric: tabular-nums; }
.uc    { text-transform: uppercase; letter-spacing: 0.06em; }
```

Scrollable flex-column pattern (prevents height-collapse bug):
```jsx
{/* Outer: scroll container */}
<div style={{ flex:1, minHeight:0, overflowY:'auto' }}>
  {/* Inner: content layout */}
  <div style={{ display:'flex', flexDirection:'column', gap:16, padding:'10px' }}>
    {/* ... content ... */}
  </div>
</div>
```

---

## Local Development

```bash
# Start local server (from project root)
python3 -m http.server 7420
# Open http://localhost:7420/

# Refresh data from live source
python3 scripts/fetch_schedule.py
python3 scripts/generate_flight_data.py

# Or use Claude Code preview (launch.json already configured at .claude/launch.json)
```

The `.claude/launch.json` runs `python3 -m http.server 7420` from the project root.

---

## Data Refresh Flow

```
GitHub Actions (cron */30 * * * *)
  └─ fetch_schedule.py          → data/flight_schedule.json
  └─ generate_flight_data.py    → flight-data.js
  └─ git commit & push
  └─ GitHub Pages deploy
```

When pushing local changes that conflict with a data commit:
```bash
git pull --rebase origin main   # rebase over the data commit
# If conflict on flight-data.js:
git checkout --theirs flight-data.js
python3 scripts/generate_flight_data.py
git add flight-data.js
GIT_EDITOR=true git rebase --continue
git push origin main
```

Cache-busting: `index.html` loads `flight-data.js?v=<timestamp>` to prevent browsers from serving stale data.

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| No build step (CDN React + Babel) | Zero toolchain setup; pure static files; GitHub Pages compatible |
| `window.*` exports | Only way for multiple `text/babel` scripts to share components |
| `useMemo` aliasing per file | Avoids `useMemo` redeclaration conflicts across script tags |
| `oklch()` color space | Better perceptual uniformity for status colors; `color-mix(in oklch, ...)` for tints |
| AP-127 always uses `var(--highlight)` | Never shares palette index with other batches — ensured by separate `colorIdx` counter |
| Flex scroll anti-pattern fix | `flex:1, minHeight:0, overflowY:auto` on outer + non-flex inner prevents children shrinking instead of scrolling |
| isMobile uses both width AND height | Catches landscape phones (width > 768 but height < 560) |
| ROSTER view as PM tool | Only view showing cross-day utilization at a glance — essential for scheduling |

---

## Rounds Summary

| Round | Key Changes |
|-------|-------------|
| 1–4 | Initial implementation: Board, Gantt, Weekly, Analytics views; GitHub Pages deploy; basic AP-127 highlighting |
| 5 | Analytics scroll fix; Gantt time grid 06–18; Instructor breakdown; resizable panels (vertical — later removed) |
| 6 | Replaced NavBar with persistent Sidebar; removed Mobile tab; added hamburger overlay; sidebar drag-resize; collapsible DateStrip; AP-127 FOCUS moved to sidebar; TH last-update time |
| 7 (Round 7 in session) | LDG/TO/INST in Drawer; SVG view icons; FocusControls moved to view headers; remove SIM/STBY chips from sidebar; Gantt "FOCUS" label + instructor default; Analytics donut chart + AP batch colors; mobile landscape fix; padding reduction |
| 8 (latest) | Gantt row cleanup (no FLT sub-label); ROSTER heat-map view; AP-128 color fix; 1-week default date range in Analytics; last-update two-line fix on mobile |
