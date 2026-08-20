import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../Button/Button';
import { Avatar } from '../Avatar/Avatar';
import badgeStyles from '../Badge/Badge.module.css';
import { SYSTEM_USERS } from '../../features/hcc/systemUsers';
import styles from './CommentComposer.module.css';

function handlePastePlainText(e) {
  e.preventDefault();
  const plain = e.clipboardData?.getData('text/plain') ?? '';
  document.execCommand('insertText', false, plain);
}

/**
 * CommentComposer — shared comment field + Comment/Cancel actions used by
 * the TaskDetailDrawer and the DiagPanel Comments tab. Starts as a
 * single-line placeholder and expands to a taller field on focus with
 * primary / secondary action buttons.
 *
 * The input is a contenteditable div (not a <textarea>) so accepted
 * @mentions render as inline Badge chips right inside the text — matching
 * the look of the DOS-source / mention pill. Chips are contenteditable=
 * "false" atoms: arrow keys jump over them, backspace at the boundary
 * removes the whole chip, and the composer serializes them back to
 * "@Name " tokens when the user submits so downstream storage stays a
 * plain string.
 *
 * Props:
 *  - onSubmit(text, mentions)
 *                    Fires on Comment. `text` is the serialized body —
 *                    mention chips become "@Name " tokens. `mentions` is the
 *                    structured list of chips actually left in the editor,
 *                    `[{ id, name }]`, where `id` is a profiles.id (null when
 *                    the picker was running off the SYSTEM_USERS fixture).
 *                    Prefer `mentions` over re-parsing `text`: the string
 *                    cannot tell you who was meant, only what was typed.
 *                    Parent clears its own state and the composer resets.
 *  - placeholder     Overrides the default placeholder.
 *  - autoFocus       Focus the input on mount.
 *  - statusChange    When set the composer morphs into the "Status
 *                    Changed" card. Shape: { fromStatus, toStatus, onCancel }.
 */

// Walk the editor's children and emit a plain string: text nodes verbatim,
// mention chips as "@Name". Used both for submit output and to keep the
// `text` state in sync so the Comment button's disabled state is accurate.
function serialize(root) {
  if (!root) return '';
  let out = '';
  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.nodeValue || '';
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = /** @type {HTMLElement} */ (node);
      if (el.dataset?.mentionName) {
        out += `@${el.dataset.mentionName}`;
      } else if (el.tagName === 'BR') {
        out += '\n';
      } else {
        out += el.textContent || '';
      }
    }
  });
  return out;
}

// Build the DOM node for a mention chip. Rendering imperatively (rather
// than via <Badge/>) keeps the chip out of React's reconciliation path —
// which would otherwise fight the contenteditable's own DOM mutations —
// and lets us reuse Badge's CSS module classes for pixel-identical styling.
//
// The chip carries the picked profile id alongside the name. The id is the
// point: it means downstream storage never has to re-derive who was meant by
// regexing the submitted string, which cannot distinguish "@Fold Demo" from
// "@fold demo", loses anyone whose name is followed by punctuation, and
// silently drops a mention if the display name is later edited.
function createMentionChip(user) {
  const chip = document.createElement('span');
  chip.contentEditable = 'false';
  chip.className = styles.mentionChip;
  chip.dataset.mentionName = user.name;
  // Only real profiles rows carry an id worth persisting. When the picker is
  // running off the SYSTEM_USERS mock (profiles fetch failed) the ids are
  // fixtures, not uuids, so they are deliberately left off the chip and the
  // name remains the only resolvable signal.
  if (user.realProfile && user.id) chip.dataset.mentionId = user.id;
  const badge = document.createElement('span');
  badge.className = `${badgeStyles.badge} ${badgeStyles.mention}`;
  badge.textContent = `@${user.name}`;
  chip.appendChild(badge);
  return chip;
}

// Collect the mention chips actually present in the editor, in document
// order, deduped. Reading the DOM rather than re-parsing the serialized text
// is the whole point of the chips being atoms: if the user backspaced a chip
// away, it is not in here.
function collectMentions(root) {
  if (!root) return [];
  const seen = new Set();
  const out = [];
  root.querySelectorAll('[data-mention-name]').forEach((el) => {
    const name = el.dataset.mentionName;
    const id = el.dataset.mentionId || null;
    const key = id || name;
    if (!name || seen.has(key)) return;
    seen.add(key);
    out.push({ id, name });
  });
  return out;
}

// Detect the "@query" fragment before the caret inside the editor. Walks
// the current selection's text node backwards to the last "@" and returns
// { range, query } if that "@" is at start-of-input or preceded by
// whitespace — otherwise null.
function detectMention(editor) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) return null;
  if (!editor.contains(range.startContainer)) return null;
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return null;
  const text = node.nodeValue || '';
  const caret = range.startOffset;
  const upToCaret = text.slice(0, caret);
  // Look for @ + word-chars (no whitespace) at the end of the string.
  const match = /(^|\s)@([^\s@]*)$/.exec(upToCaret);
  if (!match) return null;
  const atOffset = caret - match[2].length - 1; // position of the "@" itself
  const atRange = document.createRange();
  atRange.setStart(node, atOffset);
  atRange.setEnd(node, caret);
  return { range: atRange, query: match[2] };
}

// Place caret after a specific node inside the editor.
function caretAfter(node) {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

export function CommentComposer({
  onSubmit,
  placeholder = 'Add a comment, use @ to mention someone',
  autoFocus = false,
  statusChange = null,
}) {
  const inStatusMode = !!statusChange;
  const editorRef = useRef(null);
  const [text, setText] = useState('');
  const [expanded, setExpanded] = useState(autoFocus || inStatusMode);
  useEffect(() => { if (inStatusMode) setExpanded(true); }, [inStatusMode]);

  // ── Mention picker state ──────────────────────────────────────────────
  const [mention, setMention] = useState(null); // { range, query } | null
  const [mentionIdx, setMentionIdx] = useState(0);
  const platformUsers = useAppStore(s => s.platformUsers);
  const currentUserProfile = useAppStore(s => s.currentUserProfile);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  useEffect(() => { fetchPlatformUsers?.(); }, [fetchPlatformUsers]);
  // Fall back to the mock so the picker still renders before the fetch lands.
  // Always include the signed-in user so someone can @-mention themselves
  // (or write a note visible in their own Mentions tab). Deduped by id.
  const users = useMemo(() => {
    // `realProfile` marks entries whose `id` is an actual profiles.id, so
    // createMentionChip knows which ids are safe to persist. platformUsers is
    // read straight from `profiles`; SYSTEM_USERS is a fixture roster whose
    // ids are not uuids and must never be stored as a mention target.
    const hasReal = !!platformUsers?.length;
    const base = hasReal
      ? platformUsers.map(u => ({ ...u, realProfile: true }))
      : SYSTEM_USERS;
    if (!currentUserProfile?.name) return base;
    if (base.some(u => u.id === currentUserProfile.id || u.name === currentUserProfile.name)) return base;
    const initials = currentUserProfile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return [
      { id: currentUserProfile.id, name: currentUserProfile.name, initials, role: currentUserProfile.role, source: 'self', realProfile: true },
      ...base,
    ];
  }, [platformUsers, currentUserProfile]);
  const matches = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    const filtered = q
      ? users.filter(u => (u.name || '').toLowerCase().includes(q))
      : users;
    return filtered.slice(0, 8);
  }, [users, mention]);
  useEffect(() => { setMentionIdx(0); }, [mention?.query]);

  // Autofocus on mount when requested.
  useEffect(() => {
    if ((autoFocus || inStatusMode) && editorRef.current) {
      editorRef.current.focus();
    }
  }, [autoFocus, inStatusMode]);

  const refresh = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    setText(serialize(editor));
    setMention(detectMention(editor));
  }, []);

  const handleInput = () => refresh();
  const handleSelect = () => {
    const editor = editorRef.current;
    if (!editor) return;
    setMention(detectMention(editor));
  };

  const insertMention = (user) => {
    const editor = editorRef.current;
    if (!editor || !mention) return;
    editor.focus();
    // Delete the "@query" fragment, insert the chip + a trailing space,
    // then park the caret after the space.
    mention.range.deleteContents();
    const chip = createMentionChip(user);
    const space = document.createTextNode(' ');
    mention.range.insertNode(space);
    mention.range.insertNode(chip);
    caretAfter(space);
    setMention(null);
    // DOM mutated imperatively → resync state.
    setText(serialize(editor));
  };

  const resetEditor = () => {
    const editor = editorRef.current;
    if (editor) editor.innerHTML = '';
    setText('');
    setMention(null);
  };

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    // Second arg is additive — callers that only want the body ignore it.
    onSubmit?.(body, collectMentions(editorRef.current));
    resetEditor();
    setExpanded(false);
  };
  const cancel = () => {
    resetEditor();
    setExpanded(false);
    // In status-change mode, Cancel also aborts the pending transition
    // upstream (parent clears the pending state).
    statusChange?.onCancel?.();
  };

  const handleKeyDown = (e) => {
    if (mention && matches.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIdx((i) => (i + 1) % matches.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIdx((i) => (i - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(matches[mentionIdx]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMention(null);
        return;
      }
    }
  };

  const handlePaste = handlePastePlainText;

  const effectivePlaceholder = inStatusMode
    ? 'Add a comment explaining what records you need…'
    : placeholder;

  return (
    <div className={[styles.wrap, inStatusMode ? styles.wrapStatusMode : ''].filter(Boolean).join(' ')}>
      {inStatusMode && (
        <div className={styles.statusCard}>
          <div className={styles.statusHeader}>Status Changed</div>
          <div className={styles.statusPillRow}>
            <span className={[styles.statusPill, styles.statusPillFrom].join(' ')}>{statusChange.fromStatus}</span>
            <span className={styles.statusPillArrow}>→</span>
            <span className={[styles.statusPill, styles.statusPillTo].join(' ')}>{statusChange.toStatus}</span>
          </div>
        </div>
      )}
      <div
        ref={editorRef}
        role="textbox"
        aria-multiline="true"
        aria-label={effectivePlaceholder}
        contentEditable
        suppressContentEditableWarning
        className={[styles.textarea, expanded ? styles.textareaExpanded : ''].filter(Boolean).join(' ')}
        data-empty={text.length === 0 ? 'true' : 'false'}
        data-placeholder={effectivePlaceholder}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onKeyUp={handleSelect}
        onClick={handleSelect}
        onPaste={handlePaste}
        onFocus={() => setExpanded(true)}
        onBlur={() => {
          // Delay closing so click on a menu item can register.
          setTimeout(() => setMention(null), 150);
        }}
      />
      {inStatusMode && (
        <div className={styles.statusHelper}>A comment is required to change the status.</div>
      )}
      {mention && matches.length > 0 && editorRef.current && (
        <MentionMenu
          anchor={editorRef.current}
          matches={matches}
          activeIdx={mentionIdx}
          onPick={insertMention}
        />
      )}
      {expanded && (
        <div className={styles.actions}>
          <Button variant="primary" size="S" disabled={!text.trim()} onClick={submit}>
            Comment
          </Button>
          <Button variant="secondary" size="S" onClick={cancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

function MentionMenu({ anchor, matches, activeIdx, onPick }) {
  const [pos, setPos] = useState(null);
  useEffect(() => {
    const compute = () => {
      const r = anchor.getBoundingClientRect();
      const margin = 8;
      const menuH = Math.min(280, 40 + matches.length * 40);
      const spaceBelow = window.innerHeight - r.bottom - margin;
      const flipUp = spaceBelow < menuH && r.top > menuH + margin;
      const top = flipUp ? Math.max(margin, r.top - menuH - 4) : r.bottom + 4;
      setPos({ top, left: r.left, width: Math.max(r.width, 240) });
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [anchor, matches.length]);

  if (!pos) return null;

  return createPortal(
    <div className={styles.mentionMenu} style={{ top: pos.top, left: pos.left, width: pos.width }}>
      {matches.map((u, i) => (
        <button
          key={u.id || u.name}
          type="button"
          className={[styles.mentionItem, i === activeIdx ? styles.mentionItemActive : ''].join(' ')}
          onMouseDown={(e) => { e.preventDefault(); onPick(u); }}
        >
          <Avatar variant="staff" size={24} initials={u.initials || (u.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2)} />
          <span className={styles.mentionName}>{u.name}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
}
