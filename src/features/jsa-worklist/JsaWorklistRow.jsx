import { useRef, useState } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { PatientAvatarHover } from '../../components/PatientHoverCard/PatientAvatarHover';
import { AssigneeChange } from '../../components/AssigneeChange/AssigneeChange';
import { Badge } from '../../components/Badge/Badge';
import { DownChevronIcon } from '../../components/Icon/DownChevronIcon';
import { Checkbox } from '../../components/Checkbox/Checkbox';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { MenuPopover } from '../../components/MenuPopover/MenuPopover';
import { Tooltip } from '../../components/Tooltip/Tooltip';
import { formatDobDisplay, deriveDob } from '../../lib/patientDob';
import { useAppStore } from '../../store/useAppStore';
import { worklistMemberCallId } from '../../lib/patientCall';
import { FoldIdTag } from '../../components/FoldIdTag/FoldIdTag';
import styles from './JsaWorklistRow.module.css';
import { OutreachStatus } from '../../components/OutreachStatus/OutreachStatus';
import { outreachFromCount } from '../../components/OutreachStatus/outreachStatusModel';

const STATUS_VARIANT = {
  Open: 'info',
  New: 'info',
  'Unable to Reach': 'neutral',
  Engaged: 'success',
  Attempted: 'warning',
  'Engaged - Requires Follow Up': 'warning',
};

const RISK_VARIANT = {
  Low: 'success',
  Medium: 'warning',
  High: 'danger',
};

const LANG_MAP = {
  en: 'English', es: 'Spanish', zh: 'Chinese', yue: 'Cantonese',
  ko: 'Korean', vi: 'Vietnamese', hi: 'Hindi', pa: 'Punjabi',
};

/**
 * Middle-column defs for JSA. Mirrors AWV_MIDDLE_COLUMNS in shape so both
 * worklists share the same column-driven cell pattern; row bodies iterate
 * these and skip hidden ones per the Show Columns popover.
 *
 * ctx shape: { statusAnchor, setStatusAnchor, updateJsaMemberStatus, showToast }
 */
export const JSA_MIDDLE_COLUMNS = [
  {
    key: 'progSubStatus',
    label: 'Program Sub Status',
    sortKey: 'progSubStatus',
    width: 160,
    renderCell: (member, ctx) => (
      <>
        <button
          type="button"
          className={styles.statusBtn}
          onClick={(e) => {
            e.stopPropagation();
            ctx.setStatusAnchor(e.currentTarget);
          }}
        >
          <Badge
            size="md"
            tone={STATUS_VARIANT[member.progSubStatus] || 'info'}
            label={member.progSubStatus}
            trailingIconElement={<DownChevronIcon size={12} color="currentColor" />}
          />
        </button>
        {ctx.statusAnchor && (
          <MenuPopover
            anchorRef={{ current: ctx.statusAnchor }}
            width={240}
            items={[
              { label: 'Engaged', key: 'Engaged' },
              { label: 'Attempted', key: 'Attempted' },
              { label: 'Engaged - Requires Follow Up', key: 'Engaged - Requires Follow Up' },
            ]}
            onSelect={(key) => ctx.updateJsaMemberStatus(member.id, key)}
            onClose={() => ctx.setStatusAnchor(null)}
          />
        )}
      </>
    ),
  },
  {
    key: 'progName',
    label: 'Program Name',
    sortKey: 'progName',
    width: 170,
    renderCell: (member) => member.progName,
  },
  {
    key: 'due',
    label: 'Due Date',
    sortKey: 'due',
    width: 140,
    renderCell: (member) => (
      <div className={styles.dueCell}>
        <div className={styles.dueDate}>{member.due}</div>
        <div className={styles.dueLabel} style={{ color: member.dueCol }}>
          <Icon name="solar:clock-circle-linear" size={11} color={member.dueCol} />
          {member.dueLabel}
        </div>
      </div>
    ),
  },
  {
    key: 'outreach',
    label: 'Outreach',
    sortKey: 'outreach',
    width: 150,
    renderCell: (member) => <JsaOutreachCell member={member} />,
  },
  {
    key: 'assignee',
    label: 'Assignee',
    sortKey: 'assignee',
    width: 170,
    renderCell: (member, ctx) => (
      member.assignee ? (
        <AssigneeChange
          name={member.assignee}
          initials={member.assigneeIn}
          oooUser={{ name: member.assignee }}
          showRole={false}
          onClick={() => ctx.showToast(`Change assignee for ${member.name}, coming soon`)}
        />
      ) : (
        <AssigneeChange
          unassigned
          showRole={false}
          onClick={() => ctx.showToast(`Assign owner for ${member.name}, coming soon`)}
        />
      )
    ),
  },
  {
    key: 'np',
    label: 'NP Appointment Date',
    sortKey: 'npAppt',
    width: 170,
    renderCell: (member) => member.npAppt || '-',
  },
  {
    key: 'lastAwv',
    label: 'Last Annual Visit Date',
    sortKey: 'lastAwv',
    width: 180,
    renderCell: (member) => member.lastAwv || '-',
  },
  {
    key: 'ad',
    label: 'AdvIllness',
    sortKey: 'ad',
    width: 100,
    align: 'center',
    renderCell: (member) => member.ad,
  },
  {
    key: 'fr',
    label: 'Frailty',
    sortKey: 'fr',
    width: 90,
    align: 'center',
    renderCell: (member) => member.fr,
  },
  {
    key: 'ri',
    label: 'Risk IQ',
    sortKey: 'ri',
    width: 110,
    renderCell: (member) => (
      <Badge size="md" tone={RISK_VARIANT[member.ri] || 'success'} label={member.ri} />
    ),
  },
  {
    key: 'dec',
    label: 'Decile',
    sortKey: 'dec',
    width: 80,
    align: 'center',
    renderCell: (member) => member.dec,
  },
  {
    key: 'task',
    label: 'Tasks',
    sortKey: 'task',
    width: 90,
    align: 'center',
    renderCell: (member) => (
      member.task > 0
        ? <span className={styles.taskBadge}>{member.task}</span>
        : <span className={styles.taskBadgeMuted}>0</span>
    ),
  },
];

export function JsaWorklistRow({ member, columns, hiddenSet, selected, onToggle, onView, showToast }) {
  const updateJsaMemberStatus = useAppStore(s => s.updateJsaMemberStatus);
  const openQuickView = useAppStore(s => s.openQuickView);
  const openCallPopover = useAppStore(s => s.openCallPopover);
  const callBtnRef = useRef(null);
  const [statusAnchor, setStatusAnchor] = useState(null);
  const quickViewPayload = { id: member.id, name: member.name, initials: member.in, gender: member.g, age: member.age, memberId: member.memberId, language: member.language };
  const handleMemberCellClick = (e) => {
    e.stopPropagation();
    openQuickView(quickViewPayload);
  };

  const language = member.language || 'en';

  const middleCols = (columns || JSA_MIDDLE_COLUMNS)
    .filter(c => !c.sticky && !c.showCheckbox && c.renderCell);
  const visibleMiddle = hiddenSet ? middleCols.filter(c => !hiddenSet.has(c.key)) : middleCols;

  const cellCtx = {
    statusAnchor,
    setStatusAnchor,
    updateJsaMemberStatus,
    showToast,
  };

  return (
    <tr className={[styles.row, selected ? styles.rowSelected : ''].filter(Boolean).join(' ')}>
      {/* Sticky-left checkbox */}
      <td className={`${styles.checkTd} ${styles.stickyLeft}`} style={{ left: 0 }}>
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          aria-label={`Select ${member.name}`}
        />
      </td>

      {/* Sticky-left Members cell: entire cell clickable for patient quick view */}
      <td
        className={`${styles.membersTd} ${styles.stickyLeft}`}
        style={{ left: 36, cursor: 'pointer' }}
        title="Open patient quick view"
      >
        <div className={styles.patientCell}>
          <PatientAvatarHover patient={{ memberId: member.memberId, id: member.id, name: member.name, initials: member.in, gender: member.g, age: member.age, dob: member.dob }} />
          <div>
            <div className={styles.patientName}>
              <button type="button" className={styles.patientNameLink} onClick={handleMemberCellClick}>{member.name}</button>{' '}
              {(() => {
                const dobLabel = formatDobDisplay(member.dob) || deriveDob(member.age, member.name);
                return (
                  <Tooltip label={dobLabel ? `DOB: ${dobLabel}` : ''} placement="bottom">
                    <span className={styles.patientDemo}>({member.g}•{member.age})</span>
                  </Tooltip>
                );
              })()}
            </div>
            <div className={styles.patientMeta}>
              <span onClick={e => e.stopPropagation()} style={{ display: 'inline-flex' }}>
                <FoldIdTag id={member.memberId} className={styles.foldId} showToast={showToast} />
              </span>{' '}•{' '}
              <Tooltip label={`Preferred Language: ${LANG_MAP[language] || 'English'}`} variant="light">
                <button type="button" className={styles.langBadge} onClick={e => e.stopPropagation()}>
                  {language.toUpperCase()}
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      </td>

      {visibleMiddle.map(col => (
        <td
          key={col.key}
          data-col-key={col.key}
          className={styles.td}
          style={col.align === 'center' ? { textAlign: 'center' } : undefined}
        >
          {col.renderCell(member, cellCtx)}
        </td>
      ))}

      {/* Actions: sticky-right, L-size buttons with dividers, matches TOC */}
      <td className={`${styles.td} ${styles.stickyRight}`}>
        <div className={styles.actionsCell}>
          <ActionButton
            icon="solar:document-text-linear"
            tooltip="View Program"
            onClick={onView}
          />
          <span className={styles.actionDivider} />
          <ActionButton
            ref={callBtnRef}
            icon="solar:phone-linear"
            tooltip="Call patient"
            onClick={(e) => {
              e.stopPropagation();
              openCallPopover(worklistMemberCallId(member), callBtnRef);
            }}
          />
          <span className={styles.actionDivider} />
          <ActionButton
            icon="solar:menu-dots-linear"
            tooltip="More"
            onClick={() => showToast(`More actions for ${member.name}, coming soon`)}
          />
        </div>
      </td>
    </tr>
  );
}

// Outreach: the shared worklist outreach status (icon, result, date, attempt dots).
function JsaOutreachCell({ member }) {
  return <OutreachStatus {...outreachFromCount(member.outreach, member.progSubStatus, member.lastOutreach)} />;
}
