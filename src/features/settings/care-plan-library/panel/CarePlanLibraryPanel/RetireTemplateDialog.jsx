import { useState } from 'react';
import { ConfirmDialog } from '../../../../../components/ConfirmDialog/ConfirmDialog';
import { Select } from '../../../../../components/Select/Select';
import { Textarea } from '../../../../../components/Textarea/Textarea';
import { replacementOptions } from '../../lib/templateRetirement';
import styles from './CarePlanLibraryPanel.module.css';

const NO_REPLACEMENT = '';

/**
 * Retire a template: it stops being offered for new plans, plans using it
 * keep it. An optional replacement ("Use Diabetes v2 instead") is shown on
 * those plans and used by automations in its place.
 */
export function RetireTemplateDialog({ template, templates, onCancel, onConfirm }) {
  const [replacementId, setReplacementId] = useState(NO_REPLACEMENT);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const options = replacementOptions(template, templates);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm({ replacementId: replacementId || null, reason });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      variant="warning"
      icon="solar:archive-down-linear"
      title={`Retire "${template.name}"?`}
      description="It is no longer offered for new care plans. Plans already using it keep it, with a note pointing to the replacement. You can restore it from Retired Templates."
      confirmLabel="Retire Template"
      loading={busy}
      onCancel={onCancel}
      onConfirm={confirm}
    >
      <div className={styles.retireFields}>
        <Select
          label="Use instead"
          portal
          searchable
          placeholder="No replacement"
          options={[
            { value: NO_REPLACEMENT, label: 'No replacement' },
            ...options.map(t => ({ value: t.id, label: t.name })),
          ]}
          value={replacementId}
          onChange={setReplacementId}
          helperText="Automations that attach this template attach the replacement instead."
        />
        <Textarea
          title="Reason"
          value={reason}
          onChange={text => setReason(text)}
          placeholder="Optional, e.g. Superseded by the 2027 ADA update"
          rows={2}
          maxLength={300}
        />
      </div>
    </ConfirmDialog>
  );
}
