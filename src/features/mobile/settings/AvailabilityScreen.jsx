import { Badge } from '../../../components/Badge/Badge';
import { Button } from '../../../components/Button/Button';
import { useAppStore } from '../../../store/useAppStore';
import {
  ALL_TYPES, STATUS_LOOK, blockStatus, cadenceText, formatDate, slotTextTz, timezoneLabel,
} from '../../settings/calendar/availability/availabilityUtils';
import { MobileSubHeader } from '../MobileHeader';
import { MobileEmpty, MobileListSkeleton } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { useMyAvailability } from './useMyAvailability';
import common from '../mobile.module.css';
import more from '../more/more.module.css';
import styles from './settings.module.css';

/** My Availability (desktop Settings > Calendar > User Availability, my row). */
export function AvailabilityScreen() {
  const { push } = useMobileNav();
  const { user, blocks, loading } = useMyAvailability();
  const local = useAppStore(s => s.userAvailabilityLocal);

  return (
    <div className={common.screen}>
      <MobileSubHeader title="My Availability" />
      <div className={common.body}>
        {loading && !blocks.length ? <MobileListSkeleton height={96} /> : (
          <div className={`${more.stack} ${more.tight}`}>
            {blocks.length === 0 ? (
              <MobileEmpty icon="solar:calendar-date-linear" title="No availability set" description="You follow your practice's hours until you add your own." />
            ) : blocks.map((b, i) => {
              const look = STATUS_LOOK[blockStatus(b)];
              return (
                <button key={b.id || i} type="button" className={styles.block} onClick={() => push('availabilitySlot', { blockId: b.id })}>
                  <span className={styles.blockHead}>
                    <span>{b.location || 'No location'}</span>
                    <Badge tone={look.tone} label={look.label} />
                  </span>
                  <span className={styles.blockLine}>{cadenceText(b)}</span>
                  {(b.slots || []).filter(s => s.start && s.end).map((s, k) => (
                    <span key={k} className={styles.blockLine}>{slotTextTz(s, b.timezone)} · {s.appointmentType || ALL_TYPES}</span>
                  ))}
                  <span className={styles.blockLine}>
                    {formatDate(b.startDate)}{b.endDate ? ` – ${formatDate(b.endDate)}` : ' onwards'}
                    {b.timezone ? ` · ${timezoneLabel(b.timezone)}` : ''}
                  </span>
                </button>
              );
            })}
            {local && <p className={styles.blockLine}>Sample availability: changes last for this session only.</p>}
          </div>
        )}
      </div>
      <div className={styles.footer}>
        <Button size="lg" leadingIcon="solar:add-circle-linear" disabled={!user} onClick={() => push('availabilitySlot', { blockId: null })}>Add hours</Button>
      </div>
    </div>
  );
}
