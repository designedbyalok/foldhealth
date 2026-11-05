import { useEffect, useState } from 'react';
import { Drawer } from '../../components/Drawer/Drawer';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { Select } from '../../components/Select/Select';
import { DatePicker } from '../../components/DatePicker/DatePicker';
import { WeekdayPicker } from '../../components/WeekdayPicker/WeekdayPicker';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Icon } from '../../components/Icon/Icon';
import { Link } from '../../components/Link/Link';
import { AddIconMinimalist } from '../../components/Icon/AddIconMinimalist';
import { toast } from '../../components/Toast/sonnerToast';
import { useAppStore } from '../../store/useAppStore';
import { PHONE_TREE_TYPES } from './onCallSeed';
import styles from './ooo.module.css';

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const blank = (preset) => ({ key: Math.random().toString(36).slice(2), name: '', phoneTreeType: '', fromDate: '', toDate: '', days: ALL_DAYS, userName: '', ...preset });
const complete = (b) => b.name.trim() && b.phoneTreeType && b.fromDate && b.toDate && b.toDate >= b.fromDate && b.days.length && b.userName;

/**
 * Create Schedule (on call): one or more schedules, each a name, a phone
 * tree type, a date range, the weekdays it runs and who's on call. Every
 * field is required; Create saves them all. Opened from the Out of Office
 * record drawer with Out of Office picked and the record's dates filled in.
 *
 * @param {object}   props
 * @param {object}   [props.preset]      – Starting values for every block, e.g.
 *   { phoneTreeType: 'Out of Office', fromDate: 'YYYY-MM-DD', toDate: 'YYYY-MM-DD' }
 * @param {string}   [props.oooRecordId] – The Out of Office record it was made from
 * @param {string}   [props.excludeUser] – Left out of User (the provider who is away)
 * @param {function} props.onClose
 */
export function OnCallScheduleDrawer({ preset, oooRecordId, excludeUser, onClose }) {
  const createOnCallSchedules = useAppStore(s => s.createOnCallSchedules);
  const platformUsers = useAppStore(s => s.platformUsers);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  useEffect(() => { fetchPlatformUsers?.(); }, [fetchPlatformUsers]);
  const [blocks, setBlocks] = useState(() => [blank(preset)]);
  const [saving, setSaving] = useState(false);

  const userOptions = (platformUsers || [])
    .filter(u => u.name && u.name !== excludeUser)
    .map(u => ({ value: u.name, label: u.name }));
  const edit = (key, patch) => setBlocks(bs => bs.map(b => (b.key === key ? { ...b, ...patch } : b)));
  const ready = blocks.every(complete);

  const create = async () => {
    if (!ready) return;
    setSaving(true);
    const saved = await createOnCallSchedules(blocks.map(b => ({
      name: b.name.trim(),
      phoneTreeType: b.phoneTreeType,
      fromDate: b.fromDate,
      toDate: b.toDate,
      days: b.days,
      userName: b.userName,
      userId: (platformUsers || []).find(u => u.name === b.userName)?.id || null,
      oooRecordId: oooRecordId || null,
    })));
    setSaving(false);
    if (!saved) return;
    toast.success(saved.length > 1 ? 'On Call Schedules Created Successfully' : 'On Call Schedule Created Successfully');
    onClose();
  };

  return (
    <Drawer
      title="Create Schedule"
      width={640}
      onClose={onClose}
      noCloseDivider
      headerRight={(
        <>
          <Button disabled={!ready} onClick={create} loading={saving}>Create</Button>
          <span className={styles.headerDivider} aria-hidden="true" />
        </>
      )}
    >
      <div className={styles.form}>
        <span className={styles.mandatoryNote}>
          <Icon name="solar:info-circle-linear" size={16} color="var(--neutral-300)" />
          All fields are mandatory
        </span>

        {blocks.map((b, i) => (
          <div key={b.key} className={i ? `${styles.scheduleBlock} ${styles.scheduleBlockNext}` : styles.scheduleBlock}>
            {i > 0 && (
              <div className={styles.scheduleBlockHead}>
                <span className={styles.groupTitle}>Schedule {i + 1}</span>
                <ActionButton icon="solar:trash-bin-minimalistic-linear" tooltip="Remove Schedule" tooltipLeft onClick={() => setBlocks(bs => bs.filter(x => x.key !== b.key))} />
              </div>
            )}
            <Input label="Schedule Name" placeholder="Enter a Schedule Name" value={b.name} maxLength={80} onChange={(e) => edit(b.key, { name: e.target.value })} />
            <Select
              label="Phone Tree Type"
              portal
              placeholder="Select Phone Tree Type"
              options={PHONE_TREE_TYPES.map(t => ({ value: t, label: t }))}
              value={b.phoneTreeType || undefined}
              onValueChange={(v) => edit(b.key, { phoneTreeType: v })}
            />
            <div className={styles.dateRow}>
              <DatePicker
                label="From"
                placeholder="Select date"
                value={b.fromDate}
                min={todayIso()}
                // A new start after the end clears the end.
                onSelect={(v) => edit(b.key, { fromDate: v, toDate: b.toDate && b.toDate < v ? '' : b.toDate })}
              />
              <DatePicker
                label="To"
                placeholder="Select date"
                value={b.toDate}
                min={b.fromDate || todayIso()}
                disabled={!b.fromDate}
                onSelect={(v) => edit(b.key, { toDate: v })}
              />
            </div>
            <WeekdayPicker label="On" value={b.days} onChange={(days) => edit(b.key, { days })} />
            <Select
              label="User"
              portal
              searchable
              placeholder="Select user"
              options={userOptions}
              value={b.userName || undefined}
              onValueChange={(v) => edit(b.key, { userName: v })}
            />
          </div>
        ))}

        <span>
          <Link
            className={styles.newRecordLink}
            role="button"
            tabIndex={0}
            onClick={() => setBlocks(bs => [...bs, blank(preset)])}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setBlocks(bs => [...bs, blank(preset)]); } }}
          >
            <AddIconMinimalist size={12} color="currentColor" />
            Add Another Schedule
          </Link>
        </span>
      </div>
    </Drawer>
  );
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
