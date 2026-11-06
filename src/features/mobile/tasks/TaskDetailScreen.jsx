import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Badge } from '../../../components/Badge/Badge';
import { BottomSheet } from '../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { Input } from '../../../components/Input/Input';
import { PriorityIcon } from '../../../components/PriorityIcon/PriorityIcon';
import { Textarea } from '../../../components/Textarea/Textarea';
import { toast } from '../../../components/Toast/sonnerToast';
import { sanitizeRichText } from '../../../lib/sanitizeHtml';
import { useAppStore } from '../../../store/useAppStore';
import {
  AUDIT_LOG_VERB_MAP, LABEL_OPTIONS, PRIORITY_LABELS, PRIORITY_OPTIONS, STATUS_LABELS, STATUS_ORDER, TITLE_MAX, parseTaskDate, todayMMDDYYYY,
} from '../../tasks/TasksView.utils';
import { MobileEmpty, MobileListSkeleton } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { initialsOf, listStamp, patientLine, timeOf } from '../mobileFormat';
import { ChoiceList } from './ChoiceList';
import { isPoolTask } from './myTasks';
import common from '../mobile.module.css';
import styles from './TaskDetailScreen.module.css';

const ACTIVITY_VIEWS = ['All', 'Comments', 'History'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUS_ICONS = {
  pending: 'solar:clock-circle-linear',
  missed: 'solar:danger-circle-linear',
  completed: 'solar:check-circle-linear',
};
const NO_POOL = '__none__';
const pad2 = (n) => String(n).padStart(2, '0');
// The date field speaks ISO (YYYY-MM-DD); tasks store MM-DD-YYYY.
const toIso = (d) => (d ? `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` : '');
const isoToTaskDate = (iso) => {
  const [y, m, d] = String(iso || '').split('-');
  return y && m && d ? `${m}-${d}-${y}` : '';
};

const shortDate = (d) => (d ? `${d.getDate()} ${MONTHS[d.getMonth()]}` : '');
const longDate = (d) => (d ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '');

/**
 * Task preview (Figma Task Details 1045:49218, completed 1050:51278): title,
 * description, subtasks, additional details, activity and comments, with
 * Mark as completed pinned to the bottom. Reads and writes the same
 * `tasks` and `task_audit_log` rows as the desktop TaskDetailDrawer.
 */
export function TaskDetailScreen({ taskId }) {
  const { push, pop, openMember } = useMobileNav();
  const task = useAppStore(s => (s.tasks || []).find(t => String(t.id) === String(taskId)) || null);
  const allTasks = useAppStore(s => s.tasks);
  const loading = useAppStore(s => s.tasksLoading);
  const fetchTasks = useAppStore(s => s.fetchTasks);
  const updateTask = useAppStore(s => s.updateTask);
  const deleteTask = useAppStore(s => s.deleteTask);
  const createTask = useAppStore(s => s.createTask);
  const logTaskAudit = useAppStore(s => s.logTaskAudit);
  const fetchTaskAuditLog = useAppStore(s => s.fetchTaskAuditLog);
  const auditLog = useAppStore(s => s.taskAuditLogs[taskId]);
  const me = useAppStore(s => s.currentUserProfile);
  const allPatients = useAppStore(s => s.allPatients);
  const platformUsers = useAppStore(s => s.platformUsers);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  const taskProfiles = useAppStore(s => s.taskProfiles);
  const fetchTaskProfiles = useAppStore(s => s.fetchTaskProfiles);
  const taskPools = useAppStore(s => s.taskPools);
  const fetchTaskPools = useAppStore(s => s.fetchTaskPools);
  const claimTask = useAppStore(s => s.claimTask);

  // 'priority' | 'activity' | 'subtask' | 'edit' | 'delete' | 'assignee' | 'due' | 'pool' | 'status' | 'labels'
  const [sheet, setSheet] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [activityView, setActivityView] = useState('Comments');
  const [busy, setBusy] = useState(false);
  const [commentKey, setCommentKey] = useState(0);
  const [comment, setComment] = useState({ text: '', mentions: [] });

  useEffect(() => { fetchTasks(); }, [fetchTasks]);
  useEffect(() => { if (taskId != null) fetchTaskAuditLog(taskId); }, [taskId, fetchTaskAuditLog]);
  useEffect(() => { fetchPlatformUsers?.(); }, [fetchPlatformUsers]);
  useEffect(() => { fetchTaskProfiles?.(); fetchTaskPools?.(); }, [fetchTaskProfiles, fetchTaskPools]);

  const subtasks = useMemo(
    () => (allTasks || []).filter(t => task && t.parent_task_id === task.id),
    [allTasks, task],
  );
  const log = useMemo(() => auditLog || [], [auditLog]);
  const entries = useMemo(() => log.filter(l => (
    activityView === 'All'
    || (activityView === 'Comments' ? l.action_type === 'comment_added' : l.action_type !== 'comment_added')
  )), [log, activityView]);
  // Who a task can go to: you first, then everyone in taskProfiles (as the
  // desktop drawer's Assigned To list).
  const assigneeNames = useMemo(() => {
    const seen = new Set();
    const list = [];
    if (me?.name) { list.push(me.name); seen.add(me.name); }
    (taskProfiles || []).forEach(p => { if (p.name && !seen.has(p.name)) { list.push(p.name); seen.add(p.name); } });
    return list;
  }, [me, taskProfiles]);
  const mentionUsers = useMemo(() => (platformUsers || []).map(u => ({
    ...u, realProfile: true, initials: u.initials || initialsOf(u.name),
  })), [platformUsers]);

  if (!task) {
    return (
      <div className={common.screen}>
        <Header onBack={pop} />
        <div className={styles.body}>
          {loading ? <MobileListSkeleton count={3} /> : <MobileEmpty icon="solar:checklist-minimalistic-linear" title="Task not found" />}
        </div>
      </div>
    );
  }

  const done = task.status === 'completed';
  const openSubs = subtasks.filter(t => t.status !== 'completed').length;
  // Who completed it: the latest status change to completed in the audit log.
  const completedBy = done ? log.find(l => l.action_type === 'status_changed' && l.to_value === 'completed')?.user_name : null;
  const patient = (allPatients || []).find(p => (task.patient_id && String(p.id) === String(task.patient_id)) || p.name === task.member);
  const due = parseTaskDate(task.due_date);
  const labels = Array.isArray(task.labels) ? task.labels : [];

  const complete = async () => {
    if (openSubs > 0) {
      toast.error(`Complete the ${openSubs} open subtask${openSubs > 1 ? 's' : ''} first.`);
      return;
    }
    setBusy(true);
    let ok;
    try { ok = await updateTask(task.id, { status: 'completed' }); } finally { setBusy(false); }
    if (ok) toast.success('Task completed');
    else toast.error('Could not complete the task.');
  };

  // The edits below send the same patches and toasts as the desktop
  // TaskDetailDrawer; updateTask writes the matching task_audit_log rows.
  // It resolves false when the write fails, so success toasts wait for it.
  const save = async (patch, onSaved) => {
    if (await updateTask(task.id, patch)) onSaved();
    else toast.error('Could not save the change.');
  };

  const setAssignee = (name) => {
    setSheet(null);
    if (name === task.assigned_to) return;
    const picked = (taskProfiles || []).find(p => p.name === name);
    // An owner and a pool are mutually exclusive (desktop claim semantics).
    save({ assigned_to: name, assigned_to_id: picked?.id || (name === me?.name ? me?.id || null : null), pool: null },
      () => toast.success(`Assigned to ${name}`));
  };

  const setDue = (iso) => {
    setSheet(null);
    const next = isoToTaskDate(iso);
    if (!next || next === task.due_date) return;
    save({ due_date: next }, () => toast.success('Due date updated'));
  };

  const setPool = (key) => {
    setSheet(null);
    const next = key === NO_POOL ? null : key;
    if (next === (task.pool || null)) return;
    // A pooled task is unclaimed by definition, so pooling drops the assignee.
    save(next ? { pool: next, assigned_to: null, assigned_to_id: null } : { pool: null },
      () => toast.success(next ? `Pool set to ${next}` : 'Removed from pool'));
  };

  const setStatus = (status) => {
    setSheet(null);
    if (status === task.status) return;
    if (status === 'completed' && openSubs > 0) {
      toast.error(`Cannot complete: ${openSubs} subtask(s) still open`);
      return;
    }
    save({ status }, () => {
      const msg = `Status changed to ${STATUS_LABELS[status]}`;
      if (status === 'completed') toast.success(msg);
      else if (status === 'missed') toast.error(msg);
      else toast.info(msg);
    });
  };

  const toggleLabel = (label) => {
    if (labels.includes(label)) {
      save({ labels: labels.filter(x => x !== label) }, () => toast.success(`Label "${label}" removed`));
    } else {
      save({ labels: [...labels, label] }, () => toast.success(`Label "${label}" added`));
    }
  };

  const claim = async () => {
    setBusy(true);
    let ok;
    try { ok = await claimTask(task.id); } finally { setBusy(false); }
    if (ok) toast.success('Task claimed');
    else toast.error('Could not claim the task.');
  };

  const setPriority = (priority) => {
    setSheet(null);
    if (priority !== task.priority) updateTask(task.id, { priority });
  };

  const toggleSub = (sub) => updateTask(sub.id, { status: sub.status === 'completed' ? 'pending' : 'completed' });

  const addSubtask = async (name) => {
    const created = await createTask({
      name: name.slice(0, TITLE_MAX),
      status: 'pending',
      priority: task.priority || 'medium',
      due_date: task.due_date || todayMMDDYYYY(),
      assigned_to: task.assigned_to || me?.name,
      assigned_to_id: task.assigned_to_id || me?.id || null,
      member: task.member,
      patient_id: task.patient_id || null,
      labels: [],
      parent_task: task.name,
      parent_task_id: task.id,
      is_subtask: true,
      attachments: 0,
      comments: 0,
      meta: '',
      description: '',
      pool: null,
      mentions: [],
    });
    if (!created) return false;
    logTaskAudit(task.id, 'subtask_added', { to: name });
    toast.success('Subtask added');
    return true;
  };

  const saveEdit = async ({ name, description }) => {
    const patch = {};
    if (name && name !== task.name) patch.name = name.slice(0, TITLE_MAX);
    if (description !== (task.description || '')) patch.description = description;
    if (!Object.keys(patch).length) return true;
    const ok = await updateTask(task.id, patch);
    if (ok) toast.success('Task updated');
    else toast.error('Could not save the task.');
    return ok;
  };

  const remove = async () => {
    setBusy(true);
    let ok;
    try { ok = await deleteTask(task.id); } finally { setBusy(false); }
    if (ok) {
      toast.success('Task deleted');
      setSheet(null);
      pop();
    } else {
      toast.error('Could not delete the task.');
    }
  };

  const postComment = () => {
    const text = comment.text.trim();
    if (!text) return;
    logTaskAudit(task.id, 'comment_added', { to: text });
    const names = comment.mentions.map(m => m.name).filter(Boolean);
    const ids = comment.mentions.map(m => m.id).filter(Boolean);
    if (names.length || ids.length) {
      const patch = {};
      if (names.length) patch.mentions = [...new Set([...(task.mentions || []), ...names])];
      if (ids.length) patch.mention_ids = [...new Set([...(task.mention_ids || []), ...ids])];
      updateTask(task.id, patch);
    }
    setComment({ text: '', mentions: [] });
    setCommentKey(k => k + 1);
  };

  return (
    <div className={common.screen}>
      <Header
        onBack={pop}
        actions={(
          <>
            {!done && <ActionButton icon="solar:pen-linear" size="lg" aria-label="Edit task" onClick={() => setSheet('edit')} />}
            <ActionButton icon="solar:trash-bin-trash-linear" size="lg" aria-label="Delete task" onClick={() => setSheet('delete')} />
          </>
        )}
      />

      <div className={styles.body}>
        {done && (
          <div className={styles.banner} role="status">
            <Icon name="solar:check-read-linear" size={24} color="currentColor" />
            <span className={styles.bannerLabel}>Completed</span>
            {completedBy && <span className={styles.bannerBy}>By {completedBy}</span>}
          </div>
        )}

        <div className={styles.content}>
          <div className={styles.group}>
            <section className={styles.field}>
              <h2 className={styles.caps}>Title</h2>
              <div className={styles.titleRow}>
                <p className={styles.title}>{task.name}</p>
                <button
                  type="button"
                  className={styles.priority}
                  aria-label={`Priority: ${PRIORITY_LABELS[task.priority] || 'None'}`}
                  onClick={() => setSheet('priority')}
                  disabled={done}
                >
                  <PriorityIcon priority={task.priority || 'none'} size={24} />
                </button>
              </div>
            </section>
            <section className={styles.field}>
              <h2 className={styles.caps}>Description</h2>
              {task.description
                ? <div className={styles.description} dangerouslySetInnerHTML={{ __html: sanitizeRichText(task.description) }} />
                : <p className={styles.placeholder}>No description</p>}
            </section>
          </div>

          <hr className={styles.divider} />

          <section className={styles.subtasks}>
            <div className={styles.sectionHead}>
              <h2 className={styles.caps}>Subtasks</h2>
              {!done && (
                <button type="button" className={styles.link} onClick={() => setSheet('subtask')}>
                  <Icon name="solar:add-linear" size={20} color="currentColor" />
                  Add
                </button>
              )}
            </div>
            {subtasks.map(sub => (
              <SubtaskCard
                key={sub.id}
                sub={sub}
                onToggle={() => toggleSub(sub)}
                onOpen={() => push('taskDetail', { taskId: sub.id })}
              />
            ))}
          </section>

          <hr className={styles.divider} />

          <section className={styles.details}>
            <div className={styles.sectionHead}>
              <h2 className={styles.caps}>Additional Details</h2>
              <button type="button" className={styles.link} aria-expanded={showDetails} onClick={() => setShowDetails(v => !v)}>
                {showDetails ? 'Hide Details' : 'View Details'}
                <span className={styles.linkDivider} aria-hidden="true" />
                <Icon name={showDetails ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'} size={16} color="currentColor" />
              </button>
            </div>
            {showDetails && (
              <>
                {task.member && (
                  <div className={styles.detailRow}>
                    <Avatar variant="patient" size="L" initials={initialsOf(task.member)} />
                    <span className={styles.detailText}>
                      <span className={styles.detailMain}>{task.member}</span>
                      {patientLine(patient) && <span className={styles.detailSub}>{patientLine(patient)}</span>}
                    </span>
                    <ActionButton
                      icon="solar:square-top-down-linear"
                      size="lg"
                      aria-label={`Open ${task.member}'s profile`}
                      onClick={() => openMember({ id: patient?.id ?? task.patient_id, name: task.member })}
                    />
                  </div>
                )}
                <Detail label="Due date" icon="solar:calendar-minimalistic-linear" onEdit={() => setSheet('due')}>{due ? longDate(due) : 'No due date'}</Detail>
                <Detail label="Assignee" onEdit={() => setSheet('assignee')}>{task.assigned_to || 'Unassigned'}</Detail>
                <Detail label="Task pool" onEdit={() => setSheet('pool')}>{task.pool || 'None'}</Detail>
                <Detail label="Status" icon={STATUS_ICONS[task.status]} onEdit={() => setSheet('status')}>{STATUS_LABELS[task.status] || task.status}</Detail>
                <div className={styles.detail}>
                  <h3 className={styles.caps}>Labels</h3>
                  <button type="button" className={`${styles.labels} ${styles.editRow}`} aria-label={`Labels: ${labels.join(', ') || 'none'}. Edit labels`} onClick={() => setSheet('labels')}>
                    {labels.length
                      ? labels.map(l => <Badge key={l} tone="neutral" variant="soft" size="lg" label={l} />)
                      : <span className={styles.detailMain}>Add labels</span>}
                    <Icon name="solar:alt-arrow-right-linear" size={16} className={styles.chevron} />
                  </button>
                </div>
                {task.created_by && <Detail label="Created by">{task.created_by}</Detail>}
              </>
            )}
          </section>

          <hr className={styles.divider} />

          <section className={styles.activity}>
            <div className={styles.sectionHead}>
              <h2 className={styles.caps}>Activity</h2>
              <button type="button" className={styles.link} aria-haspopup="dialog" onClick={() => setSheet('activity')}>
                {activityView}
                <span className={styles.linkDivider} aria-hidden="true" />
                <Icon name="solar:alt-arrow-down-linear" size={16} color="currentColor" />
              </button>
            </div>
            <Textarea
              key={commentKey}
              className={styles.composer}
              richText
              mentions
              mentionUsers={mentionUsers}
              placeholder="Add a comment"
              aria-label="Add a comment"
              onValueChange={(_html, plain) => setComment(c => ({ ...c, text: plain ?? '' }))}
              onMentionsChange={(m) => setComment(c => ({ ...c, mentions: m || [] }))}
              bottomButton={{ label: 'Comment', onClick: postComment, disabled: !comment.text.trim() }}
            />
            {entries.length > 0 && (
              <ul className={styles.entries}>
                {entries.map(e => <ActivityEntry key={e.id} entry={e} />)}
              </ul>
            )}
            {entries.length === 0 && (
              <p className={styles.placeholder}>{activityView === 'Comments' ? 'No comments yet' : 'No activity yet'}</p>
            )}
          </section>
        </div>
      </div>

      {(!done || isPoolTask(task)) && (
        <div className={`${styles.footer} ${styles.footerRow}`}>
          {isPoolTask(task) && (
            <Button size="lg" variant={done ? 'solid' : 'outline'} fullWidth disabled={busy} onClick={claim}>Claim Task</Button>
          )}
          {!done && <Button size="lg" fullWidth disabled={busy} onClick={complete}>Mark as completed</Button>}
        </div>
      )}

      {sheet === 'priority' && (
        <BottomSheet title="Priority" onClose={() => setSheet(null)}>
          <ChoiceList
            label="Priority"
            options={PRIORITY_OPTIONS.map(p => ({ key: p, label: PRIORITY_LABELS[p], icon: <PriorityIcon priority={p} size={24} /> }))}
            value={task.priority}
            onPick={setPriority}
          />
        </BottomSheet>
      )}
      {sheet === 'activity' && (
        <BottomSheet title="Activity" onClose={() => setSheet(null)}>
          <ChoiceList
            label="Activity"
            options={ACTIVITY_VIEWS.map(v => ({ key: v, label: v }))}
            value={activityView}
            onPick={(v) => { setActivityView(v); setSheet(null); }}
          />
        </BottomSheet>
      )}
      {sheet === 'assignee' && (
        <BottomSheet title="Assignee" onClose={() => setSheet(null)}>
          <ChoiceList
            label="Assignee"
            options={assigneeNames.map(n => ({
              key: n,
              label: n === me?.name ? `${n} (You)` : n,
              icon: <Avatar variant="staff" size="L" initials={initialsOf(n)} userName={n} />,
            }))}
            value={task.assigned_to}
            onPick={setAssignee}
          />
        </BottomSheet>
      )}
      {sheet === 'due' && (
        <DueSheet value={toIso(due)} onClose={() => setSheet(null)} onSave={setDue} />
      )}
      {sheet === 'pool' && (
        <BottomSheet title="Task Pool" onClose={() => setSheet(null)}>
          <ChoiceList
            label="Task pool"
            options={[{ key: NO_POOL, label: 'None' }, ...(taskPools || []).map(p => ({ key: p.name, label: p.name }))]}
            value={task.pool || NO_POOL}
            onPick={setPool}
          />
        </BottomSheet>
      )}
      {sheet === 'status' && (
        <BottomSheet title="Status" onClose={() => setSheet(null)}>
          <ChoiceList
            label="Status"
            options={STATUS_ORDER.map(st => ({ key: st, label: STATUS_LABELS[st], icon: <Icon name={STATUS_ICONS[st]} size={24} color="currentColor" /> }))}
            value={task.status}
            onPick={setStatus}
          />
        </BottomSheet>
      )}
      {sheet === 'labels' && (
        <BottomSheet title="Labels" onClose={() => setSheet(null)}>
          <ChoiceList
            label="Labels"
            options={[...new Set([...LABEL_OPTIONS, ...labels])].map(l => ({ key: l, label: l, icon: <Icon name="solar:tag-linear" size={24} color="currentColor" /> }))}
            value={labels}
            onPick={toggleLabel}
          />
        </BottomSheet>
      )}
      {sheet === 'subtask' && (
        <SubtaskSheet onClose={() => setSheet(null)} onAdd={addSubtask} />
      )}
      {sheet === 'edit' && (
        <EditSheet task={task} onClose={() => setSheet(null)} onSave={saveEdit} />
      )}
      {sheet === 'delete' && (
        <BottomSheet title="Delete Task?" onClose={() => setSheet(null)}>
          <p className={styles.sheetText}>
            {subtasks.length > 0
              ? `"${task.name}" and its ${subtasks.length} subtask${subtasks.length > 1 ? 's' : ''} will be deleted. This can't be undone.`
              : `"${task.name}" will be deleted. This can't be undone.`}
          </p>
          <Button size="lg" variant="soft" tone="danger" fullWidth disabled={busy} onClick={remove}>Delete</Button>
        </BottomSheet>
      )}
    </div>
  );
}

function Header({ onBack, actions }) {
  return (
    <header className={styles.header}>
      <button type="button" className={common.iconBtn} aria-label="Back" onClick={onBack}>
        <Icon name="solar:arrow-left-linear" size={24} />
      </button>
      <div className={styles.headerRow}>
        <h1 className={styles.headerTitle}>Task Details</h1>
        {actions && <div className={styles.headerActions}>{actions}</div>}
      </div>
    </header>
  );
}

function SubtaskCard({ sub, onToggle, onOpen }) {
  const done = sub.status === 'completed';
  const due = parseTaskDate(sub.due_date);
  return (
    <div className={styles.subtask}>
      <div className={styles.subtaskMain}>
        <button
          type="button"
          className={[styles.check, done ? styles.checked : ''].filter(Boolean).join(' ')}
          role="checkbox"
          aria-checked={done}
          aria-label={done ? `Reopen ${sub.name}` : `Complete ${sub.name}`}
          onClick={onToggle}
        >
          {done && <Icon name="solar:check-read-linear" size={16} color="currentColor" />}
        </button>
        <button type="button" className={[styles.subtaskName, done ? styles.subtaskDone : ''].filter(Boolean).join(' ')} onClick={onOpen}>
          {sub.name}
        </button>
      </div>
      {(sub.assigned_to || due) && (
        <div className={styles.subtaskMeta}>
          {sub.assigned_to && <Badge tone="neutral" variant="soft" size="lg" icon="solar:user-linear" label={sub.assigned_to} />}
          {due && <Badge tone="neutral" variant="soft" size="lg" icon="solar:calendar-minimalistic-linear" label={shortDate(due)} />}
        </div>
      )}
    </div>
  );
}

/** A detail; with `onEdit` its value is a row that opens a picker. */
function Detail({ label, icon, onEdit, children }) {
  const inner = (
    <>
      {icon && <Icon name={icon} size={24} />}
      <span className={styles.detailMain}>{children}</span>
      {onEdit && <Icon name="solar:alt-arrow-right-linear" size={16} className={styles.chevron} />}
    </>
  );
  return (
    <div className={styles.detail}>
      <h3 className={styles.caps}>{label}</h3>
      {onEdit ? (
        <button type="button" className={`${styles.detailValue} ${styles.editRow}`} aria-label={`${label}: ${typeof children === 'string' ? children : ''}. Change`} onClick={onEdit}>
          {inner}
        </button>
      ) : (
        <div className={styles.detailValue}>{inner}</div>
      )}
    </div>
  );
}

function DueSheet({ value, onClose, onSave }) {
  const [iso, setIso] = useState(value);
  return (
    <BottomSheet title="Due Date" onClose={onClose}>
      <div className={styles.sheetForm}>
        <Input type="date" size="lg" aria-label="Due date" value={iso} onValueChange={setIso} />
        <Button size="lg" fullWidth disabled={!iso || iso === value} onClick={() => onSave(iso)}>Save</Button>
      </div>
    </BottomSheet>
  );
}

function ActivityEntry({ entry }) {
  const actor = entry.user_name || 'System';
  const comment = entry.action_type === 'comment_added';
  const stamp = listStamp(entry.created_at);
  const when = stamp && stamp !== timeOf(entry.created_at) ? `${stamp} • ${timeOf(entry.created_at)}` : stamp;
  const verb = AUDIT_LOG_VERB_MAP[entry.action_type] || entry.action_type;
  return (
    <li className={styles.entry}>
      <Avatar variant="staff" size="XS" initials={initialsOf(actor)} userName={actor} />
      <div className={styles.entryText}>
        <div className={styles.entryHead}>
          <span className={styles.entryName}>{actor}</span>
          {when && <span className={styles.entryDivider} aria-hidden="true" />}
          {when && <span className={styles.entryTime}>{when}</span>}
        </div>
        <p className={styles.entryBody}>{comment ? entry.to_value : `${verb[0].toUpperCase()}${verb.slice(1)}${entry.to_value && entry.action_type !== 'created' ? `: ${entry.to_value}` : ''}`}</p>
      </div>
    </li>
  );
}

function SubtaskSheet({ onClose, onAdd }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    let ok;
    try { ok = await onAdd(trimmed); } finally { setSaving(false); }
    if (ok) onClose();
  };
  return (
    <BottomSheet title="Add Subtask" onClose={onClose}>
      <div className={styles.sheetForm}>
        <Input
          size="lg"
          autoFocus
          placeholder="Subtask title"
          aria-label="Subtask title"
          enterKeyHint="done"
          maxLength={TITLE_MAX}
          value={name}
          onValueChange={setName}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        />
        <Button size="lg" fullWidth disabled={!name.trim() || saving} onClick={submit}>Add Subtask</Button>
      </div>
    </BottomSheet>
  );
}

function EditSheet({ task, onClose, onSave }) {
  const [name, setName] = useState(task.name || '');
  // The editor keeps its own text; only Save reads it, so no re-render per keystroke.
  const description = useRef(task.description || '');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    let ok;
    try { ok = await onSave({ name: name.trim(), description: description.current }); } finally { setSaving(false); }
    if (ok) onClose();
  };
  return (
    <BottomSheet title="Edit Task" onClose={onClose}>
      <div className={styles.sheetForm}>
        <Input size="lg" aria-label="Title" placeholder="Title" maxLength={TITLE_MAX} value={name} onValueChange={setName} />
        <Textarea
          richText
          placeholder="Description"
          aria-label="Description"
          defaultValue={task.description || ''}
          onValueChange={(html) => { description.current = html; }}
        />
        <Button size="lg" fullWidth disabled={!name.trim() || saving} onClick={submit}>Save</Button>
      </div>
    </BottomSheet>
  );
}
