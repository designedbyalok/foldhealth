import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { Button } from '../../../../../../../../components/Button/Button';
import { ActionButton } from '../../../../../../../../components/ActionButton/ActionButton';
import { CardSkeleton } from '../../../../../../../../components/CardSkeleton/CardSkeleton';
import { Tabs } from '../../../../../../../../components/Tabs/Tabs';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import { secondsToTime } from '../../../../../../data/ccmBillingMock';
import { CcmBillingLogTable } from '../CcmBillingLogTable/CcmBillingLogTable.jsx';
import { CcmBillingReportDrawer } from '../CcmBillingReportDrawer/CcmBillingReportDrawer.jsx';
import styles from './CcmBillingReview.module.css';

const REPORT_MONTH_LABEL = (ym) => {
  if (!ym) return '';
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, 1))
    .toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

const REPORT_DATE_LABEL = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

const COMPLEXITY_LABEL = { high: 'High Complexity', moderate: 'Moderate Complexity' };
const COMPLEXITY_OPTIONS = [
  { value: 'high', label: 'High Complexity' },
  { value: 'moderate', label: 'Moderate Complexity' },
];

const YEAR_MONTH_LABEL = (ym) => {
  if (!ym) return '';
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, (m || 1) - 1, 1));
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

// Short-form month label for the ready-banner headline (e.g. "July").
const MONTH_SHORT = (ym) => {
  if (!ym) return '';
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, 1))
    .toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
};

// Auto-claim submission is the 5th of the *next* month. Rendered as e.g.
// "Aug 5" in the ready-banner.
const AUTO_CLAIM_DATE = (ym) => {
  if (!ym) return '';
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m || 0, 5))
    .toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
};

// Full auto-claim date for the summary alert, e.g. "Aug 5, 2026".
const AUTO_CLAIM_DATE_FULL = (ym) => {
  if (!ym) return '';
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m || 0, 5))
    .toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
};

// Compact duration for the summary card, e.g. "28m 30s".
const secondsToCompactDuration = (sec) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}m ${s}s`;
};

const BILLED_UNDER_LABEL = { high: 'Complex', moderate: 'Moderate' };

// Whether a `YYYY-MM` string matches the current wall-clock month. Drives
// the "Current" pill in the month pager.
const isCurrentMonth = (ym) => {
  if (!ym) return false;
  const now = new Date();
  return ym === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

// Formats an ISO timestamp as "MM/DD/YYYY, HH:MM AM/PM" to match the Figma.
const formatActivityTime = (iso) => {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${date}, ${time}`;
};

const TABS = ['Billable', 'Billing History'];

function ComplexityDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.complexityWrap}>
      <button
        type="button"
        className={styles.complexityBtn}
        onClick={() => setOpen(o => !o)}
      >
        {COMPLEXITY_LABEL[value] || 'Moderate Complexity'}
        <Icon name="solar:alt-arrow-down-linear" size={14} color="var(--primary-300)" />
      </button>
      {open && (
        <>
          <div className={styles.dropdownOverlay} onClick={() => setOpen(false)} />
          <div className={styles.complexityMenu} role="listbox">
            {COMPLEXITY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                className={`${styles.complexityOption} ${opt.value === value ? styles.complexityOptionActive : ''}`}
                onClick={() => { onChange?.(opt.value); setOpen(false); }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function ActivityRow({ activity }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = activity.description && activity.description.length > 160;
  return (
    <div className={styles.activityRow}>
      <span className={styles.activityBullet} aria-hidden="true" />
      <div className={styles.activityMain}>
        <div className={styles.activityHead}>
          <span className={styles.activityTitle}>{activity.activityType}</span>
          <span className={styles.activityDuration}>{secondsToTime(activity.durationSeconds)} mins</span>
        </div>
        <div className={styles.activityMeta}>
          {formatActivityTime(activity.occurredAt)} <span className={styles.metaDot}>•</span>{' '}
          <span className={styles.metaAuthor}>{activity.loggedBy} (You)</span>
        </div>
        <p className={`${styles.activityDesc} ${!expanded && isLong ? styles.activityDescClamped : ''}`}>
          {activity.description}
        </p>
        {isLong && (
          <button
            type="button"
            className={styles.showMoreBtn}
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? 'Show Less' : 'Show More'}
          </button>
        )}
      </div>
    </div>
  );
}

export function CcmBillingReview({ program, patientId: patientIdProp }) {
  // Allow callers (e.g. the CCM worklist's Billable Mins drawer) to pass an
  // explicit patientId; falls back to the routed patient when omitted.
  const selectedPatientId = useAppStore(s => s.selectedPatientId);
  const patientId = patientIdProp || selectedPatientId;
  const periods = useAppStore(s => s.ccmBillingPeriodsByPatient[patientId]);
  const activities = useAppStore(s => s.ccmBillableActivitiesByPatient[patientId]);
  const reports = useAppStore(s => s.ccmBillingReportsByPatient[patientId]);
  const loading = useAppStore(s => s.ccmBillingLoadingByPatient[patientId]);
  const fetchCcmBilling = useAppStore(s => s.fetchCcmBilling);
  const fetchCcmBillingReports = useAppStore(s => s.fetchCcmBillingReports);

  const [activeTab, setActiveTab] = useState('Billable');
  const [complexity, setComplexity] = useState('high');
  const [openReport, setOpenReport] = useState(null);

  useEffect(() => {
    if (!patientId) return;
    if (periods == null) fetchCcmBilling(patientId);
    if (reports == null) fetchCcmBillingReports(patientId);
  }, [patientId, periods, reports, fetchCcmBilling, fetchCcmBillingReports]);

  const currentPeriod = useMemo(() => (periods && periods[0]) || null, [periods]);
  useEffect(() => {
    if (currentPeriod?.complexity) setComplexity(currentPeriod.complexity);
  }, [currentPeriod]);

  const periodActivities = useMemo(() => {
    if (!activities) return [];
    if (!currentPeriod) return activities;
    return activities.filter(a => a.periodId === currentPeriod.id);
  }, [activities, currentPeriod]);

  const totalSeconds = useMemo(
    () => periodActivities.reduce((sum, a) => sum + (a.durationSeconds || 0), 0),
    [periodActivities],
  );
  // Required minutes lives on the period row. Complexity is a display
  // classifier: the CPT threshold is set by the operator, not derived here.
  const requiredMinutes = currentPeriod?.requiredMinutes ?? 20;
  const requiredSeconds = requiredMinutes * 60;
  const overshoot = totalSeconds - requiredSeconds;
  const isReady = overshoot >= 0;

  if (loading && periodActivities.length === 0) {
    return (
      <div className={styles.wrap}>
        <div className={styles.body}>
          <div className={styles.cardSkeleton}><CardSkeleton /></div>
          <div className={styles.cardSkeleton}><CardSkeleton /></div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {/* Sub-tabs: shared TabStrip so the Billable/Billing History switch
          reads identically to every other tab surface (sliding underline,
          hairline divider, same typography). */}
      <Tabs
        items={TABS.map(t => ({ key: t, label: t }))}
        value={activeTab}
        onValueChange={setActiveTab}
        fullWidth={false}
      />

      {/* Info banner: surfaces the auto-claim date when the month is ready
          to bill. Only shows on the Billable tab, on the current period,
          when the threshold is met. */}
      {activeTab === 'Billable' && currentPeriod && isReady && (
        <button type="button" className={styles.readyBanner}>
          <Icon name="solar:lightbulb-minimalistic-linear" size={16} color="var(--primary-300)" />
          <span className={styles.readyBannerText}>
            <strong>{MONTH_SHORT(currentPeriod.yearMonth)}</strong>
            {' billable time is ready for review. Claims will be auto-generated on '}
            <strong>{AUTO_CLAIM_DATE(currentPeriod.yearMonth)}</strong>.
          </span>
          <Icon name="solar:alt-arrow-right-linear" size={14} color="var(--neutral-300)" />
        </button>
      )}

      <div className={styles.body}>
      {activeTab === 'Billable' ? (
        <>
          {/* Toolbar: month pager on the left, complexity pill on the right.
              Prev/Next are placeholders in stage 2; the pager becomes
              functional once server-side month scoping lands (stage 3+). */}
          <div className={styles.toolbar}>
            <div className={styles.monthPager}>
              <button
                type="button"
                className={styles.pagerBtn}
                aria-label="Previous month"
                onClick={() => {/* stage 3+ */}}
              >
                <Icon name="solar:alt-arrow-left-linear" size={12} color="var(--neutral-300)" />
              </button>
              <span className={styles.pagerMonth}>{YEAR_MONTH_LABEL(currentPeriod?.yearMonth) || 'This Month'}</span>
              {currentPeriod && isCurrentMonth(currentPeriod.yearMonth) && (
                <span className={styles.pagerCurrent}>Current</span>
              )}
              <button
                type="button"
                className={styles.pagerBtn}
                aria-label="Next month"
                onClick={() => {/* stage 3+ */}}
              >
                <Icon name="solar:alt-arrow-right-linear" size={12} color="var(--neutral-300)" />
              </button>
            </div>
            <ComplexityDropdown value={complexity} onChange={setComplexity} />
          </div>

          {/* Summary card: billable time + billed-under row, with an inline
              alert when the month is ready (Figma 583:38719). */}
          <div className={styles.summaryCard}>
            <div className={styles.summaryBody}>
              <div className={styles.summaryLeft}>
                <span className={styles.summaryLabel}>Billable Time:</span>
                <span className={styles.summaryValue}>{secondsToCompactDuration(totalSeconds)}</span>
                {isReady ? (
                  <span className={styles.summaryStatusOk}>
                    ✓ Requirement met (+{secondsToCompactDuration(overshoot)})
                  </span>
                ) : (
                  <span className={styles.summaryStatusShort}>
                    Requirement not met (−{secondsToCompactDuration(Math.abs(overshoot))})
                  </span>
                )}
              </div>
              <div className={styles.summaryRight}>
                <span className={styles.summaryLabel}>Billed Under:</span>
                <span className={styles.summaryValue}>
                  {BILLED_UNDER_LABEL[complexity] || 'Moderate'}
                </span>
              </div>
            </div>
            {isReady && currentPeriod && (
              <div className={styles.summaryAlert}>
                <Icon name="solar:info-circle-linear" size={16} color="var(--neutral-300)" />
                <span>
                  Scheduled to be sent for billing on {AUTO_CLAIM_DATE_FULL(currentPeriod.yearMonth)}.
                </span>
              </div>
            )}
          </div>

          <CcmBillingLogTable
            patientId={patientId}
            periodId={currentPeriod?.id}
            activities={periodActivities}
          />
        </>
      ) : (
        <div className={styles.historyTableWrap}>
          {(reports || []).length === 0 ? (
            <div className={styles.empty}>
              <Icon name="solar:history-linear" size={36} color="var(--neutral-200)" />
              <span>Billing history will appear here once claims are sent.</span>
            </div>
          ) : (
            <table className={styles.historyTable}>
              <thead>
                <tr>
                  <th>Monthly Report</th>
                  <th>Est. Billing Amount</th>
                  <th>Total Time Spent</th>
                  <th>Integrated EHR</th>
                  <th className={styles.historyActionHead}>Action</th>
                </tr>
              </thead>
              <tbody>
                {(reports || []).map(r => (
                  <tr key={r.id}>
                    <td>
                      <div className={styles.historyName}>
                        Billing Report #{r.reportNumber} - {REPORT_MONTH_LABEL(r.yearMonth)}
                      </div>
                      <div className={styles.historySub}>Generated on: {REPORT_DATE_LABEL(r.generatedAt)}</div>
                    </td>
                    <td className={styles.historyAmount}>
                      ${r.estBillingAmount.toFixed(2)}
                    </td>
                    <td>
                      <span className={styles.historyTime}>
                        <Icon name="solar:clock-circle-linear" size={14} color="var(--status-success)" />
                        {secondsToTime(r.totalSeconds)} min
                      </span>
                    </td>
                    <td className={styles.historyEhr}>{r.integratedEhr}</td>
                    <td>
                      <div className={styles.historyActions}>
                        <Button variant="soft" size="sm" onClick={() => setOpenReport(r)}>
                          View
                        </Button>
                        <ActionButton
                          icon="solar:printer-linear"
                          size="sm"
                          tooltip="Print"
                          onClick={() => setOpenReport(r)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      </div>

      {openReport && (
        <CcmBillingReportDrawer report={openReport} onClose={() => setOpenReport(null)} />
      )}

    </div>
  );
}
