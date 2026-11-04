import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../../../components/Drawer/Drawer';
import { Button } from '../../../../components/Button/Button';
import { Input } from '../../../../components/Input/Input';
import { Select } from '../../../../components/Select/Select';
import { Switch } from '../../../../components/Switch/Switch';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { ConfirmDialog } from '../../../../components/ConfirmDialog/ConfirmDialog';
import { useAppStore } from '../../../../store/useAppStore';
import { matchIpa, unmatchedIpaValues } from '../lib/ipaOverlays';
import styles from './Overlays.module.css';

const splitAliases = (s) => String(s || '').split(',').map(a => a.trim()).filter(Boolean);

function IpaRow({ ipa, patients, onSave, onDelete, canEdit }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [aliases, setAliases] = useState('');
  const startEditing = () => { setName(ipa.name); setAliases(ipa.aliases.join(', ')); setEditing(true); };
  if (editing) {
    return (
      <li className={styles.ipaRow}>
        <div className={styles.ipaEdit}>
          <Input label="Name" value={name} onChange={e => setName(e.target.value)} />
          <Input label="Also recorded as" value={aliases} onChange={e => setAliases(e.target.value)} placeholder="Comma-separated spellings" />
        </div>
        <div className={styles.ipaActions}>
          <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
          <Button size="sm" disabled={!name.trim()} onClick={async () => { if (await onSave({ ...ipa, name, aliases: splitAliases(aliases) })) setEditing(false); }}>Save</Button>
        </div>
      </li>
    );
  }
  return (
    <li className={styles.ipaRow}>
      <div className={styles.ipaMain}>
        <span className={styles.ipaName}>{ipa.name}</span>
        <span className={styles.muted}>
          {[`${patients} patient${patients === 1 ? '' : 's'}`, ipa.aliases.length ? `Also: ${ipa.aliases.join(', ')}` : null].filter(Boolean).join(' • ')}
        </span>
      </div>
      {canEdit && (
        <div className={styles.ipaActions}>
          <Switch checked={ipa.active} onChange={v => onSave({ ...ipa, active: v })} ariaLabel={`${ipa.name} active`} />
          <ActionButton icon="solar:pen-linear" size="sm" tooltip="Edit" onClick={startEditing} />
          <ActionButton icon="solar:trash-bin-trash-linear" size="sm" tooltip="Delete" onClick={() => onDelete(ipa)} />
        </div>
      )}
    </li>
  );
}

/**
 * The account's IPA registry: names, the spellings patients are recorded
 * with, and the recorded values no IPA covers yet (add them as an alias).
 */
export function IpaRegistryDrawer({ onClose, canEdit }) {
  const ipas = useAppStore(s => s.ipas);
  const saveIpa = useAppStore(s => s.saveIpa);
  const deleteIpa = useAppStore(s => s.deleteIpa);
  const fetchIpaValueCounts = useAppStore(s => s.fetchIpaValueCounts);
  const [counts, setCounts] = useState([]);
  const [newName, setNewName] = useState('');
  const [newAliases, setNewAliases] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [aliasTarget, setAliasTarget] = useState({});

  useEffect(() => { fetchIpaValueCounts().then(setCounts); }, [fetchIpaValueCounts]);

  const patientsOf = useMemo(() => {
    const m = new Map();
    for (const c of counts) { const ipa = matchIpa(c.value, ipas); if (ipa) m.set(ipa.id, (m.get(ipa.id) || 0) + c.n); }
    return m;
  }, [counts, ipas]);
  const unmatched = unmatchedIpaValues(counts, ipas);
  const save = ({ id, ...v }) => saveIpa(v, id);

  return (
    <Drawer title="IPAs" onClose={onClose}>
      <div className={styles.stack}>
        <p className={styles.lead}>Each IPA can have its own overlay on a care plan template. Patients map to an IPA by the IPA recorded on them, by name or by one of its other spellings.</p>
        <ul className={styles.ipaList}>
          {ipas.map(ipa => (
            <IpaRow key={ipa.id} ipa={ipa} patients={patientsOf.get(ipa.id) || 0} onSave={save} onDelete={setDeleting} canEdit={canEdit} />
          ))}
        </ul>
        {canEdit && (
          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>Add an IPA</h4>
            <div className={styles.ipaEdit}>
              <Input label="Name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Prospect Medical Group" />
              <Input label="Also recorded as" value={newAliases} onChange={e => setNewAliases(e.target.value)} placeholder="Comma-separated spellings" />
            </div>
            <div>
              <Button variant="outline" size="sm" disabled={!newName.trim()} onClick={async () => {
                if (await saveIpa({ name: newName, aliases: splitAliases(newAliases) })) { setNewName(''); setNewAliases(''); }
              }}>Add IPA</Button>
            </div>
          </section>
        )}
        {unmatched.length > 0 && (
          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>IPA values on patients that no IPA covers</h4>
            <ul className={styles.ipaList}>
              {unmatched.map(u => (
                <li key={u.value} className={styles.ipaRow}>
                  <div className={styles.ipaMain}>
                    <span className={styles.ipaName}>{u.value}</span>
                    <span className={styles.muted}>{u.n} patient{u.n === 1 ? '' : 's'}</span>
                  </div>
                  {canEdit && (
                    <div className={styles.ipaActions}>
                      <Select
                        portal
                        options={ipas.map(i => ({ value: i.id, label: i.name }))}
                        value={aliasTarget[u.value] || ''}
                        onValueChange={v => setAliasTarget(t => ({ ...t, [u.value]: v }))}
                        placeholder="Spelling of…"
                      />
                      <Button variant="outline" size="sm" disabled={!aliasTarget[u.value]} onClick={() => {
                        const ipa = ipas.find(i => i.id === aliasTarget[u.value]);
                        if (ipa) save({ ...ipa, aliases: [...ipa.aliases, u.value] });
                      }}>Add as spelling</Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      {deleting && (
        <ConfirmDialog
          variant="destructive"
          title={`Delete ${deleting.name}?`}
          description="Its template overlays are deleted too. Plans already built with them keep what they have."
          confirmLabel="Delete"
          onCancel={() => setDeleting(null)}
          onConfirm={async () => { await deleteIpa(deleting.id); setDeleting(null); }}
        />
      )}
    </Drawer>
  );
}
