import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../../components/Icon/Icon';
import { Button } from '../../../components/Button/Button';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Input } from '../../../components/Input/Input';
import { Badge } from '../../../components/Badge/Badge';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Select } from '../../../components/Select/Select';
import { Checkbox } from '../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { AuditBadge } from '../../../components/AuditBadge/AuditBadge';
import { ReasonDialog } from '../../../components/ReasonDialog/ReasonDialog';
import {
  OCR_TIER_LABEL, OCR_TIER_TONE, anyCheckFailed, anyCheckPending,
  CHECK_KEYS, CHECK_LABELS, STANDARD_REASONS,
} from '../compliance';
import { sftpEncStatus, highConfidenceSftpIdxs, ICD_LOOKUP, countFlaggedEncounters } from './HccSftpReviewDrawer.utils';
import { getFieldConfidence } from '../data/confidence';
import { POS_LABEL } from './mockOcr';
import styles from './HccSftpReviewDrawer.module.css';

export function DocToolbar({ batch, setSelectedAll, showToast }) {
  const encs = batch.encounters || [];
  const flagged = encs.filter(e =>
    !e.patient?.matchedMemberId || (e.errors && e.errors.length > 0)
  ).length;
  const ready = encs.length - flagged;
  const acceptAllHigh = () => {
    const highIdxs = highConfidenceSftpIdxs(encs);
    setSelectedAll?.(highIdxs, true);
    showToast?.(`${highIdxs.length} high-confidence encounter${highIdxs.length === 1 ? '' : 's'} selected`);
  };
  const reviewFlagged = () => {
    if (flagged === 0) {
      showToast?.('No flagged encounters in this document');
      return;
    }
    setTimeout(() => {
      const row = document.querySelector(`[class*="rowError_"], [class*="rowMismatch_"]`);
      row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 30);
  };
  return (
    <div className={styles.docToolbar}>
      <span className={styles.docToolbarIcon}>
        <Icon name="solar:document-text-linear" size={14} color="var(--primary-300)" />
      </span>
      <span className={styles.docToolbarName}>{batch.fileName}</span>
      <span className={styles.docToolbarSep} />
      <span className={styles.docToolbarStat}>
        <strong>{encs.length}</strong> encounter{encs.length === 1 ? '' : 's'}
      </span>
      <span className={styles.docToolbarStat}>
        <span className={[styles.docToolbarDot, styles.docToolbarDotReady].join(' ')} />
        <strong>{ready}</strong> ready
      </span>
      {flagged > 0 && (
        <span className={styles.docToolbarStat}>
          <span className={[styles.docToolbarDot, styles.docToolbarDotFlag].join(' ')} />
          <strong>{flagged}</strong> to review
        </span>
      )}
      <span className={styles.docToolbarSpacer} />
      <button
        type="button"
        className={styles.docToolbarBtn}
        onClick={acceptAllHigh}
        title="Select every encounter with ≥85% match confidence and no errors"
      >
        <Icon name="solar:check-circle-linear" size={12} color="var(--status-success)" />
        Accept All High Confidence
      </button>
      <button
        type="button"
        className={styles.docToolbarBtn}
        disabled={flagged === 0}
        onClick={reviewFlagged}
        title={flagged === 0 ? 'No flagged rows' : 'Jump to the first flagged row'}
      >
        <Icon name="solar:flag-2-linear" size={12} color="var(--status-warning)" />
        Review Flagged ({flagged})
      </button>
    </div>
  );
}

/**
 * Left-panel preview. Shows a stack of "scanned pages" for the active
 * document — one card per encounter page. Clicking a card brings the
 * preview into focus (currently just visual; future enhancement could
 * scroll-sync with the table).
 */
/**
 * DocSwitcher — dropdown-style selector inside the preview header.
 * Replaces the top tab strip. Clicking the active filename opens a
 * popover listing every batch with its status icon (pending / ready /
 * flagged), encounter count, and a "current" marker on the active
 * batch. Picking one switches the panels below.
 */
/**
 * PatientReviewBanner — top of the right panel when reviewing a patient's
 * DOS records. Renders the patient identity once (avatar + name +
 * demographics + member id + RAF) so the individual DOS cards below
 * don't repeat it (Figma 1:3574).
 */
export function PatientReviewBanner({ patient, member, encounterCount }) {
  const name = member?.name || patient?.name || '(unmatched patient)';
  const initials = member?.in || name.split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
  const gender = member?.g || '';
  const age = member?.age || '';
  const memberId = member?.memberId || patient?.matchedMemberDisplayId || patient?.patientId || '—';
  const raf = member?.raf ?? null;
  const rafDelta = member?.rafDelta ?? null;

  return (
    <div className={styles.patientBanner}>
      <Avatar variant="patient" initials={initials} />
      <div className={styles.patientBannerBody}>
        <div className={styles.patientBannerName}>
          <span>{name}</span>
          <Icon name="solar:alt-arrow-right-linear" size={14} color="var(--neutral-300)" />
        </div>
        <div className={styles.patientBannerMeta}>
          <span>Patient</span>
          <span className={styles.patientBannerDot}>•</span>
          {gender && <><span>{gender}</span><span className={styles.patientBannerDot}>•</span></>}
          {age && <><span>{age}</span><span className={styles.patientBannerDot}>•</span></>}
          <span>#{memberId}</span>
          {raf != null && (
            <>
              <span className={styles.patientBannerDot}>•</span>
              <span>RAF <strong>{Number(raf).toFixed(3)}</strong></span>
              {rafDelta != null && (
                <span className={[styles.rafDelta, rafDelta >= 0 ? styles.rafDeltaUp : styles.rafDeltaDown].join(' ')}>
                  {Number(rafDelta).toFixed(3)}
                  <Icon name={rafDelta >= 0 ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'} size={10} color="currentColor" />
                </span>
              )}
            </>
          )}
          <span className={styles.patientBannerDot}>•</span>
          <span className={styles.patientBannerCount}>{encounterCount} {encounterCount === 1 ? 'DOS record' : 'DOS records'}</span>
        </div>
      </div>
      <div className={styles.patientBannerActions}>
        <ActionButton size="S" icon="solar:phone-linear" tooltip="Contact patient" />
        <ActionButton size="S" icon="solar:alt-arrow-down-linear" tooltip="More" />
      </div>
    </div>
  );
}

export function DocSwitcher({ activeBatch, batches, onSelect }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const activeFlagged = activeBatch ? countFlaggedEncounters(activeBatch.encounters) : 0;
  const multi = batches.length > 1;

  return (
    <div ref={wrapRef} className={styles.switcher}>
      <button
        type="button"
        className={[styles.switcherTrigger, open ? styles.switcherTriggerOpen : ''].join(' ')}
        onClick={() => multi && setOpen(o => !o)}
        disabled={!multi}
        title={multi ? 'Switch document' : activeBatch?.fileName}
      >
        <span className={styles.switcherStatus}>
          {activeBatch?.status === 'pending' ? (
            <span className={styles.switcherStatusPulse} />
          ) : activeFlagged > 0 ? (
            <Icon name="solar:danger-circle-bold" size={13} color="var(--status-warning)" />
          ) : (
            <Icon name="solar:document-text-linear" size={13} color="var(--primary-300)" />
          )}
        </span>
        <span className={styles.switcherName}>{activeBatch?.fileName || '—'}</span>
        {multi && (
          <>
            <span className={styles.switcherCounter}>
              {(batches.findIndex(b => b.id === activeBatch?.id) + 1) || 1} / {batches.length}
            </span>
            <Icon
              name={open ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
              size={12}
              color="var(--neutral-400)"
            />
          </>
        )}
      </button>
      {open && (
        <div className={styles.switcherMenu} role="listbox">
          <div className={styles.switcherMenuHead}>
            <Icon name="solar:layers-linear" size={11} color="var(--neutral-300)" />
            Documents · {batches.length}
          </div>
          {batches.map(b => {
            const isActive = b.id === activeBatch?.id;
            const isPending = b.status === 'pending';
            const flagged = countFlaggedEncounters(b.encounters);
            const ready = (b.encounters || []).length - flagged;
            return (
              <button
                key={b.id}
                type="button"
                role="option"
                aria-selected={isActive}
                disabled={isPending}
                className={[
                  styles.switcherItem,
                  isActive ? styles.switcherItemActive : '',
                  isPending ? styles.switcherItemPending : '',
                ].filter(Boolean).join(' ')}
                onClick={() => { if (!isPending) { onSelect?.(b.id); setOpen(false); } }}
              >
                <span className={styles.switcherItemIcon}>
                  {isPending ? (
                    <span className={styles.switcherStatusPulse} />
                  ) : flagged > 0 ? (
                    <Icon name="solar:danger-circle-bold" size={13} color="var(--status-warning)" />
                  ) : (
                    <Icon name="solar:check-circle-bold" size={13} color="var(--status-success)" />
                  )}
                </span>
                <span className={styles.switcherItemBody}>
                  <span className={styles.switcherItemName}>{b.fileName}</span>
                  <span className={styles.switcherItemMeta}>
                    {isPending
                      ? 'Extracting…'
                      : `${b.encounters?.length || 0} encounter${(b.encounters?.length || 0) === 1 ? '' : 's'}${flagged > 0 ? ` · ${flagged} to review` : ''}`}
                  </span>
                </span>
                {!isPending && (
                  <span className={[styles.switcherItemCount, flagged > 0 ? styles.switcherItemCountFlag : ''].join(' ')}>
                    {ready}
                  </span>
                )}
                {isActive && (
                  <Icon name="solar:check-read-linear" size={13} color="var(--primary-300)" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PagePreview({ activeBatch, batches, onSelect }) {
  const fileName = activeBatch?.fileName || 'Uploaded document';
  const encounters = activeBatch?.encounters || [];
  const pages = useMemo(() => {
    const map = new Map();
    encounters.forEach(enc => {
      const p = enc.sourcePage || 1;
      if (!map.has(p)) map.set(p, []);
      map.get(p).push(enc);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [encounters]);

  return (
    <div className={styles.previewWrap}>
      {/* Inner preview header removed — the outer file strip at the
          top of the left panel already shows the filename + switcher,
          so this row was redundant. */}
      <div className={styles.previewBody}>
        {pages.length === 0 ? (
          <div className={styles.previewEmpty}>
            <Icon name="solar:document-linear" size={20} color="var(--neutral-200)" />
            <span>No pages extracted</span>
          </div>
        ) : pages.map(([page, encs]) => (
          <div key={page} className={styles.previewPage}>
            <div className={styles.previewPageHeader}>
              <div className={styles.previewPageOrg}>Fold Health Medical Group</div>
              <div className={styles.previewPagePagenum}>Page {page} · {fileName}</div>
            </div>
            <h2 className={styles.previewPageH1}>Progress Note</h2>
            {encs.map((enc, i) => (
              <div key={i} className={styles.previewPageEnc}>
                <div className={styles.previewPageMeta}>
                  <div><strong>Patient:</strong> {enc.patient?.name || '—'}</div>
                  <div><strong>DOB:</strong> {enc.patient?.dob || '—'}</div>
                  <div><strong>DOS:</strong> {enc.dos || '—'}</div>
                  <div><strong>Provider:</strong> {enc.provider || '—'}</div>
                </div>
                <div className={styles.previewPageSection}>
                  <h3 className={styles.previewPageH2}>Assessment &amp; Plan</h3>
                  <ul className={styles.previewPageIcds}>
                    {(enc.icds || []).map(icd => (
                      <li key={icd.code}>
                        <strong>{icd.code}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
                {i < encs.length - 1 && <div className={styles.previewPageSep} />}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Right-panel table — slimmer cousin of the main upload-review table.
 * Renders one row per encounter with Member · DOS · Provider · POS ·
 * ICDs · Action, each with the per-field confidence chip the main
 * drawer uses.
 */
export function SftpReviewTable({ batch, hccMembers, onPatch, onRemove, showToast, selectedIdxs, toggleSelected, setSelectedAll }) {
  const encounters = batch.encounters || [];
  if (encounters.length === 0) {
    return (
      <div className={styles.tableEmpty}>
        <Icon name="solar:document-linear" size={24} color="var(--neutral-200)" />
        <span>{batch.status === 'pending' ? 'Extracting…' : 'No encounters found'}</span>
      </div>
    );
  }
  const allIdxs = encounters.map((_, i) => i);
  const allSelected = allIdxs.length > 0 && allIdxs.every(i => selectedIdxs?.has(i));
  const someSelected = allIdxs.some(i => selectedIdxs?.has(i));
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.thCheck}>
              <Checkbox
                aria-label="Select all encounters"
                checked={allSelected ? true : (someSelected ? 'indeterminate' : false)}
                onCheckedChange={(v) => setSelectedAll?.(allIdxs, v === true)}
              />
            </th>
            <th className={styles.thMember}>Member</th>
            <th className={styles.thField}>DOS *</th>
            <th className={styles.thField}>Rendering Provider *</th>
            <th className={styles.thField}>POS *</th>
            <th className={styles.thField}>ICD Codes</th>
            <th className={styles.thStatus}>Status</th>
            <th className={styles.thActions}>Action</th>
          </tr>
        </thead>
        <tbody>
          {encounters.map((enc, idx) => (
            <SftpRow
              key={enc.tempId || idx}
              enc={enc}
              hccMembers={hccMembers}
              onPatch={(patch) => onPatch(idx, patch)}
              onRemove={() => onRemove(idx)}
              showToast={showToast}
              checked={selectedIdxs?.has(idx) || false}
              onToggle={() => toggleSelected?.(idx)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SftpRow({ enc, hccMembers, onPatch, onRemove, showToast, checked, onToggle }) {
  const errors = new Set(enc.errors || []);
  const isMatched = !!enc.patient?.matchedMemberId;
  const member = isMatched ? hccMembers.find(m => m.id === enc.patient.matchedMemberId) : null;
  const status = !isMatched ? 'mismatched' : (errors.size > 0 ? 'error' : 'ready');
  const rowCls = [
    styles.row,
    status === 'error' ? styles.rowError : '',
    status === 'mismatched' ? styles.rowMismatch : '',
    checked ? styles.rowSelected : '',
  ].filter(Boolean).join(' ');

  return (
    <tr className={rowCls}>
      <td className={styles.tdCheck}>
        <Checkbox
          aria-label="Select encounter"
          checked={!!checked}
          onCheckedChange={() => onToggle?.({ target: { checked: !checked } })}
        />
      </td>
      <td className={styles.tdMember}>
        {isMatched ? (
          <div className={styles.memberCell}>
            <Avatar variant="patient" initials={member?.in || (enc.patient.name || '?').split(' ').map(p => p[0]).slice(0,2).join('')} />
            <div className={styles.memberMain}>
              <div className={styles.memberName}>{member?.name || enc.patient.name}</div>
              {member && (
                <div className={styles.memberMeta}>
                  {member.g || ''}{member.age ? `·${member.age}` : ''}
                </div>
              )}
            </div>
          </div>
        ) : (
          <span className={styles.memberUnmatched}>
            <Icon name="solar:link-broken-linear" size={11} color="var(--status-error)" />
            Unmatched
          </span>
        )}
      </td>
      <td className={styles.tdField}>
        <Input
          variant={errors.has('dos') ? 'error' : 'default'}
          value={enc.dos || ''}
          placeholder="Enter DOS"
          onChange={(e) => onPatch({ dos: e.target.value })}
          className={styles.cellInput}
        />
        <FieldConf score={getFieldConfidence(enc, 'dos')} />
      </td>
      <td className={styles.tdField}>
        <Input
          variant={errors.has('provider') ? 'error' : 'default'}
          value={enc.provider || ''}
          placeholder="Provider"
          onChange={(e) => onPatch({ provider: e.target.value })}
          className={styles.cellInput}
        />
        <FieldConf score={getFieldConfidence(enc, 'provider')} />
      </td>
      <td className={styles.tdField}>
        <Input
          variant={errors.has('pos') ? 'error' : 'default'}
          value={enc.pos || ''}
          placeholder="POS"
          onChange={(e) => onPatch({ pos: e.target.value, posDesc: POS_LABEL[e.target.value] || '' })}
          className={styles.cellInput}
        />
        <FieldConf score={getFieldConfidence(enc, 'pos')} />
      </td>
      <td className={styles.tdField}>
        <div className={styles.icdRow}>
          {(enc.icds || []).slice(0, 1).map(icd => (
            <span key={icd.code} className={[styles.icdChip, icd.valid === false ? styles.icdChipInvalid : ''].filter(Boolean).join(' ')}>
              {icd.code}
            </span>
          ))}
          {(enc.icds || []).length > 1 && (
            <span className={styles.icdOverflow}>+{enc.icds.length - 1}</span>
          )}
          <button
            type="button"
            className={styles.icdAddBtn}
            onClick={() => showToast?.('ICD search not wired in this view yet')}
            aria-label="Add ICD"
          >
            <Icon name="solar:add-circle-linear" size={13} color="var(--neutral-300)" />
          </button>
        </div>
        <FieldConf score={getFieldConfidence(enc, 'icds')} />
      </td>
      <td className={styles.tdStatus}>
        <span className={[
          styles.statusInline,
          status === 'ready' ? styles.statusReady : '',
          status === 'error' ? styles.statusError : '',
          status === 'mismatched' ? styles.statusMismatch : '',
        ].filter(Boolean).join(' ')}>
          {status === 'ready' && <Icon name="solar:check-circle-bold" size={11} color="var(--status-success)" />}
          {status === 'error' && <Icon name="solar:danger-triangle-bold" size={11} color="var(--status-error)" />}
          {status === 'mismatched' && <Icon name="solar:question-circle-bold" size={11} color="var(--status-warning)" />}
          {status === 'ready' ? 'Ready' : status === 'error' ? 'Missing' : 'Mismatched'}
        </span>
      </td>
      <td className={styles.tdActions}>
        <button
          type="button"
          className={styles.removeBtn}
          onClick={onRemove}
          aria-label="Remove encounter"
        >
          <Icon name="solar:trash-bin-trash-linear" size={13} color="var(--status-error)" />
        </button>
      </td>
    </tr>
  );
}

/**
 * DocReviewCompleted — empty-state hero shown in the Pending tab
 * once every encounter on the active document has been triaged
 * (added / deleted). Matches Figma 180:63466.
 */
export function DocReviewCompleted({ total, nextBatch, onPickNext, onBackToWorklist }) {
  return (
    <div className={styles.docCompleted}>
      <span className={styles.docCompletedBadgeWrap}>
        <span className={styles.docCompletedRingOuter} />
        <span className={styles.docCompletedRingInner} />
        <span className={styles.docCompletedBadge}>
          <Icon name="solar:check-circle-bold" size={24} color="#fff" />
        </span>
      </span>
      <div className={styles.docCompletedTitle}>Document Review Completed</div>
      <div className={styles.docCompletedBody}>
        All {total} extracted record{total === 1 ? ' has' : 's have'} been reviewed.
      </div>
      <div className={styles.docCompletedActions}>
        <Button
          variant="primary"
          size="L"
          disabled={!nextBatch}
          onClick={() => nextBatch && onPickNext(nextBatch.id)}
        >
          Review Next Document
        </Button>
        <Button
          variant="alt"
          size="L"
          trailingIcon="solar:arrow-right-up-linear"
          onClick={onBackToWorklist}
        >
          Back to Worklist
        </Button>
      </div>
    </div>
  );
}

/**
 * Document Review encounter card — one card per encounter,
 * stacked vertically. Header: avatar + member identity + Ready /
 * Mismatch / Error pill + per-card actions. Body: 2-column field
 * grid (DOS · ICD Codes / Provider · POS) each with an inline
 * confidence gauge bar matching Figma 121:87283.
 */
export function EncounterCard({ enc, status, hccMembers, docTab, cardIdx, hidePatient, onPatch, onAddToWorklist, onDelete, onRestore }) {
  const isMatched = !!enc.patient?.matchedMemberId;
  const member = isMatched ? hccMembers.find(m => m.id === enc.patient.matchedMemberId) : null;
  const errors = new Set(enc.errors || []);
  // Read-only default for high-confidence (Ready) records when we're in
  // the patient-grouped view. Mismatch/Error records always open in edit
  // mode so the reviewer can fix them. Pen icon flips into edit; Save
  // (or X) collapses back to read-only. Legacy hidePatient=false uses
  // edit mode unconditionally (preserved for other callers of this card).
  const canReadOnly = hidePatient && status === 'ready';
  const [isEditing, setIsEditing] = useState(!canReadOnly);
  // Map status → shared Badge variant (uses the existing status- tokens
  // so this card matches every other status pill in the app).
  const badgeVariant = (
    status === 'ready'    ? 'status-completed' :
    status === 'mismatch' ? 'status-review' :
                            'status-failed'
  );
  const badgeIcon = (
    status === 'ready'    ? 'solar:check-circle-bold' :
    status === 'mismatch' ? 'solar:question-circle-bold' :
                            'solar:danger-triangle-bold'
  );
  const statusLabel = status === 'ready' ? 'Ready' : status === 'mismatch' ? 'Mismatch' : 'Error';
  // Per-field confidence drives the gauge bar next to each label.
  const fieldConf = (name) => {
    if (errors.has(name)) return 0;
    return getFieldConfidence(enc, name);
  };
  return (
    <div className={styles.encCard} data-card-idx={cardIdx}>
      <div className={styles.encCardHead}>
        {hidePatient ? (
          // Grouped-by-patient view: patient info lives in the banner above.
          // Card header shows DOS + status + a static Provider/POS meta line
          // in BOTH states. When expanded, editable inputs render in the body
          // below (Figma 4001:179835).
          <div className={styles.encCardDosHead}>
            <div className={styles.encCardDosLine}>
              <span className={styles.encCardDosLabel}>DOS:</span>
              <span className={styles.encCardDosValue}>{enc.dos || '—'}</span>
              <Badge variant={badgeVariant} icon={badgeIcon} label={statusLabel} />
            </div>
            <div className={styles.encCardDosMeta}>
              Rendering Provider: {enc.provider || '—'} · POS: {enc.pos ? `${enc.pos}${enc.posDesc ? ' - ' + enc.posDesc : ''}` : '—'}
            </div>
          </div>
        ) : (
          <>
            <Avatar
              variant="patient"
              initials={member?.in || (enc.patient?.name || '?').split(' ').map(p => p[0]).slice(0,2).join('')}
            />
            <div className={styles.encCardIdent}>
              <div className={styles.encCardName}>{member?.name || enc.patient?.name || '(unmatched)'}</div>
              <div className={styles.encCardMeta}>
                {member?.g || ''} <span className={styles.encCardMetaDot}>•</span>
                {member?.age || ''} <span className={styles.encCardMetaDot}>•</span>
                #{enc.patient?.patientId || enc.patient?.matchedMemberDisplayId || '—'}
              </div>
            </div>
            <Badge variant={badgeVariant} icon={badgeIcon} label={statusLabel} />
          </>
        )}
        <div className={styles.encCardActions}>
          {docTab === 'pending' ? (
            hidePatient && isEditing ? (
              // Expanded (editing) — Save collapses to read-only; X too.
              // Figma 4001:179835 shows Save + X in the expanded card header.
              <>
                <Button
                  variant="primary"
                  size="S"
                  onClick={() => setIsEditing(false)}
                >
                  Save
                </Button>
                <ActionButton
                  size="S"
                  icon="solar:close-circle-linear"
                  tooltip="Collapse"
                  onClick={() => setIsEditing(false)}
                />
              </>
            ) : (
              // Collapsed (read-only) — Add / view doc / edit (pen) / delete.
              <>
                <Button
                  variant="ghost"
                  size="S"
                  leadingIcon="solar:add-circle-linear"
                  disabled={status !== 'ready'}
                  onClick={onAddToWorklist}
                >
                  {hidePatient ? 'Add' : 'Add to Worklist'}
                </Button>
                {hidePatient && (
                  <>
                    <ActionButton size="S" icon="solar:document-text-linear" tooltip="View document" />
                    <ActionButton
                      size="S"
                      icon="solar:pen-linear"
                      tooltip="Edit record"
                      onClick={() => setIsEditing(true)}
                    />
                  </>
                )}
                <ActionButton size="S" icon="solar:trash-bin-trash-linear" tooltip="Delete" onClick={onDelete} />
              </>
            )
          ) : (
            <Button
              variant="ghost"
              size="S"
              leadingIcon="solar:undo-left-round-linear"
              onClick={onRestore}
            >
              Restore
            </Button>
          )}
        </div>
      </div>

      {/* Body — two states (Figma 4001:179835):
          • Collapsed (read-only): ICD Codes + Document Type selects, static
            ICD description list, v24/v28 index.
          • Expanded (editing): DOS / Provider / POS input row, ICD Codes,
            and a per-ICD checkbox list (uncheck removes the code). */}
      {hidePatient && !isEditing && (
        <div className={styles.encReadOnly}>
          <div className={styles.encReadOnlyForm}>
            <FieldBlock label="ICD Codes" required confidence={fieldConf('icds')} confVariant="tier">
              <IcdMultiSelect
                icds={enc.icds || []}
                onChange={(nextIcds) => onPatch({ icds: nextIcds })}
              />
            </FieldBlock>
            <FieldBlock label="Document Type" required confidence={fieldConf('docType')} confVariant="tier">
              <Select
                value={enc.docType || 'Progress Note'}
                onChange={(v) => onPatch({ docType: v })}
                options={[
                  { value: 'AWV',           label: 'AWV' },
                  { value: 'Progress Note', label: 'Progress Note' },
                  { value: 'SOAP Note',     label: 'SOAP Note' },
                  { value: 'Telehealth Note', label: 'Telehealth Note' },
                  { value: 'Lab',           label: 'Lab' },
                  { value: 'Other',         label: 'Other' },
                ]}
              />
            </FieldBlock>
          </div>
          <ul className={styles.encIcdList}>
            {(enc.icds || []).map(icd => {
              const meta = ICD_LOOKUP.get(icd.code);
              return (
                <li key={icd.code} className={styles.encIcdRow}>
                  <span className={styles.encIcdCode}>{icd.code}</span>
                  <span className={styles.encIcdDesc}>{meta?.desc || 'ICD description not on file'}</span>
                  {meta?.hcc && (
                    <span className={styles.encIcdHcc}>
                      <span className={styles.encIcdHccDot} /> {meta.hcc}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <div className={styles.encReadOnlyIndex}>
            Index: <span className={styles.encIndexDot} data-tone="v24" /> v24 · <span className={styles.encIndexDot} data-tone="v28" /> v28
          </div>
        </div>
      )}

      {hidePatient && isEditing && (
        <div className={styles.encEditForm}>
          <div className={styles.encEditRow}>
            <FieldBlock label="DOS" required confidence={fieldConf('dos')}>
              <Input
                value={enc.dos || ''}
                placeholder="MM/DD/YYYY"
                variant={errors.has('dos') ? 'error' : 'default'}
                onChange={(e) => onPatch({ dos: e.target.value })}
              />
            </FieldBlock>
            <FieldBlock label="Rendering Provider" required confidence={fieldConf('provider')}>
              <Input
                value={enc.provider || ''}
                placeholder="Provider"
                variant={errors.has('provider') ? 'error' : 'default'}
                onChange={(e) => onPatch({ provider: e.target.value })}
              />
            </FieldBlock>
            <FieldBlock label="POS" required confidence={fieldConf('pos')}>
              <Select
                value={enc.pos || ''}
                onChange={(v) => onPatch({ pos: v, posDesc: POS_LABEL[v] || '' })}
                placeholder="Select POS…"
                options={Object.entries(POS_LABEL).map(([code, label]) => ({ value: code, label: `${code} - ${label}` }))}
              />
            </FieldBlock>
          </div>
          <FieldBlock label="ICD Codes" required confidence={fieldConf('icds')}>
            <IcdMultiSelect
              icds={enc.icds || []}
              onChange={(nextIcds) => onPatch({ icds: nextIcds })}
            />
          </FieldBlock>
          {/* Per-ICD checkbox list — unchecking a code removes it from the
              record (and the ICD Codes field above stays in sync). */}
          <ul className={styles.encIcdCheckList}>
            {(enc.icds || []).map(icd => {
              const meta = ICD_LOOKUP.get(icd.code);
              return (
                <li key={icd.code} className={styles.encIcdCheckRow}>
                  <Checkbox
                    checked
                    onCheckedChange={(v) => {
                      if (v !== true) onPatch({ icds: (enc.icds || []).filter(i => i.code !== icd.code) });
                    }}
                  />
                  <div className={styles.encIcdCheckBody}>
                    <div className={styles.encIcdCheckTitle}>
                      <strong>{icd.code}</strong> - {meta?.desc || 'ICD description not on file'}
                    </div>
                    {meta?.hcc && (
                      <div className={styles.encIcdCheckHcc}>
                        <span className={styles.encIcdHccDot} /> {meta.hcc}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Legacy full-form layout — only for the non-grouped (non-hidePatient)
          caller, e.g. the SFTP bell-notification flow that still shows one
          encounter table per document. */}
      {!hidePatient && (
      <div className={styles.encGrid}>
        <FieldBlock label="DOS" required confidence={fieldConf('dos')}>
          <Input
            value={enc.dos || ''}
            placeholder="MM/DD/YYYY"
            variant={errors.has('dos') ? 'error' : 'default'}
            onChange={(e) => onPatch({ dos: e.target.value })}
          />
        </FieldBlock>
        <FieldBlock label="ICD Codes" required confidence={fieldConf('icds')}>
          <IcdMultiSelect icds={enc.icds || []} onChange={(next) => onPatch({ icds: next })} />
        </FieldBlock>
        <FieldBlock label="Rendering Provider" required confidence={fieldConf('provider')}>
          <Input
            value={enc.provider || ''}
            placeholder="Provider"
            variant={errors.has('provider') ? 'error' : 'default'}
            onChange={(e) => onPatch({ provider: e.target.value })}
          />
        </FieldBlock>
        <FieldBlock label="POS" required confidence={fieldConf('pos')}>
          <Select
            value={enc.pos || ''}
            onChange={(v) => onPatch({ pos: v, posDesc: POS_LABEL[v] || '' })}
            placeholder="Select POS…"
            options={Object.entries(POS_LABEL).map(([code, label]) => ({ value: code, label: `${code} - ${label}` }))}
          />
        </FieldBlock>
        <FieldBlock label="Category" required>
          <Select
            value={enc.docType || 'Progress Note'}
            onChange={(v) => onPatch({ docType: v })}
            options={[
              { value: 'AWV',           label: 'AWV' },
              { value: 'Progress Note', label: 'Progress Note' },
              { value: 'Lab',           label: 'Lab' },
              { value: 'Other',         label: 'Other' },
            ]}
          />
        </FieldBlock>
        {enc._duplicateOfMemberId && (
          <FieldBlock label="">
            <span className={styles.encDupWarn} title="Same DOS + Provider + POS already exists for this member">
              <Icon name="solar:danger-triangle-bold" size={11} color="var(--status-warning)" />
              Possible duplicate — review before adding
            </span>
          </FieldBlock>
        )}
      </div>
      )}
    </div>
  );
}

/**
 * FieldBlock — label + confidence gauge bar + input slot.
 * Used inside every encounter card cell. The gauge fills based on
 * confidence: 5 segments tinted green/amber/red per tier.
 */
export function FieldBlock({ label, required, confidence, confVariant = 'bars', children }) {
  return (
    <div className={styles.fieldBlock}>
      <div className={styles.fieldBlockHead}>
        <span className={styles.fieldBlockLabel}>
          {label}{required && <span className={styles.fieldBlockReq}>•</span>}
        </span>
        {confVariant === 'tier'
          ? <ConfTier score={confidence} />
          : <ConfGauge score={confidence} />}
      </div>
      <div className={styles.fieldBlockBody}>
        {children}
      </div>
    </div>
  );
}

/**
 * IcdMultiSelect — combobox for ICD codes. Selected codes render as DS
 * Badges (removable); typing directly in the field filters the ICD catalog
 * and shows matches in a dropdown. Removing/adding flows through onChange
 * so the description list below stays in sync (Figma 3:7620).
 */
export function IcdMultiSelect({ icds, onChange }) {
  const [q, setQ] = useState('');
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (!wrapRef.current?.contains(e.target)) { setFocused(false); setQ(''); } };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const existing = new Set((icds || []).map(i => i.code));
  const query = q.trim().toLowerCase();
  const matches = (() => {
    const all = Array.from(ICD_LOOKUP.entries()).map(([code, meta]) => ({ code, ...meta }));
    const filtered = query
      ? all.filter(i => i.code.toLowerCase().includes(query) || (i.desc || '').toLowerCase().includes(query))
      : all;
    return filtered.filter(i => !existing.has(i.code)).slice(0, 8);
  })();

  const addCode = (item) => {
    onChange([...(icds || []), { code: item.code, valid: true }]);
    setQ('');
    inputRef.current?.focus();
  };
  const removeCode = (code) => onChange((icds || []).filter(i => i.code !== code));

  const showDropdown = focused && (query.length > 0 || matches.length > 0);

  return (
    <div className={styles.icdMulti} ref={wrapRef}>
      <div
        className={[styles.encIcdsInput, focused ? styles.encIcdsInputFocus : ''].filter(Boolean).join(' ')}
        onClick={() => { setFocused(true); inputRef.current?.focus(); }}
      >
        {(icds || []).map(icd => (
          <span
            key={icd.code}
            role="button"
            tabIndex={0}
            className={styles.icdBadgeWrap}
            title={`Remove ${icd.code}`}
            onClick={(e) => { e.stopPropagation(); removeCode(icd.code); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); removeCode(icd.code); } }}
          >
            <Badge variant="ai-neutral" label={icd.code} trailingIcon="solar:close-circle-linear" />
          </span>
        ))}
        <input
          ref={inputRef}
          className={styles.icdInlineInput}
          placeholder={(icds || []).length ? 'Add code…' : 'Search ICD by code or description'}
          value={q}
          onFocus={() => setFocused(true)}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !q && (icds || []).length) {
              removeCode(icds[icds.length - 1].code);
            } else if (e.key === 'Enter' && matches[0]) {
              e.preventDefault();
              addCode(matches[0]);
            }
          }}
        />
      </div>
      {showDropdown && (
        <div className={styles.icdSearchPop}>
          <div className={styles.icdSearchList}>
            {matches.length === 0 ? (
              <div className={styles.icdSearchEmpty}>No matches for “{q}”</div>
            ) : matches.map(item => (
              <button key={item.code} type="button" className={styles.icdSearchItem} onClick={() => addCode(item)} title={item.desc}>
                <span className={styles.icdSearchCode}>{item.code}</span>
                <span className={styles.icdSearchDesc}>{item.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ConfTier — sparkle + High/Medium/Low label (Figma 3:7620). Used in the
 * read-only DOS card where the exact percentage is noise; the reviewer
 * only needs the tier to decide whether to trust or re-check.
 */
export function ConfTier({ score }) {
  if (typeof score !== 'number' || score === 0) {
    return <span className={styles.confTierEmpty}>—</span>;
  }
  const tier = score >= 85 ? 'high' : score >= 60 ? 'medium' : 'low';
  const label = tier === 'high' ? 'High' : tier === 'medium' ? 'Medium' : 'Low';
  return (
    <span className={[styles.confTier, styles[`confTier_${tier}`]].join(' ')} title={`AI confidence ${score}%`}>
      <Icon name="solar:magic-stick-3-bold" size={12} color="currentColor" />
      {label}
    </span>
  );
}

/**
 * ConfGauge — 5-segment horizontal gauge that fills based on score.
 * High (≥85%): full green; Medium (60-84%): mixed amber; Low (<60%):
 * red. Shows the percent number to the left of the bars.
 */
export function ConfGauge({ score }) {
  if (typeof score !== 'number' || score === 0) {
    return <span className={styles.confGaugeEmpty}>—</span>;
  }
  const tier = score >= 85 ? 'high' : score >= 60 ? 'medium' : 'low';
  // 5 segments. Fill count is proportional to score.
  const fillCount = Math.max(1, Math.min(5, Math.round((score / 100) * 5)));
  return (
    <span className={styles.confGauge}>
      <span className={[styles.confGaugePct, styles[`confGauge_${tier}Text`]].join(' ')}>{score}%</span>
      <span className={styles.confGaugeBars}>
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className={[
              styles.confGaugeBar,
              i < fillCount ? styles[`confGauge_${tier}Bar`] : styles.confGauge_offBar,
            ].join(' ')}
          />
        ))}
      </span>
    </span>
  );
}

/**
 * ComplianceBlock — at-a-glance OCR tier badge + 5-dot strip + expandable
 * review panel for the active document. Lives between the file switcher
 * and the page preview on the left side of the drawer.
 */
/**
 * DocChecksBadge — inline pass/fail badge on the file title that opens the
 * 7-point Document Review checklist popover (Figma 6:5838). The badge
 * reflects the aggregate: all pass → success "Pass N/N"; any fail → error
 * "Failed"; otherwise → warning "Review X/N".
 */
export function DocChecksBadge({ compliance, ocrTier, fileName, onApplyDecision }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(null); // { checkKey, decision }
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const total = CHECK_KEYS.length;
  const passCount = CHECK_KEYS.filter(k => compliance[k]?.status === 'pass').length;
  const failed = anyCheckFailed(compliance);
  const pendingAny = anyCheckPending(compliance);

  const variant = failed ? 'error' : (pendingAny ? 'warning' : 'success');
  const label = failed ? 'Checks · Failed' : `Checks · ${passCount}/${total}`;

  const submitReason = (reason) => {
    if (!pending) return;
    onApplyDecision?.({ checkKey: pending.checkKey, decision: pending.decision, reason });
    setPending(null);
  };

  return (
    <span className={styles.docChecks} ref={wrapRef}>
      <button type="button" className={styles.docChecksTrigger} onClick={() => setOpen(v => !v)} aria-label="Document checks">
        <Badge
          variant={variant}
          label={label}
          trailingIcon={open ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
        />
      </button>

      {open && (
        <div className={styles.docChecksPop} role="dialog" aria-label="Document Review checklist">
          <div className={styles.docChecksHead}>
            <Icon name="solar:clipboard-check-linear" size={16} color="var(--neutral-500)" />
            <div className={styles.docChecksHeadText}>
              <div className={styles.docChecksTitle}>Document Review</div>
              <div className={styles.docChecksSub}>Make sure the document meets these criteria</div>
            </div>
            <button type="button" className={styles.docChecksClose} onClick={() => setOpen(false)} aria-label="Close">
              <Icon name="solar:close-circle-linear" size={16} color="var(--neutral-300)" />
            </button>
          </div>
          <ul className={styles.docChecksList}>
            {CHECK_KEYS.map(k => {
              const c = compliance[k] || {};
              const passed = c.status === 'pass';
              const failedCheck = c.status === 'fail';
              const disabled = ocrTier === 'unreadable';
              return (
                <li key={k} className={[styles.docChecksRow, failedCheck ? styles.docChecksRowFail : ''].filter(Boolean).join(' ')}>
                  {/* Checkbox = manual toggle. Checking → confirm pass;
                      unchecking a passed check → mark fail. Both capture a
                      reason via the dialog. */}
                  <Checkbox
                    checked={passed}
                    disabled={disabled}
                    aria-label={CHECK_LABELS[k]}
                    onCheckedChange={(v) => setPending({ checkKey: k, decision: v === true ? 'pass' : 'fail' })}
                  />
                  <span className={styles.docChecksLabel}>{CHECK_LABELS[k]}</span>
                  {failedCheck && <Icon name="solar:close-circle-bold" size={14} color="var(--status-error)" />}
                  {c.source && <AuditBadge source={c.source} actor={c.actor} at={c.at} />}
                </li>
              );
            })}
          </ul>
          {ocrTier === 'unreadable' && (
            <div className={styles.docChecksUnreadable}>
              Document is unreadable — re-scan or re-request before it can be reviewed.
            </div>
          )}
        </div>
      )}

      {pending && (
        <ReasonDialog
          title={pending.decision === 'pass' ? 'Confirm manual pass' : 'Confirm manual fail'}
          description={CHECK_LABELS[pending.checkKey]}
          decision={pending.decision}
          standardReasons={STANDARD_REASONS[pending.checkKey] || []}
          onCancel={() => setPending(null)}
          onSubmit={submitReason}
        />
      )}
    </span>
  );
}

export function FieldConf({ score }) {
  if (typeof score !== 'number') return null;
  if (score === 0) {
    return <span className={[styles.fieldConf, styles.fieldConfMissing].join(' ')}>No value</span>;
  }
  let tier = 'Low';
  let tierCls = styles.fieldConfLow;
  if (score >= 85) { tier = 'High';   tierCls = styles.fieldConfHigh; }
  else if (score >= 60) { tier = 'Medium'; tierCls = styles.fieldConfMedium; }
  return (
    <span className={[styles.fieldConf, tierCls].join(' ')} title={`AI Confidence ${score}%`}>
      {score}% {tier}
    </span>
  );
}
