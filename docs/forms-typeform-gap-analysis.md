# Forms: Typeform Gap Analysis & Workflow Builder Plan

> Maps the Typeform developer reference (schema · renderer · logic engine ·
> theming · analytics · funnel) against what the Fold Health forms feature
> already ships, and scopes the **Workflow (Logic) Builder**: the one big
> missing piece. Healthcare use cases (validated instruments, clinical scoring,
> critical-safety triggers) stay first-class throughout.

---

## 1. Coverage matrix

Legend: ✅ shipped · 🟡 partial · ❌ missing

### Schema / data model
| Typeform capability | Status | Notes (Fold) |
|---|---|---|
| Single JSON definition (builder + renderer share it) | ✅ | `forms.schema` (`{items:[]}`, FHIR-Questionnaire-shaped) + `forms.scoring` + `forms.settings` jsonb. |
| Ordered `fields[]` with per-type `properties`/`validations` | 🟡 | Ordered `items[]` with `type`/`text`/`control`/`required`/`placeholder`/`options`. **No structured `validations`** (max_length, min/max) beyond `required`. |
| Stable developer-assignable `ref` per field | 🟡 | Every field has a generated `linkId` (stable, used by scoring + responses). Not user-editable, not per-**choice** (options keyed by `value`). |
| Stable `ref` per choice | ❌ | Options carry `{value, score}`; renaming a label breaks references. |
| Welcome / Thank-you screens | ✅ | `settings.start` / `settings.end` (title, description, button); paged renderer shows them. |
| Multiple endings selected by logic | ❌ | One end screen only. |
| Hidden fields / URL-parameter prefill | ❌ | Not implemented. |
| Variables (`score`, `price`, custom) | 🟡 | **Scores** ✅ (richer than Typeform). No `price`, no arbitrary custom variables. |

### Field types
| | Status |
|---|---|
| short_text, long_text, email, phone, number, currency(decimal), date, dropdown, single/multi choice, statement(display), yes/no & legal(consent) | ✅ |
| rating, opinion_scale / NPS, picture_choice, ranking, matrix, file_upload, payment, website, contact_info | ❌ |
| **Health components** (Chief Complaint, Vitals, Meds, Allergies…) & **validated instruments** (PHQ-9, GAD-7, AUDIT-C…) | ✅ **Fold-only differentiator**, locked clinical content + built-in scoring. |

### Renderer
| | Status |
|---|---|
| One-question-at-a-time (by-question), section-by-section, entire-page | ✅ `layout.js` + `FormRenderer`. |
| Start/end screens, progress bar, keyboard nav (Enter/arrows/1-9/A-Z), auto-advance, animated transitions | ✅ |
| Lettered choice cards, underline inputs, mobile-responsive (XL buttons) | ✅ |
| **Renderer honors branching (skips hidden questions / jumps)** | ❌ **Critical gap**, `buildFlow` is purely linear; it ignores `enableWhen` and `evaluate().visibility`. The engine computes branching but the live form shows every field. |
| Recall / piping in titles (`{{field:ref}}`, `{{var:score}}`) | ❌ |

### Logic engine (the keystone)
| Typeform `logic[]` graph | Status | Notes (Fold) |
|---|---|---|
| Conditional show/hide of a field on another's answer | ✅ **engine** | `enableWhen[]` per item + `enableBehavior` (all/any), operators `= != exists > < >= <=`. |
| Score/calculation-driven routing | ✅ **engine, richer** | Score bands fire `BRANCH` actions that `reveal` hidden sections; `evaluate()` builds a dependency DAG, topo-sorts, returns a full `visibility` map. Handles cycles fail-safe. |
| First-match-wins ordered actions | ✅ engine (band order is deterministic). |
| Forward "jump to field / ending / outcome" | 🟡 | Modeled as reveal/hide today; **no explicit jump-to-ending**. |
| AND/OR within a rule | ✅ `enableBehavior`. |
| Critical safety triggers (clinical) | ✅ **Fold-only**: `criticalTriggers[]` fire independent of totals (e.g. PHQ-9 Q9 self-harm). |
| **Visual builder to author any of the above** | ❌ **The primary ask**, all logic is hand-authored JSON today; only *scores/bands* have a UI (`ScorePanel`). |

### Theming
| | Status |
|---|---|
| Font family (allow-list), background color, header/footer presets | ✅ `FormSettings` + email-builder reuse. |
| Background image + brightness, per-field media (split/wallpaper/float), button radius/transparency, theme resource | 🟡 / ❌ | Background color only; no media layouts; no reusable theme resource. |

### Responses / analytics / funnel
| | Status |
|---|---|
| Consent-gated, event-typed responses (landed / partial / completed) | ✅ | `form_responses.status` (`in_progress`/`completed`), `session_id`, `started_at`/`completed_at`; partial autosave from first answer. |
| Funnel (views → starts → submissions), completion = submissions/starts | 🟡 | We track starts (in_progress) + submissions + **drop-off rate**; **no `view` events** (loads that never started). |
| Per-question drop-off attributed to last viewed question | ❌ | We have form-level drop-off, not per-question. |
| Webhooks (HMAC, retries) + native integrations | ❌ |
| Recall, hidden-field, time-on-question analytics | ❌ |
| Insight / Report (question-wise charts) / Responses (master-detail) | ✅ **Fold**: already richer than Typeform's standard panel in places. |
| Embed SDK (iframe widget/popup/slider) | 🟡 | Shareable `#/f/{id}` link + chat link-preview; no embeddable iframe SDK. |

---

## 2. What to build, priorities (healthcare-first)

1. **Workflow (Logic) Builder + renderer integration**: *this PR's focus.* Turn the
   existing branching engine into an authored, visible product: a visual rule
   builder **and** a renderer that actually skips/branches. Highest leverage:
   the backend already exists; we're exposing and wiring it.
2. **Recall/piping + hidden fields**: small, high-impact on completion (doc:
   piping ≈ +10%, hidden ≈ +4.8%); also lets us prefill patient context
   (name, MRN) from the launching app via URL params.
3. **Per-question analytics events** (`question_view`/`answer`/`skip`): upgrades
   drop-off from form-level to per-question; pairs naturally with branching.
4. **Field types**: rating / opinion-scale / NPS first (clinical PROs & CSAT),
   then picture_choice / ranking; payment/file-upload later.
5. **Validations** (max_length, min/max, regex), quick win on schema robustness.

Out of scope here: webhooks/integrations, embed iframe SDK, theme media layouts.

---

## 3. Workflow Builder, design

### 3.1 Model (reuse the engine; no schema churn)
We do **not** invent a parallel `logic[]` graph. Authoring writes the fields the
engine already reads:
- **Show/hide rule** → target field's `enableWhen[]` + `enableBehavior`.
- **Score-driven reveal** → a band `action {type:'branch', reveal:[linkId…]}` on a
  score (already authored in `ScorePanel`; surface it in the map too).
- **Jump to ending** → new: `enableWhen`-style condition whose action sets the
  active ending ref (small engine addition: see 3.4).

Add stable, **user-visible refs**: keep `linkId` as the id but show/allow an
optional `ref` alias for recall + readability (non-breaking).

### 3.2 Renderer integration (the critical fix)
`FormRenderer` runs `evaluate(form, answers)` reactively (it already imports
`evaluate` for live scoring in Preview) and feeds `result.visibility` into
`layout.buildFlow`:
- `buildFlow(fields, mode, visibility)` filters leaves/sections to
  `visibility[linkId] !== false`.
- Paged flow recomputes the visible question list on each answer; "Next" lands
  on the next **visible** question; hidden ones never render and are excluded
  from required-validation (they already are, in `requiredLeaves`).
- Pure + unit-testable; `layout.test.js` extended with branching fixtures.

### 3.3 Builder UI, "Logic" tab
A new top-level builder tab (Edit · **Logic** · Score · Preview · Analytics),
URL-routed like the others (`…/forms/{id}/logic`). Two coordinated panes,
matching `ScorePanel`'s three-column language and Fold tokens:
- **Rule list (left):** "When `<field>` `<op>` `<value>` → `<show/hide/jump>`
  `<target>`." Add/edit/delete; grouped by trigger field. Each row compiles to
  `enableWhen`/band-action/ending-jump.
- **Logic map (right):** a lightweight node graph (fields as nodes, rules as
  edges) for a bird's-eye view: read-only v1, using the existing DAG from
  `evaluate`. Reuses the agent-builder canvas conventions where cheap.
- **Inline validation:** reuse `validate.js` + `evaluate` diagnostics (cycles,
  dangling targets, unreachable fields) surfaced as warnings.

### 3.4 Small engine additions
- `jump-to-ending` action + multi-ending support in `settings.end[]` (selected
  by the first matching rule; default ending fallback). Keeps `evaluate` pure.
- Recall resolver: `resolveRecall(text, {answers, scores, hidden})` →
  interpolates `{{…}}` tokens; used by the renderer + title rendering.

### 3.5 Verify
- Unit: `layout.test.js` (visibility filtering), `evaluate.test.js` (already
  covers branch reveals; add jump-to-ending), recall resolver tests.
- E2E (preview): build "If pain ≥ 7 → show 'describe pain'; else skip to end";
  confirm the paged flow skips correctly and drop-off/required logic respect it.
- Keep PHQ-9 / GAD-7 regression fixtures green (clinical content unchanged).

---

## 4. Phasing
- **Phase 1 (foundation):** renderer honors `visibility` (branching goes live) +
  `layout` tests. Ships value immediately for forms authored via JSON/scores.
- **Phase 2 (authoring):** the Logic tab, rule list → `enableWhen`, inline
  validation, live Preview.
- **Phase 3:** jump-to-ending + multi-ending; recall/piping; hidden fields.
- **Phase 4:** logic map visualization; per-question analytics events.
