import { useMemo, useState } from 'react';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Banner } from '../../../components/Banner/Banner';
import { BottomSheet } from '../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { Input } from '../../../components/Input/Input';
import { Switch } from '../../../components/Switch/Switch';
import { Textarea } from '../../../components/Textarea/Textarea';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import {
  DEFAULT_AUTO_REPLY, appointmentsToReassign, canDelete, capFirst, overlapPlan, rangeChange, validateOoo,
} from '../../ooo/oooUtils';
import { MobileSubHeader } from '../MobileHeader';
import { useMobileNav } from '../MobileNavContext';
import common from '../mobile.module.css';
import styles from './ooo.module.css';

const pad = (n) => String(n).padStart(2, '0');
// ISO <-> the native datetime-local value ("YYYY-MM-DDTHH:MM", local time).
const toLocal = (v) => {
  const d = v ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocal = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(s || ''));
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).toISOString() : null;
};
const valuesOf = (r, me) => ({
  userName: r?.userName || me?.name || '',
  userEmail: r?.userEmail || me?.email || '',
  userRole: r?.userRole || me?.role || '',
  userId: r?.userId || me?.id || null,
  startAt: r?.startAt || null,
  endAt: r?.endAt || null,
  reason: r?.reason || '',
  autoReply: !!r?.autoReply,
  autoReplyMessage: r?.autoReplyMessage || DEFAULT_AUTO_REPLY,
});

/**
 * New / Edit Out of Office Record for the signed-in user. Same fields,
 * validation and saves as the desktop OooRecordDrawer (saveOooRecord,
 * restoreReassignedAppointments, deleteOooRecord). Reassigning the
 * appointments on new dates is a desktop step; this screen says so.
 */
export function OooFormScreen({ recordId }) {
  const { pop } = useMobileNav();
  const me = useAppStore(s => s.currentUserProfile);
  const oooRecords = useAppStore(s => s.oooRecords);
  const saveOooRecord = useAppStore(s => s.saveOooRecord);
  const deleteOooRecord = useAppStore(s => s.deleteOooRecord);
  const restoreReassigned = useAppStore(s => s.restoreReassignedAppointments);
  // The record being edited; Edit Existing (overlap) switches to another.
  const [record, setRecord] = useState(() => (recordId ? (oooRecords || []).find(r => r.id === recordId) || null : null));
  const [values, setValues] = useState(() => valuesOf(record, me));
  const [restore, setRestore] = useState(true);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (patch) => setValues(v => ({ ...v, ...patch }));

  const isEdit = !!record;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const origStart = isEdit ? new Date(record.startAt).getTime() : NaN;
  const started = isEdit && origStart <= now.getTime();
  const startLocked = started && origStart < todayStart;
  const startedToday = started && !startLocked;

  const errors = validateOoo(values, { original: record, existing: oooRecords });
  const hasErrors = Object.keys(errors).length > 0 || !values.userName;
  const change = rangeChange(record, values);
  const sameTime = (a, b) => (!a && !b) || (!!a && !!b && new Date(a).getTime() === new Date(b).getTime());
  const dirty = !isEdit || !sameTime(values.startAt, record.startAt) || !sameTime(values.endAt, record.endAt)
    || ['reason', 'autoReply', 'autoReplyMessage']
      .some(k => (values[k] || '') !== (record[k] || '') && !(k === 'autoReplyMessage' && !values.autoReply && !record.autoReply));
  const needsReassign = !isEdit || change.extended;

  const overlap = useMemo(() => overlapPlan(values, oooRecords, record?.id), [values, oooRecords, record?.id]);
  const partial = !isEdit && !!overlap?.gaps.length;
  const freeTime = overlap?.gaps.reduce((a, g) => (!a || g.to - g.from > a.to - a.from ? g : a), null);
  const overlapError = values.startAt && values.endAt ? errors.overlap : undefined;
  const err = (k) => (touched ? errors[k] : undefined);

  const editExisting = () => {
    const r = (overlap.extend.find(x => x.endAt !== x.record.endAt) || overlap.extend[0]).record;
    setRecord(r);
    setValues(valuesOf(r, me));
    setTouched(false);
  };

  const save = async () => {
    setTouched(true);
    if (hasErrors) return;
    setSaving(true);
    try {
      const saved = await saveOooRecord({
        ...record,
        ...values,
        reason: capFirst(values.reason.trim()),
        autoReplyMessage: values.autoReply ? values.autoReplyMessage.trim() : '',
      });
      if (!saved) return;
      // Dates taken off the record: move appointments reassigned away for
      // them back to you (from now on), if asked to.
      if (isEdit && change.reduced && restore) {
        const os = new Date(record.startAt).getTime(), oe = new Date(record.endAt).getTime();
        const ns = new Date(saved.startAt).getTime(), ne = new Date(saved.endAt).getTime();
        const removed = [
          ns > os && { from: os, to: Math.min(ns, oe) },
          ne < oe && { from: Math.max(ne, os), to: oe },
        ].filter(Boolean);
        if (removed.length) await restoreReassigned({ id: saved.userId, name: saved.userName }, removed);
      }
      if (needsReassign && !(useAppStore.getState().appointments || []).length) await useAppStore.getState().fetchAppointments?.();
      const toMove = needsReassign && appointmentsToReassign(saved, useAppStore.getState().appointments).length > 0;
      toast.success(toMove
        ? 'Out of Office Record Saved. Reassign Appointments From Fold Health on a Computer.'
        : 'Out of Office Record Saved Successfully');
      pop();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      const ok = await deleteOooRecord(record.id);
      if (ok) {
        await restoreReassigned({ id: record.userId, name: record.userName },
          [{ from: new Date(record.startAt).getTime(), to: new Date(record.endAt).getTime() }]);
        toast.success('Out of Office Record Deleted Successfully');
        setConfirmDelete(false);
        pop();
      }
    } finally {
      setSaving(false);
    }
  };

  const minLocal = toLocal(new Date(todayStart).toISOString());
  const providerLabel = values.userName ? `${values.userName}${values.userEmail ? ` (${values.userEmail})` : ''}` : '';

  return (
    <div className={common.screen}>
      <MobileSubHeader
        title={isEdit ? 'Edit Out of Office' : 'New Out of Office'}
        actions={isEdit && canDelete(record) ? (
          <ActionButton icon="solar:trash-bin-trash-linear" size="lg" aria-label="Delete OOO record" onClick={() => setConfirmDelete(true)} />
        ) : null}
      />
      <div className={`${common.body} ${styles.formBody}`}>
        <div className={styles.form}>
          {!isEdit && (
            <Banner tone="info" size="sm">Mark yourself out of office for the dates below. Appointments on these dates (if any) are reassigned from Fold Health on a computer.</Banner>
          )}
          {isEdit && change.extended && (
            <Banner icon="solar:info-circle-linear" tone="warning" size="sm">Appointments on the newly added dates can be reassigned from Fold Health on a computer once you save.</Banner>
          )}

          <Input label="Provider" size="lg" required value={providerLabel} disabled readOnly />

          <Input
            label="Start Date & Time"
            required
            size="lg"
            type="datetime-local"
            min={startLocked ? undefined : minLocal}
            value={toLocal(values.startAt)}
            onValueChange={(v) => set({ startAt: fromLocal(v) })}
            disabled={startLocked}
            invalid={!!overlapError}
            errorText={err('startAt')}
            helperText={startLocked ? "Started on a previous day, so the start can't be changed." : undefined}
          />
          <Input
            label="End Date & Time"
            required
            size="lg"
            type="datetime-local"
            min={values.startAt && (!started || new Date(values.startAt) > now) ? toLocal(values.startAt) : minLocal}
            value={toLocal(values.endAt)}
            onValueChange={(v) => set({ endAt: fromLocal(v) })}
            invalid={!!overlapError}
            errorText={err('endAt')}
          />

          {overlapError && !partial && <p className={styles.rowError} role="alert">{overlapError}</p>}
          {overlapError && partial && (
            <div className={styles.overlapCard} role="alert">
              <span className={styles.overlapHead}>
                <Icon name="solar:info-circle-linear" size={24} color="var(--status-warning)" />
                You're already out of office for some of these dates.
              </span>
              <p className={styles.overlapText}>Extend that record to cover the rest, or create a new one for the remaining dates.</p>
              <div className={styles.overlapActions}>
                <Button size="lg" fullWidth disabled={saving || !overlap.extend.length} onClick={editExisting}>Edit Existing</Button>
                <Button
                  size="lg"
                  variant="outline"
                  fullWidth
                  disabled={saving || !freeTime}
                  onClick={() => set({ startAt: new Date(freeTime.from).toISOString(), endAt: new Date(freeTime.to).toISOString() })}
                >
                  Create New
                </Button>
              </div>
            </div>
          )}

          {isEdit && change.reduced && (
            <div className={styles.optionCard}>
              <span className={styles.optionText}>
                <span className={styles.optionTitle}>You have updated the Out of Office schedule</span>
                <span className={styles.optionSub}>Move reassigned appointments on removed dates back to your calendar</span>
              </span>
              <Switch checked={restore} onChange={setRestore} ariaLabel="Move reassigned appointments on removed dates back to your calendar" />
              {startedToday && (
                <span className={styles.optionNote}>Only upcoming appointments will be restored as out of office period has started.</span>
              )}
            </div>
          )}

          <Input
            label="Reason for Out of Office"
            size="lg"
            value={values.reason}
            placeholder="e.g. Personal, Annual Leave"
            maxLength={120}
            enterKeyHint="done"
            onValueChange={(v) => set({ reason: capFirst(v) })}
          />

          <div className={styles.optionCard}>
            <span className={styles.optionText}>
              <span className={styles.optionTitle}>Enable Auto Reply For Chats</span>
              <span className={styles.optionSub}>Reply automatically when you are away from the work.</span>
            </span>
            <Switch checked={values.autoReply} onChange={(on) => set({ autoReply: on })} ariaLabel="Enable auto reply for chats" />
            {values.autoReply && (
              <div className={styles.optionField}>
                <Textarea
                  rows={3}
                  title="Set Auto Reply Message"
                  value={values.autoReplyMessage}
                  maxLength={500}
                  onValueChange={(v) => set({ autoReplyMessage: v })}
                  aria-label="Auto reply message"
                />
                {err('autoReplyMessage') && <span className={styles.rowError} role="alert">{err('autoReplyMessage')}</span>}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className={styles.footer}>
        <Button size="lg" fullWidth loading={saving} disabled={(isEdit && !dirty) || (touched && hasErrors)} onClick={save}>Save</Button>
      </div>

      {confirmDelete && (
        <BottomSheet title="Delete OOO Record?" onClose={() => setConfirmDelete(false)}>
          <p className={styles.sheetText}>The Out of Office Record will be deleted and reassigned appointments for these dates will return to your calendar.</p>
          <Button size="lg" variant="soft" tone="danger" fullWidth loading={saving} onClick={remove}>Delete Record</Button>
        </BottomSheet>
      )}
    </div>
  );
}
