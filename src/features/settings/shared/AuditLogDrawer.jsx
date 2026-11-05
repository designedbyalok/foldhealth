import { useState, useMemo, useEffect } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { Badge } from '../../../components/Badge/Badge';
import { Drawer } from '../../../components/Drawer/Drawer';
import { TimelineEntry } from '../../../components/Timeline/Timeline';
import { groupByMonth } from '../../../components/Timeline/Timeline.utils';
import { useAppStore } from '../../../store/useAppStore';
import { StatTile } from '../../../components/StatTile/StatTile';
import { FilterChip } from '../../../components/FilterChip/FilterChip';
import { DateRangeFilter } from '../../../components/DateRangeFilter/DateRangeFilter';
import { inDatePreset } from '../../../components/DateRangeFilter/dateRangePresets';
import { Avatar } from '../../../components/Avatar/Avatar';
import { supabase } from '../../../lib/supabase';
import styles from './AuditLogDrawer.module.css';

const AUDIT_LOG_FILTERS = ['all', 'created', 'updated', 'enabled', 'disabled', 'deleted'];

// Account security entries (sign-in, lockout, unlock, password) read as Login
// Activity: their own icon and tone, a bold event title over the reason, the
// method in the header and "Device • Location" underneath.
const TONE = {
  error:   { iconBg: 'var(--status-error-light)',   iconBorder: 'color-mix(in srgb, var(--status-error) 25%, transparent)',   iconColor: 'var(--status-error)' },
  warning: { iconBg: 'var(--status-warning-light)', iconBorder: 'color-mix(in srgb, var(--status-warning) 30%, transparent)', iconColor: 'var(--status-warning-dark)' },
  success: { iconBg: 'var(--status-success-light)', iconBorder: 'color-mix(in srgb, var(--status-success) 25%, transparent)', iconColor: 'var(--status-success)' },
  info:    { iconBg: 'var(--status-info-light)',    iconBorder: 'color-mix(in srgb, var(--status-info) 25%, transparent)',    iconColor: 'var(--status-info)' },
};
const SECURITY_ENTRY = {
  'Signed in':              { icon: 'solar:login-3-linear', ...TONE.success },
  'Failed sign-in attempt': { icon: 'solar:shield-warning-linear', ...TONE.error, title: 'Sign-in failed' },
  'Account locked':         { icon: 'solar:lock-keyhole-minimalistic-linear', ...TONE.error },
  'Unlock requested':       { icon: 'solar:hand-stars-linear', ...TONE.warning },
  'Account unlocked':       { icon: 'solar:lock-keyhole-unlocked-linear', ...TONE.success },
  'Unlock link emailed':    { icon: 'solar:letter-linear', ...TONE.info },
  'Unlock link used':       { icon: 'solar:link-round-linear', ...TONE.success },
  'Password changed':       { icon: 'solar:key-linear', ...TONE.success },
  'Sign-up approved':       { icon: 'solar:user-check-rounded-linear', ...TONE.success },
};
// Rows written before the context migration have no method; these are
// what they always were.
const LEGACY_METHOD = {
  'Failed sign-in attempt': 'Password',
  'Account locked': 'Password',
  'Unlock requested': 'Sign-in screen',
  'Account unlocked': 'Admin console',
  'Unlock link emailed': 'Email',
  'Unlock link used': 'Email link',
  'Sign-up approved': 'Admin console',
};
// ...and longer, sentence-style reasons.
function shortReason(text = '') {
  const attempt = /attempt (\d+) of (\d+) \((\w+)\)/i.exec(text);
  if (attempt) return `Attempt ${attempt[1]} of ${attempt[2]} · ${attempt[3]}`;
  const locked = /locked by the system after (\d+) failed/i.exec(text);
  if (locked) return `${locked[1]} failed attempts · locked by the system`;
  const whileLocked = /while the account is locked \(attempt (\d+), (\w+)\)/i.exec(text);
  if (whileLocked) return `Wrong password while locked · attempt ${whileLocked[1]} · ${whileLocked[2]}`;
  const unlocked = /^Reason: (.+?)\. Identity checked/.exec(text);
  if (unlocked) return `${unlocked[1]} · identity checked · new password required`;
  return text;
}
function withSecurityIcon(entry) {
  const cfg = SECURITY_ENTRY[entry.action];
  if (!cfg) return entry;
  return {
    ...entry,
    ...cfg,
    title: cfg.title || entry.action,
    details: shortReason(entry.details),
    method: entry.method || LEGACY_METHOD[entry.action] || '',
    footnote: [entry.device, entry.location].filter(Boolean).join(' • '),
    category: null,
  };
}

// The name an entry goes by in the Activity Type filter: the event title for
// security entries ("Sign-in failed"), else the action ("Updated").
const activityType = (e) => SECURITY_ENTRY[e.action]?.title || (SECURITY_ENTRY[e.action] ? e.action
  : (e.action || '').charAt(0).toUpperCase() + (e.action || '').slice(1));
// Column names in an entry's text read as words: "full_name" → "Full Name".
const humanizeFields = (text = '') => text.replace(/\b[a-z]+(?:_[a-z]+)+\b/g,
  m => m.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
const initialsOf = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

const DAY_MS = 24 * 60 * 60 * 1000;
const when = (iso) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
};

/** The two Login Activity cards above a user profile's timeline. */
function LoginActivitySummary({ entries }) {
  const [since] = useState(() => Date.now() - 30 * DAY_MS);
  const lastSignIn = entries.find(e => e.action === 'Signed in');
  const recent = entries.filter(e => new Date(e.createdAt).getTime() >= since);
  const failures = recent.filter(e => e.action === 'Failed sign-in attempt');
  const lock = recent.find(e => e.action === 'Account locked');
  const failCaption = lock
    ? `Account locked ${when(lock.createdAt)}`
    : failures.length ? `Last on ${when(failures[0].createdAt)}` : 'None in the last 30 days';
  return (
    <div className={styles.stats}>
      <StatTile
        icon="solar:login-3-linear"
        tone={lastSignIn ? 'success' : 'neutral'}
        label="Last successful sign-in"
        value={lastSignIn ? when(lastSignIn.createdAt) : 'Not recorded yet'}
        caption={lastSignIn
          ? [lastSignIn.method, [lastSignIn.device, lastSignIn.location].filter(Boolean).join(' • ')].filter(Boolean).join(' · ')
          : 'Shows from the next sign-in'}
      />
      <StatTile
        icon="solar:shield-warning-linear"
        tone={failures.length ? 'error' : 'success'}
        label="Failed attempts · 30 days"
        value={failures.length}
        caption={failCaption}
      />
    </div>
  );
}
const AUDIT_LOG_FILTERS_EXTENDED = [...AUDIT_LOG_FILTERS, 'previewed'];

// TimelineEntry's `details` falls back from the explicit field to a
// composed string. Audit-log entries set `details` already; the inline
// computation that used to live here ("created Foo") is now a per-entry
// concern handled before the entries reach the timeline.

/* ── Main Drawer ── */
/**
 * AuditLogContent: reusable audit log timeline with filters.
 * Can be embedded inside any container (drawer tab, panel, etc.)
 */
export function AuditLogContent({ entityType, entityId }) {
  const fetchAuditLogs = useAppStore(s => s.fetchAuditLogs);
  const [types, setTypes] = useState([]);
  const [actors, setActors] = useState([]);
  const [datePreset, setDatePreset] = useState(null);
  const [dateRange, setDateRange] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserName, setCurrentUserName] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data?.user?.user_metadata || {};
      if (meta.first_name && meta.last_name) setCurrentUserName(`${meta.first_name} ${meta.last_name}`);
      else if (meta.full_name) setCurrentUserName(meta.full_name);
      else if (data?.user?.email) setCurrentUserName(data.user.email.split('@')[0]);
    });
  }, []);

  useEffect(() => {
    if (!entityType || !entityId) return;
    setLoading(true);
    fetchAuditLogs(entityType, entityId).then(logs => {
      setEntries(logs);
      setLoading(false);
    });
  }, [entityType, entityId, fetchAuditLogs]);

  const typeOptions = useMemo(() => [...new Set(entries.map(activityType).filter(Boolean))].sort(), [entries]);
  const actorOptions = useMemo(() => [...new Set(entries.map(e => e.user).filter(Boolean))].sort(), [entries]);
  const filtered = types.length > 0 || actors.length > 0 || !!datePreset;

  const filteredEntries = useMemo(() => {
    const inRange = inDatePreset(datePreset, dateRange);
    const typeSet = new Set(types);
    const actorSet = new Set(actors);
    return entries.filter(e => (!types.length || typeSet.has(activityType(e)))
      && (!actors.length || actorSet.has(e.user))
      && inRange(e.createdAt));
  }, [entries, types, actors, datePreset, dateRange]);

  const monthGroups = useMemo(() => groupByMonth(filteredEntries), [filteredEntries]);

  return (
    <div style={{ padding: '0 0 12px' }}>
      {entityType === 'UserProfile' && !loading && <LoginActivitySummary entries={entries} />}

      <div className={styles.filters}>
        <FilterChip label="Activity Type" searchable options={typeOptions} selected={types} onChange={setTypes} />
        <FilterChip
          label="Activity By"
          searchable
          options={actorOptions}
          selected={actors}
          onChange={setActors}
          renderOptionLeading={(name) => (name === 'System'
            ? <Avatar type="icon" variant="others" iconName="solar:settings-linear" size="S" />
            : <Avatar variant="staff" size="S" initials={initialsOf(name)} userName={name} />)}
        />
        <DateRangeFilter
          label="Date"
          preset={datePreset}
          range={dateRange}
          onChange={(preset, range) => { setDatePreset(preset); setDateRange(range); }}
        />
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--neutral-300)' }}>
          <div style={{ fontSize: 'var(--font-base)' }}>Loading audit log...</div>
        </div>
      )}

      {!loading && (
        <div>
          {monthGroups.map((group, gi) => (
            <div key={gi}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 2px', marginBottom: 4 }}>
                <span style={{ fontSize: 'var(--font-sm)', fontWeight: 500, color: 'var(--neutral-400)' }}>{group.label}</span>
                <Icon name="solar:alt-arrow-down-linear" size={13} color="var(--neutral-200)" />
              </div>
              {group.entries.map((entry, ei) => (
                <TimelineEntry
                  key={entry.id}
                  compact
                  collapseChanges
                  entry={withSecurityIcon({ ...entry, category: null, details: humanizeFields(entry.details || `${entry.action} ${entry.entityName}`) })}
                  isFirst={gi === 0 && ei === 0}
                  isLast={gi === monthGroups.length - 1 && ei === group.entries.length - 1}
                  currentUserName={currentUserName}
                />
              ))}
            </div>
          ))}
          {filteredEntries.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '32px 16px', color: 'var(--neutral-300)' }}>
              <Icon name="solar:history-linear" size={32} color="var(--neutral-150)" />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--font-base)', fontWeight: 500, color: 'var(--neutral-300)' }}>No entries found</div>
                <div style={{ fontSize: 'var(--font-md)', marginTop: 4 }}>
                  {filtered ? 'Try adjusting your filters.' : 'Activity will appear here as actions are taken.'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AuditLogDrawer({ entity, onClose }) {
  const fetchAuditLogs = useAppStore(s => s.fetchAuditLogs);
  const [filter, setFilter] = useState('all');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserName, setCurrentUserName] = useState('');

  // Get current user name for "(Current User)" label
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data?.user?.user_metadata || {};
      if (meta.first_name && meta.last_name) setCurrentUserName(`${meta.first_name} ${meta.last_name}`);
      else if (meta.full_name) setCurrentUserName(meta.full_name);
      else if (data?.user?.email) setCurrentUserName(data.user.email.split('@')[0]);
    });
  }, []);

  // Fetch real audit log data from Supabase
  useEffect(() => {
    if (!entity) return;
    setLoading(true);
    fetchAuditLogs(entity.type, entity.id).then(logs => {
      setEntries(logs);
      setLoading(false);
    });
  }, [entity, fetchAuditLogs]);

  const filteredEntries = useMemo(() => {
    if (filter === 'all') return entries;
    return entries.filter(e => e.action === filter);
  }, [entries, filter]);

  const monthGroups = useMemo(() => groupByMonth(filteredEntries), [filteredEntries]);

  const title = entity?.type === 'Domain'
    ? `Audit Log: ${entity.domain || entity.name}`
    : `Audit Log: ${entity?.name}`;

  return (
    <Drawer title={title} onClose={onClose}>
      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <Icon name="custom:filter" size={16} color="var(--neutral-300)" />
        {AUDIT_LOG_FILTERS_EXTENDED.map(f => {
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '4px 8px', borderRadius: 4, fontSize: 'var(--font-sm)',
                border: `0.5px solid ${active ? 'var(--primary-300)' : 'var(--neutral-150)'}`,
                background: active ? 'var(--primary-50)' : 'var(--neutral-0)',
                color: active ? 'var(--primary-300)' : 'var(--neutral-300)',
                cursor: 'pointer', fontFamily: "'Inter', sans-serif", fontWeight: active ? 500 : 400,
                textTransform: 'capitalize', whiteSpace: 'nowrap',
              }}
            >
              {f === 'all' ? 'All' : f}
            </button>
          );
        })}
        {filter !== 'all' && (
          <button onClick={() => setFilter('all')} style={{
            fontSize: 'var(--font-sm)', color: 'var(--primary-300)', background: 'none', border: 'none',
            cursor: 'pointer', fontFamily: "'Inter', sans-serif", padding: '4px 0',
          }}>
            Clear All
          </button>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--neutral-300)' }}>
          <div style={{ fontSize: 'var(--font-base)' }}>Loading audit log...</div>
        </div>
      )}

      {/* Timeline */}
      {!loading && (
        <div style={{ padding: '0 0 4px 0' }}>
          {monthGroups.map((group, gi) => (
            <div key={gi}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 2px', marginBottom: 4 }}>
                <span style={{ fontSize: 'var(--font-sm)', fontWeight: 500, color: 'var(--neutral-400)' }}>{group.label}</span>
                <Icon name="solar:alt-arrow-down-linear" size={13} color="var(--neutral-200)" />
              </div>
              {group.entries.map((entry, ei) => (
                <TimelineEntry
                  key={entry.id}
                  entry={{ ...entry, details: entry.details || `${entry.action} ${entry.entityName}` }}
                  isFirst={gi === 0 && ei === 0}
                  isLast={gi === monthGroups.length - 1 && ei === group.entries.length - 1}
                  currentUserName={currentUserName}
                />
              ))}
            </div>
          ))}

          {filteredEntries.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '32px 16px', color: 'var(--neutral-300)' }}>
              <Icon name="solar:history-linear" size={32} color="var(--neutral-150)" />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--font-base)', fontWeight: 500, color: 'var(--neutral-300)' }}>No entries found</div>
                <div style={{ fontSize: 'var(--font-md)', marginTop: 4 }}>
                  {filter !== 'all' ? 'Try adjusting your filter.' : 'Activity will appear here as actions are taken.'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
