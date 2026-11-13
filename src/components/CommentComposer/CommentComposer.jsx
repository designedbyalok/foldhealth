import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../Button/Button';
import { Avatar } from '../Avatar/Avatar';
import { Icon } from '../Icon/Icon';
import { Badge } from '../Badge/Badge';
import badgeStyles from '../Badge/Badge.module.css';
import { MentionRoster } from './MentionRoster';
import styles from './CommentComposer.module.css';

function handlePastePlainText(e) {
  e.preventDefault();
  const plain = e.clipboardData?.getData('text/plain') ?? '';
  document.execCommand('insertText', false, plain);
}

/**
 * CommentComposer: shared comment field + Comment/Cancel actions used by
 * the TaskDetailDrawer and the DiagPanel Comments tab. Starts as a
 * single-line placeholder and expands to a taller field on focus with
 * primary / secondary action buttons.
 *
 * The input is a contenteditable div (not a <textarea>) so accepted
 * @mentions render as inline Badge chips right inside the text, matching
 * the look of the DOS-source / mention pill. Chips are contenteditable=
 * "false" atoms: arrow keys jump over them, backspace at the boundary
 * removes the whole chip, and the composer serializes them back to
 * "@Name " tokens when the user submits so downstream storage stays a
 * plain string.
 *
 * Props:
 *  - onSubmit(text, mentions)
 *                    Fires on Comment. `text` is the serialized body,
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
// than via <Badge/>) keeps the chip out of React's reconciliation path,
// which would otherwise fight the contenteditable's own DOM mutations,
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
  // Display drops the leading "@" so the mention reads as an inline link
  // rather than a Twitter-style handle. Serialization still stamps "@Name"
  // via dataset.mentionName, so downstream parsing (bell notifications,
  // read-only rendering) stays intact.
  badge.textContent = user.name;
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
// whitespace: otherwise null.
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
  // Fires on every keystroke with the current serialized text + mention list.
  // Use this when the composer is embedded in a dialog that owns its own
  // Submit / Cancel buttons and needs live access to the value (e.g. to
  // enable a required-field CTA or render a character counter).
  onChange,
  placeholder = 'Add a comment, use @ to mention someone',
  autoFocus = false,
  statusChange = null,
  // Embedded mode: hide the built-in Comment / Cancel actions so the
  // wrapping dialog can drive submission from its own footer buttons. The
  // composer still handles @mentions, keyboard picker, and serialization.
  hideActions = false,
  // Soft character cap. When set, further input past the cap is blocked
  // (via `beforeinput`) and the parent can render a counter using
  // onChange's text length.
  maxLength,
  // Optional seed text (e.g. when the composer is reused for the "Edit
  // comment" flow). Rendered into the contenteditable on mount with
  // `@Name` fragments re-hydrated into real mention chips so the
  // reader sees the same orange pill they saw in the read-only view.
  // Later prop changes are ignored: this is a one-shot mount seed;
  // key the component off the comment id if you want a fresh seed.
  initialValue,
  // Copy overrides for the Comment / Cancel actions, so the same
  // composer can label its primary CTA as "Save" in the edit flow.
  submitLabel,
  cancelLabel,
  // Fires when the Cancel button is clicked, parent can use this to
  // close the composer (e.g. leaving the "Edit comment" state).
  onCancel,
  // Optional mention roster ({ id, name, initials, roleLabel?, realProfile?,
  // disabled?, disabledReason? }). When given, only these people are listed
  // and their roleLabel shows beside the name. A `disabled` entry is shown
  // (with its reason) but can't be picked, e.g. a user with no access to the
  // record.
  users: usersProp,
}) {
  const inStatusMode = !!statusChange;
  const editorRef = useRef(null);
  const [text, setText] = useState('');
  const [expanded, setExpanded] = useState(autoFocus || inStatusMode);
  useEffect(() => { if (inStatusMode) setExpanded(true); }, [inStatusMode]);

  // ── Mention picker state ──────────────────────────────────────────────
  const [mention, setMention] = useState(null); // { range, query } | null
  const [mentionIdx, setMentionIdx] = useState(0);
  const roster = useContext(MentionRoster);
  useEffect(() => { if (!usersProp) roster.load?.(); }, [usersProp, roster]);
  const users = useMemo(() => usersProp || roster.users || [], [usersProp, roster.users]);
  const matches = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    const filtered = q
      ? users.filter(u => (u.name || '').toLowerCase().includes(q))
      : users;
    // Pickable people first; disabled ones follow so the whole roster is
    // visible without crowding out who can actually be tagged. Searching for
    // someone out of office lists them first (they can still be tagged), then
    // whoever covers them (Suggested), then the rest.
    const enabled = filtered.filter(u => !u.disabled);
    const disabled = filtered.filter(u => u.disabled);
    const top = q ? enabled.filter(u => u.out) : [];
    const covering = new Map(); // covering person's name → names of those they cover
    top.forEach(a => (a.coveredBy || []).forEach(n => covering.set(n, [...(covering.get(n) || []), a.name])));
    const suggested = users
      .filter(u => !u.out && !u.disabled && covering.has(u.name))
      .map(u => ({ ...u, coveringFor: covering.get(u.name), group: 'Suggested' }));
    const topSet = new Set(top);
    const rest = enabled.filter(u => !topSet.has(u) && !covering.has(u.name));
    const head = [...top, ...suggested];
    const tail = usersProp ? [...rest, ...disabled] : rest.slice(0, 8);
    if (head.length && tail.length) tail[0] = { ...tail[0], group: 'All' };
    return [...head, ...tail];
  }, [users, usersProp, mention]);
  useEffect(() => { setMentionIdx(0); }, [mention?.query]);
  // Arrow keys step over disabled rows; -1 when nobody is pickable.
  const stepMention = (from, dir) => {
    for (let n = 1; n <= matches.length; n++) {
      const i = (from + dir * n + matches.length) % matches.length;
      if (!matches[i].disabled) return i;
    }
    return -1;
  };

  // Autofocus on mount when requested.
  useEffect(() => {
    if ((autoFocus || inStatusMode) && editorRef.current) {
      editorRef.current.focus();
    }
  }, [autoFocus, inStatusMode]);

  // Seed the editor with `initialValue` on mount: split by mention
  // regex, wrap `@Name` fragments in real chips so the edit view
  // matches the read-only rendering. Deliberately one-shot: later
  // prop changes are ignored (edit sessions get re-seeded by keying
  // the composer off the comment id upstream).
  useEffect(() => {
    if (!initialValue) return;
    const editor = editorRef.current;
    // Re-hydrate against everyone we know, not just the pickable roster, so an
    // existing tag of someone outside the list survives an edit.
    const known = [...users, ...(roster.users || [])];
    if (!editor || !known.length) return;
    // Empty first so a re-mount with fresh initialValue doesn't stack.
    editor.innerHTML = '';
    const names = [...new Set(known.map(u => u.name).filter(Boolean))];
    // Longest-first so a full-name match wins over a shorter prefix.
    const sortedNames = names.slice().sort((a, b) => b.length - a.length);
    if (!sortedNames.length) {
      editor.appendChild(document.createTextNode(initialValue));
    } else {
      const escaped = sortedNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const re = new RegExp(`@(${escaped.join('|')})`, 'g');
      let lastIdx = 0;
      let match;
      while ((match = re.exec(initialValue)) !== null) {
        if (match.index > lastIdx) {
          editor.appendChild(document.createTextNode(initialValue.slice(lastIdx, match.index)));
        }
        const user = known.find(u => u.name === match[1]);
        if (user) {
          editor.appendChild(createMentionChip(user));
          // Trailing space so caret escapes the chip cleanly.
          editor.appendChild(document.createTextNode(' '));
        } else {
          editor.appendChild(document.createTextNode(match[0]));
        }
        lastIdx = match.index + match[0].length;
      }
      if (lastIdx < initialValue.length) {
        editor.appendChild(document.createTextNode(initialValue.slice(lastIdx)));
      }
    }
    setText(serialize(editor));
    setExpanded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users.length, roster.users?.length]);

  const refresh = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const next = serialize(editor);
    setText(next);
    setMention(detectMention(editor));
    // Notify the parent (embedded mode). Fire outside of setState so the
    // parent gets the just-computed value rather than the stale one.
    onChange?.(next, collectMentions(editor));
  }, [onChange]);

  const handleInput = () => refresh();
  // Block input that would push the serialized body past `maxLength`.
  // `beforeinput` fires with the pending data so we can veto without a
  // reset-and-restore of the caret position.
  const handleBeforeInput = (e) => {
    if (!maxLength) return;
    const editor = editorRef.current;
    if (!editor) return;
    const inserting = typeof e.data === 'string' ? e.data.length : 0;
    if (!inserting) return;
    const remaining = maxLength - serialize(editor).length;
    if (remaining <= 0) { e.preventDefault(); return; }
    if (inserting > remaining) e.preventDefault();
  };
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
    // Second arg is additive: callers that only want the body ignore it.
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
    onCancel?.();
  };

  const handleKeyDown = (e) => {
    if (mention && matches.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIdx((i) => stepMention(i, 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIdx((i) => stepMention(i, -1));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        const pick = matches[mentionIdx];
        if (pick && !pick.disabled) {
          e.preventDefault();
          insertMention(pick);
        }
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
        onBeforeInput={handleBeforeInput}
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
      {expanded && !hideActions && (
        <div className={styles.actions}>
          <Button size="sm" disabled={!text.trim()} onClick={submit}>
            {submitLabel || 'Comment'}
          </Button>
          <Button variant="outline" size="sm" onClick={cancel}>
            {cancelLabel || 'Cancel'}
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
      {matches.map((u, i) => [
        u.group && <div key={`g-${u.group}`} className={styles.mentionGroup}>{u.group}</div>,
        <button
          key={u.id || u.name}
          type="button"
          disabled={u.disabled}
          aria-disabled={u.disabled || undefined}
          title={u.disabled ? u.disabledReason : undefined}
          className={[styles.mentionItem, i === activeIdx && !u.disabled ? styles.mentionItemActive : '', u.disabled ? styles.mentionItemDisabled : ''].filter(Boolean).join(' ')}
          onMouseDown={(e) => { e.preventDefault(); if (!u.disabled) onPick(u); }}
        >
          <Avatar variant="staff" size={24} userName={u.name} userId={u.id} initials={u.initials || (u.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2)} />
          <span className={styles.mentionName}>
            <span className={styles.mentionNameRow}>
              <span>
                {u.name}
                {u.roleLabel && <span className={styles.mentionRole}> ({u.roleLabel})</span>}
              </span>
              {u.out && <Badge tone="magenta" size="sm" label="Out of Office" />}
            </span>
            {u.coveringFor && <span className={styles.mentionCovering}>Covering for {u.coveringFor.join(', ')}</span>}
          </span>
          {u.disabled && u.disabledReason && (
            <span className={styles.mentionDisabledReason}>
              <Icon name="solar:lock-keyhole-minimalistic-linear" size={12} color="currentColor" />
              {u.disabledReason}
            </span>
          )}
        </button>,
      ])}
    </div>,
    document.body,
  );
}
