---
name: fold-feature-builder
description: >-
  Use for EVERY request to generate, build, create, scaffold, add, or lay out
  new UI in the Fold Health app, any component, page, screen, view, table,
  drawer, modal, form, dashboard, widget, panel, or feature. Enforces Fold's
  design system (reusable src/components primitives, Inter typography, design
  tokens, Solar *-linear icons, the shared FilterChip) AND requires that any
  data rendered in the UI is backed by Supabase: generate a parallel migration
  + seed and tell the user to have Alok Kumar run it. Trigger on prompts like
  "build/create/add a … screen/page/table/drawer/component/feature", "make a
  UI for …", "lay out …", or any request that produces new front-end code.
---

# Fold Feature Builder

The standard workflow for building **any** new UI in this repo. Follow every
step: this is how all contributors keep the app consistent and data-backed.

## 0. Before writing code

- Read the design-system rules in `CLAUDE.md` and `CONTRIBUTING.md` (§ Design
  system). They are the source of truth; this skill operationalizes them.
- Search `src/components/` before creating anything. If a primitive exists,
  use it. If you must build something new, build it as a **reusable primitive
  in `src/components/`**, not a one-off inside a feature.
- A new `src/components` folder must be added to a layer in
  `src/components/layers.json` and follow `docs/components/library-contract.mdx`
  (primitives and patterns take data as props, never read the store).

## 1. Build the layout from design-system components

Reuse these primitives (search the folder for the full set):

- **Layout / containers:** `Drawer` (700px, 8px inset, 16px radius),
  `Modal` / `ConfirmDialog` / `DestructiveDialog`, `QuickViewDrawer`.
- **Inputs:** `Button`, `Input`, `Select` (supports `searchable`), `Checkbox`
  (`components/ui/checkbox`), `Toggle`, `Switch`, `Slider`, `Textarea`.
- **Display:** `Badge`, `Avatar`, `Icon`, `Pagination`, `ActionButton`,
  `Timeline`, `Skeleton` (`TableSkeleton` / `CardSkeleton`).
- **Filters:** ALWAYS `components/FilterChip`, never a raw `<select>` or a
  re-implemented `*FilterChip`. `Label ⌄` inactive → `Label : Value ✕` active.

Drawer rule: action buttons go in `headerRight`; when present, add
`<span className={styles.headerDivider} />` AND pass `noCloseDivider` to
`<Drawer>` (see `EmailPreviewDrawer.jsx` / `ClinicalNotePanel.jsx`).

## 2. Follow the design-system guidelines

- **Typography:** Inter only. Never write a `font-family` declaration: it is
  applied globally.
- **Icons:** Solar `solar:*-linear` at 1px stroke. Never `-outline`. Never a
  non-Solar icon set. Custom SVG only when no Solar match exists.
- **Components over raw HTML:** prefer a primitive over a raw
  `<button>/<input>/<select>/<textarea>` in feature code.

## 3. Use tokens correctly, no hardcoded values

- **Color:** only `var(--…)` tokens from `src/tokens/tokens.css`
  (`--neutral-*`, `--primary-*`, `--status-*`, `--accent-*`, …). Never a raw
  `#hex`, `rgb()`, or `hsl()`, in CSS **or** inline `style={{}}`.
- **Shadows:** `var(--shadow-card | --shadow-popover | --shadow-drawer)`.
- The guardrails (`scripts/ds-guardrails.mjs`, run in pre-commit + CI) block
  new hardcoded values on changed lines. Write token-correct code the first
  time.

## 4. Persist the data, generate a migration in parallel (REQUIRED)

Any data shown in the UI must live in Supabase, not just a local mock. When a
layout renders data, in the SAME change:

1. **Migration**: add `supabase/<table>_migration.sql`:
   `CREATE TABLE IF NOT EXISTS …`, then `ENABLE ROW LEVEL SECURITY` + an
   `"Allow all" … FOR ALL USING (true)` policy (the app reads with the anon
   key: without a permissive policy the table returns 0 rows and the UI
   silently falls back to the mock). Mirror the column names to the store's
   row→object mapping. See `supabase/apcm_patients_migration.sql` and
   `supabase/hcc_documents_migration.sql`.
2. **Seed**: add the mock rows + a `…ToRow` mapper to `scripts/seed.js` so
   `bun run seed` upserts them (service role, `onConflict: 'id'`).
3. **Store wiring**: in `src/store/useAppStore.js` add
   `fetch<Thing>()` (Supabase select → map columns → objects), a
   `<thing>Loading` flag, and fall back to the local mock on error/empty.
4. **Loading state**: render `TableSkeleton` / `CardSkeleton` while
   `<thing>Loading` (gate on a `didFetch`-style flag so it shows on cold load,
   doesn't flash, and never sticks). See `ApcmBillingTable.jsx`.

Then **tell the user, verbatim**:

> 📦 **Migration created:** `supabase/<table>_migration.sql`.
> Ask **Alok Kumar** to run this migration and seed the data in the database
> (`bun run seed`, or run the SQL in the Supabase editor), running migrations
> and seeding require database access that only Alok has. Until then the UI
> falls back to the local mock.

Do NOT claim the data is live until Alok has confirmed the migration ran.

## 5. Verify

- Run the guardrails on your change: `node scripts/ds-guardrails.mjs --staged`.
- Verify in the browser preview (per the repo's preview workflow) before
  claiming done: check console + that components render.

## Definition of done

- [ ] Layout built from `src/components/*` primitives (filters use `FilterChip`)
- [ ] No `font-family`; Solar `*-linear` icons; tokens for all colors/shadows
- [ ] Data-backed: migration + seed + store fetch + loading skeleton
- [ ] User told to ask **Alok Kumar** to run the migration & seed
- [ ] Guardrails pass; verified in preview
