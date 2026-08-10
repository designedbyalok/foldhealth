import { useMemo, useState } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { Button } from '../../../../../../../../components/Button/Button';
import { Select } from '../../../../../../../../components/Select/Select';
import { Textarea } from '../../../../../../../../components/Textarea/Textarea';
import { Checkbox } from '../../../../../../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import { CCM_ACTIVITY_TYPES, CCM_UNLOGGED_SECONDS, secondsToTime } from '../../../../../../data/ccmBillingMock';
import styles from './CcmUnloggedDrawer.module.css';

// Mock unlogged sessions — in production these would come from an
// idle-time tracker. Chunked so a user can classify or skip individually.
const buildMockSessions = () => {
  const remaining = CCM_UNLOGGED_SECONDS;
  const chunks = [
    { id: 'ul-1', label: '07/24/2026, 10:12 AM', durationSeconds: 8 * 60 },
    { id: 'ul-2', label: '07/22/2026, 03:45 PM', durationSeconds: 6 * 60 },
    { id: 'ul-3', label: '07/19/2026, 11:20 AM', durationSeconds: 4 * 60 },
  ];
  const sum = chunks.reduce((s, c) => s + c.durationSeconds, 0);
  if (sum !== remaining) {
    chunks[0].durationSeconds += remaining - sum;
  }
  return chunks;
};

export function CcmUnloggedDrawer({ patientId, periodId, onClose }) {
  const addCcmBillableActivity = useAppStore(s => s.addCcmBillableActivity);
  const sessions = useMemo(buildMockSessions, []);

  const [selected, setSelected] = useState(() => new Set(sessions.map(s => s.id)));
  const [activityType, setActivityType] = useState(CCM_ACTIVITY_TYPES[0]);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const totalSelected = sessions
    .filter(s => selected.has(s.id))
    .reduce((sum, s) => sum + s.durationSeconds, 0);

  const save = async () => {
    if (!periodId || totalSelected === 0) return;
    setSaving(true);
    try {
      await Promise.all(sessions.filter(s => selected.has(s.id)).map(session =>
        addCcmBillableActivity({
          id: `act-ul-${session.id}-${Date.now()}`,
          periodId,
          patientId,
          activityType,
          description: description.trim() || `Classified from unlogged time (${session.label})`,
          durationSeconds: session.durationSeconds,
          loggedBy: 'You',
          loggedByInitials: 'Y',
          occurredAt: new Date().toISOString(),
          isUnlogged: true,
        }),
      ));
    } finally {
      setSaving(false);
    }
    onClose?.();
  };

  return (
    <Drawer
      title="Review Unlogged Time"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" size="L" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            variant="primary"
            size="L"
            onClick={save}
            disabled={saving || totalSelected === 0 || !periodId}
          >
            {saving ? 'Saving…' : `Log ${secondsToTime(totalSelected)} mins`}
          </Button>
        </>
      }
    >
      <div className={styles.wrap}>
        <p className={styles.help}>
          Time captured from your background tracker that isn't attached to a
          billable activity yet. Select the sessions you want to include, pick
          an activity type, and log them all at once.
        </p>

        <div className={styles.summary}>
          <Icon name="solar:clock-circle-linear" size={16} color="var(--primary-300)" />
          <span>{secondsToTime(CCM_UNLOGGED_SECONDS)} mins unclassified</span>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Activity type</span>
          <Select
            options={CCM_ACTIVITY_TYPES.map(t => ({ value: t, label: t }))}
            value={activityType}
            onChange={setActivityType}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Notes (optional)</span>
          <Textarea
            placeholder="Shared context for every session logged below."
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
          />
        </div>

        <div className={styles.list}>
          {sessions.map(s => (
            <label key={s.id} className={styles.item}>
              <Checkbox
                checked={selected.has(s.id)}
                onCheckedChange={() => toggle(s.id)}
                aria-label={`Toggle ${s.label}`}
              />
              <div className={styles.itemBody}>
                <span className={styles.itemLabel}>{s.label}</span>
                <span className={styles.itemDuration}>{secondsToTime(s.durationSeconds)} mins</span>
              </div>
            </label>
          ))}
        </div>
      </div>
    </Drawer>
  );
}
