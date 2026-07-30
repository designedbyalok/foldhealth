import { useState, Fragment } from 'react';
import { Icon } from '../Icon/Icon';
import { ActionButton } from '../ActionButton/ActionButton';
import { Badge } from '../Badge/Badge';
import { BannerExpandIcon } from '../Icon/BannerExpandIcon';
import { Tooltip } from '../Tooltip/Tooltip';
import { deriveDob, formatDobDisplay } from '../../lib/patientDob';
import styles from './PatientBanner.module.css';

/**
 * PatientBanner — reusable patient context banner for drawers.
 *
 * Figma: 263:19234
 * Default (263:19235): Compact banner with avatar, name, meta, RAF, call + expand buttons
 * Expanded (263:19400): Shows Patient Details + Patient Synopsis below
 *
 * @param {string}   initials   Avatar initials
 * @param {string}   name       Patient full name
 * @param {string}   gender     "Male" | "Female"
 * @param {string}   age        e.g. "67y 2m"
 * @param {string}   [dob]      Date of birth for the age hover tooltip.
 *                              When omitted, a "Mon YYYY" fallback is derived
 *                              from `age` so the tooltip still shows.
 * @param {string}   memberId   e.g. "#219384756102"
 * @param {string}   [raf]      RAF score e.g. "4.234"
 * @param {string}   [rafChange] RAF change e.g. "0.512"
 * @param {boolean}  [rafUp=true] RAF trend direction
 * @param {function} [onCall]   Call button handler
 * @param {string}   [className] Extra class
 * @param {boolean}  [hidePatientLabel=false] Omit the leading "Patient" meta label
 */

/* Mock patient details for expanded state */
const MOCK_DETAILS = {
  location: 'Los Angeles, CA',
  centralProfile: 'Central Profile',
  healthPlan: 'Extended 6th Generation Knowledgebase',
  enrollmentDate: '01/01/2025',
  memberIds: ['23094852345', '329845673248'],
  extraIds: 3,
  activePrograms: 2,
  utr: '45d',
};

const MOCK_SYNOPSIS = {
  condition: 'Diabetic',
  text: 'High-risk patient with multiple chronic conditions, including morbid obesity and poorly controlled diabetes. Currently facing several health management challenges, including medication adherence issues and overdue screenings. The patient\'s overall state suggests a need for comprehensive care coordination and close monitoring. Eligible for CCM and have scheduled an AWV, indicating engagement with their healthcare but requiring additional support to address various health concerns and improve their overall well-being.',
  generatedAt: '2d ago',
};

export function PatientBanner({ initials, name, gender, age, dob, memberId, raf, rafChange, rafUp = true, onCall, className, hidePatientLabel = false }) {
  const [expanded, setExpanded] = useState(false);

  // Age meta gets a hover tooltip revealing DOB in mm/dd/yyyy. Prefer the
  // caller-supplied dob (normalized from ISO / m/d/yyyy variants); otherwise
  // derive a deterministic date from age + name so the tooltip always shows.
  const normalizedDob = formatDobDisplay(dob) || deriveDob(age, name);
  const dobLabel = normalizedDob ? `DOB: ${normalizedDob}` : '';

  // Build the leading meta parts so the dot separators stay correct even
  // when the "Patient" label is hidden. Age is kept as a marker string here
  // and rendered as a Tooltip trigger below.
  const AGE_MARKER = '__age__';
  const metaParts = [];
  if (!hidePatientLabel) metaParts.push('Patient');
  if (gender) metaParts.push(gender);
  if (age) metaParts.push(AGE_MARKER);
  if (memberId) metaParts.push(memberId);

  return (
    <div className={`${styles.banner} ${className || ''}`}>
      {/* Compact header row */}
      <div className={styles.header}>
        <div className={styles.info}>
          <div className={styles.avatar}>{initials}</div>
          <div className={styles.details}>
            <div className={styles.name}>{name}</div>
            <div className={styles.meta}>
              {metaParts.map((part, i) => (
                <Fragment key={i}>
                  {i > 0 && <span className={styles.dot}>&bull;</span>}
                  {part === AGE_MARKER ? (
                    dobLabel ? (
                      <Tooltip label={dobLabel} placement="bottom">
                        <span className={styles.ageTrigger}>{age}</span>
                      </Tooltip>
                    ) : (
                      <span>{age}</span>
                    )
                  ) : (
                    <span>{part}</span>
                  )}
                </Fragment>
              ))}
              {raf && (
                <>
                  {metaParts.length > 0 && <span className={styles.dot}>&bull;</span>}
                  <span>RAF</span>
                  <span className={styles.rafValue}>{raf}</span>
                  {rafChange && (
                    <Badge
                      variant={rafUp ? 'compliance-pass' : 'compliance-fail'}
                      label={rafChange}
                      icon={rafUp ? 'solar:arrow-up-linear' : 'solar:arrow-down-linear'}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        <div className={styles.actions}>
          {onCall && (
            <ActionButton icon="solar:phone-calling-rounded-linear" size="L" tooltip="Call" onClick={onCall} tooltipBelow />
          )}
          <span className={styles.divider} />
          <ActionButton
            size="L"
            tooltip={expanded ? 'Collapse' : 'Expand'}
            onClick={() => setExpanded(v => !v)}
            className={expanded ? styles.chevronOpen : ''}
            tooltipBelow
          >
            <BannerExpandIcon size={20} />
          </ActionButton>
        </div>
      </div>

      {/* Expandable section */}
      <div className={`${styles.expandable} ${expanded ? styles.expandableOpen : ''}`}>
        <div className={styles.expandContent}>
          {/* Patient Details */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Patient Details</div>
            <div className={styles.detailRows}>
              <div className={styles.detailRow}>
                <Icon name="solar:map-point-linear" size={14} color="var(--neutral-300)" />
                <span>{MOCK_DETAILS.location}</span>
              </div>
              <div className={styles.detailRow}>
                <Icon name="solar:global-linear" size={14} color="var(--neutral-300)" />
                <span className={styles.linkText}>{MOCK_DETAILS.centralProfile}</span>
              </div>
              <div className={styles.detailRow}>
                <Icon name="solar:document-text-linear" size={14} color="var(--neutral-300)" />
                <span>Health Plan Description: {MOCK_DETAILS.healthPlan}</span>
              </div>
              <div className={styles.detailRow}>
                <Icon name="solar:calendar-linear" size={14} color="var(--neutral-300)" />
                <span>Enrollment Date: {MOCK_DETAILS.enrollmentDate}</span>
              </div>
              <div className={styles.detailRow}>
                <Icon name="solar:card-linear" size={14} color="var(--neutral-300)" />
                <span>Member ID: {MOCK_DETAILS.memberIds.join(' , ')}{' '}</span>
                {MOCK_DETAILS.extraIds > 0 && (
                  <span className={styles.linkText}>+ {MOCK_DETAILS.extraIds} more</span>
                )}
              </div>
              <div className={styles.detailRow}>
                <Icon name="solar:clipboard-list-linear" size={14} color="var(--neutral-300)" />
                <span>{MOCK_DETAILS.activePrograms} Active Programs</span>
                <span className={styles.dot}>&bull;</span>
                <span className={styles.utrBadge}>
                  <Icon name="solar:phone-calling-rounded-linear" size={12} color="#D72825" />
                  UTR({MOCK_DETAILS.utr})
                </span>
              </div>
            </div>
          </div>

          {/* Patient Synopsis */}
          <div className={styles.section}>
            <div className={styles.synopsisHeader}>
              <span className={styles.sectionTitle}>Patient Synopsis</span>
              <select className={styles.conditionSelect} aria-label="Filter synopsis by condition">
                <option>{MOCK_SYNOPSIS.condition}</option>
              </select>
            </div>
            <div className={styles.synopsisCard}>
              <p className={styles.synopsisText}>{MOCK_SYNOPSIS.text}</p>
              <button className={styles.seeMore}>See More</button>
              <div className={styles.synopsisFooter}>
                <div className={styles.synopsisFooterLeft}>
                  <Icon name="solar:magic-stick-3-bold" size={14} color="var(--primary-300)" />
                  <span className={styles.poweredBy}>Powered by Unity</span>
                  <Badge variant="ai-neutral" label="BETA" />
                </div>
                <div className={styles.synopsisFooterRight}>
                  <span className={styles.generatedAt}>Generated: {MOCK_SYNOPSIS.generatedAt}</span>
                  <Icon name="solar:refresh-linear" size={14} color="var(--neutral-200)" />
                  <ActionButton icon="solar:like-linear" size="S" tooltip="Helpful" />
                  <ActionButton icon="solar:dislike-linear" size="S" tooltip="Not helpful" />
                  <ActionButton icon="solar:copy-linear" size="S" tooltip="Copy" />
                  <ActionButton icon="solar:refresh-linear" size="S" tooltip="Regenerate" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
