# 006 — Convert the Drawer entrance from keyframes to interruptible transitions

- **Status**: TODO
- **Commit**: c672e8b
- **Severity**: MEDIUM
- **Category**: Interruptibility + Easing
- **Estimated scope**: 2 files (`src/components/Drawer/Drawer.jsx`, `src/components/Drawer/Drawer.module.css`), ~40 lines net change
- **Depends on**: 001 (motion tokens)

## Problem

The shared `Drawer` uses CSS `@keyframes` for its entrance and exit, combined with a JS `setTimeout` to defer unmount by 250ms. Three concrete problems:

1. **Keyframes restart from zero when re-triggered**. If a user opens the drawer, immediately closes it, and opens it again during the close animation, the second open plays the keyframe from `translateX(100%)` again — the drawer visibly teleports back off-screen for a frame before sliding in. CSS transitions retarget from the current state; keyframes don't.
2. **Easing is weak `ease`**. AUDIT calls for strong custom curves — `--ease-out` for entrances and `--ease-drawer` for the drawer-specific iOS-like curve. Bare `ease` starts and ends softly, robbing the drawer of felt weight.
3. **JS/CSS duration must stay in sync manually**. `CLOSE_ANIM_MS = 250` in JS and `slideOut 0.25s` in CSS are duplicated magic numbers. If one changes without the other, the drawer clips or lags. This is called out in the file comment on `Drawer.jsx:8`.

Current code, verbatim:

```jsx
// src/components/Drawer/Drawer.jsx:7-9
// Matches the slideOut / overlayOut animation duration in Drawer.module.css.
// Keep in sync — bumping one without the other clips or lags the exit.
const CLOSE_ANIM_MS = 250;
```

```jsx
// src/components/Drawer/Drawer.jsx:53-58
const requestClose = useCallback(() => {
  if (closing) return;
  setClosing(true);
  setTimeout(() => onClose?.(), CLOSE_ANIM_MS);
}, [closing, onClose]);
```

```css
/* src/components/Drawer/Drawer.module.css:11 */
.overlay {
  animation: overlayIn 0.25s ease;
}
.overlay[data-closing='true'] {
  animation: overlayOut 0.25s ease forwards;
}

/* :27, :33 */
.panel {
  animation: slideIn 0.25s ease;
}
.panel[data-closing='true'] {
  animation: slideOut 0.25s ease forwards;
}

/* :108-134 — four keyframe blocks */
@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
@keyframes slideOut { from { transform: translateX(0); } to { transform: translateX(100%); } }
@keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes overlayOut { from { opacity: 1; } to { opacity: 0; } }
```

## Target

Replace the four keyframe blocks with transitions driven by `data-closing` and, on mount, by `@starting-style`. Reference the close duration from a single CSS custom property so JS reads the same value.

**CSS side** — full replacement of the four keyframe blocks + `animation` declarations:

```css
/* target — src/components/Drawer/Drawer.module.css */

.overlay {
  position: fixed;
  inset: 0;
  background: var(--surface-overlay);
  z-index: 400;
  opacity: 1;
  transition: opacity var(--drawer-duration) var(--ease-out);
}
/* Mount state — opacity starts at 0 and transitions up to 1 on paint.
   Chromium + WebKit + Firefox 129+ support @starting-style. */
@starting-style {
  .overlay { opacity: 0; }
}
.overlay[data-closing='true'] {
  opacity: 0;
}

.panel {
  position: fixed;
  top: 8px;
  right: 8px;
  bottom: 8px;
  width: 700px;
  background: var(--neutral-0);
  z-index: 401;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-drawer);
  border-radius: 16px;
  overflow: hidden;
  transform: translateX(0);
  transition: transform var(--drawer-duration) var(--ease-drawer);
  /* Source of truth for the close duration — JS reads this via
     getComputedStyle(). Keep in ms so parseFloat works. */
  --drawer-duration: 250ms;
}
@starting-style {
  .panel { transform: translateX(100%); }
}
.panel[data-closing='true'] {
  transform: translateX(100%);
}

@media (prefers-reduced-motion: reduce) {
  .overlay,
  .panel {
    transition-duration: 0.01ms;
  }
}

/* Delete the four @keyframes blocks (slideIn, slideOut, overlayIn, overlayOut)
   entirely — nothing else references them. */
```

Note: because `--drawer-duration` is defined on `.panel` and read by JS from that node, the overlay reads it via the shared inheritance context inside the portal wrapper. To keep the property inheritable, also expose it on the wrapper — see JS side below where we `getComputedStyle(panelRef.current).getPropertyValue('--drawer-duration')`.

**JS side** — read the duration from CSS instead of duplicating a constant. Also memoize a ref to the panel so the read is cheap:

```jsx
// target — src/components/Drawer/Drawer.jsx (top of file)
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon/Icon';
import { CloseButton } from '../CloseButton/CloseButton';
import styles from './Drawer.module.css';

// Falls back to 250ms if the CSS custom property is unreadable (rare — SSR,
// portal not yet mounted). The CSS custom property `--drawer-duration` on
// `.panel` is the source of truth; do NOT hard-code the timing anywhere else.
const FALLBACK_CLOSE_MS = 250;

function readDrawerDurationMs(node) {
  if (!node) return FALLBACK_CLOSE_MS;
  const raw = getComputedStyle(node).getPropertyValue('--drawer-duration').trim();
  if (!raw) return FALLBACK_CLOSE_MS;
  const ms = raw.endsWith('ms') ? parseFloat(raw) : parseFloat(raw) * 1000;
  return Number.isFinite(ms) && ms > 0 ? ms : FALLBACK_CLOSE_MS;
}
```

And in the component body:

```jsx
// target — the requestClose flow
const panelRef = useRef(null);
const [closing, setClosing] = useState(false);

const requestClose = useCallback(() => {
  if (closing) return;
  setClosing(true);
  const ms = readDrawerDurationMs(panelRef.current);
  setTimeout(() => onClose?.(), ms);
}, [closing, onClose]);
```

Attach `ref={panelRef}` to the existing `.panel` div (the one that already has `data-closing`).

## Repo conventions to follow

- Motion tokens from plan 001 (`--ease-out`, `--ease-drawer`) are the source of truth for curves. Do not hand-type cubic-beziers here.
- `data-*` attribute driving state is the established pattern in this file — keep `data-closing='true'|'false'`. Just don't drive `animation`, drive `opacity` / `transform` via `transition`.
- The `@starting-style` at-rule is the modern replacement for JS `useEffect(() => setMounted(true))` gymnastics. If a supported browser lands on this and doesn't paint the initial state, the fallback pattern in **Steps** covers legacy Firefox/older WebKit — but the caniuse baseline (Chromium 117+, Firefox 129+, Safari 17.5+) is fine for production.
- Exemplar for a duration-token-driven transition: any transition in `src/features/hcc/DiagPanel/DiagPanel.module.css` after plan 004 lands. Copy the tokens-only pattern.
- CLAUDE.md rule: don't touch the Drawer's headerRight / close button divider logic. That stays as-is.

## Steps

1. Confirm plan 001 landed — `grep '\-\-ease-drawer\|\-\-duration-medium' src/tokens/tokens.css` returns hits. If not, STOP.
2. Open `src/components/Drawer/Drawer.module.css`.
3. Replace the `.overlay` and `.panel` rules (currently at lines 6-34) with the **Target** CSS block above.
4. **Delete** the four `@keyframes` blocks at lines 108-134 (slideIn, slideOut, overlayIn, overlayOut). Confirm no other CSS file references them — `grep -rn "slideIn\|slideOut\|overlayIn\|overlayOut" src/` returns only the deletions themselves. If any other file uses these keyframe names, STOP and re-plan; those consumers must migrate too or keep local copies.
5. Add the reduced-motion block from **Target** (below the panel rule).
6. Open `src/components/Drawer/Drawer.jsx`.
7. Add `useRef, useEffect` to the React import (if not already imported).
8. Replace the `CLOSE_ANIM_MS` constant + comment (lines 7-9) with the `FALLBACK_CLOSE_MS` constant + `readDrawerDurationMs` helper from **Target**.
9. Add `const panelRef = useRef(null);` at the top of the component body, alongside `const [closing, setClosing] = useState(false);`.
10. In the returned JSX, add `ref={panelRef}` to the existing `.panel` div (the one with `className={styles.panel}` and `data-closing={closing ? 'true' : 'false'}`).
11. Update `requestClose` to read the duration from the panel node (see **Target**).
12. Save both files.
13. `bun run lint` and `bun run lint:css` — both pass.

## Boundaries

- Do **NOT** change the `.overlay` z-index, background, or `inset`. Motion properties only.
- Do **NOT** change the `.panel` dimensions (`width`, `top`, `right`, `bottom`), border-radius, shadow, or z-index. Motion properties only.
- Do **NOT** convert other keyframe-based drawers in the codebase (e.g. `HccSftpReviewDrawer`, `HccAddDosDrawer`, `ChartDetailDrawer` — those have their own `@keyframes` blocks). This plan covers only the shared `Drawer` primitive. Feature drawers are separate plans.
- Do **NOT** remove `noCloseDivider`, `headerRight`, `banner`, or any other Drawer prop or feature. Motion only.
- Do **NOT** shorten the `+20ms` cushion — actually, this plan does not need one, because the transition timing is bound to the CSS variable and JS reads that value. Do not add cushions.
- Do **NOT** add `will-change: transform` on `.panel`. The drawer opens rarely; the memory cost isn't worth it.
- Do **NOT** switch to a spring-based animation library. This is a CSS transition change only.
- If a consumer of `<Drawer>` passes a custom width via the `width` prop, the transition still works — `transform: translateX(100%)` uses percentage of the element's own width. Do not break that. (Sanity-check: the HCC Document Review drawer sets `width={1300}`; test it after landing.)

## Verification

- **Mechanical**:
  - `bun run lint` → passes.
  - `bun run lint:css` → passes.
  - `bun run build` → passes.
  - `bun run test` → passes.
  - `grep -rn "slideIn\|slideOut\|overlayIn\|overlayOut" src/` returns nothing (or only unrelated CSS in other feature drawers).
- **Feel check — open + close**:
  - `bun run dev`.
  - Trigger any drawer (e.g. Settings → Insurance Plans → "Create insurance plan").
  - The drawer slides in from the right in ~250ms with a stronger, more decisive curve than the previous `ease`. The overlay fades in in parallel.
  - Click the overlay. The drawer slides out in ~250ms and unmounts cleanly (no flicker, no gap after the slide ends).
- **Feel check — interruption**:
  - Open the drawer. Immediately click the overlay to close it. While it's still sliding out (before it finishes), click the trigger to open it again.
  - The drawer should **retarget from its current mid-close position** and slide back in from wherever it was. It should NOT teleport back to `translateX(100%)` first and then slide.
- **Feel check — custom width**:
  - Open the HCC Document Review drawer (search for `<Drawer width={1300}` in the codebase — likely in `src/features/hcc/`).
  - The 1300px drawer slides in identically to the 700px default (uses `%` for the transform, not px).
- **DevTools slow-motion check**:
  - DevTools → Animations panel → set playback to 10%.
  - Open a drawer: the `transform` transitions from `translateX(100%)` to `translateX(0)` smoothly, and no other transform sneaks in.
  - Close it: transitions back to `translateX(100%)`.
- **Reduced-motion check**:
  - Rendering panel → emulate reduced motion.
  - Drawer appears near-instantly (`transition-duration: 0.01ms` from the reduced-motion block); no slide, no fade.
  - After plan 002, this is the expected AUDIT behavior — position/scale motion drops, but state still transitions.
- **JS sync check**:
  - In DevTools, set `document.querySelector('[class*="panel"]').style.setProperty('--drawer-duration', '600ms')` on a mounted drawer.
  - Click to close. The JS `setTimeout` should now wait 600ms (call the click and count Mississippi — it visibly takes longer than before). This proves the JS reads the CSS variable, not a hard-coded 250.
- **Done when**: open/close feels stronger (curve), rapid re-triggers retarget instead of restarting from zero, `CLOSE_ANIM_MS` is gone from `Drawer.jsx`, and the four `@keyframes` blocks are deleted.
