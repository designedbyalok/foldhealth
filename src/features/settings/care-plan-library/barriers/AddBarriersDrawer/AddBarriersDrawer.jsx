import { useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from '../../../../../components/Drawer/Drawer';
import { Button } from '../../../../../components/Button/Button';
import { Input } from '../../../../../components/Input/Input';
import { Badge } from '../../../../../components/Badge/Badge';
import { Icon } from '../../../../../components/Icon/Icon';
import { Checkbox } from '../../../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { Link } from '../../../../../components/Link/Link';
import { AddIconMinimalist } from '../../../../../components/Icon/AddIconMinimalist';
import { toast } from '../../../../../components/Toast/sonnerToast';
import { BarrierDrawer } from '../BarrierDrawer/BarrierDrawer';
import { useAppStore } from '../../../../../store/useAppStore';
import { CARE_PLAN_TITLE_MAX } from '../../lib/carePlanLimits';
import styles from './AddBarriersDrawer.module.css';

const EMPTY_EXISTING_BARRIERS = [];

function normTitle(value) {
  return (value || '').trim().toLowerCase();
}

/**
 * Add Barriers — barrier picker for the Care Plan GBI table.
 * Figma SNP-Story 7550:489275.
 */
/**
 * @param {boolean} [props.selectable=true]  Plan picker: rows are checkboxes
 *   and already-added ones are grouped and disabled. Set false for the
 *   library, where the list is reference only and the action is authoring a
 *   barrier that does not exist yet.
 */
export function AddBarriersDrawer({
  onClose,
  onAdd,
  existingBarriers = EMPTY_EXISTING_BARRIERS,
  primaryLabel = 'Add to Plan',
  selectable = true,
}) {
  const libraryBarriers = useAppStore(s => s.carePlanBarriers);
  const saveCarePlanBarrier = useAppStore(s => s.saveCarePlanBarrier);
  // Plan picker: "Create New Barrier" authors a library barrier in the shared
  // BarrierDrawer (same as Add Goals → Create New Goal), then checks it.
  // null | { title } — the prefill.
  const [createDraft, setCreateDraft] = useState(null);
  const libraryDidFetch = useAppStore(s => s.carePlanLibraryDidFetch);
  const fetchCarePlanLibrary = useAppStore(s => s.fetchCarePlanLibrary);

  useEffect(() => {
    if (!libraryDidFetch) fetchCarePlanLibrary();
  }, [libraryDidFetch, fetchCarePlanLibrary]);

  const [query, setQuery] = useState('');

  const addedTitles = useMemo(
    () => new Set(existingBarriers.map(b => normTitle(b.title))),
    [existingBarriers],
  );

  // Rows already on the plan open checked and stay toggleable, so what is
  // ticked always reads as "what this should end up with".
  const [selected, setSelected] = useState(() => new Set(
    (libraryBarriers || [])
      .filter(b => addedTitles.has(normTitle(b.title)))
      .map(b => b.id),
  ));
  // The drawer can open before the library arrives (e.g. a retried fetch), so
  // seed the already-added rows once it does, as AddGoalsDrawer does.
  const seededRef = useRef(libraryBarriers.length > 0);
  useEffect(() => {
    if (seededRef.current || !libraryBarriers.length) return;
    setSelected(new Set(
      libraryBarriers.filter(b => addedTitles.has(normTitle(b.title))).map(b => b.id),
    ));
    seededRef.current = true;
  }, [libraryBarriers, addedTitles]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return libraryBarriers
      .map(b => ({
        ...b,
        added: addedTitles.has(normTitle(b.title)),
      }))
      .filter(b => {
        if (!q) return true;
        return b.title.toLowerCase().includes(q) || (b.description || '').toLowerCase().includes(q);
      });
  }, [libraryBarriers, addedTitles, query]);

  const addedRows = useMemo(() => rows.filter(b => b.added), [rows]);
  const availableRows = useMemo(() => rows.filter(b => !b.added), [rows]);

  // "Search or Enter Barrier": when the typed text matches no library or
  // already-added barrier, offer to create it as a custom (free-text) barrier.
  const trimmed = query.trim();
  const knownTitles = useMemo(
    () => new Set([...libraryBarriers.map(b => normTitle(b.title)), ...addedTitles]),
    [libraryBarriers, addedTitles],
  );
  // Typing a name that already exists is a dead end, so it is called out
  // rather than silently refusing to create.
  const duplicateName = !!trimmed && knownTitles.has(normTitle(trimmed));
  const canCreate = !!trimmed && !duplicateName;

  // A new barrier goes to the library and comes back checked. A name that's
  // already there selects the existing barrier instead of duplicating it.
  const saveNewBarrier = async ({ title, description }) => {
    const existing = libraryBarriers.find(b => normTitle(b.title) === normTitle(title));
    if (existing) {
      setSelected(prev => new Set(prev).add(existing.id));
      toast.success(`"${existing.title}" is already in the library, so it's selected`);
      setCreateDraft(null);
      setQuery('');
      return;
    }
    const saved = await saveCarePlanBarrier({ title, description });
    if (!saved) return;
    toast.success('Barrier created successfully');
    setSelected(prev => new Set(prev).add(saved.id));
    setCreateDraft(null);
    setQuery('');
  };

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  // Add any checked library barriers plus the typed custom one. The parent
  // saver keys off title/description, so a custom object with no library id
  // persists exactly like a picked one.
  const handleCreate = () => {
    if (!canCreate) return;
    const picks = libraryBarriers.filter(b => selected.has(b.id));
    onAdd?.([...picks, { id: `custom-${normTitle(trimmed).replace(/\s+/g, '-')}`, title: trimmed, description: '' }]);
  };

  const picks = () => libraryBarriers.filter(b => selected.has(b.id));
  const handleAddThisPlan = () => onAdd?.(picks(), { target: 'thisPlan' });
  const headerRight = (
    <>
      <Button
        variant="primary"
        size="L"
        disabled={selectable ? selected.size === 0 : !canCreate}
        onClick={selectable ? handleAddThisPlan : handleCreate}
      >
        {primaryLabel}
      </Button>
      <span className={styles.headerDivider} />
    </>
  );

  const renderRow = (barrier, { added = false } = {}) => (
    <div key={barrier.id} className={styles.rowWrap}>
      <label className={styles.row}>
        {selectable && (
          <Checkbox
            checked={selected.has(barrier.id)}
            onCheckedChange={() => toggle(barrier.id)}
            aria-label={`Select ${barrier.title}`}
          />
        )}
        <span className={styles.rowText}>{barrier.title}</span>
        {selectable && added ? <Badge tone="grey" size="M" label="Added" /> : null}
      </label>
    </div>
  );

  return (
    <Drawer title="Add Barriers" onClose={onClose} headerRight={headerRight} noCloseDivider>
      <div className={styles.body}>
        {/* Authoring a barrier is the point of the library's copy of this
            drawer, so the field is the goal drawer's manual-add input; the
            plan picker keeps a plain search. Either way the list below filters
            as you type, which is what stops duplicates. */}
        {selectable ? (
          // Search and "Create New Barrier" share one row: the link has no
          // filter beside it (unlike Add Goals' category toggle), so on its
          // own row it left an empty band above the search.
          <div className={styles.filterRow}>
            <span className={styles.searchGrow}>
              <Input
                type="search"
                aria-label="Search or Enter Barrier"
                placeholder="Search or Enter Barrier"
                leadingIcon="solar:magnifer-linear"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && canCreate) { e.preventDefault(); setCreateDraft({ title: trimmed }); } }}
              />
            </span>
            <Link className={styles.createLink} onClick={() => setCreateDraft({ title: trimmed })}>
              <AddIconMinimalist size={14} color="currentColor" />
              Create New Barrier
            </Link>
          </div>
        ) : (
          <Input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); setQuery(''); }
              if (e.key === 'Enter' && canCreate) { e.preventDefault(); handleCreate(); }
            }}
            placeholder={`Add New Barriers (${CARE_PLAN_TITLE_MAX} characters max)`}
            aria-label="Add New Barriers"
            maxLength={CARE_PLAN_TITLE_MAX}
            errorText={duplicateName
              ? 'A barrier with this name already exists'
              : (query.length >= CARE_PLAN_TITLE_MAX
                ? `Character limit reached - ${CARE_PLAN_TITLE_MAX}/${CARE_PLAN_TITLE_MAX}`
                : undefined)}
            trailingText={trimmed ? 'Enter to Save' : 'Esc to Cancel'}
          />
        )}

        <div className={styles.list}>
          {canCreate && (
            <button
              type="button"
              className={styles.createRow}
              onClick={selectable ? () => setCreateDraft({ title: trimmed }) : handleCreate}
            >
              <Icon name="solar:add-circle-linear" size={18} color="var(--primary-300)" />
              <span className={styles.createText}>Create “{trimmed}”</span>
            </button>
          )}
          {rows.length === 0 ? (
            canCreate ? null : (
              <p className={styles.empty}>
                {libraryBarriers.length === 0
                  ? 'No barriers in the library yet.'
                  : `No barriers match “${query.trim()}”.`}
              </p>
            )
          ) : (
            <>
              {selectable && addedRows.length > 0 && (
                <>
                  <span className={styles.groupLabel}>Already Added</span>
                  {addedRows.map(b => renderRow(b, { added: true }))}
                </>
              )}
              {selectable && addedRows.length > 0 && availableRows.length > 0 && (
                <span className={styles.groupDivider} />
              )}
              {/* The library drawer's field authors a new barrier, so the list
                  under it needs to say it is the existing ones, not choices. */}
              {!selectable && (
                <div className={styles.listHead}>Existing Barriers</div>
              )}
              {(selectable ? availableRows : rows).map(b => renderRow(b))}
            </>
          )}
        </div>
      </div>
      {createDraft && (
        <BarrierDrawer
          initialTitle={createDraft.title}
          onClose={() => setCreateDraft(null)}
          onSave={saveNewBarrier}
        />
      )}
    </Drawer>
  );
}
