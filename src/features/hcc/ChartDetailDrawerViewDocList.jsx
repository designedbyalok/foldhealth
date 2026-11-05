import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Button } from '../../components/Button/Button';
import { Select } from '../../components/Select/Select';
import { FailReasonInline, EditDocInline, FailedBadgeWithTooltip } from './ChartDetailDrawerParts';
import { DOC_TYPES } from './data/chartDocs';
import styles from './ChartDetailDrawer.module.css';

export function ChartDetailDrawerViewDocList(p) {
  const {
    docs, docActions, selected, failPrompt, editingDocId, setSelectedId, setFailPrompt,
    setEditingDocId, passDoc, failDoc, failDetails, moreMenu, setMoreMenu, unlinkDoc,
    undoDoc, isSupportAssigned, supportActionsLocked, supportLockedTip, m, showToast,
    updateChartDocMeta, reviewerName, confirmFailDoc, setLeftPanel,
  } = p;
  // Selecting a card should always return the left pane to the PDF
  // preview: clicking a doc while Comments/Timeline is open is the
  // user asking to see that doc again.
  const openDoc = (id) => { setSelectedId(id); setLeftPanel?.('preview'); };
  return (
    <>
              {docs.map((d) => {
                const action = docActions[d.id] || null;
                const isSel = !!selected && d.id === selected.id;
                const isFailing = failPrompt?.id === d.id;
                const isEditingRow = editingDocId === d.id;
                return (
                  <div
                    key={d.id}
                    className={`${styles.docCard} ${isSel ? styles.docCardSelected : ''} ${(isFailing || isEditingRow) ? styles.docCardFailing : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => openDoc(d.id)}
                    onKeyDown={(e) => {
                      // Only act when the card div itself is focused, otherwise a
                      // space typed into the inline Fail form's textarea (or any
                      // nested input) bubbles up and gets preventDefault'd here.
                      if (e.target !== e.currentTarget) return;
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDoc(d.id); }
                    }}
                  >
                    <div className={styles.docCardHeader}>
                      <span className={styles.docThumb} aria-hidden="true">
                        <Icon name="custom:pdf-file" size={20} color="var(--neutral-400)" />
                      </span>
                      <div className={styles.docCardText}>
                        <span className={styles.docName}>{d.caption || d.n}</span>
                        <span className={styles.docMeta}>
                          {d.t} • {d.dateAdded || '-'} • {d.addedBy || '-'}
                        </span>
                      </div>
                      <div className={styles.docActions} onClick={(e) => e.stopPropagation()}>
                        {action === 'pass' ? (
                          <>
                            <span className={styles.passedBadge}>
                              <Icon name="solar:check-read-linear" size={12} color="var(--status-success)" />
                              Passed
                            </span>
                            <button
                              type="button"
                              className={styles.undoBtn}
                              aria-label="Undo"
                              disabled={supportActionsLocked}
                              title={supportActionsLocked ? supportLockedTip : 'Undo'}
                              onClick={() => undoDoc(d.id)}
                            >
                              <Icon name="solar:undo-left-round-linear" size={16} color="var(--neutral-400)" />
                            </button>
                          </>
                        ) : action === 'fail' ? (
                          <>
                            <FailedBadgeWithTooltip details={failDetails[d.id]} />
                            <button
                              type="button"
                              className={styles.undoBtn}
                              aria-label="Undo"
                              disabled={supportActionsLocked}
                              title={supportActionsLocked ? supportLockedTip : 'Undo'}
                              onClick={() => undoDoc(d.id)}
                            >
                              <Icon name="solar:undo-left-round-linear" size={16} color="var(--neutral-400)" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={styles.passFailPill}
                              title={supportActionsLocked ? supportLockedTip : 'Pass'}
                              disabled={supportActionsLocked}
                              onClick={() => passDoc(d.id)}
                            >
                              <Icon name="solar:check-circle-linear" size={12} color="var(--neutral-300)" />
                              Pass
                            </button>
                            <button
                              type="button"
                              className={styles.passFailPill}
                              title={supportActionsLocked ? supportLockedTip : 'Fail'}
                              disabled={isFailing || supportActionsLocked}
                              onClick={() => failDoc(d.id)}
                            >
                              <Icon name="solar:close-circle-linear" size={12} color="var(--neutral-300)" />
                              Fail
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className={styles.moreBtn}
                          aria-label="More actions"
                          disabled={supportActionsLocked}
                          title={supportActionsLocked ? supportLockedTip : undefined}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (moreMenu?.docId === d.id) { setMoreMenu(null); return; }
                            const r = e.currentTarget.getBoundingClientRect();
                            setMoreMenu({ docId: d.id, top: r.bottom + 4, right: window.innerWidth - r.right });
                          }}
                        >
                          <Icon name="solar:menu-dots-linear" size={15} color="currentColor" />
                        </button>
                      </div>
                    </div>
                    {isFailing && (
                      <FailReasonInline
                        onCancel={() => setFailPrompt(null)}
                        onConfirm={confirmFailDoc}
                      />
                    )}
                    {isEditingRow && (
                      <EditDocInline
                        doc={d}
                        onCancel={() => setEditingDocId(null)}
                        onSave={({ caption, docType, visitType }) => {
                          updateChartDocMeta(m.id, d.id, {
                            n: caption,
                            caption,
                            t: docType,
                            vt: visitType || undefined,
                          });
                          showToast(`Updated ${caption}`);
                          setEditingDocId(null);
                        }}
                      />
                    )}
                  </div>
                );
              })}
    </>
  );
}
