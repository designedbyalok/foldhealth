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

- **Care Plan Library: goal creation and its interventions** — the New Template
  flow now opens a full-screen New Care Plan view, and Add New opens Create New
  Goals (category → measure → chronic condition → target, with a Set Target
  switch in every tab). The Linked Items card's Interventions "+" opens a menu
  whose options each open a drawer: Send Form, Send Patient Education, Measure
  Vital, and the shared Add Task drawer for Patient/Internal Task. Chronic
  conditions come from the NLM clinical-tables API; vitals are shared with the
  goal measure picker via `vitalOptions.js`. Library data is still local state.
- **Med Recon on the shared table** — every tabular program step (plus Program
  Related Tasks and the Care Programs tab) now renders through
  `components/WorklistShell` instead of one-off tables, and Med Recon gained
  inline date/status editing, note autosave, the signed header state and the
  sign-off assignee modal.

- **Forms RLS lockdown + bootstrap migrations for all 77 out-of-band tables** —
  anon-key probes proved `forms`/`form_responses` were fully readable AND
  writable by the public internet (patient answers downloadable, submissions
  tamperable, any form deletable). New migration rebuilds scoped policies:
  anon reads active forms only, inserts responses, updates in-progress rows;
  everything else authenticated-only. Applied to prod and re-probe verified.
  Also: `aaa_bootstrap_missing_tables_migration.sql` creates every table that
  predated the repo (generated from live schema, idempotent) so fresh envs and
  the Supabase Preview check can finally replay the SQL directory cleanly.
- **Settings → Users load: 14 API calls down to 5** — the page felt slow, but
  its own query was never the problem. A cold load fired 14 logical Supabase
  calls in one burst at ~870 ms, only two of which the table needs, and
  `profiles?select=*` measured 273–909 ms alone versus 3198 ms inside that
  burst — it was queued behind ~151 KB of patient data the page does not
  render. Removed outright: the Users tab's admin check (a second query for
  `role`/`clinical_roles`/`admin_role` on the signed-in user, whose row is
  already in the list response — now derived from it), two `getUser()` round
  trips that only needed the locally persisted session (`getSession()`), and
  AppLayout's `select id` probe before its identity write (now
  `update().select('id')` with the INSERT as a zero-rows fallback, since
  `handle_new_user()` already created the row). Deferred to the moment a user
  reaches for them: TopBar's `patients` + `all_patients` search index (warms on
  pointer-enter/focus of the search box), and the changelog plus the Featurebase
  SSO JWT (warm on Help hover — `changelogUnread` is only ever read *inside*
  HelpPopover, which does not exist until it opens). `fetchAllPatients` also
  gained the single-fire guard `fetchPatients` already had; two components
  mounting in the same tick both read `allPatients.length === 0` and both
  fetched, pulling 100 KB twice. `requestIdleCallback` was tried for the
  prefetch and rejected — idle arrives while the route's lazy chunk is still
  downloading, so it fired at 1025 ms, still ahead of the page's own query at
  1324 ms. Net: 31 requests to 10, and the users query now completes in
  ~210–520 ms, i.e. at its uncontended speed. `select=*` was deliberately left
  alone: the `_raw` pass-through means the two user drawers read 34 of the
  table's 35 columns, so narrowing saves only `updated_at` (6.1%) in exchange
  for a column list that has to stay in sync with both drawers.

- **Real-time task notifications (assignment + @mention)** — the bell never
  worked, for three independent reasons. The two producers lived in
  `updateTask`/`createTask` and read `currentUserProfile` — the *actor* — then
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
  paths keep it honest — refetch on (re)subscribe, on tab refocus/`online`,
  and on popover open — because a `postgres_changes` binding that dies (or is
  created before the table is published) delivers silence forever and none of
  the socket-level triggers fire in that state.

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
