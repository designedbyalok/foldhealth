import { useMemo, useState } from 'react';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { Select } from '../../../../../../../../components/Select/Select';
import { Input } from '../../../../../../../../components/Input/Input';
import { Checkbox } from '../../../../../../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import { CCM_ACTIVITY_TYPES, secondsToTime, timeToSeconds } from '../../../../../../data/ccmBillingMock';
import styles from './CcmUnloggedTable.module.css';

// Seed rows lifted from the Figma reference (450:19899) — three chunks of
// tracker time that haven't been classified into a billable activity yet.
const DEFAULT_ROWS = () => [
  { id: 'ul-1', date: '11/07/2026', serviceCategory: '', durationInput: '05:00' },
  { id: 'ul-2', date: '09/07/2026', serviceCategory: '', durationInput: '03:09' },
  { id: 'ul-3', date: '08/07/2026', serviceCategory: '', durationInput: '10:00' },
];

const CATEGORY_OPTIONS = CCM_ACTIVITY_TYPES.map(t => ({ value: t, label: t }));

// Build the last N unique date options as MM/DD/YYYY strings so the picker
// gives a realistic-looking list without needing a real calendar widget.
const DATE_OPTIONS = (() => {
  const dates = new Set([
    '11/07/2026', '11/10/2026', '10/07/2026', '09/07/2026', '08/07/2026',
    '07/07/2026', '06/07/2026',
  ]);
  return Array.from(dates).sort().reverse().map(d => ({ value: d, label: d }));
})();

const randomId = () => `ul-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`;

// Turn 'MM:SS' or 'M' / 'MM' text into seconds. Empty → 0 so rows without
// duration still render but don't roll into billable time.
const parseDuration = (str) => {
  if (!str) return 0;
  if (/^\d+$/.test(str)) return Number(str) * 60;
  return timeToSeconds(str);
};

export function CcmUnloggedTable({ patientId, periodId, expanded, onToggleExpanded, initialSeconds }) {
  const addCcmBillableActivity = useAppStore(s => s.addCcmBillableActivity);
  const [rows, setRows] = useState(DEFAULT_ROWS);
  const [selected, setSelected] = useState(() => new Set());
  const [saving, setSaving] = useState(false);

  const totalSeconds = useMemo(
    () => rows.reduce((sum, r) => sum + parseDuration(r.durationInput), 0),
    [rows],
  );

  // Header total is snapshotted on open so the "18:09 mins" label doesn't
  // count down as the user classifies rows. Fall back to what's currently
  // in the table when no baseline is passed in.
  const headerSeconds = initialSeconds ?? totalSeconds;

  const anySelected = selected.size > 0;
  const multiSelected = selected.size > 1;
  const rowIds = rows.map(r => r.id);
  const allSelected = rowIds.length > 0 && rowIds.every(id => selected.has(id));
  const someSelected = rowIds.some(id => selected.has(id)) && !allSelected;

  const toggleRow = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = (checked) => setSelected(prev => {
    const next = new Set(prev);
    if (checked) rowIds.forEach(id => next.add(id));
    else rowIds.forEach(id => next.delete(id));
    return next;
  });

  const updateRow = (id, patch) =>
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  const removeRow = (id) => {
    setRows(prev => prev.filter(r => r.id !== id));
    setSelected(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };
  const addNew = () => setRows(prev => [
    ...prev,
    { id: randomId(), date: DATE_OPTIONS[0].value, serviceCategory: '', durationInput: '00:00' },
  ]);

  // Merge — combine every selected row into the first one, summing time.
  const merge = () => {
    if (selected.size < 2) return;
    const selRows = rows.filter(r => selected.has(r.id));
    const first = selRows[0];
    const mergedSeconds = selRows.reduce((s, r) => s + parseDuration(r.durationInput), 0);
    setRows(prev => {
      const kept = prev.filter(r => !selected.has(r.id) || r.id === first.id);
      return kept.map(r =>
        r.id === first.id
          ? { ...first, durationInput: secondsToTime(mergedSeconds).replace(' Mins', '') }
          : r);
    });
    setSelected(new Set([first.id]));
  };

  // Bulk delete — trash icon in the header. Requires selection.
  const deleteSelected = () => {
    if (selected.size === 0) return;
    setRows(prev => prev.filter(r => !selected.has(r.id)));
    setSelected(new Set());
  };

  // Add — commit selected rows as billable activities and drop them from
  // the unlogged list. Rows without a category can't be added.
  const commitSelected = async () => {
    if (selected.size === 0 || !periodId) return;
    const selRows = rows.filter(r => selected.has(r.id));
    const invalid = selRows.filter(r => !r.serviceCategory);
    if (invalid.length) return;
    setSaving(true);
    try {
      await Promise.all(selRows.map(r =>
        addCcmBillableActivity({
          id: randomId(),
          periodId,
          patientId,
          activityType: r.serviceCategory,
          description: `Classified from unlogged time (${r.date})`,
          durationSeconds: parseDuration(r.durationInput),
          loggedBy: 'You',
          loggedByInitials: 'Y',
          occurredAt: new Date().toISOString(),
          isUnlogged: true,
        }),
      ));
      setRows(prev => prev.filter(r => !selected.has(r.id)));
      setSelected(new Set());
    } finally {
      setSaving(false);
    }
  };

  const canAdd = anySelected && rows.filter(r => selected.has(r.id)).every(r => r.serviceCategory);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.headerToggle}
          onClick={onToggleExpanded}
          aria-expanded={expanded}
        >
          <span className={styles.headerText}>
            Review <strong>{secondsToTime(headerSeconds)} mins</strong> of Unlogged Time
          </span>
          <Icon
            name={expanded ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-right-linear'}
            size={16}
            color="var(--primary-300)"
          />
        </button>
        {expanded && (
          <div className={styles.headerActions}>
            <button
              type="button"
              className={`${styles.headerBtn} ${canAdd ? styles.headerBtnPrimary : ''}`}
              onClick={commitSelected}
              disabled={!canAdd || saving}
            >
              {saving ? 'Saving…' : 'Add'}
            </button>
            <button
              type="button"
              className={styles.headerBtn}
              onClick={merge}
              disabled={!multiSelected}
            >
              Merge
            </button>
            <button
              type="button"
              className={styles.headerBtn}
              disabled={!anySelected}
              title="Split — coming soon"
            >
              Split
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={deleteSelected}
              disabled={!anySelected}
              aria-label="Delete selected"
            >
              <Icon name="solar:trash-bin-trash-linear" size={16} color="var(--neutral-300)" />
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <div className={styles.body}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.checkCol}>
                    <Checkbox
                      checked={someSelected ? 'indeterminate' : allSelected}
                      onCheckedChange={toggleAll}
                      aria-label="Select all unlogged rows"
                    />
                  </th>
                  <th>Date</th>
                  <th>Service Category</th>
                  <th className={styles.aiCol} aria-label="AI suggest" />
                  <th className={styles.durationCol}>Logged Duration</th>
                  <th className={styles.actionCol}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td className={styles.checkCol}>
                      <Checkbox
                        checked={selected.has(r.id)}
                        onCheckedChange={() => toggleRow(r.id)}
                        aria-label={`Select ${r.date}`}
                      />
                    </td>
                    <td>
                      <Select
                        options={DATE_OPTIONS}
                        value={r.date}
                        onChange={(v) => updateRow(r.id, { date: v })}
                      />
                    </td>
                    <td>
                      <Select
                        options={CATEGORY_OPTIONS}
                        value={r.serviceCategory}
                        onChange={(v) => updateRow(r.id, { serviceCategory: v })}
                        placeholder="Select"
                      />
                    </td>
                    <td className={styles.aiCol}>
                      <button type="button" className={styles.iconBtn} aria-label="AI suggest">
                        <Icon name="solar:magic-stick-linear" size={16} color="var(--primary-300)" />
                      </button>
                    </td>
                    <td className={styles.durationCol}>
                      <div className={styles.durationInput}>
                        <Input
                          value={r.durationInput}
                          onChange={e => updateRow(r.id, { durationInput: e.target.value })}
                          aria-label="Duration"
                        />
                        <span className={styles.durationSuffix}>Min</span>
                      </div>
                    </td>
                    <td className={styles.actionCol}>
                      <div className={styles.rowActions}>
                        <button type="button" className={styles.iconBtn} aria-label="View source">
                          <Icon name="solar:document-text-linear" size={16} color="var(--neutral-300)" />
                        </button>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => removeRow(r.id)}
                          aria-label="Delete row"
                        >
                          <Icon name="solar:trash-bin-trash-linear" size={16} color="var(--neutral-300)" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className={styles.addNew} onClick={addNew}>
            <Icon name="solar:add-circle-linear" size={14} color="var(--primary-300)" />
            Add New
          </button>
        </div>
      )}
    </div>
  );
}
