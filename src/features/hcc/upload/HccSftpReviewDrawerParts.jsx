import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../../components/Icon/Icon';
import { Button } from '../../../components/Button/Button';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Input } from '../../../components/Input/Input';
import { Badge } from '../../../components/Badge/Badge';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Select } from '../../../components/Select/Select';
import { IcdSearch } from '../../../components/IcdSearch/IcdSearch';
import { getFieldConfidence } from '../data/confidence';
import { POS_LABEL } from './mockOcr';
import { encStatus, flaggedCount } from './HccSftpReviewDrawer.utils';
import styles from './HccSftpReviewDrawer.module.css';

export function DocToolbar({ batch, setSelectedAll, showToast }) {
  const encs = batch.encounters || [];
  const flagged = encs.filter(e =>
    !e.patient?.matchedMemberId || (e.errors && e.errors.length > 0)
  ).length;
  const ready = encs.length - flagged;
  const acceptAllHigh = () => {
    const highIdxs = [];
    for (let i = 0; i < encs.length; i++) {
      const e = encs[i];
      if ((e.patient?.matchConfidence ?? 0) >= 85
          && e.patient?.matchedMemberId
          && (!e.errors || e.errors.length === 0)) {
        highIdxs.push(i);
      }
    }
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
export function DocSwitcher({ activeBatch, batches, onSelect }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const activeFlagged = activeBatch ? flaggedCount(activeBatch) : 0;
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
            const flagged = flaggedCount(b);
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

export function PagePreview({ activeBatch, batches, onSelect, previewRef }) {
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
      <div className={styles.previewBody} ref={previewRef}>
        {pages.length === 0 ? (
          <div className={styles.previewEmpty}>
            <Icon name="solar:document-linear" size={20} color="var(--neutral-200)" />
            <span>No pages extracted</span>
          </div>
        ) : pages.map(([page, encs]) => (
          <div key={page} className={styles.previewPage} data-preview-page={page}>
            <div className={styles.previewPageHeader}>
              <div className={styles.previewPageOrg}>Fold Health Medical Group</div>
              <div className={styles.previewPagePagenum}>Page {page} · {fileName}</div>
            </div>
            <h2 className={styles.previewPageH1}>Progress Note</h2>
            {encs.map((enc, i) => (
              <div key={enc.tempId || i} className={styles.previewPageEnc} data-preview-enc={enc.tempId}>
                <div className={styles.previewPageMeta}>
                  <div data-preview-field="patient"><strong>Patient:</strong> {enc.patient?.name || '—'}</div>
                  <div data-preview-field="dob"><strong>DOB:</strong> {enc.patient?.dob || '—'}</div>
                  <div data-preview-field="dos"><strong>DOS:</strong> {enc.dos || '—'}</div>
                  <div data-preview-field="provider"><strong>Provider:</strong> {enc.provider || '—'}</div>
                  <div data-preview-field="pos"><strong>POS:</strong> {enc.pos || '—'}{enc.posDesc ? ` — ${enc.posDesc}` : ''}</div>
                </div>
                <div className={styles.previewPageSection} data-preview-field="icds">
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
              <input
                type="checkbox"
                aria-label="Select all encounters"
                checked={allSelected}
                ref={el => { if (el) el.indeterminate = !allSelected && someSelected; }}
                onChange={(e) => setSelectedAll?.(allIdxs, e.target.checked)}
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
  const [icdOpen, setIcdOpen] = useState(false);
  const icdWrapRef = useRef(null);
  useEffect(() => {
    if (!icdOpen) return undefined;
    const onDocClick = (e) => { if (!icdWrapRef.current?.contains(e.target)) setIcdOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [icdOpen]);

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
        <input
          type="checkbox"
          aria-label="Select encounter"
          checked={!!checked}
          onChange={onToggle}
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
          <span className={styles.icdAddWrap} ref={icdWrapRef}>
            <button
              type="button"
              className={styles.icdAddBtn}
              onClick={() => setIcdOpen((v) => !v)}
              aria-label="Add ICD"
            >
              <Icon name="solar:add-circle-linear" size={13} color="var(--neutral-300)" />
            </button>
            {icdOpen && (
              <span className={styles.icdPickPop}>
                <IcdSearch
                  autoFocus
                  excludeCodes={(enc.icds || []).map(i => i.code)}
                  placeholder="Search ICD by code or description"
                  onSelect={(icd) => {
                    onPatch({ icds: [...(enc.icds || []), { code: icd.code, desc: icd.title, hcc: icd.hcc || '', valid: true }] });
                    setIcdOpen(false);
                  }}
                />
              </span>
            )}
          </span>
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
 * Document Review patient card — one card per patient. Header shows
 * the matched member identity once, followed by N "encounter blocks"
 * — one per DOS surfaced in this document. Each block carries its own
 * Ready/Mismatch/Error pill, per-DOS actions, and the editable field
 * grid (DOS · ICD · Provider · POS · Category). Single-DOS patients
 * render with no DOS-count chip and no separators.
 */
export function PatientCard({ group, hccMembers, encStatus, patchEnc, onAddToWorklist, onDelete, onCite, showToast, activeBatch }) {
  const first = group.encs[0];
  const isMatched = !!first?.patient?.matchedMemberId;
  const member = isMatched ? hccMembers.find(m => m.id === first.patient.matchedMemberId) : null;
  const displayName = member?.name || first?.patient?.name || '(unmatched)';
  const initials = member?.in || displayName.split(' ').map(p => p[0]).slice(0, 2).join('');

  const readyEncs = group.encs.filter(e => encStatus(e) === 'ready');
  const anyMissing = group.encs.some(e => encStatus(e) !== 'ready');
  const handleAddAll = () => {
    let added = 0;
    readyEncs.forEach((enc) => { if (onAddToWorklist(enc)) added += 1; });
    if (added) showToast?.(`Added ${added} DOS for ${displayName} to worklist`);
  };
  const handleDeleteRecord = () => {
    group.encs.forEach((enc) => onDelete(enc));
    showToast?.(`Deleted ${displayName}'s record`);
  };

  return (
    <div className={styles.encCard}>
      {/* Patient row — avatar, identity, per-record "Missing Field" badge,
          overflow menu. No inline buttons here per parity spec; actions
          live in the bottom bar. */}
      <div className={styles.encCardHead}>
        <Avatar variant="patient" initials={initials} />
        <div className={styles.encCardIdent}>
          <div className={styles.encCardName}>{displayName}</div>
          <div className={styles.encCardMeta}>
            {member?.g || ''} <span className={styles.encCardMetaDot}>•</span>
            {member?.age || ''} <span className={styles.encCardMetaDot}>•</span>
            #{first?.patient?.patientId || first?.patient?.matchedMemberDisplayId || '—'}
          </div>
        </div>
        {anyMissing && (
          <Badge size="M" variant="status-review" icon="solar:info-circle-bold" label="Missing Field" />
        )}
        <ActionButton
          size="S"
          icon="solar:menu-dots-linear"
          tooltip="More"
          onClick={() => showToast?.('More actions — coming soon')}
        />
      </div>

      {/* One collapsible card per DOS — header, Documents subsection,
          2×2 field grid with confidence badges, and per-DOS ICD list. */}
      {group.encs.map((enc, i) => (
        <EncounterBlock
          key={enc.tempId || `${group.key}:${i}`}
          enc={enc}
          status={encStatus(enc)}
          isFirst={i === 0}
          onPatch={(patch) => patchEnc(enc, patch)}
          onDelete={() => onDelete(enc)}
          onCite={onCite}
          activeBatch={activeBatch}
          showToast={showToast}
        />
      ))}

      {/* "+ Add More DOS" affordance — dashed tinted button. */}
      <button
        type="button"
        className={styles.addMoreDos}
        onClick={() => showToast?.('Add another DOS — coming soon')}
      >
        <Icon name="solar:add-circle-linear" size={14} color="var(--primary-300)" />
        Add More DOS
      </button>

      {/* Bottom action bar — Delete Record on the left, Add to the
          Worklist on the right (disabled until at least one DOS is Ready). */}
      <div className={styles.encCardFooter}>
        <Button variant="alt" size="S" leadingIcon="solar:trash-bin-trash-linear" onClick={handleDeleteRecord}>
          Delete Record
        </Button>
        <Button
          variant="primary"
          size="S"
          leadingIcon="solar:add-circle-linear"
          disabled={readyEncs.length === 0}
          onClick={handleAddAll}
        >
          Add to the Worklist
        </Button>
      </div>
    </div>
  );
}

/**
 * One DOS row inside a PatientCard. Renders the status pill + actions
 * at the top, then the editable 2-column field grid.
 */
/**
 * Status badge with a hover tooltip explaining *why* this row is
 * flagged. Tooltip is portaled to escape the card's overflow. No tip
 * when `reason` is empty (e.g. Ready rows) — just renders the Badge.
 */
export function StatusBadgeWithTip({ variant, icon, label, reason, tone }) {
  const wrapRef = useRef(null);
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  useEffect(() => {
    if (!hover || !wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    setPos({ left: r.left, top: r.bottom + 6 });
  }, [hover]);
  if (!reason) {
    return <Badge size="M" variant={variant} icon={icon} label={label} />;
  }
  return (
    <span
      ref={wrapRef}
      className={styles.statusTipWrap}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Badge size="M" variant={variant} icon={icon} label={label} />
      {hover && createPortal(
        <span
          role="tooltip"
          className={[
            styles.statusTip,
            tone === 'mismatch' ? styles.statusTipMismatch : styles.statusTipError,
          ].join(' ')}
          style={{
            left: Math.min(window.innerWidth - 320, Math.max(8, pos.left)),
            top: pos.top,
          }}
        >
          {reason}
        </span>,
        document.body
      )}
    </span>
  );
}

export function EncounterBlock({ enc, status, isFirst, onPatch, onDelete, onCite, activeBatch, showToast }) {
  const [collapsed, setCollapsed] = useState(false);
  const errors = new Set(enc.errors || []);
  const statusLabel = status === 'ready' ? 'Ready' : status === 'mismatch' ? 'Mismatch' : 'Not Ready';
  const fieldConf = (name) => {
    if (errors.has(name)) return 0;
    return getFieldConfidence(enc, name);
  };
  const docTypeMissing = errors.has('docType') || !enc.docType;
  const docTypeHint = enc.docTypeHint;

  return (
    <div className={[styles.encBlock, isFirst ? '' : styles.encBlockSep].join(' ')}>
      {/* Collapsible header — chevron, "DOS: <date>", status pill, trash. */}
      <div className={styles.dosCardHead}>
        <button
          type="button"
          className={styles.dosCardToggle}
          onClick={() => setCollapsed(v => !v)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand DOS' : 'Collapse DOS'}
        >
          <Icon
            name={collapsed ? 'solar:alt-arrow-right-linear' : 'solar:alt-arrow-down-linear'}
            size={12}
            color="var(--neutral-400)"
          />
        </button>
        <span className={styles.dosCardTitle}>DOS: {enc.dos || '—'}</span>
        <Badge size="M"
          variant={status === 'ready' ? 'status-completed' : status === 'mismatch' ? 'status-review' : 'status-review'}
          icon={status === 'ready' ? 'solar:check-circle-bold' : 'solar:hourglass-line-linear'}
          label={statusLabel}
        />
        <span className={styles.dosCardDivider} />
        <ActionButton size="S" icon="solar:trash-bin-trash-linear" tooltip="Remove this DOS" onClick={onDelete} />
      </div>

      {!collapsed && (
        <div className={styles.dosCardBody}>
          {/* Documents subsection — label + Upload text link + document card. */}
          <div className={styles.dosDocsHead}>
            <span className={styles.dosSectionLabel}>Documents</span>
            <button
              type="button"
              className={styles.dosUploadLink}
              onClick={() => showToast?.('Upload document — coming soon')}
            >
              <Icon name="solar:upload-minimalistic-linear" size={12} color="var(--primary-300)" />
              Upload
            </button>
          </div>
          <div className={styles.dosDocCard}>
            <span className={styles.pdfBadge} aria-hidden="true">
              <PdfDocIcon />
            </span>
            <div className={styles.dosDocMain}>
              <div className={styles.dosDocName}>{activeBatch?.fileName || '—'}</div>
              <div className={styles.dosDocMeta}>
                {shortDateOrRaw(activeBatch?.ingestedAt) || '—'}
                {activeBatch?.source === 'sftp' && <>&nbsp;•&nbsp;Imported via SFTP</>}
              </div>
            </div>
            <ActionButton
              size="S"
              icon="solar:menu-dots-linear"
              tooltip="More"
              onClick={() => showToast?.('Document actions — coming soon')}
            />
          </div>

          {/* 2×2 field grid — DOS + Rendering Provider on the top row,
              POS + Document Type on the bottom row. Each label carries a
              percent confidence badge with the source-page citation. */}
          <div className={styles.dosFieldGrid}>
            <PctFieldBlock
              label="DOS"
              required
              confidence={fieldConf('dos')}
              sourcePage={enc.sourcePage}
              onCite={onCite ? () => onCite(enc.sourcePage || 1, enc.tempId, 'dos') : null}
            >
              <Input
                value={enc.dos || ''}
                placeholder="MM/DD/YYYY"
                variant={errors.has('dos') ? 'error' : 'default'}
                onChange={(e) => onPatch({ dos: e.target.value })}
              />
            </PctFieldBlock>
            <PctFieldBlock
              label="Rendering Provider"
              required
              confidence={fieldConf('provider')}
              sourcePage={enc.sourcePage}
              onCite={onCite ? () => onCite(enc.sourcePage || 1, enc.tempId, 'provider') : null}
            >
              <Input
                value={enc.provider || ''}
                placeholder="Provider"
                variant={errors.has('provider') ? 'error' : 'default'}
                onChange={(e) => onPatch({ provider: e.target.value })}
              />
            </PctFieldBlock>
            <PctFieldBlock
              label="POS"
              required
              confidence={fieldConf('pos')}
              sourcePage={enc.sourcePage}
              onCite={onCite ? () => onCite(enc.sourcePage || 1, enc.tempId, 'pos') : null}
            >
              <Input
                value={enc.pos ? `${enc.pos} - ${POS_LABEL[enc.pos] || ''}` : ''}
                placeholder="POS"
                variant={errors.has('pos') ? 'error' : 'default'}
                onChange={(e) => {
                  const code = e.target.value.split(' ')[0];
                  onPatch({ pos: code, posDesc: POS_LABEL[code] || '' });
                }}
              />
            </PctFieldBlock>
            <PctFieldBlock
              label="Document Type"
              required
              confidence={fieldConf('docType')}
              sourcePage={enc.sourcePage}
              onCite={onCite ? () => onCite(enc.sourcePage || 1, enc.tempId, 'docType') : null}
              hint={docTypeMissing && docTypeHint ? `Maybe: ${docTypeHint}` : null}
            >
              <Select
                value={enc.docType || ''}
                placeholder="Select Document Type"
                variant={docTypeMissing ? 'error' : 'default'}
                onChange={(v) => onPatch({ docType: v })}
                options={[
                  { value: 'AWV Note',      label: 'AWV Note' },
                  { value: 'Progress Note', label: 'Progress Note' },
                  { value: 'Lab',           label: 'Lab' },
                  { value: 'Other',         label: 'Other' },
                ]}
              />
            </PctFieldBlock>
          </div>

          {/* ICD Codes section — full-width search then list of rows. */}
          <div className={styles.dosIcdSection}>
            <span className={styles.dosSectionLabel}>ICD Codes</span>
            <IcdSearch
              placeholder="Search and Add ICD Code & Description, HCC Code & Description"
              excludeCodes={(enc.icds || []).map(i => i.code)}
              onSelect={(icd) => onPatch({
                icds: [...(enc.icds || []), { code: icd.code, desc: icd.title, hcc: icd.hcc || '', valid: true }],
              })}
            />
            {(enc.icds || []).length > 0 && (
              <div className={styles.dosIcdList}>
                {(enc.icds || []).map((icd) => (
                  <div key={icd.code} className={styles.dosIcdRow}>
                    <span className={styles.dosIcdCode}>{icd.code}</span>
                    <div className={styles.dosIcdBody}>
                      <div className={styles.dosIcdDesc}>{icd.desc || icd.title || ''}</div>
                      {icd.hcc && <div className={styles.dosIcdHcc}>{icd.hcc}</div>}
                    </div>
                    <ConfPct score={icd.confidence ?? fieldConf('icds')} />
                    <span className={styles.dosIcdDivider} />
                    <ActionButton
                      size="S"
                      icon="solar:trash-bin-trash-linear"
                      tooltip={`Remove ${icd.code}`}
                      onClick={() => onPatch({ icds: (enc.icds || []).filter(i => i.code !== icd.code) })}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {enc._duplicateOfMemberId && (
            <span className={styles.encDupWarn} title="Same DOS + Provider + POS already exists for this member">
              <Icon name="solar:danger-triangle-bold" size={11} color="var(--status-warning)" />
              Possible duplicate — review before adding
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Format an ISO datetime as MM/DD/YYYY, or return the raw string.
export function shortDateOrRaw(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()}`;
}

// Custom PDF glyph — mirrors the badge used on the upload drawer's
// document rows so both surfaces read consistently.
export function PdfDocIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15.39 4.05L15.06 4.43V4.43L15.39 4.05ZM19.35 7.62L19.02 7.99V7.99L19.35 7.62ZM3.17 20.83L3.53 20.47H3.53L3.17 20.83ZM20.83 20.83L20.47 20.47V20.47L20.83 20.83ZM13 5L12.5 5V5H13ZM5.16 13.68V13.18H4.66V13.68H5.16ZM10.32 13.68V13.18H9.82V13.68H10.32ZM10.32 18.96H9.82V19.46H10.32V18.96ZM15.96 13.68V13.18H15.46V13.68H15.96ZM14 22V21.5H10V22V22.5H14V22ZM2 14H2.5V10H2H1.5V14H2ZM22 13.56H21.5V14H22H22.5V13.56H22ZM15.39 4.05L15.06 4.43L19.02 7.99L19.35 7.62L19.69 7.24L15.73 3.682L15.39 4.05ZM22 13.56H22.5C22.5 11.85 22.51 10.85 22.11 9.95L21.654 10.15L21.2 10.36C21.49 11.01 21.5 11.76 21.5 13.56H22ZM19.35 7.62L19.02 7.99C20.35 9.19 20.9 9.7 21.2 10.36L21.654 10.15L22.11 9.95C21.71 9.05 20.96 8.39 19.69 7.24L19.35 7.62ZM10.03 2V2.5C11.59 2.5 12.24 2.51 12.83 2.73L13.01 2.27L13.19 1.8C12.39 1.49 11.52 1.5 10.03 1.5V2ZM15.39 4.05L15.73 3.682C14.63 2.69 13.99 2.11 13.19 1.8L13.01 2.27L12.83 2.73C13.42 2.96 13.9 3.39 15.06 4.43L15.39 4.05ZM10 22V21.5C8.1 21.5 6.73 21.5 5.68 21.358C4.64 21.219 4 20.95 3.53 20.47L3.17 20.83L2.82 21.182C3.51 21.88 4.4 22.2 5.54 22.35C6.67 22.5 8.13 22.5 10 22.5V22ZM2 14H1.5C1.5 15.87 1.5 17.33 1.65 18.46C1.8 19.6 2.12 20.49 2.82 21.182L3.17 20.83L3.53 20.47C3.05 20 2.78 19.36 2.64 18.32C2.5 17.27 2.5 15.9 2.5 14H2ZM14 22V22.5C15.87 22.5 17.33 22.5 18.46 22.35C19.6 22.2 20.49 21.88 21.182 21.182L20.83 20.83L20.47 20.47C20 20.95 19.36 21.219 18.32 21.358C17.27 21.5 15.9 21.5 14 21.5V22ZM22 14H21.5C21.5 15.9 21.5 17.27 21.358 18.32C21.219 19.36 20.95 20 20.47 20.47L20.83 20.83L21.182 21.182C21.88 20.49 22.2 19.6 22.35 18.46C22.5 17.33 22.5 15.87 22.5 14H22ZM2 10H2.5C2.5 8.1 2.5 6.73 2.64 5.68C2.78 4.64 3.05 4 3.53 3.53L3.17 3.17L2.82 2.82C2.12 3.51 1.8 4.4 1.65 5.54C1.5 6.67 1.5 8.13 1.5 10H2ZM10.03 2V1.5C8.15 1.5 6.69 1.5 5.55 1.65C4.4 1.8 3.51 2.12 2.82 2.82L3.17 3.17L3.53 3.53C4 3.05 4.65 2.78 5.68 2.64C6.74 2.5 8.12 2.5 10.03 2.5V2ZM13.01 2.27L12.51 2.26L12.5 5L13 5L13.5 5L13.51 2.27L13.01 2.27ZM18 10.15V10.65H21.654V10.15V9.65H18V10.15ZM13 5H12.5C12.5 6.16 12.5 7.09 12.596 7.81C12.695 8.55 12.9 9.15 13.38 9.62L13.73 9.27L14.09 8.91C13.83 8.66 13.67 8.3 13.59 7.68C13.5 7.04 13.5 6.19 13.5 5H13ZM18 10.15V9.65C16.823 9.65 15.98 9.61 15.35 9.49C14.73 9.38 14.36 9.19 14.09 8.91L13.73 9.27L13.38 9.62C13.84 10.08 14.42 10.33 15.163 10.48C15.89 10.62 16.82 10.65 18 10.65V10.15ZM5.16 13.68V14.18H6.84V13.68V13.18H5.16V13.68ZM5.16 13.68H4.66V16.8H5.16H5.66V13.68H5.16ZM5.16 16.8H4.66V19.2H5.16H5.66V16.8H5.16ZM6.84 16.8V16.3H5.16V16.8V17.3H6.84V16.8ZM8.4 15.24H7.9C7.9 15.83 7.43 16.3 6.84 16.3V16.8V17.3C7.98 17.3 8.9 16.38 8.9 15.24H8.4ZM6.84 13.68V14.18C7.43 14.18 7.9 14.65 7.9 15.24H8.4H8.9C8.9 14.1 7.98 13.18 6.84 13.18V13.68ZM10.32 13.68H9.82V18.96H10.32H10.82V13.68H10.32ZM10.32 18.96V19.46H11.76V18.96V18.46H10.32V18.96ZM14.16 16.56H14.66V16.08H14.16H13.66V16.56H14.16ZM11.76 13.68V13.18H10.32V13.68V14.18H11.76V13.68ZM14.16 16.08H14.66C14.66 14.48 13.36 13.18 11.76 13.18V13.68V14.18C12.81 14.18 13.66 15.03 13.66 16.08H14.16ZM11.76 18.96V19.46C13.36 19.46 14.66 18.16 14.66 16.56H14.16H13.66C13.66 17.61 12.81 18.46 11.76 18.46V18.96ZM19.2 13.68V13.18H15.96V13.68V14.18H19.2V13.68ZM15.96 13.68H15.46V16.2H15.96H16.46V13.68H15.96ZM15.96 16.2H15.46V19.2H15.96H16.46V16.2H15.96ZM15.96 16.2V16.7H18.96V16.2V15.7H15.96V16.2Z" fill="currentColor"/>
    </svg>
  );
}

// Field wrapper: label + percent confidence badge on the right; optional
// error-tone hint under the input for "Maybe: X" suggestions.
export function PctFieldBlock({ label, required, confidence, sourcePage, onCite, hint, children }) {
  return (
    <div className={styles.fieldBlock}>
      <div className={styles.fieldBlockHead}>
        <span className={styles.fieldBlockLabel}>
          {label}{required && <span className={styles.fieldBlockReq}>•</span>}
        </span>
        <ConfPct score={confidence} sourcePage={sourcePage} onCite={onCite} />
      </div>
      <div className={styles.fieldBlockBody}>
        {children}
      </div>
      {hint && (
        <div className={styles.fieldHintError}>
          {hint} <Icon name="solar:info-circle-linear" size={11} color="var(--status-error)" />
        </div>
      )}
    </div>
  );
}

// Confidence percentage badge — meter icon + "44%" in tier tint.
// Cutoffs match the AI's tier reporter: ≥85 High (green), ≥60 Medium
// (amber), else Low (red). No value → dashed placeholder so the field
// still balances with its siblings.
export function ConfPct({ score, sourcePage, onCite }) {
  if (typeof score !== 'number' || score === 0) {
    return <span className={styles.confPctEmpty}>—</span>;
  }
  const tier = score >= 85 ? 'high' : score >= 60 ? 'medium' : 'low';
  const cls = [
    styles.confPct,
    styles[`confPct_${tier}`],
    onCite ? styles.confPctClickable : '',
  ].filter(Boolean).join(' ');
  const iconColor = tier === 'high'
    ? 'var(--status-success)'
    : tier === 'medium'
    ? 'var(--status-warning)'
    : 'var(--status-error)';
  const content = (
    <>
      <Icon name="solar:speedometer-linear" size={11} color={iconColor} />
      {score}%
    </>
  );
  if (onCite && sourcePage) {
    return (
      <button
        type="button"
        className={cls}
        onClick={(e) => { e.preventDefault(); onCite(); }}
        title={`AI Confidence ${score}% · Source Page ${sourcePage}`}
      >
        {content}
      </button>
    );
  }
  return <span className={cls}>{content}</span>;
}

/**
 * FieldBlock — label + confidence pill + input slot. The pill shows
 * the AI's High/Medium/Low confidence tier for this field and, when
 * the encounter has a sourcePage, doubles as a citation affordance:
 * hover reveals "Source · Page N", click scrolls the left-pane PDF
 * preview to that page and pulses a highlight on the cited row.
 */
export function FieldBlock({ label, required, confidence, sourcePage, onCite, children }) {
  return (
    <div className={styles.fieldBlock}>
      <div className={styles.fieldBlockHead}>
        <span className={styles.fieldBlockLabel}>
          {label}{required && <span className={styles.fieldBlockReq}>•</span>}
        </span>
        <ConfPill score={confidence} sourcePage={sourcePage} onCite={onCite} />
      </div>
      <div className={styles.fieldBlockBody}>
        {children}
      </div>
    </div>
  );
}

/**
 * ConfPill — replaces the old percent-based gauge with a plain
 * High/Medium/Low label, mirroring how the AI's underlying tier model
 * actually reports confidence (the percent number was always derived
 * from the same tier mapping anyway, so showing it was misleading
 * precision). When a sourcePage is available the pill becomes a
 * button with a hover tooltip ("Source · Page N — Click to view")
 * and clicking it fires `onCite` which scrolls the left-pane preview
 * to that page and highlights the cited encounter row.
 */
export function ConfPill({ score, sourcePage, onCite }) {
  const wrapRef = useRef(null);
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  useEffect(() => {
    if (!hover || !wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    setPos({ left: r.left, top: r.bottom + 6 });
  }, [hover]);
  if (typeof score !== 'number' || score === 0) {
    return <span className={styles.confPillEmpty}>—</span>;
  }
  const tier = score >= 85 ? 'high' : score >= 60 ? 'medium' : 'low';
  const label = tier === 'high' ? 'High' : tier === 'medium' ? 'Medium' : 'Low';
  const canCite = typeof onCite === 'function' && !!sourcePage;
  const cls = [styles.confPill, styles[`confPill_${tier}`], canCite ? styles.confPillClickable : ''].join(' ');
  if (!canCite) {
    return <span className={cls}>{label}</span>;
  }
  return (
    <span
      ref={wrapRef}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        className={cls}
        onClick={(e) => { e.preventDefault(); onCite(); }}
      >
        {label}
      </button>
      {hover && createPortal(
        <span
          role="tooltip"
          className={styles.confPillTip}
          style={{
            left: Math.min(window.innerWidth - 220, Math.max(8, pos.left)),
            top: pos.top,
          }}
        >
          <span className={styles.confPillTipHead}>Source · Page {sourcePage}</span>
          <span className={styles.confPillTipSub}>Click to view in document</span>
        </span>,
        document.body
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
