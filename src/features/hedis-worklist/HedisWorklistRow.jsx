import { useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { AssigneeChange } from '../../components/AssigneeChange/AssigneeChange';
import { Badge } from '../../components/Badge/Badge';
import { Checkbox } from '../../components/ShadcnCheckbox/ShadcnCheckbox';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { useAppStore } from '../../store/useAppStore';
import { worklistMemberCallId } from '../../lib/patientCall';
import { FoldIdTag } from '../../components/FoldIdTag/FoldIdTag';
import { Tooltip } from '../../components/Tooltip/Tooltip';
import { formatDobDisplay, deriveDob } from '../../lib/patientDob';
import { computeDsfbDueDateISO } from './dsf/dsfScoring';
import { CIS_CODE, cisDueIndicator, evaluateCis } from './cis/cisRules';
import { platformUsersForAssigneePicker } from '../../lib/worklistAssignee';
import { MEASURE_NAMES } from './ClinicalNotePanel.utils';
import { gapInstanceLabel, gapSourceLabel } from './hedisFilters';
import { PatientAvatarHover } from '../../components/PatientHoverCard/PatientAvatarHover';
import { ActionsMenuPopover } from '../hcc/RowPopovers';
import styles from './HedisWorklistRow.module.css';
import { OutreachStatus } from '../../components/OutreachStatus/OutreachStatus';
import { outreachFromDots } from '../../components/OutreachStatus/outreachStatusModel';

const LANG_MAP = {
  en: 'English', es: 'Spanish; Castilian', zh: 'Chinese', yue: 'Cantonese',
  ko: 'Korean', vi: 'Vietnamese', hi: 'Hindi', bn: 'Bengali', ar: 'Arabic',
};

const RISK_BADGE_VARIANT = {
  '1_High':     'priority-critical',
  '2_Mod-High': 'priority-high',
  '3_Moderate': 'priority-medium',
  '4_Mod-Low':  'toc-engaged',
  '5_Low':      'compliance-pass',
};

function CisDueLabel({ member }) {
  const immunizations = useAppStore(s => s.patientImmunizations[member.id]);
  const dob = member.dob;
  const due = useMemo(
    () => (immunizations ? cisDueIndicator(evaluateCis({ dob, immunizations })) : null),
    [dob, immunizations],
  );
  if (!due) return null;
  return <span className={`${styles.startDateDue}${due.tone === 'error' ? ` ${styles.startDateOverdue}` : ''}`}>{due.label}</span>;
}

// Shorter display names for long statuses; the stored value is unchanged.
const STATUS_LABEL = {
  'Engaged Requires Follow-Up': 'Engaged: Follow-up',
};

export const STATUS_BADGE_VARIANT = {
  Open:                            'ai-care',
  Engaged:                         'status-queued',
  'Engaged Requires Follow-Up':    'status-queued',
  Submitted:                       'status-queued',
  Completed:                       'status-completed',
  'Closed - Data':                 'ai-neutral',
  'Closed - Do not call':          'ai-neutral',
  'Closed - UTR':                  'ai-neutral',
  'Closed - Other':                'ai-neutral',
};

// Outreach: the shared worklist outreach status (icon, result, date, attempt dots).
function OutreachCell({ member }) {
  return <OutreachStatus {...outreachFromDots(member.outreachDots, { date: member.outreachDate })} />;
}

/**
 * Middle-column defs for HEDIS. Every column carries `renderCell(member,
 * ctx)` so hide + reorder in the Show Columns popover ripple through the
 * table body. The per-gap columns (total gaps, gap status, assignee, start
 * date) map each gap to its own row inside the cell, keeping the original
 * multi-gap presentation.
 *
 * Some cells stop row-click propagation because they contain their own
 * click targets (gap badges, assign button). `stopRowClickPropagation`
 * routes that through the row iterator without repeating the pattern
 * inline per cell.
 *
 * ctx shape: { onOpenGap, showToast }
 */
export const HEDIS_MIDDLE_COLUMNS = [
  {
    key: 'totalGaps',
    label: 'Total Gaps',
    stopRowClickPropagation: true,
    // Single-gap rows center vertically. `visibleGaps` comes from cellCtx and
    // reflects the collapse state, so a 3-gap row collapsed to 2 stays top-
    // aligned like other multi-gap rows.
    getTdClassName: (member, ctx) => (
      (ctx?.visibleGaps?.length === 1)
        ? `${styles.tdGap} ${styles.tdGapCenter}`
        : styles.tdGap
    ),
    renderCell: (member, ctx) => (
      <div className={styles.gapItems}>
        {(ctx.visibleGaps || []).map((g, i) => (
          <div key={`${g.code}-${i}`} className={styles.gapItem}>
            {/* Hover shows the measure's full name; the code alone is hard to read.
                A superseded gap (closed, then re-added) is history: the drawer
                and every gap action work on the active gap with that code, so
                its pill is a label, not a button. */}
            {g.supersededAt ? (
              <Tooltip label={`${MEASURE_NAMES[g.code] || g.code} · previous gap, re-added ${g.supersededAt}`}>
                <Badge size="M" variant="compliance-na" label={g.code} />
              </Tooltip>
            ) : (
            <Tooltip label={MEASURE_NAMES[g.code] || g.code}>
              <button
                type="button"
                className={styles.gapBadgeButton}
                aria-label={`Open ${g.code}${MEASURE_NAMES[g.code] ? ` (${MEASURE_NAMES[g.code]})` : ''} care gap details`}
                onClick={(e) => { e.stopPropagation(); ctx.onOpenGap?.(member, g.code); }}
              >
                <Badge size="M" variant="compliance-na" label={g.code} />
              </button>
            </Tooltip>
            )}
          </div>
        ))}
        {ctx.extraCount > 0 && (
          <div className={styles.gapFooter}>
            <button
              type="button"
              className={styles.viewMoreBtn}
              onClick={(e) => { e.stopPropagation(); ctx.toggleExpanded(); }}
            >
              {ctx.expanded ? 'View Less' : `View More ${ctx.extraCount}`}
              <Icon
                name={ctx.expanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
                size={12}
                color="var(--neutral-300)"
              />
            </button>
          </div>
        )}
      </div>
    ),
  },
  {
    key: 'gapSource',
    label: 'Source',
    getTdClassName: (member, ctx) => (
      (ctx?.visibleGaps?.length === 1)
        ? `${styles.tdGap} ${styles.tdGapCenter}`
        : styles.tdGap
    ),
    // Gaps added in Fold are stamped `fold-native`; the rest came with the
    // health plan's gap report (claims).
    renderCell: (member, ctx) => (
      <div className={styles.gapItems}>
        {(ctx.visibleGaps || []).map((g, i) => (
          <div key={`${g.code}-${i}`} className={styles.gapItem}>
            <span className={gapSourceLabel(g) === 'Manual' ? styles.gapSourceManual : styles.gapSourceClaim}>
              {gapSourceLabel(g)}
            </span>
          </div>
        ))}
        {ctx.extraCount > 0 && <div className={styles.gapFooter} />}
      </div>
    ),
  },
  {
    key: 'gapInstance',
    label: 'Instance',
    getTdClassName: (member, ctx) => (
      (ctx?.visibleGaps?.length === 1)
        ? `${styles.tdGap} ${styles.tdGapCenter}`
        : styles.tdGap
    ),
    // A gap closed and then re-added stays in the row stamped `supersededAt`.
    renderCell: (member, ctx) => (
      <div className={styles.gapItems}>
        {(ctx.visibleGaps || []).map((g, i) => (
          <div key={`${g.code}-${i}`} className={styles.gapItem}>
            <span className={gapInstanceLabel(g) === 'Previous' ? styles.gapPlainTextMuted : styles.gapPlainText}>
              {gapInstanceLabel(g)}
            </span>
          </div>
        ))}
        {ctx.extraCount > 0 && <div className={styles.gapFooter} />}
      </div>
    ),
  },
  {
    key: 'gapStatus',
    label: 'Gap Status',
    getTdClassName: (member, ctx) => (
      (ctx?.visibleGaps?.length === 1)
        ? `${styles.tdGap} ${styles.tdGapCenter}`
        : styles.tdGap
    ),
    renderCell: (member, ctx) => (
      <div className={styles.gapItems}>
        {(ctx.visibleGaps || []).map((g, i) => (
          <div key={`${g.code}-${i}`} className={styles.gapItem}>
            <Badge size="M" variant={STATUS_BADGE_VARIANT[g.status] || 'ai-neutral'} label={STATUS_LABEL[g.status] || g.status} />
          </div>
        ))}
        {/* Empty spacer keeps this column bottom-aligned with Total Gaps' expander. */}
        {ctx.extraCount > 0 && <div className={styles.gapFooter} />}
      </div>
    ),
  },
  {
    key: 'assignee',
    label: 'Assignee',
    stopRowClickPropagation: true,
    getTdClassName: (member, ctx) => (
      (ctx?.visibleGaps?.length === 1)
        ? `${styles.tdGap} ${styles.tdGapCenter}`
        : styles.tdGap
    ),
    renderCell: (member, ctx) => (
      <div className={styles.gapItems}>
        {(ctx.visibleGaps || []).map((g, i) => {
          const assignee = g.assignee ?? member.assignee;
          // Gap-level overrides carry name only: derive initials from words
          // so the avatar always has content. Member-level overrides keep the
          // curated `assigneeInitials` (handles edge cases like "Dr." prefixes).
          const initials = (g.assignee && g.assignee !== member.assignee)
            ? assignee.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
            : (member.assigneeInitials
                || assignee?.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join(''));
          const handlePick = (u) => {
            // A superseded gap's assignee is history; updateGapAssignee acts on
            // the active gap with this code.
            if (g.supersededAt || !ctx.updateGapAssignee || !ctx.memberId) return;
            ctx.updateGapAssignee(ctx.memberId, g.code, u?.name || null);
          };
          return (
            <div key={`${g.code}-${i}`} className={styles.gapItem}>
              {assignee ? (
                <AssigneeChange
                  name={assignee}
                  initials={initials}
                  showRole={false}
                  users={ctx.assigneePickerUsers}
                  pickerTitle="Change assignee"
                  onSelect={handlePick}
                  disabled={!!g.supersededAt}
                />
              ) : (
                <AssigneeChange
                  unassigned
                  unassignedLabel="Assign"
                  showRole={false}
                  users={ctx.assigneePickerUsers}
                  pickerTitle="Assign to"
                  onSelect={handlePick}
                  disabled={!!g.supersededAt}
                />
              )}
            </div>
          );
        })}
        {ctx.extraCount > 0 && <div className={styles.gapFooter} />}
      </div>
    ),
  },
  {
    key: 'startDate',
    label: 'Start Date',
    sortKey: 'startDate',
    getTdClassName: (member, ctx) => (
      (ctx?.visibleGaps?.length === 1)
        ? `${styles.tdGap} ${styles.tdGapCenter} ${styles.tdGapDivide}`
        : `${styles.tdGap} ${styles.tdGapDivide}`
    ),
    renderCell: (member, ctx) => (
      <div className={styles.gapItems}>
        {(ctx.visibleGaps || []).map((g, i) => (
          <div key={`${g.code}-${i}`} className={styles.gapItem}>
            <div className={styles.startDateCell}>
              <span className={styles.startDateValue}>{g.startDate ?? member.startDate}</span>
              {/* DSF-B carries a 30-day window. Anchor is the paired
                  DSF-A PHQ-2 savedAt when Fold-native, otherwise the
                  DSF-B ingestion date (Astrana). computeDsfbDueDateISO
                  centralises the priority so worklist copy and the
                  in-note guard stay in sync. */}
              {g.code === 'DSF-B' && g.status !== 'Completed' && !String(g.status).startsWith('Closed') && (() => {
                const dueISO = computeDsfbDueDateISO({ dsfbGap: g });
                const daysLeft = Math.ceil((new Date(dueISO).getTime() - Date.now()) / 86400000);
                const overdue = daysLeft < 0;
                const label = daysLeft > 0
                  ? `Due in ${daysLeft}d`
                  : daysLeft === 0
                    ? 'Due today'
                    : `Overdue by ${Math.abs(daysLeft)}d`;
                const cls = `${styles.startDateDue}${overdue ? ` ${styles.startDateOverdue}` : ''}`;
                return <span className={cls}>{label}</span>;
              })()}
              {g.code === CIS_CODE && g.status !== 'Completed' && !String(g.status).startsWith('Closed') && (
                <CisDueLabel member={member} />
              )}
            </div>
          </div>
        ))}
        {ctx.extraCount > 0 && <div className={styles.gapFooter} />}
      </div>
    ),
  },
  {
    key: 'outreach',
    label: 'Outreach',
    renderCell: (member) => <OutreachCell member={member} />,
  },
  {
    key: 'advIllness',
    label: 'AdvIllness',
    sortKey: 'advIllness',
    renderCell: (member) => <span className={styles.numText}>{member.advIllness ?? 0}</span>,
  },
  {
    key: 'frailty',
    label: 'Frailty',
    sortKey: 'frailty',
    renderCell: (member) => <span className={styles.numText}>{member.frailty ?? 0}</span>,
  },
  {
    key: 'riskLevel',
    label: 'Risk Level',
    sortKey: 'riskLevel',
    renderCell: (member) => (
      member.riskLevel
        ? <Badge size="M" variant={RISK_BADGE_VARIANT[member.riskLevel]} label={member.riskLevel} />
        : <span className={styles.muted}>-</span>
    ),
  },
  {
    key: 'tasks',
    label: 'Tasks',
    sortKey: 'tasks',
    renderCell: (member, ctx) => {
      const count = (ctx?.allTasks || []).filter(
        t => t.hedisMemberId && t.hedisMemberId === member.id,
      ).length;
      return count > 0
        ? <span className={styles.numText}>{count}</span>
        : <span className={styles.muted}>-</span>;
    },
  },
];

export function HedisWorklistRow({ member, columns, hiddenSet, isSelected, onSelect, onOpenGap }) {
  const showToast = useAppStore(s => s.showToast);
  const openQuickView = useAppStore(s => s.openQuickView);
  const platformUsers = useAppStore(s => s.platformUsers);
  const updateGapAssignee = useAppStore(s => s.updateGapAssignee);
  const allTasks = useAppStore(s => s.tasks);
  const openCallPopover = useAppStore(s => s.openCallPopover);
  const openAddCareGaps = useAppStore(s => s.openAddCareGaps);
  const callBtnRef = useRef(null);
  const moreBtnRef = useRef(null);
  const [actionsRect, setActionsRect] = useState(null);
  const openPatientEdit = useAppStore(s => s.openPatientEdit);
  // useState must sit above the early return: a row whose member loses its last
  // gap would otherwise render two hooks where it previously rendered three, and
  // React throws "rendered fewer hooks than expected".
  const [expanded, setExpanded] = useState(false);
  const gaps = Array.isArray(member.gaps) ? member.gaps : [];
  if (gaps.length === 0) return null;
  const primaryGap = gaps[0];

  const middleCols = (columns || HEDIS_MIDDLE_COLUMNS)
    .filter(c => !c.sticky && !c.showCheckbox && c.renderCell);
  const visibleMiddle = hiddenSet ? middleCols.filter(c => !hiddenSet.has(c.key)) : middleCols;

  // Collapse to the first 2 gaps and surface a "View More N" toggle in the
  // Total Gaps column, mirroring the HCC worklist's DOS collapse pattern.
  const MAX_INLINE_GAPS = 2;
  const visibleGaps = expanded ? gaps : gaps.slice(0, MAX_INLINE_GAPS);
  const extraCount = Math.max(0, gaps.length - MAX_INLINE_GAPS);

  const cellCtx = {
    onOpenGap,
    showToast,
    visibleGaps,
    extraCount,
    expanded,
    toggleExpanded: () => setExpanded(v => !v),
    platformUsers,
    assigneePickerUsers: platformUsersForAssigneePicker(platformUsers),
    updateGapAssignee,
    memberId: member.id,
    allTasks,
  };

  const langShort = (member.language || 'en').toUpperCase();
  const langFull = LANG_MAP[member.language] || member.language;

  // Multi-gap rows top-align member / per-member cells so the patient name
  // and single-value columns don't float in the middle of a tall stacked row.
  const multiGap = gaps.length > 1;
  const quickViewPayload = { id: member.id, name: member.name, initials: member.in, gender: member.gender, age: member.age, memberId: member.memberId, language: member.language };
  const handleMemberCellClick = (e) => {
    e.stopPropagation();
    openQuickView(quickViewPayload);
  };

  return (
    <tr
      className={[
        styles.row,
        isSelected ? styles.rowChecked : '',
        multiGap ? styles.rowMultiGap : '',
      ].filter(Boolean).join(' ')}
      onClick={() => onOpenGap?.(member, primaryGap.code)}
    >
      {/* Checkbox: wrapped in `.checkAlign` so it aligns to the avatar's
          vertical centre even on multi-gap rows where the td top-aligns
          to the first gap row. Same pattern the HCC worklist uses. */}
      <td className={`${styles.checkTd} ${styles.stickyLeft} ${styles.stickyCheck}`} onClick={e => e.stopPropagation()}>
        <div className={styles.checkAlign}>
          <Checkbox checked={isSelected} onCheckedChange={() => onSelect(member.id)} aria-label={`Select ${member.name}`} />
        </div>
      </td>

      {/* Member: entire cell clickable for patient quick view. The
          onClick stops propagation so the row's own onClick (which
          opens the Care Gap drawer) doesn't also fire. */}
      <td
        className={`${styles.memberTd} ${styles.stickyLeft} ${styles.stickyMember}`}
        title="Open patient quick view"
        style={{ cursor: 'pointer' }}
        onClick={handleMemberCellClick}
      >
        <div className={styles.patientCell}>
          <PatientAvatarHover patient={{ memberId: member.memberId, id: member.id, name: member.name, initials: member.in, gender: member.gender, age: member.age, dob: member.dob }} />
          <div>
            <div className={styles.patientName}>
              <button
                className={styles.patientNameLink}
                onClick={handleMemberCellClick}
              >
                {member.name}
              </button>{' '}
              {(() => {
                const dobLabel = formatDobDisplay(member.dob) || deriveDob(member.age, member.name);
                return (
                  <Tooltip label={dobLabel ? `DOB: ${dobLabel}` : ''} placement="bottom">
                    <span className={styles.patientDemo}>({member.gender}&bull;{member.age})</span>
                  </Tooltip>
                );
              })()}
            </div>
            <div className={styles.patientMeta}>
              <span onClick={e => e.stopPropagation()} style={{ display: 'inline-flex' }}>
                <FoldIdTag id={member.memberId} className={styles.foldId} showToast={showToast} />
              </span>{' '}&bull;{' '}
              <Tooltip label={`Preferred Language: ${langFull}`} variant="light">
                <span className={styles.langBadge}>
                  {langShort}
                </span>
              </Tooltip>
            </div>
          </div>
        </div>
      </td>

      {visibleMiddle.map(col => {
        const className = col.getTdClassName ? col.getTdClassName(member, cellCtx) : (col.tdClassName || styles.td);
        return (
          <td
            key={col.key}
            data-col-key={col.key}
            className={className}
            onClick={col.stopRowClickPropagation ? (e) => e.stopPropagation() : undefined}
          >
            {col.renderCell(member, cellCtx)}
          </td>
        );
      })}

      {/* Actions: HEDIS rows expose Call, Add Care Gaps and More. The eye affordance
          was removed because the gap pills in-row already open the Care
          Gap Details drawer, so a duplicate view button in the actions
          column added noise without a distinct outcome. */}
      {/* The actions menu is portaled, but its clicks still bubble here through
          React; stop them so they don't also open the row's gap drawer. */}
      <td className={`${styles.actionsCell} ${styles.stickyRight}`} onClick={e => e.stopPropagation()}>
        <div className={styles.actionsBtns}>
          <ActionButton
            ref={callBtnRef}
            icon="solar:phone-linear"
            tooltip="Call patient"
            onClick={(e) => {
              e.stopPropagation();
              openCallPopover(worklistMemberCallId(member), callBtnRef);
            }}
          />
          <span className={styles.actionsDivider} />
          <ActionButton
            icon="solar:clipboard-add-linear"
            tooltip="Add Care Gaps"
            onClick={(e) => { e.stopPropagation(); openAddCareGaps(member); }}
          />
          <span className={styles.actionsDivider} />
          <ActionButton
            ref={moreBtnRef}
            icon="solar:menu-dots-linear"
            tooltip="More"
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              setActionsRect(prev => (prev ? null : rect));
            }}
          />
          {/* Same member actions menu as the HCC worklist row. */}
          {actionsRect && (
            <ActionsMenuPopover
              anchorRect={actionsRect}
              onClose={() => setActionsRect(null)}
              onAction={(label) => {
                if (label === 'Make a Call') {
                  setActionsRect(null);
                  openCallPopover(worklistMemberCallId(member), moreBtnRef);
                  return;
                }
                if (label === 'Edit Details') {
                  openPatientEdit('basic', {
                    id: member.id,
                    name: member.name,
                    initials: member.in,
                    gender: member.gender,
                    age: member.age,
                    dob: formatDobDisplay(member.dob) || deriveDob(member.age, member.name),
                    email: member.email,
                    phone: member.phone,
                  });
                  return;
                }
                showToast(`${label}: coming soon`);
              }}
            />
          )}
        </div>
      </td>
    </tr>
  );
}
