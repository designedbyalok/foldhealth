import { useLayoutEffect, useRef, useState } from 'react';
import { MenuPopover } from '../MenuPopover/MenuPopover';
import { Switch } from '../Switch/Switch';
import { ActionButton } from '../ActionButton/ActionButton';
import { Icon } from '../Icon/Icon';
import { Checkbox } from '../Checkbox/Checkbox';
import { Link } from '../Link/Link';
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
 */
const MAX_BOX_HEIGHT = 150;

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
}) {
  const ref = useRef(null);
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

      <div className={styles.row}>
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
            onChange={(e) => { onChange(e.target.value); grow(e.target); }}
            onKeyDown={(e) => {
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
