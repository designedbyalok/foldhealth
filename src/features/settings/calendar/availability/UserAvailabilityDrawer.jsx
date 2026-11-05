import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from '../../../../components/Drawer/Drawer';
import { Button } from '../../../../components/Button/Button';
import { Select } from '../../../../components/Select/Select';
import { DatePicker } from '../../../../components/DatePicker/DatePicker';
import { WeekdayPicker } from '../../../../components/WeekdayPicker/WeekdayPicker';
import { Switch } from '../../../../components/Switch/Switch';
import { NumberUnitInput } from '../../../../components/NumberUnitInput/NumberUnitInput';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { ConfirmDialog } from '../../../../components/ConfirmDialog/ConfirmDialog';
import { Icon } from '../../../../components/Icon/Icon';
import { CloseIcon } from '../../../../components/Icon/CloseIcon';
import { DownChevronIcon } from '../../../../components/Icon/DownChevronIcon';
import { CollapsibleContent } from '../../../../components/Collapsible/Collapsible';
import { Badge } from '../../../../components/Badge/Badge';
import { Link } from '../../../../components/Link/Link';
import { TimePicker } from '../../../../components/TimePicker/TimePicker';
import { Tooltip } from '../../../../components/Tooltip/Tooltip';
import { Banner } from '../../../../components/Banner/Banner';
import { RadioOptionGroup } from '../../../../components/RadioOptionGroup/RadioOptionGroup';
import { recordsFor, oooStatus, formatDate as oooDate } from '../../../ooo/oooUtils';
import { AddIconMinimalist } from '../../../../components/Icon/AddIconMinimalist';
import { toast } from '../../../../components/Toast/sonnerToast';
import { CloneFromUserDrawer } from './CloneFromUserDrawer';
import { BlockSummary, BlockMeta } from './BlockSummary';
import { useAppStore } from '../../../../store/useAppStore';
import { FALLBACK_APPOINTMENT_TYPES } from '../../../../components/ScheduleDrawer/scheduleDrawerConstants';
import {
  RECURRENCES, WEEK_ORDINALS, sortOrdinals, cadenceSentence, TIMEZONES, ALL_TYPES, newBlock, newSlot, ruleSummary, validateBlock, blockStatus, STATUS_LOOK,
  findConflicts, conflictText, isBlankBlock, timezoneLabel, shortDays, shortHours, timezoneAbbr,
} from './availabilityUtils';
import styles from './UserAvailability.module.css';

const HIGHLIGHT_MS = 3000;
// "Repeats every [n] [unit]": the unit picks the recurrence. Singular for
// 1 ("1 Month"), plural otherwise ("3 Months").
const unitOptions = (n) => RECURRENCES.map(r => {
  const unit = Number(n) === 1 ? r.unit.replace(/s$/, '') : r.unit;
  return { value: r.value, label: unit[0].toUpperCase() + unit.slice(1) };
});

/**
 * Add / edit a user's availability. Each block is one card: where (location,
 * timezone), when it repeats (weekly on chosen days; with advanced cadence,
 * every N days, weeks or months, monthly on chosen occurrences of chosen
 * weekdays), between which dates, and the hours per appointment
 * type. A plain-English line under each card says what it will do. Saving
 * replaces the user's blocks with what's here.
 *
 * @param {object|null} props.user  – null for New: pick the user first
 * @param {object[]}    props.users – users to pick from (with their blocks)
 * @param {boolean}     [props.addBlock] – open with a new block after the
 *   user's existing ones, scrolled into view
 * @param {object}      [props.cloneFrom] – a user whose blocks are copied to
 *   the user picked here (added after any the target already has)
 * @param {'old'|'new'} [props.variant='old'] – 'new' calls blocks slots and
 *   adds: an optional end date, a "Skips holidays" switch (on by default),
 *   overlaps allowed with an explicit tick, an OOO warning, and "Also apply
 *   to" more users
 */
// What a slot is, for remembering an accepted overlap: where and when it runs.
const slotSignature = (b) => JSON.stringify([
  String(b.location || '').toLowerCase(), b.timezone || '', b.startDate || '', b.endDate || '',
  b.repeat || '', Number(b.interval) || 1, [...(b.days || [])].sort(), [...(b.weeks || [])].sort(),
  (b.slots || []).map(s => [s.appointmentType || '', s.start || '', s.end || '']),
]);
const ACK_KEY = 'ua-overlap-acks';
const readOverlapAcks = () => {
  try { return new Set(JSON.parse(localStorage.getItem(ACK_KEY) || '[]')); } catch { return new Set(); }
};
const rememberOverlapAcks = (keys) => {
  try {
    const all = readOverlapAcks();
    keys.forEach(k => all.add(k));
    // Keep the newest few hundred; old ones only matter if the same slots come back.
    localStorage.setItem(ACK_KEY, JSON.stringify([...all].slice(-500)));
  } catch { /* storage unavailable: the save's allowOverlap still records it */ }
};

export function UserAvailabilityDrawer({ user: initialUser, users, addBlock = false, focusBlockId = null, cloneFrom = null, variant = 'old', onClose }) {
  const isNew = variant === 'new';
  const oooRecords = useAppStore(s => s.oooRecords);
  const locations = useAppStore(s => s.practiceLocations);
  const fetchPracticeLocations = useAppStore(s => s.fetchPracticeLocations);
  const appointmentTypes = useAppStore(s => s.appointmentTypes);
  const fetchAppointmentTypes = useAppStore(s => s.fetchAppointmentTypes);
  const saveUserAvailability = useAppStore(s => s.saveUserAvailability);
  const storedBlocks = useAppStore(s => s.userAvailability);
  useEffect(() => { fetchPracticeLocations?.(); fetchAppointmentTypes?.(); }, [fetchPracticeLocations, fetchAppointmentTypes]);

  const [userName, setUserName] = useState(initialUser?.name || '');
  const user = initialUser || users.find(u => u.name === userName) || null;
  const copyBlocks = (list) => (list || []).map(b => ({ ...b, id: null, days: [...b.days], weeks: [...b.weeks], slots: b.slots.map(sl => ({ ...sl })) }));
  // Every slot the user has, past ones included, current first. The list a
  // caller passes may be filtered (the List hides past slots by default), and
  // saving writes the drawer's slots as the whole set: a slot left out here
  // would be deleted.
  const ownBlocks = (u) => {
    if (!u) return [];
    const all = (storedBlocks || []).filter(b => String(b.userName || '').toLowerCase() === String(u.name || '').toLowerCase());
    const list = all.length || !(u.blocks || []).length ? all : u.blocks;
    return [...list]
      .sort((a, b) => (blockStatus(a) === 'expired') - (blockStatus(b) === 'expired'))
      .map(b => ({ ...b, slots: (b.slots || []).map(sl => ({ ...sl })) }));
  };
  const clones = useMemo(() => (cloneFrom ? copyBlocks(cloneFrom.blocks) : []), [cloneFrom]);
  const [blocks, setBlocks] = useState(() => {
    if (cloneFrom) return copyBlocks(cloneFrom.blocks);
    const existing = ownBlocks(initialUser);
    if (!existing.length) return [newBlock()];
    if (!addBlock) return existing;
    return [...existing, newBlock()];
  });
  // New view: Skips holidays is set once for the user's whole availability
  // and stamped on every slot when it saves.
  const [skipHolidays, setSkipHolidays] = useState(() => blocks.every(b => b.skipHolidays !== false));
  // The block that's just been added (from either +):
  // scrolled to and eased in.
  // Opened from a slot in the Weekly view: that slot gets the same scroll + highlight.
  const [freshIndex, setFreshIndex] = useState(() => {
    if (addBlock) return blocks.length - 1;
    if (focusBlockId) return blocks.findIndex(b => b.id === focusBlockId);
    return -1;
  });
  // The new block wears a highlight (primary outline, lifted purple shadow)
  // for 3 seconds, then eases back to a normal card.
  const [highlightIndex, setHighlightIndex] = useState(freshIndex);
  // Bumped on every add / clone so the scroll and highlight restart even when
  // the new block lands at the same index as the last one.
  const [freshTick, setFreshTick] = useState(0);
  const freshRef = useRef(null);
  useEffect(() => {
    if (freshIndex < 0) return undefined;
    // After the drawer's own slide-in, so the scroll reads as one motion.
    const scroll = setTimeout(() => freshRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 280);
    const fade = setTimeout(() => setHighlightIndex(-1), 280 + HIGHLIGHT_MS);
    return () => { clearTimeout(scroll); clearTimeout(fade); };
  }, [freshIndex, freshTick]);
  // Saved slots whose dates are over sit in their own folded section.
  const isPast = (b) => !!b.id && blockStatus(b) === 'expired';
  const pastCount = blocks.filter(b => !b.arrive && isPast(b)).length;
  // Folded, unless the slot being opened on is a past one.
  const [pastOpen, setPastOpen] = useState(() => freshIndex >= 0 && isPast(blocks[freshIndex] || {}));
  const [touched, setTouched] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Picking a user for New loads what they already have.
  // Cloning keeps the target's own blocks and adds the copies after them.
  // targetCount: how many blocks at the top are the target's own (they
  // slide in, one after another, when the target is picked).
  const [targetCount, setTargetCount] = useState(0);
  const pickUser = (name) => {
    setUserName(name);
    const u = users.find(x => x.name === name);
    const theirs = ownBlocks(u);
    if (cloneFrom) {
      setDirty(true);
      setBlocks([...theirs, ...copyBlocks(clones)]);
      setTargetCount(theirs.length);
    } else if (theirs.length) {
      setBlocks(theirs);
      setSkipHolidays(theirs.every(b => b.skipHolidays !== false));
    }
  };

  const locationOptions = useMemo(() => {
    const names = new Set((locations || []).map(l => l.name));
    blocks.forEach(b => b.location && names.add(b.location));
    return [...names].sort().map(n => ({ value: n, label: n }));
  }, [locations, blocks]);
  const typeOptions = useMemo(() => {
    const names = (appointmentTypes?.length ? appointmentTypes : FALLBACK_APPOINTMENT_TYPES).map(t => t.name);
    return [ALL_TYPES, ...names].map(n => ({ value: n, label: n }));
  }, [appointmentTypes]);
  const tzOptions = useMemo(() => {
    const set = new Set(TIMEZONES);
    blocks.forEach(b => b.timezone && set.add(b.timezone));
    return [...set].map(z => ({ value: z, label: timezoneLabel(z) }));
  }, [blocks]);

  // Folding a card is view state, not an edit: it doesn't mark the form dirty.
  const toggleBlock = (i) => setBlocks(bs => bs.map((b, k) => (k === i ? { ...b, collapsed: !b.collapsed } : b)));

  // Unticking advanced cadence goes back to plain weekly on the same days.
  const setAdvanced = (i, on) => update(i, on
    ? { advanced: true }
    : { advanced: false, repeat: 'weekly', interval: 1, weeks: [] });

  // Changing when a slot runs voids an overlap it was saved with: any overlap
  // it has after the edit is asked about again on Save.
  const SCHEDULE_KEYS = ['startDate', 'endDate', 'rolling', 'advanced', 'repeat', 'interval', 'days', 'weeks', 'slots'];
  const update = (i, patch) => {
    setDirty(true);
    const touchesSchedule = SCHEDULE_KEYS.some(k => k in patch);
    setBlocks(bs => bs.map((b, k) => (k === i ? { ...b, ...patch, ...(touchesSchedule ? { allowOverlap: false } : {}) } : b)));
  };
  const updateSlot = (i, j, patch) => update(i, { slots: blocks[i].slots.map((s, k) => (k === j ? { ...s, ...patch } : s)) });

  // A copy of a block goes right after it, unsaved, and is scrolled to and
  // highlighted like any new block.
  const cloneBlock = (i) => {
    const src = blocks[i];
    const copy = { ...src, id: null, collapsed: false, checked: false, days: [...src.days], weeks: [...src.weeks], slots: src.slots.map(sl => ({ ...sl })) };
    setDirty(true);
    setBlocks(bs => [...bs.slice(0, i + 1), copy, ...bs.slice(i + 1)]);
    setFreshIndex(i + 1);
    setHighlightIndex(i + 1);
    setFreshTick(t => t + 1);
  };

  // Import from other users: copies of another user's blocks go after these ones (replacing
  // the untouched starter block, if that's all there is) and ease in one
  // after another (the slide-in marks them as new); the first is scrolled to.
  const [importing, setImporting] = useState(false);
  const importBlocks = (list) => {
    const keep = blocks.length === 1 && isBlankBlock(blocks[0]) ? [] : blocks;
    // importedFromId remembers the source block, so it can't be imported twice;
    // importedFrom (whose it was) comes with each one, as they may be from several users.
    const copies = copyBlocks(list).map((b, n) => ({ ...b, collapsed: false, arrive: n + 1, importedFrom: list[n].importedFrom, importedFromId: list[n].id }));
    setImporting(false);
    setDirty(true);
    // The user's own blocks fold away so the imported ones are what's in view.
    setBlocks([...keep.map(b => ({ ...b, collapsed: true })), ...copies]);
    setFreshIndex(keep.length);
    setFreshTick(t => t + 1);
  };

  // Overlaps are flagged only on newly imported blocks: the user's existing
  // blocks are what they are, and the import is what's being checked.
  // New view: every block is checked, and an overlap can be allowed (it may
  // double-book) instead of blocking the save.
  const conflicts = findConflicts(blocks).map((c, i) => (isNew || blocks[i].arrive ? c : []));
  // New view: overlapping slots are allowed (the slot says where it may
  // double-book); only the old view blocks saving on them.
  const userOoo = useMemo(
    () => (user ? recordsFor(oooRecords, { id: user.id, name: user.name }).filter(r => oooStatus(r) !== 'Past') : []),
    [oooRecords, user],
  );
  const slotOoo = (b) => (!b.startDate ? [] : userOoo.filter(r => String(r.endAt).slice(0, 10) >= b.startDate
    && (!b.endDate || String(r.startAt).slice(0, 10) <= b.endDate)));
  const hasConflicts = !isNew && conflicts.some(c => c.length);
  // How a clash names the other block: the target's own blocks by location
  // (they're listed, not numbered, in Clone); everything else by number.
  const blockNumber = (k) => (cloneFrom ? k - targetCount + 1 : k + 1);
  const unit = isNew ? 'Slot' : 'Block';
  const blockLabel = (k) => (cloneFrom && k < targetCount
    ? `${user?.name}'s ${blocks[k].location || unit.toLowerCase()}`
    : `${unit} ${blockNumber(k)}`);

  const errors = blocks.map((b) => {
    const e = validateBlock(b);
    // New view: a rolling slot has no end date; it repeats until stopped.
    if (isNew && b.rolling) delete e.endDate;
    return e;
  });
  const invalid = !user || errors.some(e => Object.keys(e).length);
  // Save waits for something to save and every required field; the tooltip
  // on the disabled button says which.
  const saveBlocker = !dirty ? 'No changes to save'
    : invalid ? 'Fill in all required fields to save'
      : hasConflicts ? 'Resolve availability conflict before saving'
        : '';

  // Overlaps not yet accepted. A pair is accepted once both slots were saved
  // with allowOverlap, or once it was accepted here before: those are
  // remembered by what the two slots are (where and when they run), so the
  // same overlap isn't asked about again even before the allow_overlap column
  // exists. Changing either slot's schedule makes it a new overlap.
  const pairKey = (i, j) => [blocks[i], blocks[j]].map(slotSignature).sort().join('||') + `@@${user?.name || ''}`;
  const newOverlaps = !isNew ? [] : conflicts.flatMap((cs, i) => cs
    .filter(c => c.index > i
      && !(blocks[i].allowOverlap && blocks[c.index].allowOverlap)
      && !readOverlapAcks().has(pairKey(i, c.index)))
    .map(c => [i, c.index]));
  const [ackOpen, setAckOpen] = useState(false);

  const save = async ({ acknowledged = false } = {}) => {
    setTouched(true);
    if (invalid) {
      // Mark the blocks that were checked, so their errors show (a block
      // added afterwards stays clean until the next Save), and open any
      // folded card with a problem so the error is visible.
      setBlocks(bs => bs.map((b, k) => ({ ...b, checked: true, ...(Object.keys(errors[k]).length ? { collapsed: false } : {}) })));
      return;
    }
    // Overlaps are allowed, but taken on knowingly: asked once, then remembered.
    if (newOverlaps.length && !acknowledged) { setAckOpen(true); return; }
    const overlapping = new Set(isNew ? conflicts.flatMap((cs, i) => (cs.length ? [i] : [])) : []);
    setSaving(true);
    const clean = blocks.map((b, k) => ({
      ...b, collapsed: undefined, arrive: undefined, importedFrom: undefined, importedFromId: undefined, checked: undefined,
      ...(isNew ? { skipHolidays, allowOverlap: overlapping.has(k) } : {}),
    }));
    const ok = await saveUserAvailability(user, clean);
    setSaving(false);
    if (ok) {
      toast.success(`Availability saved for ${user.name}`);
      setDismissed(true);
    }
  };

  // One block card. Called for the user's own blocks and, separately, for
  // the newly imported ones (which sit in their own group below).
  const renderBlock = (b, i) => {
            if (cloneFrom && i < targetCount) return null;
            const e = b.checked ? errors[i] : {};
            const status = b.id ? STATUS_LOOK[blockStatus(b)] : null;
            const shown = cloneFrom ? blocks.length - targetCount : blocks.length;
            return (
              <Fragment key={b.id || `new-${i}`}>
              {cloneFrom && targetCount > 0 && i === targetCount && (
                <div className={styles.groupLabel}>
                  <span className={styles.groupTitle}>Copied from {cloneFrom.name}</span>
                  <Badge size="sm" label={String(blocks.length - targetCount)} />
                </div>
              )}
              <section
                ref={i === freshIndex ? freshRef : undefined}
                style={b.arrive ? { animationDelay: `${(b.arrive - 1) * 90}ms` } : undefined}
                className={[
                  styles.block,
                  b.arrive ? styles.arrive : '',
                  conflicts[i].length ? (isNew ? styles.blockConflictNew : styles.blockConflict) : '',
                  i === freshIndex ? styles.blockFresh : '',
                  i === highlightIndex && !b.arrive ? styles.blockHighlight : '',
                ].filter(Boolean).join(' ')}
              >
                {/* Same card as the insurance plan form's sections: a header over
                    a hairline, the chevron leading the title. */}
                <header className={[styles.blockHead, b.collapsed ? styles.blockHeadShut : ''].join(' ')}>
                  <button
                    type="button"
                    className={styles.blockToggle}
                    aria-expanded={!b.collapsed}
                    onClick={() => toggleBlock(i)}
                  >
                    <DownChevronIcon size={16} color="var(--neutral-300)" className={[styles.blockChevron, b.collapsed ? styles.blockChevronShut : ''].join(' ')} />
                    <span className={styles.blockTitleText}>
                      <span className={styles.blockTitle}>
                        {unit} {blockNumber(i)}
                        {status && <Badge tone={status.tone} size="sm" label={status.label} />}
                      </span>
                      {b.collapsed && ruleSummary(b) && <span className={styles.blockSub}>{ruleSummary(b)}</span>}
                    </span>
                  </button>
                  <span className={styles.blockActions}>
                    <ActionButton icon="solar:copy-linear" size="sm" tooltip="Duplicate block" onClick={() => cloneBlock(i)} />
                    {shown > 1 && (
                      <>
                        <span className={styles.actionDivider} aria-hidden="true" />
                        <ActionButton
                          icon="solar:trash-bin-minimalistic-linear"
                          size="sm"
                          tooltip="Remove block"
                          onClick={() => { setDirty(true); setBlocks(bs => bs.filter((_, k) => k !== i)); }}
                        />
                      </>
                    )}
                  </span>
                </header>

                {!isNew && conflicts[i].length > 0 && (
                  <Banner size="sm" tone="warning" icon="solar:danger-triangle-linear" className={styles.conflictNote}>
                    {conflicts[i].map(c => (
                      <span key={c.index} className={styles.conflictLine}>
                        Overlaps {blockLabel(c.index)}: {conflictText(c)}
                      </span>
                    ))}
                  </Banner>
                )}

                <CollapsibleContent open={!b.collapsed}>
                <div className={styles.blockBody}>
                {/* New view: overlaps are allowed; the alert at the top of the slot says where. */}
                {isNew && conflicts[i].length > 0 && (
                  // A title, then one line per overlapping slot (which days, which hours).
                  <Banner icon="solar:info-circle-linear" size="sm" tone="warning" className={styles.conflictNoteNew}>
                    <span className={styles.conflictTitle}>Schedule Conflict</span>
                    {conflicts[i].map((c) => {
                      // The other slot's location whenever it has one; its timezone
                      // when it differs (the hours shown are in this slot's zone).
                      const o = blocks[c.index] || {};
                      const where = o.location ? ` at ${o.location}` : '';
                      const tz = b.timezone && o.timezone && o.timezone !== b.timezone ? ` (${timezoneAbbr(b.timezone)})` : '';
                      return (
                        <span key={c.index} className={styles.conflictLine}>
                          {`Overlaps ${blockLabel(c.index)}${where} on ${shortDays(c.days)}, ${c.hours.map(shortHours).join(', ')}${tz}.`}
                        </span>
                      );
                    })}
                    <span className={styles.conflictLine}>Double booking may occur during overlapping availability.</span>
                  </Banner>
                )}
                {isNew && (
                  <RadioOptionGroup
                    name={`slot-span-${i}`}
                    className={styles.spanRadios}
                    options={[{ value: 'fixed', label: 'Fixed Slot' }, { value: 'rolling', label: 'Rolling Slot' }]}
                    value={b.rolling ? 'rolling' : 'fixed'}
                    // Rolling drops the end date; Fixed asks for one again.
                    onChange={(v) => update(i, v === 'rolling' ? { rolling: true, endDate: '' } : { rolling: false })}
                  />
                )}
                <div className={styles.pair}>
                  <Select
                    label="Location"
                    required
                    searchable
                    options={locationOptions}
                    value={b.location}
                    onValueChange={(v) => {
                      const loc = (locations || []).find(l => l.name === v);
                      update(i, { location: v, ...(loc?.timezone ? { timezone: loc.timezone } : {}) });
                    }}
                    placeholder="Select location"
                    errorText={e.location}
                  />
                  <Select label="Timezone" required searchable options={tzOptions} value={b.timezone} onValueChange={(v) => update(i, { timezone: v })} placeholder="Select timezone" errorText={e.timezone} />
                </div>

                <div className={styles.pair}>
                  <DatePicker label="Start date" required value={b.startDate} onSelect={(v) => update(i, { startDate: v, ...(b.endDate && v && b.endDate < v ? { endDate: '' } : {}) })} hasError={!!e.startDate} helperText={e.startDate} />
                  {!(isNew && b.rolling) && (
                    <DatePicker
                      label="End date"
                      required
                      value={b.endDate}
                      min={b.startDate}
                      onSelect={(v) => update(i, { endDate: v })}
                      hasError={!!e.endDate}
                      helperText={e.endDate}
                    />
                  )}
                </div>

                <Switch checked={!!b.advanced} onChange={(v) => setAdvanced(i, !!v)} label="Advanced cadence" className={styles.cadenceSwitch} />

                {!b.advanced ? (
                  <WeekdayPicker label="On days (Repeats Weekly)" value={b.days} onChange={(days) => update(i, { days })} errorText={e.days} />
                ) : (
                  <div className={styles.advPanel}>
                    {/* "Repeats every" and (weekly) its days share a line; monthly puts
                        "On" and "Days" together on the next. */}
                    <div className={styles.cadenceRow}>
                    <NumberUnitInput
                      label="Repeats every"
                      value={b.interval}
                      onChange={(n) => update(i, { interval: n })}
                      unit={b.repeat}
                      units={unitOptions(b.interval)}
                      onUnitChange={(v) => update(i, { repeat: v, weeks: v === 'monthly' && !b.weeks.length ? [1] : b.weeks })}
                      errorText={e.interval}
                      className={styles.everyField}
                    />

                    {b.repeat === 'weekly' && (
                      <WeekdayPicker label="On days" value={b.days} onChange={(days) => update(i, { days })} errorText={e.days} />
                    )}

                    </div>
                    {b.repeat === 'monthly' && (
                      <div className={`${styles.cadenceRow} ${styles.halves}`}>
                        {/* "On [3rd]" beside "Days [Tue, Thu]": the 3rd Tuesday and Thursday. */}
                          <div className={`${styles.field} ${styles.onField}`}>
                            <span className={styles.label}>On</span>
                            <div className={styles.chips}>
                              {WEEK_ORDINALS.map(w => {
                                const on = b.weeks.includes(w.value);
                                return (
                                  <button
                                    type="button"
                                    key={w.value}
                                    aria-pressed={on}
                                    className={[styles.chip, on ? styles.chipOn : ''].join(' ')}
                                    onClick={() => update(i, { weeks: on ? b.weeks.filter(x => x !== w.value) : sortOrdinals([...b.weeks, w.value]) })}
                                  >
                                    {w.label}
                                  </button>
                                );
                              })}
                            </div>
                            {e.weeks && <span className={styles.error}>{e.weeks}</span>}
                          </div>
                          <WeekdayPicker label="Days" value={b.days} onChange={(days) => update(i, { days })} errorText={e.days} />
                      </div>
                    )}
                    {cadenceSentence(b) && <span className={`${styles.hint} ${styles.cadenceHint}`}>{cadenceSentence(b)}</span>}
                  </div>
                )}

                <div className={`${styles.field} ${styles.hoursSection}`}>
                  <span className={`${styles.label} ${styles.labelStrong}`}>Availability hours</span>
                  <div className={styles.slotList}>
                    {/* Column labels, lined up with the fields below (each field has its own aria-label). */}
                    <div className={`${styles.slotRow} ${styles.slotHead}`} aria-hidden="true">
                      <span className={`${styles.slotType} ${styles.slotHeadLabel}`}>Appointment Type<span className={styles.requiredDot} /></span>
                      <span className={`${styles.slotTime} ${styles.slotHeadLabel}`}>Start Time<span className={styles.requiredDot} /></span>
                      <span className={`${styles.to} ${styles.slotHeadSpacer}`}>to</span>
                      <span className={`${styles.slotTime} ${styles.slotHeadLabel}`}>End Time<span className={styles.requiredDot} /></span>
                      <span className={styles.slotHeadAction} />
                    </div>
                    {b.slots.map((s, j) => (
                      <div key={j} className={styles.slotRowWrap}>
                        <div className={styles.slotRow}>
                          <Select
                            searchable
                            options={typeOptions}
                            value={s.appointmentType}
                            placeholder="Appointment type"
                            onValueChange={(v) => updateSlot(i, j, { appointmentType: v })}
                            wrapperClassName={styles.slotType}
                            aria-label="Appointment type"
                          />
                          <TimePicker value={s.start} placeholder="Start time" onChange={(v) => updateSlot(i, j, { start: v, ...(s.end && s.end <= v ? { end: '' } : {}) })} aria-label="Start time" wrapperClassName={styles.slotTime} />
                          <span className={styles.to}>to</span>
                          <TimePicker value={s.end} placeholder="End time" defaultTime={s.start} after={s.start} onChange={(v) => updateSlot(i, j, { end: s.start && v <= s.start ? '' : v })} aria-label="End time" wrapperClassName={styles.slotTime} />
                          <ActionButton
                            size="sm"
                            tooltip="Remove time range"
                            disabled={!(b.slots.length > 1)}
                            onClick={() => b.slots.length > 1 && update(i, { slots: b.slots.filter((_, k) => k !== j) })}
                          >
                            <CloseIcon size={16} color={b.slots.length > 1 ? 'var(--neutral-300)' : 'var(--neutral-200)'} />
                          </ActionButton>
                        </div>
                        {e.slotErrors?.[j] && <span className={styles.error}>{e.slotErrors[j]}</span>}
                      </div>
                    ))}
                  </div>
                  <span>
                    <Link className={styles.addLink} onClick={() => update(i, { slots: [...b.slots, newSlot()] })}>
                      <AddIconMinimalist size={16} color="currentColor" />
                      Add time range
                    </Link>
                  </span>
                </div>

                {/* Out-of-office days in this slot: at the end of the card, just above its summary. */}
                {isNew && (() => {
                  // Out of office on any of this slot's dates. A rolling slot
                  // has no end, so every OOO from its start on counts.
                  const out = slotOoo(b);
                  if (!out.length) return null;
                  return (
                    <Banner size="sm" tone="info">
                      This slot includes the user&apos;s out-of-office days ({out.map(r => `${oooDate(r.startAt)} – ${oooDate(r.endAt)}`).join(', ')}). Availability does not apply to those days.
                    </Banner>
                  );
                })()}
                {ruleSummary(b) && (
                  <div className={styles.summary}><BlockMeta block={b} /></div>
                )}
                </div>
                </CollapsibleContent>
              </section>
              </Fragment>
            );
  };

  return (
    <>
      <Drawer
        title={initialUser ? 'Edit availability' : cloneFrom ? 'Clone availability' : 'Add availability'}
        onClose={onClose}
        dismissed={dismissed}
        beforeClose={() => {
          if (!dirty || dismissed) return true;
          setConfirmClose(true);
          return false;
        }}
        primaryAction={(
          <Tooltip label={saveBlocker} placement="bottom" align="right">
            <Button
              onClick={() => save()}
              disabled={!!saveBlocker}
              // A disabled button swallows hover, so let it reach the tooltip's wrapper.
              style={saveBlocker ? { pointerEvents: 'none' } : undefined} loading={saving}
            >
              Save
            </Button>
          </Tooltip>
        )}
      >
        <div className={styles.form}>
          {cloneFrom && (
            <Banner size="sm">
              Copying {cloneFrom.blocks.length} availability block{cloneFrom.blocks.length === 1 ? '' : 's'} from {cloneFrom.name}. Pick who they're for; any availability they already have is kept.
            </Banner>
          )}
          {/* User and the blocks heading stay put; only the blocks scroll. */}
          <div className={styles.stickyTop}>
            {/* The user: picked here for New; fixed (shown, not editable) when editing. */}
            <Select
              label={cloneFrom ? 'Clone for' : 'User'}
              required
              searchable={!initialUser}
              disabled={!!initialUser}
              options={users.filter(u => u.name !== cloneFrom?.name).map(u => ({ value: u.name, label: u.email ? `${u.name} (${u.email})` : u.name }))}
              value={userName}
              onValueChange={pickUser}
              placeholder="Select user"
              errorText={touched && !user ? 'Choose a user.' : undefined}
            />
            <div className={styles.blocksHead}>
              <span className={styles.blocksTitle}>{isNew ? 'Availability slots' : 'Availability blocks'}</span>
              <span className={styles.blockActions}>
                {/* Applies to every slot, so it sits with the slots' actions. */}
                {isNew && (
                  <>
                    <Switch checked={skipHolidays} onChange={(v) => { setSkipHolidays(!!v); setDirty(true); }} label="Skip holidays" labelGap={4} />
                    <span className={styles.actionDivider} aria-hidden="true" />
                  </>
                )}
                <Button
                  variant="soft"
                  size="sm"
                  leadingIconElement={<AddIconMinimalist size={16} color="currentColor" />}
                  onClick={() => {
                    setDirty(true);
                    setFreshIndex(blocks.length);
                    setHighlightIndex(blocks.length);
                    setFreshTick(t => t + 1);
                    setBlocks(bs => [...bs, newBlock()]);
                  }}
                >
                  Add new
                </Button>
                {!cloneFrom && (
                  <Tooltip label={user ? '' : 'Choose a user first'} placement="bottom" align="right">
                    <Button
                      variant="outline"
                      size="sm"
                      leadingIcon="solar:arrow-left-down-linear"
                      disabled={!user}
                      style={user ? undefined : { pointerEvents: 'none' }}
                      onClick={() => setImporting(true)}
                    >
                      Import
                    </Button>
                  </Tooltip>
                )}
              </span>
            </div>
          </div>

          {/* Clone: the target's own blocks, read-only and compact, so the
              copies below can be checked against them at a glance. */}
          {cloneFrom && user && targetCount > 0 && (
            <section className={[styles.current, styles.arrive].join(' ')}>
              <div className={styles.groupLabel}>
                <span className={styles.groupTitle}>{user.name}'s current availability</span>
                <Badge size="sm" label={String(targetCount)} />
              </div>
              <ul className={styles.currentList}>
                {blocks.slice(0, targetCount).map((b, k) => (
                  <li
                    key={b.id || k}
                    className={[styles.currentItem, styles.arrive, conflicts[k].length ? styles.currentConflict : ''].filter(Boolean).join(' ')}
                    style={{ animationDelay: `${(k + 1) * 90}ms` }}
                  >
                    <BlockSummary block={b} title={`Block ${k + 1}`}>
                      {conflicts[k].length > 0 && (
                        <span className={styles.conflictTag}>
                          <Icon name="solar:danger-triangle-linear" size={14} color="currentColor" />
                          Overlaps {conflicts[k].map(c => blockLabel(c.index)).join(', ')}
                        </span>
                      )}
                    </BlockSummary>
                  </li>
                ))}
              </ul>
            </section>
          )}


          {blocks.map((b, i) => (b.arrive || isPast(b) ? null : renderBlock(b, i)))}

          {/* Past slots: kept (saving writes the whole set) but folded away, like
              the collapsible sections in a patient's PAMI tab. */}
          {pastCount > 0 && (
            <section className={styles.pastGroup}>
              <button
                type="button"
                className={styles.pastHead}
                onClick={() => setPastOpen(v => !v)}
                aria-expanded={pastOpen}
              >
                <span className={styles.pastTitle}>Past slots</span>
                <Badge size="sm" label={String(pastCount)} className={styles.pastCount} />
                <DownChevronIcon size={12} color="var(--neutral-200)" style={pastOpen ? undefined : { transform: 'rotate(-90deg)' }} />
              </button>
              <CollapsibleContent open={pastOpen}>
                <div className={styles.pastList}>
                  {blocks.map((b, i) => (!b.arrive && isPast(b) ? renderBlock(b, i) : null))}
                </div>
              </CollapsibleContent>
            </section>
          )}

          {/* Blocks imported from another user: one highlighted group per
              source, until saved, so it's clear what's new and from whom. */}
          {[...new Set(blocks.filter(b => b.arrive).map(b => b.importedFrom))].map(from => {
            const count = blocks.filter(b => b.arrive && b.importedFrom === from).length;
            return (
              <section key={from || 'imported'} className={[styles.newGroup, styles.arrive].join(' ')}>
                <div className={styles.groupLabel}>
                  <span className={styles.groupTitle}>{from ? `Imported from ${from}` : 'Imported'}</span>
                  <Badge tone="primary" size="sm" label={String(count)} className={styles.countBadge} />
                </div>
                {blocks.map((b, i) => (b.arrive && b.importedFrom === from ? renderBlock(b, i) : null))}
              </section>
            );
          })}

        </div>
      </Drawer>

      {importing && (
        <CloneFromUserDrawer
          users={users}
          exclude={user?.name}
          imported={blocks.map(b => b.importedFromId).filter(Boolean)}
          target={user}
          onImport={importBlocks}
          onClose={() => setImporting(false)}
        />
      )}

      {ackOpen && (
        <ConfirmDialog
          variant="primary"
          iconColor="var(--neutral-200)"
          title="Save with overlapping slots?"
          // Every overlapping slot counts, including overlaps accepted before.
          description={`${conflicts.filter(c => c.length).length} slots in this availability are overlapping. Double booking may occur during overlapping availability.`}
          confirmLabel="Save anyway"
          cancelLabel="Cancel"
          onCancel={() => setAckOpen(false)}
          onConfirm={() => {
            rememberOverlapAcks(newOverlaps.map(([i, j]) => pairKey(i, j)));
            setAckOpen(false);
            save({ acknowledged: true });
          }}
        />
      )}

      {confirmClose && (
        <ConfirmDialog
          title="Discard changes?"
          description="Your changes to this availability won't be saved."
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          onCancel={() => setConfirmClose(false)}
          onConfirm={() => { setConfirmClose(false); setDismissed(true); }}
        />
      )}
    </>
  );
}
