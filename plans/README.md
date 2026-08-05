# Animation Plans

Prioritized motion audit for Foldhealth. Written by the `improve-animations` skill against commit `c672e8b`.

Read the top-level audit findings in the chat that produced these plans (or regenerate with `/improve-animations`). Each plan is self-contained — the executor doesn't need any other context.

## Plans

| # | Title | Severity | Category | Status |
|---|---|---|---|---|
| [001](001-motion-tokens.md) | Add motion tokens (easing + duration) | HIGH | Cohesion & tokens | TODO |
| [002](002-reduced-motion-strategy.md) | Replace the blanket reduced-motion nuke with a scoped strategy | HIGH | Accessibility | TODO |
| [003](003-scope-theme-cross-fade.md) | Scope the theme-transition cross-fade instead of every node | HIGH | Performance | TODO |
| [004](004-eliminate-transition-all.md) | Replace every `transition: all` with an explicit property list | HIGH | Performance | TODO |
| [005](005-button-press-feedback.md) | Add press feedback to the shared Button component | HIGH | Physicality | TODO |
| [006](006-drawer-transitions.md) | Convert the Drawer entrance from keyframes to interruptible transitions | MEDIUM | Interruptibility + Easing | TODO |

## Recommended execution order

Land in this order — each plan builds on the substrate of the previous:

1. **001** — motion tokens. Substrate for everything else. Land first, alone.
2. **002** — reduced-motion strategy. Removes the `!important` blanket nuke and the universal `*` transition; the app has no global cross-fade between this landing and 003 landing. Ship 003 in the same PR or immediately after.
3. **003** — theme cross-fade. Puts the theme transition back, scoped correctly.
4. **004** — kill `transition: all`. Big diff, mechanical but touches ~30 files. Can be split by directory into 3-4 PRs.
5. **005** — Button press feedback. Small, high-visibility. Can land in parallel with 004.
6. **006** — Drawer transitions. Isolated to one component; can land any time after 001.

## Dependencies

```
001 (tokens)  ─┬─► 002 (reduced-motion)  ─► 003 (theme cross-fade)
               │
               ├─► 004 (transition: all)
               │
               ├─► 005 (button press)
               │
               └─► 006 (drawer)
```

- Everything depends on 001. Do not start 002-006 before 001 lands (each plan starts with a grep check that verifies the tokens exist).
- 003 depends on 002 (002 empties the slot, 003 fills it correctly). Ship them together.
- 004, 005, 006 are independent of each other after 001. They can be worked in parallel.

## What is NOT in this batch

Deliberately deferred to follow-up (see the audit table in the parent chat for context):
- Finding 6 (EngagementCard `transition: all 400ms ease`) — the `all` part is fixed by plan 004; the 400ms duration overshoot is fixed as part of that same rewrite. Not a separate plan.
- Finding 8 (`scale(0)` in `popgroups.css:39`) — one keyframe, low blast radius. Fix inline when someone touches that file.
- Finding 9 (Radix popover `transform-origin`) — needs a survey of which popovers already scale and which just fade; write after 001 tokens land so the transition side is consistent.
- Missed opportunities (list-row stagger, filter-change cross-fade) — additive, not corrective. Design decision, not audit debt.

## How to execute a plan

Read the plan top-to-bottom before touching any code. The "Boundaries" section is not advisory — plans are written for executors with zero context, so drift from the plan (touching adjacent files, "improving" other things) is a review-time reject.

Run the "Verification" section at the end. Both mechanical checks and feel checks. Motion plans can pass typecheck and lint and still land as regressions — the feel check is the real gate.

Update this table's Status column when a plan lands: `TODO` → `IN PROGRESS` → `DONE`. When all rows are `DONE`, run `/improve-animations reconcile` to sweep the codebase against the plans and surface any drift.
