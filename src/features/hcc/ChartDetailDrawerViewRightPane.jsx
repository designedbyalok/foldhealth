import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon/Icon';
import { CloseButton } from '../../components/CloseButton/CloseButton';
import { Drawer } from '../../components/Drawer/Drawer';
import { Avatar } from '../../components/Avatar/Avatar';
import { AssigneeChange } from '../../components/AssigneeChange/AssigneeChange';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { RoleTooltip } from './RoleTooltip';
import { PatientBanner } from '../../components/PatientBanner/PatientBanner';
import { Button } from '../../components/Button/Button';
import { UploadDropField } from '../../components/UploadDropField/UploadDropField';
import { Select } from '../../components/Select/Select';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { ReviewProgressPopover, ProgressRing } from './DiagPanel/ReviewProgressPopover';
import { Checkbox } from '../../components/Checkbox/Checkbox';
import {
  StatusIcon,
  FailReasonInline,
  EditDocInline,
  FailedBadgeWithTooltip,
  InsufficientDosDialog,
} from './ChartDetailDrawerParts';
import { STATUS_OPTIONS, STATUS_BADGE } from './ChartDetailDrawer.utils';
import { DOC_TYPES } from './data/chartDocs';
import { VISIT_TYPES } from './reference/visitTypes';
import { DemoPhiStrip } from '../../components/DemoPhiStrip/DemoPhiStrip';
import styles from './ChartDetailDrawer.module.css';
import { ChartDetailDrawerViewDocList } from './ChartDetailDrawerViewDocList';
import { ChartReviewToolbar } from './ChartReviewToolbar';

// Parse the doc row's MM/DD/YYYY dateAdded into a Date. Same shape the
// DiagPanel timeline uses, so a single preset list ("Today", "Last 7
// days", …) works for both surfaces.
function parseDocDate(s) {
  if (typeof s !== 'string') return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(+m[3], +m[1] - 1, +m[2]);
}
function matchesDatePreset(d, preset) {
  const now = new Date();
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const today = startOfDay(now);
  const that = startOfDay(d);
  if (preset === 'Today')        return that.getTime() === today.getTime();
  if (preset === 'Last 7 days')  return today - that >= 0 && today - that <= 7  * 86400000;
  if (preset === 'Last 30 days') return today - that >= 0 && today - that <= 30 * 86400000;
  if (preset === 'This month')   return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  return true;
}

export function ChartDetailDrawerViewRightPane(p) {
  const {
    member, gender, overdue, teamBadgeRef, onTeamPillEnter, onTeamPillLeave, onTeamPillClick,
    teamReviewProgress, teamPillRect, teamReviewStages, cancelTeamClose, requestTeamClose,
    setTeamPillPinned, setTeamPillRect, isSupportAssigned, supportName, supportInitials,
    supportLocked, dmRef, openAssign, actionRef, currentBadge, supportActionsLocked,
    openAction, supportLockedTip, currentStatus, showReviewBanner, reviewerName,
    dosExpanded, setDosExpanded, dosList, m, canDeleteDos, setDosToDelete,
    showUpload, setShowUpload, commentsCountForMember, leftPanel, setLeftPanel,
    uploadKey, setUpFile, upCaption, setUpCaption, setUpCaptionTouched, upType, setUpType,
    upVisitType, setUpVisitType,
    canSaveUpload, saveUpload, resetUpload,
    docs, docActions, searchQuery, setSearchQuery, filterOpen, setFilterOpen,
    docFilters, setDocFilter, moreOpen, setMoreOpen, moreWrapRef,
  } = p;

  // Options fed to the Uploaded By chip, every unique uploader on this
  // record's doc set. `addedBy` is a display string, so the option list
  // renders human-readable names ("Benjamin Cummings (Support Team)",
  // "You") and matches the same field on the doc row 1:1.
  const uploadedByOptions = Array.from(new Set(
    (docs || []).map(d => d?.addedBy).filter(Boolean),
  ));

  // Doc list feed for the toolbar's Search + FilterChip row. Search
  // matches the caption / doc name / doc type substring; each filter
  // chip is multi-select: non-empty array narrows the list.
  const q = (searchQuery || '').trim().toLowerCase();
  const statusOf = (d) => {
    const a = docActions?.[d.id];
    if (a === 'pass') return 'Passed';
    if (a === 'fail') return 'Failed';
    return 'Pending';
  };
  const filteredDocs = (docs || []).filter(d => {
    if (q) {
      const hay = `${d.caption || ''} ${d.n || ''} ${d.t || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (docFilters?.docType?.length && !docFilters.docType.includes(d.t)) return false;
    if (docFilters?.status?.length && !docFilters.status.includes(statusOf(d))) return false;
    if (docFilters?.uploadedBy?.length && !docFilters.uploadedBy.includes(d.addedBy)) return false;
    if (docFilters?.date?.length) {
      const parsed = parseDocDate(d.dateAdded);
      if (!parsed || !docFilters.date.some(preset => matchesDatePreset(parsed, preset))) return false;
    }
    return true;
  });
  const docListProps = { ...p, docs: filteredDocs };

  return (
    <div className={styles.rightPane}>
            {/* Shared PatientBanner: scoped to the right column (Figma
                ICD-Import 4481:112909). */}
            <PatientBanner
              initials={member?.in || (member?.name || 'P').split(' ').map(w => w[0]).slice(0, 2).join('')}
              name={member?.name || 'Patient'}
              gender={gender}
              age={member?.age || ''}
              dob={member?.dob}
              memberId={member?.memberId || `#${member?.id || ''}`}
              raf={member?.raf}
              rafChange={member?.ri}
              rafUp={member?.ru !== false}
            />
            {/* Created / Support Team / assignee / status strip. */}
            <div className={styles.metaStrip}>
              <div className={styles.createdGroup}>
                <span className={styles.createdLabel}>Created :</span>
                <span className={styles.createdDate}>{member?.date || '06/15/2026'}</span>
                {overdue && <span className={styles.overdue}>({member.due})</span>}
              </div>
              <span className={styles.vDivider} />
              <span
                ref={teamBadgeRef}
                className={styles.teamBadge}
                onMouseEnter={onTeamPillEnter}
                onMouseLeave={onTeamPillLeave}
                onClick={onTeamPillClick}
                role="button"
                tabIndex={0}
                aria-label={`Support Team: review ${Math.round(teamReviewProgress * 100)}% complete. Hover or click for details.`}
                aria-expanded={!!teamPillRect}
              >
                <ProgressRing progress={teamReviewProgress} size={16} stroke={2} />
                <span>Support Team</span>
              </span>
              {teamPillRect && (
                <ReviewProgressPopover
                  anchorRect={teamPillRect}
                  stages={teamReviewStages}
                  onEnter={cancelTeamClose}
                  onLeave={requestTeamClose}
                  onClose={() => { setTeamPillPinned(false); setTeamPillRect(null); }}
                />
              )}
              <div className={styles.metaStripEnd}>
                {isSupportAssigned ? (
                  <RoleTooltip name={supportName} role="Support Team" initials={supportInitials} variant="staff">
                    {supportLocked ? (
                      <span
                        className={`${styles.dmBadge} ${styles.dmBadgeLocked}`}
                        aria-label={supportName}
                      >
                        <span className={styles.dmAvatar}>{supportInitials}</span>
                      </span>
                    ) : (
                      // name/role omitted so AssigneeChange's internal avatar-only
                      // tooltip stays quiet: the outer RoleTooltip already carries
                      // the hover card.
                      <AssigneeChange
                        ref={dmRef}
                        avatarOnly
                        initials={supportInitials}
                        onClick={openAssign}
                        ariaLabel={supportName}
                      />
                    )}
                  </RoleTooltip>
                ) : (
                  <AssigneeChange
                    ref={dmRef}
                    unassigned
                    avatarOnly
                    onClick={openAssign}
                    ariaLabel="Assign Support Team"
                  />
                )}
                <span className={styles.vDivider} />
                <button
                  type="button"
                  ref={actionRef}
                  className={styles.actionNeeded}
                  style={{ color: currentBadge.color, background: currentBadge.bg, borderColor: currentBadge.border }}
                  onClick={supportActionsLocked ? undefined : openAction}
                  disabled={supportActionsLocked}
                  title={supportActionsLocked ? supportLockedTip : undefined}
                  aria-disabled={supportActionsLocked}
                >
                  <StatusIcon status={currentStatus.key} size={12} />
                  {currentStatus.label}
                  {!supportActionsLocked && (
                    <Icon name="solar:alt-arrow-down-linear" size={12} color={currentBadge.color} />
                  )}
                </button>
              </div>
            </div>
            {/* Support-scoped review toolbar: same visual pattern as the
                DiagPanel one, minus Coder-only actions (Bulk select and
                Add ICD). Search filters the doc list; Comment / Timeline
                swap the left pane; Filter narrows by Pass/Fail/Pending;
                the More menu holds responsive overflow. */}
            <ChartReviewToolbar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              filterOpen={filterOpen}
              setFilterOpen={setFilterOpen}
              docFilters={docFilters}
              setDocFilter={setDocFilter}
              uploadedByOptions={uploadedByOptions}
              commentsCount={commentsCountForMember}
              leftPanel={leftPanel}
              setLeftPanel={setLeftPanel}
              moreOpen={moreOpen}
              setMoreOpen={setMoreOpen}
              moreWrapRef={moreWrapRef}
              actionsLocked={supportActionsLocked}
              actionsLockedTip={supportLockedTip}
              showUpload={showUpload}
              onUploadToggle={() => setShowUpload(v => !v)}
            />
            {showReviewBanner && (
              <div className={styles.passBanner}>
                <Icon name="solar:info-circle-linear" size={16} color="var(--status-success)" />
                <span>{reviewerName} Completed Document Review Task on {member?.date || '-'}.</span>
              </div>
            )}

            <div className={styles.rightBody}>
              {showUpload && (
                <div className={styles.uploadPanel}>
                  <DemoPhiStrip />
                  <UploadDropField key={uploadKey} onChange={setUpFile} />
                  <div className={styles.uploadField}>
                    <span className={styles.uploadLabel}>Caption<span className={styles.uploadReq} aria-hidden="true" /></span>
                    <input aria-label="Caption"
                      type="text"
                      className={styles.uploadInput}
                      placeholder="Add caption"
                      value={upCaption}
                      onChange={(e) => { setUpCaption(e.target.value); setUpCaptionTouched(true); }}
                    />
                  </div>
                  <div className={styles.uploadField}>
                    <span className={styles.uploadLabel}>Document Type<span className={styles.uploadReq} aria-hidden="true" /></span>
                    <Select
                      className={styles.uploadSelect}
                      options={DOC_TYPES.map((t) => ({ value: t, label: t }))}
                      value={upType}
                      onValueChange={setUpType}
                      placeholder="Select Type"
                    />
                  </div>
                  {/* Visit Type: mirrors the HCC worklist's Visit Type column
                      so a document uploaded here can be linked back to the
                      same encounter categories the DOS rows show. Optional. */}
                  <div className={styles.uploadField}>
                    <span className={styles.uploadLabel}>Visit Type</span>
                    <Select
                      className={styles.uploadSelect}
                      options={VISIT_TYPES.map((vt) => ({ value: vt, label: vt }))}
                      value={upVisitType}
                      onValueChange={setUpVisitType}
                      placeholder="Select Visit Type"
                    />
                  </div>
                  <div className={styles.uploadActions}>
                    <Button size="sm" disabled={!canSaveUpload} onClick={saveUpload}>Save</Button>
                    <Button variant="outline" size="sm" onClick={resetUpload}>Discard</Button>
                  </div>
                </div>
              )}

              <div className={styles.assocRow}>
                <div className={styles.assocLeft}>
                  <span className={styles.assocLabel}>Document Associated with</span>
                  <button
                    type="button"
                    className={styles.dosBadge}
                    onClick={() => setDosExpanded(o => !o)}
                    aria-expanded={dosExpanded}
                  >
                    {dosList.length} DOSs
                    <Icon name={dosExpanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'} size={11} color="var(--primary-300)" />
                  </button>
                </div>
              </div>

              {/* Expandable DOS list with a per-DOS toggle (mirrors the
                  Diagnosis Gap drawer). */}
              {dosExpanded && dosList.length > 0 && (
                <div className={styles.dosPanel}>
                  {dosList.map(d => {
                    const provider = d.provider || m?.rp || '-';
                    const pos = d.pos || d.posDesc || m?.pos || m?.posDesc || '-';
                    const vt = d.vt || m?.vt || 'HCC';
                    return (
                      <div key={d.date} className={styles.dosPanelRow}>
                        <div className={styles.dosPanelInfo}>
                          <div className={styles.dosPanelDate}>{d.date}</div>
                          <div className={styles.dosPanelMeta}>
                            Rendering Provider: {provider}
                            <span className={styles.dosPanelSep}>•</span>
                            POS: {pos}
                            <span className={styles.dosPanelSep}>•</span>
                            Visit Type: {vt}
                          </div>
                        </div>
                        {canDeleteDos && (
                          <ActionButton
                            size="sm"
                            icon="solar:trash-bin-trash-linear"
                            tooltip="Delete DOS"
                            onClick={() => setDosToDelete(d.date)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {filteredDocs.length === 0 && (docs?.length || 0) > 0 ? (
                <div className={styles.docsEmptyMatch}>
                  <Icon name="solar:magnifer-linear" size={18} color="var(--neutral-200)" />
                  <span>No documents match this search.</span>
                </div>
              ) : (
                <ChartDetailDrawerViewDocList {...docListProps} />
              )}
            </div>
    </div>
  );
}
