import { useEffect, useMemo, useState } from 'react';
import { BottomSheet, BottomSheetItem } from '../../../components/BottomSheet/BottomSheet';
import { FilterChip } from '../../../components/FilterChip/FilterChip';
import { Input } from '../../../components/Input/Input';
import { SegmentedControl } from '../../../components/SegmentedControl/SegmentedControl';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { MobileSubHeader } from '../MobileHeader';
import { MobileEmpty, MobileListSkeleton } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { callFromPhone } from '../calls/callLog';
import { resolveAllPatient } from '../members/resolvePatient';
import { ensureAllPatients } from '../members/ensureAllPatients';
import { WORKLIST_ADAPTERS } from './worklistAdapters';
import { WorklistCard } from './WorklistCard';
import { UserPickerSheet } from './UserPickerSheet';
import { pickerUsers } from './worklistUsers';
import { platformUsersForAssigneePicker } from '../../../lib/worklistAssignee';
import common from '../mobile.module.css';
import styles from './WorklistScreen.module.css';

const PAGE = 50;
const norm = (v) => String(v || '').trim().toLowerCase();
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const DAY_MS = 86400000;

// Due buckets for the Due filter (the desktop lists filter Next Action Due /
// Next Fill Due the same way: overdue, today, the coming week, later).
const DUE_OPTIONS = ['Overdue', 'Today', 'Next 7 days', 'Later', 'No due date'];
function dueBucket(due, today) {
  if (!due) return 'No due date';
  if (due < today) return 'Overdue';
  if (due - today < DAY_MS) return 'Today';
  if (due - today <= 7 * DAY_MS) return 'Next 7 days';
  return 'Later';
}
const cardStatuses = (c) => [
  ...(c.status ? [c.status.label] : []),
  ...(c.statuses || (c.subItems || []).map(sub => sub.status?.label)),
].filter(Boolean);
const cardAssignees = (c) => {
  const a = c.assignee || {};
  const names = [a.name, ...(a.names || [])].filter(Boolean);
  return names.length ? names : ['Unassigned'];
};

function isMine(card, me) {
  if (!me) return false;
  const a = card.assignee || {};
  if (me.id && a.id && String(a.id) === String(me.id)) return true;
  const mine = norm(me.name);
  return !!mine && [a.name, ...(a.names || [])].some(n => norm(n) === mine);
}

// Program worklists open the patient on their Programs tab.
const PROGRAM_LISTS = new Set(['SNP', 'Annual Visit', 'JSA', 'CMP', 'CCM']);

export function WorklistScreen({ label }) {
  const adapter = WORKLIST_ADAPTERS[label];
  if (!adapter) return <ComingSoon label={label} />;
  return <WorklistCards label={label} adapter={adapter} />;
}

/** Lists without mobile data yet (High Utilizers, DM). */
function ComingSoon({ label }) {
  return (
    <div className={common.screen}>
      <MobileSubHeader title={label} />
      <div className={common.body}>
        <MobileEmpty
          icon="solar:clipboard-list-linear"
          title={`${label} is coming to mobile`}
          description="Work this list from Fold Health on a computer for now."
        />
      </div>
    </div>
  );
}

/** One worklist as cards (mobile port of the desktop Population worklists). */
function WorklistCards({ label, adapter }) {
  const { openMember, push } = useMobileNav();
  const rawRows = useAppStore(adapter.rows);
  const loading = useAppStore(adapter.loading);
  const fetchRows = useAppStore(adapter.fetch);
  const me = useAppStore(s => s.currentUserProfile);
  const platformUsers = useAppStore(s => s.platformUsers);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  const [scope, setScope] = useState('all');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState([]);
  const [assigneeFilter, setAssigneeFilter] = useState([]);
  const [dueFilter, setDueFilter] = useState([]);
  const [limit, setLimit] = useState(PAGE);
  const [picker, setPicker] = useState(null); // status being changed
  const [assigning, setAssigning] = useState(null); // { title, current, users, set }
  const [team, setTeam] = useState(null); // CMP enrollment whose care team is open
  useEffect(() => { fetchRows?.(); }, [fetchRows]);
  useEffect(() => { fetchPlatformUsers?.(); }, [fetchPlatformUsers]);

  const cards = useMemo(() => {
    let rows = adapter.filter ? rawRows.filter(adapter.filter) : rawRows;
    if (adapter.enrich) rows = rows.map(adapter.enrich);
    if (!adapter.group) return rows.map(r => adapter.toCard(r));
    const groups = new Map();
    rows.forEach(r => {
      const k = adapter.group(r);
      groups.set(k, [...(groups.get(k) || []), r]);
    });
    return [...groups.values()].map(list => adapter.toCard(list[0], list));
  }, [rawRows, adapter]);

  const statusOptions = useMemo(() => [...new Set(cards.flatMap(cardStatuses))].sort(), [cards]);
  const assigneeOptions = useMemo(() => {
    const all = new Set(cards.flatMap(cardAssignees));
    const names = [...all].filter(n => n !== 'Unassigned').sort();
    return all.has('Unassigned') ? ['Unassigned', ...names] : names;
  }, [cards]);

  const shown = useMemo(() => {
    const q = norm(query);
    const today = startOfToday();
    const statuses = new Set(statusFilter);
    const assignees = new Set(assigneeFilter);
    const dues = new Set(dueFilter);
    return cards.filter(c => (
      (scope === 'all' || (scope === 'mine' && isMine(c, me)))
      && (!q || norm(c.name).includes(q) || norm(c.ids?.memberId).includes(q))
      && (!statuses.size || cardStatuses(c).some(st => statuses.has(st)))
      && (!assignees.size || cardAssignees(c).some(n => assignees.has(n)))
      && (!dues.size || dues.has(dueBucket(c.due, today)))
    ));
  }, [cards, scope, query, me, statusFilter, assigneeFilter, dueFilter]);
  const filtered = !!(query || scope !== 'all' || statusFilter.length || assigneeFilter.length || dueFilter.length);
  const resetPage = (fn) => (v) => { fn(v); setLimit(PAGE); };

  const usersFor = (kind) => (kind === 'picker'
    ? platformUsersForAssigneePicker(platformUsers)
    : pickerUsers(platformUsers, { excludeHccOnly: kind === 'eligible' }));

  const call = async (card) => {
    await ensureAllPatients();
    const patient = resolveAllPatient(useAppStore.getState(), card.ids);
    const number = patient?.phone || card.phone;
    if (!number) {
      toast.error(`No phone number on file for ${card.name}.`);
      return;
    }
    callFromPhone({ number, patient: patient || { id: null, name: card.name, phone: number }, sender: me });
  };

  const pick = async (next) => {
    const target = picker;
    setPicker(null);
    if (!target || next === target.label) return;
    try {
      await target.set(useAppStore.getState(), next);
    } catch {
      toast.error('Could not change the status.');
    }
  };

  // Same writes as the desktop AssigneeChange cells. setCmpCareTeam reports
  // a failed save; the desktop CMP table toasts it the same way.
  const assign = async (user) => {
    const target = assigning;
    setAssigning(null);
    if (!target || (user && norm(user.name) === norm(target.current))) return;
    const ok = await target.set(useAppStore.getState(), user);
    if (ok === false) toast.error('Could not save the change. Try again.');
    else if (user) toast.success(`Assigned to ${user.name}`);
  };

  const onSub = (sub) => {
    if (sub.open) push(sub.open.screen, sub.open.props);
    else if (sub.team) setTeam(sub);
  };

  return (
    <div className={common.screen}>
      <MobileSubHeader title={label}>
        <p className={styles.count}>{loading && !cards.length ? 'Loading…' : `${cards.length} ${cards.length === 1 ? 'member' : 'members'}`}</p>
      </MobileSubHeader>
      <div className={styles.controls}>
        <Input
          leadingIcon="solar:magnifer-linear"
          size="lg"
          type="search"
          placeholder="Search name or member ID"
          enterKeyHint="search"
          aria-label={`Search ${label}`}
          value={query}
          onValueChange={resetPage(setQuery)}
        />
        <SegmentedControl
          size="lg"
          aria-label="Show"
          value={scope}
          onValueChange={resetPage(setScope)}
          items={[{ key: 'all', label: 'All' }, { key: 'mine', label: 'Mine' }]}
        />
        <div className={styles.filters} role="group" aria-label="Filters">
          {statusOptions.length > 0 && (
            <FilterChip label="Status" options={statusOptions} selected={statusFilter} onChange={resetPage(setStatusFilter)} />
          )}
          {assigneeOptions.length > 0 && (
            <FilterChip label="Assignee" options={assigneeOptions} selected={assigneeFilter} onChange={resetPage(setAssigneeFilter)} searchable />
          )}
          {adapter.hasDue && (
            <FilterChip label="Due" options={DUE_OPTIONS} selected={dueFilter} onChange={resetPage(setDueFilter)} />
          )}
        </div>
      </div>
      <div className={common.body}>
        {loading && !cards.length ? <MobileListSkeleton height={200} count={3} /> : shown.length === 0 ? (
          <MobileEmpty
            icon="solar:clipboard-list-linear"
            title={filtered ? 'No members match' : 'No members on this list'}
          />
        ) : (
          <div className={common.list}>
            {shown.slice(0, limit).map(card => (
              <WorklistCard
                key={card.key}
                card={card}
                note={adapter.readOnlyNote}
                onStatus={setPicker}
                onAssign={card.assign ? () => setAssigning(card.assign) : undefined}
                onSub={onSub}
                onPush={(target) => push(target.screen, target.props)}
                onCall={() => call(card)}
                onOpen={() => openMember({ ...card.ids, tab: PROGRAM_LISTS.has(label) ? 'programs' : undefined })}
              />
            ))}
            {shown.length > limit && (
              <button type="button" className={common.more} onClick={() => setLimit(l => l + PAGE)}>
                Show more ({shown.length - limit})
              </button>
            )}
          </div>
        )}
      </div>

      {picker && (
        <BottomSheet title="Change Status" onClose={() => setPicker(null)}>
          {picker.options.map(opt => (
            <BottomSheetItem
              key={opt}
              icon={opt === picker.label ? 'solar:check-circle-linear' : 'solar:record-linear'}
              label={opt}
              onClick={() => pick(opt)}
            />
          ))}
        </BottomSheet>
      )}

      {team && (
        <BottomSheet title={`Care Team · ${team.title}`} onClose={() => setTeam(null)}>
          {team.team.map(r => (
            <BottomSheetItem
              key={r.key}
              icon="solar:user-linear"
              label={r.label}
              detail={r.value || 'Unassigned'}
              onClick={() => {
                setTeam(null);
                setAssigning({ title: `${r.label} · ${team.title}`, current: r.value, users: 'eligible', set: r.set });
              }}
            />
          ))}
        </BottomSheet>
      )}

      {assigning && (
        <UserPickerSheet
          title={assigning.title}
          users={usersFor(assigning.users)}
          current={assigning.current}
          onPick={assign}
          onUnassign={assigning.unassign ? () => assign(null) : undefined}
          onClose={() => setAssigning(null)}
        />
      )}
    </div>
  );
}
