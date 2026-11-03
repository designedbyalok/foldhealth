import { useEffect, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';

/**
 * Who a referral can go to and be sent from, shared by every Send Referral
 * form (Care Gap drawer, P360 Orders & Referrals).
 *
 * eFax senders are the practice eFax numbers (Settings > Messages > eFax)
 * that are active and linked to the signed-in user; email lines come from
 * referral_sender_lines.
 */
export function useReferralDirectory() {
  const directoryProviders = useAppStore(s => s.referralProviders);
  const practiceSenderLines = useAppStore(s => s.referralSenderLines);
  const efaxNumbers = useAppStore(s => s.efaxNumbers);
  const fetchEfaxNumbers = useAppStore(s => s.fetchEfaxNumbers);
  const fetchReferralDirectory = useAppStore(s => s.fetchReferralDirectory);
  const meId = useAppStore(s => s.currentUserProfile?.id);
  useEffect(() => { fetchEfaxNumbers(); fetchReferralDirectory(); }, [fetchEfaxNumbers, fetchReferralDirectory]);

  const senderLines = useMemo(() => [
    ...efaxNumbers
      .filter(n => n.isActive && meId && n.linkedUserIds.includes(meId))
      .map((n, i) => ({ id: n.id, channel: 'efax', label: n.name, value: n.number, isDefault: i === 0 })),
    ...practiceSenderLines.filter(l => l.channel !== 'efax'),
  ], [efaxNumbers, meId, practiceSenderLines]);

  // A user linked to an active practice eFax number can receive referrals on
  // it, so that number fills in when their profile has no fax of its own.
  const providers = useMemo(() => directoryProviders.map(p => {
    if (p.fax) return p;
    const linked = efaxNumbers.find(n => n.isActive && n.linkedUserIds.includes(p.id));
    return linked ? { ...p, fax: linked.number } : p;
  }), [directoryProviders, efaxNumbers]);

  // Email signature: the sender's own directory entry (profile).
  const meProvider = providers.find(p => p.id === meId);
  const emailSignature = meProvider && {
    name: meProvider.name,
    lines: [meProvider.specialty, meProvider.practice, meProvider.address],
    details: [
      { label: 'Phone', value: meProvider.phone },
      { label: 'Fax', value: meProvider.fax },
      { label: 'Email', value: meProvider.email },
    ],
  };

  const senderDefaults = () => {
    const defaultFor = (ch) => (senderLines.find(l => l.channel === ch && l.isDefault) || senderLines.find(l => l.channel === ch))?.id || '';
    return { efax: defaultFor('efax'), email: defaultFor('email') };
  };

  return { providers, senderLines, meProvider, emailSignature, senderDefaults };
}
