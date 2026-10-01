# HCC: Complete Context

One file with everything needed to work on the HCC (risk-adjustment coding) feature: the domain, the product workflow, the data model, store state, UI surfaces, and known gaps between the spec and the code. Built from the existing docs and a read of the source on 2026-09-30.

Deeper companion docs (still the source of truth for their topics):

- `docs/features/hcc-coding-workflow.md`: domain and product reference
- `docs/features/hcc-worklist.mdx`: user-facing worklist doc
- `docs/features/hcc-activity-log-spec.md`: activity/audit event taxonomy and exact log copy
- `docs/features/ra-coder-workflow-prototype-consolidated-summary.md`: Astrana review feedback, talk track, persona journeys

Paths are relative to the repo root. `useAppStore.js` means `src/store/useAppStore.js`. Line numbers were accurate at the time of writing and will drift.

---

## 1. Domain

**HCC (Hierarchical Condition Category) coding** is how Medicare Advantage plans get paid for patient risk. CMS maps ICD-10 diagnosis codes into HCC categories (current model **V28**). Each HCC carries a **RAF weight** (Risk Adjustment Factor). A patient's RAF score is roughly demographic factors plus documented HCC weights. The customer is **Astrana**; the output of the pipeline is an **ASM file** handed to Astrana.

Two rules drive everything:

- **Recapture / annual documentation.** Every chronic condition must be re-documented each calendar year against a claimable DOS. A condition documented last year but not this year is a **recapture gap**.
- **MEAT evidence.** A diagnosis only counts if the note shows the provider **M**onitored, **E**valuated, **A**ssessed, or **T**reated it.

| Term | Meaning |
|---|---|
| DOS | Date of Service, one encounter. The unit a diagnosis attaches to. |
| RAF | `member.raf` = current score; `member.ri` (+ `ru` direction) = potential uplift if open gaps close. Per-ICD `raf` = that code's weight. |
| HCC (V28) | Category an ICD maps to, e.g. `E11.22 → HCC 37`. "No HCC" = billable but no RAF value. |
| Open gap | A diagnosis believed true but not yet coded on a claim this year. |
| Suspect | AI/analytics-suggested condition not yet confirmed. |
| Recapture | Documented in a prior year, missing this year. |
| Sweep | Reviewing one ICD across all of a patient's DOSs at once. |
| Claim / Claimed | DOS+ICD set submitted for billing. |
| Override / Trumped | ICD superseded by a more specific code or hierarchy rule (`trumpedBy`), or dismissed with a reason. |
| Missed opportunity | Condition exists but this DOS can't support it; tracked for provider education. |
| Defer | Punt the decision without accepting or rejecting. |
| Rebuttal | User-facing name for a QA/Compliance return (engine also has `Returned`). |
| Action Needed | Display label for Support status `Awaiting`. |

---

## 2. Review pipeline

```
Intake → Support Team → Coder → QA (engine: reviewer) → Compliance (engine: reviewer2) → Billing Ready / ASM → Billed
```

Engine roles (`src/features/hcc/assignment/astranaStaff.js:67`): `ROLES = ['support','coder','reviewer','reviewer2']`, labeled Support / Coder / QA / Compliance. UI role to engine role mapping: `ROLE_KEY_BY_USER` in `DiagPanel/DiagPanel.utils.js:3`. **There is no Reviewer 3 in code**, even though the product docs and `hcc_members.reviewer3_*` columns mention one (see section 9).

| Stage | What they do | Where |
|---|---|---|
| Support Team | Chart chasing: collect docs (upload, SFTP, EHR), OCR, patient matching, Pass/Fail each document, mark Insufficient or Reject. **Hard gate:** Coder is locked until Support is Completed. Support has no ICD actions ("Support role cannot code ICDs"). | `ChartDetailDrawer` |
| Coder | Reviews each ICD × DOS: Accept / Reject / Missed / Defer; Missed / Dismiss for suspects and recaptures; adds ICDs; Sweep Mode; can request records from Support. | `DiagPanel` |
| QA | Reviews completed records; can Return (Rebuttal) to Coder or request records from Coder/Support. | `DiagPanel` |
| Compliance | Final review (product intent: random pull incl. records QA skipped; view-only while downstream stage in progress). Completed → Billing Ready. | `DiagPanel` |
| Manager | Assignment: per-role "Assign" links, Bulk Change Assignee (skips Completed roles), manual role-skip override. | Worklist |

Lab/imaging documents must not create worklist rows or count toward a coder's denominator. The progress popover's final action reads **"Ready for ASM generation"** (renamed from "Send to Bill").

### Coder actions per ICD × DOS

| Action | Key | Store effect |
|---|---|---|
| Accept | `A` | `setHccGapDosAction(code, dos, 'accepted')` / ICD-level `acceptHccGap` |
| Reject / Dismiss | `X` | `dismissHccGapDos(code, dos, reason, note)` / ICD-level `dismissHccGap` |
| Missed opportunity | `M` | `setHccGapDosAction(..., 'missed')` |
| Defer | `D` | `setHccGapDosAction(..., 'deferred')` |
| Remove DOS | ⋯ menu | `removeIcdDos` (tombstone `removed: true`) |
| Add ICD | `+ ICD` | `addHccGap` / `addHccGapToRow` / `addHccGapNewRow` |
| Reopen | undo | `reopenHccGap` |

Repeating the same action toggles it off. The first ICD action auto-bumps the acting role from New/Assign to In Progress (`_maybeAutoBumpInProgress`, `useAppStore.js:8613`). When every ICD row on a DOS is acted on and the role is In Progress, the role auto-completes (`useDiagPanel.js` ~1130).

Suspect/recapture rows: **Missed Opportunity** and **Dismiss** are the primary visible buttons (never in ⋯). Missed sends the entry to the ASM file as an "Added" record and flags the physician. The ICD code comes directly from Astrana's API; the code dropdown is only for override. Exactly one DOS must be selected (tied to the existing document, no custom dates), which auto-fills Rendering Provider and POS.

---

## 3. Assignment engine (`src/features/hcc/assignment/`)

State is per DOS, keyed by `dosKey(pid, date, provider, pos)` → `${pid}::${date}::${provider||'—'}::${pos||'—'}` and stored in `hccDosAssignments`. All lifecycle transitions are pure and return `{ nextMap, events }`. The store dispatches through `transitionHccDos(patientId, dosDate, kind, payload)` (`useAppStore.js:9604`), which diffs status/assignee, patches row fields (`sup/cdr/r1/r2`, `supS/cdrS/r1s/r2s`), persists via `persistHccMemberRoleStatus`, and logs activity.

**`dosState.js`**

- `STATUS`: Assign, New, Awaiting, In Progress, Completed, Record Requested, Record Received, Returned, Rebuttal, Insufficient, Reject, Skipped, Billing Ready.
- State record: `{ patientId, dosDate, renderingProvider, pos, support|coder|reviewer|reviewer2: { assignee, status, originalAssignee, history[], records_request? }, sampling: { reviewer2 }, billingReady, asmGenerated, originatorRole, originatorAssignee, manuallyAdded, visitType, activity[] (max 200) }`.
- `computeWorkload` excludes Completed, Reject, Skipped, Billing Ready. `hydrateFromMember` infers staff ids from name initials.

**`lifecycle.js` transitions**

- `initializeDos`: manual path (originator is reviewer/reviewer2) sets Support and Coder to Skipped and puts the originator role at New. Normal path auto-assigns Support at Awaiting only with `opts.autoAssignSupport`.
- Support: `markSupportInProgress`; `completeSupport` (routes back via `recordsReceivedFor` if a records request targets Support, else assigns Coder at New); `markInsufficient`, `rejectDos` (terminal, reason required).
- Coder: `markCoderInProgress`; `completeCoder` (pending records request first, then manual-origin return to originator, else `autoSkipEarlierRoles` and assign reviewer at New).
- Records loop: `requestRecordsFrom(req, dest)` sets requester → Record Requested and destination → Returned; `recordsReceivedFor` sets requester → Record Received. Legacy `requestRecords` / `recordsReceived` are fixed to coder ↔ support.
- QA: `markReviewerInProgress`; `completeReviewer` always hands off to reviewer2 (except manual-origin by reviewer, which skips reviewer2 and sets `billingReady = asmGenerated = true`).
- Compliance: `markReviewer2InProgress` (also skips QA); `completeReviewer2` sets `billingReady = asmGenerated = true` after `validateAsmReadinessConfig`.
- Rebuttal: `returnDos(fromRole)` with `RETURN_TARGET { reviewer: 'coder', reviewer2: 'reviewer' }`; both sides go to Rebuttal. `resolveRebuttal` flips the target to Completed when the sender completes.
- `reassignRole` keeps prior assignee in history; `autoSkipEarlierRoles` only skips reviewer/reviewer2 and preserves terminal statuses.
- Store wrappers (`useAppStore.js:9822–9869`): `hccMarkSupportInProgress`, `hccCompleteSupport`, `hccMarkInsufficient`, `hccRejectDos`, `hccCompleteCoder`, `hccRequestRecords`, `hccRequestRecordsFrom`, `hccRecordsReceived`, `hccCompleteReviewer`, `hccCompleteReviewer2`, `hccReturnDos`. Plus `hccReassignRole` (9873, awaits persist, rolls back, returns `{ ok, reason }`) and `hccSetRoleStatus` (9990, optimistic with rollback).

**`engine.js` `pickAssignee(role, ctx)`** order: `preferredAssignees[role]` → Astrana pin (whoever already holds this patient at this role, unless `astrana === false`) → role chain:

- support: TIN → workload → stable-random
- coder: TIN → vendor → workload → random
- reviewer/reviewer2: prior-role mapping → vendor → SLA (`daysUntilDue ≤ slaCloseDays`, default 7) → same-patient → workload → random

Headroom = `capacity − open count`; ties break on id; "random" is FNV-1a hashed.

**Staff (`ASTRANA_STAFF`)**, shape `{ id, name, initials, role, active, tins, vendors, capacity }`:

| Role | Staff (capacity, TIN/vendor) |
|---|---|
| support | EJ 80 (TIN-1001/1004), AB 70 (TIN-1002), KS 70 (TIN-1003), LT 60, MT 70 (TIN-1005), OT 70 |
| coder | DH 60 (TIN-1001/1002, CIOX), PP 60 (TIN-1003/1005, MRO), CK 60 (TIN-1004) |
| reviewer | MA 50, BO 50 (CIOX), EF 50 |
| reviewer2 | KP 30, NR 30 (CIOX), JM 30 |

**`sampling.js`**: `DEFAULT_SAMPLING_RATES = { reviewer2: 0.10 }`; `isSampled` = FNV-1a of the composite key mod 10,000 vs `rate × 10,000`. `validateAsmReadinessConfig` is a dormant guard. **`sampledForReviewer2` is not called outside `sampling.js` and its test**, so every QA completion currently goes to Compliance.

**`reference/assignmentRouting.js`**: `DEFAULT_MANUAL_ROLE = 'coder'`; Inpatient/ER/Observation → reviewer; SNF/Hospice → reviewer2. **`reference/visitTypes.js`**: `POS_BY_VT` and `PROVIDER_POOL_BY_VT` for 16 visit types.

**Store config**: `hccConfig = { astrana: true, samplingRates: {...DEFAULT_SAMPLING_RATES}, slaCloseDays: 7 }`.

---

## 4. Statuses, SLA, compliance, filters

**`statusSpec.js`** is the single source of truth for status icon, color, bg, border, legend order.

- Legend: New, Awaiting, In Progress, Record Received, Insufficient, Rebuttal, Record Requested, Returned, Reject, Completed, Skipped, Billed.
- Aliases: Records Received → Record Received, Records Requested → Record Requested, Rejected → Reject. Display: Awaiting → "Action Needed", Reject → "Rejected".
- `ROLE_STATUS_OPTIONS` (user-pickable):
  - support: Awaiting, In Progress, Insufficient, Completed, Reject
  - coder: New, In Progress, Record Received, Record Requested, Completed, Reject
  - reviewer / reviewer2: New, In Progress, Rebuttal, Record Requested, Completed, Reject
- Skipped and Returned are engine-only.

**`hccTransitionLabels.js`**: `HCC_TRANSITION_LABEL` (13 kinds, e.g. `completeReviewer` → "QA Completed"), `hccTransitionRole`, `hccRoleStatusHeadline` ("{Role} status changed to {status}").

**`sla.js`**: `SLA_CONFIG = { windowDays: 14, dueSoonDays: 3 }`, clock runs from Created Date to Coder completion.

- `computeSla`: overdue (red, "Overdue: Nw/Nd"), due-soon ≤3 days (amber, "Due today"/"Due in Nd"), on-track (blue ≤7 days, else neutral).
- `slaOutcome`: SLA Met / Breached.
- `slaDueCategory`: null once `cdrS === 'Completed'`; else Overdue / Due Today / Due This Week / Due Next Week / Due More Than 2 Weeks. Drives the Due Date header dropdown.

**`compliance.js`** (document compliance, used by SFTP/OCR intake)

- OCR tiers: clean / degraded / unreadable (`evaluateOcrTier`, hash-based ~80/15/5%, `demo-*` overrides).
- `CHECK_KEYS`: correctPatient, legible, dosCharted, posAvailable, requiredFields, signaturePresent, providerName (3 `STANDARD_REASONS` each).
- Clean tier: AI decides five checks; requiredFields and signaturePresent stay pending. Degraded/unreadable: all pending. Degraded never auto-passes; unreadable routes to Support.
- `applyManualDecision` needs pass/fail plus a reason. `canCompleteDos(docs)` blocks with no docs, any unreadable doc, or any failed/pending check.

**`filters.js`**

- `MORE_FILTER_ITEMS`: 15 primary chips (Measurement Year, DOS, Assignee, Creation Date, Open ICDs, DOS Source, Documents Available, Support/Coder/QA/Compliance Status, Rendering Provider, Visit Type, POS Code, Claims) plus ~30 extended (Risk Level, Cohort, Adv. Illness, Gender, Decile, DOB, Language, City, State, per-role assigned/completed dates, per-role assignee `supU/cdrU/r1u/r2u`, HCC Gaps, Last Gap Assessment Date, PCP, IPA, HP Code, RAF, No. Of Gaps, TIN, Last Visit Date).
- `FILTER_DEFS` types: multi, radio, range (Decile, Adv. Illness, RAF), date.
- `SUPPORT_STATUS_MATCH`: "Action Needed" covers Assign, Awaiting, New, Record Requested.
- Role defaults (`hccRoleDefaultFilters(role, userName)`, line ~218), plus `asgn = [userName]` when known:

| Role | Default |
|---|---|
| Support | `supS ∈ {Action Needed, In Progress}` and `chart ∈ {1-5, 6-10, >=10}` |
| Coder | `cdrS ∈ {New, In Progress}` |
| QA | `r1s ∈ {New, In Progress}` |
| Compliance | `r2s ∈ {New, In Progress}` |

**`reviewedBy.js`**: `normalizeReviewerLabel` maps "(Reviewer 2)" → "(Compliance)", "(Reviewer 1)"/"(Reviewer)" → "(QA)". `reviewedByLabel` returns null for Support authors.

---

## 5. Supabase data model

Every HCC table except `hcc_diag_seen` is created in `supabase/aaa_bootstrap_missing_tables_migration.sql` (lines 681–973; constraints at 1463–2048). RLS is enabled everywhere; `narrow_public_policies_to_authenticated.sql` retargets the "Allow all for hcc_*" policies to `authenticated`.

| Table | Key columns | Purpose |
|---|---|---|
| `hcc_members` | `id` text PK, `member_id`, `name`, `gender`, `date_of_birth`, `current_visit`, `total_visits`, `chart_count`, `open_icds`, `create_date`, `due_label/color`, `{support,coder,reviewer1,reviewer2,reviewer3}_{name,status}`, `{support,coder,reviewer1,reviewer2}_{assigned,completed}_at`, `rendering_provider`, `visit_type`, `raf_score`, `raf_impact`, `ipa`, `health_plan`, `pcp`, `decile`, `cohort`, `risk_level`, `advillness`, `frailty`, `language`, `is_spawned`, `city`, `state`, `tin` | One coding record (Patient + DOS + Provider + POS). `reviewer3_*` unused. |
| `hcc_member_visits` | `member_id` FK cascade, `dos_date`, `status_label/color`, `visit_index` (UNIQUE with member) | Normalized `dos_list` |
| `hcc_member_documents` | `member_id` FK, `doc_index`, `status` | Normalized `docStatus[]` |
| `hcc_diagnosis_gaps` | `id`, `member_id` FK, `member_name`, `code`, `description`, `hcc_category`, `status` (default New), `type`, `kind` (default Associated), `docs/comments/notes_count`, `raf_weight`, `last_activity(_by)`, `dismiss_reason`, `is_linked`, `dos` | ICD gap per member |
| `hcc_gap_dos_actions` | `id = member|code|dos`, `action`, `dismiss_reason`, `dismiss_note`, `removed` | Per-(ICD × DOS) decision; `removed` = tombstone |
| `hcc_gap_activity` | `member_name`, `sort_order`, `entry` jsonb | Seeded timeline (read-only) |
| `hcc_gap_sweep` | `member_name`, `code`, `hcc`, `type`, `dos_entries` jsonb, counts | Sweep-mode dedup view (read-only) |
| `hcc_gap_confidence` | `code` PK, `score`, `status`, `evidence`, `factors`, `meat_note` | AI confidence + MEAT (read-only) |
| `hcc_member_raf` | `member_name`, `hcc`, `hcc_name`, `impact` | RAF breakdown tooltip (read-only) |
| `hcc_added_charts` | `hcc_member_id`, `caption`, `doc_type`, `file_name`, `date_added`, `added_by`, `meta`, `status` (Pending), `pdf_url`, `storage_path`, `visit_type` | Uploaded charts; files in Storage bucket `chart-uploads` |
| `hcc_chart_status` | `id = member|doc`, `status`, `fail_reasons[]`, `fail_note` | Per-document Pass/Fail |
| `hcc_removed_charts` | `id = member|doc`, `removed_at` | Unlink tombstone (covers `::sys` docs) |
| `hcc_documents` | `file_name`, `ocr_tier`, `compliance` jsonb, `encounters` jsonb, `source`, `status`, `ingested_at` | SFTP / OCR intake batches |
| `hcc_diag_comments` | `author`, `role`, `body`, `icd`, `dos`, `status_from/to`, `hcc_member_id`, `author_id` uuid, `mention_ids` uuid[] | DiagPanel comments |
| `hcc_diag_documents` / `hcc_diag_notes` / `hcc_diag_history` | name/type/status; title/author/signed/body; dos/hcc/reviewed_by/claims | DiagPanel ancillary tabs (org-scoped) |
| `hcc_diag_seen` | PK(`user_id`, `hcc_member_id`, `kind` ∈ comments/documents), `seen_ids` | Per-user unread tracking |
| `hcc_activity_log` | `id`, `ts`, `category`, `event_name`, `severity`, `actor_id/name/role`, `source`, `batch_id`, `file_id`, `encounter_id`, `patient_id`, `dos`, `icd`, `claim_id`, `headline`, `payload`, `ip_address`, `user_agent` | Append-only audit log |

Other HCC migrations:

- `hcc_activity_log_stamp_actor.sql`: trigger sets `actor_id = auth.uid()`; insert policy requires it.
- `hcc_diag_comment_member_migration.sql`: adds `hcc_member_id`.
- `hcc_diag_comment_author_migration.sql`: `author_id`, `mention_ids`, `notifications.hcc_member_id`; triggers `stamp_hcc_diag_comment_author` and `emit_hcc_diag_comment_notifications` (type `hcc.comment_mention`).
- `hcc_diag_comment_rls_and_edit_mentions_migration.sql`: author-only insert/update/delete; `pin_hcc_diag_comment_author`; re-notifies only new mentions on edit.
- `hcc_added_charts_visit_type_migration.sql`, `hcc_chart_status_fail_details_migration.sql`, `hcc_diag_seen_migration.sql`.
- `drop_hcc_members_v2_view_migration.sql`: drops `hcc_members_v2`, recreates `worklist_badge_counts` (`hcc_unique` = distinct normalized `coalesce(member_id, id)`).

Also relevant: `icd_codes` (ICD lookup cache), `pos_codes`, `care_teams` (HCC Care Teams), `profiles.clinical_roles` (who can be assigned to which role).

---

## 6. Store state (`useAppStore.js`, `src/store/slices/hccWorklistFiltersSlice.js`)

**Persist helpers** (`src/store/lib/worklistPersist.js`, fire-and-forget, failures to `reportPersistFailure`): `persistHccGapDosAction`, `persistHccGapDosActionDelete(All)`, `persistHccGapUpdate`, `persistHccGapInsert`, `persistHccGapDelete`, `persistHccMemberInsert`, `persistHccMemberDetails` (updates counts, rewrites visits and documents), `persistHccMemberRoleStatus(memberId, role, status, name)` (role → column: support, coder, reviewer → `reviewer1_*`, reviewer2; 0 rows = error), `persistHccActivityRow`, `persistHccDiagComment(Update|Delete)` (retries without newer columns if missing), `persistHccDiagNote`, `persistHccDiagDocument`. Also `persistHccAddedChart` (`src/store/lib/documentUploadPersist.js:11`) and `persistHccDocument` (`useAppStore.js:10521`).

**Mappers** (`src/lib`): `hccAddedChartsMapper.js` (`addedChartToRow`, `rowToAddedChart`; does not write `visit_type`), `hccDocumentMapper.js` (`hccDocumentRowToJs`, `hccDocumentJsToDb`).

**Filters slice**: `hccDueDateFilter`, `hccFilters` (`setHccFilter`, `clearHccFilters`), `hccVisibleFilterKeys` (default visible `['my','rl','coh','g','open','chart','supS','cdrS','r1s','dec']`), saved filters (`saveHccFilter`, `renameHccSavedFilter`, `deleteHccSavedFilter`, `applyHccSavedFilter`), `hccHiddenCols` and `hccColumnOrder` (localStorage).

**Main store keys**, by area:

- Role: `hccUserRole` (localStorage, default Coder), `setHccUserRole`, `applyHccRoleDefaultFilters` (3972–4010). Switched from `components/TopBar/TopBar.jsx:57`.
- Members: `hccMembers`, `fetchHccMembers` (7450). Four parallel selects rebuilt into the "fat row"; mock `HCC_MEMBERS` only on cold-start failure. `normalizeWorklistRow` clamps Created Date to the last 35 days, forces DOS into the past, assigns deterministic visit type / POS / provider, pads `dos_list` to 2+, sets `arrivalOrder`, `sourceDocumentIds`, `createdAt`, `slaTargetAt`, and enforces sequential status invariants.
- Gaps: `hccDiagnosisGaps`, `fetchHccDiagnosisGaps(memberId, memberName)` (7979) derives `kind` (Manual / Recapture / Suspect / Associated) and loads `hccGapDosActions`, `hccGapDosMeta`, `hccGapDosDeleted` (keyed `code|dos`). `acceptHccGap`, `dismissHccGap`, `reopenHccGap`, `setHccGapDosAction`, `dismissHccGapDos`, `removeIcdDos`, `deleteHccGap` (Manual only), `addHccGap`, `addHccGapNewRow`, `addHccGapToRow`, `backfillMockNotLinkedGaps`.
- Read-once data: `hccGapActivity`, `hccGapSweep`, `hccMemberRaf`, `hccGapConfidence`, plus `fetchHccDiagAncillary` (comments, documents, notes, history) and `hccDiagSeen` / `markHccDiagSeen`.
- Charts: `hccAddedCharts` / `addChartDoc`, `hccChartStatus` / `setChartDocStatus(memberId, docId, status, { deferSync })`, `hccRemovedCharts` / `removeChartDoc`, `hccDeleteDos`.
- Assignment: `hccDosAssignments`, `getHccDosState`, `initializeHccPatient`, `hccInitializeManualDos`, `transitionHccDos`, wrappers listed in section 3, `hccRejectInfo`, `hccStaffName`, `hccStaffInitials`.
- Selection: `selectedHccIds`, `selectHccMember`, `selectAllHcc`, `clearHccSelected`.
- DiagPanel UI: `diagPanelOpen`, `diagPanelMemberId`, `diagDosFilter` (null = first DOS, `'ALL'` = sweep), `diagViewMode`, `diagHighlightCode`, `diagDosStatus`, `diagLeftPanel` (activity | comments | documents | notes | claims | newDiagGap), `diagActivityIcd`, `diagOpenDocId`, `diagClaimDos`; `openDiagPanel(memberId, { initialDos, highlightCode, dosStatus, leftPanel, activityIcd, claimDos, openDocId })` (~11707), `openDiagPanelFromNotification`, `closeDiagPanel`. `hccClaimPreview` / `openHccClaimPreview`.
- Comments/notes: `addHccDiagComment`, `updateHccDiagComment`, `deleteHccDiagComment`, `addHccDiagNote`; `hccCareTeams` CRUD (table `care_teams`).
- Activity: `hccActivityLog` (in-memory panel timeline, dedups same type+headline within 1500 ms via `addActivityEntry`), `hccActivityFeed` (seeded by `buildSeedHccActivityFeed`), `fetchHccActivityFeed(filters)` (up to 500 rows), `logHccActivity({ eventName, scope, payload })` → `makeActivityRow` → `persistHccActivityRow`, `hccHistoryDrawerOpen`.
- Intake: `hccSftpBatches`, `hccSftpReviewOpen`, `fetchHccDocuments`, `simulateSftpIngest`, `queueHccDocumentForOcr`, SFTP encounter patch/remove/status actions, `applyHccComplianceDecision`, `hccUploadSession { id, phase, file, encounters, seededMemberId, summary }`, `startHccUpload`, `findHccMemberByNameAndDob`, `hccCreateOrMergeFromEncounter` (11399), `confirmHccUpload` (11646), `hccAddDosMember` / `spawnHccMemberFromDos` (11099), `icdCreationOpen`.

**Activity log module** (`src/features/hcc/activityLog.js`): `CATEGORIES` intake, ocr, matching, review, worklist, icd, dedup, claim, audit; `SOURCES` manual, sftp, system, astrana; `SEVERITY` info, success, warning, error; `EVENTS` ~45 names (e.g. `assignee.changed`, `role.status_changed`, `dos.deleted`, `icd.created_manual`, `compliance.failed`, `asm.file_generated`). `makeActivityRow` throws on unknown events. See `hcc-activity-log-spec.md` for the full taxonomy and HIPAA rules (append-only, server timestamps, actor snapshots, original/modified values on edits).

---

## 7. Mock / reference data (`src/features/hcc/data/`)

- `mock.js`: `HCC_COLUMNS` and `HCC_MEMBERS`. Raw row fields: `in, name, g, age, cv, tv, dos_list[{ date, label, labelColor, provider, pos, posDesc, vt, open }], ch, docStatus[], open, date, due, dueCol, sup, supS, cdr, cdrS, r1, r1s, r2, r2s, rp, vt, raf, ri, ru, ipa, hp, pcp, dec, coh, rl, ad, fr`, plus `id: 'hcc-N'`, `memberId`, `dob`. Store adds `visitType`, `arrivalOrder`, `createdAt`, `slaTargetAt`, `isSpawned`, `city`, `state`, `tin`, and per-role assigned/completed dates (`supAD/supCD/...`).
- `icds.js`: gap record `{ code, desc, hcc: 'HCC n - Name' | 'HCC Not Linked', status, type: null | 'Manual' | 'Suspect' | 'Recapture', docs, cmts, notes, raf, last, by }`; `ICDS` and `NOT_LINKED` keyed by member name, generated from `ICD_POOL` (16 V28 codes) otherwise. `getOpenIcdsForMember` = status not Accepted/Dismissed.
- `sweepIcds.js`: `{ code, desc, hcc, type, dos_entries: [{ dos, status, raf, claimed }], ... }`.
- `raf.js`: static `RAF_BREAKDOWN`. **No RAF calculation in the HCC feature**; `raf`/`ri` are stored values. (A separate V24-based `rafScore` exists in `src/lib/patientSnapshot.js` for the patient hover card.)
- `activity.js`, `ancillary.js` (COMMENTS, DOCUMENTS, NOTES, CLAIMS, OUTREACH, HISTORY), `chartDocs.js` (`getChartDocs` merges system docs `${memberId}::sys${i}`, uploads, status overrides, removals; `DOC_TYPES`), `confidence.js` (score tiers ≥75 Auto-Surface, ≥55 Clinical Review, ≥35 Batch Review, else Suppressed; `EVIDENCE_FACTORS`, `MEAT_NOTE_DATA`), `posCodes.js` (52 CMS POS codes).
- `upload/v28Whitelist.js`: `V28_ICD_WHITELIST` (34 codes); non-whitelisted ICDs render muted/struck.

---

## 8. UI surfaces

### Entry and routing

- SubNav entry `{ label: 'HCC', view: 'hcc' }` (`src/components/SubNav/SubNav.jsx:12`), count from deduped fold IDs.
- Hash route `#/population/hcc` (`src/lib/router.js:238`; `'hcc-archived'` still maps to HCC).
- `src/layouts/AppLayout.jsx` renders `HccWorklistTable` chromeless and lazy-mounts the global overlays: `DiagPanel`, `UploadChartDrawer`, `UploadDocumentDrawer`, `HccUploadProcessingHost`, `HccSftpReviewDrawer`, `HccAddDosDrawer`, `IcdCreationScreen`, `ClaimPreviewDrawer`.
- Role defaults apply on entering the list when no filters or saved view are active.
- Other entry points: notifications (`openHccReview`, `openSftpReview`, `openDiagPanel`), HelpPopover "HCC Coding" entries, All Patients "Upload File".

### Worklist (`HccWorklistTable*`, `HccWorklistRow*`, `useHccWorklistTable.js`)

- Rows are deduped by fold ID with merged `dos_list`. Filter order: Due Date bucket → `memberMatchesFilters` → search.
- **Default sort in code: Created Date ascending (oldest first)**, `useTableSort(filtered, 'date', 'asc')` (`useHccWorklistTable.js:241`). The Due Date header dropdown is a filter, not the sort.
- Title bar: Due Date dropdown, search, filter toggle, history, `SavedFiltersChip`, Export (coming soon), Upload menu (Upload Document / Add Manually).
- Columns (`columns.js`): fixed Checkbox, Member, Actions. DOS-level stacked columns: DOS, Open ICDs, Visit Type, Rendering Provider, POS. Record-level: Created Date, Documents, Support Team, Coder, QA, Compliance, Progress, Assignee, PCP, RAF Score, RAF Impact, IPA, HP Code, Decile, Cohort, Risk Level, Adv. Illness, Frailty. Column config popover toggles and reorders.
- Row behavior: Rejected and Billed rows are read-only. DOS cell opens DiagPanel for that DOS; `DosSourceBadge` D/C/M (C opens `ClaimPreviewDrawer`). Open ICDs hover list opens DiagPanel with `highlightCode`. Documents cell: Support opens `ChartDetailDrawer`, other roles open read-only `DocPreviewDrawer`.
- `RoleStatusCell`: "Assign" pill when unassigned; status icon hidden until upstream role is resolved (records-loop states always shown); Completed roles locked; reassignment through `RoleAssigneePicker` (strictly scoped by `profiles.clinical_roles`, dispatches `hccReassignRole`).
- Created Date cell shows live SLA color, then SLA Met/Breached once Support and Coder are done. Progress column: 4-dot stepper with `ReviewProgressPopover`.
- `BulkChangeAssigneesDialog`: pick role and user (Care Team members ranked first), applies to first DOS of each selected row, skips Completed/Reject/Insufficient, toast reports updated/skipped/failed.
- `FilterChipBar.jsx` (shared with HEDIS) uses the shared `FilterBar` and `FilterChip`; `MoreFiltersPopover` toggles chip visibility; `SavedFiltersChip` is the only place to manage saved views.

### Support: `ChartDetailDrawer` ("Document Review")

- Per-document Pass / Fail (11 `FAIL_REASONS` plus note) / Undo, persisted immediately with `deferSync`.
- Support status sync runs on drawer close (`deriveStatus`: all/most failed → Insufficient, all passed → Completed via `hccCompleteSupport`, which auto-assigns Coder).
- Manual status: In Progress, Insufficient (needs ≥1 failed doc + reason), Completed, Rejected.
- Locks once the Coder is engaged. Pass/Fail auto-assigns the acting user as Support.

### DiagPanel ("Diagnosis Gaps Details")

- Header: `PatientBanner` (RAF + uplift chip), Created date + SLA, stage pill with `ReviewProgressPopover`, assignee avatar, `DosStatusMenu` (options from `ROLE_STATUS_OPTIONS`).
- Toolbar: bulk select, search, `+ ICD`, filter (ICD status, Claims), Documents, Comments, Timeline, More; unread dots from `hccDiagSeen`.
- Cards: alerts (rejected/billed/new-row) → pending `IcdCard` editors → "ICDs Associated with N/M DOSs" → `IcdDosCard` (one card per ICD, one row per DOS) → "Suspects and Recaptures" (`SuspectCard`).
- `IcdCard` add flow: picking an existing DOS auto-fills provider/POS/visit type; a new date spawns a new worklist row. QA/Compliance-added ICDs pin the new DOS to the current user.
- Dialogs: `DismissReasonForm` (5 reasons + note), `DiagPanelRejectDialog` (6 reasons, comment required), `RecordsRequestDialog` (QA/Compliance pick Coder or Support; Compliance can pick QA; Coder always to Support; @mention comment required).
- `useDiagPanel.js` `applyStatusChange` (~714): Completed → role's `hccComplete*`; Record Requested → `hccRequestRecords(From)`; Support Insufficient/Reject → `hccMarkInsufficient`/`hccRejectDos`; QA/Compliance Rebuttal → `hccReturnDos`; else `hccSetRoleStatus`.
- Locks: rejected or billed DOS freezes all ICD actions (comments stay live); Coder locked until Support Completed; QA/Compliance locked while own status is Record Requested; Rebuttal recipients read-only.
- Keyboard: ↑/↓ move, Enter opens document, A / X / M / D. Focus advances to the next un-acted row. Disabled for Support.
- `LeftWorkspace.jsx` second pane (drawer widens to 1280px): Documents, Claims, Timeline, Comments, Notes, History, Worklog (+ Outreach). Comments support edit/delete, @mentions limited to current and past record assignees (`recordParticipants.js`), author stamping in `commentAuthor.js`.
- `DocEvidenceViewer` renders the real file or a generated jsPDF note with the ICD evidence line highlighted.
- Story-only (not used by the live panel): `HccGroupRow`, `IcdRow`, `RoleDots`, `CountsRow`, `IcdRowExpansionPanel`.

### Other drawers

- `HccAddDosDrawer`: one or more DOS blocks, each with simulated upload → OCR extract → confidence gauges; "M" chip marks manual edits. Save needs file, DOS, provider, POS, doc type, ≥1 ICD; calls `spawnHccMemberFromDos`.
- `UploadChartDrawer`: single-member chart upload/edit; only Coder/QA/Compliance can set initial Pass/Fail.
- `DocPreviewDrawer`, `ClaimPreviewDrawer` (Claim info, Rendering Provider, CPT, ICDs): read-only.
- `HccHistoryDrawer`: org-wide `hccActivityFeed`, Activity tab (grouped by month) and Documents tab (per upload batch), filters DOS / Patient / By / Category / Date.

### Intake (`upload/`)

- `UploadDocumentDrawer`, driven by `hccUploadSession` phases: chooser → sftp | single (manual) | picker (multi-file, `queueHccDocumentForOcr`) → processing (can minimize) → review (per-field confidence, filters all/error/mismatched/ready, `confirmHccUpload({ acceptedIdxs })`).
- `mockOcr.js`: deterministic demo OCR by filename (demo-single, multi-patient, missing-dos, dob-mismatch).
- `HccSftpReviewDrawer`: batch review with document preview, confidence pills that jump to the cited page.
- `HccUploadProgressRibbon` (top of worklist) and `HccUploadProcessingHost` (floating card while minimized).
- `IcdCreationScreen`: mounted, but `openIcdCreation` has no caller outside the store.

### HCC outside `src/features/hcc`

- Patient profile: `DiagnosisGapsTable.jsx` (groups open ICDs by HCC).
- Care programs: `ProgramDiagnosisGapsTable.jsx` (AWV/APE "Open Diagnosis Gaps" step).
- Analytics: `features/analytics/views/RiskView.jsx` (RAF trend, practice, HCC performance, recapture, categories, suspects; CMS HCC V28).
- Settings → Member Leads: "HCC Team" types Coder / QA / Compliance (`teamTypeConfig.js`), used to rank bulk-assign candidates.
- All Patients merges `hccMembers` as `source: 'hcc'` rows. Shared `components/HistoryTimeline`, `components/IcdSearch` + `api/icd-search.js` (WHO ICD-11 via server proxy → `icd_codes` cache → offline catalog).

---

## 9. Spec vs code: known gaps

| Topic | Spec / docs say | Code does |
|---|---|---|
| Default worklist sort | Created Date **descending** (`hcc-coding-workflow.md`, `hcc-worklist.mdx`) | Created Date **ascending**, oldest first (`useHccWorklistTable.js:241`) |
| QA sampling | QA reviews a configured sampling %; Compliance random-pulls incl. QA-skipped records | `sampledForReviewer2` is never called; every QA completion goes to Compliance. No random-pull logic. |
| Reviewer 3 | Pipeline lists Reviewer 1, QA (Reviewer 2), Compliance (Reviewer 3) | Four engine roles only; QA = `reviewer`, Compliance = `reviewer2`. `reviewer3_*` DB columns are unused. |
| Compliance view-only while downstream in progress | Required | Not found as a distinct rule; general stage locks apply |
| Accept/dismiss persistence | Coding workflow doc says "optimistic, server round-trip future work" | Now persisted fire-and-forget to `hcc_diagnosis_gaps` and `hcc_gap_dos_actions` |
| Missing migrations | Code comments cite `hcc_documents_migration.sql`, `hcc_diag_comment_scope_migration.sql`, `hcc_diag_comment_status_migration.sql`, `hcc_schema_v2_types_and_normalization.sql`, `patient_id_unification_migration.sql` | None exist in `supabase/` |
| `hcc_diagnosis_gaps` upsert | `backfillMockNotLinkedGaps` upserts `onConflict: 'member_name,code'` (`useAppStore.js:8149`) | No such UNIQUE constraint in repo SQL |
| `worklist_badge_counts` | Old migration reads `hcc_members_v2` | View dropped; recreated in `drop_hcc_members_v2_view_migration.sql` |
| `addedChartToRow` | `hcc_added_charts.visit_type` exists | Mapper never writes it |
| Row ⋯ menu | Call, Chat, SMS, Video, Email, Task, Automation, Edit, Comms Preference | Only Make a Call and Edit Details are wired |

Still open from the Astrana plan (not built, needs product/backend decisions): worklist status column as a stepper vs removal; worklist / Single View grouping parity; nightly auto-add confirmation with Astrana; Missed → ASM backend wiring; configurable QA sampling %; Compliance random pull; role-based login personas.

---

## 10. Working rules for HCC changes

- Status display goes through `statusSpec.js`; role labels through `hccTransitionLabels.js` / `reviewedBy.js`. Never hard-code "Returned" or "Reviewer 2" in user-facing copy.
- Pipeline changes belong in `assignment/lifecycle.js` (pure) and are dispatched through `transitionHccDos`. Don't mutate `hccDosAssignments` directly.
- Every HCC mutation should log via `logHccActivity` with an event in `activityLog.js` `EVENTS`.
- Persist writes are fire-and-forget; never block optimistic UI on them. Assignment changes (`hccReassignRole`, `hccSetRoleStatus`) are the exception and roll back on error.
- New data shown in the UI must be backed by Supabase with a migration + seed (ask Alok Kumar to run it).
- Filters use the shared `FilterChip`; drawers use the shared `Drawer` (see `CLAUDE.md`).
