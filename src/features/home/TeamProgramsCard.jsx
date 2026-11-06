import { useEffect, useMemo } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { Badge } from '../../components/Badge/Badge';
import { Skeleton } from '../../components/Skeleton/Skeleton';
import { useAppStore } from '../../store/useAppStore';
import { CARE_PROGRAM_CATALOG } from '../patient/data/careProgramCatalog';
import { HomeWidgetEmpty } from './HomeWidgetEmpty';
import { WORKLIST, sortProgramHealth } from './programHealth';
import styles from './HomeView.module.css';

const NAMES = Object.fromEntries(CARE_PROGRAM_CATALOG.map(p => [p.code, p.name]));
const SIGNALS = [
  ['carePlanGaps', 'care plan gap', 'care plan gaps'],
  ['overdueOutreach', 'overdue outreach', 'overdue outreach'],
  ['overdueTasks', 'overdue task', 'overdue tasks'],
  ['reviewGaps', 'review gap', 'review gaps'],
];

function ProgramRow({ p, onOpen }) {
  const attention = p.attentionMembers > 0;
  const signals = SIGNALS.filter(([k]) => p[k] > 0).map(([k, one, many]) => `${p[k]} ${p[k] === 1 ? one : many}`);
  const body = (
    <>
      <span className={styles.teamCode}>{p.code}</span>
      <span className={styles.teamMain}>
        <span className={styles.teamName}>{NAMES[p.code] || `${p.code} program`}</span>
        <span className={styles.teamMeta}>
          {p.activeMembers} {p.activeMembers === 1 ? 'member' : 'members'}
          {signals.length > 0 && <span aria-hidden="true"> • </span>}
          {signals.join(' • ')}
        </span>
      </span>
      <Badge
        size="sm"
        tone={attention ? 'warning' : 'success'}
        icon={attention ? 'solar:danger-triangle-linear' : 'solar:check-circle-linear'}
        label={attention ? `Needs attention · ${p.attentionMembers}` : 'On track'}
      />
      {onOpen && <Icon name="solar:alt-arrow-right-linear" size={14} color="var(--neutral-300)" />}
    </>
  );
  return onOpen
    ? <button type="button" className={styles.teamRow} onClick={onOpen}>{body}</button>
    : <div className={styles.teamRow}>{body}</div>;
}

/**
 * Supervisor view of the programs they supervise (admins: every program):
 * which need attention and why, from program_health. A program with a
 * worklist opens it.
 */
export function TeamProgramsCard({ dragHandleClassName, codes }) {
  const health = useAppStore(s => s.programHealth);
  const loading = useAppStore(s => s.programHealthLoading);
  const missing = useAppStore(s => s.programHealthMissing);
  const fetchProgramHealth = useAppStore(s => s.fetchProgramHealth);
  const setActivePage = useAppStore(s => s.setActivePage);
  const setActiveSubnavList = useAppStore(s => s.setActiveSubnavList);
  const navigateBackToWorklist = useAppStore(s => s.navigateBackToWorklist);

  useEffect(() => { fetchProgramHealth(codes); }, [codes, fetchProgramHealth]);

  const rows = useMemo(() => sortProgramHealth(health), [health]);
  const flagged = rows.filter(r => r.attentionMembers > 0).length;

  const openWorklist = (code) => {
    navigateBackToWorklist();
    setActivePage('population');
    setActiveSubnavList(WORKLIST[code]);
  };

  return (
    <div className={styles.card}>
      <div className={[styles.cardHeader, dragHandleClassName].filter(Boolean).join(' ')}>
        <div className={styles.cardTitle}>
          <Icon name="solar:users-group-rounded-linear" size={14} color="var(--primary-300)" />
          Team programs
          {health && rows.length > 0 && (
            <span className={styles.countChip}>{flagged ? `${flagged} need attention` : 'All on track'}</span>
          )}
        </div>
      </div>
      <div className={styles.cardBody}>
        {!health || loading ? (
          <div className={styles.teamList} aria-busy="true">
            {[0, 1, 2].map(i => (
              <div key={i} className={styles.teamRow}>
                <Skeleton style={{ width: 36, height: 20 }} />
                <span className={styles.teamMain}>
                  <Skeleton style={{ width: '55%', height: 12 }} />
                  <Skeleton style={{ width: '80%', height: 10 }} />
                </span>
                <Skeleton style={{ width: 96, height: 20 }} />
              </div>
            ))}
          </div>
        ) : missing ? (
          <HomeWidgetEmpty
            icon="solar:database-linear"
            title="Program health isn't set up yet"
            description="Run the program_health migration to see which programs need attention."
          />
        ) : rows.length === 0 ? (
          <HomeWidgetEmpty
            icon="solar:users-group-rounded-linear"
            title="No members in your programs yet"
            description="Programs you supervise show here once members are enrolled."
          />
        ) : (
          <div className={styles.teamList}>
            {rows.map(p => (
              <ProgramRow key={p.code} p={p} onOpen={WORKLIST[p.code] ? () => openWorklist(p.code) : null} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
