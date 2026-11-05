-- Pharmacy gap status model: demo data, so every gap status shows up on the
-- worklist and in the drawer.
--
-- 1. Claim timers for the four demo plans. Placeholders until Astrana shares
--    each feed's frequency and lag; they match the defaults in planTimers().
-- 2. Demo members (19401-19410), one gap per status the earlier claim
--    scenarios don't reach:
--      19404 MAD  pickup confirmed 10/20, claim not on the feed yet (Pending Claim)
--      19408 MAH  plan file: one more fill guarantees 80% (Met for Year)
--      19408 MAC  plan file: excluded, Hospice (Excluded)
--      19409 MAH  one fill in the class (First Fill, off the worklist)
--      19410      termed 10/15/2026 (every gap Not Eligible)
--    The other statuses already come from the claim scenarios in
--    pharmacy_claim_history_migration.sql (Closed, Claim reversed,
--    Claim not matched, Non–Part D claim) and the plan dates (Failed for
--    Year on 19405 MAH).
--    19404 MAD and 19409 MAH get their whole gap from the demo data, since
--    their fills changed; 19408 only gets the two flags. Keys a gap already
--    has and the demo data does not set (a manual status, a rework task)
--    are kept.
-- 3. The pharmacy-confirmed pickup behind 19404 MAD.
--
-- Generated from src/features/pharmacy-worklist/data/mock.js, which `bun run
-- seed` reads too. Run after pharmacy_status_model_migration.sql. Safe to
-- run more than once.

begin;

insert into public.pharmacy_plan_timers (health_plan, match_window_days, feed_lag_days, return_to_stock_days, refill_due_days, note)
values
  ('Humana Gold Plus',         10, 7, 14, 14, 'Placeholder until Astrana confirms feed lag'),
  ('SCAN Classic',             21, 7, 14, 14, 'Placeholder until Astrana confirms feed lag'),
  ('Blue Shield Medicare',     14, 7, 14, 14, 'Placeholder until Astrana confirms feed lag'),
  ('Aetna Medicare Advantage', 14, 7, 14, 14, 'Placeholder until Astrana confirms feed lag')
on conflict (health_plan) do nothing;

update public.pharmacy_worklist_members as m
set measures = (
  select coalesce(jsonb_agg(
    case when v.patch ? (e ->> 'code') then e || (v.patch -> (e ->> 'code')) else e end
    order by i), '[]'::jsonb)
  from jsonb_array_elements(m.measures) with ordinality as t(e, i)
)
from (values
  ('19404', '{"MAD":{"code":"MAD","pdc":79,"calcPdc":78,"failDate":"12/07/2026","daysLeft":23,"priorYearNonCompliant":false,"excluded":false,"projectedStatus":null,"drugInteraction":false,"pickupConfirmed":"10/20/2026","claim":{"status":"Paid","date":"09/07/2026","rxNumber":"RX-19404001"},"nextFillDue":"11/29/2026","medications":[{"status":"Active","unit":"MG","doseForm":"Tablet","route":"Oral","nonAdherenceReason":null,"notesToMd":"","internalNotes":"","id":"19404-mad-2","name":"Pioglitazone","generic":"pioglitazone","strength":"30","sig":"Take 1 tablet by mouth once daily","condition":"Type 2 diabetes","mpr":78,"pdc":79,"qty":90,"daysSupply":90,"lastFill":"09/07/2026","prescriber":{"npi":"1083617254","name":"Dr. Grace Lin","phone":"(626) 555-0188","fax":"(626) 555-0189","address1":"440 E Huntington Dr","city":"Arcadia","state":"CA","zip":"91006"},"pharmacy":{"ncpdp":"0598214","name":"CVS Pharmacy #9921","phone":"(626) 555-0190","address1":"255 W Foothill Blvd","city":"Claremont","state":"CA","zip":"91711"},"nextFill":"03/06/2027","refills":[{"date":"10/20/2026","qty":90,"daysSupply":90,"pharmacy":"CVS Pharmacy #9921","prescriber":"Dr. Grace Lin","prescriberAddress":"440 E Huntington Dr, Arcadia, CA, 91006","source":"Pickup confirmed by call"},{"coverage":"Part D","bin":"610649","pcn":"MEDDPRIME","rxGroup":"HUM-MAPD","processedDate":"09/08/2026","claimSeq":1,"date":"09/07/2026","qty":90,"daysSupply":90,"pharmacy":"CVS Pharmacy #9921","prescriber":"Dr. Grace Lin","prescriberAddress":"440 E Huntington Dr, Arcadia, CA, 91006","claimId":"RX-19404001","claimStatus":"Paid","planPaid":18.4,"copay":0},{"coverage":"Part D","bin":"610649","pcn":"MEDDPRIME","rxGroup":"HUM-MAPD","processedDate":"06/04/2026","claimSeq":1,"date":"06/03/2026","qty":90,"daysSupply":90,"pharmacy":"CVS Pharmacy #9921","prescriber":"Dr. Grace Lin","prescriberAddress":"440 E Huntington Dr, Arcadia, CA, 91006","claimId":"CLM-19404-MAD1-02","claimStatus":"Paid","planPaid":18.4,"copay":0},{"coverage":"Part D","bin":"610649","pcn":"MEDDPRIME","rxGroup":"HUM-MAPD","processedDate":"02/28/2026","claimSeq":1,"date":"02/27/2026","qty":90,"daysSupply":90,"pharmacy":"CVS Pharmacy #9921","prescriber":"Dr. Grace Lin","prescriberAddress":"440 E Huntington Dr, Arcadia, CA, 91006","claimId":"CLM-19404-MAD1-03","claimStatus":"Paid","planPaid":18.4,"copay":0}],"recentFill":"10/20/2026","recentFillSource":{"outcome":"Pickup confirmed by call","date":"10/20/2026","manual":false}},{"status":"Active","unit":"MG","doseForm":"Tablet","route":"Oral","nonAdherenceReason":null,"notesToMd":"","internalNotes":"","id":"19404-mad-3","name":"Metformin ER","generic":"metformin","strength":"500","sig":"Take 1 tablet by mouth daily with evening meal","condition":"Type 2 diabetes","mpr":85,"pdc":86,"qty":30,"daysSupply":30,"lastFill":"09/30/2026","prescriber":{"npi":"1083617254","name":"Dr. Grace Lin","phone":"(626) 555-0188","fax":"(626) 555-0189","address1":"440 E Huntington Dr","city":"Arcadia","state":"CA","zip":"91006"},"pharmacy":{"ncpdp":"0598214","name":"CVS Pharmacy #9921","phone":"(626) 555-0190","address1":"255 W Foothill Blvd","city":"Claremont","state":"CA","zip":"91711"},"nextFill":"11/29/2026","refills":[{"date":"10/20/2026","qty":30,"daysSupply":30,"pharmacy":"CVS Pharmacy #9921","prescriber":"Dr. Grace Lin","prescriberAddress":"440 E Huntington Dr, Arcadia, CA, 91006","source":"Pickup confirmed by call"},{"coverage":"Part D","bin":"610649","pcn":"MEDDPRIME","rxGroup":"HUM-MAPD","processedDate":"10/01/2026","claimSeq":1,"date":"09/30/2026","qty":30,"daysSupply":30,"pharmacy":"CVS Pharmacy #9921","prescriber":"Dr. Grace Lin","prescriberAddress":"440 E Huntington Dr, Arcadia, CA, 91006","claimId":"CLM-19404-MAD2-01","claimStatus":"Paid","planPaid":21.4,"copay":4},{"coverage":"Part D","bin":"610649","pcn":"MEDDPRIME","rxGroup":"HUM-MAPD","processedDate":"08/25/2026","claimSeq":1,"date":"08/24/2026","qty":30,"daysSupply":30,"pharmacy":"CVS Pharmacy #9921","prescriber":"Dr. Grace Lin","prescriberAddress":"440 E Huntington Dr, Arcadia, CA, 91006","claimId":"CLM-19404-MAD2-02","claimStatus":"Paid","planPaid":21.4,"copay":4},{"coverage":"Part D","bin":"610649","pcn":"MEDDPRIME","rxGroup":"HUM-MAPD","processedDate":"07/20/2026","claimSeq":1,"date":"07/19/2026","qty":30,"daysSupply":30,"pharmacy":"CVS Pharmacy #9921","prescriber":"Dr. Grace Lin","prescriberAddress":"440 E Huntington Dr, Arcadia, CA, 91006","claimId":"CLM-19404-MAD2-03","claimStatus":"Paid","planPaid":21.4,"copay":4}],"recentFill":"10/20/2026","recentFillSource":{"outcome":"Pickup confirmed by call","date":"10/20/2026","manual":false}}],"oneFillToInvincible":false,"priorYearPdc":[{"year":2025,"pdc":91},{"year":2024,"pdc":76}],"pdcProjected":98,"failDateProjected":null,"pendingPickupSince":null}}'::jsonb),
  ('19408', '{"MAH":{"oneFillToInvincible":true},"MAC":{"excluded":true,"exclusionType":"Hospice"}}'::jsonb),
  ('19409', '{"MAH":{"code":"MAH","pdc":76,"calcPdc":75,"failDate":"12/05/2026","daysLeft":29,"priorYearNonCompliant":false,"excluded":false,"projectedStatus":null,"drugInteraction":false,"pickupConfirmed":null,"claim":{"status":"Paid","date":"10/02/2026","rxNumber":"RX-19409101"},"nextFillDue":"11/01/2026","medications":[{"status":"Active","unit":"MG","doseForm":"Tablet","route":"Oral","nonAdherenceReason":null,"notesToMd":"","internalNotes":"","id":"19409-mah-2","name":"Losartan","generic":"losartan","strength":"50","sig":"Take 1 tablet by mouth once daily","condition":"Hypertension","mpr":89,"pdc":90,"qty":30,"daysSupply":30,"lastFill":"10/02/2026","prescriber":{"npi":"1427053961","name":"Dr. Alan Choi","phone":"(626) 555-0142","fax":"(626) 555-0143","address1":"1798 N Garey Ave","city":"Pomona","state":"CA","zip":"91767"},"pharmacy":{"ncpdp":"1459912","name":"Walgreens #2219","phone":"(626) 555-0175","address1":"1 W Duarte Rd","city":"Arcadia","state":"CA","zip":"91007"},"nextFill":"11/01/2026","refills":[{"coverage":"Part D","bin":"610649","pcn":"MEDDPRIME","rxGroup":"HUM-MAPD","processedDate":"10/03/2026","claimSeq":1,"date":"10/02/2026","qty":30,"daysSupply":30,"pharmacy":"Walgreens #2219","prescriber":"Dr. Alan Choi","prescriberAddress":"1798 N Garey Ave, Pomona, CA, 91767","claimId":"RX-19409101","claimStatus":"Paid","planPaid":18.4,"copay":0}],"recentFill":null,"recentFillSource":null}],"oneFillToInvincible":false,"priorYearPdc":[{"year":2025,"pdc":79},{"year":2024,"pdc":90}],"firstFill":true,"pdcProjected":null,"failDateProjected":null}}'::jsonb)
) as v(id, patch)
where m.id = v.id;

update public.pharmacy_worklist_members as m
set eligibility_status = v.eligibility_status,
    term_date = v.term_date
from (values
  ('19410', 'Termed', '10/15/2026')
) as v(id, eligibility_status, term_date)
where m.id = v.id;

insert into public.pharmacy_pickup_confirmations (id, member_row_id, measure_code, pickup_date, source, logged_by, logged_at, note)
values
  ('pu-19404-mad-10202026', '19404', 'MAD', '10/20/2026', 'Pharmacy call', 'Marcus Reyes', '2026-10-20T17:11:00.000Z'::timestamptz, 'Picked up; waiting for the Part D claim.')
on conflict (id) do nothing;

commit;
