import { useEffect, useState } from 'react';
import { add, remove, update } from 'react-querybuilder';
import { useAppStore } from '../../../store/useAppStore';
import { Button } from '../../../components/Button/Button';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Icon } from '../../../components/Icon/Icon';
import { Badge } from '../../../components/Badge/Badge';
import { TabStrip } from '../../../components/TabStrip/TabStrip';
import { Drawer } from '../../../components/Drawer/Drawer';
import { ActivityLog } from '../../../components/ActivityLog/ActivityLog';
import { toActivityLogEntries } from '../../hedis-worklist/CareGapDetailDrawer.utils';
import { AddConditionPopover } from './AddConditionPopover';
import { ConditionEditorPanel } from './ConditionEditorPanel';
import { RuleSummaryPanel } from './RuleSummaryPanel';
import { QualifiedMembersTable } from './QualifiedMembersTable';
import { useQualifiedMembers } from './useQualifiedMembers';
import { FIELD_BY_KEY, groupAccent, ruleSummary } from './fieldCatalog';
import styles from './ruleBuilder.module.css';

let ruleSeq = 0;
const nextRuleId = () => `rb-${Date.now()}-${ruleSeq++}`;

const EMPTY_QUERY = { combinator: 'and', rules: [] };

/* Six-dot grip — Solar has no drag-handle glyph, so this is the one custom
   SVG in the builder (dots, so fill rather than stroke). */
function GripIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      {[4.5, 8, 11.5].flatMap(y => [5.5, 10.5].map(x => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" fill="currentColor" />
      )))}
    </svg>
  );
}

/* One rule row. `readOnly` strips every actionable trigger — no chip click,
   no AND/OR toggle, no add/remove — leaving the same visual anatomy. */
function RuleNode({ rule, readOnly, combinator, onOpenEditor, onToggleCombinator, onAddCondition, onRemove }) {
  const field = FIELD_BY_KEY[rule.field];
  if (!field) return null;
  const summary = ruleSummary(rule);
  const chipInner = (
    <>
      <span className={styles.fieldChipIcon} style={{ background: groupAccent(field.group) }}>
        <Icon name={field.icon} size={16} color="var(--neutral-400)" />
      </span>
      {field.label}
    </>
  );
  return (
    <div className={styles.node}>
      <span className={styles.dragHandle}><GripIcon /></span>
      {readOnly ? (
        <span className={styles.fieldChip} style={{ background: groupAccent(field.group), cursor: 'default' }}>
          {chipInner}
        </span>
      ) : (
        <button
          type="button"
          className={styles.fieldChip}
          style={{ background: groupAccent(field.group) }}
          onClick={onOpenEditor}
        >
          {chipInner}
        </button>
      )}
      <span className={styles.nodeBadges}>
        {summary.map(text => <Badge key={text} tone="grey" size="S" label={text} />)}
      </span>
      {!readOnly && (
        <span className={styles.nodeRight}>
          <span className={styles.combo}>
            <button
              type="button"
              className={`${styles.comboBtn} ${combinator === 'and' ? styles.comboBtnActive : ''}`}
              onClick={() => onToggleCombinator('and')}
            >AND</button>
            <span className={styles.comboDivider} />
            <button
              type="button"
              className={`${styles.comboBtn} ${combinator === 'or' ? styles.comboBtnActive : ''}`}
              onClick={() => onToggleCombinator('or')}
            >OR</button>
            <span className={styles.comboDivider} />
            <button
              type="button"
              className={styles.comboBtn}
              aria-label="Add condition"
              onClick={onAddCondition}
            ><Icon name="solar:add-circle-linear" size={14} color="currentColor" /></button>
          </span>
          <ActionButton
            icon="solar:trash-bin-minimalistic-linear"
            size="S"
            tooltip="Remove condition"
            onClick={onRemove}
          />
        </span>
      )}
    </div>
  );
}

/**
 * PopGroupRuleBuilder — full-page takeover for dynamic population groups.
 *
 * Three modes:
 *  - create — from the Create Group drawer: bare canvas + Cancel/Next
 *    sub-bar (Figma 1:3915 / 9:44005).
 *  - view   — clicking a saved Dynamic group: read-only detail screen with
 *    the summary rail, TabStrip (Qualified Members / Rule Design) and no
 *    actionable rule triggers (Figma 1:13951).
 *  - edit   — the Edit pencil (rail or table row): same editable canvas as
 *    create; Next saves and drops back to view, Cancel reverts.
 *
 * Query state is react-querybuilder's { combinator, rules } tree, mutated
 * only through the library's add/remove/update helpers.
 */
export function PopGroupRuleBuilder() {
  const session = useAppStore(s => s.pgRuleBuilder);
  const closePgRuleBuilder = useAppStore(s => s.closePgRuleBuilder);
  const createPopGroup = useAppStore(s => s.createPopGroup);
  const updatePopGroup = useAppStore(s => s.updatePopGroup);
  const fetchPopGroupActivity = useAppStore(s => s.fetchPopGroupActivity);
  const showToast = useAppStore(s => s.showToast);

  const [savedQuery, setSavedQuery] = useState(() => session?.rule || EMPTY_QUERY);
  const [query, setQuery] = useState(() => session?.rule || EMPTY_QUERY);
  const [mode, setMode] = useState(() => (session?.groupId ? (session.startInEdit ? 'edit' : 'view') : 'create'));
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [pickerRect, setPickerRect] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('design');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activity, setActivity] = useState(null); // null = not fetched
  const { members, count, loading: membersLoading, refresh } = useQualifiedMembers(query);

  const groupId = session?.groupId;
  useEffect(() => {
    if (!historyOpen || !groupId) return;
    let cancelled = false;
    fetchPopGroupActivity(groupId).then(rows => { if (!cancelled) setActivity(rows); });
    return () => { cancelled = true; };
  }, [historyOpen, groupId, fetchPopGroupActivity]);

  if (!session) return null;

  const isView = mode === 'view';
  const rules = query.rules;
  const editingIndex = rules.findIndex(r => r.id === editingRuleId);
  const editingRule = editingIndex >= 0 ? rules[editingIndex] : null;

  const addCondition = (field) => {
    const rule = { id: nextRuleId(), field: field.key, operator: field.operators[0].name, value: {} };
    setQuery(q => add(q, rule, []));
    setPickerRect(null);
    setEditingRuleId(rule.id);
  };

  const removeRule = (index) => {
    const removed = rules[index];
    setQuery(q => remove(q, [index]));
    if (removed?.id === editingRuleId) setEditingRuleId(null);
  };

  const commitRule = (index, patch) => {
    setQuery(q => {
      let next = update(q, 'operator', patch.operator, [index]);
      next = update(next, 'value', patch.value, [index]);
      return next;
    });
  };

  const setCombinator = (value) => setQuery(q => update(q, 'combinator', value, []));

  const isComplete = (r) => {
    const v = r.value || {};
    return (v.amount ?? v.text ?? '') !== '';
  };
  const canSaveGroup = rules.length > 0 && rules.every(isComplete);

  const handleCancel = () => {
    if (mode === 'create') { closePgRuleBuilder(); return; }
    setQuery(savedQuery);
    setEditingRuleId(null);
    setPickerRect(null);
    setMode('view');
  };

  const handleNext = async () => {
    if (!canSaveGroup || saving) return;
    setSaving(true);
    const payload = {
      name: session.name,
      description: session.description || '',
      type: 'Dynamic',
      filterType: 'dynamic',
      memberStatus: session.memberStatus || 'All Status',
      memberIds: [],
      count: session.count ?? 0,
      inactive: session.inactive ?? 0,
      rule: query,
    };
    const saved = groupId
      ? await updatePopGroup(groupId, payload)
      : await createPopGroup(payload);
    setSaving(false);
    if (!saved) return; // store already toasted the failure
    showToast(groupId ? 'Population Group Updated Successfully' : 'Population Group Added Successfully');
    if (mode === 'create') { closePgRuleBuilder(); return; }
    setSavedQuery(query);
    setActivity(null); // stale — refetch next time the drawer opens
    setEditingRuleId(null);
    setMode('view');
  };

  const canvas = (
    <div className={styles.canvas}>
      <div className={styles.ifChip}>
        <Button variant="secondary" size="S">IF</Button>
        <span className={styles.ifTail} />
      </div>

      {rules.map((rule, index) => (
        <div key={rule.id} className={styles.nodeStack}>
          {index > 0 && (
            <div className={styles.combinatorChip}>
              <span className={styles.ifTail} />
              <span className={styles.combinatorLabel}>{(query.combinator || 'and').toUpperCase()}</span>
              <span className={styles.ifTail} />
            </div>
          )}
          <RuleNode
            rule={rule}
            readOnly={isView}
            combinator={query.combinator}
            onOpenEditor={() => setEditingRuleId(rule.id)}
            onToggleCombinator={setCombinator}
            onAddCondition={(e) => setPickerRect(e.currentTarget.getBoundingClientRect())}
            onRemove={() => removeRule(index)}
          />
        </div>
      ))}

      {rules.length === 0 && !isView && (
        <Button
          variant="tertiary"
          size="S"
          leadingIcon="solar:add-circle-linear"
          className={styles.addConditionBtn}
          onClick={(e) => setPickerRect(e.currentTarget.getBoundingClientRect())}
        >
          Add Condition
        </Button>
      )}
      {rules.length === 0 && isView && (
        <span className={styles.criteriaEmpty}>No conditions defined yet — use Edit to add some.</span>
      )}
    </div>
  );

  return (
    <div className={styles.view}>
      {/* Sub-bar only while editing — the view state is read-only (Figma 1:13951 has no action bar). */}
      {!isView && (
        <div className={styles.subBar}>
          <div className={styles.subBarName}>
            <Avatar type="icon" variant="patient" iconName="solar:users-group-rounded-linear" size="XS" />
            <span className={styles.groupName}>{session.name}</span>
          </div>
          <div className={styles.subBarActions}>
            <Button variant="secondary" size="L" onClick={handleCancel}>Cancel</Button>
            <Button variant="primary" size="L" disabled={!canSaveGroup || saving} onClick={handleNext}>
              {saving ? 'Saving…' : 'Next'}
            </Button>
          </div>
        </div>
      )}

      <div className={styles.body}>
        {isView && (
          <RuleSummaryPanel
            session={session}
            query={query}
            qualifiedCount={membersLoading ? null : count}
            onEdit={() => { setMode('edit'); setActiveTab('design'); }}
            onHistory={() => setHistoryOpen(true)}
            onRefresh={refresh}
            showToast={showToast}
          />
        )}
        <div className={styles.tabPane}>
          {isView && (
            <TabStrip
              items={[
                { key: 'members', label: 'Qualified Members', count: membersLoading ? '…' : count },
                { key: 'design', label: 'Rule Design' },
              ]}
              activeKey={activeTab}
              onChange={setActiveTab}
            />
          )}
          {isView && activeTab === 'members' ? (
            <QualifiedMembersTable members={members} loading={membersLoading} />
          ) : (
            <div className={styles.bodyInner}>
              {canvas}
              {!isView && editingRule && (
                <ConditionEditorPanel
                  key={editingRule.id}
                  rule={editingRule}
                  onSave={(patch) => commitRule(editingIndex, patch)}
                  onClose={() => setEditingRuleId(null)}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {!isView && pickerRect && (
        <AddConditionPopover
          anchorRect={pickerRect}
          onSelect={addCondition}
          onClose={() => setPickerRect(null)}
        />
      )}

      {historyOpen && (
        <Drawer title="Activity Log" onClose={() => setHistoryOpen(false)}>
          <div className={styles.activityBody}>
            {activity === null
              ? <span className={styles.criteriaEmpty}>Loading activity…</span>
              : (
                <ActivityLog
                  entries={toActivityLogEntries(activity.map(a => ({
                    when: a.created_at,
                    actor: a.actor,
                    t: a.action,
                    title: a.title,
                    note: a.detail || undefined,
                  })))}
                  emptyLabel="No changes recorded for this group yet."
                />
              )}
          </div>
        </Drawer>
      )}
    </div>
  );
}
