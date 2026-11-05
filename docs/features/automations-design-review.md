# Automations: Figma design review

Source: Figma file `CH7Ce76BDx0a2boek5REPG`, section `2966:133582` ("Section 1", 129 nodes, about 100 full
screens). Reviewed on 2026-10-22 before implementation; this document is the summary a builder needs.

## 1. What the section contains

The frames describe one product area, **Settings > Automations**, built around a single sample record
("Patient onboarding and welcome automation"). Grouped into surfaces:

| Surface | Frames (node ids, 2966:…) | Notes |
|---|---|---|
| Entry and onboarding | 140076 "Try now" popover, 164123 guide tooltip, 133583 video modal, 61 / 67 coachmarks | Two coachmarks drawn out of "6 simple steps". |
| Template discovery | 138824 grid, 133719 table, 134768 preview modal, 137972 full-screen canvas | Category tabs, Use Template. |
| My Automations | 137519 / 137860 / 137761 grid by status, 133943 table, 138001 → 137639 list after publish | Status tabs, Switch, Run, kebab menu (134256 / 134255). |
| Builder shell | 38, 61, 62, 60, 59, 58, 29, 30, 31, 26 | Breadcrumb, title + rename, status pill, Test, History, Duplicate, Close, Save; left palette; zoom/fit/recenter; palette collapse. |
| Trigger selection | 62 | Single-select list grouped by Match condition, Patient, Prospect, Employee, Membership. |
| Condition editing | 64, 65, 66, 70, 27, 134 | Grouped field/operator/value rows with a natural-language summary. |
| Action editing | 71, 73, 72, 28, 10 | Send Form, Send Email / Appointment Link: template, channel, merge-tag warning, preview. |
| Branching | 144, 75, 76, 77, 78, 139, 80, 82, 81, 145 | Outcome chips (All Sent / Few Submitted / None Submitted, Opened / Not Opened, Booked / Not Booked, channel split). |
| Delays, reminders, repeat | 142, 78, 10 | "After 2 Days" chip, Send Reminder, Repeat. |
| Duplicate-action warning | 140 → 141 → 142 | AI card: Edit Content / Add Delay / Delete. |
| Palette filtering | 79, 83 | Actions disabled per insertion point. |
| Micro automations | 83 → 141174 → 84 → 145 | Picker modal, inserted as a grouped container. |
| Delete node | 140815 | Confirm with affected member count. |
| Test run (11 steps) | 116 intro, 133…99 (steps 1–4), 128…149 (steps 5–11), 115 complete | Ready / In-process / Success / Error / Error-fixed / Retry. |
| Save and publish | 134583 empty, 134597 filled, 161295 toast | Name, description (150 max), population group, run schedule. |
| Manual run | 161455 / 161473 / 161491 drawer, 137758 toast | Member, Patient Group, Lead Group, Employer. |
| History | 133593 History Log drawer | Edit and run entries. |
| Quick view | 165100 | Stats row, embedded read-only canvas, Edit / Analytics / Duplicate / Run. |
| Analytics | 135 Global, 137 Node Level, 164124 / 164180 / 164193 tooltips | KPIs, donut, email and SMS bar charts. |
| Drilldowns | 161297 / 163763 overview, 161524 / 162253 / 162644 / 163035 email, 161895 / 163405 SMS, 134257 row menu | Paginated member tables. |
| Patient investigation | 164721 member trace, 165034 retry tooltip, 164206 patient profile | Re-trigger, per-node status colors. |
| Shared email content | 13 Content > Emails, 140823 delete guard, 141397 "used by" drawer | Delete is blocked or reviewed when automations use it. |

Two canvas generations exist side by side: a **classic** tree (member counts on every node, Check Status /
Delay / End Thread) and a **V2** canvas (micro-automation containers, outcome chips, Email | None chips, right
edit panel). The V2 canvas is the one used by the builder, test run, analytics node view and member trace.

## 2. Missing behavior (not drawn, needs a decision)

### Builder
1. Status pill options other than "Active Automation" (Draft appears once, on 59). Whether a new, unsaved
   automation can be Active.
2. Save vs autosave: the tooltip promises autosave every 10 minutes, but no saving / saved state and no
   unsaved-changes prompt on Close are drawn.
3. How nodes are added: drag only, or click and "+" insertion points; drop targets and invalid drops.
4. Rules for which actions are enabled at an insertion point (79 and 83 enable different sets with no rule).
5. Trigger change after conditions exist; how a trigger filters conditions and actions (copy promises it).
6. AND, OR, Delay and Repeat configuration panels (Delay value picker, Repeat interval and count are never shown).
7. Config panels for most actions: SMS, IVR, Reminder, Push, App Invitation, Lab, General Task (only shown inside
   the test run), Education Content.
8. Operator lists, value lists and units for every condition field; validation and Save-enabled rules.
9. Meaning of the "Email | None" chips under every action card.
10. The duplicate-action check: when it runs (live, on Save, on Test), what Edit Content and Delete do, where
    "2 Days" in Add Delay comes from.
11. Micro automation: search, preview, editability after insert, collapse.
12. Delete node: what happens to downstream nodes.

### Test run
13. What Skip This Step, Continue (after an error), Play All Steps and Stop do, and how a skipped node looks.
14. Which test contact is used and how a branch outcome is chosen; the design runs every branch.
15. Error states only exist for a General Task with an empty required field; no send-failure state.
16. Whether edits made inside the test panel save back to the automation (154903 implies yes).
17. The completion panel has no call to action ("ready to go live" but no Activate button).

### Lists, run, history
18. Kebab menu: when the Analytics item is hidden (134255 vs 134256).
19. When the Run button appears on a card or row (some Active automations have it, some do not).
20. Run drawer: member search results, Lead Group and Employer modes, single vs multi-select, no-results state.
21. Difference between "Executed with errors" and "Failed"; the Recently executed and Failed tabs are not drawn.
22. Empty states for templates, My Automations, history and every analytics table.

### Analytics and investigation
23. Overview In-progress tab and the Delivered tile drawers are not drawn.
24. Duration, Action Types and Status filter options; download / expand / menu actions on cards.
25. Retry Automation vs Re-trigger: confirmation, disabled state for completed members, result feedback.
26. Create Task from a member row has no form; Edit Member target.
27. How "mins saved" is computed.

### Content
28. Content delete: whether Delete is blocked while automations are active; what the "used by" drawer's toggles
    turn off.

## 3. Inconsistent sample content (not treated as requirements)

### Editor copy that belongs to another automation
- Send Form editor (71, 73, 28) uses template "Caregiver Weekly Check-in" but previews an **appointment
  confirmation** ("Your Appointment Has Been Successfully Scheduled", Rescheduled From, Purpose of Visit:
  Fever).
- Appointment Link editor (10) previews the same "already scheduled" email instead of a booking link, and the
  panel is titled "Send Email" for an Appointment Link node.
- Step 5 and 6 reminders are about a form but the email is a weekly check-in *meeting* "on {Date} at {Time}".
- Step 11 (Repeat) shows the wearable education email.
- Save form description (134597) is appointment-reminder copy ("reduces no-show rates… rescheduling"). It is 189
  characters against a 150 limit while the counter reads 149/150.
- Every template card shares the onboarding description and identical stats.

### Merge tags
- Single-brace and free-text tags: `{Patient Name}`, `{Dr. Name}`, `{Caregiver's Name}`,
  `{Client/Patient's Name}`, `{User's Name}`, `{Date}`, `{Time}`, `{Scheduled Date & Time}`, `[Dr. Name]`.
  The app uses `{{key}}` tokens from `src/features/email-builder/mergeTags.js`.
- "Dr. Name merge tag is not found in your system" while the preview still uses it.
- Broken spacing: "{Dr. Name}has been scheduled".
- Content subjects with unresolved `[Date]`, `[Clinic/Hospital Name]` and a hard-coded "Dr. Smith".

### Totals that do not add up
- Overview: Completed 612 + In-progress 321 + Failed 165 = 1098, but Total Executions is 1000, success ratio is
  79% (matches neither), and "Executed 287 times".
- Email: Sent 515 vs Delivered 312 + Failed 89 = 401. SMS repeats the exact email numbers and its chart draws 5
  series for 3 metrics.
- Opened and Clicked info tooltips are identical (289 / 109 / 398); 289 unique clicks contradicts Clicked 209.
- Classic tree: Opened 150 splits into Yes 150 + No 50; Yes 150 leads to Assign Task 100.
- Node level: Send Form 200 splits into 150 + 150 + 50 = 350.
- V2 channel split: Email 22% + None 4% = 26%.
- Lists: My Automations 4 / 11 / 12 / 15; Active 4 / 5 / 8; Active 4 + Inactive 3 never reaches the total;
  "Executed with errors 1" vs "2 Errors"; Templates All 27 vs categories summing to 23.
- Overview pagination ends at 10 pages for 612 and 165 rows.

### Population and audience labels that disagree
- Condition: patients tagged High risk + Hypertensive (250 members in the builder, 800 in node level, 350 in
  the delete dialog).
- Save form population: "Diabetic Patients". My Automations: "New Patient Onboarding", audience 1892.
  Quick view: target audience 2889. Run drawer groups: "Diabetes Member Onboarding" 458,
  "Hypertention Member Onboarding" 732 (misspelled).
- Recipients switch between patients, caregivers ("Dear {Caregiver's Name}") and "User".
- Run schedule "Every Week" conflicts with the event trigger "When Contact added or update".

### Names, dates and labels that drift
- Builder title "New Automation" next to a breadcrumb with the saved name and an "Active" status.
- Form "Send weekly check-in form to caregivers" / template "Weekly check-in form updates" on the card vs
  "Fold Health Weekly Check-in Form" / "Caregiver Weekly Check-in" in the panel.
- Template names and categories differ between grid, table, picker and list (NPS "for 2 years", Health
  Insurance Renewal long and short names, "Clinical compliance" vs "Care compliance").
- Execution type "Automatic" in the preview vs "Manual" in the list for the same automation.
- Dates: filters say Apr 01 – Apr 07 while every member row is 03-13-2024 and last executed is 03-18-2024;
  dashboard filter 02-2024 – 03-2024 vs cards "March 2023 – June 2023".
- Devon Lane appears in both Completed and Failed; Completed members show failed emails.
- SMS drawer column says "Email" but shows phone numbers.
- Patient profile: "Richard Willson" page with a synopsis about "Daniel"; DOB 1965 shown as 67Y.
- Branding: Stanford Care Center, Dr. Joe Collins, Stanford@gmail.com, placeholder phone "8888 888 888" inside
  Fold Health email footers.

### Copy errors
"When Contact added or update", "A Contact enrol new membership", "A dependents of employee added",
"If member have tags & labels", "Lets’ start", "enrolment" (UK), "Hypertention", "Diabeties", "Asthama",
"Delete Node ?", "Delete Content ?", "This is supporting text", "Select  Labels".

## 4. Decisions made in the build

Where the Figma left behavior open (section 2), the build chose the following. Each is easy to change.

- **Where it lives:** Settings > Automations replaces Settings > Automation Rules. Each enrollment rule became an
  automation: "A patient is enrolled in a care program" trigger → "Patient matches clinical criteria" condition →
  "Attach care plan templates" action. Enrollment still auto-applies templates and queues the review task.
- **Execution:** runs are simulated and stored (run, member path, message outcomes). Nothing is delivered. General Task
  steps create real tasks for single-member runs, retries and re-triggers; group runs record them.
- **Statuses:** Draft, Active, Inactive. New automations start as Draft. Publishing (Active) requires every step to be set up.
- **Saving:** the builder edits a working copy, autosaved every 10 minutes; the published graph keeps running until Save.
  Close with unsaved changes asks before discarding.
- **Adding steps:** drag from the palette onto a "+" (all "+" show while dragging), or click a palette item to add it under
  the selected step. Reminder and Repeat need a message step above them; care plan actions need the enrollment trigger;
  a micro automation can't contain another.
- **Duplicate check:** runs live on every edit: the same email or text sent twice back to back (or twice on one branch).
  Add Delay inserts a 2 day delay and opens it for editing.
- **Test run:** walks every branch depth first; delays are skipped; a step with an empty required field errors, the author
  fixes it in the panel (saved to the automation), then tests it again or continues (marked skipped). Play All stops at the
  first error. The completion panel offers Publish.
- **Lists:** extra Draft tab; "Executed with errors" is the latest run having failures (the separate Failed tab is dropped);
  "Recently executed" is the last 7 days; Run shows on every Active automation.
- **Retry and Re-trigger:** both resume the member from the failed or waiting step, keeping the steps that already ran.
- **Form outcomes:** "All Sent" is labelled "All Submitted" to match its siblings.
- **Not built:** the "Try now" announcement popover, the onboarding video (no asset; Get Started shows the steps instead),
  and the Home dashboard frame (not automation-specific).
