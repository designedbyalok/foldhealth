import { Button } from '../../components/Button/Button';
import { Icon } from '../../components/Icon/Icon';
import { useAppStore } from '../../store/useAppStore';
import { joinAgentCall } from './joinAgentCall';
import styles from './AgentHandoffStrip.module.css';

/**
 * While a Unity agent is holding the patient on a live call: what the agent
 * escalated, the agent's transcript (the Live drawer), and joining the call.
 * `inline` fits it into the patient banner's tag row instead of a row of its
 * own, so the call doesn't push the record down.
 */
export function AgentHandoffStrip({ patient, inline = false }) {
  const openLiveDrawer = useAppStore(s => s.openLiveDrawer);
  const onThisCall = useAppStore(s => String(s.activeCallPatient ?? '') === String(patient?.id));
  if (!patient || patient.relayStatus !== 'live' || onThisCall) return null;
  const agent = patient.relayBy || patient.agentAssigned || 'The agent';
  const first = (patient.name || '').split(' ')[0];
  const why = String(patient.relayNote || '').replace(/^Live call\s*·\s*/i, '');

  if (inline) {
    return (
      <span className={styles.inline} role="status">
        <Icon name="solar:smile-circle-linear" size={14} color="var(--status-success)" />
        <span className={styles.inlineText} title={`${agent} (Unity Agent) is holding ${first} on the line${why ? `: ${why}` : ''}.`}>
          <span className={styles.who}>{agent} (Unity Agent)</span> is holding {first}{why ? `: ${why}` : ''}
        </span>
        <Button size="sm" variant="ghost" onClick={() => openLiveDrawer(patient.id)}>Read Handoff</Button>
        <Button size="sm" leadingIcon="solar:phone-calling-linear" onClick={() => joinAgentCall(patient)}>Join Call</Button>
      </span>
    );
  }

  return (
    <div className={styles.strip} role="status">
      <Icon name="solar:smile-circle-linear" size={16} color="var(--status-success)" />
      <span className={styles.text}>
        <span className={styles.who}>Handoff From {agent} · Unity Agent</span>
        <span className={styles.what}>{agent} is holding {first} on the line{why ? `: ${why}` : ''}.</span>
      </span>
      <Button size="sm" variant="outline" onClick={() => openLiveDrawer(patient.id)}>Read Handoff</Button>
      <Button size="sm" leadingIcon="solar:phone-calling-linear" onClick={() => joinAgentCall(patient)}>Join Call</Button>
    </div>
  );
}
