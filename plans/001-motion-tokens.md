# 001 — Add motion tokens (easing + duration)

- **Status**: TODO
- **Commit**: c672e8b
- **Severity**: HIGH
- **Category**: Cohesion & tokens
- **Estimated scope**: 1 file (`src/tokens/tokens.css`), ~15 lines added

## Problem

`src/tokens/tokens.css` is 342 lines of colors, shadows, spacing — and zero motion tokens. There is no `--ease-*` variable and no `--duration-*` variable. Every animation across the app hand-types its curve and its milliseconds.

The result: `cubic-bezier(.4, 0, .2, 1)` (Material standard) is copy-pasted in 15+ places. `cubic-bezier(0.32, 0.72, 0.36, 1)` (iOS-like drawer curve) in another ~5. Durations drift: `.15s`, `150ms`, `.18s`, `180ms`, `.2s`, `200ms`, `.25s`, `250ms`, `.28s`, `280ms`, `.3s`, `300ms`, `.35s`, `350ms` — every choice is fresh.

Every other motion plan in this batch (reduced-motion strategy, killing `transition: all`, drawer easing, button press feedback) references these tokens by name. This plan lays the substrate; nothing after it works without it.

Current state (grepped, verbatim):

```css
/* src/tokens/tokens.css — no motion tokens defined anywhere in the file */
```

```css
/* src/index.css:60-66 — hand-typed */
body,
*,
*::before,
*::after {
  transition: background-color 200ms ease, color 200ms ease,
              border-color 200ms ease, fill 200ms ease, stroke 200ms ease,
              box-shadow 200ms ease;
}
```

```css
/* src/components/Drawer/Drawer.module.css:27 — hand-typed */
animation: slideIn 0.25s ease;
```

```css
/* src/features/hcc/DiagPanel/DiagPanel.module.css:5-6 — hand-typed */
transition: width 280ms cubic-bezier(0.32, 0.72, 0.36, 1),
            max-width 280ms cubic-bezier(0.32, 0.72, 0.36, 1) !important;
```

## Target

Add a `/* Motion */` block near the bottom of `src/tokens/tokens.css` (before any theme-override blocks) exposing exactly these tokens, verbatim:

```css
/* ═══════════════════════════════════════════════════════════
   Motion tokens
   Curves and durations for every UI transition. Never hand-type
   a cubic-bezier() or a duration in module CSS — reach for one
   of these tokens. See docs/motion.md for decision rules.
   ═══════════════════════════════════════════════════════════ */
:root {
  /* Easing */
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);         /* strong ease-out — default UI entrances/exits */
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);     /* strong ease-in-out — on-screen morphs */
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);      /* iOS-like drawer curve */
  --ease-hover: ease;                                  /* built-in ease — hover/color changes only */

  /* Durations */
  --duration-instant: 100ms;   /* button press feedback, near-instant response */
  --duration-fast: 160ms;      /* tooltips, small popovers, hover */
  --duration-base: 200ms;      /* default UI transitions */
  --duration-medium: 250ms;    /* dropdowns, selects, small drawers */
  --duration-slow: 300ms;      /* modals, drawers, large panels — hard ceiling for UI */
}
```

**Do not** add any other tokens. Do **not** change existing color/shadow tokens. Do **not** modify any CSS elsewhere in this plan — token adoption is separate plans (plans 002, 003, 004, 005, 006).

## Repo conventions to follow

- `src/tokens/tokens.css` is the single source of truth for design tokens. Every other stylesheet reads them.
- Existing token style: uppercase-free kebab-case (`--neutral-300`, `--status-success-light`, `--surface-overlay`) — motion tokens follow the same pattern.
- Comments in `tokens.css` use the boxed `═══` header pattern (see `--neutral-*` and status token headers) — mirror it.
- CLAUDE.md rule: tokens live in `src/tokens/tokens.css`; do not scatter them.
- Exemplar for the block placement + comment style: the `Neutral scale` header at the top of `src/tokens/tokens.css`.

## Steps

1. Open `src/tokens/tokens.css`. Scroll to the last `:root { … }` block currently in the file.
2. **After** that final `:root` block (or if there is only one `:root` block, at the end of the file but before any `@media` / `[data-theme]` overrides), append the Motion tokens block from the **Target** section above — copy it verbatim, including the boxed header comment.
3. Save the file. Confirm with `git diff src/tokens/tokens.css` that the diff is additive only.

## Boundaries

- Do **NOT** touch any other file. This plan is one file only.
- Do **NOT** rename or re-value any existing token.
- Do **NOT** start migrating call sites (`transition: all .15s` → `var(--ease-hover)`) — that is plans 004 and 006.
- Do **NOT** add motion tokens inside a `[data-theme='dark']` or `@media` block. Motion is theme-independent.
- Do **NOT** add new dependencies.
- If the file already contains any `--ease-` or `--duration-` token (grep first), STOP and report — a prior partial migration exists and this plan needs to be re-planned.

## Verification

- **Mechanical**:
  - `bun run lint:css` → passes (adds no new rules, only custom properties).
  - `bun run build` → passes (Vite bundles the CSS as-is).
  - `git diff --stat` shows exactly one file changed: `src/tokens/tokens.css`, ~15 additions, 0 deletions.
- **Feel check**: nothing should change visually — this plan defines tokens but doesn't consume them. Load `http://localhost:5173` after `bun run dev` and confirm the app looks and animates identically to before.
- **Token wiring check**: open DevTools → Elements → `<html>` → Computed panel → search "ease". Confirm `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` is listed. Same for `--duration-base: 200ms`.
- **Done when**: the six easing/duration tokens exist on `:root` and are visible in DevTools; no other file was touched; app still builds and looks identical.
