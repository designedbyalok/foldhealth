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
import { Badge } from '../../components/Badge/Badge';
import { describeDays, PHONE_TREE_TYPES } from './onCallSeed';
import styles from './ooo.module.css';

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const blank = (preset) => ({ key: Math.random().toString(36).slice(2), name: '', phoneTreeType: '', fromDate: '', toDate: '', days: ALL_DAYS, userNames: [], location: '', ...preset });
const ALL_LOCATIONS = '__all__';
const complete = (b) => b.name.trim() && b.phoneTreeType && b.fromDate && b.toDate && b.toDate >= b.fromDate && b.days.length && b.userNames.length;

/**
 * Create Schedule (on call): one or more schedules, each a name, a phone
 * tree type, a date range, the weekdays it runs, the location whose phone
 * tree it covers (or all) and who's on call (one or more users). Every field is required;
 * Create saves them all. With `schedule`, it edits that one (Save), or with
 * `readOnly` just shows it. Opened from Settings → Calls → On-Call Schedule.
 *
 * @param {object}   props
 * @param {object}   [props.preset]      – Starting values for every block, e.g.
 *   { phoneTreeType: 'Out of Office', fromDate: 'YYYY-MM-DD', toDate: 'YYYY-MM-DD' }
 * @param {string}   [props.oooRecordId] – The Out of Office record it was made from
 * @param {string}   [props.excludeUser] – Left out of User (the provider who is away)
 * @param {object}   [props.schedule]    – An existing schedule to edit or view
 * @param {boolean}  [props.readOnly]    – View only (with `schedule`)
 * @param {function} props.onClose
 */
export function OnCallScheduleDrawer({ preset, oooRecordId, excludeUser, schedule, readOnly = false, onClose }) {
  const createOnCallSchedules = useAppStore(s => s.createOnCallSchedules);
  const updateOnCallSchedule = useAppStore(s => s.updateOnCallSchedule);
  const locations = useAppStore(s => s.practiceLocations);
  const fetchPracticeLocations = useAppStore(s => s.fetchPracticeLocations);
  const locationsFetched = useAppStore(s => s.practiceLocationsFetched);
  useEffect(() => { if (!locationsFetched) fetchPracticeLocations?.(); }, [locationsFetched, fetchPracticeLocations]);
  const isEdit = !!schedule;
  const platformUsers = useAppStore(s => s.platformUsers);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  useEffect(() => { fetchPlatformUsers?.(); }, [fetchPlatformUsers]);
  const [blocks, setBlocks] = useState(() => [schedule ? { ...blank(), ...schedule, location: schedule.location || '', userNames: (schedule.users || [{ name: schedule.userName }]).map(u => u.name).filter(Boolean), key: schedule.id } : blank(preset)]);
  const [saving, setSaving] = useState(false);

  const locationOptions = [
    { value: ALL_LOCATIONS, label: 'All Locations' },
    ...[...new Set((locations || []).map(l => l.name).filter(Boolean))].map(n => ({ value: n, label: n })),
  ];
  const userOptions = (platformUsers || [])
    .filter(u => u.name && u.name !== excludeUser)
    .map(u => ({ value: u.name, label: u.name }));
  const edit = (key, patch) => setBlocks(bs => bs.map(b => (b.key === key ? { ...b, ...patch } : b)));
  const ready = blocks.every(complete);

  const toSchedule = (b) => ({
    name: b.name.trim(),
    phoneTreeType: b.phoneTreeType,
    fromDate: b.fromDate,
    toDate: b.toDate,
    days: b.days,
    location: b.location || null,
    users: b.userNames.map(n => ({ id: (platformUsers || []).find(u => u.name === n)?.id || null, name: n })),
    userName: b.userNames[0],
    userId: (platformUsers || []).find(u => u.name === b.userNames[0])?.id || null,
  });

  const create = async () => {
    if (!ready) return;
    setSaving(true);
    if (isEdit) {
      const saved = await updateOnCallSchedule(schedule.id, toSchedule(blocks[0]));
      setSaving(false);
      if (!saved) return;
      toast.success('On Call Schedule Updated Successfully');
      onClose();
      return;
    }
    const saved = await createOnCallSchedules(blocks.map(b => ({
      name: b.name.trim(),
      phoneTreeType: b.phoneTreeType,
      fromDate: b.fromDate,
      toDate: b.toDate,
      ...toSchedule(b),
      oooRecordId: oooRecordId || null,
    })));
    setSaving(false);
    if (!saved) return;
    toast.success(saved.length > 1 ? 'On Call Schedules Created Successfully' : 'On Call Schedule Created Successfully');
    onClose();
  };

  return (
    <Drawer
      title={readOnly ? 'View Schedule' : isEdit ? 'Edit Schedule' : 'Create Schedule'}
      width={640}
      onClose={onClose}
      noCloseDivider={!readOnly}
      headerRight={readOnly ? undefined : (
        <>
          <Button disabled={!ready} onClick={create} loading={saving}>{isEdit ? 'Save' : 'Create'}</Button>
          <span className={styles.headerDivider} aria-hidden="true" />
        </>
      )}
    >
      {readOnly ? <ScheduleDetails schedule={schedule} /> : (
      <div className={styles.form}>
        {!readOnly && (
          <span className={styles.mandatoryNote}>
            <Icon name="solar:info-circle-linear" size={16} color="var(--neutral-300)" />
            All fields are mandatory
          </span>
        )}

        {blocks.map((b, i) => (
          <div key={b.key} className={i ? `${styles.scheduleBlock} ${styles.scheduleBlockNext}` : styles.scheduleBlock}>
            {i > 0 && (
              <div className={styles.scheduleBlockHead}>
                <span className={styles.groupTitle}>Schedule {i + 1}</span>
                <ActionButton icon="solar:trash-bin-minimalistic-linear" tooltip="Remove Schedule" tooltipLeft onClick={() => setBlocks(bs => bs.filter(x => x.key !== b.key))} />
              </div>
            )}
            <Input label="Schedule Name" placeholder="Enter a Schedule Name" disabled={readOnly} value={b.name} maxLength={80} onChange={(e) => edit(b.key, { name: e.target.value })} />
            <Select
              label="Phone Tree Type"
              portal
              placeholder="Select Phone Tree Type"
              disabled={readOnly}
              options={PHONE_TREE_TYPES.map(t => ({ value: t, label: t }))}
              value={b.phoneTreeType || undefined}
              onValueChange={(v) => edit(b.key, { phoneTreeType: v })}
            />
            <div className={styles.dateRow}>
              <DatePicker
                label="From"
                placeholder="Select date"
                disabled={readOnly}
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
                disabled={readOnly || !b.fromDate}
                onSelect={(v) => edit(b.key, { toDate: v })}
              />
            </div>
            <WeekdayPicker label="On" disabled={readOnly} value={b.days} onChange={(days) => edit(b.key, { days })} />
            <Select
              label="Location"
              portal
              searchable
              disabled={readOnly}
              placeholder="Select Location"
              options={locationOptions}
              value={b.location || ALL_LOCATIONS}
              onValueChange={(v) => edit(b.key, { location: v === ALL_LOCATIONS ? '' : v })}
            />
            <Select
              label="Users"
              portal
              searchable
              disabled={readOnly}
              placeholder="Select users"
              options={userOptions}
              multiple
              badges
              value={b.userNames}
              onValueChange={(v) => edit(b.key, { userNames: v || [] })}
            />
          </div>
        ))}

        {!isEdit && <span>
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
        </span>}
      </div>
      )}
    </Drawer>
  );
}

const usDate = (iso) => { const [y, m, d] = String(iso || '').split('-'); return y && m && d ? `${m}/${d}/${y}` : '-'; };

/** View: the schedule as plain text, label over value. */
function ScheduleDetails({ schedule: s }) {
  const users = s.users?.length ? s.users : [{ id: s.userId, name: s.userName }];
  const days = describeDays(s.days);
  const row = (label, value) => (
    <div className={styles.detailRow}>
      <span className={styles.detailLabel}>{label}</span>
      <span className={styles.detailValue}>{value}</span>
    </div>
  );
  return (
    <div className={styles.detailList}>
      {row('Schedule Name', s.name || '-')}
      {row('Phone Tree Type', s.phoneTreeType || '-')}
      {row('Dates', `${usDate(s.fromDate)} – ${usDate(s.toDate)}`)}
      {row('On', days ? days.charAt(0).toUpperCase() + days.slice(1) : '-')}
      {row('Location', s.location || 'All Locations')}
      {row('Users', (
        <span className={styles.detailBadges}>
          {users.filter(u => u?.name).map(u => <Badge key={u.id || u.name} tone="neutral" size="sm" icon="solar:user-linear" label={u.name} />)}
        </span>
      ))}
    </div>
  );
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
