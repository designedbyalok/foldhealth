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
import {
  CAMPAIGNS, DRAFTS, ENDED, SECTIONS_META, CHANNEL_ICONS, HEALTH_VARIANT, FILTER_DEFS, computeHealth, filterCampaigns,
} from './campaignData';
import styles from './CampaignView.module.css';

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
    return filterCampaigns(baseRows, filters);
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
