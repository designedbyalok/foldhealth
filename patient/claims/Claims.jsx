import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { SubTabs } from '@/components/SubTabs/SubTabs';
import { CardSkeleton } from '@/components/CardSkeleton/CardSkeleton';
import { CoverageOverview } from './CoverageOverview';
import { ClaimsLog } from './ClaimsLog';
import styles from './Claims.module.css';

const TABS = [{ key: 'overview', label: 'Claim Overview' }, { key: 'log', label: 'Claims Log' }];

// Claims tab on Home (frames 1114:6472, 1114:6886).
export function Claims({ memberId }) {
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      supabase.rpc('patient_coverage_for', { p_member_id: memberId }),
      supabase.rpc('patient_claims_for', { p_member_id: memberId }),
    ]).then(([coverage, claims]) => {
      if (!alive) return;
      setData({
        coverage: coverage.data || null,
        claims: claims.data || [],
        error: coverage.error || claims.error ? 'We could not load your claims.' : '',
      });
    });
    return () => { alive = false; };
  }, [memberId]);

  return (
    <div className={styles.wrap}>
      <SubTabs tabs={TABS} activeKey={tab} onChange={setTab} />
      {data?.error && <p className={styles.error} role="alert">{data.error}</p>}
      {!data && <CardSkeleton count={3} />}
      {data && tab === 'overview' && <CoverageOverview coverage={data.coverage} />}
      {data && tab === 'log' && <ClaimsLog claims={data.claims} />}
    </div>
  );
}
