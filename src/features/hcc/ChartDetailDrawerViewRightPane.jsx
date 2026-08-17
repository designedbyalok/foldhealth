import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon/Icon';
import { CloseButton } from '../../components/CloseButton/CloseButton';
import { Drawer } from '../../components/Drawer/Drawer';
import { Avatar } from '../../components/Avatar/Avatar';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { RoleTooltip } from './RoleTooltip';
import { PatientBanner } from '../../components/PatientBanner/PatientBanner';
import { Button } from '../../components/Button/Button';
import { UploadDropField } from '../../components/UploadDropField/UploadDropField';
import { Select } from '../../components/Select/Select';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { ReviewProgressPopover, ProgressRing } from './DiagPanel/ReviewProgressPopover';
import { Checkbox } from '../../components/ShadcnCheckbox/ShadcnCheckbox';
import {
  StatusIcon,
  FailReasonInline,
  EditDocInline,
  FailedBadgeWithTooltip,
  InsufficientDosDialog,
} from './ChartDetailDrawerParts';
import { STATUS_OPTIONS, STATUS_BADGE } from './ChartDetailDrawer.utils';
import { DOC_TYPES } from './data/chartDocs';
import { DemoPhiStrip } from '../../components/DemoPhiStrip/DemoPhiStrip';
import styles from './ChartDetailDrawer.module.css';
import { ChartDetailDrawerViewDocList } from './ChartDetailDrawerViewDocList';

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
    canSaveUpload, saveUpload, resetUpload,
  } = p;

  return (
    <div className={styles.rightPane}>
            {/* Shared PatientBanner — scoped to the right column (Figma
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
                aria-label={`Support Team — review ${Math.round(teamReviewProgress * 100)}% complete. Hover or click for details.`}
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
                      <button type="button" ref={dmRef} className={styles.dmBadge} onClick={openAssign} aria-label={supportName}>
                        <span className={styles.dmAvatar}>{supportInitials}</span>
                        <Icon name="solar:alt-arrow-down-linear" size={11} color="var(--secondary-300)" />
                      </button>
                    )}
                  </RoleTooltip>
                ) : (
                  <button type="button" ref={dmRef} className={styles.dmUnassigned} onClick={openAssign} title="Assign Support Team" aria-label="Assign Support Team">
                    <Icon name="solar:user-plus-linear" size={14} color="var(--neutral-300)" />
                    <Icon name="solar:alt-arrow-down-linear" size={11} color="var(--neutral-300)" />
                  </button>
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
            {showReviewBanner && (
              <div className={styles.passBanner}>
                <Icon name="solar:info-circle-linear" size={16} color="var(--status-success)" />
                <span>{reviewerName} Completed Document Review Task on {member?.date || '—'}.</span>
              </div>
            )}

            <div className={styles.rightBody}>
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
                <div className={styles.assocActions}>
                  <button
                    type="button"
                    className={styles.uploadLink}
                    onClick={() => setShowUpload(v => !v)}
                    disabled={supportActionsLocked}
                    title={supportActionsLocked ? supportLockedTip : undefined}
                  >
                    <Icon name="solar:upload-minimalistic-linear" size={16} color="var(--primary-300)" />
                    Upload
                  </button>
                  <span className={styles.assocActionsDivider} aria-hidden="true" />
                  <ActionButton
                    icon="solar:chat-round-linear"
                    size="S"
                    tooltip={supportActionsLocked ? supportLockedTip : 'Comment'}
                    tooltipLeft={supportActionsLocked}
                    tooltipBelow={supportActionsLocked}
                    count={commentsCountForMember > 0 ? String(commentsCountForMember) : undefined}
                    className={leftPanel === 'comments' ? styles.commentBtnActive : ''}
                    onClick={supportActionsLocked ? undefined : () => setLeftPanel(v => v === 'comments' ? 'preview' : 'comments')}
                    aria-pressed={leftPanel === 'comments'}
                    state={supportActionsLocked ? 'disabled' : 'active'}
                  />
                </div>
              </div>

              {/* Expandable DOS list with a per-DOS toggle (mirrors the
                  Diagnosis Gap drawer). */}
              {dosExpanded && dosList.length > 0 && (
                <div className={styles.dosPanel}>
                  {dosList.map(d => {
                    const provider = d.provider || m?.rp || '—';
                    const pos = d.pos || d.posDesc || m?.pos || m?.posDesc || '—';
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
                            size="S"
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
                      onChange={setUpType}
                      placeholder="Select Type"
                    />
                  </div>
                  <div className={styles.uploadActions}>
                    <Button variant="primary" size="S" disabled={!canSaveUpload} onClick={saveUpload}>Save</Button>
                    <Button variant="secondary" size="S" onClick={resetUpload}>Discard</Button>
                  </div>
                </div>
              )}

              <ChartDetailDrawerViewDocList {...p} />
            </div>
    </div>
  );
}
