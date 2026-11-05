import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Drawer } from '@/components/Drawer/Drawer';
import { Button } from '@/components/Button/Button';
import { RadioOptionGroup } from '@/components/RadioOptionGroup/RadioOptionGroup';
import { FilterChip } from '@/components/FilterChip/FilterChip';
import { Textarea } from '@/components/Textarea/Textarea';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { CardSkeleton } from '@/components/CardSkeleton/CardSkeleton';
import { dayKey, dayParts, groupByDay, timeLabel, zoneName } from './slotFormat';
import styles from './BookVisitDrawer.module.css';

const DAYS_AHEAD = 14;
const isDualMode = (type) => /\//.test(type?.mode || '');

export function BookVisitDrawer({ profile, onClose, onBooked }) {
  const [types, setTypes] = useState(null);
  const [typeId, setTypeId] = useState('');
  const [mode, setMode] = useState('In-person');
  const [slots, setSlots] = useState(null);
  const [provider, setProvider] = useState([]);
  const [day, setDay] = useState('');
  const [slot, setSlot] = useState(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [booking, setBooking] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    supabase.rpc('patient_bookable_appointment_types').then(({ data, error: e }) => {
      if (e) setError('We could not load visit types. Please try again.');
      setTypes(data || []);
      if (data?.length) setTypeId(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!typeId) return undefined;
    let alive = true;
    supabase.rpc('patient_available_slots', {
      p_member_id: profile.member_id, p_type_id: typeId, p_from: dayKey(Date.now(), Intl.DateTimeFormat().resolvedOptions().timeZone), p_days: DAYS_AHEAD,
    }).then(({ data, error: e }) => {
      if (!alive) return;
      if (e) setError('We could not load open times. Please try again.');
      setSlots(data || []);
    });
    return () => { alive = false; };
  }, [typeId, profile.member_id, reloadKey]);

  const type = types?.find((t) => t.id === typeId);
  const providers = useMemo(() => [...new Set((slots || []).map((s) => s.provider_name))].sort(), [slots]);
  const shown = useMemo(() => {
    const picked = new Set(provider);
    return (slots || []).filter((s) => !picked.size || picked.has(s.provider_name));
  }, [slots, provider]);
  const days = useMemo(() => groupByDay(shown), [shown]);
  const activeDay = days.find((d) => d.key === day) || days[0];
  const tz = shown[0]?.timezone;

  const pickType = (id) => {
    setTypeId(id);
    setSlots(null);
    setSlot(null);
    setDay('');
    setProvider([]);
    setError('');
  };

  const book = async () => {
    if (!slot) return;
    setBooking(true);
    setError('');
    try {
      const { error: e } = await supabase.rpc('patient_book_appointment', {
        p_member_id: profile.member_id,
        p_type_id: typeId,
        p_user_id: slot.user_id,
        p_starts_at: slot.starts_at,
        p_mode: isDualMode(type) ? mode : null,
        p_reason: reason,
      });
      if (e) {
        setError(e.message || 'We could not book that time. Please try again.');
        setSlot(null);
        setReloadKey((k) => k + 1);
        return;
      }
      toast.success('Visit booked', {
        description: `${type.name} with ${slot.provider_name}, ${dayParts(activeDay.key).weekday} ${dayParts(activeDay.key).month} ${dayParts(activeDay.key).day} at ${timeLabel(slot.starts_at, slot.timezone)}`,
      });
      onBooked?.();
      setDismissed(true);
    } catch {
      setError('We could not book that time. Check your connection and try again.');
    } finally {
      setBooking(false);
    }
  };

  return (
    <Drawer
      title="Book a visit"
      onClose={onClose}
      dismissed={dismissed}
      width={560}
      primaryAction={(
        <Button disabled={!slot || booking} onClick={book}>
          {booking ? 'Booking…' : 'Book visit'}
        </Button>
      )}
    >
      <div className={styles.body}>
        <p className={styles.for}>Booking for <strong>{profile.name}</strong></p>

        {error && <p className={styles.error} role="alert">{error}</p>}

        {types === null && <CardSkeleton count={3} />}
        {types?.length === 0 && (
          <EmptyState
            icon="solar:calendar-linear"
            title="Online booking is not available"
            description="Please contact your care team to book a visit."
          />
        )}

        {types?.length > 0 && (
          <>
            <RadioOptionGroup
              label="Visit type"
              variant="card"
              value={typeId}
              onChange={pickType}
              options={types.map((t) => ({ value: t.id, label: t.name, hint: `${t.duration_minutes} min • ${t.mode}` }))}
            />

            {isDualMode(type) && (
              <RadioOptionGroup
                label="How would you like to meet?"
                value={mode}
                onChange={setMode}
                options={[{ value: 'In-person', label: 'In person' }, { value: 'Virtual', label: 'Video visit' }]}
              />
            )}

            <section className={styles.section} aria-label="Date and time">
              <div className={styles.sectionHead}>
                <h3 className={styles.sectionTitle}>Date and time</h3>
                {providers.length > 1 && (
                  <FilterChip label="Provider" options={providers} selected={provider} onChange={(v) => { setProvider(v); setSlot(null); }} singleSelect />
                )}
              </div>

              {slots === null && <CardSkeleton count={2} />}
              {slots && days.length === 0 && (
                <EmptyState
                  icon="solar:calendar-linear"
                  title="No open times in the next two weeks"
                  description="Try another visit type, or contact your care team."
                />
              )}

              {days.length > 0 && (
                <>
                  <div className={styles.days} role="tablist" aria-label="Day">
                    {days.map((d) => {
                      const p = dayParts(d.key);
                      const active = d.key === activeDay.key;
                      return (
                        <button
                          key={d.key}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          className={`${styles.day} ${active ? styles.dayActive : ''}`}
                          onClick={() => { setDay(d.key); setSlot(null); }}
                        >
                          <span className={styles.dayWeekday}>{p.weekday}</span>
                          <span className={styles.dayNumber}>{p.day}</span>
                          <span className={styles.dayMonth}>{p.month}</span>
                        </button>
                      );
                    })}
                  </div>

                  <p className={styles.zone}>Times are in {zoneName(tz)}.</p>
                  <div className={styles.times} role="radiogroup" aria-label="Time">
                    {activeDay.slots.map((s) => {
                      const picked = slot?.starts_at === s.starts_at && slot?.user_id === s.user_id;
                      return (
                        <button
                          key={`${s.user_id}-${s.starts_at}`}
                          type="button"
                          role="radio"
                          aria-checked={picked}
                          className={`${styles.time} ${picked ? styles.timeActive : ''}`}
                          onClick={() => setSlot(s)}
                        >
                          <span>{timeLabel(s.starts_at, s.timezone)}</span>
                          {providers.length > 1 && !provider.length && <span className={styles.timeProvider}>{s.provider_name}</span>}
                        </button>
                      );
                    })}
                  </div>
                  {slot && (
                    <p className={styles.where}>
                      With {slot.provider_name}
                      {(!isDualMode(type) ? type.mode : mode) !== 'Virtual' && slot.location ? ` at ${slot.location}` : ''}
                    </p>
                  )}
                </>
              )}
            </section>

            <Textarea
              title="Reason for visit (optional)"
              value={reason}
              onValueChange={setReason}
              maxLength={500}
              rows={3}
              placeholder="Tell your care team what you would like to talk about"
            />
          </>
        )}
      </div>
    </Drawer>
  );
}
