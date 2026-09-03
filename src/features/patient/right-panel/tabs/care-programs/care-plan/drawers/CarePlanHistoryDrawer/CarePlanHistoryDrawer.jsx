import { useEffect, useMemo } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { Timeline } from '../../../../../../../../components/Timeline/Timeline';
import { useAppStore } from '../../../../../../../../store/useAppStore';

const TYPE_LABEL = { goal: 'Goal', intervention: 'Intervention', share: 'Share', plan: 'Plan' };
const ACTION_LABEL = {
  created: 'Created', updated: 'Edited', status_changed: 'Status changed',
  deleted: 'Removed', shared: 'Shared', signed: 'Signed', note: 'Note', restored: 'Restored',
};
// Timeline styles created/updated/deleted natively; the rest get per-entry
// icon overrides.
const ICON_OVERRIDE = {
  status_changed: { icon: 'solar:refresh-linear', iconBg: 'var(--primary-100)', iconColor: 'var(--primary-300)' },
  shared: { icon: 'solar:share-linear', iconBg: 'var(--status-info-light)', iconColor: 'var(--status-info)' },
  signed: { icon: 'solar:pen-2-linear', iconBg: 'var(--status-success-light)', iconColor: 'var(--status-success)' },
  restored: { icon: 'custom:history', iconBg: 'var(--primary-100)', iconColor: 'var(--primary-300)' },
};
const TIMELINE_ACTION = { created: 'created', updated: 'updated', deleted: 'deleted', status_changed: 'updated', shared: 'note', signed: 'created', note: 'note', restored: 'updated' };

// Read-only history of everything that happened to this program's care plan —
// edits, status changes, removals and shares (roadmap #9).
export function CarePlanHistoryDrawer({ patientId, program, onClose }) {
  const fetchCarePlanAudit = useAppStore(s => s.fetchCarePlanAudit);
  const key = `${patientId}::${program.id}`;
  const entries = useAppStore(s => s.patientCarePlanAudit[key]);
  const loading = useAppStore(s => s.patientCarePlanAuditLoading[key]);
  const currentUserName = useAppStore(s => s.currentUserProfile?.name);

  useEffect(() => {
    if (entries === undefined) fetchCarePlanAudit(patientId, program.id);
  }, [entries, patientId, program.id, fetchCarePlanAudit]);

  const timelineEntries = useMemo(() => (entries || []).map(e => ({
    id: e.id,
    createdAt: e.createdAt,
    date: e.createdAt ? new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
    time: e.createdAt ? new Date(e.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '',
    user: e.actor,
    action: TIMELINE_ACTION[e.action] || 'note',
    ...(ICON_OVERRIDE[e.action] || {}),
    details: e.summary,
    category: `${TYPE_LABEL[e.entityType] || e.entityType} · ${ACTION_LABEL[e.action] || e.action}${e.detail ? ` — ${e.detail}` : ''}`,
  })), [entries]);

  return (
    <Drawer title="Care Plan History" onClose={onClose}>
      <Timeline
        entries={timelineEntries}
        currentUserName={currentUserName}
        emptyLabel={loading ? 'Loading history…' : 'No care plan activity yet.'}
      />
    </Drawer>
  );
}
