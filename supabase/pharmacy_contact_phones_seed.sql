-- Pharmacy worklist: more than one number for a pharmacy or prescriber.
--
-- A contact's main number is `phone`; any others sit in `phones`
-- ([{ "number": "...", "label": "..." }], e.g. a pharmacist's direct line).
-- The call popover lists them all, marks Last Used and Most Used from the
-- member's dials, and calls the one picked. Contacts are jsonb on the member
-- (`pharmacy`, `prescriber`) and on each drug inside `measures`, so no column
-- changes.
--
-- Demo: Rite Aid #5532 (members 19403 and 19410) gets a pharmacist's direct
-- line, matching src/features/pharmacy-worklist/data/mock.js.

begin;

update public.pharmacy_worklist_members
set pharmacy = pharmacy || '{"phones": [{"number": "(562) 555-0109", "label": "Pharmacist direct"}]}'::jsonb
where pharmacy->>'name' = 'Rite Aid #5532'
  and not pharmacy ? 'phones';

commit;
