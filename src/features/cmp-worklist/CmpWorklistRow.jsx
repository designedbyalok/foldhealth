import { useRef, useState } from 'react';
import { PatientAvatarHover } from '../../components/PatientHoverCard/PatientAvatarHover';
import { Checkbox } from '../../components/Checkbox/Checkbox';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Icon } from '../../components/Icon/Icon';
import { Tooltip } from '../../components/Tooltip/Tooltip';
import { FoldIdTag } from '../../components/FoldIdTag/FoldIdTag';
import { formatDobDisplay, deriveDob } from '../../lib/patientDob';
import { memberLanguageLabel } from '../../lib/memberFilters';
import { worklistMemberCallId } from '../../lib/patientCall';
import { useAppStore } from '../../store/useAppStore';
import { CMP_MIDDLE_COLUMNS } from './cmpColumns';
import styles from './CmpWorklistRow.module.css';

// Sub-programs shown before "View More N".
const MAX_INLINE = 2;

/**
 * One member, with every CMP sub-program they're enrolled in
 * (`member.enrollments`). Per-enrollment columns stack a line per
 * sub-program; the rest show once. `onView(enrollment)` opens one.
 */
export function CmpWorklistRow({ member, columns, hiddenSet, selected, onToggle, onView, showToast, users, onSetCareTeam }) {
  const updateCmpMemberStatus = useAppStore(s => s.updateCmpMemberStatus);
  const openQuickView = useAppStore(s => s.openQuickView);
  const openCallPopover = useAppStore(s => s.openCallPopover);
  const callBtnRef = useRef(null);
  const [statusAnchor, setStatusAnchor] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const language = member.language || 'en';
  const enrollments = member.enrollments || [member];
  const shown = expanded ? enrollments : enrollments.slice(0, MAX_INLINE);
  const extraCount = Math.max(0, enrollments.length - MAX_INLINE);
  const multi = enrollments.length > 1;

  const middleCols = (columns || CMP_MIDDLE_COLUMNS).filter(c => !c.sticky && !c.showCheckbox && (c.renderCell || c.renderItem));
  const visibleMiddle = hiddenSet ? middleCols.filter(c => !hiddenSet.has(c.key)) : middleCols;
  // "View More N" sits in the first stacked column; the others get a spacer.
  const toggleKey = visibleMiddle.find(c => c.perEnrollment)?.key;
  const cellCtx = { statusAnchor, setStatusAnchor, updateCmpMemberStatus, showToast, onOpenEnrollment: onView, users, setCareTeam: onSetCareTeam };
  const dobLabel = formatDobDisplay(member.dob) || deriveDob(member.age, member.name);

  return (
    <tr className={[styles.row, selected ? styles.rowSelected : '', multi ? styles.rowMulti : ''].filter(Boolean).join(' ')}>
      <td className={`${styles.checkTd} ${styles.stickyLeft}`} style={{ left: 0 }}>
        <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={`Select ${member.name}`} />
      </td>

      <td className={`${styles.membersTd} ${styles.stickyLeft}`} style={{ left: 36 }}>
        <div className={styles.patientCell}>
          <PatientAvatarHover patient={{ memberId: member.memberId, id: member.id, name: member.name, initials: member.in, gender: member.g, age: member.age, dob: member.dob }} />
          <div>
            <div className={styles.patientName}>
              <button
                type="button"
                className={styles.patientNameLink}
                onClick={(e) => {
                  e.stopPropagation();
                  openQuickView({ id: member.id, name: member.name, initials: member.in, gender: member.g, age: member.age, memberId: member.memberId, language });
                }}
              >
                {member.name}
              </button>{' '}
              <Tooltip label={dobLabel ? `DOB: ${dobLabel}` : ''} placement="bottom">
                <span className={styles.patientDemo}>({member.g}•{member.age})</span>
              </Tooltip>
            </div>
            <div className={styles.patientMeta}>
              <span onClick={e => e.stopPropagation()} style={{ display: 'inline-flex' }}>
                <FoldIdTag id={member.memberId} className={styles.foldId} showToast={showToast} />
              </span>{' '}•{' '}
              <Tooltip label={`Preferred Language: ${memberLanguageLabel(language)}`} variant="light">
                <button type="button" className={styles.langBadge} onClick={e => e.stopPropagation()}>
                  {language.toUpperCase()}
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      </td>

      {visibleMiddle.map(col => (col.perEnrollment ? (
        <td
          key={col.key}
          data-col-key={col.key}
          className={[styles.td, styles.tdStack, shown.length === 1 ? styles.tdStackCenter : ''].filter(Boolean).join(' ')}
        >
          <div className={styles.stackItems}>
            {shown.map(e => <div key={e.id} className={styles.stackItem}>{col.renderItem(e, cellCtx)}</div>)}
            {extraCount > 0 && (
              <div className={styles.stackFooter}>
                {col.key === toggleKey && (
                  <button type="button" className={styles.viewMoreBtn} onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}>
                    {expanded ? 'View Less' : `View More ${extraCount}`}
                    <Icon name={expanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'} size={12} color="var(--neutral-300)" />
                  </button>
                )}
              </div>
            )}
          </div>
        </td>
      ) : (
        <td
          key={col.key}
          data-col-key={col.key}
          className={styles.td}
          style={col.align === 'center' ? { textAlign: 'center' } : undefined}
        >
          {col.renderCell(member, cellCtx)}
        </td>
      )))}

      {/* Actions stack with the sub-programs: View Program on every line opens
          that one; Call and More are for the member, on the first line. */}
      <td className={[styles.td, styles.tdStack, shown.length === 1 ? styles.tdStackCenter : '', styles.stickyRight].filter(Boolean).join(' ')}>
        <div className={styles.stackItems}>
          {shown.map((e, i) => (
            <div key={e.id} className={styles.stackItem}>
              <div className={styles.actionsCell}>
                <ActionButton
                  icon="solar:document-text-linear"
                  tooltip={multi ? `View ${e.subProgram || 'Program'}` : 'View Program'}
                  onClick={() => onView(e)}
                />
                {i === 0 && (
                  <>
                    <span className={styles.actionDivider} />
                    <ActionButton
                      ref={callBtnRef}
                      icon="solar:phone-linear"
                      tooltip="Call patient"
                      onClick={(ev) => { ev.stopPropagation(); openCallPopover(worklistMemberCallId(member), callBtnRef); }}
                    />
                    <span className={styles.actionDivider} />
                    <ActionButton
                      icon="solar:menu-dots-linear"
                      tooltip="More"
                      onClick={() => showToast(`More actions for ${member.name} are coming soon`)}
                    />
                  </>
                )}
              </div>
            </div>
          ))}
          {extraCount > 0 && <div className={styles.stackFooter} />}
        </div>
      </td>
    </tr>
  );
}
