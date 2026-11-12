import { Button } from '../../components/Button/Button';
import { Icon } from '../../components/Icon/Icon';
import { useAppStore } from '../../store/useAppStore';
import { joinAgentCall } from './joinAgentCall';
import styles from './AgentHandoffStrip.module.css';

/**
 * Under the patient header while a Unity agent is holding the patient on a
 * live call: what the agent escalated, the agent's transcript (the Live
 * drawer), and joining the call.
 */
export function AgentHandoffStrip({ patient }) {
  const openLiveDrawer = useAppStore(s => s.openLiveDrawer);
  const onThisCall = useAppStore(s => String(s.activeCallPatient ?? '') === String(patient?.id));
  if (!patient || patient.relayStatus !== 'live' || onThisCall) return null;
  const agent = patient.relayBy || patient.agentAssigned || 'The agent';
  const first = (patient.name || '').split(' ')[0];
  const why = String(patient.relayNote || '').replace(/^Live call\s*·\s*/i, '');

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
