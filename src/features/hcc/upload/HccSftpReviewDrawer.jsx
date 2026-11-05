import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Icon } from '../../../components/Icon/Icon';
import { Button } from '../../../components/Button/Button';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Input } from '../../../components/Input/Input';
import { Badge } from '../../../components/Badge/Badge';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Select } from '../../../components/Select/Select';
import { IcdSearch } from '../../../components/IcdSearch/IcdSearch';
// BulkBar import removed: per-card actions replace the floating bar
// in the new Document Review layout (Figma 121:87283).
import { useAppStore } from '../../../store/useAppStore';


import styles from './HccSftpReviewDrawer.module.css';

import { encStatus, flaggedCount } from './HccSftpReviewDrawer.utils';
import { HccSftpReviewDrawerContent } from './HccSftpReviewDrawerContent';
export function HccSftpReviewDrawer() {
  const open = useAppStore(s => s.hccSftpReviewOpen);
  const close = useAppStore(s => s.closeHccSftpReview);
  const allBatches = useAppStore(s => s.hccSftpBatches) || [];
  const sourceBatchIds = useAppStore(s => s.hccReviewSourceBatchIds);
  const activeId = useAppStore(s => s.hccSftpActiveBatchId);
  const setActiveId = useAppStore(s => s.setHccSftpActiveBatchId);
  // When review is opened over a specific set of documents (e.g. from the
  // upload picker's "Review"), scope the drawer, and its Previous/Next
  // navigation: to just those, in the order they were passed (focus first).
  const batches = useMemo(() => {
    if (!sourceBatchIds || !sourceBatchIds.length) return allBatches;
    const order = new Map(sourceBatchIds.map((id, i) => [id, i]));
    return allBatches
      .filter(b => order.has(b.id))
      .sort((a, b) => order.get(a.id) - order.get(b.id));
  }, [allBatches, sourceBatchIds]);
  const patchEnc = useAppStore(s => s.patchHccSftpEncounter);
  const removeEnc = useAppStore(s => s.removeHccSftpEncounter);
  const removeBatch = useAppStore(s => s.removeHccSftpBatch);
  const createFromEncounter = useAppStore(s => s.hccCreateOrMergeFromEncounter);
  const hccMembers = useAppStore(s => s.hccMembers) || [];
  const showToast = useAppStore(s => s.showToast);

  const activeBatch = useMemo(
    () => batches.find(b => b.id === activeId) || batches.find(b => b.status === 'done') || batches[0],
    [batches, activeId],
  );

  // Per-batch selection state: when the user switches tabs we reset
  // the set so bulk actions only ever apply to the visible batch.
  const selectedIdxsRef = useRef(new Set());
  // Doc-switcher popover open state (filename click).
  const [switcherOpen, setSwitcherOpen] = useState(false);
  // Ref to the left-pane preview scroll container. Used by the per-field
  // confidence pills to scroll the matching page into view and pulse a
  // highlight on the cited encounter when the user clicks them.
  const previewBodyRef = useRef(null);
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
    else     idxs.forEach(i => next.delete(i));
    selectedIdxsRef.current = next;
  };

  // Scroll the left-pane preview to the cited page and pulse a brief
  // highlight on the matching encounter's field row so the reviewer
  // can verify the AI's extraction against the source document.
  const citeField = (page, encTempId, field) => {
    const root = previewBodyRef.current;
    if (!root) return;
    const pageEl = root.querySelector(`[data-preview-page="${page}"]`);
    if (!pageEl) return;
    pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const target = encTempId
      ? root.querySelector(`[data-preview-page="${page}"] [data-preview-enc="${encTempId}"] [data-preview-field="${field}"]`)
        || root.querySelector(`[data-preview-page="${page}"] [data-preview-enc="${encTempId}"]`)
      : pageEl;
    if (!target) return;
    target.classList.add(styles.previewHighlight);
    setTimeout(() => target.classList.remove(styles.previewHighlight), 1600);
  };

  // Aggregate quick-stats for the title. MUST run before any early return
  // to keep the hook order stable across renders.
  const stats = useMemo(() => {
    const docs = batches.length;
    const ready = batches.filter(b => b.status === 'done').length;
    const pending = batches.filter(b => b.status === 'pending').length;
    const totalEncs = batches.reduce((sum, b) => sum + (b.encounters?.length || 0), 0);
    const patientKeys = new Set();
    batches.forEach(b => (b.encounters || []).forEach(e => {
      patientKeys.add(e.patient?.matchedMemberId || `__u-${e.tempId}`);
    }));
    return { docs, ready, pending, totalEncs, patients: patientKeys.size };
  }, [batches]);

  if (!open) return null;

  // Apply only the selected encounters of the active batch to the
  // worklist. Invoked from the floating BulkBar's "Add to Worklist"
  // action; the row's checkbox set drives what gets added.
  //
  // hccCreateOrMergeFromEncounter takes an encounter object directly,
  // not a wrapper: and threads `_docName` through for the activity
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
      const r = createFromEncounter?.({ ...enc, _docName: activeBatch.fileName, _batchId: activeBatch.id });
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
    // If the batch is now empty, drop it, nothing left to review.
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
    const idxs = [...selectedIdxsRef.current].sort((a, b) => b - a);
    idxs.forEach(idx => removeEnc?.(activeBatch.id, idx));
    showToast?.(`${idxs.length} encounter${idxs.length === 1 ? '' : 's'} removed`);
    selectedIdxsRef.current = new Set();
  };

  // Per-batch encounter buckets driven by the new _docStatus field.
  const activeEncs = activeBatch?.encounters || [];
  const bucket = (status) => activeEncs.filter(e => (e._docStatus || 'pending') === status);
  const pendingEncs = bucket('pending');

  // No tabs / status filter: the card stack shows every pending record for
  // this document, grouped by patient.
  const visibleEncs = pendingEncs;

  // Group encounters by patient so one card == one patient, with N DOS
  // blocks inside. Insertion-ordered Map preserves the document's
  // chronological appearance. Matched encounters group by member id;
  // unmatched fall back to extracted name + DOB. Plain const, not a
  // hook: so it stays compatible with the early-return above.
  const visibleGroups = (() => {
    const map = new Map();
    visibleEncs.forEach((enc) => {
      const key = enc.patient?.matchedMemberId
        ? `m:${enc.patient.matchedMemberId}`
        : `u:${(enc.patient?.name || '').toLowerCase()}|${enc.patient?.dob || ''}`;
      if (!map.has(key)) map.set(key, { key, encs: [] });
      map.get(key).encs.push(enc);
    });
    return Array.from(map.values());
  })();

  const title = (
    <span className={styles.titleBlock}>
      <span className={styles.titleTop}>Document Review</span>
    </span>
  );

  // Step through the reviewed documents with Previous / Next (Figma
  // 4999:156381). Falls back to the recorded/members stats for a single doc.
  const activeIndex = batches.findIndex(b => b.id === activeBatch?.id);
  const totalDocs = batches.length;
  const goToDoc = (idx) => { const b = batches[idx]; if (b) setActiveId(b.id); };

  const headerRight = totalDocs > 1 ? (
    <span className={styles.reviewNav}>
      <Button
        variant="outline" tone="primary"
        size="sm"
        leadingIcon="solar:alt-arrow-left-linear"
        disabled={activeIndex <= 0}
        onClick={() => goToDoc(activeIndex - 1)}
      >
        Previous
      </Button>
      <span className={styles.reviewNavLabel}>
        Reviewing: {activeIndex + 1} of {stats.patients} {stats.patients === 1 ? 'Patient' : 'Patients'}
      </span>
      <Button
        variant="outline" tone="primary"
        size="sm"
        trailingIcon="solar:alt-arrow-right-linear"
        disabled={activeIndex >= totalDocs - 1}
        onClick={() => goToDoc(activeIndex + 1)}
      >
        Next
      </Button>
    </span>
  ) : (
    <span className={styles.titleStats}>
      <strong>{stats.totalEncs}</strong>&nbsp;Recorded
      <span className={styles.titleSubDot}>•</span>
      <strong>{stats.patients}</strong>&nbsp;Members
    </span>
  );

  return (
    <Drawer
      title={title}
      onClose={close}
      className={styles.drawer}
      bodyClassName={styles.body}
      headerRight={headerRight}
      noCloseDivider
    >
      <HccSftpReviewDrawerContent
        activeBatch={activeBatch}
        batches={batches}
        activeEncs={activeEncs}
        visibleEncs={visibleEncs}
        visibleGroups={visibleGroups}
        hccMembers={hccMembers}
        showToast={showToast}
        patchEnc={patchEnc}
        createFromEncounter={createFromEncounter}
        setEncounterStatus={setEncounterStatus}
        setActiveId={setActiveId}
        close={close}
        citeField={citeField}
        previewBodyRef={previewBodyRef}
        switcherOpen={switcherOpen}
        setSwitcherOpen={setSwitcherOpen}
      />
    </Drawer>
  );
}
