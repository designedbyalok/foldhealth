import { useState, useRef } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Avatar } from '../../components/Avatar/Avatar';
import { PatientAvatarHover } from '../../components/PatientHoverCard/PatientAvatarHover';
import { Badge } from '../../components/Badge/Badge';
import { Checkbox } from '../../components/ShadcnCheckbox/ShadcnCheckbox';
import { MenuPopover } from '../../components/MenuPopover/MenuPopover';
import { buildPatientRowMenuItems } from '../../components/MenuPopover/patientRowMenuItems';
import { useAppStore } from '../../store/useAppStore';
import { usePatientCallButton } from '../../hooks/usePatientCallButton';
import { FoldIdTag } from '../../components/FoldIdTag/FoldIdTag';
import { Tooltip } from '../../components/Tooltip/Tooltip';
import { formatDobDisplay, deriveDob } from '../../lib/patientDob';
import { PatientAppActiveIndicator } from '../../components/PatientAppActiveIndicator/PatientAppActiveIndicator';
import rowStyles from '../toc/worklist/WorklistRow.module.css';
import styles from './AllPatientsRow.module.css';

const LANG_MAP = { en: 'English', es: 'Spanish', zh: 'Chinese', yue: 'Cantonese', ko: 'Korean', vi: 'Vietnamese', hi: 'Hindi', pa: 'Punjabi' };

// all_patients stores age as whole years; the other worklists render the
// "Ny Mm" shape. Derive a stable month component from the patient name (same
// stable-hash trick deriveDob uses for the day) so display and the derived
// DOB tooltip stay consistent across reloads.
const nameHash = (s) => {
  let h = 0;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
};
const ageDisplayOf = (row) => {
  if (row.age == null || row.age === '') return null;
  // Already "Ny Mm" (e.g. rows mirrored from TOC/HCC), pass through.
  if (/y/.test(String(row.age))) return String(row.age);
  return `${row.age}y ${nameHash(row.name) % 12}m`;
};

function TagList({ tags, max = 2 }) {
  if (!tags?.length) return <span className={styles.dash}>-</span>;
  const shown = tags.slice(0, max);
  const overflow = tags.length - max;
  return (
    <div className={styles.tagList}>
      {shown.map((t, i) => (
        <Badge key={i} tone="primary" label={t} />
      ))}
      {overflow > 0 && <Badge label={`+${overflow}`} />}
    </div>
  );
}

function ConditionList({ conditions, max = 2 }) {
  if (!conditions?.length) return <span className={styles.dash}>-</span>;
  const shown = conditions.slice(0, max);
  const overflow = conditions.length - max;
  return (
    <div className={styles.tagList}>
      {shown.map((c, i) => (
        <Badge key={i} tone="danger" label={c} />
      ))}
      {overflow > 0 && <Badge label={`+${overflow}`} />}
    </div>
  );
}

function AttributesCell({ row }) {
  const pairs = [
    row.groupNumber && ['Grp', row.groupNumber],
    row.planCode && ['Plan', row.planCode],
    row.coverageType && ['Cov', row.coverageType],
    row.tpa && ['TPA', row.tpa],
  ].filter(Boolean);

  if (!pairs.length) return <span className={styles.dash}>-</span>;

  return (
    <div className={styles.attrCell}>
      {pairs.slice(0, 2).map(([k, v]) => (
        <span key={k} className={styles.attrRow}>
          <span className={styles.attrKey}>{k}:</span>
          <span className={styles.attrVal}>{v}</span>
        </span>
      ))}
      {pairs.length > 2 && (
        <span className={styles.attrMore}>+{pairs.length - 2} more</span>
      )}
    </div>
  );
}

export const PATIENT_APP_COLUMN = {
  key: 'patientApp',
  label: 'Patient App',
  renderCell: (row) => (
    row.patientAppActive
      ? <PatientAppActiveIndicator size={16} />
      : <span className={styles.dash}>-</span>
  ),
};

const ALL_PATIENTS_BASE_COLUMNS = [
  {
    key: 'contact',
    label: 'Contact Info',
    renderCell: (row) => (
      <div className={styles.contactCell}>
        <span className={styles.contactLine}>
          <Icon name="solar:letter-linear" size={13} color="var(--neutral-300)" />
          {row.email || <span className={styles.dash}>-</span>}
        </span>
        <span className={styles.contactLine}>
          <Icon name="solar:phone-linear" size={13} color="var(--neutral-300)" />
          {row.phone || <span className={styles.dash}>-</span>}
        </span>
      </div>
    ),
  },
  {
    key: 'location',
    label: 'Location',
    renderCell: (row) => {
      const location = row.city && row.state ? `${row.city}, ${row.state}` : (row.location || '-');
      return <span className={rowStyles.dateText}>{location}</span>;
    },
  },
  {
    key: 'tags',
    label: 'Tags',
    renderCell: (row) => <TagList tags={row.tags} />,
  },
  {
    key: 'attributes',
    label: 'Attributes',
    renderCell: (row) => <AttributesCell row={row} />,
  },
  {
    key: 'chronicConditions',
    label: 'Chronic Conditions',
    renderCell: (row) => <ConditionList conditions={row.chronicConditions} />,
  },
  {
    key: 'pcp',
    label: 'PCP',
    renderCell: (row) => (
      row.pcp ? (
        <div className={rowStyles.assigneeCell}>
          <Avatar variant="staff" initials={row.pcpInitials || row.pcp.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()} />
          <span style={{ fontSize: 'var(--font-md)' }}>{row.pcp}</span>
        </div>
      ) : (
        <span className={styles.dash}>-</span>
      )
    ),
  },
  {
    key: 'lastVisit',
    label: 'Last Visit',
    renderCell: (row) => <span className={rowStyles.dateText}>{row.lastVisit || '-'}</span>,
  },
  {
    key: 'activeCareProgram',
    label: 'Active Care Program',
    renderCell: (row) => (
      row.activeCareProgram
        ? <Badge tone="info" label={row.activeCareProgram} />
        : <span className={styles.dash}>-</span>
    ),
  },
  {
    key: 'ccmConsent',
    label: 'CCM Consent',
    renderCell: (row) => {
      const ccm = row.ccmConsent;
      return (
        <Badge
          tone={ccm === true ? 'success' : ccm === false ? 'danger' : 'neutral'}
          label={ccm === true ? 'Yes' : ccm === false ? 'No' : 'N/A'}
        />
      );
    },
  },
  {
    key: 'apcmConsent',
    label: 'APCM Consent',
    renderCell: (row) => {
      const apcm = row.apcmConsent;
      return (
        <Badge
          tone={apcm === true ? 'success' : apcm === false ? 'danger' : 'neutral'}
          label={apcm === true ? 'Yes' : apcm === false ? 'No' : 'N/A'}
        />
      );
    },
  },
];

/** Middle-column defs for All Patients (without the optional Patient App column). */
export const ALL_PATIENTS_MIDDLE_COLUMNS = ALL_PATIENTS_BASE_COLUMNS;

/** Inserts the Patient App column after Contact Info when the org flag is on. */
export function buildAllPatientsMiddleColumns(showPatientAppIndicator) {
  if (!showPatientAppIndicator) return ALL_PATIENTS_BASE_COLUMNS;
  return [
    ALL_PATIENTS_BASE_COLUMNS[0],
    PATIENT_APP_COLUMN,
    ...ALL_PATIENTS_BASE_COLUMNS.slice(1),
  ];
}

export function AllPatientsRow({ row, columns, hiddenSet, isSelected, onSelect }) {
  const showToast = useAppStore(s => s.showToast);
  const startHccUpload = useAppStore(s => s.startHccUpload);
  const openPatientEdit = useAppStore(s => s.openPatientEdit);
  const openQuickView = useAppStore(s => s.openQuickView);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropBtnRef = useRef(null);
  const { callBtnRef, openCall } = usePatientCallButton(row);

  const middleCols = (columns || ALL_PATIENTS_MIDDLE_COLUMNS)
    .filter(c => !c.sticky && !c.showCheckbox && c.renderCell);
  const visibleMiddle = hiddenSet ? middleCols.filter(c => !hiddenSet.has(c.key)) : middleCols;
  const cellCtx = { showToast };

  const handleDropdownToggle = (e) => {
    e.stopPropagation();
    setShowDropdown(v => !v);
  };

  const menuItems = buildPatientRowMenuItems([
    { key: 'Open Workflow', icon: 'solar:clipboard-list-linear', label: 'Open Workflow' },
  ]);

  const runPatientRowAction = useAppStore(s => s.runPatientRowAction);
  const handleMenuSelect = (key) => {
    if (runPatientRowAction(key, row)) return;
    if (key === 'Upload File') {
      // Pre-seed the upload session with this patient so ambiguous OCR
      // matches auto-link to them in the review panel (AC-1 + AC-9 helper).
      startHccUpload(row?.id || null);
      return;
    }
    if (key === 'Edit Details') {
      openPatientEdit('basic', {
        id: row.id,
        name: row.name,
        initials: row.initials,
        gender: row.gender,
        age: row.age,
        dob: row.dob,
        email: row.email,
        phone: row.phone,
        city: row.city,
        state: row.state,
        memberId: row.memberId,
        language: row.language,
      });
      return;
    }
    showToast(`${key} – coming soon`);
  };

  const ageDisplay = ageDisplayOf(row);

  // Same QuickView payload shape as WorklistRow (TOC) / HCC: age in the
  // displayed "Ny Mm" form so the drawer banner matches the row.
  const quickViewPayload = {
    id: row.id,
    name: row.name,
    initials: row.initials,
    gender: row.gender,
    age: ageDisplay || row.age,
    memberId: row.memberId,
    language: row.language,
    dob: row.dob,
    lace: row.lace,
  };

  const handleRowClick = () => {
    openQuickView(quickViewPayload);
  };
  const handleMemberCellClick = (e) => {
    e.stopPropagation();
    openQuickView(quickViewPayload);
  };

  return (
    <tr className={rowStyles.row} onClick={handleRowClick}>
      <td className={`${rowStyles.checkTd} ${rowStyles.stickyLeft}`} style={{ left: 0 }} onClick={e => e.stopPropagation()}>
        <Checkbox checked={isSelected} onCheckedChange={() => onSelect(row.id)} />
      </td>
      <td
        className={`${rowStyles.membersTd} ${rowStyles.stickyLeft}`}
        style={{ left: 36, cursor: 'pointer' }}
        title="Open patient quick view"
      >
        <div className={rowStyles.patientCell}>
          <PatientAvatarHover patient={{ memberId: row.memberId, id: row.id, name: row.name, initials: row.initials, gender: row.gender, age: ageDisplay || row.age, dob: row.dob }} />
          <div>
            <div className={rowStyles.patientName}>
              <button className={rowStyles.patientNameLink} onClick={handleMemberCellClick}>{row.name}</button>
              {row.gender && ageDisplay && (() => {
                // DOB tooltip mirrors WorklistRow: stored dob wins, else a
                // deterministic derivation from the displayed age + name so
                // the tooltip always agrees with the "(g•Ny Mm)" string.
                const dobLabel = formatDobDisplay(row.dob) || deriveDob(ageDisplay, row.name);
                return (
                  <Tooltip label={dobLabel ? `DOB: ${dobLabel}` : ''} placement="bottom">
                    <span className={rowStyles.patientDemo}> ({row.gender}•{ageDisplay})</span>
                  </Tooltip>
                );
              })()}
            </div>
            <div className={rowStyles.patientMeta}>
              <span onClick={e => e.stopPropagation()} style={{ display: 'inline-flex' }}>
                <FoldIdTag id={row.memberId || row.id} className={rowStyles.foldId} showToast={showToast} />
              </span>{' '}•{' '}
              <Tooltip label={`Preferred Language: ${LANG_MAP[row.language] || 'English'}`} variant="light">
                <button type="button" className={rowStyles.langBadge} onClick={e => e.stopPropagation()}>
                  {(row.language || 'en').toUpperCase()}
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      </td>
      {visibleMiddle.map(col => (
        <td key={col.key} data-col-key={col.key} className={rowStyles.td}>
          {col.renderCell(row, cellCtx)}
        </td>
      ))}
      <td className={`${rowStyles.td} ${rowStyles.stickyRight}`} onClick={e => e.stopPropagation()}>
        <div className={rowStyles.actionsCell}>
          <ActionButton
            icon="solar:letter-linear"
            tooltip="Email"
            onClick={() => showToast(`Email ${row.name}, coming soon`)}
          />
          <span className={rowStyles.actionDivider} />
          <ActionButton
            ref={callBtnRef}
            icon="solar:phone-linear"
            tooltip="Call patient"
            onClick={openCall}
          />
          <span className={rowStyles.actionDivider} />
          <ActionButton
            icon="solar:chat-dots-linear"
            tooltip="Chat"
            onClick={() => showToast(`Chat with ${row.name}, coming soon`)}
          />
          <span className={rowStyles.actionDivider} />
          <div style={{ position: 'relative' }}>
            <ActionButton
              ref={dropBtnRef}
              icon="solar:menu-dots-linear"
              tooltip="More options"
              onClick={handleDropdownToggle}
            />
            {showDropdown && (
              <MenuPopover
                anchorRef={dropBtnRef}
                items={menuItems}
                onSelect={handleMenuSelect}
                onClose={() => setShowDropdown(false)}
                width={220}
                ariaLabel="Row actions"
              />
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
