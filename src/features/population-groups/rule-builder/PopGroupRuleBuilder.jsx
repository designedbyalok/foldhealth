import { useEffect, useState } from 'react';
import { add } from 'react-querybuilder';
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

/* ── Recursive tree helpers ──
   Rules can nest ({ combinator, rules }) — the Figma's flagship example is a
   tree of OR groups under a top-level AND. The rqb add/remove/update helpers
   are path-based; these id-based equivalents keep the editor working on
   leaves at any depth. */
const isGroup = (node) => Array.isArray(node?.rules);

function findRuleById(node, id) {
  for (const child of node.rules || []) {
    if (child.id === id) return child;
    if (isGroup(child)) {
      const hit = findRuleById(child, id);
      if (hit) return hit;
    }
  }
  return null;
}

function updateRuleById(node, id, patch) {
  return {
    ...node,
    rules: (node.rules || []).map(child => {
      if (child.id === id) return { ...child, ...patch };
      return isGroup(child) ? updateRuleById(child, id, patch) : child;
    }),
  };
}

function removeRuleById(node, id) {
  return {
    ...node,
    rules: (node.rules || [])
      .filter(child => child.id !== id)
      .map(child => (isGroup(child) ? removeRuleById(child, id) : child))
      // drop groups emptied by the removal
      .filter(child => !isGroup(child) || child.rules.length > 0),
  };
}

/* Insert `newRule` joined to the rule with `targetId` by `combinator`:
   same combinator as the parent group (or single-child parent) → insert as a
   sibling right after it; different combinator → wrap the pair in a new
   subgroup, which is how a mixed AND/OR chain becomes a tree. */
function addJoinedRule(node, targetId, combinator, newRule) {
  const idx = (node.rules || []).findIndex(child => child.id === targetId);
  if (idx >= 0) {
    if (node.combinator === combinator || node.rules.length === 1) {
      const rules = [...node.rules];
      rules.splice(idx + 1, 0, newRule);
      return { ...node, combinator: node.rules.length === 1 ? combinator : node.combinator, rules };
    }
    const rules = [...node.rules];
    rules[idx] = { id: `${targetId}-g`, combinator, rules: [node.rules[idx], newRule] };
    return { ...node, rules };
  }
  return {
    ...node,
    rules: (node.rules || []).map(child => (isGroup(child) ? addJoinedRule(child, targetId, combinator, newRule) : child)),
  };
}

function everyLeaf(node, pred) {
  return (node.rules || []).every(child => (isGroup(child) ? everyLeaf(child, pred) : pred(child)));
}

function countLeaves(node) {
  return (node.rules || []).reduce((n, child) => n + (isGroup(child) ? countLeaves(child) : 1), 0);
}

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
function RuleNode({ rule, readOnly, combinator, onOpenEditor, onJoin, onRemove }) {
  const field = FIELD_BY_KEY[rule.field];
  if (!field) return null;
  const summary = ruleSummary(rule);
  const chipInner = (
    <>
      <span className={styles.fieldChipIcon} style={{ background: groupAccent(field.group) }}>
        <Icon name={field.icon} size={12} color="var(--neutral-400)" />
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
        {summary.map(b => <Badge key={b.text} tone={b.tone} size="S" label={b.text} className={styles.nodeBadge} />)}
      </span>
      {!readOnly && (
        <span className={styles.nodeRight}>
          <span className={styles.combo}>
            <button
              type="button"
              className={`${styles.comboBtn} ${combinator === 'and' ? styles.comboBtnActive : ''}`}
              onClick={() => onJoin('and')}
            >AND</button>
            <span className={styles.comboDivider} />
            <button
              type="button"
              className={`${styles.comboBtn} ${combinator === 'or' ? styles.comboBtnActive : ''}`}
              onClick={() => onJoin('or')}
            >OR</button>
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
  const setPgRuleBuilderName = useAppStore(s => s.setPgRuleBuilderName);
  const fetchPopGroupActivity = useAppStore(s => s.fetchPopGroupActivity);
  const showToast = useAppStore(s => s.showToast);

  const [savedQuery, setSavedQuery] = useState(() => session?.rule || EMPTY_QUERY);
  const [query, setQuery] = useState(() => session?.rule || EMPTY_QUERY);
  const [mode, setMode] = useState(() => (session?.groupId ? (session.startInEdit ? 'edit' : 'view') : 'create'));
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [pickerRect, setPickerRect] = useState(null);
  // { ruleId, combinator } while an AND/OR click is waiting for a field pick —
  // the picker renders inline below that row (Figma 9:73965).
  const [pendingJoin, setPendingJoin] = useState(null);
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
  const editingRule = editingRuleId ? findRuleById(query, editingRuleId) : null;

  const addCondition = (field) => {
    const rule = { id: nextRuleId(), field: field.key, operator: field.operators[0].name, value: {} };
    if (pendingJoin) {
      setQuery(q => addJoinedRule(q, pendingJoin.ruleId, pendingJoin.combinator, rule));
      setPendingJoin(null);
    } else {
      setQuery(q => add(q, rule, []));
      setPickerRect(null);
    }
    setEditingRuleId(rule.id);
  };

  const commitRule = (id, patch) => {
    // Editing through the generic panel replaces any authored `display`
    // badges with the derived operator+value form.
    setQuery(q => updateRuleById(q, id, { operator: patch.operator, value: patch.value, display: undefined }));
  };

  const isComplete = (r) => {
    const v = r.value || {};
    return (v.amount ?? v.text ?? '') !== '';
  };
  const canSaveGroup = countLeaves(query) > 0 && everyLeaf(query, isComplete);

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

  /* Inline rename from the rail — persists against the SAVED rule (not the
     draft) so renaming mid-edit can't leak unsaved conditions. */
  const handleRename = async (name) => {
    const saved = await updatePopGroup(groupId, {
      name,
      description: session.description || '',
      type: 'Dynamic',
      filterType: 'dynamic',
      memberStatus: session.memberStatus || 'All Status',
      memberIds: [],
      count: session.count ?? 0,
      inactive: session.inactive ?? 0,
      rule: savedQuery,
    });
    if (!saved) return false;
    setPgRuleBuilderName(name);
    setActivity(null); // rename is logged — refetch on next open
    return true;
  };

  /* Recursively render a group's children: leaves as RuleNodes, subgroups as
     an indented block with a bracket carrying the group's combinator (the
     Figma's OR brackets). Combinator chips sit between siblings. */
  const renderChildren = (group, depth) => group.rules.map((child, index) => (
    <div key={child.id || index} className={styles.nodeStack}>
      {/* Inside a bracketed group the bracket already names the combinator —
          chips between siblings only at the top level, like the Figma. */}
      {index > 0 && depth === 0 && (
        <div className={styles.combinatorChip}>
          <span className={styles.ifTail} />
          <span className={styles.combinatorLabel}>{(group.combinator || 'and').toUpperCase()}</span>
          <span className={styles.ifTail} />
        </div>
      )}
      {isGroup(child) ? (
        <div className={styles.groupNode}>
          <div className={styles.groupBracket}>
            {(child.combinator || 'and').toUpperCase()}
          </div>
          <div className={styles.groupChildren}>{renderChildren(child, depth + 1)}</div>
        </div>
      ) : (
        <RuleNode
          rule={child}
          readOnly={isView}
          combinator={group.combinator}
          onOpenEditor={() => setEditingRuleId(child.id)}
          onJoin={(comb) => setPendingJoin({ ruleId: child.id, combinator: comb })}
          onRemove={() => setQuery(q => removeRuleById(q, child.id))}
        />
      )}
      {pendingJoin?.ruleId === child.id && (
        <AddConditionPopover
          inline
          onSelect={addCondition}
          onClose={() => setPendingJoin(null)}
        />
      )}
    </div>
  ));

  const canvas = (
    <div className={styles.canvas}>
      <div className={styles.ifChip}>
        <Button variant="secondary" size="S" className={styles.ifButton}>IF</Button>
        <span className={styles.ifTail} />
      </div>

      {renderChildren(query, 0)}

      {!isView && query.rules.length > 0 && (
        <div className={styles.canvasJoin}>
          <span className={styles.ifTail} />
          <span className={styles.combo}>
            <button type="button" className={styles.comboBtn}
              onClick={() => setPendingJoin({ ruleId: query.rules[query.rules.length - 1].id, combinator: 'and' })}>AND</button>
            <span className={styles.comboDivider} />
            <button type="button" className={styles.comboBtn}
              onClick={() => setPendingJoin({ ruleId: query.rules[query.rules.length - 1].id, combinator: 'or' })}>OR</button>
          </span>
        </div>
      )}

      {countLeaves(query) === 0 && !isView && (
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
      {countLeaves(query) === 0 && isView && (
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
            onRename={handleRename}
            onHistory={() => setHistoryOpen(true)}
            onRefresh={refresh}
            showToast={showToast}
          />
        )}
        <div className={styles.tabPane}>
          {isView && (
            <TabStrip
              fullWidth={false}
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
                  onSave={(patch) => commitRule(editingRule.id, patch)}
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
        </Drawer>
      )}
    </div>
  );
}
