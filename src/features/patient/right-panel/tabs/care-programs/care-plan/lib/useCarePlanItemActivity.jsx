import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../../../../../../store/useAppStore';
import { activityEntries, isStructuralRow } from './carePlanHistory';
import { carePlanLogItem, versionContext } from './carePlanLogItem';
import { NOTE_ACTIONS } from './carePlanVersions';

const NOUN = { goal: 'Goal', intervention: 'Intervention', barrier: 'Barrier' };
const MM_DD_YYYY = { month: '2-digit', day: '2-digit', year: 'numeric' };
const HH_MM = { hour: 'numeric', minute: '2-digit' };
const ms = iso => (iso ? new Date(iso).getTime() : 0);

// "Label: from → to" in an audit row's detail.
function arrowParts(detail) {
  const parts = (detail || '').split('→');
  if (parts.length !== 2) return null;
  const m = /^([A-Za-z][^:]{0,39}): (.*)$/.exec(parts[0].trim());
  return { label: m ? m[1] : '', from: (m ? m[2] : parts[0]).trim() || 'None', to: parts[1].trim() || 'None' };
}

// An Edit-drawer change to the item itself (target, category, links…), worded
// the way the Care Plan History words its changes.
function structuralEntry(r) {
  const noun = NOUN[r.entityType] || 'Item';
  const subject = `${noun}: ${r.summary || ''}`;
  const base = { id: `s-${r.id}`, kind: 'activity', entityType: r.entityType, at: r.createdAt, actor: r.actor || '' };
  if (r.action === 'created' || r.action === 'deleted') {
    const action = r.action === 'created' ? 'Added' : 'Removed';
    return { ...base, type: r.action, headline: `${action} ${subject}`, headlineAction: action, headlineSubject: subject };
  }
  const change = arrowParts(r.detail);
  if (change) {
    const action = `${change.label || 'Details'} Changed for`;
    return { ...base, type: 'title', from: change.from, to: change.to, headline: `${action} ${subject}`, headlineAction: action, headlineSubject: subject };
  }
  return { ...base, type: 'edit', detail: r.detail || '', headline: `${noun} Updated`, headlineAction: 'Updated', headlineSubject: subject };
}

/**
 * A goal's, intervention's or barrier's activity, entry for entry as the
 * Care Plan History draws it: live changes as pills, readings, notes behind
 * "View Note", Edit-drawer changes, each tagged with the plan version it
 * happened on. `ids` are the items whose rows belong (a goal passes its
 * linked interventions and barriers too). Entries carry `action` and
 * `createdAt` for CarePlanActivityBlock's filters and month groups.
 */
export function useCarePlanItemActivity({ patientId, program, audit, ids, goals = [], measurements = [] }) {
  const key = patientId && program ? `${patientId}::${program.id}` : null;
  const versions = useAppStore(s => (key ? s.patientCarePlanVersions[key] : undefined));
  const fetchCarePlanVersions = useAppStore(s => s.fetchCarePlanVersions);
  useEffect(() => {
    if (key && versions === undefined) fetchCarePlanVersions(patientId, program.id);
  }, [key, versions, patientId, program?.id, fetchCarePlanVersions]);

  const [openNotes, setOpenNotes] = useState(() => new Set());
  const toggleNote = useCallback(id => setOpenNotes(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  }), []);

  const idKey = [...(ids || [])].map(String).sort().join('|');
  return useMemo(() => {
    const idSet = new Set(idKey ? idKey.split('|') : []);
    const rows = (audit || [])
      .filter(a => a.entityType !== 'plan' && a.entityId != null && idSet.has(String(a.entityId)))
      .sort((x, y) => ms(y.createdAt) - ms(x.createdAt));
    const actionOf = new Map(rows.map(r => [`a-${r.id}`, NOTE_ACTIONS.has(r.action) || r.action === 'note_linked' ? 'note' : r.action]));
    const entries = [
      ...activityEntries(rows, measurements, goals).filter(e => e.type !== 'plan_event'),
      ...rows.filter(isStructuralRow).map(structuralEntry),
    ].sort((x, y) => ms(y.at) - ms(x.at));

    const signed = [...(versions || [])].sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
    const current = signed[0]?.versionNumber ?? null;
    return entries.map((e) => {
      const d = e.at ? new Date(e.at) : null;
      const on = signed.find(v => ms(v.createdAt) <= ms(e.at))?.versionNumber ?? null;
      const item = carePlanLogItem(e, {
        meta: {
          date: d ? d.toLocaleDateString('en-US', MM_DD_YYYY) : null,
          time: d ? d.toLocaleTimeString('en-US', HH_MM) : null,
          by: e.actor || null,
          context: versions ? versionContext(on, on != null && on === current) : undefined,
        },
        noteOpen: openNotes.has(e.id),
        onToggleNote: () => toggleNote(e.id),
      });
      if (e.type === 'created' || e.type === 'deleted') {
        item.icon = e.type === 'created' ? 'solar:add-circle-linear' : 'solar:minus-circle-linear';
        item.avatarVariant = e.type === 'created' ? 'success' : 'error';
        item.outcome = undefined;
      }
      if (e.type === 'edit') item.icon = 'solar:pen-linear';
      return {
        ...item,
        createdAt: e.at,
        action: e.type === 'value' ? 'value_changed' : (actionOf.get(e.id) || e.type),
      };
    });
  }, [audit, idKey, goals, measurements, versions, openNotes, toggleNote]);
}
