import { useId, useState } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { Badge } from '../../../components/Badge/Badge';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Button } from '../../../components/Button/Button';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Drawer } from '../../../components/Drawer/Drawer';
import { useAppStore } from '../../../store/useAppStore';
import { Switch } from '../../../components/Switch/Switch';
import { defaultRules, customRules, groupSettings } from '../../../data/chatGroups'; // Rules defaults — TODO: move to store

const RULE_BADGE_VARIANT = { safety: 'status-failed', system: 'ai-care', custom: 'status-completed' };
const RULE_TYPE_LABEL = { safety: 'Safety', system: 'System', custom: 'Custom' };

export function AgentRulesDrawer() {
  const uid = useId();
  const agentRulesGroupId = useAppStore(s => s.agentRulesGroupId);
  const setAgentRulesGroupId = useAppStore(s => s.setAgentRulesGroupId);
  const showToast = useAppStore(s => s.showToast);
  const chatGroupsData = useAppStore(s => s.chatGroupsData) || [];

  const group = chatGroupsData.find(g => g.id === agentRulesGroupId);
  const [agentEnabled, setAgentEnabled] = useState(true);
  const [rules, setRules] = useState([...defaultRules, ...customRules]);
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleCondition, setNewRuleCondition] = useState('Message contains [keyword]');
  const [newRuleAction, setNewRuleAction] = useState('Send message [text]');
  const [editingRuleId, setEditingRuleId] = useState(null);

  if (!group) return null;

  const toggleRule = (id) => {
    setRules(prev => prev.map(r => r.id === id && !r.locked ? { ...r, enabled: !r.enabled } : r));
  };

  const headerRight = (
    <button
      onClick={() => setAgentEnabled(!agentEnabled)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px',
        borderRadius: 20, border: '0.5px solid', cursor: 'pointer', fontSize: 12, fontWeight: 500,
        fontFamily: "'Inter', sans-serif", transition: 'background .15s, color .15s, border-color .15s',
        background: agentEnabled ? '#E3FCEF' : 'var(--neutral-50)',
        color: agentEnabled ? '#16A34A' : 'var(--neutral-300)',
        borderColor: agentEnabled ? 'rgba(22,163,74,.2)' : 'var(--neutral-150)',
      }}
    >
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: agentEnabled ? '#16A34A' : 'var(--neutral-200)',
        flexShrink: 0,
      }} />
      {agentEnabled ? 'Agent Active' : 'Agent Inactive'}
    </button>
  );

  return (
    <Drawer title="Agent Rules Configuration" onClose={() => setAgentRulesGroupId(null)} headerRight={headerRight}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 12, color: 'var(--neutral-200)' }}>
        <button type="button" style={{ cursor: 'pointer', color: 'var(--primary-300)', font: 'inherit' }} onClick={() => setAgentRulesGroupId(null)}>Chat Settings</button>
        <Icon name="solar:alt-arrow-right-linear" size={12} color="var(--neutral-200)" />
        <button type="button" style={{ cursor: 'pointer', color: 'var(--primary-300)', font: 'inherit' }} onClick={() => setAgentRulesGroupId(null)}>{group.name}</button>
        <Icon name="solar:alt-arrow-right-linear" size={12} color="var(--neutral-200)" />
        <span style={{ color: 'var(--neutral-400)', fontWeight: 500 }}>Care Assistant — Rules</span>
      </div>

      {/* Agent Header Card */}
      <div style={{ border: '0.5px solid var(--neutral-150)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar variant="agent" initials="CA" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--neutral-500)', display: 'flex', alignItems: 'center', gap: 6 }}>
              Care Assistant
              <Badge variant="ai-care" label="AI Agent" />
              <Badge variant="compliance-na" label="FAQ Responder" />
            </div>
            <div style={{ fontSize: 12, color: 'var(--neutral-200)', marginTop: 2 }}>
              Assigned to: <strong style={{ color: 'var(--neutral-300)' }}>{group.name}</strong> · Global defaults + group overrides
            </div>
          </div>
        </div>
        {!agentEnabled && (
          <div style={{ padding: '10px 16px', background: '#FFF0B3', borderTop: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="solar:danger-triangle-linear" size={14} color="#F59E0B" />
            <span style={{ fontSize: 12, color: 'var(--neutral-400)' }}>
              Agent is disabled for this chat group. Toggle on to re-enable.
            </span>
          </div>
        )}
      </div>

      {/* Group Settings */}
      <div style={{ border: '0.5px solid var(--neutral-150)', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--neutral-500)' }}>Group Settings</span>
          <span style={{ fontSize: 11, color: 'var(--neutral-200)', background: 'var(--neutral-50)', padding: '2px 8px', borderRadius: 4 }}>
            Overrides global defaults for this group
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {groupSettings.map((s, i) => (
            <div key={i} style={{ padding: '10px 14px', background: 'var(--neutral-50)', borderRadius: 8, border: '0.5px solid var(--neutral-75, #F3F4F7)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--neutral-300)' }}>{s.label}</span>
                {s.isDefault && (
                  <span style={{ fontSize: 10, color: 'var(--neutral-200)', background: 'var(--neutral-0)', padding: '1px 6px', borderRadius: 3, border: '0.5px solid var(--neutral-150)' }}>
                    Default
                  </span>
                )}
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--neutral-500)', marginTop: 4 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--neutral-200)', marginTop: 2 }}>{s.hint}</div>
            </div>
          ))}
        </div>
      </div>

      {/* IF/THEN Rules */}
      <div style={{ border: '0.5px solid var(--neutral-150)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--neutral-150)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--neutral-500)' }}>IF / Then Rules</div>
            <span style={{ fontSize: 12, color: 'var(--neutral-200)' }}>
              {rules.filter(r => r.type !== 'custom').length} default · {rules.filter(r => r.type === 'custom').length} custom · Evaluated top to bottom
            </span>
          </div>
          <Button variant="primary" size="S" leadingIcon="solar:add-circle-linear" onClick={() => setShowAddRule(!showAddRule)}>
            Add Custom Rule
          </Button>
        </div>

        {/* Add Rule Form */}
        {showAddRule && (
          <div style={{ padding: '14px 20px', background: 'var(--neutral-50)', borderBottom: '0.5px solid var(--neutral-150)' }}>
            <div style={{ marginBottom: 10 }}>
              <label htmlFor={`${uid}-new-rule-name`} style={{ fontSize: 11, fontWeight: 500, color: 'var(--neutral-300)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Rule Name</label>
              <input id={`${uid}-new-rule-name`} value={newRuleName} onChange={e => setNewRuleName(e.target.value)}
                placeholder="e.g., Billing disputes to human" style={{
                width: '100%', marginTop: 4, padding: '8px 12px', borderRadius: 4,
                border: '0.5px solid var(--neutral-150)', fontSize: 13, fontFamily: "'Inter', sans-serif",
                outline: 'none', boxSizing: 'border-box',
              }} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label htmlFor={`${uid}-new-rule-condition`} style={{ fontSize: 11, fontWeight: 500, color: 'var(--neutral-300)', textTransform: 'uppercase', letterSpacing: '.04em' }}>If (Condition)</label>
                <select id={`${uid}-new-rule-condition`} value={newRuleCondition} onChange={e => setNewRuleCondition(e.target.value)} style={{
                  width: '100%', marginTop: 4, padding: '8px 12px', borderRadius: 4,
                  border: '0.5px solid var(--neutral-150)', fontSize: 13, fontFamily: "'Inter', sans-serif",
                  outline: 'none', background: 'var(--neutral-0)', cursor: 'pointer',
                }}>
                  <option>Message contains [keyword]</option>
                  <option>Patient membership status is [active/inactive]</option>
                  <option>Agent responses this session exceeds [N]</option>
                  <option>Message length exceeds [N] characters</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor={`${uid}-new-rule-action`} style={{ fontSize: 11, fontWeight: 500, color: 'var(--neutral-300)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Then (Action)</label>
                <select id={`${uid}-new-rule-action`} value={newRuleAction} onChange={e => setNewRuleAction(e.target.value)} style={{
                  width: '100%', marginTop: 4, padding: '8px 12px', borderRadius: 4,
                  border: '0.5px solid var(--neutral-150)', fontSize: 13, fontFamily: "'Inter', sans-serif",
                  outline: 'none', background: 'var(--neutral-0)', cursor: 'pointer',
                }}>
                  <option>Send message [text]</option>
                  <option>Hold (agent does not respond)</option>
                  <option>Flag for staff review</option>
                  <option>Create staff task</option>
                  <option>Route to specific team</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button variant="primary" size="S" onClick={() => {
                if (!newRuleName.trim()) return;
                const newRule = {
                  id: Date.now(), name: newRuleName.trim(), type: 'custom', locked: false, enabled: true,
                  condition: newRuleCondition, action: newRuleAction,
                };
                // Insert before the last rule (Default fallback)
                setRules(prev => {
                  const fallbackIdx = prev.findIndex(r => r.id === 10);
                  if (fallbackIdx >= 0) {
                    const next = [...prev];
                    next.splice(fallbackIdx, 0, newRule);
                    return next;
                  }
                  return [...prev, newRule];
                });
                setNewRuleName(''); setNewRuleCondition('Message contains [keyword]'); setNewRuleAction('Send message [text]');
                setShowAddRule(false);
                showToast('Custom rule added');
              }}>Add Rule</Button>
              <Button variant="secondary" size="S" onClick={() => setShowAddRule(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Rules List */}
        {rules.map((r, i) => (
          <div key={r.id}>
          <div style={{
            display: 'flex', alignItems: 'stretch',
            borderBottom: i < rules.length - 1 ? '0.5px solid var(--neutral-150)' : 'none',
            background: r.type === 'safety' ? 'rgba(255,235,230,0.15)' : '#fff',
          }}>
            {/* Priority column */}
            <div style={{
              width: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 2, borderRight: '0.5px solid var(--neutral-150)', flexShrink: 0,
            }}>
              {!r.locked && <Icon name="solar:sort-vertical-linear" size={12} color="var(--neutral-200)" />}
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--neutral-300)', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
            </div>

            {/* Content */}
            <div style={{ flex: 1, padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Badge variant={RULE_BADGE_VARIANT[r.type]} label={RULE_TYPE_LABEL[r.type]} />
                <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--neutral-500)' }}>{r.name}</span>
                {r.locked && <Icon name="solar:shield-check-linear" size={12} color="var(--neutral-200)" />}
                {r.priority && (
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--status-error)', background: '#FFEBE6', padding: '1px 6px', borderRadius: 3 }}>{r.priority}</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--neutral-300)', lineHeight: 1.5 }}>
                <span style={{ fontWeight: 500, color: 'var(--primary-300)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>If</span>{' '}
                <span style={{ color: 'var(--neutral-400)' }}>{r.condition}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--neutral-300)', lineHeight: 1.5, marginTop: 2 }}>
                <span style={{ fontWeight: 500, color: '#16A34A', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>Then</span>{' '}
                <span style={{ color: 'var(--neutral-400)' }}>{r.action}</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', flexShrink: 0 }}>
              <Switch checked={r.enabled} onChange={() => toggleRule(r.id)} disabled={r.locked} />
              {!r.locked && (
                <>
                  <ActionButton icon="solar:pen-linear" size="L" tooltip="Edit rule"
                    onClick={() => setEditingRuleId(editingRuleId === r.id ? null : r.id)} />
                  <span style={{ width: 1, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
                  <ActionButton icon="solar:trash-bin-minimalistic-linear" size="L" tooltip="Delete rule"
                    onClick={() => { setRules(prev => prev.filter(rule => rule.id !== r.id)); showToast('Rule deleted'); }} />
                </>
              )}
            </div>
          </div>
          {/* Inline edit form for custom rules */}
          {editingRuleId === r.id && !r.locked && (
            <div style={{ padding: '12px 16px', background: 'var(--neutral-50)', borderBottom: '0.5px solid var(--neutral-150)' }}>
              <div style={{ marginBottom: 8 }}>
                <label htmlFor={`${uid}-rule-${r.id}-name`} style={{ fontSize: 11, fontWeight: 500, color: 'var(--neutral-300)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Rule Name</label>
                <input id={`${uid}-rule-${r.id}-name`} value={r.name} onChange={e => setRules(prev => prev.map(rule => rule.id === r.id ? { ...rule, name: e.target.value } : rule))}
                  style={{ width: '100%', marginTop: 4, padding: '8px 12px', borderRadius: 4, border: '0.5px solid var(--neutral-150)', fontSize: 13, fontFamily: "'Inter', sans-serif", outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor={`${uid}-rule-${r.id}-condition`} style={{ fontSize: 11, fontWeight: 500, color: 'var(--neutral-300)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Condition</label>
                  <input id={`${uid}-rule-${r.id}-condition`} value={r.condition} onChange={e => setRules(prev => prev.map(rule => rule.id === r.id ? { ...rule, condition: e.target.value } : rule))}
                    style={{ width: '100%', marginTop: 4, padding: '8px 12px', borderRadius: 4, border: '0.5px solid var(--neutral-150)', fontSize: 13, fontFamily: "'Inter', sans-serif", outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor={`${uid}-rule-${r.id}-action`} style={{ fontSize: 11, fontWeight: 500, color: 'var(--neutral-300)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Action</label>
                  <input id={`${uid}-rule-${r.id}-action`} value={r.action} onChange={e => setRules(prev => prev.map(rule => rule.id === r.id ? { ...rule, action: e.target.value } : rule))}
                    style={{ width: '100%', marginTop: 4, padding: '8px 12px', borderRadius: 4, border: '0.5px solid var(--neutral-150)', fontSize: 13, fontFamily: "'Inter', sans-serif", outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <Button variant="primary" size="S" onClick={() => { setEditingRuleId(null); showToast('Rule updated'); }}>Save Changes</Button>
            </div>
          )}
          </div>
        ))}
      </div>

      {/* Key Constraints */}
      <div style={{
        background: '#FFF0B3', border: '0.5px solid rgba(245,158,11,0.2)', borderRadius: 8,
        padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start',
      }}>
        <Icon name="solar:danger-triangle-linear" size={20} color="#F59E0B" />
        <div style={{ fontSize: 12, color: 'var(--neutral-400)', lineHeight: 1.6 }}>
          <strong>Key Constraints:</strong> Emergency (#1) and Crisis (#2) always fire first — cannot be reordered, disabled, or overridden. Default Fallback (#10) always fires last. Each message matches at most one rule (first match wins). Custom rules are inserted above #10. Changes take effect immediately for new messages.
        </div>
      </div>
    </Drawer>
  );
}
