import { useEffect, useState } from 'react';
import { DesktopOnlyNote } from '../../../components/DesktopOnlyNote/DesktopOnlyNote';
import { Icon } from '../../../components/Icon/Icon';
import { Switch } from '../../../components/Switch/Switch';
import { useAppStore } from '../../../store/useAppStore';
import { MobileSubHeader } from '../MobileHeader';
import { MobileEmpty, MobileListSkeleton } from '../MobileParts';
import { GroupedRow, GroupedSection } from '../more/GroupedList';
import { DEFAULT_MODEL } from './agentUtils';
import common from '../mobile.module.css';
import more from '../more/more.module.css';
import styles from './automations.module.css';

const ACTION_ICON = {
  created: 'solar:add-circle-linear',
  deleted: 'solar:trash-bin-minimalistic-linear',
  enabled: 'solar:play-circle-linear',
  disabled: 'solar:pause-circle-linear',
};

/** One AI agent: details, the enable switch and its audit log (desktop row menu > Audit Log). */
export function AgentScreen({ id }) {
  const agent = useAppStore(s => s.agents.find(a => a.id === id));
  const fetched = useAppStore(s => s.agentsFetched);
  const fetchAgents = useAppStore(s => s.fetchAgents);
  const updateAgent = useAppStore(s => s.updateAgent);
  const fetchAuditLogs = useAppStore(s => s.fetchAuditLogs);
  const [log, setLog] = useState(null);

  useEffect(() => { if (!fetched) fetchAgents(); }, [fetched, fetchAgents]);
  // Reload after each toggle so the new "updated" entry shows.
  const enabled = agent?.enabled;
  useEffect(() => {
    let live = true;
    fetchAuditLogs('Agent', id).then(rows => { if (live) setLog(rows); });
    return () => { live = false; };
  }, [id, enabled, fetchAuditLogs]);

  if (!agent) {
    return (
      <div className={common.screen}>
        <MobileSubHeader title="Agent" />
        <div className={common.body}>{fetched ? <MobileEmpty icon="solar:ghost-smile-linear" title="This agent was not found" /> : <MobileListSkeleton />}</div>
      </div>
    );
  }

  const voice = agent.voice && typeof agent.voice === 'object' ? agent.voice : null;
  return (
    <div className={common.screen}>
      <MobileSubHeader title={agent.name} />
      <div className={common.body}>
        <div className={more.stack}>
          {agent.role && <p className={styles.description}>{agent.role}</p>}
          <GroupedSection>
            <GroupedRow
              icon="solar:power-linear"
              label={agent.enabled ? 'Enabled' : 'Disabled'}
              trailing={(
                <span className={styles.switch}>
                  <Switch checked={!!agent.enabled} onChange={() => updateAgent(agent.id, { enabled: !agent.enabled })} ariaLabel={agent.enabled ? 'Disable agent' : 'Enable agent'} />
                </span>
              )}
            />
            <GroupedRow icon="solar:target-linear" label="Use case" detail={agent.use_case || '-'} />
            <GroupedRow icon="solar:cpu-bolt-linear" label="Model" detail={agent.model || DEFAULT_MODEL} />
            {voice && <GroupedRow icon="solar:microphone-2-linear" label="Voice" detail={[voice.name, voice.gender, voice.language].filter(Boolean).join(' · ')} />}
            {agent.version && <GroupedRow icon="solar:tag-linear" label="Version" detail={agent.version} />}
            <GroupedRow icon="solar:user-linear" label="Last updated" detail={[agent.last_updated_by, agent.last_updated].filter(Boolean).join(' · ') || '-'} />
          </GroupedSection>
          <DesktopOnlyNote description="The agent builder, call queue and analytics need a bigger screen. Open Settings > Agents on a computer." />
          <section className={styles.day} aria-label="Audit log">
            <h2 className={styles.historyLabel}>Audit log</h2>
            {log == null ? <MobileListSkeleton count={3} /> : log.length === 0 ? (
              <MobileEmpty icon="solar:history-linear" title="No activity yet" description="Changes to this agent will show up here." />
            ) : (
              <GroupedSection>
                {log.map(e => (
                  <div key={e.id} className={styles.entry}>
                    <span className={styles.entryIcon}><Icon name={ACTION_ICON[e.action] || 'solar:pen-linear'} size={16} color="currentColor" /></span>
                    <span className={styles.entryText}>
                      <span>{e.details || e.action}</span>
                      <span className={styles.entrySub}>{[e.user, e.date, e.time].filter(Boolean).join(' · ')}</span>
                    </span>
                  </div>
                ))}
              </GroupedSection>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
