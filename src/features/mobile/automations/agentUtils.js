// Desktop shows this when an agent has no model set.
export const DEFAULT_MODEL = 'ChatGPT 4.5 Mini';
export const agentInitials = (name) => (name || '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
