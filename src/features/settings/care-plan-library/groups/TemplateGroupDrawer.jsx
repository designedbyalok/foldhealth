import { useMemo, useState } from 'react';
import { Drawer } from '../../../../components/Drawer/Drawer';
import { Button } from '../../../../components/Button/Button';
import { Input } from '../../../../components/Input/Input';
import { Textarea } from '../../../../components/Textarea/Textarea';
import { Select } from '../../../../components/Select/Select';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { Badge } from '../../../../components/Badge/Badge';
import { Banner } from '../../../../components/Banner/Banner';
import { useAppStore } from '../../../../store/useAppStore';
import { membersChanged } from '../lib/templateGroups';
import styles from './TemplateGroups.module.css';

/**
 * Create or edit a template group: its name, what it's for, and its member
 * templates in the order they're applied. Changing the members makes a new
 * version; plans that used an older one are offered what was added.
 */
export function TemplateGroupDrawer({ group, readOnly = false, onClose }) {
  const templates = useAppStore(s => s.carePlanTemplates);
  const saveTemplateGroup = useAppStore(s => s.saveTemplateGroup);
  const showToast = useAppStore(s => s.showToast);
  const [name, setName] = useState(group?.name || '');
  const [description, setDescription] = useState(group?.description || '');
  const [memberIds, setMemberIds] = useState(group?.templateIds || []);
  const [saving, setSaving] = useState(false);

  const byId = useMemo(() => new Map((templates || []).map(t => [String(t.id), t])), [templates]);
  // Published, in-use organization templates can join (a group is shared, so
  // no one's private ones); a retired one already in the group stays listed.
  const options = useMemo(() => {
    const inGroup = new Set(memberIds);
    return (templates || [])
      .filter(t => t.status !== 'draft' && t.status !== 'archived' && (t.scope || 'org') === 'org' && !inGroup.has(String(t.id)))
      .map(t => ({ value: String(t.id), label: t.name }));
  }, [templates, memberIds]);
  const changed = group && membersChanged(group.templateIds, memberIds);
  const canSave = !readOnly && !saving && name.trim() && memberIds.length > 0;

  const move = (i, by) => setMemberIds((prev) => {
    const j = i + by;
    if (j < 0 || j >= prev.length) return prev;
    const next = [...prev];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  const save = async () => {
    setSaving(true);
    try {
      const saved = await saveTemplateGroup({ name, description, templateIds: memberIds }, group?.id || null);
      if (saved) {
        showToast?.(group ? `"${saved.name}" saved${changed ? ` as version ${saved.versionNumber}` : ''}` : `"${saved.name}" created`);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title={group ? (readOnly ? group.name : 'Edit Template Group') : 'New Template Group'}
      onClose={onClose}
      noCloseDivider
      headerRight={(
        <>
          {group && <Badge size="sm" label={`v${group.versionNumber}`} />}
          {!readOnly && (
            <>
              <span className={styles.headerDivider} />
              <Button disabled={!canSave} onClick={save} loading={saving}>Save</Button>
            </>
          )}
          <span className={styles.headerDivider} />
        </>
      )}
    >
      <div className={styles.drawerBody}>
        <Input label="Group name" required value={name} onChange={e => setName(e.target.value.slice(0, 120))} placeholder="e.g. Diabetes with HTN order-set" disabled={readOnly} />
        <Textarea title="What it's for" value={description} onValueChange={text => setDescription(text)} placeholder="Optional, e.g. Adults with type 2 diabetes and hypertension" rows={2} maxLength={300} disabled={readOnly} />

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Templates, in the order they're applied</span>
          {!readOnly && (
            <Select
              portal
              searchable
              placeholder="Add a template"
              options={options}
              value=""
              onValueChange={id => id && setMemberIds(prev => [...prev, id])}
            />
          )}
          {memberIds.length === 0 ? (
            <p className={styles.hint}>Add at least one template.</p>
          ) : (
            <ol className={styles.memberList}>
              {memberIds.map((id, i) => {
                const t = byId.get(id);
                return (
                  <li key={id} className={styles.memberRow}>
                    <span className={styles.memberIndex}>{i + 1}</span>
                    <span className={styles.memberName}>{t?.name || 'Deleted template'}</span>
                    {t?.status === 'archived' && <Badge tone="warning" size="sm" label="Retired, skipped" />}
                    {!t && <Badge tone="warning" size="sm" label="Skipped" />}
                    {!readOnly && (
                      <span className={styles.memberActions}>
                        <ActionButton icon="solar:alt-arrow-up-linear" size="sm" tooltip="Earlier" disabled={i === 0} onClick={() => move(i, -1)} />
                        <ActionButton icon="solar:alt-arrow-down-linear" size="sm" tooltip="Later" disabled={i === memberIds.length - 1} onClick={() => move(i, 1)} />
                        <ActionButton icon="solar:trash-bin-trash-linear" size="sm" tooltip="Remove" onClick={() => setMemberIds(prev => prev.filter(x => x !== id))} />
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {changed && (
          <Banner size="sm" icon="solar:history-linear">
            {`Saving makes version ${group.versionNumber + 1}. Plans that used an earlier version keep their templates and are offered the ones added.`}
          </Banner>
        )}
      </div>
    </Drawer>
  );
}
