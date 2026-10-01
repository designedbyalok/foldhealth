# Care Program: Complete Context

One file with everything needed to work on Care Programs: the domain, the program catalog and steps, statuses, the care plan (GBI: goals, barriers, interventions), the Supabase data model, store state, UI surfaces, touchpoints across the app, and known gaps between spec and code. Built from the existing docs and a read of the source on 2026-09-30.

Companion docs:

- `docs/features/p360.md` section 6: Care Management and programs inside the patient profile
- `docs/features/ccm-worklist.mdx`, `snp-worklist.mdx`, `tcm-worklist.mdx`, `awv-worklist.mdx`: worklists that deep-link into programs
- `docs/features/patient-profile.mdx`: user-facing profile doc (partly stale, see section 11)

Paths are relative to `src/` unless they start with `supabase/`, `scripts/` or `docs/`. Abbreviations: **Store** = `store/useAppStore.js`, **CPT** = `features/patient/right-panel/tabs/care-programs`, **PD** = `CPT/program-detail`, **CP** = `CPT/care-plan`, **CM** = `features/patient/right-panel/tabs/care-management`. Line numbers were accurate at the time of writing and will drift.

---

## 1. Domain

A **care program** is a per-patient enrollment in a structured care workflow (SNP, AWV, TOC, disease management, etc.). Each enrollment has an ordered list of **steps** (outreach, assessments, care plan, appointments, med recon, tasks, files). Completing steps drives the program's **progress**. Most programs carry a **care plan** made of Goals, Barriers and Interventions (GBI), which can be seeded from templates in the **Care Plan Library** (Settings).

| Term | Meaning |
|---|---|
| Enrollment | One row in `patient_care_programs`. Id `pcp-<patientId>-<CODE>` (SNP: `pcp-<pid>-SNP-<n>`). |
| Code | Program type key: `SNP`, `AWV`, `TOC IP`, `TOC ED`, `DM`, `HICM`, `WLCP`, `CMP`, `APE` (catalog), plus `CCM` (steps only). |
| Trigger | Ordinal of an enrollment among same-code rows by `created_at`. Only SNP can have more than one. Not stored; derived in Store:1517-1521. |
| URL key | Code slug plus trigger, e.g. `snp-2` (`CPT/CareProgramsTab/CareProgramsTab.utils.js:6-9`). |
| Step | Entry in `PROGRAM_STEPS[code]`. Can be mandatory (`*`), an alert, or a section grouping child steps. |
| Care plan | `patient_care_plans` row keyed `(patient_id, program_id)`, holding goals, interventions, barriers. |
| GBI | Goals, Barriers, Interventions. |
| Template | Library bundle of goals, interventions and barriers applied to a patient plan. |
| Sign | Snapshots the plan to a new version and stamps `signed_by`/`signed_at`. |
| Comprehensive Care Plan | Cross-program roll-up view of all of a patient's plans. |

---

## 2. Catalog and steps

**Enrollable catalog** (`features/patient/data/careProgramCatalog.js:7-17`): SNP Care Program, Annual Wellness Visit, Transition of Care - IP, Transition of Care - ED, Disease Management, High Intensity Care Management, Weight Loss Care Program, Care Management Program, Annual Physical Exam.

**CCM, TCM, APCM, HIU are not in the catalog.** CCM has a step list but can only exist via pre-existing DB rows.

**Step lists** live in `PROGRAM_STEPS` (`features/patient/data/programActivityMock.js:446-457`). `stepsFor()` falls back to SNP for unknown codes (`PD/ProgramDetailView/ProgramDetailView.utils.js:20`). `*` = mandatory, `[ ]` = section.

| Code | Steps (file lines) |
|---|---|
| SNP (254-280) | Outreach; Letters*; [Program Directives: Pre-visit*, HRA (alert), BRCSI Assessment, SNP Assessment*]; [Model of Care: Care Plan*]; ICT Appointment*; Post Visit Checklist*; Open Care Gaps; Medication Reconciliation; Program Related Task; Program Related Files*; Referral Review* |
| CCM (285-297) | Outreach; [Assess Patient: Overview, Health Management]; Medication Review; Care Plan Details; Billing Review (`kind:'billing'`, alert). Opens on `ccm-billing` by default (`useProgramDetailView.js:37`). |
| AWV (304-321) | Program Documents; Letters; Outreach*; [Program Directives: Pre-Visit*, HRA*, PHQ-9*, Post-Visit*]; Care Gaps; Open Diagnosis Gaps*; Appointment*; Referral Review; Program Related Task |
| TOC IP (323-339) | Outreach; Program Documents; Letters; [Snapshot*, Post IP Assessment*, Post-Visit*]; Appointment*; Open Care Gaps; Medication Review; Program Related Task; Referral Review |
| TOC ED (341-356) | Snapshot*; Documents; Letters; Outreach*; [Assessments: Post ED Assessment*, Post-Visit*]; Care Plan; Open Care Gaps; Medication Review; Task |
| DM (358-374) | Snapshot*; Documents; Letters*; Outreach*; [CHF, COPD, Kidney Assessment, Post-Visit*]; Care Plan; Open Care Gaps; Task |
| HICM (376-395) | Snapshot*; Documents; Letters*; Outreach*; [HICM, High ER Utilizer, High Admitter, FollowUp Assessment, Graduation Checklist, Post-Visit, all *]; Care Plan; Open Care Gaps; Medication Review; Task |
| WLCP (397-410) | Outreach*; [Physician Certification, Participation Questionnaire, WLP Checklist*]; Appointment; Medication Review; Referral Review; Care Plan*; Documents |
| CMP (412-423) | Snapshot; Documents; Letters; Outreach*; Assessments (empty section); Care Plan; ICT Appointment; Open Care Gaps; Medication Review; Task |
| APE (427-435) | Outreach*; Documents; Letters; Appointment*; Open Care Gaps; Open Diagnosis Gaps*; Task (placeholder list) |

---

## 3. Statuses and progress

### Program status (`features/patient/data/programStatus.js`)

- Dropdown options (`PROGRAM_STATUS_OPTIONS`, line 4): `Engaged`, `Declined`, `Unable to Reach`, `Enrolled`, `Attempted`.
- `STATUS_COLOR` also defines `New` and `Closed`.
- New enrollments start at `New` (Store:1548).
- Picking `Enrolled` backfills `startDate` when it is `'—'` (`CareProgramsTab.jsx:167-173`, `useProgramDetailView.js:213-221`).
- "Close Program" sets `Closed` (`CareProgramsTab.jsx:183-185`). There is no unenroll/delete.
- `Completed` is checked for "Past" grouping (`CareProgramsTab.jsx:31`) but nothing in the UI can set it.
- Only SNP can be enrolled more than once (Store:1540-1543).

### Step status (`PD/ProgramDetailView/stepStatus.js`)

Values: `pending`, `in_progress`, `completed`, `skipped`. `fromRecords()` (22-49) derives status from real data, **matching on step name**:

| Step name | Completed when | In progress when |
|---|---|---|
| `Care Plan` (exact) | plan `signedAt` set | any goal or intervention exists |
| Program Related Task | all tasks done | some tasks open |
| Files / Documents | any document | |
| Med Recon / Review | `program.medReconSignedAt` set | |
| any "appointment" | a done appointment (ICT steps: ICT only) | an open appointment |

Precedence (`deriveStepStatus`, 56-63): records-completed, then manual completed/skipped, then records in-progress, then pending.

Manual status comes from **Mark as Reviewed** and **Skip / Undo Skip** in `ProgramDetailViewContentHeader.jsx:83-100` (Skip hidden on mandatory steps; Reviewed disabled when records already complete it). Persisted via `setProgramStepStatus` (Store:6657-6689) into `care_program_step_status` through `store/lib/careProgramStepStatusPersist.js`: upsert on `(patient_program_id, step_id)`, `null` deletes the row, missing table falls back to session-only.

**Progress** = (completed + skipped) / all steps x 100 (66-70). The detail hook writes it back with `updateCareProgram` (`useProgramDetailView.js:201-205`).

---

## 4. Supabase data model (`supabase/`)

No DB triggers exist on any of these tables. All cross-table sync is in app code or one-shot backfills.

### Programs

| Table | Key columns | Notes |
|---|---|---|
| `patient_care_programs` | id text PK, patient_id, code, name, acuity, status (default `New`), status_color, start_date, end_date, last_updated, assignee, pcp, progress `numeric(4,3)`, created_at; plus `med_recon_signed_by/role/at` | Created out-of-band in prod; only committed creator is `aaa_bootstrap_missing_tables_migration.sql:1159-1175`. **UNIQUE(patient_id, code)** at :1867. Dates are MM/DD/YYYY text. Sign-off cols: `patient_care_programs_med_recon_signoff_migration.sql`. RLS: authenticated (`narrow_public_policies_to_authenticated.sql:106`). |
| `care_program_step_status` | PK(patient_program_id, step_id), step_name, status CHECK in (`completed`,`skipped`), updated_by, updated_at | No row = not started. No FK to programs. |
| `patient_program_activity` | id uuid, patient_id, program_code, program_name, occurred_at, actor_name/initials, title, status_label, status_type, activity_kind | Index (patient_id, occurred_at desc). Seed covers `snpw-001` only. |
| `program_documents` | id text PK, program_code, patient_id, name, type, status, size_bytes, updated_by, updated_date, file_url, storage_path, ext | Write RLS requires an Active `profiles` row. Storage bucket `program-documents` must be created by hand. |
| `tasks` (extension) | `program_code`, `patient_id` | `tasks_program_link_migration.sql`. Links by code, not enrollment id. |

Migrations that rewrite enrollment rows: `snp_worklist_care_program_sync_migration.sql`, `worklist_seed_dupes_cleanup_migration.sql`, `patient_reident_member_id_migration.sql`, and the identity-merge migrations (`duplicate_name_*`, `awv_jsa_*`, `annette_brave_*`).

### Patient care plan

| Table | Notes |
|---|---|
| `patient_care_plans` | id uuid, patient_id, program_id (= enrollment id, **no FK**), program_code, conditions text[], condition_total, `applied_template_ids uuid[]` (GIN), `applied_template_priorities jsonb`, `signed_by`, `signed_at`. UNIQUE(patient_id, program_id). |
| `patient_care_plan_goals` | FK plan CASCADE. Mirrors library goal fields plus current_value, trend, status (default `Not Started`), progress, sort_order, updated_by. |
| `patient_care_plan_interventions` | plan CASCADE, goal_id SET NULL. kind, title, config jsonb, assignee, status, adherence, priority, updated_by, `task_id` FK to tasks (backfilled from `config.taskId`). |
| `patient_care_plan_barriers` | plan CASCADE, legacy goal_id SET NULL. title, description, status, priority. |
| `patient_care_plan_barrier_goals` | M:N join PK(barrier_id, goal_id). FK was first pointed at library `care_plan_goals` (every insert failed 23503); fixed by `fix_barrier_goals_fk_target.sql`. |
| `patient_care_plan_goal_measurements` | Goal CASCADE. Feeds Trends drawer. |
| `patient_care_plan_automations` | plan CASCADE, goal SET NULL. |
| `patient_care_plan_versions` | snapshot jsonb, reason, note. UNIQUE(plan_id, version_number). |
| `patient_care_plan_summaries` | PK patient_id. AI recap jsonb. |
| `care_plan_audit` | Append-only: entity_type, entity_id, action, summary, detail, actor. Notes are rows with `action='note'`. |
| `care_plan_links` | Links plan items to tasks/appointments. UNIQUE(owner_id, entity_type, entity_id). |
| `care_plan_shares` | target (EHR/Patient/POA), format, goal_ids, intervention_ids. |

### Care Plan Library

`care_plan_goals`, `care_plan_barriers`, `care_plan_templates` (goals/interventions/barriers stored as jsonb copies; `status` CHECK `draft`/`published`), `care_plan_interventions` (FK goal CASCADE; also holds `kind='barrier'` rows), `care_plan_intervention_templates`, `care_plan_template_favorites` (PK user_id, template_id). All care-plan tables use "Staff manage X" RLS (`auth.uid() is not null`). `tune_autovacuum_care_plan_tables.sql` tunes vacuum for churn.

---

## 5. Store state and actions

### Navigation (Store:734-816, mirrored to the URL hash)

State: `careManagementTab`, `selectedCareProgramKey`, `careProgramStep`, `carePlanSummaryOpen`, `pendingCareProgramCode`.
Actions: `openCareProgram`, `closeCareProgram`, `setCareProgramStep`, `setCarePlanSummaryOpen`, `setCareManagementTab`, `clearPendingCareProgramCode`, `navigateToPatient(id, {profileTab, programCode})` (750-773), `setPatientProfileTab` (780-794). Both rewrite the `'Care Programs'` tab alias to Care Management + Care Programs sub-tab.

### Programs

- `careProgramsByPatient`, `careProgramsLoadedFor` (1226).
- `fetchCareProgramsForPatient` (1491): reads `patient_care_programs`, derives `trigger`.
- `addCareProgram` (1528): optimistic, upsert `onConflict 'patient_id, code', ignoreDuplicates` (1584-1611), logs activity, calls `ensureSnpWorklistMembership` for SNP.
- `updateCareProgram` (3471): optimistic, stamps lastUpdated, upsert on id, mirrors SNP status/assignee to `snpWorklistMembers`, logs status changes.

### Activity, steps, documents

- `fetchPatientProgramActivity` (1410), `logProgramActivity` (1444: optimistic prepend if loaded, fire-and-forget insert).
- `programStepStatus`, `fetchProgramStepStatus`, `setProgramStepStatus` (6657-6685).
- `fetchProgramDocuments` (3594), `addProgramDocument` (3628), `updateProgramDocument` (3643), `removeProgramDocument` (3648); persistence in `store/lib/documentUploadPersist.js:38-110`.
- Session-only: `programAddedTasks`, `programAddedAppointments` (3547), `medReconChecks` (3463), `viewedNewMedIds` (1622).

### Patient care plan (keyed by `carePlanKey(patientId, programId)`, `store/lib/carePlanStoreLib.js:414`)

| Area | Actions (Store line) |
|---|---|
| Load | `fetchPatientCarePlan` (1719), `ensurePatientCarePlan` (1793), `fetchAllPatientCarePlans` (2561) |
| Reconcile (once per plan) | `syncAppliedCarePlanTemplates` (1910, audit suppressed), `repairCarePlanGoalLinks` (1950) |
| Header | `touchCarePlanModified` (2058), `savePatientCarePlanConditions` (2079) |
| Duplicates | `refreshCarePlanDuplicates` (2116), `dismissCarePlanDuplicate` (2192) |
| Goals | `savePatientCarePlanGoal` (2204), `deletePatientCarePlanGoal` (2254), `saveGoalMeasurement` (2324), `deleteGoalMeasurement` (2354), `patchGoalDisplayFromMeasurements` (2279) |
| Interventions | `savePatientCarePlanIntervention` (2400), `deletePatientCarePlanIntervention` (2534, also deletes paired task), `recomputeGoalProgressForPlan` (2498) |
| Barriers | `savePatientCarePlanBarrier` (1823, join diff), `deletePatientCarePlanBarrier` (1892) |
| Automations | `saveCarePlanAutomation` (2365), `deleteCarePlanAutomation` (2392) |
| Templates | `applyPatientCarePlanTemplates` (2671) via `applyTemplateToPlan` (`carePlanStoreLib.js:599-660`), `setPatientCarePlanAppliedTemplates` (2622), `savePatientCarePlanAsTemplate` (2609) |
| Sign / versions | `signCarePlan` (2895), `snapshotCarePlanVersion` (2868), `fetchCarePlanVersions` (2830), `restoreCarePlanVersion` (3082), `requestCarePlanReview` (2976) |
| Audit / notes | `logCarePlanAudit` (2781), `fetchCarePlanAudit` (2811), `add/update/deleteCarePlanNote` (3038-3079) |
| Links / share / report | `fetch/add/removeCarePlanLink` (3122-3168), `sharePatientCarePlan` (2730), `fetchCarePlanReport` (3177) |
| AI summary | `fetch/save/deletePatientCarePlanSummary` (1664-1717) |
| UI request flags | `carePlanShareRequest`, `carePlanPanelRequest`, `carePlanBulkMode` (2712-2726) |

Write pattern: deletes are optimistic with rollback; saves wait for the DB then update state; goal progress recompute and step status are optimistic.

### Care Plan Library (Store:3201-3458)

`carePlanTemplates`, `carePlanGoals`, `carePlanBarriers`, `carePlanInterventionTemplates`, `carePlanFavorites`; `fetchCarePlanLibrary` (3261), `toggleCarePlanFavorite` (optimistic), `save/deleteCarePlan{Goal,Barrier,Template,InterventionTemplate}`, `saveCarePlanTemplate` (3414), `setCarePlanCreateOpen`, `setCarePlanTemplateScreen`. Row mappers in `carePlanStoreLib.js`.

---

## 6. UI: Care Management and the Care Programs tab

### Routing

- Deep URL: `#/population/<list>/patient/<memberId>/care-management/<sub-tab>/<program>/<step>` (`lib/router.js:41`).
- Care Management sub-tabs: **Care Programs | Comprehensive Care Plan | Program Activity Log** (`:48`). Care Programs was folded into Care Management on 2026-09-03 (#347).
- Legacy `…/care-programs/<prog>/<step>` and `…/summary` still resolve (`:53-78`). State to URL: `patientSubSegments` (`:92-104`).
- Deep-link consumer `CareProgramsTab.jsx:101-116`: if enrolled, open it; else look up the code in `CARE_PROGRAM_CATALOG` and auto-enroll; unknown codes do nothing.

### CareProgramsTab (`CPT/CareProgramsTab/`)

- **Toolbar** (`CM/CareManagementToolbar`): search, sub-tabs, **New Program** (a `SearchListPopover` over the catalog; codes already enrolled are disabled except SNP; `CareProgramsTab.jsx:118-126, 272-296`), filter toggle. Enroll shows a 700 ms skeleton then opens step 1.
- **Filters** (`CP_FILTERS`): Assigned to, Care Program, Status, Sub-Status, Start Date, End Date, Clear All.
- **Table** (`CareProgramsTabTable.jsx:14-24`, on `WorklistShell`): checkbox, Program Name (`ProgramStatusRing` + "Acuity : x"), Status dropdown, Start, End, Last Updated, Assignee (`AssigneeChange`), PCP, row menu (Assign to, Print Summary, Close Program).
- Sections: **Active Care Programs** and collapsed **Past Care Programs** (Completed/Closed).
- Empty states: `RingEmptyState` "No Active Programs"; "No active care programs." inside the Active section.

### ProgramDetailView (`PD/ProgramDetailView/`)

- **Header** (`ProgramDetailViewHeader.jsx`): status ring, name, status dropdown, assignee picker, SNP "Trigger N" arrows, expand panel (hardcoded, `ProgramDetailViewParts.jsx:77-131`), CCM-only hardcoded BHI/APCM badges and info bar, badges for the patient's other active programs, row menu (no handler), Close.
- **Left rail**: `StepItem` with status icon plus red dot for mandatory/alert; collapsible `SectionHeader`.
- **Content routing** (`ProgramDetailView.jsx:55-115`, flags `useProgramDetailView.js:251-264`):

| Step | Component | Data |
|---|---|---|
| Billing (CCM) | `CcmBillingReview`, `CcmBillingLogTable`, `CcmBillingReportDrawer` | `ccm_billing_periods`, `ccm_billable_activities`, `ccm_billing_reports` |
| Outreach | left-panel `OutreachTab`, program-scoped | outreach logs |
| Pre-visit | `PreVisitStep` | mock `preVisitForProgram()` |
| `Care Plan` (exact) | `CarePlanView` | section 7 |
| any appointment | `AppointmentStep` (Schedule via `ScheduleDrawer`; "Link Appointments" is a toast) | session `programAddedAppointments` |
| Open Care Gaps | `OpenCareGaps` | mock `CARE_GAP_SECTIONS_EXTENDED` |
| Med Recon / Review | `MedicationReconciliation` (PDF parsing via pdf.js/Tesseract; Surescripts is a toast) | `patient_medications` |
| Program Related Task | `ProgramRelatedTasks` + `AddTaskDrawer` | `tasks` filtered by program_code/patient_id + session tasks |
| Files / Documents | `ProgramRelatedFiles` (Program Related / All Documents, upload, preview) | `program_documents` |
| Referral Review | `ReferralReview` | mock `REFERRAL_REVIEW_MOCK` |
| assessment steps | `AssessmentFormView` via `fetchFormByName` (`forms`); checklists use `PostVisitChecklist` | hardcoded bylines |
| Letters | `ProgramDetailViewLetters` + Send/Add/History/Preview drawers | `letters`, fallback `PROGRAM_LETTERS_MOCK` |
| Open Diagnosis Gaps | `ProgramDiagnosisGapsTable` | open ICDs by HCC |
| anything else | `StepPlaceholder` "This step is coming soon." | |

- **Med recon sign-off** (`ProgramDetailViewContentHeader.jsx:242-258, 449-483`): Sign (Self), Sign (NP), Send for Sign Off. Gated on every `MED_RECON_MOCK.checklist` box in session `medReconChecks`. Sign writes `med_recon_signed_*`; Send for Sign Off uses `SelectAssigneeModal` then `createTask`.
- **Care Plan step header**: bulk toggle, Preview, Template, Sign (direct `signCarePlan` or review via `requestCarePlanReview`), More (Save as Template, Add Note, History). Sign gated by `carePlanSignShareEnabled` (`CP/lib/carePlanSignState.js:27-31`).

### Program Activity Log (`CM/`)

Events grouped month, then day, then program (`programActivity.js:49-116`), rendered with `ProgramActivityCard` / `TimelineItem`.

---

## 7. Care plan UI (`CP/`)

- **`CarePlanView`** (data via `useCarePlanViewData`, key `${patientId}::${program.id}`): condition chips; Goals, Interventions, Barriers tables; linked-item hover preview (`CarePlanLinkedPreview`); duplicate banners (`DuplicateFlag/*`); bulk actions; `AppliedTemplateStrip` (High, Medium, Low order; click filters tables).
- **Vocabulary** (`CarePlanViewSections.jsx:7-9`): statuses Not Started, In Progress, On Hold, Met, Not Met; priorities High, Medium, Low. Intervention types (`lib/carePlanInterventionMenu.js:2-9`): Send Form, Patient Education, Patient Task, Measure Vital, Internal Task.
- **Drawers**: GoalPreview, InterventionPreview, BarrierDetail, LinkGoalToBarrier, LinkItemsToGoal, ApplyTemplates (per-template priority), TemplatePreview, Link (tasks/appointments), RemoveGoalDialog (cascade via `lib/carePlanGoalCascade.js`), History, Versions, VersionChanges, Trends, Share (PDF preview, targets EHR/Patient/POA, `lib/carePlanShareFilters.js`, `generateCarePlanPdf.js`, `carePlanExport.js`).
- **Signing**: `signCarePlan` snapshots to `patient_care_plan_versions` (version + 1), stamps `signed_by/at`, sets the SNP worklist row to `Signed`, writes audit "Signed (vN)". `lib/carePlanVersions.js` groups audit rows into versions by `signed` events.
- **Review**: `requestCarePlanReview` writes a `review_requested` audit row and creates a task due in 3 days.
- **Share**: `sharePatientCarePlan` inserts `care_plan_shares`, audits, logs program activity.
- **Comprehensive Care Plan** (`summary/CarePlanSummaryView`): Active Programs Summary (Plan, Conditions/Focus, Started-Ends, PCM, PCP, Last Reviewed, Activity Since Review, Actions), then cross-program GBI. **Summarize** calls `POST /api/care-plan-summary` (Gemini proxy) and saves to `patient_care_plan_summaries`. Row click opens the program at its care plan step (`CareManagementView.jsx:344-354`). Download is CSV (`summary/carePlanSnapshot.js:146`).
- **Report**: `CarePlanReportView` reads `care_plan_shares` + `care_plan_audit` (currently unreachable, see section 11).

### Applying templates

`CarePlanView.jsx:271,549` calls `applyPatientCarePlanTemplates`, which runs `applyTemplateToPlan` (`carePlanStoreLib.js:599-660`): goals first, then interventions (linked to the first owning goal), then barriers (linked to many goals). **Everything dedupes by title.** Template ids go into `applied_template_ids` / `applied_template_priorities`. Plan rows have **no template_id**; the link back is by title (`carePlanStoreLib.js:427-429`). `syncAppliedCarePlanTemplates` re-applies on load. Condition-based recommendations: `lib/conditionRecommendations.js` (`recommendedGoalIds` in `AddGoalsDrawer.jsx:123`, `recommendedTemplateMatches` in `ApplyTemplatesDrawer.jsx:153`).

---

## 8. Care Plan Library (Settings)

- Nav: `settingsNavItems.js:13`. Routes `#/settings/care-plan-library/{template|goals|interventions|barriers|drafts|create}` (`lib/router.js:210-213, 326, 468-472`).
- Panel tabs: Plan Template, Goals, Interventions, Barriers, Draft Templates (`panel/CarePlanLibraryPanel/CarePlanLibraryPanel.jsx:29-35`).
- `CarePlanTemplateView` and `CarePlanCreateView` take over Settings (`SettingsLayout.jsx:41-112`) and hide the TopBar (`AppLayout.jsx:201-207`). Draft save switches to Drafts tab.
- Limits: name 100, titles 150 (`lib/carePlanLimits.js`).
- Favorites reset on auth change (`App.jsx:95-121`).
- Seeds: `features/settings/care-plan-library/data/*Seed.js` (about 7.4k lines templates, 5.8k goals, 1.2k interventions, plus barriers). Generated by `scripts/genCarePlanTemplates.mjs`; priorities by `scripts/applyCarePlanLibraryPriorities.mjs` + `carePlanPriorityRules.mjs`; upserted by `scripts/seed.js:1018-1080`. Do not hand-edit the seed files.

Other SQL seeds: `snp_care_plan_template_seed.sql`, `snp_sample_care_plan_links_seed.sql` (snpw-001 GBI), `annette_realistic_care_plans_migration.sql` (patient 11089, five programs), `patient_program_activity_seed.sql`. Nothing seeds `patient_care_programs` directly except the SNP backfill and identity merges.

---

## 9. Sync with worklists and tasks

- **SNP (two-way)**
  - Program to worklist: `addCareProgram` calls `ensureSnpWorklistMembership` (Store:5993); `updateCareProgram` mirrors status/assignee (3493); `signCarePlan` sets carePlanStatus (2918).
  - Worklist to program: `fetchSnpWorklistMembers` (5879) runs `projectSnpProgramState` (`worklistPersist.js:175`), overlaying latest SNP program status/assignee, plan state (`Signed`/`Draft`/`No Care Plan`), task count. `setSnpProgramSubStatus` / `setSnpAssignee` (5936, 5955) write through `writeSnpProgramField` (`worklistPersist.js:234`).
  - Backfill: `snp_worklist_care_program_sync_migration.sql`.
- **Tasks**: program tasks are `tasks` rows tagged program_code/patient_id (`ProgramDetailView.jsx:253`, filtered in `useProgramDetailView.js:185`, `ProgramRelatedTasks.jsx:41`). `createTask` bumps SNP taskCount (14238). Task status/title changes call `reconcileInterventionFromTask` (14629, completed maps to Met). Deleting an intervention deletes its task. Add Task triggers: Program Start Date, Discharge Date, Care Plan Signed (default) (`AddTaskDrawerBody.jsx:16,22`, `useAddTaskDrawer.js:25-29,89`).
- **CCM, TCM, TOC, AWV**: no sync. None of these worklists enroll a program or read `patient_care_programs`.

---

## 10. Touchpoints outside the program tab

| Where | What | Navigation |
|---|---|---|
| CCM worklist (`ccm-worklist/CcmWorklistRow.jsx:147-149, 176-215`) | Read-only Care Plan Status; "Open Care Program" | `programCode:'CCM'` |
| CCM billing drawer (`CcmBillingReviewDrawer.jsx:16-37`) | "View in Care Plan"; reuses `CcmBillingReview` | opens P360 Overview only (gap) |
| SNP worklist (`snp-worklist/SnpWorklistRow.jsx:163-168, 300-321, 392`) | Care Plan Status (filter/sort); View Program | `programCode:'SNP'` |
| AWV worklist (`awv-worklist/AwvWorklistTable.jsx:181-187`) | View | `'APE'` or `'AWV'` |
| TOC/TCM (`toc/tocColumns.jsx:134,479-489`, `queue/QueueRow.jsx:390-458`) | Care Plan Status badge (Updated / Pending / No Care Plan) | Quick View only, no program link |
| APCM (`apcm-billing/data/mock.js:70+`) | mock `programId` only | none |
| HEDIS DSF (`hedis-worklist/dsf/dsfCarePlans.js:67-74`) | Static "Care Plan - PHQ" text blocks, unrelated to GBI | none |
| P360 banner (`PatientP360Banner.jsx:64-83`, `PatientP360BannerExpanded.jsx`) | "Programs:" badges from real enrollments, dedup by code, +N overflow | none |
| Overview tab (`OverviewTab.jsx:118-158, 230-236`) | Active Care Programs table; static Care Plan Recommendations | row opens program; "+" and "View all" go to the list |
| Monitoring rail (`MonitoringRailGoals.jsx:18-83`, `MonitoringTab.jsx:195-198`) | Goals across active programs, priority/status editable inline | "Open care plan" goes to Comprehensive Care Plan |
| Hover card (`components/PatientHoverCard/PatientHoverCard.jsx:127-128`) | Care Program Eligibility (random mock, `lib/patientSnapshot.js:98`) | none |
| All Patients (`AllPatientsRow.jsx:161-165`) | one "Active Care Program" badge, randomly filled when empty | none |
| Analytics (`analyticsData.js:15-17,105`, `CareView.jsx`, `ExecutiveView.jsx:47-111`) | Hardcoded funnel/KPIs; Executive "Care Program Command Center" from `exec_care_programs` | "Full Program View" is a toast |
| Member/Leads (`settings/member-leads/teamTypeConfig.js:11-42`) | Care Program Team types SNP, AWV, CCM, TCM, ECM, CBP, MRP (TIN-routed); seeded SNP Team, TOC Team (Store:10328-10337) | |
| Member Consent (`forms/builder/memberConsent.js:7-30`) | Program consent items CCM, APCM, BHI | |
| Campaigns (`campaign/audienceResolver.js:24`) | selects `patients.active_care_program` | |
| Embedded components (`data/embeddedComponents.js:62,314,336-378`) | rule text, "Care Plan Recommendation" widget, mock patient programs | |

---

## 11. Spec vs code: known gaps

**Correctness / data integrity**

1. **SNP re-enrollment silently lost.** Ids `-SNP-2`, `-SNP-3` collide with UNIQUE(patient_id, code); `ignoreDuplicates` (Store:1609) drops them. Trigger 2+ exists only in the browser until reload.
2. **Id mismatch.** Seed rows use ids like `pcp-awv-1-AWV`; the client mints `pcp-{patientId}-{code}`. An auto-enroll via `pendingCareProgramCode` before the fetch lands creates a phantom id, and plans/step status written against it are orphaned (see 23505 note in `fix_barrier_goals_fk_target.sql:42`).
3. **Progress rewrite loop (inferred, not run).** `progress numeric(4,3)` rounds 0.3333 to 0.333; the strict `===` compare in `useProgramDetailView.js:202-205` likely rewrites the row and bumps `last_updated` on every open.
4. **`fetchAllPatientCarePlans` (2561)** loads a partial plan (no measurements, automations, barrier-goal join) but marks it loaded, so the full `fetchPatientCarePlan` never runs.
5. **Versions and templates drop barriers.** `snapshotCarePlanVersion` (2878) omits barriers/automations; `restoreCarePlanVersion` (3096) deletes goals (cascading joins and measurements) and never restores barriers; `savePatientCarePlanAsTemplate` (2617) drops barriers.
6. **Review tasks unlinked.** `requestCarePlanReview` calls `createTask` without program_code/patient_id, so the task vanishes from Program Related Tasks on reload.
7. **Program documents**: `fetchProgramDocuments` loads every row for every patient; `persistProgramDocumentUpdate` ignores `status`.
8. `reconcileInterventionFromTask` only updates plans already in memory.
9. Loose integrity: no FK from step status, care plans, audit or links to `patient_care_programs`; activity, documents and tasks link by code, so SNP triggers are indistinguishable; no CHECK on status/priority text.

**Product / UX**

10. **CCM care plan never renders.** The CCM step is `Care Plan Details`, but content and status match exactly `Care Plan` (`stepStatus.js:24`, `useProgramDetailView.js:255`). It shows the placeholder and never counts toward progress.
11. **CCM is not enrollable** (missing from `CARE_PROGRAM_CATALOG`); the CCM worklist deep-link only works for already-enrolled patients. TOC rows have no program deep-link at all.
12. `Completed` status is unreachable; no unenroll/delete.
13. Sub-Status, Start Date, End Date filters are not applied (`CareProgramsTab.jsx:198-209`); Activity Log filter chips are no-ops (`CareManagementView.jsx:272-274`).
14. Appointment step status reads real `appointments` but the list shows only session appointments. Task filter options come only from session tasks.
15. `CcmBillingReviewDrawer` "View in Care Plan" lands on Overview. Overview "+" does not open New Program.
16. Session-only state: `medReconChecks` (gates Sign), `viewedNewMedIds`, `programAddedAppointments`, `programAddedTasks`, `carePlanDuplicateDismissed`, letter Add. Toast-only: Send Letter, Add Care Note, Print Summary, Link Appointments, Sync Surescripts.
17. Hardcoded: header expand panel, CCM info bar and BHI/APCM badges, Pre-visit, Open Care Gaps, Referral Review, Post-visit checklist, assessment bylines, med-recon byline ("Last Reviewed by Robert Fox on 11/10/24").
18. Many steps are "coming soon": Snapshot, PHQ-9, CHF/COPD/Kidney, HICM assessments, WLCP assessments, Post ED Assessment, CCM Overview/Health Management.
19. `ProgramStatusRing` expects 0-100 but mock rows use fractions (0.75).
20. No shared source of truth for program codes: catalog (SNP, AWV, TOC, DM, HICM, WLCP, CMP, APE), team types (ECM, CBP, MRP, TCM) and consent (CCM, APCM, BHI) all differ. Hover card and All Patients use random mock programs that can contradict the banner.

**Dead code and stale docs**

21. `reportOpen` is never set, so `CarePlanReportView` is unreachable (`CareProgramsTab.jsx:68,238`). Unused: `matchesTab`, `CP_SUB_TABS`, `CARE_PROGRAMS_MOCK`, `APCM_PATIENT_SCENARIOS`, `programsForPatient`, `PROGRAM_ACTIVITY_BY_MONTH`. Header row-menu buttons have no handlers.
22. Stale comments: Store:1224-1225 claims a `programsForPatient()` fallback that does not exist; `updateCareProgram` comment sits at 1615 above unrelated state; `patient_care_plan_migration.sql:17` omits the SNP `-n` suffix; `CarePlanSummaryView.jsx:182` says "mock AI recap" but calls the real proxy.
23. `patient-profile.mdx:24,46-48` still describes Care Programs as a top-level tab and lists statuses that don't match p360.md. `all-patients.mdx:27,42` promises clickable per-list program chips. `snp-worklist.mdx:19` documents "Care Plan Reviewed", but code shows "Care Plan Status" (#395). No doc covered template application before this one.
24. Setup: `program-documents` storage bucket has no migration; `scripts/_run_react_doctor_rls_migration.mjs` has hardcoded `/Users/alokk/...` paths.

---

## 12. History (134 matching commits, 2026-04-03 to 2026-09-29)

- **Apr to Jun**: P360 overview and TAB_WIDGETS (04-03, 04-08); Care Team config in Member/Leads (06-01); first Care Programs tab with progress and detail view (06-16, `30358a3d`).
- **Jul**: CCM program, billing review, worklist, enrollments persisted to Supabase (07-28, `8f5ef419`, `da63f1a9`); SNP worklist plus Care Plan/Tasks views (07-29).
- **Aug 5 to 20**: step workflow with status, assignee, outreach (#113); deep-links for tabs, programs, steps (#183); TOC split from TCM (08-18); step tables on WorklistShell (08-20); Member Consent (08-21 to 08-24).
- **Aug 26 to 31**: Care Plan Library persistence (08-26); E0 to E6 epic (#298 to #310): data model, comprehensive view, interventions library, templates, preview/share/export, audit, versioning and sign-off, filters, reporting; SNP and AWV deep-links (08-28).
- **Sep 1 to 3**: 100 seeded goals and 50 templates; duplicate flagging; shared CarePlanSections; **Care Programs folded into Care Management** (#347).
- **Sep 8 to 17**: version history, sign-on-share, Active Programs Summary, draft templates, PDF share drawer, AI summary (#382), condition-based recommendations and favorites (#389 to #392), SNP columns synced to program data (#395), goal/intervention preview drawers.
- **Sep 21 to 29**: maintainability refactors (`saveGbiPatch`, extracted drawers/hooks); HEDIS DSF care-plan panels; hover card and program step status in worklists (`71f084a8`).

---

## 13. Working rules for Care Program changes

- Add a program: update both `CARE_PROGRAM_CATALOG` (enrollable) and `PROGRAM_STEPS` (steps). Missing either one breaks enroll or step rendering.
- Step behavior keys off **step names**; renaming a step (e.g. "Care Plan") changes content routing and status derivation. Prefer matching on step id when touching this.
- Any new persisted field needs a `supabase/*_migration.sql` plus seed; ask **Alok Kumar** to run it.
- Care plan saves wait for the DB; keep deletes optimistic with rollback to match existing actions.
- Link new program-scoped rows by enrollment id, not code, so SNP triggers stay distinct.
- UI work follows `fold-feature-builder`: shared `Drawer` (with `noCloseDivider` + `headerDivider` when `headerRight` has actions), `FilterChip`, Solar `*-linear` icons, Inter tokens.
