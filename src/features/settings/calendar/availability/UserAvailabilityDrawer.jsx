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
import { Collapse } from '../../../../components/Collapse/Collapse';
import { Badge } from '../../../../components/Badge/Badge';
import { Link } from '../../../../components/Link/Link';
import { TimePicker } from '../../../../components/TimePicker/TimePicker';
import { Tooltip } from '../../../../components/Tooltip/Tooltip';
import { InfoBar } from '../../../../components/InfoBar/InfoBar';
import { AddIconMinimalist } from '../../../../components/Icon/AddIconMinimalist';
import { toast } from '../../../../components/Toast/sonnerToast';
import { CloneFromUserDrawer } from './CloneFromUserDrawer';
import { BlockSummary, BlockMeta } from './BlockSummary';
import { useAppStore } from '../../../../store/useAppStore';
import { FALLBACK_APPOINTMENT_TYPES } from '../../../../components/ScheduleDrawer/scheduleDrawerConstants';
import {
  RECURRENCES, WEEK_ORDINALS, sortOrdinals, cadenceSentence, TIMEZONES, ALL_TYPES, newBlock, newSlot, ruleSummary, validateBlock, blockStatus, STATUS_LOOK,
  findConflicts, conflictText, isBlankBlock,
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
 */
export function UserAvailabilityDrawer({ user: initialUser, users, addBlock = false, cloneFrom = null, onClose }) {
  const locations = useAppStore(s => s.practiceLocations);
  const fetchPracticeLocations = useAppStore(s => s.fetchPracticeLocations);
  const appointmentTypes = useAppStore(s => s.appointmentTypes);
  const fetchAppointmentTypes = useAppStore(s => s.fetchAppointmentTypes);
  const saveUserAvailability = useAppStore(s => s.saveUserAvailability);
  useEffect(() => { fetchPracticeLocations?.(); fetchAppointmentTypes?.(); }, [fetchPracticeLocations, fetchAppointmentTypes]);

  const [userName, setUserName] = useState(initialUser?.name || '');
  const user = initialUser || users.find(u => u.name === userName) || null;
  const copyBlocks = (list) => (list || []).map(b => ({ ...b, id: null, days: [...b.days], weeks: [...b.weeks], slots: b.slots.map(sl => ({ ...sl })) }));
  const clones = useMemo(() => (cloneFrom ? copyBlocks(cloneFrom.blocks) : []), [cloneFrom]);
  const [blocks, setBlocks] = useState(() => {
    if (cloneFrom) return copyBlocks(cloneFrom.blocks);
    const existing = (initialUser?.blocks || []).map(b => ({ ...b, slots: b.slots.map(s => ({ ...s })) }));
    if (!existing.length) return [newBlock()];
    if (!addBlock) return existing;
    return [...existing, newBlock()];
  });
  // The block that's just been added (from either +):
  // scrolled to and eased in.
  const [freshIndex, setFreshIndex] = useState(() => (addBlock ? (initialUser?.blocks?.length || 0) : -1));
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
    const theirs = (u?.blocks || []).map(b => ({ ...b, slots: b.slots.map(s => ({ ...s })) }));
    if (cloneFrom) {
      setDirty(true);
      setBlocks([...theirs, ...copyBlocks(clones)]);
      setTargetCount(theirs.length);
    } else if (theirs.length) {
      setBlocks(theirs);
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
    return [...set].map(z => ({ value: z, label: z.replace(/_/g, ' ') }));
  }, [blocks]);

  // Folding a card is view state, not an edit: it doesn't mark the form dirty.
  const toggleBlock = (i) => setBlocks(bs => bs.map((b, k) => (k === i ? { ...b, collapsed: !b.collapsed } : b)));

  // Unticking advanced cadence goes back to plain weekly on the same days.
  const setAdvanced = (i, on) => update(i, on
    ? { advanced: true }
    : { advanced: false, repeat: 'weekly', interval: 1, weeks: [] });

  const update = (i, patch) => { setDirty(true); setBlocks(bs => bs.map((b, k) => (k === i ? { ...b, ...patch } : b))); };
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
  const importBlocks = (source, list) => {
    const keep = blocks.length === 1 && isBlankBlock(blocks[0]) ? [] : blocks;
    // importedFromId remembers the source block, so it can't be imported twice.
    const copies = copyBlocks(list).map((b, n) => ({ ...b, collapsed: false, arrive: n + 1, importedFrom: source?.name, importedFromId: list[n].id }));
    setImporting(false);
    setDirty(true);
    // The user's own blocks fold away so the imported ones are what's in view.
    setBlocks([...keep.map(b => ({ ...b, collapsed: true })), ...copies]);
    setFreshIndex(keep.length);
    setFreshTick(t => t + 1);
  };

  // Overlaps are flagged only on newly imported blocks: the user's existing
  // blocks are what they are, and the import is what's being checked.
  const conflicts = findConflicts(blocks).map((c, i) => (blocks[i].arrive ? c : []));
  // An imported block that double-books the user can't be saved.
  const hasConflicts = conflicts.some(c => c.length);
  // How a clash names the other block: the target's own blocks by location
  // (they're listed, not numbered, in Clone); everything else by number.
  const blockNumber = (k) => (cloneFrom ? k - targetCount + 1 : k + 1);
  const blockLabel = (k) => (cloneFrom && k < targetCount
    ? `${user?.name}'s ${blocks[k].location || 'block'}`
    : `Block ${blockNumber(k)}`);

  const errors = blocks.map(validateBlock);
  const invalid = !user || errors.some(e => Object.keys(e).length);

  const save = async () => {
    setTouched(true);
    if (invalid) {
      // Mark the blocks that were checked, so their errors show (a block
      // added afterwards stays clean until the next Save), and open any
      // folded card with a problem so the error is visible.
      setBlocks(bs => bs.map((b, k) => ({ ...b, checked: true, ...(Object.keys(errors[k]).length ? { collapsed: false } : {}) })));
      return;
    }
    setSaving(true);
    const ok = await saveUserAvailability(user, blocks.map(b => ({ ...b, collapsed: undefined, arrive: undefined, importedFrom: undefined, importedFromId: undefined, checked: undefined })));
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
                  <Badge tone="grey" size="S" label={String(blocks.length - targetCount)} />
                </div>
              )}
              <section
                ref={i === freshIndex ? freshRef : undefined}
                style={b.arrive ? { animationDelay: `${(b.arrive - 1) * 90}ms` } : undefined}
                className={[
                  styles.block,
                  b.arrive ? styles.arrive : '',
                  conflicts[i].length ? styles.blockConflict : '',
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
                        Block {blockNumber(i)}
                        {status && <Badge tone={status.tone} size="S" label={status.label} />}
                      </span>
                      {b.collapsed && ruleSummary(b) && <span className={styles.blockSub}>{ruleSummary(b)}</span>}
                    </span>
                  </button>
                  <span className={styles.blockActions}>
                    <ActionButton icon="solar:copy-linear" size="S" tooltip="Duplicate block" onClick={() => cloneBlock(i)} />
                    {shown > 1 && (
                      <>
                        <span className={styles.actionDivider} aria-hidden="true" />
                        <ActionButton
                          icon="solar:trash-bin-minimalistic-linear"
                          size="S"
                          tooltip="Remove block"
                          onClick={() => { setDirty(true); setBlocks(bs => bs.filter((_, k) => k !== i)); }}
                        />
                      </>
                    )}
                  </span>
                </header>

                {conflicts[i].length > 0 && (
                  <InfoBar variant="inline" tone="warning" icon="solar:danger-triangle-linear" className={styles.conflictNote}>
                    {conflicts[i].map(c => (
                      <span key={c.index} className={styles.conflictLine}>
                        Overlaps {blockLabel(c.index)}: {conflictText(c)}
                      </span>
                    ))}
                  </InfoBar>
                )}

                <Collapse open={!b.collapsed}>
                <div className={styles.blockBody}>
                <div className={styles.pair}>
                  <Select
                    label="Location"
                    required
                    searchable
                    options={locationOptions}
                    value={b.location}
                    onChange={(v) => {
                      const loc = (locations || []).find(l => l.name === v);
                      update(i, { location: v, ...(loc?.timezone ? { timezone: loc.timezone } : {}) });
                    }}
                    placeholder="Select location"
                    errorText={e.location}
                  />
                  <Select label="Timezone" required searchable options={tzOptions} value={b.timezone} onChange={(v) => update(i, { timezone: v })} placeholder="Select timezone" errorText={e.timezone} />
                </div>

                <div className={styles.pair}>
                  <DatePicker label="Start date" required value={b.startDate} onSelect={(v) => update(i, { startDate: v })} hasError={!!e.startDate} helperText={e.startDate} />
                  <DatePicker label="End date" required value={b.endDate} min={b.startDate} onSelect={(v) => update(i, { endDate: v })} hasError={!!e.endDate} helperText={e.endDate} />
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

                <div className={styles.field}>
                  <span className={styles.label}>Hours</span>
                  <div className={styles.slotList}>
                    {b.slots.map((s, j) => (
                      <div key={j} className={styles.slotRowWrap}>
                        <div className={styles.slotRow}>
                          <Select
                            searchable
                            options={typeOptions}
                            value={s.appointmentType}
                            placeholder="Appointment type"
                            onChange={(v) => updateSlot(i, j, { appointmentType: v })}
                            wrapperClassName={styles.slotType}
                            aria-label="Appointment type"
                          />
                          <TimePicker value={s.start} placeholder="Start time" onChange={(v) => updateSlot(i, j, { start: v, ...(s.end && s.end <= v ? { end: '' } : {}) })} aria-label="Start time" wrapperClassName={styles.slotTime} />
                          <span className={styles.to}>to</span>
                          <TimePicker value={s.end} placeholder="End time" defaultTime={s.start} onChange={(v) => updateSlot(i, j, { end: s.start && v <= s.start ? '' : v })} aria-label="End time" wrapperClassName={styles.slotTime} />
                          <ActionButton
                            size="S"
                            tooltip="Remove time range"
                            state={b.slots.length > 1 ? 'active' : 'disabled'}
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

                {ruleSummary(b) && (
                  <div className={styles.summary}><BlockMeta block={b} /></div>
                )}
                </div>
                </Collapse>
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
          <Tooltip label={hasConflicts ? 'Resolve availability conflict before saving' : ''} placement="bottom" align="right">
            <Button
              variant="primary"
              size="L"
              onClick={save}
              disabled={saving || hasConflicts}
              // A disabled button swallows hover, so let it reach the tooltip's wrapper.
              style={hasConflicts ? { pointerEvents: 'none' } : undefined}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </Tooltip>
        )}
      >
        <div className={styles.form}>
          {cloneFrom && (
            <InfoBar variant="inline">
              Copying {cloneFrom.blocks.length} availability block{cloneFrom.blocks.length === 1 ? '' : 's'} from {cloneFrom.name}. Pick who they're for; any availability they already have is kept.
            </InfoBar>
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
              onChange={pickUser}
              placeholder="Select user"
              errorText={touched && !user ? 'Choose a user.' : undefined}
            />
            <div className={styles.blocksHead}>
              <span className={styles.blocksTitle}>Availability blocks</span>
              <span className={styles.blockActions}>
                <Button
                  variant="tertiary"
                  size="S"
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
                      variant="secondary"
                      size="S"
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
                <Badge tone="grey" size="S" label={String(targetCount)} />
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


          {blocks.map((b, i) => (b.arrive ? null : renderBlock(b, i)))}

          {/* Blocks imported from another user: one highlighted group per
              source, until saved, so it's clear what's new and from whom. */}
          {[...new Set(blocks.filter(b => b.arrive).map(b => b.importedFrom))].map(from => {
            const count = blocks.filter(b => b.arrive && b.importedFrom === from).length;
            return (
              <section key={from || 'imported'} className={[styles.newGroup, styles.arrive].join(' ')}>
                <div className={styles.groupLabel}>
                  <span className={styles.groupTitle}>{from ? `Imported from ${from}` : 'Imported'}</span>
                  <Badge tone="primary" size="S" label={String(count)} className={styles.countBadge} />
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
