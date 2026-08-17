import { useState } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { Avatar } from '../../components/Avatar/Avatar';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Checkbox } from '../../components/ShadcnCheckbox/ShadcnCheckbox';
import { FoldIdTag } from '../../components/FoldIdTag/FoldIdTag';
import { useAppStore } from '../../store/useAppStore';
import { LANG_MAP, getCptCode, CPT_FEES, initialStatusOf } from './data/mock';
import styles from './ApcmBillingRow.module.css';

const CPT_CLASS = { G0556: styles.cptG0556, G0557: styles.cptG0557, G0558: styles.cptG0558 };

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function extractReasonTitle(reason) {
  const dash = reason.indexOf(' —');
  return dash > -1 ? reason.slice(0, dash) : reason;
}
function extractReasonBody(reason) {
  const dash = reason.indexOf(' —');
  return dash > -1 ? reason.slice(dash + 2).trim() : '';
}

function IcdCell({ icdCodes, onToggleChronic }) {
  const [expanded, setExpanded] = useState(false);
  if (!icdCodes?.length) return <span className={styles.emDash}>—</span>;

  const visible = expanded ? icdCodes : icdCodes.slice(0, 2);
  const remaining = icdCodes.length - 2;

  return (
    <div className={styles.icdList}>
      {visible.map((icd, i) => {
        // Unresolved-mapping ICD: SNOMED fan-out was too wide to pick a
        // single code. Show description only, disable the checkbox (nothing
        // to bill), and surface a small warning + hint to resolve in Athena.
        const unresolved = !icd.code;
        return (
          <label key={i} className={[styles.icdItem, unresolved ? styles.icdItemUnresolved : ''].filter(Boolean).join(' ')} onClick={e => e.stopPropagation()}>
            <Checkbox
              checked={icd.status === 'chronic'}
              onCheckedChange={() => !unresolved && onToggleChronic?.(icd.code)}
              disabled={unresolved}
              aria-label={unresolved
                ? `${icd.description} — ICD unresolved, cannot mark chronic in Fold`
                : `Mark ${icd.code} chronic — ${icd.description}`}
            />
            <span className={styles.icdText}>
              {icd.code && <><span className={styles.icdCode}>{icd.code}</span>{' '}</>}
              <span className={styles.icdDesc}>{icd.description}</span>
              {icd.wasChronicByProvider && (
                <span className={styles.chronicProviderTag}> (Marked Chronic by Provider)</span>
              )}
              {unresolved && (
                <span className={styles.unresolvedTag}>
                  <Icon name="solar:danger-triangle-linear" size={11} color="currentColor" />
                  ICD mapping unresolved — fix in Athena
                </span>
              )}
            </span>
          </label>
        );
      })}
      {!expanded && remaining > 0 && (
        <button className={styles.icdMoreBtn} onClick={e => { e.stopPropagation(); setExpanded(true); }}>
          +{remaining} more
          <Icon name="solar:alt-arrow-down-linear" size={12} color="currentColor" />
        </button>
      )}
      {expanded && icdCodes.length > 2 && (
        <button className={styles.icdMoreBtn} onClick={e => { e.stopPropagation(); setExpanded(false); }}>
          Show less
          <Icon name="solar:alt-arrow-up-linear" size={12} color="currentColor" />
        </button>
      )}
    </div>
  );
}

function ReasonsCell({ reasons }) {
  if (!reasons?.length) {
    return <span className={styles.noReason}>—</span>;
  }
  return (
    <div className={styles.reasonsList}>
      {reasons.map((r, i) => {
        const title = extractReasonTitle(r);
        const desc = extractReasonBody(r);
        return (
          <div key={i} className={styles.reasonItem}>
            <span className={styles.reasonBullet}>&bull;</span>
            <span className={styles.reasonTitleWrap}>
              <span className={styles.reasonTitle}>{title}</span>
              {desc && <span className={styles.reasonTooltip}>{desc}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ApcmBillingRow({ patient, isSelected, isActive, onSelect, onTriggerBill, onCommentChange, onMarkChronic, onOpenPatient }) {
  const showToast = useAppStore(s => s.showToast);
  const langCode = (patient.language || 'en').toUpperCase();
  const langFull = LANG_MAP[patient.language] || patient.language;
  const patientInitials = getInitials(patient.name);
  const providerInitials = getInitials(patient.renderingProvider);

  // ── Three-state attestation logic (derived from reasons + per-ICD docs flag)
  // Case A: 1:many ambiguous + chronic-not-selected + has docs in 36mo
  //         → filter ICD column to documented codes only.
  // Case B: 1:1 mapping + chronic-not-selected
  //         → no filter; existing flow (VMG marks chronic in EHR, then attest).
  // Case C: 1:many ambiguous + chronic-not-selected + NO docs in 36mo
  //         → surface patient but disable attestation (button + checkbox).
  // ALSO: resolved ICDs never appear in the ICD column (they're not billable).
  const isAmbiguous = patient.reasons?.some(r => r.startsWith('Ambiguous ICD-10 from EMR Mapping'));
  const chronicNotSelected = patient.reasons?.some(r => r.startsWith('Chronic Condition Not Selected'));
  const nonResolved = patient.icdCodes.filter(c => c.status !== 'resolved');
  const rawVisibleIcdCodes = (isAmbiguous && chronicNotSelected)
    ? nonResolved.filter(c => c.documentedInLast36Months !== false)
    : nonResolved;
  // Decorate each visible ICD with a `wasChronicByProvider` flag so the row
  // can render a "(Marked Chronic by Provider)" tag for codes that were
  // already chronic in Athena when Fold loaded — separates provider-marked
  // from user-marked-this-session. For null-coded (unresolved) entries the
  // lookup key is the description since there's no code to index on.
  const visibleIcdCodes = rawVisibleIcdCodes.map(c => ({
    ...c,
    wasChronicByProvider: c.code
      ? initialStatusOf(patient.id, c.code) === 'chronic'
      : c.status === 'chronic',
  }));
  // Case C: ambiguous 1:many + chronic-not-selected + no docs in 36mo → block.
  // Unresolved-mapping (code === null) does NOT block — the provider has
  // already committed via "Marked Chronic by Provider", Fold surfaces the
  // warning inline, and the biller can still attest on whatever codes exist.
  const cannotAttest = isAmbiguous && chronicNotSelected && visibleIcdCodes.length === 0;

  // ── Live CPT — computed from the currently-visible chronic count. An
  // unresolved-mapping ICD (code === null) is excluded even if the provider
  // marked it chronic — Fold can't put a null code on a claim.
  const liveChronicCount = visibleIcdCodes.filter(c => c.status === 'chronic' && c.code).length;
  const liveCpt = getCptCode(patient.isQmb, liveChronicCount);

  return (
    <tr className={[
      styles.row,
      isSelected ? styles.rowChecked : '',
      isActive ? styles.rowActive : '',
      cannotAttest ? styles.rowBlocked : '',
    ].filter(Boolean).join(' ')}>

      {/* Checkbox */}
      <td className={`${styles.stickyLeft} ${styles.stickyCheck} ${styles.checkTd} ${isActive ? styles.checkTdActive : ''}`}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onSelect(patient.id)}
          disabled={cannotAttest}
          aria-label={`Select ${patient.name}`}
        />
      </td>

      {/* Member — matches TOC Worklist's two-line layout:
           row 1: name
           row 2: memberId • LANG_CODE (with tooltip on hover) */}
      <td className={`${styles.stickyLeft} ${styles.stickyMember} ${styles.memberTd}`}>
        <div className={styles.patientCell}>
          <Avatar variant="patient" initials={patientInitials} />
          <div className={styles.patientInfo}>
            <button
              type="button"
              className={styles.patientName}
              onClick={(e) => { e.stopPropagation(); onOpenPatient?.(); }}
              title="View patient"
            >
              {patient.name}
            </button>
            <div className={styles.patientMeta}>
              {/* APCM is an independent billing roster — shown as its own
                  payer member id (no `#` prefix), copied via the same tag. */}
              <FoldIdTag
                id={patient.memberId}
                display={patient.memberId || '—'}
                className={styles.foldId}
                showToast={showToast}
              />{' '}•{' '}
              <button
                type="button"
                className={styles.langBadge}
                onClick={(e) => e.stopPropagation()}
              >
                {langCode}
                <span className={styles.langTooltip}>Preferred Language: {langFull}</span>
              </button>
            </div>
          </div>
        </div>
      </td>

      {/* EHR ID */}
      <td className={styles.td}>
        <a
          className={styles.ehrLink}
          href={`https://athena.example.com/patient/${patient.ehrId}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          title="Open in Athena EHR"
        >
          {patient.ehrId}
          <Icon name="solar:arrow-right-up-linear" size={12} color="var(--primary-300)" />
        </a>
      </td>

      {/* Month */}
      <td className={styles.td}>{patient.billingMonth}</td>

      {/* Date of Service */}
      <td className={styles.td}>{patient.dateOfService}</td>

      {/* CPT Code — live-computed from ICD chronic count. Blank until at
          least one ICD is marked chronic (nothing to bill yet). The (i)
          rule-schedule popover lives on the column header, not on each
          row, since the content is identical across all patients. */}
      <td className={styles.td}>
        {liveChronicCount === 0 ? (
          <span className={styles.emDash}>—</span>
        ) : (
          <span className={styles.cptInline}>
            <span className={[styles.cptBadge, CPT_CLASS[liveCpt]].join(' ')}>{liveCpt}</span>
            <span className={styles.cptFee}>${CPT_FEES[liveCpt]}</span>
          </span>
        )}
      </td>

      {/* ICD Codes — for Case A/C (ambiguous + chronic-not-selected) only the
          codes documented on a qualifying encounter in the last 36 months are
          shown. The hidden candidates remain referenced in the Reasons column. */}
      <td className={styles.tdWrap}>
        {visibleIcdCodes.length > 0
          ? <IcdCell icdCodes={visibleIcdCodes} onToggleChronic={(code) => onMarkChronic?.(patient.id, code)} />
          : <span className={styles.noReason}>No qualifying Dx documented</span>}
      </td>

      {/* Last Encounter */}
      <td className={styles.td}>
        {patient.lastEncounterDate || <span className={styles.emDash}>—</span>}
      </td>

      {/* Reasons */}
      <td className={styles.tdWrap}>
        <ReasonsCell reasons={patient.reasons} />
      </td>

      {/* Rendering Provider */}
      <td className={styles.td}>
        <div className={styles.providerCell}>
          <Avatar variant="assignee" initials={providerInitials} />
          <span className={styles.providerName}>{patient.renderingProvider}</span>
        </div>
      </td>

      {/* Comment — inline editable. Auto-grows with content via CSS
          field-sizing on modern browsers; onInput height nudge below
          covers Firefox + Safari <17.4 as a fallback. */}
      <td className={styles.commentTd}>
        <textarea aria-label="Billing comment"
          className={styles.commentTextarea}
          placeholder="Add comment…"
          value={patient.comment}
          rows={1}
          onClick={e => e.stopPropagation()}
          onInput={e => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
          }}
          onChange={e => onCommentChange(patient.id, e.target.value)}
        />
      </td>

      {/* Actions — Trigger Attestation is disabled for Case C patients (ambiguous +
          chronic-not-selected + no qualifying Dx in 36mo). Tooltip explains why. */}
      <td className={`${styles.stickyRight} ${styles.actionsTd}`}>
        <div className={styles.actionsBtns}>
          <ActionButton
            icon="solar:bill-list-linear"
            size="L"
            tooltipLeft
            state={cannotAttest ? 'disabled' : 'active'}
            tooltip={cannotAttest
              ? 'Cannot attest — no qualifying Dx documented in the last 36 months'
              : 'Trigger Attestation'}
            onClick={e => {
              e.stopPropagation();
              if (cannotAttest) return;
              onTriggerBill([patient.id]);
            }}
          />
          <span className={styles.actionDivider} />
          <ActionButton
            icon="solar:menu-dots-linear"
            size="L"
            tooltipLeft
            tooltip="More options"
            onClick={e => { e.stopPropagation(); }}
          />
        </div>
      </td>

    </tr>
  );
}
