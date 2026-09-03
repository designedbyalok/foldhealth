-- Program Activity Log seed for patient snpw-001 — activity across SNP, TOC,
-- AWV and HIU programs on several dates so the log groups by date → program.
-- Idempotent: clears this patient's rows first.
delete from patient_program_activity where patient_id = 'snpw-001';

insert into patient_program_activity
  (patient_id, program_code, program_name, occurred_at, actor_name, actor_initials, title, status_label, status_type, activity_kind) values
-- Sep 2, 2026 — SNP (4 activities, 2 users)
('snpw-001','SNP','SNP Program Updates','2026-09-02 14:30:00+00','Delores Conn','DC','AMTX COC UTR Letter','Sent Successfully to Patient','success','letter'),
('snpw-001','SNP','SNP Program Updates','2026-09-02 14:30:00+00','Delores Conn','DC','Discharge Summary Document Added','','neutral','document'),
('snpw-001','SNP','SNP Program Updates','2026-09-02 14:00:00+00','Delores Conn','DC','Pre-visit Details','Reviewed','success','clipboard'),
('snpw-001','SNP','SNP Program Updates','2026-09-02 12:30:00+00','Anthony Roberts','AR','4th Outreach - Outgoing Call','Attended / Scheduled Appointment','success','call'),
-- Aug 28, 2026 — TOC (3 activities, 2 users)
('snpw-001','TOC','TOC Program Updates','2026-08-28 12:30:00+00','Delores Conn','DC','3rd Outreach - Outgoing Call','Requested Call back','warning','call'),
('snpw-001','TOC','TOC Program Updates','2026-08-28 12:00:00+00','Anthony Roberts','AR','Care Plan Created','Sent for Review','warning','clipboard'),
('snpw-001','TOC','TOC Program Updates','2026-08-28 11:00:00+00','Delores Conn','DC','HRA Completed','Reviewed & Saved','success','clipboard'),
-- Aug 28, 2026 — AWV (1 activity)
('snpw-001','AWV','AWV Program Updates','2026-08-28 10:15:00+00','Delores Conn','DC','1st Outreach - Outgoing Call','Attended / Scheduled Appointment','success','call'),
-- Aug 15, 2026 — SNP (2 activities)
('snpw-001','SNP','SNP Program Updates','2026-08-15 12:30:00+00','Anthony Roberts','AR','SNP Program Status Change','Engaged','warning','status'),
('snpw-001','SNP','SNP Program Updates','2026-08-15 10:30:00+00','Delores Conn','DC','2nd Outreach - Send SMS','Inactive Phone Line / Wrong Number','error','sms'),
-- Aug 15, 2026 — HIU (1 activity)
('snpw-001','HIU','HIU Program Updates','2026-08-15 12:30:00+00','Delores Conn','DC','1st Outreach - Send Email','Provider Communication','warning','email'),
-- Aug 3, 2026 — TOC (2 activities)
('snpw-001','TOC','TOC Program Updates','2026-08-03 09:15:00+00','Devanshi Sharma','DS','Discharge Summary Document Added','','neutral','document'),
('snpw-001','TOC','TOC Program Updates','2026-08-03 09:00:00+00','Devanshi Sharma','DS','Care Coordination Note','Added','success','clipboard');
