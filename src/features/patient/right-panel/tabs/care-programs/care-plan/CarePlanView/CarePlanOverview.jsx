import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Icon } from '@/components/Icon/Icon';
import { Badge } from '@/components/Badge/Badge';
import { Button } from '@/components/Button/Button';
import { ActionButton } from '@/components/ActionButton/ActionButton';
import { Toggle } from '@/components/Toggle/Toggle';
import { Textarea } from '@/components/Textarea/Textarea';
import { Checkbox } from '@/components/ShadcnCheckbox/ShadcnCheckbox';
import { collectLinks, collectMentions } from '@/components/Textarea/mentions';
import { AiSummarySkeleton } from '../summary/CarePlanAiSummary/CarePlanAiSummary';
import { actionText, buildSummaryPayload, useCarePlanAiSummary } from '../summary/CarePlanAiSummary/useCarePlanAiSummary';
import { NOTE_ACTIONS } from '../lib/carePlanVersions';
import { fmtCarePlanDate } from '../tables/carePlanTableModel';
import { EventUpdatesList } from './EventUpdatesList';
import { useEventUpdates } from './useEventUpdates';
import { ReviewCadencePanel } from './ReviewCadencePanel';
import { useReviewCadence } from './useReviewCadence';
import { sanitizeRichText } from '@/lib/sanitizeHtml';
import styles from './CarePlanOverview.module.css';

const NOUN = { goal: 'goal', intervention: 'intervention', barrier: 'barrier' };
const stamp = iso => (iso
  ? new Date(iso).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  : '');
// The editor's starting value for a saved note: its HTML, else its text.
const noteHtml = (note) => {
  if (!note) return '';
  if (note.meta?.html) return note.meta.html;
  const div = document.createElement('div');
  div.textContent = note.detail || '';
  return div.innerHTML.replace(/\n/g, '<br>');
};

// A tab with nothing to show yet: one row in the tab's box.
function TabEmpty({ icon, title, text, action }) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}><Icon name={icon} size={16} color="currentColor" /></span>
      <span className={styles.emptyText}>
        <span className={styles.emptyTitle}>{title}</span>
        <span>{text}</span>
      </span>
      {action}
    </div>
  );
}

// Plans already summarized this session: the summary is written once per
// visit at most, and a failed run (no AI key, AI busy) isn't retried on its own.
const autoTried = new Set();

/**
 * The top of a program's care plan (Figma P360 Revamp 8340:295397): one card
 * with a segmented toggle, Care Plan Note, Summarize with Unity, Events
 * Updates and Review Cadence, and the selected one under it.
 *
 * Care Plan Note is the note box itself: "@" tags someone, "/" links a goal,
 * intervention or barrier, and saving adds a note (notes are live, outside
 * the signed snapshot). Opening the plan writes the AI summary when there is
 * none, or when the plan changed after it was written, and shows it once
 * written; each action opens the item it names and can be ticked off.
 */
export function CarePlanOverview({
  patientId, program, patientName, live, audit, stats, showSummary = true, showEvents = true, showCadence = true, canEdit,
  latestPlanNote, mentionUsers, linkItems, onOpenNoteHistory, onDeleteNote, onOpenItem,
}) {
  const programId = program?.id;
  const key = `${patientId}::${programId}`;
  const entry = useAppStore(s => s.programCarePlanSummaries[key]);
  const loaded = useAppStore(s => !!s.programCarePlanSummaryLoadedFor[key]);
  const fetchSummary = useAppStore(s => s.fetchProgramCarePlanSummary);
  const saveSummary = useAppStore(s => s.saveProgramCarePlanSummary);
  const deleteSummary = useAppStore(s => s.deleteProgramCarePlanSummary);
  const setDone = useAppStore(s => s.setProgramCarePlanSummaryDone);
  const addCarePlanNote = useAppStore(s => s.addCarePlanNote);
  const [tab, setTab] = useState('note');

  useEffect(() => {
    if (patientId && programId) fetchSummary(patientId, programId);
  }, [patientId, programId, fetchSummary]);

  // ── Care Plan Note ──
  const savedHtml = noteHtml(latestPlanNote);
  const [draft, setDraft] = useState(savedHtml);
  const [draftPlain, setDraftPlain] = useState(latestPlanNote?.detail || '');
  // Read-only until clicked; Enter saves and Escape cancels, back to read-only.
  const [editing, setEditing] = useState(false);
  // A newer saved note (saved here or in the note drawer) re-seeds the box.
  const [seededFor, setSeededFor] = useState(latestPlanNote?.id);
  if (seededFor !== latestPlanNote?.id) {
    setSeededFor(latestPlanNote?.id);
    setDraft(savedHtml);
    setDraftPlain(latestPlanNote?.detail || '');
  }
  const startEditing = () => {
    if (!canEdit) return;
    setDraft(savedHtml);
    setDraftPlain(latestPlanNote?.detail || '');
    setEditing(true);
  };
  const stopEditing = () => {
    setDraft(savedHtml);
    setDraftPlain(latestPlanNote?.detail || '');
    setEditing(false);
  };
  const saveNote = () => {
    const body = draftPlain.trim();
    // Nothing typed, or nothing changed: just close the box.
    if (!body || draft === savedHtml) { stopEditing(); return; }
    // Tags and links are read back from the HTML, so a deleted chip isn't counted.
    const root = new DOMParser().parseFromString(draft, 'text/html').body;
    setEditing(false);
    addCarePlanNote(patientId, program, body, {
      details: { html: draft, mentions: collectMentions(root), links: collectLinks(root) },
    });
  };
  // The box opens with the caret after the text: a stable ref callback (so
  // typing doesn't move the caret), run a frame later, once the Textarea has
  // written the saved note into the box.
  const focusAtEnd = useCallback((el) => {
    if (!el) return;
    requestAnimationFrame(() => {
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    });
  }, []);

  // ── Events Updates ──
  const events = useEventUpdates({ patientId, program, live });
  const eventsOn = showEvents && !events.missing;

  // ── Summarize with Unity ──
  const goals = live?.goals || [];
  const interventions = live?.interventions || [];
  const barriers = live?.barriers || [];
  const isEmpty = goals.length + interventions.length + barriers.length === 0;
  const summary = useCarePlanAiSummary({
    saved: entry?.summary || null,
    onSave: next => saveSummary(patientId, programId, next),
    onDelete: () => deleteSummary(patientId, programId),
    buildPayload: () => buildSummaryPayload({
      patientName, programs: [program], conditions: live?.plan?.conditions || [], goals, interventions, barriers,
    }),
    isEmpty,
  });
  // The plan's last change, notes aside (they don't change what needs doing).
  const changedAt = useMemo(() => (audit || [])
    .filter(a => !NOTE_ACTIONS.has(a.action) && a.action !== 'note_linked')
    .reduce((max, a) => Math.max(max, a.createdAt ? new Date(a.createdAt).getTime() : 0), 0), [audit]);
  const stale = !!entry?.generatedAt && changedAt > new Date(entry.generatedAt).getTime();

  useEffect(() => {
    if (!showSummary || !loaded || !canEdit || isEmpty || autoTried.has(key)) return;
    if (entry?.summary && !stale) return;
    autoTried.add(key);
    // Shows the new summary; a failed run leaves the tab where it was.
    summary.autoGenerate().then(ok => { if (ok) setTab('summary'); });
  }, [showSummary, loaded, canEdit, isEmpty, key, entry?.summary, stale]); // eslint-disable-line react-hooks/exhaustive-deps

  const data = entry?.summary || null;
  const actions = data?.actions || [];
  const done = new Set(data?.done || []);
  const toggleDone = (i) => {
    const next = new Set(done);
    if (next.has(i)) next.delete(i); else next.add(i);
    setDone(patientId, programId, [...next].sort((a, b) => a - b));
  };
  const itemFor = (a) => {
    const list = { goal: goals, intervention: interventions, barrier: barriers }[a?.refType];
    return list?.find(it => String(it.id) === String(a.refId)) || null;
  };

  // A dot on a tab with something to review: summary actions not ticked off,
  // events with changes to decide, a review that's due or overdue.
  const cadence = useReviewCadence({ patientId, program, plan: live?.plan });
  const cadenceDue = ['due', 'overdue'].includes(cadence?.status?.state);
  const tabs = [
    { key: 'note', label: 'Care Plan Note', leadingIcon: 'solar:notes-linear' },
    showSummary && {
      key: 'summary', label: 'Summarize with Unity', leadingIcon: 'custom:ai',
      notif: summary.state === 'ready' && actions.some((_, i) => !done.has(i)),
    },
    eventsOn && { key: 'events', label: 'Events Updates', leadingIcon: 'solar:bolt-linear', notif: events.count > 0 },
    showCadence && {
      key: 'cadence', label: 'Review Cadence', leadingIcon: 'solar:calendar-minimalistic-linear', notif: cadenceDue,
    },
  ].filter(Boolean);
  const active = tabs.some(t => t.key === tab) ? tab : 'note';

  return (
    <section className={styles.card} aria-label="Care plan overview">
      <Toggle items={tabs} value={active} onValueChange={setTab} variant="ghost" />

      {active === 'note' && (
        editing ? (
          <div
            className={styles.note}
            // Leaving an untouched box closes it; an edit stays open until Enter or Esc.
            onBlur={(e) => { if (draft === savedHtml && !e.currentTarget.contains(e.relatedTarget)) stopEditing(); }}
          >
            <Textarea
              ref={focusAtEnd}
              richText
              mentions
              mentionUsers={mentionUsers}
              links={linkItems}
              rows={3}
              className={styles.noteBox}
              toolbarOnFocus
              value={draft}
              onValueChange={(html, plain) => { setDraft(html); setDraftPlain(plain || ''); }}
              onEnter={saveNote}
              onEscape={stopEditing}
              placeholder="Add Note also you can use “/” for GBI or “@” for user to tag"
              aria-label="Care plan note"
            />
            <span className={styles.noteHint}>Enter to save • Shift + Enter for a new line • Esc to cancel</span>
          </div>
        ) : (
          <div
            className={`${styles.box} ${styles.noteRead} ${canEdit ? styles.noteReadEditable : ''}`}
            role={canEdit ? 'button' : undefined}
            tabIndex={canEdit ? 0 : undefined}
            aria-label={canEdit ? (latestPlanNote ? 'Edit care plan note' : 'Add a care plan note') : undefined}
            onClick={startEditing}
            onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); startEditing(); } }}
          >
            {latestPlanNote ? (
              <>
                {latestPlanNote.meta?.html
                  ? <div className={styles.noteBody} dangerouslySetInnerHTML={{ __html: sanitizeRichText(latestPlanNote.meta.html) }} />
                  : <p className={styles.noteBody}>{latestPlanNote.detail}</p>}
                <div className={styles.noteMetaRow}>
                  <span className={styles.noteMeta}>{latestPlanNote.actor || 'Unknown'} • {stamp(latestPlanNote.createdAt)}</span>
                  {/* Hover tools: clicks here don't open the editor. */}
                  <span className={styles.noteTools} onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                    <ActionButton icon="solar:history-linear" size="sm" tooltip="Note history" onClick={onOpenNoteHistory} />
                    {canEdit && <ActionButton icon="solar:trash-bin-trash-linear" size="sm" tooltip="Delete note" onClick={onDeleteNote} />}
                  </span>
                </div>
              </>
            ) : (
              <p className={styles.notePlaceholder}>
                {canEdit ? 'Add Note also you can use “/” for GBI or “@” for user to tag' : 'No care plan note yet.'}
              </p>
            )}
          </div>
        )
      )}

      {active === 'summary' && (
        <div className={styles.box}>
          {stats && (
            <div className={styles.stats}>
              <span className={styles.metric}><strong>{stats.goals}</strong> goals</span>
              <span className={styles.dot} aria-hidden="true" />
              <span className={styles.metric}><strong>{stats.iv}</strong> interventions</span>
              <span className={styles.dot} aria-hidden="true" />
              <span className={styles.metric}><strong>{stats.br}</strong> barriers</span>
              <span className={styles.dot} aria-hidden="true" />
              <span className={styles.metric}><strong>{stats.avgProgress}%</strong> avg progress</span>
              {stats.nextTouchpoint && (
                <>
                  <span className={styles.dot} aria-hidden="true" />
                  <span className={styles.metric}>Next touchpoint <strong>{fmtCarePlanDate(stats.nextTouchpoint)}</strong></span>
                </>
              )}
              {stats.statuses?.length > 0 && (
                <span className={styles.statuses}>
                  {stats.statuses.map(({ status, count, tone }) => (
                    <Badge key={status} tone={tone} size="sm" label={`${count} ${status}`} />
                  ))}
                </span>
              )}
            </div>
          )}
          {summary.state === 'loading' && <AiSummarySkeleton />}
          {summary.state === 'idle' && (
            <TabEmpty
              icon="custom:ai"
              title={summary.error ? 'Unity couldn\'t write the summary' : 'No summary yet'}
              text={summary.error || 'Unity reads the goals, interventions and barriers and lists what needs doing next.'}
              action={canEdit && !isEmpty && (
                <Button variant="soft" size="sm" leadingIcon="custom:ai" onClick={summary.generate}>
                  {summary.error ? 'Try Again' : 'Summarize'}
                </Button>
              )}
            />
          )}
          {summary.state === 'ready' && data && (
            <div className={styles.summary}>
              <div className={styles.summaryHead}>
                {entry?.generatedAt && (
                  <span className={styles.stamp}>Updated {stamp(entry.generatedAt)}{entry.generatedBy ? ` by ${entry.generatedBy}` : ''}</span>
                )}
                {stale && <Badge size="sm" tone="warning" label="Plan changed since" />}
                <span className={styles.spacer} />
                <ActionButton icon="solar:copy-linear" size="sm" tooltip="Copy summary" onClick={summary.copy} />
                <ActionButton icon="solar:refresh-linear" size="sm" tooltip="Write it again" onClick={summary.regenerate} />
                <ActionButton icon="solar:trash-bin-trash-linear" size="sm" tooltip="Dismiss summary" onClick={summary.clear} />
              </div>
              {data.intro && <p className={styles.intro}>{data.intro}</p>}
              {data.points?.length > 0 && (
                <ul className={styles.points}>
                  {data.points.map((p, i) => <li key={i}><strong>{p.title}:</strong> {p.body}</li>)}
                </ul>
              )}
              {actions.length > 0 && (
                <div className={styles.actions}>
                  <span className={styles.actionsHead}>Action items</span>
                  <ul className={styles.actionList}>
                    {actions.map((a, i) => {
                      const item = itemFor(a);
                      const isDone = done.has(i);
                      return (
                        <li key={i} className={`${styles.action} ${isDone ? styles.actionDone : ''}`}>
                          <Checkbox
                            checked={isDone}
                            onCheckedChange={() => toggleDone(i)}
                            disabled={!canEdit}
                            aria-label={isDone ? 'Mark not done' : 'Mark done'}
                          />
                          <span className={styles.actionText}>{actionText(a)}</span>
                          {item && (
                            <Button
                              variant="ghost"
                              tone="primary"
                              size="sm"
                              trailingIcon="solar:arrow-right-up-linear"
                              onClick={() => onOpenItem(a.refType, item)}
                            >
                              Open {NOUN[a.refType]}
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {active === 'events' && (
        events.pending.length > 0 ? (
          <div className={`${styles.box} ${styles.eventsBox}`}>
            <EventUpdatesList updates={events} canEdit={canEdit} />
          </div>
        ) : (
          <div className={styles.box}>
            <TabEmpty
              icon="solar:bolt-linear"
              title={events.evaluating ? 'Checking new events…' : 'No new events to review'}
              text="New labs, vitals, visits and medication changes that touch this plan show up here with the updates they suggest."
            />
          </div>
        )
      )}

      {active === 'cadence' && (
        <div className={styles.box}>
          <ReviewCadencePanel
            patientId={patientId}
            program={program}
            plan={live?.plan}
            canEdit={canEdit}
            empty={(
              <TabEmpty
                icon="solar:calendar-minimalistic-linear"
                title="No review cadence yet"
                text="Set how often this program's care plans are reviewed in Settings > Care Program Configuration > Cadence."
              />
            )}
          />
        </div>
      )}
    </section>
  );
}
