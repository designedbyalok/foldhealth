import { Checkbox } from '../../components/Checkbox/Checkbox';
import { Icon } from '../../components/Icon/Icon';
import { Tooltip } from '../../components/Tooltip/Tooltip';
import { CPT_RULES, thStyle } from './apcmBillingUtils';
import styles from './ApcmBillingTable.module.css';
import rowStyles from './ApcmBillingRow.module.css';

export function ApcmBillingTableHead({
  someSelected,
  allSelected,
  onSelectAll,
}) {
  return (
    <thead>
      <tr>
        <th className={`${rowStyles.stickyLeft} ${rowStyles.stickyCheck} ${styles.checkTh}`}>
          <Checkbox
            checked={someSelected ? 'indeterminate' : allSelected}
            onCheckedChange={onSelectAll}
            aria-label="Select all"
          />
        </th>
        <th className={`${rowStyles.stickyLeft} ${rowStyles.stickyMember}`} style={{ ...thStyle, borderRight: '1px solid var(--neutral-150)', minWidth: 220 }}>Member</th>
        <th style={thStyle}>EHR ID</th>
        <th style={thStyle}>Month</th>
        <th style={thStyle}>Date of Service</th>
        <th style={thStyle}>
          <span className={styles.cptHeader}>
            CPT Code
            <Tooltip
              placement="bottom"
              maxWidth={320}
              className={styles.cptInfoWrap}
              label={(
                <span className={styles.cptTooltip}>
                  <span className={styles.cptTooltipTitle}>Billing code &amp; fee</span>
                  {CPT_RULES.map(r => (
                    <span key={r.code} className={styles.cptTooltipRow}>
                      <span className={styles.cptTooltipLabel}>{r.label}</span>
                      <span className={styles.cptTooltipCode}>{r.code} · ${r.fee}</span>
                    </span>
                  ))}
                  <span className={styles.cptTooltipFoot}>
                    Checking Chronic on an ICD syncs to Athena and may change the code + fee.
                  </span>
                </span>
              )}
            >
              <span className={styles.cptInfo} aria-label="CPT rule">
                <Icon name="solar:info-circle-linear" size={12} color="currentColor" />
              </span>
            </Tooltip>
          </span>
        </th>
        <th style={{ ...thStyle, minWidth: 360 }}>ICD Codes</th>
        <th style={thStyle}>Last Encounter</th>
        <th style={{ ...thStyle, minWidth: 320 }}>Reasons</th>
        <th style={thStyle}>Rendering Provider</th>
        <th style={{ ...thStyle, minWidth: 280 }}>Comment</th>
        <th className={rowStyles.stickyRight} style={{ ...thStyle, width: '1%' }}>Actions</th>
      </tr>
    </thead>
  );
}
