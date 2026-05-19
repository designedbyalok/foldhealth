# Project Instructions for Claude

This file is auto-loaded by Claude Code on every session in this repo. Add any
rules, preferences, or context you want Claude to follow. Bullets work fine —
keep entries short and specific. Newest at the top.

## Working agreements

- **Don't push to GitHub on your own.** I'll explicitly say "push" or
  "commit and push" when I want changes shipped. Default behavior is: edit
  files, verify locally, and stop. Committing locally is fine when I ask for
  a commit, but `git push` always requires an explicit ask.
- **No Co-Authored-By trailer in commits.** Do not add
  `Co-Authored-By: Claude …` or any similar attribution line to commit
  messages.
- **Always use reusable components from `src/components/`.** Drawer,
  Button, Toggle, Badge, Select, Slider, Switch, ConfirmDialog, etc.
  Search the components folder before writing a new one. New components
  should themselves be reusable primitives, not one-offs.
- **Follow the Fold Health typography system.** Inter is the only font.
  Use size/weight/color tokens from `src/tokens/tokens.css` — don't
  hand-pick `font-size`, `font-weight`, or hex colors.
- **Use Solar (Iconify) icons.** `solar:*-linear` variants first; custom
  SVGs only as a last resort, kept in shared icon modules. **All icons
  must render at 1px stroke** — never use `-outline` variants (they use
  heavier fill-based outlines). Custom SVGs must set `strokeWidth="1"`.
  A global CSS rule in `src/index.css` already forces Iconify linear
  icons from 1.5px down to 1px.

## Project overview

- React 19 + Vite 8 SPA, hash-based routing, Zustand state, Tailwind 4 + CSS
  Modules, Supabase backend, Bun as the package manager.
- Run with `bun install && bun run dev`. App listens on port 5173.
- Main feature areas live under `src/features/` — `tasks`, `agent-builder`,
  `home`, `calls`, `messages`, `analytics`, `settings`.

## Conventions

- Add new node types for the agent builder via
  `src/features/agent-builder/nodes/nodeConfig.js` (single source of truth —
  both NodePanel and ConversationNode read from it).
- Drawers across the app use the shared `Drawer` component (700px, 8px
  inset, 16px radius). Action buttons go in `headerRight`, never in `footer`.
- Solar (Iconify) icon set is the default. Reach for `solar:*-linear`
  variants first; only build a custom SVG when no good Solar match exists.

## When making changes

- Verify in the browser preview before claiming "done."
- Don't add comments that just restate what the code does — only keep the
  ones that explain *why*.
- Update `README.md`'s "Recent Changes" section when shipping a notable
  feature.
