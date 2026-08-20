import { useRef, useState, useEffect, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../store/useAppStore';
import { FoldIdTag } from '../../components/FoldIdTag/FoldIdTag';
import { Avatar } from '../../components/Avatar/Avatar';
import { Checkbox } from '../../components/ShadcnCheckbox/ShadcnCheckbox';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Icon } from '../../components/Icon/Icon';
import { Tooltip } from '../../components/Tooltip/Tooltip';
import { Button } from '../../components/Button/Button';
import { formatDobDisplay, deriveDob } from '../../lib/patientDob';
import { ChartPopover, ActionsMenuPopover } from './RowPopovers';
import { ChartDetailDrawer } from './ChartDetailDrawer';
import { DocPreviewDrawer } from './DocPreviewDrawer';
import { getChartDocs } from './data/chartDocs';
import { DOS_LEVEL_COLS } from './HccWorklistRowParts.constants';
import { DOS_INNER, CELL_RENDERERS } from './HccWorklistRowCellRenderers';
import { synthesizeHccProfile } from './HccWorklistRowParts.utils';
import { resolveStaffName } from './HccWorklistRow.utils';
import { dosKey } from './assignment/dosState';
import styles from './HccWorklistRow.module.css';

export {
  isRejectedStatus,
  resolveStaffName,
  resolveCurrentAssignee,
} from './HccWorklistRow.utils';

function HccWorklistRowImpl({ member, hiddenCols, columns, staggerIndex = 0 }) {
  const selectedHccIds = useAppStore(s => s.selectedHccIds);
  const selectHccMember = useAppStore(s => s.selectHccMember);
  const openDiagPanel = useAppStore(s => s.openDiagPanel);
  const diagPanelMemberId = useAppStore(s => s.diagPanelMemberId);
  const openQuickView = useAppStore(s => s.openQuickView);
  const openPatientEdit = useAppStore(s => s.openPatientEdit);
  const showToast = useAppStore(s => s.showToast);
  const openHccUploadDrawer = useAppStore(s => s.openHccUploadDrawer);
  const openAddDos = useAppStore(s => s.openHccAddDos);
  const openClaimPreview = useAppStore(s => s.openHccClaimPreview);
  const setDiagOpenDocId = useAppStore(s => s.setDiagOpenDocId);
  const openHccClaimForDos = useAppStore(s => s.openHccClaimForDos);
  const justAddedHccMemberId = useAppStore(s => s.justAddedHccMemberId);
  const justAdded = justAddedHccMemberId === member.id;
  const hccDosAssignments = useAppStore(s => s.hccDosAssignments);
  const platformUsers = useAppStore(s => s.platformUsers);
  const dosStateFor = (m) => (m?.id && m?.dos ? hccDosAssignments[dosKey(m.id, m.dos, m.rp, m.pos)] : null);
  const nameOf = (id) => resolveStaffName(id, platformUsers)?.name || null;

  const checked = selectedHccIds.includes(member.id);
  const isOpenInDrawer = diagPanelMemberId === member.id;
  const isHidden = (k) => hiddenCols?.has(k);

  const dosEntries = Array.isArray(member.dos_list) && member.dos_list.length > 0
    ? member.dos_list
    : [{ date: member.dos, label: member.due, labelColor: member.dueCol, vt: member.vt, provider: member.rp, pos: member.pos, posDesc: member.posDesc, open: member.open }];
  const extraCount = dosEntries.length - 1;
  const [expanded, setExpanded] = useState(false);
  const visibleEntries = expanded ? dosEntries : dosEntries.slice(0, 1);

  const [chartRect, setChartRect] = useState(null);
  const [chartDetail, setChartDetail] = useState(null);
  const [actionsRect, setActionsRect] = useState(null);
  const hccRole = useAppStore(s => s.hccUserRole);
  const addedCharts = useAppStore(s => s.hccAddedCharts[member.id]);
  const chartStatus = useAppStore(s => s.hccChartStatus[member.id]);
  const removedCharts = useAppStore(s => s.hccRemovedCharts[member.id]);
  const charts = useMemo(() => getChartDocs(member, addedCharts || [], chartStatus || {}, removedCharts || []), [member, addedCharts, chartStatus, removedCharts]);

  const openChartDrawer = (e) => {
    e.stopPropagation();
    setChartRect(null);
    if (chartHoverCloseTimer.current) { clearTimeout(chartHoverCloseTimer.current); chartHoverCloseTimer.current = null; }
    if (chartHoverOpenTimer.current)  { clearTimeout(chartHoverOpenTimer.current);  chartHoverOpenTimer.current = null; }
    setChartDetail({ id: null });
  };
  const chartHoverOpenTimer = useRef(null);
  const chartHoverCloseTimer = useRef(null);
  const openChartPopoverHover = (e) => {
    if (chartHoverCloseTimer.current) { clearTimeout(chartHoverCloseTimer.current); chartHoverCloseTimer.current = null; }
    if (chartRect) return;
    const rect = e.currentTarget.getBoundingClientRect();
    chartHoverOpenTimer.current = setTimeout(() => setChartRect(rect), 80);
  };
  const closeChartPopoverHover = () => {
    if (chartHoverOpenTimer.current) { clearTimeout(chartHoverOpenTimer.current); chartHoverOpenTimer.current = null; }
    chartHoverCloseTimer.current = setTimeout(() => setChartRect(null), 200);
  };
  const cancelChartPopoverClose = () => {
    if (chartHoverCloseTimer.current) { clearTimeout(chartHoverCloseTimer.current); chartHoverCloseTimer.current = null; }
  };
  const requestChartPopoverClose = () => {
    chartHoverCloseTimer.current = setTimeout(() => setChartRect(null), 200);
  };
  const openActions = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setActionsRect(prev => prev ? null : rect);
  };

  const hasDoc = (charts?.length || 0) > 0;
  const innerCtx = { member, openClaimPreview, openDiagPanel, hasDoc, charts, setDiagOpenDocId, openHccClaimForDos };

  const rejectedStatuses = new Set(['Rejected', 'Reject']);
  const dosState = dosStateFor(member);
  const isRecordRejected = (() => {
    if (dosState) {
      for (const role of ['support', 'coder', 'reviewer', 'reviewer2']) {
        if (rejectedStatuses.has(dosState[role]?.status)) return true;
      }
    }
    return rejectedStatuses.has(member.supS)
      || rejectedStatuses.has(member.cdrS)
      || rejectedStatuses.has(member.r1s)
      || rejectedStatuses.has(member.r2s);
  })();

  const rejectingRole = (() => {
    if (!isRecordRejected) return null;
    const map = { support: 'Support', coder: 'Coder', reviewer: 'QA', reviewer2: 'Compliance' };
    if (dosState) {
      for (const role of ['support', 'coder', 'reviewer', 'reviewer2']) {
        if (rejectedStatuses.has(dosState[role]?.status)) return map[role];
      }
    }
    if (rejectedStatuses.has(member.supS)) return 'Support';
    if (rejectedStatuses.has(member.cdrS)) return 'Coder';
    if (rejectedStatuses.has(member.r1s))  return 'QA';
    if (rejectedStatuses.has(member.r2s))  return 'Compliance';
    return null;
  })();
  const rejectedTooltip = isRecordRejected
    ? `Rejected${rejectingRole ? ` by ${rejectingRole}` : ''} — record is read-only. Expand DOSs or open the record to review comments.`
    : undefined;

  return (
    <>
    <tr
      className={[
        styles.row,
        checked ? styles.rowChecked : '',
        isOpenInDrawer ? styles.rowActive : '',
        expanded ? styles.rowExpanded : '',
        isRecordRejected ? styles.rowRejected : '',
        justAdded ? styles.rowJustAdded : '',
      ].filter(Boolean).join(' ')}
      style={{ '--stagger-index': staggerIndex }}
      aria-disabled={isRecordRejected || undefined}
      title={rejectedTooltip}
    >
      <td className={`${styles.checkTd} ${styles.stickyLeft} ${styles.stickyCheck}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.checkAlign}>
          <Checkbox
            checked={checked}
            onCheckedChange={() => selectHccMember(member.id)}
            aria-label={`Select ${member.name}`}
            disabled={isRecordRejected}
          />
        </div>
      </td>

      <td className={`${styles.memberTd} ${styles.stickyLeft} ${styles.stickyMember} ${styles.colMember}`}>
        <div className={styles.patientCell}>
          <Avatar variant="patient" initials={member.in} locked={isRecordRejected} />
          <div>
            <div className={styles.patientName}>
              <button
                className={styles.patientNameLink}
                onClick={e => { e.stopPropagation(); openQuickView({ id: member.id, name: member.name, initials: member.in, gender: member.g, age: member.age, memberId: member.memberId, language: member.language, raf: member.raf }); }}
              >{member.name}</button>{' '}
              {(() => {
                const dobLabel = formatDobDisplay(member.dob) || deriveDob(member.age, member.name);
                return (
                  <Tooltip label={dobLabel ? `DOB: ${dobLabel}` : ''} placement="bottom">
                    <span className={styles.patientDemo}>({member.g}&bull;{member.age})</span>
                  </Tooltip>
                );
              })()}
            </div>
            <div className={styles.patientMeta}>
              <FoldIdTag id={member.memberId} className={styles.foldId} showToast={showToast} />{' '}&bull;{' '}
              <button type="button" className={styles.langBadge} onClick={(e) => e.stopPropagation()}>
                {(member.language || 'en').toUpperCase()}
                <span className={styles.langTooltip}>Preferred Language: English</span>
              </button>
            </div>
          </div>
        </div>
      </td>

      {(columns || []).map((col) => {
        if (isHidden(col.k)) return null;

        if (DOS_LEVEL_COLS.has(col.k)) {
          const inner = DOS_INNER[col.k];
          const isDos = col.k === 'dos';
          return (
            <td
              key={col.k}
              data-col={col.k}
              className={[
                styles.dosTd,
                col.k === 'pos' ? styles.dosTdLast : '',
              ].filter(Boolean).join(' ')}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.dosStack}>
                {visibleEntries.map((entry, i) => (
                  <div key={`${col.k}-${i}`} className={styles.dosStackItem}>
                    {inner(entry, innerCtx)}
                  </div>
                ))}
                {extraCount > 0 && (
                  <div className={styles.dosFooter}>
                    {isDos && (
                      <button
                        type="button"
                        className={styles.viewMoreBtn}
                        onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
                      >
                        {expanded ? 'View Less' : `View More ${extraCount}`}
                        <Icon name={expanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'} size={12} color="var(--neutral-300)" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </td>
          );
        }

        const render = CELL_RENDERERS[col.k];
        if (!render) return null;
        return render({ member, charts, dosStateFor, nameOf, openChartDrawer, openChartPopoverHover, closeChartPopoverHover, openDiagPanel, openUpload: (m) => openHccUploadDrawer(m) });
      })}

      <td className={`${styles.actionsCell} ${styles.stickyRight} ${styles.colActions}`}>
        <div className={styles.actionsRow}>
          <ActionButton
            icon="solar:eye-linear"
            size="L"
            tooltip="View Diagnosis Gaps"
            onClick={(e) => {
              e.stopPropagation();
              openDiagPanel(member.id, { leftPanel: 'documents' });
              const firstDoc = charts?.[0];
              if (firstDoc?.id) useAppStore.getState().setDiagOpenDocId(firstDoc.id);
            }}
          />
          <span className={styles.actionsDivider} />
          <ActionButton
            icon="custom:add-dos"
            size="L"
            tooltip="Add DOS"
            onClick={(e) => { e.stopPropagation(); openAddDos(member); }}
          />
          <span className={styles.actionsDivider} />
          <ActionButton
            icon="solar:menu-dots-linear"
            size="L"
            tooltip="More actions"
            onClick={openActions}
          />
        </div>
      </td>
    </tr>

    {chartRect && (
      <ChartPopover
        anchorRect={chartRect}
        member={member}
        charts={charts}
        onClose={() => setChartRect(null)}
        onEnter={cancelChartPopoverClose}
        onLeave={requestChartPopoverClose}
        onUpload={() => { setChartRect(null); openHccUploadDrawer(member); }}
        onSelectChart={(chart) => { setChartRect(null); setChartDetail({ id: chart.id }); }}
        onViewMore={() => { setChartRect(null); setChartDetail({ id: null }); }}
      />
    )}
    {chartDetail && (
      hccRole === 'Support' ? (
        <ChartDetailDrawer
          charts={charts}
          initialId={chartDetail.id}
          member={member}
          onClose={() => setChartDetail(null)}
        />
      ) : (
        <DocPreviewDrawer
          charts={charts}
          initialId={chartDetail.id}
          member={member}
          onClose={() => setChartDetail(null)}
        />
      )
    )}
    {actionsRect && (
      <ActionsMenuPopover
        anchorRect={actionsRect}
        onClose={() => setActionsRect(null)}
        onAction={(label) => {
          if (label === 'Edit Details') {
            openPatientEdit('basic', {
              id: member.id,
              name: member.name,
              initials: member.initials,
              gender: member.gender,
              age: member.age,
              // The drawer's DOB helpers only accept a string — normalize
              // any Date / ISO / mm-dd-yyyy shape to mm/dd/yyyy up front.
              dob: formatDobDisplay(member.dob) || deriveDob(member.age, member.name),
              email: member.email,
              phone: member.phone,
            });
            return;
          }
          showToast(`${label} — coming soon`);
        }}
      />
    )}
    </>
  );
}

export const HccWorklistRow = memo(HccWorklistRowImpl, (prev, next) => (
  prev.member === next.member
  && prev.hiddenCols === next.hiddenCols
  && prev.columns === next.columns
  && prev.staggerIndex === next.staggerIndex
));

function HccEmptyPatientRowImpl({ patient, hiddenCols, columns, staggerIndex = 0 }) {
  const openAddDos = useAppStore(s => s.openHccAddDos);
  const showToast = useAppStore(s => s.showToast);
  const openQuickView = useAppStore(s => s.openQuickView);
  const isHidden = (k) => hiddenCols?.has(k);
  const dash = <span className={styles.emptyDash} aria-hidden="true" />;
  const profile = useMemo(() => synthesizeHccProfile(patient), [patient]);

  const handleRecord = (e) => {
    e.stopPropagation();
    openAddDos({
      id: patient.id,
      name: patient.name,
      in: patient.initials,
      g: patient.gender,
      age: patient.age,
      memberId: patient.memberId || patient.id,
      dob: patient.dob,
    });
  };

  return (
    <tr className={`${styles.row} ${styles.emptyRow}`} style={{ '--stagger-index': staggerIndex }}>
      <td className={`${styles.checkTd} ${styles.stickyLeft} ${styles.stickyCheck}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.checkAlign}>
          <Checkbox checked={false} disabled aria-label={`Select ${patient.name}`} />
        </div>
      </td>

      <td className={`${styles.memberTd} ${styles.stickyLeft} ${styles.stickyMember} ${styles.colMember}`}>
        <div className={styles.patientCell}>
          <Avatar variant="patient" initials={patient.initials} />
          <div>
            <div className={styles.patientName}>
              <button
                className={styles.patientNameLink}
                onClick={(e) => {
                  e.stopPropagation();
                  openQuickView({
                    id: patient.id,
                    name: patient.name,
                    initials: patient.initials,
                    gender: patient.gender,
                    age: patient.age,
                    memberId: patient.memberId,
                    language: patient.language,
                  });
                }}
              >{patient.name}</button>{' '}
              <span className={styles.patientDemo}>({patient.gender}&bull;{patient.age})</span>
            </div>
            <div className={styles.patientMeta}>
              <FoldIdTag id={patient.memberId || patient.id} className={styles.foldId} showToast={showToast} />{' '}&bull;{' '}
              <button type="button" className={styles.langBadge} onClick={(e) => e.stopPropagation()}>
                {(patient.language || 'en').toUpperCase()}
                <span className={styles.langTooltip}>Preferred Language: English</span>
              </button>
            </div>
          </div>
        </div>
      </td>

      {(columns || []).map((col) => {
        if (isHidden(col.k)) return null;
        const cls = col.k === 'pos' ? styles.dosTdLast : '';
        const profileValue = profile[col.k];
        return (
          <td key={col.k} data-col={col.k} className={cls}>
            {profileValue != null ? profileValue : dash}
          </td>
        );
      })}

      <td className={`${styles.actionsCell} ${styles.stickyRight} ${styles.colActions}`}>
        <div className={styles.actionsRow}>
          <Button variant="alt" size="S" leadingIcon="solar:add-circle-linear" onClick={handleRecord}>Add DOS</Button>
        </div>
      </td>
    </tr>
  );
}

export const HccEmptyPatientRow = memo(HccEmptyPatientRowImpl, (prev, next) => (
  prev.patient === next.patient
  && prev.hiddenCols === next.hiddenCols
  && prev.columns === next.columns
  && prev.staggerIndex === next.staggerIndex
));
