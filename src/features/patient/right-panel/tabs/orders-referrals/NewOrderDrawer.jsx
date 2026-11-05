import { useState } from 'react';
import { DatePicker } from '../../../../../components/DatePicker/DatePicker';
import { Drawer } from '../../../../../components/Drawer/Drawer';
import { IcdSearch } from '../../../../../components/IcdSearch/IcdSearch';
import { Input } from '../../../../../components/Input/Input';
import { Select } from '../../../../../components/Select/Select';
import { Textarea } from '../../../../../components/Textarea/Textarea';
import { useAppStore } from '../../../../../store/useAppStore';
import { ORDER_TYPES } from '../../../data/patientOrders';
import { DraftSubmitActions, PriorityField } from './OrderFormParts';
import { runSave } from './ordersViews';
import styles from './OrderForms.module.css';

const OTHER = '__other__';

/** New Order > Lab or Imaging (`type`): saves to patient_orders as Draft or Ordered. */
export function NewOrderDrawer({ patientId, type, onClose }) {
  const config = ORDER_TYPES[type];
  const createPatientOrder = useAppStore(s => s.createPatientOrder);
  const actorName = useAppStore(s => s.currentActorName());
  const [values, setValues] = useState({ pick: '', other: '', reason: '', priority: 'Routine', orderedBy: actorName, dueDate: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const set = key => value => setValues(v => ({ ...v, [key]: value }));
  const addDiagnosis = icd => setValues(v => ({ ...v, reason: [v.reason.trim(), `${icd.code} ${icd.title}`].filter(Boolean).join('\n') }));

  const name = (values.pick === OTHER ? values.other : values.pick).trim();
  const noun = config.fieldLabel.toLowerCase();
  const draftReason = name ? undefined : `Pick a ${noun}`;
  const submitReason = draftReason || (!values.reason.trim() && 'Enter the diagnosis or reason') || undefined;
  const save = status => runSave(setSaving, () => createPatientOrder(patientId, {
    type,
    name,
    reason: values.reason.trim(),
    priority: values.priority,
    status,
    orderedBy: values.orderedBy.trim(),
    dueDate: values.dueDate,
    notes: values.notes.trim(),
  }), onClose);

  const options = [...config.options.map(o => ({ value: o, label: o })), { value: OTHER, label: 'Other' }];

  return (
    <Drawer
      title={config.title}
      onClose={onClose}
      noCloseDivider
      headerRight={(
        <DraftSubmitActions
          submitLabel="Place Order"
          saving={saving}
          draftReason={draftReason}
          submitReason={submitReason}
          onDraft={() => save('Draft')}
          onSubmit={() => save('Ordered')}
        />
      )}
    >
      <div className={styles.form}>
        <Select label={config.fieldLabel} required searchable options={options} value={values.pick} onValueChange={set('pick')} placeholder={`Select ${noun}`} />
        {values.pick === OTHER && (
          <Input label={`${config.fieldLabel} Name`} required placeholder={`Enter ${noun} name`} value={values.other} onChange={e => set('other')(e.target.value)} autoFocus />
        )}
        <div className={styles.field}>
          <span className={styles.label}>Diagnosis</span>
          <IcdSearch onSelect={addDiagnosis} placeholder="Search ICD code or description" />
        </div>
        <Textarea title="Diagnosis / Reason" mandatory rows={3} value={values.reason} onValueChange={set('reason')} placeholder="Enter reason, or add a diagnosis above" />
        <PriorityField name={`${type}-priority`} value={values.priority} onChange={set('priority')} />
        <div className={styles.row}>
          <Input label="Ordered By" value={values.orderedBy} onChange={e => set('orderedBy')(e.target.value)} />
          <DatePicker label="Scheduled / Due Date" value={values.dueDate} onSelect={set('dueDate')} />
        </div>
        <Textarea title="Notes" rows={3} value={values.notes} onValueChange={set('notes')} placeholder="Add notes" />
      </div>
    </Drawer>
  );
}
