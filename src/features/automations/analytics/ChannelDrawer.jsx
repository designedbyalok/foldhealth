import { useMemo, useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Icon } from '../../../components/Icon/Icon';
import { useTableSort } from '../../../components/HeaderCell/useTableSort';
import { channelFunnel, dailySeries, formatRange } from '../lib/analytics';
import { CHANNEL_TILES, CHANNEL_TITLE, bucketSeries, channelTiles, messagesForTile } from './analyticsUi';
import { ExecutionBarChart, KpiTile } from './AnalyticsCharts';
import { MemberCell, MemberRowMenu, MemberTable } from './MemberTable';
import styles from './Analytics.module.css';

const EMPTY = {
  sent: 'Nothing was sent in this range',
  delivered: 'Nothing was delivered in this range',
  opened: 'No one opened a message in this range',
  clicked: 'No one clicked a link in this range',
  failed: 'No messages failed in this range',
};

/**
 * Email / SMS Execution drawer: the channel's KPI tiles (each picks the
 * table below), the bar chart, and the messages behind the selected tile.
 */
export function ChannelDrawer({ automation, channel, tile, onTile, messages, membersById, range, onOpenTrace, onClose }) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const active = CHANNEL_TILES[channel].includes(tile) ? tile : 'sent';

  const funnel = useMemo(() => channelFunnel(messages, channel), [messages, channel]);
  const series = useMemo(() => bucketSeries(dailySeries(messages, channel, range)), [messages, channel, range]);
  const rows = useMemo(() => messagesForTile(messages, channel, active)
    .map(m => ({ ...m, name: m.patientName || '' })), [messages, channel, active]);
  const { sorted, sortKey, sortDir, requestSort } = useTableSort(rows, 'sentAt', 'desc');

  const addressLabel = channel === 'sms' ? 'Phone' : 'Email';
  const address = (r) => (r.status === 'failed' && active === 'sent'
    ? (
      <span className={styles.flagged}>
        {r.address || 'No address'}
        <Icon name="solar:danger-triangle-linear" size={14} color="var(--status-error)" />
      </span>
    )
    : <span className={styles.muted}>{r.address || 'No address'}</span>);

  const columns = [
    { key: 'name', label: 'Member name', sortField: 'name', render: r => <MemberCell name={r.patientName} at={r.sentAt} /> },
    ...(active === 'sent' || active === 'delivered' ? [{ key: 'address', label: addressLabel, render: address }] : []),
    ...(active === 'opened' ? [{ key: 'opens', label: '# Opens', sortField: 'opens', sortType: 'number', render: r => r.opens || 0 }] : []),
    ...(active === 'clicked' ? [{ key: 'clicks', label: '# Clicks', sortField: 'clicks', sortType: 'number', render: r => r.clicks || 0 }] : []),
    ...(active === 'failed' ? [{ key: 'reason', label: 'Failing reason', render: r => <span className={styles.errorText}>{r.failingReason || 'Not delivered'}</span> }] : []),
  ];

  const keys = CHANNEL_TILES[channel];
  return (
    <Drawer
      width={716}
      onClose={onClose}
      title={CHANNEL_TITLE[channel]}
    >
      <div className={styles.drawerIntro}>
        <span className={styles.drawerSub}>{automation.name}</span>
        <span className={styles.drawerRange}>{formatRange(range)}</span>
      </div>
      <div className={styles.tiles} style={{ '--tile-count': keys.length }}>
        {channelTiles(channel, funnel).map(({ key, ...t }) => (
          <KpiTile key={key} {...t} selected={key === active} onClick={() => { onTile(key); setPage(1); }} />
        ))}
      </div>
      {funnel.sent > 0 && <ExecutionBarChart data={series} keys={keys} height={240} />}
      <MemberTable
        columns={columns}
        rows={sorted}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={k => requestSort(k)}
        onRowClick={r => r.runMemberId && onOpenTrace(r.runMemberId)}
        renderMenu={r => <MemberRowMenu member={membersById.get(r.runMemberId)} patientId={r.patientId} patientName={r.patientName} />}
        emptyLabel={EMPTY[active]}
        page={page}
        perPage={perPage}
        onPage={setPage}
        onPerPage={n => { setPerPage(n); setPage(1); }}
      />
    </Drawer>
  );
}
