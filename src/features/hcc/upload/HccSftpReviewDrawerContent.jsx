import { Icon } from '../../../components/Icon/Icon';
import { encStatus } from './HccSftpReviewDrawer.utils';
import { PagePreview, DocReviewCompleted, PatientCard } from './HccSftpReviewDrawerParts';
import styles from './HccSftpReviewDrawer.module.css';

export function HccSftpReviewDrawerContent({
  activeBatch, batches, activeEncs, visibleEncs, visibleGroups,
  hccMembers, showToast, patchEnc, createFromEncounter, setEncounterStatus,
  setActiveId, close, citeField, previewBodyRef, switcherOpen, setSwitcherOpen,
}) {
  return (
    <>
      {activeBatch ? (
        <div className={styles.panels}>
          {/* LEFT: filename strip + page preview. */}
          <div className={styles.leftPanel}>
            <div className={styles.fileStrip}>
              <button
                type="button"
                className={styles.fileStripBtn}
                onClick={() => setSwitcherOpen(v => !v)}
                title="Switch document"
              >
                <Icon name="solar:document-text-linear" size={14} color="var(--neutral-400)" />
                <span className={styles.fileStripName}>{activeBatch.fileName}</span>
                <Icon
                  name={switcherOpen ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
                  size={12}
                  color="var(--neutral-400)"
                />
              </button>
              <button
                type="button"
                className={styles.fileStripExternal}
                title="Open document in new tab"
              >
                <Icon name="solar:square-arrow-right-up-linear" size={14} color="var(--neutral-400)" />
              </button>
              {switcherOpen && batches.length > 1 && (
                <div className={styles.fileStripMenu} role="listbox">
                  {batches.map(b => {
                    const isActive = b.id === activeBatch.id;
                    const isPending = b.status === 'pending';
                    return (
                      <button
                        key={b.id}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        disabled={isPending}
                        className={[
                          styles.fileStripMenuItem,
                          isActive ? styles.fileStripMenuItemActive : '',
                        ].filter(Boolean).join(' ')}
                        onClick={() => { setActiveId(b.id); setSwitcherOpen(false); }}
                      >
                        <Icon name="solar:document-text-linear" size={12} color={isActive ? 'var(--primary-300)' : 'var(--neutral-400)'} />
                        <span>{b.fileName}</span>
                        <span className={styles.fileStripMenuCount}>{b.encounters?.length || 0}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <PagePreview
              activeBatch={activeBatch}
              batches={batches}
              onSelect={(id) => setActiveId(id)}
              previewRef={previewBodyRef}
            />
          </div>

          {/* RIGHT: per-patient encounter card stack (one patient per
              document, N DOS inside). No tabs / status filters, the
              reviewer just works the document's records. */}
          <div className={styles.rightPanel}>
            {/* Encounter card stack: replaces the table. */}
            <div className={styles.cardStack}>
              {visibleEncs.length === 0 ? (
                // Every record on this document has been triaged → completion
                // hero with a jump to the next document that still has work.
                activeEncs.length > 0 ? (
                  <DocReviewCompleted
                    total={activeEncs.length}
                    nextBatch={batches.find(b => b.id !== activeBatch.id && (b.encounters || []).some(e => (e._docStatus || 'pending') === 'pending'))}
                    onPickNext={(id) => setActiveId(id)}
                    onBackToWorklist={close}
                  />
                ) : (
                  <div className={styles.cardStackEmpty}>
                    <Icon name="solar:checklist-minimalistic-linear" size={28} color="var(--neutral-200)" />
                    <span>No records to review on this document</span>
                  </div>
                )
              ) : visibleGroups.map((group) => (
                <PatientCard
                  key={group.key}
                  group={group}
                  hccMembers={hccMembers}
                  encStatus={encStatus}
                  onCite={citeField}
                  showToast={showToast}
                  activeBatch={activeBatch}
                  patchEnc={(enc, patch) => patchEnc?.(activeBatch.id, activeEncs.indexOf(enc), patch)}
                  onAddToWorklist={(enc) => {
                    const r = createFromEncounter?.({ ...enc, _docName: activeBatch.fileName, _batchId: activeBatch.id });
                    if (r?.kind === 'skipped') {
                      showToast?.(`Cannot add: ${r.reason || 'encounter is incomplete'}`);
                      return false;
                    }
                    setEncounterStatus?.(activeBatch.id, activeEncs.indexOf(enc), 'added');
                    return true;
                  }}
                  onDelete={(enc) => {
                    setEncounterStatus?.(activeBatch.id, activeEncs.indexOf(enc), 'deleted');
                    showToast?.(`Deleted ${enc.patient?.name || 'encounter'}`);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.emptyState}>
          <span className={styles.emptyStateBubble}>
            <Icon name="solar:server-2-linear" size={28} color="var(--neutral-300)" />
          </span>
          <span className={styles.emptyStateTitle}>No documents in the queue</span>
          <span className={styles.emptyStateSub}>Documents you upload appear here once extraction completes.</span>
        </div>
      )}
    </>
  );
}
