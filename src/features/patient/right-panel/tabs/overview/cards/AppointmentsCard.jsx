import { useEffect, useMemo, useState } from 'react';
import { DashboardCard, DashboardCardBody, DashboardCardSkeleton } from '../../../../../../components/DashboardCard/DashboardCard';
import { PanelSectionItem, PanelSectionMore } from '../../../../../../components/PanelSection/PanelSection';
import { CountToggle } from './CountToggle';
import { Button } from '../../../../../../components/Button/Button';
import { ScheduleDrawer } from '../../../../../../components/ScheduleDrawer/ScheduleDrawer';
import { parseLocalDate } from '../../../../../../lib/localDate';
import { useAppStore } from '../../../../../../store/useAppStore';
import { appointmentForDrawer } from './overviewItemActions';
import { useP360Profile } from './useP360Profile';
import { usePatientStream } from '../../../../hooks/usePatientStream';
import { missedAppointments } from './missedAppointments';
import styles from './overviewCards.module.css';
import { CardHeaderActions, CardInsights } from '../attention/CardInsights';

const VISIBLE = 3;

const fmtDate = ms => new Date(ms).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

// `date` is a stored date string; `at` a timestamp (missed visits from the stream).
function DateTile({ date, at, tone }) {
  const d = at != null ? new Date(at) : parseLocalDate(date);
  if (!d) return <span className={styles.dateTile}><span className={styles.dateMonth}>TBD</span></span>;
  return (
    <span className={`${styles.dateTile} ${tone === 'error' ? styles.dateTileMissed : ''}`} aria-hidden="true">
      <span className={styles.dateMonth}>{d.toLocaleString('en-US', { month: 'short' }).toUpperCase()}</span>
      <span className={styles.dateDay}>{String(d.getDate()).padStart(2, '0')}</span>
    </span>
  );
}

// Upcoming appointments are stored on the patient's p360_profiles row
// (upcoming_appointments), the same list the P360 banner shows. A click
// opens that visit in the appointment drawer, using the calendar row when
// one matches so status changes persist.
//
// Missed lists visits from the last year the patient didn't attend (no-show,
// cancelled, never checked in; missedAppointments.js), noting any rebooking.
// The card opens on Missed while one still needs rebooking.
export function AppointmentsCard({ patientId, patient }) {
  const profile = useP360Profile(patientId);
  const { events, loading: streamLoading } = usePatientStream(patientId);
  const appointments = useAppStore(s => s.appointments);
  const fetchAppointments = useAppStore(s => s.fetchAppointments);
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(null);
  const [pickedTab, setPickedTab] = useState(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [openedAt] = useState(() => Date.now());
  const [insightsOpen, setInsightsOpen] = useState(false);

  useEffect(() => { fetchAppointments?.(); }, [fetchAppointments]);

  const upcomingRaw = profile?.upcoming_appointments;
  const missed = useMemo(
    () => missedAppointments({ events, upcoming: upcomingRaw || [], now: openedAt }),
    [events, upcomingRaw, openedAt],
  );

  if (profile === undefined || streamLoading) return <DashboardCardSkeleton icon="solar:calendar-linear" title="Appointments" />;

  const appts = [...(upcomingRaw || [])]
    .sort((a, b) => (parseLocalDate(a.date)?.getTime() ?? Infinity) - (parseLocalDate(b.date)?.getTime() ?? Infinity));
  const needsRebooking = missed.filter(m => !m.rebookedAt).length;
  const tab = pickedTab ?? (needsRebooking ? 'missed' : 'upcoming');
  const pickTab = (key) => { setPickedTab(key); setExpanded(false); };

  const openAppointment = (a) => {
    setOpen(appointmentForDrawer(a, {
      patientId,
      patientName: patient?.name,
      appointments,
    }));
  };

  return (
    <DashboardCard
      icon="solar:calendar-linear"
      title="Appointments"
      tabs={(
        <CountToggle
          items={[
            { key: 'upcoming', label: 'Upcoming', count: appts.length },
            { key: 'missed', label: 'Missed', count: missed.length },
          ]}
          active={tab}
          onChange={pickTab}
        />
      )}
      actions={<CardHeaderActions insightsOpen={insightsOpen} onToggleInsights={() => setInsightsOpen(v => !v)}></CardHeaderActions>}
    >
      <CardInsights open={insightsOpen} />
      <DashboardCardBody className={styles.listBody}>
        {tab === 'missed' ? (
          missed.length === 0 ? (
            <p className={styles.empty}>No missed appointments in the last 12 months.</p>
          ) : (
            <>
              {missed.slice(0, expanded ? undefined : VISIBLE).map(m => (
                <div key={m.id} className={styles.listRow}>
                  <PanelSectionItem
                    inset
                    leading={<DateTile at={m.at} tone={m.rebookedAt ? null : 'error'} />}
                    title={m.provider ? `${m.title} with ${m.provider}` : m.title}
                    wrapTitle
                    meta={[
                      fmtDate(m.at),
                      <span key="why" className={m.reason === 'No show' ? styles.textError : undefined}>{m.reason}</span>,
                      m.rebookedAt
                        ? <span key="re" className={styles.textSuccess}>Rebooked {fmtDate(m.rebookedAt)}</span>
                        : 'Not rebooked',
                    ]}
                    trailing={m.rebookedAt ? null : (
                      <Button variant="outline" size="sm" onClick={() => setRescheduling(true)}>Reschedule</Button>
                    )}
                  />
                </div>
              ))}
              <PanelSectionMore expanded={expanded} hiddenCount={missed.length - VISIBLE} onToggle={() => setExpanded(v => !v)} />
            </>
          )
        ) : appts.length === 0 ? (
          <p className={styles.empty}>No upcoming appointments.</p>
        ) : appts.slice(0, expanded ? undefined : VISIBLE).map((a, i) => (
          <div key={`${a.date}-${a.type}-${i}`} className={styles.clickRow}>
            <PanelSectionItem
              inset
              leading={<DateTile date={a.date} />}
              title={(
                <button type="button" className={`${styles.titleButton} ${styles.stretch}`} onClick={() => openAppointment(a)}>
                  {a.provider ? `${a.type} with ${a.provider}` : a.type}
                </button>
              )}
              meta={[a.date, a.time, a.program]}
            />
          </div>
        ))}
        {tab === 'upcoming' && (
          <PanelSectionMore expanded={expanded} hiddenCount={appts.length - VISIBLE} onToggle={() => setExpanded(v => !v)} />
        )}
      </DashboardCardBody>
      {open && (
        <ScheduleDrawer
          existingAppointment={open}
          initialPatientId={patientId}
          source="patient_overview"
          onClose={() => setOpen(null)}
        />
      )}
      {rescheduling && (
        <ScheduleDrawer
          initialPatientId={patientId}
          source="patient_overview"
          onClose={() => setRescheduling(false)}
        />
      )}
    </DashboardCard>
  );
}
