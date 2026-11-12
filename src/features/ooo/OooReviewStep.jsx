import { useState } from 'react';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { AssigneeChange } from '../../components/AssigneeChange/AssigneeChange';
import { Avatar } from '../../components/Avatar/Avatar';
import { AvatarGroup } from '../../components/AvatarGroup/AvatarGroup';
import { Banner } from '../../components/Banner/Banner';
import { Button } from '../../components/Button/Button';
import { Drawer } from '../../components/Drawer/Drawer';
import { Icon } from '../../components/Icon/Icon';
import { Skeleton } from '../../components/Skeleton/Skeleton';
import { Textarea } from '../../components/Textarea/Textarea';
import { Tooltip } from '../../components/Tooltip/Tooltip';
import { UserPickerPopover } from '../../components/UserPickerPopover/UserPickerPopover';
import { toast } from '../../components/Toast/sonnerToast';
import { initialsOf } from './oooUtils';
import { NO_DEPARTMENT, planPeople } from './openWork';
import { MODULES } from './useOpenWork';
import { OnCallScheduleDrawer } from './OnCallScheduleDrawer';
import { PROGRAM_SHAPE, TASK_SHAPE } from './openWorkRows';
import { ReassignPlanner } from './ReassignPlanner';
import { ReassignItemsPlanner } from './ReassignItemsPlanner';
import styles from './ooo.module.css';

const shapeOf = (key) => (key === 'programs' ? PROGRAM_SHAPE : TASK_SHAPE);

// The row's "…" action, opened in a new tab so this drawer keeps its place.
const programKey = (p) => String(p.code || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const VIEW = {
  task: {
    label: 'View Task',
    icon: 'solar:eye-linear',
    onSelect: t => window.open(`#/tasks?taskId=${encodeURIComponent(t.id)}`, '_blank', 'noopener'),
  },
  programs: {
    label: 'View Program',
    icon: 'solar:eye-linear',
    onSelect: p => window.open(`#/population/patient/${encodeURIComponent(p.patientId)}/care-management/care-programs/${programKey(p)}`, '_blank', 'noopener'),
  },
};
const deptArg = (d) => (d && d !== NO_DEPARTMENT ? d : null);

// Which card a covering provider's missing access affects (COVER_ACCESS).
const ACCESS_CARDS = {
  Inbox: ['communications'],
  'Manage Tasks & Alerts': ['carePlan', 'medRecon', 'intervention', 'tasks'],
  'Program Worklists': ['programs'],
};

/** What each card says: what happens to current work, then to new work. */
function linesFor(key, covered, autoReply) {
  const existing = covered ? 'Auto-assigned to the covering providers.' : 'Stay with this user.';
  switch (key) {
    case 'appointments':
      return [covered ? 'Booked visits are reassigned after Save.' : 'Booked visits are reviewed after Save.', 'New appointments can\'t be booked during OOO duration.'];
    case 'tasks':
      return [existing, covered ? 'New tasks are assigned to the covering provider.' : 'New tasks stay with this user.'];
    case 'programs':
      return [existing, 'For new programs, auto-assignment skips this user while they are out of office.'];
    case 'calls':
      return [covered ? 'Forwarded to the covering provider.' : 'Go to the person covering the OOO phone tree for that location.'];
    case 'communications':
      return [`${covered ? 'Stay with this user; the covering provider is notified.' : 'Stay with this user.'} ${autoReply ? 'Patients get one auto-reply.' : 'No auto-reply.'}`];
    default:
      return [existing];
  }
}

/**
 * Step 2 of an Out of Office record, Reassign Open Work: one card per area
 * of the user's work. Each says what happens to what's open now and to
 * new work while they're away, and who it goes to (avatars).
 *   - Work that can move (appointments, tasks, care programs): the count in
 *     the title, and Edit (or the avatars) for that module's own Reassign
 *     drawer over this one.
 *   - Calls and Communications: who takes calls (or the OOO phone tree), and
 *     the auto-reply message, which can be edited here.
 * A covering provider's missing access shows in amber on the card it affects.
 *
 * @param {object}   props
 * @param {React.ReactNode} props.summary – The record's read-only summary; the host shows it under its header, each module drawer under its own
 * @param {{ id, name }} props.away
 * @param {{ from: number, to: number }} props.timeWindow
 * @param {object}   props.work          – useOpenWork(): { items, plans, setPlan, pickUsers, loading }
 * @param {object[]} props.coverers      – coveringPeople(): [{ id, name, locations }]
 * @param {object}   props.missingByName – covering provider name → missing access labels
 * @param {object[]} props.phoneTree     – phoneTreeOnCall(): [{ location, people }]
 * @param {boolean}  props.autoReply     – A message is set
 * @param {string}   props.message
 * @param {function} props.onMessageChange – (text) => void, on Save under the field
 */
export function OooReviewStep({ summary, away, timeWindow, work, coverers, missingByName, phoneTree, autoReply, message, onMessageChange }) {
  const { items, plans, defaults, setPlan, pickUsers, loading } = work;
  const [editing, setEditing] = useState(null); // module key whose drawer is open
  const [viewSchedule, setViewSchedule] = useState(null); // an on-call schedule, read-only
  const [picker, setPicker] = useState(null);   // { rect, key } assigning a whole module
  // The auto-reply message is edited as a draft: Save keeps it, Discard or
  // a click outside the field goes back to the saved message.
  const [draft, setDraft] = useState(null); // null: read-only
  const messageOpen = draft !== null;
  const closeMessage = () => setDraft(null);
  const covered = coverers.length > 0;

  const warningsFor = (key) => coverers
    .map(p => ({ name: p.name, missing: (missingByName[p.name] || []).filter(a => ACCESS_CARDS[a]?.includes(key)) }))
    .filter(p => p.missing.length)
    .map(p => `${p.name} has no ${p.missing.join(', ')} access`);

  // People as avatars, with a tooltip listing them.
  const avatars = (people, tip, onClick, label) => {
    const group = <AvatarGroup people={people.map(p => ({ name: p.name, initials: initialsOf(p.name) }))} variant="staff" size="S" max={3} />;
    return (
      <Tooltip label={<span className={styles.awayList}>{tip}</span>} placement="top" align="right" maxWidth={280}>
        {onClick
          ? <button type="button" className={styles.workAvatarsButton} onClick={onClick} aria-label={label}>{group}</button>
          : <span className={styles.workAvatars} aria-label={label}>{group}</span>}
      </Tooltip>
    );
  };
  // How many departments a person takes in the tooltip: for appointments,
  // the locations of the visits they get; otherwise the locations they cover.
  const deptsOf = (key, ids, person) => {
    const same = (pl) => pl?.action === 'reassign' && (person.id ? pl.toId === person.id : pl.to === person.name);
    const locs = key === 'appointments'
      ? items.appointments.filter(a => ids.includes(a.id) && same(plans[key][a.id])).map(a => String(a.location || '').trim()).filter(Boolean)
      : (coverers.find(c => (person.id && c.id === person.id) || c.name === person.name)?.locations || []);
    // A count keeps the tooltip short; the module drawer lists them.
    const n = new Set(locs).size;
    return n ? `${n} Department${n === 1 ? '' : 's'}` : '';
  };
  // Who a module's items go to, as an avatar group (as in the Figma); the
  // grey unassigned avatar when nobody yet.
  const whoFor = (key, ids, label, onClick) => {
    const ps = planPeople(plans[key], ids);
    if (!ps.length) return <AssigneeChange avatarOnly size="S" unassigned ariaLabel={`Pick a covering provider for ${label}`} onClick={(e) => setPicker({ rect: e.currentTarget.getBoundingClientRect(), key })} />;
    return avatars(ps, ps.map(p => <span key={p.name}>{p.name}{deptsOf(key, ids, p) && ` • ${deptsOf(key, ids, p)}`}</span>), onClick, `Covering providers for ${label}`);
  };
  const covererTip = (prefix) => coverers.map(p => (
    <span key={p.name}>{prefix}{p.name}{p.locations.length > 0 && ` • ${p.locations.join(', ')}`}</span>
  ));

  // A card's top: the title with its lines (and warnings) right under it,
  // who / Edit on the right.
  const head = ({ key, title, count, tools, lines, muted }) => (
    <div className={styles.workHead}>
      <span className={styles.workText}>
        <span className={muted ? `${styles.workTitle} ${styles.workTitleMuted}` : styles.workTitle}>
          {title}{count != null && ` (${count})`}
        </span>
        {lines.map(l => <span key={l} className={styles.workLine}>{l}</span>)}
        {warningsFor(key).map(w => (
          <span key={w} className={styles.awayWarn}>
            <Icon name="solar:danger-triangle-linear" size={14} color="var(--status-warning)" />
            {w}
          </span>
        ))}
      </span>
      {tools && <span className={styles.workTools}>{tools}</span>}
    </div>
  );
  // The full-width box under a card's lines (phone tree, auto-reply).
  const extraBlock = (extra) => extra && <div className={styles.workExtra}>{extra}</div>;

  // A module card: its count, who it goes to and Edit; muted when there's
  // nothing to reassign.
  const moduleCard = (m) => {
    const list = items[m.key];
    const n = list.length;
    const ids = list.map(i => i.id);
    if (!n) {
      return (
        <div key={m.key} className={styles.workCard}>
          {head({ key: m.key, muted: true, lines: linesFor(m.key, covered, autoReply), title: m.title, count: 0 })}
        </div>
      );
    }
    return (
      <div key={m.key} className={styles.workCard}>
        {head({
          key: m.key,
          lines: linesFor(m.key, covered, autoReply),
          title: m.title,
          count: n,
          tools: n > 0 && (
            <>
              {whoFor(m.key, ids, m.title, () => setEditing(m.key))}
              <span className={styles.actionDivider} aria-hidden="true" />
              <Button variant="soft" size="sm" leadingIcon="solar:pen-linear" onClick={() => setEditing(m.key)}>Edit</Button>
            </>
          ),
        })}
      </div>
    );
  };

  // Calls: the covering providers, or whoever is on the OOO phone tree.
  const onCall = [...new Set(phoneTree.flatMap(r => r.people))].map(name => ({ name }));
  const callsCard = (
    <div key="calls" className={styles.workCard}>
      {head({
        key: 'calls',
        lines: linesFor('calls', covered, autoReply),
        title: 'Calls',
        tools: covered
          ? avatars(coverers, coverers.map(p => (
            <span key={p.name}>{p.name}{p.locations.length > 0 && `: covering for ${p.locations.join(', ')}`}</span>
          )), null, 'Covering providers')
          : onCall.length > 0 && avatars(onCall, onCall.map(p => <span key={p.name}>{p.name}</span>), null, 'On call'),
      })}
      {extraBlock(!covered && (
        <span className={styles.awayMessage}>
          <span className={styles.awayMessageTitle}>OOO Phone Tree</span>
          {/* Each location, with its on-call schedule one click away (the
              View drawer, over this one). */}
          <span className={styles.awayPhoneTree}>
            {phoneTree.map(r => (
              <span key={r.location || 'all'} className={styles.awayPhoneRow}>
                <span className={styles.awayPhoneLoc}>{r.location || 'All Locations'}</span>
                {!r.people.length && <span className={styles.awayPhoneNone}>No one on call. Calls go to voicemail.</span>}
                <ActionButton
                  icon="solar:eye-linear"
                  size="sm"
                  tooltip={r.schedules.length ? 'View On Call Schedule' : 'No on call schedule for these dates'}
                  tooltipLeft
                  disabled={!r.schedules.length}
                  aria-label={`View on call schedule for ${r.location || 'all locations'}`}
                  onClick={() => r.schedules[0] && setViewSchedule(r.schedules[0])}
                />
              </span>
            ))}
          </span>
        </span>
      ))}
    </div>
  );

  // Communications: stay with the user; the covering provider is only
  // notified (the tooltip says so). The auto-reply message, editable here.
  const commsCard = (
    <div key="communications" className={styles.workCard}>
      {head({
        key: 'communications',
        lines: linesFor('communications', covered, autoReply),
        title: 'Communications (SMS, Chat, Email, eFax)',
        tools: covered && avatars(coverers, covererTip('Notified: '), null, 'Notified covering providers'),
      })}
      {extraBlock(messageOpen ? (
        // Focus lands in the field on open; leaving the field and its
        // buttons (a click outside) discards the draft.
        <span
          className={styles.workMessageEdit}
          ref={el => { if (el && !el.contains(document.activeElement)) el.querySelector('textarea')?.focus(); }}
          onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) closeMessage(); }}
        >
          <label className={styles.autoReplyField}>
            <span className={styles.fieldLabel}>Set Auto Reply Message</span>
            <Textarea
              rows={3}
              placeholder="Enter Message"
              value={draft}
              maxLength={500}
              onValueChange={setDraft}
              aria-label="Auto reply message"
            />
          </label>
          <span className={styles.workMessageActions}>
            <Button variant="outline" size="sm" onClick={closeMessage}>Discard</Button>
            <Button size="sm" onClick={() => { onMessageChange(draft); closeMessage(); }}>Save</Button>
          </span>
        </span>
      ) : (
        <span className={styles.awayMessage}>
          <span className={styles.awayMessageHead}>
            <span className={styles.awayMessageTitle}>Auto Reply Message</span>
            <ActionButton icon="solar:pen-linear" size="sm" tooltip="Edit Message" tooltipLeft aria-label="Edit auto reply message" onClick={() => setDraft(message || '')} />
          </span>
          <span className={autoReply ? styles.awayMessageText : `${styles.awayMessageText} ${styles.workLineMuted}`}>{autoReply ? message : 'No auto-reply message.'}</span>
        </span>
      ))}
    </div>
  );

  const editingModule = MODULES.find(m => m.key === editing);

  return (
    <div className={styles.form}>
      <Banner tone="info" size="sm">This can also be edited later under actions for this out of office record.</Banner>
      <p className={styles.workIntro}>Review this user&apos;s work for the out of office duration:</p>

      <div className={styles.workList}>
        {loading
          ? MODULES.map(m => <Skeleton key={m.key} height={64} radius={8} />)
          : MODULES.map(moduleCard)}
        {callsCard}
        {commsCard}
      </div>

      {picker && (() => {
        // Nobody assigned yet: pick one person for the whole module, from
        // those who work at every department its items are in.
        const ids = items[picker.key].map(i => i.id);
        const depts = [...new Set(items[picker.key].map(i => String(i.location || '').trim()).filter(d => d && d !== NO_DEPARTMENT))];
        const worksAll = (u) => depts.every(d => (u.locations || []).some(l => String(l).trim().toLowerCase() === d.toLowerCase()));
        return (
          <UserPickerPopover
            anchorRect={picker.rect}
            align="right"
            width={350}
            title="Select Provider"
            titleCaseSections
            users={pickUsers().filter(worksAll)}
            emptyText="No one works at all of these departments. Use Edit to pick per department."
            onSelect={(u) => setPlan(picker.key, p => {
              const n = { ...p };
              ids.forEach(id => { n[id] = { action: 'reassign', to: u.name, toId: u.realId || null }; });
              return n;
            })}
            onClose={() => setPicker(null)}
          />
        );
      })()}
      {viewSchedule && (
        <OnCallScheduleDrawer schedule={viewSchedule} readOnly onClose={() => setViewSchedule(null)} />
      )}
      {editingModule && (
        <ModuleReassignDrawer
          module={editingModule}
          items={items[editingModule.key]}
          plan={plans[editingModule.key]}
          defaultPlan={defaults[editingModule.key]}
          away={away}
          timeWindow={timeWindow}
          summary={summary}
          usersFor={(d) => pickUsers(deptArg(d))}
          onSave={async (next) => {
            // Marked only: everything is reassigned with the record's Save.
            setPlan(editingModule.key, next);
            const what = { appointments: 'Appointments', programs: 'Care Programs' }[editingModule.key] || 'Tasks';
            toast.success(`${what} Marked for Reassignment Successfully`);
            return true;
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

// Same plan: every item goes the same way (to the same person, or nowhere).
const samePlan = (a, b) => {
  const ids = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  const key = (p) => (p?.action === 'reassign' ? `r:${p.toId || p.to}` : p?.action || '');
  return [...ids].every(id => key(a?.[id]) === key(b?.[id]));
};

/**
 * One module's Reassign drawer, over Reassign Open Work: Reassign
 * Appointments' planner for appointments, the same layout for tasks and
 * care programs. Edits a copy of the plan; Save marks it for reassignment
 * (it runs with the record's Save), Reset goes back to the defaults (each
 * item to its department's covering provider), closing discards it.
 */
function ModuleReassignDrawer({ module: m, items, plan, defaultPlan, away, timeWindow, summary, usersFor, onSave, onClose }) {
  const [draft, setDraft] = useState(plan);
  const [saving, setSaving] = useState(false);
  const shape = shapeOf(m.key);
  return (
    <Drawer
      title={`Reassign ${m.title}`}
      width={640}
      onClose={onClose}
      noCloseDivider
      banner={summary}
      headerRight={(
        <>
          {/* Back to the defaults; nothing changes until Save. */}
          <Button variant="outline" disabled={saving || samePlan(draft, defaultPlan)} onClick={() => setDraft(defaultPlan)}>Reset</Button>
          <Button
            loading={saving}
            onClick={async () => {
              setSaving(true);
              const ok = await onSave(draft);
              setSaving(false);
              if (ok) onClose();
            }}
          >
            Save
          </Button>
          <span className={styles.headerDivider} aria-hidden="true" />
        </>
      )}
    >
      <div className={`${styles.form} ${styles.reassignForm}`}>
        {m.key === 'appointments' ? (
          <ReassignPlanner appointments={items} awayUser={away} timeWindow={timeWindow} plan={draft} onPlan={setDraft} />
        ) : (
          <ReassignItemsPlanner
            items={items}
            renderMain={shape.renderMain}
            titleOf={shape.titleOf}
            noun={m.noun}
            icon={m.icon}
            usersFor={usersFor}
            rowAction={m.key === 'programs' ? VIEW.programs : VIEW.task}
            grouped={m.key !== 'programs'}
            plan={draft}
            onPlan={setDraft}
          />
        )}
      </div>
    </Drawer>
  );
}
