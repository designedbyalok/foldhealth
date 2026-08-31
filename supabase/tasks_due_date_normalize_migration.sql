-- Normalize task due_date storage to the canonical MM-DD-YYYY shape.
-- A handful of automation/sign-off rows landed as ISO YYYY-MM-DD, which the
-- app's MM-DD-YYYY parser misread — breaking overdue detection, sorting, and
-- display for those rows. Convert them in place. Idempotent: only ISO rows match.
update tasks
set due_date = to_char(due_date::date, 'MM-DD-YYYY')
where due_date ~ '^\d{4}-\d{2}-\d{2}$';
