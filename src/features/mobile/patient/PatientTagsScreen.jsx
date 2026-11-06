import { useState } from 'react';
import { Badge } from '../../../components/Badge/Badge';
import { BottomSheet } from '../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../components/Button/Button';
import { Checkbox } from '../../../components/Checkbox/Checkbox';
import { Icon } from '../../../components/Icon/Icon';
import { Input } from '../../../components/Input/Input';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { tagBadgeStyle } from '../../settings/member-leads/tags/contactTags';
import { FieldGroup, FormScreen } from './FormScreen';
import { usePatient } from './usePatient';
import { usePatientTagList } from './usePatientTagList';
import styles from './patientForm.module.css';
import own from './PatientTagsScreen.module.css';

/**
 * Edit a patient's tags (desktop PatientTags / AddPatientTagDrawer): the
 * current tags with a remove ×, then the practice's other tags to tick and
 * Add. Writes through addPatientTags and removePatientTag.
 */
export function PatientTagsScreen({ patientId }) {
  const patient = usePatient(patientId);
  const { all, ids, tags } = usePatientTagList(patientId);
  const addPatientTags = useAppStore(s => s.addPatientTags);
  const removePatientTag = useAppStore(s => s.removePatientTag);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState([]);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(null);

  const q = query.trim().toLowerCase();
  const onPatient = new Set(ids);
  const rest = all.filter(t => !onPatient.has(t.id) && (!q || t.name.toLowerCase().includes(q)));
  const pickedSet = new Set(picked);
  const toggle = (id) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));

  const add = async () => {
    if (!picked.length || saving) return;
    setSaving(true);
    let ok;
    try {
      ok = await addPatientTags(patientId, picked);
    } finally {
      setSaving(false);
    }
    if (!ok) { toast.error('Tags could not be added. Try again.'); return; }
    toast.success(picked.length === 1 ? 'Tag Added Successfully' : 'Tags Added Successfully');
    setPicked([]);
  };

  const remove = async () => {
    const t = removing;
    setRemoving(null);
    const ok = await removePatientTag(patientId, t.id);
    if (!ok) toast.error('The tag could not be removed. Try again.');
  };

  return (
    <FormScreen
      title="Tags"
      subtitle={patient?.name}
      footer={(
        <Button size="lg" fullWidth disabled={!picked.length || saving} loading={saving} onClick={add}>
          {picked.length > 1 ? `Add ${picked.length} Tags` : 'Add Tag'}
        </Button>
      )}
    >
      <FieldGroup label="On this patient">
        {tags.length === 0 ? <span className={styles.hint}>No tags yet.</span> : (
          <div className={styles.chips}>
            {tags.map(t => (
              <span key={t.id} className={own.pill} style={tagBadgeStyle(t.color)}>
                {t.name}
                <button type="button" className={own.pillClose} aria-label={`Remove ${t.name} tag`} onClick={() => setRemoving(t)}>
                  <Icon name="solar:close-circle-linear" size={20} color="currentColor" />
                </button>
              </span>
            ))}
          </div>
        )}
      </FieldGroup>

      <FieldGroup label="Add tags">
        <Input
          size="lg"
          type="search"
          leadingIcon="solar:magnifer-linear"
          placeholder="Search tags"
          aria-label="Search tags"
          enterKeyHint="search"
          value={query}
          onValueChange={setQuery}
        />
        <div className={own.options}>
          {rest.map(t => (
            <label key={t.id} className={own.option}>
              <Checkbox checked={pickedSet.has(t.id)} onCheckedChange={() => toggle(t.id)} aria-label={t.name} />
              <Badge size="md" variant="soft" label={t.name} style={tagBadgeStyle(t.color)} />
            </label>
          ))}
          {rest.length === 0 && <span className={styles.hint}>{q ? `No tags match "${query}"` : 'Every tag is already on this patient.'}</span>}
        </div>
      </FieldGroup>

      {removing && (
        <BottomSheet title="Remove Tag?" onClose={() => setRemoving(null)}>
          <div className={styles.sheetForm}>
            <p className={styles.sheetText}>Remove &ldquo;{removing.name}&rdquo; from {patient?.name || 'this patient'}?</p>
            <Button size="lg" fullWidth variant="soft" tone="danger" onClick={remove}>Remove</Button>
          </div>
        </BottomSheet>
      )}
    </FormScreen>
  );
}
