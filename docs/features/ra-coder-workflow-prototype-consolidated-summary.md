# RA Coder Workflow Prototype, Consolidated Summary 


<span style="color: rgb(15, 71, 97);">1. Changes Required on Prototype</span>

<span>**Worklist**, mostly resolved, with new structural items </span>

- <span>Resolved: DOS Source filter added, with source indicator now visible directly on each row </span>


- <span>Resolved: Demo data cleaned up, varied visit types, varied Open ICD counts, correct POS labels, all dates in 2026 </span>


- <span>Resolved: Assignee/Status consolidated into dedicated Support Team and Coder columns with status shown inline </span>


- <span>Needs resolution: worklist header still shows "Due Date" as the active sort, but the talk track explicitly calls for **Created Date sort**, direct conflict between what's built and what's scripted for the demo. </span>


- <span>**New:** Either remove the current Status column from the worklist and replace it with a visual status-progress indicator (e.g., a stepper showing where the record sits in CODER→QA→COMPLIANCE), or remove the column entirely, needs a design decision, not both. </span>


- <span>**New:** Grouping logic on the worklist and Single View should be consistent, grouped by document, assignment, and status the same way in both places, rather than each screen having its own grouping logic. This extends the earlier "verify patient/document-level grouping isn't blending Fold/Cozeva logic" item, now explicitly requiring worklist/Single View parity. </span>


- <span>**New, terminology:** Rename the status value "Returned" to **"Rebuttal"** throughout the worklist and Single View. </span>

<span>**Document intake / extraction / Add Record flow** </span>

- <span>Remove the separate "start extraction" button, OCR triggers automatically on upload </span>


- <span>Support multiple file upload (not just single file) </span>


- <span>Nightly job reads each uploaded document and auto-adds records directly if all 5 required fields are correctly extracted, manual Pass/Fail review may only be needed for documents the job can't auto-validate. Needs confirmation with Ketan/Alok, then with Astrana. </span>


- <span>Failed-extraction handling: a document can fail specifically because of an incorrect file extension. Prototype should demonstrate this failure state and surface it immediately, not silently drop the record. </span>


- <span>**New:** The global-level "Add Record" flow (as opposed to adding a document at the row level) currently shows two separate document-upload panels side by side (left and right). This should be simplified to the standard/default single upload screen, remove the duplicate side-by-side panels. </span>

<span>**Single View / Sweep Mode** </span>

- <span>Complete the Single View change from single-level to document-level </span>


- <span>Full/Mini Sweep distinction removed; a single unified Sweep Mode is retained and is part of the intended talk track </span>


- <span>Fix the underlying issue this doesn't solve on its own: accepting one ICD applies across all DOS's sharing that code, with no easy way to navigate to each affected DOS </span>


- <span>Regression: "DOS: Set 1" labeling is still showing in the Single View panel header, despite the agreed switch to Created Date labeling, flag to Ketan/Alok. </span>


- <span>**New:** Comments, Activity Log, History, and Claims should each be placed at the **DOS level** within Single View, not at the record/patient level. This also resolves how Claim access should work, it should live directly on the DOS itself rather than requiring a separate jump/navigation mechanism. </span>

<span>**Suspects & Recaptures** </span>

- <span>Partially addressed: section header still reads "ICDs Not Associated with DOS," not "Suspects and Recaptures", the individual entry does carry a "Suspect" tag, but the header rename hasn't shipped </span>


- <span>Resolved: Accept/Decline actions now present as clickable checkmark/X actions for standard ICD rows </span>


- <span>Fold already pulls actual ICD codes (not just HCC codes) directly from Astrana's API for suspects/recaptures, no need to build HCC-to-ICD mapping logic for coders; confirms reduced scope on the "HCC-scoped ICD dropdown" item to override/correction cases only </span>


- <span>**Missed Opportunity, full requirement set:**  </span>


- <span>Default action for suspect/recapture rows should be **Missed Opportunity**, not the Accept tick mark used on regular ICD rows </span>


- <span>Must be moved out of the "three dots" overflow menu and shown as the primary, visible button/icon by default </span>


- <span>For suspect/recapture rows specifically, the two default actions should be labeled **"Missed Opportunity"** (accept-equivalent) and **"Dismiss"** (decline-equivalent), distinct from "Accept/Decline" on standard ICD rows </span>


- <span>Clicking Missed Opportunity should do two things: (a) send the entry to the ASM file as an "Added" record, and (b) annotate/flag the physician that they missed this code, needs confirmation this dual behavior is wired up on the backend </span>


- <span>Fix the underlying icon bug, the "three dots" / Missed Opportunity icon wasn't rendering or functioning correctly during the internal walkthrough </span>


- <span>None of the above is confirmed as built in either screenshot reviewed so far </span>


- <span>Default ICD selection should show the clinically correct code </span>


- <span>DOS selection should be restricted to single-select tied to the existing document, no custom date </span>


- <span>Auto-populate Rendering Provider and Place of Service on DOS selection </span>

<span>**Other UX reductions** </span>

- <span>Auto-set status to Complete when "Add to Work List" is clicked, where applicable </span>

<span>**Process/copy fixes** </span>

- <span>"Send to Billing" language updated to **"Ready for ASM generation"** </span>


- <span>Confirm lab/imaging documents don't create new worklist rows or count toward a coder's review denominator </span>


- <span>Activity Log: should also live at the DOS level (see Single View above), but exact content/scope still needs confirmation. </span>

<span style="color: rgb(15, 71, 97);">2. Expectation from the Prototype </span>

<span>**2.1 Role-specific prototype / Vercel link** </span>

<span>Build around four confirmed roles, Support Team, Coder, QA, Compliance. Talk track confirms the demo should be enacted persona by persona, starting with Support Team. </span>

<span>**2.2 Reflect assignment logic and status changes** </span>

<span>Prototype should behave per the documented CODER→QA→COMPLIANCE flow, QA sampling percentages, Returned/Rebuttal logic, and overdue/SLA transitions, including showing resulting state changes. </span>

<span>**2.3 Explorable like a real product** </span>

<span>Astrana's team should be able to click through themselves, search a patient, open a record, take an action, see the status update. </span>

<span>**2.4 Advantages of the Review Screen that need to be highlighted** </span>

1. <span>Transparency into errored records that Cozeva doesn't surface at all today. </span>


2) <span>Instead of an errored document being shared externally with the physician as-is, Fold surfaces the error upfront, internally, before it goes anywhere. </span>


3. <span>Demonstrate a document that fails specifically because of an incorrect file extension, a concrete, visible failure case. </span>


4) <span>In Cozeva, a failed document waits until the next day to be corrected and picked up for review; in Fold, the error is shown immediately. </span>

<span>**2.5 Demo patient use cases needed** </span>

<span>The demo data should include, at minimum: </span>

- <span>A row that is ready for Support Team review, document already uploaded, but sitting in a pending status </span>


- <span>A Reject interaction, a document or record that gets actively rejected during the walkthrough, so the rejection path itself is visible (not just the happy path) </span>

<span>**2.3.1 Talk Track / Guided Exploration** </span>

<span>**Path A, Support Team** </span>

1. <span>Support Team member uploads the document. </span>


2) <span>A nightly job reads the document and auto-adds the record directly if all 5 required fields are correctly extracted, no manual action needed in this case. </span>


3. <span>The document remains attached to the resulting record for reference. </span>


4) <span>Confirm the worklist is sorted by Created Date (this is where the current "Due Date" build discrepancy will surface if not fixed beforehand). </span>


5. <span>Walk through what happens when a document fails (e.g., wrong file extension), show the error appears immediately, not next day. </span>


6) <span>Walk through the Reject interaction on a use-case record, show the resulting status and where it routes. </span>


7. <span>**Explicitly demonstrate: the Coder does not begin review until the Support Team has reviewed the document.** This should be shown as a hard sequencing step in the walkthrough, the record should visibly sit unavailable/blocked for the Coder until Support Team action is taken. </span>

<span>**Path B, Coder** </span>

1. <span>Filter worklist to your name; note the combined AWV + HCC list with the AWV filter on Visit Type. </span>


2) <span>Confirm you cannot begin a record whose document hasn't cleared Support Team review yet (continuation of Path A step 7). </span>


3. <span>Open a record with multiple DOS from one uploaded document, confirm each is labeled by Created Date. </span>


4) <span>Once the Primary row is complete, move to Sweep Mode to address all other records assigned to you at once. </span>


5. <span>Within Sweep Mode: accept an ICD with highlighted evidence; decline another with a reason. </span>


6) <span>Open a record with a Suspect/Recapture, note the ICD is already provided directly from Astrana's API; check the section labeling and confirm whether "Missed Opportunity" and "Dismiss" appear as the default actions. </span>


7. <span>Select a DOS for the suspect from the dropdown; confirm Rendering Provider/POS auto-populate. </span>


8) <span>Mark the record "Complete" with one row still unactioned, confirm auto-accept/auto-delete behavior. </span>


9. <span>From within a DOS, confirm Comments, Activity Log, History, and Claims are all accessible directly at that DOS level. </span>

<span>**Path C, QA** </span>

1. <span>Filter to QA status, confirm only the sampled percentage appears. </span>


2) <span>Return a record with "Major issues", confirm it now shows as "Rebuttal" status and routes back to coder/CODER correctly. </span>


3. <span>Confirm a corrected record cycles back without losing prior work. </span>

<span>**Path D, Compliance** </span>

1. <span>Filter to Compliance status, confirm random-pull behavior, including records skipped by QA. </span>


2) <span>Confirm view-only restriction when a downstream stage is still in progress. </span>

<span style="color: rgb(15, 71, 97);">3. Summary of Plan for Next Steps </span>

1. <span>Pooja collates all points from both July 6 discussions (internal prep call + external Astrana review) plus this latest round of feedback. </span>


2) <span>Reconcile the Support-Team-gates-Coder rule with the previously confirmed SLA/overdue escalation logic, these need to work together, not contradict each other, before the walkthrough script is finalized. </span>


3. <span>Seed the two required demo use-cases (pending Support Team review; Reject interaction) into the patient data. </span>


4) <span>Get a screenshot or walkthrough of the expanded Suspect/Recapture row to close out the remaining items. </span>


5. <span>Share the Vercel link with Nallu and her team, using the role-specific talk track (Section 2.3.1) as the guided self-exploration script. </span>


6) <span>Collect their feedback and integrate it into the next iteration. </span>

<span style="color: rgb(31, 78, 121);"> </span>

<span> </span>

<span style="color: rgb(15, 71, 97);">4 RA Coder Workflow User Journey </span>

<span style="color: rgb(15, 71, 97);">*Path A: Support Team*</span> 

<span>Entry point: user logs in and lands on the HCC Worklist, default sorted by Created Date. Upload/Add Record is out of scope for this walkthrough, the journey below assumes the document has already been uploaded and is already attached to the record; it starts from the Support Team review step. </span>

<span style="color: rgb(15, 71, 97);">A1. Review a record with a document already attached </span>

<table style="min-width: 100px;">
<colgroup><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"></colgroup><tbody><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Step</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>User Action</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Screen / UI Element</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Expected Result</strong>&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">1&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Login as a Support Team user&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Login screen&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">User authenticates and lands on the HCC Worklist, default sorted by Created Date; rows show Support Team and Coder columns with status shown inline.&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">2&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Apply the “Support Team Status:” filter, select “Action Needed”&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Worklist filter bar – “Support Team Status:” dropdown&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Worklist narrows to “Action Needed” rows, records with a document already attached, waiting on Support Team review before Coder assignment.&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">3&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Open a row with status “Action Needed”&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Worklist row → side drawer&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Drawer opens showing the attached document preview and the extracted record data for review.&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">4&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Review the extracted fields against the document and click Pass (or select rows and bulk-Pass)&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Side drawer / worklist row checkboxes – Pass action&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Status moves off “Action Needed” and the record becomes eligible for Coder assignment.&nbsp;</span></p></td></tr></tbody>
</table>

<span style="color: rgb(15, 71, 97);">A2. Reject path (negative scenario) </span>

<table style="min-width: 100px;">
<colgroup><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"></colgroup><tbody><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Step</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>User Action</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Screen / UI Element</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Expected Result</strong>&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">1&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Open a record with status “Action Needed” and click Reject&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Worklist row → side drawer – Reject action&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Record status updates to reflect rejection; the record routes out of the active Coder queue so the rejection path is visibly distinct from the happy path.&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">2&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Attempt to open a record from the Coder’s view whose status is still “Action Needed”&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Worklist – Coder-filtered view&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Record is visibly blocked/unavailable to the Coder until Support Team clears the “Action Needed” status, this is a hard sequencing gate, not a soft suggestion.&nbsp;</span></p></td></tr></tbody>
</table>

<span> </span>

<span style="color: rgb(15, 71, 97);">*Path B: Coder*</span> 

<span>Entry point: user lands on the Worklist after Support Team has cleared the document. </span>

<span style="color: rgb(15, 71, 97);">B1. Filter and open a standard record </span>

<table style="min-width: 100px;">
<colgroup><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"></colgroup><tbody><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Step</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>User Action</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Screen / UI Element</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Expected Result</strong>&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">1&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Login as a Coder&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Login screen&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">User authenticates and lands on the Worklist. Record is available only after Support Team has cleared the document (“Action Needed” status resolved).&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">2&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Apply the “Assignee:” filter, select own name&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Worklist filter bar – “Assignee:” dropdown&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Worklist narrows to the Coder’s own combined AWV + HCC list.&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">3&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Optionally apply the Visit Type filter = AWV&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Worklist – Visit Type filter&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">List narrows further to AWV-specific rows only.&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">4&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Click on a record row with multiple DOS from one uploaded document&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Worklist row → Single View drawer&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Single View opens at the document level; each DOS within it is labeled by Created Date (not “DOS: Set 1”).&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">5&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Accept or Decline an individual ICD on a standard row&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Single View – checkmark / X icons on the ICD row&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">ICD status updates inline; evidence supporting the code is highlighted in the source document.&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">6&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Within Single View, open the Comments, Activity Log, History, and Claims sections&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Single View – DOS-level tabs&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Each of these is scoped to the specific DOS selected, not the record/patient as a whole; Claims can be opened directly from the DOS without a separate jump.&nbsp;</span></p></td></tr></tbody>
</table>

<span style="color: rgb(15, 71, 97);">B1a. View Activity Log for actions taken on ICDs </span>

<table style="min-width: 100px;">
<colgroup><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"></colgroup><tbody><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Step</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>User Action</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Screen / UI Element</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Expected Result</strong>&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">1&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">From within a DOS in Single View, open the Activity Log tab&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Single View – DOS-level Activity Log tab&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Activity Log opens scoped to that DOS, showing a chronological record of actions taken on its ICDs (e.g., Accept, Decline, add, delete), each with user, timestamp, and action type.&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">2&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Locate a specific ICD action (e.g., a Decline) in the log&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Activity Log – entry list&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Entry shows which ICD was actioned, what action was taken, who took it, and when, read-only, no edit action available from the log itself.&nbsp;</span></p></td></tr></tbody>
</table>

<span style="color: rgb(15, 71, 97);">B1b. Bulk actions on ICDs in Single View </span>

<table style="min-width: 100px;">
<colgroup><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"></colgroup><tbody><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Step</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>User Action</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Screen / UI Element</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Expected Result</strong>&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">1&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Within Single View, select multiple ICD rows using row checkboxes&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Single View – ICD row checkboxes&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Selected rows are highlighted; a bulk action bar appears (e.g., bulk Accept, bulk Decline).&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">2&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Click the desired bulk action (e.g., Accept) with rows selected&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Single View – bulk action bar&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">All selected ICD rows update to the chosen status in a single action; each update is reflected individually in the Activity Log.&nbsp;</span></p></td></tr></tbody>
</table>

<span style="color: rgb(15, 71, 97);">B2. Sweep Mode </span>

<table style="min-width: 100px;">
<colgroup><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"></colgroup><tbody><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Step</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>User Action</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Screen / UI Element</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Expected Result</strong>&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">1&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Once the primary DOS/row is complete, toggle Sweep Mode on&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Single View – Sweep Mode toggle (corner of screen, not a dropdown)&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">All remaining open sets for the patient consolidate into a single reconciled ICD-level view (not DOS-level).&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">2&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Accept an ICD with highlighted evidence&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Sweep Mode – ICD row, Accept icon&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">ICD is accepted; supporting evidence in the document is highlighted for reference.&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">3&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Decline another ICD and select a reason&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Sweep Mode – ICD row, Decline icon → reason dropdown&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">ICD is declined with the selected reason recorded; user automatically advances to the next ICD.&nbsp;</span></p></td></tr></tbody>
</table>

<span style="color: rgb(15, 71, 97);">B3. Suspect / Recapture row </span>

<table style="min-width: 100px;">
<colgroup><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"></colgroup><tbody><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Step</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>User Action</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Screen / UI Element</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Expected Result</strong>&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">1&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Open a record containing a Suspect/Recapture entry&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Worklist row → Single View – “Suspects and Recaptures” section&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">The actual ICD code is shown (pulled directly from Astrana’s API), no HCC-to-ICD mapping step needed.&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">2&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Review the default action buttons on the row&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Suspect/Recapture row – primary action buttons&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">“Missed” and “Dismiss” appear as the default, visible actions in place of Accept/Decline, not buried in a three-dot overflow menu.&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">3&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Select a DOS from the dropdown for the suspect/recapture entry&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Suspect/Recapture row – DOS dropdown&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Rendering Provider and POS auto-populate based on the selected DOS.&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">4&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Click “Missed”&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Suspect/Recapture row – Missed button&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Entry is sent to the ASM file as an “Added” record (confirmed backend behavior).&nbsp;</span></p></td></tr></tbody>
</table>

<span style="color: rgb(15, 71, 97);">B4. Completing a record with an unactioned row </span>

<table style="min-width: 100px;">
<colgroup><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"></colgroup><tbody><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Step</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>User Action</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Screen / UI Element</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Expected Result</strong>&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">1&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Click “Complete” on a record while one ICD row is still unactioned&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Single View – Complete button&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">System applies its default auto-accept/auto-decline behavior to the unactioned row before finalizing status as Complete.&nbsp;</span></p></td></tr></tbody>
</table>

<span style="color: rgb(15, 71, 97);">*Path C: QA*</span> 

<table style="min-width: 100px;">
<colgroup><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"></colgroup><tbody><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Step</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>User Action</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Screen / UI Element</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Expected Result</strong>&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">1&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Login as a QA user&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Login screen&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">User authenticates and lands on the Worklist.&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">2&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Apply the “QA Status:” filter&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Worklist filter bar – “QA Status:” dropdown&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Only the sampled percentage of records for QA review appears (per configured sampling %).&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">3&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Open a record and select “Return” with reason “Major issues”&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Single View – Return action, reason dropdown&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Status updates to “Rebuttal” (renamed from “Returned”) and the record routes back to the Coder.&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">4&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Reopen the same record after the Coder resubmits it&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Worklist – QA-filtered view&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Record cycles back into QA without losing prior comments, history, or ICD decisions.&nbsp;</span></p></td></tr></tbody>
</table>

<span style="color: rgb(15, 71, 97);">*Path D: Compliance*</span> 

<table style="min-width: 100px;">
<colgroup><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"></colgroup><tbody><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Step</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>User Action</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Screen / UI Element</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Expected Result</strong>&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">1&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Login as a Compliance user&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Login screen&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">User authenticates and lands on the Worklist.&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">2&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Apply the “Compliance Status:” filter&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Worklist filter bar – “Compliance Status:” dropdown&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Random-pull records appear, including records that were skipped during QA sampling.&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">3&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Attempt to take an action on a record where a downstream stage is still in progress&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Single View – action buttons&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Buttons are disabled / view-only; Compliance can view but not act while the record is still in an active downstream stage.&nbsp;</span></p></td></tr></tbody>
</table>

 

<span> </span>

<span style="color: rgb(15, 71, 97);">*Path E: Manager*</span> 

<span>Entry point: user logs in and lands on the Worklist with full visibility across all role columns (Support Team, Coder, Reviewer 1, Reviewer 2/QA, Reviewer 3/Compliance) and their per-role statuses (New, In Progress, Completed, etc., per the confirmed HCC-level status model). </span>

<span style="color: rgb(15, 71, 97);">E1. Single-record assignment from the Worklist </span>

<table style="min-width: 100px;">
<colgroup><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"></colgroup><tbody><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Step</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>User Action</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Screen / UI Element</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Expected Result</strong>&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">1&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Login as a Manager&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Login screen&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">User authenticates and lands on the Worklist with all role columns visible (Support Team, Coder, Reviewer 1/2/3).&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">2&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Locate a record row where a role column shows “Assign” (unassigned) instead of a name&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Worklist row – role column (e.g., Coder column)&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">“Assign” link/icon is visible in that role’s column for the row, indicating no one is currently assigned for that role.&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">3&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Click “Assign” under the target role column&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Worklist row – Assign link&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Assignee picker opens, listing eligible users for that specific role (e.g., eligible Coders).&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">4&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Select a user from the picker&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Assignee picker – user list&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Assignment saves; the role column updates to show the assignee’s name with status “New.”&nbsp;</span></p></td></tr></tbody>
</table>

<span style="color: rgb(15, 71, 97);">E2. Bulk assignment across multiple records </span>

<table style="min-width: 100px;">
<colgroup><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"></colgroup><tbody><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Step</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>User Action</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Screen / UI Element</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Expected Result</strong>&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">1&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Select multiple rows using row checkboxes&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Worklist – row checkboxes&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Rows are selected; bulk action bar becomes active.&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">2&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Click “Change Assignee” in the bulk action bar&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Worklist – bulk action bar, Change Assignee button&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Sub-menu opens listing the roles available to reassign: Change Support Team, Change Coder, Change Reviewer 1, Change Reviewer 2, Change Reviewer 3 (roles shown depend on client configuration).&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">3&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Select the role to reassign (e.g., “Change Coder”)&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Bulk action sub-menu&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Assignee picker opens for that role.&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">4&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Select the new assignee and confirm&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Assignee picker – user list&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Reassignment is applied to all selected records for that role in a single action. Records where that role’s status is already Completed are automatically skipped and left untouched. System displays a summary: e.g., “8 updated, 2 skipped (already Completed).”&nbsp;</span></p></td></tr></tbody>
</table>

<span style="color: rgb(15, 71, 97);">E3. Assignment by skipping a role (Manager override) </span>

<table style="min-width: 100px;">
<colgroup><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"></colgroup><tbody><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Step</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>User Action</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Screen / UI Element</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Expected Result</strong>&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">1&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Open a record where Coder status = Completed and Reviewer 1 has not yet been assigned&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Worklist row – Coder column (Completed), Reviewer 1 column (Assign)&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Coder column shows Completed with completion date; Reviewer 1 column still shows “Assign,” confirming the next sequential role has not been touched.&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">2&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Click “Assign” directly under the Compliance (Reviewer 3) column, bypassing Reviewer 1 and Reviewer 2&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Worklist row – Reviewer 3 / Compliance column, Assign link&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Assignee picker opens for Reviewer 3 / Compliance directly, the system allows the Manager to assign this role even though Reviewer 1 and Reviewer 2 were never assigned.&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">3&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Select a Compliance user and confirm&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Assignee picker – user list&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Record is assigned directly to Compliance. Reviewer 1 and Reviewer 2 columns remain unassigned/skipped for this record; the skip is a manual Manager override, not a system-automated route.&nbsp;</span></p></td></tr></tbody>
</table>

<span style="color: rgb(15, 71, 97);">Demo Data Prerequisites </span>

<span>The following patient/record states must exist in the seeded demo data before the walkthrough can be run end-to-end: </span>

<table style="min-width: 100px;">
<colgroup><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"></colgroup><tbody><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Step</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>User Action</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Screen / UI Element</strong>&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(255, 255, 255);"><strong>Expected Result</strong>&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">1&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Row with status “Action Needed”&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Worklist&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Document already uploaded and attached to the record, sitting in “Action Needed” status, used to demonstrate the Support Team review path in Path A.&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">2&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">A record that gets actively rejected&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Worklist – Support Team view&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Used to demonstrate the Reject interaction and resulting routed status in Path A.&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">3&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">A record with multiple DOS from a single uploaded document, all dated 2026&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Worklist – Coder view&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Used to demonstrate Created Date labeling and Sweep Mode in Path B.&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">4&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">A Suspect/Recapture entry&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Worklist – Coder view&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Used to demonstrate Missed / Dismiss default actions in Path B3.&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">5&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">A row with an unassigned role column (“Assign” visible)&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Worklist – any role column&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Used to demonstrate single-record and bulk assignment in Path E1/E2.&nbsp;</span></p></td></tr><tr><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">6&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">A record with Coder = Completed and Reviewer 1/Reviewer 2 unassigned&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Worklist – Manager view&nbsp;</span></p></td><td colspan="1" rowspan="1"><p style="text-align: left;"><span style="color: rgb(0, 0, 0);">Used to demonstrate the skip-role Manager override in Path E3.&nbsp;</span></p></td></tr></tbody>
</table>

<span> </span>

<span> </span>