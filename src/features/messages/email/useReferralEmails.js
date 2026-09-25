import { useMemo } from 'react';
import { useAppStore } from '../../../store/useAppStore';

const EMPTY = {};
const sameName = (a, b) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Referral emails (caregap_referrals with channel 'email') split into the
 * signed-in user's Inbox (they were referred), Sent (they sent it) and
 * Draft (their unsent drafts).
 * People with duplicate profile rows are matched by name as well, the same
 * way the referral notification trigger fans out.
 */
export function useReferralEmails() {
  const byMember = useAppStore(s => s.caregapReferrals) || EMPTY;
  const me = useAppStore(s => s.currentUserProfile);

  return useMemo(() => {
    const all = Object.values(byMember).flat()
      .filter(r => r.channel === 'email')
      .toSorted((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const mine = (r) => (me?.id && r.sentById === me.id) || (!r.sentById && sameName(r.sentBy, me?.name));
    // Drafts haven't gone out: only their author sees them, under Draft.
    const isDraft = (r) => r.status === 'Draft';
    const inbox = all.filter(r => !isDraft(r) && ((me?.id && r.providerId === me.id) || sameName(r.providerName, me?.name)));
    const sent = all.filter(r => !isDraft(r) && mine(r));
    const drafts = all.filter(r => isDraft(r) && mine(r));
    return {
      inbox,
      sent,
      drafts,
      unread: inbox.filter(r => !r.recipientReadAt).length,
      byId: new Map(all.map(r => [r.id, r])),
    };
  }, [byMember, me]);
}
