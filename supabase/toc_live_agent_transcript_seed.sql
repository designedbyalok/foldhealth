-- TOC live agent calls (DEV): what Erica (the Unity agent) and the patient
-- said before Erica paged the care manager, read by the Live drawer (Read
-- Handoff / Agent Transcript) and joined from the patient view. William Davis
-- had none; Annette Brave's named the agent "Anna" though her relay is Erica.

UPDATE public.patients SET
  live_transcript = '[
    {"name":"Erica","sender":"agent","text":"Hi William, this is Erica from your care team at Fold Health, checking in after your hospital stay. Is now a good time?","time":"9:41 AM"},
    {"name":"William Davis","sender":"patient","text":"Yes. I am glad you called, I am mixed up about my water pills.","time":"9:41 AM"},
    {"name":"Erica","sender":"agent","text":"I can help with that. Which medicines did the hospital send you home with?","time":"9:42 AM"},
    {"name":"William Davis","sender":"patient","text":"A new one, torsemide. I take one in the morning. I still have my old furosemide too.","time":"9:42 AM"},
    {"name":"Erica","sender":"agent","text":"Thank you. How are you feeling since you got home?","time":"9:43 AM"},
    {"name":"William Davis","sender":"patient","text":"My ankles are puffier than when I left.","time":"9:43 AM"},
    {"name":"Erica","sender":"agent","text":"I would like a nurse to go over your medicines with you. I am paging your care manager now, please stay on the line.","time":"9:44 AM"}
  ]'::jsonb,
  live_goals = '[
    {"name":"Patient Outreach","done":true,"time":"0:40"},
    {"name":"Medication Review","done":false,"time":null},
    {"name":"Schedule TCM Visit","done":false,"time":null}
  ]'::jsonb
WHERE id = '11143';

UPDATE public.patients SET
  live_transcript = (
    SELECT jsonb_agg(CASE WHEN e->>'sender' = 'agent' THEN jsonb_set(e, '{name}', '"Erica"') ELSE e END)
    FROM jsonb_array_elements(live_transcript) e
  )
WHERE id = '11089' AND jsonb_array_length(live_transcript) > 0;
