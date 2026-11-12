import { useState } from 'react';
import { Drawer } from '../../../../components/Drawer/Drawer';
import { Button } from '../../../../components/Button/Button';
import { Select } from '../../../../components/Select/Select';
import { Checkbox } from '../../../../components/Checkbox/Checkbox';
import { EmptyState } from '../../../../components/EmptyState/EmptyState';
import { WorklistShell } from '../../../../components/WorklistShell/WorklistShell';
import { Badge } from '../../../../components/Badge/Badge';
import { Icon } from '../../../../components/Icon/Icon';
import { Tooltip } from '../../../../components/Tooltip/Tooltip';
import { Banner } from '../../../../components/Banner/Banner';
import { Avatar } from '../../../../components/Avatar/Avatar';
import { ALL_TYPES, STATUS_LOOK, blockStatus, cadenceText, formatDate, slotTextTz } from './availabilityUtils';

// Fixed where the content is fixed; Hours takes what's left.
const COLUMNS = [
  { key: 'select', showCheckbox: true, width: 36 },
  { key: 'user', label: 'User', width: 210 },
  { key: 'status', label: 'Status', width: 96 },
  { key: 'location', label: 'Location', width: 140 },
  { key: 'cadence', label: 'Cadence', width: 128 },
  { key: 'dates', label: 'Dates', width: 112 },
  { key: 'hours', label: 'Hours' },
];
import styles from './UserAvailability.module.css';

/**
 * Import from other users: a drawer over the availability drawer. Pick one
 * or more users, tick which of their slots to copy (one table, a row per
 * slot, with whose it is), Import. Only active and upcoming slots are offered
 * (a past slot has nothing left to schedule), and none start ticked. Nothing
 * is saved here; the copies land in the availability drawer.
 *
 * @param {object[]} props.users   – users with their blocks
 * @param {string}   props.exclude – the user being edited (not a source)
 * @param {string[]} [props.imported] – ids of source blocks already imported
 *   into the drawer; their rows are greyed out and can't be picked again
 * @param {object}   [props.target] – the user being edited ({ name, locations });
 *   a slot at a location they aren't assigned to can still be picked, with an
 *   inline note saying it'll be added at their default (first) location.
 *   With no locations on record, nothing is changed.
 * @param {function} props.onImport – (blocks) => void; each block carries
 *   `importedFrom` (the source user's name)
 * @param {function} props.onClose
 * @param {boolean}  [props.single] – One source user only (Add availability
 *   for multiple users): picking another user replaces the first
 * @param {React.ReactNode} [props.note] – A banner above the picker
 */
export function CloneFromUserDrawer({ users, exclude, imported = [], target, onImport, onClose, single = false, note }) {
  const sources = users
    .filter(u => u.name !== exclude)
    .map(u => ({ ...u, blocks: (u.blocks || []).filter(b => blockStatus(b) !== 'expired') }))
    .filter(u => u.blocks.length);
  const [names, setNames] = useState([]);
  // Picked rows, keyed "<user name>|<slot index>".
  const [picked, setPicked] = useState([]);
  // Import lets the drawer slide shut first, then hands the copies over.
  const [done, setDone] = useState(null);
  const chosen = names.map(n => sources.find(u => u.name === n)).filter(Boolean);
  // Every chosen user's slots, one row each, in the order the users were picked.
  const rows = chosen.flatMap(u => u.blocks.map((b, i) => ({ ...b, blockId: b.id, id: `${u.name}|${i}`, index: i, owner: u.name, ownerUser: u })));

  // Dropping a user drops their picked rows too.
  const choose = (next) => {
    const nextSet = new Set(next);
    setNames(next);
    setPicked(p => p.filter(k => nextSet.has(k.split('|')[0])));
  };
  const importedIds = new Set(imported);
  const isImported = (r) => !!r.blockId && importedIds.has(r.blockId);
  const targetLocs = new Set((target?.locations || []).map(l => String(l).trim().toLowerCase()));
  const noAccess = (r) => {
    const loc = String(r.location || '').trim().toLowerCase();
    return targetLocs.size > 0 && !!loc && !targetLocs.has(loc);
  };
  // Why a row can't be picked, for its tooltip (null when it can be).
  const blockedReason = (r) => (isImported(r) ? 'These schedules are already added' : null);
  const available = rows.filter(r => !blockedReason(r)).map(r => r.id);
  const defaultLoc = target?.locations?.[0] || '';
  // The slots as they'll be imported: one at a location the user can't
  // access goes to their default location instead.
  const pickedBlocks = () => { const pickedSet = new Set(picked); return rows
    .filter(r => pickedSet.has(r.id))
    .map(({ id, index, owner, ownerUser, blockId, ...b }) => ({ ...b, id: blockId, importedFrom: owner, ...(noAccess(b) ? { location: defaultLoc } : {}) })); };
  const toggle = (k) => setPicked(p => (p.includes(k) ? p.filter(x => x !== k) : [...p, k]));

  return (
    <Drawer
      title="Import Availability"
      // Wider than the standard 700px so the slots table's seven columns fit
      // with no sideways scroll (Hours keeps ~200px).
      width={1040}
      dismissed={!!done}
      onClose={() => (done ? onImport(done) : onClose())}
      primaryAction={(
        <Button disabled={!picked.length} onClick={() => setDone(pickedBlocks())}>
          {picked.length ? `Import ${picked.length} schedule${picked.length === 1 ? '' : 's'}` : 'Import'}
        </Button>
      )}
    >
      <div className={styles.cloneBody}>
        {note && <Banner size="sm">{note}</Banner>}
        <div className={styles.cloneSection}>
          <span className={styles.cloneHeading}>Clone from</span>
          <Select
            searchable
            multiple={!single}
            checkboxes={!single}
            badges={!single}
            options={sources.map(u => ({
              value: u.name,
              // As in Configure Team's user picker: avatar, name over role, a chip on the right.
              label: (
                <span className={styles.cloneOption}>
                  <Avatar variant="staff" initials={u.initials} userName={u.name} userId={u.id} />
                  <span className={styles.cloneOptionText}>
                    <span className={styles.cloneOptionName}>{u.name}</span>
                    {u.role && <span className={styles.cloneOptionRole}>{u.role}</span>}
                  </span>
                  <Badge size="sm" label={`${u.blocks.length} schedule${u.blocks.length === 1 ? '' : 's'}`} />
                </span>
              ),
              triggerLabel: u.name,
              searchText: [u.name, u.email, u.role].filter(Boolean).join(' '),
            }))}
            value={single ? names[0] : names}
            onValueChange={(v) => choose(single ? (v ? [v] : []) : v)}
            placeholder={single ? 'Select user' : 'Select users'}
            // Only users with active or upcoming slots are offered; say so when a search finds none.
            emptyText={(q) => (q ? 'No users match searched keyword.' : 'No other users have availability defined.')}
            aria-label="Clone from"
          />
        </div>

        <div className={styles.cloneSection}>
          <span className={styles.cloneHeading}>Select availability schedules</span>
          {!rows.length ? (
            <div className={styles.cloneEmpty}>
              <EmptyState size="sm" icon="solar:calendar-minimalistic-linear" title="Schedules appear once a user is selected" />
            </div>
          ) : (
            <>
            {rows.some(noAccess) && (
              <Banner size="sm" className={styles.cloneAccessNote}>
                If selected, schedules at locations you don't have access to will be added for your default location ({defaultLoc}).
              </Banner>
            )}
            <div className={styles.cloneTable}>
              <WorklistShell
                embedded
                hideBulkBar
                header={null}
                columns={COLUMNS}
                rows={rows}
                // Already-imported rows count as "selected" for the header box
                // once anything is picked, so ticking every available row reads
                // as all selected.
                selectedIds={picked.length ? [...picked, ...rows.filter(r => blockedReason(r)).map(r => r.id)] : []}
                onSelectAll={(on) => setPicked(on ? available : [])}
                minTableWidth={920}
                renderRow={(b) => {
                  const on = picked.includes(b.id);
                  const reason = blockedReason(b);
                  const was = !!reason;
                  const status = STATUS_LOOK[blockStatus(b)];
                  // An imported row explains itself on hover, anywhere along it.
                  const tip = (node) => (was
                    ? <Tooltip label={reason} followCursor className={styles.cloneTip}>{node}</Tooltip>
                    : node);
                  const moved = noAccess(b);
                  return (
                    <tr
                      key={b.id}
                      className={[styles.row, styles.cloneTr, on ? styles.cloneTrOn : '', was ? styles.cloneTrDone : ''].filter(Boolean).join(' ')}
                      onClick={() => !was && toggle(b.id)}
                    >
                      <td className={`${styles.td} ${styles.cloneCheckTd}`}>
                        {tip(<>
                        <Checkbox
                          checked={on || isImported(b)}
                          disabled={was}
                          className={was ? styles.cloneCheckDone : undefined}
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={() => toggle(b.id)}
                          aria-label={`Select ${b.owner}'s schedule ${b.index + 1}`}
                        />
                      </>)}
                      </td>
                      <td className={styles.td}>
                        {/* As in the User Availability list: avatar, name over email. */}
                        {tip(<>
                        <span className={styles.user}>
                          <Avatar variant="staff" size="M" initials={b.ownerUser.initials} userName={b.ownerUser.name} userId={b.ownerUser.id} />
                          <span className={styles.userText}>
                            <span className={styles.userName}>{b.ownerUser.name}</span>
                            {b.ownerUser.email && <span className={styles.userSub}>{b.ownerUser.email}</span>}
                          </span>
                        </span>
                      </>)}
                      </td>
                      <td className={`${styles.td} ${styles.cloneStatusTd}`}>{tip(<><Badge tone={status.tone} size="sm" label={status.label} /></>)}</td>
                      <td className={styles.td}>
                        {moved ? (
                          // No access here: flagged in red, the reason on the icon.
                          <span className={`${styles.cellText} ${styles.cloneNoAccess}`}>
                            {/* The last word and the icon stay together on wrap. */}
                            {b.location.split(' ').slice(0, -1).join(' ')}{' '}
                            <span className={styles.cloneNoWrapTail}>
                            {b.location.split(' ').slice(-1)[0]}
                            <Tooltip label="You don't have access to this location. If selected, this schedule will be added for your default location." maxWidth={240} className={styles.cloneNoAccessTip}>
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
                          <span className={styles.cloneDates}>{b.endDate ? formatDate(b.endDate) : 'Ongoing'}</span>
                        </span>
                      </>)}
                      </td>
                      <td className={styles.td}>
                        {tip(<>
                        <span className={styles.cloneStack}>
                          {(b.slots || []).map((sl, k) => (
                            <span key={k} className={styles.slot}>
                              <span className={styles.slotTime}>{slotTextTz(sl, b.timezone)}</span>
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
