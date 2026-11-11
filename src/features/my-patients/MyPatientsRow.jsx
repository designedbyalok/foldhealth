import { useRef } from 'react';
import { PatientAvatarHover } from '../../components/PatientHoverCard/PatientAvatarHover';
import { Checkbox } from '../../components/Checkbox/Checkbox';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Avatar } from '../../components/Avatar/Avatar';
import { Badge } from '../../components/Badge/Badge';
import { Icon } from '../../components/Icon/Icon';
import { Tooltip } from '../../components/Tooltip/Tooltip';
import { FoldIdTag } from '../../components/FoldIdTag/FoldIdTag';
import { formatDobDisplay, deriveDob } from '../../lib/patientDob';
import { memberLanguageLabel } from '../../lib/memberFilters';
import { worklistMemberCallId } from '../../lib/patientCall';
import { useAppStore } from '../../store/useAppStore';
import { adherenceBand, lastTouchText, minutesState, reviewState } from './myPatientsModel';
import styles from './MyPatientsRow.module.css';

const PROGRAMS_SHOWN = 3;
const initialsOf = name => (name || '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

/** One patient on My Patients: who they are, their programs, how the plan is going and why they're here. */
export function MyPatientsRow({ row, hiddenSet, selected, onToggle, onOpenPrograms, showToast }) {
  const openQuickView = useAppStore(s => s.openQuickView);
  const openCallPopover = useAppStore(s => s.openCallPopover);
  const callBtnRef = useRef(null);
  const show = key => !hiddenSet?.has(key);
  const language = row.language || 'en';
  const dobLabel = formatDobDisplay(row.dob) || deriveDob(row.age, row.name);
  const band = adherenceBand(row.adherence);
  const delta = row.adherencePrev == null ? 0 : row.adherence - row.adherencePrev;
  const review = reviewState(row.lastReview, row.reviewCadenceDays);
  const minutes = minutesState(row);
  const extraPrograms = row.programs.slice(PROGRAMS_SHOWN);

  return (
    <tr className={[styles.row, selected ? styles.rowSelected : ''].filter(Boolean).join(' ')}>
      <td className={`${styles.checkTd} ${styles.stickyLeft}`} style={{ left: 0 }}>
        <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={`Select ${row.name}`} />
      </td>

      <td className={`${styles.membersTd} ${styles.stickyLeft}`} style={{ left: 36 }}>
        <div className={styles.patientCell}>
          <PatientAvatarHover patient={{ memberId: row.memberId, id: row.id, name: row.name, initials: row.initials, gender: row.gender, age: row.age, dob: row.dob }} />
          <div>
            <div className={styles.patientName}>
              <button
                type="button"
                className={styles.patientNameLink}
                onClick={() => openQuickView({ id: row.id, name: row.name, initials: row.initials, gender: row.gender, age: row.age, memberId: row.memberId, language })}
              >
                {row.name}
              </button>{' '}
              <Tooltip label={dobLabel ? `DOB: ${dobLabel}` : ''} placement="bottom">
                <span className={styles.patientDemo}>({row.gender}•{row.age})</span>
              </Tooltip>
            </div>
            <div className={styles.patientMeta}>
              <FoldIdTag id={row.memberId} className={styles.foldId} showToast={showToast} />{' '}•{' '}
              <Tooltip label={`Preferred Language: ${memberLanguageLabel(language)}`} variant="light">
                <span className={styles.langBadge}>{language.toUpperCase()}</span>
              </Tooltip>
              {row.payer && <>{' '}•{' '}<span className={styles.payer} title={row.payer}>{row.payer}</span></>}
            </div>
          </div>
        </div>
      </td>

      {show('programs') && (
        <td className={styles.td}>
          <span className={styles.badges}>
            {row.programs.slice(0, PROGRAMS_SHOWN).map(p => <Badge key={p} size="sm" label={p} />)}
            {extraPrograms.length > 0 && (
              <Tooltip label={extraPrograms.join(', ')}>
                <span><Badge size="sm" label={`+${extraPrograms.length}`} /></span>
              </Tooltip>
            )}
          </span>
        </td>
      )}

      {show('adherence') && (
        <td className={styles.td}>
          <div className={styles.adherence}>
            <span className={styles.adherenceTop}>
              <span className={styles.adherenceScore}>{row.adherence}</span>
              <Badge size="sm" tone={band.tone} label={band.label} />
              {delta !== 0 && (
                <Tooltip label={`${delta > 0 ? 'Up' : 'Down'} ${Math.abs(delta)} since last month (${row.adherencePrev})`}>
                  <span className={delta > 0 ? styles.deltaUp : styles.deltaDown}>
                    <Icon name={delta > 0 ? 'solar:arrow-up-linear' : 'solar:arrow-down-linear'} size={12} color="currentColor" />
                    {Math.abs(delta)}
                  </span>
                </Tooltip>
              )}
            </span>
            <span className={styles.bar} aria-hidden="true">
              <span className={styles[`bar_${band.tone}`]} style={{ width: `${row.adherence}%` }} />
            </span>
          </div>
        </td>
      )}

      {show('why') && (
        <td className={styles.td}>
          <Tooltip
            variant="card"
            maxWidth={320}
            placement="bottom"
            label={(
              <span className={styles.whyPop}>
                <span className={styles.whyPopHead}><Icon name="custom:ai" size={14} />Why Prioritized</span>
                <span>{row.whySummary}</span>
              </span>
            )}
          >
            <button type="button" className={styles.why} onClick={() => onOpenPrograms(row)}>
              {row.whyPoints.slice(0, 2).map(p => <span key={p} className={styles.whyPoint}>{p}</span>)}
            </button>
          </Tooltip>
        </td>
      )}

      {show('lastReview') && (
        <td className={styles.td}>
          <span className={styles.stack}>
            <span className={styles.value}>{row.lastReview || '-'}</span>
            {review.overdueDays > 0
              ? <span className={styles.overdue}>{review.label}</span>
              : <span className={styles.muted}>Current</span>}
          </span>
        </td>
      )}

      {show('minutes') && (
        <td className={styles.td}>
          {minutes ? (
            <span className={styles.stack}>
              <span className={styles.value}>{minutes.program} {minutes.text}</span>
              <span className={styles.bar} aria-hidden="true">
                <span className={minutes.met ? styles.bar_success : styles.bar_primary} style={{ width: `${minutes.pct}%` }} />
              </span>
            </span>
          ) : <span className={styles.muted}>No minute target</span>}
        </td>
      )}

      {show('lastTouch') && (
        <td className={styles.td}>
          <span className={styles.stack}>
            <span className={styles.value}>{lastTouchText(row)}</span>
            <span className={styles.muted}>{row.lastTouchBy ? `by ${row.lastTouchBy}` : ''}</span>
          </span>
        </td>
      )}

      {show('assignee') && (
        <td className={styles.td}>
          <span className={styles.assignee}>
            <Avatar variant="assignee" size="XS" initials={initialsOf(row.assignee)} userName={row.assignee} />
            <span className={styles.value}>{row.assignee || 'Unassigned'}</span>
          </span>
        </td>
      )}

      <td className={`${styles.td} ${styles.stickyRight}`}>
        <div className={styles.actionsCell}>
          <ActionButton icon="solar:document-text-linear" tooltip="Open care programs" onClick={() => onOpenPrograms(row)} />
          <span className={styles.actionDivider} />
          <ActionButton
            ref={callBtnRef}
            icon="solar:phone-linear"
            tooltip="Call patient"
            onClick={() => openCallPopover(worklistMemberCallId({ ...row, patientId: row.memberId }), callBtnRef)}
          />
        </div>
      </td>
    </tr>
  );
}
