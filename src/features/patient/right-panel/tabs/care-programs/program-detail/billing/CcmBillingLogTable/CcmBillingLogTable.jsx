import { useMemo, useState } from 'react';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { Badge } from '../../../../../../../../components/Badge/Badge';
import { Avatar } from '../../../../../../../../components/Avatar/Avatar';
import { Button } from '../../../../../../../../components/Button/Button';
import { ActionButton } from '../../../../../../../../components/ActionButton/ActionButton';
import { Select } from '../../../../../../../../components/Select/Select';
import { Textarea } from '../../../../../../../../components/Textarea/Textarea';
import { DownChevronIcon } from '../../../../../../../../components/Icon/DownChevronIcon';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import { CCM_ACTIVITY_TYPES, secondsToTime, timeToSeconds } from '../../../../../../data/ccmBillingMock';
import styles from './CcmBillingLogTable.module.css';

const CATEGORY_OPTIONS = CCM_ACTIVITY_TYPES.map(t => ({ value: t, label: t }));

const DATE_OPTIONS = [
  '08/04/2026', '08/01/2026', '11/07/2026', '11/10/2026', '10/07/2026',
  '09/07/2026', '08/07/2026', '07/07/2026', '06/07/2026',
].map(d => ({ value: d, label: d }));

const USER_OPTIONS = [
  { value: 'RF', label: 'Robert Fox', initials: 'RF' },
  { value: 'DC', label: 'Delores Conn', initials: 'DC' },
];

const DEFAULT_UNLOGGED_ROWS = () => [
  {
    id: 'ul-1',
    kind: 'unlogged',
    program: 'CCM',
    activityType: '',
    date: '08/04/2026',
    durationInput: '04:30',
    userId: 'RF',
    included: null,
    description: '',
  },
];

const randomId = () => `log-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`;

const parseDuration = (str) => {
  if (!str) return 0;
  if (/^\d+$/.test(str)) return Number(str) * 60;
  return timeToSeconds(str);
};

const formatActivityDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

function InclusionToggle({ value, onChange }) {
  return (
    <div className={styles.inclusionToggle} role="group" aria-label="Bill inclusion">
      <button
        type="button"
        className={[
          styles.inclusionSeg,
          value === false ? styles.inclusionSegExcluded : '',
        ].filter(Boolean).join(' ')}
        aria-pressed={value === false}
        aria-label="Exclude from billing"
        onClick={() => onChange(value === false ? null : false)}
      >
        <Icon name="solar:close-circle-linear" size={14} />
      </button>
      <button
        type="button"
        className={[
          styles.inclusionSeg,
          value === true ? styles.inclusionSegIncluded : value == null ? styles.inclusionSegPending : '',
        ].filter(Boolean).join(' ')}
        aria-pressed={value === true}
        aria-label="Include in billing"
        onClick={() => onChange(value === true ? null : true)}
      >
        <Icon name="solar:check-circle-linear" size={14} />
      </button>
    </div>
  );
}

function LogTableRow({
  row,
  warning,
  noteOpen,
  noteDraft,
  onNoteDraftChange,
  onToggleNote,
  onSaveNote,
  onCancelNote,
  onPatch,
  onDelete,
}) {
  const user = USER_OPTIONS.find(u => u.value === row.userId) || USER_OPTIONS[0];
  const noteCount = row.description?.trim() ? 1 : 0;

  return (
    <>
      <div className={[styles.tableGrid, styles.dataRow, warning ? styles.dataRowWarning : ''].filter(Boolean).join(' ')}>
        <div className={[styles.cell, warning ? styles.cellProgramWarning : ''].filter(Boolean).join(' ')}>
          <button type="button" className={styles.badgeTrigger} aria-label="Program">
            <Badge tone="primary" size="S" label={row.program} trailingIconElement={<DownChevronIcon size={13} color="currentColor" />} />
          </button>
        </div>

        <div className={styles.cell}>
          <Select
            className={styles.selectCompact}
            options={CATEGORY_OPTIONS}
            value={row.activityType}
            onChange={(v) => onPatch({ activityType: v })}
            placeholder="Select"
          />
        </div>

        <div className={styles.cell}>
          <Select
            className={styles.selectCompact}
            options={DATE_OPTIONS}
            value={row.date}
            onChange={(v) => onPatch({ date: v })}
          />
        </div>

        <div className={styles.cell}>
          <div className={styles.durationField}>
            <input
              className={styles.durationInput}
              value={row.durationInput}
              onChange={(e) => onPatch({ durationInput: e.target.value })}
              aria-label="Logged duration"
            />
            <span className={styles.durationSuffix}>Min</span>
          </div>
        </div>

        <div className={styles.cell}>
          <button type="button" className={styles.userPicker} aria-label={`Logged by ${user.label}`}>
            <Avatar variant="staff" initials={user.initials} size="XS" />
            <span className={styles.userPickerChevron} aria-hidden>
              <DownChevronIcon size={8} color="var(--neutral-300)" />
            </span>
          </button>
        </div>

        <div className={styles.cell}>
          <InclusionToggle
            value={row.included}
            onChange={(included) => onPatch({ included })}
          />
        </div>

        <div className={styles.cell}>
          <div className={styles.actions}>
            <ActionButton
              icon="solar:document-text-linear"
              size="S"
              tooltip="Add Note"
              count={noteCount > 0 ? String(noteCount) : undefined}
              active={noteOpen}
              onClick={onToggleNote}
            />
            <span className={styles.actionDivider} aria-hidden />
            <ActionButton
              icon="solar:trash-bin-trash-linear"
              size="S"
              tooltip="Delete"
              onClick={onDelete}
            />
          </div>
        </div>
      </div>

      {noteOpen && (
        <div className={styles.notePanel}>
          <Textarea
            rows={5}
            value={noteDraft}
            onChange={(e) => onNoteDraftChange(e.target.value)}
            placeholder="Add a note for this activity…"
          />
          <div className={styles.noteActions}>
            <Button variant="primary" size="S" onClick={onSaveNote}>Save</Button>
            <Button variant="secondary" size="S" onClick={onCancelNote}>Cancel</Button>
          </div>
        </div>
      )}
    </>
  );
}

const EMPTY_ACTIVITIES = [];

export function CcmBillingLogTable({ patientId, periodId, activities = EMPTY_ACTIVITIES }) {
  const addCcmBillableActivity = useAppStore(s => s.addCcmBillableActivity);

  const [unloggedRows, setUnloggedRows] = useState(DEFAULT_UNLOGGED_ROWS);
  const [billableOverrides, setBillableOverrides] = useState({});
  const [expandedNoteId, setExpandedNoteId] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');

  const billableRows = useMemo(() => activities.map((activity) => {
    const override = billableOverrides[activity.id] || {};
    return {
      id: activity.id,
      kind: 'billable',
      program: 'CCM',
      activityType: override.activityType ?? activity.activityType,
      date: override.date ?? formatActivityDate(activity.occurredAt),
      durationInput: override.durationInput ?? secondsToTime(activity.durationSeconds),
      userId: override.userId ?? (activity.loggedByInitials || 'DC'),
      included: override.included ?? true,
      description: override.description ?? activity.description ?? '',
      source: activity,
    };
  }), [activities, billableOverrides]);

  const rows = useMemo(
    () => [...unloggedRows, ...billableRows],
    [unloggedRows, billableRows],
  );

  const patchRow = (id, patch) => {
    if (id.startsWith('ul-')) {
      setUnloggedRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
      return;
    }
    setBillableOverrides(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), ...patch },
    }));
  };

  const deleteRow = async (row) => {
    if (row.kind === 'unlogged') {
      setUnloggedRows(prev => prev.filter(r => r.id !== row.id));
      return;
    }
    setBillableOverrides(prev => {
      const next = { ...prev };
      delete next[row.id];
      return next;
    });
  };

  const openNote = (row) => {
    setExpandedNoteId(row.id);
    setNoteDraft(row.description || '');
  };

  const saveNote = async (row) => {
    patchRow(row.id, { description: noteDraft });
    if (row.kind === 'unlogged' && row.activityType && row.included === true && periodId) {
      await addCcmBillableActivity({
        id: randomId(),
        periodId,
        patientId,
        activityType: row.activityType,
        description: noteDraft || `Classified from unlogged time (${row.date})`,
        durationSeconds: parseDuration(row.durationInput),
        loggedBy: USER_OPTIONS.find(u => u.value === row.userId)?.label || 'You',
        loggedByInitials: row.userId || 'Y',
        occurredAt: new Date().toISOString(),
        isUnlogged: true,
      });
      setUnloggedRows(prev => prev.filter(r => r.id !== row.id));
    }
    setExpandedNoteId(null);
    setNoteDraft('');
  };

  if (rows.length === 0) {
    return (
      <div className={styles.tableCard}>
        <div className={styles.empty}>
          <Icon name="solar:clipboard-list-linear" size={36} color="var(--neutral-200)" />
          <span>No billable activities yet. Start the timer to log time.</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.tableCard}>
      <div className={[styles.tableGrid, styles.headerRow].join(' ')}>
        <div className={styles.headerCell}>Program</div>
        <div className={styles.headerCell}>Activity Type</div>
        <div className={styles.headerCell}>Date</div>
        <div className={styles.headerCell}>Logged Time</div>
        <div className={styles.headerCell}>User</div>
        <div className={styles.headerCell}>Inclusion</div>
        <div className={styles.headerCell}>Actions</div>
      </div>

      {rows.map((row) => (
        <LogTableRow
          key={row.id}
          row={row}
          warning={row.kind === 'unlogged'}
          noteOpen={expandedNoteId === row.id}
          noteDraft={noteDraft}
          onNoteDraftChange={setNoteDraft}
          onToggleNote={() => {
            if (expandedNoteId === row.id) {
              setExpandedNoteId(null);
              setNoteDraft('');
            } else {
              openNote(row);
            }
          }}
          onSaveNote={() => saveNote(row)}
          onCancelNote={() => { setExpandedNoteId(null); setNoteDraft(''); }}
          onPatch={(patch) => patchRow(row.id, patch)}
          onDelete={() => deleteRow(row)}
        />
      ))}
    </div>
  );
}
