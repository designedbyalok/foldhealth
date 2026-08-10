import { useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Icon } from '../../../components/Icon/Icon';
import { Button } from '../../../components/Button/Button';
import { useAppStore } from '../../../store/useAppStore';
import {
  groupEncountersByPatient, sftpEncStatus,
} from './HccSftpReviewDrawer.utils';
import { HccSftpReviewDrawerPanels } from './HccSftpReviewDrawerPanels';
import styles from './HccSftpReviewDrawer.module.css';

export function HccSftpReviewDrawer({ inline = false, onExit }) {
  const standaloneOpen = useAppStore(s => s.hccSftpReviewOpen);
  const inlineOpen = useAppStore(s => s.hccReviewInline);
  const closeStandalone = useAppStore(s => s.closeHccSftpReview);
  const open = inline ? inlineOpen : (standaloneOpen && !inlineOpen);
  const close = inline ? (onExit || (() => {})) : closeStandalone;
  const batches = useAppStore(s => s.hccSftpBatches) || [];
  const activeId = useAppStore(s => s.hccSftpActiveBatchId);
  const setActiveId = useAppStore(s => s.setHccSftpActiveBatchId);
  const patchEnc = useAppStore(s => s.patchHccSftpEncounter);
  const removeEnc = useAppStore(s => s.removeHccSftpEncounter);
  const removeBatch = useAppStore(s => s.removeHccSftpBatch);
  const createFromEncounter = useAppStore(s => s.hccCreateOrMergeFromEncounter);
  const applyComplianceDecision = useAppStore(s => s.applyHccComplianceDecision);
  const hccMembers = useAppStore(s => s.hccMembers) || [];
  const showToast = useAppStore(s => s.showToast);
  const selectedIdxsRef = useRef(new Set());
  const [switcherOpen, setSwitcherOpen] = useState(false);
  // Patient pagination index — one step per PATIENT across the review set
  // (Figma 1:3574). Reset when the review set changes.
  const [focusIdx, setFocusIdx] = useState(0);
  const cardStackRef = useRef(null);

  const sourceBatchIds = useAppStore(s => s.hccReviewSourceBatchIds);

  // Build the ordered "patient slot" list. In aggregate mode (ICD Creation
  // Review) we span every source document; otherwise just the active batch
  // (SFTP bell-notification flow). Each slot = { batch, group } so the left
  // preview + handlers can follow the focused patient back to its document.
  const review = useMemo(() => {
    const batchById = new Map(batches.map(b => [b.id, b]));
    const done = batches.filter(b => b.status === 'done');
    const src = [];
    if (sourceBatchIds && sourceBatchIds.length) {
      for (const id of sourceBatchIds) {
        const b = batchById.get(id);
        if (b) src.push(b);
      }
    }
    const reviewBatches = src.length
      ? src
      : [batches.find(b => b.id === activeId) || done[0] || batches[0]].filter(Boolean);
    const slots = [];
    reviewBatches.forEach(b => {
      const pend = (b.encounters || []).filter(e => (e._docStatus || 'pending') === 'pending');
      groupEncountersByPatient(pend).forEach(group => slots.push({ batch: b, group }));
    });
    return { slots };
  }, [batches, sourceBatchIds, activeId]);

  const focusedSlot = review.slots[focusIdx] || review.slots[0] || null;
  // The display/active batch follows the focused patient's source document.
  const activeBatch = focusedSlot?.batch
    || batches.find(b => b.id === activeId)
    || batches.find(b => b.status === 'done')
    || batches[0];

  useEffect(() => { setFocusIdx(0); }, [activeId, (sourceBatchIds || []).join(',')]);
  const setEncounterStatus = useAppStore(s => s.setHccSftpEncounterStatus);
  useEffect(() => { selectedIdxsRef.current = new Set(); }, [activeBatch?.id]);
  const toggleSelected = (idx) => {
    const next = new Set(selectedIdxsRef.current);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    selectedIdxsRef.current = next;
  };
  const setSelectedAll = (idxs, all) => {
    const next = new Set(selectedIdxsRef.current);
    if (all) idxs.forEach(i => next.add(i));
    else idxs.forEach(i => next.delete(i));
    selectedIdxsRef.current = next;
  };

  if (!open) return null;

  // Apply only the selected encounters of the active batch to the
  // worklist. Invoked from the floating BulkBar's "Add to Worklist"
  // action; the row's checkbox set drives what gets added.
  //
  // hccCreateOrMergeFromEncounter takes an encounter object directly —
  // not a wrapper — and threads `_docName` through for the activity
  // log entry that gets stamped on the matched member.
  const handleAddSelectedToWorklist = () => {
    if (!activeBatch) return;
    const encs = activeBatch.encounters || [];
    const useSelection = selectedIdxsRef.current.size > 0;
    let created = 0, updated = 0, skipped = 0;
    const appliedIdxs = [];
    encs.forEach((enc, idx) => {
      const valid = enc.patient?.matchedMemberId && (!enc.errors || enc.errors.length === 0);
      const include = useSelection ? selectedIdxsRef.current.has(idx) : true;
      if (!include || !valid) { skipped += 1; return; }
      const r = createFromEncounter?.({ ...enc, _docName: activeBatch.fileName });
      if (r?.kind === 'created') { created += 1; appliedIdxs.push(idx); }
      else if (r?.kind === 'updated') { updated += 1; appliedIdxs.push(idx); }
      else { skipped += 1; }
    });
    const parts = [];
    if (created) parts.push(`${created} created`);
    if (updated) parts.push(`${updated} updated`);
    if (skipped) parts.push(`${skipped} skipped`);
    showToast?.(parts.length ? parts.join(', ') : 'No changes applied');
    selectedIdxsRef.current = new Set();
    // Trim applied rows out of the batch so the table no longer shows
    // them. Sort descending so removing by index doesn't shift later
    // targets.
    appliedIdxs.sort((a, b) => b - a).forEach(idx => removeEnc?.(activeBatch.id, idx));
    // If the batch is now empty, drop it — nothing left to review.
    const after = (useAppStore.getState().hccSftpBatches || []).find(b => b.id === activeBatch.id);
    if (after && (after.encounters?.length || 0) === 0) {
      removeBatch?.(activeBatch.id);
    }
  };

  // Delete the selected encounters from the active batch in one go.
  // No worklist write; just trims the queue so the reviewer can sweep
  // rejects.
  const handleDeleteSelected = () => {
    if (!activeBatch || selectedIdxsRef.current.size === 0) return;
    // Sort descending so removing by index doesn't shift later targets.
    const idxs = Array.from(selectedIdxsRef.current).sort((a, b) => b - a);
    idxs.forEach(idx => removeEnc?.(activeBatch.id, idx));
    showToast?.(`${idxs.length} encounter${idxs.length === 1 ? '' : 's'} removed`);
    selectedIdxsRef.current = new Set();
  };

  // Per-batch encounter buckets driven by the new _docStatus field.
  const activeEncs = activeBatch?.encounters || [];
  const bucket = (status) => activeEncs.filter(e => (e._docStatus || 'pending') === status);
  const pendingEncs = bucket('pending');
  const addedEncs   = bucket('added');
  const deletedEncs = bucket('deleted');

  // Per Figma 1:3574 we review ONE PATIENT at a time. `review.slots`
  // (computed above) is the ordered patient list — across all source
  // documents in aggregate mode. focusIdx points at the current patient.
  const patientSlots = review.slots;
  const focusedGroup = focusedSlot?.group || null;
  const visibleEncs = focusedGroup?.encounters || [];
  const docTab = 'pending'; // hard-coded so empty-state branches keep working

  const goPrev = () => {
    setFocusIdx(Math.max(0, focusIdx - 1));
    cardStackRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const goNext = () => {
    setFocusIdx(Math.min(patientSlots.length - 1, focusIdx + 1));
    cardStackRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Footer — Add to the Worklist commits the focused patient's ready DOS
  // records, then advances. Delete Record drops the focused patient's
  // pending records from review (Figma 4001:179835).
  const handleAddPatientToWorklist = () => {
    if (!activeBatch || !focusedGroup) return;
    let added = 0;
    visibleEncs.forEach(enc => {
      const idx = activeEncs.indexOf(enc);
      if (idx < 0 || sftpEncStatus(enc) !== 'ready') return;
      const r = createFromEncounter?.({ ...enc, _docName: activeBatch.fileName });
      if (r?.kind === 'skipped') return;
      setEncounterStatus?.(activeBatch.id, idx, 'added');
      added += 1;
    });
    showToast?.(added
      ? `Added ${added} record${added === 1 ? '' : 's'} for ${focusedGroup.patient?.name || 'patient'}`
      : 'No ready records to add — resolve issues first');
    if (added && focusIdx < patientSlots.length - 1) goNext();
  };
  const handleDeletePatientRecords = () => {
    if (!activeBatch || !focusedGroup) return;
    const idxs = [];
    for (const enc of visibleEncs) {
      const idx = activeEncs.indexOf(enc);
      if (idx >= 0) idxs.push(idx);
    }
    idxs.sort((a, b) => b - a);
    idxs.forEach(idx => setEncounterStatus?.(activeBatch.id, idx, 'deleted'));
    showToast?.(`Deleted ${idxs.length} record${idxs.length === 1 ? '' : 's'}`);
  };

  const readyCount = visibleEncs.filter(e => sftpEncStatus(e) === 'ready').length;

  // Top nav — Previous · "Reviewing X of N Patients" · Next Patient.
  const navBar = patientSlots.length > 0 ? (
    <div className={styles.reviewNav}>
      <Button
        variant="secondary"
        size="S"
        leadingIcon="solar:alt-arrow-left-linear"
        disabled={focusIdx <= 0}
        onClick={goPrev}
      >
        Previous
      </Button>
      <span className={styles.reviewNavLabel}>
        Reviewing: <strong>{Math.min(focusIdx + 1, patientSlots.length)}</strong> of <strong>{patientSlots.length}</strong> {patientSlots.length === 1 ? 'Patient' : 'Patients'}
      </span>
      <Button
        variant="secondary"
        size="S"
        trailingIcon="solar:alt-arrow-right-linear"
        disabled={focusIdx >= patientSlots.length - 1}
        onClick={goNext}
      >
        Next Patient
      </Button>
    </div>
  ) : (
    <div className={styles.reviewNav}><span className={styles.reviewNavLabel}>Document Review</span></div>
  );

  // Footer — Delete Record · Add to the Worklist.
  const footerBar = (focusedGroup && visibleEncs.length > 0) ? (
    <div className={styles.reviewFooterBar}>
      <Button
        variant="secondary"
        size="M"
        leadingIcon="solar:trash-bin-trash-linear"
        onClick={handleDeletePatientRecords}
      >
        Delete Record
      </Button>
      <Button
        variant="primary"
        size="M"
        leadingIcon="solar:add-circle-linear"
        disabled={readyCount === 0}
        onClick={handleAddPatientToWorklist}
      >
        Add to the Worklist
      </Button>
    </div>
  ) : null;

  // Both layouts below render the same panels, so build the element once —
  // the standalone branch referenced a `panels` binding that the split
  // refactor left behind.
  const panels = (
    <HccSftpReviewDrawerPanels
      activeBatch={activeBatch}
      batches={batches}
      switcherOpen={switcherOpen}
      setSwitcherOpen={setSwitcherOpen}
      setActiveId={setActiveId}
      focusedGroup={focusedGroup}
      visibleEncs={visibleEncs}
      activeEncs={activeEncs}
      patientSlots={patientSlots}
      focusIdx={focusIdx}
      hccMembers={hccMembers}
      docTab={docTab}
      cardStackRef={cardStackRef}
      applyComplianceDecision={applyComplianceDecision}
      patchEnc={patchEnc}
      createFromEncounter={createFromEncounter}
      setEncounterStatus={setEncounterStatus}
      showToast={showToast}
      handleAddPatientToWorklist={handleAddPatientToWorklist}
      goNext={goNext}
    />
  );

  // Inline (inside ICD Creation) — own top bar + footer, no floating chrome.
  if (inline) {
    return (
      <div className={styles.inlineRoot}>
        <div className={styles.inlineHeader}>
          <button
            type="button"
            className={styles.inlineBack}
            onClick={close}
            title="Back to documents"
          >
            <Icon name="solar:alt-arrow-left-linear" size={16} color="var(--neutral-500)" />
          </button>
          {navBar}
        </div>
        <div className={styles.inlineBody}>{panels}</div>
        {footerBar && <div className={styles.inlineFooterBar}>{footerBar}</div>}
      </div>
    );
  }

  // Standalone — floating 700px Drawer (bell notification / upload ribbon).
  return (
    <Drawer
      title={navBar}
      titleStyle={{ flex: 1, width: '100%' }}
      onClose={close}
      className={styles.drawer}
      bodyClassName={styles.body}
      footer={footerBar}
      noCloseDivider
    >
      {panels}
    </Drawer>
  );
}
