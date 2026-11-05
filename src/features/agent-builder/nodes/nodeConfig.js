/**
 * Single source of truth for node type config across the agent builder.
 * Both NodePanel (left sidebar palette) and ConversationNode (rendered on
 * the canvas) read from this module. When adding a new node type, add an
 * entry here: the panel and canvas pick it up automatically.
 *
 * Each entry exposes:
 *  - type            internal id stored in node.data.nodeType
 *  - label           display name
 *  - description     1-2 sentence behavior summary, shown on panel hover
 *  - color           accent color (used as canvas icon bg + label color)
 *  - drawerBg        light fill for the icon pill in the panel
 *  - drawerBorder    matching border color for the panel icon pill
 *  - icon            iconify name (preferred when a good Solar match exists)
 *  - CustomIcon      React component (used when an iconify name isn't enough)
 */

import {
  ConversationIcon,
  GuardrailsIcon,
  CallTransferIcon,
  AgentsIcon,
  PressDigitIcon,
  LogicSplitIcon,
  AgentTransferIcon,
  InCallSmsIcon,
  ExtractVariableIcon,
  McpIcon,
} from './NodeIcons';

export const NODE_CONFIG = {
  conversation: {
    type: 'conversation',
    label: 'Conversation',
    description: 'Handle dialogue and user interactions without tool calling.',
    color: '#009688',
    drawerBg: '#E5F4F3',
    drawerBorder: 'rgba(0,150,136,0.1)',
    CustomIcon: ConversationIcon,
  },
  subagents: {
    type: 'subagents',
    label: 'Subagents',
    description: 'Handle dialogue and user interactions with tool calling.',
    color: '#FF907F',
    drawerBg: 'linear-gradient(136deg, #FFF2F0 2%, #FFEDFA 52%, #EDF5FF 94%)',
    drawerBorder: '#FF907F',
    CustomIcon: AgentsIcon,
  },
  function: {
    type: 'function',
    label: 'Function',
    description: 'Execute custom functions and API calls.',
    icon: 'solar:cpu-linear',
    color: '#5800FF',
    drawerBg: '#EEE5FF',
    drawerBorder: 'rgba(88,0,255,0.1)',
  },
  callTransfer: {
    type: 'callTransfer',
    label: 'Call Transfer',
    description: 'Transfer calls to other phone numbers.',
    color: '#9C27B0',
    drawerBg: '#F5E9F7',
    drawerBorder: 'rgba(156,39,176,0.2)',
    CustomIcon: CallTransferIcon,
  },
  pressDigit: {
    type: 'pressDigit',
    label: 'Press Digit',
    description: 'Send DTMF tones (press digits) during the call.',
    color: '#2196F3',
    drawerBg: '#E9F4FE',
    drawerBorder: 'rgba(33,150,243,0.3)',
    CustomIcon: PressDigitIcon,
  },
  logicSplit: {
    type: 'logicSplit',
    label: 'Logic Split',
    description: 'Create conditional branches based on variables.',
    color: '#8C5AE2',
    drawerBg: '#FCFAFF',
    drawerBorder: 'rgba(140,90,226,0.3)',
    CustomIcon: LogicSplitIcon,
  },
  agentTransfer: {
    type: 'agentTransfer',
    label: 'Agent Transfer',
    description: 'Transfer the conversation to another agent.',
    color: '#795548',
    drawerBg: '#F2EEED',
    drawerBorder: 'rgba(121,85,72,0.2)',
    CustomIcon: AgentTransferIcon,
  },
  inCallSms: {
    type: 'inCallSms',
    label: 'In-call SMS',
    description: 'Send an SMS message during the call.',
    color: '#9C27B0',
    drawerBg: '#F5E9F7',
    drawerBorder: 'rgba(156,39,176,0.2)',
    CustomIcon: InCallSmsIcon,
  },
  extractVariable: {
    type: 'extractVariable',
    label: 'Extract Variable',
    description: 'Extract and store dynamic variables from the conversation.',
    color: '#009688',
    drawerBg: '#E5F4F3',
    drawerBorder: 'rgba(0,150,136,0.3)',
    CustomIcon: ExtractVariableIcon,
  },
  code: {
    type: 'code',
    label: 'Code',
    description: 'Execute JavaScript code directly without an external server.',
    icon: 'solar:code-linear',
    color: '#145ECC',
    drawerBg: '#F4F8FE',
    drawerBorder: 'rgba(20,94,204,0.2)',
  },
  mcp: {
    type: 'mcp',
    label: 'MCP',
    description: 'Integrate with Model Context Protocol tools.',
    color: '#6F7A90',
    drawerBg: '#F6F7F8',
    drawerBorder: '#D0D6E1',
    CustomIcon: McpIcon,
  },
  note: {
    type: 'note',
    label: 'Note',
    description: 'Document context, decisions, or reminders inside the flow.',
    icon: 'solar:file-text-linear',
    color: '#EEB200',
    drawerBg: '#FDF7E5',
    drawerBorder: 'rgba(238,178,0,0.2)',
  },
  appointment: {
    type: 'appointment',
    label: 'Appointment',
    description: 'Schedule, reschedule, or cancel patient appointments.',
    icon: 'solar:calendar-mark-linear',
    color: '#8C5AE2',
    drawerBg: '#FCFAFF',
    drawerBorder: 'rgba(140,90,226,0.3)',
  },
  guardrails: {
    type: 'guardrails',
    label: 'Guardrails',
    description: 'Enforce safety constraints and content policies during conversation.',
    color: '#D9A50B',
    drawerBg: '#FFFCF5',
    drawerBorder: 'rgba(217,165,11,0.3)',
    CustomIcon: GuardrailsIcon,
  },
  escalation: {
    type: 'escalation',
    label: 'Escalations',
    description: 'Hand off to a human or trigger an escalation workflow.',
    icon: 'solar:danger-triangle-linear',
    color: '#D72825',
    drawerBg: '#FFFCF5',
    drawerBorder: 'rgba(215,40,37,0.2)',
  },
  end: {
    type: 'end',
    label: 'End',
    description: 'Terminate the call gracefully.',
    icon: 'solar:forbidden-circle-linear',
    color: '#109CAE',
    drawerBg: '#E5F8FB',
    drawerBorder: 'rgba(16,156,174,0.3)',
  },
};

/* Order in the left sidebar palette, matches the Figma design (1041:126567). */
export const NODE_PALETTE_ORDER = [
  'conversation',
  'subagents',
  'function',
  'callTransfer',
  'pressDigit',
  'logicSplit',
  'agentTransfer',
  'inCallSms',
  'extractVariable',
  'code',
  'mcp',
  'note',
  'appointment',
  'guardrails',
  'escalation',
  'end',
];

export const NODE_LIST = NODE_PALETTE_ORDER.map(t => NODE_CONFIG[t]);

export function getNodeConfig(type) {
  return NODE_CONFIG[type] || NODE_CONFIG.conversation;
}
