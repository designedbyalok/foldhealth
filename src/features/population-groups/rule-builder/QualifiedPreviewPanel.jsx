import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { Button } from '../../../components/Button/Button';
import { Textarea } from '../../../components/Textarea/Textarea';
import { Tabs } from '../../../components/Tabs/Tabs';
import { fetchRuleFromNaturalLanguage } from './fetchRuleFromNaturalLanguage';
import styles from './ruleBuilder.module.css';

const PANEL_MIN = 260;
const PANEL_MAX = 520;
const PANEL_DEFAULT = 300;

const EXAMPLE_PROMPTS = [
  'Active patients age 65 or older',
  'Female patients 50+ with low engagement',
  'Patients with diabetes in diagnoses and active membership',
];

const WELCOME = 'Describe who should qualify. I will update the rule on the left.';

function shortReply(text) {
  const t = String(text || '').trim();
  if (!t) return 'Rule updated.';
  const words = t.split(/\s+/);
  if (words.length <= 14) return t;
  return `${words.slice(0, 14).join(' ')}…`;
}

let msgSeq = 0;
function nextMsgId() {
  msgSeq += 1;
  return `msg-${Date.now()}-${msgSeq}`;
}

/**
 * Resizable right panel: AI chat tab + matching patients tab.
 */
export function QualifiedPreviewPanel({
  open,
  onToggle,
  members,
  count,
  loading,
  error,
  onRetry,
  currentRule,
  onApplyQuery,
}) {
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT);
  const [activeTab, setActiveTab] = useState('ai');
  const [draft, setDraft] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [messages, setMessages] = useState(() => [
    { id: nextMsgId(), role: 'assistant', content: WELCOME },
  ]);
  const dragging = useRef(false);
  const chatEndRef = useRef(null);
  const chatScrollRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, aiLoading]);

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev) => {
      if (!dragging.current) return;
      const next = Math.max(PANEL_MIN, Math.min(PANEL_MAX, window.innerWidth - ev.clientX));
      setPanelWidth(next);
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const sendMessage = async (text) => {
    const trimmed = (text ?? draft).trim();
    if (!trimmed || aiLoading) return;

    const userMsg = { id: nextMsgId(), role: 'user', content: trimmed };
    const historyForApi = [...messages, userMsg]
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    setDraft('');
    setAiLoading(true);

    try {
      const { rule, summary } = await fetchRuleFromNaturalLanguage({
        prompt: trimmed,
        messages: historyForApi,
        currentRule,
      });
      onApplyQuery?.(rule);
      setMessages((prev) => [
        ...prev,
        { id: nextMsgId(), role: 'assistant', content: shortReply(summary) },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: nextMsgId(), role: 'assistant', content: err?.message || 'Could not update the rule.' },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleComposerKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const showExamples = messages.length <= 1 && !aiLoading;

  if (!open) {
    return (
      <button type="button" className={styles.previewCollapsed} onClick={onToggle} title="Show rule assistant">
        <Icon name="custom:ai" size={16} color="var(--neutral-400)" />
        <span className={styles.previewCollapsedCount}>
          {loading ? '…' : (error ? '!' : (count ?? '-'))}
        </span>
      </button>
    );
  }

  const memberCount = loading || error ? undefined : (typeof count === 'number' ? count : 0);

  return (
    <aside className={styles.previewPanel} style={{ width: panelWidth }}>
      <div
        className={styles.previewResizeHandle}
        onMouseDown={handleResizeStart}
        aria-label="Resize panel"
        role="separator"
        aria-orientation="vertical"
      >
        <div className={styles.previewResizeLine} />
      </div>

      <div className={styles.previewPanelTabBar}>
        <Tabs
          embedded
          embeddedBaseline
          size="sm"
          fullWidth={false}
          items={[
            { key: 'ai', label: 'Build with AI', icon: 'custom:ai' },
            {
              key: 'members',
              label: 'Matching patients',
              icon: 'solar:users-group-rounded-linear',
              count: memberCount,
            },
          ]}
          value={activeTab}
          onValueChange={setActiveTab}
        />
      </div>

      {activeTab === 'ai' ? (
        <div className={styles.aiChat}>
          <div ref={chatScrollRef} className={styles.aiChatScroll}>
            {messages.map((m) => (
              <div
                key={m.id}
                className={m.role === 'user' ? styles.aiChatBubbleUser : styles.aiChatBubbleAssistant}
              >
                {m.content}
              </div>
            ))}
            {aiLoading && (
              <div className={styles.aiChatBubbleAssistant}>
                <span className={styles.aiChatTyping}>Updating rule…</span>
              </div>
            )}
            {showExamples && (
              <div className={styles.aiExamples}>
                {EXAMPLE_PROMPTS.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    className={styles.aiExampleChip}
                    disabled={aiLoading}
                    onClick={() => sendMessage(ex)}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className={styles.aiComposer}>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Refine the rule or describe a new population…"
              rows={2}
              disabled={aiLoading}
              style={{ width: '100%', resize: 'none', minHeight: 56 }}
            />
            <Button
              size="sm"
              disabled={!draft.trim() || aiLoading}
              onClick={() => sendMessage()}
            >
              Send
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.previewMembersPane}>
          <div className={styles.previewCount}>
            {loading ? '…' : (error ? '-' : count)}
          </div>
          {error && (
            <div className={styles.previewError}>
              <Icon name="solar:danger-triangle-linear" size={14} color="var(--status-error)" />
              <span>Failed to load patients</span>
              <Button variant="soft" size="sm" onClick={onRetry}>Retry</Button>
            </div>
          )}
          <div className={styles.previewList}>
            {!error && !loading && members.length === 0 && (
              <span className={styles.previewEmpty}>No matches yet: add or adjust conditions.</span>
            )}
            {!error && members.slice(0, 50).map((m) => (
              <div key={m.id} className={styles.previewRow}>
                <span className={styles.previewName}>{m.name}</span>
                <span className={styles.previewMeta}>{m.age}y • {m.gender || '-'}</span>
              </div>
            ))}
            {!error && members.length > 50 && (
              <span className={styles.previewMore}>+{members.length - 50} more</span>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
