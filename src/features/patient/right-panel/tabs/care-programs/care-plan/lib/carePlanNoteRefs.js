import { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { collectMentions, collectLinks, serializePlain } from '@/components/Textarea/mentions';

/**
 * What every care plan note box offers: "@" tags a care team member and "/"
 * links one of this plan's goals, interventions or barriers. Pass both to a
 * richText Textarea as `mentionUsers` and `links`.
 */
export function useCarePlanNoteRefs(patientId, programId) {
  const platformUsers = useAppStore(s => s.platformUsers);
  const plan = useAppStore(s => (patientId && programId ? s.patientCarePlans[`${patientId}::${programId}`] : null));
  const mentionUsers = useMemo(() => (platformUsers || [])
    .filter(u => u?.name)
    .map(u => ({ id: u.id, name: u.name, initials: u.initials, role: (u.clinicalRoles || [])[0], realProfile: true }))
    .toSorted((a, b) => a.name.localeCompare(b.name)), [platformUsers]);
  const links = useMemo(() => [
    ...(plan?.goals || []).map(g => ({ id: g.id, kind: 'goal', label: g.title, group: 'Goals', icon: 'solar:flag-linear', meta: g.status })),
    ...(plan?.interventions || []).map(i => ({ id: i.id, kind: 'intervention', label: i.title, group: 'Interventions', icon: 'solar:checklist-minimalistic-linear', meta: i.status })),
    ...(plan?.barriers || []).map(b => ({ id: b.id, kind: 'barrier', label: b.title, group: 'Barriers', icon: 'custom:barrier', meta: b.status })),
  ].filter(l => l.id != null && l.label), [plan]);
  return { mentionUsers, links };
}

/**
 * A saved note's tags and links, read back from its HTML so a chip deleted
 * after it was picked is not counted. `text` is the note as plain text, for
 * the note_linked rows the store writes on each linked item.
 */
export function noteDetails(html) {
  const root = new DOMParser().parseFromString(html || '', 'text/html').body;
  return { html: html || '', mentions: collectMentions(root), links: collectLinks(root), text: serializePlain(root).trim() };
}

// The editor's starting value for a saved note: its HTML when it has one,
// otherwise the plain text with its line breaks kept.
export function noteEditorValue(note) {
  if (note?.meta?.html) return note.meta.html;
  const div = document.createElement('div');
  div.textContent = note?.detail || '';
  return div.innerHTML.replace(/\n/g, '<br>');
}
