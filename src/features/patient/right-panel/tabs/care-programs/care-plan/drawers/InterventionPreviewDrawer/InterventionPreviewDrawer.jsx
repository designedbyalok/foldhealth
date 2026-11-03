import { useState, useEffect, useMemo, useRef } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { EditableText } from '../../../../../../../../components/EditableText/EditableText';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { Badge } from '../../../../../../../../components/Badge/Badge';
import { Button } from '../../../../../../../../components/Button/Button';
import { Select } from '../../../../../../../../components/Select/Select';
import { Input } from '../../../../../../../../components/Input/Input';
import { Textarea } from '../../../../../../../../components/Textarea/Textarea';
import { Avatar } from '../../../../../../../../components/Avatar/Avatar';
import { ActionButton } from '../../../../../../../../components/ActionButton/ActionButton';
import { Slider } from '../../../../../../../../components/ShadcnSlider/ShadcnSlider';
import { PriorityIcon } from '../../../../../../../../components/PriorityIcon/PriorityIcon';
import { CarePlanActivityBlock } from '../CarePlanActivityBlock/CarePlanActivityBlock';
import { useCarePlanItemActivity } from '../../lib/useCarePlanItemActivity';
import { MenuPopover } from '../../../../../../../../components/MenuPopover/MenuPopover';
import { ConfirmDialog } from '../../../../../../../../components/ConfirmDialog/ConfirmDialog';
import { DownChevronIcon } from '../../../../../../../../components/Icon/DownChevronIcon';
import { LinkGoalToBarrierDrawer } from '../BarrierDetailDrawer/LinkGoalToBarrierDrawer';
import { DetailDropdown } from '../../../../../../../tasks/TasksViewDropdowns';
import { PRIORITY_OPTIONS } from '../../../../../../../tasks/TasksView.utils';
import { GbiProgressCell } from '../../tables/carePlanTableShared';
import { interventionOwner, toPickerValue } from '../../tables/carePlanTableModel';
import { formatGoalTarget, formatGoalFrequency } from '../../../../../../../settings/care-plan-library/lib';
import { computeDueDate, computeOccurrenceDates, formatRecurrenceLabel } from '../../tables/CarePlanInterventionsTable';
import { useScrollToSection } from '../../lib/useScrollToSection';
import { CarePlanItemNote } from '../CarePlanItemNote/CarePlanItemNote';
import { interventionDurationFromConfig } from '../../lib/carePlanInterventionMenu';
import { KIND_LABELS } from '../../../../../../../settings/care-plan-library/interventions/shared/interventionKinds';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import { useSignedCarePlan } from '../../lib/useSignedCarePlans';
import { adherenceBand, adherenceTone } from '../../lib/goalMetrics';
import { useEducationArticles, ARTICLE_ICON } from '../../lib/useEducationArticles';
import styles from '../GoalPreviewDrawer/GoalPreviewDrawer.module.css';
import barrierStyles from '../BarrierDetailDrawer/BarrierDetailDrawer.module.css';
import { parseLocalDate } from '../../../../../../../../lib/localDate';

import { GBI_STATUSES, gbiStatusMeta } from '../../lib/gbiStatus';
import { confirmStatusChange, statusReasonPatch } from '../../lib/confirmStatusChange';

function adherenceNum(value) {
  const n = Number(value);
  return Number.isFinite(n) && value !== '-' ? n : 0;
}

// Adherence uses the 3-band scheme (Poor / Moderate / Good) from the
// shared lib: intervention adherence is a distinct metric from goal
// progress, which stays on 5 bands. Local aliases keep the render calls
// short without re-declaring the logic.
const progressBand = adherenceBand;
const progressTone = adherenceTone;

// Progress slider fill / thumb color per band. Fed into the slider via
// the `--slider-tone` CSS variable so the CSS module can flip the fill
// and border colors without changing markup. Figma 2632:110774.
function progressSliderColor(pct) {
  const tone = progressTone(progressBand(pct));
  if (tone === 'error') return 'var(--status-error)';
  if (tone === 'warning') return 'var(--status-warning)';
  if (tone === 'success') return 'var(--status-success)';
  return 'var(--neutral-300)';
}

function fmtDate(iso) {
  const d = parseLocalDate(iso);
  if (!d) return '';
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
}

const initialsOf = (name) => (name || '').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();



function AccordionHead({ title, open, onToggle, onAdd, addTooltip, canEdit }) {
  return (
    <div className={styles.accHead}>
      <button type="button" className={styles.accToggle} onClick={onToggle} aria-expanded={open}>
        <span className={`${styles.accChevron} ${open ? styles.accChevronOpen : ''}`}>
          <DownChevronIcon size={12} color="var(--neutral-300)" />
        </span>
        <span className={styles.accTitle}>{title}</span>
      </button>
      {canEdit && onAdd && (
        <ActionButton icon="solar:add-linear" size="sm" tooltip={addTooltip} onClick={onAdd} />
      )}
    </div>
  );
}

/**
 * Intervention details: Paper 35-0. Mirrors Goal Details layout with
 * adherence, linked goals, automations, notes, and activity feed.
 */
export function InterventionPreviewDrawer({ intervention, patientId, program, onClose, onEdit, onOpenGoal, consolidated = false, signedView = false, focusSection = null, readOnly = false, snapshot = null }) {
  // `readOnly` + `snapshot`: opened from a past version or an earlier
  // template run; items come from that copy, nothing can be changed and
  // empty sections are hidden.
  const ro = consolidated || readOnly;
  const key = patientId && program ? `${patientId}::${program.id}` : null;
  // `signedView`: opened from a surface that shows the plan as last signed
  // (Comprehensive Care Plan, Monitoring). The item is read from that copy
  // and the plan itself is not editable there; readings and notes are live
  // documentation, so those stay open.
  const liveSlice = useAppStore(s => (key ? s.patientCarePlans[key] : null));
  const signedSlice = useSignedCarePlan(signedView ? key : null);
  const slice = useMemo(() => (snapshot
    ? { ...liveSlice, goals: snapshot.goals || [], interventions: snapshot.interventions || [], barriers: snapshot.barriers || [] }
    : (signedView ? signedSlice : liveSlice)), [snapshot, signedView, signedSlice, liveSlice]);
  const audit = useAppStore(s => (key ? s.patientCarePlanAudit[key] : null)) || [];
  const lastVisit = useAppStore(s => {
    const p = (s.patients || []).find(x => x.id === patientId)
      || (s.allPatients || []).find(x => x.id === patientId);
    return p?.lastVisit || p?.last_visit || null;
  });
  const saveCarePlanLiveField = useAppStore(s => s.saveCarePlanLiveField);
  const savePatientCarePlanIntervention = useAppStore(s => s.savePatientCarePlanIntervention);
  const deletePatientCarePlanIntervention = useAppStore(s => s.deletePatientCarePlanIntervention);
  const saveCarePlanAutomation = useAppStore(s => s.saveCarePlanAutomation);
  const deleteCarePlanAutomation = useAppStore(s => s.deleteCarePlanAutomation);
  const updateCarePlanNote = useAppStore(s => s.updateCarePlanNote);
  const deleteCarePlanNote = useAppStore(s => s.deleteCarePlanNote);
  const fetchCarePlanAudit = useAppStore(s => s.fetchCarePlanAudit);
  const currentUserName = useAppStore(s => s.currentUserProfile?.name);
  const patientName = useAppStore(s => {
    const p = (s.patients || []).find(x => x.id === patientId)
      || (s.allPatients || []).find(x => x.id === patientId);
    return p?.name;
  });
  // Content lookup: a Patient Education intervention stores the linked
  // material id as `config.content` (prefixed `email:<id>` / `form:<id>`);
  // Send Form stores it as `config.form`. Resolve to a name so the
  // reader can see which content was shared without opening the editor.
  const contentEmails = useAppStore(s => s.contentEmails);
  const contentForms = useAppStore(s => s.contentForms);
  const fetchContentEmails = useAppStore(s => s.fetchContentEmails);
  const fetchContentForms = useAppStore(s => s.fetchContentForms);

  const live = (slice?.interventions || []).find(i => i.id === intervention?.id) || intervention;
  const linkedGoals = useMemo(
    () => (slice?.goals || []).filter(g => g.id === live?.goalId),
    [slice, live],
  );
  // Read the paired task once so the hero can show a real "Due Date" and
  // the recurrence marker on the duration chip. Falls back to the intervention
  // config when the task hasn't been paired yet (pre-migration rows).
  const pairedTask = useAppStore(s => {
    if (!live?.taskId) return null;
    return (s.tasks || []).find(t => String(t.id) === String(live.taskId)) || null;
  });
  const automations = useMemo(
    () => (slice?.automations || []).filter(a => !live?.goalId || a.goalId === live.goalId),
    [slice, live],
  );

  const [pct, setPct] = useState(() => adherenceNum(live?.adherence));
  const [pctDragging, setPctDragging] = useState(false);
  const [open, setOpen] = useState({ tasks: true, goals: true, automations: true });
  const [addingAutomation, setAddingAutomation] = useState(false);
  const [automationTitle, setAutomationTitle] = useState('');
  const [moreMenu, setMoreMenu] = useState(null);
  const [linkGoalOpen, setLinkGoalOpen] = useState(false);
  // The editable title; "Rename" focuses it with the text selected.
  const titleRef = useRef(null);
  // Deferred a frame so a closing menu can't take focus back.
  const focusTitle = () => requestAnimationFrame(() => {
    const el = titleRef.current;
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [confirm, setConfirm] = useState(null);
  const moreBtnRef = useRef(null);

  useEffect(() => { setPct(adherenceNum(live?.adherence)); }, [live?.id, live?.adherence]);
  useEffect(() => { if (patientId && program) fetchCarePlanAudit(patientId, program.id); }, [patientId, program, fetchCarePlanAudit]);

  // Lazy-load the content library only for the kinds that need it, so the
  // Linked Education / Linked Form row can render a name instead of the raw
  // id when the drawer is opened cold (e.g. no library visit yet this
  // session).
  useEffect(() => {
    if (live?.kind === 'patient-education') {
      fetchContentEmails?.({ page: 1, perPage: 50, search: '' });
      fetchContentForms?.({ page: 1, perPage: 50, search: '' });
    } else if (live?.kind === 'send-form') {
      fetchContentForms?.({ page: 1, perPage: 50, search: '' });
    }
  }, [live?.kind, fetchContentEmails, fetchContentForms]);

  const articles = useEducationArticles(live?.kind === 'patient-education');

  // Resolve the linked content chips: shape `{ kind: 'Article'|'Email'|'Form', label, id, missing? }`
  // for the row renderer. `missing: true` marks a saved id that no longer
  // exists in the library (or hasn't been loaded yet) so the row can still
  // surface the raw handle.
  const linkedContent = useMemo(() => {
    if (!live) return [];
    if (live.kind === 'patient-education') {
      const raw = live.config?.content || '';
      // Current shape: a list of `article:<id>` picks.
      if (Array.isArray(raw)) {
        return raw.filter(v => String(v).startsWith('article:')).map((v) => {
          const id = String(v).slice('article:'.length);
          const hit = articles.find(a => String(a.id) === id);
          return { kind: 'Article', label: hit?.title || id, id, missing: !hit };
        });
      }
      if (!raw) return [];
      if (raw.startsWith('email:')) {
        const id = raw.slice('email:'.length);
        const hit = (contentEmails || []).find(e => String(e.id) === String(id));
        return [{ kind: 'Email', label: hit?.name || `Email #${id}`, id, missing: !hit }];
      }
      if (raw.startsWith('form:')) {
        const id = raw.slice('form:'.length);
        const hit = (contentForms || []).find(f => String(f.id) === String(id));
        return [{ kind: 'Form', label: hit?.name || `Form #${id}`, id, missing: !hit }];
      }
      return [{ kind: 'Content', label: raw, id: raw, missing: true }];
    }
    if (live.kind === 'send-form') {
      const raw = live.config?.form || '';
      if (!raw) return [];
      const hit = (contentForms || []).find(f => String(f.id) === String(raw));
      return [{ kind: 'Form', label: hit?.name || `Form #${raw}`, id: raw, missing: !hit }];
    }
    return [];
  }, [live, contentEmails, contentForms, articles]);
  const linkedContentTitle = live?.kind === 'send-form' ? 'Linked Form' : 'Linked Education';

  // Drawn as the Care Plan History draws it.
  const activity = useCarePlanItemActivity({
    patientId,
    program,
    audit,
    ids: live?.id ? [live.id] : [],
    goals: slice?.goals || [],
  });
  const noteSectionRef = useRef(null);
  useScrollToSection(noteSectionRef, focusSection === 'notes', live?.id);

  if (!live) return null;

  // canDocument: notes and live progress (status, priority, title, adherence),
  // which apply to the signed plan without a signature. canEdit: details and
  // structure, which are draft edits made in the editor.
  const canDocument = !!(patientId && program) && !readOnly;
  const canEdit = canDocument && !signedView;
  const saveLive = (patch) => (signedView
    ? saveCarePlanLiveField(patientId, program, 'intervention', live.id, patch)
    : savePatientCarePlanIntervention(patientId, program, { ...live, ...patch }, live.id));
  const youSuffix = (name) => (name && currentUserName && name === currentUserName ? ` by ${name} (You)` : name ? ` by ${name}` : '');
  const toggle = (k) => setOpen(s => ({ ...s, [k]: !s[k] }));
  const expandAnd = (k, fn) => { setOpen(s => ({ ...s, [k]: true })); fn(); };

  const commitAdherence = (v) => {
    const next = v[0];
    if (next === adherenceNum(live.adherence)) return;
    saveLive({ adherence: String(next) });
  };

  const changeStatus = async (status) => {
    if (!canDocument || status === live.status) return;
    const why = await confirmStatusChange([{ type: 'intervention', item: live }], status);
    if (!why) return;
    saveLive({ status, ...statusReasonPatch(live, why) });
  };


  const submitAutomation = async () => {
    if (!automationTitle.trim() || !live.goalId) return;
    await saveCarePlanAutomation(patientId, program, live.goalId, { title: automationTitle.trim() });
    setAutomationTitle('');
    setAddingAutomation(false);
  };

  // One due-date rule for the table, this drawer and the schedule below:
  // picked date, paired task, legacy config date, then created + duration.
  const displayDueIso = computeDueDate(live, pairedTask).iso;
  const hasRepeat = !!(pairedTask?.repeat || live.config?.repeat);
  const durationLabel = interventionDurationFromConfig(live.config);
  const recurringLabel = hasRepeat ? formatRecurrenceLabel(live) : null;

  // Primary line: everything the reviewer needs at a glance about
  // scheduling: start, due, duration, recurrence. Audit line
  // (Last Update) drops to its own row so the primary line stays
  // scannable at any width.
  // Same ownership rule as the plan table: member tasks belong to the patient.
  const owner = interventionOwner(live, patientName ? [{ name: patientName }] : []);
  const metaParts = [
    live.createdAt ? `Start Date : ${fmtDate(live.createdAt)}` : null,
    `Due Date : ${displayDueIso ? fmtDate(displayDueIso) : 'Not set'}`,
    owner.unassigned ? 'Unassigned' : `Assigned to ${owner.name || 'Member'}`,
    durationLabel ? `Duration : ${durationLabel}` : null,
    recurringLabel ? recurringLabel : null,
  ].filter(Boolean);
  const lastUpdateLabel = live.updatedAt
    ? `Last Update : ${fmtDate(live.updatedAt)}${youSuffix(live.updatedBy)}`
    : null;

  return (
    <Drawer
      title={KIND_LABELS[live.kind] ? `Intervention - ${KIND_LABELS[live.kind]}` : 'Intervention'}
      onClose={onClose}
      bodyClassName={styles.drawerPad}
    >
      <div className={styles.body}>
        <div className={styles.statusBar}>
          <Select
            options={GBI_STATUSES.map(s => ({ value: s, label: s, icon: gbiStatusMeta(s).icon }))}
            value={live.status}
            onChange={changeStatus}
            disabled={!canDocument}
            portal
            className={styles.statusSelect}
            style={{ width: 'fit-content' }}
          />
          <div className={styles.statusActions}>
            {!ro && (
              <>
                <ActionButton
                  icon="solar:pen-linear"
                  tooltip="Edit Intervention"
                  disabled={!canEdit}
                  onClick={() => {
                    // Prefer the full edit drawer when the caller wires one
                    // (opens the kind-specific InterventionDrawer with every
                    // field). Fall back to inline title-edit otherwise.
                    if (onEdit) onEdit(live);
                    else focusTitle();
                  }}
                />
                <span className={styles.headerDivider} />
                <ActionButton
                  ref={moreBtnRef}
                  icon="solar:menu-dots-linear"
                  tooltip="More"
                  disabled={!canEdit}
                  onClick={(e) => setMoreMenu(e.currentTarget.getBoundingClientRect())}
                />
              </>
            )}
          </div>
        </div>

        <div className={`${styles.hero} ${styles.heroWithKind}`}>
          <div className={styles.titleRow}>
            <span className={styles.priorityTrigger} aria-hidden="false">
              {readOnly ? <PriorityIcon priority={live.priority} size={20} /> : (
              <DetailDropdown
                value={live.priority}
                options={PRIORITY_OPTIONS}
                onSelect={(v) => {
                  if (!canDocument || v === live.priority) return;
                  saveLive({ priority: v });
                }}
                searchable={false}
                renderOption={(opt) => (
                  <>
                    <PriorityIcon priority={opt} size={16} />
                    <span style={{ textTransform: 'capitalize' }}>{opt}</span>
                  </>
                )}
              >
                <PriorityIcon priority={live.priority} size={20} />
              </DetailDropdown>
              )}
            </span>
            {/* The title edits where it stands: click the text, type, then
                Enter or click away to save; Escape cancels. No input box. */}
            <EditableText
              value={live.title || ''}
              onCommit={(next) => { if (next && next !== live.title) saveLive({ title: next }); }}
              ariaLabel="Intervention title"
              className={styles.titleText}
              elementRef={titleRef}
              disabled={!canDocument}
            />
          </div>
          {metaParts.length > 0 && <span className={styles.meta}>{metaParts.join(' • ')}</span>}
          {lastUpdateLabel && <span className={styles.meta}>{lastUpdateLabel}</span>}
          {(linkedContent.length > 0 || live.duration) && (
            <div className={styles.heroBadgeRow}>
              {linkedContent.map(c => (
                <button
                  key={`${c.kind}:${c.id}`}
                  type="button"
                  className={styles.linkedContentBadge}
                  onClick={() => { if (canEdit) onEdit?.(live); }}
                  disabled={!canEdit}
                  aria-label={`Open ${linkedContentTitle.toLowerCase()}: ${c.label}`}
                >
                  <Icon
                    name={{ Form: 'solar:document-text-linear', Article: ARTICLE_ICON }[c.kind] || 'solar:letter-linear'}
                    size={14}
                    color="var(--neutral-400)"
                  />
                  <span>{c.label}</span>
                  <Icon name="solar:arrow-right-up-linear" size={12} color="var(--neutral-400)" />
                </button>
              ))}
              {live.duration && (
                <Badge
                  size="sm"
                  icon="solar:clock-circle-linear"
                  label={live.duration}
                  trailingIcon={hasRepeat ? 'solar:refresh-linear' : undefined}
                />
              )}
            </div>
          )}
        </div>

        <section className={styles.section}>
          <span className={styles.progressLabel}>Adherence</span>
          <div className={styles.progressCard} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div
              className={styles.progressWrap}
              style={{ '--slider-tone': progressSliderColor(pct), flex: 1, minWidth: 0 }}
            >
              {pctDragging && (
                <div className={styles.progressBubble} style={{ left: `${pct}%` }}>
                  {pct}% • {progressBand(pct)}
                </div>
              )}
              <Slider
                className={styles.progressSlider}
                value={[pct]}
                min={0}
                max={100}
                step={1}
                disabled={!canDocument}
                onPointerDown={() => setPctDragging(true)}
                onPointerUp={() => setPctDragging(false)}
                onPointerCancel={() => setPctDragging(false)}
                onValueChange={v => setPct(v[0])}
                onValueCommit={(v) => { commitAdherence(v); setPctDragging(false); }}
                aria-label="Intervention adherence"
              />
            </div>
            <Badge
              size="sm"
              tone={progressTone(progressBand(pct))}
              label={`${pct}% • ${progressBand(pct)}`}
            />
          </div>
        </section>

        {(() => {
          // Schedule: the dates this intervention is due (each occurrence of a
          // recurring one). Per-day completion isn't recorded anywhere, so rows
          // say only where a date falls relative to today; a Met intervention
          // gets one "Met on" line from the audit trail instead of per-day ticks.
          const occurrences = live?.config?.repeat
            ? computeOccurrenceDates(live)
            : (displayDueIso ? [toPickerValue(displayDueIso)] : []);
          if (!occurrences.length) return null;
          const today = toPickerValue(new Date().toISOString());
          const metEntry = live.status === 'Met'
            ? audit
              .filter(a => String(a.entityId) === String(live.id) && a.action === 'status_changed' && /→\s*Met\s*$/.test(a.detail || ''))
              .sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt))[0]
            : null;
          const whenOf = (ymd) => (ymd < today ? 'Past' : ymd === today ? 'Due today' : 'Upcoming');
          return (
            <section className={barrierStyles.section}>
              <div className={barrierStyles.sectionHead}>
                <button
                  type="button"
                  className={barrierStyles.sectionToggle}
                  onClick={() => toggle('tasks')}
                  aria-expanded={open.tasks}
                >
                  <span className={barrierStyles.sectionTitle}>Schedule</span>
                  <DownChevronIcon
                    size={12}
                    color="var(--neutral-400)"
                    className={`${barrierStyles.sectionChevron} ${open.tasks ? barrierStyles.sectionChevronOpen : ''}`}
                  />
                </button>
              </div>
              {open.tasks && (
                <>
                  {live.status === 'Met' && (
                    <div className={styles.scheduleMet}>
                      <Icon name="solar:check-circle-linear" size={16} color="var(--status-success)" />
                      {metEntry ? `Met on ${fmtDate(metEntry.createdAt)}` : 'Met'}
                    </div>
                  )}
                  <ul className={styles.scheduleList}>
                    {occurrences.map(ymd => {
                      const when = whenOf(ymd);
                      return (
                        <li key={ymd} className={styles.scheduleRow}>
                          <span className={styles.scheduleDate}>{fmtDate(ymd)}</span>
                          <Badge size="sm" tone={when === 'Due today' ? 'warning' : 'neutral'} label={when} />
                        </li>
                      );
                    })}
                  </ul>
                  <span className={styles.scheduleHint}>Completion isn't tracked per date.</span>
                </>
              )}
            </section>
          );
        })()}

        {/* Linked Goals section: hidden entirely in the Comprehensive
            Care Plan view when nothing is linked (user can't link new
            goals here); otherwise shown read-only (Link/Unlink hidden). */}
        {(!ro || linkedGoals.length > 0) && (
        <section className={barrierStyles.section}>
          <div className={barrierStyles.sectionHead}>
            <button
              type="button"
              className={barrierStyles.sectionToggle}
              onClick={() => toggle('goals')}
              aria-expanded={open.goals}
            >
              <span className={barrierStyles.sectionTitle}>Linked Goals</span>
              <DownChevronIcon
                size={12}
                color="var(--neutral-400)"
                className={`${barrierStyles.sectionChevron} ${open.goals ? barrierStyles.sectionChevronOpen : ''}`}
              />
            </button>
            {canEdit && !ro && (
              <ActionButton
                icon="solar:add-linear"
                size="sm"
                tooltip="Link goal"
                onClick={() => setLinkGoalOpen(true)}
              />
            )}
          </div>
          {open.goals && (
            linkedGoals.length === 0 ? (
              <div className={barrierStyles.empty}>Not linked to any goals in this plan version yet.</div>
            ) : (
              <ul className={barrierStyles.linkList}>
                {linkedGoals.map(g => (
                  <li key={g.id} className={barrierStyles.linkRow}>
                    <span className={barrierStyles.linkIcon}>
                      <Icon name={g.icon || 'solar:flag-linear'} size={16} color="var(--neutral-400)" />
                    </span>
                    <div className={barrierStyles.linkStack}>
                      <span className={barrierStyles.linkTitle}>{g.title}</span>
                      {formatGoalTarget(g) && (
                        <span className={barrierStyles.linkSubtitle}>
                          {[`Target ${formatGoalTarget(g)}`, formatGoalFrequency(g)].filter(Boolean).join(' • ')}
                        </span>
                      )}
                    </div>
                    <div className={barrierStyles.linkActions} style={{ gap: 'var(--space-2)' }}>
                      <PriorityIcon priority={g.priority} size={16} />
                      <span className={barrierStyles.linkActionsDivider} aria-hidden style={{ margin: 0 }} />
                      <GbiProgressCell progress={g.progress} />
                      <span className={barrierStyles.linkActionsDivider} aria-hidden style={{ margin: 0 }} />
                      <ActionButton
                        icon="solar:arrow-right-up-linear"
                        size="sm"
                        tooltip="Open goal"
                        onClick={() => onOpenGoal?.(g)}
                      />
                      {canEdit && !ro && (
                        <>
                          <span className={barrierStyles.linkActionsDivider} aria-hidden style={{ margin: 0 }} />
                          <ActionButton
                            icon="solar:link-broken-minimalistic-linear"
                            size="sm"
                            tooltip="Unlink"
                            onClick={() => savePatientCarePlanIntervention(patientId, program, { ...live, goalId: null }, live.id)}
                          />
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )
          )}
        </section>
        )}

        {/* Automations section: hidden entirely in the Comprehensive
            Care Plan view when nothing is set up (user can't add new
            automations from that surface); otherwise shown read-only. */}
        {(!ro || automations.length > 0) && (
        <section className={barrierStyles.section}>
          <div className={barrierStyles.sectionHead}>
            <button
              type="button"
              className={barrierStyles.sectionToggle}
              onClick={() => toggle('automations')}
              aria-expanded={open.automations}
            >
              <span className={barrierStyles.sectionTitle}>Automations</span>
              <DownChevronIcon
                size={12}
                color="var(--neutral-400)"
                className={`${barrierStyles.sectionChevron} ${open.automations ? barrierStyles.sectionChevronOpen : ''}`}
              />
            </button>
            {canEdit && !!live.goalId && !ro && (
              <ActionButton
                icon="solar:add-linear"
                size="sm"
                tooltip="Add automation"
                onClick={() => expandAnd('automations', () => setAddingAutomation(v => !v))}
              />
            )}
          </div>
          {open.automations && (
            <>
              {addingAutomation && (
                <div className={styles.addRow}>
                  <Input
                    placeholder="Automation (e.g. Notify care team on missed task)"
                    value={automationTitle}
                    onChange={e => setAutomationTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') submitAutomation(); }}
                    aria-label="Automation title"
                  />
                  <Button size="sm" onClick={submitAutomation} disabled={!automationTitle.trim()}>Save</Button>
                </div>
              )}
              {automations.length === 0 ? (
                <div className={barrierStyles.empty}>No automations set up yet.</div>
              ) : (
                <ul className={barrierStyles.linkList}>
                  {automations.map(a => (
                    <li key={a.id} className={barrierStyles.linkRow}>
                      <span className={barrierStyles.linkIcon}>
                        <Icon name={a.icon || 'solar:bolt-linear'} size={16} color="var(--neutral-400)" />
                      </span>
                      <div className={barrierStyles.linkStack}>
                        <span className={barrierStyles.linkTitle}>{a.title}</span>
                      </div>
                      {canEdit && (
                        <div className={barrierStyles.linkActions}>
                          <ActionButton
                            icon="solar:link-broken-minimalistic-linear"
                            size="sm"
                            tooltip="Remove automation"
                            onClick={() => deleteCarePlanAutomation(patientId, program.id, a.id)}
                          />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
        )}

        {canDocument && (
          <CarePlanItemNote
            ref={noteSectionRef}
            entityType="intervention"
            itemId={live.id}
            itemTitle={live.title}
            audit={audit}
            patientId={patientId}
            program={program}
          />
        )}
      </div>

      <CarePlanActivityBlock
        entries={activity}
        lastVisit={lastVisit}
        emptyLabel="No activity for this intervention yet."
      />

      {moreMenu && (
        <MenuPopover
          anchorRect={moreMenu}
          width={160}
          ariaLabel="Intervention actions"
          items={[
            { key: 'rename', icon: 'solar:pen-linear', label: 'Rename', disabled: !canEdit },
            { key: 'delete', icon: 'solar:trash-bin-trash-linear', label: 'Remove', danger: true, disabled: !canEdit },
          ]}
          onSelect={(k) => {
            setMoreMenu(null);
            if (k === 'rename') focusTitle();
            if (k === 'delete') setConfirm({ kind: 'intervention' });
          }}
          onClose={() => setMoreMenu(null)}
        />
      )}

      {linkGoalOpen && (
        <LinkGoalToBarrierDrawer
          title="Link Goal to Intervention"
          goals={(slice?.goals || []).filter(g => g.id !== live.goalId)}
          onClose={() => setLinkGoalOpen(false)}
          onLink={async (ids) => {
            const first = Array.isArray(ids) ? ids[0] : ids;
            if (!first) { setLinkGoalOpen(false); return; }
            await savePatientCarePlanIntervention(patientId, program, { ...live, goalId: first }, live.id);
            setLinkGoalOpen(false);
          }}
        />
      )}

      {confirm?.kind === 'intervention' && (
        <ConfirmDialog
          variant="error"
          title={`Remove "${live.title}"?`}
          description="This removes it from the patient's care plan. This action cannot be undone."
          confirmLabel="Remove"
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await deletePatientCarePlanIntervention(patientId, program.id, live.id);
            setConfirm(null);
            onClose?.();
          }}
        />
      )}

      {confirm?.kind === 'note' && (
        <ConfirmDialog
          variant="error"
          title="Delete this note?"
          description="The note will be removed from this intervention's activity."
          confirmLabel="Delete"
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await deleteCarePlanNote(patientId, program.id, confirm.id);
            setConfirm(null);
          }}
        />
      )}
    </Drawer>
  );
}
