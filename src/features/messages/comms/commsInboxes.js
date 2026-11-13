// The practice's inboxes (Settings > Messages > Inboxes, store
// `commsInboxes`) as Comms uses them: which inbox a conversation came in on,
// and who its collaborators (assignees) are.
import { FIRST_INBOX_MOCK, INBOX_TAGS_MOCK, INBOX_TYPES } from '../../settings/messages/inboxes/inboxesMock';
import { sameName } from '../../ooo/oooUtils';

/**
 * The inbox a conversation came in on: its inbox_id; until the migration has
 * run (`sample`), as the seed tags it.
 */
export function inboxOf(conversation, sample) {
  if (conversation?.inbox_id) return conversation.inbox_id;
  if (!sample) return null;
  return INBOX_TAGS_MOCK[conversation?.id] || FIRST_INBOX_MOCK[conversation?.channel] || null;
}

/** An inbox's collaborators as users: by id, or (the fallback rows) by name. */
export function collaboratorsOf(inbox, users = []) {
  const byId = (inbox?.collaboratorIds || []).map(id => users.find(u => u.id === id)).filter(Boolean);
  if (byId.length) return byId;
  return (inbox?.collaboratorNames || []).map(n => users.find(u => sameName(u.name, n)) || { id: n, name: n });
}

/** "Main Line · +1 (775) 555-0100" */
export const inboxLabel = (i) => `${i.name} · ${i.address}`;

export const inboxType = (i) => INBOX_TYPES[i?.channel] || 'SMS';
