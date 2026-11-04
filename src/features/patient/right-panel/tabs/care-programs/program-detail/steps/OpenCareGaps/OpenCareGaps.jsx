import { Icon } from '../../../../../../../../components/Icon/Icon';
import { Button } from '../../../../../../../../components/Button/Button';
import { Checkbox } from '../../../../../../../../components/Checkbox/Checkbox';
import { WorklistShell } from '../../../../../../../../components/WorklistShell/WorklistShell';
import { CARE_GAP_SECTIONS_EXTENDED } from '../../../../../../data/careGapsMock';
import styles from './OpenCareGaps.module.css';

// Per-gap overlay: who it's assigned to and which resolve action it needs.
// Gaps not listed fall back to Unassigned + "Add Value".
const GAP_META = {
  cm1: { assignee: 'Delores Conn', action: 'Add Value' },
  cm2: { assignee: 'Randy Klein', action: 'Add Value' },
  cm3: { action: 'Schedule' },
  lb1: { assignee: 'Kerry Nienow', action: 'Add Value' },
  lb2: { action: 'Schedule' },
  lb3: { action: 'Schedule' },
  rf1: { action: 'Add Value' },
  rf2: { action: 'Schedule' },
};

// Columns mirror the grid this table used to be: 32 / fill / 90 / 160 / 120.
const GAP_COLUMNS = [
  { key: 'select', label: '', showCheckbox: true, width: 32 },
  { key: 'title', label: 'Title' },
  { key: 'status', label: 'Status', width: 90 },
  { key: 'assignee', label: 'Assignee', width: 160 },
  { key: 'action', label: 'Action', width: 120 },
];

function GapRow({ item }) {
  const meta = GAP_META[item.id] || {};
  return (
    <tr className={styles.row}>
      <td className={styles.checkCell} onClick={e => e.stopPropagation()}>
        <Checkbox aria-label={`Select ${item.title}`} />
      </td>
      <td className={styles.titleCell}>{item.title}</td>
      <td className={styles.statusCell}>{item.status}</td>
      <td className={styles.assigneeCell}>
        <span className={styles.assigneeInner}>
        {meta.assignee ? (
          <>
            <Icon name="solar:user-rounded-linear" size={15} color="var(--status-success)" />
            <button type="button" className={styles.assigneeName}>{meta.assignee}</button>
          </>
        ) : (
          <button type="button" className={styles.assignBtn}>
            <Icon name="solar:user-plus-rounded-linear" size={15} color="var(--neutral-300)" />
            Assign
          </button>
        )}
        </span>
      </td>
      <td className={styles.actionCell}>
        <Button variant="soft" size="sm">{meta.action || 'Add Value'}</Button>
      </td>
    </tr>
  );
}

export function OpenCareGaps() {
  return (
    <div className={styles.container}>
      {CARE_GAP_SECTIONS_EXTENDED.map(section => (
        <div key={section.title} className={styles.section}>
          <div className={styles.sectionLabel}>{section.title}</div>
          <WorklistShell
            embedded
            header={null}
            columns={GAP_COLUMNS}
            rows={section.items}
            renderRow={item => <GapRow key={item.id} item={item} />}
            minTableWidth={0}
          />
        </div>
      ))}
    </div>
  );
}
