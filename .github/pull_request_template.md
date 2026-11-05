## What & why

<!-- Short description of the change and the reason for it. -->

## Design-system checklist

- [ ] **Colors** use tokens (`var(--neutral-…/--primary-…/--status-…)`): no raw hex / `rgb()` / `hsl()`.
- [ ] **No `font-family`** declarations: Inter is applied globally.
- [ ] **Icons** are Solar `solar:*-linear` at 1px stroke: no `-outline` variants, no custom SVG where a Solar match exists.
- [ ] **UI reuses `src/components/*` primitives** (Button, Input, Select, Drawer, Badge, …) instead of raw HTML elements.
- [ ] **Drawers** with actions in `headerRight` include the `headerDivider` + `noCloseDivider` pattern.
- [ ] Verified in the browser preview.

> The **Design System Guardrails** check runs automatically on changed lines and must pass before merge.
> Run locally: `node scripts/ds-guardrails.mjs --staged`. Details in [CONTRIBUTING.md](../CONTRIBUTING.md#design-system).
