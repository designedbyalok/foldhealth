import { useEffect, useMemo, useState } from 'react';
import { FilterChip } from '../../../components/FilterChip/FilterChip';
import { Input } from '../../../components/Input/Input';
import { Switch } from '../../../components/Switch/Switch';
import { DesktopOnlyNote } from '../../../components/DesktopOnlyNote/DesktopOnlyNote';
import { Icon } from '../../../components/Icon/Icon';
import { useAppStore } from '../../../store/useAppStore';
import { executionTypeOf } from '../../automations/lib/catalog';
import { STATUS_TABS, fmtDateTime, inStatusTab, latestFailures, matchesSearch, plural, runsByAutomation } from '../../automations/list/listUtils';
import { MobileSubHeader } from '../MobileHeader';
import { MobileEmpty, MobileListSkeleton } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { GroupedSection } from '../more/GroupedList';
import common from '../mobile.module.css';
import more from '../more/more.module.css';
import styles from './automations.module.css';

const EMPTY = [];
const EXECUTION_TYPES = ['Automatic', 'Manual'];
const NO_GROUP = 'No population group';

/**
 * My Automations (desktop Settings > Automations): the same status tabs,
 * search and filters, an on/off switch per automation
 * (setAutomationStatus, as the desktop card) and a tap into its detail.
 */
export function AutomationsScreen() {
  const { push } = useMobileNav();
  const automations = useAppStore(s => s.automations);
  const status = useAppStore(s => s.automationsStatus);
  const allRuns = useAppStore(s => s.automationRuns);
  const fetchAutomations = useAppStore(s => s.fetchAutomations);
  const setAutomationStatus = useAppStore(s => s.setAutomationStatus);
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState('active');
  const [execFilter, setExecFilter] = useState(EMPTY);
  const [groupFilter, setGroupFilter] = useState(EMPTY);

  useEffect(() => { fetchAutomations(); }, [fetchAutomations]);

  const runMap = useMemo(() => runsByAutomation(allRuns), [allRuns]);
  const groupOptions = useMemo(() => [...new Set(automations.map(a => a.populationGroupName || NO_GROUP))].sort(), [automations]);
  const filtered = useMemo(() => automations.filter(a => matchesSearch(a, search)
    && (!execFilter.length || execFilter.includes(executionTypeOf(a.schedule)))
    && (!groupFilter.length || groupFilter.includes(a.populationGroupName || NO_GROUP))), [automations, search, execFilter, groupFilter]);
  const counts = useMemo(() => Object.fromEntries(STATUS_TABS.map(t => [t.key, filtered.filter(a => inStatusTab(a, t.key)).length])), [filtered]);
  const shown = useMemo(() => filtered.filter(a => inStatusTab(a, statusTab)), [filtered, statusTab]);
  const tab = STATUS_TABS.find(t => t.key === statusTab);
  const statusLabel = (t) => `${t.label} (${counts[t.key] ?? 0})`;

  return (
    <div className={common.screen}>
      <MobileSubHeader title="Automations" />
      <div className={more.toolbar}>
        <Input
          type="search"
          size="lg"
          leadingIcon="solar:magnifer-linear"
          placeholder="Search automations"
          aria-label="Search automations"
          enterKeyHint="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className={more.chips}>
          <FilterChip
            label="Status"
            options={STATUS_TABS.map(statusLabel)}
            selected={[statusLabel(tab)]}
            onChange={(labels) => {
              const hit = STATUS_TABS.find(t => statusLabel(t) === labels[labels.length - 1]);
              if (hit) setStatusTab(hit.key);
            }}
            singleSelect
            noClear
            noClearNeutral={false}
          />
          <FilterChip label="Execution type" options={EXECUTION_TYPES} selected={execFilter} onChange={setExecFilter} />
          <FilterChip label="Population group" options={groupOptions} selected={groupFilter} onChange={setGroupFilter} searchable={groupOptions.length > 6} />
        </div>
      </div>
      <div className={common.body}>
        {status !== 'ready' ? <MobileListSkeleton height={88} /> : shown.length === 0 ? (
          <MobileEmpty
            icon={search || execFilter.length || groupFilter.length ? 'solar:magnifer-linear' : 'solar:bolt-linear'}
            title={!automations.length ? 'No automations yet' : search || execFilter.length || groupFilter.length ? 'No automations match' : tab.empty}
            description={!automations.length ? 'Build one in Settings > Automations on a computer.' : tab.hint}
          />
        ) : (
          <div className={more.stack}>
            <GroupedSection label={`${tab.label} · ${shown.length}`}>
              {shown.map(a => {
                const runs = runMap.get(a.id) || EMPTY;
                const failures = latestFailures(a, runs);
                return (
                  <div key={a.id} className={styles.row}>
                    <button type="button" className={styles.rowMain} onClick={() => push('automation', { id: a.id })}>
                      <span className={styles.icon}><Icon name="solar:bolt-linear" size={24} color="currentColor" /></span>
                      <span className={styles.text}>
                        <span className={styles.name}>{a.name}</span>
                        <span className={styles.meta}>
                          {a.status === 'draft' ? 'Draft' : `${executionTypeOf(a.schedule)} · ${plural(runs.length, 'run')}`}
                          {a.lastExecutedAt ? ` · Last ${fmtDateTime(a.lastExecutedAt)}` : ''}
                        </span>
                        {failures > 0 && (
                          <span className={styles.error}>
                            <Icon name="solar:danger-triangle-linear" size={16} color="currentColor" />
                            {plural(failures, 'member')} failed in the latest run
                          </span>
                        )}
                      </span>
                    </button>
                    {a.status !== 'draft' && (
                      <span className={styles.switch}>
                        <Switch
                          checked={a.status === 'active'}
                          onChange={(on) => setAutomationStatus(a.id, on ? 'active' : 'inactive')}
                          ariaLabel={a.status === 'active' ? `Turn off ${a.name}` : `Turn on ${a.name}`}
                        />
                      </span>
                    )}
                  </div>
                );
              })}
            </GroupedSection>
            <DesktopOnlyNote description="Create an automation, use a template or change its flow in Settings > Automations on a computer." />
          </div>
        )}
      </div>
    </div>
  );
}
