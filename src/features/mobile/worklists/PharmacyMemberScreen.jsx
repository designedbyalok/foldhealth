import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../../components/Badge/Badge';
import { BottomSheet, BottomSheetItem } from '../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { Textarea } from '../../../components/Textarea/Textarea';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { toE164 } from '../../messages/comms/commsUtils';
import { currentAuthor } from '../../hcc/DiagPanel/commentAuthor';
import { INTERVENTION_ADDRESSES } from '../../pharmacy-worklist/adherencePicklists';
import { hasBarrierData } from '../../pharmacy-worklist/program/barrierHistory';
import {
  MANUAL_GAP_STATUSES, MEASURE_NAMES, MEASURE_ORDER, canSetGapStatus, enrichPharmacyMember, gapBadge,
  medLabel, pharmaciesUsed, prescribersOf,
} from '../../pharmacy-worklist/pharmacyWorklist.utils';
import { MobileSubHeader } from '../MobileHeader';
import { MobileEmpty } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { metaLine } from './worklistAdapters';
import { UserPickerSheet } from './UserPickerSheet';
import { pickerUsers } from './worklistUsers';
import common from '../mobile.module.css';
import styles from './worklistDetail.module.css';

const pad = (n) => String(n).padStart(2, '0');

// What stands now on each gap, as desktop PharmacyBarrierLog's Active view
// builds it: the gap's newest Barrier & Intervention entry (gap-wide or per
// drug) plus drugs whose Reason for Non-Adherence differs. Flattened to one
// row per barrier / intervention with what its action needs.
function activeItems(member) {
  const measures = (member.measures || []).toSorted((a, b) => MEASURE_ORDER.indexOf(a.code) - MEASURE_ORDER.indexOf(b.code));
  const items = [];
  for (const x of measures) {
    const latest = (member.interventionLog || []).find(e => hasBarrierData(e.measures?.[x.code]));
    const current = latest?.measures[x.code];
    const gapLevel = current && !current.medications && !latest.medication && (current.barriers.length > 0 || current.interventions.length > 0);
    const gapBarriers = gapLevel ? new Set(current.barriers) : null;
    const drugBarriers = x.medications.filter(d => d.status !== 'Discontinued' && d.nonAdherenceReason
      && !(gapBarriers && gapBarriers.has(d.nonAdherenceReason)));
    if (current?.medications) {
      for (const d of current.medications) {
        const med = { id: d.id, name: d.name };
        const standing = [...d.barriers, x.medications.find(m => m.id === d.id)?.nonAdherenceReason].filter(Boolean);
        d.barriers.forEach(v => items.push({ key: `${x.code}-${d.id}-b-${v}`, code: x.code, kind: 'barrier', label: v, med }));
        d.interventions.forEach(v => items.push({ key: `${x.code}-${d.id}-i-${v}`, code: x.code, kind: 'intervention', label: v, med, standing }));
      }
    } else {
      const standing = [...(current?.barriers || []), ...drugBarriers.map(d => d.nonAdherenceReason)];
      (current?.barriers || []).forEach(v => items.push({ key: `${x.code}-b-${v}`, code: x.code, kind: 'barrier', label: v, med: null }));
      (current?.interventions || []).forEach(v => items.push({ key: `${x.code}-i-${v}`, code: x.code, kind: 'intervention', label: v, med: null, standing }));
      drugBarriers.forEach(d => items.push({
        key: `${x.code}-${d.id}-r`, code: x.code, kind: 'barrier', label: d.nonAdherenceReason, med: { id: d.id, name: medLabel(d) },
      }));
    }
  }
  return items;
}

/**
 * A Pharmacy (Med Adherence) member on the phone: the desktop Pharmacy Gap
 * Details drawer's assignee, gap statuses, contacts to call, Active Barriers
 * (resolve / Done / Didn't work) and Comments, plus Log Outreach. PDC
 * overrides, claims and Medication Review stay on desktop.
 */
export function PharmacyMemberScreen({ id }) {
  const { push } = useMobileNav();
  const row = useAppStore(s => (s.pharmacyWorklistMembers || []).find(m => m.id === id));
  const fetchMembers = useAppStore(s => s.fetchPharmacyWorklistMembers);
  const platformUsers = useAppStore(s => s.platformUsers);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  const setPharmacyAssignee = useAppStore(s => s.setPharmacyAssignee);
  const setPharmacyGapStatus = useAppStore(s => s.setPharmacyGapStatus);
  const logPharmacyDial = useAppStore(s => s.logPharmacyDial);
  const resolveBarrier = useAppStore(s => s.resolvePharmacyBarrier);
  const completeIntervention = useAppStore(s => s.completePharmacyIntervention);
  const addPharmacyComment = useAppStore(s => s.addPharmacyComment);
  useEffect(() => { fetchMembers?.(); fetchPlatformUsers?.(); }, [fetchMembers, fetchPlatformUsers]);

  const [sheet, setSheet] = useState(null);
  const [comment, setComment] = useState('');

  const member = useMemo(() => (row ? enrichPharmacyMember(row) : null), [row]);
  const items = useMemo(() => (row ? activeItems(row) : []), [row]);
  const contacts = useMemo(() => (row ? [
    ...pharmaciesUsed(row).filter(p => p.phone).map(c => ({ ...c, kind: 'Pharmacy' })),
    ...prescribersOf(row).filter(p => p.phone).map(c => ({ ...c, kind: 'Prescriber' })),
  ] : []), [row]);

  if (!member) {
    return (
      <div className={common.screen}>
        <MobileSubHeader title="Pharmacy" />
        <div className={common.body}>
          <MobileEmpty icon="solar:pill-linear" title="Member not found" />
        </div>
      </div>
    );
  }

  // Desktop click-to-dial: the call goes out (here on the phone) and the
  // member's activity notes who was dialed (logPharmacyDial).
  const dial = (c) => {
    const e164 = toE164(c.phone);
    if (!e164) { toast.error(`No valid number for ${c.name}.`); return; }
    logPharmacyDial(member.id, c.name, c.phone, null, c.kind);
    window.location.assign(`tel:${e164}`);
  };

  // Desktop useBarrierActions.
  const resolve = ({ code, label, med }) => {
    setSheet(null);
    resolveBarrier(member.id, { code, barrier: label, medId: med?.id || null });
    toast.success(`Resolved ${label} on ${code}${med ? ` · ${med.name}` : ''}`);
  };
  const finish = ({ code, label, med }, outcome, resolveToo = []) => {
    setSheet(null);
    completeIntervention(member.id, { code, intervention: label, outcome, medId: med?.id || null, resolve: resolveToo });
    const where = `${code}${med ? ` · ${med.name}` : ''}`;
    if (outcome === 'Done') toast.success(`${label} done on ${where}${resolveToo.length ? `; resolved ${resolveToo.join(', ')}` : ''}`);
    else toast(`${label} marked didn't work on ${where}`);
  };
  const done = (item) => {
    const standing = new Set(item.standing);
    const addressed = (INTERVENTION_ADDRESSES[item.label] || []).filter(b => standing.has(b));
    if (addressed.length) setSheet({ kind: 'alsoResolve', item, addressed });
    else finish(item, 'Done');
  };

  // Desktop PharmacyCommentsTab.add.
  const postComment = () => {
    const body = comment.trim();
    if (!body) return;
    const me = useAppStore.getState().currentUserProfile;
    const { author, authorId } = currentAuthor(me);
    const now = new Date();
    const hours = now.getHours();
    addPharmacyComment(member.id, {
      id: `pc${now.getTime()}`,
      author: author || 'Unknown author',
      authorId,
      role: (me?.clinicalRoles || [])[0] || 'Care Team',
      date: `${pad(now.getMonth() + 1)}/${pad(now.getDate())}/${now.getFullYear()}`,
      time: `${((hours + 11) % 12) + 1}:${pad(now.getMinutes())} ${hours >= 12 ? 'PM' : 'AM'}`,
      body,
      mentionIds: [],
    });
    setComment('');
    setSheet(null);
  };

  return (
    <div className={common.screen}>
      <MobileSubHeader title={member.name}>
        <p className={styles.subtitle}>{[metaLine(member.gender || member.g, member.age), member.memberId && `#${member.memberId}`].filter(Boolean).join(' • ')}</p>
      </MobileSubHeader>
      <div className={common.body}>
        <div className={styles.stack}>
          <div className={styles.section}>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Assigned To</span>
              <button type="button" className={styles.rowBtn} aria-label={`Assigned to ${member.assigneeName || 'nobody'}. Change`} onClick={() => setSheet({ kind: 'assignee' })}>
                <span className={styles.rowValue}>{member.assigneeName || 'Unassigned'}</span>
                <Icon name="solar:alt-arrow-down-linear" size={20} color="var(--neutral-300)" />
              </button>
            </div>
            {member.priority && (
              <div className={styles.row}>
                <span className={styles.rowLabel}>Priority</span>
                <span className={styles.rowValue}>{member.priority}</span>
              </div>
            )}
            {member.healthPlan && (
              <div className={styles.row}>
                <span className={styles.rowLabel}>Health Plan</span>
                <span className={styles.rowValue}>{member.healthPlan}</span>
              </div>
            )}
          </div>

          <p className={styles.sectionLabel}>Gaps</p>
          <div className={styles.section}>
            {member.gaps.length === 0 ? <p className={styles.empty}>No open gaps.</p> : member.gaps.map(g => {
              const badge = gapBadge(g.status);
              const editable = canSetGapStatus(g.status);
              return (
                <div key={g.code} className={styles.item}>
                  <span className={styles.itemText}>
                    <span className={styles.itemTitle}>{g.code} · {MEASURE_NAMES[g.code] || g.code}</span>
                    <span className={styles.itemMeta}>
                      {[g.pdc != null ? `PDC ${Math.round(g.pdc)}%` : '', g.nextFillDue ? `Next fill ${g.nextFillDue}` : '', g.status?.label].filter(Boolean).join(' • ')}
                    </span>
                  </span>
                  {editable ? (
                    <button type="button" className={styles.rowBtn} aria-label={`${g.code} status: ${badge.label}. Change status`} onClick={() => setSheet({ kind: 'gapStatus', gap: g })}>
                      <Badge size="md" tone={badge.tone === 'white' ? 'neutral' : badge.tone} variant="soft" label={badge.label} chevron />
                    </button>
                  ) : <Badge size="md" tone={badge.tone === 'white' ? 'neutral' : badge.tone} variant="soft" label={badge.label} />}
                </div>
              );
            })}
          </div>

          {contacts.length > 0 && (
            <>
              <p className={styles.sectionLabel}>Contacts</p>
              <div className={styles.section}>
                {contacts.map(c => (
                  <div key={`${c.kind}-${c.name}`} className={styles.item}>
                    <span className={styles.itemText}>
                      <span className={styles.itemTitle}>{c.name}</span>
                      <span className={styles.itemMeta}>{[c.kind, c.phone].join(' • ')}</span>
                    </span>
                    <button type="button" className={styles.iconBtn} aria-label={`Call ${c.name}`} onClick={() => dial(c)}>
                      <Icon name="solar:phone-linear" size={24} color="var(--primary-300)" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          <p className={styles.sectionLabel}>Active Barriers</p>
          <div className={styles.section}>
            {items.length === 0 ? <p className={styles.empty}>No active barriers or interventions.</p> : items.map(it => (
              <div key={it.key} className={styles.item}>
                <span className={styles.itemText}>
                  <span className={styles.itemTitle}>{it.label}</span>
                  <span className={styles.itemMeta}>{[it.kind === 'barrier' ? 'Barrier' : 'Intervention', it.code, it.med?.name].filter(Boolean).join(' • ')}</span>
                </span>
                <button type="button" className={styles.iconBtn} aria-label={`${it.label} actions`} onClick={() => setSheet({ kind: 'item', item: it })}>
                  <Icon name="solar:menu-dots-linear" size={24} color="currentColor" />
                </button>
              </div>
            ))}
          </div>

          <p className={styles.sectionLabel}>
            Comments
            <button type="button" className={styles.linkBtn} onClick={() => setSheet({ kind: 'comment' })}>Add</button>
          </p>
          <div className={styles.section}>
            {(member.comments || []).length === 0 ? <p className={styles.empty}>No comments yet.</p> : member.comments.map(c => (
              <div key={c.id} className={styles.item}>
                <span className={styles.itemText}>
                  <span className={styles.itemMeta}>{[c.author, c.date, c.time, c.edited ? 'Edited' : ''].filter(Boolean).join(' • ')}</span>
                  <p className={styles.itemBody}>{c.body}</p>
                </span>
              </div>
            ))}
          </div>

          <p className={styles.note}>
            <Icon name="solar:monitor-linear" size={20} color="currentColor" />
            <span>Open on desktop for PDC overrides, claims and medication review.</span>
          </p>
        </div>
      </div>
      <div className={styles.footer}>
        <Button size="lg" fullWidth leadingIcon="solar:phone-calling-linear" onClick={() => push('worklistPharmacyOutreach', { id: member.id })}>
          Log Outreach
        </Button>
      </div>

      {sheet?.kind === 'assignee' && (
        <UserPickerSheet
          title={member.assigneeName ? 'Change Assignee' : 'Assign User'}
          users={pickerUsers(platformUsers, { excludeHccOnly: true })}
          current={member.assigneeName}
          onPick={(u) => {
            setSheet(null);
            if (u.name === member.assigneeName) return;
            setPharmacyAssignee(member.id, u);
            toast.success(`Assigned to ${u.name}`);
          }}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet?.kind === 'gapStatus' && (
        <BottomSheet title={`${sheet.gap.code} Status`} onClose={() => setSheet(null)}>
          {MANUAL_GAP_STATUSES.map(st => (
            <BottomSheetItem
              key={st}
              icon={st === sheet.gap.status?.gap ? 'solar:check-circle-linear' : 'solar:record-linear'}
              label={st}
              onClick={() => {
                setSheet(null);
                if (st !== sheet.gap.status?.gap) setPharmacyGapStatus(member.id, sheet.gap.code, st);
              }}
            />
          ))}
        </BottomSheet>
      )}

      {sheet?.kind === 'item' && (
        <BottomSheet title={sheet.item.label} onClose={() => setSheet(null)}>
          {sheet.item.kind === 'barrier' ? (
            <BottomSheetItem icon="solar:check-circle-linear" label="Mark resolved" onClick={() => resolve(sheet.item)} />
          ) : (
            <>
              <BottomSheetItem icon="solar:check-circle-linear" label="Mark done" onClick={() => done(sheet.item)} />
              <BottomSheetItem icon="solar:close-circle-linear" label="Didn't work" onClick={() => finish(sheet.item, "Didn't work")} />
            </>
          )}
        </BottomSheet>
      )}

      {sheet?.kind === 'alsoResolve' && (
        <BottomSheet title={`Also resolve ${sheet.addressed.join(', ')}?`} onClose={() => setSheet(null)}>
          <p className={styles.hint}>
            {`${sheet.item.label} addresses ${sheet.addressed.join(', ')} on ${sheet.item.code}${sheet.item.med ? ` · ${sheet.item.med.name}` : ''}. Resolve it now, or keep it active if the member still faces it.`}
          </p>
          <BottomSheetItem icon="solar:check-circle-linear" label="Resolve too" onClick={() => finish(sheet.item, 'Done', sheet.addressed)} />
          <BottomSheetItem icon="solar:record-linear" label="Just mark done" onClick={() => finish(sheet.item, 'Done')} />
        </BottomSheet>
      )}

      {sheet?.kind === 'comment' && (
        <BottomSheet title="Add Comment" onClose={() => setSheet(null)}>
          <div className={styles.sheetForm}>
            <Textarea rows={4} aria-label="Comment" placeholder="Add a comment" value={comment} onValueChange={setComment} />
            <Button size="lg" fullWidth disabled={!comment.trim()} onClick={postComment}>Add Comment</Button>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
