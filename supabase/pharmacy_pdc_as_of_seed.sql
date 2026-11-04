-- Pharmacy worklist: the gap report date behind each plan PDC.
--
-- The plan's PDC is as of the report it came in (monthly or every two weeks),
-- so the worklist moves it day by day with the days covered or missed since
-- (pdcToDate in src/features/pharmacy-worklist/fillEvents.js). Without
-- `pdcAsOf` on a gap the plan's number is shown as sent. A manual override,
-- `pdcManual`, and the plan's own Open / Closed status, `planStatus`, also
-- live in the `measures` jsonb, so none of these need a column.
--
-- Backfill: the 10 demo members (19401-19410) take the sample data's report
-- date, 10/22/2026, on every gap that has a plan PDC and no report date yet.
-- The gap file import should set `pdcAsOf` to the file's date from now on.

begin;

update public.pharmacy_worklist_members as m
set measures = (
  select jsonb_agg(
    case
      when x ? 'pdc' and x->'pdc' <> 'null'::jsonb and not x ? 'pdcAsOf'
        then x || jsonb_build_object('pdcAsOf', '10/22/2026')
      else x
    end
    order by ord
  )
  from jsonb_array_elements(m.measures) with ordinality as e(x, ord)
)
where m.id in ('19401', '19402', '19403', '19404', '19405', '19406', '19407', '19408', '19409', '19410')
  and jsonb_typeof(m.measures) = 'array'
  and jsonb_array_length(m.measures) > 0;

commit;
