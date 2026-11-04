import { useState } from 'react';
import { ConfirmDialog } from '../../../../../components/ConfirmDialog/ConfirmDialog';
import { DatePicker } from '../../../../../components/DatePicker/DatePicker';
import { RadioOptionGroup } from '../../../../../components/RadioOptionGroup/RadioOptionGroup';
import { Select } from '../../../../../components/Select/Select';
import { Textarea } from '../../../../../components/Textarea/Textarea';
import { formatRetireDate, replacementOptions, retirementToday } from '../../lib/templateRetirement';
import styles from './CarePlanLibraryPanel.module.css';

const tomorrowOf = (iso) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Retire a template: it stops being offered for new plans, plans using it
 * keep it. Now, or on a future day (it stays in use until then, with a
 * warning). The replacement ("Use Diabetes v2 instead") or an explicit "No
 * replacement" has to be chosen; a replacement is shown on those plans and
 * used by automations in its place.
 */
export function RetireTemplateDialog({ template, templates, onCancel, onConfirm }) {
  const [when, setWhen] = useState('now');
  const [retireOn, setRetireOn] = useState('');
  const [replacing, setReplacing] = useState('');
  const [replacementId, setReplacementId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const options = replacementOptions(template, templates);
  const firstDay = tomorrowOf(retirementToday());
  const scheduled = when === 'date';
  const ready = (!scheduled || retireOn >= firstDay)
    && (replacing === 'none' || (replacing === 'template' && !!replacementId));

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm({
        replacementId: replacing === 'template' ? replacementId : null,
        reason,
        retireOn: scheduled ? retireOn : null,
      });
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
      confirmLabel={scheduled && retireOn ? `Retire on ${formatRetireDate(retireOn)}` : 'Retire Template'}
      confirmDisabled={!ready}
      loading={busy}
      className={styles.retireDialog}
      onCancel={onCancel}
      onConfirm={confirm}
    >
      <div className={styles.retireFields}>
        <RadioOptionGroup
          label="When"
          name="retire-when"
          value={when}
          onChange={setWhen}
          options={[
            { value: 'now', label: 'Retire now' },
            {
              value: 'date',
              label: 'On a date',
              hint: 'It stays in use until then, marked "Retiring on" for anyone picking it.',
              content: (
                <DatePicker
                  aria-label="Retirement date"
                  value={retireOn}
                  min={firstDay}
                  onSelect={setRetireOn}
                  placeholder="MM/DD/YYYY"
                />
              ),
            },
          ]}
        />
        <RadioOptionGroup
          label="Replacement"
          name="retire-replacement"
          value={replacing}
          onChange={setReplacing}
          options={[
            {
              value: 'template',
              label: 'Use another template instead',
              hint: 'Automations that attach this template attach the replacement instead.',
              disabled: options.length === 0,
              disabledReason: 'No other published template to use instead',
              content: (
                <Select
                  portal
                  searchable
                  placeholder="Select a template"
                  options={options.map(t => ({ value: t.id, label: t.name }))}
                  value={replacementId}
                  onValueChange={setReplacementId}
                />
              ),
            },
            {
              value: 'none',
              label: 'No replacement',
              hint: 'Plans keep it and automations stop attaching it.',
            },
          ]}
        />
        <Textarea
          title="Reason"
          value={reason}
          onValueChange={text => setReason(text)}
          placeholder="Optional, e.g. Superseded by the 2027 ADA update"
          rows={2}
          maxLength={300}
        />
      </div>
    </ConfirmDialog>
  );
}
