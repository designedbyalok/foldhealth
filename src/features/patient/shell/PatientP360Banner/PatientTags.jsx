import { useEffect, useState } from 'react';
import { Drawer } from '../../../../components/Drawer/Drawer';
import { Button } from '../../../../components/Button/Button';
import { Input } from '../../../../components/Input/Input';
import { Badge } from '../../../../components/Badge/Badge';
import { Icon } from '../../../../components/Icon/Icon';
import { Checkbox } from '../../../../components/Checkbox/Checkbox';
import { toast } from '../../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../../store/useAppStore';
import { tagBadgeStyle } from '../../../settings/member-leads/tags/contactTags';
import styles from './PatientTags.module.css';

/** The patient's tags (Settings > Member/Leads > Tags), loaded on mount. */
function usePatientTags(patientId) {
  const key = patientId == null ? null : String(patientId);
  const all = useAppStore(s => s.contactTags);
  const ids = useAppStore(s => (key ? s.patientTags[key] : null));
  const fetchContactTags = useAppStore(s => s.fetchContactTags);
  const fetchPatientTags = useAppStore(s => s.fetchPatientTags);
  useEffect(() => { fetchContactTags(); }, [fetchContactTags]);
  useEffect(() => { if (key) fetchPatientTags(key); }, [key, fetchPatientTags]);
  return { all, tags: (ids || []).map(id => all.find(t => t.id === id)).filter(Boolean), ids: ids || [] };
}

/**
 * The patient's tags as pills in their colour, each with a remove ×.
 */
export function PatientTagPills({ patientId }) {
  const { tags } = usePatientTags(patientId);
  const removePatientTag = useAppStore(s => s.removePatientTag);
  const remove = async (t) => {
    const ok = await removePatientTag(patientId, t.id);
    if (!ok) toast.error('The tag could not be removed. Try again.');
  };
  return tags.map(t => (
    <span key={t.id} className={styles.pill} style={tagBadgeStyle(t.color)}>
      {t.name}
      <button type="button" className={styles.pillClose} onClick={() => remove(t)} aria-label={`Remove ${t.name} tag`}>
        <Icon name="solar:close-linear" size={12} color="currentColor" />
      </button>
    </span>
  ));
}

/**
 * Add Tag (Figma Jun-July 2025 810:4898): search the practice's tags, the
 * patient's current ones listed first as Added, tick more and Add.
 */
export function AddPatientTagDrawer({ patient, onClose }) {
  const { all, ids } = usePatientTags(patient.id);
  const addPatientTags = useAppStore(s => s.addPatientTags);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState([]);
  const [saving, setSaving] = useState(false);

  const q = query.trim().toLowerCase();
  const matches = (t) => !q || t.name.toLowerCase().includes(q);
  const added = all.filter(t => ids.includes(t.id) && matches(t));
  const rest = all.filter(t => !ids.includes(t.id) && matches(t));
  const toggle = (id) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));

  const add = async () => {
    if (!picked.length || saving) return;
    setSaving(true);
    const ok = await addPatientTags(patient.id, picked);
    setSaving(false);
    if (!ok) { toast.error('Tags could not be added. Try again.'); return; }
    toast.success(picked.length === 1 ? 'Tag Added Successfully' : 'Tags Added Successfully');
    onClose();
  };

  return (
    <Drawer
      title="Add Tag"
      onClose={onClose}
      primaryAction={(
        <Button onClick={add} disabled={!picked.length || saving} disabledReason={!picked.length ? 'Pick a tag to add' : null}>
          Add
        </Button>
      )}
    >
      <div className={styles.body}>
        <Input
          type="search"
          leadingIcon="solar:magnifer-linear"
          placeholder="Search Tag"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Search tags"
        />
        {added.length > 0 && (
          <div className={styles.group}>
            <span className={styles.groupLabel}>Already Added</span>
            {added.map(t => (
              <div key={t.id} className={styles.option}>
                <Checkbox checked disabled aria-label={`${t.name} (added)`} />
                <span className={styles.optionName}>{t.name}</span>
                <Badge size="sm" label="Added" />
              </div>
            ))}
            <span className={styles.divider} />
          </div>
        )}
        <div className={styles.group}>
          {rest.map(t => (
            <label key={t.id} className={`${styles.option} ${styles.optionPick}`}>
              <Checkbox checked={picked.includes(t.id)} onCheckedChange={() => toggle(t.id)} aria-label={t.name} />
              <span className={styles.optionName}>{t.name}</span>
            </label>
          ))}
          {!rest.length && !added.length && <span className={styles.none}>No tags match &ldquo;{query}&rdquo;</span>}
        </div>
      </div>
    </Drawer>
  );
}
