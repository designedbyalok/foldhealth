-- Make the profiles-watch realtime channel actually receive events.
--
-- MessagesView.jsx:78 subscribes to postgres_changes on public.profiles
-- ('profiles-watch') so the chat contact list refreshes when a teammate is
-- added or renamed. But the supabase_realtime publication contains exactly one
-- table, direct_messages, so that binding has never matched anything and
-- refreshProfiles has only ever run on mount. The subscription insert in
-- realtime.subscription filters on pg_publication_tables, so a table missing
-- from the publication doesn't error the channel; it just silently never
-- delivers. Dead code that looks alive.
--
-- Two ways to fix a dead subscription: make it live (this file) or delete the
-- effect. The code's intent is sound: a new teammate should appear in New
-- Chat without a reload: and the cost of publishing profiles is negligible:
-- 54 rows, writes are rare (profile edits, signups), and the realtime poller
-- is already running for direct_messages regardless.
--
-- RLS note: postgres_changes respects RLS per subscriber. profiles is readable
-- by all authenticated users ("profiles_read_all_authenticated"), which is
-- exactly who should see contact-list updates. anon gets nothing, as narrowed
-- in profiles_drop_anon_policies.sql.

begin;

alter publication supabase_realtime add table public.profiles;

commit;

-- ── Verify ──────────────────────────────────────────────────────────────────
--   select tablename from pg_publication_tables where pubname='supabase_realtime';
--   Expect: direct_messages, profiles
--
-- End to end: open Messages in one browser, edit a profile's name in another
-- (or via the dashboard). The contact list should re-fetch without a reload.
--
-- ── Rollback ────────────────────────────────────────────────────────────────
--   alter publication supabase_realtime drop table public.profiles;
