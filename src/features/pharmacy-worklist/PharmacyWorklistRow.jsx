import { useRef, useState } from 'react';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { PatientAvatarHover } from '../../components/PatientHoverCard/PatientAvatarHover';
import { Checkbox } from '../../components/ShadcnCheckbox/ShadcnCheckbox';
import { MenuPopover } from '../../components/MenuPopover/MenuPopover';
import { buildPatientRowMenuItems } from '../../components/MenuPopover/patientRowMenuItems';
import { FoldIdTag } from '../../components/FoldIdTag/FoldIdTag';
import { Tooltip } from '../../components/Tooltip/Tooltip';
import { formatDobDisplay, deriveDob } from '../../lib/patientDob';
import { useAppStore } from '../../store/useAppStore';
import { worklistMemberCallId } from '../../lib/patientCall';
import { clinicalRolesPickerLabel } from '../../lib/worklistAssignee';
import { PharmacyActivityDrawer } from './program/PharmacyActivityLog';
import { MANUAL_GAP_STATUSES, isReversalReopen, pharmaciesUsed, prescribersOf } from './pharmacyWorklist.utils';
import styles from './PharmacyWorklistRow.module.css';

const MAX_INLINE_GAPS = 2;

const HCC_ONLY_ROLES = new Set(['Coder', 'Support', 'QA', 'Compliance']);
const LANG_MAP = { en: 'English', es: 'Spanish', zh: 'Chinese', yue: 'Cantonese', ko: 'Korean', vi: 'Vietnamese', hi: 'Hindi', pa: 'Punjabi' };

export function PharmacyWorklistRow({ member, columns, hiddenSet, isSelected, onSelect, onOpenCareGap }) {
  const openQuickView = useAppStore(s => s.openQuickView);
  const openCallPopover = useAppStore(s => s.openCallPopover);
  const openNumberCallPopover = useAppStore(s => s.openNumberCallPopover);
  const logPharmacyDial = useAppStore(s => s.logPharmacyDial);
  const requestAddTask = useAppStore(s => s.requestAddTask);
  const runPatientRowAction = useAppStore(s => s.runPatientRowAction);
  const setPharmacyGapStatus = useAppStore(s => s.setPharmacyGapStatus);
  const openPharmacyGapDrawer = useAppStore(s => s.openPharmacyGapDrawer);
  const setPharmacyAssignee = useAppStore(s => s.setPharmacyAssignee);
  const platformUsers = useAppStore(s => s.platformUsers);
  const showToast = useAppStore(s => s.showToast);
  const m = member;
  const dobLabel = formatDobDisplay(m.dob) || deriveDob(m.age, m.name);

  const [showDropdown, setShowDropdown] = useState(false);
  const [showCallMenu, setShowCallMenu] = useState(false);
  const [gapStatusMenu, setGapStatusMenu] = useState(null); // { code, rect }
  const [expanded, setExpanded] = useState(false);

  // HEDIS pattern: show 2 gaps, the rest behind "View More N", in the same
  // MAC, MAD, MAH order as everywhere else (m.gaps is already in it). A gap a
  // claim reversal reopened always shows: the alarm never hides.
  const collapsedGaps = m.gaps.filter((g, i) => i < MAX_INLINE_GAPS || isReversalReopen(g.status));
  const visibleGaps = expanded ? m.gaps : collapsedGaps;
  const extraCount = m.gaps.length - collapsedGaps.length;
  const [showActivity, setShowActivity] = useState(false);
  const dropBtnRef = useRef(null);
  const callBtnRef = useRef(null);

  const middleCols = columns.filter(c => !c.sticky && !c.showCheckbox && c.renderCell);
  const visibleMiddle = middleCols.filter(c => !hiddenSet.has(c.key));

  const eligibleUsers = [];
  for (const u of platformUsers) {
    if (u.clinicalRoles?.some(r => HCC_ONLY_ROLES.has(r))) continue;
    eligibleUsers.push({ id: u.id, name: u.name, initials: u.initials, role: clinicalRolesPickerLabel(u) });
  }

  const cellCtx = {
    setPharmacyAssignee,
    openGap: (code) => openPharmacyGapDrawer(m.id, code, { focus: true }),
    openClaimRework: (code, medId) => openPharmacyGapDrawer(m.id, code, { medId, view: 'claims', focus: true }),
    openOutreach: () => openPharmacyGapDrawer(m.id, null, { view: 'outreach' }),
    openCareGap: onOpenCareGap,
    eligibleUsers,
    openGapStatusMenu: (code, rect) => setGapStatusMenu(cur => (cur?.code === code ? null : { code, rect })),
    visibleGaps,
    extraCount,
    expanded,
    toggleExpanded: () => setExpanded(v => !v),
  };
  const menuGap = gapStatusMenu && m.gaps.find(g => g.code === gapStatusMenu.code);
  const gapStatusItems = menuGap ? MANUAL_GAP_STATUSES.map(s => ({ key: s, label: s, selected: s === menuGap.status.gap })) : [];

  const handleNameClick = (e) => {
    e.stopPropagation();
    openQuickView?.({ id: m.patientId || m.id, name: m.name, initials: m.initials, gender: m.gender, age: m.age, memberId: m.memberId, language: m.language });
  };
  // Pharmacy calls can go to the patient, a pharmacy the fills came from,
  // or a prescriber of the member's drugs; pick who first, then the line.
  const handleCallClick = (e) => {
    e.stopPropagation();
    setShowCallMenu(v => !v);
  };
  const contacts = showCallMenu
    ? { pharmacies: pharmaciesUsed(m), prescribers: prescribersOf(m) }
    : { pharmacies: [], prescribers: [] };
  const callLabel = (name, line) => (
    <span className={styles.callOption}>
      <span className={styles.callName}>{name}</span>
      <span className={styles.callMeta}>{line}</span>
    </span>
  );
  const contactItem = (prefix, c, meta) => {
    const line = [c.phone || 'No phone on file', meta].filter(Boolean).join(' • ');
    return {
      key: `${prefix}:${c.name}`,
      icon: 'solar:phone-linear',
      label: callLabel(c.name, line),
      hint: line,
      disabled: !c.phone,
      tall: true,
      contact: c,
    };
  };
  const callItems = [
    { section: 'Patient' },
    { key: 'patient', icon: 'solar:user-linear', label: callLabel(m.name, m.phone || 'Choose a number'), tall: true },
    { section: 'Pharmacist' },
    ...(contacts.pharmacies.length
      ? contacts.pharmacies.map(p => contactItem('pharmacy', p, p.lastFill ? `Last fill ${p.lastFill}` : ''))
      : [{ key: 'pharmacy:none', label: 'No pharmacy on file', disabled: true }]),
    { section: 'Prescriber' },
    ...(contacts.prescribers.length
      ? contacts.prescribers.map(p => contactItem('prescriber', p, p.drugs.join(', ')))
      : [{ key: 'prescriber:none', label: 'No prescriber on file', disabled: true }]),
  ];
  const handleCallSelect = (key, item) => {
    setShowCallMenu(false);
    if (key === 'patient') {
      openCallPopover(worklistMemberCallId(m), callBtnRef);
      return;
    }
    const c = item?.contact;
    if (!c?.phone) return;
    openNumberCallPopover({ number: c.phone, label: c.name, onDial: () => logPharmacyDial?.(m.id, c.name, c.phone) }, callBtnRef);
  };

  const menuItems = buildPatientRowMenuItems([
    { key: 'Activity Log', icon: 'solar:history-linear', label: 'Activity Log' },
  ]);
  const handleMenuSelect = (key) => {
    if (runPatientRowAction(key, m)) return;
    if (key === 'Activity Log') { setShowActivity(true); return; }
    if (key === 'Add Task') { requestAddTask?.({ member: m.name }); return; }
    showToast(`${key} – coming soon`);
  };

  const openRow = () => { if (m.gaps.length) openPharmacyGapDrawer(m.id, m.urgent?.code || m.gaps[0].code); };

  return (
    <tr
      className={`${styles.row} ${visibleGaps.length > 1 ? styles.rowMultiGap : ''} ${m.reopenedByReversal ? styles.rowReopened : ''}`}
      tabIndex={0}
      aria-label={`Open ${m.name}'s pharmacy gaps`}
      onClick={openRow}
      // Only keys on the row itself: a cell's own buttons keep their keys.
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openRow(); } }}
    >
      <td className={`${styles.checkTd} ${styles.stickyLeft}`} style={{ left: 0 }} onClick={e => e.stopPropagation()}>
        {/* Same height as the avatar + name block, so the checkbox lines up with
            the avatar even when a multi-gap row top-aligns (HEDIS / HCC). */}
        <div className={styles.checkAlign}>
          <Checkbox checked={isSelected} onCheckedChange={() => onSelect(m.id)} aria-label={`Select ${m.name}`} />
        </div>
      </td>

      <td className={`${styles.membersTd} ${styles.stickyLeft}`} style={{ left: 36 }}>
        <div className={styles.patientCell}>
          <PatientAvatarHover patient={{ memberId: m.memberId, id: m.id, name: m.name, initials: m.initials, gender: m.gender, age: m.age, dob: m.dob }} />
          <div>
            <div className={styles.patientName}>
              <button type="button" className={styles.patientNameLink} onClick={handleNameClick}>{m.name}</button>{' '}
              <Tooltip label={dobLabel ? `DOB: ${dobLabel}` : ''} placement="bottom">
                <span className={styles.patientDemo}>({m.gender}•{m.age})</span>
              </Tooltip>
            </div>
            <div className={styles.patientMeta}>
              <span onClick={e => e.stopPropagation()} className={styles.inlineFlex}>
                <FoldIdTag id={m.memberId} className={styles.foldId} showToast={showToast} />
              </span>{' '}•{' '}
              <Tooltip label={`Preferred Language: ${LANG_MAP[m.language] || 'English'}`} variant="light">
                <button type="button" className={styles.langBadge} onClick={e => e.stopPropagation()}>
                  {(m.language || 'en').toUpperCase()}
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
          className={col.getTdClassName ? col.getTdClassName(m, cellCtx) : styles.td}
          onClick={col.stopRowClickPropagation ? (e) => e.stopPropagation() : undefined}
          onKeyDown={col.stopRowClickPropagation ? (e) => e.stopPropagation() : undefined}
        >
          {col.renderCell(m, cellCtx)}
        </td>
      ))}

      <td className={`${styles.td} ${styles.stickyRight}`} onClick={e => e.stopPropagation()}>
        <div className={styles.actionsCell}>
          <ActionButton
            icon="solar:eye-linear"
            tooltip="View all gaps"
            onClick={(e) => { e.stopPropagation(); openPharmacyGapDrawer(m.id, null); }}
          />
          <ActionButton ref={callBtnRef} icon="solar:phone-linear" tooltip="Call" onClick={handleCallClick} />
          {showCallMenu && (
            <MenuPopover
              anchorRef={callBtnRef}
              items={callItems}
              onSelect={handleCallSelect}
              onClose={() => setShowCallMenu(false)}
              width={280}
              ariaLabel="Who to call"
            />
          )}
          <span className={styles.actionDivider} />
          <div className={styles.relative}>
            <ActionButton
              ref={dropBtnRef}
              icon="solar:menu-dots-linear"
              tooltip="More options"
              onClick={(e) => { e.stopPropagation(); setShowDropdown(v => !v); }}
            />
            {showDropdown && (
              <MenuPopover
                anchorRef={dropBtnRef}
                items={menuItems}
                onSelect={(key) => { handleMenuSelect(key); setShowDropdown(false); }}
                onClose={() => setShowDropdown(false)}
                width={220}
                ariaLabel="Row actions"
              />
            )}
          </div>
        </div>
        {showActivity && <PharmacyActivityDrawer member={m} onClose={() => setShowActivity(false)} />}
        {menuGap && (
          <MenuPopover
            anchorRect={gapStatusMenu.rect}
            items={gapStatusItems}
            onSelect={(key) => {
              setPharmacyGapStatus(m.id, menuGap.code, key);
              setGapStatusMenu(null);
            }}
            onClose={() => setGapStatusMenu(null)}
            width={220}
            ariaLabel={`Change ${menuGap.code} status`}
          />
        )}
      </td>
    </tr>
  );
}
