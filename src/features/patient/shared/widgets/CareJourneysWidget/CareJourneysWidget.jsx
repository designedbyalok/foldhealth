import { useState } from 'react';
import { ActionButton } from '../../../../../components/ActionButton/ActionButton';
import { Avatar } from '../../../../../components/Avatar/Avatar';
import { Badge } from '../../../../../components/Badge/Badge';
import { BadgeSelect } from '../../../../../components/BadgeSelect/BadgeSelect';
import { EmptyState } from '../../../../../components/EmptyState/EmptyState';
import { PanelSection, PanelSectionDivider, PanelSectionItem, PanelSectionMore } from '../../../../../components/PanelSection/PanelSection';
import styles from './CareJourneysWidget.module.css';

const JOURNEYS = [
  {
    id: 1,
    name: 'Wearable Journey',
    date: '11/18/2025',
    type: 'Fixed',
    progress: 0,
    total: 7,
    unit: 'Days',
    status: 'Assigned',
    badgeVariant: 'primary',
  },
  {
    id: 2,
    name: 'Hypertension Journey',
    date: '11/18/2025',
    type: 'Rolling',
    progress: 30,
    total: 180,
    unit: 'Days',
    status: 'Active',
    badgeVariant: 'success',
  },
  {
    id: 3,
    name: 'Wearable Journey',
    date: '11/18/2025',
    type: 'Fixed',
    progress: 1,
    total: 7,
    unit: 'Days',
    status: 'Stopped',
    badgeVariant: 'danger',
  },
  {
    id: 4,
    name: 'Social Education Journey',
    date: '11/18/2025',
    type: 'Rolling',
    progress: 1,
    total: 7,
    unit: 'Days',
    status: 'Paused',
    badgeVariant: 'warning',
  },
];

// "Completed Journeys" is a view of the same list rather than a separate page.
const VIEW_OPTIONS = ['Current', 'Completed', 'All'];
const PREVIEW_COUNT = 3;
const inView = (journey, view) => view === 'All' || (view === 'Completed') === (journey.status === 'Completed');

export function CareJourneysWidget() {
  const [view, setView] = useState('Current');
  const [expanded, setExpanded] = useState(false);

  const journeys = JOURNEYS.filter(j => inView(j, view));
  const shown = expanded ? journeys : journeys.slice(0, PREVIEW_COUNT);

  return (
    <PanelSection
      icon="solar:routing-2-linear"
      title="Care Journeys"
      actions={(
        <>
          <BadgeSelect
            label="View By"
            value={view}
            options={VIEW_OPTIONS}
            onChange={(v) => { setView(v); setExpanded(false); }}
          />
          <PanelSectionDivider />
          <ActionButton icon="solar:add-circle-linear" size="sm" tooltip="Add Care Journey" />
        </>
      )}
    >
      {journeys.length === 0 ? (
        <EmptyState icon="solar:routing-2-linear" title={`No ${view.toLowerCase()} care journeys`} size="sm" />
      ) : (
        <>
          {shown.map(j => {
            const pct = j.total > 0 ? (j.progress / j.total) * 100 : 0;
            return (
              <PanelSectionItem
                key={j.id}
                alignTop
                leading={<Avatar type="icon" variant="patient" iconName="solar:routing-2-linear" size="M" />}
                title={j.name}
                meta={[j.date, j.type]}
                trailing={<Badge tone={j.badgeVariant} label={j.status} />}
              >
                <div className={styles.progressRow}>
                  <div
                    className={styles.progressTrack}
                    role="progressbar"
                    aria-label={`${j.name} progress`}
                    aria-valuemin={0}
                    aria-valuemax={j.total}
                    aria-valuenow={j.progress}
                  >
                    <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={styles.progressLabel}>{j.progress}/{j.total} {j.unit}</span>
                </div>
              </PanelSectionItem>
            );
          })}
          <PanelSectionMore expanded={expanded} hiddenCount={journeys.length - PREVIEW_COUNT} onToggle={() => setExpanded(v => !v)} />
        </>
      )}
    </PanelSection>
  );
}
