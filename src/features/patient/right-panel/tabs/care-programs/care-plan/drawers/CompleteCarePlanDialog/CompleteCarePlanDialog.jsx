import { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { Select } from '@/components/Select/Select';
import { Input } from '@/components/Input/Input';
import { Checkbox } from '@/components/Checkbox/Checkbox';
import { useAppStore } from '@/store/useAppStore';
import { resolvePatientStoreId } from '@/lib/resolvePatientStoreId';
import { LANGUAGE_FILTER_OPTIONS, memberLanguageLabel } from '@/lib/memberFilters';
import styles from './CompleteCarePlanDialog.module.css';

const NO_USERS = [];
const CHANNELS = ['Portal', 'Mail', 'SMS Link'].map(c => ({ value: c, label: c }));
const LANGUAGES = LANGUAGE_FILTER_OPTIONS.map(l => ({ value: l, label: l }));
// The worklist rows carry the recorded language; `patients` fills in 'en'
// when none is stored, so it is read last.
const PATIENT_SLICES = ['allPatients', 'ccmWorklistMembers', 'snpWorklistMembers', 'hccMembers', 'awvMembers', 'pharmacyWorklistMembers', 'hedisMembers', 'patients'];

// The patient's language as a label, to prefill the copy's language.
function usePatientLanguage(patientId) {
  return useAppStore(s => {
    const id = resolvePatientStoreId(s, patientId);
    for (const key of PATIENT_SLICES) {
      const p = s[key]?.find?.(m => m?.id === id || String(m?.memberId || '') === String(patientId));
      const lang = p && (p.language_preference || p.languages?.[0] || memberLanguageLabel(p.language));
      if (lang) return lang;
    }
    return null;
  });
}

/**
 * Complete a care plan and send it to a provider to sign (care plan redesign
 * prototype): who signs (the program's PCP when they're a user), that the
 * patient agreed, and whether they asked for a copy. The copy is recorded
 * only; nothing is sent yet. Submits { signer, agreement, copy } for
 * completeCarePlan.
 */
export function CompleteCarePlanDialog({ patientId, program, onCancel, onSubmit }) {
  const users = useAppStore(s => s.platformUsers) || NO_USERS;
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  useEffect(() => { fetchPlatformUsers?.(); }, [fetchPlatformUsers]);
  const patientLanguage = usePatientLanguage(patientId);
  const [language, setLanguage] = useState(patientLanguage || '');

  const userOptions = useMemo(() => users
    .filter(u => u?.name)
    .map(u => ({ value: String(u.id ?? u.name), label: u.name }))
    .sort((a, b) => a.label.localeCompare(b.label)), [users]);
  const pcp = users.find(u => u?.name && u.name === program?.pcp);
  const [signerId, setSignerId] = useState(pcp ? String(pcp.id ?? pcp.name) : '');
  const [agreed, setAgreed] = useState(false);
  const [agreement, setAgreement] = useState('');
  const [copy, setCopy] = useState(true);
  const [channel, setChannel] = useState('Portal');
  const [largePrint, setLargePrint] = useState(false);
  const signer = users.find(u => String(u.id ?? u.name) === signerId) || null;

  return (
    <ConfirmDialog
      variant="primary"
      align="start"
      icon="solar:pen-2-linear"
      iconColor="var(--primary-300)"
      title="Complete Care Plan"
      description="You complete it; the provider you pick signs it. Until then the plan reads Awaiting signature, and editing it means completing it again."
      confirmLabel="Send to Sign"
      confirmDisabled={!signer || !agreed}
      onCancel={onCancel}
      onConfirm={() => onSubmit?.({
        signer: { id: signer.id ?? null, name: signer.name },
        agreement,
        copy: copy ? { channel, language: language || null, largePrint } : null,
      })}
    >
      <div className={styles.form}>
        {/* portal: inside the modal the menu would be clipped by the dialog. */}
        <Select
          portal
          label="Provider who signs"
          required
          searchable
          placeholder="Pick a provider"
          options={userOptions}
          value={signerId}
          onValueChange={setSignerId}
        />

        <div className={styles.group}>
          <label className={styles.check}>
            <Checkbox checked={agreed} onCheckedChange={v => setAgreed(!!v)} />
            <span>Patient agreed to the plan</span>
          </label>
          {agreed && (
            <Input
              label="How they agreed (optional)"
              placeholder="e.g. Verbally on today's call, daughter interpreting"
              value={agreement}
              onChange={e => setAgreement(e.target.value)}
            />
          )}
        </div>

        <div className={styles.group}>
          <label className={styles.check}>
            <Checkbox checked={copy} onCheckedChange={v => setCopy(!!v)} />
            <span>Patient wants a copy</span>
          </label>
          {copy && (
            <>
              <div className={styles.copyRow}>
                <Select portal label="Send by" options={CHANNELS} value={channel} onValueChange={setChannel} />
                <Select portal label="Language" searchable placeholder="Pick a language" options={LANGUAGES} value={language} onValueChange={setLanguage} />
                <label className={styles.check}>
                  <Checkbox checked={largePrint} onCheckedChange={v => setLargePrint(!!v)} />
                  <span>Large print</span>
                </label>
              </div>
              <p className={styles.hint}>
                Recorded with the plan. Sending from here isn&rsquo;t connected yet, so send the copy yourself.
              </p>
            </>
          )}
        </div>
      </div>
    </ConfirmDialog>
  );
}
