import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MenuPopover } from '../MenuPopover/MenuPopover';
import { Switch } from '../Switch/Switch';
import { ActionButton } from '../ActionButton/ActionButton';
import { Icon } from '../Icon/Icon';
import { Checkbox } from '../Checkbox/Checkbox';
import { Link } from '../Link/Link';
import { Avatar } from '../Avatar/Avatar';
import { Badge } from '../Badge/Badge';
import { MentionRoster } from '../CommentComposer/MentionRoster';
import { LinkHighlightTextarea } from '../Textarea/Textarea';
import styles from './MessageComposer.module.css';

/**
 * Fold Health MessageComposer: the conversation type box (Figma 846:22174,
 * spacing per 3540:63749).
 * Internal toggle and tool icons on top, the message line with Send and
 * Schedule beside it, "Press Enter to send" and Archive on send below.
 * Internal on turns the box orange: the message is for staff only.
 *
 * The box grows with its text up to 150px, then scrolls; that includes text
 * set from outside (e.g. a form link added by a drawer) and shrinking back
 * after Send. Web links in it show blue and underlined.
 *
 * @param {object}   props
 * @param {string}   props.value
 * @param {(v: string) => void} props.onChange
 * @param {() => void} props.onSend
 * @param {boolean}  [props.internal]
 * @param {(v: boolean) => void} [props.onInternalChange] – omit to hide the toggle
 * @param {boolean}  [props.internalOnly] – always internal (e.g. a Calls thread)
 * @param {Array<{ key: string, icon?: string, iconNode?: React.ReactNode, tooltip: string, onClick?: () => void }>} [props.tools]
 *   – `iconNode` is a custom icon for tools with no Solar match
 * @param {boolean}  [props.archiveOnSend]
 * @param {(v: boolean) => void} [props.onArchiveOnSendChange]
 * @param {string}   [props.placeholder]
 * @param {boolean}  [props.disabled]
 * @param {boolean}  [props.sending]
 * @param {number}   [props.maxLength]
 * @param {React.ReactNode} [props.above] – shown above the box (e.g. an attachment chip)
 * @param {React.ReactNode} [props.toolbarStart] – after the Internal toggle, past a divider (e.g. Log For)
 * @param {Array<{ id: string, name: string, size?: number, type?: string, previewUrl?: string, uploading?: boolean }>} [props.attachments]
 *   – files attached but not sent yet, shown as cards inside the box
 *   (Figma Communications 1:36070); Send goes out with them
 * @param {(id: string) => void} [props.onRemoveAttachment]
 * @param {boolean}  [props.showSchedule=true] – the (not yet available) Schedule send button
 * @param {Array<{ id: string, name: string, initials?: string, kind: string, variant?: 'patient'|'staff', out?: boolean, coveredBy?: string[] }>} [props.mentions]
 *   people to @mention: typing "@" and part of a name lists them right above
 *   the "@" (avatar, name, `kind` such as Patient or User); picking one writes
 *   "@Name". Someone `out` of office wears an Out of Office badge and can
 *   still be mentioned; searching for them lists them first, then whoever
 *   covers them (`coveredBy`, names) under Suggested, "Covering for …".
 *   Without `mentions`, the app's people (the MentionRoster) are offered.
 */
const MAX_BOX_HEIGHT = 150;
const MENTION_MAX = 8;
// "@" at the start or after a space, then the name typed so far (no spaces).
const MENTION_RE = /(^|\s)@([^\s@]*)$/;
const initialsOf = (name) => String(name || '?').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
// Where the "@" sits in the box (px from the row's left), so the list opens
// right above it, kept inside the row.
const MENTION_WIDTH = 350;
let measureCanvas;
function mentionLeftFor(el, start) {
  const cs = getComputedStyle(el);
  const lineStart = el.value.lastIndexOf('\n', start - 1) + 1;
  measureCanvas ||= document.createElement('canvas');
  const ctx = measureCanvas.getContext('2d');
  ctx.font = cs.font;
  const x = ctx.measureText(el.value.slice(lineStart, start)).width + parseFloat(cs.paddingLeft || 0);
  const row = el.closest('[data-composer-row]');
  return Math.max(0, Math.min(x, (row?.clientWidth || el.clientWidth) - MENTION_WIDTH));
}
// Suggested (covering someone out who matches), the rest, and Not Available.
function groupMentions(mentions, query) {
  if (query == null || !mentions?.length) return { top: [], suggested: [], rest: [] };
  const q = query.toLowerCase();
  const matches = mentions.filter(m => nameMatches(m.name, q));
  if (!q) return { top: [], suggested: [], rest: matches.slice(0, MENTION_MAX) };
  // Searching: whoever matches and is out comes first (they can still be
  // mentioned), with whoever covers them right after, then the rest.
  const top = matches.filter(m => m.out).slice(0, MENTION_MAX);
  const covering = new Map(); // covering person's name → names of those they cover
  top.forEach(a => (a.coveredBy || []).forEach(n => covering.set(n, [...(covering.get(n) || []), a.name])));
  const suggested = mentions
    .filter(m => !m.out && covering.has(m.name))
    .map(m => ({ ...m, coveringFor: covering.get(m.name) }));
  const rest = matches.filter(m => !m.out && !covering.has(m.name)).slice(0, MENTION_MAX);
  return { top, suggested, rest };
}
const nameMatches = (name, q) => !q || String(name || '').toLowerCase().split(/\s+/).some(w => w.startsWith(q)) || String(name || '').toLowerCase().includes(q);

export function MessageComposer({
  value,
  onChange,
  onSend,
  internal = false,
  onInternalChange,
  internalOnly = false,
  tools = [],
  archiveOnSend = false,
  onArchiveOnSendChange,
  placeholder,
  disabled = false,
  sending = false,
  maxLength,
  above,
  toolbarStart,
  attachments = [],
  onRemoveAttachment,
  showSchedule = true,
  mentions,
}) {
  const ref = useRef(null);
  // An @mention being typed: where its "@" is and what follows it.
  const [mention, setMention] = useState(null); // { start, query }
  const [mentionIndex, setMentionIndex] = useState(0);
  const roster = useContext(MentionRoster);
  useEffect(() => { if (!mentions) roster.load?.(); }, [mentions, roster]);
  // Without its own list, the composer offers the app's people (staff).
  const mentionPeople = mentions || (roster.users || []).filter(u => u.name).map(u => ({
    id: u.id || u.name, name: u.name, initials: u.initials, kind: 'User', variant: 'staff', out: u.out, coveredBy: u.coveredBy,
  }));
  const { top: mentionTop, suggested: mentionSuggested, rest: mentionRest } = groupMentions(mentionPeople, mention?.query);
  // What the arrow keys move through: everyone who can be picked.
  const mentionList = [...mentionTop, ...mentionSuggested, ...mentionRest];
  const mentionOpen = !!mention && mentionList.length > 0;
  const mentionLeft = mention?.left || 0;
  // One row; someone out of office wears the Out of Office badge (and the
  // avatar's mark) but can still be mentioned.
  const mentionRow = (m, index) => (
    <div
      key={m.id}
      role="option"
      aria-selected={index === mentionIndex}
      className={index === mentionIndex ? `${styles.mention} ${styles.mentionActive}` : styles.mention}
      // Keep the text box focused while picking.
      onMouseDown={(e) => { e.preventDefault(); pickMention(m); }}
      onMouseEnter={() => setMentionIndex(index)}
    >
      <Avatar
        variant={m.variant === 'staff' ? 'staff' : 'patient'}
        size="M"
        initials={m.initials || initialsOf(m.name)}
        userName={m.variant === 'staff' ? m.name : undefined}
        userId={m.variant === 'staff' ? m.id : undefined}
      />
      <span className={styles.mentionText}>
        <span className={styles.mentionNameRow}>
          <span className={styles.mentionName}>{m.name}</span>
          {m.out && <Badge tone="magenta" size="sm" label="Out of Office" />}
        </span>
        <span className={styles.mentionKind}>{m.kind}</span>
        {m.coveringFor && <span className={styles.mentionKind}>Covering for {m.coveringFor.join(', ')}</span>}
      </span>
    </div>
  );
  const readMention = (el) => {
    if (!mentionPeople.length) return;
    const caret = el.selectionStart ?? el.value.length;
    const m = MENTION_RE.exec(el.value.slice(0, caret));
    if (!m) { setMention(null); return; }
    const start = caret - m[2].length - 1;
    setMention({ start, query: m[2], left: mentionLeftFor(el, start) });
    setMentionIndex(0);
  };
  const pickMention = (person) => {
    const el = ref.current;
    if (!el || !mention) return;
    const caret = el.selectionStart ?? value.length;
    const insert = `@${person.name} `;
    onChange(value.slice(0, mention.start) + insert + value.slice(caret));
    setMention(null);
    const at = mention.start + insert.length;
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(at, at); });
  };
  const isInternal = internal || internalOnly;
  const uploading = attachments.some(a => a.uploading);
  const canSend = !disabled && !sending && !uploading && (value.trim().length > 0 || attachments.length > 0);

  // Grows with the text up to MAX_BOX_HEIGHT, then scrolls.
  const grow = (el) => {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_BOX_HEIGHT)}px`;
  };
  // Also when the text is set from outside (a form link added, a draft
  // cleared after Send), not only while typing.
  useLayoutEffect(() => { if (ref.current) grow(ref.current); }, [value]);

  const send = () => {
    if (!canSend) return;
    onSend();
    requestAnimationFrame(() => { if (ref.current) { ref.current.style.height = 'auto'; ref.current.focus(); } });
  };

  return (
    <div className={[styles.root, isInternal ? styles.internal : ''].filter(Boolean).join(' ')}>
      {(onInternalChange || internalOnly || toolbarStart || tools.length > 0) && (
      <div className={styles.toolbar}>
        <div className={styles.toolbarStart}>
          {onInternalChange && !internalOnly && (
            <Switch checked={internal} onChange={onInternalChange} label="Internal" />
          )}
          {toolbarStart && (
            <>
              {onInternalChange && !internalOnly && <span className={styles.toolbarDivider} aria-hidden="true" />}
              {toolbarStart}
            </>
          )}
        </div>
        <div className={styles.tools}>
          {tools.map(t => (
            <ActionButton key={t.key} icon={t.icon} size="sm" tooltip={t.tooltip} onClick={t.onClick}>{t.iconNode}</ActionButton>
          ))}
        </div>
      </div>
      )}

      {above}

      <div className={styles.row} data-composer-row>
          {mentionOpen && (
            <div className={styles.mentions} style={{ left: mentionLeft }} role="listbox" aria-label="Mention someone">
              {/* Searching for someone out shows them first, then who covers
                  them (Suggested), then everyone else. */}
              {mentionTop.map((m, i) => mentionRow(m, i))}
              {mentionSuggested.length > 0 && <div className={styles.mentionGroup}>Suggested</div>}
              {mentionSuggested.map((m, i) => mentionRow(m, mentionTop.length + i))}
              {(mentionTop.length > 0 || mentionSuggested.length > 0) && mentionRest.length > 0 && <div className={styles.mentionGroup}>All</div>}
              {mentionRest.map((m, i) => mentionRow(m, mentionTop.length + mentionSuggested.length + i))}
            </div>
          )}
        <div className={styles.boxWrap}>
          {/* Links in the text show blue and underlined. */}
          <LinkHighlightTextarea
            ref={ref}
            className={styles.box}
            rows={1}
            value={value}
            maxLength={maxLength}
            disabled={disabled}
            placeholder={placeholder || (isInternal
              ? 'Internal messages are not visible to patient(s)'
              : 'Type message here')}
            onChange={(e) => { onChange(e.target.value); grow(e.target); readMention(e.target); }}
            onClick={(e) => readMention(e.currentTarget)}
            onBlur={() => setMention(null)}
            onKeyDown={(e) => {
              if (mentionOpen) {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  const step = e.key === 'ArrowDown' ? 1 : -1;
                  setMentionIndex(i => (i + step + mentionList.length) % mentionList.length);
                  return;
                }
                if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pickMention(mentionList[mentionIndex] || mentionList[0]); return; }
                if (e.key === 'Escape') { e.preventDefault(); setMention(null); return; }
              }
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
            }}
          />
          {attachments.length > 0 && (
            <div className={styles.attachments}>
              {attachments.map(a => (
                <PendingAttachment key={a.id} file={a} onRemove={onRemoveAttachment ? () => onRemoveAttachment(a.id) : undefined} />
              ))}
            </div>
          )}
        </div>
        <div className={styles.sendGroup}>
          <button type="button" className={styles.sendBtn} onClick={send} disabled={!canSend} aria-label="Send">
            <Icon name="solar:plain-2-linear" size={16} />
          </button>
          {showSchedule && (
            <>
              <span className={styles.sendDivider} />
              <button type="button" className={styles.sendBtn} disabled aria-label="Schedule send">
                <Icon name="solar:clock-circle-linear" size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className={styles.footer}>
        <span>
          Press Enter to send • <Link className={styles.changeLink}>Change</Link>
        </span>
        {onArchiveOnSendChange && (
          <label className={styles.archive}>
            <Checkbox checked={archiveOnSend} onCheckedChange={v => onArchiveOnSendChange(v === true)} />
            Archive on send
          </label>
        )}
      </div>
    </div>
  );
}

function fileMeta(file) {
  const ext = (file.name.split('.').pop() || '').slice(0, 4);
  const kb = file.size != null ? (file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`) : '';
  return [kb, ext].filter(Boolean).join(' • ');
}

// A file waiting to go out with the message: preview, name, size • type, and
// a menu to open or remove it.
function PendingAttachment({ file, onRemove }) {
  const menuRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const isImage = file.type?.startsWith('image/');
  const isVideo = file.type?.startsWith('video/');
  const items = [
    ...(file.previewUrl ? [{ key: 'open', icon: 'solar:eye-linear', label: 'Preview' }] : []),
    ...(onRemove ? [{ key: 'remove', icon: 'solar:trash-bin-minimalistic-linear', label: 'Remove', danger: true }] : []),
  ];
  return (
    <div className={styles.attachment}>
      <div className={styles.attachPreview}>
        {file.previewUrl && isImage && <img src={file.previewUrl} alt="" />}
        {file.previewUrl && isVideo && <video src={file.previewUrl} muted preload="metadata" />}
        {!(file.previewUrl && (isImage || isVideo)) && <Icon name="solar:document-text-linear" size={24} color="var(--neutral-200)" />}
        {isVideo && <span className={styles.attachPlay}><Icon name="solar:play-bold" size={12} color="var(--neutral-0)" /></span>}
        {file.uploading && <span className={styles.attachUploading}>Uploading…</span>}
      </div>
      <div className={styles.attachInfo}>
        <span className={styles.attachText}>
          <span className={styles.attachName}>{file.name}</span>
          <span className={styles.attachMeta}>{fileMeta(file)}</span>
        </span>
        {items.length > 0 && (
          <ActionButton ref={menuRef} icon="solar:menu-dots-bold" size="sm" tooltip="More" onClick={() => setMenuOpen(o => !o)} />
        )}
        {menuOpen && (
          <MenuPopover
            anchorRef={menuRef}
            width={160}
            items={items}
            onClose={() => setMenuOpen(false)}
            onSelect={(key) => {
              setMenuOpen(false);
              if (key === 'open') {
                const a = Object.assign(document.createElement('a'), { href: file.previewUrl, target: '_blank', rel: 'noopener noreferrer' });
                a.click();
              }
              if (key === 'remove') onRemove?.();
            }}
          />
        )}
      </div>
    </div>
  );
}
