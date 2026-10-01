# HEDIS Workflow: Complete Developer Context

Single reference for how the HEDIS care-gap workflow works end to end: routing,
components, data model, Supabase schema, business rules, and what is still
prototype-only. For the user-facing walkthrough, see `hedis-worklist.mdx`.

Paths are relative to the repo root. `F` = `src/features/hedis-worklist`,
`S` = `src/store/useAppStore.js`.

---

## 1. Core concepts

- **One table, gaps in JSONB.** Members live in `public.hedis_members`. There is
  no separate gap table: each member's gaps are an array in `gaps jsonb`.
- **Rows are members, gaps are badges.** Each worklist row is a member; the
  row shows gap badges. Clicking a badge opens that gap; clicking the row opens
  the first gap. Members with zero gaps are not rendered (`F/HedisWorklistRow.jsx:316`).
- **Gap object shape:**
  `{ code, status, startDate, assignee?, source?: 'astrana' | 'fold-native', linkedTo?, dueDateISO?, draft? }`
- **Gap statuses** (`F/CareGapDetailDrawer.utils.js:20`):
  `Open`, `Engaged`, `Engaged Requires Follow-Up`, `Submitted`, `Completed`,
  `Closed - Do not call`, `Closed - UTR`, `Closed - Other`.
  - `Completed` is the compliant end state and is locked once set.
  - `Closed - *` statuses act as exclusions.
  - "Active" gap = not `Completed` and not `Closed*` (`F/useClinicalNotePanel.js:46`).
- **Activity timeline** for every gap is `public.caregap_activity`.

---

## 2. Routing and mounting

| Where | What |
| --- | --- |
| `src/lib/router.js:239, 270, 287, 361-372` | `#/hedis` and `#/hedis/patient/<memberId>/...`; sets `activePage='population'`, `activeSubnavList='HEDIS'` |
| `src/components/SubNav/SubNav.jsx:13` | SubNav entry; badge count from mock `HEDIS_MEMBERS.length` |
| `src/layouts/AppLayout.jsx:145, 155, 175` | `isHedis`, chromeless layout, renders `<HedisWorklistTable/>` |
| `features/patient/left-panel/PatientProfileTabs/PatientProfileTabs.jsx:20` | Opens `CareGapDetailDrawer` from Patient 360 |
| `features/tasks/TaskDetailDrawer.jsx`, `TasksView.jsx` | Embed `ClinicalNotePanel` for reviewer sign-off |
| `features/tasks/ClinicalNotePreviewDrawer.jsx`, `PatientNotesTab.jsx` | Reuse note preview, hook, and parts |

---

## 3. Component tree

```
HedisWorklistTable (F/HedisWorklistTable.jsx:43)
├─ SectionTitleBar: year dropdown, search, filter, download*, history*
├─ FilterChipBar + SavedFiltersChip (shared from features/hcc)
├─ HedisWorklistRow (F/HedisWorklistRow.jsx:303)
│   columns: member, totalGaps, gapStatus, assignee (inline AssigneeChange),
│   startDate (+ DSF-B due chip), outreach, advIllness, frailty, riskLevel, tasks, actions
├─ BulkBar + BulkChangeHedisAssigneeDialog
├─ SortPopover (Member column)
└─ CareGapDetailDrawer (F/CareGapDetailDrawer.jsx:73, remounts per member)
    ├─ CareGapDetailDrawerHeader: measurement year, assignee, status menu,
    │   Measure Tutorial (MeasureInfoBody), More menu, prev/next gap, Suggested Actions
    ├─ Tabs: Activity | Clinical Notes | Outreaches | Tasks | Appt/Reminders |
    │        Documents | Referrals | Orders
    └─ Left workspace slot (one at a time): task, schedule, outreach, document,
        appointment, reminder, referral form/detail, clinical-note (single / consolidated),
        clinical-note-preview, measure info, lab order/detail/review

ClinicalNotePanel (F/ClinicalNotePanel.jsx:19)   1280px multi-gap / 700px review
├─ NoteContextPane + GapEvidencePane  (or ConsolidatedNoteBody in review flow)
├─ HeaderActions (F/ClinicalNotePanelParts.jsx:41) + ReviewerPickerPopover
└─ Evidence forms: GenericEvidenceForm, CBP/EED bespoke, DsfaEvidenceForm, DsfbEvidenceForm
```

`*` = toast-only stub.

---

## 4. Measures

- `MEASURE_NAMES`: `F/CareGapDetailDrawer.utils.js:1`, `F/ClinicalNotePanel.utils.js:6`.
- `GAP_TEMPLATES`: about 30 measure codes with field schemas
  (`F/ClinicalNotePanel.utils.js:139-517`). CBP, EED, DSF-A and DSF-B have
  bespoke defaults (`:562-616`).
- DB templates override code templates: `forms` rows with `form_type='Note'`,
  `gap_code`, and `is_default_for_gap` (one default per gap code).
- Measure Tutorial content (`F/measureInfoData.js:15`) exists only for CBP, BCS,
  LSC, DSF-A, DSF-B, COL. Others use `DEFAULT_MEASURE_INFO` (`:228`).
- Lab-closable measures (`F/labs/labRules.js:52-99`): GSD3 / DM (HbA1c),
  KED (eGFR), COL (FIT), CHL (Chlamydia NAAT).

---

## 5. End-to-end workflow

### 5.1 Open and filter the worklist
1. On mount: `fetchHedisMembers` (single-fire `hedisDidFetch` guard) and
   `fetchPlatformUsers` (`F/HedisWorklistTable.jsx:60, 87`).
2. Search matches name, member ID, or initials (`:96`).
3. Filters: `F/hedisFilters.js` (`FILTER_DEFS :71`, `memberMatchesFilters :149`),
   state in `hedisFilters` (S:9238), saved via `saveSavedFilter('HEDIS')` (S:9265).
4. Default sort is `startDate` desc; pagination from store `currentPage` / `perPage`.
5. The year dropdown only passes `year` to the drawer. It does not filter rows.

### 5.2 Open a gap
The drawer fetches, per member: program documents, reminders, eFax numbers,
referral directory, referrals, comments, activity, appointments, clinical notes,
tasks (`F/CareGapDetailDrawer.jsx:113-411`). Prev/next cycles through the
member's gaps (`:1133`).

### 5.3 Review evidence
- **Measure Tutorial** opens `MeasureInfoBody`.
- **Activity tab** merges `caregap_activity` with `caregap_comments` (`:962`),
  with search and Type / By / Date chips.
- **Documents tab** uploads to `program_documents` (ids `cgdoc-*`) and logs
  "Document Uploaded".
- **Orders tab** shows lab evidence (section 6).

### 5.4 Clinical note (the main closure path)
1. **Add Note** opens the standalone multi-gap `ClinicalNotePanel` when the
   member has more than one open gap, otherwise the inline single-gap
   workspace (`:480`). Hidden when status is Submitted, Completed, or Closed-*.
2. **Hydration** (`F/useClinicalNotePanel.js:65-87, 305-404`): defaults, then
   newest cached note payloads, then re-hydrate after fetch.
3. **Save Draft** (`:529`): upsert `clinical_notes` with `status='draft'`, only
   changed gaps. DSF-A and DSF-B always share one row. Logs "Clinical Note Added".
4. **Submit for Review** (`:582, :597`):
   - Requires Date of Service and at least one Ready gap.
   - Reviewer picker opens; on confirm: build PDF, upsert `status='submitted'`
     with `reviewer_id` / `reviewer_name`.
   - Gaps go to **Submitted** and are assigned to the reviewer. Declined DSF
     gaps stay Open.
   - `createCareGapSignOffTask` (S:6792) creates or refreshes a task:
     pool `HEDIS Sign-Off`, assigned to reviewer, due tomorrow, labels = gap codes.
   - Note linked via `review_task_id`. Logs "Pending Review".
5. **Sign & Save / Sign and Print** (`:723, :805`): upsert `status='signed'`,
   gaps go to **Completed** via `bulkUpdateGapStatuses`, linked task completes,
   logs "Clinical Note Signed". Print opens the PDF data URL.
6. **Viewing existing notes** (drawer `:518-589`):
   - Draft: opens the editor.
   - Submitted: consolidated editor if you are the reviewer (name match),
     otherwise preview with Edit.
   - Signed: preview with Print and Amend. Amend seeds the editor via
     `amendNoteId`; the DB trigger snapshots the prior version.
7. **Template choice:** DB default per `(gap_code, context)` first, otherwise
   `GAP_TEMPLATES`. `form_type` is `<code>_visit_note` or `consolidated_visit_note`.
8. **PDF:** `F/lib/generateClinicalNotePdf.js:28` (jsPDF) returns
   `{ blob, dataUrl, filename }`, stored in `clinical_notes.pdf_data_url`.

### 5.5 Reviewer sign-off from Tasks
- `TaskDetailDrawer` finds the member by `hedisMemberId`, or by name when the
  pool is `HEDIS Sign-Off` (`:54-78`), and opens `ClinicalNotePanel` with
  `editingTaskId`.
- Completing the task in the Tasks list calls `completeCareGapSignOffTask`
  (S:7389): task done, all `hedisGapCodes` go to Completed, note signed,
  "Clinical Note Signed" logged.

### 5.6 DSF-A / DSF-B (depression screening and follow-up)
- DSF-A = PHQ-2 screening; DSF-B = PHQ-9 follow-up. Forms render inside the
  clinical note (`F/dsf/DsfEvidenceForms.jsx`).
- Scoring (`F/dsf/dsfScoring.js`):
  - PHQ-2 positive when total is 3 or higher (`:62`).
  - PHQ-9 bands (`:74`): 0-4 minimal, 5-9 mild, 10-19 moderate (includes
    moderately severe), 20-27 severe.
  - Unanswered items give a null total.
- **Negative PHQ-2:** shows the `phq2Negative` wellness care plan inline.
- **Positive PHQ-2:** explicit Save score stamps `{ totalScore, outcome, savedAt }`,
  locks DSF-A, marks it Ready, then `openDsfbGap` calls
  `openNativeGap(member.id, 'DSF-B', { linkedTo: 'DSF-A', dueDateISO: savedAt + 30d })`
  (S:6353, idempotent) and promotes the drawer to the consolidated view.
- **DSF-B due date** (`computeDsfbDueDateISO :91`), first match wins:
  PHQ-2 `savedAt + 30d`, gap `dueDateISO`, gap `startDate + 30d`, today + 30d.
- **Standalone DSF-B** (Astrana-ingested, no DSF-A on the note) collects its own
  Location and Performed-by.
- **Mild band** asks: prior episodes or symptoms longer than 3 months (Yes / No).
- **Care plans** (`F/dsf/dsfCarePlans.js:67-75`): `phq2Negative`, `phq9Minimal`,
  `phq9MildNo`, `phq9MildYes`, `phq9Moderate`, `phq9Severe`, `decline`.
  Decline wins. Bullet copy is verbatim clinical wording: do not paraphrase.
- **Phq9ExitDialog** guards close (partial PHQ-9) and save-draft (DSF-B present),
  showing `answered/9` and days remaining.

### 5.7 Lab orders (Orders tab)
Lab order status and gap evaluation are deliberately separate
(`F/labs/labRules.js:5-9`): a completed order can leave the gap Open, and an
external result can satisfy a gap with no order.

- **Order statuses:** Draft, Ordered, Awaiting Collection, Collected,
  In Process, Result Available, Completed, Cancelled.
- **Evidence status:** Qualifying, Non-qualifying, Pending Review,
  Outside Measurement Period.
- **Gap evaluation** (UI only, not stored): Open, In Progress, Satisfied, Not Satisfied.
- `evaluateResult` (`:138-159`): no rule / wrong test / no value is
  Non-qualifying; collected outside Jan 1 to Dec 31 of the measurement year is
  Outside Measurement Period; otherwise Qualifying. Any reported value counts.
- `deriveLabState` (`:168-211`) picks the evaluation and next action
  (`review`, `evidence`, `order`, `new`).
- **Hook** `F/labs/useCareGapLabs.js`: `placeOrder` (creates as Awaiting
  Collection), `recordResult`, `importExternalResult`, `cancelOrder`,
  `reviewResult`. Persists via `src/store/lib/caregapLabsPersist.js`.
- **The only lab path that closes a gap:** `reviewResult({ closeGap: true })` on
  a Qualifying result calls `updateGapStatus(member.id, gapCode, 'Completed')`
  (`:204-206`), driven by the "Also mark this Care Gap as Completed" checkbox in
  `LabResultReview.jsx`.
- `LabPrototypeControls.jsx` simulates collection, processing, results, and
  external imports using the real hook actions.

### 5.8 Referrals
- Channels: eFax and Email. Sender = your active eFax number or a
  `referral_sender_lines` entry. Recipients from `profiles`.
- "Generate" calls `/api/referral-email` (Gemini proxy with template fallback,
  `F/referralEmail.js:27`).
- Status: Draft, Signed & Referred, Completed. Each step logged.
- Send requires recipient contact, at least one attachment, a sender, and
  either a reason (eFax) or subject + body (Email) (drawer `:169`).
- Attachments go to the `program-documents` storage bucket.

### 5.9 Appointments, reminders, outreach
- **Appointments:** ScheduleDrawer against `appointments`; logs
  Scheduled / Deleted.
- **Reminders:** `caregap_reminders`; logs Set / Updated / Completed / Deleted.
- **Outreach:** `useOutreachTab`; one activity entry per program.

### 5.10 Assignment and manual status
- Per gap: inline in the row or in the drawer header via `updateGapAssignee`
  (S:6274), logs `assignee_change`.
- Bulk: `BulkChangeHedisAssigneeDialog` reassigns every active gap on the
  selected members. This is the only working bulk action.
- Manual status: header status menu calls `updateGapStatus` (S:6242), logs
  `status_change`. Completed is locked.

---

## 6. Business rules

### Gap status transitions
| From | To | Trigger |
| --- | --- | --- |
| Open / Engaged | Submitted | Clinical note submitted for review |
| Open / Submitted | Completed | Note signed, sign-off task completed, or qualifying lab reviewed with `closeGap` |
| Any (except Completed) | Any | Manual status menu |
| (none) | DSF-B Open | Positive PHQ-2 saved on DSF-A |

### Note readiness (`isMandatoryComplete`, `F/ClinicalNotePanel.utils.js:661`)
- CBP: bpDate, systolic, diastolic, location.
- EED: 7 required fields (`:523`).
- Template gaps: their `required` fields, plus telehealth consent when `consentWhen` applies.
- DSF-A: location, consent, performedBy, PHQ-2 score (positive must be saved).
- DSF-B: saved PHQ-9 or Decline; standalone DSF-B also needs visit context.
- Gaps toggled off (`manuallyOff`) are excluded.
- Cannot sign when DSF-A is Ready but its DSF-B is not (`F/useClinicalNotePanel.js:892`).

### Clinical note lifecycle (DB-enforced, `supabase/clinical_notes_lifecycle_guards_migration.sql:14-31`)
- draft to submitted or signed; submitted to draft or signed.
- signed to signed only (amend), and only by the original signer.
- Only the assigned reviewer can sign a submitted note.
- `signed_by_id` must equal `auth.uid()`.
- Every UPDATE snapshots the old row into `clinical_note_versions`.

---

## 7. Supabase schema

All IDs are `text` unless noted. `hedis_member_id` is a text reference with no
real FK to `hedis_members`. RLS is "authenticated full access" unless noted.

| Table | Purpose | Key columns / notes | Migration |
| --- | --- | --- | --- |
| `hedis_members` | Members + gaps | `id`, `name`, `member_id`, `gaps jsonb`, `assignee`, `start_date` (MM/DD/YYYY text), `adv_illness`, `frailty`, `risk_level`, `outreach_dots jsonb`, demographics | `aaa_bootstrap_missing_tables_migration.sql:975-1003, 1887` |
| `caregap_activity` | Gap timeline | `member_id`, `at`, `actor`, `t` (type), `title`, `payload jsonb` | bootstrap `:420-430, 2053`; `tasks_hedis_linkage_migration.sql` |
| `caregap_comments` | Comments + mentions | `hedis_member_id`, `gap_code`, `author_id uuid`, `body`, `mention_ids uuid[]`; triggers stamp author and emit `hedis.comment_mention` notifications; write RLS = own rows | `caregap_comments_migration.sql` |
| `caregap_reminders` | Reminders | `remind_date`, `remind_time`, `assignee`, `status` (Pending / Completed) | `caregap_reminders_migration.sql` |
| `caregap_referrals` | Referrals | `channel` (efax/email/sms/chat), `provider_id`, `reason`, `attachments jsonb`, `status`, `email_subject`, `email_body`, `recipient_read_at`; trigger emits `referral.received` | `caregap_referrals_migration.sql`, `caregap_referrals_email_migration.sql` |
| `referral_sender_lines` | Sender lines | `channel`, `label`, `value`, `is_default`; select-only RLS. eFax rows moved to `efax_numbers` | `caregap_referrals_migration.sql` |
| `caregap_lab_orders` | Lab orders | `gap_code`, `measurement_year`, `tests text[]`, `diagnoses jsonb`, `priority`, `performing_lab`, `status` | `caregap_lab_orders_migration.sql:23-41` |
| `caregap_lab_results` | Lab results | `lab_order_id` FK (null = external), `test_name`, `value`, `evidence_status`, `reviewed_by`, `reviewed_at`; seeds a prior 8.2% HbA1c for GSD3 members | `caregap_lab_orders_migration.sql:43-83` |
| `clinical_notes` | Notes | `id uuid`, `hedis_member_id`, `gap_codes text[]`, `form_type`, `status` (draft/submitted/signed), `payload jsonb` (DSF data lives here), `pdf_data_url`, `reviewer_id`, `review_task_id`, `signed_by_id`, `origin_kind`, `origin_ref`; RLS = any authenticated user | `clinical_notes_migration.sql`, `clinical_notes_origin_migration.sql`, `clinical_notes_rls_align_with_practice.sql` |
| `clinical_note_versions` | Append-only history | `note_id` FK cascade, `version`, snapshot fields; select + insert only | `clinical_note_versions_migration.sql` |
| `tasks` (additions) | Sign-off linkage | `hedis_member_id`, `hedis_gap_codes text[]` | `tasks_hedis_linkage_migration.sql` |
| `forms` (additions) | Note templates | `gap_code`, `is_default_for_gap` (one default per code) | `note_templates_migration.sql` |

**Seeds**
- `hedis_gap_clinical_note_templates_seed.sql`: Care Gap note templates (BCS, GSD3, EED, OMW, and more).
- `hedis_members_hd16_hd30_seed.sql`: 15 members, some with 9-12 open gaps.
- `hedis_members_dsf_ab_seed.sql`: `ap-dsfa-01..10` (DSF-A Open, `source:'astrana'`) and `ap-dsfb-01..05` (DSF-B with `dueDateISO`).
- `dsfb_standalone_due_date_and_source_migration.sql`: normalizes standalone DSF-B source and due date.
- `dsfb_orphan_cleanup_migration.sql`: removes fold-native DSF-B gaps whose DSF-A is not Completed.

**Persistence helpers** (`src/store/lib/`): `worklistPersist.js`
(`persistHedisGaps`, replaces the whole `gaps` array), `caregapCommentsPersist.js`,
`caregapRemindersPersist.js`, `caregapReferralsPersist.js`, `caregapLabsPersist.js`.
No RPCs are used.

---

## 8. Known gaps and prototype-only behavior

- **Silent note write failures.** If the `clinical_notes` upsert fails (RLS,
  lifecycle trigger, anything), the store keeps an optimistic local row
  (S:7283-7290). The UI can show Signed while the DB rejected it.
- **Whole-array gap writes.** Status and assignee changes replace the entire
  `hedis_members.gaps` JSONB. Concurrent edits can clobber each other; failures
  surface only via `reportPersistFailure`.
- **Name-based matching** for reviewer identity and sign-off task to member lookup.
- **Counts from mock.** SubNav / store HEDIS count uses `HEDIS_MEMBERS.length`
  from `F/data/mock.js`; `worklist_badge_counts` view excludes HEDIS.
- **Year picker** does not filter rows.
- **Unwired filters.** Many filter keys (lob, pcp*, snpType, riskIQ,
  careGapAddedDate, lastVisitDate, preferredCallTime, and others) target fields
  the DB mapper never fills, so they exclude every row.
- **In-memory only:** task `consolidatedPdf` / `state`; `hedisMemberId`,
  `careGap`, `measurementYear` on tasks created manually from the drawer are
  stripped before insert (drawer `:692-696`).
- **Table-missing fallbacks:** comments degrade to activity entries; reminders
  and referrals become session-only; labs fall back to `labMock`.
- **Hard-coded user:** `CURRENT_USER='Isabeth Partida Fra'` when there is no session
  (`F/ClinicalNotePanel.utils.js:3`).
- **DSF decline paths** in `bulkUpdateGapStatuses` do not log a status change.
- **Toast-only stubs:** Export, History, row More menu, Add MRC Task, Add Imaging
  Order, Run Automation, BulkBar More. "Schedule with Specialist" opens the
  generic scheduler.
- **Mocks still in the tree:** `F/data/mock.js` (47 members, used by
  `scripts/seed.js` and counts), `caregapActivityMock.js` (seed only),
  `referralDirectoryMock.js` (fallback when `referral_sender_lines` is empty).
- **Measure Tutorial** covers only 6 measures.
