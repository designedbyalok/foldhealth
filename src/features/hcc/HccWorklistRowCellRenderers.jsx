import { dosSourceLetter } from './dosSource';
import { deriveClaimId } from './claimId';
import { RafTooltip } from './RowPopovers';
import { isRejectedStatus } from './HccWorklistRow.utils';
import { ROLE_OFFSET } from './HccWorklistRowParts.constants';
import { addDaysToDate, vtShortLabel } from './HccWorklistRowParts.utils';
import {
  CreateDateCell,
  HccEvidenceCell,
  AssigneeCell,
  RoleStatusCell,
  OpenIcdsCell,
  RafImpactCell,
  ProgressStepper,
  DosSourceBadge,
} from './HccWorklistRowParts';
import styles from './HccWorklistRow.module.css';

const RESOLVED_STATUSES = new Set(['Completed', 'Skipped']);
function isRoleResolved(s) { return RESOLVED_STATUSES.has(s); }

// Inner content (NOT the <td>) for each DOS-level column, given one
// dos_list entry. The main row wraps these in a stacked `<td>`.
export const DOS_INNER = {
  dos: (entry, { openDiagPanel, openClaimPreview, member, hasDoc, charts }) => {
    // Source letter comes from the entry itself when available (Manual
    // entries must carry `source: 'manual'`): never from a hash-only guess.
    // Click affordances split by target:
    //   • DATE click        → always opens the Documents tab (the doc
    //                         extracted / mapped to this DOS, or the first
    //                         chart on file as a fallback).
    //   • BADGE (C)         → opens the standalone Claim Preview drawer
    //                         pinned to this DOS. Same drawer also opens
    //                         via the claim-number link inside the badge
    //                         hover tooltip.
    //   • BADGE hover       → tooltip shows the claim number as a
    //                         clickable link with a chevron so the number
    //                         itself feels like the affordance.
    const letter = dosSourceLetter(entry, hasDoc);
    const isClaim = letter === 'C';
    const openDocuments = () => {
      const doc = (charts || []).find(c => c.date === entry.date) || (charts || [])[0];
      openDiagPanel(member.id, {
        leftPanel: 'documents', initialDos: entry.date, openDocId: doc?.id ?? null,
      });
    };
    const openClaim = () => openClaimPreview(member, entry.date);
    const claimNumber = isClaim ? deriveClaimId(member.id, entry.date) : null;
    return (
      <span className={styles.dosItem}>
        <button type="button" className={styles.lastVisitDateBtn} onClick={openDocuments}>
          <span className={styles.lastVisitDate}>{entry.date}</span>
        </button>
        <DosSourceBadge
          entry={entry}
          hasDoc={hasDoc}
          onClick={isClaim ? openClaim : undefined}
          claimNumber={claimNumber}
        />
      </span>
    );
  },
  open: (entry, { openDiagPanel, member }) => (
    <OpenIcdsCell
      member={member}
      onOpenWithCode={(code) => openDiagPanel(member.id, {
        highlightCode: code, initialDos: entry.date,
        leftPanel: 'documents', activityIcd: code,
      })}
    />
  ),
  vt: (entry, { member }) => {
    const full = entry.vt || member.visitType || member.vt || 'HCC';
    return <span className={styles.vtText} title={full}>{vtShortLabel(full)}</span>;
  },
  rp: (entry, { member }) => {
    const full = entry.provider || member.rp || '';
    const name = full.replace(/\s*\([^)]*\)\s*$/, '');
    return <span className={styles.providerText} title={full}>{name}</span>;
  },
  pos: (entry) => (
    entry.pos
      ? <span className={styles.posText}>{entry.pos}{entry.posDesc ? ` - ${entry.posDesc}` : ''}</span>
      : <span className={styles.muted}>-</span>
  ),
};

// Per-column cell renderers for the RECORD-LEVEL columns (everything not
// in DOS_LEVEL_COLS). Each receives the record `member` and returns a
// populated `<td>`, rendered once per row (top-aligned).
export const CELL_RENDERERS = {
  date: ({ member, dosStateFor }) => (
    <td key="date" data-col="date" className={styles.colDate}>
      <CreateDateCell member={member} dosState={dosStateFor(member)} />
    </td>
  ),
  evidence: ({ member, charts, openChartDrawer, openChartPopoverHover, closeChartPopoverHover, openUpload }) => (
    <td key="evidence" data-col="evidence" className={styles.colEvidence} onClick={(e) => e.stopPropagation()}>
      <HccEvidenceCell
        charts={charts}
        onClick={openChartDrawer}
        onMouseEnter={openChartPopoverHover}
        onMouseLeave={closeChartPopoverHover}
        onUpload={() => openUpload(member)}
      />
    </td>
  ),
  assignee: ({ member, dosStateFor }) => (
    <td key="assignee" data-col="assignee" className={styles.colAssignee}>
      <AssigneeCell member={member} dosState={dosStateFor(member)} />
    </td>
  ),
  sup: ({ member, dosStateFor, nameOf }) => {
    const s = dosStateFor(member);
    const status = s?.support?.status || member.supS;
    return (
      <td key="sup" data-col="sup" data-status={isRejectedStatus(status) ? 'rejected' : undefined} className={styles.colRole}>
        <RoleStatusCell
          name={s?.support?.assignee ? (nameOf(s.support.assignee) || member.sup) : member.sup}
          status={status}
          date={addDaysToDate(member.date, ROLE_OFFSET.sup)}
          role="support" memberId={member.id} dosDate={member.dos || member.date} />
      </td>
    );
  },
  cdr: ({ member, dosStateFor, nameOf }) => {
    const s = dosStateFor(member);
    const status = s?.coder?.status || member.cdrS;
    const supStatus = s?.support?.status || member.supS;
    return (
      <td key="cdr" data-col="cdr" data-status={isRejectedStatus(status) ? 'rejected' : undefined} className={styles.colRole}>
        <RoleStatusCell
          name={s?.coder?.assignee ? (nameOf(s.coder.assignee) || member.cdr) : member.cdr}
          status={status}
          date={addDaysToDate(member.date, ROLE_OFFSET.cdr)}
          priorResolved={isRoleResolved(supStatus)}
          role="coder" memberId={member.id} dosDate={member.dos || member.date} />
      </td>
    );
  },
  r1: ({ member, dosStateFor, nameOf }) => {
    const s = dosStateFor(member);
    const status = s?.reviewer?.status || member.r1s;
    const cdrStatus = s?.coder?.status || member.cdrS;
    return (
      <td key="r1" data-col="r1" data-status={isRejectedStatus(status) ? 'rejected' : undefined} className={styles.colRole}>
        <RoleStatusCell
          name={s?.reviewer?.assignee ? (nameOf(s.reviewer.assignee) || member.r1) : member.r1}
          status={status}
          date={addDaysToDate(member.date, ROLE_OFFSET.r1)}
          priorResolved={isRoleResolved(cdrStatus)}
          role="reviewer" memberId={member.id} dosDate={member.dos || member.date} />
      </td>
    );
  },
  r2: ({ member, dosStateFor, nameOf }) => {
    const s = dosStateFor(member);
    const status = s?.reviewer2?.status || member.r2s;
    const r1Status = s?.reviewer?.status || member.r1s;
    return (
      <td key="r2" data-col="r2" data-status={isRejectedStatus(status) ? 'rejected' : undefined} className={styles.colRole}>
        <RoleStatusCell
          name={s?.reviewer2?.assignee ? (nameOf(s.reviewer2.assignee) || member.r2) : member.r2}
          status={status}
          date={addDaysToDate(member.date, ROLE_OFFSET.r2)}
          priorResolved={isRoleResolved(r1Status)}
          role="reviewer2" memberId={member.id} dosDate={member.dos || member.date} />
      </td>
    );
  },
  r3: ({ member }) => (
    <td key="r3" data-col="r3" className={styles.colRole}>
      <RoleStatusCell name={member.r3} status={member.r3s} date={addDaysToDate(member.date, ROLE_OFFSET.r3)}
        role="r3" memberId={member.id} dosDate={member.dos || member.date} />
    </td>
  ),
  posDesc: ({ member }) => (
    <td key="posDesc" data-col="posDesc" className={styles.colPosDesc}>
      <span className={styles.codeText}>{member.posDesc}</span>
    </td>
  ),
  raf: ({ member }) => (
    <td key="raf" data-col="raf" className={styles.colRaf}>
      <RafTooltip memberName={member.name}>
        <span className={styles.numText}>{member.raf}</span>
      </RafTooltip>
    </td>
  ),
  ri: ({ member }) => (
    <td key="ri" data-col="ri" className={styles.colRi}>
      <RafTooltip memberName={member.name}>
        <RafImpactCell value={member.ri} ru={member.ru} />
      </RafTooltip>
    </td>
  ),
  ipa: ({ member }) => (
    <td key="ipa" data-col="ipa" className={styles.colIpa}>
      <span className={styles.codeText}>{member.ipa}</span>
    </td>
  ),
  hp: ({ member }) => (
    <td key="hp" data-col="hp" className={styles.colHp}>
      <span className={styles.codeText}>{member.hp}</span>
    </td>
  ),
  progress: ({ member }) => (
    <td key="progress" data-col="progress" className={styles.colProgress}>
      <ProgressStepper member={member} />
    </td>
  ),
  pcp: ({ member }) => (
    <td key="pcp" data-col="pcp" className={styles.colPcp}>
      <div className={styles.pcpCell}>
        <span className={styles.providerText}>{member.pcp}</span>
        <span className={styles.pcpMore}>+2 More</span>
      </div>
    </td>
  ),
  dec: ({ member }) => (
    <td key="dec" data-col="dec" className={styles.colDec}>
      <span className={styles.numText}>{member.dec}</span>
    </td>
  ),
  coh: ({ member }) => (
    <td key="coh" data-col="coh" className={styles.colCoh}>
      <span className={styles.codeText}>{member.coh}</span>
    </td>
  ),
  rl: ({ member }) => (
    <td key="rl" data-col="rl" className={styles.colRl}>
      {member.rl
        ? <span className={styles.codeText}>{member.rl}</span>
        : <span className={styles.muted}>-</span>}
    </td>
  ),
  ad: ({ member }) => (
    <td key="ad" data-col="ad" className={styles.colAd}>
      <span className={styles.numText}>{member.ad}</span>
    </td>
  ),
  fr: ({ member }) => (
    <td key="fr" data-col="fr" className={styles.colFr}>
      <span className={styles.numText}>{member.fr}</span>
    </td>
  ),
};
