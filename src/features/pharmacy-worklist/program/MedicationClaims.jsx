import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Badge } from '../../../components/Badge/Badge';
import { Icon } from '../../../components/Icon/Icon';
import { Banner } from '../../../components/Banner/Banner';
import { PhoneLink } from '../../../components/PhoneLink/PhoneLink';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { annotateClaims, confirmedFills, matchFill, medLabel, parseMdy } from '../pharmacyWorklist.utils';
import { MeasureCode, Sep } from '../PharmacyCells';
import styles from './MedicationClaims.module.css';


// Each claim status looks different, so a reversed, cancelled or rejected
// line never reads as a paid fill.
const CLAIM_BADGE = {
  Paid: { tone: 'success', icon: 'solar:check-circle-linear' },
  Pending: { tone: 'neutral', icon: 'solar:clock-circle-linear' },
  Reversed: { tone: 'danger', icon: 'solar:undo-left-linear' },
  Cancelled: { tone: 'warning', icon: 'solar:close-circle-linear' },
  Rejected: { tone: 'danger', icon: 'solar:forbidden-circle-linear' },
  Deleted: { tone: 'neutral', icon: 'solar:trash-bin-minimalistic-linear' },
};
// Where a fill confirmed in Fold stands against its claim.
const MATCH_BADGE = {
  verified: { tone: 'success', label: 'Claim matched' },
  pending: { tone: 'grey', label: 'Awaiting claim' },
  'no-claim': { tone: 'error', label: 'Claim not matched' },
  'other-coverage': { tone: 'error', label: 'Non–Part D claim' },
  voided: { tone: 'error', label: 'Fill reversed' },
};
// Claim fields still waiting on Astrana's feed definition.
const PENDING_FIELDS = 'Status values, transaction type, claim ID and sequence, fill and reversal dates, BIN / PCN / group, the negative-value rule and deleted-claim handling are pending confirmation from Astrana.';

const money = (n) => (n == null ? '-' : `${n < 0 ? '-' : ''}$${Math.abs(Number(n)).toFixed(2)}`);
const total = (c) => (c.planPaid == null && c.copay == null ? null : (c.planPaid || 0) + (c.copay || 0));
const byDate = (a, b) => (parseMdy(a.date) ?? 0) - (parseMdy(b.date) ?? 0);
// Within one claim group, the order things happened: when each transaction
// was processed (a rebill can carry the original fill date), then billed,
// reversed, rebilled.
const TXN_RANK = { Original: 0, Reversal: 1, Rebill: 2 };
const eventAt = (c) => parseMdy(c.reversalDate || c.processedDate || c.date) ?? 0;
const byEvent = (a, b) => eventAt(a) - eventAt(b) || TXN_RANK[a.txnType] - TXN_RANK[b.txnType] || a.claimSeq - b.claimSeq;

function ClaimStatusBadge({ claim }) {
  if (claim.effect === 'Not Part D') {
    return (
      <Tooltip label="Billed outside Part D: does not count in PDC" placement="bottom">
        <span><Badge size="sm" tone="info" icon="solar:shield-linear" label={`Non–Part D · ${claim.coverage}`} /></span>
      </Tooltip>
    );
  }
  if (claim.effect === 'Superseded') return <Badge size="sm" label="Replaced by a newer version" />;
  // A reversal line (a Reversal transaction, or negative values linked to a
  // fill) cancels its fill, whatever status the feed sent with it.
  if (claim.effect === 'Reversal') return <Badge size="sm" tone={CLAIM_BADGE.Reversed.tone} icon={CLAIM_BADGE.Reversed.icon} label="Reversal" />;
  if (claim.effect === 'Invalid') {
    return (
      <Tooltip label="Days supply 0, or a negative value not linked to a fill: held for review and not counted in PDC" placement="bottom">
        <span><Badge size="sm" tone="warning" icon="solar:eye-linear" label="Held for review" /></span>
      </Tooltip>
    );
  }
  const status = claim.effect === 'Reversed' && claim.claimStatus === 'Paid' ? 'Reversed' : (claim.claimStatus || 'Paid');
  const b = CLAIM_BADGE[status] || CLAIM_BADGE.Paid;
  return <Badge size="sm" tone={b.tone} icon={b.icon} label={status} />;
}

function PendingConfirmation() {
  return (
    <Tooltip label={PENDING_FIELDS} placement="bottom" maxWidth={320}>
      <span><Badge size="sm" tone="warning" icon="solar:info-circle-linear" label="Pending data confirmation" /></span>
    </Tooltip>
  );
}

function ClaimField({ label, children }) {
  return (
    <div className={styles.claimField}>
      <span className={styles.claimFieldLabel}>{label}</span>
      <span className={styles.claimFieldValue}>{children ?? '-'}</span>
    </div>
  );
}

// `table`: the body is a table, not a field grid.
function Section({ title, aside, table = false, children }) {
  return (
    <section className={styles.claimSection}>
      <div className={styles.claimSectionHead}>
        <span className={styles.claimSectionTitle}>{title}</span>
        {aside}
      </div>
      {table ? children : <div className={styles.claimInfoGrid}>{children}</div>}
    </section>
  );
}

// What the member took home on this claim's fill: its own drug first, then
// any other drug of theirs on a current claim from the same pharmacy that day.
function dispensedWith(med, claim, memberMeds) {
  const others = (memberMeds || [])
    .filter(d => d.id !== med.id)
    .flatMap(d => {
      const hit = annotateClaims(d.refills).find(c => c.current && c.date === claim.date && c.pharmacy === claim.pharmacy);
      return hit ? [{ med: d, claim: hit }] : [];
    });
  return [{ med, claim }, ...others];
}

// Inline claim detail, as in the HCC Claims tab: back arrow and title, then
// the claim, its transaction, the drug dispensed, the pharmacy and the
// prescriber.
function ClaimDetail({ med, claim, memberMeds, onBack, onOpen, flush }) {
  const dispensed = dispensedWith(med, claim, memberMeds);
  const pharmacy = med.pharmacy?.name === claim.pharmacy ? med.pharmacy : { name: claim.pharmacy };
  const prescriber = med.prescriber;
  const original = claim.reversesClaimId || (claim.claimGroup !== claim.claimId ? claim.claimGroup : null);
  return (
    <div className={flush ? styles.claimDetailFlush : undefined}>
      <div className={styles.claimDetailHead}>
        <button type="button" className={styles.claimBackBtn} onClick={onBack} aria-label="Back to claims">
          <Icon name="solar:arrow-left-linear" size={18} color="var(--neutral-400)" />
        </button>
        <span className={styles.claimDetailTitle}>Claim Details for Fill: {claim.date}</span>
      </div>

      <Section title="Claim Information" aside={<ClaimStatusBadge claim={claim} />}>
        <ClaimField label="Claim Number">{claim.claimId}</ClaimField>
        <ClaimField label="Fill Date">{claim.date}</ClaimField>
        <ClaimField label="Status">{claim.claimStatus || 'Paid'}</ClaimField>
        <ClaimField label="Plan Paid">{money(claim.planPaid)}</ClaimField>
        <ClaimField label="Copay">{money(claim.copay)}</ClaimField>
        <ClaimField label="Total">{money(total(claim))}</ClaimField>
      </Section>

      <Section title="Transaction" aside={<PendingConfirmation />}>
        <ClaimField label="Transaction Type">{claim.txnType}</ClaimField>
        <ClaimField label="Claim Sequence">{`${claim.claimSeq}${claim.current ? ' · Current' : ''}`}</ClaimField>
        <ClaimField label={claim.txnType === 'Reversal' ? 'Reverses Claim' : 'Original Claim'}>
          {original ? <button type="button" className={styles.claimIdLink} onClick={() => onOpen(original)}>{original}</button> : null}
        </ClaimField>
        <ClaimField label="Reversal Date">{claim.reversalDate}</ClaimField>
        <ClaimField label="Processed Date">{claim.processedDate}</ClaimField>
        <ClaimField label="Coverage">{claim.coverage || 'Part D'}</ClaimField>
        <ClaimField label="BIN">{claim.bin}</ClaimField>
        <ClaimField label="PCN">{claim.pcn}</ClaimField>
        <ClaimField label="Group">{claim.rxGroup}</ClaimField>
        {claim.note && <ClaimField label="Note">{claim.note}</ClaimField>}
      </Section>

      <Section title={dispensed.length > 1 ? `Drugs Dispensed (${dispensed.length})` : 'Drug Dispensed'} table>
        <div className={`${styles.dataTableHead} ${styles.drugsGrid}`}>
          <span>Medication</span>
          <span>Gap</span>
          <span>Qty</span>
          <span>Days Supply</span>
          <span>Dose Form</span>
        </div>
        {dispensed.map(({ med: d, claim: c }) => (
          <div key={d.id} className={`${styles.dataTableRow} ${styles.drugsGrid}`}>
            <span className={styles.idCell}>
              <span className={styles.drugName}>{medLabel(d)}</span>
              <span className={styles.rowMeta}>{d.generic}</span>
            </span>
            <span><MeasureCode code={d.measure} /></span>
            <span>{c.qty ?? '-'}</span>
            <span>{c.daysSupply ?? '-'}</span>
            <span>{d.doseForm || '-'}</span>
          </div>
        ))}
      </Section>

      <Section title="Pharmacy">
        <ClaimField label="Name">{pharmacy.name}</ClaimField>
        <ClaimField label="NCPDP">{pharmacy.ncpdp}</ClaimField>
        <ClaimField label="Phone">{pharmacy.phone ? <PhoneLink number={pharmacy.phone} label={pharmacy.name} /> : null}</ClaimField>
      </Section>

      <Section title="Prescriber">
        <ClaimField label="Name">{claim.prescriber || prescriber?.name}</ClaimField>
        <ClaimField label="NPI">{prescriber?.npi}</ClaimField>
        <ClaimField label="Phone">{prescriber?.phone ? <PhoneLink number={prescriber.phone} label={prescriber.name} /> : null}</ClaimField>
      </Section>
    </div>
  );
}

function ClaimRow({ c, onOpen }) {
  const muted = c.voided || c.effect === 'Superseded' || c.effect === 'Invalid' || c.txnType === 'Reversal';
  return (
    <div className={`${styles.dataTableRow} ${styles.claimsGrid} ${muted ? styles.rowVoid : ''}`}>
      <span className={styles.idCell}>
        <button type="button" className={styles.claimIdLink} onClick={() => onOpen(c.claimId)}>{c.claimId || 'Claim'}</button>
      </span>
      <span className={styles.claimDate}>{c.date}</span>
      <ClaimStatusBadge claim={c} />
      <ActionButton icon="solar:eye-linear" size="sm" tooltip="View claim" onClick={() => onOpen(c.claimId)} />
    </div>
  );
}

// A fill confirmed in Fold (by hand, from a pickup or a refill approval):
// projected until its claim matches, so it never reads as a claim.
function FillRow({ f }) {
  const b = MATCH_BADGE[f.match.kind];
  return (
    <div className={`${styles.dataTableRow} ${styles.claimsGrid} ${styles.rowFill}`}>
      <span className={styles.idCell}>
        <span className={styles.fillLabel}>{f.manual ? 'Entered by hand' : f.source}</span>
        <span className={styles.rowMeta}>Fold fill<Sep />{f.match.detail}</span>
      </span>
      <span className={styles.claimDate}>{f.date}</span>
      <span className={styles.badges}>
        {f.match.kind !== 'verified' && <Badge size="sm" tone="warning" label="Projected" />}
        <Badge size="sm" tone={b.tone} label={b.label} />
      </span>
      <span />
    </div>
  );
}

/**
 * Claim history for one medication. Claims are grouped into the story of
 * each fill (billed, reversed, rebilled, billed to other insurance); fills
 * confirmed in Fold sit in the same timeline with their source and match
 * status, tagged Projected until a claim matches. A claim ID opens its detail in the
 * same panel with a back arrow. The host owns which claim is open
 * (`selectedId` / `onSelect`), so it can hide its own tabs meanwhile.
 * `flush`: the open claim runs edge to edge in a padded host pane.
 * `memberMeds`: the member's other drugs (with `measure`), so a claim lists
 * everything picked up from the same pharmacy that day.
 */
export function MedicationClaims({ med, plan, memberMeds, selectedId, onSelect: setSelectedId, flush = false }) {
  const claims = annotateClaims(med.refills);
  const fills = confirmedFills(med).map(f => ({ ...f, match: matchFill(f, claims, plan) }));
  const selected = selectedId ? claims.find(c => c.claimId === selectedId) : null;

  if (selected) return <ClaimDetail med={med} claim={selected} memberMeds={memberMeds} onBack={() => setSelectedId(null)} onOpen={setSelectedId} flush={flush} />;

  const groups = new Map();
  for (const c of claims) groups.set(c.claimGroup, [...(groups.get(c.claimGroup) || []), c]);
  const timeline = [
    ...[...groups.values()].map(rows => ({ kind: 'claims', rows: rows.toSorted(byEvent), date: rows.toSorted(byDate).at(-1).date })),
    ...fills.map(f => ({ kind: 'fill', f, date: f.date })),
  ].toSorted((a, b) => byDate(b, a));

  return (
    <div className={styles.history}>
      {!timeline.length ? <p className={styles.empty}>No claims on file for this medication.</p> : (
        <div className={styles.dataTable}>
          <div className={`${styles.dataTableHead} ${styles.claimsGrid}`}>
            <span>Claim ID</span>
            <span>Fill Date</span>
            <span>Status</span>
            <span />
          </div>
          {timeline.map(item => (item.kind === 'fill' ? (
            <FillRow key={`fill-${item.f.date}-${item.f.source}`} f={item.f} />
          ) : (
            <div key={item.rows[0].claimGroup} className={styles.claimGroup}>
              {item.rows.map(c => <ClaimRow key={`${c.claimId}-${c.claimSeq}-${c.txnType}`} c={c} onOpen={setSelectedId} />)}
            </div>
          )))}
        </div>
      )}
    </div>
  );
}
