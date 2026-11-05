import { Icon } from '../../../components/Icon/Icon';
import { CloseIcon } from '../../../components/Icon/CloseIcon';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import styles from './DiagPanel.module.css';

export function DiagPanelViewCardsAlerts({
  isDosRejected, isDosBilled, dosState, rejectInfo, member, newRowNotice, memberId,
  dismissNewRowNotice, openDiagPanel,
}) {
  return (
    <>
      {isDosBilled && (() => {
        const billedRole = ['support', 'coder', 'reviewer', 'reviewer2']
          .find(r => dosState?.[r]?.status === 'Billed');
        const roleRecord = billedRole ? dosState?.[billedRole] : null;
        const ROLE_LABEL_B = { support: 'Support Team', coder: 'Coder', reviewer: 'QA', reviewer2: 'Compliance' };
        const roleLabel = ROLE_LABEL_B[billedRole] || '';
        const stamp = roleRecord?.at
          ? new Date(roleRecord.at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
          : null;
        return (
          <div className={styles.billedBanner} role="status">
            <Icon name="solar:dollar-linear" size={18} color="var(--status-success)" />
            <div className={styles.billedBannerText}>
              <div className={styles.billedBannerTitle}>Record Billed</div>
              <div className={styles.billedBannerMeta}>
                {roleLabel
                  ? <>Marked billed by <strong>{roleLabel}</strong>{stamp ? ` on ${stamp}` : ''}</>
                  : 'This record has been submitted and billed.'}
              </div>
              <div className={styles.billedBannerHint}>
                All ICD actions are locked. You can still add a Comment.
              </div>
            </div>
          </div>
        );
      })()}
      {isDosRejected && (() => {
        const ROLE_LABEL_R = { support: 'Support Team', coder: 'Coder', reviewer: 'QA', reviewer2: 'Compliance' };
        const rejectingRole = ['support', 'coder', 'reviewer', 'reviewer2']
          .find(r => (dosState?.[r]?.status === 'Reject' || dosState?.[r]?.status === 'Rejected'));
        const roleRecord = rejectingRole ? dosState?.[rejectingRole] : null;
        const nameField = { support: 'sup', coder: 'cdr', reviewer: 'r1', reviewer2: 'r2' }[rejectingRole];
        const fallbackBy = rejectInfo?.by || roleRecord?.by || (nameField ? member?.[nameField] : null);
        const roleLabel = rejectInfo?.role || ROLE_LABEL_R[rejectingRole] || '';
        const reasons = rejectInfo?.reasons || (roleRecord?.reason ? [roleRecord.reason] : []);
        const note = rejectInfo?.note || '';
        const stamp = rejectInfo?.date
          ? `${rejectInfo.date}${rejectInfo.time ? ` · ${rejectInfo.time}` : ''}`
          : null;
        return (
          <div className={styles.rejectBanner} role="status">
            <Icon name="solar:info-circle-bold" size={18} color="var(--status-error)" />
            <div className={styles.rejectBannerText}>
              <div className={styles.rejectBannerTitle}>Record Rejected</div>
              <div className={styles.rejectBannerMeta}>
                {fallbackBy
                  ? <>Rejected by <strong>{fallbackBy}</strong>{roleLabel ? ` (${roleLabel})` : ''}{stamp ? ` on ${stamp}` : ''}</>
                  : (roleLabel ? `Rejected by ${roleLabel}` : 'This record has been rejected.')}
              </div>
              {(reasons.length > 0 || note) && (
                <div className={styles.rejectBannerBody}>
                  {reasons.length > 0 && (
                    <div className={styles.rejectBannerReasons}>
                      <span className={styles.rejectBannerLabel}>Reason:</span>
                      {reasons.map(r => (
                        <span key={r} className={styles.rejectBannerReason}>{r}</span>
                      ))}
                    </div>
                  )}
                  {note && (
                    <div className={styles.rejectBannerNote}>
                      <span className={styles.rejectBannerLabel}>Note:</span> {note}
                    </div>
                  )}
                </div>
              )}
              <div className={styles.rejectBannerHint}>
                All ICD actions are locked. You can still add a Comment.
              </div>
            </div>
          </div>
        );
      })()}

      {newRowNotice && (
        <div className={styles.newRowBadge} role="status">
          <Icon name="solar:info-circle-linear" size={16} color="var(--primary-300)" />
          <span className={styles.newRowBadgeText}>
            {newRowNotice.kind === 'existing-row'
              ? <>ICD added to sibling row (Created <strong>{newRowNotice.createdDate}</strong>) for DOS <strong>{newRowNotice.dos}</strong></>
              : <>New worklist row created for DOS <strong>{newRowNotice.dos}</strong></>}
          </span>
          <button
            type="button"
            className={styles.newRowBadgeLink}
            onClick={() => {
              const { newMemberId } = newRowNotice;
              dismissNewRowNotice(memberId);
              openDiagPanel(newMemberId);
            }}
          >
            View row
            <Icon name="solar:arrow-right-linear" size={12} color="currentColor" />
          </button>
          <ActionButton size="sm" tooltip="Dismiss" onClick={() => dismissNewRowNotice(memberId)}>
            <CloseIcon size={14} color="var(--neutral-300)" />
          </ActionButton>
        </div>
      )}
    </>
  );
}
