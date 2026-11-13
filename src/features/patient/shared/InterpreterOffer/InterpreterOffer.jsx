import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Badge } from '@/components/Badge/Badge';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { Input } from '@/components/Input/Input';
import { RadioOptionGroup } from '@/components/RadioOptionGroup/RadioOptionGroup';
import { offerRecord } from './interpreterOfferModel';
import { useInterpreterStatus } from './useInterpreterStatus';
import styles from './InterpreterOffer.module.css';

const BADGE_TONE = { warning: 'warning', success: 'success', neutral: 'neutral' };

/**
 * Interpreter chip for a patient who needs one: "not offered" until the care
 * team records the qualified-interpreter offer, then the patient's choice.
 * Opens the dialog that records it. Nothing for patients who don't need one.
 */
export function InterpreterChip({ patientId, size = 'sm' }) {
  const { prefs, status } = useInterpreterStatus(patientId);
  const [open, setOpen] = useState(false);
  if (!status) return null;
  return (
    <>
      <button type="button" className={styles.chip} onClick={() => setOpen(true)} title={status.label} aria-haspopup="dialog">
        <Badge size={size} tone={BADGE_TONE[status.tone]} icon="solar:translation-linear" label={status.short} chevron />
      </button>
      {open && <InterpreterOfferDialog patientId={patientId} prefs={prefs} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Record that a qualified interpreter was offered, and what the patient chose. */
export function InterpreterOfferDialog({ patientId, prefs, onClose }) {
  const savePatientPreferences = useAppStore(s => s.savePatientPreferences);
  const actor = useAppStore(s => s.currentActorName());
  const showToast = useAppStore(s => s.showToast);
  const language = prefs?.preferredLanguage || '';
  const current = prefs?.interpreterOffer;
  const [choice, setChoice] = useState(current?.status || 'qualified');
  const [name, setName] = useState(current?.name || '');
  const [relationship, setRelationship] = useState(current?.relationship || '');
  const needsName = choice === 'declined' && !name.trim();

  const save = async () => {
    if (needsName) return;
    await savePatientPreferences(patientId, { interpreterOffer: offerRecord({ status: choice, language, name, relationship, recordedBy: actor }) });
    showToast?.(choice === 'qualified' ? 'Qualified interpreter recorded' : 'Patient’s choice of interpreter recorded');
    onClose();
  };

  return (
    <ConfirmDialog
      variant="primary"
      align="start"
      icon="solar:translation-linear"
      title={`Offer a qualified ${language || ''} interpreter`.replace(/\s+/g, ' ')}
      description="Offer a qualified interpreter at no cost. A family member can interpret only if the patient asks for that after the offer."
      confirmLabel="Save"
      confirmDisabled={needsName}
      onConfirm={save}
      onCancel={onClose}
    >
      <RadioOptionGroup
        label="The patient's choice"
        value={choice}
        onChange={setChoice}
        options={[
          { value: 'qualified', label: 'Accepted a qualified interpreter', hint: 'Book one for calls and visits.' },
          {
            value: 'declined',
            label: 'Declined, and asked for a family member or friend',
            content: (
              <div className={styles.who}>
                <Input label="Name" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Lucia" />
                <Input label="Relationship" value={relationship} onChange={e => setRelationship(e.target.value)} placeholder="e.g. Daughter" />
              </div>
            ),
          },
        ]}
      />
    </ConfirmDialog>
  );
}
