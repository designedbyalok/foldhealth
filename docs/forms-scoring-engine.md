# Form Scoring Engine: Evaluation Spec (v1)

> Status: draft. Scope is the validated-instrument core. This document is the
> spec-lock for the pure evaluation function, build and test it in isolation
> before any Score-tab UI exists.

## 1. Purpose & scope

Defines how a filled form is evaluated into **scores**, **interpretation bands**,
**critical alerts**, and **actions**, deterministically. Covers the
validated-instrument core only: choice/boolean point sources; SUM / AVERAGE /
COUNT / MAX / MIN / WEIGHTED_SUM / COMPOSITE; bands; critical triggers; and four
band-action types (flag, careGap, route, branch).

**Out of scope (v1):** numeric value-mapping, FHIRPath/formula aggregation,
T-scores. The schema reserves slots for these so they slot in later without
re-architecting.

## 2. Data contracts

**Inputs**

- `FormDefinition` = `{ questionnaire, scores[], criticalTriggers[] }`, the FHIR
  `Questionnaire` plus the scoring config.
- `Answers` = map `linkId -> value | value[]` (the in-progress
  `QuestionnaireResponse`).

**Output: `EvaluationResult`**

```jsonc
{
  "visibility":  { "<linkId>": true|false },        // final, post-branch
  "scores": [
    { "id": "phq9_total", "value": 6, "status": "complete|partial|empty",
      "answered": 9, "applicable": 9, "range": { "min": 0, "max": 27 },
      "band": { "label": "Mild", "severity": "info", "min": 5, "max": 9 } | null }
  ],
  "criticalsTriggered": [
    { "triggerId": "phq9_q9_selfharm", "linkId": "phq9_q9", "value": 1,
      "alert": "...", "severity": "critical" }
  ],
  "actions": [                                       // merged + ordered (see §9)
    { "type": "flag", "source": "score:phq9_total:band:Mild" }
  ],
  "diagnostics": [ { "level": "warn", "code": "BAND_GAP", "msg": "..." } ]
}
```

The engine is a **pure function** `evaluate(FormDefinition, Answers) ->
EvaluationResult`. No I/O, no clock, no randomness, same inputs always yield the
same output. Side effects (writing flags, opening care gaps, routing) are
performed by the **caller** from `result.actions`; the engine only *decides*
them.

## 3. The dependency-DAG model (the core idea)

Naively, scoring and branching are mutually recursive: a branch action reveals a
section -> new fields become visible -> they feed a score -> the score changes ->
it triggers a different branch. Resolving that with a re-run-until-stable loop is
fragile (oscillation, non-determinism).

Instead, model the whole form as a **directed graph** and require it to be
acyclic. Then a single topological pass evaluates everything, in order, with no
iteration.

**Nodes:** every field, every `score`, and every branch-controlled section's
*visibility*.

**Edges (A -> B means "A must be evaluated before B"):**

| Edge | From -> To | Source |
|---|---|---|
| enableWhen | controller field -> controlled item's visibility | `item.enableWhen` |
| score-source | scored field -> score | `score.sources[]` |
| composite | child score -> parent score | `COMPOSITE` sources |
| branch | score -> target section's visibility | band `action.type=branch` |
| containment | section visibility -> fields inside it | structural |

A **cycle** means a section feeds a score whose band reveals/hides that same
section. This is rejected at author time (§7) and guarded at runtime (§8). Given
acyclicity, one topological sort gives a valid evaluation order and the engine
runs each node exactly once.

## 4. Evaluation pipeline

Build the DAG, topologically sort, then walk nodes in order. Concretely the walk
resolves, for each node type:

```
0. Normalize answers
1. Resolve visibility   (enableWhen, default section state)
2. Resolve scores       (per topo order; composites after children)
3. Match bands          (per score, if scoreable)
4. Apply branch actions (mutate downstream visibility: only nodes later in topo order)
5. Evaluate critical triggers
6. Collect + merge actions
```

Because branch targets are always *downstream* in the topological order
(guaranteed by acyclicity), step 4 only ever changes the visibility of nodes not
yet evaluated: so there is **no recompute**. This is the property that makes the
engine single-pass and deterministic.

### Stage 0: Normalize

- Coerce each answer to a canonical form (single value vs array per field type).
- An item is **answered** iff it has a non-empty value. Empty string / empty
  array / null = unanswered.

### Stage 1: Visibility

For each item, `visible = enableWhenResult AND notHiddenByBranch`.

- `enableWhen` uses the form's existing skip-logic (operators `=`, `!=`,
  `exists`, `>`, `<`, `>=`, `<=`; `enableBehavior: all|any`). A controller that
  is itself hidden evaluates as "condition not met."
- Branch-controlled sections start at their **declared default** (`hidden` or
  `shown`); branch actions in Stage 4 may override. In v1, **branch actions are
  reveal-only** (`reveal`): see §7 for why. "Hide when X" is expressed as a
  default-hidden section revealed on the complementary band.

### Stage 2: Score resolution

For score `S`, let:

- `Applicable(S)` = sources of `S` that are **visible** (a hidden item is never
  applicable).
- `Answered(S)` = applicable sources that are **answered**.

**Per-source contribution** `c(i)`:

- Single choice/boolean: point value of the selected option.
- Multi-select: `sum` of selected options' points (configurable to `max`;
  default `sum`).
- Reverse-scored item: `c(i) = item.range.min + item.range.max - raw(i)`.

**Aggregation:**

| Function | Definition |
|---|---|
| `SUM` | `Σ c(i)` over `Answered(S)` |
| `AVERAGE` | `Σ c(i) / D`, where `D = |Answered(S)|` if `missingPolicy=exclude`, else `|Applicable(S)|` |
| `COUNT` | `|{ i ∈ Answered(S) : predicate(i) }|`; default predicate `c(i) ≥ 1` |
| `MAX` / `MIN` | max / min `c(i)` over `Answered(S)` |
| `WEIGHTED_SUM` | `Σ w(i)·c(i)` over `Answered(S)` |
| `COMPOSITE` | aggregation (default SUM) over the **values of child scores**; evaluated after children via topo order |

**Status:**

- `empty`: `Answered(S)` is ∅.
- `partial`, some but not all *required* applicable sources answered.
- `complete`, all required applicable sources answered.

`value` is computed for `partial`/`complete`. Whether a `partial` score is
allowed to match a band is governed by `score.showPartialScore` (default
**false** -> partial scores report `band: null`).

### Stage 3: Band matching

If the score is scoreable (`complete`, or `partial` with
`showPartialScore=true`):

- Find the band where `band.min ≤ value ≤ band.max`.
- Bands are stored inclusive; the validator (§7) guarantees they tile
  `[range.min, range.max]` with no gaps or overlaps, so exactly one matches.
- No match (only possible if validation was bypassed) -> `band: null` +
  `diagnostic: BAND_NO_MATCH`.

### Stage 4: Branch actions

A matched band's `action.type=branch` sets `reveal` on its target section's
visibility node (downstream only). Already applied before those downstream nodes
are evaluated.

### Stage 5: Critical triggers

Independent of all scores and of form completeness. For each trigger:

- Fire iff its `linkId` is **visible AND answered AND** the value satisfies the
  condition (`> 0`, `= "yes"`, etc.).
- For a **numeric** condition (e.g. `> 0`) on a scored `choice` item, the
  comparison uses the selected option's *score*, not the raw option text, so
  "PHQ-9 Q9 > 0" means "any answer worth points." **String** conditions still
  match the raw answer value.
- A trigger fires even when the parent score is `partial`/`empty`, this is the
  whole point (low total, but a self-harm item is positive).

### Stage 6: Collect & merge actions

Gather actions from all matched bands plus critical triggers, then dedupe/merge
(§9) and order deterministically.

## 5. Missing / incomplete / skipped, the rules table

| Situation | Rule |
|---|---|
| Item hidden by `enableWhen` | Not applicable; excluded from every score's `Applicable` set; never feeds AVERAGE denominator |
| Item visible but unanswered | In `Applicable`, not in `Answered`. AVERAGE denominator depends on `missingPolicy` |
| `missingPolicy: exclude` (default) | Unanswered visible items drop out of the denominator (clinically correct for AVERAGE) |
| `missingPolicy: as_zero` | Unanswered visible items count as `0` and stay in the denominator |
| Form incomplete | Score reports `partial` + `answered/applicable`; band suppressed unless `showPartialScore` |
| Critical item | Fires regardless of overall completeness |

## 6. Determinism requirements

- Stable action ordering: by `(score topo index, band order, action declaration
  index)`; critical-trigger actions appended in trigger declaration order.
- No dependence on object/map key iteration order, sort sources by declared
  order.
- Forbidden in the engine: `Date.now()`, `Math.random()`, locale-dependent
  number formatting.
- `evaluate` is idempotent and referentially transparent.

## 7. Author-time validation (must pass before a form is publishable)

| Code | Check |
|---|---|
| `BAND_GAP` | Bands must cover `[range.min, range.max]` with no holes |
| `BAND_OVERLAP` | No two bands of one score may overlap |
| `RANGE_STALE` | Stored `range` must equal recomputed min/max possible |
| `CYCLE` | The dependency DAG must be acyclic (a section may not feed a score that controls its own visibility) |
| `DANGLING_SOURCE` | Every `score.source` linkId / child-score id must exist |
| `COMPOSITE_DEPTH` | Composite nesting bounded (e.g. ≤ 5) and acyclic |
| `LOCKED_EDIT` | Validated-instrument scales (PHQ-9 etc.) reject edits to points/cutoffs |

**Why branch is reveal-only in v1:** allowing a band to *hide* a section that
participates upstream reintroduces non-monotonic feedback and makes "no cycle"
harder to reason about. Reveal-only keeps visibility monotonically growing within
a pass, which (combined with acyclicity) gives a trivial termination proof. "Hide
on severe" is authored as a default-hidden section revealed by the non-severe
bands.

## 8. Runtime safety net

Even with author-time `CYCLE` validation, the runtime keeps a guard: if the
topological sort detects a back-edge (corrupt/legacy definition), abort with
`EvaluationError(CYCLE_AT_RUNTIME)` and return scores computed with all branch
actions suppressed (fail safe: never loop, never partially apply).

## 9. Action merge semantics

Merge key per type:

| Type | Merge key | On collision |
|---|---|---|
| `flag` | `(flag.label, severity)` | keep one; union of sources |
| `careGap` | `careGap.ref` | keep one; highest severity wins |
| `route` | `queue` | keep one; record all contributing scores |
| `branch` | `reveal target` | union (reveal-only, idempotent) |

Merging matters because two scores (e.g. PHQ-9 + GAD-7) can both route to the
same triage queue: the caller should act once.

## 10. Worked examples

### Example A: Low total, positive critical item (the safety case)

PHQ-9, `missingPolicy=exclude`, all 9 answered. Items 1–8 sum to 5; item 9
(self-harm) = 1 -> total **6**.

- Stage 2: `value = 6`, `status = complete`.
- Stage 3: band `5–9 = Mild (info)`.
- Stage 5: trigger `phq9_q9 > 0` -> **fires** (visible, answered, 1 > 0).
- Result: `band = Mild` **and** `criticalsTriggered = [phq9_q9]`. A
  "minimal-looking" score still surfaces the red alert. This is the case generic
  builders get wrong.

### Example B: AVERAGE with a skipped (hidden) item

5-item average scale, item 5 hidden by `enableWhen`. Items 1–4 answered with
points `3,2,4,1` (sum 10).

- `Applicable = {1,2,3,4}` (item 5 not applicable: hidden).
- `missingPolicy=exclude`: `D = 4` -> `value = 10/4 = 2.5`.
- If items 1–4 were applicable but item 4 *unanswered*: `exclude` -> `D=3`,
  `value=9/3=3.0`; `as_zero` -> `D=4`, `value=9/4=2.25`. Demonstrates the
  denominator rule.

### Example C: Score-driven branch (acyclicity in action)

Score `phq9_total ≥ 15` -> band `Moderately severe`, `action: branch reveal
section_safety_plan`. `section_safety_plan` contains a free-text field that is
**not** a source of `phq9_total`.

- DAG: `phq9 items -> phq9_total -> (visibility of section_safety_plan) ->
  safety-plan fields`. Acyclic.
- Topo walk: items -> score (18) -> band (Moderately severe) -> reveal safety
  plan -> safety-plan field becomes visible *after* the score is fixed, so it can
  never feed back into the 18. Single pass, deterministic.
- Counter-case rejected at author time: if a safety-plan field were added to
  `phq9_total.sources`, validation throws `CYCLE`.

## 11. Test checklist (success criteria)

Engine is correct when these pass (pure-function unit tests, no UI):

- [ ] SUM/AVERAGE/COUNT/MAX/MIN/WEIGHTED_SUM each match hand-computed totals
- [ ] AVERAGE denominator differs correctly under `exclude` vs `as_zero`
- [ ] Reverse-scored item computes `min+max-raw`
- [ ] Hidden item excluded from `Applicable` and from AVERAGE denominator
- [ ] `partial` status suppresses band unless `showPartialScore`
- [ ] Critical trigger fires on low total (Example A) and never on a hidden item
- [ ] Composite score evaluates after children; nesting beyond limit rejected
- [ ] Band gap / overlap / stale-range / dangling-source / cycle all rejected at author time
- [ ] Score-driven reveal applies once, single pass, no recompute (Example C)
- [ ] Action merge dedupes shared careGap/route across two scores
- [ ] `evaluate` is deterministic across 1000 repeated runs with shuffled answer-key order
- [ ] Runtime cycle guard returns fail-safe result, never loops
