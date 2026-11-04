import { Icon } from '../../../components/Icon/Icon';
import { Badge } from '../../../components/Badge/Badge';
import { Switch } from '../../../components/Switch/Switch';
import { Checkbox } from '../../../components/Checkbox/Checkbox';
import { IcdCard } from './IcdCard';
import { IcdDosCard } from './IcdDosCard';
import { SuspectCard } from './HccSuspectGroup';
import { dosSourceLetter } from '../dosSource';
import { DiagPanelViewCardsAlerts } from './DiagPanelViewCardsAlerts';
import styles from './DiagPanel.module.css';

export function DiagPanelViewCards(p) {
  const {
    isDosRejected, isDosBilled, billedLockReason,
    dosState, rejectInfo, member, newRowNotice, memberId, dismissNewRowNotice,
    openDiagPanel, pendingGaps, memberDosList, chartsList, gapDosOptions, gapPosOptions,
    gapVtOptions, gapDocTypeOptions, gapProviderAll, updatePendingGap, removePendingGap,
    savePendingGap, bulkMode, rowKeys, associatedSelectState, toggleSelectAllAssociated,
    dosExpanded, setDosExpanded, enabledDates, dosList, disabledDos, setDisabledDos,
    openHccClaimForDos, diagnosisGapsLoading, cardIcds, actedSuspects, pendingSuspects, q,
    focusKey, handleFocusRow, selectedKeys, toggleSelected, openDismissKey, setOpenDismissKey,
    advanceFocusAfterAction, stageLocked, rejectionLockReason, recordsRequestLockReason,
  } = p;
  // A single reason string surfaced on every locked control below. Rejection
  // is the more specific / terminal explanation, so it wins over the
  // records-request pending one when both would apply. Billed sits in the
  // middle: less specific than a rejection reason, more specific than a
  // records-request pending prompt.
  const lockReason = rejectionLockReason || billedLockReason || recordsRequestLockReason;
  const reviewLocked = stageLocked || isDosRejected || isDosBilled;
  return (
    <>
      {/* ── Body: ICD-first cards + HCC suspect groups + collapsed history ── */}
      <div className={styles.cardsList}>
        <DiagPanelViewCardsAlerts
          isDosRejected={isDosRejected}
          isDosBilled={isDosBilled}
          dosState={dosState}
          rejectInfo={rejectInfo}
          member={member}
          newRowNotice={newRowNotice}
          memberId={memberId}
          dismissNewRowNotice={dismissNewRowNotice}
          openDiagPanel={openDiagPanel}
        />

        {/* Pending gap cards from the toolbar's + ICD flow. Rendered above
            the associated-ICDs list so the user completes them in place
            without leaving the drawer or losing sight of the linked docs
            on the LHS. */}
        {pendingGaps.length > 0 && (
          <div className={styles.pendingGaps}>
            {pendingGaps.map((card, idx) => (
              <IcdCard
                key={`pending-${card.pick.code}-${idx}`}
                card={card}
                member={member}
                memberDosList={memberDosList}
                memberDocs={chartsList}
                dosOptions={gapDosOptions}
                posOptions={gapPosOptions}
                vtOptions={gapVtOptions}
                docTypeOptions={gapDocTypeOptions}
                providerAll={gapProviderAll}
                onUpdate={(patch) => updatePendingGap(idx, patch)}
                onRemove={() => removePendingGap(idx)}
                onSave={() => savePendingGap(idx)}
              />
            ))}
          </div>
        )}

        {/* Section header: the DOS badge expands an inline per-DOS panel
            with toggles (Paper 1ZV3). Toggling a DOS off hides its rows.
            In bulk mode a select-all checkbox precedes the title with a
            tri-state (none/some/all) that mirrors row selection. */}
        <div className={styles.assocHeader}>
          {bulkMode && rowKeys.length > 0 && (
            <Checkbox
              className={styles.assocSelectAll}
              checked={
                associatedSelectState === 'checked'
                  ? true
                  : associatedSelectState === 'indeterminate'
                    ? 'indeterminate'
                    : false
              }
              onCheckedChange={toggleSelectAllAssociated}
              aria-label={associatedSelectState === 'checked' ? 'Deselect all associated ICDs' : 'Select all associated ICDs'}
            />
          )}
          <span className={styles.assocTitle}>ICDs Associated with</span>
          <button
            type="button"
            className={styles.dosBadge}
            onClick={() => setDosExpanded(o => !o)}
            aria-expanded={dosExpanded}
          >
            {enabledDates.length}/{dosList.length} DOSs
            <Icon name={dosExpanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'} size={12} color="var(--primary-300)" />
          </button>
        </div>

        {dosExpanded && dosList.length > 0 && (
          <div className={styles.dosPanel}>
            {dosList.map(d => {
              const enabled = !disabledDos.has(d.date);
              const provider = d.provider || member.rp || '-';
              const pos = d.pos || d.posDesc || member.pos || member.posDesc || '-';
              const vt = d.vt || member.vt || 'HCC';
              // Same D/C/M classifier the worklist letter badge uses, so this
              // panel and the worklist agree on where each DOS came from.
              // No document on file → 'D' is impossible.
              const srcLetter = dosSourceLetter(d, chartsList.length > 0);
              const srcMeta = srcLetter === 'D' ? { label: 'Documents', variant: 'neutral' }
                : srcLetter === 'C' ? { label: 'Claims',   variant: 'primary'    }
                :                     { label: 'Manual',   variant: 'secondary'    };
              const isClaim = srcLetter === 'C';
              return (
                <div key={d.date} className={styles.dosPanelRow}>
                  <div className={styles.dosPanelInfo}>
                    {isClaim ? (
                      <button
                        type="button"
                        className={styles.dosPanelDateRowBtn}
                        onClick={() => openHccClaimForDos(d.date)}
                        title={`Open claim for DOS ${d.date}`}
                      >
                        <span className={styles.dosPanelDate}>{d.date}</span>
                        <Badge size="sm" tone={srcMeta.variant} label={srcMeta.label} />
                      </button>
                    ) : (
                      <div className={styles.dosPanelDateRow}>
                        <span className={styles.dosPanelDate}>{d.date}</span>
                        <Badge size="sm" tone={srcMeta.variant} label={srcMeta.label} />
                      </div>
                    )}
                    <div className={styles.dosPanelMeta}>
                      Rendering Provider: {provider} <span className={styles.dosPanelSep}>•</span> POS: {pos} <span className={styles.dosPanelSep}>•</span> Visit Type: {vt}
                    </div>
                  </div>
                  <Switch
                    checked={enabled}
                    ariaLabel={`Toggle DOS ${d.date}`}
                    onChange={() => setDisabledDos(prev => {
                      const next = new Set(prev);
                      if (next.has(d.date)) next.delete(d.date); else next.add(d.date);
                      return next;
                    })}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Bulk-action bar has moved to the drawer footer (see BulkActionFooter
            in the header slot swap above) so it stays pinned at the bottom
            regardless of scroll position. */}

        <div className={styles.cardsFlow}>
          {/* Skeleton state: replaces the ICD cards while the diagnosis-gap
              fetch is in flight, so switching between members doesn't flash
              the previous record's ICDs before the new data lands. */}
          {diagnosisGapsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={`skel-${i}`} className={styles.icdCardSkeleton} aria-hidden="true">
                <div className={[styles.skelBar, styles.skelBarTitle].join(' ')} />
                <div className={[styles.skelBar, styles.skelBarSub].join(' ')} />
                <div className={styles.skelBar} />
              </div>
            ))
          ) : (cardIcds.length === 0 && actedSuspects.length === 0 && pendingSuspects.length === 0 && (
            <div className={styles.empty}>
              <Icon name="solar:file-text-linear" size={32} color="var(--neutral-200)" />
              <p>No diagnosis gaps {q ? 'match your search' : 'recorded yet for this member'}.</p>
            </div>
          ))}
          {!diagnosisGapsLoading && cardIcds.map((icd, i) => (
            <IcdDosCard
              key={`card-${icd.code}-${i}`}
              icd={icd}
              currentDos={p.currentDos}
              focusKey={focusKey}
              onFocusRow={handleFocusRow}
              selectedKeys={selectedKeys}
              onToggleSelect={bulkMode ? toggleSelected : null}
              openDismissKey={openDismissKey}
              onOpenDismiss={setOpenDismissKey}
              onActed={advanceFocusAfterAction}
              reviewLocked={reviewLocked}
              lockReason={lockReason}
            />
          ))}
          {/* Acted suspects graduate into the associated list as normal cards. */}
          {!diagnosisGapsLoading && actedSuspects.map((icd, i) => (
            <IcdDosCard
              key={`acted-suspect-${icd.code}-${i}`}
              icd={icd}
              focusKey={focusKey}
              onFocusRow={handleFocusRow}
              selectedKeys={selectedKeys}
              onToggleSelect={bulkMode ? toggleSelected : null}
              openDismissKey={openDismissKey}
              onOpenDismiss={setOpenDismissKey}
              onActed={advanceFocusAfterAction}
              reviewLocked={reviewLocked}
              lockReason={lockReason}
            />
          ))}

          {!diagnosisGapsLoading && pendingSuspects.length > 0 && (
            <div className={styles.assocHeader}>
              <span className={styles.assocTitle}>Suspects and Recaptures</span>
            </div>
          )}
          {!diagnosisGapsLoading && pendingSuspects.map((icd, i) => (
            <SuspectCard
              key={`suspect-${icd.code}-${i}`}
              icd={icd}
              dosList={dosList}
              member={member}
              reviewLocked={reviewLocked}
              lockReason={lockReason}
              bulkDisabled={bulkMode}
            />
          ))}
        </div>

        {/* Overridden ICDs + Closed ICDs sections removed per request, code
            kept commented out rather than deleted.
        <div className={styles.icdSections}>
          <IcdSection
            title="Overridden ICDs"
            count={overriddenICDs.length}
            open={overriddenOpen}
            onToggle={() => setOverriddenOpen(o => !o)}
          >
            {overriddenICDs.length === 0
              ? <SectionEmpty label="No overridden ICDs" />
              : overriddenICDs.map((icd, i) => <IcdRow key={`o-${icd.code}-${i}`} icd={icd} />)
            }
          </IcdSection>
          <IcdSection
            title="Closed ICDs"
            count={closedICDs.length}
            open={closedOpen}
            onToggle={() => setClosedOpen(o => !o)}
          >
            {closedICDs.length === 0
              ? <SectionEmpty label="No closed ICDs" />
              : closedICDs.map((icd, i) => <IcdRow key={`c-${icd.code}-${i}`} icd={icd} />)
            }
          </IcdSection>
        </div>
        */}
      </div>
    </>
  );
}
