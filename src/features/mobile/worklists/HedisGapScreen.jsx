import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../../components/Badge/Badge';
import { BottomSheet, BottomSheetItem } from '../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { Input } from '../../../components/Input/Input';
import { Textarea } from '../../../components/Textarea/Textarea';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { MEASURE_NAMES, STATUSES, initialsOf } from '../../hedis-worklist/CareGapDetailDrawer.utils';
import { CIS_CODE } from '../../hedis-worklist/cis/cisRules';
import { todayIso } from '../../hedis-worklist/useCareGapReminderForm';
import { MobileSubHeader } from '../MobileHeader';
import { MobileEmpty } from '../MobileParts';
import { PickerField } from '../patient/FormScreen';
import { UserPickerSheet } from './UserPickerSheet';
import common from '../mobile.module.css';
import styles from './worklistDetail.module.css';

// Desktop CareGapDetailDrawerHeader's status → Badge tone.
const STATUS_TONE = {
  Open: 'primary',
  Engaged: 'warning',
  'Engaged Requires Follow-Up': 'warning',
  Submitted: 'warning',
  Completed: 'success',
};
const EMPTY = [];
const EMPTY_REMINDER = { title: '', date: '', time: '', assignee: '', note: '' };

const when = (iso) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '';
};
const reminderDate = (r) => {
  const [y, m, d] = String(r.date || '').split('-');
  return y && m && d ? `${m}/${d}/${y}` : '';
};

/**
 * One HEDIS care gap on the phone: the desktop Care Gap Details drawer's
 * header (status and assignee), its Set Reminder pane and its comments.
 * Writes go through the same store actions with the same activity entries.
 * Referrals, clinical notes and evidence stay on desktop.
 */
export function HedisGapScreen({ memberId, code }) {
  const member = useAppStore(s => (s.hedisMembers || []).find(m => m.id === memberId));
  const fetchHedisMembers = useAppStore(s => s.fetchHedisMembers);
  const platformUsers = useAppStore(s => s.platformUsers);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  const me = useAppStore(s => s.currentUserProfile);
  const comments = useAppStore(s => s.caregapComments[memberId]) || EMPTY;
  const fetchCaregapComments = useAppStore(s => s.fetchCaregapComments);
  const reminders = useAppStore(s => s.caregapReminders[memberId]) || EMPTY;
  const fetchCaregapReminders = useAppStore(s => s.fetchCaregapReminders);
  const updateGapStatus = useAppStore(s => s.updateGapStatus);
  const updateGapAssignee = useAppStore(s => s.updateGapAssignee);
  const addCaregapComment = useAppStore(s => s.addCaregapComment);
  const updateCaregapComment = useAppStore(s => s.updateCaregapComment);
  const deleteCaregapComment = useAppStore(s => s.deleteCaregapComment);
  const addCaregapReminder = useAppStore(s => s.addCaregapReminder);
  const logCareGapActivity = useAppStore(s => s.logCareGapActivity);
  const currentActorName = useAppStore(s => s.currentActorName);
  useEffect(() => { fetchHedisMembers?.(); fetchPlatformUsers?.(); fetchCaregapComments?.(); fetchCaregapReminders?.(); },
    [fetchHedisMembers, fetchPlatformUsers, fetchCaregapComments, fetchCaregapReminders]);

  const [sheet, setSheet] = useState(null); // 'status' | 'assignee' | 'reminder' | { comment, mode }
  const [draft, setDraft] = useState('');
  const [reminder, setReminder] = useState(EMPTY_REMINDER);
  const [edit, setEdit] = useState('');

  const gap = (member?.gaps || []).find(g => g.code === code && !g.supersededAt);
  const users = useMemo(() => (platformUsers || []).filter(u => u?.name)
    .map(u => ({ id: u.id, name: u.name, initials: u.initials || initialsOf(u.name), role: (u.clinicalRoles || []).join(', ') })), [platformUsers]);
  const gapReminders = useMemo(() => reminders.filter(r => r.gapCode === code), [reminders, code]);

  if (!member || !gap) {
    return (
      <div className={common.screen}>
        <MobileSubHeader title={code} />
        <div className={common.body}>
          <MobileEmpty icon="solar:clipboard-list-linear" title="Care gap not found" description="It may have been closed or replaced." />
        </div>
      </div>
    );
  }

  const status = gap.status ?? 'Open';
  // Desktop: Completed gaps are locked.
  const statusLocked = status === 'Completed';
  const assignee = gap.assignee ?? member.assignee ?? null;
  const isMine = (c) => !!(c.authorId && me?.id && c.authorId === me.id);

  const pickStatus = (next) => {
    setSheet(null);
    updateGapStatus(member.id, gap.code, next);
  };
  const pickAssignee = (user) => {
    setSheet(null);
    updateGapAssignee(member.id, gap.code, user?.name || null);
    toast.success(user ? `Assigned to ${user.name}` : 'Unassigned');
  };

  const post = () => {
    const body = draft.trim();
    if (!body) return;
    addCaregapComment({ memberId: member.id, gapCode: gap.code, body, mentions: [] });
    setDraft('');
  };

  // Desktop handleSaveReminder (new reminder).
  const reminderOk = !!(reminder.title.trim() && reminder.date && reminder.date >= todayIso());
  const openReminder = () => { setReminder({ ...EMPTY_REMINDER, assignee: currentActorName() || '' }); setSheet('reminder'); };
  const saveReminder = () => {
    if (!reminderOk) return;
    const fields = { title: reminder.title.trim(), date: reminder.date, time: reminder.time, assignee: reminder.assignee, note: reminder.note.trim() };
    const row = {
      id: `cgrem-${new Date().getTime()}`,
      memberId: member.id,
      memberName: member.name,
      gapCode: gap.code,
      createdBy: currentActorName(),
      ...fields,
    };
    addCaregapReminder(row);
    logCareGapActivity(member.id, {
      when: new Date().toISOString(),
      actor: currentActorName(),
      t: 'appointment',
      title: 'Reminder Set',
      gapCodes: [gap.code],
      detailCard: { title: row.title || 'Reminder', subtitle: [reminderDate(row), row.time, row.assignee].filter(Boolean).join(' • '), status: 'Pending' },
    });
    toast.success('Reminder set');
    setSheet(null);
  };

  const commentSheet = sheet && typeof sheet === 'object' ? sheet : null;

  return (
    <div className={common.screen}>
      <MobileSubHeader title={gap.code}>
        <p className={styles.subtitle}>{[MEASURE_NAMES[gap.code], member.name].filter(Boolean).join(' • ')}</p>
      </MobileSubHeader>
      <div className={common.body}>
        <div className={styles.stack}>
          <div className={styles.section}>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Status</span>
              <button
                type="button"
                className={styles.rowBtn}
                disabled={statusLocked}
                aria-label={statusLocked ? `Status: ${status}. Completed gaps are locked` : `Status: ${status}. Change status`}
                onClick={() => setSheet('status')}
              >
                <Badge size="md" tone={STATUS_TONE[status] || 'neutral'} variant="soft" label={status} chevron={!statusLocked || undefined}
                  icon={status === 'Completed' ? 'solar:check-circle-linear' : undefined} />
              </button>
            </div>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Assignee</span>
              <button type="button" className={styles.rowBtn} aria-label={`Assignee: ${assignee || 'Unassigned'}. Change`} onClick={() => setSheet('assignee')}>
                <span className={styles.rowValue}>{assignee || 'Unassigned'}</span>
                <Icon name="solar:alt-arrow-down-linear" size={20} color="var(--neutral-300)" />
              </button>
            </div>
            {gap.startDate && (
              <div className={styles.row}>
                <span className={styles.rowLabel}>Start Date</span>
                <span className={styles.rowValue}>{gap.startDate}</span>
              </div>
            )}
          </div>

          <p className={styles.sectionLabel}>
            Reminders
            <button type="button" className={styles.linkBtn} onClick={openReminder}>Set Reminder</button>
          </p>
          <div className={styles.section}>
            {gapReminders.length === 0 ? <p className={styles.empty}>No reminders for this gap.</p> : gapReminders.map(r => (
              <div key={r.id} className={styles.item}>
                <Icon name="solar:alarm-linear" size={24} color="var(--neutral-300)" />
                <span className={styles.itemText}>
                  <span className={styles.itemTitle}>{r.title || 'Reminder'}</span>
                  <span className={styles.itemMeta}>{[reminderDate(r), r.time, r.assignee].filter(Boolean).join(' • ')}</span>
                </span>
                <Badge size="sm" tone={r.status === 'Completed' ? 'success' : 'warning'} variant="soft" label={r.status || 'Pending'} />
              </div>
            ))}
          </div>

          <p className={styles.note}>
            <Icon name="solar:monitor-linear" size={20} color="currentColor" />
            <span>Open on desktop to send referrals, write clinical notes or upload evidence.</span>
          </p>

          <p className={styles.sectionLabel}>Comments</p>
          <div className={styles.section}>
            {comments.length === 0 ? <p className={styles.empty}>No comments yet.</p> : comments.map(c => (
              <div key={c.id} className={styles.item}>
                <span className={styles.itemText}>
                  <span className={styles.itemMeta}>
                    {[c.author || 'Unknown author', c.gapCode, when(c.createdAt), c.edited ? 'Edited' : ''].filter(Boolean).join(' • ')}
                  </span>
                  <p className={styles.itemBody}>{c.body}</p>
                </span>
                {isMine(c) && (
                  <button type="button" className={styles.iconBtn} aria-label="Comment actions" onClick={() => setSheet({ comment: c, mode: 'menu' })}>
                    <Icon name="solar:menu-dots-linear" size={24} color="currentColor" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className={styles.footer}>
        <Input
          size="lg"
          placeholder="Add a comment"
          aria-label="Add a comment"
          enterKeyHint="send"
          value={draft}
          onValueChange={setDraft}
          onKeyDown={(e) => { if (e.key === 'Enter') post(); }}
        />
        <Button size="lg" disabled={!draft.trim()} onClick={post}>Post</Button>
      </div>

      {sheet === 'status' && (
        <BottomSheet title="Change Status" onClose={() => setSheet(null)}>
          {STATUSES.map(st => {
            // CIS-CMB10 closes only once every Combo 10 dose is met; that
            // check lives in the desktop immunization view.
            const blocked = st === 'Completed' && gap.code === CIS_CODE;
            return (
              <BottomSheetItem
                key={st}
                icon={st === status ? 'solar:check-circle-linear' : 'solar:record-linear'}
                label={st}
                detail={blocked ? 'On desktop' : undefined}
                disabled={blocked}
                onClick={() => (st === status ? setSheet(null) : pickStatus(st))}
              />
            );
          })}
        </BottomSheet>
      )}

      {sheet === 'assignee' && (
        <UserPickerSheet
          title={assignee ? 'Change Assignee' : 'Assign To'}
          users={users}
          current={assignee}
          onPick={pickAssignee}
          onUnassign={() => pickAssignee(null)}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === 'reminder' && (
        <BottomSheet title="Set Reminder" onClose={() => setSheet(null)}>
          <div className={styles.sheetForm}>
            <Input label="Title" required size="lg" placeholder="Reminder title" value={reminder.title} onValueChange={v => setReminder(r => ({ ...r, title: v }))} />
            <div className={styles.pair}>
              <Input label="Date" required type="date" size="lg" isDayDisabled={(iso) => iso < todayIso()} value={reminder.date} onValueChange={v => setReminder(r => ({ ...r, date: v }))} />
              <Input label="Time" type="time" size="lg" value={reminder.time} onValueChange={v => setReminder(r => ({ ...r, time: v }))} />
            </div>
            {reminder.date && reminder.date < todayIso() && <span className={styles.hint}>Reminders are for today or later.</span>}
            <PickerField
              label="Assignee"
              options={[
                ...(reminder.assignee && !users.some(u => u.name === reminder.assignee) ? [{ value: reminder.assignee, label: reminder.assignee }] : []),
                ...users.map(u => ({ value: u.name, label: u.name, detail: u.role })),
              ]}
              value={reminder.assignee}
              onChange={v => setReminder(r => ({ ...r, assignee: v }))}
            />
            <Textarea title="Note" rows={3} placeholder="Add a note" value={reminder.note} onValueChange={v => setReminder(r => ({ ...r, note: v }))} />
            <Button size="lg" fullWidth disabled={!reminderOk} onClick={saveReminder}>Set Reminder</Button>
          </div>
        </BottomSheet>
      )}

      {commentSheet?.mode === 'menu' && (
        <BottomSheet title="Comment" onClose={() => setSheet(null)}>
          <BottomSheetItem icon="solar:pen-linear" label="Edit" onClick={() => { setEdit(commentSheet.comment.body); setSheet({ ...commentSheet, mode: 'edit' }); }} />
          <BottomSheetItem icon="solar:trash-bin-trash-linear" label="Delete" tone="danger" onClick={() => setSheet({ ...commentSheet, mode: 'delete' })} />
        </BottomSheet>
      )}
      {commentSheet?.mode === 'edit' && (
        <BottomSheet title="Edit Comment" onClose={() => setSheet(null)}>
          <div className={styles.sheetForm}>
            <Textarea rows={4} aria-label="Comment" value={edit} onValueChange={setEdit} />
            <Button
              size="lg"
              fullWidth
              disabled={!edit.trim() || edit.trim() === commentSheet.comment.body}
              onClick={() => { updateCaregapComment(member.id, commentSheet.comment.id, edit, []); setSheet(null); }}
            >
              Save
            </Button>
          </div>
        </BottomSheet>
      )}
      {commentSheet?.mode === 'delete' && (
        <BottomSheet title="Delete comment?" onClose={() => setSheet(null)}>
          <p className={styles.hint}>This comment will be removed. A Deleted a Comment entry stays in the Activity log.</p>
          <BottomSheetItem
            icon="solar:trash-bin-trash-linear"
            label="Delete"
            tone="danger"
            onClick={() => { deleteCaregapComment(member.id, commentSheet.comment.id); toast.success('Comment deleted'); setSheet(null); }}
          />
          <BottomSheetItem icon="solar:close-circle-linear" label="Cancel" onClick={() => setSheet(null)} />
        </BottomSheet>
      )}
    </div>
  );
}
