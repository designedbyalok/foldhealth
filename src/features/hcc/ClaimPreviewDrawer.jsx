import { useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Drawer } from '../../components/Drawer/Drawer';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { PatientBanner } from '../../components/PatientBanner/PatientBanner';
import { deriveClaimId } from './claimId';
import { getIcdsForMember } from './data/icds';
import styles from './ClaimPreviewDrawer.module.css';

// Mirror the Claim Details layout that lives inline inside the DiagPanel
// Claims tab (Figma 10891:325889) so hopping between the two surfaces
// reads the same. Sections:
//   Claim Information (Claims Number / Submission Date / Date of Service
//     + status badge)
//   Rendering Provider (Name / NPI / Speciality)
//   CPT Procedure Codes (2-col table)
//   ICD Codes on Claim (2-col table)
//
// Status → badge variant. Keep in sync with the DiagPanel version so a
// "Paid" claim reads the same in the tab and in this drawer.
const CLAIM_STATUS_BADGE = {
  Paid:     'success',
  Pending:  'warning',
  Billed:   'info',
  Denied:   'danger',
  Rejected: 'danger',
};

/**
 * Read-only preview of the claim that generated a DOS record on the HCC
 * worklist. Opens when the user clicks a claim-sourced (C) DOS badge in
 * the DOS column or the claim-number link inside the badge tooltip.
 *
 * Reads `hccClaimPreview = { open, member, dosDate }` from the store.
 * Composed from the shared Drawer primitive so width / inset / header
 * spacing stays consistent with the other right-side drawers.
 */
export function ClaimPreviewDrawer() {
  const { open, member, dosDate } = useAppStore(s => s.hccClaimPreview);
  const close = useAppStore(s => s.closeHccClaimPreview);
  const openDiagPanel = useAppStore(s => s.openDiagPanel);

  const claim = useMemo(() => buildClaim(member, dosDate), [member, dosDate]);

  if (!open || !member) return null;

  // "View Gaps" hand-off: closes this drawer and opens the DiagPanel for
  // the member, pinned to this DOS. Gap context lives in the DiagPanel;
  // the button below is the explicit entry point from this claim view.
  const viewGaps = () => {
    close();
    openDiagPanel(member.id, { initialDos: dosDate, leftPanel: 'documents' });
  };

  return (
    <Drawer
      title="Claim Preview"
      onClose={close}
      noCloseDivider
      headerRight={(
        <>
          <Button
            variant="soft"
            size="sm"
            leadingIcon="solar:document-medicine-linear"
            onClick={viewGaps}
          >
            View Gaps
          </Button>
          <span className={styles.headerDivider} aria-hidden="true" />
        </>
      )}
      banner={(
        // Full-bleed banner slot: hugs the drawer edges (no side padding),
        // treated as its own entity above the padded Claim Details body.
        <PatientBanner
          initials={member.in}
          name={member.name}
          gender={member.g === 'M' ? 'Male' : member.g === 'F' ? 'Female' : member.g}
          age={member.age || ''}
          dob={member.dob}
          memberId={member.memberId || `#${member.id}`}
          raf={member.raf}
          rafChange={member.ri}
          rafUp={member.ru !== false}
        />
      )}
    >
      <div className={styles.body}>
        <section className={styles.claimSection}>
          <div className={styles.claimSectionHead}>
            <span className={styles.claimSectionTitle}>Claim Information</span>
            <Badge size="md" tone={CLAIM_STATUS_BADGE[claim.status] || 'info'} label={claim.status} />
          </div>
          <div className={styles.claimInfoGrid}>
            <ClaimField label="Claims Number" value={claim.number} />
            <ClaimField label="Submission Date" value={claim.submissionDate} />
            <ClaimField label="Date of Service" value={claim.dos} />
          </div>
        </section>

        <section className={styles.claimSection}>
          <div className={styles.claimSectionHead}>
            <span className={styles.claimSectionTitle}>Rendering Provider</span>
          </div>
          <div className={styles.claimInfoGrid}>
            <ClaimField label="Name" value={claim.provider.name} />
            <ClaimField label="NPI" value={claim.provider.npi} />
            <ClaimField label="Speciality" value={claim.provider.speciality} />
          </div>
        </section>

        <section className={styles.claimSection}>
          <div className={styles.claimSectionHead}>
            <span className={styles.claimSectionTitle}>CPT Procedure Codes</span>
          </div>
          <table className={styles.claimCodeTable}>
            <thead>
              <tr><th>CPT Codes</th><th>Description</th></tr>
            </thead>
            <tbody>
              {claim.cpts.map((p) => (
                <tr key={p.cpt}>
                  <td className={styles.claimCode}>{p.cpt}</td>
                  <td className={styles.claimCodeDesc}>{p.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={styles.claimSection}>
          <div className={styles.claimSectionHead}>
            <span className={styles.claimSectionTitle}>ICD Codes on Claim</span>
          </div>
          <table className={styles.claimCodeTable}>
            <thead>
              <tr><th>ICD Codes</th><th>Description</th></tr>
            </thead>
            <tbody>
              {claim.icds.map((d) => (
                <tr key={d.code}>
                  <td className={styles.claimCode}>{d.code}</td>
                  <td className={styles.claimCodeDesc}>{d.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </Drawer>
  );
}

// ── Small composition helpers (kept local: single-use UI) ─────────────

function ClaimField({ label, value }) {
  return (
    <div className={styles.claimField}>
      <span className={styles.claimFieldLabel}>{label}</span>
      <span className={styles.claimFieldValue}>{value || '-'}</span>
    </div>
  );
}

// ── Mock claim shape: replace with a real fetch when the claims service
// lands. Uses the shared `deriveClaimId` so the number rendered here
// matches the one shown in the DOS-source badge tooltip.
function buildClaim(member, dosDate) {
  if (!member) return { cpts: [], icds: [], provider: {} };
  const allIcds = getIcdsForMember(member.name) || [];
  const icds = allIcds.slice(0, 5).map(i => ({ code: i.code, description: i.desc }));
  const cpts = [
    { cpt: '99285', description: 'Emergency department visit, high severity' },
    { cpt: '93005', description: 'Electrocardiogram, tracing only' },
    { cpt: '80048', description: 'Basic metabolic panel' },
  ];
  return {
    number: deriveClaimId(member.id, dosDate),
    dos: dosDate || member.dos,
    submissionDate: dosDate || member.dos,
    provider: {
      name: member.rp || 'Dr. Katherine Moss',
      npi: '555555555',
      speciality: 'Emergency Medicine',
    },
    cpts,
    icds,
    status: 'Billed',
  };
}
