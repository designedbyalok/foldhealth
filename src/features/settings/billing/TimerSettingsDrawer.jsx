import { useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Button } from '../../../components/Button/Button';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { RadioOptionGroup } from '../../../components/RadioOptionGroup/RadioOptionGroup';
import { Input } from '../../../components/Input/Input';
import { Toggle } from '../../../components/Toggle/Toggle';
import { CollapsibleContent } from '../../../components/Collapsible/Collapsible';
import { Checkbox } from '../../../components/Checkbox/Checkbox';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Badge } from '../../../components/Badge/Badge';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { Link } from '../../../components/Link/Link';
import { Icon } from '../../../components/Icon/Icon';
import { AddIconMinimalist } from '../../../components/Icon/AddIconMinimalist';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { ConfigureTeamDrawer } from '../member-leads/ConfigureTeamDrawer';
import { useAppStore } from '../../../store/useAppStore';
import { toast } from '../../../components/Toast/sonnerToast';
import { CARE_TEAM_ROLES, TIMER_ACCESS, initialsOf, timerChange } from './careProgramBillingData';
import styles from './CareProgramBilling.module.css';

const REMOVE_MS = 220;
const todayLabel = () => new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
const sameSet = (a, b) => { const bs = new Set(b); return a.length === b.length && a.every(x => bs.has(x)); };
const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Who a save takes the timer from, for the confirm step (null when nobody
 * loses it): leaving "All users", or dropping added users / roles (by
 * removing them or by switching to "Care Program Team only").
 */
function lostAccess(before, after) {
  if (before.access === 'all' && after.access !== 'all') return 'Users outside the care program team';
  if (before.access !== 'team_plus') return null;
  const gone = (a = [], b = []) => { const bs = new Set(b); return a.filter(x => !bs.has(x)); };
  const users = gone(before.userNames, after.userNames);
  const roles = gone(before.roles, after.roles);
  if (!users.length && !roles.length) return null;
  return [users.length && count(users.length, 'User'), roles.length && count(roles.length, 'Role')].filter(Boolean).join(' and ');
}

/**
 * Timer Access (Figma 2883:24403, "Billing Timer Settings"): who sees the billing timer for
 * one program. With "Care Program Team + Additional Roles/Users", the search
 * field opens a Users / Roles dropdown to add from, and the list
 * below holds what's been added (each removable).
 *
 * @param {object}   props.program – { code, name }
 * @param {object}   props.setting – { id, program, access, userNames, roles }
 * @param {function} props.onClose
 */
export function TimerSettingsDrawer({ program, setting, onClose }) {
  const save = useAppStore(s => s.saveBillingTimerSetting);
  const platformUsers = useAppStore(s => s.platformUsers);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  const me = useAppStore(s => s.currentUserProfile?.name) || 'You';
  const careTeams = useAppStore(s => s.hccCareTeams);
  useEffect(() => { fetchPlatformUsers?.(); }, [fetchPlatformUsers]);

  // The program's care program team(s). With none (or none with members),
  // only "All users with patient access" is possible.
  const programTeams = (careTeams || []).filter(t => t.kind === 'care-program' && t.teamType === program.code && (t.members || []).length > 0);
  const hasTeam = programTeams.length > 0;
  // The team's members who can log time (ticked in the team drawer), once each.
  const teamMembers = useMemo(() => {
    const seen = new Map();
    for (const m of programTeams.flatMap(t => t.members || [])) {
      if (m.canLogTime === false || seen.has(m.name)) continue;
      seen.set(m.name, { kind: 'team', key: `t:${m.name}`, name: m.name, initials: m.initials || initialsOf(m.name), role: m.roles || 'Staff' });
    }
    return [...seen.values()];
  }, [programTeams]);
  const [viewTeam, setViewTeam] = useState(null);
  const [addingTeam, setAddingTeam] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const [access, setAccess] = useState(hasTeam ? setting.access : 'all');
  // A team added from here switches access to "Care Program Team only" (the
  // store saves that); follow it in the open drawer.
  const [hadTeam, setHadTeam] = useState(hasTeam);
  if (hasTeam !== hadTeam) {
    setHadTeam(hasTeam);
    if (hasTeam) setAccess('team');
  }
  const [userNames, setUserNames] = useState(setting.userNames || []);
  const [roles, setRoles] = useState(setting.roles || []);
  const [query, setQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState('users');
  const [tab, setTab] = useState('all');
  const [removing, setRemoving] = useState([]);
  const removingSet = new Set(removing);
  // Keys picked in this session, oldest first, so the list can show the latest on top.
  const [recent, setRecent] = useState([]);
  const [closing, setClosing] = useState(false);
  const searchRef = useRef(null);

  // Click outside the search field and its dropdown closes the dropdown.
  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e) => { if (!searchRef.current?.contains(e.target)) setPickerOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setPickerOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [pickerOpen]);

  // Saved names stay listed even if they've left the roster.
  const users = useMemo(() => {
    const roster = (platformUsers || []).map(u => ({ name: u.name, initials: u.initials || initialsOf(u.name), role: u.clinicalRoles?.[0] || 'Staff' }));
    const missing = (setting.userNames || []).filter(n => !roster.some(u => u.name === n)).map(n => ({ name: n, initials: initialsOf(n), role: 'Staff' }));
    return [...roster, ...missing];
  }, [platformUsers, setting.userNames]);
  const userByName = useMemo(() => Object.fromEntries(users.map(u => [u.name, u])), [users]);

  const q = query.trim().toLowerCase();
  // Team members already have the timer, so they aren't offered as additions.
  const teamNames = new Set(teamMembers.map(m => m.name));
  const pickerOptions = pickerTab === 'users'
    ? users.filter(u => !teamNames.has(u.name) && (!q || u.name.toLowerCase().includes(q) || u.role.toLowerCase().includes(q))).map(u => ({ kind: 'user', key: `u:${u.name}`, ...u }))
    : CARE_TEAM_ROLES.filter(r => !q || r.toLowerCase().includes(q)).map(r => ({ kind: 'role', key: `r:${r}`, name: r }));

  // All = what's been added (latest picks first), then the team (read-only
  // here); each tab is one kind.
  const additional = [
    ...(tab === 'all' || tab === 'users' ? userNames.map(n => ({ kind: 'user', key: `u:${n}`, name: n, ...(userByName[n] || { initials: initialsOf(n), role: 'Staff' }) })) : []),
    ...(tab === 'all' || tab === 'roles' ? roles.map(r => ({ kind: 'role', key: `r:${r}`, name: r })) : []),
  ];
  const recency = (o) => recent.indexOf(o.key);
  const byRecent = additional
    .map((o, i) => ({ o, i }))
    .sort((a, b) => (recency(b.o) - recency(a.o)) || (a.i - b.i))
    .map(x => x.o);
  const added = [...byRecent, ...(tab === 'all' || tab === 'team' ? teamMembers : [])];
  const tabCount = (n) => <span className={styles.tabCount}>{n}</span>;

  const listFor = (kind) => (kind === 'user' ? [userNames, setUserNames] : [roles, setRoles]);
  const isOn = (o) => listFor(o.kind)[0].includes(o.name);
  const toggle = (o) => {
    const [list, setList] = listFor(o.kind);
    const adding = !list.includes(o.name);
    setList(adding ? [...list, o.name] : list.filter(x => x !== o.name));
    const key = `${o.kind === 'user' ? 'u' : 'r'}:${o.name}`;
    setRecent(r => [...r.filter(k => k !== key), ...(adding ? [key] : [])]);
  };
  // The row slides out to the right, then leaves the list.
  const remove = (o) => {
    setRemoving(r => [...r, o.key]);
    setTimeout(() => {
      const [, setList] = listFor(o.kind);
      setList(list => list.filter(x => x !== o.name));
      setRemoving(r => r.filter(k => k !== o.key));
    }, REMOVE_MS);
  };

  const plus = access === 'team_plus';
  const dirty = access !== setting.access || (plus && (!sameSet(userNames, setting.userNames || []) || !sameSet(roles, setting.roles || [])));
  const blocker = !dirty ? 'No changes to save' : plus && !userNames.length && !roles.length ? 'Select at least one user or role' : '';

  const next = { access, userNames: plus ? userNames : [], roles: plus ? roles : [] };
  // Taking the timer away from anyone asks first.
  const handleSave = () => {
    const lost = lostAccess(setting, next);
    if (lost) setConfirming(lost);
    else commit();
  };
  const commit = (result = next) => {
    setConfirming(null);
    const change = timerChange(setting, result, me);
    // Nothing actually changed (e.g. "Save without Removing" undid it all): just close.
    if (change) {
      toast.success('Timer access settings updated successfully');
      save({
        ...setting,
        ...result,
        lastModifiedAt: todayLabel(),
        lastModifiedBy: me,
        history: [change, ...(setting.history || [])],
      });
    }
    setClosing(true);
  };
  // "Save without Removing": keep everyone who had the timer, save the rest.
  const commitKeepingAccess = () => {
    const union = (a = [], b = []) => { const as = new Set(a); return [...a, ...b.filter(x => !as.has(x))]; };
    if (setting.access === 'all') return commit({ access: 'all', userNames: [], roles: [] });
    return commit({
      access: setting.access === 'team_plus' ? 'team_plus' : next.access,
      userNames: setting.access === 'team_plus' ? union(setting.userNames, plus ? userNames : []) : next.userNames,
      roles: setting.access === 'team_plus' ? union(setting.roles, plus ? roles : []) : next.roles,
    });
  };

  const noTeamReason = `${program.code} has no care program team yet. Add one to limit who sees the timer.`;
  // With no team, both team options offer to create one.
  const addTeamLink = (
    <Link style={{ fontSize: 'var(--font-sm)' }} onClick={(e) => { e.stopPropagation(); setAddingTeam(true); }}>
      <span className={styles.viewTeamLink}>
        <AddIconMinimalist size={14} color="currentColor" />
        Add Team
      </span>
    </Link>
  );
  // Every option reads as two lines: the choice, then what it means (for the
  // team, a link to see who that is, or to add one).
  const ACCESS_HINTS = {
    team: hasTeam
      ? (
        <Link style={{ fontSize: 'var(--font-sm)' }} onClick={(e) => { e.stopPropagation(); setViewTeam(programTeams[0]); }}>
          <span className={styles.viewTeamLink}>
            Edit Team
            <Icon name="solar:alt-arrow-right-linear" size={14} color="currentColor" />
          </span>
        </Link>
      )
      : addTeamLink,
    team_plus: hasTeam ? 'Care program team, plus the users and care team roles you add below.' : addTeamLink,
    all: 'Anyone who can open the patient\'s profile.',
  };
  const who = (o) => (
    <>
      {o.kind !== 'role'
        ? <Avatar variant="staff" size="M" initials={o.initials} userName={o.name} />
        : <Avatar type="icon" variant="others" iconName="solar:user-linear" size="M" />}
      <span className={styles.optionText}>
        <span className={styles.optionName}>{o.name}</span>
        {o.kind !== 'role' && <span className={styles.optionMeta}>{o.role}</span>}
      </span>
    </>
  );
  // The roles/users picker, under the option cards; eases open when
  // "+ Additional Roles/Users" is picked.
  const pickerContent = (
    <CollapsibleContent open={plus}>
      <div className={styles.picker}>
        <span className={styles.pickerHeading}>Add additional roles/users who can log billable time for this program</span>

        <div ref={searchRef} className={styles.search}>
          <Input
            type="search"
            aria-label="Search user and roles"
            placeholder="Search user and roles"
            leadingIcon="solar:magnifer-linear"
            value={query}
            onFocus={() => setPickerOpen(true)}
            onChange={(e) => { setQuery(e.target.value); setPickerOpen(true); }}
          />
          {pickerOpen && (
            <div className={styles.dropdown}>
              <Toggle
                size="sm"
                fullWidth
                value={pickerTab}
                onValueChange={setPickerTab}
                items={[{ key: 'users', label: 'Users' }, { key: 'roles', label: 'Roles' }]}
              />
              <div className={styles.dropdownList}>
                {pickerOptions.length === 0 && <span className={styles.listEmpty}>No {pickerTab === 'users' ? 'users' : 'roles'} match “{query}”</span>}
                {pickerOptions.map(o => (
                  <label key={o.key} className={styles.dropdownOption}>
                    <Checkbox checked={isOn(o)} onCheckedChange={() => toggle(o)} />
                    {o.kind === 'user'
                      ? <>
                        <Avatar variant="staff" size="M" initials={o.initials} userName={o.name} />
                        <span className={styles.optionText}>
                          <span className={styles.optionName}>{o.name}</span>
                          <span className={styles.optionMeta}>{o.role}</span>
                        </span>
                      </>
                      : <span className={styles.optionName}>{o.name}</span>}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <Toggle
          size="sm"
          className={styles.pickerToggle}
          value={tab}
          onValueChange={setTab}
          items={[
            { key: 'all', label: <>All{tabCount(teamMembers.length + userNames.length + roles.length)}</> },
            { key: 'team', label: <>Care Program Team{tabCount(teamMembers.length)}</> },
            { key: 'users', label: <>Additional Users{tabCount(userNames.length)}</> },
            { key: 'roles', label: <>Additional Roles{tabCount(roles.length)}</> },
          ]}
        />

        <div className={styles.list}>
          {/* Empty: the dashed ring card the PAMI drawers use. */}
          {added.length === 0 && (
            <div className={styles.emptyCard}>
              <EmptyState
                icon="solar:users-group-rounded-linear"
                iconSize={31}
                title={tab === 'roles' ? 'No Additional Roles Added' : tab === 'users' ? 'No Additional Users Added' : tab === 'team' ? 'No Care Program Team Members' : 'No Additional Roles or Users Added'}
              />
            </div>
          )}
          {added.map(o => (
            <div key={o.key} className={[styles.option, o.kind === 'team' ? styles.optionStatic : '', removingSet.has(o.key) ? styles.optionLeaving : ''].filter(Boolean).join(' ')}>
              {who(o)}
              {/* Team members come from the care program team; they're managed there.
                  The tag only tells them apart in the mixed All tab. */}
              {o.kind === 'team'
                ? tab === 'all' && <Badge size="xs" label="Care program team" className={styles.optionTag} />
                : (
                  <ActionButton
                    icon="solar:trash-bin-trash-linear"
                    size="sm"
                    tooltip="Remove"
                    className={styles.optionRemove}
                    onClick={() => remove(o)}
                  />
                )}
            </div>
          ))}
        </div>
      </div>
    </CollapsibleContent>
  );
  const accessOptions = Object.entries(TIMER_ACCESS).map(([value, label]) => ({
    value,
    label,
    hint: ACCESS_HINTS[value],
    ...(value !== 'all' && !hasTeam ? { disabled: true, disabledReason: noTeamReason } : {}),
  }));

  const saveButton = <Button disabled={!!blocker} onClick={handleSave}>Save</Button>;

  return (
    <Drawer
      title={(
        <span className={styles.drawerTitle}>
          Edit Timer Access Settings
          <span className={styles.drawerSubtitle}>For program: {program.code}</span>
        </span>
      )}
      // Two-line title: let the header grow, with 8px above and below (as the history drawer).
      headerStyle={{ height: 'auto', paddingTop: 'var(--space-2)', paddingBottom: 'var(--space-2)' }}
      dismissed={closing}
      onClose={onClose}
      closeOnOverlayClick={false}
      // Closing with unsaved edits asks first (as the availability drawer does).
      beforeClose={() => {
        if (!dirty || closing) return true;
        setConfirmClose(true);
        return false;
      }}
      primaryAction={blocker ? <Tooltip label={blocker} placement="bottom" align="right"><span>{saveButton}</span></Tooltip> : saveButton}
    >
      <div className={styles.drawerBody}>
        <p className={styles.hint}>
          Select who can log billable time for {program.code} Program. Only these users will see the billing timer on a patient&apos;s profile.
        </p>
        <RadioOptionGroup name="timer-access" variant="card" options={accessOptions} value={access} onChange={setAccess} />
        {/* One slot under the options: at most one of these is open, so the
            gap above stays 24px whichever it is (a closed CollapsibleContent still
            takes a flex gap). */}
        <div>
          {/* "Care Program Team only": who that is, read-only. */}
          <CollapsibleContent open={access === 'team' && hasTeam}>
            <div className={styles.picker}>
              <span className={styles.pickerHeading}>Care program team</span>
              <div className={styles.list}>
                {teamMembers.map(o => (
                  <div key={o.key} className={`${styles.option} ${styles.optionStatic} ${styles.optionFlush}`}>{who(o)}</div>
                ))}
              </div>
            </div>
          </CollapsibleContent>
          {pickerContent}
        </div>

      </div>

      {viewTeam && (
        <ConfigureTeamDrawer kind="care-program" editTeam={viewTeam} onClose={() => setViewTeam(null)} />
      )}
      {/* A new team for this program; once saved, the team options open up. */}
      {addingTeam && (
        <ConfigureTeamDrawer kind="care-program" defaultTeamType={program.code} onClose={() => setAddingTeam(false)} />
      )}
      {confirmClose && (
        <ConfirmDialog
          title="Discard changes?"
          description="Your changes to timer access won't be saved."
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          onCancel={() => setConfirmClose(false)}
          onConfirm={() => { setConfirmClose(false); setClosing(true); }}
        />
      )}
      {confirming && (
        <ConfirmDialog
          variant="warning"
          // Dialog Box 2: left-aligned, with a ✕ that just goes back to editing,
          // so both buttons can be real choices.
          align="start"
          icon={false}
          title="Remove access and save?"
          description={`Saving these changes removes ${confirming} from accessing ${program.code} billing timer. Any time already logged by them is unaffected.`}
          confirmLabel="Remove and Save"
          cancelLabel="Keep Access & Save"
          onClose={() => setConfirming(null)}
          onCancel={commitKeepingAccess}
          onConfirm={() => commit()}
        />
      )}
    </Drawer>
  );
}
