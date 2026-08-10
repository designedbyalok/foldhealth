/**
 * Generates a conversation flow (nodes + edges) from a plain-text prompt.
 *
 * This uses keyword matching to produce a realistic starter flow.
 * In production this would call an LLM, but for the prototype we
 * deterministically build a flow based on intent analysis.
 */

const NODE_TEMPLATES = {
  greeting: {
    label: 'Introduction & Greeting',
    prompt: 'Hello, this is the care support assistant calling on behalf of your healthcare provider.\n\nI\'m reaching out to check in with you. Is now a good time to talk for a few minutes?',
    nodeType: 'conversation',
    transitions: [{ condition: 'If yes', target: '' }, { condition: 'If no', target: '' }],
  },
  identity: {
    label: 'Identity Verification',
    prompt: 'To make sure I\'m speaking with the right person, could you please confirm your full name and date of birth?',
    nodeType: 'conversation',
    verified: true,
    transitions: [{ condition: 'Verified', target: '' }, { condition: 'Not verified', target: '' }],
  },
  reschedule: {
    label: 'Reschedule Call',
    prompt: 'No problem. When would be a better time for us to call you back?',
    nodeType: 'conversation',
    transitions: [{ condition: 'Time saved', target: '' }],
  },
  discharge: {
    label: 'Discharge Follow-Up',
    prompt: 'I can see you were recently discharged from the hospital. How are you feeling today? Are you experiencing any new symptoms or concerns since leaving?',
    nodeType: 'conversation',
    transitions: [{ condition: 'Feeling well', target: '' }, { condition: 'Has concerns', target: '' }],
  },
  medication: {
    label: 'Medication Review',
    prompt: 'Let me go through your discharge medications to make sure everything is in order. Are you taking all the medications as prescribed?',
    nodeType: 'conversation',
    transitions: [{ condition: 'All confirmed', target: '' }, { condition: 'Issues found', target: '' }],
  },
  symptoms: {
    label: 'Symptom Assessment',
    prompt: 'I\'d like to ask you a few questions about how you\'re feeling. On a scale of 1-10, how would you rate your overall well-being today?',
    nodeType: 'conversation',
    transitions: [{ condition: 'Stable', target: '' }, { condition: 'Needs attention', target: '' }],
  },
  appointment: {
    label: 'Schedule Appointment',
    prompt: 'Based on our conversation, I\'d like to schedule a follow-up appointment for you. What days and times work best for you this week?',
    nodeType: 'appointment',
    transitions: [{ condition: 'Scheduled', target: '' }, { condition: 'Declined', target: '' }],
  },
  wellness: {
    label: 'Wellness Check',
    prompt: 'This is your Annual Wellness Visit reminder. It\'s important to stay on top of preventive care. Would you like to schedule your wellness visit?',
    nodeType: 'conversation',
    transitions: [{ condition: 'Interested', target: '' }, { condition: 'Not now', target: '' }],
  },
  escalation: {
    label: 'Escalation to Staff',
    prompt: 'I understand your situation needs immediate attention. Let me connect you with a care coordinator who can help right away.',
    nodeType: 'escalation',
    transitions: [],
  },
  transfer: {
    label: 'Transfer to Provider',
    prompt: 'I\'ll transfer you to your care team now. Please hold for just a moment.',
    nodeType: 'callTransfer',
    transitions: [],
  },
  mentalHealth: {
    label: 'Mental Health Check-In',
    prompt: 'I\'d also like to check in on how you\'re doing emotionally. Over the past two weeks, have you been feeling down, depressed, or hopeless?',
    nodeType: 'conversation',
    transitions: [{ condition: 'No concerns', target: '' }, { condition: 'Needs support', target: '' }],
  },
  adherence: {
    label: 'Adherence Check',
    prompt: 'Have you been able to follow the care plan we discussed during your last visit? Are there any barriers that are making it difficult?',
    nodeType: 'conversation',
    transitions: [{ condition: 'On track', target: '' }, { condition: 'Struggling', target: '' }],
  },
  chronicCare: {
    label: 'Chronic Care Monitor',
    prompt: 'Let\'s review your current condition. Have you been monitoring your readings regularly? What were your most recent numbers?',
    nodeType: 'conversation',
    transitions: [{ condition: 'In range', target: '' }, { condition: 'Out of range', target: '' }],
  },
  closing: {
    label: 'Call Wrap-Up',
    prompt: 'Thank you for taking the time to speak with me today. Is there anything else I can help you with before we end the call?',
    nodeType: 'conversation',
    transitions: [{ condition: 'No more questions', target: '' }],
  },
};

// Keyword → node template mapping
const KEYWORD_MAP = [
  { keywords: ['discharge', 'post-discharge', 'hospital', 'toc', 'transition'], nodes: ['greeting', 'identity', 'reschedule', 'discharge', 'medication', 'symptoms', 'appointment', 'escalation', 'closing'] },
  { keywords: ['follow-up', 'followup', 'check-in', 'checkin', 'check in'], nodes: ['greeting', 'identity', 'reschedule', 'symptoms', 'adherence', 'appointment', 'closing'] },
  { keywords: ['wellness', 'awv', 'annual', 'preventive'], nodes: ['greeting', 'identity', 'reschedule', 'wellness', 'appointment', 'closing'] },
  { keywords: ['mental', 'behavioral', 'depression', 'anxiety'], nodes: ['greeting', 'identity', 'reschedule', 'mentalHealth', 'escalation', 'closing'] },
  { keywords: ['chronic', 'diabetes', 'hypertension', 'copd', 'heart', 'monitor'], nodes: ['greeting', 'identity', 'reschedule', 'chronicCare', 'medication', 'escalation', 'appointment', 'closing'] },
  { keywords: ['medication', 'med', 'reconciliation', 'prescription'], nodes: ['greeting', 'identity', 'reschedule', 'medication', 'appointment', 'closing'] },
  { keywords: ['schedule', 'appointment', 'booking'], nodes: ['greeting', 'identity', 'reschedule', 'appointment', 'closing'] },
  { keywords: ['remote', 'monitoring', 'rpm'], nodes: ['greeting', 'identity', 'reschedule', 'chronicCare', 'symptoms', 'escalation', 'closing'] },
];

export function generateFlowFromPrompt(prompt) {
  if (!prompt || !prompt.trim()) return null;

  const lower = prompt.toLowerCase();

  // Find best matching keyword set
  let bestMatch = null;
  let bestScore = 0;
  for (const entry of KEYWORD_MAP) {
    const score = entry.keywords.reduce((s, kw) => s + (lower.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  // Default to a generic follow-up if no match
  const nodeKeys = bestMatch?.nodes || ['greeting', 'identity', 'reschedule', 'symptoms', 'appointment', 'closing'];

  // Build nodes
  const nodes = [
    { id: 'start', type: 'startNode', position: { x: 100, y: 300 }, data: { label: 'Starts Here' } },
  ];
  const edges = [];

  let x = 300;
  let y = 200;
  let prevId = 'start';
  let lastMainId = null;

  nodeKeys.forEach((key, i) => {
    const template = NODE_TEMPLATES[key];
    if (!template) return;

    const nodeId = `n${i + 1}`;
    const isReschedule = key === 'reschedule';
    const isEscalation = key === 'escalation' || key === 'transfer';
    const isClosing = key === 'closing';

    // Position: main chain flows right-then-down, branches go below
    let posX, posY;
    if (isReschedule) {
      posX = x - 100;
      posY = y + 250;
    } else if (isEscalation) {
      posX = x;
      posY = y + 200;
    } else {
      posX = x;
      posY = y;
      x += 300;
      if (i > 0 && i % 3 === 0) {
        y += 180;
        x -= 600;
      }
    }

    // Clone transitions with proper targets
    const transitions = template.transitions.map(t => ({ ...t }));

    nodes.push({
      id: nodeId,
      type: 'conversationNode',
      position: { x: posX, y: posY },
      data: {
        label: template.label,
        prompt: template.prompt,
        nodeType: template.nodeType,
        verified: template.verified || false,
        transitions,
        guardrails: '',
      },
    });

    // Connect edges
    if (i === 0) {
      // Start → first node
      edges.push({
        id: `e-start-${nodeId}`,
        source: 'start',
        target: nodeId,
        type: 'smoothstep',
        animated: true,
      });
    } else if (isReschedule && nodes.length > 2) {
      // "If no" from first conversation → reschedule
      edges.push({
        id: `e-${nodes[1].id}-${nodeId}`,
        source: nodes[1].id,
        target: nodeId,
        sourceHandle: 't-1',
        type: 'smoothstep',
        label: 'If no',
      });
    } else if (isEscalation) {
      // Connect from previous main node's negative branch
      if (lastMainId) {
        edges.push({
          id: `e-${lastMainId}-${nodeId}`,
          source: lastMainId,
          target: nodeId,
          sourceHandle: 't-1',
          type: 'smoothstep',
          label: 'Needs attention',
        });
      }
    } else if (prevId && !isReschedule) {
      edges.push({
        id: `e-${prevId}-${nodeId}`,
        source: prevId,
        target: nodeId,
        sourceHandle: 't-0',
        type: 'smoothstep',
      });
    }

    if (!isReschedule && !isEscalation) {
      lastMainId = nodeId;
      prevId = nodeId;
    }
  });

  // Add end node
  const endNode = {
    id: 'end',
    type: 'endNode',
    position: { x: x + 100, y: y },
    data: { label: 'End' },
  };
  nodes.push(endNode);

  // Connect closing/last → end
  if (lastMainId) {
    edges.push({
      id: `e-${lastMainId}-end`,
      source: lastMainId,
      target: 'end',
      sourceHandle: 't-0',
      type: 'smoothstep',
    });
  }

  // Connect reschedule → end
  const rescheduleNode = nodes.find(n => n.data.label === 'Reschedule Call');
  if (rescheduleNode) {
    edges.push({
      id: `e-${rescheduleNode.id}-end`,
      source: rescheduleNode.id,
      target: 'end',
      sourceHandle: 't-0',
      type: 'smoothstep',
    });
  }

  // Wire up transition target labels
  const nodeById = new Map(nodes.map(n => [n.id, n]));
  for (const node of nodes) {
    if (!node.data.transitions) continue;
    for (const t of node.data.transitions) {
      if (!t.target) {
        // Find the connected edge
        const edge = edges.find(e => e.source === node.id && e.sourceHandle === `t-${node.data.transitions.indexOf(t)}`);
        if (edge) {
          const targetNode = nodeById.get(edge.target);
          if (targetNode) t.target = targetNode.data.label;
        }
      }
    }
  }

  return { nodes, edges };
}
