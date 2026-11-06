import { useEffect, useMemo, useState } from 'react';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Badge } from '../../../components/Badge/Badge';
import { Input } from '../../../components/Input/Input';
import { SegmentedControl } from '../../../components/SegmentedControl/SegmentedControl';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { findOrCreateConversation } from '../../messages/comms/commsRepo';
import { MobileSubHeader } from '../MobileHeader';
import { MobileEmpty, MobileListSkeleton } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { initialsOf, patientLine } from '../mobileFormat';
import styles from '../mobile.module.css';

const PAGE = 50;
const sameName = (a, b) => !!a && !!b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

/** The practice's members, searchable (Figma 759:19398 / 759:19522). */
function MembersList({ onPick, showScope = true, autoFocus = false }) {
  const patients = useAppStore(s => s.allPatients);
  const loading = useAppStore(s => s.allPatientsLoading);
  const didFetch = useAppStore(s => s.allPatientsDidFetch);
  const fetchAllPatients = useAppStore(s => s.fetchAllPatients);
  const me = useAppStore(s => s.currentUserProfile);
  const [scope, setScope] = useState('all');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => { fetchAllPatients(); }, [fetchAllPatients]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (patients || []).filter(p => (
      (scope === 'all' || sameName(p.assignee, me?.name) || sameName(p.pcp, me?.name))
      && (!q || [p.name, p.memberId, p.phone, p.email].some(v => String(v || '').toLowerCase().includes(q)))
    ));
  }, [patients, scope, query, me]);

  return (
    <>
      <div className={styles.search}>
        <Input
          leadingIcon="solar:magnifer-linear"
          size="lg"
          type="search"
          placeholder="Search members"
          enterKeyHint="search"
          autoFocus={autoFocus}
          aria-label="Search members"
          value={query}
          onValueChange={(v) => { setQuery(v); setLimit(PAGE); }}
        />
      </div>
      {showScope && (
        <div className={styles.toolbar}>
          <SegmentedControl
            size="lg"
            aria-label="Which members"
            value={scope}
            onValueChange={(v) => { setScope(v); setLimit(PAGE); }}
            items={[{ key: 'all', label: 'Patients' }, { key: 'mine', label: 'My Patients' }]}
          />
        </div>
      )}
      <div className={styles.body}>
        {(loading || !didFetch) && !patients?.length ? <MobileListSkeleton height={88} /> : shown.length === 0 ? (
          <MobileEmpty icon="solar:users-group-rounded-linear" title={query ? 'No members match' : 'No members yet'} />
        ) : (
          <div className={styles.list}>
            {shown.slice(0, limit).map(p => (
              <button key={p.id} type="button" className={`${styles.card} ${styles.cardTop}`} onClick={() => onPick(p)}>
                <Avatar variant="patient" size="XL" initials={p.initials || initialsOf(p.name)} />
                <span className={styles.cardText}>
                  <span className={styles.primaryText}>{p.name}</span>
                  <span className={styles.secondaryText}>{['Patient', patientLine(p)].filter(Boolean).join(' • ')}</span>
                  {p.tags?.length > 0 && (
                    <span className={styles.tagRow}>
                      {p.tags.slice(0, 3).map(t => <Badge key={t} tone="neutral" variant="soft" size="sm" label={t} />)}
                      {p.tags.length > 3 && <Badge tone="neutral" variant="soft" size="sm" label={`+${p.tags.length - 3}`} />}
                    </span>
                  )}
                </span>
              </button>
            ))}
            {shown.length > limit && (
              <button type="button" className={styles.more} onClick={() => setLimit(l => l + PAGE)}>
                Show more ({shown.length - limit})
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/** Every patient, searchable (Figma 759:19398). Opened from Worklists and Home search. */
export function MembersScreen({ autoFocus = false }) {
  const { openMember } = useMobileNav();
  return (
    <div className={styles.screen}>
      <MobileSubHeader title="All Patients" />
      <MembersList onPick={(p) => openMember({ id: p.id })} autoFocus={autoFocus} />
    </div>
  );
}

/** Pick who to message, then open their chat (or SMS when they don't have the app). */
export function PickMemberScreen() {
  const { push } = useMobileNav();
  const open = async (p) => {
    const channel = p.patientAppActive ? 'chat' : 'sms';
    if (channel === 'sms' && !p.phone) {
      toast.error(`${p.name} has no phone number or app to message.`);
      return;
    }
    try {
      const conversation = await findOrCreateConversation(channel, p, channel === 'chat' ? { group_name: `Care for ${p.name}` } : {});
      push('thread', { conversation });
    } catch {
      toast.error('Could not open the conversation.');
    }
  };
  return (
    <div className={styles.screen}>
      <MobileSubHeader title="New Message" />
      <MembersList onPick={open} showScope={false} />
    </div>
  );
}
