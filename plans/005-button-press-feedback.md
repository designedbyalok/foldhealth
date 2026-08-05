# 005 — Add press feedback to the shared Button component

- **Status**: TODO
- **Commit**: c672e8b
- **Severity**: HIGH
- **Category**: Physicality
- **Estimated scope**: 1 file (`src/components/Button/Button.module.css`), ~15 lines added
- **Depends on**: 001 (motion tokens)

## Problem

`src/components/Button/Button.module.css` is the shared `<Button>` primitive used across the entire app — every drawer footer, form action, table action, filter clear, dialog confirm. It has hover styles but **no `:active` state**. Every click on every button feels dead: no press response, no tactile confirmation.

Current code, verbatim:

```css
/* src/components/Button/Button.module.css:14-31 — current .btn base */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-family: 'Inter', sans-serif;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  border: none;
  outline: none;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  flex-shrink: 0;
  -webkit-appearance: none;
  appearance: none;
  line-height: 1;
}
```

No `.btn:active`. No `transform: scale(...)`. The AUDIT specifies press feedback as:

> Press feedback: `transform: scale(0.97)` on `:active` with `transition: transform 160ms ease-out`. Keep it subtle (0.95–0.98).

This is the highest-frequency-of-use fix in the audit — every button in the app benefits from a 15-line change to one file.

Two adjacent primitives already do this correctly and serve as exemplars:
- `src/components/CloseButton/CloseButton.module.css:17` — `.btn:active {...}` (present, verify pattern)
- `src/components/DetailDrawer/DetailDrawer.module.css:653` — `.iconBtn:active {...}` (present)

## Target

Add press feedback to the base `.btn` rule, add `transform` to its transition list, and confirm disabled/hover states still layer correctly.

```css
/* target — src/components/Button/Button.module.css */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-family: 'Inter', sans-serif;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  border: none;
  outline: none;
  transition:
    background var(--duration-fast) var(--ease-hover),
    color var(--duration-fast) var(--ease-hover),
    border-color var(--duration-fast) var(--ease-hover),
    transform var(--duration-fast) var(--ease-out);
  flex-shrink: 0;
  -webkit-appearance: none;
  appearance: none;
  line-height: 1;
}

/* Press feedback — subtle scale-down on active. Applies to every button type
   through the shared base class. AUDIT: 0.95–0.98 range; 0.97 is our default. */
.btn:active:not(:disabled) {
  transform: scale(0.97);
}

/* Reduced-motion respect — drop the scale but keep the color transition,
   consistent with plan 002's "fewer and gentler, not zero" strategy. */
@media (prefers-reduced-motion: reduce) {
  .btn:active:not(:disabled) {
    transform: none;
  }
}
```

Exact deltas:
- Line 26 `transition: background 0.15s, color 0.15s, border-color 0.15s;` becomes a 4-property list including `transform` and uses tokens.
- New `.btn:active:not(:disabled)` rule appended after the `.btn` base (before the `.btn:focus-visible` rule, or immediately after `.btn` — either works).
- New `@media (prefers-reduced-motion: reduce)` block for the button.

## Repo conventions to follow

- Motion tokens from plan 001 live in `src/tokens/tokens.css`. This plan must not run until they exist — `grep '\-\-ease-out' src/tokens/tokens.css` must return a hit.
- Existing `:active` exemplars: `src/components/CloseButton/CloseButton.module.css:17`, `src/components/DetailDrawer/DetailDrawer.module.css:653`, `src/components/VoicePreviewPopover/VoicePreviewPopover.module.css:103`. Same pattern (scale-down + transform in transition).
- CLAUDE.md: reusable primitives in `src/components/` are the substrate. Changing the shared `<Button>` propagates the fix to every consumer with no consumer changes required.
- Storybook stories exist for `Button` — `src/components/Button/Button.stories.jsx` (search Chromatic-published stories under [Storybook 6a61dbc8d0f0c8fbac7a34f1](https://www.chromatic.com/library?appId=6a61dbc8d0f0c8fbac7a34f1)).

## Steps

1. Confirm plan 001 landed: `grep '\-\-ease-out\|\-\-duration-fast' src/tokens/tokens.css`. If empty, STOP.
2. Open `src/components/Button/Button.module.css`.
3. Replace line 26 (`transition: background 0.15s, color 0.15s, border-color 0.15s;`) with the four-property version from **Target**.
4. Immediately after the closing `}` of `.btn { … }` (line 31), insert:
   ```css
   .btn:active:not(:disabled) {
     transform: scale(0.97);
   }

   @media (prefers-reduced-motion: reduce) {
     .btn:active:not(:disabled) {
       transform: none;
     }
   }
   ```
5. Save.
6. `bun run lint:css` and `bun run build` — both pass.
7. `bun run storybook` — Storybook renders; the Button story shows the effect on `:active` when clicked and held.

## Boundaries

- Do **NOT** modify per-variant styles (`.primary`, `.secondary`, `.tertiary`, `.ghost`, `.alt`, `.success`, `.danger`, `.dangerFilled`, `.info`). The scale is applied to the base `.btn` and cascades.
- Do **NOT** change the scale factor. `0.97` is the app default. AUDIT allows 0.95–0.98 for special cases; buttons stay at 0.97.
- Do **NOT** apply the transform on `:disabled` — the `:not(:disabled)` guard is required.
- Do **NOT** duplicate the `:active` rule on hover-capable devices only. `pointer: fine` is not required for `:active` (unlike `:hover`, `:active` fires on touch too and touch users expect the same tactile feedback).
- Do **NOT** touch `CloseButton`, `IconButton`, `DetailDrawer.iconBtn` — those already have their own `:active` handling with the same 0.97 factor. Leave them alone.
- Do **NOT** add a `will-change: transform` hint on `.btn`. The transform is briefly applied and modern browsers handle it; `will-change` on a shared primitive costs memory for negligible gain.
- If the file already has a `.btn:active` rule (grep first), STOP and report — a partial migration exists.

## Verification

- **Mechanical**:
  - `bun run lint:css` → passes.
  - `bun run build` → passes.
  - `bun run test` → passes (no test asserts on `transform: none`).
  - Storybook build (`bun run build-storybook`) → passes.
- **Feel check** (`bun run dev`):
  - Open `http://localhost:5173`. Find a page with obvious buttons (Settings → Insurance Plans, or any drawer footer).
  - Click and **hold** a primary button. It scales down to 97% and stays there while held. Release: it scales back.
  - Click a disabled button (grey). No scale effect.
  - Move focus to a button with keyboard (`Tab`). Focus ring appears. Press `Space` — button visibly presses (scales) then releases.
  - Sanity-check each variant: primary, secondary, tertiary, ghost, alt, success, danger, dangerFilled, info. All press identically.
- **DevTools slow-motion check**:
  - DevTools → Animations panel → set playback to 10%.
  - Click a button and observe the 160ms scale transition: smooth, no jitter, no other properties tween unexpectedly.
- **Reduced-motion check**:
  - Rendering panel → emulate `prefers-reduced-motion: reduce`.
  - Click and hold a button — no scale. Color/background still cross-fade on hover as before.
- **Regression check**:
  - Hover a button: background + border transitions still work (they now use tokens; visually identical).
  - Focus a button with keyboard: `box-shadow: 0 0 0 2px var(--primary-100)` focus ring still appears (unchanged).
- **Done when**: every button in the app has a visible press response on click/tap, disabled buttons stay static, and reduced-motion users see the color hover but not the scale.
