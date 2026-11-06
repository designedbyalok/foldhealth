import { useState } from 'react';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { Input } from '../../../components/Input/Input';
import { Textarea } from '../../../components/Textarea/Textarea';
import { useAppStore } from '../../../store/useAppStore';
import { useCan } from '../../../lib/useCan';
import { MEASURE_NAMES } from '../../hedis-worklist/ClinicalNotePanel.utils';
import { useMobileNav } from '../MobileNavContext';
import { FieldGroup, FormScreen } from './FormScreen';
import { usePatient } from './usePatient';
import styles from './patientForm.module.css';

/**
 * New Clinical Note (non-visit), the free-form shape of the desktop
 * NonVisitNoteDrawer: title + body, optional open care gaps, saved through
 * upsertClinicalNote as a draft or signed. Signing needs "Sign and Amend EHR
 * Notes" (notes:sign), as on the desktop note panel; without it only the
 * draft can be saved.
 */
export function ClinicalNoteScreen({ patientId }) {
  const { pop } = useMobileNav();
  const patient = usePatient(patientId);
  const upsertClinicalNote = useAppStore(s => s.upsertClinicalNote);
  const showToast = useAppStore(s => s.showToast);
  const hedisMembers = useAppStore(s => s.hedisMembers);
  const can = useCan();
  const signAllowed = can('notes:sign');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [gaps, setGaps] = useState([]);
  const [saving, setSaving] = useState(null);

  const memberIdStr = patient?.memberId != null ? String(patient.memberId) : null;
  const hedisMember = hedisMembers?.find(m => m.id === patient?.id || (memberIdStr && String(m.memberId) === memberIdStr));
  const hedisMemberId = hedisMember?.id || patient?.id || patientId;
  const openGaps = (hedisMember?.gaps || []).filter(g => g.code && g.status !== 'Completed').map(g => g.code);
  const valid = !!title.trim() && !!body.trim();

  const toggleGap = (code) => setGaps(g => (g.includes(code) ? g.filter(c => c !== code) : [...g, code]));
  const gapSet = new Set(gaps);

  const save = async (status) => {
    if (!valid) { showToast?.('Title and note body are required'); return; }
    setSaving(status);
    try {
      const saved = await upsertClinicalNote({
        hedisMemberId,
        patientId: patient?.id ?? patientId,
        gapCodes: gaps,
        formType: 'non_visit_note',
        formId: null,
        status,
        payload: { dateOfService: new Date().toISOString().slice(0, 10), title: title.trim(), body: body.trim() },
        originKind: 'patient',
        originRef: String(patient?.id ?? patientId),
      });
      if (saved) {
        showToast?.(status === 'signed' ? 'Note signed' : 'Draft saved');
        pop();
      } else {
        showToast?.('Save failed: check console');
      }
    } finally {
      setSaving(null);
    }
  };

  return (
    <FormScreen
      title="Clinical Note"
      subtitle={patient?.name}
      footer={(
        <>
          <Button size="lg" variant={signAllowed ? 'outline' : 'solid'} fullWidth disabled={!!saving} loading={saving === 'draft'} onClick={() => save('draft')}>
            Save as Draft
          </Button>
          {signAllowed && (
            <Button size="lg" fullWidth disabled={!valid || !!saving} loading={saving === 'signed'} onClick={() => save('signed')}>
              Sign &amp; Save
            </Button>
          )}
        </>
      )}
    >
      <p className={styles.notice}>
        <Icon name="solar:info-circle-linear" size={20} color="currentColor" />
        <span>Non-visit notes skip the Reviewer flow. {signAllowed ? 'Sign to lock, or save a draft to keep editing.' : 'You can save a draft; signing needs the Sign and Amend EHR Notes permission.'}</span>
      </p>
      <Input label="Title" required size="lg" enterKeyHint="next" placeholder="Short summary of the note" value={title} onValueChange={setTitle} />
      <Textarea title="Note" mandatory rows={10} placeholder="Write the clinical note" value={body} onValueChange={setBody} />
      {openGaps.length > 0 && (
        <FieldGroup label="Related Care Gaps">
          <div className={styles.chips}>
            {openGaps.map(code => (
              <button
                key={code}
                type="button"
                aria-pressed={gapSet.has(code)}
                className={`${styles.chip} ${gapSet.has(code) ? styles.chipOn : ''}`}
                onClick={() => toggleGap(code)}
              >
                {gapSet.has(code) && <Icon name="solar:check-circle-linear" size={20} color="currentColor" />}
                {code}{MEASURE_NAMES[code] ? `: ${MEASURE_NAMES[code]}` : ''}
              </button>
            ))}
          </div>
        </FieldGroup>
      )}
    </FormScreen>
  );
}
