import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../components/Drawer/Drawer';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { DateTimePicker } from '../../components/DateTimePicker/DateTimePicker';
import { Select } from '../../components/Select/Select';
import { Switch } from '../../components/Switch/Switch';
import { Checkbox } from '../../components/Checkbox/Checkbox';
import { Icon } from '../../components/Icon/Icon';
import { Textarea } from '../../components/Textarea/Textarea';
import { Banner } from '../../components/Banner/Banner';
import { Tooltip } from '../../components/Tooltip/Tooltip';
import { Avatar } from '../../components/Avatar/Avatar';
import { AssigneeChange } from '../../components/AssigneeChange/AssigneeChange';
import { UserPickerPopover } from '../../components/UserPickerPopover/UserPickerPopover';
import { Badge } from '../../components/Badge/Badge';
import { useAppStore } from '../../store/useAppStore';
import { appointmentsToReassign, capFirst, coveringPeople, DEFAULT_AUTO_REPLY, formatDate, initialsOf, overlapPlan, personKey, phoneTreeOnCall, fromPickerValue, rangeChange, samePerson, toPickerValue, validateOoo } from './oooUtils';
import { coverageFor, coveringGroups } from './reassignUtils';
import { OooReviewStep } from './OooReviewStep';
import { OooRecordSummary } from './OooRecordSummary';
import { useOpenWork, MODULES } from './useOpenWork';
import { toast } from '../../components/Toast/sonnerToast';
// // import { AddIconMinimalist } from '../../components/Icon/AddIconMinimalist';
// import { OnCallScheduleDrawer } from './OnCallScheduleDrawer';
import styles from './ooo.module.css';

// A picked date-time's local day, "YYYY-MM-DD" ('' when unset).
// function isoDay(v) {
//   const d = v ? new Date(v) : null;
//   if (!d || Number.isNaN(d.getTime())) return '';
//   return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// }

/**
 * Opens and closes its content smoothly (height and fade) instead of
 * popping it in; closed, it takes no room, including the form's gap.
 */
function Reveal({ open, children }) {
  return (
    <div className={open ? `${styles.reveal} ${styles.revealOpen}` : styles.reveal} aria-hidden={!open || undefined} inert={!open}>
      <div className={styles.revealInner}>{children}</div>
    </div>
  );
}

/**
 * New / Edit Out of Office Record (Figma Eventus 17400:134395, 17400:136675).
 *
 * Save stores the record; a new record, or an edit that adds dates, then
 * hands off to the Reassign Appointments drawer (see useOooRecordActions).
 * Edit, depending on how the dates change:
 *   - no new dates: Save, enabled once something changes;
 *   - dates removed: a "You have updated the Out of Office schedule" card offers to move
 *     the removed dates' reassigned appointments back (17401:138229);
 *   - dates added: a note that they can be reassigned after saving.
 *
 * @param {object}   props
 * @param {object}   [props.record]  – The record being edited; omit to create one
 * @param {object}   [props.user]    – { name, email, role } the new record is for; omit to pick one
 * @param {object[]} [props.users]   – Who can be picked when `user` is omitted
 * @param {1|2}     [props.initialStep] – 2 opens an existing record at Reassign Open Work
 * @param {function} props.onClose
 * @param {function} [props.onSaved] – (record, { reassign }) => void; `reassign` when
 *   there are newly out-of-office dates whose appointments need moving
 */
export function OooRecordDrawer({ record: initialRecord, user, users = [], initialStep = 1, onClose, onSaved }) {
  // The record being edited; Edit Existing (below) switches to another one.
  const [record, setRecord] = useState(initialRecord);
  const saveOooRecord = useAppStore(s => s.saveOooRecord);
  const oooRecords = useAppStore(s => s.oooRecords);
  const restoreReassigned = useAppStore(s => s.restoreReassignedAppointments);
  const meName = useAppStore(s => s.currentUserProfile?.name);
  const isEdit = !!record;
  // A record that has started: from a previous day, its start is fixed;
  // from earlier today, it can still move, but reassignments already in
  // the past stay where they are.
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const origStart = isEdit ? new Date(record.startAt).getTime() : NaN;
  const started = isEdit && origStart <= now.getTime();
  const startLocked = started && origStart < todayStart;
  const startedToday = started && !startLocked;
  const isMine = !!meName && String(record?.userName || user?.name || '').trim().toLowerCase() === meName.trim().toLowerCase();

  const [values, setValues] = useState(() => ({
    userName: record?.userName || user?.name || '',
    userEmail: record?.userEmail || user?.email || '',
    userRole: record?.userRole || user?.role || '',
    userId: record?.userId || user?.id || null,
    startAt: record?.startAt || null,
    endAt: record?.endAt || null,
    reason: record?.reason || '',
    // On for every record now (older ones saved with it off included).
    autoReply: true,
    autoReplyMessage: record?.autoReplyMessage || DEFAULT_AUTO_REPLY,
    coverage: record?.coverage || [],
  }));
  const [restore, setRestore] = useState(true);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  // const [onCallOpen, setOnCallOpen] = useState(false); // on call schedule, parked
  const set = (patch) => setValues(v => ({ ...v, ...patch }));

  const errors = validateOoo(values, { original: record, existing: oooRecords });
  const hasErrors = Object.keys(errors).length > 0 || !values.userName;
  const change = rangeChange(record, values);
  // Dates compare as moments: the picker writes "…00.000Z" where the
  // database returns "…+00:00" for the same time.
  const sameTime = (a, b) => (!a && !b) || (!!a && !!b && new Date(a).getTime() === new Date(b).getTime());
  const dirty = !isEdit || !sameTime(values.startAt, record.startAt) || !sameTime(values.endAt, record.endAt)
    || (values.reason || '') !== (record.reason || '')
    // A record saved with auto-reply off shows the default message: unchanged.
    || values.autoReplyMessage !== (record.autoReplyMessage || DEFAULT_AUTO_REPLY)
    || JSON.stringify(values.coverage || []) !== JSON.stringify(record.coverage || []);

  const providerLabel = values.userName ? `${values.userName}${values.userEmail ? ` (${values.userEmail})` : ''}` : '';
  // Valued by id: two providers can share a name (each shows with their email).
  const pickable = useMemo(() => users.map(u => ({ value: personKey(u), label: u.email ? `${u.name} (${u.email})` : u.name })), [users]);

  // Covering Provider: everyone but the away provider, in three groups
  // (Suggested, Limited Access, Not Available for these dates).
  const people = useAppStore(s => (s.platformPeople?.length ? s.platformPeople : s.platformUsers));
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  useEffect(() => { if (!people?.length) fetchPlatformUsers?.(); }, [people, fetchPlatformUsers]);
  const awayLocations = useMemo(
    () => (people || []).find(u => samePerson(u, { id: values.userId, name: values.userName }))?.locations || [],
    [people, values.userId, values.userName],
  );
  // With no covering provider, calls go to whoever is on call on the Out of
  // Office phone tree at each of the user's locations.
  const onCallSchedules = useAppStore(s => s.onCallSchedules);
  const fetchOnCallSchedules = useAppStore(s => s.fetchOnCallSchedules);
  useEffect(() => { fetchOnCallSchedules?.(); }, [fetchOnCallSchedules]);
  const phoneTree = useMemo(() => phoneTreeOnCall(onCallSchedules, awayLocations, {
    away: { id: values.userId, name: values.userName },
    from: values.startAt ? new Date(values.startAt).getTime() : null,
    to: values.endAt ? new Date(values.endAt).getTime() : null,
  }), [onCallSchedules, awayLocations, values.userId, values.userName, values.startAt, values.endAt]);
  const groups = useMemo(() => coveringGroups(
    { id: values.userId, name: values.userName },
    people,
    {
      oooRecords,
      from: values.startAt ? new Date(values.startAt).getTime() : null,
      to: values.endAt ? new Date(values.endAt).getTime() : null,
      recordId: record?.id,
    },
  ), [people, oooRecords, values.userId, values.userName, values.startAt, values.endAt, record?.id]);
  // Why a person is Limited Access or Not Available, as badges: a count keeps
  // the access badge one width (hovering names the modules); the Out of
  // Office pink is the calendar's, and hovering gives their dates.
  const limitedBadge = missing => (
    <Tooltip label={`No access to ${missing.join(' and ')}`} placement="top" align="right">
      <Badge tone="warning" size="sm" icon="solar:danger-triangle-linear" label={`No access to ${missing.length} module${missing.length === 1 ? '' : 's'}`} />
    </Tooltip>
  );
  const outBadge = out => (
    <Tooltip label={`Out of office ${formatDate(out.startAt)} - ${formatDate(out.endAt)}`} placement="top" align="right">
      <Badge tone="magenta" size="sm" label="Out of Office" />
    </Tooltip>
  );
  const optionsFor = useMemo(() => (groups) => {
    // Title Case group names (the list uppercases headers by default).
    const header = (key, label) => ({ type: 'header', value: `h-${key}`, label: <span className={styles.coverGroup}>{label}</span> });
    // Each row says why it's in its group: Limited Access rows carry a
    // warning badge, Not Available rows an Out of Office one.
    const row = ({ user }, trail, extra) => ({
      value: personKey(user),
      searchText: [user.name, user.email, user.clinicalRoles?.[0] || 'Staff'].filter(Boolean).join(' '),
      triggerLabel: user.name,
      // Like Create Team With: avatar, name over role, and the note on the right.
      label: (
        <span className={styles.coverRow}>
          <Avatar variant="assignee" initials={user.initials || initialsOf(user.name)} />
          <span className={styles.coverRowText}>
            <span className={styles.coverRowName}>{user.name}</span>
            <span className={styles.coverRowRole}>{user.clinicalRoles?.[0] || 'Staff'}</span>
          </span>
          {trail}
        </span>
      ),
      ...extra,
    });
    return [
      ...(groups.suggested.length ? [header('suggested', 'Suggested'), ...groups.suggested.map(g => row(g))] : []),
      ...(groups.limited.length ? [header('limited', 'Limited Access'), ...groups.limited.map(g => row(g, limitedBadge(g.missing)))] : []),
      ...(groups.unavailable.length ? [header('unavailable', 'Not Available'), ...groups.unavailable.map(g => row(g, outBadge(g.out), { disabled: true }))] : []),
    ];
  }, []);
  const coverOptions = useMemo(() => optionsFor(groups), [optionsFor, groups]);

  // One provider for every location (the default), or, toggled off, one per
  // location (Figma Eventus 17785:116219). Coverage is saved per location
  // either way; turning it off keeps the common pick in every row.
  const multiLocation = awayLocations.length > 1;
  const [sameForAll, setSameForAll] = useState(() => coveringPeople(record?.coverage).length <= 1);
  const perLocation = multiLocation && !sameForAll;
  const coverers = coveringPeople(values.coverage);
  const coverer = coverers[0];
  const covererKey = coverer ? personKey({ id: coverer.id, name: coverer.name }) : undefined;
  const findPerson = key => (people || []).find(x => personKey(x) === key);
  const toggleSameForAll = (on) => {
    setSameForAll(on);
    // Back to one provider: the first one picked covers every location.
    if (on && coverer) set({ coverage: coverageFor(coverer, awayLocations) });
  };
  // Per location: the assignee pill opens the shared user picker with the
  // same three groups, those who work at that location first.
  const [locPicker, setLocPicker] = useState(null); // { loc, rect }
  const pickerUsers = useMemo(() => {
    if (!locPicker) return [];
    const g = coveringGroups({ id: values.userId, name: values.userName }, people, {
      oooRecords,
      from: values.startAt ? new Date(values.startAt).getTime() : null,
      to: values.endAt ? new Date(values.endAt).getTime() : null,
      recordId: record?.id,
      location: locPicker.loc,
    });
    const asUser = ({ user }, section, extra) => ({ id: personKey(user), name: user.name, role: user.clinicalRoles?.[0] || 'Staff', initials: user.initials, section, ...extra });
    return [
      ...g.suggested.map(x => asUser(x, 'Suggested')),
      ...g.limited.map(x => asUser(x, 'Limited Access', { badge: limitedBadge(x.missing) })),
      ...g.unavailable.map(x => asUser(x, 'Not Available', { badge: outBadge(x.out), disabled: true })),
    ];
  }, [locPicker, people, oooRecords, values.userId, values.userName, values.startAt, values.endAt, record?.id]);
  const setLocationCover = (loc, key) => {
    const u = findPerson(key);
    const rest = (values.coverage || []).filter(c => c.location !== loc);
    set({ coverage: u ? [...rest, ...coverageFor(u, [loc])].sort((a, b) => awayLocations.indexOf(a.location) - awayLocations.indexOf(b.location)) : rest });
  };
  const keyAt = (loc) => {
    const c = (values.coverage || []).find(x => x.location === loc);
    return c ? personKey({ id: c.userId, name: c.userName }) : undefined;
  };
  // The away summary: who lacks which access.
  const missingByName = Object.fromEntries(groups.limited.map(g => [g.user.name, g.missing]));

  // A banner for anyone picked who is out themselves. (Missing access shows
  // on the summary row it affects instead.)
  const coverWarnings = coverers.map((p) => {
    const out = groups.unavailable.find(g => samePerson(g.user, p));
    return out ? { key: p.name, text: `${p.name} is out of office ${formatDate(out.out.startAt)} - ${formatDate(out.out.endAt)}. Pick someone else.` } : null;
  }).filter(Boolean);

  // After a save: Reassign Appointments opens next only if the dates hold
  // appointments still to move; the toast says so when it does.
  const finish = async (saved, wantsReassign, started = false) => {
    // (Load appointments first if nothing on screen has yet.)
    if (wantsReassign && !(useAppStore.getState().appointments || []).length) await useAppStore.getState().fetchAppointments?.();
    const reassign = wantsReassign && appointmentsToReassign(saved, useAppStore.getState().appointments).length > 0;
    toast.success(started ? 'Reassignment job started. You will be notified with updates'
      : reassign ? 'Out of Office Record Saved. Reassign Appointments Next.' : 'Out of Office Record Saved Successfully');
    onSaved?.(saved, { reassign });
    onClose();
  };

  // New dates that clash with the provider's other records: say what's
  // covered, and offer to extend those records or keep only the free time.
  const overlap = useMemo(() => overlapPlan(values, oooRecords, record?.id), [values, oooRecords, record?.id]);
  // Create New keeps the longest stretch of free time, wherever it falls
  // (after, before or between the existing records). Shorter gaps are too
  // rare to plan around, so they're left as they are.
  // The card only helps when some of the new dates are still free; dates
  // already fully covered just get the plain error.
  const partial = !isEdit && !!overlap?.gaps.length;
  const freeTime = overlap?.gaps.reduce((a, g) => (!a || g.to - g.from > a.to - a.from ? g : a), null);
  // Edit Existing: this drawer slides out and the clashing record opens for
  // editing, as saved (the user changes its dates on purpose).
  const [swapTo, setSwapTo] = useState(null);
  const editExisting = () => setSwapTo((overlap.extend.find(x => x.endAt !== x.record.endAt) || overlap.extend[0]).record);
  const openSwapped = () => {
    const r = swapTo;
    setRecord(r);
    setValues({
      userName: r.userName, userEmail: r.userEmail || '', userRole: r.userRole || '', userId: r.userId || null,
      startAt: r.startAt, endAt: r.endAt,
      reason: r.reason || '', autoReply: true, autoReplyMessage: r.autoReplyMessage || DEFAULT_AUTO_REPLY,
      coverage: r.coverage || [],
    });
    setTouched(false);
    setSwapTo(null);
  };

  // Two steps: the record and its covering provider (Next), then Reassign
  // Open Work. Save saves the record and runs the reassignments.
  const [step, setStep] = useState(initialStep);
  const awayPerson = useMemo(() => ({ id: values.userId, name: values.userName }), [values.userId, values.userName]);
  const work = useOpenWork({
    enabled: step === 2,
    away: awayPerson,
    startAt: values.startAt,
    endAt: values.endAt,
    coverage: values.coverage,
    recordId: record?.id,
  });
  const next = () => {
    setTouched(true);
    if (hasErrors) return;
    setStep(2);
  };
  // The auto-reply is optional: a blank message means none.
  const autoReplyOn = !!String(values.autoReplyMessage || '').trim();

  const runReassignments = async (saved) => {
    const st = useAppStore.getState();
    const window = { from: new Date(saved.startAt).getTime(), to: new Date(saved.endAt).getTime() };
    const inScope = (key) => Object.fromEntries(work.items[key].filter(i => work.plans[key][i.id]).map(i => [i.id, work.plans[key][i.id]]));
    const appts = inScope('appointments');
    let apptJob = false;
    if (Object.keys(appts).length) {
      const fromRole = (people || []).find(u => samePerson(u, awayPerson))?.clinicalRoles?.[0] || null;
      // A background job; its summary arrives as a notification.
      st.runReassignmentJob({
        fromUser: saved.userName, fromUserId: saved.userId, fromUserRole: fromRole, type: 'ooo', window,
        oooRecordId: saved.id, plan: appts, appointments: work.items.appointments,
      });
      apptJob = true;
    }
    // Tasks and care programs move right away; once they have, a toast says
    // so (the drawer has closed by then).
    const taskMoves = MODULES.filter(m => m.key !== 'appointments' && m.key !== 'programs')
      .flatMap(m => Object.entries(inScope(m.key)).filter(([, p]) => p.action === 'reassign')
        .map(([id, p]) => st.updateTask(id, { assigned_to: p.to, assigned_to_id: p.toId })));
    const programs = inScope('programs');
    const programMove = Object.keys(programs).length ? st.reassignCarePrograms(programs) : null;
    if (taskMoves.length || programMove) {
      Promise.all([Promise.allSettled(taskMoves), programMove]).then(([tasksDone, programsOk]) => {
        const tasksOk = taskMoves.length > 0 && tasksDone.every(r => r.status === 'fulfilled' && r.value !== false);
        const progOk = !!programMove && programsOk !== false;
        const what = tasksOk && progOk ? 'Tasks and Programs' : tasksOk ? 'Tasks' : progOk ? 'Programs' : null;
        if (what) toast.success(`${what} Reassigned Successfully`);
      });
    }
    return apptJob;
  };

  const save = async () => {
    setTouched(true);
    if (hasErrors) return;
    setSaving(true);
    try {
      const saved = await saveOooRecord({
        ...record,
        ...values,
        autoReply: autoReplyOn,
        reason: capFirst(values.reason.trim()),
        autoReplyMessage: autoReplyOn ? values.autoReplyMessage.trim() : '',
      });
      if (!saved) return;
      // Dates taken off the record: move appointments that were reassigned
      // away for them back to the provider (from now on), if asked to.
      if (isEdit && change.reduced && restore) {
        const os = new Date(record.startAt).getTime(), oe = new Date(record.endAt).getTime();
        const ns = new Date(saved.startAt).getTime(), ne = new Date(saved.endAt).getTime();
        const removed = [
          ns > os && { from: os, to: Math.min(ns, oe) },
          ne < oe && { from: Math.max(ne, os), to: oe },
        ].filter(Boolean);
        if (removed.length) await restoreReassigned({ id: saved.userId, name: saved.userName }, removed);
      }
      const started = await runReassignments(saved);
      await finish(saved, false, started);
    } finally {
      setSaving(false);
    }
  };

  const title = step === 2 ? 'Reassign Open Work' : isEdit ? 'Edit Out of Office Record' : 'New Out of Office Record';

  const headerRight = step === 1 ? (
    <>
      <Button disabled={touched && hasErrors} onClick={next}>Next</Button>
      <span className={styles.headerDivider} aria-hidden="true" />
    </>
  ) : (
    <>
      <Button variant="outline" disabled={saving} onClick={() => setStep(1)}>Previous</Button>
      <Button disabled={saving || isEdit && !dirty && !MODULES.some(m => Object.keys(work.plans[m.key]).length)} onClick={() => save()} loading={saving}>Save</Button>
      <span className={styles.headerDivider} aria-hidden="true" />
    </>
  );

  const err = (k) => (touched ? errors[k] : undefined);
  // An overlap shows as soon as both dates are set, not only after Save.
  const overlapError = values.startAt && values.endAt ? errors.overlap : undefined;
  const today = new Date();

  // Step 2's record summary: a full-width strip under the header, here and
  // in each module drawer.
  const recordSummary = (
    <OooRecordSummary name={values.userName} startAt={values.startAt} endAt={values.endAt} />
  );

  return (
    <Drawer
      // A new key on the swap mounts a fresh panel, which slides in.
      key={record?.id || 'new'}
      title={title}
      width={640}
      dismissed={!!swapTo}
      onClose={swapTo ? openSwapped : onClose}
      headerRight={headerRight}
      noCloseDivider
      banner={step === 2 ? recordSummary : undefined}
    >
      {step === 2 ? (
        <OooReviewStep
          summary={recordSummary}
          away={awayPerson}
          timeWindow={{ from: new Date(values.startAt).getTime(), to: new Date(values.endAt).getTime() }}
          work={work}
          coverers={coverers}
          missingByName={missingByName}
          phoneTree={phoneTree}
          autoReply={autoReplyOn}
          message={values.autoReplyMessage}
          onMessageChange={(text) => set({ autoReplyMessage: text })}
        />
      ) : (
      <div className={styles.form}>
        {!isEdit && (
          <Banner tone="info" size="sm">Mark users OOO by selecting date range below. Appointments (if any) will be reassigned next.</Banner>
        )}
        {isEdit && change.extended && (
          <Banner icon="solar:info-circle-linear" tone="warning" size="sm">Appointments on the newly added dates can be reassigned once you save.</Banner>
        )}

        {user || isEdit ? (
          <Input label="Provider" required value={providerLabel} disabled readOnly />
        ) : (
          <Select
            label="Provider"
            required
            portal
            searchable
            placeholder="Select a provider"
            options={pickable}
            value={values.userName ? personKey({ id: values.userId, name: values.userName }) : undefined}
            errorText={touched && !values.userName ? 'Pick a provider.' : undefined}
            onValueChange={(key) => {
              const u = users.find(x => personKey(x) === key);
              if (u) set({ userName: u.name, userEmail: u.email || '', userRole: u.role || '', userId: u.id || null });
            }}
          />
        )}


        <div className={styles.dateRow}>
          {/* A record that began before today keeps its start; hovering the
              locked field says why. */}
          <Tooltip label={startLocked ? 'Started on a previous day, so the start can\'t be changed.' : ''} className={styles.recordPickerTip} followCursor maxWidth={240}>
          <DateTimePicker
            label="Start Date & Time"
            required
            fullWidth
            placeholder="Select Start Date & Time"
            hour12
            autoCommit
            minDate={today}
            value={toPickerValue(values.startAt)}
            onChange={(v) => set({ startAt: fromPickerValue(v) })}
            errorText={err('startAt')}
            invalid={!!overlapError}
            disabled={startLocked}
          />
          </Tooltip>
          <DateTimePicker
            label="End Date & Time"
            required
            fullWidth
            placeholder="Select End Date & Time"
            hour12
            autoCommit
            // Not before the start, and for a record under way, not before today.
            minDate={values.startAt && (!started || new Date(values.startAt) > today) ? new Date(values.startAt) : today}
            value={toPickerValue(values.endAt)}
            onChange={(v) => set({ endAt: fromPickerValue(v) })}
            errorText={err('endAt')}
            invalid={!!overlapError}
          />
        </div>
        {/* Overlapping another record: both dates are marked, and the
            reason is said once, across the row. */}
        {overlapError && !partial && <span className={styles.rowError} role="alert">{overlapError}</span>}
        {/* Part of the dates is already out of office (Figma Eventus 17654:115160):
            stretch the existing record(s) over the rest, or keep only the free time.
            New records only; editing one just says the dates clash. */}
        {overlapError && partial && (
          <div className={styles.overlapCard} role="alert">
            <div className={styles.overlapHead}>
              <Icon name="solar:info-circle-linear" size={16} color="var(--status-warning)" />
              <span>This user is already out of office for some of these dates.</span>
            </div>
            <div className={styles.overlapBody}>
              <p className={styles.overlapText}>Extend that record to cover the rest, or create a new one for the remaining dates.</p>
              <div className={styles.overlapActions}>
                <Button size="sm" disabled={saving || !overlap.extend.length} onClick={editExisting}>Edit Existing</Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={saving || !freeTime}
                  onClick={() => set({ startAt: new Date(freeTime.from).toISOString(), endAt: new Date(freeTime.to).toISOString() })}
                >
                  Create New
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Figma Eventus 17620:122123: what changed, whether to move the
            removed dates' appointments back, and (under way) that only the
            ones still ahead can move. Slides open as the dates are cut back. */}
        {isEdit && (
          <Reveal open={change.reduced}>
            <div className={styles.changedCard}>
              <div className={styles.changedBody}>
                <span className={styles.changedTitle}>You have updated the Out of Office schedule:</span>
                <label className={styles.changedCheck}>
                  <Checkbox checked={restore} onCheckedChange={(v) => setRestore(v === true)} aria-label="Restore reassigned appointments from the removed dates" />
                  <span>Move reassigned appointments on removed dates back to {isMine ? 'your' : 'this provider\'s'} calendar</span>
                </label>
              </div>
              {startedToday && (
                <div className={styles.changedNote}>
                  <Icon name="solar:info-circle-linear" size={16} color="var(--status-warning)" />
                  Only upcoming appointments will be restored as out of office period has started.
                </div>
              )}
            </div>
          </Reveal>
        )}

        <Input
          label="Reason for Out of Office"
          value={values.reason}
          placeholder="e.g. Personal, Annual Leave"
          maxLength={120}
          // Sentence case: the first letter is always a capital.
          onChange={(e) => set({ reason: capFirst(e.target.value) })}
        />

        {/* Add Covering Provider (Figma Eventus 17785:116219): one picker,
            or with the toggle off a picker per location. */}
        <div className={styles.coverSection}>
          <div className={styles.coverHead}>
            <span className={styles.coverTitle}>Add Covering Provider</span>
            <span className={styles.coverSub}>
              Who handles this user&apos;s work while they&apos;re away.
              {multiLocation && ' Turn off the toggle to pick a different covering provider for each location.'}
            </span>
          </div>
          {multiLocation && (
            // Our own 14px label (the Switch's built-in one is 12px); the
            // label element makes the text toggle it too.
            <label className={`${styles.changedCheck} ${styles.coverSwitch}`}>
              <Switch checked={sameForAll} onChange={toggleSameForAll} ariaLabel="Use same covering provider for all locations" />
              <span>Use same covering provider for all locations</span>
            </label>
          )}
          {perLocation ? (
            <div className={styles.coverTable} role="table" aria-label="Covering provider per location">
              <div className={`${styles.coverTableRow} ${styles.coverTableHead}`} role="row">
                <span role="columnheader">Location</span>
                <span role="columnheader">Covering Provider</span>
              </div>
              {awayLocations.map(loc => (
                <div key={loc} className={styles.coverTableRow} role="row">
                  <span className={styles.coverTableLoc} role="cell">{loc}</span>
                  <span role="cell">
                    {(() => {
                      const c = (values.coverage || []).find(x => x.location === loc);
                      return (
                        <AssigneeChange
                          size="M"
                          fillContainer
                          showRole={false}
                          unassigned={!c}
                          unassignedLabel="Assign User"
                          name={c?.userName}
                          initials={c ? initialsOf(c.userName) : undefined}
                          ariaLabel={c ? `Covering provider for ${loc}: ${c.userName}` : `Assign a covering provider for ${loc}`}
                          onClick={e => setLocPicker({ loc, rect: e.currentTarget.getBoundingClientRect() })}
                        />
                      );
                    })()}
                  </span>
                </div>
              ))}
              {locPicker && (
                <UserPickerPopover
                  anchorRect={locPicker.rect}
                  align="right"
                  width={350}
                  title="Select Provider"
                  titleCaseSections
                  users={pickerUsers}
                  selected={keyAt(locPicker.loc)}
                  onSelect={u => setLocationCover(locPicker.loc, u.id)}
                  onUnassign={keyAt(locPicker.loc) ? () => setLocationCover(locPicker.loc, null) : undefined}
                  onClose={() => setLocPicker(null)}
                />
              )}
            </div>
          ) : (
            <Select
              label="Select Covering Provider"
              portal
              searchable
              placeholder="Select Provider"
              searchPlaceholder="Search by name, email or role"
              options={coverOptions}
              value={covererKey}
              disabled={!values.userName}
              onValueChange={(key) => {
                const u = findPerson(key);
                set({ coverage: u ? coverageFor(u, awayLocations) : [] });
              }}
            />
          )}
          {coverWarnings.map(w => (
            <Banner key={w.key} icon="solar:danger-triangle-linear" tone="warning" size="sm">{w.text}</Banner>
          ))}
        </div>


        {/* On call schedule: parked for now (the drawer is built,
            OnCallScheduleDrawer.jsx). Restore this link and the drawer below
            to bring it back.
        <span>
          <Link
            className={styles.newRecordLink}
            role="button"
            tabIndex={0}
            onClick={() => setOnCallOpen(true)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOnCallOpen(true); } }}
          >
            <AddIconMinimalist size={12} color="currentColor" />
            On Call Schedule
          </Link>
        </span>
        */}
      </div>
      )}
      {/* {onCallOpen && (
        <OnCallScheduleDrawer
          preset={{ phoneTreeType: 'Out of Office', fromDate: isoDay(values.startAt), toDate: isoDay(values.endAt) }}
          oooRecordId={record?.id}
          excludeUser={values.userName}
          onClose={() => setOnCallOpen(false)}
        />
      )} */}
    </Drawer>
  );
}
