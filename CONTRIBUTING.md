# Contributing

## Package manager

This repo uses **Bun**: never `npm` or `pnpm`. Use `bun install` and
`bun run <script>`. `bun.lock` is the source of truth; do not commit
`package-lock.json` or `pnpm-lock.yaml`.

**Bun version** is pinned in four places. Bump them together:

- `package.json` → `packageManager`
- `.github/workflows/{design-system,no-undef,cvx-sync}.yml` → `bun-version`
- `vercel.json` → `installCommand` / `buildCommand` (`bunx bun@<version> …`)

Vercel has no setting for the Bun version used by installs and builds
(`bunVersion` only switches the Functions *runtime*, and `packageManager`
pinning goes through Corepack, which covers pnpm/Yarn only), so it would
otherwise use whatever Bun its build image ships. Running the pinned Bun via
`bunx` fixes that; Bun re-exposes itself as `bun` to nested `package.json`
scripts, so the whole build tree runs on the pinned version.

## Design system

All UI must follow the Fold Health design system. These rules are enforced
automatically: **on the lines your change touches**, so existing code isn't
held against you, but new/modified code must comply.

| Rule | Do | Don't |
|------|----|-------|
| **Color** | `var(--neutral-400)`, `var(--primary-300)`, `var(--status-error)` … (see `src/tokens/tokens.css`) | Raw `#hex`, `rgb()`, `hsl()` in CSS or inline `style={{}}` |
| **Font family** | Nothing: Inter is applied globally | Any `font-family` declaration |
| **Icons** | Solar `solar:*-linear` at 1px stroke | `-outline` variants; non-Solar icon sets; custom SVG where a Solar match exists |
| **Components** | Reuse primitives from `src/components/*` (Button, Input, Select, Drawer, Badge, Checkbox, …) | Raw `<button>/<input>/<select>/<textarea>` in feature code |
| **Filter badges** | Use the shared `src/components/FilterChip` for every filter: same look + behaviour everywhere (`Label ⌄` → `Label : Value ✕`) | Re-implementing a `*FilterChip`, or using a plain `Select`/`<select>` as a filter |
| **Drawers** | Actions in `headerRight`; add `headerDivider` + pass `noCloseDivider` | A close button that draws its own border |
| **Component layers** | Add every new `src/components` folder to `src/components/layers.json`; primitives and patterns take data as props | A primitive or pattern importing `store/`, `features/`, `layouts/` or an app/domain component |

The layers, import boundaries and the shared prop vocabulary (`variant`,
`tone`, `size`, `value` / `defaultValue` / `onValueChange`, …) are in
[`docs/components/library-contract.mdx`](docs/components/library-contract.mdx).

### How enforcement works

- **Pre-commit** (`husky` + `lint-staged`): runs the guardrails on your staged
  changes before every commit.
- **CI** (`.github/workflows/design-system.yml`): runs on every PR to `main` /
  `preview` and **blocks merge** if a new violation lands on a changed line.
- The rule engine is `scripts/ds-guardrails.mjs`, which layers ESLint (JSX) and
  Stylelint (CSS) but reports **only violations on added/modified lines**.

### Run it yourself

```bash
node scripts/ds-guardrails.mjs --staged            # check staged changes
node scripts/ds-guardrails.mjs --base origin/main  # check your branch vs main
bun run lint                                        # full ESLint (whole repo)
bun run lint:css                                    # full Stylelint (whole repo)
```

### Notes / known gaps

- There is currently **no font-size / font-weight token scale** in
  `src/tokens/tokens.css`, so those aren't machine-enforced yet. Keep sizes
  consistent with existing components until a type scale is added.
- The existing codebase has ~3,500 pre-token values; they're being cleaned up
  incrementally and never block your PR.
