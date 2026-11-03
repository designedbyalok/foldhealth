import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../../../components/Drawer/Drawer';
import { Button } from '../../../../components/Button/Button';
import { Input } from '../../../../components/Input/Input';
import { Select } from '../../../../components/Select/Select';
import { Switch } from '../../../../components/Switch/Switch';
import { Badge } from '../../../../components/Badge/Badge';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { Alert } from '../../../../components/Alert/Alert';
import { RadioOptionGroup } from '../../../../components/RadioOptionGroup/RadioOptionGroup';
import { useAppStore } from '../../../../store/useAppStore';
import { GOAL_DURATION_UNITS, GOAL_FREQUENCIES, INTERVENTION_KINDS } from '../lib/aiTemplateDraft';
import { itemKey, overlaySummary } from '../lib/ipaOverlays';
import styles from './Overlays.module.css';

const KINDS = [['goal', 'goals', 'Goals'], ['intervention', 'interventions', 'Interventions'], ['barrier', 'barriers', 'Barriers']];
const PRIORITY_OPTIONS = ['high', 'medium', 'low'].map(p => ({ value: p, label: p[0].toUpperCase() + p.slice(1) }));
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
const uuid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `loc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
const priorityOf = (kind, x) => (kind === 'intervention' ? x.config?.priority || x.priority : x.priority) || 'medium';

/** One template item: include it, and what this IPA changes about it. */
function ItemRow({ kind, item, override, onChange, readOnly }) {
  const o = override || {};
  const set = (patch) => onChange({ ...o, ...patch });
  const hidden = !!o.hidden;
  const base = priorityOf(kind, item);
  return (
    <tr className={hidden ? styles.rowHidden : ''}>
      <td><Switch checked={!hidden} disabled={readOnly} onChange={v => set({ hidden: !v })} ariaLabel={`Include ${item.title}`} /></td>
      <td className={styles.itemCell}>
        <span className={styles.itemTitle}>{item.title}</span>
        <span className={styles.muted}>{[cap(base), kind === 'goal' && item.frequency, kind === 'intervention' && item.kind].filter(Boolean).join(' • ')}</span>
      </td>
      <td>
        <Select portal disabled={hidden || readOnly} options={[{ value: '', label: `Template (${cap(base)})` }, ...PRIORITY_OPTIONS]} value={o.priority || ''} onChange={v => set({ priority: v || undefined })} />
      </td>
      <td>
        {kind === 'goal' ? (
          <div className={styles.cadence}>
            <Select portal disabled={hidden || readOnly} options={[{ value: '', label: item.frequency ? `Template (${item.frequency})` : 'Template' }, ...GOAL_FREQUENCIES.map(f => ({ value: f, label: f }))]} value={o.frequency || ''} onChange={v => set({ frequency: v || undefined })} />
            <Input type="number" min={1} disabled={hidden || readOnly} value={o.duration || ''} onChange={e => set({ duration: e.target.value || undefined })} placeholder={item.duration || 'For'} aria-label="Duration" wrapperClassName={styles.duration} />
            <Select portal disabled={hidden || readOnly || !o.duration} options={GOAL_DURATION_UNITS.map(u => ({ value: u, label: `${u}s` }))} value={o.durationUnit || 'Month'} onChange={v => set({ durationUnit: v })} />
          </div>
        ) : <span className={styles.muted}>-</span>}
      </td>
      <td>
        <Input disabled={hidden || readOnly} value={o.patientTitle || ''} onChange={e => set({ patientTitle: e.target.value || undefined })} placeholder="Same as title" aria-label={`Patient wording for ${item.title}`} />
      </td>
    </tr>
  );
}

/**
 * Edit one IPA's overlay on a care plan template: which items it keeps, their
 * priority and cadence, how they read for patients, its own extra items, and
 * who must sign plans built from it. New overlays pick the template and IPA.
 */
export function OverlayEditorDrawer({ overlay, onClose, canEdit }) {
  const templates = useAppStore(s => s.carePlanTemplates);
  const ipas = useAppStore(s => s.ipas);
  const overlays = useAppStore(s => s.templateOverlays);
  const users = useAppStore(s => s.platformUsers);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  const saveTemplateOverlay = useAppStore(s => s.saveTemplateOverlay);
  const showToast = useAppStore(s => s.showToast);
  const [templateId, setTemplateId] = useState(overlay?.templateId || '');
  const [ipaId, setIpaId] = useState(overlay?.ipaId || '');
  const [overrides, setOverrides] = useState(overlay?.overrides || { items: {}, additions: { goals: [], interventions: [], barriers: [] }, signoff: { mode: 'default', roles: [], people: [] } });
  const [draft, setDraft] = useState({ kind: 'goal', title: '', priority: 'medium', interventionKind: 'internal-task', goal: '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => { fetchPlatformUsers?.(); }, [fetchPlatformUsers]);

  const isNew = !overlay?.id;
  const template = templates.find(t => t.id === templateId);
  const ipa = ipas.find(i => i.id === ipaId);
  const readOnly = !canEdit;
  const summary = template ? overlaySummary(template, overrides) : null;
  const items = overrides.items || {};
  const additions = { goals: [], interventions: [], barriers: [], ...(overrides.additions || {}) };
  const signoff = { mode: 'default', roles: [], people: [], ...(overrides.signoff || {}) };
  const setItem = (kind, title, o) => setOverrides(v => ({ ...v, items: { ...(v.items || {}), [itemKey(kind, title)]: o } }));
  const setSignoff = (patch) => setOverrides(v => ({ ...v, signoff: { ...signoff, ...patch } }));

  const templateOptions = templates.filter(t => t.status !== 'draft' && (t.scope || 'org') === 'org')
    .map(t => ({ value: t.id, label: t.name })).sort((a, b) => a.label.localeCompare(b.label));
  const taken = new Set(overlays.filter(o => o.templateId === templateId && o.id !== overlay?.id).map(o => o.ipaId));
  const ipaOptions = ipas.filter(i => i.active && !taken.has(i.id)).map(i => ({ value: i.id, label: i.name }));
  const roleOptions = useMemo(() => [...new Set((users || []).flatMap(u => u.clinicalRoles || []))].sort().map(r => ({ value: r, label: r })), [users]);
  const peopleOptions = (users || []).map(u => ({ value: u.id, label: u.name }));
  const goalTitles = template ? [...template.goals.filter(g => !items[itemKey('goal', g.title)]?.hidden).map(g => g.title), ...additions.goals.map(g => g.title)] : [];

  const addLocal = () => {
    const title = draft.title.trim();
    if (!title) return;
    const listKey = `${draft.kind}s`;
    const entry = draft.kind === 'goal'
      ? { id: uuid(), title, priority: draft.priority, category: 'Others' }
      : draft.kind === 'intervention'
        ? { id: uuid(), title, kind: draft.interventionKind, config: { priority: draft.priority }, priority: draft.priority, ...(draft.goal ? { goalTitle: draft.goal } : {}) }
        : { id: uuid(), title, priority: draft.priority, description: '', ...(draft.goal ? { goalTitles: [draft.goal] } : {}) };
    setOverrides(v => ({ ...v, additions: { ...additions, [listKey]: [...additions[listKey], entry] } }));
    setDraft(d => ({ ...d, title: '' }));
  };
  const removeLocal = (listKey, id) => setOverrides(v => ({ ...v, additions: { ...additions, [listKey]: additions[listKey].filter(x => x.id !== id) } }));

  const save = async (status) => {
    setSaving(true);
    let saved;
    try { saved = await saveTemplateOverlay({ templateId, ipaId, status, overrides }, overlay?.id || null); }
    finally { setSaving(false); }
    if (!saved) return;
    showToast(status === 'active' ? `Overlay for ${ipa?.name} is active. Plans for its patients use it from now on.` : 'Overlay saved as a draft');
    onClose();
  };

  const signoffInvalid = (signoff.mode === 'roles' && !signoff.roles.length) || (signoff.mode === 'people' && !signoff.people.length);
  const canSave = canEdit && template && ipa && !saving && !signoffInvalid;
  const title = isNew ? 'New IPA overlay' : `${template?.name || 'Template'} for ${ipa?.name || 'IPA'}`;

  return (
    <Drawer
      title={title}
      width="min(1040px, calc(100vw - 16px))"
      onClose={onClose}
      secondaryAction={canEdit ? <Button variant="outline" disabled={!canSave} onClick={() => save('draft')}>Save draft</Button> : null}
      primaryAction={canEdit ? <Button disabled={!canSave} onClick={() => save('active')}>{overlay?.status === 'active' ? 'Save' : 'Save and activate'}</Button> : null}
    >
      <div className={styles.stack}>
        {isNew && (
          <div className={styles.pickers}>
            <Select portal label="Template" required searchable options={templateOptions} value={templateId} onChange={setTemplateId} placeholder="Pick a template" />
            <Select portal label="IPA" required searchable options={ipaOptions} value={ipaId} onChange={setIpaId} placeholder={templateId ? 'Pick an IPA' : 'Pick a template first'} disabled={!templateId} />
          </div>
        )}
        {template && (
          <>
            <p className={styles.lead}>
              Applies on top of <b>{template.name}</b>{template.currentVersionNumber ? ` (version ${template.currentVersionNumber} and later)` : ''} when a plan for a {ipa?.name || 'this IPA'} patient adds it. Anything left as "Template" follows the template.
            </p>
            {summary && (
              <div className={styles.summaryChips}>
                <Badge size="sm" label={`${summary.hidden} hidden`} />
                <Badge size="sm" label={`${summary.changed} changed`} />
                <Badge size="sm" label={`${summary.added} added`} />
                <Badge tone={summary.signoff ? 'info' : 'neutral'} size="sm" label={summary.signoff ? `Sign-off: ${summary.signoff}` : 'Anyone can sign'} />
              </div>
            )}
            {summary?.orphaned.length > 0 && (
              <Alert tone="warning" message={`${summary.orphaned.length} override${summary.orphaned.length === 1 ? ' is' : 's are'} for items no longer in the template; they no longer apply.`} />
            )}

            {KINDS.map(([kind, listKey, label]) => (template[listKey] || []).length > 0 && (
              <section key={kind} className={styles.section}>
                <h4 className={styles.sectionTitle}>{label}</h4>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead><tr><th>Include</th><th>Item</th><th>Priority</th><th>{kind === 'goal' ? 'Cadence' : ''}</th><th>Patient wording</th></tr></thead>
                    <tbody>
                      {template[listKey].map(x => (
                        <ItemRow key={x.id || x.title} kind={kind} item={x} override={items[itemKey(kind, x.title)]} readOnly={readOnly} onChange={o => setItem(kind, x.title, o)} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}

            <section className={styles.section}>
              <h4 className={styles.sectionTitle}>Added for {ipa?.name || 'this IPA'}</h4>
              {KINDS.every(([, listKey]) => !additions[listKey].length) && <p className={styles.muted}>No local items.</p>}
              <ul className={styles.localList}>
                {KINDS.flatMap(([kind, listKey]) => additions[listKey].map(x => (
                  <li key={x.id} className={styles.localRow}>
                    <Badge size="sm" label={cap(kind)} />
                    <span className={styles.itemTitle}>{x.title}</span>
                    <span className={styles.muted}>{[cap(x.priority || x.config?.priority), x.kind, x.goalTitle || x.goalTitles?.[0]].filter(Boolean).join(' • ')}</span>
                    {canEdit && <ActionButton icon="solar:trash-bin-trash-linear" size="sm" tooltip="Remove" onClick={() => removeLocal(listKey, x.id)} />}
                  </li>
                )))}
              </ul>
              {canEdit && (
                <div className={styles.addRow}>
                  <Select portal options={KINDS.map(([k]) => ({ value: k, label: cap(k) }))} value={draft.kind} onChange={v => setDraft(d => ({ ...d, kind: v }))} />
                  <Input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} placeholder="Title" aria-label="New item title" />
                  {draft.kind === 'intervention' && (
                    <Select portal options={INTERVENTION_KINDS.map(k => ({ value: k, label: k }))} value={draft.interventionKind} onChange={v => setDraft(d => ({ ...d, interventionKind: v }))} />
                  )}
                  {draft.kind !== 'goal' && (
                    <Select portal options={[{ value: '', label: 'No goal' }, ...goalTitles.map(g => ({ value: g, label: g }))]} value={draft.goal} onChange={v => setDraft(d => ({ ...d, goal: v }))} />
                  )}
                  <Select portal options={PRIORITY_OPTIONS} value={draft.priority} onChange={v => setDraft(d => ({ ...d, priority: v }))} />
                  <Button variant="outline" size="sm" disabled={!draft.title.trim()} onClick={addLocal}>Add</Button>
                </div>
              )}
            </section>

            <section className={styles.section}>
              <RadioOptionGroup
                label="Who signs plans built from it"
                value={signoff.mode}
                onChange={mode => setSignoff({ mode })}
                variant="card"
                options={[
                  { value: 'default', label: 'Anyone who can edit the plan', disabled: readOnly },
                  { value: 'roles', label: 'Specific roles', hint: 'Only people with one of these roles can sign.', disabled: readOnly },
                  { value: 'people', label: 'Specific people', hint: 'Only these people can sign.', disabled: readOnly },
                ]}
              />
              {signoff.mode === 'roles' && (
                <Select portal label="Roles" multiple checkboxes badges searchable disabled={readOnly} options={roleOptions} value={signoff.roles} onChange={v => setSignoff({ roles: v || [] })} placeholder="Pick roles" />
              )}
              {signoff.mode === 'people' && (
                <Select portal label="People" multiple checkboxes badges searchable disabled={readOnly} options={peopleOptions}
                  value={signoff.people.map(p => p.id)}
                  onChange={v => setSignoff({ people: (v || []).map(id => ({ id, name: users.find(u => u.id === id)?.name || '' })) })}
                  placeholder="Pick people" />
              )}
            </section>
          </>
        )}
      </div>
    </Drawer>
  );
}
