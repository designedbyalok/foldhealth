# Fold Health — TOC Worklist Platform

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
