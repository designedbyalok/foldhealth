import { useState } from 'react';
import { Checkbox } from '../../../../../../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { PriorityIcon } from '../../../../../../../../components/PriorityIcon/PriorityIcon';
import { Button } from '../../../../../../../../components/Button/Button';
import { ActionButton } from '../../../../../../../../components/ActionButton/ActionButton';
import { Textarea } from '../../../../../../../../components/Textarea/Textarea';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { DownChevronIcon } from '../../../../../../../../components/Icon/DownChevronIcon';
import { DatePickerPopover } from '../../../../../../../../components/DatePicker/DatePickerPopover';
import { GbiStatusButton } from '../../tables/carePlanTableShared';
import { parseLocalDate } from '../../../../../../../../lib/localDate';
import { formatGoalTarget } from '../../../../../../../settings/care-plan-library/lib/goalFormat';
import { CARE_PLAN_INTERVENTION_MENU } from '../../lib/carePlanInterventionMenu';
import styles from './CarePlanReviewDrawer.module.css';

const QUICK_TAGS = ['Patient reported', 'Education given', 'Follow-up needed', 'Barrier found'];
const KIND_LABEL = Object.fromEntries(CARE_PLAN_INTERVENTION_MENU.filter(i => i.key).map(i => [i.key, i.label]));

function fmtDate(value) {
  const d = parseLocalDate(value) || (value ? new Date(value) : null);
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
const isoDay = (value) => {
  const d = parseLocalDate(value);
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function rightMeta(kind, item) {
  if (kind === 'goal') return { text: formatGoalTarget(item), badge: item.frequency || null };
  if (kind === 'intervention') {
    const who = item.assignee?.name && item.assignee.name !== 'Unassigned' ? item.assignee.name : '';
    return { text: who, badge: null };
  }
  return { text: '', badge: null };
}

/** The few facts worth seeing mid-call, per kind. */
function Facts({ kind, item, onPickDate }) {
  const progress = Math.max(0, Math.min(100, Number(item.progress) || 0));
  if (kind === 'goal') {
    return (
      <dl className={styles.facts}>
        <div><dt>Started</dt><dd>{fmtDate(item.createdAt) || '—'}</dd></div>
        <div>
          <dt>Target date</dt>
          <dd>
            <button type="button" className={styles.dateLink} onClick={(e) => onPickDate(e.currentTarget.getBoundingClientRect())}>
              {fmtDate(item.targetDate) || 'Set date'}
            </button>
          </dd>
        </div>
        <div>
          <dt>Progress</dt>
          <dd className={styles.progressFact}>
            <span>{progress}%</span>
            <span className={styles.meter} aria-hidden="true"><span style={{ width: `${progress}%` }} /></span>
          </dd>
        </div>
      </dl>
    );
  }
  if (kind === 'intervention') {
    return (
      <dl className={styles.facts}>
        <div><dt>Type</dt><dd>{KIND_LABEL[item.kind] || '—'}</dd></div>
        <div><dt>Assigned to</dt><dd>{item.assignee?.name && item.assignee.name !== 'Unassigned' ? item.assignee.name : 'Unassigned'}</dd></div>
        <div><dt>Started</dt><dd>{fmtDate(item.createdAt) || '—'}</dd></div>
      </dl>
    );
  }
  return (
    <dl className={styles.facts}>
      <div><dt>Started</dt><dd>{fmtDate(item.createdAt) || '—'}</dd></div>
      <div><dt>Linked goals</dt><dd>{(item.goalIds?.length || (item.goalId ? 1 : 0)) || 'None'}</dd></div>
    </dl>
  );
}

/**
 * One goal / intervention / barrier in the Review care plan drawer. The row
 * is ticked when discussed and its status changes in place; clicking it
 * expands a quiet panel underneath with the key facts, the latest note and
 * a quick note with tags. "Open details" there opens the item's own drawer.
 */
export function ReviewItemRow({
  kind, item, discussed, selected, expanded, note, latestNote,
  onToggleSelected, onToggleDiscussed, onToggleExpanded, onOpen, onStatusMenu, onSaveNote, onTargetDate,
}) {
  const [text, setText] = useState('');
  const [tags, setTags] = useState(() => discussed?.tags || []);
  const [saving, setSaving] = useState(false);
  const [dateRect, setDateRect] = useState(null);
  const meta = rightMeta(kind, item);
  const toggleTag = t => setTags(prev => (prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]));
  const tagsChanged = JSON.stringify([...tags].sort()) !== JSON.stringify([...(discussed?.tags || [])].sort());
  const canSave = !saving && (text.trim() || tagsChanged);

  return (
    <div className={`${styles.item} ${expanded ? styles.itemOpen : ''} ${selected ? styles.itemSelected : ''}`}>
      <div className={styles.itemRow}>
        <Checkbox
          checked={!!selected}
          onCheckedChange={onToggleSelected}
          aria-label={`Select ${item.title}`}
        />
        <PriorityIcon priority={(item.priority || 'medium').toLowerCase()} size={14} />
        <button type="button" className={styles.itemMain} onClick={onToggleExpanded} aria-expanded={expanded}>
          <span className={`${styles.itemTitle} ${discussed ? styles.itemTitleDone : ''}`}>{item.title}</span>
          {(discussed || meta.text || meta.badge) && (
            <span className={styles.itemMeta}>
              {discussed && (
                <span className={styles.discussedMark}>
                  <Icon name="solar:check-circle-linear" size={12} color="currentColor" />
                  Discussed
                </span>
              )}
              {[meta.text, meta.badge].filter(Boolean).map((part, i) => (
                <span key={part}>
                  {(i > 0 || discussed) && <span className={styles.dot} aria-hidden="true">•</span>}
                  {part}
                </span>
              ))}
            </span>
          )}
        </button>
        {/* Fixed slots so every row's note count and status line up. */}
        <span className={styles.noteSlot}>
          {note && (
            <span
              className={`${styles.noteCount} ${note.isNew ? styles.noteCountNew : ''}`}
              title={note.isNew ? 'New note' : `${note.count} note${note.count === 1 ? '' : 's'}`}
            >
              <Icon name="solar:chat-line-linear" size={14} color="currentColor" />
              {note.count}
            </span>
          )}
        </span>
        {/* Hidden, not removed, on rows without notes so statuses still line up. */}
        <span className={`${styles.slotDivider} ${note ? '' : styles.slotDividerHidden}`} aria-hidden="true" />
        <span className={styles.statusSlot}>
          <GbiStatusButton value={item.status || 'Not Started'} onOpen={onStatusMenu} />
        </span>
        <button type="button" className={styles.chevronBtn} onClick={onToggleExpanded} aria-label={expanded ? 'Collapse' : 'Expand'}>
          <DownChevronIcon size={14} color="var(--neutral-300)" className={expanded ? styles.chevronOpen : ''} />
        </button>
      </div>

      {expanded && (
        <div className={styles.detail}>
          <Facts kind={kind} item={item} onPickDate={setDateRect} />

          {latestNote && (
            <blockquote className={styles.quote}>
              <p>{latestNote.detail}</p>
              <cite>{latestNote.actor || 'Care team'} · {fmtDate(latestNote.createdAt)}</cite>
            </blockquote>
          )}

          <div className={styles.composeBox}>
            <Textarea
              placeholder={latestNote ? 'Add to the notes' : `What did the patient say about this ${kind}?`}
              value={text}
              onChange={(v) => setText(typeof v === 'string' ? v : (v?.target?.value ?? ''))}
              rows={2}
            />
            <div className={styles.composeBar}>
              <div className={styles.tags} role="group" aria-label="Quick tags">
                {QUICK_TAGS.map(t => (
                  <button
                    key={t}
                    type="button"
                    className={`${styles.tag} ${tags.includes(t) ? styles.tagOn : ''}`}
                    aria-pressed={tags.includes(t)}
                    onClick={() => toggleTag(t)}
                  >
                    {tags.includes(t) && <Icon name="solar:check-read-linear" size={12} color="currentColor" />}
                    {t}
                  </button>
                ))}
              </div>
              <Button
                variant="primary"
                size="S"
                disabled={!canSave}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await onSaveNote(text, tags);
                    setText('');
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Save
              </Button>
            </div>
          </div>

          <div className={styles.detailLinks}>
            <button type="button" className={styles.openDetails} onClick={onToggleDiscussed}>
              <Icon name={discussed ? 'solar:undo-left-linear' : 'solar:check-read-linear'} size={12} color="currentColor" />
              {discussed ? 'Undo discussed' : 'Mark as discussed'}
            </button>
            <span className={styles.slotDivider} aria-hidden="true" />
            <button type="button" className={styles.openDetails} onClick={onOpen}>
              Open {kind} details
              <Icon name="solar:arrow-right-up-linear" size={12} color="currentColor" />
            </button>
          </div>
        </div>
      )}

      {dateRect && (
        <DatePickerPopover
          open
          value={isoDay(item.targetDate)}
          anchorRect={dateRect}
          onChange={(iso) => { onTargetDate?.(iso || ''); setDateRect(null); }}
          onClose={() => setDateRect(null)}
        />
      )}
    </div>
  );
}
