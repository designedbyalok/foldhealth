import { useEffect, useMemo } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { Badge } from '../../../../../../../../components/Badge/Badge';
import { RingEmptyState } from '../../../../../../../../components/RingEmptyState/RingEmptyState';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import styles from './CarePlanLinkDrawer.module.css';

const apptLabel = (a) => `${a.appointment_type_name || 'Appointment'}${a.date ? ` · ${new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}`;

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

  const Row = ({ type, id, icon, title, meta }) => {
    const linked = !!isLinked(type, id);
    return (
      <button type="button" className={styles.row} onClick={() => toggle(type, id, title)}>
        <span className={styles.rowIcon}><Icon name={icon} size={16} color="var(--neutral-400)" /></span>
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>{title}</span>
          {meta && <span className={styles.rowMeta}>{meta}</span>}
        </span>
        {linked
          ? <Badge tone="green" size="S" label="Linked" />
          : <span className={styles.addLink}><Icon name="solar:add-circle-linear" size={16} color="var(--primary-300)" />Link</span>}
      </button>
    );
  };

  return (
    <Drawer title="Link Items" onClose={onClose}>
      <div className={styles.body}>
        <div className={styles.ownerLine}>
          Linking to <strong>{owner.item.title}</strong>
          {ownerLinks.length > 0 && <Badge tone="grey" size="S" label={`${ownerLinks.length} linked`} />}
        </div>

        <div className={styles.section}>
          <span className={styles.sectionTitle}>Tasks</span>
          {patientTasks.length === 0
            ? <div className={styles.empty}>No tasks for this patient.</div>
            : patientTasks.map(t => (
              <Row key={`t-${t.id}`} type="task" id={t.id} icon="solar:checklist-minimalistic-linear" title={t.name} meta={t.status} />
            ))}
        </div>

        <div className={styles.section}>
          <span className={styles.sectionTitle}>Appointments</span>
          {patientAppointments.length === 0
            ? <div className={styles.empty}>No appointments for this patient.</div>
            : patientAppointments.map(a => (
              <Row key={`a-${a.id}`} type="appointment" id={a.id} icon="solar:calendar-linear" title={apptLabel(a)} meta={a.mode || a.location} />
            ))}
        </div>

        {patientTasks.length === 0 && patientAppointments.length === 0 && (
          <RingEmptyState icon="solar:link-linear" label="Nothing to link yet" />
        )}
      </div>
    </Drawer>
  );
}
