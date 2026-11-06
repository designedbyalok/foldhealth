import { useEffect, useMemo } from 'react';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Icon } from '../../../components/Icon/Icon';
import { useAppStore } from '../../../store/useAppStore';
import { MobileRootHeader, MobileSubHeader } from '../MobileHeader';
import { MobileEmpty } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import styles from '../mobile.module.css';

// Same lists and default order as the desktop Population sidebar
// (components/SubNav). `count` reads the cheap badge counts.
const WORKLISTS = [
  { label: 'SNP', count: c => c?.snp },
  { label: 'Annual Visit', count: c => c?.awv },
  { label: 'TOC IP', count: c => c?.tocIp },
  { label: 'HCC', count: c => c?.hccUnique },
  { label: 'Pharmacy', count: c => c?.pharmacy },
  { label: 'HEDIS' },
  { label: 'CCM', count: c => c?.ccm },
  { label: 'JSA', count: c => c?.jsa },
  { label: 'CMP' },
  { label: 'TCM', count: c => c?.tcm },
];
const BY_LABEL = Object.fromEntries(WORKLISTS.map(w => [w.label, w]));

/** Every worklist, in the user's saved order, plus All Patients. */
export function WorklistsScreen() {
  const { push } = useMobileNav();
  const counts = useAppStore(s => s.worklistCounts);
  const order = useAppStore(s => s.worklistOrder);
  const fetchWorklistCounts = useAppStore(s => s.fetchWorklistCounts);
  const fetchWorklistOrder = useAppStore(s => s.fetchWorklistOrder);
  useEffect(() => {
    fetchWorklistCounts?.();
    fetchWorklistOrder?.(WORKLISTS.map(w => w.label));
  }, [fetchWorklistCounts, fetchWorklistOrder]);

  const ordered = useMemo(() => {
    const saved = (order || []).filter(l => BY_LABEL[l]);
    const savedSet = new Set(saved);
    return [...saved, ...WORKLISTS.map(w => w.label).filter(l => !savedSet.has(l))].map(l => BY_LABEL[l]);
  }, [order]);

  const row = (label, icon, count, onClick) => (
    <button key={label} type="button" className={styles.card} onClick={onClick}>
      <Avatar type="icon" variant="primary" iconName={icon} size="L" />
      <span className={styles.cardText}><span className={styles.primaryText}>{label}</span></span>
      <span className={styles.cardEndRow}>
        {count != null && <span className={styles.metaText}>{count}</span>}
        <Icon name="solar:alt-arrow-right-linear" size={20} />
      </span>
    </button>
  );

  return (
    <div className={styles.screen}>
      <MobileRootHeader title="Worklists" />
      <div className={styles.body}>
        <p className={styles.sectionLabel}>Patients</p>
        <div className={styles.list}>
          {row('All Patients', 'solar:users-group-rounded-linear', null, () => push('allPatients'))}
        </div>
        <p className={styles.sectionLabel}>Worklists</p>
        <div className={styles.list}>
          {ordered.map(w => row(w.label, 'solar:clipboard-list-linear', w.count?.(counts), () => push('worklist', { label: w.label })))}
        </div>
      </div>
    </div>
  );
}

/** One worklist. Cards for each list arrive in the next phase. */
export function WorklistComingScreen({ label }) {
  return (
    <div className={styles.screen}>
      <MobileSubHeader title={label} />
      <div className={styles.body}>
        <MobileEmpty
          icon="solar:clipboard-list-linear"
          title={`${label} is coming to mobile`}
          description="Work this list from Fold Health on a computer for now."
        />
      </div>
    </div>
  );
}
