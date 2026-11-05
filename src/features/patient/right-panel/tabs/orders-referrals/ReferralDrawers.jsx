import { Drawer } from '../../../../../components/Drawer/Drawer';
import { FilePreview } from '../../../../../components/FilePreview/FilePreview';
import { CareGapReferralDetail } from '../../../../hedis-worklist/CareGapReferralDetail';
import styles from './OrdersReferralsTab.module.css';

/** A patient referral read-only, in the Care Gap drawer's Referral Details layout. */
export function ReferralDetailDrawer({ referral: r, patient, onClose }) {
  const asCareGapReferral = { ...r, sentBy: r.referredByName, providerName: r.referredToName, channel: null };
  const providers = [
    { name: r.referredByName, specialty: r.referredBySpecialty },
    { name: r.referredToName, specialty: r.referredToSpecialty },
  ];
  return (
    <Drawer title="Referral Details" onClose={onClose}>
      <CareGapReferralDetail referral={asCareGapReferral} member={patient} providers={providers} />
    </Drawer>
  );
}

export function AttachmentPreviewDrawer({ attachment: a, onClose }) {
  return (
    <Drawer title={a.name || 'Attachment'} onClose={onClose} bodyClassName={styles.previewBody}>
      <FilePreview src={a.url} name={a.name} />
    </Drawer>
  );
}
