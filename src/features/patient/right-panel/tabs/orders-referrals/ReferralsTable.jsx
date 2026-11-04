import { Link } from '../../../../../components/Link/Link';
import { ProfileTable } from '../../../../../components/ProfileTable/ProfileTable';
import { profileCellClass, profileRowClass } from '../../../../../components/ProfileTable/profileTableClasses';
import { Checkbox } from '../../../../../components/Checkbox/Checkbox';
import { toneOf } from './ordersViews';
import styles from './OrdersReferralsTab.module.css';

const COLUMNS = [
  { key: 'select', label: '', showCheckbox: true, width: 36 },
  { key: 'referredBy', label: 'Referred By' },
  { key: 'referredTo', label: 'Referred To' },
  { key: 'status', label: 'Status', width: 180 },
  { key: 'attachment', label: 'Attachment', width: 180 },
  { key: 'createdOn', label: 'Created On', width: 200 },
];

function Party({ name, specialty }) {
  return (
    <span className={styles.party}>
      <span className={styles.primaryText}>{name}</span>
      {specialty && <span className={styles.muted}>{specialty}</span>}
    </span>
  );
}

function AttachmentLink({ attachments, onPreview }) {
  const count = attachments.length;
  if (!count) return <span className={styles.muted}>-</span>;
  const open = (e) => { e.stopPropagation(); onPreview(attachments[0]); };
  return (
    <Link
      variant="subtle"
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); } }}
    >
      {count} Attachment{count === 1 ? '' : 's'}
    </Link>
  );
}

/** The Referral view: Referred By / Referred To / Status / Attachment / Created On. */
export function ReferralsTable({ rows, selectedIds, onToggle, onToggleAll, onOpen, onPreview, emptyLabel }) {
  const selected = new Set(selectedIds);
  return (
    <ProfileTable
      columns={COLUMNS}
      rows={rows}
      selectedIds={selectedIds}
      onSelectAll={onToggleAll}
      emptyState={<span className={styles.muted}>{emptyLabel}</span>}
      renderRow={r => (
        <tr key={r.id} className={`${profileRowClass} ${styles.row}`} onClick={() => onOpen(r.raw)}>
          <td className={`${profileCellClass} ${styles.checkCell}`} onClick={e => e.stopPropagation()}>
            <Checkbox checked={selected.has(r.id)} onCheckedChange={() => onToggle(r.id)} aria-label={`Select referral to ${r.toName}`} />
          </td>
          <td className={profileCellClass}><Party name={r.fromName} specialty={r.fromSpecialty} /></td>
          <td className={profileCellClass}><Party name={r.toName} specialty={r.toSpecialty} /></td>
          <td className={`${profileCellClass} ${styles[toneOf(r.status)]}`}>{r.status}</td>
          <td className={profileCellClass}><AttachmentLink attachments={r.attachments} onPreview={onPreview} /></td>
          <td className={`${profileCellClass} ${styles.muted}`}>{r.dateLabel}</td>
        </tr>
      )}
    />
  );
}
