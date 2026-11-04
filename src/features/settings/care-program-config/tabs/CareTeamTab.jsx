import { useEffect, useMemo } from 'react';
import { Button } from '../../../../components/Button/Button';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { Select } from '../../../../components/Select/Select';
import { useAppStore } from '../../../../store/useAppStore';
import { CARE_TEAM_ROLES, newId } from '../careProgramConfigModel';
import { usePlatformUserOptions } from './usePlatformUserOptions';
import styles from '../CareProgramConfig.module.css';

const NONE = '__none';
const EMPTY = [];

/**
 * Care Team: who looks after this program's patients. Each role maps to a
 * care team from Member/Leads, a default assignee, and the steps it is
 * responsible for.
 */
export function CareTeamTab({ draft, patch }) {
  const teams = useAppStore(s => s.hccCareTeams) || EMPTY;
  const fetchTeams = useAppStore(s => s.fetchHccCareTeams);
  useEffect(() => { fetchTeams?.(); }, [fetchTeams]);
  const userOptions = usePlatformUserOptions();
  // Care program teams first, then the rest.
  const teamOptions = useMemo(() => [
    { value: NONE, label: 'No team' },
    ...[...teams].sort((a, b) => Number(b.kind === 'care-program') - Number(a.kind === 'care-program'))
      .map(t => ({ value: t.id, label: t.kind === 'care-program' ? t.name : `${t.name} (${String(t.kind || '').toUpperCase()})` })),
  ], [teams]);
  const stepOptions = useMemo(() => draft.steps.flatMap(s => (s.type === 'section'
    ? (s.children || []).map(c => ({ value: c.id, label: `${s.name}: ${c.name}` }))
    : [{ value: s.id, label: s.name }])), [draft.steps]);

  const rows = draft.careTeam;
  const update = (id, p) => patch({ careTeam: rows.map(r => (r.id === id ? { ...r, ...p } : r)) });
  const usedRoles = new Set(rows.map(r => r.role));

  return (
    <section className={`${styles.card} ${styles.cardFlush}`}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitleBlock}>
          <h3 className={styles.cardTitle}>Care Team Mapping</h3>
          <p className={styles.cardHint}>Map each role to a care team (Settings &gt; Member/Leads &gt; Care Team), a default assignee for new enrollments, and the steps that role owns.</p>
        </div>
        <Button
          variant="outline"
          leadingIcon="solar:add-circle-linear"
          disabled={usedRoles.size >= CARE_TEAM_ROLES.length}
          onClick={() => patch({ careTeam: [...rows, { id: newId('ct'), role: CARE_TEAM_ROLES.find(r => !usedRoles.has(r)), teamId: null, defaultAssigneeId: null, stepIds: [] }] })}
        >
          Add Role
        </Button>
      </div>
      <div className={`${styles.listRow} ${styles.careTeamRow} ${styles.listHead}`}>
        <span>Role</span><span>Care Team</span><span>Default Assignee</span><span>Responsible Steps</span><span />
      </div>
      {rows.length === 0 && <div className={styles.listRow}><span className={styles.cardHint}>No roles mapped yet.</span></div>}
      {rows.map(r => (
        <div key={r.id} className={`${styles.listRow} ${styles.careTeamRow}`}>
          <Select
            portal
            options={CARE_TEAM_ROLES.map(role => ({ value: role, label: role, disabled: role !== r.role && usedRoles.has(role) }))}
            value={r.role}
            onValueChange={role => update(r.id, { role })}
          />
          <Select portal options={teamOptions} value={r.teamId || NONE} onValueChange={v => update(r.id, { teamId: v === NONE ? null : v })} />
          <Select
            portal
            searchable
            placeholder="No default"
            options={[{ value: NONE, label: 'No default' }, ...userOptions]}
            value={r.defaultAssigneeId || NONE}
            onValueChange={v => update(r.id, { defaultAssigneeId: v === NONE ? null : v })}
          />
          <Select
            portal
            multiple
            checkboxes
            placeholder="No steps"
            options={stepOptions}
            value={r.stepIds}
            onValueChange={stepIds => update(r.id, { stepIds })}
          />
          <ActionButton icon="solar:trash-bin-trash-linear" size="sm" tooltip="Remove role" onClick={() => patch({ careTeam: rows.filter(x => x.id !== r.id) })} />
        </div>
      ))}
    </section>
  );
}
