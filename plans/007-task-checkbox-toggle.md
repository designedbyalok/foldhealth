# 007 — Animate the task checkbox toggle

- **Status**: TODO
- **Commit**: f72a4a0
- **Severity**: MEDIUM
- **Category**: Feedback + state indication
- **Estimated scope**: 1 file (`src/features/tasks/TasksView.module.css`), ~30 lines added; JSX untouched.

## Problem

The task-completion checkbox is the most-repeated state change in the app. Tapping it does two things simultaneously — the pill fills to green and a check icon appears inside it — but only the pill's `background` transitions; the check icon just materializes.

Current code, verbatim:

```jsx
// src/features/tasks/TasksView.jsx:624-630 (list view)
<button
  className={`${styles.taskCheckbox} ${isCompleted ? styles.taskCheckboxChecked : ''}`}
  onClick={e => { e.stopPropagation(); onToggle(task); }}
  aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
>
  {isCompleted && <Icon name="solar:check-read-linear" size={13} color="var(--neutral-0)" />}
</button>
```

The same JSX appears at [src/features/tasks/TasksView.jsx:816-822](src/features/tasks/TasksView.jsx:816) for the kanban card variant.

```css
/* src/features/tasks/TasksView.module.css:148-175 — current */
.taskCheckbox {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  border: 1.5px solid var(--neutral-200);
  background: var(--neutral-0);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 150ms, border-color 150ms;
  padding: 0;
}

.taskCheckbox:hover {
  border-color: var(--primary-300);
}

.taskCheckboxChecked {
  background: var(--status-success-bright);
  border-color: var(--status-success-bright);
}

.taskCheckboxChecked:hover {
  background: var(--status-success);
  border-color: var(--status-success);
}
```

Problems this plan fixes:
- The `<Icon>` child is conditionally rendered via `isCompleted && <Icon …>`, so the check icon mounts/unmounts instantly. AUDIT: state changes that teleport should get a bridge.
- The `background`/`border-color` transition uses raw `150ms` with no easing curve (browser default `ease`). Motion tokens exist (`--duration-fast`, `--ease-hover`) — this rule pre-dates them.
- No press feedback on the checkbox itself. Tapping it feels dead until the color swap fires.
- The button has no `transform` in the transition list, so any `:active` scale would jump.

## Target

The checkbox pill gets `transform` added to its transition, a press-feedback `:active` rule, and motion tokens applied to the existing color transitions. The check icon is rendered **always** (not conditionally) and scaled in/out via `@starting-style`-style CSS state — no JSX change to the render logic, but the conditional `{isCompleted && …}` becomes a class swap on an always-mounted icon wrapper.

The final result:
- **On toggle to checked**: pill background fills green (existing behavior, but tokenized), check icon scales from `0.6` to `1.0` and fades from `0` to `1` over 160ms `--ease-out`.
- **On toggle to unchecked**: icon reverses (`1.0 → 0.6`, `1 → 0`) and pill unfills. Same 160ms.
- **On press**: pill scales to `0.92` for the duration of the press.
- **`prefers-reduced-motion`**: no scale (transform: none), only the color and opacity transitions run.

```css
/* target — src/features/tasks/TasksView.module.css */

.taskCheckbox {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  border: 1.5px solid var(--neutral-200);
  background: var(--neutral-0);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition:
    background var(--duration-fast) var(--ease-hover),
    border-color var(--duration-fast) var(--ease-hover),
    transform var(--duration-fast) var(--ease-out);
  padding: 0;
}

.taskCheckbox:hover {
  border-color: var(--primary-300);
}

/* Press feedback — subtle scale-down while held.
   0.92 is slightly deeper than the Button primitive's 0.97 because the
   checkbox is a smaller hit target; the deeper press is still subtle at
   22px and reads more confidently. */
.taskCheckbox:active:not(:disabled) {
  transform: scale(0.92);
}

.taskCheckboxChecked {
  background: var(--status-success-bright);
  border-color: var(--status-success-bright);
}

.taskCheckboxChecked:hover {
  background: var(--status-success);
  border-color: var(--status-success);
}

/* Check icon — always mounted (JSX change below). Scale + opacity
   drive the state change so React never remounts the SVG. */
.taskCheckIcon {
  display: inline-flex;
  transform: scale(0.6);
  opacity: 0;
  transition:
    transform var(--duration-fast) var(--ease-out),
    opacity var(--duration-fast) var(--ease-out);
}

.taskCheckboxChecked .taskCheckIcon {
  transform: scale(1);
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .taskCheckbox:active:not(:disabled) {
    transform: none;
  }
  .taskCheckIcon {
    transform: none;
  }
  .taskCheckboxChecked .taskCheckIcon {
    transform: none;
  }
}
```

## Repo conventions to follow

- Motion tokens (`--duration-fast`, `--ease-out`, `--ease-hover`) live in [src/tokens/tokens.css](src/tokens/tokens.css) and are already used across the codebase after PR #102. Do not hand-type curves or durations.
- Press-feedback exemplar: `.btn:active:not(:disabled) { transform: scale(0.97) }` in [src/components/Button/Button.module.css:33](src/components/Button/Button.module.css:33). Same pattern with a tighter scale value here.
- Always-mounted + class-toggled visibility exemplar: any Radix-driven component that uses `data-state='open'/'closed'` (e.g. how the shared Drawer flips visibility via `data-closing`). This plan follows the same pattern: mount always, drive state via a class or `data-`.
- CLAUDE.md: `src/components/` is for reusable primitives — `.taskCheckbox` lives in the tasks feature and stays there; this is not the place to promote it. If a second surface (e.g. a subtasks panel) needs the same feel, promote at that time.
- Motion is on `transform` and `opacity` only. Never animate layout properties on this element.

## Steps

1. Confirm PR #102 has landed and the motion tokens exist: `grep -c '\-\-duration-fast\|\-\-ease-out' src/tokens/tokens.css` returns a positive number. If zero, STOP — plan 001 has to land first.
2. Open [src/features/tasks/TasksView.module.css](src/features/tasks/TasksView.module.css). Locate the `.taskCheckbox` rule at line 148.
3. Replace lines 148-175 with the **Target** CSS block above verbatim, including the new `.taskCheckIcon` rule and the reduced-motion block.
4. Open [src/features/tasks/TasksView.jsx](src/features/tasks/TasksView.jsx). At **line 625** (list-view `TaskRow`), replace:
   ```jsx
   {isCompleted && <Icon name="solar:check-read-linear" size={13} color="var(--neutral-0)" />}
   ```
   with:
   ```jsx
   <span className={styles.taskCheckIcon}>
     <Icon name="solar:check-read-linear" size={13} color="var(--neutral-0)" />
   </span>
   ```
5. At **line 821** (kanban-card `KanbanTaskCard`), do the exact same replacement. The two lines are identical.
6. Save. Run `bun run lint`, `bun run lint:css`, and `bun run build` — all pass.

## Boundaries

- Do **NOT** rename `.taskCheckbox` or `.taskCheckboxChecked` — every other file that references these classes is out of scope.
- Do **NOT** change the icon (`solar:check-read-linear`), its size (13), or its color (`var(--neutral-0)`).
- Do **NOT** change the checkbox dimensions (22×22), border radius, or border width.
- Do **NOT** move the `.taskCheckIcon` styles into the icon component itself — CSS Modules scoping is deliberate. Feature-local.
- Do **NOT** add JS refs, useEffect, or animation libraries. Pure CSS + one JSX wrapping element.
- Do **NOT** apply the same treatment to the standalone `<Checkbox>` component or the `input[type="checkbox"]` global in [src/index.css](src/index.css) — those are different primitives with different consumers.
- Do **NOT** touch the `.subtaskCard > .taskCheckbox` rule at line 1199 — it's a positional override, not a visual one.
- If the JSX at lines 625/821 has drifted since the commit stamp (e.g. the conditional was already refactored, or the checkbox was extracted to its own component), STOP and report instead of guessing.

## Verification

- **Mechanical**:
  - `bun run lint` and `bun run lint:css` → pass.
  - `bun run build` → passes.
  - `git diff --stat` shows exactly two files changed: `TasksView.jsx` (+2 lines net) and `TasksView.module.css` (~20 lines net).
- **Feel check** — with the preview at `http://localhost:5173`:
  1. Navigate to Tasks. Find any pending task in the list.
  2. Click its checkbox. The pill fills green **and** the check icon scales up from ~60% with a fade — no teleport. Both animations should feel like one gesture, not two.
  3. Click the checkbox again to uncheck. The check icon scales down and fades out; the pill unfills. Symmetric to the check direction.
  4. Click and **hold** the checkbox for a beat before releasing. The pill visibly shrinks to ~92% while held, snaps back on release.
  5. Switch to the Kanban view (there's a view toggle in the Tasks header). Repeat step 2-4 on a card checkbox. Behavior must be identical.
- **DevTools slow-motion**:
  - DevTools → Animations panel → set playback speed to 10%.
  - Toggle a checkbox. Confirm three parallel transitions: `background`, `border-color`, and `transform`/`opacity` on the icon — no restart, no jump, all smooth.
- **Reduced-motion**:
  - Rendering panel → emulate `prefers-reduced-motion: reduce`.
  - Toggle a checkbox. Icon appears/disappears via opacity fade (no scale). Pill fills via color transition (no scale). Press feedback (scale) is disabled.
  - Toggling should still feel responsive, just without any transform.
- **Done when**: the check icon smoothly scales in/out (both directions), press feedback is visible on hold, reduced-motion drops the transforms but keeps the color and opacity, and both TaskRow and KanbanTaskCard render identically after the change.
