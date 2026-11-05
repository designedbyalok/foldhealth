import { useState } from 'react';
import { MetaLine, ViewMoreButton } from '../../../components/ActivityLog/ActivityLog';
import { Badge } from '../../../components/Badge/Badge';
import styles from './PharmacyBarrierLog.module.css';

const plural = (n, word) => (n === 1 ? word : `${word}s`);

// "Barrier & Intervention added", "Barrier resolved", "Intervention done"…
function lineTitle(line) {
  if (line.completed) return line.completed.outcome === 'Done' ? 'Intervention done' : "Intervention didn't work";
  if (line.resolvedList) return `${plural(line.resolvedList.length, 'Barrier')} resolved`;
  const { addB, addI, remB, remI } = line;
  if (addB.length && addI.length) return 'Barrier & Intervention added';
  if (addB.length) return `${plural(addB.length, 'Barrier')} added`;
  if (addI.length) return `${plural(addI.length, 'Intervention')} added`;
  if (remB.length && remI.length) return 'Barrier & Intervention removed';
  if (remB.length) return `${plural(remB.length, 'Barrier')} removed`;
  if (remI.length) return `${plural(remI.length, 'Intervention')} removed`;
  return 'Barriers & interventions confirmed';
}

const Row = ({ label, children }) => (
  <>
    <span className={styles.entryLabel}>{label}</span>
    <span className={styles.chips}>{children}</span>
  </>
);

// One History entry: when, who, how and which gap, then what happened for
// which drug (or all of the gap's drugs) • View Details, which opens a card of
// what changed (label on the left, badges on the right) and the note.
export function EntryBody({ entry }) {
  const { line } = entry;
  const [open, setOpen] = useState(false);
  const changed = line.addB?.length || line.addI?.length || line.remB?.length || line.remI?.length;
  return (
    <>
      <MetaLine entry={entry} />
      <span className={styles.entryTitleRow}>
        <span className={styles.entryTitle}>{lineTitle(line)} for {line.target}</span>
        <ViewMoreButton expanded={open} onToggle={() => setOpen(v => !v)} label="View Details" leadingDot />
      </span>
      {open && (
      <div className={styles.entryCard}>
      <div className={styles.current}>
        {line.completed && (
          <Row label="Intervention">
            {line.completed.outcome === 'Done'
              ? <Badge size="sm" tone="success" icon="solar:check-circle-linear" label={line.completed.intervention} />
              : <Badge size="sm" tone="danger" icon="solar:close-circle-linear" label={line.completed.intervention} />}
          </Row>
        )}
        {line.resolvedList && (
          <Row label={line.completed ? 'Resolved' : 'Barrier'}>
            {line.resolvedList.map(v => <Badge key={v} size="sm" tone="success" icon="solar:check-circle-linear" label={v} />)}
          </Row>
        )}
        {!line.completed && !line.resolvedList && (changed ? <>
          {line.addB.length > 0 && <Row label="Barrier">{line.addB.map(v => <Badge key={v} size="sm" tone="danger" label={v} />)}</Row>}
          {line.addI.length > 0 && <Row label="Intervention">{line.addI.map(v => <Badge key={v} size="sm" label={v} />)}</Row>}
          {(line.remB.length > 0 || line.remI.length > 0) && (
            <Row label="Removed">{[...line.remB, ...line.remI].map(v => <Badge key={v} size="sm" label={v} className={styles.struck} />)}</Row>
          )}
        </> : <>
          {line.rec.barriers.length > 0 && <Row label="Barrier">{line.rec.barriers.map(v => <Badge key={v} size="sm" tone="danger" label={v} />)}</Row>}
          {line.rec.interventions.length > 0 && <Row label="Intervention">{line.rec.interventions.map(v => <Badge key={v} size="sm" label={v} />)}</Row>}
        </>)}
      </div>
      {entry.note && <span className={styles.entryNote}>{entry.note}</span>}
      </div>
      )}
    </>
  );
}
