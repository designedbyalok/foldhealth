import { useState, useEffect } from 'react';
import { TopBar } from '../../components/TopBar/TopBar';
import { Icon } from '../../components/Icon/Icon';
import { MissedCallIcon } from '../../components/Icon/MissedCallIcon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Avatar } from '../../components/Avatar/Avatar';
import { DeclinedCallIcon } from '../../components/Icon/DeclinedCallIcon';
import { Button } from '../../components/Button/Button';
import { SideNav } from '../../components/SideNav/SideNav';
import { Input } from '../../components/Input/Input';
import { Toggle } from '../../components/Toggle/Toggle';
import { DetailDrawer } from '../../components/DetailDrawer/DetailDrawer';
import { AgentsIcon } from '../agent-builder/nodes/NodeIcons';
import { Select } from '../../components/Select/Select';
import { useAppStore } from '../../store/useAppStore';
import { CallTypeAvatar, DIR_LABEL } from '../../components/CallTypeAvatar/CallTypeAvatar';
import styles from './CallsView.module.css';

// ── Helpers ──
function getInitials(name) {
  if (!name) return '?';
  return name
    .replace(/^Dr\.\s*/i, '')
    .split(' ')
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase();
}

function computeGoalStatus(goalsDetail) {
  if (!Array.isArray(goalsDetail) || goalsDetail.length === 0) return null;
  const passed = goalsDetail.filter(g => g.pass).length;
  return { passed, total: goalsDetail.length, allMet: passed === goalsDetail.length };
}

function computeOOH(startedAt) {
  if (!startedAt) return '-';
  const d = new Date(startedAt);
  if (isNaN(d.getTime())) return '-';
  const h = d.getHours();
  return (h < 9 || h >= 17) ? 'Yes' : 'No';
}

function formatCallDate(str) {
  if (!str) return '-';
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  return d.toLocaleString('en-US', {
    month: 'short', day: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const CALL_DIR_MAP = {
  outgoing: { icon: 'solar:outgoing-call-linear',  color: 'var(--primary-300)' },
  incoming: { icon: 'solar:incoming-call-linear',  color: 'var(--accent-teal)' },
  answered: { icon: 'solar:phone-calling-linear',  color: 'var(--accent-light-green)' },
  declined: { icon: 'solar:end-call-linear',       color: 'var(--status-error)' },
};

function CallDirBadge({ dir, size = 14 }) {
  if (dir === 'missed') {
    return <MissedCallIcon size={size} color="var(--status-error)" />;
  }
  const cfg = CALL_DIR_MAP[dir] || CALL_DIR_MAP.outgoing;
  return <Icon name={cfg.icon} size={size} color={cfg.color} />;
}

function EngagementScoreBadge({ score }) {
  if (score == null) return <span className={styles.dateDash}>-</span>;

  let color = '#D72825';
  if (score >= 85) color = '#009B53';
  else if (score >= 70) color = '#009B53';
  else if (score >= 30) color = '#D9A50B';

  return (
    <span
      className={styles.engBadge}
      style={{ color, background: `${color}15`, borderColor: `${color}25` }}
    >
      {score}%
    </span>
  );
}

// ── Skeleton components ──
function CallListSkeleton() {
  return (
    <div className={styles.skeletonItem}>
      <div className={styles.skeletonAvatar} />
      <div className={styles.skeletonLines}>
        <div className={[styles.skeletonLine, styles.skeletonLineWide].join(' ')} />
        <div className={[styles.skeletonLine, styles.skeletonLineNarrow].join(' ')} />
      </div>
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <tr className={styles.skeletonRow}>
      {[180, 140, 80, 100, 120, 60, 120].map((w, i) => (
        <td key={i} className={styles.td}>
          <div className={styles.skeletonCell} style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

// ── Call list item ──
function CallListItem({ entry, selected, onClick }) {
  return (
    <button
      type="button"
      className={[styles.convItem, selected ? styles.selected : ''].join(' ')}
      onClick={onClick}
    >
      <div className={styles.avatarWrap}>
        <Avatar variant="callCard" initials={getInitials(entry.name)} />
        <span className={styles.avatarBadge} aria-hidden="true">
          <CallDirBadge dir={entry.dir} size={10} />
        </span>
      </div>
      <div className={styles.convInfo}>
        <div className={styles.convNameRow}>
          <div className={styles.convName}>
            {entry.name}
            {entry.pinned && (
              <Icon name="solar:pin-bold" size={10} color="var(--primary-300)" className={styles.pin} />
            )}
          </div>
          <div className={styles.convTime}>{entry.time}</div>
        </div>
        <div className={styles.convPreview}>{entry.status}</div>
      </div>
    </button>
  );
}

// ── Calls table row ──
function CallsTableRow({ row, onClick }) {
  const hasGoals = row.goalStatus != null;
  const allMet = row.goalStatus?.allMet;

  return (
    <tr className={[styles.row, row.isNew ? styles.rowNew : ''].filter(Boolean).join(' ')} onClick={onClick}>
      <td className={`${styles.td} ${styles.tdStickyLeft}`}>
        <div className={styles.callsCell}>
          <CallTypeAvatar dir={row.dir} />
          <div className={styles.callsCellText}>
            <span className={styles.callDirText}>{DIR_LABEL[row.dir] || 'Call'}</span>
            <div className={styles.callsAgent}>
              {row.isBot
                ? <AgentsIcon size={11} />
                : <Icon name="solar:user-rounded-linear" size={11} color="var(--neutral-300)" />}
              <span>{row.agent}</span>
            </div>
          </div>
        </div>
      </td>
      <td className={styles.td}><span className={styles.secondaryText}>{row.date}</span></td>
      <td className={styles.td}>
        {row.duration != null
          ? <span className={styles.secondaryText}>{row.duration}</span>
          : <span className={styles.emDash}>—</span>}
      </td>
      <td className={styles.td}>
        <div className={styles.goalStatusCell}>
          {hasGoals ? (
            <>
              <Icon
                name={allMet ? 'solar:check-circle-linear' : 'solar:close-circle-linear'}
                size={15}
                color={allMet ? 'var(--status-success)' : 'var(--status-error)'}
              />
              <span className={styles.secondaryText}>{row.goalStatus.passed}/{row.goalStatus.total} Met</span>
            </>
          ) : (
            <span className={styles.emDash}>—</span>
          )}
        </div>
      </td>
      <td className={styles.td}>
        {row.engagementScore != null
          ? <EngagementScoreBadge score={row.engagementScore} />
          : <span className={styles.emDash}>—</span>}
      </td>
      <td className={styles.td}>
        <span className={row.ooh === 'Yes' ? styles.oohYes : styles.secondaryText}>{row.ooh}</span>
      </td>
      <td className={`${styles.td} ${styles.tdStickyRight}`} onClick={e => e.stopPropagation()}>
        <div className={styles.actionsCell}>
          <ActionButton icon="solar:play-circle-linear"   size="L" tooltip="Play recording" />
          <span className={styles.actionDivider} />
          <ActionButton icon="solar:document-text-linear" size="L" tooltip="Transcript" />
          <span className={styles.actionDivider} />
          <ActionButton icon="solar:menu-dots-bold"       size="L" tooltip="More" />
        </div>
      </td>
    </tr>
  );
}

const TH_STYLE = {
  padding: '8px 14px',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--neutral-300)',
  borderBottom: '1px solid var(--neutral-150)',
  background: 'var(--neutral-0)',
  position: 'sticky',
  top: 0,
  zIndex: 2,
  textAlign: 'left',
  whiteSpace: 'nowrap',
  userSelect: 'none',
};

export function CallsView() {
  const [activeInbox, setActiveInbox] = useState('agents');
  const [activeCallId, setActiveCallId] = useState('c1');
  const [listFilter, setListFilter] = useState('all');
  const [listSearch, setListSearch] = useState('');
  const [dialNumber, setDialNumber] = useState('');
  const [dialCountry, setDialCountry] = useState('us');
  const [callLine, setCallLine] = useState('all');
  const [showSearch, setShowSearch] = useState(false);

  const showToast              = useAppStore(s => s.showToast);
  const openDetail             = useAppStore(s => s.openDetail);
  const detailPatient          = useAppStore(s => s.detailPatient);
  const fetchPatients          = useAppStore(s => s.fetchPatients);
  const fetchCallDetails       = useAppStore(s => s.fetchCallDetails);
  const fetchMoreCallDetails   = useAppStore(s => s.fetchMoreCallDetails);
  const fetchCallsConfig       = useAppStore(s => s.fetchCallsConfig);

  // Calls UI config from Supabase
  const callNavItems       = useAppStore(s => s.callNavItems);
  const callLines          = useAppStore(s => s.callLines);
  const callSessions       = useAppStore(s => s.callSessions);
  const callsConfigLoading = useAppStore(s => s.callsConfigLoading);

  // Call records for the table
  const callDetails        = useAppStore(s => s.callDetails);
  const callDetailsLoading = useAppStore(s => s.callDetailsLoading);
  const callDetailsHasMore = useAppStore(s => s.callDetailsHasMore);

  useEffect(() => {
    fetchPatients();
    fetchCallDetails();
    fetchCallsConfig();
  }, [fetchPatients, fetchCallDetails, fetchCallsConfig]);

  // Derive inbox items and channel items from the combined callNavItems array
  const inboxItems   = callNavItems.filter(i => i.section === 'inbox');
  const channelItems = callNavItems.filter(i => i.section === 'channel');

  // Derive table rows from call_details — exclude live/ongoing records
  const callsRows = callDetails
    .filter(c => c.callType !== 'ongoing')
    .map(c => {
      const dir = c.direction || (c.callType === 'voicemail' ? 'missed' : c.callType === 'declined' ? 'declined' : 'outgoing');
      const hasCall = dir === 'outgoing' || dir === 'incoming' || dir === 'answered';
      return {
        id: c.id,
        dir,
        agent: c.agentName || 'Anna',
        isBot: c.isBot ?? (c.agentName === 'Anna' || c.agentName === 'Automation'),
        date: formatCallDate(c.startedAt),
        startedAt: c.startedAt,
        duration: hasCall ? (c.duration || '-') : null,
        ooh: computeOOH(c.startedAt),
        goalStatus: hasCall ? computeGoalStatus(c.goalsDetail) : null,
        engagementScore: hasCall ? (c.qualityScore?.overall ?? null) : null,
        patientId: c.patientId,
      };
    });

  const filteredList = callSessions.filter(c => {
    if (listFilter === 'incoming') {
      if (c.dir !== 'incoming' && c.dir !== 'missed' && c.dir !== 'declined') return false;
    } else if (listFilter === 'outgoing') {
      if (c.dir !== 'outgoing') return false;
    }
    if (!listSearch) return true;
    return c.name.toLowerCase().includes(listSearch.toLowerCase());
  });

  const activeCount = filteredList.filter(c => c.status === 'Call Back').length;
  const activeLabel =
    inboxItems.find(i => i.id === activeInbox)?.label
    || channelItems.find(i => i.id === activeInbox)?.label
    || 'Calls';

  const handleRowClick = (row) => {
    if (row.patientId) {
      openDetail(row.patientId, row);
    } else {
      showToast('Call details — coming soon');
    }
  };

  return (
    <div className={styles.page}>
      <TopBar />

      <div className={styles.panels}>
        {/* ── Left commPanel — shared SideNav ── */}
        <SideNav
          width={200}
          loading={callsConfigLoading}
          header={
            <Button
              variant="primary"
              size="L"
              leadingIcon="solar:add-circle-bold"
              fullWidth
              onClick={() => showToast('New call – coming soon')}
            >
              New Call
            </Button>
          }
          sections={[
            {
              key: 'inbox',
              label: 'Inbox',
              items: inboxItems.map(item => ({
                key: item.id,
                label: item.label,
                icon: item.isCustomIcon ? undefined : item.icon,
                iconElement: item.isCustomIcon
                  ? <MissedCallIcon size={16} color={activeInbox === item.id ? 'var(--primary-300)' : 'var(--neutral-300)'} />
                  : undefined,
              })),
            },
            {
              key: 'channels',
              label: 'Channels',
              items: channelItems.map(item => ({ key: item.id, label: item.label, icon: item.icon })),
            },
          ]}
          activeKey={activeInbox}
          onSelect={setActiveInbox}
        />

        {/* ── Middle: Call history list ── */}
        <div className={styles.convPanel}>
          <div className={styles.convHeader}>
            <div className={styles.convHeaderLeft}>
              <div className={styles.convHeaderTitle}>{activeLabel}</div>
              {activeCount > 0 && (
                <div className={styles.convHeaderSub}>
                  {activeCount} call{activeCount !== 1 ? 's' : ''} to return
                </div>
              )}
            </div>
            <div className={styles.convHeaderActions}>
              <ActionButton
                icon="solar:magnifer-linear"
                size="L"
                tooltip="Search"
                active={showSearch}
                onClick={() => setShowSearch(!showSearch)}
              />
              <div className={styles.convDivider} />
              <ActionButton icon="solar:refresh-linear" size="L" tooltip="Refresh" />
              <div className={styles.convDivider} />
              <ActionButton icon="custom:filter"  size="L" tooltip="Filter" />
            </div>
          </div>

          {/* Call line select */}
          <div className={styles.convSelectWrap}>
            {callsConfigLoading ? (
              <div className={styles.skeletonSelect} />
            ) : (
              <Select
                className={styles.callLineTrigger}
                options={callLines.map(line => ({ value: line.id, label: line.label }))}
                value={callLine}
                onChange={setCallLine}
              />
            )}
          </div>

          {/* Search row */}
          {showSearch && (
            <div className={styles.convSearch}>
              <div className={styles.convSearchWrap}>
                <span className={styles.convSearchIcon}>
                  <Icon name="solar:magnifer-linear" size={13} />
                </span>
                <Input
                  placeholder="Search calls…"
                  value={listSearch}
                  onChange={e => setListSearch(e.target.value)}
                  style={{ paddingLeft: 28, fontSize: 13 }}
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Filter toggle */}
          <div className={styles.convTabs}>
            <Toggle
              items={[
                { key: 'all',      label: 'All' },
                { key: 'incoming', label: 'Incoming' },
                { key: 'outgoing', label: 'Outgoing' },
              ]}
              active={listFilter}
              onChange={setListFilter}
              size="S"
              fullWidth
            />
          </div>

          <div className={styles.convList}>
            {callsConfigLoading
              ? Array.from({ length: 6 }).map((_, i) => <CallListSkeleton key={i} />)
              : filteredList.map(c => (
                  <CallListItem
                    key={c.id}
                    entry={c}
                    selected={activeCallId === c.id}
                    onClick={() => setActiveCallId(c.id)}
                  />
                ))}
          </div>

          {/* Dial a Number */}
          <div className={styles.dialPad}>
            <div className={styles.dialLabel}>Dial a Number</div>
            <div className={styles.dialRow}>
              <Select
                className={styles.countryTrigger}
                options={[
                  { value: 'us', label: '🇺🇸 +1' },
                  { value: 'gb', label: '🇬🇧 +44' },
                  { value: 'in', label: '🇮🇳 +91' },
                ]}
                value={dialCountry}
                onChange={setDialCountry}
              />
              <div className={styles.dialInputWrap}>
                <Input
                  placeholder="Enter Number Here"
                  value={dialNumber}
                  onChange={e => setDialNumber(e.target.value)}
                  style={{ paddingRight: 32 }}
                />
                <button
                  type="button"
                  className={styles.dialBtn}
                  onClick={() => showToast('Dial pad – coming soon')}
                  aria-label="Open dial pad"
                >
                  <Icon name="solar:dialpad-linear" size={16} color="var(--primary-300)" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Main panel ── */}
        <div className={styles.mainPanel}>
          {/* Profile banner */}
          <div className={styles.profileBanner}>
            <div className={styles.profileContent}>
              <Avatar variant="patient" initials="CM" className={styles.profileAvatar} />
              <div className={styles.profileInfo}>
                <div className={styles.profileNameRow}>
                  <span className={styles.profileName}>Clara Mitchell</span>
                  <ActionButton
                    icon="solar:square-top-down-linear"
                    size="L"
                    tooltip="Open patient record"
                    iconColor="var(--primary-300)"
                  />
                </div>
                <div className={styles.profileMeta}>
                  <span>Patient</span>
                  <span className={styles.metaDot}>•</span>
                  <span>Female</span>
                  <span className={styles.metaDot}>•</span>
                  <span>34Y (02-21-1992)</span>
                  <span className={styles.metaDot}>•</span>
                  <span>(581) 824-1591</span>
                </div>
                <div className={styles.profileActions}>
                  <ActionButton icon="solar:home-2-linear"           size="L" tooltip="Home" />
                  <span className={styles.profileActionDivider} />
                  <ActionButton icon="solar:phone-linear"            size="L" tooltip="Call" />
                  <span className={styles.profileActionDivider} />
                  <ActionButton icon="solar:letter-linear"           size="L" tooltip="Email" />
                  <span className={styles.profileActionDivider} />
                  <ActionButton icon="solar:chat-round-dots-linear"  size="L" tooltip="Chat" />
                  <span className={styles.profileActionDivider} />
                  <ActionButton icon="solar:videocamera-linear"      size="L" tooltip="Video" />
                  <span className={styles.profileActionDivider} />
                  <ActionButton icon="solar:folder-linear"           size="L" tooltip="Files" />
                  <span className={styles.profileActionDivider} />
                  <ActionButton icon="solar:phone-calling-linear"    size="L" tooltip="Call history" />
                </div>
              </div>
            </div>
          </div>

          {/* To: subtitle */}
          <div className={styles.toRow}>To: +1 25648 84230</div>

          {/* Calls table */}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...TH_STYLE, minWidth: 200, left: 0, zIndex: 3 }}>Calls</th>
                  <th style={TH_STYLE}>Date &amp; Time</th>
                  <th style={TH_STYLE}>Duration</th>
                  <th style={TH_STYLE}>Goal Status</th>
                  <th style={TH_STYLE}>Engagement Score</th>
                  <th style={TH_STYLE}>Out of Office</th>
                  <th style={{ ...TH_STYLE, width: 130, right: 0, zIndex: 3 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {callDetailsLoading && callsRows.length === 0
                  ? Array.from({ length: 7 }).map((_, i) => <TableRowSkeleton key={i} />)
                  : callsRows.map((row, idx) => (
                      <CallsTableRow key={row.id} row={row} idx={idx} onClick={() => handleRowClick(row)} />
                    ))}
              </tbody>
            </table>
            {/* Load More */}
            {(callDetailsHasMore || (callDetailsLoading && callsRows.length > 0)) && (
              <div className={styles.loadMoreWrap}>
                <Button
                  variant="ghost"
                  size="S"
                  onClick={fetchMoreCallDetails}
                  disabled={callDetailsLoading}
                >
                  {callDetailsLoading ? 'Loading…' : 'Load More'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Drawer — renders when a row is clicked */}
      {detailPatient && <DetailDrawer />}
    </div>
  );
}
