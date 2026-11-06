import { useEffect, useMemo, useState } from 'react';
import { BottomSheet, BottomSheetItem } from '../../../components/BottomSheet/BottomSheet';
import { Input } from '../../../components/Input/Input';
import { SegmentedControl } from '../../../components/SegmentedControl/SegmentedControl';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { MobileSubHeader } from '../MobileHeader';
import { MobileEmpty, MobileListSkeleton } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { callFromPhone } from '../calls/callLog';
import { resolveAllPatient } from '../members/resolvePatient';
import { WORKLIST_ADAPTERS } from './worklistAdapters';
import { WorklistCard } from './WorklistCard';
import common from '../mobile.module.css';
import styles from './WorklistScreen.module.css';

const PAGE = 50;
const norm = (v) => String(v || '').trim().toLowerCase();
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

function isMine(card, me) {
  if (!me) return false;
  const a = card.assignee || {};
  if (me.id && a.id && String(a.id) === String(me.id)) return true;
  const mine = norm(me.name);
  return !!mine && [a.name, ...(a.names || [])].some(n => norm(n) === mine);
}

/** One worklist as cards (mobile port of the desktop Population worklists). */
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

function WorklistCards({ label, adapter }) {
  const { openMember } = useMobileNav();
  const rawRows = useAppStore(adapter.rows);
  const loading = useAppStore(adapter.loading);
  const fetchRows = useAppStore(adapter.fetch);
  const me = useAppStore(s => s.currentUserProfile);
  const [scope, setScope] = useState('all');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [picker, setPicker] = useState(null); // status being changed
  useEffect(() => { fetchRows?.(); }, [fetchRows]);

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

  const shown = useMemo(() => {
    const q = norm(query);
    const today = startOfToday();
    return cards.filter(c => (
      (scope === 'all'
        || (scope === 'mine' && isMine(c, me))
        || (scope === 'overdue' && c.due && c.due < today))
      && (!q || [c.name, c.ids?.memberId].some(v => norm(v).includes(q)))
    ));
  }, [cards, scope, query, me]);

  const scopes = [
    { key: 'all', label: 'All' },
    { key: 'mine', label: 'Mine' },
    ...(adapter.hasDue ? [{ key: 'overdue', label: 'Overdue' }] : []),
  ];

  const call = async (card) => {
    await useAppStore.getState().fetchAllPatients();
    const patient = resolveAllPatient(useAppStore.getState(), card.ids);
    const number = patient?.phone || card.phone;
    if (!number) {
      toast.error(`No phone number on file for ${card.name}.`);
      return;
    }
    callFromPhone({ number, patient: patient || { id: null, name: card.name, phone: number }, sender: me });
  };

  const pick = (next) => {
    const target = picker;
    setPicker(null);
    if (!target || next === target.label) return;
    try {
      target.set(useAppStore.getState(), next);
    } catch {
      toast.error('Could not change the status.');
    }
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
          aria-label={`Search ${label}`}
          value={query}
          onValueChange={(v) => { setQuery(v); setLimit(PAGE); }}
        />
        <SegmentedControl
          size="lg"
          aria-label="Show"
          value={scope}
          onValueChange={(v) => { setScope(v); setLimit(PAGE); }}
          items={scopes}
        />
      </div>
      <div className={common.body}>
        {loading && !cards.length ? <MobileListSkeleton height={200} count={3} /> : shown.length === 0 ? (
          <MobileEmpty
            icon="solar:clipboard-list-linear"
            title={query || scope !== 'all' ? 'No members match' : 'No members on this list'}
          />
        ) : (
          <div className={common.list}>
            {shown.slice(0, limit).map(card => (
              <WorklistCard
                key={card.key}
                card={card}
                note={adapter.readOnlyNote}
                onStatus={setPicker}
                onCall={() => call(card)}
                onOpen={() => openMember(card.ids)}
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
    </div>
  );
}
