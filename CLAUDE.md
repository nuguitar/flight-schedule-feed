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
    ├── view-daily.js          # DAY GLANCE view — single-day comprehensive dashboard
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

```
GitHub Actions (cron */30 * * * *)
  └─ fetch_schedule.py
       └─ validate_raw_cache()        ← hard-fail on schema break; data not saved if errors
       └─ normalize_entry() × N       ← sentinel cleanup, derived booleans, durationMin
       └─ write data/flight_schedule.json
  └─ generate_flight_data.py
       └─ transform()                 ← renames fields, strips actuals from non-Completed
       └─ write flight-data.js        ← window.FLIGHT_DATA consumed by React dashboard
  └─ git commit & push
  └─ GitHub Pages deploy
```

### Stage 1 — `data/flight_schedule.json`

Intermediate source-of-truth. Written by `fetch_schedule.py`; read by `generate_flight_data.py`. Do not edit manually.

```json
{
  "fetched_at": "2026-05-12T18:50:57Z",
  "timezone":   "Asia/Bangkok",
  "schedules":  { "2026-05-12": [ {…} ], … },
  "instructors": […],
  "resources":  […],
  "leaves":     […]
}
```

Every schedule entry has exactly these fields:

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | String form of `rowIdx`; `ACTUAL_ONLY_<n>` for unplanned flights |
| `date` | `string` | `YYYY-MM-DD` — duplicated inside entry for flat-list querying |
| `rowIdx` | `number\|string` | `number` for scheduled entries; `string` (`ACTUAL_ONLY_<n>`) for unplanned flights |
| `status` | `string` | `"Pending"` · `"Completed"` · `"Canceled"` |
| `isActual` | `boolean` | `true` when post-flight actuals are recorded |
| `isSimulator` | `boolean` | `true` when `type` contains `"(SIM)"` |
| `isStandby` | `boolean` | `true` when source condition contained `"(Standby)"` — suffix stripped from `condition` |
| `start` | `string` | Scheduled start `HH:MM` (Asia/Bangkok) |
| `end` | `string` | Scheduled end `HH:MM` (Asia/Bangkok) |
| `duration` | `string\|null` | Display string `"H…:MM"`. `null` if absent |
| `durationMin` | `number\|null` | Total minutes (e.g. `180`). `null` if duration absent |
| `student` | `string\|null` | `null` when source was `"-"` |
| `instructor` | `string\|null` | `null` when source was `"-"` |
| `batch` | `string` | e.g. `"AP-127"` |
| `lesson` | `string` | Lesson code or label |
| `condition` | `string\|null` | Flight condition after `"(Standby)"` stripping. `null` if empty |
| `type` | `string\|null` | Aircraft type. `null` if absent |
| `tail` | `string\|null` | Registration e.g. `"HS-TPW"`. `null` if unassigned |
| `actualType` | `string\|null` | `"Dual"` · `"Solo"` · `"SPIC"`. `null` if not flown |
| `tkoff` | `string\|null` | Actual take-off `HH:MM`. `null` if not flown |
| `ldgTime` | `string\|null` | Actual landing `HH:MM`. `null` if not flown |
| `airborne` | `string\|null` | Actual airborne `"H…:MM"`. `null` if not flown |
| `ldg` | `number` | Landing count (0 if not flown) |
| `to` | `number` | Take-off count (0 if not flown) |
| `inst` | `number` | Instrument approaches (0 if not flown) |

**Normalization rules** (`fetch_schedule.py → normalize_entry`):

| Raw source value | Normalized to |
|---|---|
| `"-"` in any string field | `null` |
| `""` in `actualType`, `condition`, `type` | `null` |
| `rowIdx` numeric string `"3105"` | `number` `3105` |
| `rowIdx` `"ACTUAL_ONLY_*"` | kept as `string` |
| `condition` ending `" (Standby)"` | suffix stripped; `isStandby: true` |
| `type` containing `"(SIM)"` | `isSimulator: true` |
| Unknown `status` | defaulted to `"Pending"` |

**Upstream schema validation** (`validate_raw_cache`) — runs before normalization:

| Severity | Check |
|---|---|
| **Hard error** (data not saved) | Missing top-level keys; missing required entry fields; `isActual` not bool; `ldg`/`to`/`inst` not int; malformed `duration` or `start`/`end` format |
| **Warning** (logged to stderr) | New top-level or entry fields; unknown `status` values; unexpected `rowIdx` format |

**Known source quirks:**

| Quirk | Explanation |
|---|---|
| `rowIdx = "ACTUAL_ONLY_<n>"` | Unplanned flights logged post-hoc; no scheduled slot. Multiple entries can share the same token. |
| `tail = null` | Aircraft not yet assigned (standby entries, classroom slots) |
| `student = null` | Meetings or slots without a named student |
| Duplicate `ACTUAL_ONLY_` ids | Source limitation; unfixable without upstream changes |

---

### Stage 2 — `flight-data.js`

Auto-generated by `generate_flight_data.py`. Exposes `window.FLIGHT_DATA`. **Do not edit directly.**

```js
window.FLIGHT_DATA = {
  fetchedAt:   "2026-05-12T18:50:57Z",
  tz:          "Asia/Bangkok",
  flights:     [ … ],   // flat array across all dates
  instructors: [ … ],
  resources:   [ … ],
  leaves:      [ … ]
}
```

Field mapping from `flight_schedule.json` → `flight-data.js`:

| `flight-data.js` | `flight_schedule.json` | Notes |
|---|---|---|
| `id` | `id` / `rowIdx` | `isActual` entries without `ACTUAL_ONLY_` prefix get it added |
| `date` | `date` | |
| `status` | `status` | |
| `isSim` | `isSimulator` | renamed |
| `isStandby` | `isStandby` | |
| `start` | `start` | |
| `end` | `end` | |
| `durMin` | `durationMin` | renamed; recalculated from `duration` if absent |
| `duration` | `duration` | |
| `student` | `student` | |
| `instructor` | `instructor` | |
| `batch` | `batch` | |
| `lesson` | `lesson` | |
| `cond` | `condition` | renamed |
| `type` | `type` | |
| `tail` | `tail` | |
| `tkoff`, `ldgTime`, `airborne`, `to`, `ldg`, `inst` | same | **Completed flights only**; omitted if null |

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

| Token | Cockpit (dark) | Light | Warm (dark amber) |
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

### 0 — DAY GLANCE (`view-daily.js`)
Comprehensive single-day dashboard — the default landing view. Summarizes every
aspect of one date (defaults to today via `localToday()`, changeable via `DateStrip`).
- **Date hero**: large day number + month/year/weekday, amber-glow border when viewing today
- **Hero KPI strip**: TOTAL · COMPLETED (+rate) · PENDING (+standby) · CANCELED · HOURS (flown/planned) · SIM · A/C USED · INSTR · ◆ AP-127 — overlapping counters, consistent with BOARD's stat tiles
- **Schedule Pulse**: hourly bar chart 06–21; AP-127 portion overlaid in highlight color
- **Status Mix**: SVG donut + legend — mutually-exclusive buckets (sim → standby → completed → canceled → pending precedence, matches `STATUS_COLOR`) so slices sum to total
- **Batch Breakdown**: per-batch stacked status bars; AP-127 pinned first
- **Instructor Load** / **Aircraft Fleet**: ranked utilization bars with completion %
- **◆ AP-127 SPOTLIGHT** (full-width, highlight accent): dedicated section — AP-127 KPIs, AP-127-vs-school completion-rate comparison bars, today's AP-127 flight roster (click row → Drawer), and lesson chips for lessons in progress
- Self-contained: inlines its own `DailyDonut`, `DKPI`, `Section`, `StackBar` components; no `FocusControls` (always shows everything + has its own AP-127 section)

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
- TAIL focus sorts rows by aircraft type first, then alphabetically by tail number
- Clicking a bar opens Drawer

### C — WEEKLY (`view-weekly.js`)
Dates grouped into Mon-Sun calendar weeks; one week shown at a time with prev/next nav.
- Week navigation bar: `‹ PREV` · week label (`DD – DD MMM YYYY`) · `NEXT ›` · WK N/total
- Current week's dates shown as equal-width grid columns (CSS grid `repeat(N, 1fr)`)
- Each column header shows date + P/C/X/S counts + TODAY/PAST badge
- Cards show time · batch · student · tail
- `buildWeeks(dates)` helper groups ALL_DATES by Mon boundary
- Defaults to the week containing today (or nearest future week)

### D — ANALYTICS (`view-summary.js`)
Aggregate stats with date-range filter (default: last 7 days → today).
- **SumTiles**: TOTAL · PENDING · COMPLETED · CANCELED · STANDBY · SIM
- **AP BATCH COMPARISON**: SVG donut chart, AP-xxx batches only
  - AP-127 always gets `var(--highlight)` (pink); other batches use `BATCH_COLORS[]` (no pink)
  - `BATCH_COLORS`: blue · green · amber · red-orange · teal · purple · mint
- **◆ AP-127 STUDENTS**: All cohort members seeded from full `FLIGHTS` (0-hr students appear); sorted by barMode metric
- **Bar mode toggle**: `# FLIGHTS` | `HOURS` chips — controls sort order + bar widths for all breakdowns
  - Bar container width ∝ selected metric; inner coloured segments flex-proportional to status flight counts
- **BATCH BREAKDOWN** / **INSTRUCTOR BREAKDOWN** / **STUDENT BREAKDOWN**: sorted by active metric

### E — ROSTER (`view-roster.js`)
**PM tool** — workload heat-map.
- Rows: instructors, batches, **or students** (toggle VIEW chip: INSTRUCTOR · BATCH · STUDENT)
- **◆ AP-127 ONLY** filter chip — shows only AP-127 rows and date totals
- Columns: ALL_DATES
- Cell color = load: green (1 flt) · amber (2–3) · red (4+)
- ◆ badge on cells with AP-127 flights
- DAILY TOTAL footer row (respects AP-127 only filter)
- Respects `highlightAP127` / `hideOthers` (opacity dimming)
- Sticky first column + sticky header row
- **Click cell → inline detail overlay** listing all flights for that row × date
  - Each flight shows time, student/instructor, lesson, tail, STBY badge
  - Tap flight in overlay → sets date + opens global Drawer
  - Click backdrop or ✕ to dismiss

---

## Shared Components (app-shared.js)

| Component | Description |
|-----------|-------------|
| `ThemeStyle` | Injects CSS custom-property theme rules |
| `ArtboardShell` | Wrapper div: `position:relative; width/height:100%` |
| `DateStrip` | Horizontal date pill selector; collapsible (collapsed by default on mobile) |
| `FilterBar` | SEARCH + BATCH + INSTRUCTOR + AIRCRAFT + STATUS dropdowns |
| `FocusControls` | Compact `◆ AP-127` + `HIDE` chips — used in every view header (top-right) |
| `ViewIcon` | SVG icon per view id: `daily` · `board` · `gantt` · `weekly` · `summary` · `roster` |
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
localToday()       // "YYYY-MM-DD" in local (Bangkok) time — use this, never new Date().toISOString().slice(0,10)
minutesOf(hhmm)    // "06:30" → 390
fmtDay(dateStr)    // "2026-05-12" → { wd:"MON", mo:"MAY", day:12, y:2026 }
fmtHM(hhmm)        // identity or "—"
isPast(dateStr)    // bool (uses localToday())
isToday(dateStr)   // bool (uses localToday())
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
        {view === 'daily'   → <DailyBoard/>}
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
| 8 | Gantt row cleanup (no FLT sub-label); ROSTER heat-map view; AP-128 color fix; 1-week default date range in Analytics; last-update two-line fix on mobile |
| 9 | Gantt TAIL sort by aircraft type then alpha; Weekly week-by-week pagination (Mon-Sun, prev/next nav); Analytics barMode toggle (# flights vs hours), AP-127 0hr student seeding, all breakdowns sorted by active metric; Roster student groupBy, ◆ AP-127 ONLY filter, cell-click inline detail overlay |
| 10 | **Bug fixes + UX polish:** `localToday()` helper replaces all `new Date().toISOString().slice(0,10)` usages (fixes Bangkok midnight off-by-one in Board, Roster, Weekly, Analytics, DateStrip); "board" theme renamed to "warm" (no longer clashes with BOARD view name); localStorage persistence for last-used theme and view; view descriptions shown under active nav label in sidebar; Board sort-column hover affordance + title tooltips; FocusControls tooltip hints |
| 11 (latest) | **New DAY GLANCE view** (`view-daily.js`): comprehensive single-day dashboard — date hero, hero KPI strip, hourly Schedule Pulse chart, Status Mix donut, Batch Breakdown, Instructor Load + Aircraft Fleet utilization, and a dedicated full-width AP-127 Spotlight (KPIs, AP-127-vs-school completion comparison, flight roster, lesson chips). Added as the first tab and the new default landing view; new `daily` ViewIcon (sun glyph). Stale-localStorage view guard added in `App`. |
