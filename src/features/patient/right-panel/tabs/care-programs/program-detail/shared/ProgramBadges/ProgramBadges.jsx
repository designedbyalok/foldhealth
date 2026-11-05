import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ProgramStatusRing } from '../ProgramStatusRing/ProgramStatusRing.jsx';
import { statusColorFor } from '../../../../../../data/programStatus';
import styles from './ProgramBadges.module.css';

// How many program badges show before the rest collapse into a "+N" chip.
const MAX_VISIBLE = 2;

// Hover-card body for one program: ring + code + status, then start/owner.
// Figma 1837-16264. The title row opens the program when `onSelect` is set.
function ProgramDetail({ program, progressFor, onSelect }) {
  const unassigned = !program.assignee || program.assignee === 'Unassigned';
  const head = (
    <>
      <ProgramStatusRing progress={progressFor(program.code)} size={16} />
      <span className={styles.detailCode}>{program.code}</span>
      <span className={styles.detailStatus} style={{ color: statusColorFor(program.status) }}>
        {program.status}
      </span>
    </>
  );
  return (
    <div className={styles.detail}>
      {onSelect ? (
        <button type="button" className={`${styles.detailHead} ${styles.detailHeadBtn}`} onClick={() => onSelect(program)}>
          {head}
        </button>
      ) : (
        <div className={styles.detailHead}>{head}</div>
      )}
      {program.subProgram && (
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Sub-program:</span> {program.subProgram}
        </div>
      )}
      <div className={styles.detailRow}>
        <span className={styles.detailLabel}>Start Date:</span> {program.startDate || '-'}
      </div>
      <div className={styles.detailRow}>
        <span className={styles.detailLabel}>Assigned to:</span> {unassigned ? 'Unassigned' : program.assignee}
      </div>
    </div>
  );
}

/**
 * Row of the patient's other active-program badges (Figma 1837-16118), shown in
 * the program-detail header in place of the old prev/next arrows. Hovering a
 * badge reveals that program's details; hovering the "+N" chip lists the
 * remaining programs' details. With `onSelect`, clicking a badge or a
 * program's title in the card switches to that program.
 */
export function ProgramBadges({ programs, progressFor, onSelect }) {
  const [hover, setHover] = useState(null); // { rect, items } | null
  const timer = useRef(null);
  const stripRef = useRef(null);
  const popoverRef = useRef(null);

  // Opened by click (keyboard, touch): Escape or a click elsewhere closes it.
  useEffect(() => {
    if (!hover) return undefined;
    const onDown = (e) => {
      if (!stripRef.current?.contains(e.target) && !popoverRef.current?.contains(e.target)) setHover(null);
    };
    const onKey = (e) => { if (e.key === 'Escape') setHover(null); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [hover]);

  if (!programs.length) return null;
  const visible = programs.slice(0, MAX_VISIBLE);
  const overflow = programs.slice(MAX_VISIBLE);

  const open = (e, items) => {
    clearTimeout(timer.current);
    setHover({ rect: e.currentTarget.getBoundingClientRect(), items });
  };
  const scheduleClose = () => { timer.current = setTimeout(() => setHover(null), 120); };
  const cancelClose = () => clearTimeout(timer.current);
  const select = (p) => { clearTimeout(timer.current); setHover(null); onSelect(p); };

  return (
    <div className={styles.strip} ref={stripRef}>
      {visible.map(p => (
        <button
          key={p.id}
          type="button"
          className={[styles.badge, onSelect ? styles.clickable : ''].filter(Boolean).join(' ')}
          aria-label={onSelect ? `Open ${p.subProgram ? `${p.subProgram} (${p.code})` : p.code} program` : undefined}
          onClick={onSelect ? () => select(p) : undefined}
          onMouseEnter={e => open(e, [p])}
          onMouseLeave={scheduleClose}
        >
          <ProgramStatusRing progress={progressFor(p.code)} size={14} />
          <span className={styles.badgeCode}>{p.code}</span>
          {/* CMP can run several sub-programs at once; the code alone can't tell them apart. */}
          {p.subProgram && <span className={styles.badgeSub}>{p.subProgram}</span>}
        </button>
      ))}
      {overflow.length > 0 && (
        <button
          type="button"
          className={[styles.badgeMore, onSelect ? styles.clickable : ''].filter(Boolean).join(' ')}
          aria-label={`${overflow.length} more program${overflow.length === 1 ? '' : 's'}`}
          // Click (keyboard, touch) opens the same list a hover does.
          onClick={e => open(e, overflow)}
          onMouseEnter={e => open(e, overflow)}
          onMouseLeave={scheduleClose}
        >
          +{overflow.length}
        </button>
      )}
      {hover && createPortal(
        <div
          ref={popoverRef}
          className={styles.popover}
          style={{ top: hover.rect.bottom + 6, left: Math.min(hover.rect.left, window.innerWidth - 260) }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          {hover.items.map(p => <ProgramDetail key={p.id} program={p} progressFor={progressFor} onSelect={onSelect ? select : undefined} />)}
        </div>,
        document.body,
      )}
    </div>
  );
}
