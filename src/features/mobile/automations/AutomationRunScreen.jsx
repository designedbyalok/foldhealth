import { useEffect, useMemo, useState } from 'react';
import { Banner } from '../../../components/Banner/Banner';
import { Button } from '../../../components/Button/Button';
import { CheckboxTick } from '../../../components/CheckboxTick/CheckboxTick';
import { Input } from '../../../components/Input/Input';
import { useAppStore } from '../../../store/useAppStore';
import { plural } from '../../automations/list/listUtils';
import { MobileSubHeader } from '../MobileHeader';
import { MobileEmpty } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { PickerField } from '../patient/FormScreen';
import common from '../mobile.module.css';
import styles from './automations.module.css';

// Same modes, limit and lead-group rule as the desktop Run Automation drawer.
const MODES = [
  { key: 'member', label: 'Member', search: 'Search members by name, member ID or email' },
  { key: 'patientGroup', label: 'Patient Group', search: 'Search patient groups' },
  { key: 'leadGroup', label: 'Lead Group', search: 'Search lead groups' },
  { key: 'employer', label: 'Employer', search: 'Search employers' },
];
const MEMBER_LIMIT = 100;
const isLeadGroup = (g) => /lead/i.test([g.type, g.filterType, g.name].filter(Boolean).join(' '));

/** Run an automation now for chosen people (desktop RunAutomationDrawer, runAutomation). */
export function AutomationRunScreen({ id }) {
  const { pop } = useMobileNav();
  const automation = useAppStore(s => s.automations.find(a => a.id === id));
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

  useEffect(() => {
    let live = true;
    fetchAutomationMembers().finally(() => { if (live) setLoadingPool(false); });
    if (!popGroups.length) fetchPopGroups?.();
    return () => { live = false; };
  }, [fetchAutomationMembers, fetchPopGroups, popGroups.length]);

  const byId = useMemo(() => new Map(pool.map(p => [String(p.id), p])), [pool]);
  const pickedIds = useMemo(() => new Set(memberIds), [memberIds]);
  const q = query.trim().toLowerCase();
  const members = useMemo(() => (q
    ? pool.filter(p => [p.name, p.memberId, p.email].some(v => (v || '').toLowerCase().includes(q)))
    : pool), [pool, q]);
  const groups = useMemo(() => popGroups
    .filter(g => (mode === 'leadGroup' ? isLeadGroup(g) : !isLeadGroup(g)))
    .filter(g => !q || g.name.toLowerCase().includes(q))
    .map(g => ({ ...g, resolved: (g.memberIds || []).map(mid => byId.get(String(mid))).filter(Boolean) })),
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
      .sort((x, y) => x.name.localeCompare(y.name));
  }, [pool, q]);

  const target = useMemo(() => {
    if (mode === 'member') {
      const list = memberIds.map(mid => byId.get(mid)).filter(Boolean);
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

  const toggleMember = (mid) => setMemberIds(ids => (ids.includes(mid) ? ids.filter(x => x !== mid) : [...ids, mid]));
  const submit = async () => {
    if (!target || !automation) return;
    setSubmitting(true);
    let run;
    try {
      run = await runAutomation(automation.id, target);
    } finally {
      setSubmitting(false);
    }
    if (run) {
      // A run with failures already gets the store's failure toast.
      if (!run.failedCount) showToast('Automation executed successfully!');
      pop();
    }
  };
  const modeDef = MODES.find(m => m.key === mode);

  return (
    <div className={common.screen}>
      <MobileSubHeader title="Run automation">
        {automation && <p className={styles.by}>{automation.name}</p>}
      </MobileSubHeader>
      <div className={`${common.body} ${styles.runBody}`}>
        <div className={styles.runForm}>
          <PickerField label="Run automation for" value={mode} options={MODES.map(m => ({ value: m.key, label: m.label }))} onChange={(k) => { setMode(k); setQuery(''); }} />
          {sample && mode !== 'patientGroup' && mode !== 'leadGroup' && (
            <Banner>Sample members: no patient records are loaded in this account, so runs use sample members. Nothing is sent.</Banner>
          )}
          <Input type="search" size="lg" leadingIcon="solar:magnifer-linear" placeholder={modeDef.search} aria-label={modeDef.search} enterKeyHint="search" value={query} onChange={e => setQuery(e.target.value)} />

          {mode === 'member' && (loadingPool ? <p className={styles.note}>Loading members…</p> : (
            <>
              <div className={styles.listHead}>
                <span>{plural(members.length, 'member')}{q ? ' found' : ''}</span>
                {memberIds.length > 0 && <button type="button" className={styles.clear} onClick={() => setMemberIds([])}>{memberIds.length} selected · Clear</button>}
              </div>
              {members.length === 0 ? <MobileEmpty icon="solar:user-cross-linear" title={q ? `No members match “${query.trim()}”` : 'No members yet'} /> : (
                <ul className={styles.pickList}>
                  {members.slice(0, MEMBER_LIMIT).map(p => {
                    const pid = String(p.id);
                    const on = pickedIds.has(pid);
                    return (
                      <li key={pid}>
                        <Pick on={on} multi name={p.name} sub={[p.memberId, p.email].filter(Boolean).join(' • ')} onClick={() => toggleMember(pid)} />
                      </li>
                    );
                  })}
                  {members.length > MEMBER_LIMIT && <li className={styles.note}>Showing the first {MEMBER_LIMIT}. Search to find others.</li>}
                </ul>
              )}
            </>
          ))}

          {(mode === 'patientGroup' || mode === 'leadGroup') && (groups.length === 0 ? (
            <MobileEmpty icon="solar:users-group-rounded-linear" title={q ? `No groups match “${query.trim()}”` : mode === 'leadGroup' ? 'No lead groups yet' : 'No patient groups yet'} />
          ) : (
            <ul className={styles.pickList}>
              {groups.map(g => (
                <li key={g.id}>
                  <Pick
                    on={groupId === g.id}
                    disabled={!g.resolved.length}
                    name={g.name}
                    sub={g.resolved.length ? plural(g.resolved.length, 'member') : 'None of its members are in this account, so it can’t run'}
                    onClick={() => setGroupId(g.id)}
                  />
                </li>
              ))}
            </ul>
          ))}

          {mode === 'employer' && (employers.length === 0 ? (
            <MobileEmpty icon="solar:buildings-2-linear" title={q ? `No employers match “${query.trim()}”` : 'No employers on member records'} />
          ) : (
            <ul className={styles.pickList}>
              {employers.map(e => (
                <li key={e.name}>
                  <Pick on={employer === e.name} name={e.name} sub={plural(e.members.length, 'member')} onClick={() => setEmployer(e.name)} />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
      <div className={styles.footer}>
        <Button size="lg" disabled={!target || !automation} loading={submitting} onClick={submit}>
          {target ? `Run for ${target.label}` : 'Submit'}
        </Button>
      </div>
    </div>
  );
}

function Pick({ on, multi, name, sub, disabled, onClick }) {
  return (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={on}
      className={`${styles.pick} ${on ? styles.pickOn : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      <span className={styles.pickMark}>
        {multi ? <CheckboxTick checked={on} size={20} /> : <span className={`${styles.radio} ${on ? styles.radioOn : ''}`} aria-hidden="true" />}
      </span>
      <span className={styles.pickText}>
        <span className={styles.pickName}>{name}</span>
        {sub && <span className={styles.pickSub}>{sub}</span>}
      </span>
    </button>
  );
}
