import { useRef, useState } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { AssigneeChange } from '../../components/AssigneeChange/AssigneeChange';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { FilterChip } from '../../components/FilterChip/FilterChip';
import { MenuPopover } from '../../components/MenuPopover/MenuPopover';
import { MEASURE_NAMES, STATUSES, daysAgo, initialsOf } from './CareGapDetailDrawer.utils';
import { computeDsfbDueDateISO } from './dsf/dsfScoring';
import { CIS_CODE } from './cis/cisRules';
import { GapSourceCircle } from './GapSourceCircle';
import { gapSourceLabel } from './hedisFilters';
import styles from './CareGapDetailDrawer.module.css';

// Status → shared Badge tone. Aligns with STATUS_STYLE's colour intent
// but routes through the design-system palette so the trigger reads
// identically to every other status pill in the app.
const STATUS_TONE = {
  'Open':                        'primary',
  'Engaged':                     'warning',
  'Engaged Requires Follow-Up':  'warning',
  'Submitted':                   'warning',
  'Completed':                   'success',
  'Closed - Data':               'neutral',
  'Closed - Do not call':        'neutral',
  'Closed - UTR':                'neutral',
  'Closed - Other':              'neutral',
};

export function CareGapDetailDrawerHeader({
  gap,
  member,
  selectedYear,
  setSelectedYear,
  yearOpen,
  setYearOpen,
  yearOptions,
  status,
  statusLocked,
  statusOpen,
  setStatusOpen,
  statusAnchorRect,
  setStatusAnchorRect,
  updateGapStatus,
  platformUsers,
  updateGapAssignee,
  showToast,
  setShowClinicalNote,
  onOpenClinicalNote,
  onScheduleAppointment,
  onAddOutreach,
  onAddTask,
  onSendReferral,
  onScheduleVaccine,
  cisCompletedBlocked = false,
  onOpenMeasureInfo,
  moreBtnRef,
  moreMenuRect,
  openMoreMenu,
  closeMoreMenu,
  goPrev,
  goNext,
  canPrev,
  canNext,
  // Every instance of this gap, newest first ({ no, gap, active }); the
  // dropdown shows only once there is a second one. A previous instance is
  // shown read-only.
  instances = [],
  viewedInstanceNo = null,
  onPickInstance,
}) {
  const statusBtnRef = useRef(null);
  const instanceBtnRef = useRef(null);
  const [instanceMenuOpen, setInstanceMenuOpen] = useState(false);
  const viewed = instances.find(i => i.no === viewedInstanceNo) || instances[0];
  const readOnly = !!viewed && !viewed.active;
  const measureName = MEASURE_NAMES[gap.code] ?? gap.code;
  const isCis = gap.code === CIS_CODE;

  return (
    <>
      <div className={styles.gapHeader}>
        <div className={styles.gapToolbar}>
          <div className={styles.yearWrap}>
            {/* Shared FilterChip in single-select mode: same "Label ⌄" idle
                → "Label : value ✕" active behaviour every other filter chip
                in the app uses. Emits a 1-element array so the local state
                stays a plain number. */}
            <FilterChip
              label="Measurement Year"
              options={yearOptions.map(String)}
              selected={selectedYear ? [String(selectedYear)] : []}
              onChange={(vals) => {
                const next = vals?.[0];
                if (next) setSelectedYear(Number(next));
                setYearOpen(false);
              }}
              singleSelect
              noClear
              size="S"
              info={`Evidence uploaded will be recorded for measurement year ${selectedYear}.`}
            />
          </div>
          <div className={styles.gapToolbarRight}>
            {/* Assignee + Status promoted from the title row into the toolbar,
                primary actions live in Suggested Actions below, so the toolbar
                is reserved for the gap's identity chips (who owns it, what
                state it's in) plus the More menu that catches everything else
                (Add Task, Add Clinical Note, orders, referrals, …). */}
            {(() => {
              const effectiveAssignee = gap.assignee ?? member?.assignee ?? null;
              const pickerUsers = effectiveAssignee
                ? [...(platformUsers || []), { id: '__unassign', name: 'Unassign', initials: '-' }]
                : (platformUsers || []);
              return (
                <AssigneeChange
                  avatarOnly
                  disabled={readOnly}
                  unassigned={!effectiveAssignee}
                  name={effectiveAssignee || undefined}
                  initials={effectiveAssignee ? initialsOf(effectiveAssignee) : undefined}
                  ariaLabel={effectiveAssignee || 'Assign'}
                  users={pickerUsers}
                  pickerTitle={effectiveAssignee ? 'Change assignee' : 'Assign to'}
                  onSelect={(u) => {
                    if (u?.id === '__unassign') updateGapAssignee(member.id, gap.code, null);
                    else updateGapAssignee(member.id, gap.code, u?.name || null);
                  }}
                />
              );
            })()}

            <div className={styles.statusWrap}>
              <button
                ref={statusBtnRef}
                type="button"
                className={styles.statusBtnReset}
                onClick={() => {
                  if (statusLocked) return;
                  if (statusOpen) { setStatusOpen(false); setStatusAnchorRect(null); }
                  else { const r = statusBtnRef.current?.getBoundingClientRect(); if (r) setStatusAnchorRect(r); setStatusOpen(true); }
                }}
                disabled={statusLocked}
                title={statusLocked ? 'Completed gaps are locked' : ''}
                aria-haspopup="menu"
                aria-expanded={statusOpen}
              >
                <Badge
                  size="md"
                  tone={STATUS_TONE[status] || 'neutral'}
                  label={status}
                  chevron={!statusLocked}
                  icon={status === 'Completed' ? 'solar:check-circle-linear' : undefined}
                  style={{ height: 28 }}
                />
              </button>
              {statusOpen && !statusLocked && statusAnchorRect && (
                <MenuPopover
                  anchorRect={statusAnchorRect}
                  // Radio glyph in the icon slot mirrors the Performed by
                  // dropdown pattern: empty neutral-200 circle by default,
                  // 5px primary-300 fill on the current status. Reads at a
                  // glance without the shared double-check icon (which
                  // looked like "read receipt" more than "selected").
                  items={STATUSES.map(s => ({
                    key: s,
                    label: s,
                    selected: s === status,
                    // CIS-CMB10: Completed only once every Combo 10 dose is met.
                    disabled: s === 'Completed' && cisCompletedBlocked,
                    hint: s === 'Completed' && cisCompletedBlocked ? 'All Combo 10 doses must be met first' : undefined,
                    iconElement: (
                      <span
                        aria-hidden="true"
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 999,
                          background: 'var(--neutral-0)',
                          boxSizing: 'border-box',
                          flexShrink: 0,
                          border: s === status
                            ? '5px solid var(--primary-300)'
                            : '1px solid var(--neutral-200)',
                        }}
                      />
                    ),
                  }))}
                  onSelect={(key) => { updateGapStatus(member.id, gap.code, key); setStatusOpen(false); setStatusAnchorRect(null); }}
                  onClose={() => { setStatusOpen(false); setStatusAnchorRect(null); }}
                  ariaLabel="Change Status"
                  width={220}
                />
              )}
            </div>

            {onOpenMeasureInfo && (
              <>
                <span className={styles.headerDivider} />
                <ActionButton
                  icon="solar:book-2-linear"
                  tooltip="Measure Tutorial"
                  tooltipBelow
                  tooltipLeft
                  onClick={() => onOpenMeasureInfo(gap.code)}
                />
              </>
            )}
            <span className={styles.headerDivider} />
            <ActionButton ref={moreBtnRef} icon="solar:menu-dots-linear" tooltip="More" tooltipBelow tooltipLeft
              onClick={moreMenuRect ? closeMoreMenu : openMoreMenu} />
          </div>
        </div>

        <div className={styles.gapTitleWrap}>
          <div className={styles.gapTitleRow}>
            <div className={styles.gapTitleCol}>
              <div className={`${styles.gapTitle} ${styles.gapTitleWithSource}`}>
                {gap.code} - {measureName}
                <GapSourceCircle gap={gap} />
              </div>
              {gap.startDate && (
                <div className={styles.gapSubRow}>
                  <span>{gap.startDate}{daysAgo(gap.startDate) ? ` (${daysAgo(gap.startDate)})` : ''}</span>
                  {instances.length > 1 && viewed && (
                    <>
                      <span style={{ color: 'var(--neutral-300)' }}>{' • '}</span>
                      <button
                        ref={instanceBtnRef}
                        type="button"
                        className={styles.instancePickerBtn}
                        aria-haspopup="menu"
                        aria-expanded={instanceMenuOpen}
                        onClick={() => setInstanceMenuOpen(v => !v)}
                      >
                        Instance {viewed.no} • {viewed.active ? 'Active' : 'Previous'}
                        <Icon name="solar:alt-arrow-down-linear" size={12} color="currentColor" />
                      </button>
                      {instanceMenuOpen && (
                        <MenuPopover
                          anchorRef={instanceBtnRef}
                          align="left"
                          width={380}
                          ariaLabel="Gap instances"
                          items={instances.map(i => ({
                            key: String(i.no),
                            // Second line: source, the instance it is the
                            // parent of (if any), and its dates.
                            iconElement: <GapSourceCircle gap={i.gap} />,
                            tall: true,
                            label: (
                              <span className={styles.instanceOption}>
                                <span>{`Instance ${i.no} • ${i.active ? 'Active' : 'Previous'} • ${i.gap.status}`}</span>
                                <span className={styles.instanceOptionMeta}>
                                  {[
                                    gapSourceLabel(i.gap),
                                    !i.active && instances.find(x => x.no === i.no + 1) ? `Parent of Instance ${i.no + 1}` : null,
                                    `Opened ${i.gap.startDate || '-'}`,
                                    i.gap.closedDate ? `Closed ${i.gap.closedDate}` : null,
                                  ].filter(Boolean).join(' • ')}
                                </span>
                              </span>
                            ),
                            selected: i.no === viewed.no,
                          }))}
                          onSelect={(key) => { setInstanceMenuOpen(false); onPickInstance?.(Number(key)); }}
                          onClose={() => setInstanceMenuOpen(false)}
                        />
                      )}
                    </>
                  )}
                  {/* DSF-B carries a 30-day due window that the worklist
                      row already surfaces; mirror the same "Due in Xd" /
                      "Overdue by Xd" chip here so the drawer header
                      doesn't hide the deadline the coordinator saw
                      one click ago. Hidden once the gap is Completed
                      or Closed. */}
                  {gap.code === 'DSF-B' && gap.status !== 'Completed' && !String(gap.status).startsWith('Closed') && (() => {
                    const dueISO = computeDsfbDueDateISO({ dsfbGap: gap });
                    if (!dueISO) return null;
                    const daysLeft = Math.ceil((new Date(dueISO).getTime() - Date.now()) / 86400000);
                    const label = daysLeft > 0
                      ? `Due in ${daysLeft}d`
                      : daysLeft === 0
                        ? 'Due today'
                        : `Overdue by ${Math.abs(daysLeft)}d`;
                    const color = daysLeft < 0 ? 'var(--status-error)' : 'var(--status-warning)';
                    return (
                      <>
                        {/* Match the PatientBanner's meta separator (bullet
                            glyph in neutral-300) so the drawer subrow reads
                            in the same rhythm as gender • age • DOB. */}
                        <span style={{ color: 'var(--neutral-300)' }}>{' • '}</span>
                        <span style={{ color, fontWeight: 500 }}>{label}</span>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {!readOnly && (
      <div className={styles.suggestSection}>
        <div className={styles.suggestRow}>
          <Icon name="custom:ai" size={14} color="var(--primary-300)" /> Suggested Actions
        </div>
        <div className={styles.suggestActions}>
          {gap.workflows?.length > 0 ? (() => {
            // Gaps added from the worklist carry the workflows picked at
            // creation; suggest only those, first one as the primary action.
            const noteOpen = !(status === 'Submitted' || status === 'Completed' || (status || '').startsWith('Closed'));
            const actions = [
              { key: 'Outreach', label: 'Add Outreach', onClick: () => onAddOutreach?.() },
              noteOpen && { key: 'Clinical Note', label: 'Add Note', onClick: () => (onOpenClinicalNote ? onOpenClinicalNote() : setShowClinicalNote(true)) },
              { key: 'Referral', label: 'Send Referral', onClick: () => onSendReferral?.() },
              { key: 'Task', label: 'Add Task', onClick: () => onAddTask?.() },
            ].filter(a => a && gap.workflows.includes(a.key));
            return actions.map((a, i) => (
              <Button key={a.key} variant={i === 0 ? 'solid' : 'soft'} onClick={a.onClick}>{a.label}</Button>
            ));
          })() : (
          <>
          {isCis ? (
            // CIS-CMB10 is outreach and care coordination (we don't give the
            // vaccines): reach the family, then book the vaccine visit, which
            // also sets the follow-up reminder. Nothing to book once every
            // dose is given.
            <>
              <Button onClick={() => onAddOutreach?.()}>Add Outreach</Button>
              <Button variant="soft" disabled={!onScheduleVaccine} onClick={() => onScheduleVaccine?.()}>Schedule Vaccine Reminder</Button>
            </>
          ) : (
            <>
              <Button onClick={() => onScheduleAppointment?.()}>Schedule with Specialist</Button>
              {/* Hide Add Note once the note has moved past the "start" state:
                  Submitted (pending review), Completed (signed), or any Closed
                  status. The Add Note suggested action is for kicking off the
                  flow; after review it would just create a duplicate. */}
              {!(status === 'Submitted' || status === 'Completed' || (status || '').startsWith('Closed')) && (
                <Button variant="soft" onClick={() => (onOpenClinicalNote ? onOpenClinicalNote() : setShowClinicalNote(true))}>Add Note</Button>
              )}
              <Button variant="soft" onClick={() => showToast('Add MRC Task: coming soon')}>Add MRC Task</Button>
              <Button variant="outline" onClick={() => onAddOutreach?.()}>Add Outreach</Button>
            </>
          )}
          </>
          )}
        </div>
      </div>
      )}
    </>
  );
}
