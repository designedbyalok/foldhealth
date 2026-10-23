import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon/Icon';
import { ActionButton } from '../ActionButton/ActionButton';
import { Switch } from '../Switch/Switch';
import styles from './ConsentPopover.module.css';

/**
 * Consent overview popover: one section per consent group, one row per
 * consent with its state, and an audit view of every record.
 *
 * @param {{top:number,left:number}} props.pos
 * @param {function} props.onClose
 * @param {Array<{id:string,title:string,items:Array<{id:string,label:string,
 *   status:string,icon:string,color:string,checked:boolean,onToggle?:function}>}>} props.sections
 *   `onToggle(nextChecked)` runs when a row's switch is flipped; the switch
 *   follows `checked`, so the caller decides whether the change happens.
 * @param {Array<{id:string,label:string,status:string,meta:string}>} [props.history] newest first
 * @param {boolean}  [props.loading]
 */
export function ConsentPopover({ pos, onClose, sections = [], history = [], loading = false }) {
  const ref = useRef(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const raf = requestAnimationFrame(() => document.addEventListener('mousedown', handler));
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div ref={ref} className={styles.popover} style={{ top: pos.top, left: pos.left }} role="dialog" aria-label="Patient consent">
      <div className={styles.header}>
        <span className={styles.headerTitle}>{showHistory ? 'Consent Audit Log' : 'Patient Consent'}</span>
        <ActionButton
          icon={showHistory ? 'solar:arrow-left-linear' : 'solar:history-linear'}
          size="S"
          tooltip={showHistory ? 'Back' : 'Audit Log'}
          tooltipBelow
          onClick={() => setShowHistory(v => !v)}
        />
      </div>

      <div className={styles.body}>
        {loading && <span className={styles.empty}>Loading consent…</span>}
        {!loading && showHistory && (history.length ? history.map(h => (
          <div key={h.id} className={styles.row}>
            <div className={styles.rowText}>
              <span className={styles.rowLabel}>{h.label} · {h.status}</span>
              <span className={styles.rowStatus}>{h.meta}</span>
            </div>
          </div>
        )) : <span className={styles.empty}>No consent has been recorded yet.</span>)}
        {!loading && !showHistory && sections.flatMap((section, si) => {
          const parts = [];
          if (si > 0) parts.push(<div key={`div-${section.id}`} className={styles.divider} />);
          parts.push(
            <div key={section.id} className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>{section.title}</span>
              </div>
              {section.items.map(item => (
                <div key={item.id} className={styles.row}>
                  <div className={styles.rowCheck}>
                    <Icon name={item.icon} size={16} color={item.color} />
                  </div>
                  <div className={styles.rowText}>
                    <span className={styles.rowLabel}>{item.label}</span>
                    <span className={styles.rowStatus}>{item.status}</span>
                  </div>
                  <Switch checked={!!item.checked} onChange={() => item.onToggle?.(!item.checked)} ariaLabel={item.label} />
                </div>
              ))}
            </div>
          );
          return parts;
        })}
      </div>
    </div>,
    document.body
  );
}
