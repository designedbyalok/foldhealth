import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../../store/useAppStore';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { Icon } from '../../../components/Icon/Icon';
import { CheckIcon } from '../../../components/Icon/CheckIcon';
import { CloseIcon } from '../../../components/Icon/CloseIcon';
import { useIcdSearch } from '../../../lib/icd/useIcdSearch';
import { DismissReasonForm } from './DismissReasonForm';
import { reviewedByLabel } from '../reviewedBy';
import styles from './HccSuspectGroup.module.css';

const EMPTY_DOS_LIST = [];

/**
 * SuspectCard — one card per AI suspect / recapture ICD (Paper 1WXT; RA coder
 * workflow §B3; Figma ICD-Import 4278-67296; see docs/features/hcc-coding-
 * workflow.md). Rendered as a flat list under "Suspects and Recaptures" (no
 * per-HCC section header).
 *
 * Flow: the code can be **switched** to a corrected one via an in-dropdown ICD
 * search (WHO ICD-11); a **single DOS** is then chosen (from the document's
 * existing encounters, which supply Rendering Provider + POS); only then — with
 * both an ICD and a DOS selected — can the coder flag **Missed Opportunity** or
 * **Dismiss** it (primary, at the DOS level), or **Accept** / **Defer** from the
 * ⋯ menu. State uses the same per-(code × DOS) store the confirmed ICD card
 * uses, so both behave identically.
 */
export function SuspectCard({ icd, dosList = EMPTY_DOS_LIST, member, reviewLocked = false, lockReason = null, bulkDisabled = false }) {
  const openIcdPanel = useAppStore(s => s.openIcdPanel);
  const openIcdActivityLog = useAppStore(s => s.openIcdActivityLog);
  const diagActivityIcd = useAppStore(s => s.diagActivityIcd);
  const clearDiagActivityIcd = useAppStore(s => s.clearDiagActivityIcd);
  const setDiagLeftPanel = useAppStore(s => s.setDiagLeftPanel);
  const dosActions = useAppStore(s => s.hccGapDosActions);
  const dosMeta = useAppStore(s => s.hccGapDosMeta);
  const setDosAction = useAppStore(s => s.setHccGapDosAction);
  const dismissDos = useAppStore(s => s.dismissHccGapDos);

  // ICD switch — the displayed code can be corrected via the in-dropdown search.
  const [override, setOverride] = useState(null); // { code, desc }
  const code = override?.code || icd.code;
  const desc = override?.desc || icd.desc;

  // Live ICD-scoped counters — comments filtered by `icd`, activity by the
  // `icds` array. Falls back to seeded fields while the DB slice is empty
  // so the pills never blank out mid-render.
  const dbComments = useAppStore(s => s.hccDiagComments);
  const memberActivity = useAppStore(s => (member?.name ? s.hccActivityLog[member.name] : null));
  const commentsCount = useMemo(() => {
    if (!Array.isArray(dbComments) || dbComments.length === 0) {
      return icd.cmts ?? 0;
    }
    return dbComments.filter(c => c?.icd === code).length;
  }, [dbComments, code, icd.cmts]);
  const historyCount = useMemo(() => {
    const list = Array.isArray(memberActivity) ? memberActivity : [];
    const scoped = list.filter(e => Array.isArray(e?.icds) && e.icds.includes(code)).length;
    return scoped || ((icd.docs ?? 0) + (icd.notes ?? 0));
  }, [memberActivity, code, icd.docs, icd.notes]);

  // Single DOS selection (from the document's existing encounters). When the
  // document has exactly one encounter, pre-select it so the coder can act
  // immediately (Accept / Reject / Defer / Missed) without opening the picker.
  // Multiple DOS → the user must pick one via the dropdown.
  const [dos, setDos] = useState(() => (dosList.length === 1 ? dosList[0]?.date || '' : ''));
  const [dosOpen, setDosOpen] = useState(false);
  const dosBtnRef = useRef(null);
  const singleDos = dosList.length === 1;
  useEffect(() => {
    // Keep pre-selection in sync if dosList later resolves to a single entry.
    if (!dos && dosList.length === 1) setDos(dosList[0]?.date || '');
  }, [dosList, dos]);

  // Per-(code × DOS) action state — same store the confirmed ICD card uses.
  const key = dos ? `${icd.code}|${dos}` : null;
  const action = key ? (dosActions[key] || null) : null;
  const meta = key ? (dosMeta[key] || null) : null;

  const [dismissOpen, setDismissOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const moreRef = useRef(null);

  // Bulk select only applies to associated ICD cards — while it's active this
  // card is inert (dimmed, no pointer events), so close anything it had open.
  useEffect(() => {
    if (bulkDisabled) {
      setDosOpen(false);
      setMenuPos(null);
      setDismissOpen(false);
    }
  }, [bulkDisabled]);

  // Support can't work ICDs (that's the coder's job). QA / Compliance
  // consume the same lock as the ICD card (reviewLocked = Support not
  // Completed) — but here we gate on user role directly since Suspect
  // cards live in a shared section, not under a role-specific bucket.
  const hccUserRole = useAppStore(s => s.hccUserRole);
  const roleAllowsIcdActions = hccUserRole !== 'Support';
  // Tooltip ordered most-specific first: explicit lockReason from the
  // parent (e.g. rejection with rejecting user + date) wins; then role
  // gate; then the generic Support-hasn't-reviewed message.
  const disabledReason = lockReason
    || (hccUserRole === 'Support'
      ? 'Support role cannot code ICDs'
      : (reviewLocked ? "Support team hasn't reviewed the documents yet" : null));
  // Actions unlock only once an ICD *and* a DOS are chosen, the user
  // holds a role that can code ICDs, AND Support has completed its
  // document review (reviewLocked = false).
  const canAct = !!code && !!dos && !action && roleAllowsIcdActions && !reviewLocked;

  useEffect(() => {
    if (!menuPos) return undefined;
    const onDoc = (e) => {
      if (!moreRef.current?.contains(e.target) && !e.target.closest?.('[data-suspect-menu]')) setMenuPos(null);
    };
    const onKey = (e) => { if (e.key === 'Escape') setMenuPos(null); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [menuPos]);

  const openMenu = () => {
    const r = moreRef.current?.getBoundingClientRect();
    if (!r) return;
    const margin = 8;
    const menuW = 180;
    const estHeight = 128;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const spaceBelow = vh - r.bottom - margin;
    const flipUp = spaceBelow < estHeight && r.top > estHeight + margin;
    const top = flipUp ? Math.max(margin, r.top - estHeight - 4) : r.bottom + 4;
    const left = Math.min(Math.max(margin, r.right - menuW), vw - menuW - margin);
    setMenuPos({ top, left });
  };

  const missed = () => setDosAction(icd.code, dos, 'missed');
  const accept = () => { setDosAction(icd.code, dos, 'accepted'); setMenuPos(null); };
  const defer = () => { setDosAction(icd.code, dos, 'deferred'); setMenuPos(null); };
  const undo = () => setDosAction(icd.code, dos, action);
  const confirmDismiss = (reason, note) => { dismissDos(icd.code, dos, reason, note); setDismissOpen(false); };

  const isRejected = action === 'rejected';
  // Clicking the whole card opens (or closes) the source-document preview
  // for this ICD — matches the IcdDosCard behavior so Suspect / Recapture
  // rows respond to click + keyboard the same way.
  const isSelected = diagActivityIcd === code;
  const toggleSelect = () => {
    if (isSelected) {
      clearDiagActivityIcd();
      setDiagLeftPanel(null);
    } else {
      openIcdPanel('documents', code);
    }
  };

  return (
    <div
      className={[styles.card, isSelected ? styles.cardSelected : '', bulkDisabled ? styles.cardBulkDisabled : ''].filter(Boolean).join(' ')}
      role="button"
      tabIndex={bulkDisabled ? -1 : 0}
      aria-disabled={bulkDisabled || undefined}
      // Card-level click opens the source document. Every inner button /
      // combobox / dropdown still functions — we only fire the toggle when
      // the click landed on non-interactive card chrome.
      onClick={(e) => {
        if (bulkDisabled) return;
        if (e.target.closest?.('button, input, [role="listbox"], [role="option"], [role="dialog"]')) return;
        toggleSelect();
      }}
      onKeyDown={(e) => {
        if (bulkDisabled) return;
        if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
          e.preventDefault();
          toggleSelect();
        }
      }}
      title={bulkDisabled
        ? 'Bulk actions don’t apply to Suspects and Recaptures'
        : (isSelected ? 'Deselect' : `Open source document for ${code}`)}>
      <div className={styles.head}>
        <div className={styles.headMain}>
          <IcdCombobox
            code={code}
            desc={desc}
            disabled={!roleAllowsIcdActions || reviewLocked}
            onSelect={(picked) => setOverride({ code: picked.code, desc: picked.title || picked.desc || '' })}
          />
          {reviewedByLabel(icd.by) && (
            <div className={styles.lastLine}>Last Reviewed by {reviewedByLabel(icd.by)} • {icd.last}</div>
          )}
        </div>
        <span className={styles.counters}>
          <Tooltip label="Comments">
            <button type="button" className={styles.counter} onClick={() => openIcdPanel('comments', code)}>
              <Icon name="solar:chat-round-line-linear" size={14} />
              {commentsCount}
            </button>
          </Tooltip>
          <span className={styles.counterDivider} />
          <Tooltip label="Activity">
            <button type="button" className={styles.counter} onClick={() => openIcdActivityLog(code)}>
              <Icon name="solar:history-linear" size={14} />
              {historyCount}
            </button>
          </Tooltip>
        </span>
      </div>

      <div className={styles.chips}>
        <span className={styles.hccChip}>{(icd.hcc || '').split(' - ')[0] || 'No HCC'}</span>
        {icd.type && <span className={styles.suspectChip}>{icd.type}</span>}
      </div>

      <div className={styles.dosRow}>
        <button
          ref={dosBtnRef}
          type="button"
          className={[styles.dosButton, dos ? styles.dosButtonActive : ''].filter(Boolean).join(' ')}
          disabled={!!action || singleDos || !roleAllowsIcdActions || reviewLocked}
          onClick={() => (singleDos || !roleAllowsIcdActions || reviewLocked ? null : setDosOpen(o => !o))}
          title={disabledReason
            || (singleDos ? 'Only encounter available' : 'Select a DOS')}
        >
          <span>{dos || 'Select DOS'}</span>
          {!singleDos && (
            <Icon name="solar:alt-arrow-down-linear" size={13} color={dos ? 'var(--primary-300)' : 'var(--neutral-300)'} />
          )}
        </button>
        {/* stopPropagation so ICD-action button clicks (Missed / Dismiss /
            More / Undo) don't bubble to the parent Suspect card's
            toggleSelect handler — the card would otherwise switch the
            left panel to Documents even when Timeline / Comments is open. */}
        <div className={styles.dosActions} onClick={(e) => e.stopPropagation()}>
          {action ? (
            <>
              <ResolvedPill action={action} />
              {isRejected && (
                <button type="button" className={styles.dismissReasonLink} title={meta?.reason || 'View dismiss reason'} onClick={() => setDismissOpen(true)}>
                  Dismiss Reason
                  <Icon name="solar:info-circle-linear" size={12} />
                </button>
              )}
              <button type="button" className={styles.undoBtn} title="Undo" aria-label="Undo" onClick={undo}>
                <Icon name="solar:undo-left-round-linear" size={15} />
              </button>
            </>
          ) : (
            <>
              {/* Match the ICD-card action row: icon-only 24-tall buttons in
                  Accept (primary tinted) / Dismiss (neutral) / more-menu shape. */}
              <Tooltip label={canAct ? 'Missed Opportunity' : (disabledReason || 'Select an ICD and DOS first')}>
                <button
                  type="button"
                  className={[styles.missedBtn, canAct ? '' : styles.disabledAction].filter(Boolean).join(' ')}
                  aria-label="Missed Opportunity"
                  disabled={!canAct}
                  onClick={canAct ? missed : undefined}
                >
                  <Icon name="solar:flag-linear" size={13} color="currentColor" />
                </button>
              </Tooltip>
              <Tooltip label={canAct ? 'Dismiss' : (disabledReason || 'Select an ICD and DOS first')}>
                <button
                  type="button"
                  className={[styles.dismissBtn, dismissOpen ? styles.dismissBtnActive : '', canAct ? '' : styles.disabledAction].filter(Boolean).join(' ')}
                  aria-label="Dismiss"
                  disabled={!canAct}
                  onClick={canAct ? () => setDismissOpen(v => !v) : undefined}
                >
                  <CloseIcon size={13} color="currentColor" />
                </button>
              </Tooltip>
              <Tooltip label={canAct ? 'More actions' : (disabledReason || 'Select an ICD and DOS first')}>
                <button
                  ref={moreRef}
                  type="button"
                  className={styles.moreBtn}
                  aria-label="More actions"
                  disabled={!canAct}
                  onClick={() => (menuPos ? setMenuPos(null) : openMenu())}
                >
                  <Icon name="solar:menu-dots-linear" size={15} />
                </button>
              </Tooltip>
            </>
          )}
        </div>

        {dosOpen && (
          <DosDropdown
            anchorRef={dosBtnRef}
            dosList={dosList}
            member={member}
            selected={dos}
            onSelect={(d) => { setDos(d); setDosOpen(false); }}
            onClose={() => setDosOpen(false)}
          />
        )}
      </div>

      {dismissOpen && (
        <DismissReasonForm
          initialReason={meta?.reason || ''}
          initialNote={meta?.note || ''}
          onCancel={() => setDismissOpen(false)}
          onConfirm={confirmDismiss}
        />
      )}

      {menuPos && createPortal(
        <div data-suspect-menu className={styles.moreMenu} style={{ top: menuPos.top, left: menuPos.left }}>
          <button type="button" className={styles.moreItem} onClick={accept}>
            <Icon name="solar:check-circle-linear" size={14} color="var(--neutral-400)" />
            Accept
          </button>
          <button type="button" className={styles.moreItem} onClick={defer}>
            <Icon name="solar:alarm-linear" size={14} color="var(--neutral-400)" />
            Defer
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}

// Terminal-state pill + icon.
function ResolvedPill({ action }) {
  if (action === 'accepted') {
    return <span className={styles.acceptedPill}><CheckIcon size={13} color="currentColor" /> Accepted</span>;
  }
  if (action === 'rejected') {
    return <span className={styles.dismissedPill}><Icon name="solar:close-circle-linear" size={13} color="currentColor" /> Dismissed</span>;
  }
  if (action === 'missed') {
    return <span className={styles.warnPill}><CheckIcon size={13} color="currentColor" /> Missed Opportunity</span>;
  }
  return <span className={styles.warnPill}><Icon name="solar:alarm-linear" size={13} color="currentColor" /> Deferred</span>;
}

// ── ICD combobox — button opens a dropdown with an in-dropdown search field.
// The current code is pre-selected; typing searches the live WHO ICD-11 API.
function IcdCombobox({ code, desc, onSelect, disabled = false }) {
  const btnRef = useRef(null);
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.icdComboWrap}>
      <button
        ref={btnRef}
        type="button"
        className={styles.icdSelect}
        title={disabled ? 'Support role cannot code ICDs' : 'Switch to a corrected ICD code'}
        disabled={disabled}
        onClick={() => (disabled ? null : setOpen(o => !o))}
      >
        <span className={styles.icdSelectText}>{code} {desc}</span>
        <Icon name="solar:alt-arrow-down-linear" size={13} color="var(--neutral-300)" />
      </button>
      {open && (
        <IcdComboPopover
          anchorRef={btnRef}
          currentCode={code}
          currentDesc={desc}
          onSelect={(picked) => { onSelect(picked); setOpen(false); }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function IcdComboPopover({ anchorRef, currentCode, currentDesc, onSelect, onClose }) {
  const { query, setQuery, results, loading } = useIcdSearch({ minChars: 2 });
  const [pos, setPos] = useState(null);

  useEffect(() => {
    const compute = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.max(r.width, 340);
      const margin = 8;
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      // Search input + up to ~5 rows visible before scrolling kicks in.
      const estHeight = 320;
      const spaceBelow = vh - r.bottom - margin;
      const spaceAbove = r.top - margin;
      const flipUp = spaceBelow < estHeight && spaceAbove > spaceBelow;
      const left = Math.min(Math.max(margin, r.left), vw - width - margin);
      if (flipUp) {
        // Anchor the popover's BOTTOM edge just above the trigger. Anchoring
        // by `top: r.top - estHeight - 6` used the ESTIMATED height, so a
        // short popover (single option, no search results) rendered hundreds
        // of pixels above the trigger — the "opens in random places" bug.
        // Bottom-anchor makes the popover hug the trigger regardless of the
        // actual content height it settles at.
        setPos({ bottom: vh - r.top + 6, left, width, maxHeight: Math.min(spaceAbove - 6, estHeight) });
      } else {
        setPos({ top: r.bottom + 6, left, width, maxHeight: Math.min(spaceBelow, estHeight) });
      }
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [anchorRef]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!pos) return null;

  const searching = query.trim().length >= 2;
  // Empty query → show the current code (pre-selected). Typing → live results.
  const list = searching ? results.filter(r => r.code) : [{ code: currentCode, title: currentDesc }];

  return createPortal(
    <>
      <div className={styles.comboOverlay} onClick={onClose} />
      <div
        className={styles.comboMenu}
        style={{
          ...(pos.top !== undefined ? { top: pos.top } : {}),
          ...(pos.bottom !== undefined ? { bottom: pos.bottom } : {}),
          left: pos.left,
          width: pos.width,
          maxHeight: pos.maxHeight,
          overflowY: 'auto',
        }}
      >
        <div className={styles.comboSearch}>
          <Icon name="solar:magnifer-linear" size={13} color="var(--neutral-300)" />
          <input aria-label="Search ICD code or description"
            autoFocus
            type="text"
            placeholder="Search ICD code or description…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className={styles.comboList}>
          {list.map((r) => {
            const isCurrent = r.code === currentCode;
            return (
              <button
                key={r.code}
                type="button"
                className={[styles.comboOption, isCurrent ? styles.comboOptionActive : ''].filter(Boolean).join(' ')}
                onClick={() => onSelect(r)}
              >
                <span className={styles.comboCode}>{r.code}</span>
                <span className={styles.comboTitle}>{r.title}</span>
                {isCurrent && (
                  <span className={styles.comboCheck}><CheckIcon size={13} color="var(--primary-300)" /></span>
                )}
              </button>
            );
          })}
          {searching && !list.length && (
            <div className={styles.comboStatus}>{loading ? 'Searching…' : 'No matching ICD codes'}</div>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}

// Portaled DOS picker — one radio per document encounter, showing the date with
// its Rendering Provider + POS (Figma 4278-67296 "Select DOS" dropdown).
function DosDropdown({ anchorRef, dosList, member, selected, onSelect, onClose }) {
  const [pos, setPos] = useState(null);

  useEffect(() => {
    const compute = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.max(r.width, 280);
      const margin = 8;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Estimate menu height (header + up to ~7 rows visible) then decide
      // whether to flip above the anchor when the viewport can't fit below.
      const estHeight = Math.min(360, 40 + dosList.length * 56);
      const spaceBelow = vh - r.bottom - margin;
      const flipUp = spaceBelow < estHeight && r.top > estHeight + margin;
      const top = flipUp ? Math.max(margin, r.top - estHeight - 6) : r.bottom + 6;
      // Clamp horizontally so the menu never leaves the viewport.
      const left = Math.min(Math.max(margin, r.left), vw - width - margin);
      setPos({ top, left, width, maxHeight: flipUp ? r.top - margin - 6 : spaceBelow });
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [anchorRef, dosList.length]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!pos) return null;

  return createPortal(
    <>
      <div className={styles.dosOverlay} onClick={onClose} />
      <div className={styles.dosMenu} style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight, overflowY: 'auto' }}>
        <div className={styles.dosMenuHead}>Select DOS</div>
        {dosList.length === 0 && <div className={styles.dosEmpty}>No encounters available</div>}
        {dosList.map((d) => {
          const provider = d.provider || member?.rp || '—';
          const posCode = d.pos || d.posDesc || member?.pos || member?.posDesc || '—';
          const active = selected === d.date;
          return (
            <button
              key={d.date}
              type="button"
              className={styles.dosOption}
              onClick={() => onSelect(d.date)}
            >
              <span className={[styles.dosRadio, active ? styles.dosRadioActive : ''].filter(Boolean).join(' ')}>
                {active && <span className={styles.dosRadioDot} />}
              </span>
              <span className={styles.dosOptionText}>
                <span className={styles.dosOptionDate}>{d.date}</span>
                <span className={styles.dosOptionMeta}>Provider: {provider} · POS: {posCode}</span>
              </span>
            </button>
          );
        })}
      </div>
    </>,
    document.body,
  );
}
