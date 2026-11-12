import { useContext } from 'react';
import { Tooltip } from '../Tooltip/Tooltip';
import { OooIcon } from '../Icon/OooIcon';
import { formatDateTime } from '../../lib/dateFormat';
import { AvatarOooLookup } from './AvatarOooLookup';
import { AvatarBase } from './AvatarBase';
import styles from './Avatar.module.css';

// A user who is out of office right now wears a purple arrow badge on the
// avatar's bottom-right corner (Figma Eventus 17436:107488); hovering it
// shows when they're away (17453:111528).
// Large avatars (L, XL, DXL, or over 40px) get a 16px mark; the rest,
// including the default and M, 8px.
const oooMarkSize = (size) => (['L', 'XL', 'DXL'].includes(size) || (typeof size === 'number' && size > 40) ? 16 : 8);

// A day for the badge's hover: "11/11/2026", with the time only when it isn't
// midnight ("11/11/2026, 2:30 PM").
function oooDay(v) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.getHours() || d.getMinutes() ? formatDateTime(v) : d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function OooWrapper({ record, size, note, children }) {
  return (
    <span className={styles.oooWrap}>
      {children}
      <Tooltip
        variant="light"
        placement="bottom"
        className={styles.oooBadgeWrap}
        label={(
          <span className={styles.oooTip}>
            <span className={styles.oooTipTitle}>Out of office</span>
            <span>{oooDay(record.startAt)} – {oooDay(record.endAt)}</span>
            {note && <span className={styles.oooTipNote}>{note}</span>}
          </span>
        )}
      >
        <span className={styles.oooBadge} role="img" aria-label="Out of office">
          <OooIcon size={oooMarkSize(size)} color="var(--accent-magenta)" />
        </span>
      </Tooltip>
    </span>
  );
}

/**
 * Avatar, plus the Out of Office badge. Pass `userName` (and `userId`, so
 * two staff with the same name aren't confused) and the badge shows whenever
 * that user is out of office now (the app supplies the lookup through
 * AvatarOooLookup); or pass `ooo` (a record, or null) to decide it yourself.
 * `oooNote` adds a line under the dates in that hover (e.g. "You're covering").
 */
export function Avatar({ userName, userId, ooo, oooNote, ...props }) {
  const lookup = useContext(AvatarOooLookup);
  const found = ooo !== undefined || !userName || !lookup ? null
    : lookup(userId ? { id: userId, name: userName } : userName);
  const record = ooo !== undefined ? ooo : found;
  const el = <AvatarBase {...props} />;
  return record ? <OooWrapper record={record} size={props.size} note={oooNote}>{el}</OooWrapper> : el;
}
