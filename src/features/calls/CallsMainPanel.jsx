import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Avatar } from '../../components/Avatar/Avatar';
import { Button } from '../../components/Button/Button';
import { CallsTableRow, TableRowSkeleton } from './CallsViewHelpers';
import { TH_STYLE } from './CallsViewHelpers.utils';
import styles from './CallsView.module.css';

export function CallsMainPanel({
  callsRows,
  callDetailsLoading,
  callDetailsHasMore,
  onLoadMore,
  onRowClick,
}) {
  return (
    <div className={styles.mainPanel}>
      <div className={styles.profileBanner}>
        <div className={styles.profileContent}>
          <Avatar variant="patient" initials="CM" className={styles.profileAvatar} />
          <div className={styles.profileInfo}>
            <div className={styles.profileNameRow}>
              <span className={styles.profileName}>Clara Mitchell</span>
              <ActionButton
                icon="solar:square-top-down-linear"
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
              <ActionButton icon="solar:home-2-linear" tooltip="Home" />
              <span className={styles.profileActionDivider} />
              <ActionButton icon="solar:phone-linear" tooltip="Call" />
              <span className={styles.profileActionDivider} />
              <ActionButton icon="solar:letter-linear" tooltip="Email" />
              <span className={styles.profileActionDivider} />
              <ActionButton icon="solar:chat-round-dots-linear" tooltip="Chat" />
              <span className={styles.profileActionDivider} />
              <ActionButton icon="solar:videocamera-linear" tooltip="Video" />
              <span className={styles.profileActionDivider} />
              <ActionButton icon="solar:folder-linear" tooltip="Files" />
              <span className={styles.profileActionDivider} />
              <ActionButton icon="solar:phone-calling-linear" tooltip="Call history" />
            </div>
          </div>
        </div>
      </div>

      <div className={styles.toRow}>To: +1 25648 84230</div>

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
              : callsRows.map(row => (
                  <CallsTableRow key={row.id} row={row} onClick={() => onRowClick(row)} />
                ))}
          </tbody>
        </table>
        {(callDetailsHasMore || (callDetailsLoading && callsRows.length > 0)) && (
          <div className={styles.loadMoreWrap}>
            <Button
              variant="ghost"
              size="sm"
              onClick={onLoadMore}
              disabled={callDetailsLoading}
            >
              {callDetailsLoading ? 'Loading…' : 'Load More'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
