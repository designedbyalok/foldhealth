import { useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from '../../../../../../components/Drawer/Drawer';
import { Select } from '../../../../../../components/Select/Select';
import { CardSkeleton } from '../../../../../../components/CardSkeleton/CardSkeleton';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { Button } from '../../../../../../components/Button/Button';
import { Link } from '../../../../../../components/Link/Link';
import { AddIconMinimalist } from '../../../../../../components/Icon/AddIconMinimalist';
import { ChronicConditionSelect } from '../../../../../settings/care-plan-library/shared/ChronicConditionSelect/ChronicConditionSelect';
import { useAppStore } from '../../../../../../store/useAppStore';
import { toast } from '../../../../../../components/Toast/sonnerToast';
import { FAMILY_RELATIONS, groupByRelation } from '../../../../../../reference-data/familyRelations';
import { HistoryTable, HistoryDelete, HISTORY_ACTIONS_COLUMN, historyRowClass, historyCellClass } from '../HistoryTable';
import styles from '../AddProblemsDrawer/AddProblemsDrawer.module.css';

const KIND = 'family';

const FAMILY_COLUMNS = [
  { key: 'relation', label: 'Relationship', width: '30%' },
  { key: 'conditions', label: 'Conditions' },
  HISTORY_ACTIONS_COLUMN,
];

/**
 * The table's rows: each condition is its own row, so its delete sits in the
 * Actions column, and each relation ends with a row for Add Condition. The
 * relation is drawn once, on its first row, spanning the rest. A relation
 * added here with no condition yet is one row with its relation dropdown.
 */
function tableRows(groups) {
  return groups.flatMap(group => (group.pending
    ? [{ id: group.id, type: 'pending', group }]
    : [
      ...group.entries.map((entry, i) => ({ id: entry.id, type: 'condition', group, entry, first: i === 0 })),
      { id: `${group.relation}:add`, type: 'add', group, first: false },
    ]));
}

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * A relation's condition search, opened from Add Condition (or by adding the
 * relation) with its menu open, ready to type. Picking saves;
 * Escape or a click anywhere outside it closes it without adding anything.
 * The menu renders inside the wrapper, so picking an option is not a click
 * away.
 */
function ConditionSearch({ onPick, onDismiss }) {
  const ref = useRef(null);
  const dismiss = useRef(onDismiss);
  useEffect(() => { dismiss.current = onDismiss; });

  // Closes on a finished click, not on mousedown: closing on mousedown moves
  // the rows below up before the button is released, so a click on another
  // relation's Add Condition would land somewhere else and do nothing.
  // Listening starts on the next tick, so the click that opened this search
  // doesn't also close it.
  useEffect(() => {
    // The event's path, not contains(): picking an option re-renders the
    // menu away before the click reaches the document, and a detached
    // target would otherwise read as a click outside.
    const onClick = (e) => { if (!e.composedPath().includes(ref.current)) dismiss.current(); };
    const onKey = (e) => { if (e.key === 'Escape') dismiss.current(); };
    const timer = setTimeout(() => {
      document.addEventListener('click', onClick);
      document.addEventListener('keydown', onKey);
    });
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div ref={ref}>
      <ChronicConditionSelect
        label=""
        multiple={false}
        leadingIcon="solar:magnifer-linear"
        placeholder="Search And Add Condition"
        value=""
        defaultOpen
        onChange={onPick}
      />
    </div>
  );
}

/** "+ Label" as a link-styled button, for the table's add rows. */
function AddLink({ label, disabled, onClick }) {
  return (
    <Link
      className={styles.famAddLink}
      role="button"
      tabIndex={0}
      disabled={disabled}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    >
      <AddIconMinimalist size={12} color="currentColor" />
      {label}
    </Link>
  );
}

/**
 * Add Family History: conditions grouped by relation. Add New Relation (above
 * the table) adds a row whose relation is picked from a dropdown; each
 * relation then takes conditions from the same NLM conditions lookup as
 * Problems (chronic conditions), and every pick saves as its own entry.
 *
 * A relation is only stored through its conditions, so one just added with
 * none yet lives in this drawer until its first condition is picked.
 *
 * @param {string}   props.patientId
 * @param {function} props.onClose
 */
export function AddFamilyHistoryDrawer({ patientId, onClose }) {
  const records = useAppStore(s => (patientId ? s.patientPamiRecords[patientId] : null));
  const loadedFor = useAppStore(s => (patientId ? s.patientPamiRecordsLoadedFor[patientId] : false));
  const fetchPatientPamiRecords = useAppStore(s => s.fetchPatientPamiRecords);
  const addPatientHistoryEntry = useAppStore(s => s.addPatientHistoryEntry);
  const removePatientHistoryEntry = useAppStore(s => s.removePatientHistoryEntry);
  // Rows added with Add New Relation that have no condition yet: { id, relation }.
  const [pending, setPending] = useState([]);
  const nextId = useRef(0);
  const [searching, setSearching] = useState(() => new Set()); // relations with the search open
  const openSearch = (relation) => setSearching(s => new Set(s).add(relation));
  const closeSearch = (relation) => setSearching((s) => { const next = new Set(s); next.delete(relation); return next; });

  useEffect(() => {
    if (patientId) fetchPatientPamiRecords(patientId);
  }, [patientId, fetchPatientPamiRecords]);

  const loading = !!patientId && !loadedFor;
  const groups = useMemo(() => {
    const saved = groupByRelation((records?.history || []).filter(h => h.kind === KIND));
    const extra = pending
      .filter(p => !saved.some(g => g.relation === p.relation))
      .map(p => ({ id: p.id, relation: p.relation, entries: [], pending: true }));
    return [...saved, ...extra];
  }, [records, pending]);

  const usedRelations = groups.map(g => g.relation).filter(Boolean);
  const relationOptionsFor = (own) => FAMILY_RELATIONS
    .filter(r => r === own || !usedRelations.includes(r))
    .map(r => ({ value: r, label: r }));
  // One blank row at a time, and none once every relation is in the table.
  const canAddRelation = !pending.some(p => !p.relation) && usedRelations.length < FAMILY_RELATIONS.length;

  const addRelationRow = () => {
    if (!canAddRelation) return;
    nextId.current += 1;
    setPending(p => [...p, { id: `new:${nextId.current}`, relation: '' }]);
  };

  const setPendingRelation = (id, relation) => {
    const before = pending.find(p => p.id === id)?.relation;
    if (before) closeSearch(before);
    setPending(p => p.map(row => (row.id === id ? { ...row, relation } : row)));
  };

  const dropPending = (id) => {
    const relation = pending.find(p => p.id === id)?.relation;
    if (relation) closeSearch(relation);
    setPending(p => p.filter(row => row.id !== id));
  };

  const addCondition = async (relation, name) => {
    if (!name) return;
    const group = groups.find(g => g.relation === relation);
    if (group?.entries.some(e => sameName(e.title, name))) {
      toast.info(`Already in ${relation}'s History`);
      return;
    }
    const ok = await addPatientHistoryEntry(patientId, KIND, { relation, title: name });
    if (!ok) return;
    closeSearch(relation);
    setPending(p => p.filter(row => row.relation !== relation));
    toast.success('Family History Added');
  };

  const remove = (entry) => removePatientHistoryEntry(patientId, entry.id);

  return (
    <Drawer title="Add Family History" onClose={onClose}>
      <div className={styles.body}>
        {loading ? (
          <CardSkeleton rows={3} />
        ) : (<>
          <div className={styles.famHead}>
            <span className={styles.addLabel}>Family History</span>
            <Button
              variant="outline"
              size="sm"
              leadingIconElement={<AddIconMinimalist size={14} color="currentColor" />}
              disabled={!canAddRelation}
              disabledReason={!canAddRelation ? 'Pick a relation for the new row first' : undefined}
              onClick={addRelationRow}
            >
              Add New Relation
            </Button>
          </div>
          <div className={styles.famTable}>
            <HistoryTable
              label="Family history"
              columns={FAMILY_COLUMNS}
              rows={tableRows(groups)}
              renderRow={(row) => {
                const { group } = row;
                const open = !!group.relation && searching.has(group.relation);
                const conditionAdd = (
                  <div className={styles.famAddCell}>
                    {open && (
                      <ConditionSearch
                        onPick={name => addCondition(group.relation, name)}
                        onDismiss={() => closeSearch(group.relation)}
                      />
                    )}
                    <span>
                      <AddLink
                        label="Add Condition"
                        disabled={open || !group.relation}
                        onClick={() => openSearch(group.relation)}
                      />
                    </span>
                  </div>
                );
                if (row.type === 'pending') {
                  return (
                    <tr key={row.id} className={historyRowClass}>
                      <td className={`${historyCellClass} ${styles.historyCellTop} ${styles.famRelationCell}`}>
                        <Select
                          portal
                          searchable
                          placeholder="Select Relation"
                          options={relationOptionsFor(group.relation)}
                          value={group.relation}
                          onValueChange={relation => setPendingRelation(group.id, relation)}
                        />
                      </td>
                      <td className={`${historyCellClass} ${styles.historyCellTop}`}>
                        <div className={styles.famAddCell}>
                          {!open && <span className={styles.famEmpty}>No Conditions for this member</span>}
                          {conditionAdd}
                        </div>
                      </td>
                      <td className={`${historyCellClass} ${styles.historyCellTop} ${styles.famActionsCell}`}>
                        <ActionButton
                          icon="solar:trash-bin-trash-linear"
                          size="sm"
                          tooltip="Remove"
                          aria-label="Remove relation"
                          onClick={() => dropPending(group.id)}
                        />
                      </td>
                    </tr>
                  );
                }
                const relationCell = row.first && (
                  <td rowSpan={group.entries.length + 1} className={`${historyCellClass} ${styles.historyCellTop} ${styles.famRelationCell}`}>
                    {group.relation}
                  </td>
                );
                if (row.type === 'condition') {
                  return (
                    <tr key={row.id} className={`${historyRowClass} ${styles.famInnerRow}`}>
                      {relationCell}
                      <td className={historyCellClass}>{row.entry.title}</td>
                      <td className={`${historyCellClass} ${styles.famActionsCell}`}>
                        <HistoryDelete
                          name={row.entry.title}
                          description={`This removes it from the ${group.relation.toLowerCase()}'s history and can't be undone.`}
                          onRemove={() => remove(row.entry)}
                        />
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={row.id} className={historyRowClass}>
                    {/* The search opens in place of the link, which drops
                        below it and stays disabled until a condition is
                        picked, or the search is closed (Escape, or a click
                        away). */}
                    <td className={historyCellClass}>{conditionAdd}</td>
                    <td className={`${historyCellClass} ${styles.famActionsCell}`} />
                  </tr>
                );
              }}
            />
          </div>
        </>)}
      </div>
    </Drawer>
  );
}
