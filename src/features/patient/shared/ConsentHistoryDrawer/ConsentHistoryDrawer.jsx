import { useMemo, useState } from 'react';
import { Drawer } from '../../../../components/Drawer/Drawer';
import { Tabs } from '../../../../components/Tabs/Tabs';
import { Input } from '../../../../components/Input/Input';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { FilterChip } from '../../../../components/FilterChip/FilterChip';
import { ActivityLog, MetaLine } from '../../../../components/ActivityLog/ActivityLog';
import { TimelineSkeleton } from '../../../../components/TimelineSkeleton/TimelineSkeleton';
import { toActivityLogEntries } from '../../../hedis-worklist/CareGapDetailDrawer.utils';
import { usePatientConsent } from '../../hooks/usePatientConsent';
import { CONSENT_CATEGORIES, consentTimelineEntries } from '../../data/consentDisplay';
import styles from './ConsentHistoryDrawer.module.css';

const TABS = [{ key: 'all', label: 'All Activity' }, ...CONSENT_CATEGORIES.map(c => ({ key: c.key, label: c.label }))];
const STATUS_OPTIONS = ['Accepted', 'Declined', 'Withdrawn'];
const STATUS_VALUE = { Accepted: 'given', Declined: 'declined', Withdrawn: 'withdrawn' };

function ConsentEntryBody({ entry }) {
  return (
    <div className={styles.entry}>
      <MetaLine entry={entry} />
      <span className={entry.tone === 'success' ? styles.accepted : styles.refused}>{entry.outcome}</span>
      {entry.reason && <span className={styles.reason}>{entry.reason}</span>}
    </div>
  );
}

const renderBody = (entry) => <ConsentEntryBody entry={entry} />;

/** Every consent record for a patient (Figma 1:34523), by category, in the shared ActivityLog. */
export function ConsentHistoryDrawer({ patientId, onClose }) {
  const { consents, loaded } = usePatientConsent(patientId);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [statuses, setStatuses] = useState([]);

  const allEntries = useMemo(() => consentTimelineEntries(consents), [consents]);
  const entries = useMemo(() => {
    const q = search.trim().toLowerCase();
    const wanted = new Set(statuses.map(s => STATUS_VALUE[s]));
    const shown = allEntries.filter(e => (tab === 'all' || e.group === tab)
      && (!wanted.size || wanted.has(e.status))
      && (!q || e.searchText.includes(q)));
    return toActivityLogEntries(shown).map(e => (e.t === 'group' ? e : { ...e, render: renderBody }));
  }, [allEntries, tab, search, statuses]);

  return (
    <Drawer title="Consent History" onClose={onClose} bodyClassName={styles.body}>
      <Tabs items={TABS} value={tab} onValueChange={setTab} fullWidth={false} />
      <div className={styles.content}>
        <div className={styles.toolbar}>
          <div className={styles.search}>
            <Input leadingIcon="solar:magnifer-linear" placeholder="Search Consent History" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search consent history" />
          </div>
          <span className={styles.divider} />
          <ActionButton
            icon="custom:filter"
            tooltip="Filter"
            tooltipLeft
            active={showFilters}
            notification={statuses.length > 0}
            count={statuses.length > 0 ? String(statuses.length) : undefined}
            onClick={() => setShowFilters(v => !v)}
          />
        </div>
        {showFilters && (
          <div className={styles.filters}>
            <FilterChip label="Status" options={STATUS_OPTIONS} selected={statuses} onChange={setStatuses} />
          </div>
        )}
        {!loaded ? (
          <TimelineSkeleton rows={4} />
        ) : (
          <ActivityLog
            entries={entries}
            flushTop
            emptyLabel={allEntries.length ? 'No consent history matches.' : 'No consent has been recorded yet.'}
          />
        )}
      </div>
    </Drawer>
  );
}
