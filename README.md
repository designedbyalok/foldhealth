# Fold Health — Care Coordination Platform

A comprehensive healthcare operations platform for Transitional Care Organizations (TCOs), built to coordinate multi-agent patient outreach, track care management goals, monitor population health analytics, and manage AI-powered care workflows.

## Documentation

For comprehensive information about the platform's features, architecture, and API, please refer to the project's **Mintlify Docs**. All detailed technical and feature documentation has been migrated there.

## Getting Started

Make sure you have [Bun](https://bun.sh/) installed.

```bash
# Install dependencies
bun install

# Start the development server
bun run dev
```

The application will start at `http://localhost:5173`. 
The default landing page is the Population Worklist (`/#/population/worklist`), and you can use the sidebar to navigate through the rest of the platform.

## Storybook

Every reusable primitive under `src/components/` has a story. Run locally
with `bun run storybook` (port 6006) or browse the hosted library on
Chromatic:

- **Library (all branches):** https://www.chromatic.com/library?appId=6a61dbc8d0f0c8fbac7a34f1&branch=main
- **Branch preview:** https://\<branch>--6a61dbc8d0f0c8fbac7a34f1.chromatic.com — replace `<branch>` with the branch name; `main` for production, e.g. `main--6a61dbc8d0f0c8fbac7a34f1.chromatic.com`.
- **Setup wizard (one-time):** https://www.chromatic.com/setup?appId=6a61dbc8d0f0c8fbac7a34f1

Publish a new snapshot with `bunx chromatic --project-token=<token>`
(project token lives in Chromatic → Manage → Project token). Storybook
build requires esbuild ≥ 0.28 on Node 26.

## Recent Changes

- **Typography: root font size now scales with the viewport** — the root
  font-size was a hard-coded `16px`, so a 13" laptop and a 27" 4K panel got
  identical CSS px and wildly different apparent text size. It's now
  `clamp(1rem, 0.866rem + 0.134vw, 1.1875rem)`: flat 16px through every laptop
  width (≤1600px — no regression), then 16.4px at 1920, 17.3px at 2560, capped
  at 19px from 3840 up. Every `--font-*` and `--space-*` token is rem-based, so
  the whole type ramp and token spacing move together. The 5 `data-font-scale`
  accessibility levels became *multipliers* (0.875 → 1.25) instead of absolute
  px, so they compose with the fluid base rather than overriding it — at laptop
  widths they still resolve to exactly 14/15/16/18/20px. Deliberately keyed to
  viewport width, not `devicePixelRatio`: a CSS px is already
  density-independent, so DPR says nothing about apparent size. Each clamp arm
  keeps a `rem` term so the browser's own font-size preference still wins
  (WCAG 1.4.4).

- **Tasks: "Assigned to Me" dropped tasks that were yours** — `matchAssignee`
  short-circuited on `assigned_to_id`, so it never fell back to a name match.
  `profiles` holds one row per email a person signed up with (three are named
  "Alok Kumar"), so a task carrying a different profile id for the same human
  was silently excluded. Now matches id **or** display name; same for
  `matchCreator`. Also made pool and assignee mutually exclusive: pooling a task
  clears its assignee and assigning an owner clears the pool (what `claimTask`
  already did), so a pooled-and-assigned task can no longer end up invisible in
  both the pool tab and the Claim button.

- **Calendar: slot clicks snap to 30-min slots + faster load** — clicking a
  timeslot now books the slot the hover preview shows (schedule-x reports the
  raw pixel time, e.g. 3:13; we snap it down to :00/:30 before it reaches the
  Schedule drawer and the dashed selection). Calendar libs now load in
  parallel instead of a sequential import waterfall, the grid setup (hover
  ghost, past-day overlays, scroll-to-now) polls for readiness instead of
  waiting a fixed 800ms, and `isResponsive: false` stops schedule-x from
  silently hijacking week view into day view when it mounts mid-layout.
  Location/Status filter chips actually filter now, and month view finally
  dims past days (the old selector matched nothing in schedule-x v4).

- **Calendar: vanishing-appointment fix + schedule-x v4 cleanup** — opening and
  closing an appointment drawer used to silently delete the last appointment
  from the grid: `clearSelection()` called the events plugin's `remove()` for a
  selection event that didn't exist, and schedule-x's `remove()` does
  `splice(findIndex(...), 1)`, so a missing id splices at `-1` and drops the
  final event. It's guarded with an existence check now. Cancelled styling and
  the dashed new-slot block are declarative (`_options.additionalClasses`)
  instead of a `querySelector` chain fired at 100/300/600ms and again at
  300/800/1500ms, so they paint correctly on the first frame — the dashed
  selection style had in fact never applied, because `.sx__event--selection`
  isn't a class v4 emits. Navigation repaints run off schedule-x's
  `onRangeUpdate` rather than a `setTimeout(50)` guess, the now-line ticks each
  minute instead of freezing at page load, the Location/Status filter options
  come from the same constants the booking form writes (the calendar's own
  copies had drifted — `Fold Health, NY` vs `Fold Health, New York`, so any
  location selection matched zero rows), and the four empty `catch {}` blocks
  and the dead `buildCalendars` helper are gone.

- **Dynamic group detail screen + qualified members + activity log** —
  clicking a Dynamic group row opens its read-only detail screen (Figma
  1-13951): left rail with the group summary, live qualified-member count and
  an Applied Filtration Criteria card (Powered by Unity), plus TabStrip tabs.
  The Qualified Members tab is a `WorklistShell` table of every patient whose
  `p360_profiles` row satisfies the rule, evaluated client-side by
  `rule-builder/useQualifiedMembers.js` and joined to `patients` /
  `all_patients` for display. Edit (rail pencil or the row's pencil) switches
  into the editable builder; Cancel reverts, Next saves back to view. The
  rail's History button opens a Drawer with the shared ActivityLog backed by
  the new `pop_group_activity` table
  (`supabase/pop_group_activity_migration.sql`) — the store logs every
  create / rule update / details update / delete. The seed also backfills the
  core profile criteria fields (age / sex / gender / state / zip) from each
  patient's identity row.

- **Dynamic group rule builder** — choosing the Dynamic filter in Create Group
  now opens a full-page rule builder (Figma Pop Group Rule Builder) instead of
  inserting a rule-less group: IF canvas, an Add Condition picker with 22
  patient-profile fields across 5 groups, per-condition editor panel
  (operator / value / as-of), AND/OR combinator, and drag/trash affordances.
  Built on `react-querybuilder`'s rule model (`{ combinator, rules }`) via its
  `add`/`remove`/`update` helpers so stored rules stay portable to
  `formatQuery` when evaluation lands. Editing a Dynamic group reopens the
  builder with its saved rule. Every condition maps to a `p360_profiles`
  column (`rule-builder/fieldCatalog.js` is the contract); the rule persists
  in `population_groups.rule`
  (`supabase/pop_group_rule_builder_migration.sql` adds it plus the 12
  profile columns that didn't exist yet, and `bun run seed` backfills demo
  values).

- **Tables fill the viewport — auto page size** — every table now sizes its
  page to the space available instead of always showing 10 rows, so a tall
  screen fills with data rather than white space (TOC 10 → 20 rows at 1440×1000).
  Sizes step in multiples of 5 with a floor of 10 and always round up, so the
  last row runs past the fold — a little scroll, never a gap. The per-page
  selector gained an **Auto** default (`Auto (20)`); picking an explicit
  10/25/50 pins it. The choice is a per-user preference persisted in
  `user_worklist_prefs`
  (`supabase/user_worklist_prefs_page_size_migration.sql`), mirrored to
  localStorage so it survives a reload before the fetch lands. Logic lives in
  `src/components/Pagination/useAutoPageSize.js` and applies to every table
  through the shared `Pagination`. Also fixed CCM/SNP passing
  `pageSize`/`onPageSizeChange` where `Pagination` declares
  `perPage`/`onPerPageChange` — their page-size selector had been a no-op.

- **Population Groups on WorklistShell** — the groups table now renders through
  the shared `WorklistShell` (sticky Group Name + Actions columns, working
  select-all with BulkBar, loading skeleton) instead of a hand-rolled table and
  its own `PaginationBar`, which was deleted.

- **P360 banner — real data for every patient** — all 28 patients now have a
  seeded `p360_profiles` row (acuity/RAF, consent, next appt, chronic
  conditions, vitals, family, care team) generated deterministically per
  patient by `scripts/seed_p360_banner.js`; re-runs only fill NULL/empty
  fields so hand-crafted rows survive. New `upcoming_appointments` jsonb
  column (`supabase/p360_upcoming_appointments_migration.sql`) persists the
  expanded banner's Appointments column. Expanded-state typography was also
  rebalanced (SemiBold section titles, proper Care Team sub-header, no more
  stray 10/11/14px sizes).

- **Care Programs table — editable Status & Assignee** — the program list
  Status cell is now a dropdown (Engaged / Declined / Unable to Reach /
  Enrolled / Attempted) with per-status colors (warning for in-program,
  neutral for Declined, error for Unable to Reach). Enrolling stamps the
  Start Date with today's date; any change bumps Last Updated. The Assignee
  column reuses the HCC worklist's searchable assign picker
  (`RoleAssigneePicker`, now generalized with an `onAssign` callback). A
  hover three-dot row menu (Assign to / Print Summary / Close Program) and a
  pie-fill completion indicator (`ProgramStatusRing`) round it out.
  Persisted to the existing `patient_care_programs` table via
  `updateCareProgram`.
- **Component library consolidation** — one primitive per job. The three
  Radix duplicates (`ShadcnSelect`, `ShadcnTooltip`, `ShadcnRadioGroup`) were
  removed; every dropdown now uses the shared `Select` (new `style` prop for
  width constraints), every tooltip the portaled `Tooltip` (new `maxWidth`
  prop for wrapping), and every radio the shared `RadioButton`. All inline
  row-action dropdowns (TOC, CCM, All Patients, Agents table, Outreach log)
  were migrated to the shared `MenuPopover`, which now supports
  `{ section }` headers and `{ divider }` rules; TOC/CCM share one menu
  vocabulary via `buildPatientRowMenuItems`. Also fixed a fragile import
  cycle by moving `FALLBACK_USERS` into `settings/fallbackUsers.js`.
- **Help → Feedback & What's New** — the sidebar Help popover now hosts a
  Featurebase feedback panel (ideas / bug reports / voting) and an in-house
  changelog drawer backed by Supabase (`changelog_entries`). A GitHub Action
  (`.github/workflows/changelog.yml`) publishes entries automatically from
  commit messages on every push to main (feat → New, fix → Fixed,
  perf/refactor → Improved; chores skipped). Requires the
  `SUPABASE_SERVICE_ROLE_KEY` repo secret.
- **Storybook + Chromatic** — every primitive under `src/components/`
  (Core, Forms, Overlays, Feedback, Data, Navigation, Composed, shadcn/ui)
  now has a story. Storybook is published to Chromatic — links above.
- **HCC worklist** — default assignee filter (role-scoped, "me + In
  Progress"), mandatory doc upload in Add DOS, inline Pass/Fail on chart
  upload, auto-transition of Coder/QA/Compliance status to In Progress on
  first ICD action.
- **Auth** — invited-user flow now sends a single confirmation email
  (was two) and lands the user on a "Set Password" page whose success
  drops them straight into the app.
