# Fold Health: Care Coordination Platform

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
- **Branch preview:** https://\<branch>--6a61dbc8d0f0c8fbac7a34f1.chromatic.com, replace `<branch>` with the branch name; `main` for production, e.g. `main--6a61dbc8d0f0c8fbac7a34f1.chromatic.com`.
- **Setup wizard (one-time):** https://www.chromatic.com/setup?appId=6a61dbc8d0f0c8fbac7a34f1

Publish a new snapshot with `bunx chromatic --project-token=<token>`
(project token lives in Chromatic → Manage → Project token). Storybook
build requires esbuild ≥ 0.28 on Node 26.

## Recent Changes

- **Live call: full-screen view from the call card.** The expand icon on the floating call card now grows the card into a full-screen call view (and Minimize, Esc or the backdrop shrinks it back), with the avatar, name, call status and every call control moving between the two. On the left: Reason for Call, Talking Points (ticked off as the conversation covers them) and Medications, each opening an editor in the right rail (status, start and stop dates with reason, sig, last filled, days supply, note, Request Refill, and where the drug came up on the call). In the middle: Live Transcript behind a recording consent prompt (lines highlight what raised an action item), plus the patient's real Care Plan, Program Steps (Reviewed / Skip / Undo, tagged This Call) and Patient Tasks. On the right: Action Items heard on the call (accept, edit, dismiss, Accept All). End Call opens Wrap Up Call: outcome, an editable AI summary that only claims what happened, unreviewed suggestions, and what saves; Complete writes the call to the patient's call log (`call_details`). Transcripts come from `live_call_scripts` (`supabase/live_call_scripts_migration.sql`, `live_call_scripts_summary_migration.sql`, seed `live_call_scripts_seed.sql`, run on Dev), since there's no speech-to-text yet.
- **TOC IP worklist: the discharge workflow first.** The TOC IP list now opens on the redesign prototype's columns: Facility (with the admit reason), Discharged (date and time), 2-Day Contact (due 2 business days after discharge: the day, Today 5:00 PM, Overdue, or Met), Relay (what the agent or care manager has done: attempts, live call holding for an RN, completed, with a note), Visit Window (7-day for high acuity, else 14-day, or the booked date, or missed) and Med Rec (Not started, Pending, Done). An ED discharge isn't TCM-eligible, so it shows the 7-day ED follow-up instead of the TCM window; a psychiatric stay gets 7 days (HEDIS FUH). The Agent Worklist columns are still in the column picker, hidden by default (saved layouts start fresh under a new key). Needs `supabase/toc_discharge_workflow_migration.sql`; `supabase/toc_discharge_workflow_seed.sql` (Dev only) moves the sample discharges into the last 10 days.
- **My Patients worklist.** Population › My Patients (was Coming Soon) is the care manager's own list from the redesign prototype: 15 patients from Dev with their open programs, lowest plan adherence first. Each row shows the programs, Plan Adherence (score, On Track / At Risk / Off Track band and the change since last month), Why Prioritized (the two most pressing points, the full summary on hover), Last Review (overdue past the program's cadence), Program Time (CCM / PCM minutes against the monthly target), Last Touch and Assignee, with Open Care Programs and Call. A Care Plan Adherence strip counts each band and filters to it; Program, Plan Adherence, Assignee and Payer filters. Needs `supabase/my_patients_worklist_migration.sql` and `supabase/my_patients_worklist_seed.sql`; until then the list shows the same rows from `src/features/my-patients/data/mock.js`.
- **Care plan: one title style, Summarize in the card.** Every section of the care plan (program and All Programs) now uses the same card header as Look at These First, Suggested Actions and Tasks: Summary, Unity Summary and Recent Notes in the left column are icon-titled cards, and Goals, Interventions and Barriers has a matching title with a rule above it, so the plan's items read as their own section. All Programs' Summarize moved off the toolbar into the overview card: a Summarize with Unity tab when narrow (the program stepper hides there, since the summary covers every program) and the left column's Unity Summary when wide, as in a program's plan.
- **Care plan: add goals, interventions and barriers inline.** The + on Goals, Interventions or Barriers now opens a row right above the table, as in the prototype: type the name, pick the intervention's type (Internal Task or Patient Task) and the goal an intervention or barrier belongs to, then Add (or press Enter; Escape cancels). Browse Library (goals, barriers) and More Types (interventions) still open the existing drawer and type menu. Task interventions added this way get their task when the plan is signed, as template-added ones do. All Programs has the same row with a Program pick.
- **All Programs care plan now reads like a program's plan.** With the switch on **All Programs**, the Comprehensive Care Plan uses the same layout as a single program, as in the prototype. The middle column opens with the program note card (Care Plan Note, Events Updates, Review Cadence) with ◀ CCM · 1 of 6 ▶ to step through the programs. Goals, Interventions and Barriers use the program plan's own tables and columns (Latest Reading, Due Date, notes, links, attention flags), with each row's program as a badge beside its name instead of a Program column; every edit saves to that program's plan. Suggested Actions from every program join Look at These First and the tasks on the right; they're read, not re-evaluated, so opening All Programs never runs AI. The Active Programs Summary table moved behind an **Active Programs (N)** button in the plan bar, and the Care Notes tabs are replaced by the note card.
- **Care plan: completing again replaces the sign request.** When a plan that is waiting for its provider is edited and completed again, the earlier "Sign care plan" task now closes as the new one is created, so the provider has one task per plan instead of one per completion.
- **Guided care plan review.** **Start Review** / **Resume Review** on a program's care plan (and Start Review in Look at These First) now walks the plan one step at a time instead of opening the review checklist. The agenda on the left lists every open goal (off target, overdue or with an unaddressed barrier first), then interventions and barriers not linked to a goal, **Suggested Actions**, **Pending Patient Tasks** and **Wrap Up**, with progress and a running clock. Each goal step shows what to review (latest readings against the target, overdue interventions, barriers nothing addresses), its readings, and a decision on every barrier (Still a Barrier, Resolved, Not Applicable), intervention (Continue, Done, Reschedule to a picked date, Stop) and the goal (Continue, Met, Not Met, Discontinue), plus note tags. An overdue intervention suggests Reschedule. Picks are saved on the open review, so **Save and Exit** resumes where it stopped; the plan changes only at **Wrap Up**, which lists the changes and the steps not reviewed, drafts the review note, shows the next review date, and can open **Complete** to send the plan to sign. No migration: picks live in `care_plan_call_reviews.discussed`. The worklist's Review care plan drawer is unchanged.
- **Care Programs overview: Why Prioritized and Program Summary by Unity.** Both cards still open with the version assembled from the records. **Summarize** in either card asks Unity to write both (`POST /api/care-programs-insights`). Why Prioritized gets Unity's takeaways (each opens the action, goal reading or concern it names) and a short paragraph. Program Summary gets Unity's lead and a few points, above the records' own Latest Readings and Open Concerns rows. The result is saved per patient and read back on every visit, so nothing is generated when the tab opens. Once the records change (steps, plans, readings, problems), the footer says "Records changed since" and offers **Update**. Write it again, copy, and Dismiss (back to the records' version) are in the footer. Needs `supabase/patient_care_programs_insights_migration.sql`.
- **All Programs care plan matches the prototype; AI summaries only on request.** On wide screens (1400px and up) the Comprehensive Care Plan's **All Programs** view now has the same three columns as a program's plan. Left: **Summary** (combined goal progress, goals / interventions / barriers with what needs attention), **Unity Summary** across the programs (action items open the goal, intervention or barrier they name and can be ticked off) and **Recent Notes** across programs with Add Care Note. Middle: Active Programs Summary, Care Notes, then **Goals, Interventions and Barriers** with an All / Needs Attention switch. Right: Look at These First and tasks. Fixes: All Programs reads only open programs everywhere (totals, tables, filters, Download, summary), so the counts match the rows; every program's item is its own row (no longer collapsed by title), and Needs Attention matches items by program as well as id. Care plan AI summaries (per program and across programs) are no longer written on their own when a plan opens: they are generated by **Summarize**, saved, and read back on every visit. When a plan changes after its summary was written, the summary says so and offers **Update Summary**.
- **Care plan view: the prototype's layout.** On wide screens (1400px and up) a program's care plan has three columns. Left: **Summary** (average goal progress with its band, goals / interventions / barriers with what needs attention, which toggles the Needs Attention filter, and where the review stands), **Unity Summary** (intro and action items, with the detail on Show Details) and **Recent Notes** with Add Note. Middle: the note card (Care Plan Note, Event Updates, Review Cadence), then **Goals, Interventions and Barriers** with an All / Needs Attention switch. Goals show a **Latest Reading** column (the latest reading, green in range and red off target, with the target) and the patient's own words under the title. Interventions show their kind and goal ("for Improve A1C control"), a Due Date column and a "N Days Overdue" badge. Look at These First offers **Start Review** (for an off-target goal or a due review) and **View Details** on each item. Narrower, the plan keeps its strip and tabs as before.
- **Comprehensive Care Plan, recreated.** The tab beside Care Programs now has an **All Programs** / per-program switch. All Programs combines every open program's live plan and is editable item by item (each edit saves to that item's program plan): the summary strip (goal progress, goals / interventions / barriers with what needs attention, which filters the tables), Active Programs Summary, Care Notes, Summarize, Download, and the Goals / Interventions / Barriers tables with a Program column. On wide screens Look at These First (across programs) and the patient's tasks sit on the right, and an opened item docks there. **Complete (N)** lists each program's plan with where it stands (not completed, awaiting a signature, signed) and opens it. Picking a program shows that program's full care plan, where it is completed, reviewed and signed.
- **Care Programs: the prototype's overview.** The Care Programs tab is three columns (two when narrower, one on a phone width). Left: **Programs** cards (progress ring, two-line name, code, status menu, assignee, ⋯ menu, steps done, Next step) ordered by most urgent actions, then required steps open, then open actions, then most recently updated, four shown with Show N More; and **Active Problems** (name over type, onset and code; chronic first, then the latest onset; four shown). Middle: **Why Prioritized** (takeaways, with the paragraph under Show More), **Next Best Actions** (open program steps and care plan items needing attention, In Order or By Program, Go to Step / Open Care Plan, mark a step reviewed) and **Since Last Visit / Recent Activity** as a timeline. Right: **Care Plan Summary** across the programs and a **Program Summary** assembled from the same numbers. Each line comes from the records ("1 open • 1 overdue", "2 barriers with nothing addressing it", "Scheduled 11/18/2026", "Required"); nothing is generated or invented. Past programs keep their table in a collapsed section. Care plan redesign prototype items 8 and 9.
- **Care plan: Start Review / Resume Review.** The care plan header now opens the existing care plan review drawer (until now only reachable from the SNP worklist): the review timer, goals / interventions / barriers to discuss, the call note and Complete Review. The button reads **Resume Review** while a review is in progress (an item discussed or a call note saved), and becomes an icon with a tooltip when the plan is narrow. Seventh step of the care plan redesign prototype; the prototype's guided step-by-step review is not built.
- **Care plan: Complete, then the provider signs.** The care plan's Sign button is now **Complete**: a dialog picks the provider who signs (the program's PCP by default when they're a user), records that the patient agreed (required) and how, and whether they want a copy (Portal, Mail or SMS link, in their preferred language, large print). The plan then reads "Awaiting <provider>'s signature", the provider gets a "Sign care plan" task (closed automatically when the plan is signed), and the button becomes **Sign**, which signs and cuts the version as before. Editing a goal, intervention or barrier after completing puts it back to "complete it again". The copy is recorded only; nothing is sent yet. **Sign Now** (skip the provider step) and Send for Review stay in the button's menu. Needs `supabase/care_plan_completion_migration.sql`. Sixth step of the care plan redesign prototype.
- **Care plan: Recent notes.** Under the Care Plan Note box, the overview card lists the three latest notes on the plan's goals, interventions and barriers: which item each is on, the note (two lines), and who wrote it when. Clicking one opens that item. Deleted notes and notes on items no longer in the plan are left out. Earlier plan notes stay in the note history, since editing the note box saves a new plan note and they're often its previous versions. Fifth step of the care plan redesign prototype.
- **Care plan summary strip.** The top of the care plan overview card shows the plan at a glance: a goal progress ring (the average across goals that are judged), Goals / Interventions / Barriers tiles with their counts and what needs attention in each ("1 off target", or "On track"), and a review tile (due, overdue by N days, or the next date). A tile with an issue toggles the Needs Attention filter; the review tile opens Review Cadence. The counts that used to sit in the Summarize with Unity tab moved here. Fourth step of the care plan redesign prototype. Left out on purpose: an adherence trend (no history to compare against) and time logged this month (the CCM billing fetch falls back to sample minutes when a patient has none, which can't be told apart from real ones).
- **Care plan: what needs attention, on each section.** The Goals, Interventions, Barriers and Social Needs headers show how many of their items need attention ("1 Off Target", "2 Overdue", "1 Without Intervention"), by the same rules as Look at These First. Clicking one turns on a new **Show: Needs Attention** filter (a FilterChip in the filter bar, which opens) and clicking again turns it off. An open SDOH referral now counts as addressing its barrier, and the side panel uses the intervention table's own due date, so a flagged intervention always reads overdue in its row. Third step of the care plan redesign prototype.
- **Care plan side panel: Look at These First, Suggested Actions and Tasks.** When the care plan is wide enough to dock details (at least 1080px) and no item is open, the column beside the tables shows what needs attention, all from data the plan already has. **Look at These First** lists a due or overdue review, open goals whose latest reading is unfavorable, open interventions past their due date, and open barriers with no open intervention on any of their goals; each opens its item. **Suggested Actions** lists the changes proposed by patient events, with Accept and Dismiss (the same decisions as the Events Updates tab). **Tasks** is the patient's task card from the Overview tab. The panel reads what the overview card already loaded, so it adds no requests. Second step of the care plan redesign prototype.
- **Care plan details dock beside the tables.** When the care plan is at least 1080px wide (for example with the patient side panel collapsed), opening a goal, intervention or barrier shows its details in a panel to the right of the tables instead of a drawer over them. The open row is highlighted, picking another row or a linked item swaps the panel, and Escape or the close button closes it. Narrower, it stays the usual drawer. This is the first step of the care plan redesign prototype. The shared `Drawer` gained a `dockable` prop: inside a `DrawerDockContext` host it renders in the page with no overlay, and drawers opened from it still overlay.
- **DOB filter: Month & Year, and applied filters stay visible.** The worklists' DOB filter has a third tab between Years and Custom Dates: one searchable From and one To field ("April 1958"; search "apr 1958", "04/1958" or "1958"), pre-filled with last month to this month. It saves the 1st of the From month to the last day of the To month, leap years included, so every worklist's existing DOB matching works unchanged; the chip reads "Apr 1958 – Dec 1961". Closing a worklist's filter row no longer hides what's applied: `FilterBar`'s new `collapsed` mode keeps one line with just the filters that have a value (each clearable, and still editable) and Clear All, and shows nothing when no filter is set. On for HEDIS, HCC, Pharmacy, SNP, CCM, Annual Visit, JSA, CMP and the shared TCM / TOC IP bar. No migration.
- **Two new PR checks: Self imports and Patient app build.** `.github/workflows/build-checks.yml` runs on every PR to main or preview and on main. **Self imports** (`scripts/check-self-imports.mjs`) fails on a module that imports itself, through a relative path or the `@/` alias, like the FilterBar wrapper that rendered itself forever and froze every worklist (#781). **Patient app build** runs `bun run build:patient`, which no check built before, so the patient app's use of removed components only failed at the production deploy (#784).
- **TOC filter definitions moved out of the library.** The TCM and TOC IP filter definitions (and `filterDefsForList`) moved from `components/FilterBar/filterBarUtils` to `src/features/toc/tocFilters.js`, and option resolving into `features/worklists/FilterBar`. The library's `FilterBar` folder now holds no app data. No migration.
- **Old component names removed.** The re-export folders kept during the library merges are gone: `ShadcnCheckbox`, `ShadcnDialog`, `ShadcnSlider`, `Collapse`, `Alert`, `InfoBar`, `RingEmptyState`, `ErrorState`, `TabStrip` (with `OverflowTabStrip`), `SubTabs` and `Toggle`, plus the `components/WorklistColumns/useWorklistColumns` forwarder. Nothing imported them. Use `Checkbox`, `Dialog`, `Slider`, `CollapsibleContent`, `Banner`, `EmptyState`, `Tabs` / `OverflowTabs`, `SegmentedControl` and `features/worklists/useWorklistColumns`. No migration.
- **The component library no longer imports the app.** No primitive or pattern reads the store, features, layouts or the network. `Avatar`'s Out of Office badge, `BulkBar`'s default worklist actions, `Pagination`'s saved page size, `ActivityLog`'s note / task / referral entries and `CommentComposer`'s mention roster come through small library contexts that `src/features/AppProviders.jsx` fills in (around the app and every Storybook story), so nothing on screen changes. `WorklistShell` takes `columnPrefs`, and `features/worklists/WorklistShell` turns a `worklistKey` into them; `FilterBar`'s store fallbacks live in `features/worklists/FilterBar`; `ProductTour` takes a `store` (the app's syncs seen tours); `EmailComposer` takes an `assistant` slot; `HoverCard` owns `useHoverIntent`. `FilterNameDialog` and `MoreFiltersPopover` moved from HCC into the library, and the date formatters into `src/lib/dateFormat.js`. No migration.
- **Pharmacy: Assessment, call widget for pharmacists and prescribers, PDC from the worklist.** Verify with Pharmacy is now **Assessment** (button, menu, pane, history and saved call title) and is always available: every call to the pharmacy, physician or member is its own checklist. Suggested Actions leads with **Call Pharmacist** (primary) and **Call Prescriber** (tertiary), then Add Outreach, Assessment and Update Barriers (secondary). Pharmacy and prescriber calls use the member call widget: every number on file (`phones` beside `phone` on the contact) with Last Used and Most Used from the member's dials, then Call Via with Switch Number; the line used is saved with each dial. The worklist row's call icon has a chevron: Call Member, Call Pharmacist, Call Prescriber, asking which one when there are several. PDC can be set by hand from the worklist's PDC column (pencil on hover) as well as a gap's details, through one shared editor. Next Fill Due and Claim Reconciliation sit after Plan Status. `supabase/pharmacy_contact_phones_seed.sql` gives Rite Aid #5532 a pharmacist's direct line for the demo.
- **CMP members show their programs.** A CMP worklist member opened from
  anywhere showed "No Active Programs": the worklist reads `cmp_members` and
  the Care Programs tab reads `patient_care_programs`, and nothing linked
  the two. When a patient's programs load, `syncCmpEnrollments` now enrolls
  any CMP sub-program on their roster that they aren't in yet, keeping the
  roster's start date, due date and assignee. These enrollments aren't
  logged as new and don't run auto-apply rules. The seed does the same. Needs
  `supabase/cmp_members_care_program_sync_migration.sql` to backfill existing
  members.
- **Program step header.** Program badges name the CMP sub-program
  ("CMP | Complex Case Management", full name in the hover card). Step
  actions are split by dividers (assignee | Skip | Reviewed | More), and the
  review button reads "Reviewed" as an outline primary button, green once
  reviewed, in every program. No migration.
- **Templates list social needs as barriers.** New Template and the template editor now show SDOH needs in the Barriers table (medium priority by default) as well as under Social Needs, matching the patient's care plan. Removing a need from the Barriers table also removes its suggested referrals; the Add Barriers picker still manages only library barriers.
- **Every date picker uses the Figma calendar.** `DateRangePopover` (the date-range filter chips: DOB, Create Date, Last Visit and the rest) and `DateTimePicker` now draw their days with the shared `Calendar` instead of their own grids, so all date pickers look and behave alike: single-letter weekdays, the neighbouring months' days shown muted, round ends with a pale strip for a range (previewed while picking the second end), and keyboard navigation between days. `DateTimePicker` gets a story. No migration.
- **One Calendar and one set of date helpers.** The Figma month grid that lived inside `DatePickerPopover` is now its own `Calendar` primitive (single or range, `min` / `max`, disabled days with a reason, highlighted days), and the pickers build on it. Days are reachable from the keyboard: one tab stop, arrows by day and week, Home / End, and each day reads its full date to screen readers. The date helpers that `DatePickerPopover`, `DateRangePopover`, `DatePicker` and `Input` each re-implemented (`isoFromLocal`, `addDays`, `sameDay`, `daysInMonth`, `mdyFromIso`, `isoFromMdy`, …) live in `src/lib/localDate.js`, with tests (including a DST step). No visual change. `DateRangePopover` and `DateTimePicker` still draw their own grids; moving them onto `Calendar` changes how they look, so it waits for a design call. No migration.
- **One Listbox under every picker.** New `Listbox` primitive: the rows, selection mark (none, check, checkbox, radio), sections, filtering and keyboard (Up / Down / Home / End, Enter or Space) that `Select`'s menu, `CheckboxListPopover`, `RadioListPopover`, `SearchListPopover` and `UserPickerPopover` each wrote by hand. Option lists are now `role="listbox"` / `"option"` with `aria-selected` everywhere. `Select` keeps its look (`variant="menu"`), its trigger and its positioning; long labels now truncate with an ellipsis instead of running past the menu edge. The four popovers' rows now share one spacing (4px 8px, 4px radius); the checkbox and radio lists were 4px 6px with a 6px radius. `UserPickerPopover` is a dialog with a listbox (it was a menu) and gets a story. No call site changes. No migration.
- **Tabs and SegmentedControl.** `TabStrip` and `SubTabs` are now one `Tabs`: `variant="underline"` (default, the app tab bar) or `"pill"` (the secondary switch inside a tab), with the shared `items` / `value` / `onValueChange` / `size` props. Tabs are now real tabs for screen readers (`role="tablist"` / `"tab"`, `aria-selected`) and one tab stop, with Left / Right / Home / End to move. `OverflowTabStrip` is `OverflowTabs`. `Toggle` is renamed `SegmentedControl`, for picking a value rather than switching content. No visual change. `scripts/codemods/tabs.mjs` made 364 edits in 111 files; the old names stay as adapters under `$deprecated`. No migration.
- **One Banner, one EmptyState.** `InfoBar` and `Alert` are now `Banner`: `tone` (info, success, warning, danger), `variant="soft"` (the InfoBar look) or `"outline"` (the Alert look), `size="sm"` for the compact in-flow form, and `meta`, `action` and `onClose` slots. No banner changes look, except that an outline banner's icon now takes the message colour instead of the surrounding text colour; only `tone="danger"` interrupts screen readers now (Alert used `role="alert"` for every tone). `RingEmptyState` and `ErrorState` are now `EmptyState`, which uses the dashed-ring medallion everywhere: `title`, `description`, an `action` slot and `tone="danger"` for a failed load. The 13 screens that used the old tile empty state (a 56px purple or red square) now show the ring; Retry and Back buttons get refresh and back icons instead of "+". `DegradedBanner` is built on `Banner` (no more hardcoded colours or bold icon). `scripts/codemods/banner-emptystate.mjs` made 558 edits in 99 files; the old names stay as adapters listed under `$deprecated`. No migration.
- **Social needs are listed as barriers.** An SDOH need added to a patient's care plan was already saved as a medium-priority barrier but showed only under Social Needs (SDOH). The Barriers table now lists it too, with its priority and status; Social Needs still holds the community referrals.
- **One Collapsible, one Skeleton, plain names.** `ShadcnCheckbox`, `ShadcnDialog` and `ShadcnSlider` are now `Checkbox`, `Dialog` and `Slider` (126 files re-pointed). New `Collapsible` in parts (`Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`, as in Radix): `Collapse` became `CollapsibleContent` at its 35 call sites, and `CollapsibleSection` is rebuilt on it, so its trigger now carries `aria-controls` and it takes `open` / `onOpenChange`. New `Skeleton` primitive: the four skeleton layouts, `DashboardCard`, `SuggestedPatients`, `PatientHoverCard`, `NotificationsPopover` and 10 feature files now build on it instead of borrowing `TableSkeleton`'s CSS or copying the shimmer. Old folders stay as one-line re-exports listed under `$deprecated` in `src/components/layers.json`, and lint flags new imports of them. No migration.
- **Form controls speak the shared vocabulary.** `Input`, `Select` and `Textarea` take `invalid` for the error look (was `variant="error"`), `variant` `outline` / `ghost` (Input's `quiet` is now `ghost`), and Input and Select take `size` `md` (32px) or `sm` (28px). Every one reports its value through `onValueChange(value)`: Select's value-style `onChange` is renamed, and a labelled or rich `Textarea` no longer overloads `onChange` (it is the native event; rich text reports `onValueChange(html, plain)`). `Toggle` and `SubTabs` take `value` / `defaultValue` / `onValueChange` and `size` `sm` / `md`, and work uncontrolled. Select forwards `ref` and its other props to the trigger, so the 13 accessible names it used to drop (11 `aria-label`, 2 misspelled `ariaLabel`) now reach screen readers. `scripts/codemods/form-controls.mjs` moved about 770 call sites in 209 files; old names still work with a dev warning, and the guardrails block them. Fixes the Add Tag description, which threw on every keystroke. No migration.
- **Pharmacy worklist: Reopened gaps, plan status, PDC to date, call and verification parties.** A gap comes back as **Reopened**, for one of two reasons (the Next Fill Due and Claim columns say why). **Claim reversal** (a closed gap's claim was reversed or cancelled) is the alarm: the gap always shows even when the row is collapsed, and the member is pinned to the top whatever the sort. **New fill due** is a cycle a matched claim closed coming due again. Both read as an amber Reopened badge. A reopened gap moves to In Progress once outreach is logged, and the team can still set its status by hand. A missing claim still goes back as rework, not Reopened. New **Plan Status** column and filter show the plan's own Open / Closed (`planStatus` on the gap, else the file's adherence flags) beside Fold's Gap Status. PDC keeps dropping between gap reports: with the report date (`pdcAsOf`) it moves the plan's PDC by the days covered or missed since; without one the plan's number shows as sent. The team can set PDC by hand from a gap's details (pencil, Use calculated to go back); the PDC Source filter gains Manual. Call Pharmacist and Call Prescriber list everyone from the gap report and the claims and ask which one when there are several. Pharmacy Verification asks who was called (Pharmacy, Physician or Member, then which one) and titles the call "Verification call · Physician: Dr. Lin". Everything lives in the `measures` jsonb, so no column changes; `supabase/pharmacy_pdc_as_of_seed.sql` backfills `pdcAsOf` for the 10 demo members.
- **Care plan top is one card with a segmented toggle (Figma P360 Revamp 8340:295397).** It replaces the stats line above it (goal, intervention and barrier counts, progress, status counts and next touchpoint now head the Summarize tab) and the cadence badge. Tabs: **Care Plan Note** (read-only, with author, time, and history and delete on hover; clicking opens the note box, `@` to tag, `/` to link a goal, intervention or barrier; Enter saves, Shift + Enter breaks a line, Esc cancels), **Summarize with Unity**, **Events Updates** (the #84 events, scrolling inside the card) and **Review Cadence** (the cadence details and patient override); each tab has its own empty state, and a pulsing dot marks a tab with something to review (summary actions not ticked off, events to decide, a review due or overdue). Opening the plan writes the AI summary when there is none, or when the plan changed after it was written, once per visit, and switches to it when written. `/api/care-plan-summary` now returns each action with the goal, intervention or barrier it is about (`{ text, refType, refId }`, checked against the ids sent); each action has an **Open goal / intervention / barrier** button and a checkbox saved in the summary (`summary.done`). Older string actions still render. Stored in the existing `patient_care_plan_program_summaries`; `bun run seed` adds a demo summary for 11089. New primitive options: `Toggle` `variant="ghost"` (no track, 28px segments, for a grey surface) and a `leadingIcon` per item, `Textarea` `toolbarOnFocus`, `onEnter` and `onEscape`; `Toggle` items take `notif`.
- **Reason prompt on care plan status changes is an org setting, off by default.** Settings > Organization has a new switch, **Ask for a reason on care plan status changes**. Off (the default), a goal, intervention or barrier's status changes straight away and its `gbi_status_history` row is saved without a reason. On, every status menu asks as before (required for Met, Resolved, Discontinued and On Hold). It saves when toggled, like the care plan level. Needs `supabase/org_settings_status_change_reason_migration.sql` (`org_settings.ask_status_change_reason`); until it runs the prompt stays off.
- **@ tags and / links in every care plan note box.** The Review care plan drawer's call note, the Complete review popover, an item's note in the Review drawer, editing a note on its Notes tab, the Note section of the goal, intervention and barrier drawers, and the quick note popover now work like the Care Note: `@` tags a care team member and `/` links one of the plan's goals, interventions or barriers. Each linked item gets a `note_linked` row, so the note shows in its activity log; an edit logs only the links it adds. Item and quick notes still save their plain text (with the HTML kept in `meta`), call notes stay rich text. The people and items offered come from one hook, `useCarePlanNoteRefs` (`care-plan/lib/carePlanNoteRefs.js`). The mention picker now opens above a Popover, so it shows inside the quick note. No new migration: it uses `care_plan_audit.meta` from `care_plan_audit_meta_migration.sql`.
- **Badge speaks the shared vocabulary.** `Badge` takes `tone` (neutral, primary, secondary, success, warning, danger, info, plus the magenta and unity accents), `variant` (soft, outline, ghost, solid), `size` xs / sm / md / lg and `disabled`. The 60-odd feature looks it carried (`toc-*`, `awv-*`, `compliance-*`, `status-*`, …) are gone: features map their statuses to a tone in their own tables, moved by `scripts/codemods/badge-tones.mjs` (about 1,090 edits in 226 files). Colors snap to the Figma Badge tones, so neutral pills read a shade darker, purple pills a shade lighter, and orange text uses the AA shade. New `Kbd` primitive for keyboard keys; `src/lib/riskTone.js` maps LACE risk to a tone for every worklist.
- **Clinical protocol Extracted Items: what each list is for, checks in place, passages highlighted.** Each section of a protocol's Extracted Items opens with one plain line on what it holds (thresholds, decision rules, cadence, medication titration, cross-references). The parser now puts a doubt about one item (a conflicting value, a typo, unclear wording) on that item as a check, shown under it with **Mark Checked**, and its section counts what is left to check; only concerns about the whole document stay in their own section. Opening an item's Source shows the original PDF in the left pane with the quoted passage highlighted and scrolled into view (new `PdfPassageViewer`, pdf.js, matching ignores spacing, case and punctuation). Protocols parsed before this keep their flags at the top until parsed again. No migration.
- **Care plan review cadence (#131).** Settings > Care Program Configuration has a new **Cadence** tab: how often each program's care plan is reviewed (HICM weekly, CCM monthly, SNP quarterly by default), an optional cadence per acuity (CCM and SNP tighten for High), how many days past due a review is flagged overdue, and a post-discharge spike (weekly for 30 days after an inpatient discharge, then back to normal). A patient's care plan shows a small **review cadence** badge in its summary strip (amber once due, red once overdue); clicking it shows the cadence in force and why (program default, acuity, patient override or post-discharge), the next review date, and a Due or Overdue badge. Care managers can override the cadence for one patient with a reason; the change is logged in the care plan History. The next review counts from the last finished care plan review (else the signed plan), so completing a review moves it on. Discharges come from ADT clinical events, and the cadence is worked out each time, so the spike ends on its own. Paused plans show no cadence. Needs `supabase/care_plan_cadence_migration.sql`.
- **Event-based care plan updates (#84).** New patient data now reaches the care plan. Database triggers record every new ADT event, lab, encounter, vital, medication start, change or stop, completed assessment and signed note in a `care_plan_events` inbox, whoever wrote it. When a care plan opens, its unreviewed events from the last 30 days are checked once against the plan with rules (a lab or vital that measures a goal, a value outside the reference range, a discharge or ED visit, a medication change, an assessment the plan tracks, a signed note). Events that touch the plan get proposed changes: the rules propose recording the value on the goal it measures, and the AI (`/api/care-plan-event-update`) drafts status changes, target changes and new goals, interventions or barriers, each with a rationale, keeping only changes that point at real items. A **Plan updates from new events** card lists them by event; each change is accepted (applied to the plan through the usual save actions, so History records it) or dismissed, with Accept All per event. Every evaluation is a `care_plan_event_impacts` row, so an event is never asked about twice. Needs `supabase/care_plan_event_updates_migration.sql`.
- **Reason and note on every care plan status change (#62).** Changing a goal, intervention or barrier's status, from any status menu (care plan tables and bulk actions, the item drawers, the comprehensive care plan, the Review care plan drawer and Monitoring), now opens a small dialog showing the move (Not Started → Discontinued) with status-specific reasons ("Patient refused", "Replaced by new goal", "Goal met", "Patient hospitalized" and so on) and an optional note. A reason or a note is required for Met, Resolved, Discontinued and On Hold, and optional for the rest; cancelling leaves the status as it was. Every change, including those made by program status automations, is a `gbi_status_history` row with from and to status, reason, note, source and who made it, the record the activity log (#63) reads. The latest reason also shows in the status badge's tooltip. Needs `supabase/gbi_status_history_migration.sql`.
- **Buttons show that a click is being worked on.** `Button` and `ActionButton` get a `loading` state: a spinner in the label's color replaces the content after 150ms (so quick actions don't flicker), the button keeps its size and colors, and repeat clicks are ignored. It turns on by itself while a promise returned from `onClick` is pending, so every async handler gets it with no changes. `scripts/codemods/button-loading.mjs` moved 58 buttons that switched their label to "Saving…" onto `loading` with a steady label. New `Spinner` primitive.
- **Patient profile Outreach tab: classic form, Member Outreach, shared timeline.** The profile's Outreach tab goes back to the pre-chat outreach form (Log Outreach For, type and date, Last Call card, call details, program/gap pills, outcome radios); every other host keeps the composer (`OutreachTab` `classicForm` prop). Picking no program or gap now logs the note as a **Member Outreach** (the badge that used to read "Contact-level"); it isn't written to any program's activity log. **Use This** on the Last Call card fills the call fields and closes the card. The Outreach Activity list now renders through the shared `ActivityLog` (icon rail, meta line, small program badges, View Note on hover, Edit/Delete menu), and a note-only entry opens as a compact note without a heading. `ActivityLog`'s outreach variant gains toned badges (`{ label, tone, title }`), `expandLabel` and `outcomeAside`. No migration.
- **Clinical protocol uploads produce a scope, and the template only on Approve.** Each uploaded protocol now gets a **scope** as well as its extracted items: a plain-language plan for care managers and nurses, with the protocol's categories (BP stages, pain phases) and, for each, its range, a "goal 1 is ..., goal 2 is ..." explanation and its goals, interventions and barriers. The review drawer follows the HCC drawer: at 700px it shows the scope (overview, conditions, and Every patient plus each category as a row with its G / I / B counts; Details and Extracted Items are tabs beside it), and opening a row widens it to 1280px with a left pane holding only that category's goals, interventions and barriers in the care plan's own tables (or a nested view, each goal with what it links), where an admin edits its name, range and goal count and adds or removes goals, interventions and barriers from the library; approval takes those lists as edited. Extracted Items lists the original file (shown or hidden in the left pane, and each item's source page opens there) and the parser's flags as numbered sentences. Each pane scrolls on its own; **Refresh** redrafts from the edits. The stacked alerts are one quiet line, and Needs Review uses the warning orange. G / I / B also show on each protocol row, and the library intro is now a numbered Upload, Review, Approve, Build flow (`IntroCard layout="flow"`). Nothing is created during review: **Approve** turns the scope into the linked draft care plan template with its categories (new goals are added to the library then), **Reject** deletes the upload and its file, and an upload can be cancelled mid-way. Approve, save and delete now notice when RLS changed nothing (a non-admin) instead of reporting success. The scope lives in `clinical_protocols.protocol.plan`; `supabase/clinical_protocols_cancel_upload_migration.sql` lets a non-admin's cancelled upload remove its row and file (applied on Dev and production).
- **Scheduled care plan template retirement.** Retire (Settings > Care Plan Library, row menu) now asks **When**: Retire now (the default) or **On a date**, a future Los Angeles day. Until then the template stays in use and shows **Retiring on MM/DD/YYYY** beside its version in the library, on its row in Add Care Plan Templates and on its chip in a patient's plan. The replacement is a deliberate choice: **Use another template instead** (pick one) or **No replacement**; Retire stays disabled until one is chosen. The retiring template's editor says "This template is being replaced by X" ("Replaced by X" once retired), the replacement's row says "Replaces A, B", and the Retired Templates column is now **Replaced By** ("No replacement" when none). **Cancel Retirement** in the row menu calls a scheduled one off; Restore still works. A nightly pg_cron job (`retire_scheduled_care_plan_templates`, 09:05 UTC) retires templates whose day has arrived, the same way Retire does, so automations switch to the replacement without anyone opening the app. Needs `supabase/care_plan_template_scheduled_retirement_migration.sql` (applied on Dev).
- **Tags and links in the care plan's Care Note.** The Add/Update Note drawer now uses the shared rich `Textarea` (its own Note title and required mark). Type **@** to tag a care team member, or **/** to link one of the plan's goals, interventions or barriers from a grouped picker. Both show as chips in the note and on the Care Note card, and come back as chips when the note is edited. Each linked item gets a `note_linked` row, so the note appears in that item's activity log (and in its goal's, which includes linked items) under Notes. Like other notes, these rows sit outside the signed snapshot. `Textarea` gains `links` / `onLinksChange` for the "/" picker. Needs `supabase/care_plan_audit_meta_migration.sql` (adds `care_plan_audit.meta` for the note's HTML, tags and links; notes still save without it).
- **Task templates spawn real tasks.** On a care plan template (and in the Interventions and Goals libraries), a Patient Task or Internal Task is now a task template: title, priority, **labels**, and for an Internal Task an **assignee role** from the care team roles plus a **task pool** used when nobody on the patient's care team holds that role. The due date offset (calendar or business days) is the SLA. Editing an intervention on the template screen now saves into the template (it used to be discarded). When the template is applied, each task intervention remembers its template entry, and `spawn_care_plan_tasks()` creates the task once its creation date arrives (on apply, on signing, and nightly via pg_cron for delayed ones): routed to the role holder, else the pool; the Patient Task goes to the member. It reads the template entry at creation time, so an edited task template changes every task not yet created and leaves existing tasks alone. Paused plans wait; interventions applied before this change never spawn. Repeat is not applied yet (one task per intervention). Needs `supabase/care_plan_task_templates_migration.sql` (applied on Dev).
- **New Care Plan: draft from a reference template, previews and a tidier form.** In **Draft with UnityAI**, a **Reference template** field under Clinical protocol picks one published library template; UnityAI starts from its goals, interventions and barriers and adapts them to the description (the pick shapes the draft only and is not saved on the new template). Use Template is hidden in that mode. Every protocol and template in those dropdowns has an eye button that opens a read-only preview drawer (shared `Select` options take an `action`). Upload lives only in the protocol label row. The chronic condition picker sits under **For Chronic Conditions** (new / edit), an episodic template's program and pause settings fold into **More controls**, and the "How episodic templates work" card is a start, pause, end timeline (`IntroCard layout="steps"`). No migration.
- **Quick notes on goals, interventions and barriers; plan notes always on show (#18, #80).** The note button on a care plan row now opens a quick note beside it: the item's latest note, a box for a new one, the Review drawer's quick tags (Patient reported, Education given, Follow-up needed, Barrier found) and **Open Notes** for the item's full history in its drawer. Notes stay live audit rows outside the signed snapshot, so a note never counts as an unsigned change or starts a new plan version; the popover and the Care Note say so. The care plan's **Care Note** section is always shown (it still collapses): with no note it offers **Add Note** in place (before, it appeared only once a note existed and was added from the header menu). The comprehensive care plan gains a collapsible **Care Notes** section showing one program's note at a time, with a toggle beside the title to switch program; it stays hidden until some program has a note. Its toolbar note action, which used to only show a toast, now saves: one radio row picks All programs or a single program. **Summarize** moves into that toolbar beside the note action, and the AI Summary section only appears once a summary is generating or saved. That view also loads each program's audit itself, so Care Notes and Activity Since Review fill in without opening a plan first. No migration.
- **Episodes run as their own program, with pause rules and a nightly close.** An episodic care plan template now names the program it runs as (TOC IP, TOC ED or the new **Home Health** program) and, optionally, which programs it pauses (empty pauses every other ongoing plan; other episodes never pause). Applying one from any care plan enrolls the patient in that program with a care plan of its own, pre-picks the plans to pause by those rules (the plan it was applied from can pause too) and opens the new plan. Ending the episode completes that enrollment. A nightly job (`close_due_care_plan_episodes`, pg_cron) closes episodes past their last day the way End Episode does, resumes the paused plans and writes the audit trail as System, so nothing waits on someone opening the plan. TOC IP gets a Care Plan step, and two episodic templates are added from existing templates' entries: Transitions of Care - ED (TOC ED, 14 days) and Home Health Episode (until closed). Needs `supabase/care_plan_episode_programs_migration.sql` (applied on Dev).
- **Template groups.** Care Plan Library > Template Groups bundles templates that go together (for example "Diabetes with HTN order-set" = Type 2 Diabetes + Hypertension + SDOH Support Plan). Supervisors create and edit them in a drawer, members in the order they're applied; changing the members makes a new version (`care_plan_template_group_versions`), a new name doesn't. On a care plan, **Groups** beside Templates applies a group in one click: members not on the plan yet (retired and draft ones skipped), each with the category the patient's latest results match, then the duplicate check runs and the toast says how many possible duplicates to review. The plan records the group and version; when the group later gains templates, the plan offers them (Add or Dismiss). Needs `supabase/care_plan_template_groups_migration.sql`.
- **Template retirement.** A supervisor can retire a care plan template from its row menu (Retire), optionally naming a replacement ("Use instead") and a reason. Retired templates leave Plan Template and the Add Care Plan Templates drawer, so they can't start new plans; plans already using one keep it, show a note with the replacement and an Add button that opens the drawer with it checked, and the template chip says Retired. Enrollment automations attach the replacement in a retired template's place (or nothing, with no replacement), and UnityAI never offers a retired template. A new Retired Templates tab lists who retired each one, when and why, with Restore. Retiring from Suggestions uses the same action. Needs `supabase/care_plan_template_retirement_migration.sql`.
- **Move care plans to a new clinical protocol version.** Approving a new version of a protocol (one that replaces an Active version) opens an impact analysis: every active care plan run still on an earlier version, directly or through a template "Based on" it, counted by version, care program, IPA, care manager and population group, with the plans listed. The supervisor picks **Migrate all now**, **Migrate by cohort** (FilterChips; the rest stay on the prior version) or **Next review only** (each plan moves when its next care plan review is completed); **Decide Later** leaves them, and the protocol's menu offers **Migrate Care Plans** again. Each decision is a `clinical_protocol_migrations` row (who, when, mode, cohort, from/to version, counts) and each plan that moves gets a care plan History entry ("Clinical Protocol: Protocol v2.1 → v2.2 (mode)"). Moving records the protocol version a run follows; changing its goals still goes through a template version. Needs `supabase/clinical_protocol_migrations_migration.sql` (applied on Dev).
- **Template suggestions show the last analysis run.** Care Plan Library > Suggestions shows when the analysis last ran ("Last run: Today, 1:22 PM"); hover for whether it was the nightly job or who ran it. Each run of `refresh_care_plan_template_suggestions()` is logged in `care_plan_template_analysis_runs`. The tab also matches the other library tables now: filters behind the filter button, pagination, two-line explanations and icon actions. Needs `supabase/care_plan_template_analysis_runs_migration.sql`.
- **Clinical protocols: admins edit and approve.** Only practice admins (Admin/Practice Manager or Business/Practice Owner) can edit, approve, parse again, retire or delete a clinical protocol; everyone else sees it read-only with a note. Any staff user can still upload, which creates a draft for an admin to review. Row-level security enforces the same rules, and Fold protocols can't be changed from the app by anyone. Needs `supabase/clinical_protocols_admin_rls_migration.sql`.
- **Assessment-to-template mapping.** The form builder has a new **Care Plan** tab between Score and Preview. Each rule maps a score range (for example, PHQ-9 score from 10) or specific answers (for example, any non-zero answer to PHQ-9 Q9) to one or more published care plan templates. The editor shows which bands a range covers and flags rules that are incomplete or point at a deleted template. When a response with a patient is completed, from the staff form view or the patient app, a database trigger matches the rules against the score snapshot saved at submit and records a pending suggestion per template in `assessment_care_plan_suggestions`, with the reason. A score counts only once it is complete, and a template already pending for the patient isn't suggested again. A program's care plan shows its pending suggestions in a **Suggested by an assessment** card with each template and reason: **Recommend Care Plan** has UnityAI merge them (with any automation matches) into a flagged recommended plan, and **Dismiss** sets them aside. Approving the recommendation marks them accepted; discarding it dismisses them. Suggestions sent for another program, or for a template already on the plan, don't show. Needs `supabase/assessment_care_plan_suggestions_migration.sql`.
- **Vercel deploys are manual.** Git pushes no longer deploy on their own (`git.deploymentEnabled: false` in `vercel.json` and `patient/vercel.json`); the two Vercel projects were hitting the Hobby plan's 100 deployments a day. Use the **Deploy** workflow (Actions tab > Run workflow): production ships `main`, preview deploys any branch, for the app, the patient app or both. Needs the `VERCEL_TOKEN` repository secret. PRs no longer get automatic preview links.
- **UnityAI drafts a care plan template when a protocol is approved.** Approving a client clinical protocol starts a background UnityAI draft: Common goals plus categories by the protocol's graded thresholds on measurable labs (for example SBP 180 or above, 140 or above, 130 to 139), each adding that grade's own interventions such as same-day escalation or titration review. Goals come from the library only, so nothing unreviewed is added to it; interventions and barriers may be new template entries. The draft is saved to Draft Templates, linked to the protocol and version, for a supervisor to review and publish, and a toast says when it's ready. The protocol drawer's Care Plan Templates card offers Draft Care Plan Template for protocols approved earlier or to draft again. Fold protocols keep their starter templates. No migration.
- **Describe the patient when the record is empty.** When a patient's profile and record have nothing UnityAI can plan from (no conditions, condition tags, labs, events, assessments or barriers), the empty care plan asks the care manager to describe the patient in plain English, and UnityAI drafts the plan from that: library first, every item citing the description (shown as "Care manager" evidence), flagged until the plan is approved. Profile condition tags (p360 `condition_tags`) now count as planning inputs too.
- **Care plan template suggestions.** A new Suggestions tab in Settings > Care Plan Library (supervisors only) lists what a nightly analysis of template runs and goal outcomes flags: templates rarely used (retire), often removed while a plan is being built (high abandon), with goals rarely met (low goal attainment), used only in part or spanning many conditions (split), and applied together or sharing most goals (merge). Each kind needs a minimum sample. UnityAI words the why and a next step; the rule's numbers stay underneath. Accept on a retire archives the template (it leaves Plan Template and Apply Templates but stays on plans that use it, and Undo or Restore brings it back); Accept on the other kinds records the decision and opens the template editor. Dismissed or accepted suggestions are not raised again for 90 days. Run Analysis refreshes on demand. Needs `supabase/care_plan_template_suggestions_migration.sql` (enables pg_cron, adds the `archived` template status).
- **Template category switch suggestions.** When a patient's latest results match a different category than the one a template run follows (or a category, for a run on Common alone), the care plan shows a banner with the reason and Switch Category / Dismiss. Switching closes the run like Apply Again > Reinstate: items only the old category brought (and items linked only to them) move to the plan's history with it, the new category's items are added, Common stays, the new run keeps the old end date, and History logs "Category Changed". The earlier run's chip shows its category. Dismissing records that category on the run so it isn't offered again. Results are re-read at most every 10 minutes. Needs `supabase/care_plan_category_suggestion_migration.sql`.
- **Episodic care plan templates.** A template can be General, For Chronic Conditions or **Episodic (event-based)**: care for one event such as a hospital discharge or a home health stay. An episodic template picks a length (30 days for TOC-IP, 14 for TOC-ED, Until closed for home health, or a custom number of days) and whether it pauses the patient's other care plans; the editor explains how episodes work, and the library and Apply Templates list show an **Episodic** badge. Applying one asks to confirm the last day and which of the patient's other plans pause. While it runs, the plan shows the day count with **Extend** and **End Episode**; paused plans say they are paused for the episode and resume automatically the day after it. After its last day the episode closes when the plan is next opened: its goals and interventions move to history (still open from the template strip) and the paused plans resume. Logic in `care-plan/lib/episodeTemplates.js`. Needs `supabase/care_plan_episodic_templates_migration.sql` (applied on Dev; marks Transitions of Care (TOC) as a 30-day episode).
- **Recommended care plans from automations + UnityAI.** When a patient enrolls in a program with an empty care plan, every active enrollment automation whose clinical criteria they meet contributes its templates, and UnityAI merges all of them into one plan tailored to the patient (duplicates removed, every item citing the record). Items land flagged; **Approve Plan** makes it the patient's plan, **Discard** removes it, and the care manager gets a review task listing why each rule matched. With no automation match UnityAI picks templates itself; if the AI can't run, the matched templates attach as before. The empty plan's card and the plan menu offer **Recommend Care Plan** on demand. A pending recommendation shows the UnityAI mark on the program's Care Plan step. Opening a UnityAI-drafted plan no longer adds back every library-linked item it left out.
- **AI Summary on each program's care plan.** A program's Care Plan step now has an **AI Summary** section above Care Note with the same **Summarize** recap the Comprehensive Care Plan has, scoped to that program's goals, interventions and barriers. The summary is saved per patient and program and stays (across reloads and for everyone) until someone regenerates or dismisses it from the card. The trigger, loading state and card are now shared (`care-plan/summary/CarePlanAiSummary`) by both views. Needs `supabase/patient_care_plan_program_summaries_migration.sql` (applied on Dev).
- **Care plan template categories.** A template's goals, interventions and barriers are now its Common section, and it can add categories: named groups with entry criteria (chronic conditions and latest lab results such as HbA1c, eGFR or LDL, on the automations criteria engine) and their own goals, interventions and barriers. New and Edit Care Plan show Common and each category as tabs, with the category's criteria above its tables; categories are checked in order and the first match wins. Adding a template to a patient's plan presets the category their latest results match and says why ("HbA1c 7.1 % on 06/15/2026 is at or above 7"); the care manager can change it, and must pick one when nothing matches. The patient gets Common plus that category, the run records it, and the template badge on the plan shows it; applying again, restoring and moving to a new version keep it. The Fold Type 2 Diabetes starter template comes with three A1C categories (9% or above, 7% to 8.9%, below 7%). Needs `supabase/care_plan_template_categories_migration.sql`, then `supabase/fold_protocols_seed.sql` again.
- **Fold Pathways become Fold clinical protocols and starter templates.** The Fold Pathways tab is gone; each of the six pathways (type 2 diabetes, heart failure, COPD, CKD, hypertension, dyslipidemia) is now split in two. Its thresholds, decision rules, cadence and sources are an Active, read-only clinical protocol with organization "Fold", listed with the client's own in Clinical Protocols and usable in Draft with UnityAI. Its goals, interventions and barriers are a published starter template in Plan Template, "Based on" that protocol. Templates adapted from a pathway now link to its protocol, and old Fold Pathways links open Clinical Protocols. Content lives in `clinical-protocols/data/foldProtocolContent.js`; `scripts/genFoldProtocolsSeed.mjs` writes `supabase/fold_protocols_seed.sql` (idempotent; starter templates resolve library titles in SQL). The `care_pathways` table is no longer read.
- **Clinical Protocols move into the Care Plan Library.** Clinical Protocols is now a tab in Settings > Care Plan Library, next to Plan Template, instead of its own Settings item; old `#/settings/clinical-protocols` links open the tab. Its status tabs became a Status filter beside Condition, Program and Organization, and those filters no longer crash the page when opened.
- **New Care Plan: build it yourself or draft with UnityAI.** New Care Plan starts with a choice. Build it yourself shows the plain form; Draft with UnityAI adds the Clinical protocol picker and the description prompt, and keeps Care Plan Name and Description locked until UnityAI has written them (they open for edits after the draft; Discard Draft clears them again). The protocol picker can also upload a new protocol (an Upload button beside its label, and the first option in its list): it opens the upload and review drawers, and the protocol is picked as soon as it is approved. A template now records a protocol only when its draft actually followed one.
- **Design Signoff: review without an item, on review-dock 0.2.3.** **Start a review** in the Signoff drawer header opens the review box on the current page without picking a feature. That feedback is saved with the page it was made on and listed under a new **General feedback** tab, visible to its author and the Signoff managers. The review box picks up review-dock 0.2.3's frosted glass panel, and the Open in Signoff row now sits at the bottom of the box. Needs `supabase/feature_review_general_feedback_migration.sql` (applied on Dev).
- **Patient sign-in paused emails.** Two Account Security templates in the redesigned style: one tells a patient their patient app sign-in is paused and to reset their password to unlock it (no admin step), the other tells the care team which patient is paused and that the patient resets their password. New merge tags `attempts`, `reset_password_link` and `locked_patient_*` / `patient_profile_link` (also fills `{{attempts}}` in the Sign-in Paused preview). Like the other `_v2` security emails, the server doesn't send them yet.
- **Clinical protocols guide template drafting.** New Care Plan has a Clinical protocol picker (Active protocols); the chosen protocol's thresholds, decision rules, cadence and medication titration go to the UnityAI drafter, and the saved template records the protocol and version and shows "Based on clinical protocol". The protocol's review drawer lists the templates drafted from it and flags ones built on an older version. Settings > Clinical Protocols opens with a dismissible intro card (new `IntroCard` pattern); the ? button after Upload Protocol brings it back. Also fixes typing in the UnityAI prompt field. Needs `supabase/care_plan_template_source_protocol_migration.sql`.
- **Barrier priority and a sortable P column.** Barriers carry a High / Medium / Low priority like goals and interventions, set from the priority icon on a patient's plan and in the Care Plan Library template editor (new barriers default to Medium). Priority now has its own narrow "P" column in the Goals, Interventions and Barriers tables; clicking the header sorts by priority. Priority icons line up under the header and with each row's type icon.
- **Button and ActionButton speak the shared vocabulary.** `Button` takes `variant` (solid, soft, outline, ghost) for emphasis and `tone` (primary, neutral, success, warning, danger, info) for intent, with `size` sm / md / lg; `ActionButton` takes `size`, `tone` and a plain `disabled` instead of `state`. One CSS matrix (tone custom properties × variant rules) replaces nine hand-painted variants. `scripts/codemods/button-variants.mjs` rewrote about 2,270 call sites in 516 files with no visual change; old names still work at runtime with a dev warning, and the guardrails block them in new code. New `--on-color` token for text on filled colors. See `docs/components/library-contract.mdx`.
- **Design Signoff review: thumbnails, annotation, back to Signoff.** The review box shows attachments as square thumbnails; clicking one opens a full-size preview with **Annotate**: a clean canvas with one floating toolbar (rectangle, highlight, ellipse, arrow, line, pen, text, numbered steps, redact for PHI, crop, colours, undo/redo) on the open-source Konva canvas library, with Solar icons. Done saves at the screenshot's full resolution. **Open in Signoff** in the box opens the Signoff drawer on the same item, ready to sign off. The box now sits just under Fold's drawers. Ships in `review-dock` 0.2.0 (now React 19+).
- **One Popover for every anchored overlay.** New `Popover` primitive (Floating UI) positions, stacks, dismisses and manages focus for anchored overlays; 14 library popovers (`MenuPopover`, the list pickers, `DatePickerPopover`, `DateRangePopover`, `AnchoredPopover`, …) now build on it instead of their own `createPortal` math. They flip and shift to stay on screen, share one surface (8px radius, `--shadow-popover`), and Escape or an outside click closes only the top one. Menus and pick lists (menu, checkbox, radio, search, sort, user) move with the arrow keys. `Drawer` is now a labelled modal dialog: focus moves in, Tab stays inside, focus returns on close, and Escape closes it (after any inline dropdown or edit inside has used the key, and through unsaved-changes guards). See `docs/components/library-contract.mdx` → Overlays.
- **Fold Pathway Library.** Settings > Care Plan Library > Fold Pathways lists the care pathways Fold ships with every account (type 2 diabetes, heart failure, COPD, CKD, hypertension, dyslipidemia). Each has a recommended GBI set drawn from the Care Plan Library, decision logic (thresholds and rules) and recheck cadence, every item naming the guideline or Fold practice it rests on. Pathways are read-only; Adapt into Template makes a draft to edit, and supervisors can Use as Template to publish it as is. Templates remember the pathway and version they came from. Content lives in `carePathwayContent.js`; `scripts/genCarePathwaySeed.mjs` writes `supabase/care_pathways_seed.sql`. See `supabase/care_pathways_migration.sql`.
- **Patient consent redesign.** The Patient Consent popover follows the new design: 12px status dots (green given, red declined or withdrawn, amber not given), an Other Consents section with Data Sharing, and no TCPA row (texts now need SMS consent and autodialed calls Call consent). Call, SMS and Email switches confirm in a small Accept Consent to Contact dialog, and the Communication heading switch covers all three. Capture Consent shows the agreement with give / choose-not-to choices (full Medicare APCM agreement; Data Sharing signs on screen), without witness or expiry. The history icon opens a Consent History drawer (tabs, search, status filter) on the shared ActivityLog. The banner badge counts all four program consents. Needs `supabase/patient_consents_other_scope_migration.sql`.
- **Patient app: error boundaries.** A component error no longer blanks the patient app. Each Home tab and each page has its own boundary (Try Again; it also clears when you switch tab, page or profile), and a last-resort boundary offers Reload and Sign out. New shared `ErrorBoundary` component.
- **Patient app: Claims and coverage.** The Claims tab shows a Coverage Overview (deductible and out-of-pocket bars, in and out of network, with plain-words explanations), Cost Breakdown, an Understanding Your Coverage guide, and a Claims Log with status filter, sort and Claim Details with the Explanation of Benefits. New tables `patient_coverage`, `patient_claims`, `patient_claim_lines` (responsibility is computed, so totals always add up); `scripts/demo/patient_claims_demo.sql` fills demo data until a payer feed exists. See `supabase/patient_claims_migration.sql`.
- **Patient app: Settings and packages.** Settings now has Family Members, My Packages (Enrolled, Available, Opt-out), Change Password, Communication Preferences and About Fold. Packages are a new patient-facing catalog (`patient_packages`, `patient_package_enrollments`); asking to join or opting out also messages the care team in Chat. Home gets the Introducing Packages card. See `supabase/patient_packages_migration.sql`.
- **Patient app: Documents.** Patients see documents staff share with them (new **Share with patient** in the staff Documents tab row menu) and upload their own (PDF or image, up to 10 MB), which show in the staff tab marked "From patient". Files stay in the private `program-documents` bucket behind signed links; the storage gate is now split by command so patients can only read their documents and write to their own folder. See `supabase/patient_documents_migration.sql`.
- **Patient app: Edit Profile.** Patients update their own contact details, address, preferred contact method and e-communication consent from Home; name, date of birth and gender stay with the care team. Changes land in `p360_profiles` (what the staff Profile tab reads), consents in `patient_consents`, and each change is logged in `patient_profile_changes`. See `supabase/patient_edit_profile_migration.sql`.
- **Patient app: Care Tasks.** Home's first tab now shows the day's medicines by time of day (tick one or All Done; logged in `patient_medication_doses` for staff), education from the care plan, and forms the care team sent, filled in a drawer with the shared form renderer. The patient build now allows `src/features/forms/{render,builder,scoring}`, which never import the staff store. See `supabase/patient_care_tasks_migration.sql`.
- **Patient app: care team sign-in.** Everyone who uses the provider portal can sign in to patients.foldhealth.org with the same credentials (password or Google) and view the portal as any patient they pick, with a "Viewing as" banner. What they send or book there is labeled as theirs. New shared `OAuthButtons` component (Google, Microsoft "Coming soon"). See `supabase/staff_patient_portal_access_migration.sql`.
- **Patient app: health records and notifications.** Home's right panel now has the Care Tasks, Health Records, Documents and Claims tabs, with Health Records live (problems, allergies, active medications, immunizations; no clinician notes). The header bell opens a notifications drawer with care-team messages and visit reminders. See `supabase/patient_notifications_records_migration.sql`.
- **Patient app: messages and care team.** Patients (and parents, guardians or caregivers) message their care team from the patient app: the same chat conversations staff answer in Messages > Chat, with unread badges on both sides. Home shows the Care Team with a message shortcut per person. Patients never see internal notes, drafts, calls or emails. `MessageComposer` gains `showSchedule` and hides an empty toolbar; `ChatBubble` uses `AvatarBase`. See `supabase/patient_messages_migration.sql`.
- **Patient portal access for staff.** The patient Profile tab has a Patient Portal section: who can use the patient app for this patient, Give portal access (emails a set-password link; the account is created server-side with the patient role) and Remove access. Settings → Calendar → Appointment types now lists every visit type with an Online booking switch. See `api/_handlers/patient-invite.js` and `supabase/patient_portal_staff_migration.sql`.
- **Patient app: profiles and booking.** A patient account can manage several people (`patient_accounts`): after sign-in a picker chooses who you are acting for, and Home has a switcher. Book Appointment opens a drawer with open times computed from staff availability, and the booking lands in the staff calendar. Patients reach data only through SECURITY DEFINER functions (`patient_profiles`, `patient_available_slots`, `patient_book_appointment`, `patient_upcoming_appointments`); every table stays staff-only. See `supabase/patient_accounts_migration.sql`, `supabase/patient_appointments_migration.sql` and W2 / W12 in `docs/features/patient-app-workflows.md`.
- **Patient app scaffold (patients.foldhealth.org).** A second Vite entry in
  `patient/` (`bun run dev:patient`, `bun run build:patient`) with the
  patient login (email or mobile + password, reset link) and the app shell
  from the Fold Patient Web App Figma. It reuses `src/components`; the build
  fails if anything, even transitively, imports `src/features` or
  `src/store`. New store-free primitives: `NavRail`, and `AvatarBase` split
  out of `Avatar`. Patients share the Supabase project behind a RESTRICTIVE
  `staff_only` policy on every table
  (`supabase/staff_patient_rls_split_migration.sql`); patient accounts carry
  `app_metadata.role = 'patient'` and are created server-side only.
- **Pharmacy barriers and interventions have a lifecycle.** The member
  drawer's Barriers & Interventions tab is read-only, split into Active
  Barriers and History. Each barrier can be resolved, and each intervention
  marked Done or Didn't work; Done offers to resolve the barrier it addresses
  (`INTERVENTION_ADDRESSES`). Update Barriers logs a gap as a whole or, with
  Set per medication, one drug at a time. The worklist's Barrier column and
  filter count active barriers only, and Medication Review shows each gap's
  barrier count while collapsed. Barrier and intervention icons match the
  care plan. Also: verification opens from the drawer, outreach shows Note
  in amber, and pharmacy outreach outcomes are a multi-select by stakeholder.
- **Pausing a care program asks why and until when.** Picking Paused for a
  care program (header or Care Programs table) opens the same dialog as
  pausing a care plan: reason, start date, planned resume date, auto-resume
  and notes. The details are saved on the program
  (`supabase/care_program_pause_migration.sql`) and its care plan pauses with
  it. Moving the program off Paused resumes both; with auto-resume it returns
  to Active when opened on or after the resume date. A paused plan reads
  On Hold in the SNP worklist's Care Plan Status column and filter, with the
  pause in a tooltip. Plan auto-resume now logs once when several views load
  the plan together.
- **Pharmacy worklist P column and member drawer polish.** The Priority
  column is now P, shown with the shared PriorityIcon; clicking it changes
  the member's priority (P1–P3), which wins over the plan file's and is
  logged (`supabase/pharmacy_priority_override_migration.sql` adds
  `priority_override`). In the Pharmacy Gap Details drawer: a Drugs column and
  per-gap prescriber and pharmacy (with phones) in the gap table; medication
  rows with Recent Fill set in bulk from the shared floating BulkBar, an Info
  link for prescriber and pharmacy, and a selected-row state for the open
  drug; medication details in titled sections built from the library's
  labelled Select, Textarea and RadioOptionGroup. A Reason for Non-Adherence
  picked on a drug is now also logged as that gap's barrier in Barriers &
  Interventions.
- **Care program automations (Settings > Automations).** Enrollment
  auto-apply: clinical criteria can now check urine ACR and assessment
  scores (PHQ-9), and a review task with no reviewer or program owner goes
  to the Care Management pool. New GBI auto-status: a "care program status
  changes" trigger and an "Update care plan item statuses" action move every
  open goal, intervention and barrier when a program goes Unable to Reach,
  Paused, Completed or Closed (default: UTR → UTR, reason "Program UTR";
  a program-type automation overrides the account default). New UTR GBI
  status and `status_reason` (`gbi_status_reason_migration.sql`), shown on
  hover. Seeds: `seed_enrollment_automations.sql`,
  `seed_program_status_automations.sql`.
- **Design Signoff.** A "Signoff" item above Help in the nav bar opens the
  Design Signoff drawer: an aligned table of what we're shipping (Feature,
  Reviewers, Status, Actions), grouped by day and sorted
  newest first (switchable to oldest first), with sub-items nested under
  their feature. Every `feat` or `fix` commit on main arrives automatically
  as a suggestion (a trigger on `changelog_entries`); the design team (Alok,
  Ketan and Devanshi, in `feature_review_managers`) keeps it for review or
  removes it, sets the section link and assigns, switches or removes
  reviewers (straight from the row's avatars). Everyone else sees only kept
  items assigned to them. Reviewers get Comment, Sign off (one click; the
  database stamps the date and time and locks it, and the date shows under
  the status) and Open (goes to the section) on each row. Needs `supabase/feature_reviews_migration.sql`,
  `feature_reviews_seed.sql` and `feature_reviews_suggestions_migration.sql`.
- **Pharmacy gap status model, filters, rules and reports.** Pharmacy gaps
  follow the status model spec: Open, In Progress, Pending Claim, Closed,
  Met for Year, Failed for Year and Excluded (First Fill and Not Eligible stay
  off the worklist), with one sub-status per gap and five Claim
  Reconciliation values. Only a matched Part D claim closes a gap; a fill
  logged in Fold is Pending Claim, and a reversal reopens it. The team sets
  only Open and In Progress, and a hand-set status lapses once a newer fill or
  claim arrives. The worklist adds plan / Fold source markers, Savability and
  seven more optional columns, and 70 filters on the shared filter chip bar.
  Outreach rules add the outreach queue, pickup reminders, escalation to the
  prescriber, and Auto-assign by IPA or health plan from a PHARM care team.
  Analytics > Pharmacy Adherence reports outcomes, provider groups,
  productivity and claim data quality. Pharmacy Gap Details is now one drawer
  per member: the member's assignee and Progress head it, a "Pharmacy Gap:
  All | MAD | MAH | MAC" toggle scopes the gap table, the tabs and the
  actions, so one outreach or verification call covers one gap or all of
  them, and each gap row opens to its details (claim, savability, attempts). Migrations:
  `pharmacy_status_model_migration.sql`, `pharmacy_status_model_seed.sql`,
  `pharmacy_care_team_seed.sql`.
- **Pharmacy claim reversals and projected fills.** A confirmed pickup or a
  fill date entered by hand recalculates PDC, next fill and the absolute fail
  date, and the gap shows Completed with a Projected tag until a matching
  Part D claim arrives (then Closed-Data). No claim inside the plan's window,
  a reversed claim or a claim billed to other coverage flags the gap "Claim
  not matched"; the flag opens that drug's claim history next to outreach
  logging and creates a rework task. Reversed, cancelled, deleted and
  negative-value claims drop out of PDC, and only the current sequence of a
  resubmitted claim counts. Claim history tells each fill's story (billed,
  reversed, rebilled, other coverage) with transaction fields marked pending
  Astrana's confirmation, and lists pharmacy-confirmed pickups, now their own
  records, apart from claims. The worklist adds Plan / Calculated / Projected
  tags on PDC, Next Fill Due and Fail Date, Prior Year PDC per gap, and a
  hidden Fills to Stay Compliant column.
  Migration: `supabase/pharmacy_claim_history_migration.sql`.
- **Pharmacy workflow updates.** Every sample patient has MAD, MAH and MAC
  open with more medications. Gap status is Open or In Progress only (no
  Completed or Closed-Data). Medication Review supports bulk Recent Fill
  across gaps, with per-gap and global select-all checkboxes. Each medication
  has a Claims tab laid out like the HCC Claims tab (claim ID, fill date,
  status, amount, and an inline claim detail). Lead Note is now Internal Note,
  next to Outreach. Other Care Gaps is now Open Care Gaps, and each gap in its
  hover card opens Care Gap Details (the pharmacy patients were added to
  HEDIS). The Pharmacy worklist gets Saved Filters like the other worklists.
  Migrations: `supabase/pharmacy_worklist_sample_refresh_migration.sql`, then
  `supabase/pharmacy_hedis_patients_migration.sql`.

- **Pharmacy worklist, HEDIS layout.** Each patient row stacks one sub-row
  per pharmacy gap (MAD / MAH / MAC) with its own status, start date, PDC,
  drug count and claim reconciliation; assignment stays at the patient level.
  New Progress and Other Care Gaps (count, hover list) columns. Priority is always P1–P3 (High/Medium/Low from the plan file maps to it).
  Sub-statuses are a fixed short list; a pickup matched by a paid claim closes
  the gap as Closed-Data; an overdue claim creates a pharmacy follow-up task.
  Days Left, Overdue and both Other Care Gaps filters added. Clicking a gap
  (or the row) opens a Pharmacy Gap Details drawer laid out like HEDIS Care
  Gap Details: header, suggested actions, tabs (Snapshot, Medication Review,
  Outreaches, Barriers & Interventions, Verification, Activity) and a left side
  workspace for logging work and drug details. The same views back the PHARM
  program steps: a Snapshot step (prescriber and pharmacies with click-to-dial),
  Medication Review grouped by therapeutic class with the clicked gap first,
  patient-only barriers with outreach flags, and the pharmacy verification
  assessment as a questions-by-gap table. Outreach stays the app's standard
  form and automations, shared by the drawer and the program step.
  Migration: `supabase/pharmacy_worklist_source_fields_migration.sql`.

- **Add Care Gaps (HEDIS worklist).** A new row action opens an Add Care Gaps
  drawer. You pick IPA, HP code and measure year (prefilled from the patient),
  then one or more care gaps from the Fold whitelist (`caregap_whitelist`), plus
  the workflows they need (Outreach, Clinical Note, Referral, Task). Gaps that
  are already open can't be selected. When a measure was previously closed, the
  drawer shows that gap as the parent, and the new Open gap keeps it in
  `parentGap`.

- **Pharmacy worklist.** New Population › Worklists › Pharmacy list for the
  Med Adherence gaps (MAD / MAH / MAC; SUPD out of scope): one row per member
  with measure chips, the most urgent measure's PDC, fail date and next fill,
  derived P1–P3 priority, the standard Outreach cell, inline status and
  coordinator assignment. Claim reconciliation flags confirmed pickups with no
  claim yet (Awaiting / Overdue), reversed claims and plan-vs-claims PDC
  mismatches, with a matching filter. Clicking a row (or the eye icon) opens
  the member's Pharmacy care program: Pharmacy Verification walks the
  pharmacy call per drug (confirm last fill, refilled?, picked up?, refills
  remaining?), suggests the next action, locks the call as one outreach and
  creates reversal / refill follow-up tasks; Outreach is the standard program
  form with MAD / MAH / MAC as the pills and the Medication Adherence
  Intervention Schema outcomes; a pickup outcome (or verified pickup) moves
  the medication's last/next fill, adds a call-confirmed refill row, sets the
  measure to Completed · Pickup confirmed once every measure is picked up; an Activity Log (program step + worklist row menu) records every
  action; Barrier & Intervention logs one call with barriers, interventions
  and result recorded per measure (barrier / intervention / result outcomes
  logged in Outreach are copied in automatically); Gap Closure / Outcome
  shows each measure's gap status (Open / In Progress / Completed /
  Closed-Data, with a sub-status such as Pickup confirmed, Safe or At risk on
  the second line) with PDC, fill / fail dates and plan signals; measure
  chips and the worklist Status column use the same two-line status (with a
  Gap Sub-Status filter); Medication Review groups medications by measure and opens each one
  in a side drawer with SIG, conditions, non-adherence reason,
  prescriber/pharmacy, notes and refill history. Backed by
  `supabase/pharmacy_worklist_members_migration.sql` (table),
  `pharmacy_worklist_members_seed.sql` (the 10 members, Fold IDs 19401-19410),
  `pharmacy_worklist_care_program_sync_migration.sql` (enrolls each member in
  the Pharmacy Program) and `pharmacy_care_plan_template_seed.sql` (MAD / MAH /
  MAC care plan template), run in that order.

- **Overview widgets redesign (Figma 1312-174/483/589/686).** Vitals tiles
  can be added (recorded vitals, biomarkers, labs), removed and reordered per
  patient for the whole care team (`patient_overview_vitals`). Care Plan
  splits Goals / Interventions / Barriers with a short "why" line on items
  that need attention. Gaps and Active Care Programs follow the new layouts.
  Unity insights open from a lightbulb in each card header. Medications
  leads with what changed: refill due or run out, new, stopped
  (`cards/medHighlights.js`; refill fields from
  `patient_medications_refill_migration.sql`). Risk & Acuity and Consent
  left the Overview (they are in the banner). One type scale across the
  screen: item titles 14, subtitles 13, captions 12.
- **Overview: attention first, Reminders, missed visits.** Each Overview
  widget now leads with what needs action and sums up the rest in one line.
  Care Plan lists only the goals, interventions and barriers that need
  attention (not met, past target or due, trending down, no owner, on hold,
  new high-priority barrier; `attention/carePlanAttention.js`), topped up
  with recently updated items. Active Care Programs flags no owner, not
  started, attempted, unable to reach and ending soon (`programAttention.js`);
  Vitals, Gaps and Notes put off-goal, urgent and unfinished items first;
  Medications leads with changes since the program started; Care Team leads
  with programs nobody owns; Health Chart names the domains below the clinic
  average. Appointments gains a Missed tab (no-shows, cancellations, never
  checked in, last 12 months, rebooked or not, with Reschedule). A new
  Reminders card holds private, per-user reminders on the patient
  (`patient_reminders`, owner-only RLS) with snooze, done and delete.
- **Program access data layer (Phase 2B.1).** Who works in which care
  program: `program_memberships` links a user to a program with an access
  level (viewer, member, supervisor), a care team role and a vendor
  organization (`vendor_organizations`); `access_override_log` keeps an
  append-only record of supervisor overrides with their reason. The rules in
  `src/features/patient/data/programAccess.js` decide view and edit rights,
  overrides, BHI co-sign, and which patients and notifications belong in a
  user's scope. Enforcement is in the app for now: database reads stay
  signed-in only per `supabase/RLS_POSTURE.md`, while membership writes are
  admin-only in the database. Admins and users with no memberships stay
  unscoped, so nothing changes until someone is assigned. The signed-in
  profile now carries `adminRole` and `clinicalRoles` so the app recognizes
  admins the way the database does. Store: `fetchProgramAccess`,
  `saveProgramMembership`, `logAccessOverride`; hook: `useProgramAccess`.
  No UI yet. Needs `supabase/program_access_migration.sql` then
  `supabase/program_access_seed.sql`.
- **Patient consent and preferences (Phase 2A).** Patient consent is now
  a record, not a "2/4" count: `patient_consents` keeps an append-only
  history per program (CCM, APCM, RPM, BHI) and channel (call, SMS, email,
  TCPA) with status, method, who captured it, expiry, witness and the signed
  artifact, stored in a private `patient-consents` bucket and read through
  signed URLs. `patient_preferences` holds channel per program, language,
  interpreter need, health literacy and contact validity. The rules in
  `src/features/patient/data/consentRules.js` decide whether billable work
  can be recorded (a hard block without current consent), whether a patient
  can be contacted on a channel (TCPA for texts and autodialed calls), and
  whether they're eligible to enroll. Store: `fetchPatientConsents`,
  `capturePatientConsent`, `savePatientPreferences`. A guided Capture
  Consent drawer (consent for, decision, method, the script to read, then a
  witness, a drawn signature through the new `SignaturePad` component, or an
  uploaded form) opens from the banner's consent popover, which now shows
  each consent's live state and an audit log, and from the Overview Consent
  card. The banner count covers the patient's open billable enrollments.
  Without current CCM consent no CCM time is recorded (2A.3): the store
  refuses the write, the timer shows why with a Capture link and keeps the
  time, and the billing log leaves unlogged time unclassified. Enrolling
  checks eligibility (CCM needs two or more chronic conditions, RPM one)
  and captures consent first, enrolling once it's given; a program whose
  enrollments have all ended can be enrolled again. Gates stay off until
  the consent table exists, so billing isn't switched off by a rollout.
  The Profile tab's new Preferences view (2A.4) shows the preferred channel
  per enrolled program, language and interpreter need, health literacy,
  and whether each phone and email is valid, edited in a Contact
  Preferences drawer. Outreach warns when the logged channel was declined
  or withdrawn, the number is marked invalid, or a text has no TCPA
  consent. Block Number now writes `p360_profiles.opted_out_comms`, which
  the banner and Contact card read (it wrote the `patients` table).
  Needs
  `supabase/patient_consents_migration.sql` then
  `supabase/patient_consents_seed.sql` (consent reads as missing and
  captures stay session-only until then).
- **Overview: Unity insights and Recap.** Each Overview widget now carries
  its own Unity layer (Figma Reports pattern): a purple strip with the
  widget's headline ("Missed Annual Wellness Visit on 04/10/2026 is not
  rebooked.") over Recommendations rows, one per open item, each with its
  next step (Reschedule, Create Task, Review Meds, Reply, Open Tasks) and a
  Mark reviewed check the whole team sees (`patient_signal_reviews`). Items
  are abnormal labs, ED visits and admissions, missed or cancelled visits
  not yet rebooked, medication changes, messages awaiting a reply, vitals
  off goal, overdue tasks and care gaps, and RAF jumps, new ones flagged
  since the last touch (or the last 30 days). A Recap button in the Patient
  Synopsis header (Unity gradient until you open it, an outline after)
  opens a walkthrough of what happened since the last touch, or over 30 or
  90 days: an At a Glance slide (counts, last touch, what's coming up, a
  plain summary), then touchpoints, clinical events (with repeat ED use),
  vitals with their trends, medication changes and program updates, each
  event with who, when and how it went, and finally the open items with
  their next steps. Each slide leads with what changed against the
  period before (`recapChanges.js`) and a Unity summary of the section
  (`/api/patient-recap-summary`, Gemini, one call for all sections); when
  Unity can't answer, a summary written from the same facts stands in.
  Story: `overview/attention/recapStory.js`; rules:
  `overview/attention/attentionSignals.js`; shared pieces:
  `src/components/UnityInsights` and `src/components/SlideshowDialog`. The
  default lanes now lead with what moves (risk, care plan, gaps, suggested
  actions, tasks), and sample-only reference cards start hidden; layouts
  people already arranged are kept.
  Cards are soft white surfaces on a tinted page (8px radius, no inner
  rules) with one header style: icon, title, 44px, on a 16px edge.
- **Care plan Linkage view.** The care plan's More menu switches between
  Table View and Linkage View. Linkage nests each goal's interventions and
  barriers beneath it with connecting lines, and lists anything not linked to a goal under
  Unlinked at the bottom. Drag a row to another goal to move its link (or
  onto Unlinked to drop it), or use a row's "Link to goal" and "Unlink from
  goal" actions. A barrier linked to two goals shows under both; "Link to
  goal" adds a goal to a barrier, while an intervention (one goal each)
  moves. Writes reuse the existing save calls, so link history is logged as
  before. The tree is the reusable `src/components/LinkageTree`.

- **Patient Timeline.** The right panel's Timeline tab is the patient's
  full timeline: labs (with range flags), ADT events, visits, diagnoses,
  device readings, patient-reported outcomes, medication starts and stops,
  notes, assessments, touchpoints (calls, messages, visits, appointments)
  and program updates, newest first, filterable by category, type and
  program. One stream (`data/patientStream.js`) reads the tables that already
  hold each record. Touchpoints carry their program, billing program,
  duration and vendor. Needs `supabase/patient_event_stream_migration.sql`.
- **Care program lifecycle.** Program status is one list: New, Engaged,
  Attempted, Unable to Reach, Declined, Enrolled, Active, Paused, Completed,
  Discontinued, Re-enrolled (`data/programStatus.js`, `isProgramClosed`).
  Closing a program (End Program, the row menu, or picking Completed /
  Discontinued) asks for a reason (goal met, lost to follow-up, opt-out,
  transferred, other) and logs it. A program can be enrolled again once its
  last enrollment ended: the new instance is numbered (WLCP #2), starts as
  Re-enrolled, and records who enrolled it and a planned end from the program
  type's max duration. The program details panel shows the enrollment and
  the previous enrollments with how each ended. Needs
  `supabase/patient_care_program_lifecycle_migration.sql` (adds the columns
  and keys rows per instance; the app falls back to the old key until then).
- **One Outreach cell across worklists.** TOC IP, TCM, HEDIS, SNP, Annual
  Visit, JSA and CMP render outreach with the shared `OutreachStatus`
  component (Figma SNP-Story 8602:333343): the channel's icon (call, in-person,
  video, SMS, app, email, letter), the result (Attended / Success in green;
  Failed / Followup / Remove in red), the last attempt's date (M/D/YY) and
  three attempt dots (earlier attempts peach, the latest in the result's
  colour, all red once three attempts failed). `outreachStatusModel.js`
  adapts each worklist's outreach data. The CMP worklist also has a View
  Program button on each sub-program line.
- **Automations (Settings > Automations).** Replaces Automation Rules with the
  full automation experience from Figma: template library (grid and table,
  preview, Use Template), My Automations by status with Run, History,
  Duplicate and Delete, and a builder (triggers, conditions, actions, outcome
  branches, delays, repeats, micro automations, duplicate-action warning,
  autosaved working copy, Save and publish). A step-by-step test run checks
  each step without touching real data. Analytics (Global and Node Level),
  overview, email and SMS drilldowns and a per-member trace with Re-trigger
  read run records, so every total adds up. Runs are simulated
  (`src/features/automations/lib/simulate.js`); nothing is delivered. Content
  > Emails warns before deleting an email an automation sends. Enrollment
  rules became automations with the "enrolled in a care program" trigger and
  keep auto-applying care plan templates. Needs
  `supabase/automations_migration.sql` and `bun run seed`; until then the
  screens use in-memory sample data. Design review and decisions:
  `docs/features/automations-design-review.md`.
- **Access Control.** Settings > Account > Access Control lists the roles
  with their user counts and, for the selected role, Platform Access (nav bar
  pages, Patient Details, Sign and Amend EHR Notes) and Settings Access
  switches that save as they change. Roles can be created, duplicated,
  renamed, deleted and have their permissions copied to others; built-in
  roles keep their names. What a role can't see is hidden in the app (side
  nav, Settings menu, the patient page, note signing); admins always see
  everything. Saved in `access_roles` (`supabase/access_roles_migration.sql`).
- **Verify ID on patient sends (VBC-25597).** Compose Email, New SMS, Send
  Content, Send Assessment and the thread's new Send Forms / Send Article
  drawers can protect their links. Ticking "Verify ID" applies the default
  methods as a one-line summary (Edit to change, Save to fold back); anyone
  picked who can't pass the methods is named and blocks Send. Links go out as
  `/#/secure/<token>` links (the verification page isn't built yet), and a
  protected SMS starts with "You have a secure message from Fold Health."
- **Record Vitals.** The + on the patient Vitals tab opens Record New Vitals
  (11 vitals, each showing its last reading). Readings save to
  `patient_vitals` (`supabase/patient_vitals_migration.sql`) and the Vitals
  table shows the latest three per vital; vitals with no readings yet show
  sample history. Shared config: `vitals-labs/vitalsConfig.js`.
- **Configurable program steps and the SNP Snapshot form.** In Settings >
  Care Program Configuration > Steps, Add Step and the gear on every step set
  its name, what it opens in the patient's program (a form from the Forms
  library, a built-in screen, or nothing yet), its section, and Show /
  Mandatory / Alert. Snapshot is its own step (first, above Outreach, for SNP
  and TOC IP); Pre-visit now holds only the Pre-visit Assessment. A program's
  Snapshot renders its "<CODE> Snapshot" form, editable and saved per patient
  program in `form_responses`, above the Primary Care Team. The "SNP Snapshot"
  form (Trigger Information, Member & Eligibility, Outreach & Engagement, Care
  Plan, TOC, Risk Stratification) is seeded by
  `supabase/snp_snapshot_form_migration.sql` / `bun run seed`.
- **CMP worklist and sub-programs.** CMP (Care Management Program) is
  enrolled per sub-program: SPD, Whole Child Model, Basic / Complex Case
  Management, Coordination of Care, Maternity Program or Pediatrics Program.
  Picking CMP under New Program on a member opens that list; sub-programs the
  member already has are greyed out. Population > Worklists has a CMP
  worklist, one row per member: like HEDIS's gaps, a member's sub-programs
  stack inside the row (Sub Program, Program Sub Status (editable), Care Plan
  Status, Assignee, Outreach, Next Action Due, Start Date, Due Date; View More
  past two), while Member, Risk IQ and Tasks show once. Shared filter bar and
  saved filters. Backed by `cmp_members` (`supabase/cmp_members_migration.sql`,
  seeded by `bun run seed`) and a `sub_program` column on
  `patient_care_programs` (`supabase/patient_care_programs_sub_program_migration.sql`).
- **Consistent worklist filters.** Gender (Male, Female, Other), Language
  (one searchable list) and Member Status now show the same options on every
  worklist (`src/lib/memberFilters.js`), so SNP and CCM no longer show raw
  codes. Every worklist uses the same filter bar layout: the primary filters
  that fit show first, filters added from More Filters follow them and wrap
  onto more lines, and More Filters | Clear All | Save Filter come last. CCM,
  JSA and TCM group their secondary filters by domain in More Filters, and
  CCM leads with the member filters. The HCC "View More" row is 8px shorter.
- **Customize the patient Overview.** Each Overview column now scrolls on its
  own. "Customize Overview" opens a kanban board (new `SortableLanes`
  component): drag widgets between the three columns, reorder them, or move
  them to Hidden. One arrangement drives every layout: at two columns,
  Column 3 stacks under Column 1; at one, all three stack in order. Saved per
  user in `user_panel_layouts` (`patientOverviewLayout`). Nine new widgets
  read real data: Risk & Acuity, Contact & Reachability, Care Team, Caregiver
  & Family, Consent, Medications and Diagnoses & Problems (p360 profile), and
  Since Last Touch and Program Progress (patient monitoring). The left panel
  Summary widgets are available too, hidden by default and marked "Sample
  data" because they still show built-in data.
- **Redesigned patient Overview.** The Overview tab is now a card dashboard:
  Unity Patient Synopsis, Health Chart, Highlights, Suggested Actions, Care
  Plan, Active Care Programs, Gaps, Recent Notes, Quick Actions, Upcoming
  Appointments, Tasks and Vitals. Columns follow the Overview's own width:
  three (25 / 50 / 25) when the left panel is collapsed and there is room,
  at most two (1/3 + 2/3) while the panel is open, one when narrow
  (`overviewLayout.js`). Quick Actions are pinnable per user
  (`user_panel_layouts`). Care plan, programs, notes, tasks and appointments
  read their existing tables; the synopsis, health scores, highlights,
  suggested actions, vitals and gaps live in the new `patient_overview`
  table. New shared pieces: `DashboardCard`, `QuickActionTile`, `Sparkline`.
  Needs `supabase/patient_overview_migration.sql`.
- **Customize the patient panel.** The patient profile's left panel has
  More > Customize: switch tabs, and the widgets inside Gaps, PAMI/Hx,
  Vitals/Labs and Summary, on or off and drag them into order, as in the
  analytics Export Report drawer. The layout is per user
  (`user_panel_layouts`, cached in localStorage), applies on Save, and keeps
  at least one tab shown. New shared pieces: `SectionCustomizer`,
  `SortableList` (moved from analytics), `PanelSection` and `BadgeSelect`
  (the redesigned Summary tab), and `moreActions` on `OverflowTabStrip`.
  Needs `supabase/user_panel_layouts_migration.sql`.
- **Worklist filters and saved filters, per the worklist filter spec.**
  HCC, HEDIS, SNP, Annual Visits and TOC IP list their filters in the spec's
  order (always-primary first, then each worklist's own). The chip row stays
  on one line: what doesn't fit sits in More Filters, which now lists those
  primaries first and the secondary filters under their domain (Member,
  Workflow Status, Assignment, Geography, Clinical). Picking one shows it in
  the row; unchecking clears its value. Saved filters work the same on every
  worklist (HCC, HEDIS, SNP, Annual Visit, JSA, CCM, TCM, TOC IP): the Figma
  dropdown (hover, selected and inline edit states, Make a Copy, a delete
  confirmation, an empty state), the selected filter stays selected while you
  edit (Go Back to Filter, Save Changes, Save a New Filter, Copy Filter), and
  Reset Selection clears that worklist's filters. DOB filters (HCC, HEDIS,
  SNP, CCM) pick by Years or Custom Dates. CCM's filters now live in the store
  so they can be saved.
- **Individualized Plan AI.** An empty care plan offers Draft Individualized
  Plan (also in the care plan ⋯ menu). UnityAI reads the patient's chronic
  conditions, latest assessments, open barriers, recent events and lab trends
  as numbered facts (`care-plan/lib/individualizedPlan.js`), picks the
  best-fitting templates and drafts a tailored set of goals, interventions
  and barriers (`/api/care-plan-individualized`). It's written onto the plan
  unsigned (a draft), and every item is flagged "AI · Review" with its
  rationale and the inputs it cites, as they read when drafted. Anything that
  cites nothing real is dropped on the server. Reviewers clear items one by
  one or all at once, or discard the AI items; History records the draft.
  Needs `supabase/care_plan_ai_suggestions_migration.sql`.
- **Automation Rules: auto-apply care plan templates on enrollment.**
  Settings > Automation Rules (was the Automations placeholder) holds
  account-level rules: the programs a rule watches, conditions over the
  patient's chronic conditions (problem list, diagnosis events), labs (for
  example HbA1c > 9 within 365 days), recent encounters (ED, inpatient) and
  assessment answers, matched all or any, plus the templates to attach and
  who reviews. When a patient enrolls, matching rules attach their templates
  to the care plan unsigned (a draft), one review task goes to the care
  manager with the reasons, the plan's History records it, and every
  evaluation is logged with why it did or didn't match (Recent evaluations).
  Engine: `features/settings/automation-rules/lib/automationRules.js`. Needs
  `supabase/automation_rules_migration.sql`, which also seeds the
  "Diabetes + HbA1c > 9" example rule, off by default.
- **SDOH barriers, community referrals and UDS social risk.** Care plans and
  care plan templates get a Social Needs (SDOH) section with the six
  domains: housing, food, transportation, finance, social and safety. Each
  need is a barrier with a structured domain, need and suggested ICD-10-CM
  Z-code (`care-plan/lib/sdohTaxonomy.js`). SDOH needs take Findhelp and Unite
  Us referrals as their own intervention type (`sdoh-referral`): no partner
  API, the partner's site opens in a new tab and the referral's program,
  notes and status (Draft, Sent, Accepted, Completed, Declined) are tracked
  on the plan. Templates can suggest a referral per need; it lands as a
  Draft. Analytics > SDoH & Equity gains a live UDS Social Risk card
  (patients, needs, referred, closed loop and resolved by domain). Needs
  `supabase/care_plan_sdoh_migration.sql`.

- **Pause a care plan.** The care plan ⋯ menu gets Pause Care Plan: reason
  (Hospitalized, Traveling, Patient request, Other with a note), pause start
  date, planned resume date and an auto-resume toggle. While paused the plan
  shows a banner with Resume Now, no overdue flags, no next touchpoint, and
  its automations read as paused; `isCarePlanPaused`
  (`care-plan/lib/carePlanPause.js`) is the gate any cadence or outreach job
  must check. Resume (by hand, or automatically the first time the plan is
  opened on or after the resume date) returns it to Active and recomputes the
  next touchpoint (earliest open intervention due date, else the soonest goal
  cadence), shown in the plan summary. Every pause and resume writes a
  History entry. Needs `supabase/care_plan_pause_migration.sql`.

- **Draft a care plan template from plain English.** Settings → Care Plan
  library → New Template opens with "Describe this template in plain
  English" (`src/components/UnityPromptField`). UnityAI
  (`/api/care-plan-template-draft`, Gemini) drafts the name, summary,
  template type and conditions, plus goals with their cadence, interventions
  and barriers, picking from the library first: every library reference is
  checked against the catalog the client sent (`lib/aiTemplateDraft.js`).
  The draft lands in the editor for review with a banner saying what came
  from the library and what's new; Redraft replaces it and Discard Draft
  removes it, leaving anything added by hand. New goals are created in the
  library when the template saves (with no invented target values), then
  Save as Template publishes. The three AI endpoints now share one function
  (`api/ai.js`), so the deployment uses 9 of Hobby's 12.
- **Care plan GBI statuses: Discontinued, Not Applicable, Resolved.** Goals,
  interventions and barriers can now be Discontinued (patient refusal) or Not
  Applicable, and barriers can be Resolved, alongside Not Started / In
  Progress / On Hold / Met / Not Met. Every status has an icon and a color,
  and On Hold is now blue rather than grey. The vocabulary lives in one place
  (`care-plan/lib/gbiStatus.js`) that every badge, picker, filter and rollup
  reads. Reporting: Met and Resolved are achieved, Not Met is the only
  failure, and Discontinued / Not Applicable count as neither, so they leave
  completion rates, average progress and template-run outcomes, and never
  show red. Closed items collapse into "Closed Goals / Interventions /
  Barriers". No migration: status columns are plain text.

- **Account emails from the email builder.** Unlock Account (User ID +
  set-password link), Password Set, Account Activated and Sign-up Approved are
  email builder templates (Settings → Content → Emails, category "Account
  Security") with new Account tokens: `{{user_id}}`, `{{set_password_link}}`,
  `{{sign_in_link}}`, `{{event_time}}`. The server sends whichever template
  has that `system_key`, filling the tokens, and falls back to the built-in
  email when there is none. A new password after an unlock now sends Account
  Activated; approving a Pending sign-up sends Sign-up Approved. Run
  `supabase/account_email_templates_migration.sql`, then `bun run seed`.
- **Update card replaces the new-version strip.** When a newer deploy is
  live, a card appears in the bottom-right corner above everything, listing
  the top three bold lead-ins from this section (baked into
  `/version.json` at build time). Refresh reloads; Dismiss hides it until a
  later deploy. Keep these lead-ins short: they are the card's highlights.
- **Login Activity in a user's Audit Log.** Two cards sit above the
  timeline: "Last successful sign-in" and "Failed attempts · 30 days". Each
  sign-in and lockout entry shows date • time • method • user, then the
  event (for example "Account locked"), its reason ("5 failed attempts ·
  locked by the system") and "Device • Location". The server reads the
  device, location and a masked IP from the request headers through
  `/api/auth-activity`, which is routed inside `api/account.js` so no new
  Vercel function is added. Run
  `supabase/account_activity_context_migration.sql` after
  `account_unlock_link_migration.sql`.
- **Account lockout: administrator-only unlock with an emailed link.** A
  locked account stays locked even with the right password. It all runs on
  the Supabase free plan: the existing access-token hook refuses password
  sign-in while locked, and the sign-in page reports each failure to
  `record_sign_in_failure`, which counts it only after checking the password
  really is wrong, so nobody can lock an account they didn't guess at. (The
  paid Password Verification Hook is optional; it also counts guesses sent
  straight to the Auth API.) The user requests an unlock from the sign-in
  screen; an admin unlocks it from their profile, which emails the User ID
  and a one-time link (24 hours) to set a new password and sign in. A locked
  practice admin can still reset by emailed code, so locking every admin
  can't leave nobody to unlock. Every step (failed attempts, lock, request,
  unlock and reason, link sent, password set) is recorded in the user's
  Audit Log. Password reset, unlock and security email now share one
  function (`api/account.js`) to stay under Vercel Hobby's 12-function
  limit. Needs `supabase/account_unlock_link_migration.sql`.

- **HCC Diagnosis Gaps and the Care Plan in the side panel (floating
  sidebar).** The Diagnosis Gaps Details drawer has "Open in Side Panel"
  beside its close button: the drawer morphs into the patient split (a view
  transition) with the patient card on the left, laid out 30 / 35 / 35
  (patient, document preview, ICDs). "Open as Drawer" goes back to the
  worklist with the drawer. A program's care plan can also open as its own
  panel ("Open in Separate Panel"); its Care Plan step then says so, with Go
  to Panel and Show Here. Also: care plan priority icons line up under the
  "P" header, and the document preview hides the PDF viewer's scrollbar.

- **Account lockout (HITRUST).** Five failed password attempts in a row lock
  a staff account until a person acts (no timer). Sign-in pauses on the 5th
  try with Reset password and Contact your administrator. Forgot password now
  uses a 6-digit emailed code (15 minutes, 5 tries, 3 per hour, no reuse of
  recent passwords). Admins see a red "Account locked since…" line and a
  Locked filter in Settings → Users, and unlock from the profile with a
  recorded reason. Security emails go out through Resend. Needs
  `supabase/account_lockout_migration.sql` and the Supabase Password
  Verification Hook.

- **Care Program Configuration (Settings).** A new Settings section lists
  every program type and lets you create new ones (blank or copied from
  another program's steps). Each program has Overview, Steps, Worklists,
  Care Team, Completion Criteria and Access tabs, saved to
  `care_program_types`. Steps drive the patient's program view: switched-off
  steps disappear, mandatory flags and order apply, and only active program
  types can be enrolled. Built-in step ids are kept so saved step statuses
  still line up. Worklists, Care Team, Completion Criteria and Access are
  saved but don't yet change navigation or permissions.

- **Care program in a right panel (floating sidebar).** A care program's ⋯
  menu, and the Care Plan's ⋯ menu, offer "Open in Right Panel" when the
  floating sidebar is on: the patient view becomes a patient card
  (breadcrumb, compact banner, care-gap tabs) beside the program at full
  height (or, for patient-level orgs, the patient's Care Plan). The right
  panel's other tabs join the patient card's tabs and open there, or as
  panels from their row in the More dropdown. Open panels get browser-style
  tabs (the active tab merges into its card): click a tab to bring its panel
  into focus, drag tabs to reorder. Panels scroll and snap one at a time with
  the next one peeking at the edge (`src/components/PanelStack`). The compact patient banner now
  adapts to its width: quick actions overflow into ⋯ and the Acuity/RAF
  metrics wrap into a grid. "Open Inline" or closing the program restores
  the standard layout.

- **Comms → E-fax: received faxes matched to a patient.** Each fax shows
  the file (View File / Download) and an "Add Patient Context" row, with the
  AI's picks attached under the message as "Suggested Members" (confidence
  badge, hover for what it rests on, + to add). "View N More" and + open
  Patient Context for eFax: search any patient or add an OCR match. Once
  added, the patient shows with View Profile / Change Patient and an AI mark
  when the OCR suggested them. "Create Test eFax" receives a fax about any
  patient read as a strong match, needs review, or no match. Stored in
  `efax_inbound` (`supabase/efax_inbound_migration.sql`).

- **Settings → Billing: Billable, Billing History and Timer Access.**
  Billable lists unbilled members with Program Type, CPT Code, Provider,
  Date of Service and Members filters and a total. Billing History lists
  monthly reports, each opening its billed members in a drawer. Timer
  Access sets, per program (BHI and CCM), who sees the billing timer on a
  patient's profile: the Care Program Team only, the team plus selected
  additional users and roles, or everyone with patient access. The Care Program Team
  drawer gains a "This user can log billable time for this program" check
  per member. Data lives in `supabase/care_program_billing_migration.sql`.

- **Care program report, History and End Program.** The ⋯ menu in a care
  program's header now has History (this program's slice of the Program
  Activity Log), Download Report and End Program (with a confirmation).
  Download Report opens a split drawer like the Employer Impact export: a
  live PDF on the left; on the right, a Program Steps tab (date range plus a
  switch per step) and a Personalize tab (logo, title, cover page, header
  and footer, using the shared `src/components/ReportCover` controls). The
  PDF follows Figma CCM-Story 11211:479858. Every step action (review, skip,
  letters, appointments, tasks, medications, sign-offs, billable time) now
  writes to the program's activity log.

- **Review care plan drawer from the SNP worklist.** Clicking a Signed or
  Draft Care Plan Status opens the plan in a side drawer for reviewing it
  with the patient on a call: goals grouped by category and interventions
  by type, status changes in place, an expandable row with key facts and a
  quick note, bulk select (Change status, Mark discussed), and the item's
  own drawer one click away. Start review runs a timer; Stop opens Complete
  review with the recorded time and a rich-text call note, saved to
  `care_plan_call_reviews` as the plan's new last reviewed date. A Notes tab
  lists the care plan note and call notes (editable by their author), and
  the Activity Log opens Care Plan History in place, from the last visit.
  The worklist status column shows Signed in green with a check and Draft in
  warning colours.

- **Care plan notes work the same on goals, interventions and barriers.**
  One shared Note section (`drawers/CarePlanItemNote`) replaces three
  copies: the latest note as a card (click to edit, hover to delete), Add /
  Update Note with a toast, and the change log, with the same rules for the
  current note and deletes. Typing in the intervention and barrier note box
  works again, and the Activity Log no longer prefixes notes with "Note:".
  The table's note button shows the note count, filled in purple when a note
  by someone else is new to you (`care_plan_note_reads`, per user).
- **Template versions on the care plan.** When a template is reinstated, the
  current run's chip on the applied-templates strip reads V2 and each earlier
  run follows it as a done chip (check mark, V1). Selecting V1 shows that
  run's goals, interventions and barriers in the same tables, read-only,
  under a banner with its close date and how many were met. This replaces
  the Previous runs section.
- **Care plan print: Personalize tab, presets and a Care Plan Summary format.**
  Preview & Share now has Content and Personalize tabs, as the Employer
  Impact Report does. Personalize picks the format (Tables, Care Plan
  Summary, or Care Plan Summary detailed, from the Figma "Care Plan PDF"
  frames), group by condition, the Care Note on or off, patient
  demographics (DOB / age / sex, Member / Fold ID, PCP and insurance), a
  Report Header and Footer component, and a logo. Settings save as presets
  (`care_plan_print_presets`), for the organization or just for you, with an
  optional org default. The Tables format was redone (A4, Inter, a patient
  card, one clean table per type). The employer report's header, footer,
  font and logo drawing moved to `email-builder/reportPrintAssets.js` so
  both reports share it. Possible duplicates now open in a centered
  popover (`components/AnchoredPopover`) with Existing / New rows and Keep
  or Keep both; the next duplicate lands under the pointer after each one.
- **Care plan versions: signed plan vs draft, and a versioned History.**
  Signing snapshots the whole plan (goals, interventions, barriers, goal
  links, templates, conditions) into `patient_care_plan_versions`. Changes
  made through Edit, plus adding or removing items, links and templates, stay
  in the draft until signed; the header shows "N unsigned changes since vN"
  with Discard (back to the signed version, same row ids). Status, priority,
  title, assignee, due date and recurrence, progress and adherence, readings
  and notes apply at once as progress on the signed plan. The Comprehensive
  Care Plan, Monitoring rail and Share read the signed copy; Share no longer
  re-signs, and a never-signed plan is hidden outside the editor. Care Plan
  History is rebuilt on the shared ActivityLog: Month or Versions view,
  Activity Type, Date Range (with Custom) and Activity by filters, a
  "Care Plan Signed as Version N" marker per signature, "Changes in Care
  Plan" with the full changes drawer, and live activity tagged with its
  version. Restore now loads an older version into the draft instead of
  rewriting the plan. No migration.
- **Applying a template again: Extend or Reinstate.** Each template on a
  patient's plan is now a run with a start and an end date
  (`patient_care_plan_template_instances`). Templates carry a "When
  applied again" setting (`care_plan_templates.renewal`): condition
  templates extend, event templates such as TOC reinstate. In Apply
  Templates, a template already on the plan gets Apply again, which asks
  Extend (keep the start date, set a new end date) or Reinstate (auto-close
  the current run as Completed when every goal and intervention is met,
  Closed otherwise, and start a fresh one). The end date is prefilled from
  the template's longest goal duration and can be changed. A reinstated
  run's goals, interventions and barriers are kept as history
  (`retired_instance_id`) under a collapsed Previous runs section with an
  Auto-closed tag, and both actions show in History. Also: the template
  editor can switch a template between Private and Org, template titles
  open the preview, Save as Template uses the whole plan unless a template
  is selected, and SNP's empty Model of Care section is hidden in
  patient-level mode.
- **Care plan templates for the org, for yourself, or for one patient.**
  `care_plan_templates` gains `scope` (`org`, `user`, `patient`),
  `owner_user_id` and `patient_id`; existing templates are `org`, and RLS
  keeps `user` templates readable and writable only by their owner. New
  Care Plan (Settings and Apply Templates > Create New) and Duplicate ask
  "Who is this template for?" (Organization / Only me). A patient's Save as
  Template adds This patient, and that template is offered only in that
  patient's Apply Templates. The Settings library lists org templates plus
  your own; both lists show an Org / Private / Patient badge and a
  Visibility filter.
- **API routes now require a signed-in user.** The routes that send email
  (send-test-email, send-report-email) or call paid APIs (care-plan-summary,
  referral-email, pop-group-rule-from-nl, pexels-search) return 401 unless
  the request carries a valid Supabase access token. Server side, call
  `requireUser(req, res)` from `api/_lib/requireUser.js` at the top of the
  handler; client side, use `apiFetch` from `src/lib/apiFetch.js` instead of
  `fetch`. ICD search, reference lookups, share pages, OG images and the
  Sentry tunnel stay public.

- **Care plan level: program, patient or both.** Settings > Account > Org has
  a "Care plan level" choice (`org_settings.care_plan_mode`, default
  program). Program level works as before. Patient level hides each
  program's Care Plan step (and drops it from progress) and adds Care
  Management > Care Plan with the full plan, stored under a per-patient
  PATIENT program. Both keeps program plans and turns Care Management >
  Care Plan into an editable roll-up: drawers edit each item's own program,
  "+" asks which program to add to, and one Sign signs every plan with
  unsigned changes. A level the org isn't using stays hidden, including in
  the Monitoring goals rail. The plan header (title, status, toolbar) is now
  the shared `CarePlanHeader`.
- **Branded CIS PDFs and Astrana report header / footer.** The CIS-CMB10
  schedule and immunization record PDFs follow the Patient Summary report
  layout (A4, Inter; logo + page / title / Generated On header, brand band,
  label : value patient block, titled bordered tables, contact footer). New
  **Astrana Report Header / Footer** components (maroon band, Astrana wordmark
  and contact) sit beside the Trailhead ones in the report header / footer
  options; the immunization record uses Astrana, the schedule keeps
  Trailhead. Also: CIS gap status advances automatically (Engaged on a
  recorded dose or booked visit, Engaged Requires Follow-Up when a booked
  visit passes unrecorded, Completed when met; never past a closed gap);
  CIS suggested actions restyled; the scheduled-appointment chip is a link.

- **HEDIS worklist Age filter.** More Filters gains **Age** (Under 2, 2–17,
  18–44, 45–64, 65–74, 75+), a multi-select FilterChip. Age comes from DOB
  in whole years, falling back to the row's age text ("22m", "67y 2m").
  In the CIS Vaccine Calendar drawer, View by Age now shows separate
  Vaccine and Dose columns (dose number with its date window) in place of
  Recommended Age.

- **CIS-CMB10 follow-ups from the clinical review call.** Doses given after
  their recommended window but by the 2nd birthday show **Completed late**
  (they still count). The team can track vaccine appointments booked with the
  child's own provider: a "Schedule Vaccine Appointment" left panel (date,
  time, provider, doses, note) puts a "Scheduled <date>" chip on each dose,
  turning to "Confirm <date>" once the visit passes unrecorded, and sets a
  follow-up reminder for the day after (new `cis_dose_appointments` table,
  `supabase/cis_dose_appointments_migration.sql`). A new immunization record
  PDF (doses given, product, CVX) can be downloaded or saved to the gap's
  Documents as evidence (non-standard note, nothing billed). The tab's actions
  move into a ⋯ menu; fully given vaccines group under Completed as Met / Not
  Met; doses unlock on their earliest allowed date; Add Outreach leads the
  suggested actions on CIS gaps; the Vaccine Calendar opens as a drawer.

- **PR Autopilot.** When Alok, Ketan or Devanshi open or update a PR, a
  GitHub Action (`.github/workflows/pr-autopilot.yml`) has Claude review it,
  wait for the required checks, merge it (resolving conflicts on an
  `autopilot/integrate-pr-N` branch when needed), run its Supabase migrations
  with the CLI, and comment with what it did. Anon-open RLS policies and
  missing clinical-note lifecycle bypasses are patched before running, and
  rows a migration deletes or rewrites are backed up to `demo_bak` first.
  Anything it isn't sure about gets the `autopilot:needs-human` label; add
  `autopilot:skip` to opt a PR out. Rules: `.github/claude/pr-autopilot.md`.
  Inactive until the `CLAUDE_CODE_OAUTH_TOKEN`, `AUTOPILOT_GH_TOKEN` and
  `SUPABASE_ACCESS_TOKEN` repo secrets are set.
- **CIS-CMB10 Vaccine Calendar (phase 3).** The first CIS tab is now
  "Vaccine Calendar". It adds View by Vaccine / Age (Age follows a printed
  schedule; each age group shows dose dots, start date and status, so it
  reads when collapsed), a PDF schedule download, and a short celebration on
  the progress block when a dose is given. The Vaccine Calendar dialog gains
  a Timeline view (vaccines by routine age, birth to 2 years, each dose
  across its range with dates and status), View by Vaccine / Age, the same
  dose-progress card and date field as the tab, the patient banner, and
  saves each change as it is made (no Save footer). Shared pieces:
  `CisDoseProgress`, `DoseDateField`, `VaccineTimeline`. Date picker and
  FilterChip popovers now take clicks inside modal dialogs.

- **Comms (was Messages).** The sidebar item is now Comms, built to the
  Figma Communications file. Patient conversations live in two new tables
  (`patient_conversations`, `patient_messages`) and work on real channels at
  no cost:
  - **Chat:** the patient answers on their own page (`#/p/<token>`, no
    sign-in), opened from the chat header's "Open patient view" icon.
  - **Email:** Compose Email starts on the Fold Care template. You can edit
    it in place or swap it for any Content → Emails template. It sends
    through Resend, and failures show their reason with a Retry. Closing with unsaved changes offers Save as Draft or Discard.
  - **SMS:** real texts through an Android phone running textbee
    (`TEXTBEE_API_KEY`, `TEXTBEE_DEVICE_ID`). Replies are pulled into
    threads.
  - **Calls:** browser-to-browser voice (WebRTC, signalled over Supabase
    Realtime) rings the patient's page. "Dial a number" hands off to your
    phone and logs the call.
  - Internal Chat keeps the staff-to-staff chat.
  - Worklist row menus (TOC, All Patients, CCM, SNP): Send SMS and Send
    Email open the Comms drawers for that patient; Send Education opens Send
    Content (MedlinePlus education pages by email and/or SMS) and Send
    Assessment sends form links.

  Only real conversations are shown, with nothing seeded, and each channel has
  its Figma empty state. Until the migration runs, Comms keeps its data in the
  browser.

- **CIS-CMB10 immunization tracker (phase 2).** The Immunizations tab (first
  tab on CIS gaps) now records doses inline. A dose-progress card shows one
  block per required dose as a timeline (given, due now, overdue / does not
  count, upcoming; doses whose window has not opened carry a lock), with
  start / end dates and the evaluation; a Recommended Action follows. Vaccines
  are grouped (Action Needed, Upcoming, Later, Met) with search, a status
  filter and Expand all; expanding a vaccine lists its doses with recommended
  age, earliest allowed date, a date badge that opens the picker (locked until
  the window opens), status and a note. A dose that does not count (same day,
  too early, after the 2nd birthday) keeps its slot and shows the reason.
  Given dates save to `patient_immunizations`, notes to the new
  `cis_dose_notes` table (`supabase/cis_dose_notes_migration.sql`), and each
  change logs an activity entry. The Vaccine Calendar dialog offers the same
  edits in one table. `Input` gains a `variant="quiet"`.

- **CIS-CMB10 immunization tracker (phase 1).** The HEDIS Care Gap drawer
  shows an Immunizations tab on Childhood Immunization Status (Combination 10)
  gaps. It evaluates the ten vaccines (DTaP, IPV, MMR, HiB, Hep B, VZV, PCV,
  Hep A, Rotavirus, Influenza) from the member's `patient_immunizations`
  rows: HEDIS counting rules decide which doses count, ACIP minimums decide
  the next due date and whether the remaining doses can still fit before the
  2nd birthday. The gap reads Compliant, On track, At risk, Can't be met or
  Not eligible. Read-only for now; recording doses comes in phase 2. The
  measure code is renamed from `CISCMG10` to `CIS-CMB10`
  (`supabase/cis_cmb10_migration.sql`, which also seeds five pediatric demo
  members).
- **Care plan notes keep their history, Save as Template saves one template,
  and new interventions can start from the library.** Goal, Intervention and
  Barrier drawers show a "Change log" of every note under the note editor,
  like the plan-level Care Note, so adding a note on a signed plan no longer
  looks like it overwrote the last one. Save as Template has a "Save from"
  picker (one applied template or the entire plan) and now keeps barriers and
  each goal's library link. New interventions and care plan tasks have a
  "From library" picker that fills in the title, description and priority.
  The shared rich-text `Textarea` now hides its placeholder when its value is
  set from code.

- **Smarter Goal, Intervention and Barrier drawers, and in-place titles.**
  Titles edit where they stand in the plan table and all three drawers (no
  input box): click the text, Enter or click away saves, Escape cancels.
  Goal readings use measure-aware inputs (Systolic/Diastolic for BP, a 0-10
  scale for Pain, a number with its unit, free text for Others) and In/Out of
  target is computed from the goal's target, with a clinician override.
  Assessment goals are marked completed on a date (recorded as a reading, sets
  Met). The Goal drawer shows the structured target and an editable target
  date; the Intervention drawer shows the assignee and an honest Schedule
  (Upcoming / Due today / Past, no invented completions) using the same
  due-date rule as the table. The Barrier drawer shows and edits the
  description, only locks when Met, and lists the real applied templates it
  came from.

- **Compact Care Plan layout, and no invented dates.** Goals, Interventions
  and Barriers share one drawer-width grid: P, Name with a meta line, Status,
  and Actions (Linked items, Notes, More). The meta line shows only recorded
  data: start and target date, the goal target exactly as stored (a bare
  number is flagged "No unit recorded"), and the current value only when a
  reading exists. Interventions show due date and owner; barriers are a single
  line. Only Met items collapse into Completed/Resolved groups, so Not Met
  stays visible. The Notes action opens the item's drawer at its Note section.
  The store no longer seeds goal (+90 days) or intervention (+30 days) dates
  on save, and `supabase/care_plan_seeded_dates_cleanup_migration.sql` clears
  previously seeded values (keeping any date with an audited edit). Plan dates
  now parse as local dates, so they no longer show a day early west of UTC.
  The shared column picker also stops revealing every default-hidden column
  on the first toggle or Reset.

- **Admin approval for self sign-ups.** Accounts created from the login page
  (password or OAuth) start as **Pending**. Every admin gets a "New sign-up
  awaiting approval" notification that opens Settings → Users filtered to
  Pending, where each row has Approve / Reject. A Supabase access-token hook
  (`signup_approval_access_token_hook`) refuses sessions for Pending and
  Rejected accounts, so the block is enforced server-side. Invited users skip
  approval: the invite drawer writes the email to the admin-only
  `signup_invites` allowlist before creating the account. See
  `supabase/signup_approval_migration.sql`.

- **LSC (Lead Screening in Children) Clinical Note, Phase 2.** LSC now has
  its own section in the consolidated Clinical Note: Location, Performed by
  (users with the new Phlebotomist role, listed by email), Procedure
  Performed, and Result Value in mcg/dL. Result is selected automatically
  (<3.5 Negative, ≥3.5 Positive) and shows the matching care plan. Telehealth
  consent is required when Location is Telehealth. Both results bill CPT
  83655. The rules (`showWhen`, `derive`, `content`, `user-select`) live in
  `src/lib/noteTemplateRules.js`, so other templates can use them.

- **Patient hover card on every worklist.** Resting on a member avatar for
  800ms opens a patient banner, then a snapshot slides out: EHR ID, Fold
  Score / RAF Score / Goal Progress tiles and the Fold Score Breakdown. The
  RAF Score tile switches the breakdown to HCCs (each opens to its ICD-10
  details), demographics and interactions. Shared `PatientAvatarHover`
  component; data in `patient_snapshots`
  (`supabase/patient_snapshots_migration.sql`).

- **Care Gap lab orders and results.** Order one or more tests with multiple
  diagnoses from the Care Gap drawer, then review results against the gap
  (`supabase/caregap_lab_orders_migration.sql`). Care Program steps now derive
  their status from records, with Reviewed / Skip stored in
  `care_program_step_status`. The Activity loader is a timeline skeleton, and
  gap badges show the full measure name on hover.

- **Employer Impact Print drawer: Widgets and Personalize tabs.** Widgets
  (first) holds the section cards, redesigned to Figma 937:52974: drag a card
  from anywhere (all cards shrink to their titles mid-drag), switch a section
  off to collapse it, and edit titles and subtitles in place with the new
  reusable `EditableText` component. Each section has a default subtitle. A
  filter button opens the report's own filters. Personalize holds the logo
  preview (defaults to the filtered employer, Change to upload a
  replacement), title and cover settings.

- **Employer Impact Report: Download HTML and Send Report.** The Print
  drawer's Download HTML saves the report page itself, with its filters,
  layout and data, as one self-contained interactive file (read-only
  filters; no location toggle, Widget, Print or Settings). It inlines the
  report viewer bundle, `src/report-viewer`, which `bun run dev` and
  `bun run build` now build first (`bun run build:report-viewer` on its own).
  Send Report lists Email, Chat, eFax and Internal Chat (not wired yet).

- **Components, and report headers built from them.** Settings → Content →
  Components lists saved headers and footers (Name, Type, Default, Last
  Updated). New and Edit open the email builder in component mode, with Name,
  Type (Header, Footer, Report Header, Report Footer) and Default in the
  toolbar. The Employer Impact print header and footer are now seeded report
  components (`report-print-header`, `report-print-footer`) using the new
  Report merge tags `{{report_title}}`, `{{generated_on}}`, `{{employer_logo}}`
  and `{{page_number}}`. The Print drawer's Show Header and Show Footer
  toggles pick which report components print on every page. Needs `supabase/email_components_migration.sql` and `bun run
  seed`.

- **Employer Impact Report: stock photo cover backgrounds and consistent
  loading.** The print drawer's Image background can now search free Pexels
  photos (photos only, never videos) through the server-side
  `/api/pexels-search` proxy, using the new reusable `PhotoSearch` component,
  with photographer credit. Set `PEXEL_API_KEY` in Vercel. While loading, stat
  and cost savings cards now show KPI skeletons like the other Analytics tabs,
  and the data freshness bar no longer shows on this report.

- **HEDIS Care Gap drawer: Outreach, Documents, and a complete Activity log.**
  Add Outreach and Add Document now open as left-pane workspaces, like Add
  Task and Schedule Appointment. The outreach form's Select Outcome lists
  depend on the Successful / Unsuccessful / Note choice, Sync Text is one
  toggle across note panels, and its Actions row opens the current Add Task
  drawer and a scheduler with the patient preselected. A new Documents tab
  (shared `DocumentList`, matching the HCC Documents tab) lists care gap
  uploads with preview, edit, and delete; files go to `program_documents`.
  Every drawer action (outreach, tasks, appointments, notes, documents, bulk
  status and assignee changes) is now written to `caregap_activity`.

- **Analytics: Employer Impact Report.** A new Overview page (Figma
  5618:10554) with seven sections: Overview, Cost Savings, Engagement,
  Communication, Clinical Visits, Clinical Trends, and Demographics. Every
  chart is Recharts (via `LazyRecharts`) and is computed from
  `employer_impact_metrics` through the `employer_impact_rollup` SQL function,
  so the Employer, Patient/Visit Location, Time Frame, and date range filters
  change the data itself. Each widget can be expanded, viewed as a table,
  downloaded as CSV, or hidden (Widget picker). Migration:
  `supabase/employer_impact_migration.sql`, seeded by `bun run seed`.

- **Email campaigns: personalization, compliance, and a real send engine.**
  The email builder gained a Personalize token picker (merge tags like
  `{{first_name}}` resolved at preview and send time, with support for legacy
  `{Patient Name}` styles), a preview-text preheader field, and a CAN-SPAM
  footer (physical address plus unsubscribe) appended at render with a
  List-Unsubscribe header on test sends. RawHtml and custom-HTML now ship
  sanitized. "Run Campaign Now" is a real (simulated) send: it resolves the
  audience from `all_patients` via Supabase-backed `audience_segments`, writes a
  `campaign_sends` delivery log, and rolls the results into the campaign's
  delivered/opened stats, surfaced in a delivery-results summary. New tables:
  `email_compliance_settings`, `audience_segments`, `campaign_sends`.

- **Care Plan Library: goal creation and its interventions**, the New Template
  flow now opens a full-screen New Care Plan view, and Add New opens Create New
  Goals (category → measure → chronic condition → target, with a Set Target
  switch in every tab). The Linked Items card's Interventions "+" opens a menu
  whose options each open a drawer: Send Form, Send Patient Education, Measure
  Vital, and the shared Add Task drawer for Patient/Internal Task. Chronic
  conditions come from the NLM clinical-tables API; vitals are shared with the
  goal measure picker via `vitalOptions.js`. Library data is still local state.
- **Med Recon on the shared table**, every tabular program step (plus Program
  Related Tasks and the Care Programs tab) now renders through
  `components/WorklistShell` instead of one-off tables, and Med Recon gained
  inline date/status editing, note autosave, the signed header state and the
  sign-off assignee modal.

- **Forms RLS lockdown + bootstrap migrations for all 77 out-of-band tables**,
  anon-key probes proved `forms`/`form_responses` were fully readable AND
  writable by the public internet (patient answers downloadable, submissions
  tamperable, any form deletable). New migration rebuilds scoped policies:
  anon reads active forms only, inserts responses, updates in-progress rows;
  everything else authenticated-only. Applied to prod and re-probe verified.
  Also: `aaa_bootstrap_missing_tables_migration.sql` creates every table that
  predated the repo (generated from live schema, idempotent) so fresh envs and
  the Supabase Preview check can finally replay the SQL directory cleanly.
- **Settings → Users load: 14 API calls down to 5**, the page felt slow, but
  its own query was never the problem. A cold load fired 14 logical Supabase
  calls in one burst at ~870 ms, only two of which the table needs, and
  `profiles?select=*` measured 273–909 ms alone versus 3198 ms inside that
  burst: it was queued behind ~151 KB of patient data the page does not
  render. Removed outright: the Users tab's admin check (a second query for
  `role`/`clinical_roles`/`admin_role` on the signed-in user, whose row is
  already in the list response: now derived from it), two `getUser()` round
  trips that only needed the locally persisted session (`getSession()`), and
  AppLayout's `select id` probe before its identity write (now
  `update().select('id')` with the INSERT as a zero-rows fallback, since
  `handle_new_user()` already created the row). Deferred to the moment a user
  reaches for them: TopBar's `patients` + `all_patients` search index (warms on
  pointer-enter/focus of the search box), and the changelog plus the Featurebase
  SSO JWT (warm on Help hover: `changelogUnread` is only ever read *inside*
  HelpPopover, which does not exist until it opens). `fetchAllPatients` also
  gained the single-fire guard `fetchPatients` already had; two components
  mounting in the same tick both read `allPatients.length === 0` and both
  fetched, pulling 100 KB twice. `requestIdleCallback` was tried for the
  prefetch and rejected: idle arrives while the route's lazy chunk is still
  downloading, so it fired at 1025 ms, still ahead of the page's own query at
  1324 ms. Net: 31 requests to 10, and the users query now completes in
  ~210–520 ms, i.e. at its uncontended speed. `select=*` was deliberately left
  alone: the `_raw` pass-through means the two user drawers read 34 of the
  table's 35 columns, so narrowing saves only `updated_at` (6.1%) in exchange
  for a column list that has to stay in sync with both drawers.

- **Real-time task notifications (assignment + @mention)**: the bell never
  worked, for three independent reasons. The two producers lived in
  `updateTask`/`createTask` and read `currentUserProfile`, the *actor*, then
  asked "is the new assignee me?", so assigning a task to someone else
  notified nobody and the only case that ever fired was assigning to yourself.
  `notifications` was also an in-memory array, so even a correct notification
  died on reload and could never reach another device; and `pendingOpenTaskId`
  was written but never consumed, so clicking a notification navigated to
  Tasks without opening the task. Notifications are now rows in
  `public.notifications`, emitted by a `tasks_emit_notifications` trigger
  addressed to the assignee or the mentioned profile (the producer belongs
  below the client for the same reason task attribution does), delivered over
  Supabase Realtime on a per-user channel that RLS self-filters. Mentions
  resolve by case-insensitive name because that is what `tasks.mentions`
  stores. Read/dismiss persist; the unread badge is DB-truth. Three recovery
  paths keep it honest: refetch on (re)subscribe, on tab refocus/`online`,
  and on popover open: because a `postgres_changes` binding that dies (or is
  created before the table is published) delivers silence forever and none of
  the socket-level triggers fire in that state.

- **Typography: root font size now scales with the viewport**, the root
  font-size was a hard-coded `16px`, so a 13" laptop and a 27" 4K panel got
  identical CSS px and wildly different apparent text size. It's now
  `clamp(1rem, 0.866rem + 0.134vw, 1.1875rem)`: flat 16px through every laptop
  width (≤1600px: no regression), then 16.4px at 1920, 17.3px at 2560, capped
  at 19px from 3840 up. Every `--font-*` and `--space-*` token is rem-based, so
  the whole type ramp and token spacing move together. The 5 `data-font-scale`
  accessibility levels became *multipliers* (0.875 → 1.25) instead of absolute
  px, so they compose with the fluid base rather than overriding it, at laptop
  widths they still resolve to exactly 14/15/16/18/20px. Deliberately keyed to
  viewport width, not `devicePixelRatio`: a CSS px is already
  density-independent, so DPR says nothing about apparent size. Each clamp arm
  keeps a `rem` term so the browser's own font-size preference still wins
  (WCAG 1.4.4).

- **Tasks: "Assigned to Me" dropped tasks that were yours**: `matchAssignee`
  short-circuited on `assigned_to_id`, so it never fell back to a name match.
  `profiles` holds one row per email a person signed up with (three are named
  "Alok Kumar"), so a task carrying a different profile id for the same human
  was silently excluded. Now matches id **or** display name; same for
  `matchCreator`. Also made pool and assignee mutually exclusive: pooling a task
  clears its assignee and assigning an owner clears the pool (what `claimTask`
  already did), so a pooled-and-assigned task can no longer end up invisible in
  both the pool tab and the Claim button.

- **Calendar: slot clicks snap to 30-min slots + faster load**, clicking a
  timeslot now books the slot the hover preview shows (schedule-x reports the
  raw pixel time, e.g. 3:13; we snap it down to :00/:30 before it reaches the
  Schedule drawer and the dashed selection). Calendar libs now load in
  parallel instead of a sequential import waterfall, the grid setup (hover
  ghost, past-day overlays, scroll-to-now) polls for readiness instead of
  waiting a fixed 800ms, and `isResponsive: false` stops schedule-x from
  silently hijacking week view into day view when it mounts mid-layout.
  Location/Status filter chips actually filter now, and month view finally
  dims past days (the old selector matched nothing in schedule-x v4).

- **Calendar: vanishing-appointment fix + schedule-x v4 cleanup**, opening and
  closing an appointment drawer used to silently delete the last appointment
  from the grid: `clearSelection()` called the events plugin's `remove()` for a
  selection event that didn't exist, and schedule-x's `remove()` does
  `splice(findIndex(...), 1)`, so a missing id splices at `-1` and drops the
  final event. It's guarded with an existence check now. Cancelled styling and
  the dashed new-slot block are declarative (`_options.additionalClasses`)
  instead of a `querySelector` chain fired at 100/300/600ms and again at
  300/800/1500ms, so they paint correctly on the first frame, the dashed
  selection style had in fact never applied, because `.sx__event--selection`
  isn't a class v4 emits. Navigation repaints run off schedule-x's
  `onRangeUpdate` rather than a `setTimeout(50)` guess, the now-line ticks each
  minute instead of freezing at page load, the Location/Status filter options
  come from the same constants the booking form writes (the calendar's own
  copies had drifted: `Fold Health, NY` vs `Fold Health, New York`, so any
  location selection matched zero rows), and the four empty `catch {}` blocks
  and the dead `buildCalendars` helper are gone.

- **Dynamic group detail screen + qualified members + activity log**,
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
  (`supabase/pop_group_activity_migration.sql`): the store logs every
  create / rule update / details update / delete. The seed also backfills the
  core profile criteria fields (age / sex / gender / state / zip) from each
  patient's identity row.

- **Dynamic group rule builder**: choosing the Dynamic filter in Create Group
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

- **Tables fill the viewport, auto page size**, every table now sizes its
  page to the space available instead of always showing 10 rows, so a tall
  screen fills with data rather than white space (TOC 10 → 20 rows at 1440×1000).
  Sizes step in multiples of 5 with a floor of 10 and always round up, so the
  last row runs past the fold, a little scroll, never a gap. The per-page
  selector gained an **Auto** default (`Auto (20)`); picking an explicit
  10/25/50 pins it. The choice is a per-user preference persisted in
  `user_worklist_prefs`
  (`supabase/user_worklist_prefs_page_size_migration.sql`), mirrored to
  localStorage so it survives a reload before the fetch lands. Logic lives in
  `src/components/Pagination/useAutoPageSize.js` and applies to every table
  through the shared `Pagination`. Also fixed CCM/SNP passing
  `pageSize`/`onPageSizeChange` where `Pagination` declares
  `perPage`/`onPerPageChange`, their page-size selector had been a no-op.

- **Population Groups on WorklistShell**: the groups table now renders through
  the shared `WorklistShell` (sticky Group Name + Actions columns, working
  select-all with BulkBar, loading skeleton) instead of a hand-rolled table and
  its own `PaginationBar`, which was deleted.

- **P360 banner, real data for every patient**, all 28 patients now have a
  seeded `p360_profiles` row (acuity/RAF, consent, next appt, chronic
  conditions, vitals, family, care team) generated deterministically per
  patient by `scripts/seed_p360_banner.js`; re-runs only fill NULL/empty
  fields so hand-crafted rows survive. New `upcoming_appointments` jsonb
  column (`supabase/p360_upcoming_appointments_migration.sql`) persists the
  expanded banner's Appointments column. Expanded-state typography was also
  rebalanced (SemiBold section titles, proper Care Team sub-header, no more
  stray 10/11/14px sizes).

- **Care Programs table, editable Status & Assignee**, the program list
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
- **Component library consolidation**: one primitive per job. The three
  Radix duplicates (`ShadcnSelect`, `ShadcnTooltip`, `ShadcnRadioGroup`) were
  removed; every dropdown now uses the shared `Select` (new `style` prop for
  width constraints), every tooltip the portaled `Tooltip` (new `maxWidth`
  prop for wrapping), and every radio the shared `RadioButton`. All inline
  row-action dropdowns (TOC, CCM, All Patients, Agents table, Outreach log)
  were migrated to the shared `MenuPopover`, which now supports
  `{ section }` headers and `{ divider }` rules; TOC/CCM share one menu
  vocabulary via `buildPatientRowMenuItems`. Also fixed a fragile import
  cycle by moving `FALLBACK_USERS` into `settings/fallbackUsers.js`.
- **Help → Feedback & What's New**: the sidebar Help popover now hosts a
  Featurebase feedback panel (ideas / bug reports / voting) and an in-house
  changelog drawer backed by Supabase (`changelog_entries`). A GitHub Action
  (`.github/workflows/changelog.yml`) publishes entries automatically from
  commit messages on every push to main (feat → New, fix → Fixed,
  perf/refactor → Improved; chores skipped). Requires the
  `SUPABASE_SERVICE_ROLE_KEY` repo secret.
- **Storybook + Chromatic**: every primitive under `src/components/`
  (Core, Forms, Overlays, Feedback, Data, Navigation, Composed, shadcn/ui)
  now has a story. Storybook is published to Chromatic, links above.
- **HCC worklist**: default assignee filter (role-scoped, "me + In
  Progress"), mandatory doc upload in Add DOS, inline Pass/Fail on chart
  upload, auto-transition of Coder/QA/Compliance status to In Progress on
  first ICD action.
- **Auth**: invited-user flow now sends a single confirmation email
  (was two) and lands the user on a "Set Password" page whose success
  drops them straight into the app.
