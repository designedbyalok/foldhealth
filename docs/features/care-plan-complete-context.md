# Care Plan: Complete Context

This file covers the patient care plan end to end:

- the lifecycle, from creation through editing, signing, review, versioning, sharing and roll-up
- goals, interventions and barriers (GBI) and how each one behaves
- templates and the Care Plan Library
- the Supabase schema, store actions and every UI surface
- touchpoints outside the editor
- known gaps between how the code is meant to work and how it does

It is built from a read of the source on 2026-10-01.

Companion docs:

- `docs/features/care-program-complete-context.md`: the program shell that hosts the plan (enrollment, steps, statuses, worklist sync). Its sections 4, 5, 7 and 8 summarize the care plan; this doc goes deeper and wins where they differ.
- `docs/features/p360.md` section 6: Care Management inside the patient profile.

**Path conventions**

Paths are relative to `src/` unless they start with `supabase/`, `scripts/`, `api/` or `docs/`.

| Abbreviation | Meaning |
|---|---|
| **S** | `store/useAppStore.js` |
| **L** | `store/lib/carePlanStoreLib.js` |
| **CP** | `features/patient/right-panel/tabs/care-programs/care-plan` |
| **HDR** | `features/patient/right-panel/tabs/care-programs/program-detail/ProgramDetailView/ProgramDetailViewContentHeader.jsx` |
| **CPL** | `features/settings/care-plan-library` |

Line numbers were accurate when this was written and will drift.

---

## 1. Domain and lifecycle

A **care plan** is one `patient_care_plans` row for a single program enrollment, keyed `(patient_id, program_id)`. `program_id` is the enrollment id, such as `pcp-<pid>-SNP-1`. The plan holds three kinds of item:

- **Goals**: measurable targets.
- **Interventions**: actions. Each one is linked to at most one goal.
- **Barriers**: obstacles. Each one can be linked to many goals.

The **Comprehensive Care Plan** is a read-and-edit roll-up of all of a patient's plans.

```
enroll program
  -> open "Care Plan" step                      (plan row does not exist yet)
  -> add goals / interventions / barriers, or apply templates
                                                (first write creates the plan: ensurePatientCarePlan)
  -> Draft
  -> Sign                                       (snapshot to versions, stamp signed_by/at, audit "Signed (vN)")
  -> Signed                                     (step = completed; SNP worklist = Signed)
  -> any edit after sign = "modified since sign": Sign re-enables, no visible label
  -> Send for Review                            (audit review_requested + task due in 3 days)
  -> Preview & Share                            (records a share row, then re-signs)
  -> History / Versions / Restore
```

| Term | Meaning |
|---|---|
| Plan key | `${patientId}::${programId}` (`L:414`). Cache: `patientCarePlans[key] = { plan, goals, interventions, barriers, measurements, automations }`. |
| GBI | Goals, Barriers, Interventions. |
| Template | A library bundle of goals, interventions and barriers applied to a plan. |
| Applied templates | `plan.applied_template_ids` plus `applied_template_priorities`. These only drive the badge strip; plan rows carry no template id. |
| Sign | Snapshot plus `signed_by` / `signed_at`. |
| Version | A `patient_care_plan_versions` row written on each sign. |
| Audit | `care_plan_audit`, one row per change. It feeds History, Versions changes, notes and Activity Since Review. |

---

## 2. Data model (`supabase/`)

**RLS.** Every table uses `FOR ALL TO authenticated USING ((select auth.uid()) is not null)`, with no anon access. `react_doctor_rls_forward_migration.sql:79-140` re-applies this. There are no DB triggers, so all sync happens in app code.

### Patient plan tables

| Table | Columns and notes | Migration |
|---|---|---|
| `patient_care_plans` | id uuid PK, patient_id, program_id (**no FK** to `patient_care_programs`), program_code, created_by, `conditions text[]`, condition_total, `applied_template_ids uuid[]` (GIN, no FK), `applied_template_priorities jsonb` (`{templateId: low/medium/high}`), signed_by text, signed_at, timestamps. UNIQUE(patient_id, program_id). | `patient_care_plan_migration.sql:36-47`, `patient_care_plan_applied_templates_migration.sql`, `care_plan_applied_template_priorities_migration.sql`, `care_plan_versioning_migration.sql:22-23` |
| `patient_care_plan_goals` | plan_id CASCADE; title, subtitle, icon, priority (default `medium`), category, measure, conditions[], comparator, target_value, target_value_2, custom_unit, set_target, duration, duration_unit, frequency, **target_date as text**, current_value, trend, status (default `Not Started`), progress int (no 0-100 CHECK), updated_by, sort_order | `patient_care_plan_migration.sql:49-74`, `patient_care_plan_goal_details_migration.sql:26-29` |
| `patient_care_plan_interventions` | plan_id CASCADE, goal_id SET NULL; kind, title, icon, duration, `config jsonb`, assignee_name/initials, status, adherence (text), priority, updated_by, `task_id int` FK to `tasks` SET NULL (backfilled from `config.taskId`), sort_order | `:76-92`, `..._intervention_priority_migration.sql`, `..._intervention_updated_by_migration.sql`, `care_plan_intervention_task_link_migration.sql:23-46` |
| `patient_care_plan_barriers` | plan_id CASCADE, legacy goal_id SET NULL (still written as the first linked goal); title, description, status, priority, sort_order | `patient_care_plan_barriers_migration.sql:19-30` |
| `patient_care_plan_barrier_goals` | PK(barrier_id, goal_id). The FK was first pointed at library `care_plan_goals`, so every insert failed with 23503; `fix_barrier_goals_fk_target.sql:68-92` re-points it at `patient_care_plan_goals`. The original migration also merged same-title barriers per plan. | `care_plan_barrier_goals_migration.sql` |
| `patient_care_plan_goal_measurements` | goal_id CASCADE; value, unit, favorable bool, taken_at, sort_order | `patient_care_plan_goal_details_migration.sql:31-40` |
| `patient_care_plan_automations` | plan_id CASCADE, goal_id SET NULL; title, icon (default `solar:bolt-linear`), enabled, sort_order | `:42-52` |
| `care_plan_links` | plan_id CASCADE; owner_type, owner_id, entity_type (task/appointment), entity_id, entity_label. UNIQUE(owner_id, entity_type, entity_id) | `care_plan_links_migration.sql:21-34` |
| `patient_care_plan_versions` | plan_id, patient_id, program_id, version_number, snapshot jsonb, reason (`signed`/`manual`/`restore`, but only `signed` is ever written), note, created_by. UNIQUE(plan_id, version_number) | `care_plan_versioning_migration.sql` |
| `care_plan_audit` | patient_id, program_id, program_code, entity_type, entity_id, action, summary, detail, actor, created_at. Described as append-only, but notes are hard-deleted (section 9). | `care_plan_audit_migration.sql` |
| `care_plan_shares` | target (ehr/patient/poa), format (always `standard`), note, goal_ids, intervention_ids (no barrier ids) | `care_plan_shares_migration.sql` |
| `patient_care_plan_summaries` | PK patient_id (no FK), summary jsonb, generated_by, generated_at | `patient_care_plan_summaries_migration.sql:21-27` |

### Library tables

| Table | Notes |
|---|---|
| `care_plan_goals` | title, description, category, measure, conditions[], comparator, target values, custom_unit, set_target, duration(+unit), frequency, target_date, priority, created_by/updated_by (`care_plan_library_migration.sql:41-62`) |
| `care_plan_interventions` | A library goal's **links**. goal_id CASCADE, kind, title, config. Barriers linked to a goal are also stored here with `kind='barrier'` (`:87-98`). |
| `care_plan_barriers` | title, description (`:64-72`) |
| `care_plan_intervention_templates` | Standalone reusable interventions: kind (default `internal-task`), title, description, config. Has **no created_by/updated_by**, yet the panel renders them. |
| `care_plan_templates` | name, conditions[], goals/interventions/barriers **jsonb copies**, status `draft`/`published` (default published, `care_plan_template_status_migration.sql`) |
| `care_plan_template_favorites` | PK(user_id, template_id CASCADE). Scoped to a user only by a client-side filter. |

**Template jsonb shape** (seed, `scripts/genCarePlanTemplates.mjs:148-158`):

- goals: `[{id: libraryGoalId, title, subtitle, category, priority}]`
- interventions: `[{id: linkRowId, kind, title, config:{priority}}]`
- barriers: `[{id: linkRowId, title, description, priority}]`

Writers disagree on this shape:

- `CarePlanCreateView` stores whole library goal objects.
- `CarePlanTemplateView` drops intervention `kind`.
- Save-as-template uses `g-<id>` / `i-<id>` ids and no barriers.

### Seeded data

| Source | Patient | What |
|---|---|---|
| `scripts/seed.js:1018-1080` | n/a | Library upsert: 14 legacy and 123 structured barriers, 130 intervention templates, 122 goals (591 links), 50 templates |
| `scripts/seed.js:1625-1700` | first `patients` row | One CCM plan from `CARE_PLAN_MOCK` |
| `annette_realistic_care_plans_migration.sql` | 11089 (Annette Brave) | Wipes all of 11089's plans, then applies templates to five programs: SNP (Diabetes + Hypertension), CCM (Complex Care), DM (COPD), WLCP (Weight), TOC IP (TOC). Backup goes to schema `annette_bak`. |
| `snp_sample_care_plan_links_seed.sql` | snpw-001, plan `8d30c3c8-…` | 9 goals, 20 measurements, 17 interventions, 6 barriers (legacy goal_id only), 4 automations. **That plan is deleted by the realistic migration above**, so re-running this seed or `snp_care_plan_template_seed.sql` afterwards fails or produces nothing. |

Do not hand-edit `CPL/data/*Seed.js`. They are generated by `scripts/genCarePlanTemplates.mjs`, `scripts/applyCarePlanLibraryPriorities.mjs` and `scripts/carePlanPriorityRules.mjs`.

---

## 3. Loading and creating a plan

- **`fetchPatientCarePlan`** (S:1719) runs on CarePlanView mount (`CP/CarePlanView/useCarePlanViewFetchEffects.js:17-23`), along with `fetchCarePlanLinks` and `refreshCarePlanDuplicates`.
  - Load order: plan row, then goals, interventions, barriers and automations in parallel (ordered by sort_order, created_at), then the barrier-goal join, then measurements.
  - A missing table (42P01, PGRST205) is treated as empty. With no plan row the slice is `null`.
  - Guarded by `patientCarePlanLoadedFor[key]`, so it **never refetches during a session** and other users' edits are not seen.
- **`ensurePatientCarePlan`** (S:1793) creates the plan lazily. Every write (goal, intervention, barrier, automation, link, applied templates, snapshot) calls it first.
  - It upserts on `patient_id,program_id` with `created_by` set to the current user, so it can overwrite the original author whenever the cache lacks the plan id.
- **Once per plan per session**, after the plan exists (`useCarePlanViewFetchEffects.js:27-33`):
  1. `syncAppliedCarePlanTemplates` (S:1910) re-applies every applied template with audit suppressed.
  2. `repairCarePlanGoalLinks` (S:1950) adds a library goal's linked interventions and barriers to matching plan goals, matched by title, with no audit.
- **`fetchAllPatientCarePlans`** (S:2561) is used by the Comprehensive view and the Monitoring rail. It loads plans, goals, interventions and barriers for every program, writes each per-program slice and marks it loaded. Those slices lack measurements, automations and the barrier-goal join (see gap 1).

---

## 4. The editor: CarePlanView (`CP/CarePlanView/CarePlanView.jsx`)

It is mounted by ProgramDetailView when the step name is exactly `Care Plan`. The data hook is `useCarePlanViewData`. `canEdit` is just `!!(patientId && program)` (`:201`); there is no role check and no read-only mode after signing.

### Step header (HDR)

The header line reads `Care Plan • Ver. {max(1, latest version)}` (`:147, :312`), followed by a state label:

| State | Header label |
|---|---|
| Draft | grey "Draft" |
| Signed | green "Signed by X on date" |
| Review requested | warning "Sent for review to X on date" |

| Control | Behavior |
|---|---|
| Bulk toggle | `carePlanBulkMode` (`:387`) |
| Preview (eye) | Opens the Preview & Share drawer (`requestCarePlanShare('preview')`, `:389-395`) |
| Template | Opens ApplyTemplatesDrawer (`requestCarePlanPanel('templates')`, `:401`) |
| Sign (split) | Primary signs directly, with no note and no confirm (`signCarePlanDirect`, `:229-233`). Chevron: **Send for Review**, which opens `SelectAssigneeModal` (`:415-426`). Both are gated by `carePlanSignShareEnabled` (section 7). |
| More | Save as Template, Add Note, History (`:180`) |

### Body, top to bottom

| # | Element | Notes |
|---|---|---|
| 1 | `AppliedTemplateStrip` (sticky) | Template badges sorted High, Medium, Low, then applied order. Each shows a goal count, which is the number of the template's goal titles present on the plan. Click filters the tables by title. The X removes the template, only when unsigned. "View More N" appears on overflow. |
| 2 | Conditions | Not rendered here (comment at `:674`). They appear in Share/PDF and the Comprehensive view. |
| 3 | Summary strip | Goal, intervention and barrier counts, average goal progress, status badges (`useCarePlanViewFilters.js:78`) |
| 4 | Care Note card | Latest plan `note` audit row unless a newer `note_cleared` exists (`useCarePlanViewData.js:56-87`) |
| 5 | Filter bar | Status, Priority, Assignee (interventions only), Clear All |
| 6 | BulkBar | Set status, Set priority, Assign (interventions only), Delete with a 6-second Undo (`carePlanBulkActions.js`) |
| 7 | Goals | Duplicates badge, Trends, +. Empty state: "No Goals Added for Selected Problem". |
| 8 | Interventions | + opens the type menu |
| 9 | Open Barriers | Met/Not Met go under a collapsible "Closed Barriers"; same-title rows are merged client-side |

**Shared table behavior**

- **Sort:** `useTableSort`, default title ascending (`tables/carePlanTableSort.js`).
- **Hidden columns:** saved per user under `carePlan:goals` / `carePlan:interventions`.
- **Section open state:** localStorage `carePlanOpenSections`.

**Columns** (`tables/carePlanTableShared.jsx:91`)

| Table | Columns |
|---|---|
| Goals | P, Goal Title, Start, Target (falls back to createdAt + 90d), Current Value\*, Progress\*, Trend\*, Status, Actions |
| Interventions | P, Name ("Started <date> · <duration>"), Due Date (inline date plus recurrence; falls back to createdAt + duration, else + 30d), Assigned To (locked to the patient for non-internal kinds), Adherence\*, Status, Actions |
| Barriers | (empty P), Name, Status, Actions |

\* hidden by default.

**Row menus**

| Row | Menu items |
|---|---|
| Goal | Edit (**only a toast**), Add Intervention, Link Existing Intervention, Add Barrier, Link Existing Barrier, Delete |
| Intervention | Edit (kind editor), Delete |
| Barrier | Edit (`BarrierDrawer`), Delete |

**Linked-items hover** (`tables/CarePlanLinkedPreview.jsx:125`, `CarePlanView/carePlanLinkedItems.js`)

- On a goal row it shows the goal's interventions, barriers and automations. On a child row it shows the parent goals.
- Clicking an item scrolls to `[data-cp-row-id]` and flashes it for 3s.

### Vocabulary

| Field | Values |
|---|---|
| Status | Not Started, In Progress, On Hold, Met, Not Met (`CarePlanViewSections.jsx:7`). `Overdue` exists in `GBI_STATUS_TONE`, but nothing sets it. |
| Priority | high, medium, low |
| Goal category | Vitals, Labs, Diet, Exercise, Assessment, Others |
| Goal comparator | `=`, `<`, `<=`, `>`, `>=`, `between` |
| Goal frequency | Daily, Weekly, Monthly, Quarterly |
| Intervention kinds (`lib/carePlanInterventionMenu.js:2-9`) | Send Form, Patient Education, Patient Task, Measure Vital, Internal Task |

---

## 5. Goals, interventions, barriers

### Goals

- **Add** through `AddGoalsDrawer` (`CPL/goals/AddGoalsDrawer`).
  - In patient context the list is grouped Added (pre-checked), Recommended, All.
  - Unchecking an added goal deletes it with cascade (`carePlanPickerHandlers.js:24-33`).
  - Each goal is built by `goalPayloadFromTemplateEntry` (`CP/lib/carePlanTemplateApply.js:7`). Its library links are then created as interventions and barriers, deduped by title (`carePlanPickerHandlers.js:40-78`).
- **Custom goals.** "Create New Goal" saves a **library** goal, then selects it. There is no plan-only custom goal.
- **Recommendations.** `recommendedGoalIds` (`CPL/lib/conditionRecommendations.js:33-47`) uses 9 keyword groups. It substring-matches active problem titles from `patientProblems[patientId]` against goal conditions, title and category. There is no ICD matching.
- **Save.** `savePatientCarePlanGoal` (S:2204) does no merge, so callers must pass the full goal.
  - Seeds targetDate at +90d when it is missing.
  - Recomputes currentValue and trend from measurements.
  - Stamps updated_by.
  - Baseline (`initialValue` / `initialValue2` / `heightUnit`) is dropped by the row mapper.
- **Progress** (`CP/lib/goalMetrics.js:63`):
  - It is the average numeric `adherence` of the goal's interventions, times 0.8 if any linked barrier is still open. It is null if there is no adherence.
  - `recomputeGoalProgressForPlan` (S:2498) runs after every intervention or barrier save, and overwrites the manual slider in Goal Details (`GoalPreviewDrawer.jsx:691`).
  - Bands: progress Poor/Low/Moderate/High/Complete; adherence Poor/Moderate/Good.
- **Measurements.** Goal Details "Last Trends" takes a value plus In-target/Out-of-target.
  - `saveGoalMeasurement` (S:2324) inserts the row, then `patchGoalDisplayFromMeasurements` (S:2279) sets current_value and trend. Trend compares the first number in each of the last two readings.
  - `CarePlanTrendsDrawer` is a read-only per-goal sparkline roll-up.
- **Remove** (`lib/carePlanGoalCascade.js:21`, `RemoveGoalDialog`).
  - The cascade covers all of the goal's interventions, plus barriers for which this is the last linked goal.
  - The dialog offers "Remove all" or "Remove goal only".
  - Undo (`carePlanGbiActions.js:26`) re-inserts the goal as a new row and re-links the children.

### Interventions

| Kind | Editor | On create |
|---|---|---|
| Send Form | `CPL/interventions/InterventionDrawer` (requires form) | Saves the row only. **No form is sent.** |
| Patient Education | requires content (`email:<id>` / `form:<id>`) | Row only, nothing sent |
| Measure Vital | requires vital | Row only, nothing scheduled |
| Patient Task / Internal Task | `features/tasks/AddTaskDrawer` | `createTask` first, then the intervention is saved with `config:{title, taskId}` and `task_id` (`CarePlanViewDrawers.jsx:180`) |

- **Config.** Holds kind, title, priority, form/content/vital, note, description, the creation fields (creationTrigger default "Care Plan Signed", creationTiming, creationCount), the due fields (dueOffset/Unit, durationType), the repeat fields, goalIds, assignedTo, member and `dueDateOverride`.
  - **Nothing reads creationTrigger or creationTiming.** Interventions never auto-create on sign.
- **Single goal link.** `buildInterventionRecordFromConfig` (`carePlanInterventionMenu.js:36`) keeps one goalId; extra picked goals are dropped.
- **Save.** `savePatientCarePlanIntervention` (S:2400) merges over the previous row, including config.
  - Seeds `dueDateOverride` at +30d when there is no duration.
  - Writes `goal_linked` / `goal_unlinked` audit rows when the goal changes.
  - Recomputes goal progress.
- **Adherence** is a manual slider (`InterventionPreviewDrawer.jsx:532-565`) and is stored as a string.
- **Task sync is one way: task to intervention.**
  - `updateTask` calls `reconcileInterventionFromTask` (S:14607-14678).
  - Status mapping: completed to Met, missed/cancelled to Not Met, in_progress to In Progress, pending to Not Started. The title syncs too.
  - It skips audit and the progress recompute, and only touches plans already in memory.
  - Intervention edits never update the task.
- **Delete** (S:2534) is optimistic, then **deletes the paired task**.

### Barriers

- **Fields:** title, description, status, priority, plus `goalIds[]` from the join table.
- **Save** (S:1823) diffs prev and next goalIds and only writes the delta. The legacy `goal_id` is set to the first linked goal.
- **Add** from the picker (`addBarriersFromPicker`, `carePlanPickerHandlers.js:97`, targets `thisPlan` / `thisPlanAllGoals`), from Goal Details quick add, or from the goal row "Link Existing Barrier". The `allPlans*` targets only toast "pending".
- **`BarrierDetailDrawer`:**
  - Title and status are staged until you click Update.
  - Unlinking the last goal **deletes the barrier**.
  - Met or Not Met locks the record.
  - "Templates" are derived from the linked goals' conditions.

### Automations

Automations are free-text rows added in Goal Details and Intervention Details. **Nothing executes them.** There is no trigger, no schedule and no audit, and `enabled` is never toggled in the UI.

### Links to tasks and appointments

`care_plan_links` has working actions: `fetchCarePlanLinks` (S:3125), `addCarePlanLink` (S:3146) and `removeCarePlanLink` (S:3162). `CarePlanLinkDrawer`, however, is **unreachable**, because `setLinkOwner` is never called with a value (`CarePlanView.jsx:91`). Links are fetched on load but never shown.

### Duplicate detection (`refreshCarePlanDuplicates`, S:2116)

- **What is compared:** goals and interventions across all of the patient's plans, grouped by trimmed, lowercased title. Barriers are excluded.
- **What gets flagged:**
  - When another program's plan has the same title, every copy on this plan is flagged.
  - When the duplicates are only on this plan, the oldest copy counts as existing and the rest are flagged.
- **Card actions:** Ignore, Accept Existing (deletes the new item), Accept New (deletes the existing item if it is on the same plan), Edit & Accept.
- **Dismissals** are a session-only Set (S:1652, 2192).

---

## 6. Templates and the Care Plan Library

### Library (Settings)

- **Routes:** `#/settings/care-plan-library/{template|goals|interventions|barriers|drafts|create}` (`lib/router.js:211-213, 326, 465-475`). The **edit** screen has no route, so a refresh loses it.
- **Panel tabs** (`CPL/panel/CarePlanLibraryPanel/CarePlanLibraryPanel.jsx:29-35`): Plan Template, Goals Library, Interventions Library, Barriers Library, Draft Templates.
  - Search is per tab.
  - Favorites sort first.
  - Goals paginate at 10.
- **Template row actions:**
  - Favorite.
  - Edit.
  - Duplicate: saves as "<name> (Copy)", always published.
  - Delete: ConfirmDialog, then an optimistic delete with rollback. The success toast fires before the result is known.
- **`CarePlanCreateView`** (full pane, hides TopBar). Left side: Name (required, max 100), Description, Template Type (General / For Chronic Conditions), and `ChronicConditionSelect`, which searches the NLM clinicaltables API live. Right side: the GBI pane.
  - Buttons: Save as Draft / Save as Template.
  - Adding a goal pulls in its library links. Removing a goal drops items that no other goal links.
  - "Use Template" imports only the template's goals that resolve to library ids, plus their links.
- **`CarePlanTemplateView`** (edit) has one Save button and **keeps the current status, so a draft can never be published**.
- **Goal editor** `CreateGoalDrawer`: category, measure, conditions, title (max 150), priority, a target block, and staged interventions and barriers.
  - `saveCarePlanGoal` (S:3340) deletes and re-inserts every link on each edit, so link ids change.
- **Intervention editor** `InterventionDrawer`: title plus an entity field are required.
- **Barrier editors:** `BarrierDrawer` (edit) and `AddBarriersDrawer` (pick or create).
- **Limits** live in `CPL/lib/carePlanLimits.js`. Favorites use an optimistic toggle (`toggleCarePlanFavorite`, S:3222-3258).

### Applying templates to a patient plan

**`ApplyTemplatesDrawer`** (`CP/drawers/ApplyTemplatesDrawer`)

- **Finding templates:** search by name or conditions, a Condition FilterChip and a Condition sort.
- **Groups:** Recommended ("Recommended for <problems>", via `recommendedTemplateMatches`), Favorites, Selected, All.
- **Per-row controls:** a High/Medium/Low priority (checking a row defaults it to medium), Star, and Preview (`TemplatePreviewDrawer`, read-only).
- **Drafts** are listed too, because there is no status filter.

**`applyPatientCarePlanTemplates`** (S:2671)

1. Computes toAdd = new ids minus previous ids.
2. Runs `applyTemplateToPlan` for each.
3. Persists ids and priorities (`setPatientCarePlanAppliedTemplates`, S:2622).
4. Unions the template conditions into the plan.
5. Touches the plan.

**Removing a template only removes the badge.** No goals, interventions, barriers or conditions are removed, even though `CarePlanView.jsx:261-264` claims conditions are stripped.

**`applyTemplateToPlan`** (L:599-645)

1. Snapshot the plan's existing titles (trimmed, lowercased).
2. **Goals:** use the library goal matched **by id**, else the entry's own fields. Skip blank or existing titles.
3. **Ownership** (`templateLinkOwners`, `carePlanTemplateApply.js:90-107`): map each linked title to its owning goal titles, then to plan goal ids.
4. **Interventions:** skip the title if it is already anywhere on the plan. Otherwise link it to the **first** owner, with defaults kind internal-task, priority from config, assignee Unassigned.
5. **Barriers:** the same title dedupe, linked to all owners.
6. The template-level priority **is not applied to items**. It only orders the strip.

**Sync on load.** `syncAppliedCarePlanTemplates` re-runs this for every applied template, once per session. **Items a user deleted that still belong to an applied template come back silently**, with no audit.

### Save as Template from a plan

Started from More, then Save as Template. The dialog takes Name (no max) and Conditions. `savePatientCarePlanAsTemplate` (S:2609-2620) writes goals as `{id:'g-<id>', title, subtitle}` and interventions as `{id:'i-<id>', title, duration}`:

- **Barriers, kind, config and priority are dropped.**
- **Goal ids do not resolve** to the library, so the result applies as bare goals plus internal-task interventions.
- The template is always published.

---

## 7. Governance: sign, review, versions, history, notes

### Plan states (`CP/lib/carePlanSignState.js`)

| State | Derivation |
|---|---|
| No plan | No plan row. Sign is disabled. |
| Draft | `!(signedBy && signedAt)` |
| Signed | Both are set. The program step turns `completed` (`stepStatus.js:24-29`). |
| Modified since sign | The max of plan `updatedAt` and every GBI item's updatedAt/createdAt is later than `signedAt` (`:14-24`). There is no label; Sign simply re-enables. |
| Review requested | Derived from audit: newest-first, stop at `signed`, take the first `review_requested` (HDR:156-169). It is always cleared when `signedAt` exists. |

**Sign gate** (`carePlanSignShareEnabled`, `:27-31`): enabled when the plan is unsigned, or signed and modified. The Send for Review chevron shares the same disabled state. An empty plan can be signed.

**Who can sign:** anyone signed in. `signed_by` is the free-text `currentUserProfile.name`; no user id is stored.

### Sign (`signCarePlan`, S:2895-2965)

1. Requires a plan id; otherwise it toasts "Add a goal before signing."
2. `snapshotCarePlanVersion(reason 'signed', note)`. If this fails, signing stops.
3. Update `signed_by`, `signed_at`, `updated_at`.
4. SNP only: patch `snpWorklistMembers[].carePlanStatus = 'Signed'`.
5. Write `template` audit rows for templates added or removed since the last signature. `created` rows carry JSON contents from `templateContents` (L:430-466).
6. Write the `plan/signed` audit row, `Signed (vN)`, with the note as detail.

The note-taking Sign drawer (`CarePlanViewDrawers.jsx:228-243`) is dead, because nothing requests `'sign'`. The only way to attach a sign-off note is the Share drawer.

### Review (`requestCarePlanReview`, S:2976-3033)

1. **Audit row:** `plan/review_requested` (summary = reviewer, detail = ISO time).
2. **Task**, created with `createTask` and registered with `addProgramTask(program.code)`:

   | Field | Value |
   |---|---|
   | name | `Review care plan for <member>` |
   | status | pending |
   | priority | medium |
   | due | today + 3 days |
   | assigned to | the reviewer |
   | labels | `['Care Plan Review']` |
   | mentions | the reviewer |

   The task has no patient_id/program_code and no deep link, so it drops out of Program Related Tasks on reload.
3. **Notification:** `addNotification` with action `openCarePlan`. It is ephemeral and local to this tab, so the reviewer never receives it, and nothing handles `openCarePlan`.

There is no approve or reject step. Review clears only when someone signs.

### Versions

- **Snapshot contents:** `{conditions, goals, interventions}` only. No barriers, measurements, automations, templates or links.
- **Numbering:** max + 1, computed client-side and not atomic.
- **Versions drawer:**
  - The newest version always carries the "Current" badge.
  - Cards show "N goals · N interventions" and the note.
  - View opens the Changes drawer.
  - Restore asks for confirmation first.
- **Restore** (S:3082-3117):
  1. Delete all goals, then all interventions.
  2. Re-insert from the snapshot. Goals get new ids.
  3. Refetch the plan, touch it, and write audit `Restored vN`.

  Interventions keep their snapshot `goal_id`, which now points at deleted rows. **The FK makes the insert fail after the deletes have run**, leaving the plan without interventions. Measurements also cascade away, and barriers are never restored.
- **Changes drawer** (`CarePlanVersionChangesDrawer`): built from audit rows, not a snapshot diff.
  - `groupByVersion` (`lib/carePlanVersions.js:11-24`) closes a group at each `signed` row.
  - `netVersionRows` (`:68-121`) nets out each item: created then deleted in the same version drops out, and field changes collapse to first-from and last-to.
  - Filters: date, user, change type, activity type, sort.

### History and audit

- **Writer:** `logCarePlanAudit` (S:2781) takes one entry or an array. It is skipped while `carePlanAuditSuppressed` is set, which covers template sync.
- **Actions per entity** (`auditForSave`, L:547-576):

  | Entity | Actions |
  |---|---|
  | goal / intervention / barrier | `created`, `deleted`, `status_changed`, `progress_changed` (intervention adherence too), `priority_changed`, and `updated` ("Renamed from", plus per-config-key "Label: a → b") |
  | goal only | `category_changed`, `measure_changed`, `target_changed`, `target_date_changed`, `duration_changed`, `frequency_changed`, `value_changed`, `conditions_changed` |
  | intervention only | `type_changed`, `duration_changed`, `assignee_changed`, `goal_link_changed`, `goal_linked`, `goal_unlinked` |
  | barrier only | `description_changed`, `goal_link_changed` |
  | plan | `signed`, `review_requested`, `restored`, `note`, `note_cleared` |
  | template | `created`, `deleted` |
  | share | `shared` |

- **Never audited:** automations, links, progress recompute, task reconcile, template sync and repair, condition changes, applied-template ids.
- **History drawer** (`CarePlanHistoryDrawer`): a month-grouped timeline of signed-version groups ("Care Plan Updated", with badges like "N Templates Added") plus standalone notes and restores. The header line reads `Signed by X · vN · Shared to Y`. Changes after the last signature, and anything on a never-signed plan, do not appear.
- **`CarePlanActivityBlock`:** per-item activity in the Intervention and Barrier preview drawers, with All / Since Last Visit tabs.

### Notes

| Note | Add | Edit | Delete |
|---|---|---|---|
| Plan care note | More, then Add Note, which appends a `note` row | appends a new row | soft `note_cleared` |
| Goal / intervention note | `addCarePlanNote` with entityType/entityId | none (`updateCarePlanNote` is unused) | soft `note_deleted`, or a hard `deleteCarePlanNote` from the confirm dialogs |

---

## 8. Share, export, report

- **Preview & Share drawer** (`CP/drawers/CarePlanShareDrawer`, 1300px): a live PDF preview on one side and the editor on the other.
  - Preview: `CarePlanPdfPreview`, an iframe regenerated with a 120ms debounce.
  - Item filters (`lib/carePlanShareFilters.js`): date (All, Since last visit, 30d, 90d), status, priority, assignee, conditions. Each section has per-item checkboxes and a note field.
- **Targets:** EHR (default), Patient, POA.
- **What Share does** (`CarePlanShareDrawer.jsx:190-206`):
  1. `sharePatientCarePlan` (S:2730) inserts a `care_plan_shares` row, writes audit `Shared to X`, and logs program activity "Signed & Shared".
  2. **Then it always calls `signCarePlan`**, so every share cuts a new version.
- **Nothing is sent anywhere.** There is no EHR, portal or POA integration, and no stored PDF.
- **PDF** (`lib/generateCarePlanPdf.js`, jsPDF, letter size):
  - Header: Care Plan, date, prepared by, program.
  - Patient and Conditions bar: always lists every condition, whatever the filter.
  - GBI sections: active items in the primary table, Not Started items in "Additional X".
  - Ending: an optional note, a disclaimer and a page footer.
- **Download** (`lib/carePlanExport.js:120-143`): `CarePlan-<patient>-<program>-<date>.pdf`. The legacy HTML export is unused.
- **Report** (`report/CarePlanReportView`, data from `fetchCarePlanReport`, S:3177) is **unreachable**. `reportOpen` is never set to true (`CareProgramsTab.jsx:68, 238`); the trigger was lost in the shared-toolbar refactor (#345).

---

## 9. Comprehensive Care Plan (`summary/`)

**Mount and toolbar**

- Mounted by `CareManagementView.jsx` as a sub-tab, through `ComprehensiveCarePlanPane` (`:66-220`). The legacy `.../summary` URL maps here.
- Toolbar:
  - Search (titles only).
  - FilterChips (`summary/carePlanSnapshot.js:79-121`): Program, Care Plan Template, Status, Priority, Due Date, Create Date. The date presets are Today, Last 7 days, Last 30 days, This month.
  - Add Care Note (**only a toast**).
  - Download CSV.

**Data**

- On mount it loads `fetchAllPatientCarePlans`, `fetchPatientCarePlanSummary` and `fetchPlatformUsers`.
- `buildCarePlanSnapshot` (`carePlanSnapshot.js:12-39`) unions conditions and tags each item with its program and template ids.
- Rows collapse by title across programs (`dedupeByTitle`). `ProgramCell` shows a "+N" badge for the extra programs.

**Active Programs Summary**

| Column | Source |
|---|---|
| Plan | the plan |
| Conditions/Focus | plan conditions |
| Started-Ends | signedAt or created date, to the latest goal target or the program end |
| PCM | program assignee |
| PCP | patient's PCP |
| Last Reviewed | `signedAt` / `signedBy` |
| Activity Since Review | audit rows newer than signedAt, bucketed by entity type; opens `ActivityReviewDrawer` |
| Actions | |

Only active programs that have a plan row are listed.

**GBI tables**

- Goals, Interventions and Barriers, with a Program column. Closed barriers are grouped.
- Priority and status menus save through the per-program save actions. Assignee is editable only for internal-task interventions.
- Row click opens the preview drawers with `consolidated` set.
- "View Plan" opens the program at its care plan step (`:349-354`).

**AI summary**

- **Request:** "Summarize" posts `{patientName, programs, conditions, goals, interventions, barriers}` to `POST /api/care-plan-summary` (`api/care-plan-summary.js`).
- **Model:** `GOOGLE_AI_MODEL` or `gemini-3.8-flash`, temperature 0.4, JSON schema output.
- **Prompt:** a 30-second clinician read at roughly 8th-grade level, with lists capped at 60 items.
- **Output:** `{intro, points[3-6], actions[2-5]}`.
- **Retries:** 3 on 429/503.
- **Storage:** upserted to `patient_care_plan_summaries` (S:1664-1717). The card offers copy, regenerate and delete.
- **Limits:** there is no staleness tracking, it ignores the filters, and it sends the patient name to Google.

**CSV** (`carePlanSnapshot.js:129-154`): Conditions, Goals and Interventions, with filters applied. No barriers, and no title dedupe.

---

## 10. Touchpoints outside the editor

| Where | What |
|---|---|
| Program step status (`stepStatus.js:24-29`) | `signedAt` gives completed; any goal or intervention gives in progress. Matches only the exact step name `Care Plan`, so CCM's "Care Plan Details" never renders the plan. |
| SNP worklist (`store/lib/worklistPersist.js:157-160, 175-226`) | Care Plan Status is projected as `Signed` / `Draft` / `No Care Plan` from the latest SNP plan. "In Review" exists only in mock data, and modified-since-sign still shows Signed. |
| Monitoring rail (`tabs/monitoring/MonitoringRailGoals.jsx:16-154`) | Active goals across non-closed programs, with priority and status editable inline. Opens GoalPreviewDrawer as fully editable. "Open care plan" goes to the Comprehensive view. |
| Tasks (S:14603-14678, `features/tasks/useAddTaskDrawer.js:29`) | Task-to-intervention status sync; the "Care Plan Signed" creation trigger option, which nothing consumes |
| Patient notes (`notes/PatientNotesTab/PatientNotesTab.jsx:335-336`) | Origin labels `care_plan_goal` / `care_plan_intervention` |
| CCM worklist (`CcmWorklistRow.jsx:147-149`) | Static `ccm_worklist_members.care_plan_status`, not derived from plans |
| TOC/TCM (`toc/tocColumns.jsx:479-490`, `toc/queue/QueueRow.jsx:390-400`) | Static `patients.care_plan_status` (updated/pending/none) |
| Overview (`overview/OverviewTab/OverviewTab.jsx:226-249`) | "Care Plan Recommendations" is pure mock (`overviewMock.js:31`) |
| HEDIS DSF (`hedis-worklist/dsf/dsfCarePlans.js`) | Fixed PHQ-based text, unrelated to GBI |
| Analytics, agent builder, embedded components | Hardcoded or descriptive text only; no care plan reads |

---

## 11. Known gaps

**Data integrity**

1. **`fetchAllPatientCarePlans` poisons the editor cache.** If the Comprehensive view or Monitoring rail loads first, the editor shows no measurements, no automations and only single-goal barrier links, and never refetches (S:2588-2600).
2. **Restore breaks plans.** Interventions keep their stale goal_id, so the FK fails after the deletes. Barriers, conditions, templates and measurements are lost (S:3096-3110).
3. **Snapshots and Save-as-Template drop barriers.** Snapshots also drop measurements, automations, templates and links.
4. **Barrier row-menu Edit unlinks every goal.** `BarrierDrawer` saves without `goalIds` (`CarePlanViewDrawers.jsx:200`), so the join diff deletes every link.
5. **Template sync resurrects deleted items** every session, with no audit.
6. **Bulk goal delete and duplicate Accept Existing / Edit & Accept cascade silently** to interventions, barriers and their tasks. Undo restores only the goals.
7. **Intervention delete hard-deletes the paired task**, and undo leaves a dead `task_id`.
8. **Task sync is one way and covers loaded plans only.** Intervention edits never update the task, and the sync writes no audit and skips the progress recompute.
9. **Plan Patient/Internal Task interventions** ignore the drawer's linked goals, and the task carries no patient_id/program_code.
10. **`ensurePatientCarePlan` can overwrite `created_by`.** Version numbering is not atomic.
11. **A null `currentUserProfile.name` makes signing silently fail** (signed_by null), while a version and an audit row still exist.
12. **No FKs** from plans, audit, links or step status to `patient_care_programs`, and none from `applied_template_ids` to templates. Deleted templates leave dangling ids.
13. **Comprehensive edits on a collapsed title only update the first program's copy.**
14. **The Comprehensive patient lookup reads `s.snpMembers` / `s.ccmMembers`**, which do not exist (`CarePlanSummaryView.jsx:792`). For SNP/CCM-only patients the PCP is blank and the AI summary says "the patient".

**Product and UX**

15. **Sharing always re-signs**, even with no changes, and logs "Signed & Shared" even if signing fails. Nothing is actually transmitted.
16. **Review is notification-less** for the reviewer and has no approve/reject step. A pending review disappears if the plan was ever signed before.
17. **No role-based sign authority.** Plans are editable, and templates can be applied, after signing. Only template removal is blocked.
18. **Template-level priority does not affect item priority.** Unapplying a template removes nothing. Drafts appear in the apply drawer, and a draft can never be published.
19. **Library edit gaps:**
    - Template description and type are never saved.
    - Intervention edits inside the template screens are discarded.
    - The barrier picker replaces the whole list and drops non-library barriers.
    - The edit screen is not URL-routed.
20. **Manual goal progress is overwritten** by the adherence recompute. The goal baseline is never persisted.
21. **Intervention creation triggers do nothing.** Send Form, Patient Education and Measure Vital send or schedule nothing. Automations never run.
22. **Comprehensive view:**
    - Activity Since Review is usually empty, because `fetchCarePlanAudit` is not called there.
    - The Due Date filter hides every intervention and barrier.
    - Every barrier audit entry is counted as "Closed".
23. **Duplicate dismissals are session-only.** Duplicate cards show plan-level author and date, not the item's own.
24. **Audit noise:** a measurement writes two `value_changed` rows, and a goal-link change writes both `goal_link_changed` (raw UUIDs) and `goal_linked`/`goal_unlinked`. `review_requested`, `goal_linked` and `goal_unlinked` have no History label.

**Dead code**

25. Unreachable or unused:
    - `CarePlanLinkDrawer`, the Sign-with-note drawer, the filter and scan-duplicates panel requests, `CarePlanReportView`, `carePlanSummaryOpen`
    - `updateCarePlanNote`, the legacy HTML export, `templateGoalCount`
    - the goal row "Edit" toast, the `AddGoalsDrawer` row buttons, ApplyTemplatesDrawer "Create New"
    - `GBI_STATUS_TONE.Overdue`
26. Stale comments:
    - S:1642 and `scripts/seed.js:1629` mention a mock fallback that no longer exists.
    - `CarePlanSummaryView.jsx:182` says "mock AI recap".
    - `CarePlanView.jsx:261-264` claims unapply strips conditions.
27. Generator lookups by link id never match (`genCarePlanTemplates.mjs:95`, `applyCarePlanLibraryPriorities.mjs:20`). As a result, every library link row has empty config and intervention priorities are effectively the default.

---

## 12. Working rules for care plan changes

- **Step routing.** Content and status key off the exact step name `Care Plan`. Prefer step ids when touching this, and fix CCM's "Care Plan Details" at the same time.
- **Saves.**
  - Goal saves do not merge, so pass the full object.
  - Barrier saves treat a missing `goalIds` as "unlink all", so always pass the current set.
  - Intervention saves merge.
- **Audit.** Every user-visible change should write a `care_plan_audit` row through `logCarePlanAudit`, because History, Versions and Activity Since Review depend on it.
- **Barriers.** Any snapshot, restore or template path must include barriers and the barrier-goal join.
- **Cache.** Anything that writes a `patientCarePlans[key]` slice must write the full shape (`plan, goals, interventions, barriers, measurements, automations`) or leave `patientCarePlanLoadedFor` unset.
- **Linking.** Link new rows by enrollment id (`program_id`), not by program code.
- **Migrations.** New persisted fields need a `supabase/*_migration.sql` plus a seed. Ask **Alok Kumar** to run it.
- **UI.** UI work follows `fold-feature-builder`: the shared `Drawer` (with `noCloseDivider` plus `headerDivider` when `headerRight` has actions), `FilterChip`, Solar `*-linear` icons, Inter tokens.
