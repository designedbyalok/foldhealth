import { useState, useEffect, useMemo, useRef } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
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
import { TabStrip } from '../../../../../../../../components/TabStrip/TabStrip';
import { MenuPopover } from '../../../../../../../../components/MenuPopover/MenuPopover';
import { ConfirmDialog } from '../../../../../../../../components/ConfirmDialog/ConfirmDialog';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import { AddInterventionDrawer } from '../AddInterventionDrawer/AddInterventionDrawer';
import { CreateGoalDrawer } from '../../../../../../../settings/care-plan-library/goals/CreateGoalDrawer/CreateGoalDrawer';
import { formatGoalTarget, formatGoalDuration } from '../../../../../../../settings/care-plan-library/lib';
import styles from './GoalPreviewDrawer.module.css';

const GBI_STATUSES = ['Not Started', 'In Progress', 'On Hold', 'Met', 'Not Met'];
const ACTIVITY_TABS = [
  { key: 'all', label: 'All' },
  { key: 'since', label: 'Since Last Visit' },
];
const ACTIVITY_FILTERS = [
  { key: 'all', label: 'All activity' },
  { key: 'note', label: 'Notes' },
  { key: 'status_changed', label: 'Status' },
  { key: 'progress_changed', label: 'Progress' },
  { key: 'value_changed', label: 'Values' },
];
const STATUS_TONE = {
  'Not Started': 'grey',
  'In Progress': 'warning',
  'On Hold': 'grey',
  Met: 'success',
  'Not Met': 'error',
};

function progressBand(pct) {
  const n = Number(pct) || 0;
  if (n <= 0) return 'Poor';
  if (n < 40) return 'Low';
  if (n < 80) return 'Moderate';
  if (n < 100) return 'High';
  return 'Complete';
}

function progressTone(label) {
  if (/Poor|Low/.test(label)) return 'error';
  if (/Moderate/.test(label)) return 'warning';
  if (/High|Complete/.test(label)) return 'success';
  return 'grey';
}

function relativeLabel(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 60) return `${mins || 1}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.round(months / 12)}y`;
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
}

function fmtStamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${date} ${time}`;
}

const initialsOf = (name) => (name || '').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

// Rebuild the goal's descriptive subtitle from its structured values so the
// hero line ("Blood pressure < 140/90 mmHg • 3 Months") reflects edits made in
// the Edit Goal drawer. Returns '' when there's nothing structured to show.
function buildGoalSubtitle(g) {
  const target = formatGoalTarget(g);
  const dur = formatGoalDuration(g);
  const left = [g.measure, target].filter(Boolean).join(' ').trim();
  return [left, dur].filter(Boolean).join(' • ');
}

function splitArrow(detail) {
  if (!detail || !detail.includes('→')) return [null, null];
  const [from, to] = detail.split('→').map(s => s.trim());
  return [from || null, to || null];
}

function mapAuditEntry(e) {
  const [from, to] = splitArrow(e.detail);
  const base = { id: e.id, actor: e.actor || '', at: e.createdAt, createdAt: e.createdAt, action: e.action };
  if (e.action === 'note') return { ...base, verb: 'added a', field: 'Note', comment: e.detail };
  if (e.action === 'created') return { ...base, verb: 'added a', field: 'Goal' };
  if (e.action === 'deleted') return { ...base, verb: 'removed a', field: 'Goal' };
  if (e.action === 'status_changed') return { ...base, verb: 'changed the', field: 'Status', from, to, fromTone: STATUS_TONE[from] || 'grey', toTone: STATUS_TONE[to] || 'grey' };
  if (e.action === 'progress_changed') return { ...base, verb: 'changed the', field: 'Progress', from, to, fromTone: progressTone(from), toTone: progressTone(to) };
  if (e.action === 'value_changed') {
    if (from && to) return { ...base, verb: 'changed the', field: 'Value', from, to, fromTone: 'grey', toTone: 'grey' };
    return { ...base, verb: 'added a', field: 'Value', comment: e.detail };
  }
  return { ...base, verb: 'updated', field: e.summary || 'Goal' };
}

function sparkNum(v) {
  const m = String(v).match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : NaN;
}

function Sparkline({ values }) {
  const nums = values.map(sparkNum).filter(n => !Number.isNaN(n));
  if (nums.length < 2) return <span className={styles.sparkEmpty}>—</span>;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const w = 85;
  const h = 47;
  const padX = 8;
  const padY = 6;
  const step = nums.length > 1 ? (w - padX * 2) / (nums.length - 1) : 0;
  const pts = nums.map((n, i) => ({
    x: padX + i * step,
    y: h - padY - ((n - min) / span) * (h - padY * 2),
  }));
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={styles.spark} aria-hidden="true">
      {pts.map((p, i) => {
        const last = i === pts.length - 1;
        const stroke = last ? 'var(--accent-blue)' : 'var(--neutral-150)';
        return (
          <g key={i}>
            <line x1={p.x} y1={h - padY} x2={p.x} y2={p.y} stroke={stroke} strokeWidth="1" strokeLinecap="round" />
            <circle cx={p.x} cy={p.y} r={last ? 2.5 : 2} fill={last ? 'var(--accent-blue)' : 'var(--neutral-200)'} />
          </g>
        );
      })}
    </svg>
  );
}

function AccordionHead({ title, open, onToggle, onAdd, addTooltip, canEdit, muted }) {
  return (
    <div className={styles.accHead}>
      <button type="button" className={styles.accToggle} onClick={onToggle} aria-expanded={open}>
        {!muted && (
          <span className={`${styles.accChevron} ${open ? styles.accChevronOpen : ''}`}>
            <Icon name="solar:alt-arrow-down-linear" size={12} color="var(--neutral-300)" />
          </span>
        )}
        <span className={muted ? styles.accTitleMuted : styles.accTitle}>{title}</span>
        {muted && (
          <span className={`${styles.accChevronAfter} ${open ? styles.accChevronOpen : ''}`}>
            <Icon name="solar:alt-arrow-down-linear" size={16} color="var(--neutral-300)" />
          </span>
        )}
      </button>
      {canEdit && (
        <ActionButton icon="solar:add-linear" size="S" tooltip={addTooltip} onClick={onAdd} />
      )}
    </div>
  );
}

/**
 * Goal Details — Figma SNP-Story 2632:81504.
 * Every edit (status, progress, readings, automations, notes, interventions,
 * barriers) writes through the care-plan store into Supabase.
 */
export function GoalPreviewDrawer({ goal, patientId, program, onClose }) {
  const key = patientId && program ? `${patientId}::${program.id}` : null;
  const slice = useAppStore(s => (key ? s.patientCarePlans[key] : null));
  const audit = useAppStore(s => (key ? s.patientCarePlanAudit[key] : null)) || [];
  const lastVisit = useAppStore(s => {
    const p = (s.patients || []).find(x => x.id === patientId)
      || (s.allPatients || []).find(x => x.id === patientId);
    return p?.lastVisit || p?.last_visit || null;
  });
  const currentUserName = useAppStore(s => s.currentUserProfile?.name);
  const savePatientCarePlanGoal = useAppStore(s => s.savePatientCarePlanGoal);
  const deletePatientCarePlanGoal = useAppStore(s => s.deletePatientCarePlanGoal);
  const saveGoalMeasurement = useAppStore(s => s.saveGoalMeasurement);
  const deleteGoalMeasurement = useAppStore(s => s.deleteGoalMeasurement);
  const saveCarePlanAutomation = useAppStore(s => s.saveCarePlanAutomation);
  const deleteCarePlanAutomation = useAppStore(s => s.deleteCarePlanAutomation);
  const savePatientCarePlanIntervention = useAppStore(s => s.savePatientCarePlanIntervention);
  const savePatientCarePlanBarrier = useAppStore(s => s.savePatientCarePlanBarrier);
  const addCarePlanNote = useAppStore(s => s.addCarePlanNote);
  const showToast = useAppStore(s => s.showToast);
  const updateCarePlanNote = useAppStore(s => s.updateCarePlanNote);
  const deleteCarePlanNote = useAppStore(s => s.deleteCarePlanNote);
  const fetchCarePlanAudit = useAppStore(s => s.fetchCarePlanAudit);

  const live = (slice?.goals || []).find(g => g.id === goal?.id) || goal;
  const interventions = useMemo(() => (slice?.interventions || []).filter(i => i.goalId === live?.id), [slice, live]);
  const barriers = useMemo(() => (slice?.barriers || []).filter(b => b.goalId === live?.id), [slice, live]);
  const measurements = useMemo(
    () => (slice?.measurements || []).filter(m => m.goalId === live?.id).slice().sort((a, b) => new Date(a.takenAt) - new Date(b.takenAt)),
    [slice, live],
  );
  const automations = useMemo(() => (slice?.automations || []).filter(a => !a.goalId || a.goalId === live?.id), [slice, live]);

  const [pct, setPct] = useState(Number(live?.progress) || 0);
  const [open, setOpen] = useState({ trends: true, interventions: false, barriers: false, automations: false });
  const [addingReading, setAddingReading] = useState(false);
  const [readingValue, setReadingValue] = useState('');
  const [readingFavorable, setReadingFavorable] = useState(true);
  const [addingAutomation, setAddingAutomation] = useState(false);
  const [automationTitle, setAutomationTitle] = useState('');
  const [addingBarrier, setAddingBarrier] = useState(false);
  const [barrierTitle, setBarrierTitle] = useState('');
  const [intvOpen, setIntvOpen] = useState(false);
  const [note, setNote] = useState('');
  const [notePlain, setNotePlain] = useState('');
  const [activityTab, setActivityTab] = useState('all');
  const [activityFilter, setActivityFilter] = useState('all');
  const [filterMenu, setFilterMenu] = useState(null);
  const [moreMenu, setMoreMenu] = useState(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [editGoalOpen, setEditGoalOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [confirm, setConfirm] = useState(null);
  const moreBtnRef = useRef(null);
  const filterBtnRef = useRef(null);

  useEffect(() => { setPct(Number(live?.progress) || 0); }, [live?.id, live?.progress]);
  useEffect(() => { if (patientId && program) fetchCarePlanAudit(patientId, program.id); }, [patientId, program, fetchCarePlanAudit]);

  const activity = useMemo(() => {
    const rows = audit
      .filter(a => String(a.entityId) === String(live?.id))
      .map(mapAuditEntry);
    const sinceCutoff = (() => {
      if (lastVisit) {
        const t = new Date(lastVisit).getTime();
        if (!Number.isNaN(t)) return t;
      }
      return Date.now() - 30 * 86400000;
    })();
    return rows.filter(e => {
      if (activityTab === 'since' && e.createdAt && new Date(e.createdAt).getTime() < sinceCutoff) return false;
      if (activityFilter !== 'all' && e.action !== activityFilter) return false;
      return true;
    });
  }, [audit, live, activityTab, activityFilter, lastVisit]);

  if (!live) return null;

  const canEdit = !!(patientId && program);
  const unit = live.customUnit || measurements[0]?.unit || '';
  const youSuffix = (name) => (name && currentUserName && name === currentUserName ? ` by ${name} (You)` : name ? ` by ${name}` : '');

  const toggle = (k) => setOpen(s => ({ ...s, [k]: !s[k] }));
  const expandAnd = (k, fn) => { setOpen(s => ({ ...s, [k]: true })); fn(); };

  const commitProgress = (v) => {
    const next = v[0];
    if (next === (live.progress ?? 0)) return;
    savePatientCarePlanGoal(patientId, program, { ...live, progress: next }, live.id);
  };

  const changeStatus = (status) => {
    if (!canEdit || status === live.status) return;
    savePatientCarePlanGoal(patientId, program, { ...live, status }, live.id);
  };

  const commitTitle = () => {
    const next = titleDraft.trim();
    setEditingTitle(false);
    if (!next || next === live.title) return;
    savePatientCarePlanGoal(patientId, program, { ...live, title: next }, live.id);
  };

  // Full-detail edit via the shared Goals Library drawer. Its onSave returns the
  // whole goal shape (title/priority/target/duration/…); merge onto the live
  // goal so unrelated fields (subtitle, icon, status, progress) are preserved.
  // `interventions` from the drawer is ignored — care-plan interventions are
  // managed separately and the goal row mapper drops the field.
  const handleSaveGoalEdit = async (values) => {
    setEditGoalOpen(false);
    const merged = { ...live, ...values };
    // Regenerate the subtitle from the edited structured values (keep the old
    // one only if the edit leaves nothing structured to render).
    const subtitle = buildGoalSubtitle(merged);
    if (subtitle) merged.subtitle = subtitle;
    const saved = await savePatientCarePlanGoal(patientId, program, merged, live.id);
    if (saved) showToast?.('Goal updated');
  };

  const submitReading = async () => {
    if (!readingValue.trim()) return;
    await saveGoalMeasurement(patientId, program.id, live.id, { value: readingValue.trim(), unit, favorable: readingFavorable });
    setReadingValue(''); setReadingFavorable(true); setAddingReading(false);
  };

  const submitAutomation = async () => {
    if (!automationTitle.trim()) return;
    await saveCarePlanAutomation(patientId, program, live.id, { title: automationTitle.trim() });
    setAutomationTitle(''); setAddingAutomation(false);
  };

  const submitBarrier = async () => {
    if (!barrierTitle.trim()) return;
    await savePatientCarePlanBarrier(patientId, program, { title: barrierTitle.trim(), goalId: live.id, status: 'Not Started', priority: live.priority || 'medium' });
    setBarrierTitle(''); setAddingBarrier(false);
  };

  const submitNote = async () => {
    const body = (notePlain || note).replace(/<[^>]+>/g, '').trim();
    if (!body) return;
    await addCarePlanNote(patientId, program, body, { entityType: 'goal', entityId: live.id, summary: `Note on ${live.title}` });
    setNote('');
    setNotePlain('');
  };

  const programBadges = [program?.code].filter(Boolean);
  const conditionBadges = (live.conditions?.length
    ? live.conditions
    : (slice?.plan?.conditions || []).map(c => (typeof c === 'string' ? c : c.label)).filter(Boolean)
  ).slice(0, 4);

  const metaParts = [
    live.createdAt ? `Start Date : ${fmtDate(live.createdAt)}` : null,
    live.updatedAt ? `Last Updated : ${fmtDate(live.updatedAt)}${youSuffix(live.updatedBy)}` : null,
  ].filter(Boolean);

  // Edit mode replaces this drawer's surface with the shared Goals Library
  // drawer (rather than stacking a second drawer on top). Cancel/Save both
  // return to Goal Details.
  if (editGoalOpen) {
    return (
      <CreateGoalDrawer
        goal={live}
        onClose={() => setEditGoalOpen(false)}
        onSave={handleSaveGoalEdit}
      />
    );
  }

  return (
    <Drawer title="Goal Details" onClose={onClose} bodyClassName={styles.drawerPad}>
      <div className={styles.body}>
        <div className={styles.statusBar}>
          <Select
            options={GBI_STATUSES.map(s => ({ value: s, label: s }))}
            value={live.status}
            onChange={changeStatus}
            disabled={!canEdit}
            portal
            className={styles.statusSelect}
            style={{ width: 'fit-content' }}
          />
          <div className={styles.statusActions}>
            <ActionButton
              icon="solar:pen-linear"
              size="L"
              tooltip="Edit Goal"
              disabled={!canEdit}
              onClick={() => setEditGoalOpen(true)}
            />
            <span className={styles.headerDivider} />
            <ActionButton
              ref={moreBtnRef}
              icon="solar:menu-dots-linear"
              size="L"
              tooltip="More"
              disabled={!canEdit}
              onClick={(e) => setMoreMenu(e.currentTarget.getBoundingClientRect())}
            />
          </div>
        </div>

        <div className={styles.hero}>
          <div className={styles.titleRow}>
            <PriorityIcon priority={live.priority} size={16} />
            {editingTitle ? (
              <Input
                autoFocus
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                aria-label="Goal title"
              />
            ) : (
              <span className={styles.title}>{live.title}</span>
            )}
          </div>
          {live.subtitle && <span className={styles.subtitle}>{live.subtitle}</span>}
          {metaParts.length > 0 && <span className={styles.meta}>{metaParts.join(' • ')}</span>}
          {(programBadges.length > 0 || conditionBadges.length > 0) && (
            <div className={styles.badges}>
              {programBadges.map(b => <Badge key={b} tone="grey" label={b} />)}
              {programBadges.length > 0 && conditionBadges.length > 0 && <span className={styles.badgeDivider} />}
              {conditionBadges.map(b => <Badge key={b} tone="grey" label={b} />)}
            </div>
          )}
        </div>

        <section className={styles.section}>
          <span className={styles.progressLabel}>Progress</span>
          <div className={styles.progressCard}>
            <div className={styles.progressWrap}>
              <div className={styles.progressBubble} style={{ left: `${pct}%` }}>
                {pct}% • {progressBand(pct)}
              </div>
              <Slider
                className={styles.progressSlider}
                value={[pct]}
                min={0}
                max={100}
                step={1}
                disabled={!canEdit}
                onValueChange={v => setPct(v[0])}
                onValueCommit={commitProgress}
                aria-label="Goal progress"
              />
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <AccordionHead
            title="Last Trends"
            open={open.trends}
            onToggle={() => toggle('trends')}
            canEdit={canEdit}
            muted
            addTooltip="Add reading"
            onAdd={() => expandAnd('trends', () => setAddingReading(v => !v))}
          />
          {open.trends && (
            <>
              {addingReading && (
                <div className={styles.addRow}>
                  <Input
                    placeholder={unit ? `Value (${unit})` : 'Value'}
                    value={readingValue}
                    onChange={e => setReadingValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') submitReading(); }}
                    aria-label="Reading value"
                  />
                  <button
                    type="button"
                    className={`${styles.favorableToggle} ${readingFavorable ? styles.favorableOn : styles.favorableOff}`}
                    onClick={() => setReadingFavorable(v => !v)}
                  >
                    {readingFavorable ? 'In target' : 'Out of target'}
                  </button>
                  <Button variant="primary" size="S" onClick={submitReading} disabled={!readingValue.trim()}>Save</Button>
                </div>
              )}
              {measurements.length === 0 ? (
                <div className={styles.emptyCard}>No readings recorded yet.</div>
              ) : (
                <div className={styles.trendsCard}>
                  <div className={styles.trendsHead}>
                    <span>Last {measurements.length} Values{unit ? ` (${unit})` : ''}</span>
                    <span className={styles.trendsHeadRight}>Trend</span>
                  </div>
                  <div className={styles.trendsBody}>
                    <div className={styles.trendsValues}>
                      {measurements.map(m => (
                        <div key={m.id} className={styles.valueCol}>
                          <span className={`${styles.value} ${m.favorable ? styles.valueGood : styles.valueBad}`}>{m.value}</span>
                          <span className={styles.valueAge}>{relativeLabel(m.takenAt)}</span>
                          {canEdit && (
                            <button type="button" className={styles.valueRemove} onClick={() => deleteGoalMeasurement(patientId, program.id, m.id)} aria-label="Remove reading">
                              <Icon name="solar:close-circle-linear" size={12} color="var(--neutral-300)" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className={styles.trendsSpark}>
                      <Sparkline values={measurements.map(m => m.value)} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <section className={`${styles.accSection} ${open.interventions ? styles.accSectionOpen : ''}`}>
          <AccordionHead
            title="Interventions"
            open={open.interventions}
            onToggle={() => toggle('interventions')}
            canEdit={canEdit}
            addTooltip="Add Intervention"
            onAdd={() => expandAnd('interventions', () => setIntvOpen(true))}
          />
          {open.interventions && (
            interventions.length === 0 ? (
              <div className={styles.emptyCard}>No interventions linked yet.</div>
            ) : (
              <div className={styles.linkedList}>
                {interventions.map(i => (
                  <div key={i.id} className={styles.linkedRow}>
                    <span className={styles.linkedIcon}><Icon name={i.icon || 'solar:clipboard-list-linear'} size={16} color="var(--neutral-400)" /></span>
                    <span className={styles.linkedText}>
                      <span className={styles.linkedTitle}>{i.title}</span>
                      {i.status && <span className={styles.linkedMeta}>{i.status}</span>}
                    </span>
                    {i.assignee?.name && i.assignee.name !== 'Unassigned'
                      ? <Avatar type="initial" variant="staff" size="S" initials={initialsOf(i.assignee.name)} />
                      : <Badge tone="grey" label="Unassigned" />}
                  </div>
                ))}
              </div>
            )
          )}
        </section>

        <section className={`${styles.accSection} ${open.barriers ? styles.accSectionOpen : ''}`}>
          <AccordionHead
            title="Barriers"
            open={open.barriers}
            onToggle={() => toggle('barriers')}
            canEdit={canEdit}
            addTooltip="Add Barriers"
            onAdd={() => expandAnd('barriers', () => setAddingBarrier(v => !v))}
          />
          {open.barriers && (
            <>
              {addingBarrier && (
                <div className={styles.addRow}>
                  <Input
                    placeholder="Barrier title"
                    value={barrierTitle}
                    onChange={e => setBarrierTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') submitBarrier(); }}
                    aria-label="Barrier title"
                  />
                  <Button variant="primary" size="S" onClick={submitBarrier} disabled={!barrierTitle.trim()}>Save</Button>
                </div>
              )}
              {barriers.length === 0 ? (
                <div className={styles.emptyCard}>No barriers linked yet.</div>
              ) : (
                <div className={styles.linkedList}>
                  {barriers.map(b => (
                    <div key={b.id} className={styles.linkedRow}>
                      <span className={styles.linkedIcon}><Icon name="solar:shield-warning-linear" size={16} color="var(--neutral-400)" /></span>
                      <span className={styles.linkedText}>
                        <span className={styles.linkedTitle}>{b.title}</span>
                        {b.status && <span className={styles.linkedMeta}>{b.status}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        <section className={`${styles.accSection} ${open.automations ? styles.accSectionOpen : ''}`}>
          <AccordionHead
            title="Automations"
            open={open.automations}
            onToggle={() => toggle('automations')}
            canEdit={canEdit}
            addTooltip="Add Automations"
            onAdd={() => expandAnd('automations', () => setAddingAutomation(v => !v))}
          />
          {open.automations && (
            <>
              {addingAutomation && (
                <div className={styles.addRow}>
                  <Input
                    placeholder="Automation (e.g. Notify care team on 5% deviation)"
                    value={automationTitle}
                    onChange={e => setAutomationTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') submitAutomation(); }}
                    aria-label="Automation title"
                  />
                  <Button variant="primary" size="S" onClick={submitAutomation} disabled={!automationTitle.trim()}>Save</Button>
                </div>
              )}
              {automations.length === 0 ? (
                <div className={styles.emptyCard}>No automations set up.</div>
              ) : (
                <div className={styles.linkedList}>
                  {automations.map(a => (
                    <div key={a.id} className={styles.linkedRow}>
                      <span className={styles.linkedIcon}><Icon name={a.icon || 'solar:bolt-linear'} size={16} color="var(--neutral-400)" /></span>
                      <span className={styles.linkedText}><span className={styles.linkedTitle}>{a.title}</span></span>
                      {canEdit && (
                        <button type="button" className={styles.valueRemove} onClick={() => deleteCarePlanAutomation(patientId, program.id, a.id)} aria-label="Remove automation">
                          <Icon name="solar:trash-bin-minimalistic-linear" size={14} color="var(--neutral-300)" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {canEdit && (
          <Textarea
            title="Add Note"
            placeholder="Add a note"
            value={note}
            onChange={(html, extra) => {
              setNote(typeof html === 'string' ? html : '');
              setNotePlain(typeof extra === 'string' ? extra : (typeof html === 'string' ? html : ''));
            }}
            richText
            attachment
            rows={3}
            bottomButton={{ label: 'Add Note', onClick: submitNote, disabled: !(notePlain || note).replace(/<[^>]+>/g, '').trim() }}
          />
        )}
      </div>

      <div className={styles.activityBlock}>
        <TabStrip
          items={ACTIVITY_TABS}
          activeKey={activityTab}
          onChange={setActivityTab}
          fullWidth={false}
          size="S"
          trailing={(
            <ActionButton
              ref={filterBtnRef}
              icon="custom:filter"
              size="S"
              tooltip="Filter activity"
              active={activityFilter !== 'all'}
              onClick={(e) => setFilterMenu(e.currentTarget.getBoundingClientRect())}
            />
          )}
        />
        <div className={styles.activityList}>
          {activity.length === 0 ? (
            <div className={styles.emptyCard}>No activity yet.</div>
          ) : activity.map((e, i) => (
            <div key={e.id} className={styles.logRow}>
              <div className={styles.logRail}>
                <Avatar type="initial" variant="staff" size="S" initials={initialsOf(e.actor) || '—'} />
                {i < activity.length - 1 && <span className={styles.logLine} />}
              </div>
              <div className={styles.logBody}>
                <span className={styles.logStamp}>{fmtStamp(e.at)}</span>
                <p className={styles.logLineText}>
                  <span className={styles.logActor}>{e.actor || 'Someone'}</span>
                  <span>{e.verb}</span>
                  <span className={styles.logField}>{e.field}</span>
                </p>
                {e.from && e.to && (
                  <div className={styles.logChange}>
                    <Badge tone={e.fromTone || 'grey'} size="S" label={e.from} />
                    <Icon name="solar:arrow-right-linear" size={16} color="var(--neutral-300)" />
                    <Badge tone={e.toTone || 'grey'} size="S" label={e.to} />
                  </div>
                )}
                {e.comment && editingNoteId !== e.id && (
                  <p className={styles.logComment}>{e.comment}</p>
                )}
                {e.action === 'note' && canEdit && editingNoteId === e.id && (
                  <div className={styles.noteEdit}>
                    <Textarea value={noteDraft} onChange={ev => setNoteDraft(ev.target.value)} rows={3} />
                    <div className={styles.noteEditActions}>
                      <Button variant="ghost" size="S" onClick={() => setEditingNoteId(null)}>Cancel</Button>
                      <Button
                        variant="primary"
                        size="S"
                        disabled={!noteDraft.trim()}
                        onClick={async () => {
                          await updateCarePlanNote(patientId, program.id, e.id, noteDraft);
                          setEditingNoteId(null);
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                )}
                {e.action === 'note' && canEdit && editingNoteId !== e.id && (
                  <div className={styles.logNoteActions}>
                    <Button
                      variant="ghost"
                      size="S"
                      onClick={() => { setEditingNoteId(e.id); setNoteDraft(e.comment || ''); }}
                    >
                      Edit
                    </Button>
                    <span className={styles.logDot}>•</span>
                    <Button
                      variant="ghost"
                      size="S"
                      onClick={() => setConfirm({ kind: 'note', id: e.id })}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {moreMenu && (
        <MenuPopover
          anchorRect={moreMenu}
          width={160}
          ariaLabel="Goal actions"
          items={[
            { key: 'rename', icon: 'solar:pen-linear', label: 'Rename', disabled: !canEdit },
            { key: 'delete', icon: 'solar:trash-bin-trash-linear', label: 'Remove', danger: true, disabled: !canEdit },
          ]}
          onSelect={(k) => {
            setMoreMenu(null);
            if (k === 'rename') { setTitleDraft(live.title); setEditingTitle(true); }
            if (k === 'delete') setConfirm({ kind: 'goal' });
          }}
          onClose={() => setMoreMenu(null)}
        />
      )}

      {filterMenu && (
        <MenuPopover
          anchorRect={filterMenu}
          width={180}
          ariaLabel="Filter activity"
          items={ACTIVITY_FILTERS.map(f => ({ key: f.key, label: f.label }))}
          onSelect={(k) => { setActivityFilter(k); setFilterMenu(null); }}
          onClose={() => setFilterMenu(null)}
        />
      )}

      {intvOpen && (
        <AddInterventionDrawer
          onClose={() => setIntvOpen(false)}
          onSave={async (values) => {
            await savePatientCarePlanIntervention(patientId, program, { ...values, goalId: live.id });
            setIntvOpen(false);
          }}
        />
      )}

      {confirm?.kind === 'goal' && (
        <ConfirmDialog
          variant="error"
          title={`Remove "${live.title}"?`}
          description="This removes it from the patient's care plan. This action cannot be undone."
          confirmLabel="Remove"
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await deletePatientCarePlanGoal(patientId, program.id, live.id);
            setConfirm(null);
            onClose?.();
          }}
        />
      )}

      {confirm?.kind === 'note' && (
        <ConfirmDialog
          variant="error"
          title="Delete this note?"
          description="The note will be removed from this goal's activity."
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
