import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { Input } from '../../../components/Input/Input';
import { RadioButton } from '../../../components/RadioButton/RadioButton';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { Checkbox } from '../../../components/Checkbox/Checkbox';
import { Banner } from '../../../components/Banner/Banner';
import { plural } from './listUtils';
import styles from './RunAutomationDrawer.module.css';

const MODES = [
  { key: 'member', label: 'Member', search: 'Search members by name, member ID or email' },
  { key: 'patientGroup', label: 'Patient Group', search: 'Search patient groups' },
  { key: 'leadGroup', label: 'Lead Group', search: 'Search lead groups' },
  { key: 'employer', label: 'Employer', search: 'Search employers' },
];
// Only the first matches render; search narrows the rest.
const MEMBER_LIMIT = 100;

const isLeadGroup = (g) => /lead/i.test([g.type, g.filterType, g.name].filter(Boolean).join(' '));

/**
 * Run an automation now for chosen people: members picked one by one, a
 * patient or lead population group, or everyone at an employer. Opened from
 * a list card/row, the quick view, and the builder.
 */
export function RunAutomationDrawer({ automation, onClose }) {
  const fetchAutomationMembers = useAppStore(s => s.fetchAutomationMembers);
  const pool = useAppStore(s => s.automationMembers);
  const sample = useAppStore(s => s.automationMembersSample);
  const popGroups = useAppStore(s => s.popGroups);
  const fetchPopGroups = useAppStore(s => s.fetchPopGroups);
  const runAutomation = useAppStore(s => s.runAutomation);
  const showToast = useAppStore(s => s.showToast);

  const [mode, setMode] = useState('member');
  const [query, setQuery] = useState('');
  const [memberIds, setMemberIds] = useState([]);
  const [groupId, setGroupId] = useState(null);
  const [employer, setEmployer] = useState(null);
  const [loadingPool, setLoadingPool] = useState(!pool.length);
  const [submitting, setSubmitting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let live = true;
    fetchAutomationMembers().finally(() => { if (live) setLoadingPool(false); });
    if (!popGroups.length) fetchPopGroups?.();
    return () => { live = false; };
  }, [fetchAutomationMembers, fetchPopGroups, popGroups.length]);

  const byId = useMemo(() => new Map(pool.map(p => [String(p.id), p])), [pool]);
  const q = query.trim().toLowerCase();

  const members = useMemo(() => (q
    ? pool.filter(p => [p.name, p.memberId, p.email].some(v => (v || '').toLowerCase().includes(q)))
    : pool), [pool, q]);

  const groups = useMemo(() => popGroups
    .filter(g => (mode === 'leadGroup' ? isLeadGroup(g) : !isLeadGroup(g)))
    .filter(g => !q || g.name.toLowerCase().includes(q))
    .map(g => ({ ...g, resolved: (g.memberIds || []).map(id => byId.get(String(id))).filter(Boolean) })),
  [popGroups, mode, q, byId]);

  const employers = useMemo(() => {
    const map = new Map();
    for (const p of pool) {
      if (!p.groupNumber) continue;
      if (!map.has(p.groupNumber)) map.set(p.groupNumber, []);
      map.get(p.groupNumber).push(p);
    }
    return [...map.entries()]
      .map(([name, list]) => ({ name, members: list }))
      .filter(e => !q || e.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [pool, q]);

  const target = useMemo(() => {
    if (mode === 'member') {
      const list = memberIds.map(id => byId.get(id)).filter(Boolean);
      if (!list.length) return null;
      return { type: 'member', label: list.length === 1 ? list[0].name : plural(list.length, 'member'), members: list };
    }
    if (mode === 'employer') {
      const e = employers.find(x => x.name === employer);
      return e ? { type: 'employer', label: e.name, members: e.members } : null;
    }
    const g = groups.find(x => x.id === groupId);
    return g?.resolved.length ? { type: mode, label: g.name, members: g.resolved } : null;
  }, [mode, memberIds, byId, employers, employer, groups, groupId]);

  const switchMode = (key) => { setMode(key); setQuery(''); };
  const toggleMember = (id) => setMemberIds(ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]));

  const submit = async () => {
    if (!target) return;
    setSubmitting(true);
    const run = await runAutomation(automation.id, target);
    setSubmitting(false);
    if (run) {
      // A run with failures already gets the store's failure toast.
      if (!run.failedCount) showToast('Automation executed successfully!');
      setDismissed(true);
    }
  };

  const modeDef = MODES.find(m => m.key === mode);

  return (
    <Drawer
      title={(
        <span className={styles.titleBlock}>
          <span>Run Automation</span>
          <span className={styles.subtitle}>{automation.name}</span>
        </span>
      )}
      width={516}
      onClose={onClose}
      dismissed={dismissed}
      noCloseDivider
      headerRight={(
        <>
          <Button disabled={!target} onClick={submit} loading={submitting}>
            Submit
          </Button>
          <span className={styles.headerDivider} aria-hidden />
        </>
      )}
    >
      <div className={styles.body}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Run automation for</span>
          <div className={styles.radios} role="radiogroup" aria-label="Run automation for">
            {MODES.map(m => (
              <RadioButton key={m.key} name="run-for" value={m.key} label={m.label} checked={mode === m.key} onChange={() => switchMode(m.key)} />
            ))}
          </div>
        </div>

        {sample && mode !== 'patientGroup' && mode !== 'leadGroup' && (
          <Banner>Sample members: no patient records are loaded in this account, so runs use sample members. Nothing is sent.</Banner>
        )}

        <Input type="search" leadingIcon="solar:magnifer-linear" placeholder={modeDef.search} value={query} onChange={e => setQuery(e.target.value)} />

        {mode === 'member' && (
          loadingPool ? <div className={styles.note}>Loading members…</div> : (
            <>
              <div className={styles.listHead}>
                <span>{plural(members.length, 'member')}{q ? ' found' : ''}</span>
                {memberIds.length > 0 && (
                  <button type="button" className={styles.clear} onClick={() => setMemberIds([])}>
                    {memberIds.length} selected · Clear
                  </button>
                )}
              </div>
              {members.length === 0 ? (
                <EmptyState size="sm" icon="solar:user-cross-linear" title={q ? `No members match “${query.trim()}”` : 'No members yet'} />
              ) : (
                <ul className={styles.list}>
                  {members.slice(0, MEMBER_LIMIT).map(p => {
                    const id = String(p.id);
                    return (
                      <li key={id}>
                        <label className={`${styles.row} ${memberIds.includes(id) ? styles.rowOn : ''}`}>
                          <Checkbox checked={memberIds.includes(id)} onCheckedChange={() => toggleMember(id)} aria-label={`Select ${p.name}`} />
                          <span className={styles.rowText}>
                            <span className={styles.rowName}>{p.name}</span>
                            <span className={styles.rowSub}>{[p.memberId, p.email].filter(Boolean).join(' • ')}</span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                  {members.length > MEMBER_LIMIT && (
                    <li className={styles.note}>Showing the first {MEMBER_LIMIT}. Search to find others.</li>
                  )}
                </ul>
              )}
            </>
          )
        )}

        {(mode === 'patientGroup' || mode === 'leadGroup') && (
          groups.length === 0 ? (
            <EmptyState
              size="sm"
              icon="solar:users-group-rounded-linear"
              title={q ? `No groups match “${query.trim()}”` : mode === 'leadGroup' ? 'No lead groups yet' : 'No patient groups yet'}
            />
          ) : (
            <ul className={styles.list}>
              {groups.map(g => {
                const missing = !g.resolved.length;
                const selected = groupId === g.id;
                return (
                  <li key={g.id}>
                    <div
                      className={`${styles.row} ${selected ? styles.rowOn : ''} ${missing ? styles.rowDisabled : ''}`}
                      onClick={() => { if (!missing) setGroupId(g.id); }}
                    >
                      <RadioButton checked={selected} disabled={missing} ariaLabel={g.name} onChange={() => setGroupId(g.id)} />
                      <span className={styles.groupIcon}><Icon name="solar:users-group-rounded-linear" size={18} /></span>
                      <span className={styles.rowText}>
                        <span className={styles.rowName}>{g.name}</span>
                        <span className={styles.rowSub}>
                          {missing
                            ? 'None of its members are in this account, so it can’t run'
                            : plural(g.resolved.length, 'member')}
                        </span>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        )}

        {mode === 'employer' && (
          employers.length === 0 ? (
            <EmptyState size="sm" icon="solar:buildings-2-linear" title={q ? `No employers match “${query.trim()}”` : 'No employers on member records'} />
          ) : (
            <ul className={styles.list}>
              {employers.map(e => (
                <li key={e.name}>
                  <div className={`${styles.row} ${employer === e.name ? styles.rowOn : ''}`} onClick={() => setEmployer(e.name)}>
                    <RadioButton checked={employer === e.name} ariaLabel={e.name} onChange={() => setEmployer(e.name)} />
                    <span className={styles.groupIcon}><Icon name="solar:buildings-2-linear" size={18} /></span>
                    <span className={styles.rowText}>
                      <span className={styles.rowName}>{e.name}</span>
                      <span className={styles.rowSub}>{plural(e.members.length, 'member')}</span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </Drawer>
  );
}
