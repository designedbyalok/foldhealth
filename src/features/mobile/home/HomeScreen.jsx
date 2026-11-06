import { useEffect, useMemo, useState } from 'react';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Badge } from '../../../components/Badge/Badge';
import { BottomSheet, BottomSheetItem } from '../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { Skeleton } from '../../../components/Skeleton/Skeleton';
import { useAppStore } from '../../../store/useAppStore';
import { useProgramAccess } from '../../patient/hooks/useProgramAccess';
import { CARE_PROGRAM_CATALOG } from '../../patient/data/careProgramCatalog';
import { isMissedCall } from '../../messages/comms/commsUtils';
import { useCommsConversations } from '../../messages/comms/useComms';
import { formatPatientMeta, useMyWorklistPatients } from '../../home/useMyWorklistPatients';
import { WORKLIST as PROGRAM_WORKLIST, sortProgramHealth } from '../../home/programHealth';
import { MobileRootHeader } from '../MobileHeader';
import { useMobileNav } from '../MobileNavContext';
import { initialsOf } from '../mobileFormat';
import { appointmentStart, toApptDate } from '../schedule/appointmentTime';
import { useMyTasks } from '../tasks/myTasks';
import { TaskRow } from '../tasks/TaskRow';
import { HomeSection } from './HomeSection';
import { QuickNoteSheet, QuickNotesSection } from './QuickNotesSection';
import common from '../mobile.module.css';
import styles from './HomeScreen.module.css';

const PROGRAM_NAMES = Object.fromEntries(CARE_PROGRAM_CATALOG.map(p => [p.code, p.name]));

function greeting(d) {
  const h = d.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function minutesUntil(date, now) {
  const m = Math.round((date - now) / 60000);
  if (m <= 0) return 'now';
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60);
  return `in ${h} hr${m % 60 ? ` ${m % 60} min` : ''}`;
}

/** The provider's day at a glance (mobile port of desktop Home). */
export function HomeScreen() {
  const { push, setTab, canTab, openMember } = useMobileNav();
  const me = useAppStore(s => s.currentUserProfile);
  const [now] = useState(() => new Date());
  const firstName = (me?.name || '').replace(/^Dr\.?\s+/i, '').split(/\s+/)[0];
  const [actionsOpen, setActionsOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  // ── Data ──
  const { tasks: myTasks, loading: tasksLoading } = useMyTasks();
  const { rows: worklist, loading: worklistLoading } = useMyWorklistPatients();
  const { conversations } = useCommsConversations();
  const appointments = useAppStore(s => s.appointments);
  const fetchAppointments = useAppStore(s => s.fetchAppointments);
  const involvesMe = useAppStore(s => s._appointmentInvolvesMe);
  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  const todays = useMemo(() => (appointments || [])
    .filter(a => a.date === toApptDate(now) && !/cancel/i.test(a.status || '') && (!me?.name || involvesMe(a)))
    .map(a => ({ ...a, start: appointmentStart(a) }))
    .filter(a => a.start)
    .sort((a, b) => a.start - b.start), [appointments, now, me, involvesMe]);
  // The next one still to start, or one that began in the last 15 minutes.
  const upNext = todays.find(a => a.start.getTime() >= now.getTime() - 15 * 60000);
  const laterToday = todays.filter(a => a !== upNext && a.start >= now).slice(0, 3);

  const overdue = myTasks.filter(t => t.bucket === 'overdue').length;
  const dueToday = myTasks.filter(t => t.bucket === 'today').length;
  const missedCalls = conversations.filter(isMissedCall).length;
  const unread = conversations.filter(c => c.channel !== 'call').reduce((n, c) => n + (c.unread_count || 0), 0);
  const openTasks = myTasks.filter(t => t.bucket !== 'done');

  // Team programs: supervisors see theirs, admins see all.
  const access = useProgramAccess();
  const supervised = useMemo(
    () => (access.admin ? null : (access.programs || []).filter(c => access.levels?.[c] === 'supervisor')),
    [access.admin, access.programs, access.levels],
  );
  const showTeam = access.admin || supervised?.length > 0;

  const glance = [
    { key: 'overdue', label: 'Overdue tasks', value: overdue, alert: overdue > 0, icon: 'solar:danger-circle-linear', onClick: () => push('tasks', { filter: 'overdue' }) },
    { key: 'today', label: 'Due today', value: dueToday, icon: 'solar:checklist-minimalistic-linear', onClick: () => push('tasks', { filter: 'today' }) },
    canTab('calls') && { key: 'missed', label: 'Missed calls', value: missedCalls, alert: missedCalls > 0, icon: 'solar:end-call-rounded-linear', onClick: () => setTab('calls') },
    canTab('messages') && { key: 'unread', label: 'Unread messages', value: unread, icon: 'solar:chat-round-unread-linear', onClick: () => setTab('messages') },
  ].filter(Boolean);
  // "See all" opens the first non-empty bucket of what the section lists.
  const tasksFilter = overdue ? 'overdue' : dueToday ? 'today' : 'upcoming';

  return (
    <div className={common.screen}>
      <MobileRootHeader title={firstName ? `Hi, ${firstName}` : 'Home'} />
      <div className={common.bodyWrap}>
        <div className={common.body}>
          <div className={styles.intro}>
            <p className={styles.date}>{greeting(now)} • {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            <button type="button" className={styles.search} onClick={() => push('allPatients', { autoFocus: true })}>
              <Icon name="solar:magnifer-linear" size={24} />
              Search members
            </button>
          </div>

          {upNext && (
            <div className={styles.upNext}>
              <Icon name={/virtual|tele/i.test(upNext.mode || '') ? 'solar:videocamera-record-linear' : 'solar:calendar-minimalistic-linear'} size={24} />
              <div className={styles.upNextText}>
                <span className={styles.upNextTitle}>{upNext.patient_name || 'Appointment'}</span>
                <span className={styles.upNextMeta}>
                  {[upNext.appointment_type_name, `${upNext.time_start} (${minutesUntil(upNext.start, now)})`].filter(Boolean).join(' • ')}
                </span>
              </div>
              <Button
                variant="solid"
                onClick={() => openMember({ id: upNext.patient_id, name: upNext.patient_name })}
                disabled={!upNext.patient_id && !upNext.patient_name}
              >
                Open
              </Button>
            </div>
          )}

          <div className={styles.glance}>
            {glance.map(g => (
              <button key={g.key} type="button" className={styles.tile} onClick={g.onClick}>
                <span className={[styles.tileIcon, g.alert ? styles.tileAlert : ''].join(' ')}><Icon name={g.icon} size={24} color="currentColor" /></span>
                <span className={[styles.tileValue, g.alert ? styles.tileValueAlert : ''].join(' ')}>{g.value}</span>
                <span className={styles.tileLabel}>{g.label}</span>
              </button>
            ))}
          </div>

          <HomeSection title="My Worklist" count={worklist.length || null} actionLabel={worklist.length > 5 ? 'See all' : undefined} onAction={() => push('myWorklist')}>
            {worklistLoading && !worklist.length ? <Skeleton width="100%" height={72} radius={12} /> : worklist.length === 0 ? (
              <p className={styles.empty}>No patients are assigned to you</p>
            ) : worklist.slice(0, 5).map(row => (
              <button key={row.key} type="button" className={common.card} onClick={() => openMember({ id: row.patientId, memberId: row.memberId, name: row.name })}>
                <Avatar variant="patient" size="L" initials={row.initials && row.initials !== '??' ? row.initials : initialsOf(row.name)} />
                <span className={common.cardText}>
                  <span className={common.primaryText}>{row.name}</span>
                  <span className={common.secondaryText}>{formatPatientMeta(row)}</span>
                </span>
                {row.myTaskCount > 0 && <Badge tone="neutral" variant="soft" size="sm" label={`${row.myTaskCount} ${row.myTaskCount === 1 ? 'Task' : 'Tasks'}`} />}
              </button>
            ))}
          </HomeSection>

          <HomeSection title="Today's Schedule" count={todays.length || null} actionLabel={canTab('calendar') ? 'Schedule' : undefined} onAction={() => setTab('calendar')}>
            {laterToday.length === 0 ? (
              <p className={styles.empty}>{todays.length ? 'Nothing else today' : 'No appointments today'}</p>
            ) : laterToday.map(a => (
              <button key={a.id} type="button" className={styles.appt} onClick={() => openMember({ id: a.patient_id, name: a.patient_name })}>
                <span className={styles.apptTime}>{a.time_start}</span>
                <span className={common.cardText}>
                  <span className={common.primaryText}>{a.patient_name || 'Appointment'}</span>
                  <span className={common.secondaryText}>{a.appointment_type_name || a.reason_for_visit || 'Visit'}</span>
                </span>
              </button>
            ))}
          </HomeSection>

          <HomeSection title="My Tasks" count={openTasks.length || null} actionLabel="See all" onAction={() => push('tasks', { filter: tasksFilter })}>
            {tasksLoading && !myTasks.length ? <Skeleton width="100%" height={96} radius={12} /> : openTasks.length === 0 ? (
              <p className={styles.empty}>You're all caught up</p>
            ) : openTasks.slice(0, 3).map(t => (
              <TaskRow key={t.id} task={t} onOpenMember={(task) => openMember({ name: task.member })} />
            ))}
          </HomeSection>

          {showTeam && <TeamProgramsSection codes={supervised} onOpen={(label) => push('worklist', { label })} />}

          <QuickNotesSection />
        </div>
        <button type="button" className={common.fab} aria-label="Quick actions" onClick={() => setActionsOpen(true)}>
          <Icon name="solar:add-circle-linear" size={32} color="currentColor" />
        </button>
      </div>

      {actionsOpen && (
        <BottomSheet title="Quick Actions" onClose={() => setActionsOpen(false)}>
          <BottomSheetItem icon="solar:chat-round-line-linear" label="New Message" onClick={() => { setActionsOpen(false); push('pickMember', { purpose: 'message' }); }} />
          <BottomSheetItem icon="solar:phone-calling-linear" label="Make a Call" onClick={() => { setActionsOpen(false); push('dialer'); }} />
          <BottomSheetItem icon="solar:notes-linear" label="Add Quick Note" onClick={() => { setActionsOpen(false); setNoteOpen(true); }} />
        </BottomSheet>
      )}
      {noteOpen && <QuickNoteSheet note={{ text: '' }} onClose={() => setNoteOpen(false)} />}
    </div>
  );
}

function TeamProgramsSection({ codes, onOpen }) {
  const health = useAppStore(s => s.programHealth);
  const loading = useAppStore(s => s.programHealthLoading);
  const missing = useAppStore(s => s.programHealthMissing);
  const fetchProgramHealth = useAppStore(s => s.fetchProgramHealth);
  useEffect(() => { fetchProgramHealth?.(codes); }, [codes, fetchProgramHealth]);

  const rows = useMemo(() => sortProgramHealth(health), [health]);
  if (missing) return null;

  return (
    <HomeSection title="Team Programs">
      {(!health || loading) ? <Skeleton width="100%" height={72} radius={12} /> : rows.length === 0 ? (
        <p className={styles.empty}>No members in your programs yet</p>
      ) : rows.map(p => {
        const attention = p.attentionMembers > 0;
        const worklist = PROGRAM_WORKLIST[p.code];
        return (
          <button key={p.code} type="button" className={common.card} onClick={worklist ? () => onOpen(worklist) : undefined} disabled={!worklist}>
            <span className={styles.code}>{p.code}</span>
            <span className={common.cardText}>
              <span className={common.primaryText}>{PROGRAM_NAMES[p.code] || `${p.code} program`}</span>
              <span className={common.secondaryText}>{p.activeMembers} {p.activeMembers === 1 ? 'member' : 'members'}</span>
            </span>
            <Badge
              size="sm"
              tone={attention ? 'warning' : 'success'}
              label={attention ? `Needs attention · ${p.attentionMembers}` : 'On track'}
            />
          </button>
        );
      })}
    </HomeSection>
  );
}
