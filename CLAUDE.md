# Project Instructions for Claude

This file is auto-loaded by Claude Code on every session in this repo. Add any
rules, preferences, or context you want Claude to follow. Bullets work fine,
keep entries short and specific. Newest at the top.

## Working agreements

- **Never touch the production database from a dev session without an
  explicit ask.** Production is Supabase project `osnihfqqrcchsaqhagcx`.
  Local dev, dev servers, browser previews, seeds and migrations go to the
  dev project (`.env.development.local`, see
  `docs/getting-started/dev-database.mdx`). Vercel preview deployments,
  including the `preview` Git branch, use that same Foldhealth Dev project.
  Production deployments stay on production. Before
  running a migration, a seed, `supabase db query --linked`, or starting a
  dev server, check which project the env points at; if it is production,
  stop and ask. On 2026-10-21 dev sessions made 88% of production API
  traffic and the database went down. Close browser preview tabs you no
  longer need: every open tab keeps a realtime socket and refetches on
  reconnect.
- **Never use em dashes (U+2014) anywhere.** This applies to
  everything you write: UI copy, form descriptions, docs, README entries,
  code comments, seed data, commit messages, PR descriptions, and chat
  replies. Empty values render as a hyphen `-`; code that reads rows saved
  before 2026-10-30 uses `isEmptyDash` from `src/lib/emptyDash.js` and the
  `\u2014` escape, never the literal character. Rewrite the sentence
  with a comma, colon, parentheses, or two separate sentences instead. En
  dashes (–) in numeric ranges are fine; the ban is on the em dash as a
  punctuation/aside device.

- **Building any new UI? Invoke the `fold-feature-builder` skill FIRST.**
  For every request that generates, builds, creates, scaffolds, or adds new
  front-end code (a component, page, screen, view, table, drawer, modal, form,
  dashboard, or feature), run the `fold-feature-builder` skill before writing
  code. It enforces the design system (reusable `src/components` primitives,
  Inter typography, tokens, Solar `*-linear` icons, the shared `FilterChip`)
  and requires that any data shown in the UI is persisted to Supabase, with a
  parallel migration + seed, and a note telling the user to ask **Alok Kumar**
  to run the migration and seed the database.
- **Drawer headers: NEVER let the close button draw its own border.**
  When `headerRight` has action buttons, pass `noCloseDivider` to `<Drawer>`
  AND insert your own `<span className={styles.headerDivider} />` (1px × 16px,
  `var(--neutral-150)`) between the last action button and the close button.
  This rule is the single most-repeated mistake, if you're putting anything
  in `headerRight`, you almost certainly need both pieces. See
  `EmailPreviewDrawer.jsx` / `ClinicalNotePanel.jsx` for the canonical
  pattern. Same divider class goes between distinct action groups.
- **Use Bun, never npm or pnpm.** Bun is the package manager + script
  runner for this repo. Always use `bun install` (not `npm install` /
  `pnpm install`) and `bun run <script>` (not `npm run` / `pnpm run`).
  The `bun.lockb` lockfile is the source of truth; introducing
  `package-lock.json` or `pnpm-lock.yaml` will desync deps. If you see
  Vite errors like `Failed to resolve import "@sentry/react"`, the fix
  is `bun install` from the worktree root, not switching managers.
- **Don't push to GitHub on your own.** I'll explicitly say "push" or
  "commit and push" when I want changes shipped. Default behavior is: edit
  files, verify locally, and stop. Committing locally is fine when I ask for
  a commit, but `git push` always requires an explicit ask.
- **No Co-Authored-By trailer in commits.** Do not add
  `Co-Authored-By: Claude …` or any similar attribution line to commit
  messages.
- **Component library contract.** Every `src/components` folder is listed in
  `src/components/layers.json` (primitives, patterns, app, domain). Primitives
  and patterns never import the store, features or layouts, and use the shared
  prop names (`variant` for emphasis, `tone` for intent, `size`
  `xs`/`sm`/`md`/`lg`, `value`/`defaultValue`/`onValueChange`). See
  `docs/components/library-contract.mdx`. The guardrails block violations.
- **Always use reusable components from `src/components/`.** Drawer,
  Button, Toggle, Badge, Select, Slider, Switch, ConfirmDialog, etc.
  Search the components folder before writing a new one. New components
  should themselves be reusable primitives, not one-offs.
- **Filter badges: always use `src/components/FilterChip`.** Every filter
  across the app must use this one component so filter badges look and
  behave identically (`Label ⌄` inactive → `Label : Value ✕` active, with a
  popover of options, optional `searchable`/`iconKind`). Never re-implement a
  `*FilterChip` or use a plain `Select`/`<select>` as a filter: the
  guardrails flag re-implementations. Migrate legacy filter UI to
  `FilterChip` when you touch it.
- **Follow the Fold Health typography system.** Inter is the only font.
  Use size/weight/color tokens from `src/tokens/tokens.css`, don't
  hand-pick `font-size`, `font-weight`, or hex colors.
- **Use Solar (Iconify) icons.** `solar:*-linear` variants first; custom
  SVGs only as a last resort, kept in shared icon modules. **All icons
  must render at 1px stroke**: never use `-outline` variants (they use
  heavier fill-based outlines). Custom SVGs must set `strokeWidth="1"`.
  A global CSS rule in `src/index.css` already forces Iconify linear
  icons from 1.5px down to 1px.

## Project overview

- React 19 + Vite 8 SPA, hash-based routing, Zustand state, Tailwind 4 + CSS
  Modules, Supabase backend, Bun as the package manager.
- Run with `bun install && bun run dev`. App listens on port 5173.
- Main feature areas live under `src/features/`: `tasks`, `agent-builder`,
  `home`, `calls`, `messages`, `analytics`, `settings`.

## Conventions

- Add new node types for the agent builder via
  `src/features/agent-builder/nodes/nodeConfig.js` (single source of truth,
  both NodePanel and ConversationNode read from it).
- Drawers across the app use the shared `Drawer` component (700px, 8px
  inset, 16px radius). Action buttons go in `headerRight`, never in `footer`.
- **Always place a divider between distinct groups of action buttons** in a
  drawer header. Use `<span className={styles.headerDivider} />` (1px ×
  16px, `var(--neutral-150)`) and pass `noCloseDivider` to `<Drawer>` so
  the close button doesn't add a second automatic border.
- Solar (Iconify) icon set is the default. Reach for `solar:*-linear`
  variants first; only build a custom SVG when no good Solar match exists.

## When making changes

- Verify in the browser preview before claiming "done."
- Don't add comments that just restate what the code does, only keep the
  ones that explain *why*.
- Update `README.md`'s "Recent Changes" section when shipping a notable
  feature.

---

## General behavior

These guidelines bias toward caution over speed. For trivial tasks, use
judgment.

### Think before coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them, don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### Simplicity first

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If
yes, simplify.

### Surgical changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it, don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the user's request.

### Goal-driven execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make
it work") require constant clarification.

**These guidelines are working if:** fewer unnecessary changes in diffs,
fewer rewrites due to overcomplication, and clarifying questions come
before implementation rather than after mistakes.
