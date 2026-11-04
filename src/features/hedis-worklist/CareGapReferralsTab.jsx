import { useMemo, useState } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { Button } from '../../components/Button/Button';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { SearchBar } from '../../components/SearchBar/SearchBar';
import { MenuPopover } from '../../components/MenuPopover/MenuPopover';
import { FilterChip } from '../../components/FilterChip/FilterChip';
import { Toggle } from '../../components/Toggle/Toggle';
import { HeaderCell } from '../../components/HeaderCell/HeaderCell';
import { useTableSort } from '../../components/HeaderCell/useTableSort';
import { REFERRAL_CHANNELS, REFERRAL_STATUS } from './useCareGapReferralForm';
import styles from './CareGapReferralsTab.module.css';

// Folder tabs (Figma 1:121862). "Signed" covers anything sent but not yet
// completed ('Signed & Referred', and the older 'Sent').
const FOLDERS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Drafts', dot: 'var(--neutral-300)' },
  { key: 'signed', label: 'Signed', dot: 'var(--status-warning)' },
  { key: 'completed', label: 'Completed', dot: 'var(--status-success)' },
];
const folderOf = (status) => (status === REFERRAL_STATUS.draft ? 'draft' : status === REFERRAL_STATUS.completed ? 'completed' : 'signed');
const STATUS_CLASS = { draft: styles.statusDraft, signed: styles.statusSigned, completed: styles.statusCompleted };
const EMPTY_FILTERS = { channel: [], referredTo: [] };

const fmtCreated = (iso) => {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
};

/**
 * Care Gap drawer: Referrals tab (Figma New Care Gap Workflow 1:121862).
 * Folder tabs, search + filter chips, and a Referred By / Referred To /
 * Created On / Status table with a row menu. Row click opens the referral
 * (read-only, or the draft for editing).
 *
 * @param {object}   props
 * @param {Array}    props.referrals   – caregap_referrals records for the member
 * @param {Array}    props.providers   – referral directory (specialty lookup)
 * @param {function} props.onOpen      – (id) => void
 * @param {function} props.onNew       – opens Send Referral
 * @param {function} props.onComplete  – (id) => void, marks a signed referral Completed
 * @param {function} props.onViewEmail – (id) => void, opens a sent email in Messages
 * @param {string}   [props.selectedId]
 */
export function CareGapReferralsTab({ referrals = [], providers = [], onOpen, onNew, onComplete, onViewEmail, selectedId }) {
  const [folder, setFolder] = useState('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [chipsOpen, setChipsOpen] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [rowMenu, setRowMenu] = useState(null);

  const specialtyOf = (id, name) => {
    const byId = id && providers.find(p => p.id === id);
    if (byId) return byId.specialty;
    const same = providers.filter(p => (p.name || '').toLowerCase() === String(name || '').toLowerCase());
    return (same.find(p => p.specialty) || same[0])?.specialty || '';
  };

  const rows = useMemo(() => referrals.map(r => ({
    id: r.id,
    raw: r,
    folder: folderOf(r.status),
    status: r.status || 'Sent',
    fromName: r.sentBy || '',
    fromSpecialty: specialtyOf(r.sentById, r.sentBy),
    toName: r.providerName || 'Provider not selected',
    toSpecialty: specialtyOf(r.providerId, r.providerName),
    channel: REFERRAL_CHANNELS.find(c => c.key === r.channel)?.label || r.channel,
    createdTs: r.createdAt ? new Date(r.createdAt).getTime() : 0,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [referrals, providers]);

  const counts = useMemo(() => {
    const acc = { draft: 0, signed: 0, completed: 0 };
    for (const r of rows) acc[r.folder] = (acc[r.folder] || 0) + 1;
    return acc;
  }, [rows]);
  const channelOptions = useMemo(() => [...new Set(rows.map(r => r.channel).filter(Boolean))], [rows]);
  const toOptions = useMemo(() => [...new Set(rows.map(r => r.toName).filter(Boolean))].sort(), [rows]);
  const anyFilter = filters.channel.length > 0 || filters.referredTo.length > 0;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter(r => folder === 'all' || r.folder === folder)
      .filter(r => !filters.channel.length || filters.channel.includes(r.channel))
      .filter(r => !filters.referredTo.length || filters.referredTo.includes(r.toName))
      .filter(r => !q || `${r.fromName} ${r.fromSpecialty} ${r.toName} ${r.toSpecialty} ${r.status} ${r.channel}`.toLowerCase().includes(q))
      .toSorted((a, b) => b.createdTs - a.createdTs);
  }, [rows, folder, filters, search]);
  const { sorted, sortKey, sortDir, requestSort } = useTableSort(visible);

  const actionsFor = (row) => {
    if (row.folder === 'draft') return [{ key: 'open', icon: 'solar:pen-linear', label: 'Continue Draft' }];
    return [
      { key: 'open', icon: 'solar:eye-linear', label: 'View Referral' },
      ...(row.raw.channel === 'email' ? [{ key: 'email', icon: 'solar:letter-linear', label: 'View Email' }] : []),
      ...(row.folder === 'signed' ? [{ key: 'complete', icon: 'solar:check-circle-linear', label: 'Mark as Completed' }] : []),
    ];
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <Toggle
          size="sm"
          items={FOLDERS.map(f => ({
            key: f.key,
            label: (
              <span className={styles.folderLabel}>
                {f.dot && <span className={styles.folderDot} style={{ background: f.dot }} aria-hidden="true" />}
                {f.label}
                {f.key !== 'all' && counts[f.key] ? <span className={styles.folderCount}>{counts[f.key]}</span> : null}
              </span>
            ),
          }))}
          value={folder}
          onValueChange={setFolder}
        />
        <div className={styles.toolbarActions}>
          {searchOpen ? (
            <SearchBar
              className={styles.searchBar}
              placeholder="Search referrals"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClose={() => { setSearchOpen(false); setSearch(''); }}
            />
          ) : (
            <ActionButton size="sm" icon="solar:magnifer-linear" tooltip="Search" onClick={() => setSearchOpen(true)} />
          )}
          <span className={styles.divider} />
          <ActionButton
            size="sm"
            icon="custom:filter"
            tooltip={chipsOpen ? 'Hide filters' : 'Filter'}
            tooltipLeft
            iconColor={chipsOpen || anyFilter ? 'var(--primary-300)' : undefined}
            onClick={() => setChipsOpen(v => !v)}
          />
        </div>
      </div>

      {chipsOpen && (
        <div className={styles.chips}>
          <FilterChip size="S" label="Channel" options={channelOptions} selected={filters.channel} onChange={v => setFilters(f => ({ ...f, channel: v }))} />
          <FilterChip size="S" label="Referred To" options={toOptions} selected={filters.referredTo} onChange={v => setFilters(f => ({ ...f, referredTo: v }))} searchable />
          {anyFilter && (
            <button type="button" className={styles.clearAll} onClick={() => setFilters(EMPTY_FILTERS)}>
              <Icon name="solar:close-circle-linear" size={14} color="currentColor" />
              Clear All
            </button>
          )}
        </div>
      )}

      {visible.length === 0 ? (
        <div className={styles.empty}>
          <Icon name="solar:square-share-line-linear" size={36} color="var(--neutral-200)" />
          <p className={styles.emptyTitle}>
            {rows.length === 0 ? 'No referrals for this member yet.' : 'No referrals match these filters.'}
          </p>
          {rows.length === 0 && onNew && (
            <Button leadingIcon="solar:square-share-line-linear" onClick={onNew}>Send Referral</Button>
          )}
        </div>
      ) : (
        <table className={styles.table}>
          <colgroup>
            <col />
            <col />
            <col className={styles.colCreated} />
            <col className={styles.colStatus} />
            <col className={styles.colActions} />
          </colgroup>
          <thead>
            <tr>
              <HeaderCell label="Referred By" className={styles.th} />
              <HeaderCell label="Referred To" className={styles.th} />
              <HeaderCell label="Created On" sortField="createdTs" sortType="number" activeKey={sortKey} activeDir={sortDir} onSort={requestSort} className={styles.th} />
              <HeaderCell label="Status" sortField="status" activeKey={sortKey} activeDir={sortDir} onSort={requestSort} className={styles.th} />
              <HeaderCell label="" className={styles.th} />
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => (
              <tr
                key={r.id}
                className={[styles.row, r.id === selectedId ? styles.rowActive : ''].filter(Boolean).join(' ')}
                tabIndex={0}
                onClick={() => onOpen?.(r.id)}
                onKeyDown={(e) => { if (e.key === 'Enter') onOpen?.(r.id); }}
              >
                <td className={styles.td}>
                  <span className={styles.name}>{r.fromName}</span>
                  {r.fromSpecialty && <span className={styles.sub}>{r.fromSpecialty}</span>}
                </td>
                <td className={styles.td}>
                  <span className={styles.name}>{r.toName}</span>
                  {r.toSpecialty && <span className={styles.sub}>{r.toSpecialty}</span>}
                </td>
                <td className={[styles.td, styles.created].join(' ')}>{fmtCreated(r.raw.createdAt)}</td>
                <td className={[styles.td, STATUS_CLASS[r.folder]].join(' ')}>{r.status}</td>
                <td className={[styles.td, styles.actionsTd].join(' ')} onClick={e => e.stopPropagation()}>
                  <ActionButton
                    size="sm"
                    icon="solar:menu-dots-linear"
                    tooltip="More actions"
                    tooltipLeft
                    className={styles.rowMenuBtn}
                    onClick={(e) => setRowMenu({ row: r, rect: e.currentTarget.getBoundingClientRect() })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {rowMenu && (
        <MenuPopover
          anchorRect={rowMenu.rect}
          align="right"
          width={180}
          ariaLabel="Referral actions"
          items={actionsFor(rowMenu.row)}
          onSelect={(key) => {
            const id = rowMenu.row.id;
            setRowMenu(null);
            if (key === 'open') onOpen?.(id);
            else if (key === 'email') onViewEmail?.(id);
            else if (key === 'complete') onComplete?.(id);
          }}
          onClose={() => setRowMenu(null)}
        />
      )}
    </div>
  );
}
