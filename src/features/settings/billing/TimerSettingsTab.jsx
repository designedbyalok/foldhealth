import { useEffect, useState } from 'react';
import { WorklistShell } from '../../../components/WorklistShell/WorklistShell';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Badge } from '../../../components/Badge/Badge';
import { Icon } from '../../../components/Icon/Icon';
import { useAppStore } from '../../../store/useAppStore';
import { TimerSettingsDrawer } from './TimerSettingsDrawer';
import { TimerHistoryDrawer } from './TimerHistoryDrawer';
import { TIMER_ACCESS, TIMER_PROGRAMS } from './careProgramBillingData';
import styles from './CareProgramBilling.module.css';

const COLUMNS = [
  { key: 'program', label: 'Program', width: 220 },
  { key: 'access', label: 'Access', width: 240 },
  { key: 'extra', label: 'Additional Users & Roles', width: 240 },
  { key: 'modified', label: 'Last Modified', width: 150 },
  { key: 'action', label: 'Action', width: 104, sticky: 'right' },
];

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One row per program: who sees the billing timer on a patient's profile. */
export function TimerSettingsTab({ settings, loading }) {
  const [editing, setEditing] = useState(null);
  const [history, setHistory] = useState(null);
  const careTeams = useAppStore(s => s.hccCareTeams);
  const fetchHccCareTeams = useAppStore(s => s.fetchHccCareTeams);
  useEffect(() => { fetchHccCareTeams?.(); }, [fetchHccCareTeams]);
  // A program without a care program team (with members) can only be open to
  // all users, whatever was saved before the team went away.
  const hasTeam = (code) => (careTeams || []).some(t => t.kind === 'care-program' && t.teamType === code && (t.members || []).length > 0);

  const rows = TIMER_PROGRAMS.map(p => ({
    ...p,
    setting: settings.find(s => s.program === p.code) || { id: `timer-${p.code.toLowerCase()}`, program: p.code, access: 'team', userNames: [], roles: [] },
  }));
  const dash = <span className={styles.cellMuted}>-</span>;

  return (
    <div className={styles.tab}>
      <div className={`${styles.tableWrap} ${styles.stickyActions}`}>
        <WorklistShell
          header={null}
          columns={COLUMNS}
          rows={rows}
          loading={loading}
          minTableWidth={COLUMNS.reduce((n, c) => n + c.width, 0)}
          renderRow={(r) => {
            const s = r.setting;
            const access = hasTeam(r.code) ? s.access : 'all';
            const extra = access === 'team_plus' && (s.userNames.length > 0 || s.roles.length > 0);
            return (
              // The whole row opens the settings drawer (as the pen does).
              <tr
                key={r.code}
                className={`${styles.row} ${styles.rowClickable}`}
                tabIndex={0}
                aria-label={`Edit ${r.code} timer access`}
                onClick={() => setEditing(r)}
                onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setEditing(r); } }}
              >
                <td className={styles.td}>
                  <span className={styles.program}>
                    <span className={styles.programCode}>{r.code}</span>
                    <span className={styles.cellMuted}>{r.name}</span>
                  </span>
                </td>
                <td className={styles.td}><span className={styles.cellText}>{TIMER_ACCESS[access]}</span></td>
                <td className={styles.td}>
                  {extra ? (
                    <span className={styles.people}>
                      {s.userNames.length > 0 && <Badge size="sm" label={plural(s.userNames.length, 'user')} />}
                      {s.roles.length > 0 && <Badge tone="secondary" size="sm" label={plural(s.roles.length, 'role')} />}
                    </span>
                  ) : dash}
                </td>
                <td className={styles.td}>
                  {s.lastModifiedAt ? (
                    <>
                      <span className={`${styles.cellText} ${styles.num}`}>{s.lastModifiedAt}</span>
                      <span className={styles.cellMuted}>by {s.lastModifiedBy}</span>
                    </>
                  ) : dash}
                </td>
                <td className={`${styles.td} ${styles.stickyRight} ${styles.actionTd}`}>
                  {/* Its own clicks stay here, not on the row. */}
                  <span className={styles.actions} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    {/* As in the other settings tables: L buttons, a divider between,
                        and the pen drawn at 16px so it reads the same size as the clock. */}
                    <ActionButton tooltip="Edit timer access" tooltipLeft onClick={() => setEditing(r)}>
                      <Icon name="solar:pen-linear" size={16} color="var(--neutral-300)" />
                    </ActionButton>
                    <span className={styles.actionDivider} aria-hidden="true" />
                    <ActionButton icon="solar:history-linear" tooltip="History" tooltipLeft onClick={() => setHistory(r)} />
                  </span>
                </td>
              </tr>
            );
          }}
        />
      </div>

      {history && (
        <TimerHistoryDrawer
          program={history}
          // Read from the store so a save made since opening shows up.
          setting={settings.find(x => x.program === history.code) || history.setting}
          onClose={() => setHistory(null)}
        />
      )}

      {editing && (
        <TimerSettingsDrawer
          program={editing}
          // Read from the store so a change made while it's open (a team added) shows.
          setting={settings.find(x => x.program === editing.code) || editing.setting}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
