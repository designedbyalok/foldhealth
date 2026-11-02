import { useState } from 'react';
import { Popover } from '@/components/Popover/Popover';
import { Textarea } from '@/components/Textarea/Textarea';
import { Button } from '@/components/Button/Button';
import { Badge } from '@/components/Badge/Badge';
import { latestItemNote } from '../lib/carePlanNotes';
import styles from './QuickNotePopover.module.css';

const NOUN = { goal: 'Goal', intervention: 'Intervention', barrier: 'Barrier' };
// Same quick tags as the Review care plan drawer's item notes.
const QUICK_TAGS = ['Patient reported', 'Education given', 'Follow-up needed', 'Barrier found'];

const stamp = iso => (iso
  ? new Date(iso).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  : '');

/**
 * A quick note on a goal, intervention or barrier (#18), right from its row:
 * the latest note, a box for a new one and the quick tags. Notes are live
 * audit rows outside the signed snapshot, so saving one never starts a new
 * plan version. "Open Notes" goes to the item's drawer for the full history.
 */
export function QuickNotePopover({ kind, item, rect, audit, onSave, onOpenFull, onClose }) {
  const [text, setText] = useState('');
  const [tags, setTags] = useState([]);
  const [saving, setSaving] = useState(false);
  const latest = latestItemNote(audit, [item.id, ...(item.cloneIds || [])], kind);
  const body = [tags.length ? `${tags.join(', ')}.` : '', text.trim()].filter(Boolean).join(' ');

  const save = async () => {
    if (!body) return;
    setSaving(true);
    try { await onSave(body); } finally { setSaving(false); }
  };
  const toggleTag = t => setTags(list => (list.includes(t) ? list.filter(x => x !== t) : [...list, t]));

  return (
    <Popover anchor={rect} onOpenChange={o => !o && onClose()} placement="bottom-end" width={340}>
      <div className={styles.popover}>
        <div className={styles.head}>
          <span className={styles.title}>Quick note</span>
          <span className={styles.subject}>{NOUN[kind]}: {item.title}</span>
        </div>
        {latest && (
          <div className={styles.latest}>
            <p className={styles.latestBody}>{latest.detail}</p>
            <span className={styles.meta}>{latest.actor || 'Unknown'} • {stamp(latest.createdAt)}</span>
          </div>
        )}
        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={latest ? 'Add a newer note…' : 'Add a note…'}
          rows={3}
          autoFocus
          aria-label="Quick note"
        />
        <div className={styles.tags} aria-label="Quick tags">
          {QUICK_TAGS.map(t => (
            <button key={t} type="button" className={styles.tag} onClick={() => toggleTag(t)} aria-pressed={tags.includes(t)}>
              <Badge size="S" tone={tags.includes(t) ? 'primary' : 'white'} label={t} />
            </button>
          ))}
        </div>
        <span className={styles.hint}>Saved as a live note. It doesn&apos;t change the signed version.</span>
        <div className={styles.actions}>
          <Button variant="ghost" size="sm" onClick={onOpenFull}>Open Notes</Button>
          <span className={styles.spacer} />
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!body || saving} onClick={save}>{saving ? 'Saving…' : 'Save Note'}</Button>
        </div>
      </div>
    </Popover>
  );
}
