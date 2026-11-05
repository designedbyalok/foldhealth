# Agent Runtime: Implementation Plan

_Turning the agent-builder from a UI shell into a real, callable AI agent._
_Planned 2026-08-06. Work starts 2026-08-07._

## Where we are

The builder is UI-complete but has no runtime:

- **Canvas**: `src/features/agent-builder/AgentCanvas.jsx` persists flows
  (nodes/edges/versions) to `agent_flows` via `saveFlow` / `createFlowVersion`
  in `src/store/useAppStore.js` (~line 2830).
- **Configure**: `ConfigurePanel.jsx` + `GlobalSettings.jsx` persist to
  `agent_config` (JSON blobs). The model dropdown (`LLM_MODELS` in
  `GlobalSettings.jsx`) writes to `builderAgent.globalSettings`, **not**
  `agents.model`, it's cosmetic.
- **Chat**: `ChatPanel.jsx` is keyword-matching mock (regex over "add node",
  "remove node", etc. + `flowGenerator.js` templates). No LLM anywhere.
- **Analytics**: mock data.
- **Storage**: `agents` (now with `model`/`role`/`avatar_url` columns),
  `agent_flows` (versioned, `is_current` unique index), `agent_config`.
- **Edge functions**: pattern already exists: `supabase/functions/delete-user`,
  `supabase/functions/featurebase-jwt`.

## Architecture decisions (recommended)

| Decision | Choice | Why |
|---|---|---|
| Run endpoint host | **Supabase Edge Function** (`agent-run`) | Pattern exists in repo; secrets already live in Supabase; same auth boundary as the SPA (Supabase JWT); tools/KB handlers sit next to the data. Vercel Functions remain a fallback (repo is Vercel-linked) if Deno limits bite. |
| Provider layer | **Vercel AI Gateway** (one key, OpenAI-compatible endpoint / AI SDK `gateway()` ids) | One auth boundary for OpenAI + Anthropic + Gemini; retries, fallbacks, per-key cost tracking built in. Key stored via `supabase secrets set AI_GATEWAY_API_KEY=…`, never in client `.env`. |
| Model identity | **Canonical gateway ids** (`openai/gpt-4.1-mini`, `anthropic/claude-opus-4-7`) in `agents.model`; display labels live in one registry module | Display strings like "ChatGPT 4.5 Mini" can't route. One `src/lib/modelRegistry.js` maps id ⇄ label for the table + dropdowns. |
| Prompt compilation | **Client-side at save time**, persisted to `agent_flows.compiled_prompt` | Runtime never re-walks the graph per message. Pure function → unit-testable. |
| Transcripts | New `agent_sessions` + `agent_messages` tables | Runtime needs history per session; analytics (M3) aggregates from the same rows. |

### Open decisions (settle tomorrow, before code)

1. **ChatPanel dual role.** Today it's a *flow-editing copilot* (add/remove
   nodes). The review treats it as the *agent test chat*. Recommendation:
   split into two modes/tabs: "Test agent" (talks to `agent-run`, M1) and
   "Edit flow" (keep the current copilot; make it LLM-backed later).
2. **Which 2–3 tools ship in M2**, proposal below: `kb_search`,
   `appointment_lookup` (backed by `appointments` table),
   `patient_chart_summary` (backed by `all_patients`).
3. **Gateway account/key ownership**: need an AI Gateway API key before M1
   day 2.

---

## Phase 0: Keys & model plumbing (Day 1, ~half day)

1. Create the AI Gateway key → `supabase secrets set AI_GATEWAY_API_KEY=…`.
2. `src/lib/modelRegistry.js`, single source of truth:
   `[{ id: 'openai/gpt-4.1-mini', label: 'GPT 4.1 mini', provider: 'openai' }, …]`.
3. Migration `supabase/agents_model_canonicalize.sql`, normalize existing
   `agents.model` display strings → canonical ids (idempotent `UPDATE … WHERE`).
4. Wire the Configure/GlobalSettings model `Select` to read/write
   `agents.model` (via the store's agent update path), sourced from the
   registry. AgentsTable's Model column renders `label` from the registry.

**Verify:** change model in builder → row updates in Supabase → AgentsTable
shows new label after reload.

## Phase 1: M1: Compiled prompt + run endpoint + real chat (Week 1)

### 1.1 Prompt compiler
- `src/lib/promptCompiler.js`, pure `compilePrompt({ nodes, edges, config, agent })`:
  - Walk the graph from `startNode` following edges (breadth-first, cycle-safe).
  - Each `conversationNode` → a numbered scoped instruction: label, prompt,
    per-node `guardrails`, `transitions` rendered as "if X → go to step N".
  - `nodeType` variants (`callTransfer`, `escalation`) → explicit hand-off
    instructions; `endNode` → completion criteria.
  - Merge `agent_config`: `system_prompt`, tone, empathy/pace, languages,
    `selected_policies` as hard rules.
- Unit tests against the seeded TOC flow in `agent_flows_migration.sql`
  (orphan nodes, cycles, missing transitions).

### 1.2 Migrations (idempotent, run via aws-1 session pooler)
- `agent_flows` + `compiled_prompt TEXT`, `compiled_at TIMESTAMPTZ`.
- `agent_sessions` (id, agent_id, user_id, channel `test|web|phone`,
  started_at, ended_at, status) and `agent_messages` (id, session_id, role,
  content, tool_calls JSONB, tokens_in/out, latency_ms, created_at). RLS on.
- Seed one test session per seeded agent so the UI never renders empty.

### 1.3 Compile on save
- In `useAppStore.js`: `saveFlow` and `createFlowVersion` call
  `compilePrompt` and write `compiled_prompt`/`compiled_at` with nodes/edges.

### 1.4 `agent-run` edge function
- `supabase/functions/agent-run/index.ts`, following the `delete-user`
  CORS/auth shape:
  - Input `{ agent_id, session_id, message }`; validate Supabase JWT.
  - Load `agents` (model) + `agent_config` + current flow's `compiled_prompt`
    + last N `agent_messages` for the session.
  - Call the gateway (AI SDK `streamText` with `gateway('<agents.model>')`,
    or plain fetch to the OpenAI-compatible endpoint) and **stream SSE** back.
  - On completion: persist user + assistant messages, tokens, latency.

### 1.5 ChatPanel → real chat
- Add "Test agent" mode: streams from `agent-run` via
  `supabase.functions.invoke`/fetch + SSE reader; typing indicator already
  exists. Replace the `dangerouslySetInnerHTML` markdown hack with safe
  rendering while in there.
- Keep the existing flow-edit commands under the "Edit flow" mode.

**Verify (M1 done):** open builder → Test agent → send "hi" → streamed reply
follows the compiled TOC script; rows appear in `agent_messages`; changing
`agents.model` changes the provider actually hit (check gateway logs).

## Phase 2: M2: Knowledge base + tools (Weeks 2–3)

### 2.1 pgvector KB
- Migration: `CREATE EXTENSION IF NOT EXISTS vector`;
  `knowledge_base_entries` (id, kb_id, agent_id scope, title, chunk,
  embedding vector, metadata JSONB) + HNSW index; `match_kb_entries` RPC
  (cosine, top-k, kb_id filter).
- Embed at write time via gateway embeddings (small edge function
  `kb-embed`, or inline in the save path).
- Configure panel's Knowledge Base section persists real `kb_ids`.

### 2.2 Tool framework in `agent-run`
- Tool registry: `{ name, description, inputSchema (zod/JSON-schema), handler }`.
- v1 tools: `kb_search` (RPC above), `appointment_lookup` (`appointments`),
  `patient_chart_summary` (`all_patients`, honoring RLS).
- Tool loop with `maxSteps` cap; tool calls + results persisted on
  `agent_messages.tool_calls`; streamed as events so ChatPanel can render
  tool chips.

### 2.3 `agent_config` schema upgrade (review gap #3)
- Migration adding discrete columns: `tool_ids TEXT[]`, `kb_ids TEXT[]`,
  `model TEXT`, `temperature NUMERIC`, backfill from the JSON blobs, keep
  blobs during transition, switch store reads to columns.

**Verify:** ask the test agent a KB question → `kb_search` fires → grounded
answer; ask for an appointment → `appointment_lookup` returns a real row.

## Phase 3: M3: Guardrails, audit, real analytics (Weeks 4–5)

- `agent_runs` metrics table (session_id, model, tokens, cost_usd,
  latency_ms, outcome, escalated), written by `agent-run` per turn.
- Plug runs into the existing `audit_logs` table.
- Inbound PHI redaction pass + moderation check before each response;
  compliance policies from Configure become injected prompt fragments or
  hard-blocked patterns.
- Rate limits per agent per user (simple counter table or upstash later).
- `AnalyticsPanel.jsx`: replace mocks with aggregates over
  `agent_runs`/`agent_sessions`; per-agent cost & latency.
- Restore the **Version** column in AgentsTable from `agent_flows.version`
  where `is_current` (review gap #2).

**Verify:** run 10 test conversations → AnalyticsPanel numbers match SQL
aggregates; a message containing seeded PHI gets redacted in stored rows.

## Phase 4: M4: Voice (separate track, after text runtime is proven)

- STT (Deepgram/AssemblyAI) → same `agent-run` loop → TTS
  (ElevenLabs/Cartesia); Twilio/Vapi for telephony. The `voice` /
  `speaking_pace` config fields already exist and carry over. Not scoped
  further until M1–M3 land.

---

## Working notes

- **Migrations:** repo has no `supabase/migrations` dir: apply SQL files
  manually via the aws-1 session pooler, keep every file idempotent like the
  existing ones. `config.toml` must stay a complete mirror; never
  `supabase config push` casually.
- **New UI** (Test-agent tab, tool chips, analytics swaps) goes through the
  `fold-feature-builder` skill: DS primitives, tokens, Solar `*-linear`
  icons, Supabase-backed data.
- **PRs:** DS check must be green before merge; no pushes without an
  explicit ask.
