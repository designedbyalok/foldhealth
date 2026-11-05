// Same patient match as the Monitoring tab: member id, store id, or name.
export function tasksForPatient(tasks, patient) {
  const memberKey = patient?.memberId ? String(patient.memberId) : null;
  return (tasks || []).filter(t => !t.is_subtask && (
    (memberKey && String(t.patient_id) === memberKey)
    || (patient?.id && String(t.patient_id) === String(patient.id))
    || (patient?.name && t.member === patient.name)
  ));
}
