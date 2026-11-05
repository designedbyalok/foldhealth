# HCC Coding Workflow: Domain & Product Reference

> **Why this doc exists.** The HCC feature set (worklist, Diagnosis Gaps panel,
> Add DOS, document upload/OCR, SFTP review, claims) all implement one
> underlying business process: **risk-adjustment (RA) coding**. This is the
> canonical description of that process and how the app models it. Read this
> before touching anything under `src/features/hcc/` so you don't need the
> context re-explained. Companion docs: `hcc-activity-log-spec.md` (event
> taxonomy for the activity/history system).

---

## 1. The domain in one page

**HCC (Hierarchical Condition Category) coding** is how Medicare Advantage
(and ACA/Medicaid) plans get paid for patient risk. CMS maps ~10,000 ICD-10
diagnosis codes into ~115 HCC categories (current model: **V28**). Each HCC
carries a **RAF weight** (Risk Adjustment Factor); a patient's RAF score ≈ the
sum of demographic factors + their documented HCC weights. Higher documented
acuity → higher plan payment. Two rules matter constantly:

- **Annual documentation**: every chronic condition must be re-documented
  face-to-face **each calendar year** with a claimable **DOS (Date of
  Service)**, or the plan loses that HCC's revenue. A condition documented
  last year but not this year is a **recapture gap**.
- **MEAT evidence**: a diagnosis only counts if the note shows the provider
  **M**onitored / **E**valuated / **A**ssessed / **T**reated the condition.
  Coders can't accept a code without supporting evidence in the chart.

Vocabulary used across the codebase:

| Term | Meaning |
|---|---|
| **DOS** | Date of Service, one encounter/visit. The billing unit a diagnosis attaches to. |
| **RAF** | Risk Adjustment Factor. `member.raf` = current score; `member.ri` (+`ru` direction) = potential uplift if open gaps close. Per-ICD `raf` = that code's weight contribution. |
| **HCC (V28)** | The condition category an ICD maps to, e.g. `E11.22 → HCC 37`. "No HCC" = code doesn't risk-adjust (still billable, no RAF value). |
| **Open gap** | A diagnosis we believe is true but not yet coded on a claim this year. |
| **Suspect** | AI/analytics-suggested condition never (or not yet) confirmed: needs coder confirmation ("Are you sure this ICD is correctly coded?"). |
| **Recapture** | Documented in a prior year, missing this year. |
| **Sweep** | Reviewing an ICD across **all** of a patient's DOSs at once (dedup view), instead of one DOS at a time. |
| **Claim / Claimed** | The DOS+ICD set submitted for billing. A `Claim` link on a row means that pair is already on a claim. |
| **Override / Trumped** | An ICD superseded by a more specific code or a hierarchy rule (`trumpedBy`), or dismissed with a reason (`dismissReason`). |
| **Missed opportunity** | Coder marks that a gap could not be captured for this DOS (e.g. no MEAT), tracked for provider education, not billed. |
| **Defer** | Punt the decision on a row to later / another reviewer without accepting or rejecting. |

## 2. The Fold review pipeline (who does what)

Every **DOS** flows through a staged human pipeline, then ASM generation
(`ReviewProgressPopover.jsx` / `assignment/` engine). Product persona names
(per the RA Coder Workflow plan) map onto the engine's role slots:

```
Support Team → Coder → Reviewer 1 → QA (Reviewer 2) → Compliance (Reviewer 3) → ASM
```

- **Support Team**: chart chasing: collects documents (upload, SFTP, EHR),
  runs OCR, fixes patient matching, marks records insufficient/requested,
  and **Pass/Fail-reviews** each attached document ("Action Needed" status).
  **Hard sequencing gate:** a Coder cannot begin a record until Support Team
  has cleared its document: the record is visibly blocked, not just
  discouraged.
- **Coder**: the main persona for the Diagnosis Gaps panel: reviews each
  ICD×DOS, accepts/rejects with MEAT evidence, adds missed codes, actions
  suspects/recaptures (Missed / Dismiss), uses Sweep Mode for the remaining
  sets after the primary row is complete.
- **QA (Reviewer 2)**: reviews a configured **sampling percentage** of
  completed records; can Return with a reason → status becomes
  **"Rebuttal"** (product term: the engine value is still `Returned`) and
  the record routes back to the Coder without losing prior work.
- **Compliance (Reviewer 3)**: **random pull**, explicitly including
  records QA's sampling skipped; **view-only** while a downstream stage is
  still in progress.
- **Manager**: assignment persona: per-role Assign links on worklist rows,
  bulk Change-Assignee (skips rows whose role is already Completed), and
  manual role-skip overrides (e.g. assign Compliance directly).
- **ASM generation**: the output file for Astrana; the progress popover's
  final action reads **"Ready for ASM generation"** (renamed from "Send to
  Bill"). Lab/imaging documents do NOT create worklist rows or count toward
  a coder's review denominator.

Per-DOS pipeline state lives in the **assignment engine**
(`src/features/hcc/assignment/`, keyed by `dosKey(memberId, dos, provider,
pos)` in `hccDosAssignments`), with lifecycle actions in the store
(`hccCompleteSupport/Coder/Reviewer/Reviewer2`, `hccRejectDos`,
`hccReturnDos`, `hccRequestRecords`, `hccMarkInsufficient`, …). DOS-level
statuses shown in `DosStatusMenu`: New → In Progress → Completed (+ Return,
Reject, Records Requested, Insufficient…). The worklist columns `sup/cdr/r1/r2`
(+`*S` status twins) mirror the same pipeline per member row.

## 3. What a coder decides, per ICD × DOS

The atomic unit of coding work is a **(ICD code, DOS) pair**. For each pair
the coder can:

| Action | Meaning | Store effect |
|---|---|---|
| **Accept** (`A`) | Diagnosis is MEAT-supported for this DOS → goes on the claim. AI-suggested codes (Suspect/Recapture) require signing a MEAT note first (`IcdRow` MEAT panel). | `acceptHccGap(code)` / per-DOS `setHccGapDosAction(code, dos, 'accepted')`; logs `accept` activity. |
| **Reject / Dismiss** (`X`) | Not supported / incorrect for this DOS. Multi-DOS rejects confirm via `DismissConfirmModal`. | `dismissHccGap(code, reason)` / `setHccGapDosAction(…, 'rejected')`. |
| **Missed opportunity** (`M`) | Condition exists but this DOS can't support it: flag for provider education. | `setHccGapDosAction(…, 'missed')`. |
| **Defer** (`D`) | Skip for now; leaves the row open. | `setHccGapDosAction(…, 'deferred')`. |
| **Missed / Dismiss** (suspects & recaptures only) | Suspect/recapture rows do NOT use Accept/Reject. **Missed** (accept-equivalent) sends the entry to the **ASM file as an "Added" record** AND flags the physician for education; **Dismiss** declines it. Both are primary visible buttons, never in the ⋯ overflow. The ICD code arrives directly from Astrana's API (no HCC→ICD mapping step); the code dropdown exists only for override/correction. Selecting the row's **DOS (single-select, tied to the existing document, no custom dates)** auto-populates Rendering Provider + POS. | `acceptHccGap`/`dismissHccGap` under the hood. |
| **Bulk Accept / Reject** | Select DOS rows via checkboxes → bulk bar applies the action to all selected; each update logs individually. | `setHccGapDosAction` per row. |
| **Add ICD** | Manually add a code the pipeline missed (chip: `Manually Added`). Uses the shared live ICD lookup (`components/IcdSearch`, WHO ICD-11 API → Supabase cache → offline catalog). | appends to the gap list. |
| **Reopen** | Undo a dismissal. | `reopenHccGap(code)`. |

Every action lands in the **activity log** (legacy `hccActivityLog` map for
the panel timeline + canonical `hccActivityFeed`, see
`hcc-activity-log-spec.md`).

## 4. The Diagnosis Gaps Details panel (`DiagPanel/`)

**Entry**: clicking a row (or a visit chip) on the HCC worklist,
`openDiagPanel(memberId, { initialDos, highlightCode, dosStatus, leftPanel })`
(`useAppStore.js`). Mounted from `AppLayout.jsx`.

**Data**: Supabase `hcc_diagnosis_gaps` (per member) with mock fallback
(`data/icds.js`, `data/sweepIcds.js` for per-DOS entries,
`data/confidence.js` for AI confidence + evidence). Accept/dismiss are
optimistic local updates (server round-trip is future work).

### Layout (post-redesign, Paper node `1WXT-0`, "RA Coder Workflow")

Top to bottom:

1. **Title row**: "Diagnosis Gaps Details" + close.
2. **Patient banner** (shared `PatientBanner`): avatar, name, sex • age •
   member ID • **RAF score** with green **uplift chip** (`ri`/`ru`), call
   action.
3. **Meta row**: left: `Created : {member.date}` + overdue chip
   (`member.due`) and the **stage pill** (e.g. ◑ Coder, hover = 4-stage
   review progress popover). Right: **assignee avatar** (current stage owner,
   e.g. DH) with reassign dropdown + **DOS status dropdown** (New ⌄).
4. **Toolbar**: bulk-select, inline **search** (filters cards by code or
   description), `+ ICD` (live ICD lookup popover → adds a Manually-Added
   row), filter, documents / comments / history toggles (open the
   **LeftWorkspace** second pane: Activity, Notes, Comments, Documents,
   Claims, Outreach, Worklog tabs), overflow.
5. **"ICDs Associated with N/M DOSs"** header: link opens the DOS selector
   (filter the rows to one DOS, or all).
6. **ICD-first cards** (`IcdDosCard`): *the core redesign inversion*: the
   old panel grouped by DOS-association sections and rendered one row per
   ICD; the new panel renders **one card per ICD** containing **one action
   row per DOS**:
   - Card head: purple code + description; 💬 comment count (opens the
     Comments workspace scoped to the code) and 🕘 activity count (opens the
     scoped Activity Log).
   - "Last Reviewed by {who}({role}) • {date}".
   - Per-DOS rows: `date` + `HCC {n} (V28)` chip (or `No HCC`) + `Claim`
     link when already claimed + `Manually Added` chip for coder-added rows,
     with **✓ Accept / ✗ Reject / ⋯ (Missed opportunity, Defer)** actions.
7. **HCC suspect groups** (`HccSuspectGroup`): collapsible per-HCC sections
   (`HCC 88 – Congestive Heart Failure · Open · RAF 0.166↑ · Overrides`)
   holding AI suspects: each row has an ICD dropdown (to refine the code),
   `HCC` + `Suspect` chips, the confirmation prompt, and
   **Confirm / Decline**.
8. **Keyboard shortcut bar** (dark, bottom): `A` Accept · `X` Reject ·
   `M` Missed opportunity · `D` Defer · `↑↓` Move · `Enter` Open Document.
   A focus ring tracks the active DOS row; keys act on it. Shortcuts are
   suppressed while typing in inputs.

**Second pane**: `LeftWorkspace.jsx` slides the drawer to 1280px with
tabs: Activity / Notes / Comments / Documents / Claims (+ Outreach/Worklog
at DOS scope). Toolbar icons and per-card counters both route here (ICD-scoped
via `openIcdActivityLog` / `openIcdPanel`).

### Related HCC surfaces

- **Worklist** (`HccWorklist*`): member-level queue; per-DOS rows with due
  dates, pipeline columns, open-ICD counts; actions to open this panel,
  upload documents, **Add DOS** (`HccAddDosDrawer`, upload → OCR extract →
  confidence gauges → Ready), claim preview.
- **Upload/OCR** (`upload/UploadDocumentDrawer`): single doc or manual
  encounter entry → extraction review → create/merge encounters.
- **SFTP review** (`upload/HccSftpReviewDrawer`): batch document intake.
- **ICD lookup** (`components/IcdSearch` + `api/icd-search.js`): WHO ICD-11
  live search behind a server proxy (OAuth secret server-side), write-through
  Supabase cache (`icd_codes`), offline catalog fallback. POS reference data:
  `data/posCodes.js` + Supabase `pos_codes`.

### Plan-mandated behaviors (RA Coder Workflow consolidated summary, Jul 2026)

Source: "RA Coder Workflow Prototype: Consolidated Summary" (pasted into
this repo's history 07/10/2026; collated from the Jul 6 internal prep +
Astrana review rounds). The panel implements:

- **Suspects & Recaptures** is the section title (not "ICDs Not Associated
  with DOS"); rows carry Suspect/Recapture tags.
- **Missed / Dismiss** as the suspect-row default actions (see table above).
- **Complete with unactioned rows** → the system auto-accepts each remaining
  unactioned row before finalizing (toast reports the count).
- **DOS-level scoping** for Comments, Activity Log, History, and Claims,
  they open from the row/card context, not the patient level; Claims access
  lives on the DOS itself.
- **Rebuttal** replaces "Returned" as the user-facing status everywhere
  (QA returning a record with "Major issues" shows Rebuttal and routes back
  to the Coder).
- **Worklist sort**: default is **Created Date desc** (`useTableSort(...,
  'date', 'desc')` in `HccWorklistTable.jsx`). The "Due Date" chip in the
  header is a *filter*, not the sort, a repeated source of confusion in
  reviews.
- **Intake**: OCR triggers automatically on upload (no separate "start
  extraction" button); multiple file upload; a nightly job auto-adds records
  when all 5 required fields extract cleanly (manual Pass/Fail only for
  what it can't auto-validate); extraction failures (e.g. wrong file
  extension) surface immediately: never silently dropped, never shared
  externally as-is (key differentiator vs Cozeva, where failures wait a day).
- **Demo data prerequisites** (for the persona walkthrough): a row pending
  Support Team review ("Action Needed", document attached); a record that
  gets actively Rejected; a multi-DOS record from one document (all 2026
  dates, labeled by Created Date, never "DOS: Set 1"); a suspect/recapture
  entry; an unassigned role column ("Assign"); a Coder=Completed record with
  Reviewer 1/2 unassigned (Manager skip-override).

Still open from the plan (needs design/backend decisions: not yet built):
worklist status column → progress stepper vs removal; worklist/Single-View
grouping parity; nightly-job auto-add confirmation with Astrana; Missed →
ASM backend wiring confirmation; QA sampling % configuration; Compliance
random-pull logic; role-based login personas.

### Known modelling caveats (intentional, demo-stage)

- Accept/dismiss key on `code` only; per-(code×DOS) decisions layer on top
  via `hccGapDosActions`, a real backend would key rows by (member, code,
  dos) ids.
- Confidence scores/evidence, sweep entries, and review stages are mock-fed;
  swap `data/*.js` for API calls when the backend lands.
