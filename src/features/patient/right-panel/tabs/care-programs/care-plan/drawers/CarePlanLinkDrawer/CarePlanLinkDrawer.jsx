import { useEffect, useMemo } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { Badge } from '../../../../../../../../components/Badge/Badge';
import { EmptyState } from '../../../../../../../../components/EmptyState/EmptyState';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import styles from './CarePlanLinkDrawer.module.css';
import { parseLocalDate } from '../../../../../../../../lib/localDate';

const apptLabel = (a) => {
  const d = parseLocalDate(a.date);
  return `${a.appointment_type_name || 'Appointment'}${d ? ` · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}`;
};

function CarePlanLinkRow({ type, id, icon, title, meta, linked, onToggle }) {
  return (
    <button type="button" className={styles.row} onClick={() => onToggle(type, id, title)}>
      <span className={styles.rowIcon}><Icon name={icon} size={16} color="var(--neutral-400)" /></span>
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{title}</span>
        {meta && <span className={styles.rowMeta}>{meta}</span>}
      </span>
      {linked
        ? <Badge tone="success" size="sm" label="Linked" />
        : <span className={styles.addLink}><Icon name="solar:add-circle-linear" size={16} color="var(--primary-300)" />Link</span>}
    </button>
  );
}

// Link existing tasks & appointments to one goal/intervention/barrier (#11).
// The owner is { kind: 'goal'|'intervention'|'barrier', item }.
export function CarePlanLinkDrawer({ patientId, program, patientName, owner, onClose }) {
  const tasks = useAppStore(s => s.tasks);
  const fetchTasks = useAppStore(s => s.fetchTasks);
  const appointments = useAppStore(s => s.appointments);
  const fetchAppointments = useAppStore(s => s.fetchAppointments);
  const addCarePlanLink = useAppStore(s => s.addCarePlanLink);
  const removeCarePlanLink = useAppStore(s => s.removeCarePlanLink);
  const showToast = useAppStore(s => s.showToast);
  const key = `${patientId}::${program.id}`;
  const links = useAppStore(s => s.patientCarePlanLinks[key]);

  useEffect(() => { fetchTasks?.(); fetchAppointments?.(); }, [fetchTasks, fetchAppointments]);

  const ownerId = String(owner.item.id);
  const ownerLinks = useMemo(() => (links || []).filter(l => l.ownerId === ownerId), [links, ownerId]);
  const isLinked = (type, id) => ownerLinks.find(l => l.entityType === type && l.entityId === String(id));

  const patientTasks = useMemo(
    () => (tasks || []).filter(t => t.member && patientName && t.member === patientName),
    [tasks, patientName],
  );
  const patientAppointments = useMemo(
    () => (appointments || []).filter(a => String(a.patient_id) === String(patientId)),
    [appointments, patientId],
  );

  const toggle = async (type, id, label) => {
    const existing = isLinked(type, id);
    if (existing) {
      await removeCarePlanLink(patientId, program.id, existing.id);
    } else {
      const saved = await addCarePlanLink(patientId, program, { ownerType: owner.kind, ownerId, entityType: type, entityId: id, entityLabel: label });
      if (saved) showToast('Linked');
    }
  };

  return (
    <Drawer title="Link Items" onClose={onClose}>
      <div className={styles.body}>
        <div className={styles.ownerLine}>
          Linking to <strong>{owner.item.title}</strong>
          {ownerLinks.length > 0 && <Badge size="sm" label={`${ownerLinks.length} linked`} />}
        </div>

        <div className={styles.section}>
          <span className={styles.sectionTitle}>Tasks</span>
          {patientTasks.length === 0
            ? <div className={styles.empty}>No tasks for this patient.</div>
            : patientTasks.map(t => (
              <CarePlanLinkRow
                key={`t-${t.id}`}
                type="task"
                id={t.id}
                icon="solar:checklist-minimalistic-linear"
                title={t.name}
                meta={t.status}
                linked={!!isLinked('task', t.id)}
                onToggle={toggle}
              />
            ))}
        </div>

        <div className={styles.section}>
          <span className={styles.sectionTitle}>Appointments</span>
          {patientAppointments.length === 0
            ? <div className={styles.empty}>No appointments for this patient.</div>
            : patientAppointments.map(a => (
              <CarePlanLinkRow
                key={`a-${a.id}`}
                type="appointment"
                id={a.id}
                icon="solar:calendar-linear"
                title={apptLabel(a)}
                meta={a.mode || a.location}
                linked={!!isLinked('appointment', a.id)}
                onToggle={toggle}
              />
            ))}
        </div>

        {patientTasks.length === 0 && patientAppointments.length === 0 && (
          <EmptyState icon="solar:link-linear" title="Nothing to link yet" />
        )}
      </div>
    </Drawer>
  );
}
