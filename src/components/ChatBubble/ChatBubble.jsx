import { useRef, useState } from 'react';
import { Icon } from '../Icon/Icon';
import { AvatarBase } from '../Avatar/AvatarBase';
import { ActionButton } from '../ActionButton/ActionButton';
import { MenuPopover } from '../MenuPopover/MenuPopover';
import { useStorageUrl } from '../../lib/storageUrl';
import { openStoredLink } from '../../lib/openSafeUrl';
import styles from './ChatBubble.module.css';

const URL_RE = /(https?:\/\/[^\s]+)/;
const URL_SPLIT_RE = /(https?:\/\/[^\s]+)/g;

function formatBytes(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Fold Health ChatBubble (Fold-Pixel 1.0 "Chat Bubble Web", 1288:19893).
 *
 * - side 'left'   – from the other person: white bubble, their avatar beside it
 * - side 'right'  – from us: purple bubble, the sender's staff avatar on
 *   the outer side (mirrors 'left'; the internal card shows it too)
 * - side 'internal' – a staff-only note: dashed orange card with an
 *   "Internal" badge
 *
 * Inside the bubble, in order: an optional reply quote, attachment, link
 * card (a preview of the first URL in `text`) or call, then the text. Links
 * stay in the text where they were, underlined: white on our purple bubble,
 * info blue otherwise. Under it: the time
 * and, for our messages, a status (pass a <MessageStatus />).
 *
 * @param {'left'|'right'|'internal'} props.side
 * @param {string}  props.name           – sender name over the bubble
 * @param {string}  [props.initials]     – avatar initials; on 'right', omit to hide the avatar
 * @param {string}  [props.text]
 * @param {string}  [props.time]
 * @param {React.ReactNode} [props.status]
 * @param {{ name: string, text: string }} [props.reply]
 * @param {{ url: string, name: string, size?: number, type?: 'image'|'file' }} [props.attachment]
 * @param {{ label: string, duration?: string, direction?: 'in'|'out' }} [props.call]
 * @param {boolean} [props.compact]       – a follow-on from the same sender: no name row
 * @param {Array}   [props.menuItems]     – MenuPopover items for the ••• menu
 * @param {(key: string) => void} [props.onMenuSelect]
 * @param {React.ReactNode} [props.footer] – extra line under the time (e.g. an error)
 * @param {React.ReactNode} [props.children] – extra content at the end of the bubble (e.g. a card)
 * @param {boolean} [props.flush]          – no padding: `children` lay out the bubble's sections themselves
 * @param {'patient'|'provider'} [props.avatarVariant='patient'] – the sender's avatar colour (provider: an outside org)
 * @param {'staff'|'patient'} [props.selfAvatarVariant='staff'] – the avatar colour on 'right' (patient on the patient's own page)
 * @param {string} [props.avatarIcon] – Solar icon in place of initials on 'left' (e.g. an unknown sender)
 * @param {(bucket: string, path: string, expiresIn: number) => Promise<string>} [props.signUrl]
 *   – signs a private attachment URL; defaults to the signed-in session (see lib/storageUrl.js)
 */
export function ChatBubble({
  side = 'left',
  name,
  initials,
  text,
  time,
  status,
  reply,
  attachment,
  call,
  compact = false,
  menuItems,
  onMenuSelect,
  footer,
  children,
  flush = false,
  avatarVariant = 'patient',
  selfAvatarVariant = 'staff',
  avatarIcon,
  signUrl,
}) {
  const menuRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const internal = side === 'internal';
  const right = side === 'right';
  const attachmentUrl = useStorageUrl(attachment?.url, signUrl);

  const linkMatch = !attachment && !call && text ? text.match(URL_RE) : null;
  const link = linkMatch?.[1];

  const copyLink = () => {
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const menu = menuItems?.length ? (
    <>
      <ActionButton ref={menuRef} icon="solar:menu-dots-linear" size="sm" tooltip="More" className={styles.menuBtn} onClick={() => setMenuOpen(o => !o)} />
      {menuOpen && (
        <MenuPopover
          anchorRef={menuRef}
          items={menuItems}
          onSelect={(key) => { setMenuOpen(false); onMenuSelect?.(key); }}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </>
  ) : null;

  const inner = (
    <>
      {reply && (
        <div className={styles.quote}>
          <span className={styles.quoteName}>{reply.name}</span>
          <span className={styles.quoteText}>{reply.text}</span>
        </div>
      )}
      {attachment && (
        <a
          href={attachmentUrl || attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.attachment}
          onClick={e => openStoredLink(e, attachment.url, signUrl)}
        >
          {attachment.type === 'image' && (
            <span className={styles.attachImage}>
              {attachmentUrl && <img src={attachmentUrl} alt={attachment.name} />}
            </span>
          )}
          <span className={styles.attachRow}>
            <Icon name="solar:document-text-linear" size={20} color="var(--neutral-300)" />
            <span className={styles.attachText}>
              <span className={styles.attachName}>{attachment.name}</span>
              {attachment.size != null && <span className={styles.attachSize}>{formatBytes(attachment.size)}</span>}
            </span>
            <Icon name="solar:download-minimalistic-linear" size={16} color="var(--neutral-300)" />
          </span>
        </a>
      )}
      {link && (
        <span className={styles.link}>
          <Icon name="solar:link-minimalistic-linear" size={20} color="var(--neutral-300)" />
          <a href={link} target="_blank" rel="noopener noreferrer" className={styles.linkText}>{link}</a>
          <ActionButton icon={copied ? 'solar:check-circle-linear' : 'solar:copy-linear'} size="sm" tooltip={copied ? 'Copied' : 'Copy link'} onClick={copyLink} />
        </span>
      )}
      {call && (
        <span className={styles.call}>
          <Icon name={call.direction === 'in' ? 'solar:incoming-call-rounded-linear' : 'solar:outgoing-call-rounded-linear'} size={20} />
          <span className={styles.callLabel}>{call.label}</span>
          {call.duration && <span className={styles.callDuration}>{call.duration}</span>}
        </span>
      )}
      {/* The text keeps its links where they were (the card above is a preview). */}
      {text && (
        <span className={styles.text}>
          {text.split(URL_SPLIT_RE).map((part, i) => (i % 2
            ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className={styles.inlineLink}>{part}</a>
            : part))}
        </span>
      )}
      {children}
    </>
  );

  const timeRow = (time || status) && (
    <div className={styles.timeRow}>
      {time && <span className={styles.time}>{time}</span>}
      {status}
    </div>
  );

  if (internal) {
    return (
      <div className={[styles.wrap, styles.wrapInternal].join(' ')}>
        <div className={styles.internal}>
          <div className={styles.internalHead}>
            <span className={styles.internalBadge}>
              <Icon name="solar:users-group-rounded-linear" size={16} color="var(--secondary-300)" />
              Internal
            </span>
            <span className={styles.internalName}>{name}</span>
            <AvatarBase variant="staff" size="XS" initials={initials} />
            {menu}
          </div>
          {inner}
          {timeRow}
        </div>
        {footer}
      </div>
    );
  }

  return (
    <div className={[styles.wrap, right ? styles.wrapRight : '', call ? styles.wrapCall : ''].join(' ')}>
      {!right && (
        <span className={styles.avatarCol}>
          {!compact && (avatarIcon
            ? <AvatarBase variant={avatarVariant} size="XS" type="icon" iconName={avatarIcon} />
            : <AvatarBase variant={avatarVariant} size="XS" initials={initials} />)}
        </span>
      )}
      <div className={styles.col}>
        {!compact && (
          <div className={styles.nameRow}>
            <span className={styles.name}>{name}</span>
            {menu}
          </div>
        )}
        <div className={[styles.bubble, right ? styles.bubbleRight : styles.bubbleLeft, call ? styles.bubbleCall : '', flush ? styles.bubbleFlush : ''].join(' ')}>
          {inner}
        </div>
        {timeRow}
        {footer}
      </div>
      {right && initials && (
        <span className={styles.avatarCol}>
          {!compact && <AvatarBase variant={selfAvatarVariant} size="XS" initials={initials} />}
        </span>
      )}
    </div>
  );
}

/** "Missed Call from … 9:28 PM", across the thread between two dotted rules. */
export function MissedCallMarker({ from, time }) {
  return (
    <div className={styles.missed} role="note">
      <span className={styles.missedRule} />
      <span className={styles.missedBadge}>
        <Icon name="solar:end-call-rounded-linear" size={16} color="var(--status-error)" />
        Missed Call
      </span>
      {from && <span className={styles.missedFrom}>from {from}</span>}
      {time && <span className={styles.time}>{time}</span>}
      <span className={styles.missedRule} />
    </div>
  );
}
