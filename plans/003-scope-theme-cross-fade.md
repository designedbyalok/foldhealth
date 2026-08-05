# 003 — Scope the theme-transition cross-fade instead of applying it to every node

- **Status**: TODO
- **Commit**: c672e8b
- **Severity**: HIGH
- **Category**: Performance
- **Estimated scope**: 2 files (`src/index.css`, theme-switcher JS/JSX), ~30 lines
- **Depends on**: 001 (motion tokens), 002 (blanket reduced-motion nuke removed)

## Problem

To make theme flips look smooth, the app currently sets a 200ms transition on **every** DOM node for six properties. It's motivated well, but the implementation fires on every interaction — every worklist row hover, every focus change, every button press pays the cost of a universal-selector transition it doesn't need.

Current code, verbatim (already deleted by plan 002 — this plan reintroduces it correctly):

```css
/* src/index.css:60-66 — pre-plan-002 */
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
```

AUDIT rules this violates: category 5 (performance) — the universal selector `*` with six animated properties runs on every element in the DOM, every interaction, not only during theme flips. Per-element hover transitions inherit this and end up animating six properties instead of the one or two they need.

The theme switcher itself lives in `src/features/settings` (find with `grep -rn 'setAttribute.*theme\|data-theme' src/features/settings/`). It flips a `data-theme` attribute on `<html>` (or on `<body>`) and does not currently coordinate any transition state.

## Target

Move the cross-fade off the universal selector and gate it on an attribute that is only present during the theme flip. The cascade for the 200ms window looks correct; every hover after that runs without the tax.

**CSS side** — add to `src/index.css` in the same slot the pre-plan-002 rules occupied:

```css
/* target — src/index.css */

/* Theme transition cross-fade.
   Only fires while a theme flip is in progress. The theme switcher sets
   [data-theme-transitioning] on <html>, waits one frame, changes the
   [data-theme] value, then removes the attribute after --duration-slow.
   Between flips, no transition is applied globally — per-element CSS
   handles hover/focus color changes at its own cost. */
html[data-theme-transitioning],
html[data-theme-transitioning] *,
html[data-theme-transitioning] *::before,
html[data-theme-transitioning] *::after {
  transition:
    background-color var(--duration-base) var(--ease-hover),
    color var(--duration-base) var(--ease-hover),
    border-color var(--duration-base) var(--ease-hover),
    fill var(--duration-base) var(--ease-hover),
    stroke var(--duration-base) var(--ease-hover) !important;
  /* box-shadow deliberately dropped from the theme cross-fade — the shadow
     tokens don't retint on theme change enough to justify the paint cost. */
}

@media (prefers-reduced-motion: reduce) {
  html[data-theme-transitioning],
  html[data-theme-transitioning] *,
  html[data-theme-transitioning] *::before,
  html[data-theme-transitioning] *::after {
    transition: none !important;
  }
}
```

**JS side** — every theme flip in the app must go through a shared helper that stamps the attribute, defers, changes the theme, and clears the attribute after the transition. Add it as a module the theme switcher imports.

```js
// target — new file: src/lib/theme/applyTheme.js
// Coordinates <html data-theme> changes with the global cross-fade window.
// Never write to data-theme directly outside this helper — the transition
// attribute pair is the contract.

const TRANSITION_MS = 200; // must match var(--duration-base) in tokens.css

export function applyTheme(nextTheme) {
  const root = document.documentElement;
  if (root.getAttribute('data-theme') === nextTheme) return;

  root.setAttribute('data-theme-transitioning', '');

  // Wait one frame so the transitioning attribute has a chance to apply
  // before the color tokens change. Without this, the color swap and the
  // transition-property set race and the fade is inconsistent.
  requestAnimationFrame(() => {
    root.setAttribute('data-theme', nextTheme);
    setTimeout(() => {
      root.removeAttribute('data-theme-transitioning');
    }, TRANSITION_MS + 20); // +20ms cushion so the last frame commits
  });
}
```

Every current theme-flip call site is replaced with `applyTheme(nextTheme)`.

## Repo conventions to follow

- Shared libs live under `src/lib/`. See `src/lib/` for existing modules — mirror the structure (small named exports, no default).
- Zustand stores in `src/stores/` manage cross-cutting state. If the current theme lives in a Zustand store, the store's setter calls `applyTheme()`; the raw `setAttribute` moves out of the setter and into `applyTheme`.
- CLAUDE.md: use `bun`, not npm/pnpm. No new dependencies required for this plan.
- Exemplar for coordinated CSS + JS timing: `src/components/Drawer/Drawer.jsx` uses a `CLOSE_ANIM_MS = 250` constant that mirrors a CSS duration — mirror that pattern (constant + comment saying which token it matches).

## Steps

1. **CSS** — open `src/index.css`. In the same slot plan 002 emptied (right below the Iconify stroke block), paste the CSS from **Target** above verbatim.
2. **JS helper** — create `src/lib/theme/applyTheme.js` with the code from **Target** above verbatim.
3. **Locate theme switcher** — run `grep -rn "data-theme\|setAttribute.*theme" src/` and identify every call site that sets the theme. Expected locations: settings panels or a Zustand theme store.
4. **Migrate each call site** — replace every `document.documentElement.setAttribute('data-theme', X)` (and equivalents on `document.body`) with `applyTheme(X)`. Add the import.
5. **Sanity-check the initial theme** — the initial theme on page load should NOT go through `applyTheme` (no cross-fade at boot; the AUDIT calls out theme transitions only on user-initiated flips). If the app currently sets the initial theme via `setAttribute`, leave that untouched.
6. Save. Run `bun run lint`.

## Boundaries

- Do **NOT** reintroduce the universal `*` transition unconditionally. The `[data-theme-transitioning]` attribute is the required gate.
- Do **NOT** merge `applyTheme` into an unrelated setter — it's a standalone helper so unit tests can import it.
- Do **NOT** shorten the `+20ms` cushion on the `setTimeout`. The transition can miss its last frame otherwise, leaving the attribute stuck.
- Do **NOT** add the attribute to `<body>` — it must be on `<html>` so it can gate the `*` selector under it.
- Do **NOT** touch the token block from plan 001 or the reduced-motion block from plan 002.
- If `grep` finds zero call sites setting `data-theme`, the app has no theme switching yet — STOP and confirm with the user before writing dead code.

## Verification

- **Mechanical**:
  - `bun run lint` → passes.
  - `bun run lint:css` → passes.
  - `bun run build` → passes.
  - `git diff --stat` shows `src/index.css`, `src/lib/theme/applyTheme.js` (new), and the theme-switcher file(s).
- **Feel check — theme flip**:
  - `bun run dev`. Open `http://localhost:5173`.
  - Trigger the theme switcher.
  - Colors cross-fade over ~200ms. Border colors and fill/stroke on Iconify icons tint smoothly.
  - Box-shadows do NOT cross-fade (intentional — see the comment in the CSS).
- **Feel check — hover cost**:
  - DevTools → Performance → record a hover sweep over 30 worklist rows.
  - No frame drops. No paint on unrelated elements.
  - Before the plan, the recorded activity would include repaints on every `*` node during hovers; after, it doesn't.
- **DevTools attribute inspection**:
  - Right-click `<html>` → Break on → Attribute modifications.
  - Flip theme.
  - The debugger pauses on `data-theme-transitioning` being set, then on `data-theme` being set, then on `data-theme-transitioning` being removed. All three, in order.
- **Reduced-motion check**:
  - Rendering panel → emulate `prefers-reduced-motion: reduce`.
  - Flip theme — colors change instantly with no cross-fade. No 200ms window.
- **Done when**: theme flip still cross-fades smoothly; hover/focus interactions incur no universal-selector transition cost; the attribute is present only during the ~200ms flip window; reduced-motion collapses the fade.
