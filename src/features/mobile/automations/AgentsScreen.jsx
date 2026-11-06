import { useEffect, useMemo, useState } from 'react';
import { Avatar } from '../../../components/Avatar/Avatar';
import { FilterChip } from '../../../components/FilterChip/FilterChip';
import { Input } from '../../../components/Input/Input';
import { Switch } from '../../../components/Switch/Switch';
import { DesktopOnlyNote } from '../../../components/DesktopOnlyNote/DesktopOnlyNote';
import { useAppStore } from '../../../store/useAppStore';
import { MobileSubHeader } from '../MobileHeader';
import { MobileEmpty, MobileListSkeleton } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { GroupedSection } from '../more/GroupedList';
import { DEFAULT_MODEL, agentInitials } from './agentUtils';
import common from '../mobile.module.css';
import more from '../more/more.module.css';
import styles from './automations.module.css';

const EMPTY = [];

/**
 * AI Agents (desktop Settings > Agents, Agents tab): search, the Status /
 * Model / Use Case filters and the enable switch (updateAgent, as the
 * desktop row). Tapping an agent opens its details and audit log.
 */
export function AgentsScreen() {
  const { push } = useMobileNav();
  const agents = useAppStore(s => s.agents);
  const loading = useAppStore(s => s.agentsLoading);
  const fetched = useAppStore(s => s.agentsFetched);
  const fetchAgents = useAppStore(s => s.fetchAgents);
  const updateAgent = useAppStore(s => s.updateAgent);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(EMPTY);
  const [model, setModel] = useState(EMPTY);
  const [useCase, setUseCase] = useState(EMPTY);

  useEffect(() => { if (!fetched) fetchAgents(); }, [fetched, fetchAgents]);

  const options = useMemo(() => ({
    model: [...new Set(agents.map(a => a.model).filter(Boolean))].sort(),
    useCase: [...new Set(agents.map(a => a.use_case).filter(Boolean))].sort(),
  }), [agents]);
  const shown = useMemo(() => {
    let list = agents;
    const statusSet = new Set(status);
    const modelSet = new Set(model);
    const useCaseSet = new Set(useCase);
    if (statusSet.size) list = list.filter(a => statusSet.has(a.enabled ? 'Enabled' : 'Disabled'));
    if (modelSet.size) list = list.filter(a => modelSet.has(a.model || DEFAULT_MODEL));
    if (useCaseSet.size) list = list.filter(a => useCaseSet.has(a.use_case));
    const q = search.toLowerCase().trim();
    if (!q) return list;
    return list.filter(a => a.name?.toLowerCase().includes(q) || a.use_case?.toLowerCase().includes(q) || a.last_updated_by?.toLowerCase().includes(q));
  }, [agents, status, model, useCase, search]);

  return (
    <div className={common.screen}>
      <MobileSubHeader title="AI Agents" />
      <div className={more.toolbar}>
        <Input type="search" size="lg" leadingIcon="solar:magnifer-linear" placeholder="Search agents" aria-label="Search agents" enterKeyHint="search" value={search} onChange={e => setSearch(e.target.value)} />
        <div className={more.chips}>
          <FilterChip label="Status" options={['Enabled', 'Disabled']} selected={status} onChange={setStatus} />
          <FilterChip label="Model" options={options.model} selected={model} onChange={setModel} />
          <FilterChip label="Use Case" options={options.useCase} selected={useCase} onChange={setUseCase} searchable={options.useCase.length > 6} />
        </div>
      </div>
      <div className={common.body}>
        {loading && !agents.length ? <MobileListSkeleton height={72} /> : shown.length === 0 ? (
          <MobileEmpty
            icon={search.trim() ? 'solar:magnifer-linear' : 'solar:ghost-smile-linear'}
            title={search.trim() || status.length || model.length || useCase.length ? 'No results found' : 'No agents configured yet'}
          />
        ) : (
          <div className={more.stack}>
            <GroupedSection label={`Agents · ${shown.length}`}>
              {shown.map(a => (
                <div key={a.id} className={styles.row}>
                  <button type="button" className={styles.rowMain} onClick={() => push('aiAgent', { id: a.id })}>
                    <Avatar variant="staff" size="L" initials={agentInitials(a.name)} />
                    <span className={styles.text}>
                      <span className={styles.name}>{a.name}</span>
                      <span className={styles.meta}>{[a.use_case, a.model || DEFAULT_MODEL].filter(Boolean).join(' · ')}</span>
                    </span>
                  </button>
                  <span className={styles.switch}>
                    <Switch checked={!!a.enabled} onChange={() => updateAgent(a.id, { enabled: !a.enabled })} ariaLabel={a.enabled ? `Disable ${a.name}` : `Enable ${a.name}`} />
                  </span>
                </div>
              ))}
            </GroupedSection>
            <DesktopOnlyNote description="Create an agent, or change its flow, goals and knowledge base, in Settings > Agents on a computer." />
          </div>
        )}
      </div>
    </div>
  );
}
