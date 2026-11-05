-- Bootstrap creators for every public table that predates the repo.
--
-- These 77 tables were created against production out-of-band
-- (before supabase/*.sql became the convention), so no committed migration
-- builds them. Consequences: fresh environments can't boot, and the Supabase
-- Preview integration fails on ANY PR touching supabase/*.sql because it
-- replays the whole directory onto an empty branch and dies at the first file
-- referencing a missing relation.
--
-- Named aaa_ so it sorts FIRST and runs before everything else. Every
-- statement is idempotent, generated from the live production schema,
-- running it where tables/constraints already exist is a no-op.
--
-- Scope: columns, types, nullability, defaults, identities, generated
-- columns, PK/UNIQUE/FK constraints (FKs only when the target table is also
-- built here; cross-file FKs belong to their owning migration). RLS is
-- ENABLED on every table: deny-until-a-policy-exists is the safe fresh-env
-- default; policy-bearing repo files then apply grants on top. Indexes beyond
-- keys, triggers, functions and views are intentionally omitted.

begin;

-- ── Tables ────────────────────────────────────────────────────────────────
create table if not exists public.agent_config (
  "id" text default (gen_random_uuid())::text not null,
  "agent_id" text not null,
  "agent_role" text,
  "use_case_name" text,
  "description" text,
  "system_prompt" text,
  "tone_of_voice" text default 'professional'::text,
  "voice" text default 'erica'::text,
  "empathy_level" integer default 75,
  "speaking_pace" integer default 75,
  "languages" jsonb default '["english"]'::jsonb,
  "adaptations" jsonb default '[]'::jsonb,
  "selected_policies" jsonb default '[]'::jsonb,
  "population_type" text default 'worklist'::text,
  "selected_worklist" text,
  "modality" text default 'voice'::text,
  "phone" text,
  "email" text,
  "office_hours" text,
  "goal_ids" jsonb default '[]'::jsonb,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
alter table public.agent_config enable row level security;

create table if not exists public.agent_flows (
  "id" bigint default nextval('agent_flows_id_seq'::regclass) not null,
  "agent_id" text,
  "version" text default '1.0'::text,
  "nodes" jsonb default '[]'::jsonb,
  "edges" jsonb default '[]'::jsonb,
  "viewport" jsonb default '{"x": 0, "y": 0, "zoom": 1}'::jsonb,
  "is_current" boolean default true,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
alter table public.agent_flows enable row level security;

create table if not exists public.agent_rules (
  "id" bigint default nextval('agent_rules_id_seq'::regclass) not null,
  "name" text not null,
  "type" text default 'custom'::text not null,
  "locked" boolean default false,
  "enabled" boolean default true,
  "condition_text" text not null,
  "action_text" text not null,
  "priority_label" text,
  "sort_order" integer default 0,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
alter table public.agent_rules enable row level security;

create table if not exists public.agents (
  "id" text default (gen_random_uuid())::text not null,
  "name" text not null,
  "use_case" text,
  "version" text default '1.0'::text,
  "voice" jsonb,
  "last_updated" text,
  "last_updated_by" text,
  "enabled" boolean default false,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "model" text,
  "role" text,
  "avatar_url" text
);
alter table public.agents enable row level security;

create table if not exists public.all_patients (
  "id" text not null,
  "source" text default 'manual'::text,
  "member_id" text,
  "name" text not null,
  "initials" text,
  "gender" text,
  "age" integer,
  "language" text default 'en'::text,
  "email" text,
  "phone" text,
  "city" text,
  "state" text,
  "location" text,
  "tags" jsonb default '[]'::jsonb,
  "group_number" text,
  "family_id" text,
  "unique_member_id" text,
  "coverage_type" text,
  "plan_code" text,
  "employee_ssn" text,
  "member_ssn" text,
  "subscriber_hire_date" date,
  "tpa" text,
  "chronic_conditions" jsonb default '[]'::jsonb,
  "pcp" text,
  "pcp_initials" text,
  "last_visit" date,
  "active_care_program" text,
  "ccm_consent" boolean,
  "apcm_consent" boolean,
  "assignee" text,
  "assignee_initials" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "dob" text,
  "ipa" text,
  "hp_code" text,
  "zip" text
);
alter table public.all_patients enable row level security;

create table if not exists public.analytics_configs (
  "id" integer default nextval('analytics_configs_id_seq'::regclass) not null,
  "tenant_id" text default 'default'::text not null,
  "config_key" text not null,
  "period" text default '2026-03'::text not null,
  "config_data" jsonb default '{}'::jsonb not null,
  "meta" jsonb default '{}'::jsonb,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
alter table public.analytics_configs enable row level security;

create table if not exists public.analytics_kpis (
  "id" integer default nextval('analytics_kpis_id_seq'::regclass) not null,
  "tenant_id" text default 'default'::text not null,
  "view_key" text not null,
  "period" text default '2026-03'::text not null,
  "kpis" jsonb default '[]'::jsonb not null,
  "insight" jsonb,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
alter table public.analytics_kpis enable row level security;

create table if not exists public.analytics_progress_bars (
  "id" integer default nextval('analytics_progress_bars_id_seq'::regclass) not null,
  "tenant_id" text default 'default'::text not null,
  "bar_key" text not null,
  "period" text default '2026-03'::text not null,
  "items" jsonb default '[]'::jsonb not null,
  "meta" jsonb default '{}'::jsonb,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
alter table public.analytics_progress_bars enable row level security;

create table if not exists public.analytics_tables (
  "id" integer default nextval('analytics_tables_id_seq'::regclass) not null,
  "tenant_id" text default 'default'::text not null,
  "table_key" text not null,
  "period" text default '2026-03'::text not null,
  "columns" jsonb default '[]'::jsonb not null,
  "rows" jsonb default '[]'::jsonb not null,
  "meta" jsonb default '{}'::jsonb,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
alter table public.analytics_tables enable row level security;

create table if not exists public.analytics_time_series (
  "id" integer default nextval('analytics_time_series_id_seq'::regclass) not null,
  "tenant_id" text default 'default'::text not null,
  "series_key" text not null,
  "period" text default '2026-03'::text not null,
  "label" text not null,
  "data_points" jsonb default '[]'::jsonb not null,
  "meta" jsonb default '{}'::jsonb,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
alter table public.analytics_time_series enable row level security;

create table if not exists public.apcm_patients (
  "id" text not null,
  "name" text not null,
  "member_id" text,
  "language" text default 'en'::text,
  "ehr_id" text,
  "billing_month" text,
  "date_of_service" text,
  "is_qmb" boolean default false,
  "chronic_condition_count" integer default 0,
  "cpt_code" text,
  "icd_codes" jsonb default '[]'::jsonb,
  "last_encounter_date" text,
  "reasons" jsonb default '[]'::jsonb,
  "rendering_provider" text,
  "rendering_provider_initials" text,
  "comment" text default ''::text,
  "tab" text,
  "billing_status" text default 'pending'::text,
  "program_id" text,
  "created_at" timestamp with time zone default now()
);
alter table public.apcm_patients enable row level security;

create table if not exists public.appointment_types (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "code" text,
  "mode" text,
  "duration" text,
  "color" text default '#8C5AE2'::text not null,
  "created_at" timestamp with time zone default now()
);
alter table public.appointment_types enable row level security;

create table if not exists public.appointments (
  "id" uuid default gen_random_uuid() not null,
  "patient_id" text,
  "patient_name" text,
  "appointment_type_id" uuid,
  "appointment_type_name" text,
  "mode" text,
  "location" text,
  "primary_user" text,
  "secondary_users" jsonb default '[]'::jsonb,
  "date" text not null,
  "time_start" text not null,
  "time_end" text,
  "reason_for_visit" text,
  "member_instruction" text,
  "staff_instruction" text,
  "require_rsvp" boolean default false,
  "recurring" boolean default false,
  "status" text default 'Scheduled'::text,
  "calendar_id" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "recurring_config" jsonb
);
alter table public.appointments enable row level security;

create table if not exists public.audit_logs (
  "id" integer default nextval('audit_logs_id_seq'::regclass) not null,
  "entity_type" text not null,
  "entity_id" text not null,
  "entity_name" text not null,
  "action" text not null,
  "user_name" text default 'Current User'::text not null,
  "details" text,
  "category" text,
  "created_at" timestamp with time zone default now()
);
alter table public.audit_logs enable row level security;

create table if not exists public.awv_members (
  "id" text not null,
  "member_id" text,
  "name" text,
  "initials" text,
  "gender" text,
  "age" text,
  "outreach" integer default 0,
  "tasks" integer default 0,
  "dos_list" jsonb default '[]'::jsonb,
  "create_date" text,
  "due_label" text,
  "due_color" text,
  "support_name" text,
  "support_status" text,
  "provider" text,
  "visit_type" text default 'AWV'::text,
  "ipa" text,
  "place_of_service" text,
  "primary_care_doctor" text,
  "decile" text,
  "cohort" text,
  "risk_level" text,
  "advillness" integer default 0,
  "frailty" integer default 0,
  "language" text default 'en'::text
);
alter table public.awv_members enable row level security;

create table if not exists public.business_hours (
  "id" bigint default nextval('business_hours_id_seq'::regclass) not null,
  "day_of_week" text not null,
  "available" boolean default false,
  "slots" jsonb default '[]'::jsonb,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
alter table public.business_hours enable row level security;

create table if not exists public.call_details (
  "id" text not null,
  "patient_id" text not null,
  "call_type" text not null,
  "agent_name" text,
  "started_at" text,
  "ended_at" text,
  "duration" text,
  "live_goals" jsonb default '[]'::jsonb,
  "live_transcript" jsonb default '[]'::jsonb,
  "goals_detail" jsonb default '[]'::jsonb,
  "call_summary" jsonb,
  "call_transcript" jsonb default '[]'::jsonb,
  "outcome" text,
  "attempt_number" integer,
  "created_at" timestamp with time zone default now(),
  "direction" text,
  "is_bot" boolean default false not null
);
alter table public.call_details enable row level security;

create table if not exists public.call_lines (
  "id" text not null,
  "label" text not null,
  "phone_number" text,
  "sort_order" integer default 0 not null,
  "is_active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null
);
alter table public.call_lines enable row level security;

create table if not exists public.call_nav_items (
  "id" text not null,
  "section" text not null,
  "icon" text,
  "label" text not null,
  "is_custom_icon" boolean default false not null,
  "sort_order" integer default 0 not null,
  "is_active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null
);
alter table public.call_nav_items enable row level security;

create table if not exists public.call_sessions (
  "id" text not null,
  "name" text not null,
  "status" text not null,
  "time" text not null,
  "dir" text not null,
  "pinned" boolean default false not null,
  "active" boolean default false not null,
  "patient_id" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
alter table public.call_sessions enable row level security;

create table if not exists public.campaigns (
  "id" bigint default nextval('campaigns_id_seq'::regclass) not null,
  "name" text not null,
  "description" text,
  "channel" text default 'email'::text,
  "section" text default 'scheduled'::text,
  "audience" integer default 0,
  "dynamic" boolean default false,
  "health" text,
  "delivered" numeric,
  "opened" numeric,
  "start_date" text,
  "duration" integer default 1,
  "progress" numeric default 0,
  "executes_in" integer,
  "enabled" boolean default false,
  "email_template" jsonb,
  "color_variables" jsonb,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "audience_include" jsonb default '[]'::jsonb,
  "audience_exclude" jsonb default '[]'::jsonb,
  "send_via" jsonb default '["email"]'::jsonb,
  "start_mode" text default 'immediately'::text,
  "start_at" timestamp with time zone,
  "end_date" timestamp with time zone,
  "campaign_type" text default 'one_time'::text,
  "sender_name" text,
  "send_from" text,
  "subject_line" text,
  "category" text,
  "updated_by" uuid
);
alter table public.campaigns enable row level security;

create table if not exists public.care_teams (
  "id" text not null,
  "name" text not null,
  "kind" text default 'hcc'::text not null,
  "team_type" text,
  "allocated_tins" jsonb default '[]'::jsonb not null,
  "created_label" text,
  "created_by" text,
  "modified_label" text,
  "modified_by" text,
  "members" jsonb default '[]'::jsonb not null,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
alter table public.care_teams enable row level security;

create table if not exists public.caregap_activity (
  "id" text not null,
  "member_id" text not null,
  "at" timestamp with time zone default now() not null,
  "actor" text,
  "t" text,
  "title" text,
  "payload" jsonb default '{}'::jsonb,
  "created_at" timestamp with time zone default now()
);
alter table public.caregap_activity enable row level security;

create table if not exists public.ccm_billable_activities (
  "id" text not null,
  "period_id" text,
  "patient_id" text not null,
  "activity_type" text not null,
  "description" text default ''::text,
  "duration_seconds" integer default 0 not null,
  "logged_by" text,
  "logged_by_initials" text,
  "occurred_at" timestamp with time zone not null,
  "is_unlogged" boolean default false,
  "created_at" timestamp with time zone default now()
);
alter table public.ccm_billable_activities enable row level security;

create table if not exists public.ccm_billing_periods (
  "id" text not null,
  "patient_id" text not null,
  "program_id" text,
  "year_month" text not null,
  "complexity" text default 'moderate'::text,
  "required_minutes" integer default 20,
  "bill_status" text default 'draft'::text,
  "claim_status" text default 'unsent'::text,
  "generated_at" timestamp with time zone,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone default now()
);
alter table public.ccm_billing_periods enable row level security;

create table if not exists public.ccm_billing_reports (
  "id" text not null,
  "report_number" integer not null,
  "patient_id" text not null,
  "period_id" text,
  "year_month" text not null,
  "generated_at" timestamp with time zone not null,
  "est_billing_amount" numeric(10,2) not null,
  "total_seconds" integer default 0 not null,
  "integrated_ehr" text,
  "provider_name" text,
  "provider_initials" text,
  "medical_decision_making" text default 'moderate'::text,
  "cpt_codes" jsonb default '[]'::jsonb,
  "created_at" timestamp with time zone default now()
);
alter table public.ccm_billing_reports enable row level security;

create table if not exists public.ccm_worklist_members (
  "id" text not null,
  "initials" text,
  "name" text not null,
  "gender" text,
  "age" text,
  "member_id" text,
  "language" text default 'en'::text,
  "status" text not null,
  "next_action_due" text,
  "next_action_overdue" boolean default false,
  "outreach_status" text,
  "outreach_date" text,
  "assignee_id" text,
  "assignee_name" text,
  "assignee_initials" text,
  "start_date" text,
  "last_admission" text,
  "risk_level" text,
  "task_count" integer default 0,
  "care_plan_status" text,
  "patient_id" text,
  "created_at" timestamp with time zone default now(),
  "billable_seconds" integer default 0,
  "unlogged_seconds" integer default 0,
  "dob" text,
  "utr_flag" text default 'No'::text,
  "utr_age_days" integer default 0,
  "program_due_date" text,
  "last_outreach_outcome" text,
  "assignment_date" text,
  "ipa" text,
  "hp_code" text,
  "member_status" text default 'Active'::text
);
alter table public.ccm_worklist_members enable row level security;

create table if not exists public.changelog_entries (
  "id" uuid default gen_random_uuid() not null,
  "title" text not null,
  "kind" text default 'New'::text not null,
  "sha" text,
  "compare_url" text,
  "created_at" timestamp with time zone default now() not null
);
alter table public.changelog_entries enable row level security;

create table if not exists public.chat_groups (
  "id" bigint default nextval('chat_groups_id_seq'::regclass) not null,
  "name" text not null,
  "users" jsonb default '[]'::jsonb,
  "roles" jsonb default '[]'::jsonb,
  "location" text default 'Global Template'::text,
  "updated_by" text,
  "active_chats" integer default 0,
  "has_agent" boolean default false,
  "agent_name" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
alter table public.chat_groups enable row level security;

create table if not exists public.chat_participants (
  "id" text not null,
  "name" text not null,
  "role" text,
  "type" text default 'user'::text not null,
  "is_agent" boolean default false,
  "created_at" timestamp with time zone default now()
);
alter table public.chat_participants enable row level security;

create table if not exists public.direct_messages (
  "id" uuid default gen_random_uuid() not null,
  "sender_id" uuid not null,
  "recipient_id" uuid not null,
  "content" text not null,
  "created_at" timestamp with time zone default now(),
  "read_at" timestamp with time zone,
  "reply_to_id" uuid,
  "media_url" text,
  "media_type" text,
  "media_name" text
);
alter table public.direct_messages enable row level security;

create table if not exists public.email_header_footer_presets (
  "id" bigint default nextval('email_header_footer_presets_id_seq'::regclass) not null,
  "role" text not null,
  "name" text not null,
  "description" text,
  "accent" text default '#7C5CFA'::text,
  "tree" jsonb not null,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
alter table public.email_header_footer_presets enable row level security;

create table if not exists public.embed_components (
  "id" integer default nextval('embed_components_id_seq'::regclass) not null,
  "name" text not null,
  "category" text,
  "description" text default ''::text,
  "domain_id" integer,
  "domain" text,
  "surfaces" jsonb default '[]'::jsonb,
  "placements" jsonb default '{}'::jsonb,
  "web_config" jsonb default '{}'::jsonb,
  "sidecar_config" jsonb default '{}'::jsonb,
  "mobile_config" jsonb default '{}'::jsonb,
  "url" text default ''::text,
  "staging_url" text default ''::text,
  "token_lifetime" integer default 5,
  "context_fields" jsonb default '[]'::jsonb,
  "visible_to" text default 'All providers'::text,
  "activation" text default 'always'::text,
  "condition" text,
  "enabled" boolean default false not null,
  "previewed" boolean default false not null,
  "domain_removed" boolean default false not null,
  "errors_24h" integer default 0,
  "last_loaded" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
alter table public.embed_components enable row level security;

create table if not exists public.embed_domains (
  "id" integer default nextval('embed_domains_id_seq'::regclass) not null,
  "vendor" text not null,
  "domain" text not null,
  "category" text default 'Internal'::text not null,
  "hipaa" text default 'Pending BAA'::text not null,
  "enabled" boolean default true not null,
  "added_date" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
alter table public.embed_domains enable row level security;

create table if not exists public.faqs (
  "id" bigint default nextval('faqs_id_seq'::regclass) not null,
  "question" text not null,
  "answer" text not null,
  "category" text default 'General'::text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
alter table public.faqs enable row level security;

create table if not exists public.form_responses (
  "id" bigint default nextval('form_responses_id_seq'::regclass) not null,
  "form_id" bigint,
  "answers" jsonb default '{}'::jsonb,
  "scores" jsonb default '{}'::jsonb,
  "created_at" timestamp with time zone default now(),
  "created_by" uuid,
  "status" text default 'completed'::text not null,
  "session_id" text,
  "started_at" timestamp with time zone default now(),
  "completed_at" timestamp with time zone,
  "answered_count" integer default 0
);
alter table public.form_responses enable row level security;

create table if not exists public.forms (
  "id" bigint default nextval('forms_id_seq'::regclass) not null,
  "name" text not null,
  "description" text,
  "category" text,
  "status" text default 'draft'::text,
  "schema" jsonb default '{"items": []}'::jsonb,
  "scoring" jsonb default '{"scores": [], "criticalTriggers": []}'::jsonb,
  "settings" jsonb default '{}'::jsonb,
  "response_count" integer default 0,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "updated_by" uuid
);
alter table public.forms enable row level security;

create table if not exists public.goals (
  "id" bigint default nextval('goals_id_seq'::regclass) not null,
  "name" text not null,
  "program" text default 'TCM'::text,
  "program_color" text default 'purple'::text,
  "description" text,
  "status" text default 'draft'::text,
  "weighted_scoring" boolean default false,
  "passing_score" integer default 100,
  "mode" text default 'all-mandatory'::text,
  "steps" jsonb default '[]'::jsonb,
  "success_metrics" jsonb default '[]'::jsonb,
  "agents" jsonb default '[]'::jsonb,
  "completion_rate" integer default 0,
  "total_runs" integer default 0,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
alter table public.goals enable row level security;

create table if not exists public.hcc_activity_log (
  "id" uuid default gen_random_uuid() not null,
  "ts" timestamp with time zone default now() not null,
  "category" text not null,
  "event_name" text not null,
  "severity" text default 'info'::text not null,
  "actor_id" text,
  "actor_name" text,
  "actor_role" text,
  "source" text not null,
  "batch_id" text,
  "file_id" text,
  "encounter_id" text,
  "patient_id" text,
  "dos" text,
  "icd" text,
  "claim_id" text,
  "headline" text not null,
  "payload" jsonb default '{}'::jsonb not null,
  "ip_address" inet,
  "user_agent" text
);
alter table public.hcc_activity_log enable row level security;

create table if not exists public.hcc_added_charts (
  "id" text not null,
  "hcc_member_id" text not null,
  "caption" text,
  "doc_type" text,
  "file_name" text,
  "date_added" text,
  "added_by" text,
  "meta" text,
  "status" text default 'Pending'::text,
  "pdf_url" text,
  "storage_path" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "visit_type" text
);
alter table public.hcc_added_charts enable row level security;

create table if not exists public.hcc_chart_status (
  "id" text not null,
  "member_id" text not null,
  "doc_id" text not null,
  "status" text not null,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "fail_reasons" text[],
  "fail_note" text
);
alter table public.hcc_chart_status enable row level security;

create table if not exists public.hcc_diag_comments (
  "id" text not null,
  "author" text not null,
  "role" text not null,
  "date" text not null,
  "time" text not null,
  "edited" boolean default false,
  "body" text not null,
  "created_at" timestamp with time zone default now(),
  "icd" text,
  "dos" text,
  "status_from" text,
  "status_to" text
);
alter table public.hcc_diag_comments enable row level security;

create table if not exists public.hcc_diag_documents (
  "id" text not null,
  "name" text not null,
  "ext" text not null,
  "doc_type" text not null,
  "uploaded_by" text not null,
  "role" text not null,
  "date" text not null,
  "time" text not null,
  "status" text default 'passed'::text not null,
  "created_at" timestamp with time zone default now()
);
alter table public.hcc_diag_documents enable row level security;

create table if not exists public.hcc_diag_history (
  "id" text not null,
  "dos" text not null,
  "hcc_code" text not null,
  "hcc_name" text not null,
  "reviewed_at" text not null,
  "reviewed_by" text not null,
  "role" text not null,
  "claims" integer default 0 not null,
  "icd_status" text not null,
  "created_at" timestamp with time zone default now()
);
alter table public.hcc_diag_history enable row level security;

create table if not exists public.hcc_diag_notes (
  "id" text not null,
  "title" text not null,
  "author" text not null,
  "role" text not null,
  "date" text not null,
  "time" text not null,
  "signed" boolean default true,
  "body" text not null,
  "created_at" timestamp with time zone default now()
);
alter table public.hcc_diag_notes enable row level security;

create table if not exists public.hcc_diagnosis_gaps (
  "id" text default (gen_random_uuid())::text not null,
  "member_name" text not null,
  "code" text not null,
  "description" text,
  "hcc_category" text,
  "status" text default 'New'::text,
  "type" text,
  "docs_count" integer default 0,
  "comments_count" integer default 0,
  "notes_count" integer default 0,
  "raf_weight" double precision default 0,
  "last_activity" date,
  "last_activity_by" text,
  "dismiss_reason" text,
  "is_linked" boolean default true,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "kind" text default 'Associated'::text not null,
  "member_id" text,
  "dos" text
);
alter table public.hcc_diagnosis_gaps enable row level security;

create table if not exists public.hcc_documents (
  "id" text not null,
  "file_name" text not null,
  "ocr_tier" text default 'clean'::text not null,
  "compliance" jsonb,
  "encounters" jsonb default '[]'::jsonb not null,
  "source" text,
  "status" text,
  "ingested_at" timestamp with time zone,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
alter table public.hcc_documents enable row level security;

create table if not exists public.hcc_gap_activity (
  "id" text not null,
  "member_name" text not null,
  "sort_order" integer not null,
  "entry" jsonb not null,
  "created_at" timestamp with time zone default now()
);
alter table public.hcc_gap_activity enable row level security;

create table if not exists public.hcc_gap_confidence (
  "code" text not null,
  "score" integer not null,
  "status" text not null,
  "evidence" jsonb default '[]'::jsonb not null,
  "factors" jsonb,
  "meat_note" text,
  "created_at" timestamp with time zone default now()
);
alter table public.hcc_gap_confidence enable row level security;

create table if not exists public.hcc_gap_dos_actions (
  "id" text not null,
  "member_name" text not null,
  "code" text not null,
  "dos" text not null,
  "action" text,
  "dismiss_reason" text,
  "dismiss_note" text,
  "removed" boolean default false not null,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
alter table public.hcc_gap_dos_actions enable row level security;

create table if not exists public.hcc_gap_sweep (
  "id" text not null,
  "member_name" text not null,
  "code" text not null,
  "description" text not null,
  "hcc" text,
  "type" text,
  "dos_entries" jsonb not null,
  "docs" integer default 0,
  "cmts" integer default 0,
  "notes" integer default 0,
  "last_activity" text,
  "last_activity_by" text,
  "sort_order" integer default 0,
  "created_at" timestamp with time zone default now()
);
alter table public.hcc_gap_sweep enable row level security;

create table if not exists public.hcc_member_documents (
  "id" uuid default gen_random_uuid() not null,
  "member_id" text not null,
  "doc_index" integer not null,
  "status" text not null,
  "created_at" timestamp with time zone default now()
);
alter table public.hcc_member_documents enable row level security;

create table if not exists public.hcc_member_raf (
  "id" text not null,
  "member_name" text not null,
  "hcc" text not null,
  "hcc_name" text not null,
  "impact" numeric(6,3) not null,
  "sort_order" integer default 0 not null,
  "created_at" timestamp with time zone default now()
);
alter table public.hcc_member_raf enable row level security;

create table if not exists public.hcc_member_visits (
  "id" uuid default gen_random_uuid() not null,
  "member_id" text not null,
  "dos_date" date not null,
  "status_label" text,
  "status_color" text,
  "visit_index" integer not null,
  "created_at" timestamp with time zone default now()
);
alter table public.hcc_member_visits enable row level security;

create table if not exists public.hcc_members (
  "id" text not null,
  "member_id" text not null,
  "name" text not null,
  "initials" text,
  "gender" text,
  "current_visit" integer,
  "total_visits" integer,
  "chart_count" integer,
  "open_icds" integer default 0,
  "create_date" date,
  "due_label" text,
  "due_color" text,
  "support_name" text,
  "support_status" text,
  "coder_name" text,
  "coder_status" text,
  "reviewer1_name" text,
  "reviewer1_status" text,
  "reviewer2_name" text,
  "reviewer2_status" text,
  "reviewer3_name" text,
  "reviewer3_status" text,
  "rendering_provider" text,
  "visit_type" text,
  "raf_score" numeric(8,3),
  "raf_impact" numeric(8,3),
  "risk_utilization" boolean default false,
  "ipa" text,
  "health_plan" text,
  "pcp" text,
  "decile" integer,
  "cohort" text,
  "risk_level" text,
  "advillness" integer,
  "frailty" integer,
  "language" text default 'en'::text,
  "created_at" timestamp with time zone default now(),
  "is_spawned" boolean default false not null,
  "date_of_birth" date,
  "city" text,
  "state" text,
  "tin" text,
  "support_assigned_at" timestamp with time zone,
  "support_completed_at" timestamp with time zone,
  "coder_assigned_at" timestamp with time zone,
  "coder_completed_at" timestamp with time zone,
  "reviewer1_assigned_at" timestamp with time zone,
  "reviewer1_completed_at" timestamp with time zone,
  "reviewer2_assigned_at" timestamp with time zone,
  "reviewer2_completed_at" timestamp with time zone
);
alter table public.hcc_members enable row level security;

create table if not exists public.hcc_removed_charts (
  "id" text not null,
  "member_id" text not null,
  "doc_id" text not null,
  "removed_at" timestamp with time zone default now()
);
alter table public.hcc_removed_charts enable row level security;

create table if not exists public.hedis_members (
  "id" text not null,
  "initials" text,
  "name" text not null,
  "gender" text,
  "age" text,
  "member_id" text,
  "language" text default 'en'::text,
  "gaps" jsonb default '[]'::jsonb,
  "assignee" text,
  "assignee_initials" text,
  "start_date" text,
  "adv_illness" integer default 0,
  "frailty" integer default 0,
  "risk_level" text,
  "tasks" integer,
  "outreach_dots" jsonb default '[]'::jsonb,
  "outreach_date" text,
  "member_status" text default 'Active'::text,
  "phone" text,
  "dob" text,
  "ipa" text,
  "hp_code" text,
  "zip" text,
  "city" text,
  "state" text,
  "created_at" timestamp with time zone default now()
);
alter table public.hedis_members enable row level security;

create table if not exists public.holidays (
  "id" bigint default nextval('holidays_id_seq'::regclass) not null,
  "date" date not null,
  "name" text not null,
  "created_at" timestamp with time zone default now()
);
alter table public.holidays enable row level security;

create table if not exists public.icd_codes (
  "code" text not null,
  "title" text not null,
  "chapter" text,
  "hcc" text,
  "entity_id" text,
  "source" text default 'seed'::text,
  "updated_at" timestamp with time zone default now()
);
alter table public.icd_codes enable row level security;

create table if not exists public.letters (
  "id" text not null,
  "file_name" text not null,
  "file_type" text,
  "sent_via" text[] default '{}'::text[],
  "last_sent" text,
  "sent_by" text,
  "source_file" text,
  "content_base64" text,
  "sort_order" integer default 0,
  "created_at" timestamp with time zone default now()
);
alter table public.letters enable row level security;

create table if not exists public.org_settings (
  "id" bigint default nextval('org_settings_id_seq'::regclass) not null,
  "user_id" uuid not null,
  "name" text,
  "subtitle" text,
  "about" text,
  "twitter" text,
  "instagram" text,
  "facebook" text,
  "website" text,
  "primary_color" text default '#802166'::text,
  "logo_url" text,
  "created_at" timestamp with time zone default CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone default CURRENT_TIMESTAMP,
  "show_name" boolean default false,
  "linkedin" text
);
alter table public.org_settings enable row level security;

create table if not exists public.p360_profiles (
  "id" uuid default gen_random_uuid() not null,
  "patient_id" text not null,
  "profile_type" text default 'Central Profile'::text,
  "health_plan_name" text,
  "health_plan_id" text,
  "health_plan_desc" text,
  "consent_given" integer default 0,
  "consent_total" integer default 4,
  "acuity" text default 'Low'::text,
  "raf_score" numeric(6,3),
  "raf_change" numeric(4,2),
  "next_appointment_date" text,
  "last_contact_type" text,
  "last_contact_days" integer,
  "programs" jsonb default '[]'::jsonb,
  "patient_type" text default 'New Patient'::text,
  "condition_tags" jsonb default '[]'::jsonb,
  "location" text,
  "location_count" integer default 0,
  "languages" jsonb default '[]'::jsonb,
  "language_preference" text,
  "emails" jsonb default '[]'::jsonb,
  "plan_numbers_primary" jsonb default '[]'::jsonb,
  "plan_numbers_secondary" jsonb default '[]'::jsonb,
  "chronic_conditions" jsonb default '[]'::jsonb,
  "recent_vitals" jsonb,
  "opted_out_comms" jsonb default '[]'::jsonb,
  "family_caregiver_count" integer default 0,
  "family_members" jsonb default '[]'::jsonb,
  "care_team" jsonb default '[]'::jsonb,
  "care_team_profile_type" text default 'Central Profile'::text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "chosen_name" text,
  "date_of_birth" text,
  "gender_identity" text,
  "pronoun" text,
  "sex_at_birth" text,
  "sexual_orientation" text,
  "primary_language" text,
  "secondary_language" text,
  "blood_group" text,
  "marital_status" text,
  "race" text,
  "ethnicity" text,
  "ipa" text,
  "address_line1" text,
  "address_line2" text,
  "city" text,
  "state" text,
  "zipcode" text,
  "location_landmark" text,
  "profile_source" text,
  "profile_created_on" text,
  "employer" text,
  "practice_location" text,
  "age" text,
  "tags" jsonb default '[]'::jsonb,
  "custom_fields" jsonb default '[]'::jsonb,
  "extra_languages" jsonb default '[]'::jsonb,
  "extra_phones" jsonb default '[]'::jsonb,
  "additional_notes" text,
  "insurance_carrier_name" text,
  "insurance_plan_name" text,
  "insurance_member_id" text,
  "insurance_snp_type" text,
  "insurance_lob" text,
  "insurance_employment_status" text,
  "insurance_group_id" text,
  "insurance_eligibility_start" text,
  "insurance_eligibility_end" text,
  "insurance_benefits_effective" text,
  "insurance_benefits_termed" text,
  "insurance_deductible" text,
  "insurance_max_oop" text,
  "insurance_copay" text,
  "insurance_cost_sharing_level" text,
  "insurance_part_d_lis_level" text,
  "insurance_extra_benefits" text,
  "ph_relationship" text,
  "ph_policy_id" text,
  "ph_first_name" text,
  "ph_last_name" text,
  "ph_date_of_birth" text,
  "ph_sex_at_birth" text,
  "upcoming_appointments" jsonb,
  "problems" jsonb default '[]'::jsonb,
  "diagnoses" jsonb default '[]'::jsonb,
  "diagnosis_groups" jsonb default '[]'::jsonb,
  "immunizations" jsonb default '[]'::jsonb,
  "medication_orders" jsonb default '[]'::jsonb,
  "procedures" jsonb default '[]'::jsonb,
  "lab_results" jsonb default '[]'::jsonb,
  "wearables" jsonb default '[]'::jsonb,
  "forms_submitted" jsonb default '[]'::jsonb,
  "membership_status" text,
  "past_membership_status" text,
  "engagement_level" text
);
alter table public.p360_profiles enable row level security;

create table if not exists public.patient_care_programs (
  "id" text not null,
  "patient_id" text not null,
  "code" text not null,
  "name" text not null,
  "acuity" text,
  "status" text default 'New'::text,
  "status_color" text,
  "start_date" text,
  "end_date" text,
  "last_updated" text,
  "assignee" text,
  "pcp" text,
  "progress" numeric(4,3) default 0,
  "created_at" timestamp with time zone default now()
);
alter table public.patient_care_programs enable row level security;

create table if not exists public.patient_registry (
  "member_id" text,
  "fold_id" integer default nextval('patient_fold_id_seq'::regclass) not null,
  "created_at" timestamp with time zone default now()
);
alter table public.patient_registry enable row level security;

create table if not exists public.patients (
  "id" text not null,
  "initials" text not null,
  "name" text not null,
  "gender" text,
  "age" text,
  "member_id" text,
  "enrolled" boolean default false,
  "language" text default 'en'::text,
  "agent_assigned" text default ''::text,
  "agent_role" text default ''::text,
  "lace" text,
  "toc_type" text,
  "outreach_type" text,
  "outreach_left" text,
  "on_call" boolean default false,
  "call_duration" text,
  "status" text default 'scheduled'::text,
  "scheduled_time" text,
  "goals" jsonb,
  "next_action" text,
  "outreach_dots" jsonb default '[]'::jsonb,
  "toc_status" text,
  "due_on" text,
  "outreach_attended" integer default 0,
  "outreach_date" text,
  "next_outreach" text,
  "start_date" text,
  "last_admission" text,
  "assignee" text,
  "assignee_initials" text,
  "readmission" text default 'No'::text,
  "tasks" integer default 0,
  "care_plan_status" text default 'none'::text,
  "discharge_date" text,
  "facility" text,
  "admit_reason" text,
  "ai_insights" jsonb default '[]'::jsonb,
  "attempts" jsonb default '[]'::jsonb,
  "goals_detail" jsonb default '[]'::jsonb,
  "call_summary" jsonb,
  "call_date" text,
  "call_duration_full" text,
  "call_transcript" jsonb default '[]'::jsonb,
  "live_goals" jsonb default '[]'::jsonb,
  "live_transcript" jsonb default '[]'::jsonb,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "assessment_status" text,
  "outreach_status" text,
  "dob" text,
  "email" text,
  "phone" text,
  "city" text,
  "state" text,
  "nurse_coach" text,
  "nurse_coach_initials" text,
  "coordinator" text,
  "coordinator_initials" text,
  "social_worker" text,
  "social_worker_initials" text,
  "community_health_worker" text,
  "community_health_worker_initials" text,
  "tags" jsonb default '[]'::jsonb,
  "tags_more" integer default 0,
  "radar" text,
  "risk_iq" text,
  "ai_outcome_initiated" boolean default true,
  "ai_outcome_invoked_at" timestamp with time zone,
  "ai_outcome_status" text
);
alter table public.patients enable row level security;

create table if not exists public.population_groups (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "description" text,
  "group_type" text default 'Static'::text not null,
  "filter_type" text,
  "member_status" text default 'All Status'::text,
  "member_ids" jsonb default '[]'::jsonb,
  "active_count" integer default 0,
  "inactive_count" integer default 0,
  "created_by" uuid,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "rule" jsonb,
  "status" text default 'active'::text not null
);
alter table public.population_groups enable row level security;

create table if not exists public.pos_codes (
  "code" text not null,
  "name" text not null,
  "updated_at" timestamp with time zone default now()
);
alter table public.pos_codes enable row level security;

create table if not exists public.practice_locations (
  "id" text not null,
  "name" text not null,
  "ehr_instance" text,
  "address_line_1" text,
  "address_line_2" text,
  "city" text,
  "state" text,
  "zip_code" text,
  "timezone" text,
  "google_map_link" text,
  "default_phone" text,
  "business_hours" jsonb default '[]'::jsonb,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "deleted_at" timestamp with time zone
);
alter table public.practice_locations enable row level security;

create table if not exists public.profiles (
  "id" uuid not null,
  "email" text,
  "full_name" text,
  "role" text default 'Viewer'::text,
  "department" text,
  "practice_location" text,
  "phone" text,
  "status" text default 'Active'::text,
  "avatar_url" text,
  "extra_roles" integer default 0,
  "extra_locations" integer default 0,
  "last_active_at" timestamp with time zone,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "first_name" text,
  "middle_name" text,
  "last_name" text,
  "date_of_birth" date,
  "gender" text,
  "credentials" text[],
  "admin_role" text default 'Employer'::text,
  "clinical_roles" text[],
  "locations" text[],
  "ehr_mapping" text,
  "ehr_user" text,
  "languages" jsonb default '[]'::jsonb,
  "licence_states" text[],
  "bio" text,
  "mobile" text,
  "fax" text,
  "zip_code" text,
  "address_line1" text,
  "address_line2" text,
  "state" text,
  "city" text
);
alter table public.profiles enable row level security;

create table if not exists public.snp_worklist_members (
  "id" text not null,
  "initials" text,
  "name" text not null,
  "gender" text,
  "age" text,
  "member_id" text,
  "language" text default 'en'::text,
  "program_sub_status" text,
  "care_plan_status" text,
  "next_action_due" text,
  "outreach" jsonb,
  "assignee_id" text,
  "assignee_name" text,
  "assignee_initials" text,
  "trigger_date" text,
  "last_admission" text,
  "trigger" text,
  "risk_iq" text default 'Undetermined'::text,
  "tags" jsonb default '[]'::jsonb,
  "tags_more" integer default 0,
  "task_count" integer default 0,
  "patient_id" text,
  "created_at" timestamp with time zone default now(),
  "assignee_role" text
);
alter table public.snp_worklist_members enable row level security;

create table if not exists public.sticky_note_history (
  "id" uuid default gen_random_uuid() not null,
  "sticky_note_id" uuid,
  "patient_id" text not null,
  "author_name" text,
  "action" text default 'added a Note'::text,
  "note_text" text,
  "ehr_instance" text default 'Central Profile'::text,
  "created_at" timestamp with time zone default now()
);
alter table public.sticky_note_history enable row level security;

create table if not exists public.sticky_notes (
  "id" uuid default gen_random_uuid() not null,
  "patient_id" text not null,
  "text" text default ''::text not null,
  "author_name" text,
  "author_date" timestamp with time zone default now(),
  "ehr_profile" text default 'Central Profile'::text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
alter table public.sticky_notes enable row level security;

create table if not exists public.task_audit_log (
  "id" integer default nextval('task_audit_log_id_seq'::regclass) not null,
  "task_id" integer,
  "user_name" text,
  "user_id" uuid,
  "action_type" text not null,
  "field_name" text,
  "from_value" text,
  "to_value" text,
  "created_at" timestamp with time zone default now()
);
alter table public.task_audit_log enable row level security;

create table if not exists public.task_labels (
  "id" integer default nextval('task_labels_id_seq'::regclass) not null,
  "name" text not null,
  "created_at" timestamp with time zone default now()
);
alter table public.task_labels enable row level security;

create table if not exists public.task_pools (
  "id" integer default nextval('task_pools_id_seq'::regclass) not null,
  "name" text not null,
  "description" text default ''::text,
  "created_at" timestamp with time zone default now()
);
alter table public.task_pools enable row level security;

create table if not exists public.tasks (
  "id" integer default nextval('tasks_id_seq'::regclass) not null,
  "name" text not null,
  "meta" text default ''::text,
  "parent_task" text,
  "is_subtask" boolean default false,
  "attachments" integer default 0,
  "comments" integer default 0,
  "priority" text default 'medium'::text,
  "status" text default 'pending'::text,
  "due_date" text,
  "due_missed" boolean default false,
  "member" text default ''::text,
  "labels" text[] default '{}'::text[],
  "assigned_to" text,
  "created_by" text not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now(),
  "parent_task_id" integer,
  "pool" text,
  "mentions" text[] default '{}'::text[],
  "completed_at" timestamp with time zone,
  "description" text default ''::text,
  "assigned_to_id" uuid,
  "created_by_id" uuid,
  "program_code" text,
  "patient_id" text,
  "source_key" text,
  "mention_ids" uuid[]
);
alter table public.tasks enable row level security;

create table if not exists public.user_tour_status (
  "id" bigint generated by default as identity not null,
  "user_id" uuid default auth.uid() not null,
  "tour_id" text not null,
  "seen_at" timestamp with time zone default now() not null
);
alter table public.user_tour_status enable row level security;

-- ── Keys & foreign keys (existence-guarded; FKs only to tables built above)
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hcc_activity_log_pkey' and conrelid = 'public.hcc_activity_log'::regclass) then
    alter table public.hcc_activity_log add constraint hcc_activity_log_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hcc_member_visits_pkey' and conrelid = 'public.hcc_member_visits'::regclass) then
    alter table public.hcc_member_visits add constraint hcc_member_visits_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hcc_member_visits_member_id_visit_index_key' and conrelid = 'public.hcc_member_visits'::regclass) then
    alter table public.hcc_member_visits add constraint hcc_member_visits_member_id_visit_index_key UNIQUE (member_id, visit_index);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hcc_member_visits_member_id_fkey' and conrelid = 'public.hcc_member_visits'::regclass) then
    alter table public.hcc_member_visits add constraint hcc_member_visits_member_id_fkey FOREIGN KEY (member_id) REFERENCES hcc_members(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hcc_member_documents_pkey' and conrelid = 'public.hcc_member_documents'::regclass) then
    alter table public.hcc_member_documents add constraint hcc_member_documents_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hcc_member_documents_member_id_doc_index_key' and conrelid = 'public.hcc_member_documents'::regclass) then
    alter table public.hcc_member_documents add constraint hcc_member_documents_member_id_doc_index_key UNIQUE (member_id, doc_index);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hcc_member_documents_member_id_fkey' and conrelid = 'public.hcc_member_documents'::regclass) then
    alter table public.hcc_member_documents add constraint hcc_member_documents_member_id_fkey FOREIGN KEY (member_id) REFERENCES hcc_members(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'practice_locations_pkey' and conrelid = 'public.practice_locations'::regclass) then
    alter table public.practice_locations add constraint practice_locations_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'changelog_entries_pkey' and conrelid = 'public.changelog_entries'::regclass) then
    alter table public.changelog_entries add constraint changelog_entries_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'changelog_entries_sha_key' and conrelid = 'public.changelog_entries'::regclass) then
    alter table public.changelog_entries add constraint changelog_entries_sha_key UNIQUE (sha);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ccm_billing_periods_pkey' and conrelid = 'public.ccm_billing_periods'::regclass) then
    alter table public.ccm_billing_periods add constraint ccm_billing_periods_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'patients_pkey' and conrelid = 'public.patients'::regclass) then
    alter table public.patients add constraint patients_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'agents_pkey' and conrelid = 'public.agents'::regclass) then
    alter table public.agents add constraint agents_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'call_details_pkey' and conrelid = 'public.call_details'::regclass) then
    alter table public.call_details add constraint call_details_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'analytics_kpis_pkey' and conrelid = 'public.analytics_kpis'::regclass) then
    alter table public.analytics_kpis add constraint analytics_kpis_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'analytics_kpis_tenant_id_view_key_period_key' and conrelid = 'public.analytics_kpis'::regclass) then
    alter table public.analytics_kpis add constraint analytics_kpis_tenant_id_view_key_period_key UNIQUE (tenant_id, view_key, period);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'analytics_time_series_pkey' and conrelid = 'public.analytics_time_series'::regclass) then
    alter table public.analytics_time_series add constraint analytics_time_series_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'analytics_time_series_tenant_id_series_key_period_key' and conrelid = 'public.analytics_time_series'::regclass) then
    alter table public.analytics_time_series add constraint analytics_time_series_tenant_id_series_key_period_key UNIQUE (tenant_id, series_key, period);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'analytics_tables_pkey' and conrelid = 'public.analytics_tables'::regclass) then
    alter table public.analytics_tables add constraint analytics_tables_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'analytics_tables_tenant_id_table_key_period_key' and conrelid = 'public.analytics_tables'::regclass) then
    alter table public.analytics_tables add constraint analytics_tables_tenant_id_table_key_period_key UNIQUE (tenant_id, table_key, period);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'analytics_progress_bars_pkey' and conrelid = 'public.analytics_progress_bars'::regclass) then
    alter table public.analytics_progress_bars add constraint analytics_progress_bars_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'analytics_progress_bars_tenant_id_bar_key_period_key' and conrelid = 'public.analytics_progress_bars'::regclass) then
    alter table public.analytics_progress_bars add constraint analytics_progress_bars_tenant_id_bar_key_period_key UNIQUE (tenant_id, bar_key, period);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'analytics_configs_pkey' and conrelid = 'public.analytics_configs'::regclass) then
    alter table public.analytics_configs add constraint analytics_configs_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'analytics_configs_tenant_id_config_key_period_key' and conrelid = 'public.analytics_configs'::regclass) then
    alter table public.analytics_configs add constraint analytics_configs_tenant_id_config_key_period_key UNIQUE (tenant_id, config_key, period);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'faqs_pkey' and conrelid = 'public.faqs'::regclass) then
    alter table public.faqs add constraint faqs_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'agent_rules_pkey' and conrelid = 'public.agent_rules'::regclass) then
    alter table public.agent_rules add constraint agent_rules_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'chat_participants_pkey' and conrelid = 'public.chat_participants'::regclass) then
    alter table public.chat_participants add constraint chat_participants_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'business_hours_pkey' and conrelid = 'public.business_hours'::regclass) then
    alter table public.business_hours add constraint business_hours_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'holidays_pkey' and conrelid = 'public.holidays'::regclass) then
    alter table public.holidays add constraint holidays_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ccm_billing_periods_patient_id_year_month_key' and conrelid = 'public.ccm_billing_periods'::regclass) then
    alter table public.ccm_billing_periods add constraint ccm_billing_periods_patient_id_year_month_key UNIQUE (patient_id, year_month);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ccm_billable_activities_pkey' and conrelid = 'public.ccm_billable_activities'::regclass) then
    alter table public.ccm_billable_activities add constraint ccm_billable_activities_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ccm_billable_activities_period_id_fkey' and conrelid = 'public.ccm_billable_activities'::regclass) then
    alter table public.ccm_billable_activities add constraint ccm_billable_activities_period_id_fkey FOREIGN KEY (period_id) REFERENCES ccm_billing_periods(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'agent_flows_pkey' and conrelid = 'public.agent_flows'::regclass) then
    alter table public.agent_flows add constraint agent_flows_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'agent_flows_agent_id_fkey' and conrelid = 'public.agent_flows'::regclass) then
    alter table public.agent_flows add constraint agent_flows_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ccm_billing_reports_pkey' and conrelid = 'public.ccm_billing_reports'::regclass) then
    alter table public.ccm_billing_reports add constraint ccm_billing_reports_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'goals_pkey' and conrelid = 'public.goals'::regclass) then
    alter table public.goals add constraint goals_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'chat_groups_pkey' and conrelid = 'public.chat_groups'::regclass) then
    alter table public.chat_groups add constraint chat_groups_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'embed_domains_pkey' and conrelid = 'public.embed_domains'::regclass) then
    alter table public.embed_domains add constraint embed_domains_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'embed_domains_domain_key' and conrelid = 'public.embed_domains'::regclass) then
    alter table public.embed_domains add constraint embed_domains_domain_key UNIQUE (domain);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'embed_components_pkey' and conrelid = 'public.embed_components'::regclass) then
    alter table public.embed_components add constraint embed_components_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'embed_components_domain_id_fkey' and conrelid = 'public.embed_components'::regclass) then
    alter table public.embed_components add constraint embed_components_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES embed_domains(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'audit_logs_pkey' and conrelid = 'public.audit_logs'::regclass) then
    alter table public.audit_logs add constraint audit_logs_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'user_tour_status_pkey' and conrelid = 'public.user_tour_status'::regclass) then
    alter table public.user_tour_status add constraint user_tour_status_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'user_tour_status_user_id_tour_id_key' and conrelid = 'public.user_tour_status'::regclass) then
    alter table public.user_tour_status add constraint user_tour_status_user_id_tour_id_key UNIQUE (user_id, tour_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ccm_billing_reports_period_id_fkey' and conrelid = 'public.ccm_billing_reports'::regclass) then
    alter table public.ccm_billing_reports add constraint ccm_billing_reports_period_id_fkey FOREIGN KEY (period_id) REFERENCES ccm_billing_periods(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_pkey' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'appointment_types_pkey' and conrelid = 'public.appointment_types'::regclass) then
    alter table public.appointment_types add constraint appointment_types_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'appointments_pkey' and conrelid = 'public.appointments'::regclass) then
    alter table public.appointments add constraint appointments_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'appointments_appointment_type_id_fkey' and conrelid = 'public.appointments'::regclass) then
    alter table public.appointments add constraint appointments_appointment_type_id_fkey FOREIGN KEY (appointment_type_id) REFERENCES appointment_types(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'p360_profiles_pkey' and conrelid = 'public.p360_profiles'::regclass) then
    alter table public.p360_profiles add constraint p360_profiles_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'p360_profiles_patient_id_key' and conrelid = 'public.p360_profiles'::regclass) then
    alter table public.p360_profiles add constraint p360_profiles_patient_id_key UNIQUE (patient_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sticky_notes_pkey' and conrelid = 'public.sticky_notes'::regclass) then
    alter table public.sticky_notes add constraint sticky_notes_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sticky_note_history_pkey' and conrelid = 'public.sticky_note_history'::regclass) then
    alter table public.sticky_note_history add constraint sticky_note_history_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sticky_note_history_sticky_note_id_fkey' and conrelid = 'public.sticky_note_history'::regclass) then
    alter table public.sticky_note_history add constraint sticky_note_history_sticky_note_id_fkey FOREIGN KEY (sticky_note_id) REFERENCES sticky_notes(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'agent_config_pkey' and conrelid = 'public.agent_config'::regclass) then
    alter table public.agent_config add constraint agent_config_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'agent_config_agent_id_key' and conrelid = 'public.agent_config'::regclass) then
    alter table public.agent_config add constraint agent_config_agent_id_key UNIQUE (agent_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'agent_config_agent_id_fkey' and conrelid = 'public.agent_config'::regclass) then
    alter table public.agent_config add constraint agent_config_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hcc_members_pkey' and conrelid = 'public.hcc_members'::regclass) then
    alter table public.hcc_members add constraint hcc_members_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hcc_diagnosis_gaps_pkey' and conrelid = 'public.hcc_diagnosis_gaps'::regclass) then
    alter table public.hcc_diagnosis_gaps add constraint hcc_diagnosis_gaps_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'letters_pkey' and conrelid = 'public.letters'::regclass) then
    alter table public.letters add constraint letters_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'direct_messages_pkey' and conrelid = 'public.direct_messages'::regclass) then
    alter table public.direct_messages add constraint direct_messages_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'direct_messages_reply_to_id_fkey' and conrelid = 'public.direct_messages'::regclass) then
    alter table public.direct_messages add constraint direct_messages_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES direct_messages(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'task_audit_log_pkey' and conrelid = 'public.task_audit_log'::regclass) then
    alter table public.task_audit_log add constraint task_audit_log_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'task_audit_log_task_id_fkey' and conrelid = 'public.task_audit_log'::regclass) then
    alter table public.task_audit_log add constraint task_audit_log_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'task_pools_pkey' and conrelid = 'public.task_pools'::regclass) then
    alter table public.task_pools add constraint task_pools_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'task_pools_name_key' and conrelid = 'public.task_pools'::regclass) then
    alter table public.task_pools add constraint task_pools_name_key UNIQUE (name);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_assigned_to_id_fkey' and conrelid = 'public.tasks'::regclass) then
    alter table public.tasks add constraint tasks_assigned_to_id_fkey FOREIGN KEY (assigned_to_id) REFERENCES profiles(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_created_by_id_fkey' and conrelid = 'public.tasks'::regclass) then
    alter table public.tasks add constraint tasks_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES profiles(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'all_patients_pkey' and conrelid = 'public.all_patients'::regclass) then
    alter table public.all_patients add constraint all_patients_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ccm_worklist_members_pkey' and conrelid = 'public.ccm_worklist_members'::regclass) then
    alter table public.ccm_worklist_members add constraint ccm_worklist_members_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'call_nav_items_pkey' and conrelid = 'public.call_nav_items'::regclass) then
    alter table public.call_nav_items add constraint call_nav_items_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'call_lines_pkey' and conrelid = 'public.call_lines'::regclass) then
    alter table public.call_lines add constraint call_lines_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'call_sessions_pkey' and conrelid = 'public.call_sessions'::regclass) then
    alter table public.call_sessions add constraint call_sessions_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'call_sessions_patient_id_fkey' and conrelid = 'public.call_sessions'::regclass) then
    alter table public.call_sessions add constraint call_sessions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_pkey' and conrelid = 'public.tasks'::regclass) then
    alter table public.tasks add constraint tasks_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'task_labels_pkey' and conrelid = 'public.task_labels'::regclass) then
    alter table public.task_labels add constraint task_labels_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'task_labels_name_key' and conrelid = 'public.task_labels'::regclass) then
    alter table public.task_labels add constraint task_labels_name_key UNIQUE (name);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_parent_task_id_fkey' and conrelid = 'public.tasks'::regclass) then
    alter table public.tasks add constraint tasks_parent_task_id_fkey FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'campaigns_pkey' and conrelid = 'public.campaigns'::regclass) then
    alter table public.campaigns add constraint campaigns_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'patient_care_programs_pkey' and conrelid = 'public.patient_care_programs'::regclass) then
    alter table public.patient_care_programs add constraint patient_care_programs_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'email_header_footer_presets_pkey' and conrelid = 'public.email_header_footer_presets'::regclass) then
    alter table public.email_header_footer_presets add constraint email_header_footer_presets_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'patient_care_programs_patient_id_code_key' and conrelid = 'public.patient_care_programs'::regclass) then
    alter table public.patient_care_programs add constraint patient_care_programs_patient_id_code_key UNIQUE (patient_id, code);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'patient_registry_fold_id_key' and conrelid = 'public.patient_registry'::regclass) then
    alter table public.patient_registry add constraint patient_registry_fold_id_key UNIQUE (fold_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'patient_registry_pkey' and conrelid = 'public.patient_registry'::regclass) then
    alter table public.patient_registry add constraint patient_registry_pkey PRIMARY KEY (fold_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'patient_registry_member_id_key' and conrelid = 'public.patient_registry'::regclass) then
    alter table public.patient_registry add constraint patient_registry_member_id_key UNIQUE (member_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hedis_members_pkey' and conrelid = 'public.hedis_members'::regclass) then
    alter table public.hedis_members add constraint hedis_members_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'apcm_patients_pkey' and conrelid = 'public.apcm_patients'::regclass) then
    alter table public.apcm_patients add constraint apcm_patients_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'campaigns_updated_by_fkey' and conrelid = 'public.campaigns'::regclass) then
    alter table public.campaigns add constraint campaigns_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'forms_pkey' and conrelid = 'public.forms'::regclass) then
    alter table public.forms add constraint forms_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'forms_updated_by_fkey' and conrelid = 'public.forms'::regclass) then
    alter table public.forms add constraint forms_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'form_responses_pkey' and conrelid = 'public.form_responses'::regclass) then
    alter table public.form_responses add constraint form_responses_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'form_responses_form_id_fkey' and conrelid = 'public.form_responses'::regclass) then
    alter table public.form_responses add constraint form_responses_form_id_fkey FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'form_responses_created_by_fkey' and conrelid = 'public.form_responses'::regclass) then
    alter table public.form_responses add constraint form_responses_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'org_settings_pkey' and conrelid = 'public.org_settings'::regclass) then
    alter table public.org_settings add constraint org_settings_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'org_settings_user_id_key' and conrelid = 'public.org_settings'::regclass) then
    alter table public.org_settings add constraint org_settings_user_id_key UNIQUE (user_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'care_teams_pkey' and conrelid = 'public.care_teams'::regclass) then
    alter table public.care_teams add constraint care_teams_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'snp_worklist_members_pkey' and conrelid = 'public.snp_worklist_members'::regclass) then
    alter table public.snp_worklist_members add constraint snp_worklist_members_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'population_groups_pkey' and conrelid = 'public.population_groups'::regclass) then
    alter table public.population_groups add constraint population_groups_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hcc_documents_pkey' and conrelid = 'public.hcc_documents'::regclass) then
    alter table public.hcc_documents add constraint hcc_documents_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'icd_codes_pkey' and conrelid = 'public.icd_codes'::regclass) then
    alter table public.icd_codes add constraint icd_codes_pkey PRIMARY KEY (code);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'pos_codes_pkey' and conrelid = 'public.pos_codes'::regclass) then
    alter table public.pos_codes add constraint pos_codes_pkey PRIMARY KEY (code);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hcc_added_charts_pkey' and conrelid = 'public.hcc_added_charts'::regclass) then
    alter table public.hcc_added_charts add constraint hcc_added_charts_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hcc_diag_comments_pkey' and conrelid = 'public.hcc_diag_comments'::regclass) then
    alter table public.hcc_diag_comments add constraint hcc_diag_comments_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hcc_diag_documents_pkey' and conrelid = 'public.hcc_diag_documents'::regclass) then
    alter table public.hcc_diag_documents add constraint hcc_diag_documents_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hcc_diag_notes_pkey' and conrelid = 'public.hcc_diag_notes'::regclass) then
    alter table public.hcc_diag_notes add constraint hcc_diag_notes_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hcc_diag_history_pkey' and conrelid = 'public.hcc_diag_history'::regclass) then
    alter table public.hcc_diag_history add constraint hcc_diag_history_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hcc_gap_confidence_pkey' and conrelid = 'public.hcc_gap_confidence'::regclass) then
    alter table public.hcc_gap_confidence add constraint hcc_gap_confidence_pkey PRIMARY KEY (code);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'awv_members_pkey' and conrelid = 'public.awv_members'::regclass) then
    alter table public.awv_members add constraint awv_members_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hcc_member_raf_pkey' and conrelid = 'public.hcc_member_raf'::regclass) then
    alter table public.hcc_member_raf add constraint hcc_member_raf_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hcc_gap_sweep_pkey' and conrelid = 'public.hcc_gap_sweep'::regclass) then
    alter table public.hcc_gap_sweep add constraint hcc_gap_sweep_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hcc_gap_activity_pkey' and conrelid = 'public.hcc_gap_activity'::regclass) then
    alter table public.hcc_gap_activity add constraint hcc_gap_activity_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hcc_gap_dos_actions_pkey' and conrelid = 'public.hcc_gap_dos_actions'::regclass) then
    alter table public.hcc_gap_dos_actions add constraint hcc_gap_dos_actions_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hcc_gap_dos_actions_member_name_code_dos_key' and conrelid = 'public.hcc_gap_dos_actions'::regclass) then
    alter table public.hcc_gap_dos_actions add constraint hcc_gap_dos_actions_member_name_code_dos_key UNIQUE (member_name, code, dos);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hcc_chart_status_pkey' and conrelid = 'public.hcc_chart_status'::regclass) then
    alter table public.hcc_chart_status add constraint hcc_chart_status_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hcc_chart_status_member_id_doc_id_key' and conrelid = 'public.hcc_chart_status'::regclass) then
    alter table public.hcc_chart_status add constraint hcc_chart_status_member_id_doc_id_key UNIQUE (member_id, doc_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hcc_removed_charts_pkey' and conrelid = 'public.hcc_removed_charts'::regclass) then
    alter table public.hcc_removed_charts add constraint hcc_removed_charts_pkey PRIMARY KEY (id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hcc_removed_charts_member_id_doc_id_key' and conrelid = 'public.hcc_removed_charts'::regclass) then
    alter table public.hcc_removed_charts add constraint hcc_removed_charts_member_id_doc_id_key UNIQUE (member_id, doc_id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hcc_diagnosis_gaps_member_id_fkey' and conrelid = 'public.hcc_diagnosis_gaps'::regclass) then
    alter table public.hcc_diagnosis_gaps add constraint hcc_diagnosis_gaps_member_id_fkey FOREIGN KEY (member_id) REFERENCES hcc_members(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'caregap_activity_pkey' and conrelid = 'public.caregap_activity'::regclass) then
    alter table public.caregap_activity add constraint caregap_activity_pkey PRIMARY KEY (id);
  end if;
end $$;

commit;

-- ── Verify ────────────────────────────────────────────────────────────────
-- select count(*) from pg_tables where schemaname='public';
-- Expected: 89 tables on production; complete set elsewhere.
-- select relname, relrowsecurity from pg_class
--  where relnamespace='public'::regnamespace and relkind='r' order by 1;

-- ── Rollback ──────────────────────────────────────────────────────────────
-- On environments that already have these tables this file is a no-op.
-- On a fresh branch: drop the created tables or delete the branch.
