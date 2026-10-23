import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../../../components/Icon/Icon';
import { Avatar } from '../../../../components/Avatar/Avatar';
import { Button } from '../../../../components/Button/Button';
import { ConfirmDialog } from '../../../../components/ConfirmDialog/ConfirmDialog';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { Link } from '../../../../components/Link/Link';
import { Select } from '../../../../components/Select/Select';
import { Textarea } from '../../../../components/Textarea/Textarea';
import { useAppStore } from '../../../../store/useAppStore';
import { formatFoldId } from '../../../../lib/foldId';
import { CCM_ACTIVITY_TYPES, secondsToTime } from '../../data/ccmBillingMock';
import { useCcmTimerDock } from './CcmTimerDockContext';
import { armAlertAudio, formatIdleDuration, inactivitySecondsFor, isInactivityDemoPatient, playAlertChime, useInactivity } from './inactivity';
import { usePatientConsent } from '../../hooks/usePatientConsent';
import { canBill } from '../../data/consentRules';
import styles from './CcmTimerWidget.module.css';

// CCM activity timer (Figma CCM Timer 324:84077), drawn in our timer's own
// style. Two sizes:
//   mini     — the control bar; docked in the banner's tag row by default
//   expanded — a card with the patient, the time large, and the actions
// and these states (Figma variant in brackets):
//   idle        → 00:00, Start Timer                         (Start / Mini Start)
//   running     → green time, Pause · Stop                   (Mini / Expanded)
//   paused      → grey time, Resume · Reset · Log            (Variant8 / Paused)
//   stopped     → grey time, Resume · Log Time               (Stoped)
//   confirm     → "Reset Timer?" over the card               (Variant7)
//   classifying → the log form in the card
//   logged      → brief confirmation, then a fresh session starts
// A banner can sit on top: "Accrued time not billable." when this month's
// period is already billed (error).
//
// Inactivity reminder (story: notify when the timer runs with no activity):
// after the patient's threshold with no mouse, key, scroll or touch activity
// while running, the timer asks "Are you still working on this patient?"
// with Keep Timer Running / Pause Timer and a "Don't remind me again" checkbox
// (Figma Dialog Box 2, 2810:68907). 30 minutes for every patient; 30 seconds
// for the demo patient (inactivity.js). It never pauses on its
// own, stays until answered, and every answer is recorded.
//
// The timer starts itself when a patient profile opens. Leaving the profile
// screen, or switching to another browser tab, pauses it and coming back
// resumes it (as Fold does, VBC-22802):
// each patient's timer is parked on the way out and picked up on return,
// running again only if it was running when they left. Drag the handle to
// move it anywhere; drop it on the tag row to dock it back there.
const DRAG_GHOST_CLASS = 'ccm-timer-dragging';
const LOGGED_FEEDBACK_MS = 1600;
// How far outside the tag row a drop still counts as "in" it.
const DOCK_SLOP = 16;

// Timers parked when their patient's profile was left, by patient id:
// { ms, wasRunning, mode, sessionId, quietSession }. Lives for the page.
const parkedTimers = new Map();

const newSessionId = () => `tms-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function activityId() {
  return `act-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function fixedPosFromRect(rect) {
  return {
    right: Math.max(8, window.innerWidth - rect.right),
    bottom: Math.max(8, window.innerHeight - rect.bottom),
  };
}

/** The tag row the timer docks into, or null when it isn't on screen. */
function dockRowRect(dockEl) {
  const row = dockEl?.closest('[data-ccm-timer-row]') ?? dockEl?.parentElement;
  const rect = row?.getBoundingClientRect();
  return rect && rect.width > 0 && rect.height > 0 ? rect : null;
}

/** Whether a pointer at (x, y) is over the tag row, give or take DOCK_SLOP. */
function overDock(x, y, dockEl) {
  const r = dockRowRect(dockEl);
  return !!r && x >= r.left - DOCK_SLOP && x <= r.right + DOCK_SLOP
    && y >= r.top - DOCK_SLOP && y <= r.bottom + DOCK_SLOP;
}

const initialsOf = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';

/** "MM:SS", with the colon set apart like the design's. */
function TimeText({ seconds, className }) {
  const [m, s] = secondsToTime(seconds).split(':');
  return (
    <span className={className}>
      {m}<span className={styles.colon}>:</span>{s}
    </span>
  );
}

/** The six-dot grip; `horizontal` lays it on its side for the card's top strip. */
function Grip({ horizontal = false }) {
  return (
    <svg width={horizontal ? 14 : 8} height={horizontal ? 8 : 14} viewBox={horizontal ? '0 0 14 8' : '0 0 8 14'} fill="currentColor" aria-hidden="true">
      {horizontal
        ? [2, 7, 12].flatMap(x => [<circle key={`a${x}`} cx={x} cy="2" r="1.3" />, <circle key={`b${x}`} cx={x} cy="6" r="1.3" />])
        : [2, 7, 12].flatMap(y => [<circle key={`a${y}`} cx="2" cy={y} r="1.3" />, <circle key={`b${y}`} cx="6" cy={y} r="1.3" />])}
    </svg>
  );
}

/** A one-line notice that sits on top of the timer (error or info). */
function TimerNotice({ notice, onClose }) {
  if (!notice) return null;
  return (
    <div className={`${styles.notice} ${notice.tone === 'error' ? styles.noticeError : styles.noticeInfo}`} role="status">
      <Icon
        name={notice.tone === 'error' ? 'solar:danger-triangle-linear' : 'solar:info-circle-linear'}
        size={12}
        color={notice.tone === 'error' ? 'var(--status-error)' : 'var(--status-info)'}
      />
      <span className={styles.noticeText}>{notice.text}</span>
      {notice.action && <Link onClick={notice.action.onClick}>{notice.action.label}</Link>}
      {onClose && (
        <button type="button" className={styles.noticeClose} onClick={onClose} aria-label="Dismiss">
          <Icon name="solar:close-linear" size={12} color="currentColor" />
        </button>
      )}
    </div>
  );
}

/**
 * "Are you still working on this patient?" — our ConfirmDialog, inline so it
 * sits above the timer (where the banners go) without blocking the page.
 * Keep Timer Running continues; Pause Timer pauses. "Don't remind me
 * again" is a checkbox that rides along with either answer and quiets
 * reminders for the rest of this session.
 */
function InactivityPrompt({ seconds, onAnswer }) {
  const [quiet, setQuiet] = useState(false);
  return (
    <ConfirmDialog
      inline
      align="start"
      className={styles.prompt}
      variant="primary"
      icon="solar:clock-circle-linear"
      iconColor="var(--neutral-300)"
      title="Are you still working?"
      description={`No activity detected for ${formatIdleDuration(seconds)}. Please confirm to keep the timer running or pause it if you're not working on their profile right now.`}
      confirmLabel="Keep Timer Running"
      cancelLabel="Pause Timer"
      checkbox={{ label: 'Don’t remind me again', checked: quiet, onChange: setQuiet }}
      onConfirm={() => onAnswer('continue', quiet)}
      onCancel={() => onAnswer('pause', quiet)}
    />
  );
}

export function CcmTimerWidget({ patient }) {
  const patientId = useAppStore(s => s.selectedPatientId);
  const periods = useAppStore(s => s.ccmBillingPeriodsByPatient[patientId]);
  const fetchCcmBilling = useAppStore(s => s.fetchCcmBilling);
  const addCcmBillableActivity = useAppStore(s => s.addCcmBillableActivity);
  const logTimerInactivityEvent = useAppStore(s => s.logTimerInactivityEvent);
  const currentPeriod = periods && periods[0];

  const { dockEl, isDocked, setIsDocked, floatPos, setFloatPos } = useCcmTimerDock();

  const [mode, setMode] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [activityType, setActivityType] = useState(CCM_ACTIVITY_TYPES[0]);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [overDockZone, setOverDockZone] = useState(false);
  const [anchor, setAnchor] = useState(null); // docked bar's box, for the card below it
  // A timer session runs from start to log or reset; "Don't remind me again"
  // holds for the session it was chosen in.
  const [sessionId, setSessionId] = useState(newSessionId);
  const [prompt, setPrompt] = useState(null); // { shownAt } while asking
  const [quietSession, setQuietSession] = useState(null);
  const [continuedAt, setContinuedAt] = useState(0);

  const startedAtRef = useRef(null);
  const accumulatedRef = useRef(0);
  const loggedTimeoutRef = useRef(null);
  const autoStartedForRef = useRef(null);
  const barRef = useRef(null);

  const isIdle = mode === 'idle';
  const isRunning = mode === 'running';
  const isPaused = mode === 'paused';
  const isStopped = mode === 'stopped';
  const isLogged = mode === 'logged';
  const isClassifying = mode === 'classifying';
  const isHeld = isPaused || isStopped; // time frozen, waiting for a decision
  // The card shows when asked for, and always for the log form and the reset
  // confirmation, which don't fit in the bar.
  const showCard = expanded || isClassifying || confirmReset;

  // No CCM consent: time keeps running but can't be logged until it's
  // captured. Off while the consent table doesn't exist yet (pre-migration).
  const { consents, loaded: consentLoaded } = usePatientConsent(patientId);
  const consentTableMissing = useAppStore(s => s.patientConsentTableMissing);
  const openConsentCapture = useAppStore(s => s.openConsentCapture);
  const consentGate = consentLoaded && !consentTableMissing ? canBill(consents, 'CCM') : { allowed: true };
  // This month is already billed, so time added now can't be.
  const notice = !consentGate.allowed
    ? {
      tone: 'error',
      text: `${consentGate.reason}. Time can't be logged.`,
      action: { label: 'Capture', onClick: () => openConsentCapture(patientId, { scopeType: 'program', scope: 'CCM' }) },
    }
    : currentPeriod?.billStatus === 'sent' && !noticeDismissed
      ? { tone: 'error', text: 'Accrued time not billable.' }
      : null;

  useEffect(() => {
    if (!patientId) return;
    if (periods == null) fetchCcmBilling(patientId);
  }, [patientId, periods, fetchCcmBilling]);

  // A new patient starts docked, small, with nothing pending. The inactivity
  // demo patient starts floating in the bottom-right corner instead, where
  // the reminder has room above it (it can still be dragged and docked).
  useEffect(() => {
    const floats = isInactivityDemoPatient(patientId);
    setIsDocked(!floats);
    if (floats) setFloatPos({ right: 16, bottom: 16 });
  }, [patientId, setIsDocked, setFloatPos]);
  const [shownFor, setShownFor] = useState(patientId);
  if (shownFor !== patientId) {
    setShownFor(patientId);
    setExpanded(false);
    setConfirmReset(false);
    setNoticeDismissed(false);
    setPrompt(null);
    setQuietSession(null);
    setSessionId(newSessionId());
  }

  // startTick / stopTick only do the time maths (when this run started, and
  // what earlier runs added up to). The display ticks from the effect below,
  // which follows `mode`, so a remount can never leave a running timer frozen.
  const stopTick = useCallback(() => {
    if (startedAtRef.current != null) {
      accumulatedRef.current += performance.now() - startedAtRef.current;
      startedAtRef.current = null;
    }
  }, []);

  const startTick = useCallback(() => {
    if (startedAtRef.current == null) startedAtRef.current = performance.now();
  }, []);

  useEffect(() => {
    if (mode !== 'running') return undefined;
    let frame;
    const loop = () => {
      if (startedAtRef.current != null) {
        setElapsed(Math.floor((accumulatedRef.current + (performance.now() - startedAtRef.current)) / 1000));
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [mode]);

  const restartTimer = useCallback(() => {
    stopTick();
    accumulatedRef.current = 0;
    setElapsed(0);
    setDescription('');
    setActivityType(CCM_ACTIVITY_TYPES[0]);
    setSessionId(newSessionId());
    setPrompt(null);
    startTick();
    setMode('running');
  }, [startTick, stopTick]);

  const resetTimer = useCallback(() => {
    stopTick();
    accumulatedRef.current = 0;
    setElapsed(0);
    setSessionId(newSessionId());
    setPrompt(null);
    setMode('idle');
  }, [stopTick]);

  // Opening a profile: pick its parked timer back up (the time it had, its
  // session, running again only if it was running when the profile was
  // left), or start a fresh one.
  const openTimerFor = useCallback((pid) => {
    const saved = parkedTimers.get(String(pid));
    parkedTimers.delete(String(pid));
    if (!saved) { restartTimer(); return; }
    stopTick();
    accumulatedRef.current = saved.ms;
    setElapsed(Math.floor(saved.ms / 1000));
    setSessionId(saved.sessionId);
    setQuietSession(saved.quietSession);
    setPrompt(null);
    if (saved.wasRunning) {
      startTick();
      setMode('running');
    } else {
      setMode(saved.mode);
    }
  }, [restartTimer, startTick, stopTick]);

  useEffect(() => {
    if (!patientId || !currentPeriod) return;
    const key = `${patientId}:${currentPeriod.id}`;
    if (autoStartedForRef.current === key) return;
    autoStartedForRef.current = key;
    openTimerFor(patientId);
  }, [patientId, currentPeriod, openTimerFor]);

  // The latest timer state, for parking it when the profile is left (the
  // cleanup below runs after this render's state is gone).
  const liveRef = useRef(null);
  useEffect(() => { liveRef.current = { mode, sessionId, quietSession }; });
  // Set while the timer is paused only because the browser tab is hidden.
  const hiddenPausedRef = useRef(false);

  // Leaving this patient's profile (another patient, or another screen)
  // parks the timer, paused, with the time it had.
  useEffect(() => {
    const pid = String(patientId);
    return () => {
      const live = liveRef.current;
      if (!patientId || !live || live.mode === 'idle' || live.mode === 'logged') {
        parkedTimers.delete(pid);
        return;
      }
      // Snapshot only. Opening the next patient restarts the clock's maths;
      // stopping it here would freeze a timer that React remounts in place
      // (StrictMode).
      const running = startedAtRef.current != null;
      const ms = accumulatedRef.current + (running ? performance.now() - startedAtRef.current : 0);
      parkedTimers.set(pid, {
        ms,
        // Paused only by a hidden tab still counts as running.
        wasRunning: running || hiddenPausedRef.current,
        // Mid-log, it comes back stopped with the time intact.
        mode: live.mode === 'classifying' ? 'stopped' : live.mode,
        sessionId: live.sessionId,
        quietSession: live.quietSession,
      });
    };
  }, [patientId]);

  // Switching to another browser tab (or minimising the window) pauses the
  // timer too, and coming back resumes it, but only if it was running when
  // the tab was hidden: a timer the user paused stays paused. An open
  // inactivity reminder stays up; its count restarts when the timer resumes.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        if (liveRef.current?.mode === 'running') {
          hiddenPausedRef.current = true;
          stopTick();
          setMode('paused');
        }
      } else if (hiddenPausedRef.current) {
        hiddenPausedRef.current = false;
        startTick();
        setMode('running');
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [startTick, stopTick]);

  useEffect(() => () => clearTimeout(loggedTimeoutRef.current), []);

  // ── Actions ──────────────────────────────────────────────────────────
  const start = () => { startTick(); setMode('running'); };
  const pause = () => { stopTick(); setPrompt(null); setMode('paused'); };
  const stop = () => { stopTick(); setPrompt(null); setMode('stopped'); };
  const resume = () => { startTick(); setMode('running'); };
  const askReset = () => setConfirmReset(true);
  const discard = () => { setConfirmReset(false); resetTimer(); };
  const openLog = () => { stopTick(); setConfirmReset(false); setPrompt(null); setMode('classifying'); };

  // ── Inactivity reminder ──────────────────────────────────────────────
  const idleSeconds = inactivitySecondsFor(patientId);
  // Ready the alert sound on the first click, for Safari (see armAlertAudio).
  useEffect(() => { if (idleSeconds) armAlertAudio(); }, [idleSeconds]);
  useInactivity({
    enabled: !!idleSeconds && isRunning && !prompt && quietSession !== sessionId,
    seconds: idleSeconds,
    resetKey: continuedAt,
    onIdle: () => {
      setPrompt({ shownAt: new Date().toISOString() });
      playAlertChime(); // once, as it appears
    },
  });
  // `action` is continue | pause; `dontRemind` is the checkbox.
  const answerPrompt = (action, dontRemind) => {
    logTimerInactivityEvent?.({
      sessionId,
      patientId,
      thresholdSeconds: idleSeconds,
      elapsedSeconds: elapsed,
      shownAt: prompt?.shownAt,
      respondedAt: new Date().toISOString(),
      action,
      dontRemind,
    });
    setPrompt(null);
    if (dontRemind) setQuietSession(sessionId);
    if (action === 'continue') setContinuedAt(Date.now());
    if (action === 'pause') pause();
  };
  const promptEl = prompt && <InactivityPrompt seconds={idleSeconds} onAnswer={answerPrompt} />;
  const cancelLog = () => {
    if (elapsed > 0) setMode('stopped');
    else resetTimer();
  };

  const persist = async () => {
    if (!currentPeriod || elapsed <= 0) {
      resetTimer();
      return;
    }
    setSaving(true);
    let result;
    try {
      result = await addCcmBillableActivity({
        id: activityId(),
        periodId: currentPeriod.id,
        patientId,
        activityType,
        description: description.trim(),
        durationSeconds: elapsed,
        loggedBy: 'You',
        loggedByInitials: 'Y',
        occurredAt: new Date().toISOString(),
        isUnlogged: false,
      });
    } finally {
      setSaving(false);
    }
    // Blocked by the consent gate: keep the form and the time.
    if (result?.blocked) return;
    stopTick();
    setMode('logged');
    clearTimeout(loggedTimeoutRef.current);
    loggedTimeoutRef.current = setTimeout(() => {
      restartTimer();
    }, LOGGED_FEEDBACK_MS);
  };

  // ── Card placement while docked: in the bar's place, right-aligned. ──
  const docked = isDocked && !!dockEl;
  useLayoutEffect(() => {
    if (!docked || !showCard) return undefined;
    const place = () => {
      const r = barRef.current?.getBoundingClientRect();
      // The card grows out of the bar, from its top-right corner.
      if (r) setAnchor({ top: r.top, right: Math.max(8, window.innerWidth - r.right) });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [docked, showCard]);

  // ── Reminder placement: always fully on screen. ──────────────────────
  // It sits on its own layer, above the timer if there's room (else below),
  // lined up with the timer's right edge when it fits to the left, else with
  // its left edge, and is nudged inside the window either way. Re-placed as
  // the timer moves, expands or the window changes.
  const cardRef = useRef(null);
  const promptRef = useRef(null);
  const [promptPos, setPromptPos] = useState(null);
  useLayoutEffect(() => {
    if (!prompt) return undefined;
    const place = () => {
      const surface = (showCard ? cardRef.current : barRef.current)?.getBoundingClientRect();
      const box = promptRef.current?.getBoundingClientRect();
      if (!surface || !box) return;
      const EDGE = 8;
      const GAP = 8;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const rightAligned = surface.right - box.width;
      let left = rightAligned >= EDGE ? rightAligned : surface.left;
      left = Math.min(Math.max(EDGE, left), vw - box.width - EDGE);
      let top = surface.top - GAP - box.height;
      if (top < EDGE) top = surface.bottom + GAP;
      top = Math.min(Math.max(EDGE, top), vh - box.height - EDGE);
      setPromptPos({ top, left });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [prompt, showCard, docked, floatPos.right, floatPos.bottom]);

  // ── Drag: move anywhere; dropping on the tag row docks it there. ─────
  const onDragPointerDown = (e) => {
    e.preventDefault();
    const handle = e.currentTarget;
    const { pointerId } = e;
    try { handle.setPointerCapture(pointerId); } catch { /* ignore */ }

    // Start from wherever the dragged surface is now (the bar, or the card).
    const surface = handle.closest('[data-ccm-timer-surface]');
    const rect = surface?.getBoundingClientRect();
    const startPos = rect ? fixedPosFromRect(rect) : floatPos;
    setIsDocked(false);
    setFloatPos(startPos);

    const startX = e.clientX;
    const startY = e.clientY;
    setIsDragging(true);
    document.body.classList.add(DRAG_GHOST_CLASS);

    const onMove = (ev) => {
      if (ev.pointerId !== pointerId) return;
      setFloatPos({
        right: Math.max(8, startPos.right - (ev.clientX - startX)),
        bottom: Math.max(8, startPos.bottom - (ev.clientY - startY)),
      });
      setOverDockZone(overDock(ev.clientX, ev.clientY, dockEl));
    };
    const onUp = (ev) => {
      if (ev.pointerId !== pointerId) return;
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      try { handle.releasePointerCapture(pointerId); } catch { /* ignore */ }
      setIsDragging(false);
      setOverDockZone(false);
      document.body.classList.remove(DRAG_GHOST_CLASS);
      if (overDock(ev.clientX, ev.clientY, dockEl)) setIsDocked(true);
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  };

  // Show where a drop would land: the tag row lights up while dragging over it.
  useEffect(() => {
    const row = dockEl?.closest('[data-ccm-timer-row]');
    if (!row) return undefined;
    row.toggleAttribute('data-ccm-drop-target', overDockZone);
    return () => row.removeAttribute('data-ccm-drop-target');
  }, [dockEl, overDockZone]);

  if (!currentPeriod) return null;

  const timeTone = isRunning ? styles.timeRunning : styles.timeHeld;
  const name = patient?.name || 'Patient';

  // ── Mini: the control bar ────────────────────────────────────────────
  const bar = (
    <div
      ref={barRef}
      className={[styles.control, docked ? styles.controlDocked : '', docked && showCard ? styles.controlExpanded : ''].filter(Boolean).join(' ')}
      data-ccm-timer-surface
      inert={docked && showCard}
    >
      <button type="button" className={styles.dragHandle} onPointerDown={onDragPointerDown} aria-label="Drag timer" title="Drag to move; drop on the tag row to dock">
        <Grip />
      </button>

      <div className={styles.chipWrap}>
        <span className={`${styles.chip} ${isRunning ? styles.chipActive : isIdle ? styles.chipIdle : styles.chipHeld}`}>
          {isRunning && <span className={styles.chipDot} aria-hidden="true" />}
          {isHeld && <Icon name={isPaused ? 'solar:pause-circle-linear' : 'solar:stop-circle-linear'} size={14} color="var(--neutral-200)" />}
          {isIdle && <Icon name="solar:stopwatch-linear" size={14} color="var(--neutral-300)" />}
          {isLogged
            ? <><Icon name="solar:check-circle-linear" size={14} color="var(--status-success)" /><span className={styles.loggedLabel}>Logged</span></>
            : <TimeText seconds={elapsed} className={`${styles.chipTime} ${isRunning ? styles.chipTimeActive : styles.chipTimeIdle}`} />}
        </span>
      </div>

      {isIdle && (
        <button type="button" className={styles.segmentBtn} onClick={start}>
          <span className={`${styles.segmentLabel} ${styles.segmentStart}`}>Start Timer</span>
        </button>
      )}
      {isRunning && (
        <>
          <button type="button" className={styles.segmentBtn} onClick={pause}>
            <span className={`${styles.segmentLabel} ${styles.segmentPause}`}>Pause</span>
          </button>
          <button type="button" className={styles.segmentBtn} onClick={stop}>
            <span className={`${styles.segmentLabel} ${styles.segmentStop}`}>Stop</span>
          </button>
        </>
      )}
      {(isHeld || isClassifying) && (
        <>
          <button type="button" className={styles.segmentBtn} onClick={resume} disabled={isClassifying}>
            <span className={`${styles.segmentLabel} ${styles.segmentResume}`}>Resume</span>
          </button>
          <button type="button" className={styles.segmentBtn} onClick={askReset} disabled={isClassifying}>
            <span className={`${styles.segmentLabel} ${styles.segmentPause}`}>Reset</span>
          </button>
          <button type="button" className={styles.segmentBtn} onClick={openLog} disabled={isClassifying}>
            <span className={`${styles.segmentLabel} ${styles.segmentStart}`}>Log</span>
          </button>
        </>
      )}

      {/* Docked, the tag row has no room for the banner: a mark stands in
          for it, and the banner shows on the card. */}
      {docked && notice && !showCard && (
        <span className={styles.noticeMark} title={notice.text} aria-label={notice.text} role="img">
          <Icon name="solar:danger-triangle-linear" size={14} color="var(--status-error)" />
        </span>
      )}
      <button
        type="button"
        className={styles.expandBtn}
        onClick={() => setExpanded(v => !v)}
        aria-label={showCard ? 'Collapse timer' : 'Expand timer'}
        title={showCard ? 'Collapse' : 'Expand'}
        aria-expanded={showCard}
      >
        <Icon name={showCard ? 'solar:minimize-square-linear' : 'solar:maximize-square-linear'} size={14} color="currentColor" />
      </button>
    </div>
  );

  // ── Expanded: the card ───────────────────────────────────────────────
  const cardBody = (() => {
    if (confirmReset) {
      return (
        <div className={styles.confirm}>
          <span className={styles.confirmTitle}>Reset Timer?</span>
          <p className={styles.confirmText}>
            This permanently removes <strong>{secondsToTime(elapsed)}</strong> of unlogged time. This can&apos;t be undone.
          </p>
          <div className={styles.confirmActions}>
            <Button variant="secondary" size="L" onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button variant="danger" size="L" onClick={discard}>Discard</Button>
          </div>
        </div>
      );
    }
    if (isClassifying) {
      return (
        <div className={styles.form}>
          <span className={styles.formTitle}>Log {secondsToTime(elapsed)}</span>
          <Select
            label="Activity"
            options={CCM_ACTIVITY_TYPES.map(t => ({ value: t, label: t }))}
            value={activityType}
            onChange={setActivityType}
          />
          <Textarea
            placeholder="What did you work on?"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
          />
          <div className={styles.formActions}>
            <Button variant="secondary" size="S" onClick={cancelLog} disabled={saving}>Cancel</Button>
            <Button variant="primary" size="S" onClick={persist} disabled={saving || elapsed === 0 || !consentGate.allowed}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      );
    }
    const timeIcon = isRunning || isIdle ? 'solar:stopwatch-linear' : isPaused ? 'solar:pause-circle-linear' : 'solar:stop-circle-linear';
    return (
      <div className={styles.cardBody}>
        <div className={styles.cardTime}>
          <span className={styles.cardLabel}>Activity Timer</span>
          <span className={`${styles.bigTime} ${timeTone}`}>
            {isLogged
              ? <><Icon name="solar:check-circle-linear" size={20} color="var(--status-success)" /><span className={styles.loggedBig}>Logged</span></>
              : <><Icon name={timeIcon} size={20} color="currentColor" /><TimeText seconds={elapsed} /></>}
          </span>
          {isHeld && (
            <Link variant="secondary" className={styles.resetLink} onClick={askReset}>
              <Icon name="solar:restart-linear" size={12} color="currentColor" />
              Reset
            </Link>
          )}
        </div>
        <div className={styles.cardActions}>
          {isIdle && <Button variant="alt" size="L" onClick={start}>Start Timer</Button>}
          {isRunning && (
            <>
              <Button variant="secondary" size="L" onClick={pause}>Pause</Button>
              <Button variant="danger" size="L" onClick={openLog}>Stop &amp; Log</Button>
            </>
          )}
          {isPaused && (
            <>
              <Button variant="success" size="L" onClick={resume}>Resume</Button>
              <Button variant="danger" size="L" onClick={openLog}>Stop &amp; Log</Button>
            </>
          )}
          {isStopped && (
            <>
              <Button variant="success" size="L" onClick={resume}>Resume</Button>
              <Button variant="primary" size="L" onClick={openLog}>Log Time</Button>
            </>
          )}
        </div>
      </div>
    );
  })();

  const card = (
    <div ref={cardRef} className={styles.card} data-ccm-timer-surface>
      <button type="button" className={styles.cardGrip} onPointerDown={onDragPointerDown} aria-label="Drag timer" title="Drag to move; drop on the tag row to dock">
        <Grip horizontal />
      </button>
      <div className={styles.cardHead}>
        <Avatar type="initial" variant="patient" size="M" initials={initialsOf(name)} />
        <span className={styles.cardWho}>
          <span className={styles.cardName}>{name}</span>
          {patient?.memberId != null && <span className={styles.cardId}>{formatFoldId(patient.memberId)}</span>}
        </span>
        <ActionButton icon="solar:history-linear" size="S" tooltip="Time Log" />
        <span className={styles.headDivider} aria-hidden="true" />
        <ActionButton
          icon="solar:minimize-square-linear"
          size="S"
          tooltip="Collapse"
          tooltipLeft
          onClick={() => { setExpanded(false); setConfirmReset(false); if (isClassifying) cancelLog(); }}
        />
      </div>
      {cardBody}
    </div>
  );

  // The reminder, on its own layer (placed by the effect above; hidden for
  // the first measure so it never flashes in the wrong spot).
  const promptLayer = prompt && createPortal(
    <div
      ref={promptRef}
      className={styles.promptLayer}
      style={promptPos ? { top: promptPos.top, left: promptPos.left } : { top: 0, left: 0, visibility: 'hidden' }}
    >
      {promptEl}
    </div>,
    document.body,
  );

  // Floating: the card replaces the bar in place. Docked: the bar stays in
  // the tag row and the card opens under it.
  const floatingStyle = { right: floatPos.right, bottom: floatPos.bottom };
  const wrapClass = [styles.wrap, !isDragging ? styles.wrapAnimated : '', isDragging ? styles.wrapDragging : ''].filter(Boolean).join(' ');

  if (docked) {
    return (
      <>
        {createPortal(
          <div className={styles.dockHost}>{bar}</div>,
          dockEl,
        )}
        {/* Expanding turns the bar into the card in place (the bar keeps
            its spot in the tag row, hidden). */}
        {showCard && anchor && createPortal(
          <div className={`${styles.dockedCard} ${styles.dockedCardExpanded}`} style={{ top: anchor.top, right: anchor.right }}>
            <TimerNotice notice={notice} onClose={consentGate.allowed ? () => setNoticeDismissed(true) : undefined} />
            {card}
          </div>,
          document.body,
        )}
        {promptLayer}
      </>
    );
  }

  return (
    <div className={wrapClass} style={floatingStyle}>
      {promptLayer}
      <TimerNotice notice={notice} onClose={consentGate.allowed ? () => setNoticeDismissed(true) : undefined} />
      {showCard ? card : bar}
    </div>
  );
}
