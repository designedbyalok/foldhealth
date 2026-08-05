# 002 — Replace the blanket reduced-motion nuke with a scoped strategy

- **Status**: TODO
- **Commit**: c672e8b
- **Severity**: HIGH
- **Category**: Accessibility
- **Estimated scope**: 1 file (`src/index.css`), ~20 lines changed
- **Depends on**: 001 (motion tokens)

## Problem

The global reduced-motion handler is too aggressive. It kills every transition on every element with `!important`, so users with the pref get a teleporting UI: drawers pop into existence, dropdowns snap, toasts appear with no fade, theme flips are jarring, focus rings jump.

Current code, verbatim:

```css
/* src/index.css:60-74 — current */
body {
  transition: background-color 200ms ease, color 200ms ease;
}

*,
*::before,
*::after {
  transition: background-color 200ms ease, color 200ms ease,
              border-color 200ms ease, fill 200ms ease, stroke 200ms ease,
              box-shadow 200ms ease;
}

/* Honor reduced-motion preference */
@media (prefers-reduced-motion: reduce) {
  body,
  *,
  *::before,
  *::after {
    transition: none !important;
  }
}
```

The AUDIT rule this violates: "Reduced motion means fewer and gentler animations, **not zero** — keep transitions that aid comprehension, remove position changes." The intent of the pref is to prevent motion sickness from position/scale movement, not to blind users to state changes.

`!important` here also defeats every well-scoped reduced-motion rule elsewhere in the codebase — the ten files that opt in via their own `@media (prefers-reduced-motion: reduce)` block are overridden.

## Target

Replace the current global reduced-motion rule with a scoped strategy that (a) does not use `!important`, (b) does not touch every element in the DOM, and (c) preserves opacity/color fades while shortening durations.

```css
/* target — src/index.css, replacing lines 60-74 */

/* Global theme-transition surface removed from this file — see plan 003.
   The 200ms cross-fade is opt-in via [data-theme-transitioning] toggled
   by the theme switcher, not applied to every element in the DOM. */

/* Reduced-motion strategy.
   The AUDIT rule: fewer and gentler, not zero. Users who set this pref
   are avoiding motion sickness from position/scale — they still need
   feedback for state changes. Opacity/color fades stay; position, scale,
   and rotation are dropped by per-component reduced-motion blocks (see
   src/features/hcc/DiagPanel/*.module.css for the exemplar). This global
   rule only caps duration so no legacy animation runs long. */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
  }
}
```

Note the deliberate choices:
- `animation-duration: 0.01ms` (not `none`) collapses `@keyframes`-based motion to imperceptibly short without disabling the animation state machine — the `@starting-style`/`data-mounted` patterns still fire their state changes.
- `animation-iteration-count: 1` stops infinite pulses/shimmers from running forever with the pref.
- `transition` is **not** blanket-disabled. Components that need to drop position/scale under reduced-motion do so in their own module CSS (see exemplars). Opacity fades survive.
- No `!important` on `transition` anywhere in this rule.
- Duration overrides use `!important` only because CSS module classes carry higher specificity — this matches how `src/features/hcc/DiagPanel/LeftWorkspace.module.css:19-21` and `src/features/hcc/DiagPanel/IcdRow.module.css:48-50` already handle it.

## Repo conventions to follow

- The a11y block sits directly under the theme-transition block in `src/index.css`. Keep it in the same location.
- Per-component reduced-motion blocks are the pattern — `src/features/hcc/DiagPanel/LeftWorkspace.module.css:19-21` shows the shape:
  ```css
  @media (prefers-reduced-motion: reduce) {
    .leftWs { animation: none; }
  }
  ```
  Components that opt in should override just their own transforms; this global rule provides the safety net.
- Exemplar for a well-behaved reduced-motion component: `src/components/FoldIdTag/FoldIdTag.module.css:21-23` — drops the transform but keeps everything else.

## Steps

1. Open `src/index.css`. Locate the block spanning **lines 60-74** (the `body {…}` theme transition, the `*, *::before, *::after {…}` universal transition, and the `@media (prefers-reduced-motion: reduce)` block).
2. **Delete lines 60-74** exactly (from the `body {` that opens the theme transition through the closing `}` of the `@media` block).
3. In the same spot, paste the **Target** block above, verbatim including the two comment blocks.
4. Save.
5. Run `bun run lint:css` and confirm clean.

## Boundaries

- Do **NOT** move or re-scope the theme transitions in this plan — that is plan 003. This plan removes them from the global cascade (plan 003 puts them back correctly). Between plan 002 landing and plan 003 landing, theme switching will have no cross-fade — that's fine; ship 003 in the same PR or immediately after.
- Do **NOT** touch any per-component `@media (prefers-reduced-motion: reduce)` blocks that already exist in module CSS. They keep working.
- Do **NOT** add `useReducedMotion()` calls anywhere in JS in this plan.
- Do **NOT** modify any other file.
- If the theme-transition block has already been moved to another file (grep for `data-theme-transitioning` or a global body transition somewhere other than `src/index.css:60-74`), STOP and re-plan.

## Verification

- **Mechanical**:
  - `bun run lint:css` → passes.
  - `bun run build` → passes.
  - `git diff src/index.css` shows one net deletion of ~14 lines and one net insertion of ~15 lines.
- **Feel check** (default pref, motion allowed):
  - `bun run dev`, open `http://localhost:5173`.
  - Hover a worklist row → the row-hover feedback still works (per-component transitions still fire).
  - Open a drawer → still slides in with its `slideIn` keyframe (plan 006 replaces this, not this plan).
  - Flip theme (light ↔ dark) — colors change instantly with no cross-fade (expected until plan 003 lands).
- **Feel check** (reduced motion enabled):
  - DevTools → Rendering panel → "Emulate CSS media feature prefers-reduced-motion: reduce".
  - Open a drawer — the `slideIn` keyframe collapses to 0.01ms so the drawer appears instantly with no slide (correct — this is the AUDIT-preferred behavior for keyframe-based movement).
  - Hover a worklist row — the color transition on the row still runs (it's a `transition`, not an `animation`, and the plan does not disable transitions).
  - Watch the on-call pulse indicator (`animation: oncallPulse … infinite`) — it stops after one iteration.
  - No spinning loader animates continuously (iteration-count capped at 1).
- **Done when**: with reduced-motion on, infinite pulses/shimmers stop and keyframe entrances collapse, but per-component color/opacity transitions still fire; with reduced-motion off, nothing changed except that the app no longer pays the global-`*` transition cost on every hover.
