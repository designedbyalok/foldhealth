import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../../../../components/Drawer/Drawer';
import { Button } from '../../../../../components/Button/Button';
import { Toggle } from '../../../../../components/Toggle/Toggle';
import { Input } from '../../../../../components/Input/Input';
import { Checkbox } from '../../../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { Badge } from '../../../../../components/Badge/Badge';
import { Link } from '../../../../../components/Link/Link';
import { RingEmptyState } from '../../../../../components/RingEmptyState/RingEmptyState';
import { Icon } from '../../../../../components/Icon/Icon';
import { AddIconMinimalist } from '../../../../../components/Icon/AddIconMinimalist';
import { toast } from '../../../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../../../store/useAppStore';
import { InterventionDrawer } from '../InterventionDrawer/InterventionDrawer';
import { interventionTemplateFromValues } from '../shared/interventionTemplateValues';
import { INTERVENTION_KIND_ORDER, KIND_LABELS } from '../shared/interventionKinds';
import { CARE_PLAN_INTERVENTION_ICONS } from '../../../../patient/right-panel/tabs/care-programs/care-plan/lib/carePlanInterventionMenu';
import styles from './AddInterventionsDrawer.module.css';

// Rows shown under "Recently Used", the newest in the library. There is no
// per-user usage log, so recency stands in for it.
const RECENT_COUNT = 5;

const TAB_TO_KIND = Object.fromEntries(INTERVENTION_KIND_ORDER.map(k => [KIND_LABELS[k], k]));

/**
 * Add Interventions: the library picker behind a goal's Interventions "+".
 * Same shape as Add Goals: filter by type, search, tick what you want. The
 * tab you are on decides which kind "New Intervention" starts on.
 *
 * @param {string} [props.primaryLabel='Add']  Names where the picks land.
 */
export function AddInterventionsDrawer({ onClose, onAdd, primaryLabel = 'Add' }) {
  const library = useAppStore(s => s.carePlanInterventionTemplates);
  const libraryDidFetch = useAppStore(s => s.carePlanLibraryDidFetch);
  const fetchCarePlanLibrary = useAppStore(s => s.fetchCarePlanLibrary);
  const saveCarePlanInterventionTemplate = useAppStore(s => s.saveCarePlanInterventionTemplate);
  const [createKind, setCreateKind] = useState(null);

  useEffect(() => {
    if (!libraryDidFetch) fetchCarePlanLibrary();
  }, [libraryDidFetch, fetchCarePlanLibrary]);

  const [tab, setTab] = useState('All');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(() => new Set());

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Newest first, so "Recently Used" is the head of the list.
  const items = useMemo(() => {
    const byNewest = [...(library || [])].sort(
      (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
    );
    return byNewest.map((i, idx) => ({ ...i, recent: idx < RECENT_COUNT }));
  }, [library]);

  const tabs = useMemo(
    () => ['All', ...INTERVENTION_KIND_ORDER.map(k => KIND_LABELS[k])],
    [],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(i => {
      if (tab !== 'All' && i.kind !== TAB_TO_KIND[tab]) return false;
      if (!q) return true;
      return i.title.toLowerCase().includes(q)
        || (i.description || '').toLowerCase().includes(q);
    });
  }, [items, tab, query]);

  const showRecentLabel = tab === 'All' && !query.trim();
  const lastRecentId = showRecentLabel
    ? [...rows].reverse().find(i => i.recent)?.id
    : null;

  // The tab decides which kind the creation drawer starts on; "All" has no
  // kind of its own, so it falls back to the first.
  const openCreate = () => setCreateKind(TAB_TO_KIND[tab] || INTERVENTION_KIND_ORDER[0]);

  const headerRight = (
    <>
      <Button
        disabled={selected.size === 0}
        onClick={() => onAdd?.(items.filter(i => selected.has(i.id)))}
      >
        {primaryLabel}
      </Button>
      <span className={styles.headerDivider} />
    </>
  );

  return (
    <Drawer title="Add Interventions" onClose={onClose} headerRight={headerRight} noCloseDivider>
      <div className={styles.body}>
        <div className={styles.filterRow}>
          <Toggle size="S" items={tabs} active={tab} onChange={setTab} />
          <Button
            variant="soft"
            size="sm"
            leadingIconElement={<AddIconMinimalist size={14} />}
            onClick={openCreate}
          >
            New
          </Button>
        </div>

        <Input
          type="search"
          aria-label="Search Intervention"
          placeholder="Search Intervention"
          leadingIcon="solar:magnifer-linear"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />

        <div className={styles.list}>
          {showRecentLabel && <span className={styles.groupLabel}>Recently Used</span>}
          {rows.length === 0 ? (
            <div className={styles.emptyState}>
            <RingEmptyState
              icon="solar:clipboard-list-linear"
              iconSize={31}
              label={items.length === 0
                ? 'No interventions in the library yet'
                : 'No interventions match searched keyword'}
            >
              {/* Nothing to pick means the only useful move is authoring one,
                  so creation lives here rather than in the filter row. */}
              <Link className={styles.createLink} onClick={openCreate}>
                <AddIconMinimalist size={14} color="currentColor" />
                Create New
              </Link>
            </RingEmptyState>
            </div>
          ) : rows.map(i => (
            <div key={i.id} className={styles.rowWrap}>
              <label className={styles.row}>
                <Checkbox
                  checked={selected.has(i.id)}
                  onCheckedChange={() => toggle(i.id)}
                  aria-label={`Select ${i.title}`}
                />
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{i.title}</span>
                </span>
                <span className={styles.rowMeta}>
                  <Badge tone="grey" size="S" label={KIND_LABELS[i.kind] || i.kind} />
                  <Icon
                    name={CARE_PLAN_INTERVENTION_ICONS[i.kind] || 'solar:clipboard-list-linear'}
                    size={16}
                    color="var(--neutral-400)"
                  />
                </span>
              </label>
              {i.id === lastRecentId && <span className={styles.groupDivider} />}
            </div>
          ))}
        </div>
      </div>
      {createKind && (
        <InterventionDrawer
          kind={createKind}
          taskTemplate
          onKindChange={setCreateKind}
          onClose={() => setCreateKind(null)}
          onSave={async (values) => {
            const saved = await saveCarePlanInterventionTemplate(
              interventionTemplateFromValues(values, { kind: createKind }),
            );
            if (!saved) return;
            toast.success('Intervention created successfully');
            // Creating one from inside the picker means you want it.
            setSelected(prev => new Set(prev).add(saved.id));
            setCreateKind(null);
          }}
        />
      )}
    </Drawer>
  );
}
