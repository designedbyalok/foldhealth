import { useState, useEffect, useMemo } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { Badge } from '../../../../../../../../components/Badge/Badge';
import { Button } from '../../../../../../../../components/Button/Button';
import { Select } from '../../../../../../../../components/Select/Select';
import { Avatar } from '../../../../../../../../components/Avatar/Avatar';
import { ActionButton } from '../../../../../../../../components/ActionButton/ActionButton';
import { Slider } from '../../../../../../../../components/ShadcnSlider/ShadcnSlider';
import { PriorityIcon } from '../../../../../../../../components/PriorityIcon/PriorityIcon';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import styles from './GoalPreviewDrawer.module.css';

const GBI_STATUSES = ['Not Started', 'In Progress', 'On Hold', 'Met', 'Not Met'];

// 70% → "Moderate", matching the Figma readout bands.
function progressBand(pct) {
  if (pct <= 0) return 'Not Started';
  if (pct < 40) return 'Low';
  if (pct < 80) return 'Moderate';
  if (pct < 100) return 'High';
  return 'Complete';
}

// Compact "10h / 3d / 18d / 1mo" relative label for a reading's age.
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

function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
}

const initialsOf = (name) => (name || '').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

// Tiny inline sparkline over the leading numeric token of each reading value.
function Sparkline({ values }) {
  const nums = values.map(v => parseFloat(String(v).replace(/[^0-9.]/g, ''))).filter(n => !Number.isNaN(n));
  if (nums.length < 2) return <span className={styles.sparkEmpty}>—</span>;
  const min = Math.min(...nums), max = Math.max(...nums);
  const span = max - min || 1;
  const w = 72, h = 28, pad = 3;
  const step = (w - pad * 2) / (nums.length - 1);
  const pts = nums.map((n, i) => {
    const x = pad + i * step;
    const y = h - pad - ((n - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = pts[pts.length - 1].split(',');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={styles.spark} aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" stroke="var(--neutral-200)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill="var(--primary-300)" />
    </svg>
  );
}

/**
 * Goal Details — the full per-goal panel from Figma SNP-Story (2632:80657).
 * Reads the live care-plan slice from the store and persists every edit
 * (status, progress, measurements, automations, notes). Opened from a goal
 * row/title click in CarePlanView.
 */
export function GoalPreviewDrawer({ goal, patientId, program, onClose, onEdit }) {
  const key = patientId && program ? `${patientId}::${program.id}` : null;
  const slice = useAppStore(s => (key ? s.patientCarePlans[key] : null));
  const audit = useAppStore(s => (key ? s.patientCarePlanAudit[key] : null)) || [];
  const savePatientCarePlanGoal = useAppStore(s => s.savePatientCarePlanGoal);
  const saveGoalMeasurement = useAppStore(s => s.saveGoalMeasurement);
  const deleteGoalMeasurement = useAppStore(s => s.deleteGoalMeasurement);
  const saveCarePlanAutomation = useAppStore(s => s.saveCarePlanAutomation);
  const deleteCarePlanAutomation = useAppStore(s => s.deleteCarePlanAutomation);
  const addCarePlanNote = useAppStore(s => s.addCarePlanNote);
  const fetchCarePlanAudit = useAppStore(s => s.fetchCarePlanAudit);

  // Prefer the live goal from the store so status/progress edits reflect back.
  const live = (slice?.goals || []).find(g => g.id === goal?.id) || goal;
  const interventions = useMemo(() => (slice?.interventions || []).filter(i => i.goalId === live?.id), [slice, live]);
  const barriers = useMemo(() => (slice?.barriers || []).filter(b => b.goalId === live?.id), [slice, live]);
  const measurements = useMemo(
    () => (slice?.measurements || []).filter(m => m.goalId === live?.id).slice().sort((a, b) => new Date(a.takenAt) - new Date(b.takenAt)),
    [slice, live],
  );
  const automations = useMemo(() => (slice?.automations || []).filter(a => !a.goalId || a.goalId === live?.id), [slice, live]);
  const activity = useMemo(() => audit.filter(a => a.entityId === live?.id), [audit, live]);

  const [pct, setPct] = useState(live?.progress ?? 0);
  const [addingReading, setAddingReading] = useState(false);
  const [readingValue, setReadingValue] = useState('');
  const [readingFavorable, setReadingFavorable] = useState(true);
  const [addingAutomation, setAddingAutomation] = useState(false);
  const [automationTitle, setAutomationTitle] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => { setPct(live?.progress ?? 0); }, [live?.id, live?.progress]);
  useEffect(() => { if (patientId && program) fetchCarePlanAudit(patientId, program.id); }, [patientId, program, fetchCarePlanAudit]);

  if (!live) return null;

  const canEdit = !!(patientId && program);
  const unit = live.customUnit || (measurements[0]?.unit) || '';

  const commitProgress = (v) => {
    const next = v[0];
    if (next === (live.progress ?? 0)) return;
    savePatientCarePlanGoal(patientId, program, { ...live, progress: next }, live.id);
  };

  const changeStatus = (status) => {
    if (!canEdit || status === live.status) return;
    savePatientCarePlanGoal(patientId, program, { ...live, status }, live.id);
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

  const submitNote = async () => {
    if (!note.trim()) return;
    await addCarePlanNote(patientId, program, note.trim(), { entityType: 'goal', entityId: live.id, summary: `Note on ${live.title}` });
    setNote('');
  };

  const badges = [
    program?.code ? [program.code] : [],
    live.conditions || [],
  ].flat();

  const metaParts = [
    live.createdAt ? `Start Date : ${fmtDate(live.createdAt)}` : null,
    live.updatedAt ? `Last Update : ${fmtDate(live.updatedAt)}${live.updatedBy ? ` by ${live.updatedBy}` : ''}` : null,
  ].filter(Boolean);

  return (
    <Drawer title="Goal Details" onClose={onClose} noCloseDivider>
      <div className={styles.body}>
        {/* Status bar */}
        <div className={styles.statusBar}>
          <Select
            options={GBI_STATUSES.map(s => ({ value: s, label: s }))}
            value={live.status}
            onChange={changeStatus}
            disabled={!canEdit}
            wrapperClassName={styles.statusSelect}
          />
          {onEdit && (
            <div className={styles.statusActions}>
              <ActionButton icon="solar:pen-linear" size="S" tooltip="Edit goal" onClick={onEdit} disabled={!canEdit} />
            </div>
          )}
        </div>

        {/* Hero */}
        <div className={styles.hero}>
          <div className={styles.titleRow}>
            <PriorityIcon priority={live.priority} size={16} />
            <span className={styles.title}>{live.title}</span>
          </div>
          {live.subtitle && <span className={styles.subtitle}>{live.subtitle}</span>}
          {metaParts.length > 0 && <span className={styles.meta}>{metaParts.join(' • ')}</span>}
          {badges.length > 0 && (
            <div className={styles.badges}>
              {badges.map((b, i) => <Badge key={`${b}-${i}`} tone="grey" size="S" label={b} />)}
            </div>
          )}
        </div>

        {/* Progress */}
        <section className={styles.section}>
          <span className={styles.sectionTitle}>Progress</span>
          <div className={styles.progressWrap}>
            <div className={styles.progressBubble} style={{ left: `${pct}%` }}>
              {pct}% • {progressBand(pct)}
            </div>
            <Slider
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
        </section>

        {/* Last Trends */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionTitle}>Last Trends</span>
            {canEdit && <ActionButton icon="solar:add-circle-linear" size="S" tooltip="Add reading" onClick={() => setAddingReading(v => !v)} />}
          </div>
          {addingReading && (
            <div className={styles.addRow}>
              <input
                className={styles.addInput}
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
        </section>

        {/* Interventions */}
        {interventions.length > 0 && (
          <section className={styles.section}>
            <span className={styles.sectionTitle}>Interventions</span>
            <div className={styles.linkedList}>
              {interventions.map(i => (
                <div key={i.id} className={styles.linkedRow}>
                  <span className={styles.linkedIcon}><Icon name={i.icon || 'solar:clipboard-list-linear'} size={16} color="var(--neutral-400)" /></span>
                  <span className={styles.linkedText}>
                    <span className={styles.linkedTitle}>{i.title}</span>
                    {i.status && <span className={styles.linkedMeta}>{i.status}</span>}
                  </span>
                  {i.assignee?.name
                    ? <Avatar type="initial" variant="user" size="S" initials={initialsOf(i.assignee.name)} />
                    : <Badge tone="grey" size="S" label="Unassigned" />}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Barriers */}
        {barriers.length > 0 && (
          <section className={styles.section}>
            <span className={styles.sectionTitle}>Barriers</span>
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
          </section>
        )}

        {/* Automations */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionTitle}>Automations</span>
            {canEdit && <ActionButton icon="solar:add-circle-linear" size="S" tooltip="Add automation" onClick={() => setAddingAutomation(v => !v)} />}
          </div>
          {addingAutomation && (
            <div className={styles.addRow}>
              <input
                className={styles.addInput}
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
        </section>

        {/* Add Note */}
        {canEdit && (
          <section className={styles.section}>
            <span className={styles.sectionTitle}>Add Note</span>
            <textarea
              className={styles.noteInput}
              placeholder="Add a note"
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              aria-label="Add a note"
            />
            <div className={styles.noteActions}>
              <Button variant="primary" size="S" onClick={submitNote} disabled={!note.trim()}>Add Note</Button>
            </div>
          </section>
        )}

        {/* Activity */}
        {activity.length > 0 && (
          <section className={styles.section}>
            <span className={styles.sectionTitle}>Activity</span>
            <div className={styles.activityList}>
              {activity.map(a => (
                <div key={a.id} className={styles.activityRow}>
                  <Avatar type="initial" variant="user" size="S" initials={initialsOf(a.actor) || '—'} />
                  <div className={styles.activityText}>
                    <span className={styles.activityLine}>
                      <strong>{a.actor || 'Someone'}</strong> {a.summary || a.action}
                    </span>
                    {a.detail && <span className={styles.activityDetail}>{a.detail}</span>}
                    <span className={styles.activityTime}>{fmtDateTime(a.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </Drawer>
  );
}
