import { Icon } from '../../../components/Icon/Icon';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Button } from '../../../components/Button/Button';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Select } from '../../../components/Select/Select';
import { getInitials } from './AccountPanel.constants';
import { ADMIN_ROLES, GENDER_OPTIONS, BULK_EXTRA_COLUMNS, BULK_COL_LABELS } from './InviteUserDrawer.utils';
import { AddColumnDropdown } from './AccountPanelParts';
import styles from './AccountPanel.module.css';

export function InviteUserBulkReviewStep({
  onClose,
  onPrevious,
  onImport,
  sending,
  bulkRows,
  bulkColumns,
  tableRef,
  highlightId,
  highlightCol,
  addColOpen,
  setAddColOpen,
  onAddRow,
  onAddColumns,
  onUpdateRow,
  onDuplicateRow,
  onDeleteRow,
}) {
  return (
    <Drawer
      title={<div><div style={{ fontSize: 'var(--font-lg)', fontWeight: 600 }}>Bulk Import Users</div><div style={{ fontSize: 'var(--font-md)', color: 'var(--neutral-300)', fontWeight: 400 }}>Import the Prospect in bulk by uploading a spreadsheet.</div></div>}
      onClose={onClose}
      className={styles.bulkReviewDrawer}
      bodyClassName={styles.inviteDrawerBody}
      headerRight={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="outline" onClick={onPrevious}>Previous</Button>
          <Button onClick={onImport} loading={sending}>Import</Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: '0.5px solid var(--neutral-150)', gap: 16, flexShrink: 0 }}>
          <div className={styles.bulkStepper} style={{ flex: 1 }}>
            <span className={styles.bulkStepDone}><span className={styles.bulkStepNum}>1</span> Upload File</span>
            <span className={styles.bulkStepLine} />
            <span className={styles.bulkStepActive}><span className={styles.bulkStepNum}>2</span> Profile Review</span>
          </div>
          <Button variant="ghost" size="sm" leadingIcon="solar:add-circle-linear" onClick={onAddRow}>Add Row</Button>
          <div style={{ position: 'relative' }}>
            <Button variant="ghost" size="sm" leadingIcon="solar:add-circle-linear" onClick={() => setAddColOpen(v => !v)}>Add Column</Button>
            {addColOpen && (
              <AddColumnDropdown
                available={BULK_EXTRA_COLUMNS.filter(c => !bulkColumns.includes(c))}
                labels={BULK_COL_LABELS}
                onAdd={onAddColumns}
                onClose={() => setAddColOpen(false)}
              />
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          <table className={styles.bulkTable} ref={tableRef}>
            <thead>
              <tr>
                <th className={styles.stickyLeft}>Users</th>
                {bulkColumns.map(col => (
                  <th key={col} style={{ minWidth: 140, background: highlightCol === col ? 'var(--primary-50)' : undefined, transition: 'background .5s' }}>
                    {BULK_COL_LABELS[col] || col} {['first_name', 'last_name', 'email'].includes(col) && <span style={{ color: 'var(--status-error)' }}>*</span>}
                  </th>
                ))}
                <th className={styles.stickyRight}>Action</th>
              </tr>
            </thead>
            <tbody>
              {bulkRows.map(row => {
                const isEmpty = !row.first_name && !row.last_name;
                const isHighlighted = highlightId === row._id;
                return (
                  <tr key={row._id} style={{ background: isHighlighted ? 'var(--primary-25)' : undefined, transition: 'background .5s' }}>
                    <td className={styles.stickyLeft} style={{ background: isHighlighted ? 'var(--primary-25)' : 'var(--neutral-0)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isEmpty ? (
                          <Icon name="solar:user-linear" size={24} color="var(--neutral-200)" />
                        ) : (
                          <Avatar variant="assignee" initials={getInitials(`${row.first_name} ${row.last_name}`).toUpperCase()} />
                        )}
                        <div>
                          <div style={{ fontSize: 'var(--font-md)', fontWeight: 500, color: isEmpty ? 'var(--neutral-200)' : 'var(--neutral-400)' }}>{isEmpty ? 'Unnamed' : `${row.first_name} ${row.last_name}`}</div>
                          <div style={{ fontSize: 'var(--font-sm)', color: 'var(--neutral-200)' }}>{row.email || 'abc@xyz.com'}</div>
                        </div>
                      </div>
                    </td>
                    {bulkColumns.map(col => (
                      <td key={col} style={{ background: highlightCol === col ? 'var(--primary-25)' : undefined, transition: 'background .5s' }}>
                        {col === 'admin_role' ? (
                          <Select className={styles.bulkSelectTrigger} options={ADMIN_ROLES.map(r => ({ value: r, label: r }))} value={row[col] || undefined} onValueChange={v => onUpdateRow(row._id, col, v)} placeholder="Select Admin R..." />
                        ) : col === 'gender' ? (
                          <Select className={styles.bulkSelectTrigger} options={GENDER_OPTIONS.map(g => ({ value: g, label: g }))} value={row[col] || undefined} onValueChange={v => onUpdateRow(row._id, col, v)} placeholder="Select..." />
                        ) : (
                          <input className={styles.bulkInput} value={row[col] || ''} onChange={e => onUpdateRow(row._id, col, e.target.value)} placeholder={BULK_COL_LABELS[col] || ''} />
                        )}
                      </td>
                    ))}
                    <td className={styles.stickyRight} style={{ background: isHighlighted ? 'var(--primary-25)' : 'var(--neutral-0)' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <ActionButton icon="solar:copy-linear" size="sm" tooltip="Duplicate" onClick={() => onDuplicateRow(row)} />
                        <ActionButton icon="solar:trash-bin-minimalistic-linear" size="sm" tooltip="Delete" tone="danger" onClick={() => onDeleteRow(row._id)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className={styles.bulkNotice} style={{ margin: 0, padding: '8px 16px', borderTop: '0.5px solid var(--neutral-150)' }}>
          <Icon name="solar:info-circle-linear" size={14} color="var(--neutral-200)" />
          <span>Following the successful creation of users through bulk import, their login credentials will be made available to them.</span>
        </div>
      </div>
    </Drawer>
  );
}
