import { Icon } from '../../../components/Icon/Icon';
import { PatientBanner } from '../../../components/PatientBanner/PatientBanner';
import { DosStatusMenu } from './DosStatusMenu';
import { ReviewProgressPopover, ProgressRing } from './ReviewProgressPopover';
import { AssigneeAvatar } from './DiagPanelAssignee';
import styles from './DiagPanel.module.css';

export function DiagPanelViewHeader(p) {
  const {
    member, rafImpact, noop, slaVerdict, pillRef, onPillEnter, onPillLeave, onPillClick,
    pillLabel, reviewProgress, pillRect, reviewStages, cancelClose, requestClose,
    setPillPinned, setPillRect, dosState, currentDos, isDosRejected, isDosBilled, actingStatus,
    handleStatusChange, actingRole, stageLocked, recordsRequestLockReason, embedded,
  } = p;
  return (
    <>
      {/* ── Row 2: Patient Banner (shared component). In the patient split the
          patient card beside it already carries this context. ── */}
      {!embedded && <PatientBanner
        initials={member.in}
        name={member.name}
        gender={member.g === 'M' ? 'Male' : member.g === 'F' ? 'Female' : member.g}
        age={member.age || ''}
        dob={member.dob}
        memberId={member.memberId || `#${member.id}`}
        raf={member.raf}
        rafChange={rafImpact}
        rafUp={member.ru !== false}
        patientId={member.id}
      />}

      {/* ── Meta row: Created date + overdue + stage pill | assignee + status ── */}
      <div className={styles.dosRow}>
        <div className={styles.dosRowLeft}>
          <span className={[styles.createdLabel, styles.hideBelow540].join(' ')}>Created :</span>
          <span className={styles.createdDate}>{member.date || '—'}</span>
          {slaVerdict ? (
            <span className={[styles.dueTag, styles.hideBelow460].join(' ')} style={{ color: slaVerdict.colorVar }}>
              <Icon name={slaVerdict.icon} size={12} color={slaVerdict.colorVar} /> {slaVerdict.label}
            </span>
          ) : member.due && (
            <span className={[styles.dueTag, styles.hideBelow460].join(' ')} style={{ color: member.dueCol || 'var(--status-error)' }}>
              ({member.due})
            </span>
          )}
          <span className={[styles.dosRowDivider, styles.hideBelow540].join(' ')} />
          {/* Stage pill — hover opens the Review Progress popover; the ring
              is a real progress indicator driven by the engine state. */}
          <span
            ref={pillRef}
            className={styles.withCoderPill}
            onMouseEnter={onPillEnter}
            onMouseLeave={onPillLeave}
            onClick={onPillClick}
            role="button"
            tabIndex={0}
            aria-label={`${pillLabel} — review ${Math.round(reviewProgress * 100)}% complete. Hover or click for details.`}
            aria-expanded={!!pillRect}
          >
            <ProgressRing progress={reviewProgress} size={16} stroke={2} />
            <span>{pillLabel}</span>
          </span>
          {pillRect && (
            <ReviewProgressPopover
              anchorRect={pillRect}
              stages={reviewStages}
              onEnter={cancelClose}
              onLeave={requestClose}
              onClose={() => { setPillPinned(false); setPillRect(null); }}
            />
          )}
        </div>
        <div className={styles.dosRowRight}>
          <AssigneeAvatar
            member={member}
            dosState={dosState}
            currentDos={currentDos}
            locked={isDosRejected}
            billed={isDosBilled}
          />
          <span className={styles.dosRowDivider} />
          <DosStatusMenu
            value={actingStatus}
            onChange={handleStatusChange}
            role={actingRole}
            disabled={stageLocked || isDosRejected || isDosBilled}
            disabledReason={(() => {
              const supStatus = dosState?.support?.status || member?.supS;
              if (isDosRejected) return 'Record was Rejected upstream — no downstream action';
              if (isDosBilled) return 'Record has been billed — no further edits allowed';
              if (recordsRequestLockReason) return recordsRequestLockReason;
              if (supStatus === 'Insufficient') return 'Support marked the documents Insufficient — nothing to code yet';
              if (supStatus === 'Reject' || supStatus === 'Rejected') return 'Support rejected this DOS — no downstream action';
              return 'Support and Coder must complete their work first';
            })()}
          />
        </div>
      </div>
    </>
  );
}
