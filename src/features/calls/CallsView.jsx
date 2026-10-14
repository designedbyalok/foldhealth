import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TopBar } from '../../components/TopBar/TopBar';
import { MissedCallIcon } from '../../components/Icon/MissedCallIcon';
import { Button } from '../../components/Button/Button';
import { SideNav } from '../../components/SideNav/SideNav';
import { useFloatingSubNavSlot } from '../../components/FloatingSidebar/floatingSubNavSlot';
import { DetailDrawer } from '../../components/DetailDrawer/DetailDrawer';
import { useAppStore } from '../../store/useAppStore';
import { computeGoalStatus, computeOOH, formatCallDate } from './CallsViewHelpers.utils';
import { CallsConvPanel } from './CallsConvPanel';
import { CallsMainPanel } from './CallsMainPanel';
import styles from './CallsView.module.css';

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

  const callNavItems       = useAppStore(s => s.callNavItems);
  const callLines          = useAppStore(s => s.callLines);
  const callSessions       = useAppStore(s => s.callSessions);
  const callsConfigLoading = useAppStore(s => s.callsConfigLoading);

  const callDetails        = useAppStore(s => s.callDetails);
  const callDetailsLoading = useAppStore(s => s.callDetailsLoading);
  const callDetailsHasMore = useAppStore(s => s.callDetailsHasMore);

  useEffect(() => {
    fetchPatients();
    fetchCallDetails();
    fetchCallsConfig();
  }, [fetchPatients, fetchCallDetails, fetchCallsConfig]);

  const inboxItems   = callNavItems.filter(i => i.section === 'inbox');
  const channelItems = callNavItems.filter(i => i.section === 'channel');

  const callsRows = [];
  for (const c of callDetails) {
    if (c.callType === 'ongoing') continue;
    const dir = c.direction || (c.callType === 'voicemail' ? 'missed' : c.callType === 'declined' ? 'declined' : 'outgoing');
    const hasCall = dir === 'outgoing' || dir === 'incoming' || dir === 'answered';
    callsRows.push({
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
    });
  }

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

  const sidebarShape = useAppStore(st => st.sidebarShape);
  const floatingSlot = useFloatingSubNavSlot();
  const floating = sidebarShape === 'floating' && floatingSlot;

  const sideNavEl = (
    <SideNav
      width={floating ? '100%' : 200}
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
  );

  return (
    <div className={styles.page}>
      <TopBar />

      <div className={styles.panels}>
        {floating ? createPortal(sideNavEl, floatingSlot) : sideNavEl}

        <CallsConvPanel
          activeLabel={activeLabel}
          activeCount={activeCount}
          showSearch={showSearch}
          onToggleSearch={() => setShowSearch(!showSearch)}
          callsConfigLoading={callsConfigLoading}
          callLines={callLines}
          callLine={callLine}
          onCallLineChange={setCallLine}
          listSearch={listSearch}
          onListSearchChange={setListSearch}
          listFilter={listFilter}
          onListFilterChange={setListFilter}
          filteredList={filteredList}
          activeCallId={activeCallId}
          onActiveCallChange={setActiveCallId}
          dialCountry={dialCountry}
          onDialCountryChange={setDialCountry}
          dialNumber={dialNumber}
          onDialNumberChange={setDialNumber}
          onDialPadClick={() => showToast('Dial pad – coming soon')}
        />

        <CallsMainPanel
          callsRows={callsRows}
          callDetailsLoading={callDetailsLoading}
          callDetailsHasMore={callDetailsHasMore}
          onLoadMore={fetchMoreCallDetails}
          onRowClick={handleRowClick}
        />
      </div>

      {detailPatient && <DetailDrawer />}
    </div>
  );
}
