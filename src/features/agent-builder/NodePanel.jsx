import { useState } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { Toggle } from '../../components/Toggle/Toggle';
import {
  ConversationIcon,
  GuardrailsIcon,
  CallTransferIcon,
  AgentsIcon,
  FunctionIcon,
  PressDigitIcon,
  LogicSplitIcon,
  AgentTransferIcon,
  InCallSmsIcon,
  ExtractVariableIcon,
  CodeIcon,
  McpIcon,
  NoteIcon,
} from './nodes/NodeIcons';
import styles from './NodePanel.module.css';

/* ── Node type config — order + colors match Figma 1041:126567 ──
 * Drawer icons: light bg + colored border. Canvas icons use solid bg.
 */
const NODE_TYPES = [
  {
    type: 'conversation',
    label: 'Conversation',
    iconColor: '#009688',
    drawerBg: '#E5F4F3',
    drawerBorder: 'rgba(0,150,136,0.1)',
    CustomIcon: ConversationIcon,
  },
  {
    type: 'subagents',
    label: 'Subagents',
    iconColor: '#FF907F',
    drawerBg: 'linear-gradient(136deg, #FFF2F0 2%, #FFEDFA 52%, #EDF5FF 94%)',
    drawerBorder: '#FF907F',
    CustomIcon: AgentsIcon,
  },
  {
    type: 'function',
    label: 'Function',
    iconColor: '#5800FF',
    drawerBg: '#EEE5FF',
    drawerBorder: 'rgba(88,0,255,0.1)',
    CustomIcon: FunctionIcon,
  },
  {
    type: 'callTransfer',
    label: 'Call Transfer',
    iconColor: '#9C27B0',
    drawerBg: '#F5E9F7',
    drawerBorder: 'rgba(156,39,176,0.2)',
    CustomIcon: CallTransferIcon,
  },
  {
    type: 'pressDigit',
    label: 'Press Digit',
    iconColor: '#2196F3',
    drawerBg: '#E9F4FE',
    drawerBorder: 'rgba(33,150,243,0.3)',
    CustomIcon: PressDigitIcon,
  },
  {
    type: 'logicSplit',
    label: 'Logic Split',
    iconColor: '#8C5AE2',
    drawerBg: '#FCFAFF',
    drawerBorder: 'rgba(140,90,226,0.3)',
    CustomIcon: LogicSplitIcon,
  },
  {
    type: 'agentTransfer',
    label: 'Agent Transfer',
    iconColor: '#795548',
    drawerBg: '#F2EEED',
    drawerBorder: 'rgba(121,85,72,0.2)',
    CustomIcon: AgentTransferIcon,
  },
  {
    type: 'inCallSms',
    label: 'In-call SMS',
    iconColor: '#9C27B0',
    drawerBg: '#F5E9F7',
    drawerBorder: 'rgba(156,39,176,0.2)',
    CustomIcon: InCallSmsIcon,
  },
  {
    type: 'extractVariable',
    label: 'Extract Variable',
    iconColor: '#009688',
    drawerBg: '#E5F4F3',
    drawerBorder: 'rgba(0,150,136,0.3)',
    CustomIcon: ExtractVariableIcon,
  },
  {
    type: 'code',
    label: 'Code',
    iconColor: '#145ECC',
    drawerBg: '#F4F8FE',
    drawerBorder: 'rgba(20,94,204,0.2)',
    CustomIcon: CodeIcon,
  },
  {
    type: 'mcp',
    label: 'MCP',
    iconColor: '#6F7A90',
    drawerBg: '#F6F7F8',
    drawerBorder: '#D0D6E1',
    CustomIcon: McpIcon,
  },
  {
    type: 'note',
    label: 'Note',
    iconColor: '#EEB200',
    drawerBg: '#FDF7E5',
    drawerBorder: 'rgba(238,178,0,0.2)',
    CustomIcon: NoteIcon,
  },
  {
    type: 'appointment',
    icon: 'solar:calendar-mark-linear',
    label: 'Appointment',
    iconColor: '#8C5AE2',
    drawerBg: '#FCFAFF',
    drawerBorder: 'rgba(140,90,226,0.3)',
  },
  {
    type: 'guardrails',
    label: 'Guardrails',
    iconColor: '#D9A50B',
    drawerBg: '#FFFCF5',
    drawerBorder: 'rgba(217,165,11,0.3)',
    CustomIcon: GuardrailsIcon,
  },
  {
    type: 'escalation',
    icon: 'solar:danger-triangle-linear',
    label: 'Escalations',
    iconColor: '#D72825',
    drawerBg: '#FFFCF5',
    drawerBorder: 'rgba(215,40,37,0.2)',
  },
  {
    type: 'end',
    icon: 'solar:forbidden-circle-linear',
    label: 'End',
    iconColor: '#109CAE',
    drawerBg: '#E5F8FB',
    drawerBorder: 'rgba(16,156,174,0.3)',
  },
];

const COMPONENTS = [
  { type: 'greeting', icon: 'solar:hand-shake-linear', label: 'Greeting', desc: 'Standard greeting message' },
  { type: 'verification', icon: 'solar:shield-user-linear', label: 'Verification', desc: 'Identity verification block' },
  { type: 'medCheck', icon: 'solar:pill-linear', label: 'Med Check', desc: 'Medication reconciliation' },
  { type: 'scheduling', icon: 'solar:calendar-mark-linear', label: 'Scheduling', desc: 'Appointment scheduling' },
];

export function NodePanel({ onDragStart }) {
  const [activeTab, setActiveTab] = useState('Node');

  const handleDragStart = (e, nodeType, label) => {
    e.dataTransfer.setData('application/reactflow', JSON.stringify({ nodeType, label }));
    e.dataTransfer.effectAllowed = 'move';
    if (onDragStart) onDragStart(nodeType);
  };

  return (
    <aside className={styles.panel}>
      {/* Segmented toggle */}
      <div className={styles.toggleWrap}>
        <Toggle items={['Node', 'Components']} active={activeTab} onChange={setActiveTab} fullWidth />
      </div>

      <div className={styles.list}>
        {activeTab === 'Node' ? (
          NODE_TYPES.map(n => {
            const isGradient = n.drawerBg.startsWith('linear');
            return (
              <div
                key={n.type}
                className={styles.nodeItem}
                draggable
                onDragStart={e => handleDragStart(e, n.type, n.label)}
              >
                <div
                  className={styles.nodeIcon}
                  style={{
                    background: n.drawerBg,
                    borderColor: n.drawerBorder,
                  }}
                >
                  {n.CustomIcon ? <n.CustomIcon size={16} color={n.iconColor} /> : <Icon name={n.icon} size={16} color={n.iconColor} />}
                </div>
                <span className={styles.nodeLabel}>{n.label}</span>
              </div>
            );
          })
        ) : (
          COMPONENTS.map(c => (
            <div
              key={c.type}
              className={styles.componentItem}
              draggable
              onDragStart={e => handleDragStart(e, c.type, c.label)}
            >
              <div className={styles.componentIcon}>
                <Icon name={c.icon} size={16} color="var(--primary-300)" />
              </div>
              <div className={styles.componentText}>
                <span className={styles.componentLabel}>{c.label}</span>
                <span className={styles.componentDesc}>{c.desc}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
