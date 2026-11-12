-- Goals in Their Words (DEV): Annette Brave's own words on three of her
-- program goals (TOC IP, DM, WLCP), shown in the call brief beside the
-- clinical goal. patient_title is the goal's patient-facing wording.

UPDATE public.patient_care_plan_goals SET patient_title = 'I want to know my heart is okay so I can stop worrying.'
WHERE id = 'fbec7f11-bc2f-4052-b5ff-ef8c868a800b';
UPDATE public.patient_care_plan_goals SET patient_title = 'I want to keep my sugar steady so I can keep working.'
WHERE id = '45a612c1-e685-4199-9402-baa833b0266a';
UPDATE public.patient_care_plan_goals SET patient_title = 'I want to walk with my granddaughter after school.'
WHERE id = '4ddf3bb7-e7b6-4a2a-8acd-845c092a6fd5';
