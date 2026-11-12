import { isProgramClosed } from '../../data/programStatus';

/* Program time attribution (care management redesign prototype): which
   time-billed program a timer session counts toward, and how far that
   program's monthly minimum is. CCM is the default (the timer's billing
   periods are CCM's); a patient in more than one time-billed program picks. */

// Monthly minutes each time-billed program needs before it bills.
export const TIME_PROGRAM_MINUTES = { CCM: 20, BHI: 20, PCM: 30, RPM: 20 };

/** The patient's open time-billed programs, CCM first; CCM when there are none. */
export function timeProgramsFor(programs = []) {
  const codes = [...new Set(programs.filter(p => !isProgramClosed(p.status)).map(p => p.code))]
    .filter(code => code in TIME_PROGRAM_MINUTES)
    .sort((a, b) => (a === 'CCM' ? -1 : b === 'CCM' ? 1 : a.localeCompare(b)));
  return codes.length ? codes : ['CCM'];
}

/** Seconds already logged to a program in a billing period (older rows without a program are CCM). */
export function loggedSecondsFor(activities = [], periodId, code) {
  return activities
    .filter(a => a.periodId === periodId && (a.programCode || 'CCM') === code && !a.isUnlogged)
    .reduce((n, a) => n + (a.durationSeconds || 0), 0);
}

/** A program's monthly minimum: the period's own for CCM, else the program's. */
export function targetMinutesFor(code, period) {
  if (code === 'CCM' && period?.requiredMinutes) return period.requiredMinutes;
  return TIME_PROGRAM_MINUTES[code] || 20;
}

/** "CCM 12/20 min": logged this month plus the running session, whole minutes. */
export function progressLabel(code, loggedSeconds, sessionSeconds, target) {
  return `${code} ${Math.floor((loggedSeconds + sessionSeconds) / 60)}/${target} min`;
}
