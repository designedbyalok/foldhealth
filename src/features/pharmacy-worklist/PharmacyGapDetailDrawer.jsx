import { useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Drawer } from '../../components/Drawer/Drawer';
import { PatientBanner } from '../../components/PatientBanner/PatientBanner';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { AssigneeChange } from '../../components/AssigneeChange/AssigneeChange';
import { Badge } from '../../components/Badge/Badge';
import { Tooltip } from '../../components/Tooltip/Tooltip';
import { Button } from '../../components/Button/Button';
import { CloseButton } from '../../components/CloseButton/CloseButton';
import { FilterChip } from '../../components/FilterChip/FilterChip';
import { Icon } from '../../components/Icon/Icon';
import { MenuPopover } from '../../components/MenuPopover/MenuPopover';
import { Tabs } from '../../components/Tabs/Tabs';
import { SegmentedControl } from '../../components/SegmentedControl/SegmentedControl';
import { clinicalRolesPickerLabel } from '../../lib/worklistAssignee';
import { MEASURE_ORDER, PROGRESS_TONE, contactCallTarget, enrichPharmacyMember, medLabel, pharmaciesUsed, prescribersOf } from './pharmacyWorklist.utils';
import { BARRIER_ICON } from './adherencePicklists';
import { PharmacyContacts, PharmacyGapsCard } from './program/PharmacySnapshotStep';
import { MedicationDetail, PharmacyMedicationReview } from './program/PharmacyMedicationReview';
import { usePharmacyOutreachTab } from './program/usePharmacyOutreachTab';
import { OutreachTabView } from '../patient/left-panel/tabs/outreach/OutreachTab/OutreachTab';
import { PharmacyBarrierStep } from './program/PharmacyBarrierStep';
import { useBarrierForm } from './program/useBarrierForm';
import { PharmacyBarrierLog } from './program/PharmacyBarrierLog';
import { PharmacyVerificationStep } from './program/PharmacyVerificationStep';
import { assessmentSummary, callTypeForStakeholder } from './program/assessmentOutreach';
import { PharmacyActivityLog } from './program/PharmacyActivityLog';
import { PharmacyCommentsTab } from './program/PharmacyCommentsTab';
// Same layout system as the HEDIS Care Gap Details drawer, so both read as one.
import { MeasureCode } from './PharmacyCells';
import styles from '../hedis-worklist/CareGapDetailDrawer.module.css';
import local from './PharmacyGapDetailDrawer.module.css';
import { escalation } from './pharmacyRules';

const PHARM_PROGRAM = { code: 'PHARM' };
const HCC_ONLY_ROLES = new Set(['Coder', 'Support', 'QA', 'Compliance']);

// Activity leads; the drawer still opens on Medication Review.
const TABS = [
  { key: 'activity', label: 'Activity' },
  { key: 'medication', label: 'Medication Review' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'comments', label: 'Comments' },
  { key: 'outreach', label: 'Outreaches' },
  { key: 'barriers', label: 'Barriers & Interventions' },
];

// An Assessment's Action as the outreach form's Type.
const OUTREACH_TYPE_FOR_ACTION = { Telephonic: 'Call', Email: 'Email', Text: 'SMS', Mail: 'Letter' };

const WORKSPACE_TITLE = {
  outreach: 'Add Outreach',
  verify: 'Assessment',
  barriers: 'Barriers & Interventions',
};

/**
 * Pharmacy Gap Details: one drawer per member, as on the HCC worklist. The
 * member level (assignee, Progress) heads it; below, every pharmacy gap with
 * its own status. Ticking gaps scopes the tabs and the actions, so one
 * outreach or verification call can cover one gap or all of them.
 */
export function PharmacyGapDetailDrawer() {
  const target = useAppStore(s => s.pharmacyGapDrawer);
  const row = useAppStore(s => (target ? s.pharmacyWorklistMembers.find(m => m.id === target.memberId) : null));
  // A member with no pharmacy measures has no gap to show.
  if (!target || !row || !row.measures?.length) return null;
  // Keyed by member: the outreach state reads the member's log once per mount,
  // and the starting selection follows how the drawer was opened.
  return <PharmacyGapDrawerBody key={`${row.id}|${target.focus ? target.code : ''}|${target.medId || ''}`} target={target} row={row} />;
}

function PharmacyGapDrawerBody({ target, row }) {
  const close = useAppStore(s => s.closePharmacyGapDrawer);
  const openDrawer = useAppStore(s => s.openPharmacyGapDrawer);
  const order = useAppStore(s => s.pharmacyWorklistOrder);
  const platformUsers = useAppStore(s => s.platformUsers);
  const setPharmacyAssignee = useAppStore(s => s.setPharmacyAssignee);
  const setPharmacyGapStatus = useAppStore(s => s.setPharmacyGapStatus);

  const m = useMemo(() => enrichPharmacyMember(row), [row]);
  const codes = useMemo(() => m.gaps.map(g => g.code), [m]);

  // The gap toggle: All, or one gap. Opened from one gap (its badge or rework
  // flag): that gap; otherwise All.
  const [scope, setScope] = useState(() => (target.focus && codes.includes(target.code) ? target.code : 'all'));
  const selected = useMemo(() => new Set(scope === 'all' ? codes : [scope]), [scope, codes]);
  const picked = MEASURE_ORDER.filter(c => selected.has(c));
  const scopeLabel = scope === 'all' ? 'All gaps' : scope;

  // The member as the tabs see it: only the picked gaps.
  const scoped = useMemo(() => ({ ...row, measures: row.measures.filter(x => selected.has(x.code)) }), [row, selected]);
  // The picked gaps still to confirm with the pharmacy: Verify with Pharmacy
  // shows while any are left, and its form asks about only those.
  // Update Barriers' form lives here so its Save sits in the pane header.
  const barrierForm = useBarrierForm(scoped);
  // Pharmacy Verification's Lock & Log Call, also in the pane header.
  const [verifyAction, setVerifyAction] = useState(null);

  // Opened from a "Claim not matched" flag: the drug's claim history in the
  // side workspace, outreach logging in the main pane.
  const rework = target.view === 'claims' && target.medId;
  // Opened from the Outreach cell's View All: straight to Outreaches.
  const [tab, setTab] = useState(rework || target.view === 'outreach' ? 'outreach' : 'medication');
  const [workspace, setWorkspace] = useState(rework ? { medId: target.medId, tab: 'claims' } : null); // 'outreach' | 'verify' | 'barriers' | { medId, tab? }
  const [moreRect, setMoreRect] = useState(null);
  // The More menu's call actions: the pharmacy the member last filled at and
  // the prescribers of their drugs, through the same call popover as Contacts.
  const openNumberCallPopover = useAppStore(st => st.openNumberCallPopover);
  const logPharmacyDial = useAppStore(st => st.logPharmacyDial);
  // Every pharmacy and prescriber with a phone, from the gap report and the
  // claims; with more than one, the menu asks who to call.
  const pharmacyContacts = useMemo(() => pharmaciesUsed(row).filter(p => p.phone), [row]);
  const prescriberContacts = useMemo(() => prescribersOf(row).filter(p => p.phone), [row]);
  const [callPick, setCallPick] = useState(null); // { title, contacts, anchor }
  // The call popover and the picker open from whichever button was used.
  const pharmacistBtnRef = useRef(null);
  const prescriberBtnRef = useRef(null);
  const callContact = (c, kind, anchor = moreBtnRef) => openNumberCallPopover({ ...contactCallTarget(row, c, kind), onDial: (number, line) => logPharmacyDial?.(row.id, c.name, number, line, kind) }, anchor);
  const callOneOf = (title, kind, contacts, anchor = moreBtnRef) => (contacts.length === 1 ? callContact(contacts[0], kind, anchor) : setCallPick({ title, kind, contacts, anchor }));
  const moreBtnRef = useRef(null);

  // One outreach state backs the side-workspace form and the Outreach tab
  // log, the same as Care Gap Details; it keeps the PHARM automations
  // (pickups move fill dates, outcomes feed Barriers & Interventions).
  const outreach = usePharmacyOutreachTab(row, { patientId: row.patientId || row.id, memberName: row.name });

  const closeWorkspace = () => {
    if (workspace === 'outreach') outreach.handleDiscard();
    setWorkspace(null);
  };
  // Previous / next member, in the worklist's order on screen.
  const ids = order.length ? order : [m.id];
  const at = ids.indexOf(m.id);
  const goMember = (step) => {
    const id = ids[at + step];
    if (!id) return;
    closeWorkspace();
    openDrawer(id, null);
  };
  // One outreach for the picked gaps: the form starts with exactly those.
  const openOutreach = () => {
    outreach.setDatetime(outreach.formatNow());
    outreach.setSelectedProgs(picked);
    outreach.setFormOpen(true);
    setWorkspace('outreach');
  };
  // The call an Assessment belongs to: the call outreach being filled in, or
  // else the last call dialed from this drawer (who, and to whom).
  const outreachCall = useMemo(() => {
    if (outreach.formOpen && outreach.type === 'Call') {
      return { callType: outreach.callType, direction: outreach.callDirection, calledTo: outreach.calledToNumber };
    }
    const dial = (row.activityLog || []).find(e => e.t === 'call' && e.callKind && e.title?.startsWith('Dialed '));
    return dial ? { callType: dial.callKind, direction: 'outgoing', calledTo: dial.title.slice('Dialed '.length) } : null;
  }, [outreach.formOpen, outreach.type, outreach.callType, outreach.callDirection, outreach.calledToNumber, row.activityLog]);
  // An Assessment's summary goes into the outreach note, and the outreach
  // opens so the user picks its outcome and saves it (which logs it). With no
  // outreach under way, one starts from the Assessment's call details.
  const addToOutreachNote = (call) => {
    const summary = assessmentSummary(call);
    const underWay = outreach.formOpen && (outreach.type !== 'General' || outreach.outcome || outreach.sharedPanel.note.trim());
    if (!underWay) {
      outreach.setDatetime(outreach.formatNow());
      outreach.setSelectedProgs((call.measures || []).filter(c => picked.includes(c)).length ? call.measures.filter(c => picked.includes(c)) : picked);
      outreach.setType(OUTREACH_TYPE_FOR_ACTION[call.action] || 'General');
      outreach.setCallDirection(call.direction === 'Inbound' ? 'incoming' : 'outgoing');
      const callType = callTypeForStakeholder(call.party);
      if (callType) outreach.setCallType(callType);
      outreach.setFormOpen(true);
    }
    const add = (text) => (text.trim() ? `${text.trimEnd()}\n\n${summary}` : summary);
    if (outreach.useSeparate) outreach.selectedProgs.forEach(p => outreach.patchPanel(p, { note: add(outreach.getPanel(p).note) }));
    else outreach.patchShared({ note: add(outreach.sharedPanel.note) });
    setWorkspace('outreach');
  };
  const saveOutreach = () => {
    if (!outreach.canSave) return;
    outreach.handleSave();
    setWorkspace(null);
  };
  const year = (m.gaps.find(g => g.failDate)?.failDate || '').slice(6) || String(new Date().getFullYear());
  // What the outreach rules ask for next on the picked gaps.
  const prompts = m.gaps.filter(g => selected.has(g.code)).map(g => ({ g, escalate: escalation(g, m) }));
  const inSplit = !!workspace;
  const openMed = workspace?.medId
    ? m.gaps.flatMap(g => g.medications.map(d => ({ ...d, measure: g.code }))).find(d => d.id === workspace.medId)
    : null;

  const users = (platformUsers || [])
    .filter(u => !u.clinicalRoles?.some(r => HCC_ONLY_ROLES.has(r)))
    .map(u => ({ id: u.id, name: u.name, initials: u.initials, role: clinicalRolesPickerLabel(u) }));

  // The Outreach tab lists only outreach that touched a picked gap.
  const touchesPicked = (programs) => !programs?.length || programs.some(p => selected.has(p));
  const scopedOutreach = useMemo(() => ({
    ...outreach,
    filteredLogGroups: outreach.filteredLogGroups
      .map(g => ({ ...g, logs: g.logs.filter(l => touchesPicked(l.programs)) }))
      .filter(g => g.logs.length),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [outreach, selected]);

  const banner = (
    <PatientBanner
      initials={m.initials}
      name={m.name}
      gender={m.gender}
      age={m.age}
      dob={m.dob}
      memberId={m.memberId}
      hidePatientLabel
      patientId={m.patientId || m.id}
    />
  );

  const tabCounts = {
    outreach: (m.callHistory || []).filter(c => touchesPicked(c.measures)).length,
    medication: m.gaps.filter(g => selected.has(g.code)).reduce((n, g) => n + g.medications.length, 0),
    comments: (row.comments || []).length,
  };

  return (
    <Drawer
      title="Pharmacy Gap Details"
      onClose={close}
      noCloseDivider
      width={inSplit ? 1280 : 700}
      className={`${styles.panel} ${inSplit ? styles.panelExpanded : ''}`}
      bodyClassName={inSplit ? `${styles.drawerBody} ${styles.drawerBodySplit}` : styles.drawerBody}
      headerRight={
        <div className={styles.headerNav}>
          <ActionButton icon="solar:alt-arrow-left-linear" tooltip="Previous member" disabled={!(at > 0)} onClick={() => goMember(-1)} />
          <ActionButton icon="solar:alt-arrow-right-linear" tooltip="Next member" disabled={!(at >= 0 && at < ids.length - 1)} onClick={() => goMember(1)} />
          <span className={styles.headerDivider} />
        </div>
      }
      banner={inSplit ? undefined : <div className={styles.patientBannerWrap}>{banner}</div>}
    >
      {inSplit && (
        <div className={styles.leftPane}>
          <div className={styles.paneHeader}>
            {openMed ? (
              <span className={`${styles.paneTitle} ${styles.paneTitleRow}`}>
                {`${medLabel(openMed)} (${openMed.generic})`}
                <MeasureCode code={openMed.measure} />
              </span>
            ) : workspace?.verification ? (
              <span className={styles.paneTitle}>{`Assessment · ${workspace.verification.date}`}</span>
            ) : (
              <span className={styles.paneTitle}>
                {`${WORKSPACE_TITLE[workspace]}${scope === 'all' ? '' : ` · ${scopeLabel}`}`}
              </span>
            )}
            <div className={styles.paneHeaderRight}>
              {workspace === 'outreach' && (
                <>
                  <Button disabled={!outreach.canSave} onClick={saveOutreach}>Save</Button>
                  <span className={styles.headerDivider} />
                </>
              )}
              {workspace === 'barriers' && (
                <>
                  <Button disabled={!barrierForm.canSave} onClick={barrierForm.save}>Save</Button>
                  <span className={styles.headerDivider} />
                </>
              )}
              {workspace === 'verify' && (
                <>
                  <Button disabled={!verifyAction?.canLock} onClick={() => verifyAction?.lock()}>Save</Button>
                  <span className={styles.headerDivider} />
                </>
              )}
              <CloseButton size={18} onClick={closeWorkspace} label={`Close ${openMed ? 'medication' : WORKSPACE_TITLE[workspace] || 'Assessment'}`} />
            </div>
          </div>
          <div className={styles.leftPaneBody}>
            {workspace === 'outreach' && (
              <OutreachTabView tab={outreach} hideLogForRow hideActivity hideFormFooter flush taskMember={m.name} />
            )}
            {workspace === 'verify' && <PharmacyVerificationStep member={scoped} program={PHARM_PROGRAM} onLocked={() => setWorkspace(null)} onLockAction={setVerifyAction} outreachCall={outreachCall} onAddToOutreach={addToOutreachNote} />}
            {workspace === 'barriers' && <PharmacyBarrierStep member={scoped} form={barrierForm} />}
            {workspace?.verification && <PharmacyVerificationStep key={workspace.verification.id} record={workspace.verification} program={PHARM_PROGRAM} />}
            {/* A note click remounts the pane so it scrolls to Notes again, even on the drug already open. */}
            {openMed && <MedicationDetail key={workspace.tab === 'notes' ? `${openMed.id}|notes|${workspace.at}` : openMed.id} med={openMed} memberRowId={m.id} plan={m.healthPlan} initialTab={workspace.tab} flushTabs showMeasure={false} />}
          </div>
        </div>
      )}

      <div className={styles.contentBody}>
        {inSplit && <div className={styles.patientBannerWrap}>{banner}</div>}

        <div className={styles.gapHeader}>
          <div className={styles.gapToolbar}>
            <div className={styles.yearWrap}>
              <FilterChip
                label="Measurement"
                options={[year]}
                selected={[year]}
                onChange={() => {}}
                singleSelect
                noClear
                size="S"
                info={`PDC for MAC, MAD and MAH is measured over calendar year ${year}.`}
              />
            </div>
            <div className={styles.gapToolbarRight}>
              {/* Member level: one assignee and one Progress for all the
                  member's pharmacy gaps. Progress is Fold's roll-up. */}
              <AssigneeChange
                avatarOnly
                unassigned={!m.assigneeName}
                name={m.assigneeName || undefined}
                initials={m.assigneeInitials || undefined}
                ariaLabel={m.assigneeName || 'Assign'}
                users={users}
                pickerTitle={m.assigneeName ? 'Change assignee' : 'Assign to'}
                onSelect={(u) => setPharmacyAssignee(m.id, u)}
              />
              <Tooltip label={`Member progress: ${m.progress.closed} of ${m.progress.total} gaps closed (Closed or Met for Year)`} placement="bottom">
                <span><Badge size="md" tone={PROGRESS_TONE[m.progress.label]} label={m.progress.label} style={{ height: 28 }} /></span>
              </Tooltip>
              <span className={styles.headerDivider} />
              <ActionButton
                ref={moreBtnRef}
                icon="solar:menu-dots-linear"
                tooltip="More"
                tooltipBelow
                tooltipLeft
                onClick={() => setMoreRect(r => (r ? null : moreBtnRef.current?.getBoundingClientRect()))}
              />
              {moreRect && (
                <MenuPopover
                  anchorRect={moreRect}
                  items={[
                    { key: 'verify', label: 'Assessment', icon: 'solar:clipboard-check-linear' },
                    { key: 'callPharmacy', label: 'Call Pharmacist', icon: 'solar:phone-linear', disabled: !pharmacyContacts.length, hint: pharmacyContacts.length === 1 ? pharmacyContacts[0].name : pharmacyContacts.length ? `${pharmacyContacts.length} pharmacies` : 'No pharmacy phone on file' },
                    { key: 'callPrescriber', label: 'Call Prescriber', icon: 'solar:phone-linear', disabled: !prescriberContacts.length, hint: prescriberContacts.length === 1 ? prescriberContacts[0].name : prescriberContacts.length ? `${prescriberContacts.length} prescribers` : 'No prescriber phone on file' },
                    { key: 'outreach', label: 'Log Outreach', icon: 'solar:phone-calling-linear', disabled: !picked.length },
                    { key: 'barriers', label: 'Add Barrier', icon: BARRIER_ICON },
                  ]}
                  onSelect={(key) => {
                    setMoreRect(null);
                    if (key === 'verify') setWorkspace('verify');
                    else if (key === 'callPharmacy') callOneOf('Call which pharmacy?', 'Pharmacy', pharmacyContacts);
                    else if (key === 'callPrescriber') callOneOf('Call which prescriber?', 'Prescriber', prescriberContacts);
                    else if (key === 'outreach') openOutreach();
                    else if (key === 'barriers') setWorkspace('barriers');
                  }}
                  onClose={() => setMoreRect(null)}
                  width={220}
                  ariaLabel="More actions"
                />
              )}
              {callPick && (
                <MenuPopover
                  anchorRef={callPick.anchor}
                  items={[
                    { section: callPick.title },
                    ...callPick.contacts.map(c => ({
                      key: c.name, label: c.name, icon: 'solar:phone-linear', tall: true,
                      hint: [c.phone, c.lastFill ? `Last fill ${c.lastFill}` : null, c.drugs?.length ? c.drugs.join(', ') : null].filter(Boolean).join(' • '),
                    })),
                  ]}
                  onSelect={(key) => { const c = callPick.contacts.find(x => x.name === key); setCallPick(null); if (c) callContact(c, callPick.kind, callPick.anchor); }}
                  onClose={() => setCallPick(null)}
                  width={300}
                  ariaLabel={callPick.title}
                />
              )}
            </div>
          </div>

        </div>

        <div className={local.gapsSection}>
          <PharmacyGapsCard
            compact
            member={scoped}
            titleExtra={codes.length > 1 && (
              <SegmentedControl
                size="sm"
                items={[{ key: 'all', label: 'All' }, ...codes.map(c => ({ key: c, label: c }))]}
                value={scope}
                onValueChange={setScope}
              />
            )}
            onSetStatus={(code, status) => setPharmacyGapStatus(m.id, code, status)}
          />
        </div>

        <div className={styles.suggestSection}>
          {picked.length > 0 && (
            <>
              <div className={styles.suggestRow}>
                <Icon name="custom:ai" size={14} color="var(--primary-300)" /> Suggested Actions
              </div>
              <div className={local.actionRow}>
                {/* Calls lead: Call Pharmacist primary, Call Prescriber tertiary,
                    then the logging actions as secondary. */}
                <Button ref={pharmacistBtnRef} leadingIcon="solar:phone-linear" disabled={!pharmacyContacts.length} onClick={() => callOneOf('Call which pharmacy?', 'Pharmacy', pharmacyContacts, pharmacistBtnRef)}>Call Pharmacist</Button>
                <Button ref={prescriberBtnRef} variant="soft" leadingIcon="solar:stethoscope-linear" disabled={!prescriberContacts.length} onClick={() => callOneOf('Call which prescriber?', 'Prescriber', prescriberContacts, prescriberBtnRef)}>Call Prescriber</Button>
                <Button variant="outline" onClick={openOutreach}>Add Outreach</Button>
                <Button variant="outline" onClick={() => setWorkspace('verify')}>Assessment</Button>
                <Button variant="outline" onClick={() => setWorkspace('barriers')}>Update Barriers</Button>
              </div>
            </>
          )}
          {prompts.filter(p => p.escalate).map(({ g, escalate }) => (
            <div key={g.code}>
              {escalate && (
                <div className={local.ruleHint}>
                  <Icon name="solar:danger-triangle-linear" size={14} color="var(--status-warning)" />
                  <span>
                    <b>{g.code}: escalate to {escalate.prescriber?.name || 'the prescriber'}</b>
                    {escalate.prescriber?.phone ? ` (${escalate.prescriber.phone})` : ''}: {escalate.reason}. Outreach goes to the prescriber of the drug, not the PCP.
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        <Tabs
          items={TABS.map(t => ({ key: t.key, label: tabCounts[t.key] != null ? `${t.label} (${tabCounts[t.key]})` : t.label }))}
          value={tab}
          onValueChange={setTab}
          fullWidth={false}
          size="sm"
        />

        {/* The outreach and comments views pad themselves, as in the HEDIS drawer. */}
        <div className={`${styles.tabContentWrap} ${tab === 'outreach' || tab === 'comments' ? styles.tabContentWrapFlush : ''}`}>
          {picked.length > 0 && (
            <>
              {tab === 'medication' && <PharmacyMedicationReview compact member={scoped} activeMedId={workspace?.medId ?? null} onOpenMed={(medId, medTab) => setWorkspace({ medId, tab: medTab, at: Date.now() })} />}
              {tab === 'outreach' && (
                <OutreachTabView tab={scopedOutreach} hideLogForRow hideForm={workspace === 'outreach'} taskMember={m.name} onLogNew={openOutreach} />
              )}
              {tab === 'barriers' && <PharmacyBarrierLog member={scoped} onEdit={() => setWorkspace('barriers')} />}
            </>
          )}
          {tab === 'activity' && <PharmacyActivityLog member={row} onViewVerification={(call) => setWorkspace({ verification: call })} onAddToOutreach={addToOutreachNote} />}
          {tab === 'comments' && <PharmacyCommentsTab member={row} />}
          {tab === 'contacts' && <div className={local.contacts}><PharmacyContacts member={row} /></div>}
        </div>
      </div>
    </Drawer>
  );
}
