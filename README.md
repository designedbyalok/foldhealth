# Fold Health — TOC Worklist Platform

A comprehensive healthcare operations platform for Transitional Care Organizations (TCOs), built to coordinate multi-agent patient outreach, track care management goals, monitor population health analytics, and manage AI-powered care workflows.

## Overview

This is a **production-grade prototype** of Fold Health's care coordination platform. It provides clinicians, care managers, and administrators with tools to manage post-discharge follow-ups, chronic disease programs, quality measure tracking, and AI agent orchestration — all from a single unified interface.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 |
| Build | Vite 8 |
| Package Manager | Bun 1.2 |
| State | Zustand 5 |
| Routing | Custom hash-based router |
| Styling | Tailwind CSS 4 + CSS Modules |
| UI Primitives | Radix UI |
| Icons | Solar (via Iconify) |
| Charts | Recharts |
| Flow Editor | XYFlow |
| Database | Supabase (PostgreSQL) |
| Analytics | Vercel Analytics + Speed Insights |

## Getting Started

```bash
bun install
bun run dev
```

The app runs at `http://localhost:5173`. Navigate to `/#/population/worklist` (default) or use the sidebar to explore other sections.

## Application Structure

```
src/
  components/       # Shared UI components (Button, Input, Switch, Drawer, Badge, etc.)
  features/         # Feature modules
    worklist/       # Patient worklist management
    queue/          # Agent assignment queue
    analytics/      # 15+ analytics dashboard views
    agent-builder/  # Visual workflow designer
    settings/       # Admin configuration panels
  store/            # Zustand state management
  lib/              # Router, Supabase client, data mappers
  data/             # Mock/fallback data
  tokens/           # Design tokens (colors, spacing, typography)
```

## Features

### Population Management
- **Worklist** — Master patient roster grouped by status (Ongoing Call, In Queue, Scheduled, Needs Attention, Enrolled)
- **Queue** — Prioritized agent work queue with KPI summary bar
- Search, multi-filter, bulk selection, pagination
- TCPA compliance tracking, recording consent, identity verification

### Analytics (15 Views)
Executive, Population, Financial, Risk, Quality, Utilization, Care Coordination, Network, Shared Savings, ROI Simulator, Tool Usage, Platform Ops, AI Analytics, SDOH, Action Rules — each with period selection, practice filtering, and drill-down capabilities.

### Agent Builder
- Visual node-based workflow designer (XYFlow)
- Conversation nodes, conditional branching, tool integration
- Agent testing/preview via chat panel
- Version history and workflow persistence

### Settings — Agents
- **Agents Table** — List, create, duplicate, delete AI agents with voice configuration
- **Goals** — Multi-step care program goals (TCM, Outreach, Onboarding, Preventive, Billing) with weighted scoring, completion tracking, and a 4-step creation wizard
- **Knowledge Base** — FAQ management for agent training
- **Compliance Policies** — Escalation rules and policy configuration
- **Test Cases / Feature Toggles** — QA and feature flag management

### Settings — Embedded Components
- **Domain Registry** — Whitelist domains for embedded iFrame components with HIPAA compliance tracking, enable/disable toggle, and per-domain audit log
- **Component Library** — Configure embedded UI components (Prior Auth, Risk Dashboard, HEDIS Tracker, etc.) with surface placement (Fold Web, Sidecar, Mobile), JWT context scoping, and a 4-step creation wizard (Identity, Surfaces, Context, Preview)
- **Audit Log Drawer** — Per-entity timeline-based activity history with color-coded action types, month grouping, and filter pills

### Settings — Messages
- Chat group configuration with agent routing rules
- Business hours management per group
- Agent rules drawer for conversation flow control

### Real-Time Features
- Active call monitoring with transfer flows
- System health strip (EHR, Retell, Redis, Supabase status)
- Degraded service banners
- Toast notifications

## Design System

The platform follows the **Fold Health design system** with strict adherence to:

- **Typography** — Inter font family, weights 400/500/600
- **Colors** — Primary purple (#8C5AE2), neutral grey scale, semantic status colors
- **Spacing** — 4px base unit grid
- **Components** — Shared library: Button (8 variants), Input, Switch, Badge, ActionButton, Drawer (700px floating panel), Select (Radix-based popover)
- **Tables** — Edge-to-edge with sticky headers, 12px row padding, hover states
- **Drawers** — All use the shared Drawer component (700px, 8px inset, 16px radius)

## Shared Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `Button` | `src/components/Button/` | Primary, secondary, ghost, danger variants (S/L/XL) |
| `Input` | `src/components/Input/` | Text input matching Figma spec (32px, 0.5px border, 6px radius) |
| `Switch` | `src/components/Switch/` | Toggle control matching Figma spec |
| `Badge` | `src/components/Badge/` | Status and category indicators |
| `ActionButton` | `src/components/ActionButton/` | Icon-only toolbar buttons with tooltip |
| `Drawer` | `src/components/Drawer/` | Floating right-side panel (700px) |
| `Select` | `src/components/ui/select.jsx` | Radix-based dropdown with popover |
| `Icon` | `src/components/Icon/` | Solar icon wrapper via Iconify |
| `ConfirmDialog` | `src/components/Modal/` | Destructive action confirmation |
| `Pagination` | `src/components/Pagination/` | Table pagination controls |

## Data Flow

- **Supabase** is the primary data source (PostgreSQL + real-time)
- **Fallback data** in `src/data/` seeds empty tables on first load
- **Mappers** in `src/lib/` transform DB rows to app objects
- **Zustand store** centralizes all state with session persistence
- **Hash router** syncs URL with store state bidirectionally

## Key Routes

```
/#/population/worklist          — Patient worklist (default)
/#/population/queue             — Agent queue
/#/analytics                    — Executive dashboard
/#/analytics/{view}             — Specific analytics view
/#/builder                      — Agent workflow builder
/#/settings/agents              — Agent management
/#/settings/agents/goals        — Goal management
/#/settings/agents/goals/new    — Goal creation wizard
/#/settings/messages            — Chat/message settings
/#/settings/embedded-components — Domain registry & component library
```

## Recent Changes

### Platform — Bun migration, Help menu update (May 2026)
- **Migrated from npm to Bun** — `packageManager` set to `bun@1.2.23`, `bun.lock` replaces `package-lock.json` as the canonical lock file.
- **Help popover** — added Tasks group (Task List, Kanban Board) to the platform features menu.

### Tasks — Action menus, functional View By/Sort By filters, label click-to-edit (May 2026)
- **Three-dot action menu** on every list row (appears on hover) and kanban card (top-right corner), with contextual options: Mark as Complete/Missed/Pending depending on current status, and Delete (red).
- **Functional View By filter** — groups tasks by Status (default), Priority (High/Medium/Low/None), or Due Date (Overdue/Today/Upcoming/No Due Date).
- **Functional Sort By filter** — sorts tasks within each group by Due Date, Priority, or Name.
- **Labels click-to-edit** — clicking existing labels opens the multi-select dropdown directly; "Add Label" CTA only shows when no labels are assigned.
- **Due Date text color** now matches other secondary columns (`var(--neutral-300)`).

### Tasks — Full Tasks page with preview drawer, Kanban board, and drag-and-drop (May 2026)
- **New Tasks page** (`src/features/tasks/TasksView.jsx`) rendered when `activePage === 'tasks'`. Matches the Figma Tasks design (node `1371:40866`).
- **Top nav tabs** — "Assigned to Me", "My Task Pool", "Created by Me", "Mentions" with count badges and active state styling. Right-aligned action buttons: list/board view toggle, filter, "+ Add Task", pin, settings.
- **Filter bar** — nine filter chips (Assigned to, View By, Sort By, Created By, Members, Task Status, Priority, Due Date, Labels) with dropdown chevrons and a "Clear All" button.
- **Grouped task table** — tasks grouped by status (Pending, Missed, Completed) with collapsible section headers showing task counts and add/collapse action buttons.
- **Task rows** — circular checkbox (green check for completed), task name with hover link, parent task / subtask hierarchy with custom subtask SVG icon, meta line (Care Journey / Automation / By), attachment & comment count badges, priority icons (high/medium/low with color coding), colored status badges, due dates, member with user icon, and label badges with "Add Label" placeholder.
- **Kanban board** — drag-and-drop columns (Pending, Missed, Completed) using `@dnd-kit/core` and `@dnd-kit/sortable`. Cards move between columns with optimistic local state updates and Supabase persistence. Click-vs-drag discrimination via `wasDragging` ref pattern.
- **Task preview drawer** — follows appointment drawer design language. Radix Select status dropdown, hoverable/editable detail fields with negative-margin hover trick, conditional subtask section, click-to-edit rich text description with contentEditable and formatting toolbar (bold, italic, underline, strikethrough, list), activity log with comments and history.
- **Routing** — `src/lib/router.js` now recognizes the `tasks` page (hash `#/tasks`); `Sidebar` adds `'tasks'` to `implementedPages`; `TopBar` shows "Tasks" breadcrumb.
- **Reuses** existing components: `TopBar`, `ActionButton`, `Button`, `Icon`, `Drawer`, `Select`, `Badge`, `Avatar`, and design tokens from `tokens.css`.

### Calls — Full Calls page wired to the sidebar (April 2026)
- **New Calls page** (`src/features/calls/CallsView.jsx`) rendered when `activePage === 'calls'`. Matches the Figma "Build Health Agent Wizard" Calls screen (node `754:67514`).
- **Layout** — reuses the shared `TopBar` (breadcrumb "Calls", search, Ask Unity, notifications, Create New, Schedule, avatar). Below it, a 40 px tabs bar hosts `All | Incoming | Outgoing | Missed | Calling Agents` (Calling Agents active), with right-aligned shortcut/settings action buttons.
- **Left panel (350 px)** — "All Call Lines" dropdown, search + refresh row, scrollable call-history list with direction-coded phone avatars (outgoing/incoming/missed/answered/declined), call-back pins, and a "Dial a Number" block pinned at the bottom with a country-code selector and dial-pad launcher.
- **Main panel** — patient profile banner (72 px avatar, name with external-link glyph, Patient · Male · 31Y (03-29-1992) · (581) 824-1591), a horizontal row of quick actions (Home, Call, Email, Chat, Video, Files, Call history), a `To: +1 25648 84230` subtitle, and a 5-column calls table (Calls | Date & Time | Duration | Out of Office | Actions) with play/transcript/retry/more action buttons per row.
- **Routing** — `src/lib/router.js` now recognizes the `calls` page (hash `#/calls`); `Sidebar` adds `'calls'` to `implementedPages` so the Calls nav item navigates to the new view instead of the coming-soon toast.
- **TopBar** — added a `Calls` breadcrumb branch and suppressed the subnav-toggle button while on the Calls page (same pattern as Messages/Home/Calendar).

### Home Dashboard — Draggable, resizable cards with DB-backed patient list (April 2026)
- **New Home page** (`src/features/home/HomeView.jsx`) rendered when `activePage === 'home'`. Matches the Figma "Dashboard" file (node `3:7795`): toolbar with "View Business Insights" + "Edit Dashboard", and five cards in a grid.
- **Cards**:
  - **Welcome** — greeting banner with dynamic "Good Morning/Afternoon/Evening/Night, {firstName}" (first name from the Supabase auth session's `user_metadata`). Location is resolved from `navigator.geolocation` + OpenStreetMap Nominatim reverse-geocoding (falls back to Rajshahi, Bangladesh). Weather (current temperature in °C + condition label + meteocons icon) is pulled from [Open-Meteo](https://open-meteo.com/) using the resolved coords. Gradient uses `--primary-300` → `--primary-400`. Capped at `maxH: 6` so it never exceeds ~240 px tall.
  - **Alerts & Monitoring** — pulls patients via `fetchPatients()` → Supabase `patients` table; renders initials, name, `Gender · DOB (age)`, and action badges (Missed, Message, Alerts, Tasks) derived from `outreachType`, `readmission`, and `tasks` fields.
  - **Assigned to me** — mock recent interactions (Missed Call, message reply).
  - **Today's Calendar** — full 24-hour day view with 48 thirty-minute slots per day. Hovering a slot highlights it; clicking one opens the shared [`ScheduleDrawer`](src/components/ScheduleDrawer/ScheduleDrawer.jsx) pre-populated with the clicked date/time. Saved appointments are pulled from `useAppStore.appointments` (Supabase `appointments` table) via `fetchAppointments()` and rendered as positioned blocks keyed off `date`/`time_start`/`time_end`. A live red "Now" line (updates every minute) is drawn for the current day. Previous / Today / Next-day arrows in the header navigate days. Card body scrolls vertically when the card is shorter than the 24-hour grid; grid has a 400px min-height.
  - **TASKS** — mock task list with urgent/soon/later/done states.
  - **Quick Notes** — yellow sticky-note cards with URL/text + timestamp.
- **Drag & resize** via [`react-grid-layout/legacy`](https://github.com/react-grid-layout/react-grid-layout) (12-col grid, 40px row height). The package ships v2 as the default export with a new `gridConfig`/`dragConfig` API; we import `react-grid-layout/legacy` for the v1-compatible flat-props API. **Locked by default** — `isDraggable` and `isResizable` are both tied to the edit toggle, the `.home-drag-handle` class is only applied to card headers when editing, and the resize handle is hidden with `opacity: 0; pointer-events: none` in view mode. Clicking "Edit Dashboard" reveals the drag handle on each card header and a resize grip in the bottom-right corner.
- **Persistence** — layout saved to `localStorage` under `home-dashboard-layout-v2` (bumped from v1 when the Welcome card was added). A "Reset" button in edit mode restores the default layout.
- **Routing** — `src/lib/router.js` now recognizes the `home` page (hash `#/home`); `Sidebar` adds `home` to `implementedPages` so the Home nav item navigates instead of showing a coming-soon toast.
- **HelpPopover** — added a "Home / Dashboard" entry to the Platform features directory.

### Help Popover — Platform features directory (April 2026)
- **HelpPopover component** (`src/components/HelpPopover/`) — opens when the Help item in the sidebar is clicked. 400×700px, positioned fixed at `left: 72px; bottom: 16px` so it anchors close to the sidebar.
- **Sticky header** — "Platform features" title with compass icon + close button; the body scrolls beneath it when content exceeds 700px.
- **Feature directory** — groups every implemented feature by top-level section (Population, Analytics, Calendar, Settings). Each row shows an icon, the breadcrumb path (e.g. `Analytics / Risk`), and a one-line description.
- **Deep navigation** — clicking a row sets `activePage`, and where applicable also `activeTab` (TOC Worklist / TOC Queue / HCC), `settingsNavItem` (Agents / Messages / Embedded Components / Account), or `analyticsView` (Executive / Care / Financial / …), then closes the popover.
- **Dismiss** — click-outside or Escape closes the popover; the Help sidebar item shows the active state while open.

### HCC Worklist — Phase 2: DiagPanel side-car + table polish (April 2026)
- **DiagPanel side-car** — pixel-matched to the "HCC-DEMO-SIDE-CAR-New" Figma file (`A8BWt2o8MJkUhZ79Vq1SM0` node `3:582607`). The drawer is 582px wide (overrides the default 700px via `.panel` CSS with `!important`). Opens when a row in the HCC table is clicked; active row highlighted with `--primary-100` + 2px primary-300 left border.
- **Header**: 40px title row `"Diagnosis Gaps Details"` + close button, then a 64px patient banner with a lavender rounded-square avatar (48×48, `#F5F0FF` bg, `#D7C0FF` border, primary-300 initials at 20px), name (16px/500), meta `F · 73y · RAF 4.234` and a green impact pill `0.512 ↑`, and a trailing action group (phone / divider / chat / divider / menu-dots).
- **View by toolbar** (40px) — segmented `HCC / ICD` control plus icon row (refresh / +ICD / verify / filter with red `1` notification dot / sort / history / book / search).
- **HCC Cards** — `HccCard` component with chevron, title, `Open` yellow pill, provider chip (`Robert Langdon ▾`), RAF info with up arrow, optional `Overrides` pill; expands to show a column-header row (`ICD Code & Description | Evidence | Actions`) and ICD rows.
- **IcdRow** — code (dashed-underline purple link) + type tag (`Suspect` purple / `Recapture` blue / `Manual` amber) + likelihood badge (yellow when <75, green when ≥75, derived deterministically from the ICD code) + single-line description, evidence count cell, 24×22 icon buttons (✓ / × / ⋯). All action buttons are no-op for Phase 2 and toast `Coming in Phase 3`.
- **Collapsibles** — `Overridden HCCs >` and `Closed HCCs >` at the bottom of the card list, derived from per-ICD status and dismiss reasons.
- **Mock data ported verbatim** from the HCC prototype: 30 members with 119+ ICD codes (`icds.js` — keyed by `member.name`), ~100 activity entries with a `_default` fallback (`activity.js`), and static stubs for Comments/Documents/Notes/Claims/Outreach/History in `ancillary.js` for future use.
- **Store slice** — `diagPanelOpen`, `diagPanelMemberId`, `diagActiveTab`, `diagDosFilter`, `diagViewMode` + `openDiagPanel(id)` / `closeDiagPanel()` / `setDiagActiveTab` / `setDiagDosFilter` / `setDiagViewMode`.
- **HCC worklist table polish** — renamed "HCC Worklist" → `HCC` in SubNav, added router hash `#/population/hcc` (+ dynamic breadcrumb), TabBar-style header with search / filter / history / export icons (matches TOC WorklistTable), member cell is an exact clone of TOC `.patientCell` (avatar + name + `(F•65y 9m)` + `M-XXXX-XXXX • EN` with hover tooltip `Preferred Language: English`), row height 59px matching TOC, column set now matches the first Figma reference: DOS / Open ICDs / Create Date / HCC Evidence / 5 role columns / Rendering Provider / POS Code + POS Description / RAF Score / RAF Impact / IPA / HP Code / PCP / Decile / Cohort / Risk Level / Advillness / Frailty.
- **Open ICDs hover popover** — hovering the Open ICDs badge in a table row reveals a 360px portal-rendered popover listing that member's open ICD codes (with type/status badges and an "Open diagnosis review →" footer).
- **Carried over components** (still present, no longer mounted in Phase 2): `RoleDots`, `CountsRow`, `ActivityTimeline` — retained for a future phase.

### HCC Worklist — Phase 1: sidebar entry + 100-member sticky table (April 2026)
- **New sidebar entry** — `HCC Worklist` added to SubNav's Shared Lists section, below TOC. Shows count of 100. Selecting it hides the TabBar / FilterBar / QueueSummaryBar (all TOC-specific) and swaps `<WorklistTable>` for `<HccWorklistTable>`.
- **New feature folder** `src/features/hcc/` — `HccWorklistTable.jsx` + `HccWorklistRow.jsx` + CSS modules + `data/mock.js` (100 members ported verbatim from the HCC prototype at `/Users/alokk/Downloads/HCC/hcc_worklist_v2.tsx`; all hex colors mapped to our tokens via a local `C` map, so dark-mode theming works for free).
- **Sticky 23-column table** — member cell pinned left, actions pinned right, middle 21 columns scroll horizontally (DOS, Open ICDs, Create Date, Chart Available, Support Team, Coder, Reviewer 1/2/3, Rendering Provider, Visit Type, RAF Score/Impact, IPA, HP Code, PCP, Decile, Cohort, Risk Level, Advillness, Frailty). Row height stable across scroll. Reuses the sticky pattern from `WorklistRow.module.css`.
- **Store slice** — `hccMembers` / `hccMembersLoading` / `fetchHccMembers` (lazy-imports mock) / `selectedHccIds` / `selectHccMember` / `selectAllHcc` / `clearHccSelected` in `useAppStore.js`, additive to the existing patients slice.
- **Pagination extension** — `Pagination.jsx` is now list-aware: when `activeSubnavList === 'HCC Worklist'` it counts against `hccMembers` + `searchQuery` instead of TOC patients. Existing TOC pagination unchanged.
- **Built-in toolbar search** — the existing TabBar search is hidden for HCC, so the HCC table ships with its own toolbar (title + count + SearchIconButton). Search uses the shared store `searchQuery` and filters by member name / initials / id.
- **Sort via `useTableSort` + `SortableHeader`** — every column except IPA / HP Code / Cohort is sortable.
- **Typography uses inherited `Inter` + existing tokens** — no hardcoded hex in code or data; header 12px, body 13px, `font-variant-numeric: tabular-nums` for RAF / decile / numeric cells.
- **Phase 1 scope** — list-only. Row click is a no-op (wired in Phase 2), no DiagPanel drawer, no accept/dismiss actions, no activity log, no sweep mode. Documented in `/Users/alokk/.claude/plans/lovely-wibbling-milner.md`.

### Agents Table Polish + Unity Chat Avatar (April 2026)
- **Clickable agent names** (`AgentsTable.jsx`) — the Agent Name cell is now a link that opens the builder directly on the Workflow tab. New `.nameLink` hover style in `AgentsTable.module.css` mirrors the existing `.userLink` pattern.
- **Responsive + sticky table** — `.stickyLeft` (Agent Name), `.stickyStatus` (`right: 148px`) and `.stickyRight` (Actions) keep identity and primary actions pinned while middle columns scroll horizontally. Column `min-width` helpers (`.colName`/`.colUseCase`/`.colVersion`/`.colVoice`/`.colUpdated`/`.colUpdatedBy`/`.colStatus`/`.colActions`) force scroll below ~1080px; row height stays constant across scroll.
- **Pencil "Edit Agent" removed** — redundant now that the name is clickable. Actions column is Call Queue · Call Analytics · More Options (3 buttons, 2 dividers). `AGENT_TOUR_STEPS` retargeted from `edit-agent-btn` to `agent-name-link` with "Quick Edit" copy.
- **Voice preview popover** — new `src/components/VoicePreviewPopover/` card (portal + `createPortal`) appears on voice-badge hover. Color-tinted avatar/dot, italic sample line, play button with animated `requestAnimationFrame` progress bar (mock 4s playback), auto-flips up if no room below, stays open while cursor is inside (250ms open / 180ms close delay).
- **Chat bubble color** — user message bubble in `ChatPanel.module.css` switched from `var(--primary-500)` (dark navy) to `var(--primary-300)` so it matches the primary brand purple.
- **Unity chat avatar** — new `src/components/UnityIcon/` component renders the Unity brand glyph as a single-color SVG (color prop drives all paths). All three `solar:ghost-smile-linear` usages in `ChatPanel.jsx` swapped for `<UnityIcon />`; `.avatar` and `.msgAvatar` backgrounds switched from solid primary to `linear-gradient(135deg, #1E9DAE 0%, #D478FF 100%)`. Icon stays white on the gradient.

### Astrana Plum Theme (April 2026)
- New `[data-theme="plum"]` block in `src/tokens/tokens.css`. Primary palette anchored at `#6C0C46` (primary-300) with deep-plum chrome for the sidebar (`#2A0519` / `#4A0A30`). Neutral, secondary (orange), and status tokens inherit from `:root`.
- Registered as `'plum'` in `THEME_VALUES`, the `index.html` inline-script allowlist, and `ThemePicker` OPTIONS (label "Astrana Plum", crown-star icon).

### Blue Theme + Chat Settings Table Polish (April 2026)
- **Blue theme** — new `[data-theme="blue"]` block in `src/tokens/tokens.css` with a full parallel primary palette anchored at `#007BFF` (primary-300). Sidebar chrome retinted to dark navy for cohesion; secondary (orange), neutral, and status tokens inherit from `:root`.
- **ThemePicker** gains a "Blue" option (palette icon). `THEME_VALUES` in `src/lib/theme.js` extended, inline script in `index.html` updated to pass new theme values through, and `getResolvedTheme` returns any named palette as-is. Adding future palettes is append-only: new entry in `THEME_VALUES` + `OPTIONS` + a matching `[data-theme="<name>"]` block.
- **ChatSettingsPanel table** — row `borderBottom` and action-menu divider moved from literal `#EAECF0` to `var(--neutral-100)`; Location and Last Updated columns now use `var(--neutral-400)` + `13px` so they match the other columns (previously faint gray at `var(--neutral-200)`/`12px`).

### Theme Picker → Dropdown + Calendar Theme Sync + Stray-Hex Fixes (April 2026)
- **ThemePicker is now a dropdown** (`src/components/ThemePicker`) instead of a segmented Light/Dark/System row. Designed for future themes — append to `OPTIONS` and add a matching `[data-theme="<name>"]` block in `tokens.css`.
- **schedule-x calendar follows app theme** — `CalendarView.jsx` reads `resolvedTheme` from `useAppStore`, passes `isDark` at init, and calls `calendarApp.setTheme()` on theme flips.
- **Primary button text** (TopBar `.btnPrimary`) reverted from `var(--neutral-0)` (which inverts) to literal `#fff`. Text on `var(--primary-300)` purple should be white in BOTH themes.
- **`var(--neutral-900, #16181d)` regressions fixed** (`AccountPanel.module.css` ×3 + `CallQueueDrawer.module.css` ×1) — `--neutral-900` doesn't exist; fallback `#16181d` was making titles ("Administrative Role", "Roles", agent name, etc.) invisible on dark surfaces. Replaced with `var(--neutral-500)`.
- **SystemHealthStrip** background tokenized: `#fafbff` → `var(--neutral-50)`.

### Dark-Mode Tokenization Sweep — Forms, Bars, Toasts, Calendar, Drawers & Goals (April 2026)
- **Shared form primitives** (`Input`, `Select`, `Checkbox`) — replaced hardcoded `bg-white` / `background: #fff` with `var(--neutral-0)` so triggers, dropdowns, and unchecked checkboxes flip with the theme everywhere they're consumed.
- **BulkBar** (`BulkBar.module.css`) — surface and inner buttons now use `var(--neutral-0)`; no more white slab on a dark page.
- **Toasts** (`AppLayout.jsx`) — default toast text moved to `var(--neutral-0)` (inverts cleanly with `var(--neutral-500)` background); success toast switched from literal `#059669` to `var(--status-success)` (theme-aware brighter green in dark).
- **Calendar** (`CalendarView.module.css`) — schedule-x `--sx-color-surface` now points at `var(--neutral-0)`; user-picker trigger and dropdown tokenized; past-day overlay gets a dark-tinted variant under `[data-theme="dark"]`.
- **Preferences (User Profile) Drawer** — warm-cream gradient on the `editHeader` is overridden to a solid dark surface in dark mode (titles read clearly); avatar-upload border tokenized; verified-check icon swapped to `var(--status-success)`.
- **GoalsPanel** — every `background: #fff` (cards, stat boxes, drawer steps, wizard, form inputs) replaced with `var(--neutral-0)`, fixing the white-on-white "Passed / Failed" stats in dark mode.
- **Settings panels sweep** — `AgentsTable`, `CreateAgentDrawer`, `EmbeddedComponents`, `AccountPanel`, `BusinessHoursDrawer`, `ChatSettingsPanel`, `ComponentWizardDrawer`, `EscalationPolicyPanel`, `FeatureTogglesPanel`, `GroupDetailDrawer`, `KnowledgeBasePanel`, `PracticeConfigPanel`, `AgentRulesDrawer` — all literal `#fff` backgrounds and stray neutral/status hexes converted to design tokens; info-box copy colors (`#1E40AF`/`#92400E`/`#B45309`/`#065F46`) mapped to their `var(--status-*)` counterparts.

### Dark Theme + Extensible Color Theming System (April 2026)
- **Dark mode**: full dark palette added as a `[data-theme="dark"]` override in `src/tokens/tokens.css`. Redefines every neutral, primary, secondary, and status token for dark surfaces; inverts text colors; keeps the Sidebar as theme-invariant dark chrome.
- **Theme picker in profile popover**: new `ThemePicker` segmented control (Light / Dark / System) between Switch Account and Log Out. System mode live-follows OS `prefers-color-scheme`.
- **Pure-module theme system** at `src/lib/theme.js`: `applyTheme()`, `getResolvedTheme()`, `getStoredTheme()`, `subscribeToSystem()`, `initTheme()`. Theme persisted to `localStorage['theme']`; first-visit default is Light.
- **Zero-flash initial paint**: inline blocking script in `index.html` reads localStorage and sets `<html data-theme="...">` + `.dark` class BEFORE React mounts.
- **Store integration**: `useAppStore` gains `theme`, `resolvedTheme`, `setTheme`, and a `matchMedia`-backed subscription for System mode.
- **Smooth 200ms cross-fade** on theme flips (background/color/border/fill/stroke/box-shadow), scoped on body + `*`, with `prefers-reduced-motion` honored.
- **Tailwind v4 `@custom-variant dark`** registered so `dark:` utility prefix works; shadcn primitives flip automatically because their semantic tokens map to design tokens.
- **Deep color cleanup**: ~150 hardcoded hex, rgba, and brand-literal color values across `src/` replaced with design tokens (`var(--*)`) or `color-mix()` derivatives of existing tokens, so the entire platform transitions cohesively in both themes.
- **New tokens** added to support theming: `--shadow-popover / drawer / card`, `--status-success-bright`, `--button-danger-bg`, `--button-info-bg`, `--surface-overlay`, `--sidebar-bg / fg / fg-muted / hover-bg / active-bg / active-border / active-overlay / active-overlay-border`.

### Agent Call Queue Drawer + Updated Agent Actions (April 2026)
- Redesigned agent listing action buttons: **Call Queue**, **Call Analytics**, **Edit Agent** (pencil icon), **More Options**
- All action buttons now show tooltips on hover
- New **CallQueueDrawer** component with 3 tabs: Ongoing Call, In Queue, Call Log
- **Ongoing Call tab**: shows active calls with member info, live call duration (green), Live Transcript button, listen icon, and more options
- **In Queue tab**: shows queued members with priority ordering, Call Order reorder buttons (up/down arrows), remove from queue, and more options
- Agent banner in drawer shows agent name/role with Edit Configuration and Stop buttons
- Tab bar includes refresh, filter, and search action buttons

### Audit Log Across All Settings + Widget Ordering (April 2026)
- Audit log support added to **Agents**, **Goals**, and **Chat Settings** tables
- All CRUD operations (create, update, delete) automatically logged to `audit_logs` table
- Audit Log button (history icon) in table actions for all entity types
- Rich diff display: status badges (Enabled→Disabled), text strikethrough (old→new)
- Widget Card placement: sortable widget list shows existing widgets in selected tab
- Tab widgets data from patient profile Excel (11 tabs, 50+ widgets)
- User's full name (from Supabase auth metadata) shown in audit entries
- "(Current User)" label for entries matching the logged-in user

### Supabase Persistence for Embedded Components (April 2026)
- **New tables**: `embed_domains`, `embed_components`, `audit_logs` with full Supabase CRUD
- All domain and component operations (create, update, delete, toggle, duplicate) persist to PostgreSQL
- Every action automatically logged to `audit_logs` table with entity tracking
- Audit Log Drawer fetches real data from DB with filter support
- Tab-level action buttons changed from primary to secondary variant (visual hierarchy fix)
- Data mapper (`embedMapper.js`) for snake_case/camelCase DB↔JS conversion
- Auto-seeding of embed tables with fallback data on first load

### Embedded Components Admin (April 2026)
- Domain Registry with enable/disable switch, audit log, CRUD modals
- Component Library table with 3-dot more menu (Edit, Audit Log, Duplicate, Delete)
- Component Wizard (4-step: Identity, Surfaces, Context, Preview) using shared Drawer
- Audit Log Drawer with Figma-matching timeline layout
- All native `<select>` replaced with Radix Select popover dropdowns
- Shared Input component created for platform-wide consistency
- Dismissible info/warning banners
- Routing support for `/#/settings/embedded-components/*`

## License

Proprietary — Fold Health, Inc.
