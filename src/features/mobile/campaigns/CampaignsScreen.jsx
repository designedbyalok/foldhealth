import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../../components/Badge/Badge';
import { BottomSheet } from '../../../components/BottomSheet/BottomSheet';
import { DesktopOnlyNote } from '../../../components/DesktopOnlyNote/DesktopOnlyNote';
import { FilterChip } from '../../../components/FilterChip/FilterChip';
import { Icon } from '../../../components/Icon/Icon';
import { SegmentedControl } from '../../../components/SegmentedControl/SegmentedControl';
import { Switch } from '../../../components/Switch/Switch';
import { useAppStore } from '../../../store/useAppStore';
import {
  CAMPAIGNS, CHANNEL_ICONS, DRAFTS, ENDED, FILTER_DEFS, HEALTH_VARIANT, SECTIONS_META, computeHealth, filterCampaigns,
} from '../../campaign/campaignData';
import { MobileSubHeader } from '../MobileHeader';
import { MobileEmpty, MobileListSkeleton } from '../MobileParts';
import { GroupedRow, GroupedSection } from '../more/GroupedList';
import common from '../mobile.module.css';
import more from '../more/more.module.css';
import styles from './CampaignsScreen.module.css';

const TABS = [
  { key: 'active', label: 'Active' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'ended', label: 'Ended' },
];
const pct = (v) => (v != null ? `${Math.round(v)}%` : '-');

/**
 * Campaigns (desktop CampaignView): Active / Drafts / Ended, the same filters
 * and health rule, and the per-campaign on/off switch. Building and editing
 * a campaign stays on a computer.
 */
export function CampaignsScreen() {
  const [activeTab, setActiveTab] = useState('active');
  const storeCampaigns = useAppStore(s => s.campaigns);
  const loading = useAppStore(s => s.campaignsLoading);
  const fetchCampaigns = useAppStore(s => s.fetchCampaigns);
  const usingSupa = Array.isArray(storeCampaigns) && storeCampaigns.length > 0;
  // Same local rows and toggle as desktop until campaigns load from Supabase.
  const [localData, setLocalData] = useState(CAMPAIGNS);
  const [filters, setFilters] = useState({});
  const [openId, setOpenId] = useState(null);

  useEffect(() => { fetchCampaigns?.(); }, [fetchCampaigns]);

  const campaignData = usingSupa ? storeCampaigns : localData;
  const toggle = (id) => {
    if (usingSupa) return;
    setLocalData(prev => prev.map(c => (c.id === id ? { ...c, enabled: !c.enabled } : c)));
  };

  const baseRows = useMemo(() => {
    if (activeTab === 'drafts') return usingSupa ? campaignData.filter(c => c.section === 'draft') : DRAFTS;
    if (activeTab === 'ended') return usingSupa ? campaignData.filter(c => c.section === 'ended') : ENDED;
    return usingSupa ? campaignData.filter(c => c.section !== 'draft' && c.section !== 'ended') : campaignData;
  }, [activeTab, campaignData, usingSupa]);
  const rows = useMemo(() => filterCampaigns(baseRows, filters), [baseRows, filters]);
  const sections = useMemo(() => {
    const keys = activeTab === 'drafts' ? ['draft'] : activeTab === 'ended' ? ['ended'] : ['running', 'paused', 'scheduled'];
    return keys.map(key => ({ key, rows: rows.filter(c => c.section === key) })).filter(s => s.rows.length);
  }, [activeTab, rows]);

  const setFilter = (key, value) => setFilters(f => {
    const next = { ...f };
    if (value) next[key] = value; else delete next[key];
    return next;
  });
  const opened = openId != null ? campaignData.concat(DRAFTS, ENDED).find(c => c.id === openId) : null;

  return (
    <div className={common.screen}>
      <MobileSubHeader title="Campaigns" />
      <div className={more.toolbar}>
        <SegmentedControl size="lg" fullWidth aria-label="Campaign status" items={TABS} value={activeTab} onValueChange={setActiveTab} />
        <div className={more.chips}>
          {FILTER_DEFS.map(def => {
            const current = def.options.find(o => o.value === filters[def.key]);
            return (
              <FilterChip
                key={def.key}
                label={def.label}
                options={def.options.map(o => o.label)}
                selected={current ? [current.label] : []}
                onChange={(labels) => setFilter(def.key, def.options.find(o => o.label === labels[labels.length - 1])?.value)}
                singleSelect
              />
            );
          })}
        </div>
      </div>
      <div className={common.body}>
        {loading && !usingSupa ? <MobileListSkeleton height={96} /> : sections.length === 0 ? (
          <MobileEmpty icon="solar:filter-linear" title="No campaigns match your filters" />
        ) : (
          <div className={more.stack}>
            {sections.map(s => (
              <GroupedSection key={s.key} label={`${SECTIONS_META[s.key].label} · ${s.rows.length}`}>
                {s.rows.map(c => (
                  <CampaignRow key={c.id} campaign={c} usingSupa={usingSupa} onToggle={() => toggle(c.id)} onOpen={() => setOpenId(c.id)} />
                ))}
              </GroupedSection>
            ))}
            <DesktopOnlyNote description="Create a campaign or edit its audience, content and schedule in Campaigns on a computer." />
          </div>
        )}
      </div>
      {opened && <CampaignSheet campaign={opened} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function progressLine(c) {
  if (c.section === 'scheduled') return `Executes in ${c.executesIn ?? '-'} Days`;
  if (c.section === 'draft') return 'Draft';
  return `${Math.round(c.progress || 0)}% sent`;
}

function CampaignRow({ campaign: c, usingSupa, onToggle, onOpen }) {
  const health = computeHealth(c.delivered, c.opened);
  const canToggle = c.section !== 'ended' && c.section !== 'draft';
  return (
    <div className={styles.row}>
      <button type="button" className={styles.rowMain} onClick={onOpen}>
        <span className={styles.channel}><Icon name={CHANNEL_ICONS[c.channel] || 'solar:letter-linear'} size={24} color="currentColor" /></span>
        <span className={styles.text}>
          <span className={styles.name}>{c.name}</span>
          <span className={styles.meta}>
            {(c.audience ?? 0).toLocaleString()} members{c.dynamic ? ' · Dynamic' : ''} · {progressLine(c)}
          </span>
          {health && <span className={styles.badges}><Badge tone={HEALTH_VARIANT[health]} label={health} /></span>}
        </span>
      </button>
      {canToggle && (
        <span className={styles.switch}>
          <Switch
            checked={!!c.enabled}
            onChange={onToggle}
            disabled={usingSupa}
            ariaLabel={c.enabled ? `Pause ${c.name}` : `Resume ${c.name}`}
          />
        </span>
      )}
    </div>
  );
}

function CampaignSheet({ campaign: c, onClose }) {
  const health = computeHealth(c.delivered, c.opened);
  return (
    <BottomSheet title={c.name} onClose={onClose}>
      <div className={styles.sheet}>
        {c.description && <p className={styles.description}>{c.description}</p>}
        <div className={styles.stats}>
          <Stat label="Delivered" value={pct(c.delivered)} />
          <Stat label="Opened" value={pct(c.opened)} />
          <Stat label="Health" value={health ? <Badge tone={HEALTH_VARIANT[health]} label={health} /> : '-'} />
        </div>
        {c.section !== 'draft' && c.section !== 'scheduled' && (
          <div className={styles.progress} aria-label={`Execution progress ${Math.round(c.progress || 0)}%`}>
            <span className={styles.track}><span className={styles.fill} style={{ width: `${Math.min(100, c.progress || 0)}%` }} /></span>
            <span className={styles.pct}>{Math.round(c.progress || 0)}%</span>
          </div>
        )}
        <GroupedSection>
          <GroupedRow icon="solar:users-group-rounded-linear" label="Audience" detail={`${(c.audience ?? 0).toLocaleString()}${c.dynamic ? ' (Dynamic)' : ''}`} />
          <GroupedRow icon="solar:calendar-linear" label="Start date" detail={c.startDate || '-'} />
          <GroupedRow icon="solar:clock-circle-linear" label="Duration" detail={c.duration != null ? `${c.duration} Days` : '-'} />
          <GroupedRow icon="solar:info-circle-linear" label="Status" detail={SECTIONS_META[c.section]?.label || '-'} />
        </GroupedSection>
        <DesktopOnlyNote description="The campaign builder (audience, content and schedule) needs a bigger screen." />
      </div>
    </BottomSheet>
  );
}

function Stat({ label, value }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
    </div>
  );
}
