import { useEffect, useState } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Badge } from '../../../components/Badge/Badge';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { SegmentedControl } from '../../../components/SegmentedControl/SegmentedControl';
import { SearchBar } from '../../../components/SearchBar/SearchBar';
import { useAppStore } from '../../../store/useAppStore';
import { formatTime } from '../messageUtils';
import { openStoredLink } from '../../../lib/openSafeUrl';
import { useReferralEmails } from './useReferralEmails';
import { useCommsConversations, useCommsMessagesFor } from '../comms/useComms';
import { PatientEmailThread } from '../comms/PatientEmailThread';
import { patientFor } from '../comms/commsUtils';
import { useCommsPeople } from '../comms/useCommsPeople';
import { CommsListEmpty, CommsPanelEmpty } from '../comms/CommsEmptyState';
import { CommsListHeader } from '../comms/CommsListHeader';
import { markConversationRead, updateConversation } from '../comms/commsRepo';
import { FilterChip } from '../../../components/FilterChip/FilterChip';
import { BulkBar } from '../../../components/BulkBar/BulkBar';
import { Checkbox } from '../../../components/Checkbox/Checkbox';
import commsStyles from '../comms/Comms.module.css';

const ACTIVITY_FILTER = { Today: 1, 'Last 7 days': 7, 'Last 30 days': 30 };
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
 * Comms > Email (Figma Communications 1:25080): mail list with Inbox / Draft
 * / Sent on the left, the selected thread on the right. Lists patient email
 * threads (sent through Resend) alongside Care Gap referral emails. Renders
 * both panes as siblings in MessagesView's row.
 *
 * `onCompose(initial)` opens Compose Email (reply, forward, a draft).
 */
export function EmailWorkspace({ onCompose, selectConversationId, onSelectedConversation, navCollapsed, onToggleNav }) {
  const fetchCaregapReferrals = useAppStore(s => s.fetchCaregapReferrals);
  const markRead = useAppStore(s => s.markCaregapReferralRead);
  const pendingId = useAppStore(s => s.pendingEmailReferralId);
  const setPendingId = useAppStore(s => s.setPendingEmailReferralId);
  const { inbox, sent, drafts, byId } = useReferralEmails();
  const { patients, me } = useCommsPeople();
  const { conversations } = useCommsConversations();
  const emailConvs = conversations.filter(c => c.channel === 'email' && !c.archived);
  const emailMsgs = useCommsMessagesFor(emailConvs.map(c => c.id));

  // Patient threads as list rows: Inbox has replies from the patient, Sent
  // has what we sent (or tried to), Draft has each unsent draft.
  const patientRows = (folder) => {
    if (folder === 'draft') {
      return emailMsgs.filter(m => m.status === 'draft').map(m => {
        const c = emailConvs.find(x => x.id === m.conversation_id);
        return { key: `d:${m.id}`, type: 'draft', draft: m, conv: c, who: c?.patient_name || m.to_addr, subject: m.subject, body: m.body, at: m.created_at, unread: false };
      });
    }
    return emailConvs.flatMap((c) => {
      const msgs = emailMsgs.filter(m => m.conversation_id === c.id && m.status !== 'draft' && m.kind === 'email');
      const pick = folder === 'inbox' ? msgs.filter(m => m.direction === 'in') : msgs.filter(m => m.direction === 'out');
      const last = pick.toSorted((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
      if (!last) return [];
      return [{
        key: `c:${c.id}`, type: 'patient', conv: c, who: c.patient_name, subject: last.subject || c.subject,
        body: last.body, at: last.created_at, unread: folder === 'inbox' && c.unread_count > 0, failed: folder === 'sent' && last.status === 'failed',
      }];
    });
  };
  const referralRows = (list) => list.map(r => ({
    key: `r:${r.id}`, type: 'referral', referral: r,
    who: null, subject: r.emailSubject, body: r.emailBody, at: r.createdAt,
  }));
  const FOLDERS = {
    inbox: [...patientRows('inbox'), ...referralRows(inbox)],
    draft: [...patientRows('draft'), ...referralRows(drafts)],
    sent: [...patientRows('sent'), ...referralRows(sent)],
  };
  const unread = FOLDERS.inbox.filter(r => (r.type === 'referral' ? !r.referral.recipientReadAt : r.unread)).length;
  const [folder, setFolder] = useState('inbox');
  const [selectedId, setSelectedId] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [activity, setActivity] = useState([]);
  // The cutoff is fixed when the filter is picked, not recomputed each render.
  const [activityCutoff, setActivityCutoff] = useState(0);
  // Bulk select works on patient threads; referral emails live with their care gap.
  const [bulk, setBulk] = useState(false);
  const [picked, setPicked] = useState([]);

  useEffect(() => { fetchCaregapReferrals({ force: true }); }, [fetchCaregapReferrals]);

  const open = (row) => {
    if (row.type === 'draft') {
      onCompose?.({
        conversation: row.conv, patient: patientFor(row.conv, patients), draft: row.draft,
        to: (row.draft.to_addr || '').split(/,\s*/).filter(Boolean),
        cc: (row.draft.cc || '').split(/,\s*/).filter(Boolean),
        bcc: (row.draft.bcc || '').split(/,\s*/).filter(Boolean),
        subject: row.draft.subject || '', bodyText: row.draft.body, useTemplate: row.draft.meta?.useTemplate !== false && !!row.draft.html,
      });
      return;
    }
    setSelectedId(row.key);
    if (row.type === 'referral' && inbox.some(r => r.id === row.referral.id) && !row.referral.recipientReadAt) markRead(row.referral.memberId, row.referral.id);
  };

  // A thread just sent from Compose: show it.
  const [handledConvId, setHandledConvId] = useState(null);
  if (selectConversationId && selectConversationId !== handledConvId) {
    setHandledConvId(selectConversationId);
    setFolder('sent');
    setSelectedId(`c:${selectConversationId}`);
    onSelectedConversation?.();
  }

  // A notification click lands here with the referral to show (once the
  // referrals have loaded); then the request is cleared and marked read.
  const [handledPendingId, setHandledPendingId] = useState(null);
  if (pendingId && pendingId !== handledPendingId && byId.has(pendingId)) {
    setHandledPendingId(pendingId);
    setSelectedId(`r:${pendingId}`);
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
  const list = (FOLDERS[folder] || [])
    .map(r => (r.type === 'referral' ? { ...r, who: folder === 'inbox' ? r.referral.sentBy : (r.referral.providerName || 'No recipient yet'), unread: folder === 'inbox' && !r.referral.recipientReadAt } : r))
    .filter(r => !q || `${r.subject} ${r.body} ${r.who} ${r.referral?.memberName || ''}`.toLowerCase().includes(q))
    .filter(r => !activityCutoff || new Date(r.at || 0).getTime() >= activityCutoff)
    .toSorted((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  const selectedRow = selectedId ? Object.values(FOLDERS).flat().find(r => r.key === selectedId) : null;
  const selectedReferral = selectedRow?.type === 'referral' ? byId.get(selectedRow.referral.id) : null;
  const selectedConv = selectedRow?.type === 'patient' ? emailConvs.find(c => c.id === selectedRow.conv.id) : null;

  return (
    <>
      <div className={listStyles.convPanel}>
        <CommsListHeader
          title="Emails"
          sub={unread > 0 ? `${unread} unread email${unread !== 1 ? 's' : ''}` : ''}
          navCollapsed={navCollapsed}
          onToggleNav={onToggleNav}
          searchActive={searchOpen}
          onSearch={() => { setSearchOpen(v => !v); setQuery(''); }}
          bulkActive={bulk}
          onBulk={() => { setBulk(v => !v); setPicked([]); }}
          filterActive={filterOpen || activity.length > 0}
          onFilter={() => setFilterOpen(v => !v)}
        />
        <div className={listStyles.convTabs}>
          <SegmentedControl
            items={[{ key: 'inbox', label: 'Inbox' }, { key: 'draft', label: 'Draft' }, { key: 'sent', label: 'Sent' }]}
            value={folder}
            onValueChange={setFolder}
            size="sm"
          />
        </div>
        {filterOpen && (
          <div className={commsStyles.filterRow}>
            <FilterChip label="Last Activity" singleSelect options={Object.keys(ACTIVITY_FILTER)} selected={activity} onChange={(v) => { setActivity(v); setActivityCutoff(v.length ? Date.now() - ACTIVITY_FILTER[v[0]] * 86400000 : 0); }} />
          </div>
        )}
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
            <CommsListEmpty viewKey="email" label={q ? 'No emails match your search' : undefined} />
          ) : list.map(r => (
            <button
              type="button"
              key={r.key}
              aria-current={selectedId === r.key ? 'true' : undefined}
              className={[listStyles.convItem, selectedId === r.key ? listStyles.selected : ''].join(' ')}
              onClick={() => {
                if (!bulk) { open(r); return; }
                if (r.type !== 'patient') return;
                setPicked(p => (p.includes(r.conv.id) ? p.filter(x => x !== r.conv.id) : [...p, r.conv.id]));
              }}
            >
              {bulk && (
                <span className={commsStyles.rowCheck}>
                  <Checkbox checked={r.type === 'patient' && picked.includes(r.conv.id)} disabled={r.type !== 'patient'} tabIndex={-1} aria-label={`Select ${r.who}`} />
                </span>
              )}
              <Avatar variant={r.type === 'referral' ? 'staff' : 'patient'} size={36} initials={initialsOf(r.who)} />
              <div className={listStyles.convInfo}>
                <div className={listStyles.convNameRow}>
                  <div className={[listStyles.convName, r.unread ? '' : listStyles.muted].join(' ')}>{r.who || 'Unknown'}</div>
                  {r.failed && <Icon name="solar:danger-triangle-linear" size={14} color="var(--status-error)" />}
                </div>
                <div className={listStyles.convNameRow}>
                  <div className={[styles.subject, r.unread ? styles.subjectUnread : ''].join(' ')}>{r.subject || '(no subject)'}</div>
                  <div className={listStyles.convTime}>{formatTime(r.at)}</div>
                </div>
                <div className={listStyles.convPreviewRow}>
                  <div className={listStyles.convPreview}>{preview(r.body)}</div>
                  {r.unread && <span className={styles.unreadDot} aria-label="Unread" />}
                </div>
              </div>
            </button>
          ))}
        </div>
        {bulk && (
          <BulkBar
            selectedIds={picked}
            onClear={() => setPicked([])}
            noun={picked.length === 1 ? 'Email Thread' : 'Email Threads'}
            actions={[
              { label: 'Mark as Read', icon: 'solar:check-read-linear', variant: 'outline', onClick: (ids) => { ids.forEach(id => markConversationRead(emailConvs.find(c => c.id === id))); setPicked([]); } },
              { label: 'Archive', icon: 'solar:archive-linear', variant: 'solid', onClick: (ids) => { ids.forEach(id => updateConversation(id, { archived: true })); setPicked([]); } },
            ]}
          />
        )}
      </div>

      {selectedConv ? (
        <PatientEmailThread conversation={selectedConv} patient={patientFor(selectedConv, patients)} me={me} onCompose={onCompose} />
      ) : selectedReferral ? <EmailThread email={selectedReferral} /> : (
        <CommsPanelEmpty
          viewKey="email"
          hasConversations={Object.values(FOLDERS).some(f => f.length > 0)}
          onCreate={() => onCompose?.({})}
        />
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
        {email.status === 'Draft' && <Badge tone="warning" size="sm" label="Draft" />}
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
                      <a className={styles.attachment} href={a.url} target="_blank" rel="noopener noreferrer" onClick={e => openStoredLink(e, a.url)}>
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
