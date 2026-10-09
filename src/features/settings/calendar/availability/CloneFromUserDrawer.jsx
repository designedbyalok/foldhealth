import { useState } from 'react';
import { Drawer } from '../../../../components/Drawer/Drawer';
import { Button } from '../../../../components/Button/Button';
import { Select } from '../../../../components/Select/Select';
import { Checkbox } from '../../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { RingEmptyState } from '../../../../components/RingEmptyState/RingEmptyState';
import { WorklistShell } from '../../../../components/WorklistShell/WorklistShell';
import { Badge } from '../../../../components/Badge/Badge';
import { Icon } from '../../../../components/Icon/Icon';
import { Tooltip } from '../../../../components/Tooltip/Tooltip';
import { InfoBar } from '../../../../components/InfoBar/InfoBar';
import { ALL_TYPES, STATUS_LOOK, blockStatus, cadenceText, formatDate, slotText } from './availabilityUtils';

// Fixed where the content is fixed; Hours takes what's left.
const COLUMNS = [
  { key: 'select', showCheckbox: true, width: 36 },
  { key: 'block', label: 'Block', width: 72 },
  { key: 'status', label: 'Status', width: 96 },
  { key: 'location', label: 'Location', width: 140 },
  { key: 'cadence', label: 'Cadence', width: 128 },
  { key: 'dates', label: 'Dates', width: 112 },
  { key: 'hours', label: 'Hours' },
];
import styles from './UserAvailability.module.css';

/**
 * Import from other users: a drawer over the availability drawer. Pick a
 * user, tick which of their blocks to copy (a table, one block per row),
 * Save. Only active
 * and upcoming blocks are offered (a past block has nothing left to
 * schedule), and none start ticked. Nothing is saved here; the copies land
 * in the availability drawer.
 *
 * @param {object[]} props.users   – users with their blocks
 * @param {string}   props.exclude – the user being edited (not a source)
 * @param {string[]} [props.imported] – ids of source blocks already imported
 *   into the drawer; their rows are greyed out and can't be picked again
 * @param {object}   [props.target] – the user being edited ({ name, locations });
 *   a block at a location they aren't assigned to is shown but can't be
 *   taken as is: it can still be picked, with an inline note saying it'll
 *   be added at their default (first) location. With no locations on
 *   record, nothing is changed.
 * @param {function} props.onImport – (source, blocks) => void
 * @param {function} props.onClose
 */
export function CloneFromUserDrawer({ users, exclude, imported = [], target, onImport, onClose }) {
  const sources = users
    .filter(u => u.name !== exclude)
    .map(u => ({ ...u, blocks: (u.blocks || []).filter(b => blockStatus(b) !== 'expired') }))
    .filter(u => u.blocks.length);
  const [name, setName] = useState('');
  const [picked, setPicked] = useState([]);
  // Save lets the drawer slide shut first, then hands the copies over.
  const [done, setDone] = useState(null);
  const source = sources.find(u => u.name === name);

  const choose = (n) => { setName(n); setPicked([]); };
  const importedIds = new Set(imported);
  const isImported = (i) => !!source?.blocks[i]?.id && importedIds.has(source.blocks[i].id);
  const targetLocs = (target?.locations || []).map(l => String(l).trim().toLowerCase());
  const noAccess = (i) => {
    const loc = String(source?.blocks[i]?.location || '').trim().toLowerCase();
    return targetLocs.length > 0 && !!loc && !targetLocs.includes(loc);
  };
  // Why a row can't be picked, for its tooltip (null when it can be).
  const blockedReason = (i) => {
    if (isImported(i)) return 'These blocks are already added';
    return null;
  };
  const available = (source?.blocks || []).map((_, i) => i).filter(i => !blockedReason(i));
  const defaultLoc = target?.locations?.[0] || '';
  // The blocks as they'll be imported: one at a location the user can't
  // access goes to their default location instead.
  const pickedBlocks = () => picked.map(i => (noAccess(i) ? { ...source.blocks[i], location: defaultLoc } : source.blocks[i]));
  const toggle = (i) => setPicked(p => (p.includes(i) ? p.filter(x => x !== i) : [...p, i].sort((a, b) => a - b)));

  return (
    <Drawer
      title="Import Availability"
      // Wider than the standard 700px so the blocks table's seven columns fit
      // with no sideways scroll (Hours keeps ~200px).
      width={840}
      dismissed={!!done}
      onClose={() => (done ? onImport(done.source, done.blocks) : onClose())}
      primaryAction={(
        <Button variant="primary" size="L" disabled={!picked.length} onClick={() => setDone({ source, blocks: pickedBlocks() })}>
          {picked.length ? `Import ${picked.length} block${picked.length === 1 ? '' : 's'}` : 'Import'}
        </Button>
      )}
    >
      <div className={styles.cloneBody}>
        <div className={styles.cloneSection}>
          <span className={styles.cloneHeading}>Clone from</span>
          <Select
            searchable
            options={sources.map(u => ({ value: u.name, label: `${u.name} (${u.blocks.length} block${u.blocks.length === 1 ? '' : 's'})` }))}
            value={name}
            onChange={choose}
            placeholder="Select user"
            aria-label="Clone from"
          />
        </div>

        <div className={styles.cloneSection}>
          <span className={styles.cloneHeading}>Select availability blocks</span>
          {!source ? (
            <div className={styles.cloneEmpty}>
              <RingEmptyState size="S" icon="solar:calendar-minimalistic-linear" label="Blocks appear once a user is selected" />
            </div>
          ) : (
            <>
            {source.blocks.some((_, i) => noAccess(i)) && (
              <InfoBar variant="inline" className={styles.cloneAccessNote}>
                If selected, blocks at locations you don't have access to will be added for your default location ({defaultLoc}).
              </InfoBar>
            )}
            <div className={styles.cloneTable}>
              <WorklistShell
                embedded
                hideBulkBar
                header={null}
                columns={COLUMNS}
                // The shell keys selection by row.id; here that's the block's position.
                rows={source.blocks.map((b, i) => ({ ...b, blockId: b.id, id: i, index: i }))}
                // Already-imported rows count as "selected" for the header box
                // once anything is picked, so ticking every available row reads
                // as all selected.
                selectedIds={picked.length ? [...picked, ...(source?.blocks || []).map((_, i) => i).filter(i => blockedReason(i))] : []}
                onSelectAll={(on) => setPicked(on ? available : [])}
                minTableWidth={700}
                renderRow={(b) => {
                  const on = picked.includes(b.index);
                  const reason = blockedReason(b.index);
                  const was = !!reason;
                  const status = STATUS_LOOK[blockStatus(b)];
                  // An imported row explains itself on hover, anywhere along it.
                  const tip = (node) => (was
                    ? <Tooltip label={reason} followCursor className={styles.cloneTip}>{node}</Tooltip>
                    : node);
                  const moved = noAccess(b.index);
                  return (
                    <tr
                      key={b.blockId || b.index}
                      className={[styles.row, styles.cloneTr, on ? styles.cloneTrOn : '', was ? styles.cloneTrDone : ''].filter(Boolean).join(' ')}
                      onClick={() => !was && toggle(b.index)}
                    >
                      <td className={`${styles.td} ${styles.cloneCheckTd}`}>
                        {tip(<>
                        <Checkbox
                          checked={on || isImported(b.index)}
                          disabled={was}
                          className={was ? styles.cloneCheckDone : undefined}
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={() => toggle(b.index)}
                          aria-label={`Select block ${b.index + 1}`}
                        />
                      </>)}
                      </td>
                      <td className={styles.td}>{tip(<><span className={styles.cloneBlockName}>Block {b.index + 1}</span></>)}</td>
                      <td className={`${styles.td} ${styles.cloneStatusTd}`}>{tip(<><Badge tone={status.tone} size="S" label={status.label} /></>)}</td>
                      <td className={styles.td}>
                        {moved ? (
                          // No access here: flagged in red, the reason on the icon.
                          <span className={`${styles.cellText} ${styles.cloneNoAccess}`}>
                            {/* The last word and the icon stay together on wrap. */}
                            {b.location.split(' ').slice(0, -1).join(' ')}{' '}
                            <span className={styles.cloneNoWrapTail}>
                            {b.location.split(' ').slice(-1)[0]}
                            <Tooltip label="You don't have access to this location. If selected, this block will be added for your default location." maxWidth={240} className={styles.cloneNoAccessTip}>
                              <Icon name="solar:info-circle-linear" size={14} color="currentColor" className={styles.cloneNoAccessIcon} />
                            </Tooltip>
                            </span>
                          </span>
                        ) : tip(<><span className={styles.cellText}>{b.location}</span></>)}
                      </td>
                      <td className={styles.td}>
                        {tip(<>
                        {/* "Monthly" over its days ("1st, 3rd Sat"), no separator. */}
                        <span className={styles.slot}>
                          <span className={`${styles.cellText} ${styles.cloneNoWrap}`}>{cadenceText(b).split(' • ')[0]}</span>
                          {cadenceText(b).split(' • ')[1] && <span className={styles.cloneDays}>{cadenceText(b).split(' • ')[1]}</span>}
                        </span>
                      </>)}
                      </td>
                      <td className={styles.td}>
                        {tip(<>
                        <span className={styles.slot}>
                          <span className={styles.cloneDates}>{formatDate(b.startDate)} -</span>
                          <span className={styles.cloneDates}>{formatDate(b.endDate)}</span>
                        </span>
                      </>)}
                      </td>
                      <td className={styles.td}>
                        {tip(<>
                        <span className={styles.cloneStack}>
                          {(b.slots || []).map((sl, k) => (
                            <span key={k} className={styles.slot}>
                              <span className={styles.slotTime}>{slotText(sl)}</span>
                              <span className={styles.slotType}>{sl.appointmentType || ALL_TYPES}</span>
                            </span>
                          ))}
                        </span>
                      </>)}
                      </td>
                    </tr>
                  );
                }}
              />
            </div>
            </>
          )}
        </div>
      </div>
    </Drawer>
  );
}
