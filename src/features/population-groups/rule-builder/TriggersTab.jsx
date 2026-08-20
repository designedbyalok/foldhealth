import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button } from '../../../components/Button/Button';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Toggle } from '../../../components/Toggle/Toggle';
import { Select } from '../../../components/Select/Select';
import { Input } from '../../../components/Input/Input';
import { Icon } from '../../../components/Icon/Icon';
import { Badge } from '../../../components/Badge/Badge';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { Drawer } from '../../../components/Drawer/Drawer';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import styles from './ruleBuilder.module.css';

const TRIGGER_EVENTS = [
  { value: 'member_added', label: 'Member Added', description: 'Fires when a patient enters this group' },
  { value: 'member_removed', label: 'Member Removed', description: 'Fires when a patient exits this group' },
  { value: 'rule_matched', label: 'Rule Matched', description: 'Fires for all current members on each evaluation' },
  { value: 'scheduled', label: 'Scheduled', description: 'Fires on a recurring schedule' },
];

const ACTION_TYPES = [
  { value: 'invoke_agent', label: 'Invoke Agent', icon: 'solar:bot-linear' },
  { value: 'send_notification', label: 'Send Notification', icon: 'solar:bell-linear' },
  { value: 'add_tag', label: 'Add Tag', icon: 'solar:tag-horizontal-linear' },
  { value: 'enroll_program', label: 'Enroll in Program', icon: 'solar:clipboard-list-linear' },
  { value: 'webhook', label: 'Webhook', icon: 'solar:link-round-linear' },
];

/**
 * TriggersTab — lists automation triggers for a population group and lets
 * users create/edit/delete them. Each trigger watches for a membership
 * event and fires an action (invoke agent, send notification, add tag, etc.).
 */
export function TriggersTab({ groupId, showToast }) {
  const [triggers, setTriggers] = useState(null);
  const [error, setError] = useState(null);
  const [editId, setEditId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Refetch is driven by a token rather than by calling a shared loader, so the
  // fetch and its state writes live in one place and the `cancelled` guard sits
  // directly in front of them. Without that guard a slow first request could
  // land after groupId moved on and overwrite the newer group's triggers.
  // Same pattern as useQualifiedMembers' refreshToken.
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (!groupId) return undefined;
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase
        .from('pop_group_triggers')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at');
      if (cancelled) return;
      if (err) { setError(err.message); setTriggers([]); return; }
      setTriggers(data || []);
      setError(null);
    })();
    return () => { cancelled = true; };
  }, [groupId, refreshToken]);

  const handleToggle = async (trigger) => {
    const { error: err } = await supabase
      .from('pop_group_triggers')
      .update({ enabled: !trigger.enabled })
      .eq('id', trigger.id);
    if (err) { showToast?.(`Failed to update trigger: ${err.message}`); return; }
    setTriggers(ts => ts.map(t => t.id === trigger.id ? { ...t, enabled: !t.enabled } : t));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    let err;
    try {
      ({ error: err } = await supabase
        .from('pop_group_triggers')
        .delete()
        .eq('id', deleteTarget.id));
    } finally {
      setDeleting(false);
    }
    if (err) { showToast?.(`Delete failed: ${err.message}`); return; }
    setTriggers(ts => ts.filter(t => t.id !== deleteTarget.id));
    setDeleteTarget(null);
    showToast?.('Trigger deleted');
  };

  if (error) {
    return (
      <div className={styles.triggersError}>
        <Icon name="solar:danger-triangle-linear" size={14} color="var(--status-error)" />
        Could not load triggers: {error}
      </div>
    );
  }

  if (triggers === null) {
    return <span className={styles.criteriaEmpty}>Loading triggers...</span>;
  }

  return (
    <div className={styles.triggersTab}>
      <div className={styles.triggersHeader}>
        <span className={styles.triggersTitle}>Automation Triggers</span>
        <Button
          variant="secondary"
          size="S"
          leadingIcon="solar:add-circle-linear"
          onClick={() => setEditId('new')}
        >
          Add Trigger
        </Button>
      </div>

      {triggers.length === 0 && (
        <EmptyState
          icon="solar:bolt-linear"
          title="No triggers yet"
          description="Add a trigger to automate actions when members enter or leave this group."
        />
      )}

      {triggers.map(t => {
        const ev = TRIGGER_EVENTS.find(e => e.value === t.trigger_event);
        const act = ACTION_TYPES.find(a => a.value === t.action_type);
        return (
          <div key={t.id} className={styles.triggerCard}>
            <div className={styles.triggerCardHeader}>
              <Toggle checked={t.enabled} onChange={() => handleToggle(t)} size="S" />
              <span className={styles.triggerCardName}>{t.name}</span>
              <span className={styles.triggerCardActions}>
                <ActionButton icon="solar:pen-linear" size="S" tooltip="Edit" onClick={() => setEditId(t.id)} />
                <ActionButton icon="solar:trash-bin-minimalistic-linear" size="S" tooltip="Delete" onClick={() => setDeleteTarget(t)} />
              </span>
            </div>
            <div className={styles.triggerCardBody}>
              <Badge tone="info" size="S" label={ev?.label || t.trigger_event} />
              <Icon name="solar:arrow-right-linear" size={12} color="var(--neutral-200)" />
              <Icon name={act?.icon || 'solar:bolt-linear'} size={14} color="var(--neutral-300)" />
              <span className={styles.triggerCardAction}>{act?.label || t.action_type}</span>
            </div>
          </div>
        );
      })}

      {editId && (
        <TriggerEditorDrawer
          triggerId={editId === 'new' ? null : editId}
          groupId={groupId}
          triggers={triggers}
          onClose={() => setEditId(null)}
          onSaved={() => { setEditId(null); setRefreshToken(t => t + 1); showToast?.('Trigger saved'); }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          variant="destructive"
          title="Delete this trigger?"
          description={`"${deleteTarget.name}" will be permanently removed.`}
          confirmLabel={deleting ? 'Deleting...' : 'Delete'}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function TriggerEditorDrawer({ triggerId, groupId, triggers, onClose, onSaved }) {
  const existing = triggerId ? triggers.find(t => t.id === triggerId) : null;
  const [name, setName] = useState(existing?.name || '');
  const [triggerEvent, setTriggerEvent] = useState(existing?.trigger_event || 'member_added');
  const [actionType, setActionType] = useState(existing?.action_type || 'invoke_agent');
  const [config, setConfig] = useState(existing?.action_config || {});
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0;

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    const payload = {
      group_id: groupId,
      name: name.trim(),
      trigger_event: triggerEvent,
      action_type: actionType,
      action_config: config,
    };
    let error;
    try {
      ({ error } = triggerId
        ? await supabase.from('pop_group_triggers').update(payload).eq('id', triggerId)
        : await supabase.from('pop_group_triggers').insert(payload));
    } finally {
      setSaving(false);
    }
    if (error) return;
    onSaved();
  };

  return (
    <Drawer
      title={triggerId ? 'Edit Trigger' : 'New Trigger'}
      onClose={onClose}
      primaryAction={
        <Button variant="primary" size="L" disabled={!canSave || saving} onClick={save}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      }
    >
      <div className={styles.editorFields}>
        <span className={styles.editorSectionLabel}>Name</span>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Trigger name" style={{ width: '100%' }} />

        <span className={styles.editorSectionLabel}>When</span>
        <Select
          options={TRIGGER_EVENTS.map(e => ({ value: e.value, label: e.label }))}
          value={triggerEvent}
          onChange={setTriggerEvent}
          style={{ width: '100%' }}
        />
        <div className={styles.triggerEventDesc}>
          {TRIGGER_EVENTS.find(e => e.value === triggerEvent)?.description}
        </div>

        <span className={styles.editorSectionLabel}>Action</span>
        <Select
          options={ACTION_TYPES.map(a => ({ value: a.value, label: a.label }))}
          value={actionType}
          onChange={setActionType}
          style={{ width: '100%' }}
        />

        {actionType === 'invoke_agent' && (
          <>
            <span className={styles.editorSectionLabel}>Prompt Template</span>
            <Input
              value={config.prompt_template || ''}
              onChange={e => setConfig(c => ({ ...c, prompt_template: e.target.value }))}
              placeholder="Patient {{name}} has entered the group..."
              style={{ width: '100%' }}
            />
          </>
        )}

        {actionType === 'add_tag' && (
          <>
            <span className={styles.editorSectionLabel}>Tag</span>
            <Input
              value={config.tag || ''}
              onChange={e => setConfig(c => ({ ...c, tag: e.target.value }))}
              placeholder="high-risk"
              style={{ width: '100%' }}
            />
          </>
        )}

        {actionType === 'webhook' && (
          <>
            <span className={styles.editorSectionLabel}>Webhook URL</span>
            <Input
              value={config.url || ''}
              onChange={e => setConfig(c => ({ ...c, url: e.target.value }))}
              placeholder="https://..."
              style={{ width: '100%' }}
            />
          </>
        )}

        {actionType === 'send_notification' && (
          <>
            <span className={styles.editorSectionLabel}>Channel</span>
            <Select
              options={[
                { value: 'email', label: 'Email' },
                { value: 'sms', label: 'SMS' },
                { value: 'in_app', label: 'In-App' },
              ]}
              value={config.channel || 'email'}
              onChange={v => setConfig(c => ({ ...c, channel: v }))}
              style={{ width: '100%' }}
            />
          </>
        )}
      </div>
    </Drawer>
  );
}
