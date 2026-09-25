import { useEffect, useState } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Badge } from '../../../components/Badge/Badge';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Toggle } from '../../../components/Toggle/Toggle';
import { SearchBar } from '../../../components/SearchBar/SearchBar';
import { useAppStore } from '../../../store/useAppStore';
import { formatTime } from '../messageUtils';
import { useReferralEmails } from './useReferralEmails';
import listStyles from '../MessagesView.module.css';
import styles from './EmailWorkspace.module.css';

const initialsOf = (name) => String(name || '?').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const preview = (body) => String(body || '').replace(/\s+/g, ' ').trim();
const fullDate = (iso) => {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} • ${time}`;
};

/**
 * Messages > Email (Figma Communications 1:26811): mail list with Inbox /
 * Draft / Sent on the left, the selected email on the right. Backed by Care Gap
 * referral emails. Renders both panes as siblings in MessagesView's row.
 */
export function EmailWorkspace() {
  const fetchCaregapReferrals = useAppStore(s => s.fetchCaregapReferrals);
  const markRead = useAppStore(s => s.markCaregapReferralRead);
  const pendingId = useAppStore(s => s.pendingEmailReferralId);
  const setPendingId = useAppStore(s => s.setPendingEmailReferralId);
  const { inbox, sent, drafts, unread, byId } = useReferralEmails();
  const FOLDERS = { inbox, draft: drafts, sent };
  const [folder, setFolder] = useState('inbox');
  const [selectedId, setSelectedId] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => { fetchCaregapReferrals({ force: true }); }, [fetchCaregapReferrals]);

  const open = (email) => {
    setSelectedId(email.id);
    if (inbox.some(r => r.id === email.id) && !email.recipientReadAt) markRead(email.memberId, email.id);
  };

  // A notification click lands here with the referral to show (once the
  // referrals have loaded); then the request is cleared and marked read.
  const [handledPendingId, setHandledPendingId] = useState(null);
  if (pendingId && pendingId !== handledPendingId && byId.has(pendingId)) {
    setHandledPendingId(pendingId);
    setSelectedId(pendingId);
    setFolder(inbox.some(r => r.id === pendingId) ? 'inbox' : drafts.some(r => r.id === pendingId) ? 'draft' : 'sent');
  }
  useEffect(() => {
    if (!handledPendingId) return;
    const email = byId.get(handledPendingId);
    if (email && inbox.some(r => r.id === email.id) && !email.recipientReadAt) markRead(email.memberId, email.id);
    setPendingId(null);
    // Runs once per handled request; byId / inbox are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handledPendingId]);

  const q = query.trim().toLowerCase();
  const list = (FOLDERS[folder] || []).filter(r => !q
    || `${r.emailSubject} ${r.emailBody} ${r.providerName} ${r.sentBy} ${r.memberName}`.toLowerCase().includes(q));
  const selected = selectedId ? byId.get(selectedId) : null;

  return (
    <>
      <div className={listStyles.convPanel}>
        <div className={listStyles.convHeader}>
          <div className={listStyles.convHeaderLeft}>
            <div className={listStyles.convHeaderTitle}>Emails</div>
            {unread > 0 && <div className={listStyles.convHeaderSub}>{unread} unread email{unread !== 1 ? 's' : ''}</div>}
          </div>
          <div className={listStyles.convHeaderActions}>
            <ActionButton
              icon="solar:magnifer-linear"
              size="S"
              tooltip="Search"
              onClick={() => { setSearchOpen(v => !v); setQuery(''); }}
            />
          </div>
        </div>
        <div className={listStyles.convTabs}>
          <Toggle
            items={[{ key: 'inbox', label: 'Inbox' }, { key: 'draft', label: 'Draft' }, { key: 'sent', label: 'Sent' }]}
            active={folder}
            onChange={setFolder}
            size="S"
          />
        </div>
        {searchOpen && (
          <div className={styles.search}>
            <SearchBar
              placeholder="Search emails"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onClose={() => { setSearchOpen(false); setQuery(''); }}
            />
          </div>
        )}
        <div className={listStyles.convList}>
          {list.length === 0 ? (
            <div className={listStyles.emptyConv}>
              <div className={listStyles.emptyConvIcon}>
                <Icon name="solar:letter-linear" size={28} />
              </div>
              <div className={listStyles.emptyConvText}>
                {q ? 'No emails match your search' : folder === 'inbox' ? 'No emails in your inbox' : folder === 'draft' ? 'No drafts' : 'No sent emails yet'}
              </div>
            </div>
          ) : list.map(r => {
            const isUnread = folder === 'inbox' && !r.recipientReadAt;
            const who = folder === 'inbox' ? r.sentBy : (r.providerName || 'No recipient yet');
            return (
              <button
                type="button"
                key={r.id}
                aria-current={selectedId === r.id ? 'true' : undefined}
                className={[listStyles.convItem, selectedId === r.id ? listStyles.selected : ''].join(' ')}
                onClick={() => open(r)}
              >
                <Avatar variant="staff" size={36} initials={initialsOf(who)} />
                <div className={listStyles.convInfo}>
                  <div className={listStyles.convNameRow}>
                    <div className={[listStyles.convName, isUnread ? '' : listStyles.muted].join(' ')}>{who || 'Unknown'}</div>
                  </div>
                  <div className={listStyles.convNameRow}>
                    <div className={[styles.subject, isUnread ? styles.subjectUnread : ''].join(' ')}>{r.emailSubject || '(no subject)'}</div>
                    <div className={listStyles.convTime}>{formatTime(r.createdAt)}</div>
                  </div>
                  <div className={listStyles.convPreviewRow}>
                    <div className={listStyles.convPreview}>{preview(r.emailBody)}</div>
                    {isUnread && <span className={styles.unreadDot} aria-label="Unread" />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selected ? <EmailThread email={selected} /> : (
        <div className={listStyles.chatPanel}>
          <div className={listStyles.noConvPlaceholder}>
            <div className={listStyles.noConvIcon}><Icon name="solar:letter-linear" size={32} /></div>
            <div className={listStyles.noConvText}>Select an email to read it</div>
          </div>
        </div>
      )}
    </>
  );
}

function EmailThread({ email }) {
  const attachments = email.attachments || [];
  return (
    <div className={listStyles.chatPanel}>
      <div className={styles.subjectBar}>
        <span>Subject : {email.emailSubject || '(no subject)'}</span>
        {email.status === 'Draft' && <Badge tone="warning" size="S" label="Draft" />}
      </div>
      {email.status === 'Draft' && (
        <div className={styles.draftNotice}>
          <Icon name="solar:info-circle-linear" size={14} color="var(--status-warning)" />
          Not sent yet. Open {email.memberName ? `${email.memberName}'s` : 'the member\'s'} care gap to finish it and Sign &amp; Refer.
        </div>
      )}
      <div className={listStyles.chatHeader}>
        <Avatar variant="staff" size={40} initials={initialsOf(email.providerName)} />
        <div className={listStyles.chatHeaderInfo}>
          <div className={styles.headerName}>{email.providerName}</div>
          <div className={styles.headerMeta}>
            {['Referral', email.gapCode, email.providerContact].filter(Boolean).join(' • ')}
          </div>
        </div>
      </div>
      <div className={styles.thread}>
        <article className={styles.card}>
          <Avatar variant="staff" size={32} initials={initialsOf(email.sentBy)} />
          <div className={styles.cardBody}>
            <div className={styles.cardName}>{email.sentBy || 'Unknown sender'}</div>
            <div className={styles.cardMeta}>
              {fullDate(email.createdAt)}
              {email.senderValue && ` • From ${email.senderValue}`}
              {email.providerContact && ` • To ${email.providerName} (${email.providerContact})`}
            </div>
            {email.memberName && (
              <div className={styles.ccRow}>
                <span className={styles.ccLabel}>CC</span>
                <MemberTag name={email.memberName} />
              </div>
            )}
            <div className={styles.cardText}>{email.emailBody}</div>
            {attachments.length > 0 && (
              <ul className={styles.attachments} aria-label="Attachments">
                {attachments.map(a => (
                  <li key={a.documentId || a.storagePath || a.name}>
                    {a.url ? (
                      <a className={styles.attachment} href={a.url} target="_blank" rel="noopener noreferrer">
                        <Icon name="solar:paperclip-linear" size={14} color="var(--neutral-300)" />
                        {a.name}
                      </a>
                    ) : (
                      <span className={styles.attachment}>
                        <Icon name="solar:paperclip-linear" size={14} color="var(--neutral-300)" />
                        {a.name}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}

// The member the referral is about, tagged in CC (not a recipient).
function MemberTag({ name }) {
  return (
    <span className={styles.memberTag}>
      <Avatar variant="patient" size="XS" initials={initialsOf(name)} />
      {name}
      <span className={styles.memberTagRole}>Member</span>
    </span>
  );
}
