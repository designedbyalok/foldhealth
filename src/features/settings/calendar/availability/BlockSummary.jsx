import { Badge } from '../../../../components/Badge/Badge';
import { Icon } from '../../../../components/Icon/Icon';
import { CalendarIcon } from '../../../../components/Icon/CalendarIcon';
import { ALL_TYPES, STATUS_LOOK, blockStatus, cadenceText, formatRange, slotText } from './availabilityUtils';
import styles from './UserAvailability.module.css';

/** "Weekly on Tue, Thu", "Every 2 weeks on Wed", "Daily". */
const occurs = (block) => cadenceText(block).replace(' • ', ' on ');

/**
 * A block, read-only (Figma 2819:4421): title and status, then where and
 * when it runs, then how it repeats and its hours. Used wherever a block is
 * looked at or picked, not edited.
 *
 * @param {object} props.block
 * @param {string} props.title – e.g. "Block 1"
 * @param {React.ReactNode} [props.children] – extra lines under the summary
 */
export function BlockSummary({ block, title, children }) {
  const status = STATUS_LOOK[blockStatus(block)];
  return (
    <span className={styles.summaryBlock}>
      <span className={styles.summaryHead}>
        <span className={styles.summaryTitleBadge}>
          <span className={styles.summaryTitle}>{title}</span>
          <Badge tone={status.tone} size="S" label={status.label} />
        </span>
      </span>
      <BlockMeta block={block} />
      {children}
    </span>
  );
}

/**
 * A block's facts as two lines (Figma 2819:12442): location • dates, then
 * "Occurs …" • each time range. Parts not filled in yet are left out. Used
 * under a block's title (BlockSummary) and as the edit card's footer.
 *
 * @param {object} props.block
 */
export function BlockMeta({ block }) {
  const hours = (block.slots || []).filter(s => s.start && s.end).map(s => `${slotText(s)} (${s.appointmentType || ALL_TYPES})`);
  const range = block.startDate && block.endDate ? formatRange(block.startDate, block.endDate) : '';
  const hasCadence = block.repeat === 'daily' || (block.days?.length || 0) > 0;
  const dot = <span className={styles.summaryDot} aria-hidden="true">•</span>;
  return (
    <>
      {(block.location || range) && (
        <span className={styles.summaryLine}>
          {block.location && (
            <span className={styles.summaryItem}>
              <Icon name="solar:map-point-linear" size={12} color="currentColor" />
              {block.location}
            </span>
          )}
          {block.location && range && dot}
          {range && (
            <span className={styles.summaryItem}>
              <CalendarIcon size={12} color="currentColor" />
              {range}
            </span>
          )}
        </span>
      )}
      {(hasCadence || hours.length > 0) && (
        <span className={styles.summaryLine}>
          {hasCadence && (
            <span className={styles.summaryItem}>
              <Icon name="solar:refresh-linear" size={12} color="currentColor" />
              Occurs {occurs(block)}
            </span>
          )}
          {hours.map((h, k) => (
            <span key={h} className={styles.summaryItem}>{(hasCadence || k > 0) && dot}{h}</span>
          ))}
        </span>
      )}
    </>
  );
}
