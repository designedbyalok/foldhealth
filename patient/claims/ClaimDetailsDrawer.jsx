import { useState } from 'react';
import { Drawer } from '@/components/Drawer/Drawer';
import { Badge } from '@/components/Badge/Badge';
import { Icon } from '@/components/Icon/Icon';
import { Collapse } from '@/components/Collapse/Collapse';
import { money, serviceDate, statusOf } from './claimFormat';
import styles from './Claims.module.css';

function Amounts({ rows }) {
  return (
    <dl className={styles.amounts}>
      {rows.map(([label, value, strong]) => (
        <div key={label} className={`${styles.amountRow} ${strong ? styles.amountStrong : ''}`}>
          <dt>{label}</dt>
          <dd>{money(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

// Claim Details (frames 1114:7011, 1114:7077).
export function ClaimDetailsDrawer({ claim, onClose }) {
  const [eob, setEob] = useState(true);
  const s = statusOf(claim.status);
  return (
    <Drawer title="Claim Details" onClose={onClose} width={560}>
      <div className={styles.stack}>
        <div className={styles.detailCard}>
          <span className={styles.detailProvider}>
            <Icon name="solar:hospital-linear" size={18} color="currentColor" />
            {claim.provider_name}
          </span>
          <dl className={styles.detailGrid}>
            <div><dt>Patient</dt><dd>{claim.patient_name || '-'}</dd></div>
            <div><dt>Claim Number</dt><dd>{claim.claim_number}</dd></div>
          </dl>
          <span className={styles.claimHead}>
            <span>Service Date: {serviceDate(claim.service_date)} • {claim.network === 'out' ? 'Out of network' : 'In network'}</span>
            <Badge size="S" tone={s.tone} icon={s.icon} label={s.label} />
          </span>
        </div>

        <span className={styles.heading}>Cost Breakdown</span>
        <Amounts rows={[
          ['Provider Billed', claim.billed],
          ['Allowed Amount', claim.allowed],
          ['Plan Paid', claim.plan_paid],
          ['Member Copay', claim.member_copay],
          ['Member Responsibility', claim.member_responsibility, true],
          ['Balance Owed', claim.balance_owed],
        ]}
        />
        <p className={styles.note}>Member responsibility is the allowed amount minus what your plan paid. It includes your copay.</p>

        {claim.lines.length > 0 && (
          <>
            <button type="button" className={styles.eobToggle} aria-expanded={eob} onClick={() => setEob((o) => !o)}>
              Explanation of Benefits
              <Icon name={eob ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'} size={14} color="currentColor" />
            </button>
            <Collapse open={eob}>
              <ul className={styles.eobList}>
                {claim.lines.map((l) => (
                  <li key={`${l.procedure_code}-${l.description}`} className={styles.eob}>
                    <span className={styles.eobHead}>
                      <span className={styles.sub}>Procedure Code</span>
                      <span className={styles.main}>{l.procedure_code}</span>
                    </span>
                    <span className={styles.eobTitle}>{l.description}</span>
                    <span className={styles.sub}>{serviceDate(l.service_date)}</span>
                    <Amounts rows={[
                      ['Billed Amount', l.billed],
                      ['Allowed Amount', l.allowed],
                      ['Health Plan Paid', l.plan_paid],
                      ['Member Copay', l.member_copay],
                      ['Member Responsibility', l.member_responsibility, true],
                    ]}
                    />
                  </li>
                ))}
              </ul>
            </Collapse>
          </>
        )}
      </div>
    </Drawer>
  );
}
