import { useRef, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Badge } from '../../../components/Badge/Badge';
import { Button } from '../../../components/Button/Button';
import { Input } from '../../../components/Input/Input';
import { DashboardCard } from '../../../components/DashboardCard/DashboardCard';
import { Icon } from '../../../components/Icon/Icon';
import { DownChevronIcon } from '../../../components/Icon/DownChevronIcon';
import { PhoneLink } from '../../../components/PhoneLink/PhoneLink';
import { MenuPopover } from '../../../components/MenuPopover/MenuPopover';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import {
  canSetGapStatus, gapBadge, MANUAL_GAP_STATUSES, MEASURE_NAMES, daysFromToday, isActiveGap, enrichPharmacyMember, medicationStatus, pdcTone, pharmaciesUsed, prescribersOf,
} from '../pharmacyWorklist.utils';
import { Dash, DrugsCount, DueDate, NamesCount, FailDateValue, MeasureCode, NextFillDueValue, PdcValue, PriorYearPdc, SavabilityBadge, SubStatus } from '../PharmacyCells';
import { usePharmacyProgramMember } from './usePharmacyProgramMember';
import styles from './PharmacySnapshotStep.module.css';

// Days supply and quantity in one cell: "90 days • Qty 90".
const supplyLabel = (d) => [d.daysSupply != null && `${d.daysSupply} days`, d.qty != null && `Qty ${d.qty}`].filter(Boolean).join(' • ') || '-';

const addressOf = (o) => [o.address1, o.city, o.state, o.zip].filter(Boolean).join(', ') || '-';

// The gap's prescribers or pharmacies, one each (a gap's drugs may come
// from different ones), from its active medications.
function contactsOf(meds, key) {
  const seen = new Map();
  for (const d of meds || []) {
    const c = d.status !== 'Discontinued' && d[key];
    if (c?.name && !seen.has(c.name)) seen.set(c.name, c);
  }
  return [...seen.values()];
}

// One line per contact, or a dash.
function ContactLines({ contacts, render }) {
  if (!contacts.length) return '-';
  return <span className={styles.detailLines}>{contacts.map(c => <span key={c.name}>{render(c)}</span>)}</span>;
}

// What a compact gap row opens to: the gap's details the table leaves out,
// label above value, three to a row (Figma 5693:49946). Its drugs are in
// Medication Review.
const PDC_SOURCE_TEXT = { Manual: 'Set by hand', Projected: 'Projected from a confirmed pickup', 'To date': 'Calculated to date', Plan: 'From the plan file', Calculated: 'Calculated' };

// The gap's PDC with where it comes from; the pencil sets it by hand (Fold
// keeps calculating underneath, and Use calculated goes back to it).
function PdcField({ gap: g, memberId }) {
  const setOverride = useAppStore(s => s.setPharmacyPdcOverride);
  const [draft, setDraft] = useState(null);
  const manual = g.pdcSource === 'Manual';
  const save = () => {
    const n = Math.round(Number(draft));
    if (draft === '' || !Number.isFinite(n) || n < 0 || n > 100) return;
    setOverride(memberId, g.code, n);
    setDraft(null);
  };
  if (draft != null) {
    return (
      <span className={styles.pdcEdit}>
        <Input type="number" size="sm" min={0} max={100} value={draft} onChange={e => setDraft(e.target.value)} aria-label={`${g.code} PDC`} autoFocus />
        <Button size="sm" onClick={save}>Save</Button>
        <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
      </span>
    );
  }
  return (
    <span className={styles.detailLines}>
      <span className={styles.pdcLine}>
        {g.pdc == null ? '-' : `${g.pdc}%`}
        <ActionButton icon="solar:pen-linear" size="sm" tooltip="Set PDC by hand" onClick={() => setDraft(g.pdc == null ? '' : String(g.pdc))} />
      </span>
      <span className={styles.muted}>
        {manual ? `${PDC_SOURCE_TEXT.Manual}${g.pdcManualBy ? ` by ${g.pdcManualBy}` : ''}${g.pdcManualOn ? `, ${g.pdcManualOn}` : ''}` : PDC_SOURCE_TEXT[g.pdcSource] || ''}
      </span>
      {manual && <button type="button" className={styles.linkBtn} onClick={() => setOverride(memberId, g.code, null)}>Use calculated</button>}
    </span>
  );
}

function GapDetails({ gap: g, memberId }) {
  const open = isActiveGap(g.status);
  const prescribers = contactsOf(g.medications, 'prescriber');
  const pharmacies = contactsOf(g.medications, 'pharmacy');
  const phone = (c) => (c.phone ? <PhoneLink number={c.phone} label={c.name} /> : '-');
  const items = [
    ['PDC', <PdcField key="pdc" gap={g} memberId={memberId} />],
    ['Claim', g.recon ? (
      <Tooltip label={g.recon.detail} placement="bottom">
        <span className={g.recon.rework && open ? styles.toneError : ''}>{g.recon.status}</span>
      </Tooltip>
    ) : 'Nothing to reconcile'],
    ['Start Date', g.startDate || '-'],
    ['Prior-Year PDC', <PriorYearPdc key="py" years={g.priorYearPdc} nonCompliant={g.priorYearNonCompliant} year={new Date().getFullYear() - 1} />],
    ['Savability', <SavabilityBadge key="sv" value={g.savability} />],
    ['Allowable Gap Days', g.allowableGapDays == null ? '-' : <span className={g.allowableGapDays <= 0 ? styles.toneError : ''}>{g.allowableGapDays} days</span>],
    ['Attempts This Cycle', g.attempts],
    ['Last Pickup Confirmed', g.pickupConfirmed || '-'],
    ['Prescriber', <ContactLines key="rx" contacts={prescribers} render={c => c.name} />],
    ['Prescriber Phone', <ContactLines key="rxp" contacts={prescribers} render={phone} />],
    ['Pharmacy', <ContactLines key="ph" contacts={pharmacies} render={c => c.name} />],
    ['Pharmacy Phone', <ContactLines key="php" contacts={pharmacies} render={phone} />],
  ];
  return (
    <div className={styles.detailPanel}>
      <div className={styles.detailGrid}>
        {items.map(([label, value]) => (
          <div key={label} className={styles.detail}>
            <span className={styles.detailLabel}>{label}</span>
            <span className={styles.detailValue}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// A projected value reads plain in the table; hovering it says so, briefly.
const PROJECTED_HINT = 'Projected until the claim matches';
function Projected({ on, children }) {
  if (!on) return children;
  return <Tooltip label={PROJECTED_HINT} placement="bottom" maxWidth={240}><span>{children}</span></Tooltip>;
}

// A value that needs action (PDC below 80%, a fail date within 14 days, an
// overdue fill on an open gap) uses the shared alert style: red, with a
// dashed underline and why on hover. Otherwise the value is plain, with the short
// projected hint when it rests on a fill not yet claimed.

// Shows a gap's value as needing action even when it is projected (the
// alert style, not the projected one).
const alertSources = (g) => ({ ...g, pdcSource: null, failDateSource: null });

function Pdc({ gap: g }) {
  if (g.pdc == null) return <span className={styles.muted}>Not sent</span>;
  const open = isActiveGap(g.status);
  if (open && pdcTone(g.pdc) === 'error') return <PdcValue pdc={g.pdc} open source={null} medications={g.medications} />;
  return <Projected on={g.pdcSource === 'Projected'}><span>{g.pdc}%</span></Projected>;
}

function FailDate({ gap: g }) {
  const d = daysFromToday(g.failDate);
  if (isActiveGap(g.status) && d != null && d <= 14) return <FailDateValue gap={alertSources(g)} />;
  return <Projected on={g.failDateSource === 'Projected'}><span>{g.failDate || '-'}</span></Projected>;
}

// The same as the worklist: the date, with a due line under it when due.
function NextFill({ gap: g }) {
  return <NextFillDueValue gap={g} />;
}

// The compact gap table (Pharmacy Gap Details), laid out like the Pharmacy
// Gap table in Figma (5693:49892): title with the gap toggle beside it, a
// header row, one line per gap, and a grey detail panel under an open gap.
function GapList({ gaps, memberId, title, titleExtra, onSetStatus }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const [statusMenu, setStatusMenu] = useState(null); // { code, rect }
  const toggle = (code) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(code)) next.delete(code); else next.add(code);
    return next;
  });
  const menuGap = statusMenu && gaps.find(g => g.code === statusMenu.code);

  return (
    <div className={styles.gapList}>
      <div className={styles.listTitleRow}>
        <span className={styles.listTitle}>{title}:</span>
        {titleExtra}
      </div>
      <div className={styles.list} role="table" aria-label={title}>
        <div className={`${styles.listGrid} ${styles.listHead}`} role="row">
          <span role="columnheader">Gap</span>
          <span role="columnheader">Drugs</span>
          <span role="columnheader">Status</span>
          <span role="columnheader">PDC</span>
          <span role="columnheader">Fail Date</span>
          <span role="columnheader">Next Fill Due</span>
        </div>
        {gaps.map(g => {
          const isOpen = expanded.has(g.code);
          const workable = onSetStatus && canSetGapStatus(g.status);
          const badge = (
            <Badge size="sm" {...gapBadge(g.status)}
              trailingIconElement={workable ? <DownChevronIcon size={12} color="currentColor" /> : undefined} />
          );
          return (
            <div key={g.code} className={styles.listItem} role="rowgroup">
              <div className={`${styles.listGrid} ${styles.listRow}`} role="row">
                <button type="button" className={styles.listName} onClick={() => toggle(g.code)} aria-expanded={isOpen} aria-label={`${isOpen ? 'Hide' : 'Show'} ${g.code} details`} title={`${g.code} - ${MEASURE_NAMES[g.code]}`}>
                  <span className={styles.chevronBox}><DownChevronIcon size={16} className={`${styles.chevron} ${isOpen ? '' : styles.chevronRight}`} /></span>
                  <span className={styles.listNameText}>{g.code}</span>
                </button>
                <span className={styles.listCell} role="cell"><DrugsCount meds={g.medications || []} /></span>
                <span className={styles.listStatus} role="cell">
                  {workable ? (
                    <button
                      type="button"
                      className={styles.statusBtn}
                      onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setStatusMenu(cur => (cur?.code === g.code ? null : { code: g.code, rect })); }}
                      aria-haspopup="menu"
                      aria-label={`Change ${g.code} status`}
                    >{badge}</button>
                  ) : (
                    // A span, so the Badge's own centering doesn't apply in
                    // this column (it lines up with the buttons above).
                    <span>{badge}</span>
                  )}
                  {/* A reopen names its reason under the badge. */}
                  {g.status.gap === 'Reopened' && <SubStatus label={g.status.reopenReason} />}
                </span>
                <span className={styles.listCell} role="cell"><Pdc gap={g} /></span>
                <span className={styles.listCell} role="cell"><FailDate gap={g} /></span>
                <span className={styles.listCell} role="cell"><NextFill gap={g} /></span>
              </div>
              {isOpen && <GapDetails gap={g} memberId={memberId} />}
            </div>
          );
        })}
      </div>
      {menuGap && (
        <MenuPopover
          anchorRect={statusMenu.rect}
          items={MANUAL_GAP_STATUSES.map(s => ({ key: s, label: s, selected: s === menuGap.status.gap }))}
          onSelect={(key) => { onSetStatus(menuGap.code, key); setStatusMenu(null); }}
          onClose={() => setStatusMenu(null)}
          width={200}
          ariaLabel={`Change ${menuGap.code} status`}
        />
      )}
    </div>
  );
}

// The member's pharmacy gaps, one row each. A row opens its medications, or
// with `compact` (Pharmacy Gap Details) its details: compact keeps only
// gap, status (its sub-status says what is needed), PDC and fail date in the
// row, without plan / Fold source marks (projected values keep their
// underline). With `onSetStatus`, a gap the team may still move
// (Open / In Progress) gets its status menu. `titleExtra` sits next to the
// card title (the drawer's gap toggle).
export function PharmacyGapsCard({ member, onSetStatus, compact = false, titleExtra }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const [statusMenu, setStatusMenu] = useState(null); // { code, rect }
  const toggle = (code) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(code)) next.delete(code); else next.add(code);
    return next;
  });
  const m = enrichPharmacyMember(member);
  const menuGap = statusMenu && m.gaps.find(g => g.code === statusMenu.code);
  if (compact) return <GapList gaps={m.gaps} memberId={m.id} title="Pharmacy Gap" titleExtra={titleExtra} onSetStatus={onSetStatus} />;
  const gridClass = styles.gapGrid;

  return (
    <DashboardCard title="Pharmacy Gaps" count={`${m.progress.closed} of ${m.progress.total} closed • ${m.progress.label}`}>
      {/* Column names once, not on every row; rows share its grid. */}
      <div className={`${gridClass} ${styles.gapHead}`} aria-hidden="true">
        <span>Gap</span><span>Status</span><span>PDC</span><span>Fail Date</span><span>Next Fill Due</span><span>Claim</span>
      </div>
      {m.gaps.map(g => {
        // Red only where someone has to act: an open gap. A closed gap's
        // low PDC or past fill date is history.
        const open = isActiveGap(g.status);
        const isOpen = expanded.has(g.code);
        const claimFlagged = !!g.recon?.rework;
        const workable = onSetStatus && canSetGapStatus(g.status);
        return (
          <div key={g.code} className={styles.gapItem}>
            <div className={`${gridClass} ${styles.gapRow}`} data-expanded={isOpen}>
              <button type="button" className={styles.gapCode} onClick={() => toggle(g.code)} aria-expanded={isOpen} aria-label={`${isOpen ? 'Hide' : 'Show'} ${g.code} medications`}>
                <DownChevronIcon size={14} className={`${styles.chevron} ${isOpen ? '' : styles.chevronRight}`} />
                <MeasureCode code={g.code} />
              </button>
              <span className={styles.gapStatus}>
                {workable ? (
                  <button
                    type="button"
                    className={styles.statusBtn}
                    onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setStatusMenu(cur => (cur?.code === g.code ? null : { code: g.code, rect })); }}
                    aria-haspopup="menu"
                    aria-label={`Change ${g.code} status`}
                  >
                    <Badge size="sm" {...gapBadge(g.status)} trailingIconElement={<DownChevronIcon size={12} color="currentColor" />} />
                  </button>
                ) : (
                  <Tooltip label={onSetStatus ? `Set by Fold${g.status.label ? '' : `: ${g.status.detail}`}` : ''} placement="bottom">
                    <span><Badge size="sm" {...gapBadge(g.status)} /></span>
                  </Tooltip>
                )}
                {/* A reopen says why first, then the gap's signal. */}
                {g.status.gap === 'Reopened'
                  ? <SubStatus label={g.status.reopenReason} suffix={g.status.label !== 'Claim reversed' ? g.status.label : null} />
                  : <SubStatus label={g.status.label} />}
              </span>
              <PdcValue pdc={g.pdc} open={open} source={g.pdcSource} medications={g.medications} />
              <FailDateValue gap={g} />
              <NextFillDueValue gap={g} />
              {g.recon ? <span className={claimFlagged && open ? styles.toneError : styles.value}>{g.recon.status}</span> : <Dash />}
            </div>
            {isOpen && (
              <div className={styles.medNest}>
                <div className={styles.medPanel}>
                  <table className={styles.medTable}>
                    <thead>
                      <tr><th>Medication</th><th>Last Fill</th><th>Recent Fill</th><th>Next Fill</th><th>Supply</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {g.medications.map(d => (
                        <tr key={d.id}>
                          <td className={styles.medName}>{d.name} {d.strength} {d.unit}</td>
                          <td>{d.lastFill || '-'}</td>
                          <td>{d.recentFill || '-'}</td>
                          <td><DueDate date={d.nextFill} alert={open && d.status !== 'Discontinued'} /></td>
                          <td>{supplyLabel(d)}</td>
                          <td className={d.status === 'Discontinued' ? styles.muted : ''}>{medicationStatus(d, member.healthPlan)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {menuGap && (
        <MenuPopover
          anchorRect={statusMenu.rect}
          items={MANUAL_GAP_STATUSES.map(s => ({ key: s, label: s, selected: s === menuGap.status.gap }))}
          onSelect={(key) => { onSetStatus(menuGap.code, key); setStatusMenu(null); }}
          onClose={() => setStatusMenu(null)}
          width={200}
          ariaLabel={`Change ${menuGap.code} status`}
        />
      )}
    </DashboardCard>
  );
}

// The card header's call action: straight to the call popover (pick the line
// to call from) for one contact; with several, pick who first.
function CallContactAction({ contacts, onDial }) {
  const openNumberCallPopover = useAppStore(st => st.openNumberCallPopover);
  const btnRef = useRef(null);
  const [menuRect, setMenuRect] = useState(null);
  const callable = contacts.filter(c => c.phone);
  if (!callable.length) return null;
  const call = (c) => openNumberCallPopover({ number: c.phone, label: c.name, onDial: onDial(c.name, c.phone) }, btnRef);
  return (
    <>
      <ActionButton
        ref={btnRef}
        icon="solar:phone-linear"
        size="sm"
        tooltip={callable.length === 1 ? `Call ${callable[0].name}` : 'Call'}
        tooltipLeft
        onClick={(e) => {
          e.stopPropagation();
          if (callable.length === 1) call(callable[0]);
          else setMenuRect(e.currentTarget.getBoundingClientRect());
        }}
      />
      {menuRect && (
        <MenuPopover
          anchorRect={menuRect}
          items={callable.map(c => ({ key: c.name, label: `${c.name} · ${c.phone}` }))}
          onSelect={(key) => { setMenuRect(null); call(callable.find(c => c.name === key)); }}
          onClose={() => setMenuRect(null)}
          width={280}
          ariaLabel="Who to call"
        />
      )}
    </>
  );
}

// Who to call about the member's gaps: prescribers of their drugs and the
// pharmacies their fills came from. Phone numbers dial and log to Activity.
export function PharmacyContacts({ member }) {
  const logActivity = useAppStore(s => s.logPharmacyDial);
  const prescribers = prescribersOf(member);
  const pharmacies = pharmaciesUsed(member);
  const dial = (who, number) => () => logActivity?.(member.id, who, number);
  // Both cards read the same way: who (with their address under the name),
  // how to reach them, then what ties them to the member.
  return (
    <>
      <DashboardCard size="S" title={prescribers.length === 1 ? 'Prescriber' : 'Prescribers'} actions={<CallContactAction contacts={prescribers} onDial={dial} />}>
        {prescribers.length === 0 ? <div className={styles.row}><span className={styles.muted}>No prescriber on file.</span></div> : (
          <table className={`${styles.table} ${styles.contactTable}`}>
            <thead>
              <tr><th>Prescriber</th><th>Phone</th><th>Fax</th><th>Medications</th></tr>
            </thead>
            <tbody>
              {prescribers.map(p => (
                <tr key={p.name}>
                  <td>
                    <span className={styles.contactName}>{p.name}</span>
                    <span className={styles.address}>{addressOf(p)}</span>
                  </td>
                  <td><PhoneLink number={p.phone} label={p.name} onDial={dial(p.name, p.phone)} /></td>
                  <td>{p.fax || '-'}</td>
                  <td><NamesCount names={p.drugs} label="medication" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DashboardCard>

      <DashboardCard size="S" title={pharmacies.length === 1 ? 'Pharmacy' : 'Pharmacies'} actions={<CallContactAction contacts={pharmacies} onDial={dial} />}>
        {pharmacies.length === 0 ? <div className={styles.row}><span className={styles.muted}>No fills on record.</span></div> : (
          <table className={`${styles.table} ${styles.contactTable}`}>
            <thead>
              <tr><th>Pharmacy</th><th>Phone</th><th>Fills</th><th>Last Fill</th></tr>
            </thead>
            <tbody>
              {pharmacies.map((p, i) => (
                <tr key={p.name}>
                  <td>
                    <span className={styles.contactName}>{p.name}</span>
                    {i === 0 && pharmacies.length > 1 && <Badge size="sm" label="Last used" className={styles.lastUsed} />}
                    <span className={styles.address}>{addressOf(p)}</span>
                  </td>
                  <td><PhoneLink number={p.phone} label={p.name} onDial={dial(p.name, p.phone)} /></td>
                  <td>{p.fills}</td>
                  <td>{p.lastFill}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DashboardCard>
    </>
  );
}

// Snapshot step of the Pharmacy program (patient profile): the member's
// pharmacy gaps at a glance, plus who to call about them.
export function PharmacySnapshotStep({ member }) {
  const fromProfile = usePharmacyProgramMember();
  const row = member || fromProfile;

  if (!row) {
    return (
      <div className={styles.empty}>
        <Icon name="solar:pill-linear" size={40} color="var(--neutral-200)" />
        <p>No MAC, MAD or MAH measures on file for this member.</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <PharmacyGapsCard member={row} />
      <PharmacyContacts member={row} />
    </div>
  );
}
