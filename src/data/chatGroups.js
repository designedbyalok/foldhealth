// Config defaults used by Group/AgentRules drawers. Not DB fallback data
// (the seed chatGroups list was removed). Marked TODO to migrate into DB.
export const availableUsers = [
  { id: 'u1', name: 'Alexa Daly', role: 'Business/Practice Owner, Physician', type: 'user', isAgent: false },
  { id: 'u2', name: 'Care Assistant', role: 'AI Agent · FAQ Responder', type: 'agent', isAgent: true },
  { id: 'u3', name: 'Dr. Robert Langdon', role: 'Physician', type: 'user', isAgent: false },
  { id: 'u4', name: 'Fernando Alonso', role: 'Care Manager', type: 'user', isAgent: false },
  { id: 'u5', name: 'Dr. Zachary Simonis', role: 'Business/Practice Owner', type: 'user', isAgent: false },
  { id: 'u6', name: 'Dr. Clara Kozey', role: 'Physician', type: 'user', isAgent: false },
  { id: 'u7', name: 'Ivy Ralph', role: 'Care Manager', type: 'user', isAgent: false },
];

// All available care team roles for search/add
export const availableRoles = [
  { id: 'r1', name: 'Guardian', type: 'role' },
  { id: 'r2', name: 'Nurse Guardian', type: 'role' },
  { id: 'r3', name: 'Primary Care Practitioner', type: 'role' },
  { id: 'r4', name: 'Nurse Practitioner', type: 'role' },
  { id: 'r5', name: 'Care Manager', type: 'role' },
  { id: 'r6', name: 'Medical Assistant', type: 'role' },
  { id: 'r7', name: 'Wellness Consultant', type: 'role' },
  { id: 'r8', name: 'Nutritionist', type: 'role' },
  { id: 'r9', name: 'Physical Therapist', type: 'role' },
];

export const defaultRules = [
  { id: 1, name: 'Emergency detection', type: 'safety', locked: true, enabled: true, condition: 'Message contains emergency keywords (chest pain, can\'t breathe, severe bleeding, overdose)', action: 'Immediate 911 guidance + alert care team', priority: 'Always first' },
  { id: 2, name: 'Crisis detection', type: 'safety', locked: true, enabled: true, condition: 'Message contains crisis keywords (suicide, self-harm, want to die)', action: '988 Lifeline guidance + alert care team', priority: 'Always second' },
  { id: 3, name: 'Staff is typing', type: 'system', locked: true, enabled: true, condition: 'Staff member is actively typing in thread', action: 'Agent holds: defers to human' },
  { id: 4, name: 'Staff already replied', type: 'system', locked: true, enabled: true, condition: 'Staff has replied in this session', action: 'Agent holds for rest of session' },
  { id: 5, name: 'Thread assigned to staff', type: 'system', locked: true, enabled: true, condition: 'Thread assigned to a specific staff member', action: 'Agent holds: staff owns thread' },
  { id: 6, name: 'After-hours acknowledgement', type: 'system', locked: true, enabled: true, condition: 'Message outside business hours + first message of session', action: 'Send after-hours acknowledgement message' },
  { id: 7, name: 'Start debounce timer', type: 'system', locked: true, enabled: true, condition: 'Patient message + unassigned + no staff reply + staff not typing', action: 'Start 90s debounce timer' },
  { id: 8, name: 'FAQ match', type: 'system', locked: true, enabled: true, condition: 'Debounce complete + KB match above confidence threshold', action: 'Reply with matched KB answer' },
  { id: 9, name: 'No FAQ match', type: 'system', locked: true, enabled: true, condition: 'Debounce complete + no KB match above threshold', action: 'Send fallback message + create staff task' },
  { id: 10, name: 'Default fallback', type: 'system', locked: true, enabled: true, condition: 'No other rule matched', action: 'Send fallback + flag thread for staff review' },
];

export const customRules = [
  { id: 11, name: 'Billing disputes to human', type: 'custom', locked: false, enabled: true, condition: 'Message contains "billing dispute" or "overcharged" or "wrong charge"', action: 'Route to billing team immediately' },
  { id: 12, name: 'VIP patients to human', type: 'custom', locked: false, enabled: false, condition: 'Patient flag = VIP', action: 'Route to staff immediately: skip chatbot' },
];

export const groupSettings = [
  { label: 'Debounce Window', value: '90 seconds', hint: 'Global default: 90s', isDefault: true },
  { label: 'FAQ Confidence Threshold', value: '0.75', hint: 'Global default: 0.75', isDefault: true },
  { label: 'After-Hours Ack Frequency', value: 'Once / session', hint: 'Global default: Once / session', isDefault: true },
  { label: 'Inactivity Timeout', value: '30 minutes', hint: 'Global default: 30 min', isDefault: true },
];
