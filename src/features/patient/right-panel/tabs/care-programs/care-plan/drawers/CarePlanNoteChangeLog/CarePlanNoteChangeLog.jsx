import { useMemo } from 'react';
import { ActivityLog } from '../../../../../../../../components/ActivityLog/ActivityLog';
import styles from './CarePlanNoteChangeLog.module.css';

/**
 * "Change log" under a note editor: every note ever added to the item, newest
 * first. Same shape as the plan-level Care Note drawer so an item note and
 * the plan note read the same way.
 */
export function CarePlanNoteChangeLog({ notes }) {
  const entries = useMemo(() => (notes || []).map(a => {
    const created = a.createdAt ? new Date(a.createdAt) : null;
    return {
      id: a.id,
      t: 'comment',
      date: created ? created.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
      time: created ? created.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null,
      by: a.actor || 'Unknown',
      title: 'Added a Note',
      commentBody: a.detail || '',
    };
  }), [notes]);

  if (entries.length === 0) return null;
  return (
    <div className={styles.changeLog}>
      <span className={styles.label}>Change log</span>
      <ActivityLog entries={entries} hideCommentTitle />
    </div>
  );
}
