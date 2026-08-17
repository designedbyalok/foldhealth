import { useState, useRef, useEffect } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { UnityIcon } from '../../components/UnityIcon/UnityIcon';
import { useAppStore } from '../../store/useAppStore';
import { generateFlowFromPrompt } from '../../lib/flowGenerator';
import styles from './ChatPanel.module.css';

const INITIAL_MESSAGE = {
  role: 'assistant',
  content: 'Here\'s a production-style node workflow you can modify. Ask me to:\n\n• **Add a node** — e.g. "Add a medication check node"\n• **Remove a node** — e.g. "Remove the escalation node"\n• **Modify a node** — e.g. "Update the greeting message"\n• **Regenerate the flow** — e.g. "Create a chronic care monitoring flow"',
  time: formatTime(),
};

// Message text is user- and model-authored, so it must be HTML-escaped BEFORE
// the tiny markdown pass adds its own tags — otherwise a message containing
// markup (e.g. `<img onerror=…>`) executes when injected into the bubble.
// Escaping first means the only tags that survive are the ones we add here.
function renderMessageMarkup(content) {
  const escaped = String(content ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>')
    .replace(/• /g, '&bull; ');
}

function formatTime() {
  return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function ChatPanel({ nodes, edges, onApplyFlow, agentName }) {
  const builderPrompt = useAppStore(s => s.builderPrompt);
  const updateNodeData = useAppStore(s => s.updateNodeData);
  const showToast = useAppStore(s => s.showToast);

  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isProcessing) return;
    const userMsg = { role: 'user', content: input.trim(), time: formatTime() };
    setMessages(prev => [...prev, userMsg]);
    processCommand(input.trim());
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const processCommand = (text) => {
    setIsProcessing(true);
    const lower = text.toLowerCase();

    setTimeout(() => {
      let response = '';

      // ─── Regenerate flow ───
      if (lower.includes('regenerate') || lower.includes('create a') || lower.includes('build a') || lower.includes('generate')) {
        const generated = generateFlowFromPrompt(text);
        if (generated) {
          onApplyFlow(generated.nodes, generated.edges);
          response = `I've regenerated the workflow based on your request. The canvas now shows ${generated.nodes.length - 2} conversation nodes with appropriate transitions. You can click any node to edit its details.`;
        } else {
          response = 'I couldn\'t determine the flow type from your description. Try being more specific, e.g. "Create a post-discharge follow-up flow" or "Build a chronic care monitoring workflow".';
        }
      }
      // ─── Add a node ───
      else if (lower.includes('add') && (lower.includes('node') || lower.includes('step'))) {
        const nameMatch = text.match(/add (?:a |an )?(.+?)(?:\s+node|\s+step|$)/i);
        const nodeName = nameMatch ? nameMatch[1].trim() : 'New Node';
        const maxX = Math.max(...nodes.map(n => n.position?.x || 0), 0);
        const avgY = nodes.reduce((s, n) => s + (n.position?.y || 0), 0) / (nodes.length || 1);

        const newNode = {
          id: `n${Date.now()}`,
          type: 'conversationNode',
          position: { x: maxX + 200, y: avgY },
          data: {
            label: nodeName.charAt(0).toUpperCase() + nodeName.slice(1),
            prompt: '',
            nodeType: 'conversation',
            transitions: [],
            guardrails: '',
          },
        };

        const newNodes = [...nodes, newNode];
        onApplyFlow(newNodes, edges);
        response = `Added "${newNode.data.label}" node to the canvas. Click on it to configure its conversation prompt and transitions.`;
      }
      // ─── Remove a node ───
      else if ((lower.includes('remove') || lower.includes('delete')) && (lower.includes('node') || lower.includes('step'))) {
        const nameMatch = text.match(/(?:remove|delete) (?:the |a )?(.+?)(?:\s+node|\s+step|$)/i);
        const searchName = nameMatch ? nameMatch[1].trim().toLowerCase() : '';
        const found = nodes.find(n =>
          n.data.label?.toLowerCase().includes(searchName) &&
          n.type !== 'startNode'
        );
        if (found) {
          const newNodes = nodes.filter(n => n.id !== found.id);
          const newEdges = edges.filter(e => e.source !== found.id && e.target !== found.id);
          onApplyFlow(newNodes, newEdges);
          response = `Removed "${found.data.label}" node and its connections from the flow.`;
        } else {
          const labels = [];
          for (const n of nodes) {
            if (n.type === 'conversationNode') labels.push(n.data.label);
          }
          response = `I couldn't find a node matching "${searchName}". Available nodes: ${labels.join(', ')}.`;
        }
      }
      // ─── Modify/Update a node ───
      else if (lower.includes('update') || lower.includes('modify') || lower.includes('change')) {
        const nameMatch = text.match(/(?:update|modify|change) (?:the |a )?(.+?)(?:\s+(?:node|message|prompt|to say|with))/i);
        const searchName = nameMatch ? nameMatch[1].trim().toLowerCase() : '';
        const found = nodes.find(n =>
          n.data.label?.toLowerCase().includes(searchName) &&
          n.type === 'conversationNode'
        );
        if (found) {
          const msgMatch = text.match(/(?:to say|with|message to|prompt to)\s+["']?(.+?)["']?$/i);
          if (msgMatch) {
            updateNodeData(found.id, { prompt: msgMatch[1].trim() });
            response = `Updated the prompt for "${found.data.label}".`;
          } else {
            response = `Found "${found.data.label}". What would you like to change? Try: "Update ${found.data.label} prompt to say [new message]"`;
          }
        } else {
          response = 'I couldn\'t identify which node to modify. Try specifying the node name, e.g. "Update the greeting message to say Hello!"';
        }
      }
      // ─── List nodes ───
      else if (lower.includes('list') || lower.includes('show') || lower.includes('what nodes')) {
        const lines = [];
        let i = 0;
        for (const n of nodes) {
          if (n.type !== 'conversationNode') continue;
          i += 1;
          lines.push(`${i}. **${n.data.label}** (${n.data.nodeType})`);
        }
        response = `Current nodes in the flow:\n\n${lines.join('\n')}`;
      }
      // ─── Help ───
      else {
        response = 'I can help you modify this workflow. Try:\n\n• "Add a medication check node"\n• "Remove the escalation node"\n• "Regenerate as a chronic care flow"\n• "List all nodes"\n• "Update the greeting prompt to say..."';
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response,
        time: formatTime(),
      }]);
      setIsProcessing(false);
    }, 600);
  };

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <div className={styles.avatar}>
            <UnityIcon size={16} color="#fff" />
          </div>
          <span className={styles.headerName}>Workflow Assistant</span>
        </div>
        <button className={styles.moreBtn} aria-label="More options">
          <Icon name="solar:menu-dots-bold" size={16} color="var(--neutral-300)" />
        </button>
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {messages.map((msg, i) => (
          <div key={i} className={`${styles.message} ${msg.role === 'user' ? styles.messageUser : styles.messageAssistant}`}>
            {msg.role === 'assistant' && (
              <div className={styles.msgAvatar}>
                <UnityIcon size={12} color="#fff" />
              </div>
            )}
            <div className={styles.msgBubble}>
              <div className={styles.msgContent} dangerouslySetInnerHTML={{
                __html: renderMessageMarkup(msg.content)
              }} />
              <span className={styles.msgTime}>{msg.time}</span>
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className={`${styles.message} ${styles.messageAssistant}`}>
            <div className={styles.msgAvatar}>
              <UnityIcon size={12} color="#fff" />
            </div>
            <div className={styles.msgBubble}>
              <div className={styles.typing}>
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={styles.inputArea}>
        <div className={styles.inputWrap}>
          <button className={styles.attachBtn} aria-label="Attach file">
            <Icon name="solar:paperclip-linear" size={16} color="var(--neutral-300)" />
          </button>
          <input aria-label="Describe the changes you want"
            ref={inputRef}
            className={styles.input}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask for the changes here"
            disabled={isProcessing}
          />
          <button
            className={`${styles.sendBtn} ${input.trim() ? styles.sendBtnActive : ''}`}
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            aria-label="Send message"
          >
            <Icon name="solar:arrow-up-linear" size={16} color={input.trim() ? '#fff' : 'var(--neutral-200)'} />
          </button>
        </div>
      </div>
    </div>
  );
}
