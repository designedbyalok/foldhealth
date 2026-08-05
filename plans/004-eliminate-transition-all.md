# 004 — Replace every `transition: all` with an explicit property list

- **Status**: TODO
- **Commit**: c672e8b
- **Severity**: HIGH
- **Category**: Performance
- **Estimated scope**: ~30 files, ~63 sites
- **Depends on**: 001 (motion tokens)

## Problem

`transition: all` is banned by the AUDIT ("always a finding"). It animates every changing property — including layout properties like `padding`, `width`, `border-width` — off the GPU. Every hover on a rule with `transition: all` pays for repaints it doesn't need.

`grep -rn --include="*.css" -E "transition: all|transition:all" src/` currently returns **63 hits** across ~30 files. Examples, verbatim:

```css
/* src/index.css:94 — checkbox */
transition: all .15s;

/* src/index.css:161 — (see file for context) */
transition: all .15s;

/* src/components/FilterBar/FilterBar.module.css:51 */
transition: all .15s;

/* src/components/FilterBar/FilterBar.module.css:248 */
transition: all .15s;

/* src/components/EngagementCard/EngagementCard.module.css:57 */
transition: all 400ms ease;

/* src/components/EngagementCard/EngagementCard.module.css:263 */
transition: all 400ms ease;

/* src/components/LiveDrawer/LiveDrawer.module.css:97 */
transition: all .15s;

/* src/components/TopBar/TopBar.module.css:240 */
transition: all .15s;

/* src/components/WorkflowPanel/WorkflowPanel.module.css:134, :176, :199 */
transition: all .15s;

/* src/components/ScheduleDrawer/ScheduleDrawer.module.css:359 */
transition: all .1s;

/* src/features/settings/AgentsTable.module.css:194, :228 */
transition: all .15s;

/* src/features/settings/CreateAgentDrawer.module.css:486 */
transition: all .15s;

/* src/features/settings/panels/GoalsPanel.module.css:7, :21, :78, :200, :206, :240, :284, :291, :296, :327, :408, :443 */
transition: all .15s;   /* and .2s */

/* src/features/settings/panels/EmbeddedComponents.module.css:209, :429, :484, (more) */
transition: all .2s;    /* and .15s */
```

There are more; the full list is produced by the discovery command in **Steps** below.

## Target

Every `transition: all …s` becomes a transition of the **exact properties the rule actually changes**, using motion tokens from plan 001.

For a typical hover/focus rule that swaps background + color + border-color, the target is:

```css
/* target pattern — safe for hover/focus interaction rules */
transition:
  background var(--duration-fast) var(--ease-hover),
  color var(--duration-fast) var(--ease-hover),
  border-color var(--duration-fast) var(--ease-hover);
```

For the specific outlier at `EngagementCard.module.css:57` and `:263` (`transition: all 400ms ease` — over the 300ms UI budget too):

```css
/* target — EngagementCard */
transition:
  transform var(--duration-base) var(--ease-out),
  box-shadow var(--duration-base) var(--ease-out),
  background var(--duration-base) var(--ease-out);
```

For sites where the animated properties include layout (`width`, `height`, `padding`), the target lists them explicitly — do NOT convert layout properties to `transform`; that's a different plan.

**Never** substitute a plain `transition: background 150ms ease;` verbatim — always use the tokens from plan 001 (`var(--duration-fast)`, `var(--ease-hover)` for hover, `var(--ease-out)` for entrances). A rule using `.15s`/`.2s` maps to `var(--duration-fast)`/`var(--duration-base)` respectively.

## Repo conventions to follow

- Tokens from plan 001 must already exist in `src/tokens/tokens.css`. If they don't, STOP — plan 001 has to land first.
- CSS Modules — every file that uses these transitions is a `*.module.css` (or `src/index.css` for globals). No JSX changes.
- Duration mapping (map the current hand-typed value to the closest token, do not invent new durations):

| Current | Token |
|---|---|
| `.1s`, `100ms` | `var(--duration-instant)` |
| `.15s`, `150ms`, `.16s`, `160ms` | `var(--duration-fast)` |
| `.18s`, `180ms`, `.2s`, `200ms` | `var(--duration-base)` |
| `.25s`, `250ms` | `var(--duration-medium)` |
| `.28s`, `280ms`, `.3s`, `300ms` | `var(--duration-slow)` |
| `> 300ms` on a UI element | `var(--duration-slow)` and flag in commit body |

- Easing mapping:

| Current | Token |
|---|---|
| bare `ease` on a hover/color rule | `var(--ease-hover)` |
| bare `ease` on an entrance/exit | `var(--ease-out)` |
| `ease-out` | `var(--ease-out)` |
| `ease-in-out` | `var(--ease-in-out)` |
| `cubic-bezier(0.32, 0.72, 0.36, 1)` or the `0.32, 0.72, 0, 1` variant | `var(--ease-drawer)` |
| `cubic-bezier(.4, 0, .2, 1)` (Material) | `var(--ease-out)` (this is the app's default UI curve) |
| bare `ease-in` on any UI transition | **stop** — the rule is broken; report the site for a separate review |

- Exemplar of a well-scoped hover transition already in the repo: `src/components/MenuPopover/MenuPopover.module.css:36-42` uses `transition: background 0.12s;` on `.row`, changing only the property it needs. The pattern this plan enforces.

## Steps

1. **Confirm plan 001 has landed** — `grep '\-\-ease-out\|\-\-duration-fast' src/tokens/tokens.css` must return hits. If not, STOP.
2. **Enumerate** all sites:
   ```bash
   grep -rn --include="*.css" -E "transition: all|transition:all" src/ > /tmp/transition-all-sites.txt
   wc -l /tmp/transition-all-sites.txt  # expect ~63
   ```
3. For each file in that list, **read the rule the transition applies to** and note which properties actually change in the `:hover`/`:focus`/`:active`/`.active` variants of the same selector. This is the property list to inline.
4. Rewrite each `transition: all …s [easing]` using the mapping tables above. Multiple properties → wrap the value:
   ```css
   transition:
     background var(--duration-fast) var(--ease-hover),
     color var(--duration-fast) var(--ease-hover),
     border-color var(--duration-fast) var(--ease-hover);
   ```
5. **Special case — the two `EngagementCard` rules** at lines 57 and 263: `400ms` is over budget. Read the surrounding `.card:hover` block to identify actual animated properties. Rewrite using the target pattern shown in **Target** above (`transform + box-shadow + background`, `var(--duration-base)`).
6. **Special case — `GoalsPanel.module.css`** has 12 uses of `transition: all` on a wizard flow. Read the wizard's hover/state rules; several will collapse to a single-property transition on `background`. Do not merge unrelated selectors.
7. Save each file. Re-run the discovery grep from step 2:
   ```bash
   grep -rn --include="*.css" -E "transition: all|transition:all" src/ | wc -l
   ```
   Expected: **0**.
8. `bun run lint:css` — passes.
9. `bun run build` — passes.

## Boundaries

- Do **NOT** convert transitioned layout properties (`width`, `height`, `padding`, `top`, `left`) to `transform` — that's a separate plan.
- Do **NOT** delete or add hover/focus states. This plan changes only the `transition` property.
- Do **NOT** rewrite a rule whose `transition: all` sits inside an `@keyframes` block (there shouldn't be any — but if there are, STOP and report).
- Do **NOT** invent new duration values. If a current site uses `.35s` on a hover, snap it up to `--duration-slow` and note it in the commit message. Do not add `--duration-350` or similar.
- Do **NOT** touch `src/index.css:60-74` (that's plans 002/003).
- Do **NOT** batch these into one giant commit — split by directory (`src/components/`, `src/features/settings/`, `src/features/hcc/`, etc.) so the diff is reviewable.
- If a site's real animated properties can't be inferred from the surrounding CSS (e.g. the rule targets a wrapper whose children swap classes), leave the `transition: all` alone, add a `/* TODO(motion-audit): explicit list */` comment above it, and list it in the PR description. Better to skip than to guess wrong.

## Verification

- **Mechanical**:
  - `grep -rn --include="*.css" -E "transition: all|transition:all" src/ | wc -l` → returns **0** (or the exact count of TODO-marked skips, listed in PR description).
  - `bun run lint:css` → passes.
  - `bun run build` → passes.
  - `bun run test` → passes (no unit test should depend on transition property).
  - Storybook build: `bun run build-storybook` → passes.
- **Feel check** (`bun run dev`):
  - Hover over a menu popover row, a filter chip, a top-bar item, a button: color/background transitions still fade smoothly.
  - Hover over an `EngagementCard`: transform + shadow now transition in 200ms (feel-check by comparing to the pre-plan 400ms — it should feel snappier and never feel jittery).
  - In DevTools Performance tab, record a 5-second sweep of hover over a worklist grid. Confirm paint activity is scoped to hovered elements only (no cascading paints on siblings).
  - DevTools Animations panel → set playback to 10% → hover a filter chip: verify only the intended properties tween.
- **Reduced-motion check**:
  - Rendering panel → emulate reduced motion.
  - After plan 002 landed, transitions still fire under reduced motion (that plan does not disable them). Confirm that behavior didn't regress.
- **Done when**: the discovery grep returns 0 (or a small documented set of skips), Storybook renders every component visually identically to pre-plan, and no reviewer can find a hover/focus in the app that no longer animates.
