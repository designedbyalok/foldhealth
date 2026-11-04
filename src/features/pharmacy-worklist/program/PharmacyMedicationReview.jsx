import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Badge } from '../../../components/Badge/Badge';
import { Icon } from '../../../components/Icon/Icon';
import { DownChevronIcon } from '../../../components/Icon/DownChevronIcon';
import { PhoneLink } from '../../../components/PhoneLink/PhoneLink';
import { Checkbox } from '../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { RadioOptionGroup } from '../../../components/RadioOptionGroup/RadioOptionGroup';
import { Textarea } from '../../../components/Textarea/Textarea';
import { Select } from '../../../components/Select/Select';
import { Drawer } from '../../../components/Drawer/Drawer';
import { TabStrip } from '../../../components/TabStrip/TabStrip';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { MedicationClaims } from './MedicationClaims';
import { DatePicker } from '../../../components/DatePicker/DatePicker';
import { BulkBar } from '../../../components/BulkBar/BulkBar';
import { DatePickerPopover } from '../../../components/DatePicker/DatePickerPopover';
import { gapBadge, MEASURE_NAMES, MEASURE_ORDER, annotateClaims, isActiveGap, effectivePdc, fillDueTone, latestConfirmedFill, matchFill, measureStatus, medicationStatus, pdcTone, medFills, todayMdy, gapActiveBarriers } from '../pharmacyWorklist.utils';
import { MeasureCode, Sep, SubStatus } from '../PharmacyCells';
import { BARRIERS, BARRIER_ICON } from '../adherencePicklists';
import { usePharmacyProgramMember } from './usePharmacyProgramMember';
import { DrugBarriers } from './PharmacyBarrierLog';
import styles from './PharmacyMedicationReview.module.css';
import claimStyles from './MedicationClaims.module.css';

const CONDITIONS = ['Type 2 diabetes', 'Hypertension', 'Hyperlipidemia', 'Chronic kidney disease', 'Heart failure', "I don't know"];

const NON_ADHERENCE_REASONS = [...BARRIERS, 'Other'].map(r => ({ value: r, label: r }));

const TONE_CLASS = { error: styles.toneError };

const conditionsOf = (d) => d.conditions ?? (d.condition ? [d.condition] : []);

// A text field that saves on blur rather than per keystroke (each save
// rewrites the member's measures jsonb).
function DraftTextarea({ value, onCommit, ...rest }) {
  const [draft, setDraft] = useState(value || '');
  return (
    <Textarea
      {...rest}
      value={draft}
      // A labelled Textarea passes the text; a plain one, the event.
      onChange={v => setDraft(typeof v === 'string' ? v : v.target.value)}
      onBlur={() => { if (draft !== (value || '')) onCommit(draft); }}
    />
  );
}

function ContactCard({ title, person }) {
  return (
    <section className={styles.card}>
      <header className={styles.cardTitle}>{title}{person?.name ? <span className={styles.cardName}>{person.name}</span> : null}</header>
      <dl className={styles.cardGrid}>
        <div className={styles.halfCell}><dt>Primary Phone</dt><dd><PhoneLink number={person?.phone} label={person?.name} /></dd></div>
        {person?.fax !== undefined && <div className={styles.halfCell}><dt>Fax</dt><dd className={styles.noWrap}>{person.fax || '-'}</dd></div>}
        <div className={styles.fullRow}><dt>Address</dt><dd>{person?.address1 || '-'}</dd></div>
        <div><dt>City</dt><dd>{person?.city || '-'}</dd></div>
        <div><dt>State</dt><dd>{person?.state || '-'}</dd></div>
        <div><dt>Zip Code</dt><dd>{person?.zip || '-'}</dd></div>
      </dl>
    </section>
  );
}


// The drug's latest fill confirmed in Fold and its claim match, if any.
const fillMatchOf = (d, plan) => {
  const fill = latestConfirmedFill(d);
  return fill ? { fill, ...matchFill(fill, annotateClaims(d.refills), plan) } : null;
};

// Tag for a fill date confirmed in Fold: Projected until its claim matches,
// then Claim matched. A reversed claim, no claim, or one billed outside
// Part D is a rework link to the drug's Claim History.
function FillMatchTag({ match, onRework }) {
  if (!match) return null;
  if (match.kind === 'verified') return <Badge size="sm" tone="success" icon="solar:check-circle-linear" label="Claim matched" />;
  if (match.kind === 'pending') return <Badge size="sm" tone="warning" label="Projected" />;
  return (
    <button type="button" className={styles.reworkLink} onClick={(e) => { e.stopPropagation(); onRework?.(); }} title={match.detail}>
      {match.kind === 'voided' ? 'Fill reversed' : 'Claim not matched'}
    </button>
  );
}

// The fill's claim match as words for the compact row's second line.
function FillMatchText({ match, onRework }) {
  if (match.kind === 'verified') return <span className={styles.cMatchOk}>Claim matched</span>;
  if (match.kind === 'pending') return <span className={styles.cMatchPending}>Projected</span>;
  return (
    <button type="button" className={styles.reworkLink} onClick={onRework} title={match.detail}>
      {match.kind === 'voided' ? 'Fill reversed' : 'Claim not matched'}
    </button>
  );
}

// Recent Fill as a light date chip that opens the calendar, as on the CIS
// dose list (DoseDateField), so a row is not a form field.
function RecentFillChip({ date, label, onChange }) {
  const [rect, setRect] = useState(null);
  const pick = (iso) => { setRect(null); onChange(fromIso(iso)); };
  return (
    <>
      <button type="button" className={styles.cChip} onClick={(e) => setRect(e.currentTarget.getBoundingClientRect())} aria-haspopup="dialog" aria-label={`${label}: ${date || 'not set'}`}>
        <Badge variant="outline" size="md" label={date || 'Select Date'} className={date ? undefined : styles.cChipEmpty} />
      </button>
      {rect && (
        <DatePickerPopover
          open
          value={toIso(date)}
          anchorRect={rect}
          max={toIso(todayMdy())}
          onChange={pick}
          onClose={() => setRect(null)}
        />
      )}
    </>
  );
}

// Medication statuses that call for action read red.
const URGENT_MED_STATUSES = new Set(['Refill overdue', 'Fill reversed', 'Not matched – rework']);

// `flushTabs`: the host pads its pane, and the tab strip should still run
// edge to edge (the gap drawer's left pane). `showMeasure={false}` when the
// host already shows the gap code beside the drug's name.
export function MedicationDetail({ med, memberRowId, plan, initialTab, flushTabs = false, showMeasure = true }) {
  // The member as stored (measures and barrier log), for the drug's
  // Barriers & Interventions.
  const member = useAppStore(s => s.pharmacyWorklistMembers.find(m => m.id === memberRowId));
  const memberMeds = useMemo(() => (member?.measures || []).flatMap(x => x.medications.map(d => ({ ...d, measure: x.code }))), [member]);
  const update = useAppStore(s => s.updatePharmacyMedication);
  const save = (patch) => update(memberRowId, med.id, patch);
  // Claims tab (as in HCC), or the medication's details. 'notes' opens the
  // details at the Notes section, ready to type (the review row's note icon).
  const [tab, setTab] = useState(initialTab === 'notes' ? 'details' : initialTab || 'details');
  const notesRef = useRef(null);
  const [addingBarrier, setAddingBarrier] = useState(false);
  useEffect(() => {
    if (initialTab !== 'notes' || !notesRef.current) return;
    notesRef.current.scrollIntoView({ block: 'start', behavior: 'smooth' });
    notesRef.current.querySelectorAll('textarea')[1]?.focus({ preventScroll: true });
  }, [initialTab]);
  // An open claim replaces the tabs; its back arrow returns to Claim History.
  const [claimId, setClaimId] = useState(null);
  const claims = annotateClaims(med.refills);
  // Another drug opened in the same panel has none of this claim id.
  const openClaimId = tab === 'claims' && claims.some(c => c.claimId === claimId) ? claimId : null;
  const claimCount = (med.refills || []).length;
  const fills = medFills(med);
  const conditions = conditionsOf(med);
  const toggleCondition = (c) => save({
    conditions: conditions.includes(c) ? conditions.filter(x => x !== c) : [...conditions, c],
  });

  return (
    <div className={styles.detail}>
      {!openClaimId && <TabStrip
        items={[
          { key: 'details', label: 'Details' },
          { key: 'claims', label: `Claim History (${claimCount})` },
          { key: 'refills', label: `Refill History (${fills.length})` },
        ]}
        activeKey={tab}
        onChange={setTab}
        fullWidth={false}
        size="S"
        className={flushTabs ? styles.tabsFlush : undefined}
      />}
      {tab === 'claims' ? <MedicationClaims med={med} plan={plan} memberMeds={memberMeds} selectedId={openClaimId} onSelect={setClaimId} flush={flushTabs} /> : tab === 'refills' ? (
      <section className={`${styles.detailSection} ${styles.detailSectionFirst}`}>
      {fills.length === 0 ? <span className={styles.muted}>No fills on file for this medication.</span> : (
      // One row per fill, laid out like the Notes table: the fill date, then
      // quantity and supply, then where and who (address on hover); its
      // source on the right. Fits the pane without a sideways scroll.
      <div className={claimStyles.dataTable}>
        <div className={`${claimStyles.dataTableHead} ${styles.refillGrid}`}>
          <span>Fill</span>
          <span>Source</span>
        </div>
        {fills.map((r, i) => (
          <div key={`${r.date}-${r.source || 'claim'}-${i}`} className={`${claimStyles.dataTableRow} ${styles.refillGrid}`}>
            <div className={styles.refillCell}>
              <span className={styles.refillDate}>{r.date}</span>
              <span className={styles.refillMeta}>
                {[r.qty != null && `Qty ${r.qty}`, r.daysSupply != null && `${r.daysSupply} days supply`].filter(Boolean).map((t, j) => <Fragment key={t}>{j > 0 && <Sep />}{t}</Fragment>)}
              </span>
              <span className={styles.refillMeta} title={r.prescriberAddress ? `Prescriber address: ${r.prescriberAddress}` : undefined}>
                {[r.pharmacy, r.prescriber].filter(Boolean).map((t, j) => <Fragment key={t}>{j > 0 && <Sep />}{t}</Fragment>)}
              </span>
            </div>
            {/* Call-confirmed pickups land here before the claim does. */}
            {r.source ? (
              <span className={styles.sourceCell}>
                <Badge size="sm" icon={r.manual ? 'solar:pen-linear' : 'solar:phone-linear'} label={r.manual ? 'Entered by hand' : r.source} />
                <FillMatchTag match={matchFill(r, claims, plan)} onRework={() => setTab('claims')} />
              </span>
            ) : <span><Badge size="sm" label="Claim" /></span>}
          </div>
        ))}
      </div>
      )}
      </section>
      ) : <>
      {showMeasure && <div className={styles.detailHead}><MeasureCode code={med.measure} /></div>}

      {/* Sections read top to bottom: the drug, who prescribes and fills it,
          notes, then its barrier log. */}
      <section className={`${styles.detailSection} ${showMeasure ? '' : styles.detailSectionFirst}`}>
        <div className={styles.subTitle}>Medication</div>
        <div className={styles.detailRow}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Dose Form</span>
            <span className={styles.fieldValue}>{med.doseForm || '-'}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Route</span>
            <span className={styles.fieldValue}>{med.route || '-'}</span>
          </div>
        </div>
        <div className={styles.detailRow}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Times Refilled</span>
            <span className={styles.fieldValue}>{fills.length}</span>
          </div>
        </div>
        <div className={styles.detailRow}>
          <RadioOptionGroup
            className={styles.medStatus}
            label="Med Status"
            name={`med-status-${med.id}`}
            options={['Active', 'Discontinued'].map(v => ({ value: v, label: v }))}
            value={med.status}
            onChange={status => save({ status })}
          />
          <Select
            label="Reason for Non-Adherence"
            options={NON_ADHERENCE_REASONS}
            value={med.nonAdherenceReason || ''}
            onChange={v => save({ nonAdherenceReason: v })}
            placeholder="Select reason"
          />
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Condition</span>
          <div className={styles.checks}>
            {CONDITIONS.map(c => (
              <label key={c} className={styles.checkRow}>
                <Checkbox checked={conditions.includes(c)} onCheckedChange={() => toggleCondition(c)} />
                <span>{c}</span>
              </label>
            ))}
          </div>
        </div>
        <DraftTextarea key={`sig-${med.id}`} title="SIG" value={med.sig} onCommit={sig => save({ sig })} placeholder="Directions for use" rows={2} />
      </section>

      <section className={styles.detailSection}>
        <div className={styles.subTitle}>Prescriber &amp; Pharmacy</div>
        <div className={styles.detailRow}>
          <ContactCard title="Prescriber" person={med.prescriber} />
          <ContactCard title="Pharmacy" person={med.pharmacy} />
        </div>
      </section>

      <section ref={notesRef} className={styles.detailSection}>
        <div className={styles.subTitle}>Notes</div>
        <div className={styles.detailRow}>
          <DraftTextarea key={`md-${med.id}`} title="Notes to MD" value={med.notesToMd} onCommit={notesToMd => save({ notesToMd })} placeholder="Note for the prescriber" />
          <DraftTextarea key={`int-${med.id}`} title="Internal Notes" value={med.internalNotes} onCommit={internalNotes => save({ internalNotes })} placeholder="Visible to the care team only" />
        </div>
      </section>

      <section className={styles.detailSection}>
        <div className={styles.subTitleRow}>
          <span className={styles.subTitle}>Barriers &amp; Interventions ({med.measure})</span>
          {/* Discontinued drugs are off the record, so nothing to add. */}
          {med.status !== 'Discontinued' && (
            <ActionButton icon="solar:add-circle-linear" size="sm" tooltip="Add barrier or intervention" tooltipLeft active={addingBarrier} onClick={() => setAddingBarrier(v => !v)} />
          )}
        </div>
        <DrugBarriers member={member} code={med.measure} medId={med.id} adding={addingBarrier} onAddDone={() => setAddingBarrier(false)} />
      </section>

      </>}
    </div>
  );
}

// Therapeutic class by generic name, so a switch within a class (one ARB
// discontinued, another started) sits together.
const CLASS_BY_GENERIC = [
  [/metformin/, 'Biguanides'],
  [/glipizide|glyburide|glimepiride/, 'Sulfonylureas'],
  [/sitagliptin|linagliptin|saxagliptin|alogliptin/, 'DPP-4 inhibitors'],
  [/pioglitazone/, 'Thiazolidinediones'],
  [/pril$/, 'ACE inhibitors'],
  [/sartan/, 'ARBs'],
  [/statin/, 'Statins'],
];
const classOf = (d) => CLASS_BY_GENERIC.find(([re]) => re.test(d.generic || ''))?.[1] || 'Other';

// MM/DD/YYYY (stored) ↔ YYYY-MM-DD (date input).
const toIso = (mdy) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(mdy || '');
  return m ? `${m[3]}-${m[1]}-${m[2]}` : '';
};
const fromIso = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[2]}/${m[3]}/${m[1]}` : '';
};

// One gap's medications, grouped by therapeutic class so a switch within a
// class (one ARB discontinued, another started) sits together.
function classGroups(x) {
  const out = [];
  for (const d of x.medications) {
    const cls = classOf(d);
    let g = out.find(y => y.cls === cls);
    if (!g) { g = { cls, meds: [] }; out.push(g); }
    g.meds.push({ ...d, measure: x.code });
  }
  return out;
}

// Medication Review step of the Pharmacy program. Every pharmacy gap is an
// expandable card, the one opened from the worklist first; open gaps start
// expanded, closed ones (picked up, closed by data) collapsed. Inside, the
// gap's medications are grouped by therapeutic class so drug switches are
// visible. Last Fill is the claims date; Recent Fill (set by a pickup or
// refill-approved outreach) is editable and drives next fill and PDC. Clicking a medication opens its details and refill history.
// `onOpenMed` lets a host (the gap drawer) show a medication in its own
// side workspace instead of the stacked drawer.
// `compact` (Pharmacy Gap Details): the gap table above already shows each
// gap's status, PDC and dates, so each gap card is just its drugs, and each
// drug row keeps the fill columns; the rest is a click away in its details.
// `activeMedId`: the medication whose details the host has open; its row
// reads as selected.
export function PharmacyMedicationReview({ member: memberProp, onOpenMed, compact = false, activeMedId = null }) {
  const fromProfile = usePharmacyProgramMember();
  const member = memberProp || fromProfile;
  const focus = useAppStore(s => s.pharmacyFocusGap);
  const setRecentFill = useAppStore(s => s.setPharmacyRecentFill);
  // Expansion the user chose, per gap; gaps they haven't touched follow
  // their default, so a later status change doesn't flip a chosen state.
  const [chosen, setChosen] = useState(() => new Map());
  const [openId, setOpenId] = useState(null);
  const [openTab, setOpenTab] = useState(null);
  // Opens a drug's details, or its claim history for a rework.
  const openDrug = (medId, medTab = null) => {
    if (onOpenMed) { onOpenMed(medId, medTab); return; }
    setOpenId(medId);
    setOpenTab(medTab);
  };
  // Bulk Recent Fill: drugs picked across any gaps, as "code|medId".
  const setRecentFillBulk = useAppStore(s => s.setPharmacyRecentFillBulk);
  const [picked, setPicked] = useState(() => new Set());
  const [bulkRect, setBulkRect] = useState(null);
  // Picks belong to one patient: drop them when another patient opens on
  // this step (the step is not remounted).
  const [pickedFor, setPickedFor] = useState(member?.id);
  if (pickedFor !== member?.id) {
    setPickedFor(member?.id);
    setPicked(new Set());
    setBulkRect(null);
  }
  const pickKey = (code, medId) => `${code}|${medId}`;
  const togglePick = (key) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  // Select-all: every active drug of one gap, or of all gaps.
  const activeKeys = (xs) => xs.flatMap(x => x.medications.filter(d => d.status !== 'Discontinued').map(d => pickKey(x.code, d.id)));
  const checkState = (keys) => (keys.length && keys.every(k => picked.has(k)) ? true : keys.some(k => picked.has(k)) ? 'indeterminate' : false);
  const setMany = (keys, on) => setPicked(prev => {
    const next = new Set(prev);
    for (const k of keys) { if (on) next.add(k); else next.delete(k); }
    return next;
  });
  const applyBulk = (iso) => {
    setBulkRect(null);
    if (!iso) return;
    setRecentFillBulk(member.id, [...picked].map(k => { const [code, medId] = k.split('|'); return { code, medId }; }), fromIso(iso));
    setPicked(new Set());
  };

  const all = useMemo(() => (member?.measures || [])
    .map(x => ({ ...x, st: measureStatus(x, member) }))
    .toSorted((a, b) => MEASURE_ORDER.indexOf(a.code) - MEASURE_ORDER.indexOf(b.code)), [member]);
  const focusCode = focus?.memberId === member?.id ? focus.code : null;
  const shown = all.toSorted((a, b) => (b.code === focusCode) - (a.code === focusCode));

  const openCodes = new Set(all.filter(x => isActiveGap(x.st)).map(x => x.code));
  // Red only for an open gap's risk; a closed gap's numbers are history.
  const riskClass = (code, tone) => (openCodes.has(code) ? TONE_CLASS[tone] || '' : '');
  // Open gaps (and the one opened from the worklist) start expanded.
  const isExpanded = (code) => (chosen.has(code) ? chosen.get(code) : openCodes.has(code) || code === focusCode);
  const toggle = (code) => setChosen(prev => new Map(prev).set(code, !isExpanded(code)));
  const medCount = all.reduce((n, x) => n + x.medications.length, 0);
  const openMed = openId
    ? all.flatMap(x => x.medications.map(d => ({ ...d, measure: x.code }))).find(d => d.id === openId)
    : null;

  // Compact (Pharmacy Gap Details), after the CIS dose list: a gap title line
  // with only a bottom stroke ("MAD (Medication Adherence for Diabetes)",
  // count on the right), then the drugs outside any card. Each drug is two
  // lines: Rx and the fill columns, then quantity, days supply, prescriber
  // and pharmacy; a note icon (when the drug has one) and its details sit in
  // a fixed column on the right.
  const barriersOf = (x) => gapActiveBarriers(member, x);
  const renderCompactGroup = (x) => {
    const expanded = isExpanded(x.code);
    const keys = activeKeys([x]);
    return (
      <div key={x.code} className={styles.cGroup}>
        <button type="button" className={styles.cGroupHead} onClick={() => toggle(x.code)} aria-expanded={expanded}>
          <DownChevronIcon size={16} className={`${styles.chevron} ${expanded ? '' : styles.chevronRight}`} />
          <span className={styles.cCode}>{x.code}</span>
          <span className={styles.cName}>({MEASURE_NAMES[x.code]})</span>
          <span className={styles.cCount}>
            {/* Collapsed, the gap shows how many barriers stand on it; the
                drug rows show them once it is open. */}
            {!expanded && barriersOf(x).length > 0 && (
              <Tooltip label={barriersOf(x).join(', ')} placement="bottom">
                <Badge size="sm" tone="danger" icon={BARRIER_ICON} label={`${barriersOf(x).length} Barrier${barriersOf(x).length === 1 ? '' : 's'}`} />
              </Tooltip>
            )}
            <Badge size="sm" label={`${x.medications.length} Med${x.medications.length === 1 ? '' : 's'}`} />
          </span>
        </button>
        {expanded && (
          <div className={styles.cTable} role="table" aria-label={`${x.code} medications`}>
            <div className={`${styles.cRow} ${styles.cHead}`} role="row">
              <span role="columnheader">
                {keys.length > 0 && (
                  <Checkbox checked={checkState(keys)} onCheckedChange={() => setMany(keys, checkState(keys) !== true)} aria-label={`Select all ${x.code} medications`} />
                )}
              </span>
              <span role="columnheader">Rx</span>
              <span role="columnheader">Last Fill</span>
              <span role="columnheader" title="A date entered here is projected until a matching Part D claim arrives">Recent Fill</span>
              <span role="columnheader">Next Fill</span>
              <span role="columnheader">PDC</span>
              <span role="columnheader" aria-label="Actions" />
            </div>
            {classGroups(x).flatMap(g => g.meds.map(d => ({ ...d, cls: g.cls }))).map(d => {
              const dc = d.status === 'Discontinued';
              const notes = [d.internalNotes && `Internal: ${d.internalNotes}`, d.notesToMd && `To MD: ${d.notesToMd}`].filter(Boolean);
              const note = notes.join(' · ');
              const noteCount = notes.length;
              const match = dc ? null : fillMatchOf(d, member.healthPlan);
              const supply = [
                dc && 'Discontinued',
                d.qty != null && `Qty ${d.qty}`,
                d.daysSupply != null && `${d.daysSupply} days supply`,
              ].filter(Boolean);
              const fillCount = medFills(d).length;
              const refills = `Refilled ${fillCount} time${fillCount === 1 ? '' : 's'}`;
              const source = [
                d.prescriber?.name && ['Prescriber', d.prescriber.name],
                d.pharmacy?.name && ['Pharmacy', d.pharmacy.name],
              ].filter(Boolean);
              return (
                <div key={d.id} className={`${styles.cRow} ${styles.cMedRow} ${dc ? styles.cDiscontinued : ''} ${d.id === activeMedId ? styles.cMedRowActive : ''}`} role="row" aria-selected={d.id === activeMedId} onClick={() => openDrug(d.id)}>
                  <span className={styles.cPick} onClick={e => e.stopPropagation()}>
                    {!dc && <Checkbox checked={picked.has(pickKey(x.code, d.id))} onCheckedChange={() => togglePick(pickKey(x.code, d.id))} aria-label={`Select ${d.name}`} />}
                  </span>
                  {/* Rx and Recent Fill stack their details under them, so each
                      is one block centered in the row like the other cells. */}
                  <span className={styles.cStack}>
                    <span className={styles.cRx}>{d.name} {d.strength} {d.unit}</span>
                    <span className={styles.cMeta} onClick={e => e.stopPropagation()}>
                      {supply.length > 0 && <span className={styles.cMetaLine}>{supply.map((t, i) => <Fragment key={t}>{i > 0 && <Sep />}{t}</Fragment>)}</span>}
                      {/* Info • Barrier • how many times it was filled. */}
                      <span className={styles.cLinks}>
                          {source.length > 0 && (
                            <Tooltip
                              placement="bottom"
                              align="left"
                              maxWidth={260}
                              label={<span className={styles.cSource}>{source.map(([k, v]) => <span key={k}>{k}: {v}</span>)}</span>}
                            >
                              <button type="button" className={styles.cInfoLink} aria-label={source.map(([k, v]) => `${k}: ${v}`).join(', ')}>Info</button>
                            </Tooltip>
                          )}
                          {source.length > 0 && d.nonAdherenceReason && <Sep />}
                          {d.nonAdherenceReason && (
                            <Tooltip placement="bottom" align="left" maxWidth={260} label={`Barrier: ${d.nonAdherenceReason}`}>
                              <button type="button" className={`${styles.cInfoLink} ${styles.cBarrierText}`} aria-label={`Barrier: ${d.nonAdherenceReason}`}>1 Barrier</button>
                            </Tooltip>
                          )}
                          {(source.length > 0 || d.nonAdherenceReason) && <Sep />}
                          <span className={styles.cRefills}>{refills}</span>
                        </span>
                    </span>
                  </span>
                  <span className={styles.cValue}>{d.lastFill || '-'}</span>
                  <span className={styles.cStack} onClick={e => e.stopPropagation()}>
                    {dc ? (d.recentFill || '-') : (
                      <RecentFillChip
                        date={d.recentFill}
                        label={`${d.name} recent fill date`}
                        onChange={(mdy) => setRecentFill(member.id, x.code, d.id, mdy || null)}
                      />
                    )}
                    {match && (
                      <span className={styles.cMatch}>
                        <FillMatchText match={match} onRework={() => openDrug(d.id, 'claims')} />
                      </span>
                    )}
                  </span>
                  <span className={`${styles.cValue} ${riskClass(d.measure, fillDueTone(d.nextFill))}`}>{d.nextFill || '-'}</span>
                  <span className={`${styles.cValue} ${riskClass(d.measure, pdcTone(d.pdc))}`}>{d.pdc == null ? '-' : `${d.pdc}%`}</span>
                  <span className={styles.cActions} onClick={e => e.stopPropagation()}>
                    {/* Always there: opens the drug at its Notes; the count and the
                        tooltip say what is already written. */}
                    <ActionButton
                      icon="solar:notes-linear"
                      size="sm"
                      count={noteCount ? String(noteCount) : undefined}
                      tooltip={note || 'Add a note'}
                      tooltipLeft
                      onClick={() => openDrug(d.id, 'notes')}
                    />
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (!member) {
    return (
      <div className={styles.empty}>
        <Icon name="solar:pill-linear" size={40} color="var(--neutral-200)" />
        <p>No MAC, MAD or MAH medications on file for this member.</p>
      </div>
    );
  }

  return (
    <div className={`${styles.wrap} ${picked.size > 0 ? styles.wrapWithBulk : ''}`}>
      <div className={`${styles.toolbar} ${compact ? styles.cToolbar : ''}`}>
        {activeKeys(all).length > 0 && (
          <label className={styles.checkRow}>
            <Checkbox
              checked={checkState(activeKeys(all))}
              onCheckedChange={() => setMany(activeKeys(all), checkState(activeKeys(all)) !== true)}
              aria-label="Select all medications"
            />
            <span>Select all medications</span>
          </label>
        )}
        {!compact && <span className={styles.count}>{all.length} gap{all.length === 1 ? '' : 's'} · {medCount} medication{medCount === 1 ? '' : 's'}</span>}
      </div>
      {!compact && (
        <p className={styles.helper}>
          <Icon name="solar:info-circle-linear" size={14} color="var(--neutral-300)" />
          A Recent Fill date entered here is projected: it updates PDC, next fill and fail date, but the gap only closes when a matching Part D claim arrives.
        </p>
      )}

      {/* Selected medications get the shared floating bulk bar; Set Recent
          Fill opens the calendar and applies the date to all of them. */}
      <BulkBar
        className={compact ? styles.bulkBarInDrawer : undefined}
        selectedIds={[...picked]}
        onClear={() => setPicked(new Set())}
        actions={[{
          label: 'Set Recent Fill',
          icon: 'solar:calendar-linear',
          variant: 'solid',
          size: 'md',
          onClick: (_ids, e) => setBulkRect(e.currentTarget.getBoundingClientRect()),
        }]}
      />
      {bulkRect && (
        <DatePickerPopover
          open
          value=""
          anchorRect={bulkRect}
          max={toIso(todayMdy())}
          onChange={applyBulk}
          onClose={() => setBulkRect(null)}
        />
      )}

      {compact && shown.map(x => renderCompactGroup(x))}
      {!compact && shown.map(x => {
        const expanded = isExpanded(x.code);
        return (
          <section key={x.code} className={`${styles.gapCard} ${x.code === focusCode ? styles.gapCardFocus : ''}`}>
            <button type="button" className={styles.gapCardToggle} onClick={() => toggle(x.code)} aria-expanded={expanded}>
              <span className={styles.gapCardHead}>
                <DownChevronIcon size={14} className={`${styles.chevron} ${expanded ? '' : styles.chevronRight}`} />
                <MeasureCode code={x.code} />
                <span className={styles.groupName}>{MEASURE_NAMES[x.code]}</span>
                {!compact && x.code === focusCode && <span className={styles.groupMeta}>Opened from worklist</span>}
                <span className={styles.groupMeta}>{x.medications.length} medication{x.medications.length === 1 ? '' : 's'}</span>
              </span>
              {!compact && <span className={styles.gapCardMeta}>
                <Badge size="sm" {...gapBadge(x.st)} />
                <SubStatus label={x.st.label} />
                <span className={styles.groupMeta}>{x.pdcProjected != null ? 'Projected PDC' : 'PDC'} <b className={riskClass(x.code, pdcTone(effectivePdc(x)))}>{effectivePdc(x) == null ? '-' : `${effectivePdc(x)}%`}</b></span>
                <span className={styles.groupMeta}>Next due <b className={riskClass(x.code, fillDueTone(x.nextFillDue))}>{x.nextFillDue || '-'}</b></span>
              </span>}
            </button>

            {expanded && (
              <div className={styles.tableScroll}>
                <table className={`${styles.table} ${styles.medTable}`}>
                  <thead>
                    <tr>
                      <th className={styles.pickCol}>
                        {activeKeys([x]).length > 0 && (
                          <Checkbox
                            checked={checkState(activeKeys([x]))}
                            onCheckedChange={() => setMany(activeKeys([x]), checkState(activeKeys([x])) !== true)}
                            aria-label={`Select all ${x.code} medications`}
                          />
                        )}
                      </th><th>Rx</th><th>Last Fill</th>
                      <th>{compact ? <span title="A date entered here is projected until a matching Part D claim arrives">Recent Fill</span> : 'Recent Fill'}</th>
                      <th>Next Fill</th><th>PDC</th>
                      {!compact && <><th>MPR</th><th>DS</th><th>Quantity</th><th>Barrier</th><th>Prescriber</th><th>Pharmacy</th></>}
                      <th aria-label="Open" />
                    </tr>
                  </thead>
                  <tbody>
                    {classGroups(x).map(g => {
                      const switched = g.meds.some(d => d.status === 'Discontinued') && g.meds.some(d => d.status !== 'Discontinued');
                      return (
                        <Fragment key={g.cls}>
                          <tr className={styles.groupRow}>
                            <td colSpan={compact ? 7 : 13}>
                              <span className={styles.groupHead}>
                                <span className={styles.groupName}>{g.cls}</span>
                                <span className={styles.groupMeta}>{g.meds.length} medication{g.meds.length === 1 ? '' : 's'}</span>
                                {switched && <Badge size="sm" icon="solar:refresh-linear" label="Drug switched" />}
                              </span>
                            </td>
                          </tr>
                          {g.meds.map(d => (
                            <tr
                              key={d.id}
                              className={`${styles.medRow} ${openId === d.id ? styles.medRowSelected : ''} ${d.status === 'Discontinued' ? styles.medRowDc : ''}`}
                              onClick={() => openDrug(d.id)}
                            >
                              <td className={styles.pickCol} onClick={e => e.stopPropagation()}>
                                {d.status !== 'Discontinued' && (
                                  <Checkbox
                                    checked={picked.has(pickKey(x.code, d.id))}
                                    onCheckedChange={() => togglePick(pickKey(x.code, d.id))}
                                    aria-label={`Select ${d.name}`}
                                  />
                                )}
                              </td>
                              <td className={styles.rxCell}>
                                <span className={styles.rxName}>{d.name} {d.strength} {d.unit}</span>
                                <span className={styles.rxGeneric}>
                                  {d.generic} · <span className={URGENT_MED_STATUSES.has(medicationStatus(d, member.healthPlan)) ? styles.toneError : ''}>{medicationStatus(d, member.healthPlan)}</span>
                                </span>
                              </td>
                              <td>{d.lastFill}</td>
                              {d.status === 'Discontinued' ? (
                                <td>{d.recentFill || '-'}</td>
                              ) : (
                                <td className={styles.dateCell} onClick={e => e.stopPropagation()}>
                                  <DatePicker
                                    value={toIso(d.recentFill)}
                                    onSelect={(iso) => setRecentFill(member.id, x.code, d.id, fromIso(iso) || null)}
                                    aria-label={`${d.name} recent fill date`}
                                  />
                                  <FillMatchTag match={fillMatchOf(d, member.healthPlan)} onRework={() => openDrug(d.id, 'claims')} />
                                </td>
                              )}
                              <td className={riskClass(d.measure, fillDueTone(d.nextFill))}>{d.nextFill}</td>
                              <td className={riskClass(d.measure, pdcTone(d.pdc))}>{d.pdc == null ? '-' : `${d.pdc}%`}</td>
                              {!compact && <>
                                <td>{d.mpr ?? '-'}</td>
                                <td>{d.daysSupply}</td>
                                <td>{d.qty}</td>
                                <td>{d.nonAdherenceReason ? <Badge size="sm" label={d.nonAdherenceReason} /> : '-'}</td>
                                <td>{d.prescriber?.name || '-'}</td>
                                <td>{d.pharmacy?.name || '-'}</td>
                              </>}
                              <td className={styles.openCell}>
                                <DownChevronIcon size={14} className={`${styles.chevron} ${styles.chevronRight}`} />
                              </td>
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

      {openMed && (
        <Drawer
          title={`${openMed.name} ${openMed.strength} ${openMed.unit} (${openMed.generic})`}
          onClose={() => setOpenId(null)}
          width={760}
        >
          <MedicationDetail key={`${openMed.id}-${openTab || 'details'}`} med={openMed} memberRowId={member.id} plan={member.healthPlan} initialTab={openTab} />
        </Drawer>
      )}
    </div>
  );
}
