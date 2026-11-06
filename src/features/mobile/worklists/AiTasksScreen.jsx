import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '../../../components/Badge/Badge';
import { Icon } from '../../../components/Icon/Icon';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { buildAiTocTasks } from '../../toc/aiTocTasks';
import { MobileSubHeader } from '../MobileHeader';
import { MobileEmpty, MobileListSkeleton } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import common from '../mobile.module.css';
import styles from './worklistDetail.module.css';

const EMPTY_GROUPS = { pending: [], overdue: [], completed: [] };
const PRIORITY_TONE = { high: 'danger', medium: 'warning', low: 'neutral' };
const SECTIONS = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
];

/**
 * The TOC worklist AI Tasks drawer on the phone: the TOC agent's follow-up
 * tasks for one patient (persisted per patient by
 * ensureAiTocTasksForPatient), checked off with updateTask like desktop.
 */
export function AiTasksScreen({ patientId }) {
  const { push } = useMobileNav();
  const patient = useAppStore(s => (s.patients || []).find(p => p.id === patientId));
  const ensureAiTocTasksForPatient = useAppStore(s => s.ensureAiTocTasksForPatient);
  const updateTask = useAppStore(s => s.updateTask);
  const [groups, setGroups] = useState(EMPTY_GROUPS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!patient) return;
    try {
      setGroups(await ensureAiTocTasksForPatient(patient));
    } catch {
      setGroups(buildAiTocTasks(patient));
    }
  }, [patient, ensureAiTocTasksForPatient]);

  useEffect(() => {
    let active = true;
    if (!patient) return undefined;
    ensureAiTocTasksForPatient(patient)
      .then(g => { if (active) setGroups(g); })
      .catch(() => { if (active) setGroups(buildAiTocTasks(patient)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [patient, ensureAiTocTasksForPatient]);

  const shown = useMemo(() => ({
    pending: groups.pending.filter(t => t.status !== 'completed'),
    overdue: groups.overdue.filter(t => t.status !== 'completed'),
    completed: groups.completed,
  }), [groups]);

  // Desktop AiTasksDrawer.toggleComplete.
  const toggle = async (task) => {
    const next = task.status === 'completed' ? 'pending' : 'completed';
    setGroups(g => {
      const all = [...g.pending, ...g.overdue, ...g.completed].map(t => (t.id === task.id ? { ...t, status: next } : t));
      return {
        pending: all.filter(t => t.status !== 'completed' && !t.overdue),
        overdue: all.filter(t => t.status !== 'completed' && t.overdue),
        completed: all.filter(t => t.status === 'completed'),
      };
    });
    await updateTask(task.id, { status: next });
    toast.success(next === 'completed' ? 'Task completed' : 'Task reopened');
    await refresh();
  };

  const total = shown.pending.length + shown.overdue.length + shown.completed.length;

  return (
    <div className={common.screen}>
      <MobileSubHeader title="AI Tasks">
        {patient && <p className={styles.subtitle}>{patient.name}</p>}
      </MobileSubHeader>
      <div className={common.body}>
        {loading ? <MobileListSkeleton count={4} /> : total === 0 ? (
          <MobileEmpty icon="solar:checklist-minimalistic-linear" title="No AI tasks" />
        ) : (
          <div className={styles.stack}>
            {SECTIONS.filter(sec => shown[sec.key].length).map(sec => (
              <div key={sec.key}>
                <p className={styles.sectionLabel}>{sec.label}</p>
                <div className={styles.section}>
                  {shown[sec.key].map(t => {
                    const done = t.status === 'completed';
                    return (
                      <div key={t.id} className={styles.item}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={done}
                          aria-label={`${done ? 'Reopen' : 'Complete'} ${t.title}`}
                          className={styles.iconBtn}
                          onClick={() => toggle(t)}
                        >
                          <Icon name={done ? 'solar:check-circle-linear' : 'solar:record-linear'} size={24} color={done ? 'var(--status-success)' : 'var(--neutral-300)'} />
                        </button>
                        <button type="button" className={`${styles.itemText} ${styles.itemBtn}`} onClick={() => push('taskDetail', { taskId: t.id })}>
                          <span className={styles.itemTitle}>{t.title}</span>
                          <span className={styles.itemMeta}>{[t.due && t.due !== '-' ? `Due ${t.due}` : '', done && t.completedOn ? `Completed ${t.completedOn}` : ''].filter(Boolean).join(' • ')}</span>
                        </button>
                        {t.priority && <Badge size="sm" variant="soft" tone={PRIORITY_TONE[t.priority] || 'neutral'} label={t.priority[0].toUpperCase() + t.priority.slice(1)} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
