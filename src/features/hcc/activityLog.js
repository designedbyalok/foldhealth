/**
 * HCC Activity Log: event taxonomy and copy templates.
 *
 * One module owns every legal event_name in the system. Producers import
 * EVENTS.* constants; consumers (the timeline, filter chips, exports) use
 * the same maps to render category labels, icons, severity, and message
 * copy. Adding a new event = adding one entry here, nowhere else.
 *
 * Spec: docs/features/hcc-activity-log-spec.md
 */

// ─── Categories ──────────────────────────────────────────────────────
// Used by the filter chip row and to colour the timeline icon. The order
// here is the order the chips render in.
export const CATEGORIES = {
  intake:   { label: 'Intake',   icon: 'solar:upload-square-linear',  color: 'var(--status-info)' },
  ocr:      { label: 'AI',       icon: 'solar:scanner-linear',        color: 'var(--neutral-400)' },
  matching: { label: 'Matching', icon: 'solar:users-group-rounded-linear', color: 'var(--neutral-400)' },
  review:   { label: 'Review',   icon: 'solar:check-read-linear',     color: 'var(--primary-300)' },
  worklist: { label: 'Worklist', icon: 'solar:checklist-minimalistic-linear', color: 'var(--primary-300)' },
  icd:      { label: 'ICD',      icon: 'solar:file-text-linear',      color: 'var(--neutral-400)' },
  dedup:    { label: 'Dedup',    icon: 'solar:layers-linear',         color: 'var(--neutral-400)' },
  claim:    { label: 'Claim',    icon: 'solar:dollar-linear',         color: 'var(--status-success)' },
  audit:    { label: 'Audit',    icon: 'solar:shield-keyhole-linear', color: 'var(--status-warning)' },
};

export const SOURCES = {
  manual:  { label: 'Manual Upload' },
  sftp:    { label: 'SFTP' },
  system:  { label: 'System' },
  astrana: { label: 'Astrana' },
};

export const SEVERITY = {
  info:    { color: 'var(--status-info)' },
  success: { color: 'var(--status-success)' },
  warning: { color: 'var(--status-warning)' },
  error:   { color: 'var(--status-error)' },
};

// ─── Event registry ──────────────────────────────────────────────────
// Each entry: { category, severity, headline(payload) }.
// The headline fn receives the same payload object that gets stored in
// the DB row, so what you see in the timeline is generated deterministically
// from the persisted record: no UI drift across reloads.

const E = (category, severity, headline) => ({ category, severity, headline });

// Helper for "{}" template interpolation while still returning a string
// when a placeholder is missing, so a half-populated event doesn't crash
// the timeline.
function tpl(s, vars) {
  return String(s).replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] != null ? String(vars[k]) : `{${k}}`));
}

export const EVENTS = {
  // Intake
  'file.uploaded':                     E('intake',   'info',    p => tpl('{actor} uploaded {fileName} ({pageCount} pages).', p)),
  'sftp.file.detected':                E('intake',   'info',    p => tpl('SFTP picked up {fileName} from {sftpFolder}.', p)),
  'batch.created':                     E('intake',   'info',    p => tpl('Batch {batchId} created: {fileCount} files queued.', p)),
  'file.rejected.non_pdf':             E('intake',   'warning', p => tpl('{fileName} skipped: only PDF files are accepted.', p)),
  'file.rejected.invalid_filename':    E('intake',   'warning', p => tpl('{fileName} skipped: filename does not match expected pattern.', p)),

  // OCR
  'ocr.started':                       E('ocr',      'info',    p => tpl('AI extraction started for {fileName}.', p)),
  'ocr.completed':                     E('ocr',      'success', p => tpl('{fileName} processed: {encounterCount} encounters detected across {pageCount} pages.', p)),
  'ocr.failed':                        E('ocr',      'error',   p => tpl('AI extraction failed for {fileName}: {errorReason}. File moved to retry queue.', p)),
  'ocr.low_confidence':                E('ocr',      'warning', p => tpl('Encounter for {patientName} (DOS {dos}) flagged: confidence {confidencePct}% below {thresholdPct}% threshold. Routed to manual review.', p)),

  // Patient matching
  'patient.matched':                   E('matching', 'success', p => tpl('Matched encounter to {patientName} (score {matchScorePct}%).', p)),
  'patient.match_failed':              E('matching', 'warning', p => tpl('No matching patient for encounter on {dos} (provider {provider}). Awaiting reviewer.', p)),
  'patient.match_manual':              E('matching', 'info',    p => tpl('{actor} manually matched encounter to {patientName}.', p)),
  'patient.identity_changed':          E('audit',    'warning', p => tpl('{actor} reassigned encounter from {fromPatientName} (ID {fromId}) to {toPatientName} (ID {toId}). Reason: {reason}.', p)),

  // Review / approval
  'encounter.approved':                E('review',   'success', p => tpl('{actor} approved encounter for {patientName} (DOS {dos}).', p)),
  'encounter.rejected':                E('review',   'warning', p => tpl('{actor} rejected encounter for {patientName} (DOS {dos}): reason: {reason}.', p)),
  'encounter.field_corrected':         E('audit',    'info',    p => tpl('{actor} corrected {fieldName} from "{originalValue}" to "{modifiedValue}" on encounter for {patientName}.', p)),
  'encounter.restored':                E('review',   'info',    p => tpl('{actor} restored encounter for {patientName} (DOS {dos}), previously rejected by {originalActor} on {originalTs}. Reason: {reason}.', p)),
  'encounter.removed':                 E('audit',    'warning', p => tpl('{actor} removed encounter for {patientName} (DOS {dos}). Source file remains: {fileName}.', p)),

  // Worklist
  'worklist.row_created':              E('worklist', 'success', p => tpl('Approved encounter created a new HCC worklist row for {patientName}.', p)),
  'worklist.row_merged':               E('worklist', 'info',    p => tpl('Approved encounter folded into existing DOS {dos} for {patientName}.', p)),
  'assignee.changed':                  E('worklist', 'info',    p => tpl('{roleLabel} reassigned from {fromName} to {toName} for {patientName}.', p)),
  'role.status_changed':               E('worklist', 'info',    p => tpl('{roleLabel} status for {patientName} changed to {status}.', p)),
  'dos.deleted':                       E('worklist', 'warning', p => tpl('{actor} deleted DOS {dos} for {patientName}.', p)),

  // ICD operations (mirrors existing DiagPanel ActivityTab events)
  'icd.accepted':                      E('icd',      'success', p => tpl('{actor} accepted ICD {icd} for {patientName}.', p)),
  'icd.dismissed':                     E('icd',      'info',    p => tpl('{actor} dismissed ICD {icd} for {patientName}: reason: {reason}.', p)),
  'icd.created_manual':                E('icd',      'info',    p => tpl('{actor} manually added ICD {icd} for {patientName}.', p)),
  'icd.deleted':                       E('icd',      'warning', p => tpl('{actor} deleted ICD {icd} on DOS {dos} for {patientName}.', p)),
  'icd.overridden':                    E('icd',      'info',    p => tpl('HCC {fromHcc} overridden by HCC {toHcc} on DOS {dos}.', p)),
  'icd.merged':                        E('icd',      'info',    p => tpl('{icd} added to existing DOS {dos}: other ICDs on this DOS unchanged.', p)),
  'icd.status_changed':                E('icd',      'info',    p => tpl('{icdsLabel} status changed: {fromStatus} → {toStatus}.', p)),
  'icd.comment_added':                 E('icd',      'info',    p => tpl('{actor} added a comment for {icdsLabel}.', p)),
  'note.added':                        E('icd',      'info',    p => tpl('{actor} added a note for {patientName}.', p)),
  'document.uploaded_for_icd':         E('icd',      'info',    p => tpl('Document uploaded for {icdsLabel}.', p)),
  // Compliance decisions from the SFTP / Chart review flow (Support role
  // marks each check pass/fail; the audit trail records who and why).
  'compliance.passed':                 E('review',   'success', p => tpl('{actor} passed compliance check {check}.', p)),
  'compliance.failed':                 E('review',   'warning', p => tpl('{actor} failed compliance check {check}: {reasonText}.', p)),

  // Deduplication
  'dedup.dos_match_found':             E('dedup',    'info',    p => tpl('DOS {dos} already exists for {patientName}: encounter routed to merge path.', p)),
  'dedup.icd_net_new_merged':          E('dedup',    'success', p => tpl('{icd} added to existing DOS {dos} for {patientName} (other ICDs already on file).', p)),
  'dedup.related_dos_created':         E('dedup',    'info',    p => tpl('New DOS {dos} created for {patientName} ({reason}: existing DOS within encounter window).', p)),
  'dedup.duplicate_detected':          E('dedup',    'warning', p => tpl('Encounter from {fileName} is an exact duplicate of {existingEncounterId}: rejected automatically.', p)),

  // Claim reconciliation / ASM
  'claim.attached':                    E('claim',    'info',    p => tpl('Claim {claimId} attached to {patientName} DOS {dos}.', p)),
  'claim.matched':                     E('claim',    'success', p => tpl('Claim {claimId} matched to {patientName} DOS {dos} ({matchScorePct}% match, {matchedFieldCount} fields).', p)),
  'claim.not_found':                   E('claim',    'warning', p => tpl('No claim found for {patientName} DOS {dos} after {searchWindowDays}-day search. Will retry.', p)),
  'asm.reevaluated':                   E('claim',    'info',    p => tpl('ASM reevaluation queued for {patientName} DOS {dos}: trigger: {reason}.', p)),
  'asm.file_generated':                E('claim',    'success', p => tpl('ASM output {asmFileId} generated: {addCount} adds, {deleteCount} deletes.', p)),
  'asm.delete_entry_created':          E('claim',    'info',    p => tpl('ASM delete entry created for ICD {icd} on DOS {dos} (reason: {reason}).', p)),

  // Audit / field edits
  'patient.dos_changed':               E('audit',    'warning', p => tpl('{actor} corrected DOS from {fromDos} to {toDos} on encounter for {patientName}.', p)),
  'patient.field_edited':              E('audit',    'info',    p => tpl('{actor} edited {fieldName} on {patientName}: "{originalValue}" → "{modifiedValue}".', p)),
  'batch.processing_started':          E('intake',   'info',    p => tpl('Started processing batch {batchId} ({fileCount} files).', p)),
  'batch.processing_completed':        E('intake',   'success', p => tpl('Batch {batchId} complete: {approvedCount} approved, {rejectedCount} rejected, {pendingCount} in review.', p)),
  'batch.processing_partial_failure':  E('intake',   'warning', p => tpl('Batch {batchId} finished with errors: {failedCount} of {fileCount} files failed.', p)),
};

/**
 * Build a complete log row from a short call site, filling in defaults.
 * Producers pass `eventName` + `scope` + `payload`; this returns the
 * full DB-shaped record (snake_case columns).
 *
 *   makeActivityRow('assignee.changed', { patientId, dos, source: 'manual' }, { roleLabel, fromName, toName, patientName, actor: 'You' })
 */
export function makeActivityRow(eventName, scope = {}, payload = {}) {
  const def = EVENTS[eventName];
  if (!def) throw new Error(`Unknown HCC activity event: ${eventName}`);
  return {
    event_name:   eventName,
    category:     def.category,
    severity:     def.severity,
    actor_id:     payload.actorId   || scope.actorId   || null,
    actor_name:   payload.actor     || scope.actorName || null,
    actor_role:   payload.actorRole || scope.actorRole || null,
    source:       scope.source || 'system',
    batch_id:     scope.batchId     || null,
    file_id:      scope.fileId      || null,
    encounter_id: scope.encounterId || null,
    patient_id:   scope.patientId   || null,
    dos:          scope.dos         || null,
    icd:          scope.icd         || null,
    claim_id:     scope.claimId     || null,
    headline:     def.headline(payload || {}),
    payload:      payload || {},
  };
}
