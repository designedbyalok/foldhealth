# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Fold Health is deliberately multi-persona: three roles are first-class and every design decision must serve them equally:

- **Care managers & clinicians**: work prioritized daily worklists (TOC 48h/7d, HEDIS, CCM, SNP, AWV, JSA), place calls, log tasks, close gaps, send forms. Optimize for fast triage and minimal clicks per patient touch.
- **HCC coders & risk-adjustment teams**: review each diagnosis against MEAT evidence with the chart in hand, move records through Support → Coder → QA → Compliance, ship ASM/Rebuttal files. Optimize for table density, evidence-heavy screens, and deep focus.
- **Operations & administrators**: design AI voice/chat agents, set escalation policies, curate knowledge base, manage chat groups, run campaigns, view audit logs. Config-heavy, lower daily volume, needs discoverability.

Fold sells to Transitional Care Organizations, Medicare Advantage plans and ACOs, and primary-care / value-based-care groups. The buyer is often ops leadership; the daily user is one of the three above.

## Product Purpose

Care operations platform for value-based care teams. Replaces the four-vendor stack (worklist + coding + voice/chat + analytics) with one workspace, one patient roster, and one story per member. The claim: never lose a member's context, never re-explain a chart to the next teammate, never hand-off from an AI agent to a human without carrying the state.

Success means the day's work, post-discharge follow-ups, risk-adjustment coding, HEDIS gap closure, chronic-care management, annual visits, agent-driven outreach, happens in one screen.

## Positioning

AI voice and chat agents ship *inside* the product, not as an integration. Care managers can design agent flows, assign them cases, monitor them live, and take a call back from the agent mid-conversation. That live human-in-the-loop is the differentiator a neighboring worklist vendor or a neighboring AI-agent vendor can't truthfully claim.

Secondary claim: every worklist (HCC/TOC/CCM/AWV/HEDIS/SNP/JSA) is a first-class native surface with its own data model and evidence flow, not a saved filter on one generic table.

## Operating Context

Internal-facing SaaS. Not a website, not a public-facing app. Care teams open it at the start of a shift, work it for hours, and close it. Sessions are long, screens are dense, and multiple tabs / patient drawers are often open at once.

Workflows the design must respect:
- **Worklist → row → drawer/profile → action → back to worklist** is the dominant loop for every persona.
- **Real-time and near-real-time**: active calls, live AI agent status, outreach logs update while the user watches. The UI should reflect this without startling.
- **Multi-patient context**: several patients in flight at once via drawers, tabs, and the quick-view overlay.
- **Compliance evidence**: every clinical / financial action leaves an audit trail visible to admins.

## Capabilities and Constraints

**Core capabilities**

- Seven distinct patient worklists (TOC, HCC, HEDIS, CCM, SNP, AWV, JSA) plus an All-Patients deduped union, each with its own filters, columns, and evidence flow.
- Patient P360: one profile with clinical history, care programs, outreach log, tasks, gaps, vitals, forms.
- Agent builder: visual editor for AI voice/chat agents with node graph, escalation policies, live monitoring.
- CCM time-tracking, APCM attestation, HCC RAF capture with MEAT evidence, billing workflows in-app.
- Campaigns, email builder, forms builder (drag-and-drop + scoring), messaging + chat groups.
- ~15 analytics dashboards from Executive → SDOH → ROI Simulator, with cohort → worklist send-back.
- Population Groups: static and dynamic (rule-builder over 22 patient fields) member cohorts.

**Technical / durable constraints**

- React 19 + Vite 8 SPA, hash-based routing, Zustand state, Tailwind 4 + CSS Modules, Bun package manager.
- Supabase backend (Postgres + Auth + RLS `authenticated`-only policies + Storage). Six patient-bearing tables with `member_id` as the identity key across slices.
- Every reusable primitive lives under `src/components/` with a Storybook story published on Chromatic.
- Design system: Fold tokens in `src/tokens/tokens.css`, Inter typography only, Solar `*-linear` icons at 1px stroke, shared `FilterChip` for every filter, shared `Drawer` (700px, 8px inset, 16px radius) for every side panel.
- Data-first rule: any new UI must be backed by Supabase (migration + seed), not mock data.
- Guardrails enforced pre-commit: `ds-guardrails.mjs` (no hardcoded hex, tokens only), `check-no-undef.mjs` (zero-tolerance for undefined vars), `receiver-audit.mjs` (prop contracts).

**Terminology to preserve**

- HCC coding stages: **ASM** (Ambulatory Support Matrix) / **Rebuttal** / **Missed-Dismiss**.
- Outreach outcomes: **Attended** / **Failed** / **Attempted** / **Unable to Reach** / **Engaged**.
- Care Programs: named programs (e.g. SNP, CCM, AWV) that a patient can be assigned to independently of the worklist they appear on.
- Fold ID: the customer-visible member identifier (formatted via `formatFoldId`), distinct from any Supabase primary key.

## Brand Commitments

- **Name:** Fold Health.
- **Design system:** Fold tokens are the single source of truth for color, spacing, typography, radius, shadow. No hardcoded hex outside tokens.css.
- **Typography:** Inter is the only font. Sizes/weights come from the token scale, never hand-picked.
- **Icons:** Solar (Iconify) `*-linear` variants at 1px stroke. No `*-outline` variants. Custom SVGs are a last resort.
- **Components:** Search `src/components/` before writing a new one. Every filter uses `FilterChip`. Every side panel uses `Drawer`. Every reusable primitive gets a Storybook story.
- **Drawer header rule:** action buttons in `headerRight` require an explicit `noCloseDivider` prop plus a manual `styles.headerDivider` between the last action and the close button.

## Evidence on Hand

Fold Health is an internal-facing SaaS app, not a public website. There are no customer testimonials, logos, published case studies, or ROI benchmarks to draw from in the UI. Any real customer data lives in Supabase behind RLS; every screenshot and demo dataset is seeded (see `scripts/seed.js` and `scripts/seed_p360_banner.js`) and future design work must not invent testimonials, customer names, or benchmark numbers to fill space.

## Product Principles

1. **One patient, one story.** A patient's context, chart, outreach log, care programs, tasks, gaps, is continuous across every worklist, drawer, and screen. Never make a teammate re-derive it.
2. **Every worklist is a first-class surface.** TOC, HCC, HEDIS, CCM, SNP, AWV, JSA each get their own data model, columns, and evidence flow, not a generic table with saved filters.
3. **AI agents live inside the product.** Voice and chat agents are designed, monitored, and taken back mid-conversation without leaving Fold. Human-in-the-loop is a first-class interaction, not an escape hatch.
4. **Compliance evidence is a feature, not friction.** MEAT for HCC, time-tracking for CCM, attestation for APCM, the evidence trail is visible where the clinical action happens.
5. **Density serves depth.** Care ops is table-heavy and detail-heavy. Design earns whitespace only when it clarifies; a shift-long user shouldn't hunt for information.

## Accessibility & Inclusion

WCAG 2.1 AA is the binding standard. All body text meets 4.5:1; large text and UI components meet 3:1. The `[data-contrast="high"]` mode ships an AAA-adjacent lift for older users and low-vision scenarios (`--neutral-500/400/300` → `#000000`) as an opt-in preference, but AA is the default floor every screen must clear before shipping.

Keyboard navigation is required end-to-end (all interactive controls reachable, focus rings honored). Screen-reader labels required on icon-only controls and every filter chip. The a11y check hook (`scripts/check-no-undef.mjs` + react-doctor findings) gates commits.
