import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { TabStrip } from '@/components/TabStrip/TabStrip';
import { Icon } from '@/components/Icon/Icon';
import { Badge } from '@/components/Badge/Badge';
import { Button } from '@/components/Button/Button';
import { Drawer } from '@/components/Drawer/Drawer';
import { CardSkeleton } from '@/components/CardSkeleton/CardSkeleton';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { hashParam } from '../lib/useHashRoute';
import styles from './Settings.module.css';

const TABS = [
  { key: 'enrolled', label: 'Enrolled' },
  { key: 'available', label: 'Available' },
  { key: 'optout', label: 'Opt-out' },
];
const inTab = (tab, p) => (tab === 'enrolled' ? ['requested', 'enrolled'].includes(p.status)
  : tab === 'optout' ? p.status === 'opted_out' : !p.status || p.status === 'opted_out');
const EMPTY = {
  enrolled: 'You are not in any packages yet. See what is available.',
  available: 'You are in every package we offer.',
  optout: 'You have not left any packages.',
};

function PackageDrawer({ pkg, busy, onRequest, onClose }) {
  const inIt = ['requested', 'enrolled'].includes(pkg.status);
  return (
    <Drawer
      title={pkg.title}
      onClose={onClose}
      width={560}
      primaryAction={inIt
        ? <Button variant="secondary" size="L" disabled={busy} onClick={() => onRequest(pkg, false)}>Opt out</Button>
        : <Button variant="primary" size="L" disabled={busy} onClick={() => onRequest(pkg, true)}>Ask to join</Button>}
    >
      <div className={styles.stack}>
        <span className={styles.packageIconLarge}><Icon name={pkg.icon} size={40} color="currentColor" /></span>
        {pkg.status === 'requested' && <Badge size="S" tone="warning" label="Request sent to your care team" />}
        {pkg.status === 'enrolled' && <Badge size="S" tone="success" label="Enrolled" />}
        <p className={styles.body}>{pkg.summary}</p>
        {pkg.details && <p className={styles.body}>{pkg.details}</p>}
        <p className={styles.note}>
          {inIt
            ? 'Opting out lets your care team know. You can ask to join again at any time.'
            : 'Your care team gets your request in Messages and will help you get started.'}
        </p>
      </div>
    </Drawer>
  );
}

// My Packages (frame 701:5439). Joining or leaving sends the care team a message.
export function MyPackages({ memberId }) {
  const [tab, setTab] = useState(() => (TABS.some((t) => t.key === hashParam('tab')) ? hashParam('tab') : 'enrolled'));
  const [packages, setPackages] = useState(null);
  const [version, setVersion] = useState(0);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.rpc('patient_packages_for', { p_member_id: memberId }).then(({ data }) => {
      if (alive) setPackages(data || []);
    });
    return () => { alive = false; };
  }, [memberId, version]);

  const request = async (pkg, join) => {
    setBusy(true);
    try {
      const { error } = await supabase.rpc('patient_request_package', { p_member_id: memberId, p_package_id: pkg.id, p_join: join });
      if (error) { toast.error(error.message || 'Your request was not sent. Try again.'); return; }
      toast.success(join ? 'Request sent to your care team' : 'Your care team knows you opted out');
      setOpen(null);
      setVersion((v) => v + 1);
    } finally {
      setBusy(false);
    }
  };

  const shown = (packages || []).filter((p) => inTab(tab, p));
  return (
    <div className={styles.stack}>
      <TabStrip items={TABS} activeKey={tab} onChange={setTab} fullWidth={false} />
      {!packages && <CardSkeleton count={3} />}
      {packages && shown.length === 0 && (
        <div className={styles.card}><EmptyState icon="solar:box-linear" title="Nothing here" description={EMPTY[tab]} /></div>
      )}
      {shown.length > 0 && (
        <ul className={styles.packages}>
          {shown.map((p) => (
            <li key={p.id} className={styles.package}>
              <span className={styles.packageIcon}><Icon name={p.icon} size={40} color="currentColor" /></span>
              <div className={styles.packageBody}>
                <span className={styles.packageTitle}>{p.title}</span>
                {p.status === 'requested' && <Badge size="S" tone="warning" label="Requested" />}
                <span className={styles.packageSummary}>{p.summary}</span>
                <button type="button" className={styles.link} onClick={() => setOpen(p)}>View Details</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {open && <PackageDrawer pkg={open} busy={busy} onRequest={request} onClose={() => setOpen(null)} />}
    </div>
  );
}
