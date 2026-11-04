import { useState, useMemo, useEffect, Fragment } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { Button } from '../../components/Button/Button';
import { Badge } from '../../components/Badge/Badge';
import { Switch } from '../../components/Switch/Switch';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { TopBar } from '../../components/TopBar/TopBar';
import { SectionTitleBar } from '../../components/SectionTitleBar/SectionTitleBar';
import { FilterBar } from '../worklists/FilterBar';
import { Pagination } from '../../components/Pagination/Pagination';
import { HeaderCell } from '../../components/HeaderCell/HeaderCell';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { SimpleTableSkeleton } from '../../components/SimpleTableSkeleton/SimpleTableSkeleton';
import { useAppStore } from '../../store/useAppStore';
import styles from './CampaignView.module.css';

// ── Static data ───────────────────────────────────────────────────────────────

const CAMPAIGNS = [
  {
    id: 1, section: 'running',
    channel: 'email', name: 'Resilient Recoveries',
    description: 'A support campaign focused on helping patients recover from injuries or surgeries with personalized care plans.',
    audience: 644, dynamic: true,
    health: 'Good', delivered: 32, opened: 18,
    startDate: '09/07/2024', duration: 15, progress: 40, enabled: true,
  },
  {
    id: 2, section: 'running',
    channel: 'email', name: 'Healthy Moms, Happy Babies',
    description: 'A maternal health initiative providing resources and support for expecting and new mothers.',
    audience: 80, dynamic: false,
    health: 'Moderate', delivered: 56, opened: 49,
    startDate: '09/23/2024', duration: 9, progress: 60, enabled: true,
  },
  {
    id: 3, section: 'paused',
    channel: 'email', name: 'Fit for Life',
    description: 'A wellness program promoting fitness, balanced nutrition, and sustainable healthy lifestyle habits.',
    audience: 916, dynamic: false,
    health: 'Good', delivered: 57, opened: 43,
    startDate: '08/29/2024', duration: 1, progress: 60, enabled: false,
  },
  {
    id: 4, section: 'paused',
    channel: 'email', name: 'Skin Care Savvy',
    description: 'Educational campaign raising awareness about skincare routines and dermatological health.',
    audience: 43, dynamic: false,
    health: 'Good', delivered: 64, opened: 59,
    startDate: '09/19/2024', duration: 1, progress: 70, enabled: false,
  },
  {
    id: 5, section: 'scheduled',
    channel: 'email', name: 'Mind Over Matter',
    description: 'A mental wellness campaign offering mindfulness, stress management, and emotional resilience tools.',
    audience: 191, dynamic: false,
    health: null, delivered: null, opened: null,
    startDate: '09/01/2024', duration: 7, progress: 0, executesIn: 5, enabled: false,
  },
  {
    id: 6, section: 'scheduled',
    channel: 'email', name: 'Resilient Recoveries',
    description: 'A pediatric health campaign encouraging healthy eating, physical activity, and overall child wellness.',
    audience: 830, dynamic: true,
    health: null, delivered: null, opened: null,
    startDate: '09/05/2024', duration: 11, progress: 0, executesIn: 5, enabled: false,
  },
  {
    id: 7, section: 'scheduled',
    channel: 'sms', name: 'Healthy Habits for Kids',
    description: 'A support network campaign providing guidance and emotional support to cancer patients and families.',
    audience: 433, dynamic: false,
    health: null, delivered: null, opened: null,
    startDate: '09/11/2024', duration: 12, progress: 0, executesIn: 5, enabled: false,
  },
  {
    id: 8, section: 'scheduled',
    channel: 'email', name: 'Cancer Companions',
    description: 'A long-term initiative focused on managing chronic illnesses with proactive care and patient education.',
    audience: 529, dynamic: false,
    health: null, delivered: null, opened: null,
    startDate: '09/16/2024', duration: 20, progress: 0, executesIn: 5, enabled: false,
  },
  {
    id: 9, section: 'scheduled',
    channel: 'email', name: 'Chronic Care Campaign',
    description: 'A location-specific campaign targeting patient engagement for the Rosewood clinic region.',
    audience: 396, dynamic: false,
    health: null, delivered: null, opened: null,
    startDate: '09/26/2024', duration: 21, progress: 0, executesIn: 5, enabled: false,
  },
  {
    id: 10, section: 'scheduled',
    channel: 'voice', name: 'Rome Office Patients',
    description: 'An annual seminar covering the latest advancements in health and wellness practices.',
    audience: 7, dynamic: false,
    health: null, delivered: null, opened: null,
    startDate: '09/27/2024', duration: 7, progress: 0, executesIn: 5, enabled: false,
  },
  {
    id: 11, section: 'scheduled',
    channel: 'email', name: 'Health & Wellness Seminar 2025',
    description: 'Helping patients recover from injuries or surgeries with personalized care plans.',
    audience: 795, dynamic: false,
    health: null, delivered: null, opened: null,
    startDate: '08/28/2024', duration: 19, progress: 0, executesIn: 5, enabled: false,
  },
];

const DRAFTS = [
  {
    id: 20, section: 'draft',
    channel: 'email', name: 'Q3 Diabetic Outreach',
    description: 'Reaching out to patients with HbA1c > 9 over the past 90 days with targeted education resources.',
    audience: 312, dynamic: false,
    health: null, delivered: null, opened: null,
    startDate: null, duration: null, progress: 0, enabled: false,
  },
  {
    id: 21, section: 'draft',
    channel: 'sms', name: 'Fall Prevention Program',
    description: 'A preventive campaign for elderly patients focused on balance training and home safety.',
    audience: 158, dynamic: false,
    health: null, delivered: null, opened: null,
    startDate: null, duration: null, progress: 0, enabled: false,
  },
];

const ENDED = [
  {
    id: 30, section: 'ended',
    channel: 'email', name: 'Annual Flu Vaccine Drive',
    description: 'Annual influenza vaccination outreach targeting all eligible patients in the practice.',
    audience: 1402, dynamic: false,
    health: 'Good', delivered: 78, opened: 61,
    startDate: '10/01/2023', duration: 30, progress: 100, enabled: false,
  },
  {
    id: 31, section: 'ended',
    channel: 'email', name: 'COVID-19 Booster Reminder',
    description: 'Reminder campaign for eligible patients to schedule their COVID-19 booster shots.',
    audience: 892, dynamic: false,
    health: 'Moderate', delivered: 54, opened: 38,
    startDate: '11/15/2023', duration: 14, progress: 100, enabled: false,
  },
];

const SECTIONS_META = {
  running:   { label: 'Currently Running', dotColor: 'var(--status-success)' },
  paused:    { label: 'Paused',            icon: 'solar:pause-circle-linear',  color: 'var(--neutral-300)' },
  scheduled: { label: 'Scheduled',         icon: 'solar:clock-circle-linear',  color: 'var(--neutral-200)' },
  draft:     { label: 'Drafts',            icon: 'solar:document-text-linear', color: 'var(--neutral-300)' },
  ended:     { label: 'Ended',             icon: 'solar:check-circle-linear',  color: 'var(--neutral-300)' },
};

const CHANNEL_ICONS = {
  email: 'solar:letter-linear',
  sms:   'solar:chat-round-line-linear',
  voice: 'solar:phone-linear',
};

const HEALTH_VARIANT = {
  Good:     'success',
  Moderate: 'warning',
  Poor:     'warning',
};

// `primary: true` → chip renders by default in the shared FilterBar.
const FILTER_DEFS = [
  { key: 'section', label: 'Status', primary: true, options: [
    { value: 'running',   label: 'Currently Running' },
    { value: 'paused',    label: 'Paused' },
    { value: 'scheduled', label: 'Scheduled' },
  ]},
  { key: 'channel', primary: true, label: 'Channel', options: [
    { value: 'email', label: 'Email' },
    { value: 'sms',   label: 'SMS' },
    { value: 'voice', label: 'Voice' },
  ]},
  { key: 'health', primary: true, label: 'Health', options: [
    { value: 'Good',     label: 'Good' },
    { value: 'Moderate', label: 'Moderate' },
    { value: 'Poor',     label: 'Poor' },
  ]},
  { key: 'audienceType', primary: true, label: 'Audience Type', options: [
    { value: 'dynamic', label: 'Dynamic' },
    { value: 'static',  label: 'Static' },
  ]},
  { key: 'audienceSize', primary: true, label: 'Audience Size', options: [
    { value: 'small',  label: 'Under 100' },
    { value: 'medium', label: '100 – 500' },
    { value: 'large',  label: '500+' },
  ]},
  { key: 'duration', primary: true, label: 'Duration', options: [
    { value: 'short',  label: '< 7 Days' },
    { value: 'medium', label: '7 – 14 Days' },
    { value: 'long',   label: '> 14 Days' },
  ]},
];

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusIcon({ section }) {
  if (section === 'running') return <span className={styles.runningDot} />;
  if (section === 'paused')    return <Icon name="solar:pause-circle-linear"  size={16} color="var(--neutral-300)" />;
  if (section === 'scheduled') return <Icon name="solar:clock-circle-linear"  size={16} color="var(--neutral-200)" />;
  if (section === 'draft')     return <Icon name="solar:document-text-linear" size={16} color="var(--neutral-200)" />;
  return <Icon name="solar:check-circle-linear" size={16} color="var(--neutral-200)" />;
}

function ProgressBar({ progress, section }) {
  const fillColor =
    section === 'running' ? 'var(--status-success)' :
    section === 'paused'  ? 'var(--neutral-150)'    : 'transparent';
  return (
    <div className={styles.progressWrap}>
      <div className={styles.progressTrack}>
        {progress > 0 && (
          <div className={styles.progressFill} style={{ width: `${progress}%`, background: fillColor }} />
        )}
      </div>
      <span className={styles.progressPct}>{Math.round(progress)}%</span>
    </div>
  );
}

function SectionHeader({ sectionKey, count }) {
  const s = SECTIONS_META[sectionKey];
  return (
    <tr className={styles.sectionRow}>
      <td colSpan={10} className={styles.sectionCell}>
        <div className={styles.sectionInner}>
          <span className={styles.sectionLabel} style={{ color: s.dotColor || s.color }}>
            {s.label}
          </span>
          <span className={styles.sectionCount}>{count}</span>
        </div>
      </td>
    </tr>
  );
}

function computeHealth(delivered, opened) {
  if (delivered == null || opened == null) return null;
  const gap = delivered - opened;
  if (gap <= 10) return 'Good';
  if (gap <= 20) return 'Moderate';
  return 'Poor';
}

function CampaignRow({ campaign, onToggle }) {
  const showToast = useAppStore(s => s.showToast);
  const openCampaignBuilder = useAppStore(s => s.openCampaignBuilder);
  const isActive = campaign.section !== 'ended' && campaign.section !== 'draft';
  const isScheduled = campaign.section === 'scheduled';
  const health = computeHealth(campaign.delivered, campaign.opened);

  return (
    <tr className={styles.row}>
      {/* 1. S: status */}
      <td className={styles.tdS}>
        <StatusIcon section={campaign.section} />
      </td>

      {/* 2. Campaign Name (single line, clickable) */}
      <td className={styles.tdName}>
        <button type="button" className={styles.nameLink} onClick={() => openCampaignBuilder(campaign)}>
          <Icon name={CHANNEL_ICONS[campaign.channel] || 'solar:letter-linear'} size={15} color="var(--neutral-300)" />
          <span className={styles.nameText}>{campaign.name}</span>
        </button>
      </td>

      {/* 3. Audience */}
      <td className={styles.tdAudience}>
        <div className={styles.audienceCell}>
          <span className={styles.audienceNum}>{campaign.audience.toLocaleString()}</span>
          {campaign.dynamic && <Icon name="solar:bolt-linear" size={13} color="var(--neutral-200)" />}
        </div>
      </td>

      {/* 4. Execution Progress */}
      <td className={styles.tdProgress}>
        {isScheduled ? (
          <span className={styles.execLabel}>Executes in {campaign.executesIn} Days</span>
        ) : campaign.section === 'draft' ? (
          <span className={styles.dash}>-</span>
        ) : (
          <ProgressBar progress={campaign.progress} section={campaign.section} />
        )}
      </td>

      {/* 5. Delivered */}
      <td className={styles.tdMetric}>
        <span className={styles.metricNum}>
          {campaign.delivered != null ? `${Math.round(campaign.delivered)}%` : '-'}
        </span>
      </td>

      {/* 6. Opened */}
      <td className={styles.tdMetric}>
        <span className={styles.metricNum}>
          {campaign.opened != null ? `${Math.round(campaign.opened)}%` : '-'}
        </span>
      </td>

      {/* 7. Health (derived from delivered/opened gap) */}
      <td className={styles.tdHealth}>
        {health
          ? <Badge tone={HEALTH_VARIANT[health]} label={health} />
          : <span className={styles.dash}>-</span>
        }
      </td>

      {/* 8. Start Date */}
      <td className={styles.tdDate}>
        <span className={styles.cellText}>{campaign.startDate || '-'}</span>
      </td>

      {/* 9. Duration */}
      <td className={styles.tdDuration}>
        <span className={styles.cellText}>{campaign.duration != null ? `${campaign.duration} Days` : '-'}</span>
      </td>

      {/* 10. Action */}
      <td className={styles.tdAction}>
        <div className={styles.actionCell}>
          {isActive && (
            <>
              <Switch
                checked={campaign.enabled}
                onChange={() => onToggle(campaign.id)}
                ariaLabel="Enable campaign"
              />
              <div className={styles.vDivider} />
            </>
          )}
          <ActionButton
            icon="solar:pen-linear"
            size="sm"
            tooltip="Edit"
            onClick={() => openCampaignBuilder(campaign)}
          />
          <div className={styles.vDivider} />
          <ActionButton
            icon="solar:chart-linear"
            size="sm"
            tooltip="Analytics"
            onClick={() => showToast('Analytics – coming soon')}
          />
          <div className={styles.vDivider} />
          <ActionButton
            icon="solar:menu-dots-linear"
            size="sm"
            tooltip="More"
            onClick={() => showToast('More – coming soon')}
          />
        </div>
      </td>
    </tr>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function CampaignView() {
  const showToast = useAppStore(s => s.showToast);
  const activeTab = useAppStore(s => s.campaignTab);
  const setActiveTab = useAppStore(s => s.setCampaignTab);
  const storeCampaigns = useAppStore(s => s.campaigns);
  const campaignsLoading = useAppStore(s => s.campaignsLoading);
  const fetchCampaigns = useAppStore(s => s.fetchCampaigns);
  const openCampaignBuilder = useAppStore(s => s.openCampaignBuilder);
  const campaignBuilderSaving = useAppStore(s => s.campaignBuilderSaving);

  const usingSupa = Array.isArray(storeCampaigns) && storeCampaigns.length > 0;
  const [localData, setLocalData] = useState(CAMPAIGNS);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  useEffect(() => { fetchCampaigns?.(); }, [fetchCampaigns]);

  const campaignData = usingSupa ? storeCampaigns : localData;

  const handleToggle = (id) => {
    if (usingSupa) return;
    setLocalData(prev => prev.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c));
  };

  // Live tick: gradually advance progress/delivered/opened on running, enabled campaigns.
  useEffect(() => {
    if (usingSupa) return;
    const id = setInterval(() => {
      setLocalData(prev => prev.map(c => {
        if (c.section !== 'running' || !c.enabled) return c;
        const nextProgress = Math.min(100, c.progress + 0.4);
        const deliveredCap = nextProgress;
        const nextDelivered = Math.min(deliveredCap, c.delivered + 0.3);
        const openedCap = nextDelivered;
        const nextOpened = Math.min(openedCap, c.opened + 0.22);
        return { ...c, progress: nextProgress, delivered: nextDelivered, opened: nextOpened };
      }));
    }, 1500);
    return () => clearInterval(id);
  }, [usingSupa]);

  const handleFilterChange = (key, val) => {
    setPage(1);
    setFilters(f => {
      const next = { ...f };
      if (val) next[key] = val; else delete next[key];
      return next;
    });
  };
  const handleClearFilters = () => { setPage(1); setFilters({}); };

  const baseRows = useMemo(() => {
    if (activeTab === 'drafts') return usingSupa ? campaignData.filter(c => c.section === 'draft') : DRAFTS;
    if (activeTab === 'ended')  return usingSupa ? campaignData.filter(c => c.section === 'ended') : ENDED;
    return usingSupa ? campaignData.filter(c => c.section !== 'draft' && c.section !== 'ended') : campaignData;
  }, [activeTab, campaignData, usingSupa]);

  const filteredRows = useMemo(() => {
    let rows = baseRows;
    if (filters.section) rows = rows.filter(c => c.section === filters.section);
    if (filters.channel) rows = rows.filter(c => c.channel === filters.channel);
    if (filters.health)  rows = rows.filter(c => computeHealth(c.delivered, c.opened) === filters.health);
    if (filters.audienceType) {
      rows = rows.filter(c => filters.audienceType === 'dynamic' ? c.dynamic : !c.dynamic);
    }
    if (filters.audienceSize) {
      rows = rows.filter(c => {
        if (filters.audienceSize === 'small')  return c.audience < 100;
        if (filters.audienceSize === 'medium') return c.audience >= 100 && c.audience <= 500;
        return c.audience > 500;
      });
    }
    if (filters.duration) {
      rows = rows.filter(c => {
        if (c.duration == null) return false;
        if (filters.duration === 'short')  return c.duration < 7;
        if (filters.duration === 'medium') return c.duration >= 7 && c.duration <= 14;
        return c.duration > 14;
      });
    }
    return rows;
  }, [baseRows, filters]);

  const totalRows = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / perPage));
  const safePage = Math.min(page, totalPages);

  const sections = useMemo(() => {
    const paginated = filteredRows.slice((safePage - 1) * perPage, safePage * perPage);
    if (activeTab === 'drafts') return [{ key: 'draft',   rows: paginated }];
    if (activeTab === 'ended')  return [{ key: 'ended',   rows: paginated }];
    const running   = paginated.filter(c => c.section === 'running');
    const paused    = paginated.filter(c => c.section === 'paused');
    const scheduled = paginated.filter(c => c.section === 'scheduled');
    return [
      ...(running.length   ? [{ key: 'running',   rows: running }]   : []),
      ...(paused.length    ? [{ key: 'paused',     rows: paused }]    : []),
      ...(scheduled.length ? [{ key: 'scheduled',  rows: scheduled }] : []),
    ];
  }, [activeTab, filteredRows, safePage, perPage]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className={styles.page}>
      <TopBar />

      <SectionTitleBar
        tabs={[
          { key: 'active', label: 'Active' },
          { key: 'drafts', label: 'Drafts' },
          { key: 'ended',  label: 'Ended' },
        ]}
        activeTab={activeTab}
        onTabChange={(tab) => { setPage(1); setActiveTab(tab); }}
        actions={['filter']}
        filterActive={showFilters}
        filterBadgeCount={activeFilterCount}
        onFilter={() => setShowFilters(v => !v)}
        primaryActionLabel={campaignBuilderSaving ? 'Creating…' : 'New Campaign'}
        primaryActionDisabled={campaignBuilderSaving}
        onPrimaryAction={() => openCampaignBuilder(null)}
      />

      {/* Filter bar */}
      {showFilters && (
        <FilterBar
          leading={null}
          filterDefs={FILTER_DEFS}
          filters={filters}
          onFilterChange={handleFilterChange}
          onClearAll={handleClearFilters}
          getOptions={(def) => def.options || []}
          showMoreFilters={false}
          showSaveFilter={false}
        />
      )}

      {/* Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <colgroup>
            <col className={styles.colS} />
            <col className={styles.colName} />
            <col className={styles.colAudience} />
            <col className={styles.colProgress} />
            <col className={styles.colMetric} />
            <col className={styles.colMetric} />
            <col className={styles.colHealth} />
            <col className={styles.colDate} />
            <col className={styles.colDuration} />
            <col className={styles.colAction} />
          </colgroup>
          <thead>
            <tr className={styles.headerRow}>
              <HeaderCell label="S" align="center" />
              <HeaderCell label="Campaign Name" />
              <HeaderCell label="Audience" />
              <HeaderCell label="Execution Progress" />
              <HeaderCell label="Delivered" />
              <HeaderCell label="Opened" />
              <HeaderCell label="Health" />
              <HeaderCell label="Start Date" />
              <HeaderCell label="Duration" />
              <HeaderCell label="Action" />
            </tr>
          </thead>
          <tbody>
            {campaignsLoading && !usingSupa ? (
              <tr>
                <td colSpan={10} style={{ padding: 0 }}>
                  <SimpleTableSkeleton rows={6} cols={10} />
                </td>
              </tr>
            ) : sections.length === 0 ? (
              <tr>
                <td colSpan={10}>
                  <EmptyState icon="solar:filter-linear" title="No campaigns match your filters" />
                </td>
              </tr>
            ) : (
              sections.map(({ key, rows }) => (
                <Fragment key={key}>
                  <SectionHeader sectionKey={key} count={rows.length} />
                  {rows.map(c => (
                    <CampaignRow key={c.id} campaign={c} onToggle={handleToggle} />
                  ))}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className={styles.footer}>
        <Pagination
          totalItems={totalRows}
          totalCount={baseRows.length}
          filtered={Object.keys(filters).length > 0}
          currentPage={safePage}
          perPage={perPage}
          onPageChange={setPage}
          onPerPageChange={setPerPage}
        />
      </div>
    </div>
  );
}
