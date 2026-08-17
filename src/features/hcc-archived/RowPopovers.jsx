import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon/Icon';
import { getRafBreakdown } from './data/raf';
import { getChartDocs } from './data/chartDocs';
import styles from './RowPopovers.module.css';

// ── Generic hover-popup helpers ───────────────────────────────────────────
//
// Hover-driven popovers need a "bridge" between the trigger and the popover
// so the pointer doesn't lose hover when moving onto the floating content.
// usePopoverHover returns trigger handlers + a stable open/close pair that
// can be reused across RafTooltip and OpenICDsPopover.

function usePopoverHover(delayOpen = 200, delayClose = 200) {
  const openTimer = useRef(null);
  const closeTimer = useRef(null);
  const [open, setOpen] = useState(false);

  const onTriggerEnter = (cb) => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    if (open) return;
    openTimer.current = setTimeout(() => { cb?.(); setOpen(true); }, delayOpen);
  };
  const onTriggerLeave = () => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    closeTimer.current = setTimeout(() => setOpen(false), delayClose);
  };
  const cancelClose = () => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; } };
  const requestClose = () => { closeTimer.current = setTimeout(() => setOpen(false), delayClose); };

  useEffect(() => () => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
  }, []);

  return { open, setOpen, onTriggerEnter, onTriggerLeave, cancelClose, requestClose };
}

// ── RafTooltip — hover popup over RAF Score / Impact cells ────────────────

/**
 * Renders a small invisible "hover bridge" between the trigger and the
 * tooltip so the pointer can travel without dropping hover state.
 */
export function RafTooltip({ memberName, children }) {
  const triggerRef = useRef(null);
  const [pos, setPos] = useState(null);
  const { open, setOpen, onTriggerEnter, onTriggerLeave, cancelClose, requestClose } = usePopoverHover();

  const recordRect = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPos(rect);
  };

  return (
    <>
      <span
        ref={triggerRef}
        className={styles.rafTrigger}
        onMouseEnter={() => onTriggerEnter(recordRect)}
        onMouseLeave={onTriggerLeave}
      >
        {children}
      </span>
      {open && pos && <RafTooltipPopup memberName={memberName} rect={pos} onEnter={cancelClose} onLeave={requestClose} />}
    </>
  );
}

function RafTooltipPopup({ memberName, rect, onEnter, onLeave }) {
  const items = getRafBreakdown(memberName);
  const total = items.reduce((s, x) => s + x.impact, 0);
  const W = 272;
  const left = Math.min(rect.left, window.innerWidth - W - 8);
  const top = rect.bottom + 8;
  return createPortal(
    <>
      {/* Bridge: keeps hover alive over the gap between trigger and tooltip */}
      <div
        className={styles.bridge}
        style={{ top: rect.bottom, left: rect.left, width: rect.width, height: 8 }}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      />
      <div
        className={styles.rafTooltip}
        style={{ top, left, width: W }}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        <div className={styles.rafTooltipHeader}>RAF Impact Breakdown</div>
        <div className={styles.rafTooltipList}>
          {items.map((x, i) => (
            <div key={i} className={styles.rafTooltipRow}>
              <div className={styles.rafTooltipRowText}>
                <div className={styles.rafTooltipHcc}>{x.hcc}</div>
                <div className={styles.rafTooltipName}>{x.name}</div>
              </div>
              <span className={styles.rafTooltipImpact}>+{x.impact.toFixed(3)}</span>
            </div>
          ))}
        </div>
        <div className={styles.rafTooltipFooter}>
          <span>Total RAF Impact</span>
          <strong>+{total.toFixed(3)}</strong>
        </div>
      </div>
    </>,
    document.body,
  );
}

// ── VisitsPopover — click-anchored list of all DOS for a member ───────────

export function VisitsPopover({ anchorRect, name, visits, onClose, onSelect }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!anchorRect) return null;
  const W = 280;
  const top = Math.min(anchorRect.bottom + 6, window.innerHeight - 240);
  const left = Math.min(anchorRect.left, window.innerWidth - W - 8);

  return createPortal(
    <>
      <div aria-hidden="true" className={styles.overlay} onClick={onClose} />
      <div
        className={styles.popover}
        style={{ top, left, width: W }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`All DOS for ${name}`}
      >
        <div className={styles.header}>
          <span>All DOS of <strong>{name}</strong></span>
        </div>
        <div className={styles.visitList}>
          {visits?.length ? visits.map((v, i) => (
            <button
              key={i}
              type="button"
              className={styles.visitRow}
              onClick={() => { onSelect?.(v); onClose?.(); }}
            >
              <div className={styles.visitIcon}>
                <Icon name="solar:calendar-linear" size={13} color="var(--neutral-300)" />
              </div>
              <div className={styles.visitText}>
                <div className={styles.visitDate}>{v.date}</div>
                <div className={styles.visitLabel} style={{ color: v.labelColor || 'var(--neutral-300)' }}>{v.label}</div>
              </div>
              <Icon name="solar:arrow-right-linear" size={12} color="var(--primary-200)" />
            </button>
          )) : (
            <div className={styles.empty}>No visits recorded</div>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}

// ── ChartPopover — click-anchored list of chart documents ─────────────────

const DOC_STATUS_STYLE = {
  Pending: { color: 'var(--neutral-300)', bg: 'var(--neutral-50)',         border: 'var(--neutral-150)',          icon: 'solar:clock-circle-linear' },
  Passed:  { color: 'var(--status-success)', bg: 'var(--status-success-light)', border: 'rgba(0,155,83,0.2)',     icon: 'solar:check-circle-linear' },
  Failed:  { color: 'var(--status-error)',   bg: 'var(--status-error-light)',   border: 'rgba(215,40,37,0.2)',   icon: 'solar:info-circle-linear' },
};

export function ChartPopover({ anchorRect, member, onClose, onUpload }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!anchorRect) return null;
  const allDocs = getChartDocs(member);
  const SHOW = 3;
  const visible = allDocs.slice(0, SHOW);
  const more = allDocs.length - SHOW;
  const passedN = allDocs.filter(d => d.status === 'Passed').length;
  const allPassed = passedN === allDocs.length && allDocs.length > 0;
  const allPending = allDocs.every(d => d.status === 'Pending');
  const overallLabel = allDocs.length === 0
    ? 'No Charts'
    : allPassed ? 'All Passed'
    : allPending ? 'All Pending'
    : `${passedN} Passed`;
  const overallColor = allPassed
    ? 'var(--status-success)'
    : allPending ? 'var(--neutral-300)' : 'var(--status-warning)';

  const W = 308;
  const left = Math.min(Math.max(8, anchorRect.left - 20), window.innerWidth - W - 8);
  const top = anchorRect.bottom + 8;

  return createPortal(
    <>
      <div aria-hidden="true" className={styles.overlay} onClick={onClose} />
      <div
        className={styles.chartPopover}
        style={{ top, left, width: W }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Document Available"
      >
        <div className={styles.chartHeader}>
          <span className={styles.chartHeaderLabel}>Document Available:</span>
          <span className={styles.chartHeaderStatus}>
            <span className={styles.chartHeaderDot} style={{ background: overallColor }} />
            <span style={{ color: overallColor }}>{overallLabel}</span>
          </span>
        </div>
        <div className={styles.chartUpload}>
          <button
            type="button"
            className={styles.chartUploadBtn}
            onClick={() => { onClose?.(); onUpload?.(); }}
          >
            <Icon name="solar:upload-minimalistic-linear" size={13} color="var(--primary-300)" />
            <span>Upload New Chart</span>
          </button>
        </div>
        <div className={styles.chartList}>
          {visible.length === 0 && (
            <div className={styles.empty}>No documents on chart</div>
          )}
          {visible.map((d, i) => {
            const st = DOC_STATUS_STYLE[d.status] || DOC_STATUS_STYLE.Pending;
            return (
              <div key={i} className={styles.chartRow}>
                <div className={styles.chartRowText}>
                  <div className={styles.chartName}>
                    <span>{d.n}</span>
                    <Icon name="solar:alt-arrow-right-linear" size={11} color="var(--neutral-300)" />
                  </div>
                  <div className={styles.chartMeta}>{d.meta}</div>
                </div>
                <span
                  className={styles.chartStatus}
                  style={{ color: st.color, background: st.bg, borderColor: st.border }}
                >
                  <Icon name={st.icon} size={11} color={st.color} />
                  <span>{d.status}</span>
                </span>
              </div>
            );
          })}
        </div>
        {more > 0 && (
          <button type="button" className={styles.chartMoreBtn}>
            <span>View More {more}</span>
            <Icon name="solar:alt-arrow-right-linear" size={11} color="var(--primary-300)" />
          </button>
        )}
      </div>
    </>,
    document.body,
  );
}

// ── ActionsMenuPopover — right-aligned action list off the row "..." ──────

const ACTION_ITEMS = [
  { icon: 'solar:phone-linear',                label: 'Make a Call',     trail: true  },
  { icon: 'solar:chat-round-linear',           label: 'Chat',            trail: false },
  { icon: 'solar:chat-square-linear',          label: 'SMS',             trail: false },
  { icon: 'solar:videocamera-linear',          label: 'Video meet',      trail: false },
  { icon: 'solar:letter-linear',               label: 'Send Email',      trail: true  },
  { icon: 'solar:add-square-linear',           label: 'Add Task',        trail: false },
  { icon: 'solar:bolt-linear',                 label: 'Run Automation',  trail: false },
  { icon: 'solar:pen-linear',                  label: 'Edit Details',    trail: false },
  { icon: 'solar:chat-round-unread-linear',    label: 'Comms Preference',trail: false },
];

export function ActionsMenuPopover({ anchorRect, onClose, onAction }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!anchorRect) return null;
  const W = 200;
  const top = Math.min(anchorRect.bottom + 4, window.innerHeight - 380);
  const right = Math.max(8, window.innerWidth - anchorRect.right);

  return createPortal(
    <>
      <div aria-hidden="true" className={styles.overlay} onClick={onClose} />
      <div
        className={styles.actionsMenu}
        style={{ top, right, width: W }}
        onClick={(e) => e.stopPropagation()}
        role="menu"
        aria-label="Member actions"
      >
        {ACTION_ITEMS.map((item) => (
          <button
            key={item.label}
            type="button"
            className={styles.actionRow}
            onClick={() => { onAction?.(item.label); onClose?.(); }}
          >
            <Icon name={item.icon} size={16} color="var(--neutral-400)" />
            <span className={styles.actionLabel}>{item.label}</span>
            {item.trail && (
              <Icon name="solar:alt-arrow-right-linear" size={10} color="var(--neutral-300)" />
            )}
          </button>
        ))}
      </div>
    </>,
    document.body,
  );
}

// ── OpenIcdsHoverPopover — list ICDs, click to open DiagPanel ─────────────

function isAISuggestedIcd(i) {
  return ['Suspect', 'Recapture'].includes(i.type || '');
}

function hccShortLabel(h) {
  return h?.split(' - ')[0]?.trim() || h;
}

export function OpenIcdsHoverPopover({
  anchorRect,
  member,
  icds,        // ICDs from getICDs(member.name)
  notLinked,   // ICDs from getNotLinked(member.name)
  onIcdClick,  // (code: string) => void
  onEnter,
  onLeave,
}) {
  if (!anchorRect) return null;
  const open = (icds || []).filter(i => i.status !== 'Dismissed' && i.status !== 'Accepted');
  const linked = open.filter(i => !isAISuggestedIcd(i));
  const notLinkedClean = [
    ...open.filter(i => isAISuggestedIcd(i)),
    ...(notLinked || []).filter(i => i.status !== 'Dismissed' && i.status !== 'Accepted'),
  ];
  const all = [...linked, ...notLinkedClean];
  const dos = member?.dos_list?.[0]?.date || member?.dos || null;

  const W = 296;
  const left = Math.min(anchorRect.left, window.innerWidth - W - 8);
  const top = anchorRect.bottom + 8;

  return createPortal(
    <>
      <div
        className={styles.bridge}
        style={{ top: anchorRect.bottom, left: anchorRect.left, width: anchorRect.width, height: 8 }}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      />
      <div
        className={styles.openIcdsPopover}
        style={{ top, left, width: W }}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        {all.length === 0 && <div className={styles.empty}>No open ICDs</div>}
        {linked.length > 0 && (
          <>
            <div className={styles.openIcdsSection}>
              <span>Open ICD's (DOS: {dos || '—'}):</span>
            </div>
            {linked.map((icd, i) => (
              <IcdHoverRow key={`l${i}`} icd={icd} hccShort={hccShortLabel} onClick={() => onIcdClick?.(icd.code)} />
            ))}
          </>
        )}
        {notLinkedClean.length > 0 && (
          <>
            <div className={styles.openIcdsSection}>
              <span>Open ICD's (No DOS Linked):</span>
            </div>
            {notLinkedClean.map((icd, i) => (
              <IcdHoverRow key={`n${i}`} icd={icd} hccShort={hccShortLabel} onClick={() => onIcdClick?.(icd.code)} />
            ))}
          </>
        )}
      </div>
    </>,
    document.body,
  );
}

// Row shape (per Figma node 11864:523333):
//   <strong>E11.22</strong> - Type 2 Diabetes Mellitus with Diabeti…
//   [ HCC18 ]
// No status badge, no count metadata, no chevron — just code + description
// on the top line and the HCC code in a small chip beneath.
function IcdHoverRow({ icd, hccShort, onClick }) {
  return (
    <button type="button" className={styles.icdRow} onClick={onClick}>
      <div className={styles.icdRowText}>
        <div className={styles.icdRowDesc}>
          <strong>{icd.code}</strong>
          {' - '}
          <span>{icd.desc}</span>
        </div>
        {icd.hcc && (
          <span className={styles.icdHccChip}>{hccShort(icd.hcc)}</span>
        )}
      </div>
    </button>
  );
}
