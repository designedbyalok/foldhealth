-- SNP sample care plan (patient snpw-001, Annette Brave — T2DM + Hypertension).
-- A clinically vetted, customer-ready demo: distinct non-overlapping goals with
-- structured targets, real reading histories (current value + trend), varied
-- progress/priority/status, interventions assigned to real platform users with
-- mixed kinds/statuses, linked barriers, and patient-data automations.
-- Every intervention/barrier/automation is wired to the goal it serves (goal_id)
-- so the GBI link button shows real counts and the hover preview lists them.
-- Idempotent full rebuild of the plan's GBI. Plan: 8d30c3c8-519a-4167-955f-d264f4564937.

do $$
declare
  v_plan uuid := '8d30c3c8-519a-4167-955f-d264f4564937';
  g_a1c   uuid := gen_random_uuid();
  g_bp    uuid := gen_random_uuid();
  g_glc   uuid := gen_random_uuid();
  g_hypo  uuid := gen_random_uuid();
  g_med   uuid := gen_random_uuid();
  g_act   uuid := gen_random_uuid();
  g_nut   uuid := gen_random_uuid();
  g_renal uuid := gen_random_uuid();
  g_prev  uuid := gen_random_uuid();
  now_ts timestamptz := now();
begin
  -- Fresh rebuild: clear existing GBI for this plan (children first).
  delete from patient_care_plan_goal_measurements m using patient_care_plan_goals g
    where m.goal_id = g.id and g.plan_id = v_plan;
  delete from patient_care_plan_automations where plan_id = v_plan;
  delete from patient_care_plan_interventions where plan_id = v_plan;
  delete from patient_care_plan_barriers where plan_id = v_plan;
  delete from patient_care_plan_goals where plan_id = v_plan;

  ---------------------------------------------------------------------------
  -- GOALS (distinct, non-overlapping; structured targets)
  ---------------------------------------------------------------------------
  insert into patient_care_plan_goals
    (id, plan_id, title, subtitle, icon, priority, category, measure, comparator,
     target_value, target_value_2, custom_unit, set_target, current_value, trend,
     status, progress, sort_order, conditions, target_date) values
  (g_a1c, v_plan, 'Lower HbA1c to below 7%',
     'Achieve glycemic control to reduce long-term diabetes complications.',
     'solar:test-tube-linear', 'high', 'Lab result', 'Hemoglobin A1c', '<',
     '7', null, null, true, '7.4 %', '↓', 'In Progress', 55, 0, '{Diabetes}', '2026-12-15'),
  (g_bp, v_plan, 'Reduce blood pressure below 130/80 mmHg',
     'Lower cardiovascular and renal risk through blood pressure control.',
     'solar:heart-pulse-linear', 'high', 'Vital', 'Blood Pressure', '<=',
     '130', '80', null, true, '132/84 mmHg', '↓', 'In Progress', 60, 1, '{Hypertension}', '2026-11-30'),
  (g_glc, v_plan, 'Keep fasting glucose within 80–130 mg/dL',
     'Maintain day-to-day glucose in range through self-monitoring.',
     'solar:pulse-linear', 'medium', 'Vital', 'Blood Glucose', 'between',
     '80', '130', null, true, '128 mg/dL', '↓', 'In Progress', 70, 2, '{Diabetes}', '2026-10-31'),
  (g_hypo, v_plan, 'Prevent severe hypoglycemic episodes',
     'Eliminate low-glucose events through safer insulin use and education.',
     'solar:danger-triangle-linear', 'high', 'Other', '', '<=',
     '0', null, 'episodes/month', true, '0 episodes', '↓', 'In Progress', 80, 3, '{Diabetes}', '2026-10-31'),
  (g_med, v_plan, 'Take medications as prescribed (90% or higher)',
     'Sustain medication adherence across diabetes and hypertension regimens.',
     'solar:pills-linear', 'high', 'Other', '', '>=',
     '90', null, '%', true, '92 %', '↑', 'Met', 100, 4, '{Diabetes,Hypertension}', '2026-09-30'),
  (g_act, v_plan, 'Reach 150 minutes of moderate activity weekly',
     'Build a sustainable weekly physical activity routine.',
     'solar:running-linear', 'medium', 'Activity', 'Duration', '>=',
     '150', null, null, true, '140 minutes', '↑', 'In Progress', 65, 5, '{Diabetes,Hypertension}', '2026-12-31'),
  (g_nut, v_plan, 'Follow a diabetes-friendly meal plan 5+ days a week',
     'Adopt consistent, dietitian-guided nutrition habits.',
     'solar:donut-linear', 'medium', 'Other', '', '>=',
     '5', null, 'days/week', true, '', '-', 'On Hold', 20, 6, '{Diabetes}', '2027-01-31'),
  (g_renal, v_plan, 'Protect kidney function (eGFR at or above 60)',
     'Monitor and preserve renal function with annual labs.',
     'solar:filter-linear', 'medium', 'Lab result', 'eGFR', '>=',
     '60', null, null, true, '66 mL/min', '↓', 'In Progress', 40, 7, '{Diabetes,Hypertension}', '2026-12-15'),
  (g_prev, v_plan, 'Complete recommended annual preventive screenings',
     'Close gaps for diabetic eye exam, foot exam and wellness visit.',
     'solar:clipboard-check-linear', 'low', 'Assessment', 'Preventive Screening', '=',
     'Completed', null, null, true, '', '-', 'Not Started', 0, 8, '{Diabetes}', '2026-12-31');

  ---------------------------------------------------------------------------
  -- MEASUREMENTS (reading history → current value + trend)
  ---------------------------------------------------------------------------
  insert into patient_care_plan_goal_measurements (goal_id, value, unit, favorable, taken_at, sort_order) values
  (g_a1c, '8.1', '%', false, now_ts - interval '180 days', 0),
  (g_a1c, '7.6', '%', true,  now_ts - interval '90 days', 1),
  (g_a1c, '7.4', '%', true,  now_ts - interval '10 days', 2),
  (g_bp, '148/92', 'mmHg', false, now_ts - interval '45 days', 0),
  (g_bp, '138/86', 'mmHg', true,  now_ts - interval '20 days', 1),
  (g_bp, '132/84', 'mmHg', true,  now_ts - interval '3 days', 2),
  (g_glc, '165', 'mg/dL', false, now_ts - interval '30 days', 0),
  (g_glc, '142', 'mg/dL', true,  now_ts - interval '14 days', 1),
  (g_glc, '128', 'mg/dL', true,  now_ts - interval '2 days', 2),
  (g_hypo, '3', 'episodes', false, now_ts - interval '60 days', 0),
  (g_hypo, '1', 'episodes', true,  now_ts - interval '30 days', 1),
  (g_hypo, '0', 'episodes', true,  now_ts - interval '5 days', 2),
  (g_med, '72', '%', false, now_ts - interval '60 days', 0),
  (g_med, '85', '%', true,  now_ts - interval '30 days', 1),
  (g_med, '92', '%', true,  now_ts - interval '4 days', 2),
  (g_act, '60', 'minutes', false, now_ts - interval '45 days', 0),
  (g_act, '110', 'minutes', true, now_ts - interval '21 days', 1),
  (g_act, '140', 'minutes', true, now_ts - interval '5 days', 2),
  (g_renal, '68', 'mL/min', true, now_ts - interval '200 days', 0),
  (g_renal, '66', 'mL/min', false, now_ts - interval '15 days', 1);

  ---------------------------------------------------------------------------
  -- INTERVENTIONS (all 5 types, each with its type icon + duration; assigned to
  -- real platform users; mixed status/priority). Icons match CARE_PLAN_INTERVENTION_ICONS:
  -- send-form=document-add, patient-education=book-2, patient-task=checklist-minimalistic,
  -- measure-vital=heart-pulse, internal-task=clipboard-check.
  ---------------------------------------------------------------------------
  insert into patient_care_plan_interventions
    (plan_id, goal_id, kind, icon, title, duration, assignee_name, assignee_initials, status, adherence, priority, sort_order) values
  (v_plan, g_a1c,  'measure-vital',     'solar:heart-pulse-linear',            'Order HbA1c panel every 3 months',                'Every 3 mo', 'Akanksha Singh',  'AS', 'In Progress', '100', 'high',   0),
  (v_plan, g_a1c,  'patient-education', 'solar:book-2-linear',                 'Diabetes self-management education',              '6 weeks',    'Devanshi Sharma', 'DS', 'In Progress', '80',  'medium', 1),
  (v_plan, g_bp,   'measure-vital',     'solar:heart-pulse-linear',            'Home blood pressure monitoring twice daily',      'Daily',      'Gaurav Gangurde', 'GG', 'In Progress', '75',  'high',   2),
  (v_plan, g_bp,   'patient-education', 'solar:book-2-linear',                 'Teach proper BP cuff technique',                  'One-time',   'Devanshi Sharma', 'DS', 'Met',         '100', 'medium', 3),
  (v_plan, g_glc,  'patient-task',      'solar:checklist-minimalistic-linear', 'Log fasting glucose each morning',                'Daily',      'Raj Thakur',      'RT', 'In Progress', '68',  'medium', 4),
  (v_plan, g_glc,  'internal-task',     'solar:clipboard-check-linear',        'Review glucose logs at each visit',               'Each visit', 'Akanksha Singh',  'AS', 'In Progress', '90',  'low',    5),
  (v_plan, g_hypo, 'patient-education', 'solar:book-2-linear',                 'Hypoglycemia recognition and treatment education','One-time',   'Devanshi Sharma', 'DS', 'Met',         '100', 'high',   6),
  (v_plan, g_hypo, 'internal-task',     'solar:clipboard-check-linear',        'Reassess and adjust insulin dosing',              'Monthly',    'Akanksha Singh',  'AS', 'In Progress', '50',  'high',   7),
  (v_plan, g_med,  'send-form',         'solar:document-add-linear',           'Enroll in medication refill sync program',        'One-time',   'Ketan Patni',     'KP', 'Met',         '100', 'high',   8),
  (v_plan, g_med,  'patient-task',      'solar:checklist-minimalistic-linear', 'Set up weekly pill organizer',                    'Weekly',     'Raj Thakur',      'RT', 'In Progress', '85',  'medium', 9),
  (v_plan, g_act,  'internal-task',     'solar:clipboard-check-linear',        'Refer to community walking program',              'One-time',   'Abhijit Gupta',   'AG', 'In Progress', '60',  'medium', 10),
  (v_plan, g_act,  'patient-task',      'solar:checklist-minimalistic-linear', 'Set weekly step and activity goals',              'Weekly',     'Gaurav Gangurde', 'GG', 'In Progress', '55',  'low',    11),
  (v_plan, g_nut,  'internal-task',     'solar:clipboard-check-linear',        'Refer to registered dietitian',                   'One-time',   'Abhijit Gupta',   'AG', 'On Hold',     '20',  'medium', 12),
  (v_plan, g_nut,  'send-form',         'solar:document-add-linear',           'Send diabetes-friendly meal planning guide',      'One-time',   'Devanshi Sharma', 'DS', 'Not Started', '-',   'low',    13),
  (v_plan, g_renal,'measure-vital',     'solar:heart-pulse-linear',            'Order annual eGFR and urine albumin',             'Annual',     'Akanksha Singh',  'AS', 'In Progress', '40',  'medium', 14),
  (v_plan, g_prev, 'internal-task',     'solar:clipboard-check-linear',        'Schedule diabetic retinal eye exam',              'Annual',     'Ketan Patni',     'KP', 'Not Started', '-',   'low',    15),
  (v_plan, g_prev, 'patient-task',      'solar:checklist-minimalistic-linear', 'Arrange transportation to appointments',          'As needed',  'Ajay Lakshman',   'AL', 'In Progress', '30',  'medium', 16);

  ---------------------------------------------------------------------------
  -- BARRIERS (real obstacles; linked; varied status/priority)
  ---------------------------------------------------------------------------
  insert into patient_care_plan_barriers (plan_id, goal_id, title, status, priority, sort_order) values
  (v_plan, g_bp,   'Limited access to a home blood pressure monitor',      'In Progress', 'medium', 0),
  (v_plan, g_med,  'Difficulty affording insulin and antihypertensives',   'In Progress', 'high',   1),
  (v_plan, g_hypo, 'Fear of hypoglycemia limiting insulin adherence',      'In Progress', 'high',   2),
  (v_plan, g_nut,  'Food insecurity limiting access to healthy meals',     'On Hold',     'high',   3),
  (v_plan, g_renal,'Transportation barriers to lab and clinic visits',     'In Progress', 'medium', 4),
  (v_plan, g_a1c,  'Low health literacy around carbohydrate counting',     'Met',         'low',    5);

  ---------------------------------------------------------------------------
  -- AUTOMATIONS (patient-data triggers; linked)
  ---------------------------------------------------------------------------
  insert into patient_care_plan_automations (plan_id, goal_id, title, icon, sort_order) values
  (v_plan, g_bp,   'Notify care team if systolic BP exceeds 150 mmHg',      'solar:bell-linear', 0),
  (v_plan, g_hypo, 'Alert care team on any glucose reading below 70 mg/dL', 'solar:bell-linear', 1),
  (v_plan, g_a1c,  'Flag for review when HbA1c result is above 8%',         'solar:bell-linear', 2),
  (v_plan, g_bp,   'Remind patient if blood pressure not logged for 3 days','solar:bell-linear', 3);
end $$;
