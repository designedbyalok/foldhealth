import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { Button } from '../../../components/Button/Button';
import { SegmentedControl } from '../../../components/SegmentedControl/SegmentedControl';
import { SearchBar } from '../../../components/SearchBar/SearchBar';
import { Skeleton } from '../../../components/Skeleton/Skeleton';
import { useAppStore } from '../../../store/useAppStore';
import listStyles from '../MessagesView.module.css';
import commsStyles from '../comms/Comms.module.css';
import { formatTime } from '../messageUtils';
import { CommsListHeader } from '../comms/CommsListHeader';
import { CommsListEmpty, CommsPanelEmpty } from '../comms/CommsEmptyState';
import { useCommsPeople } from '../comms/useCommsPeople';
import { EfaxThread } from './EfaxThread';
import { CreateEfaxDrawer } from './CreateEfaxDrawer';
import styles from './Efax.module.css';

// How long a new fax shows "Reading this fax…" before its match appears.
const READ_MS = 1600;

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Not Linked' },
  { key: 'linked', label: 'Linked' },
];

/**
 * Comms → E-fax: received faxes, each read for the patient it's about. A
 * fax that isn't filed under a patient yet says so in the list. "Create
 * Test eFax" receives one about any patient.
 */
export function EfaxWorkspace({ navCollapsed, onToggleNav }) {
  const faxes = useAppStore(s => s.efaxes);
  const loading = useAppStore(s => s.efaxesLoading);
  const fetchEfaxes = useAppStore(s => s.fetchEfaxes);
  const addEfax = useAppStore(s => s.addEfax);
  const { patients, me } = useCommsPeople();
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [reading, setReading] = useState([]);

  useEffect(() => { fetchEfaxes(); }, [fetchEfaxes]);

  const patientOptions = useMemo(
    () => patients.map(p => ({ value: String(p.id), label: p.name })),
    [patients],
  );

  const q = query.trim().toLowerCase();
  const list = faxes.filter((f) => {
    if (tab === 'open' && f.linked) return false;
    if (tab === 'linked' && !f.linked) return false;
    if (!q) return true;
    return `${f.senderName} ${f.documentType} ${f.linked?.name || ''} ${f.extracted?.name || ''}`.toLowerCase().includes(q);
  });
  const selected = list.find(f => f.id === selectedId) || null;
  const notLinked = faxes.filter(f => !f.linked).length;

  const create = (fax) => {
    addEfax(fax);
    setCreating(false);
    setTab('all');
    setSelectedId(fax.id);
    setReading(r => [...r, fax.id]);
    setTimeout(() => setReading(r => r.filter(id => id !== fax.id)), READ_MS);
  };

  return (
    <>
      <div className={listStyles.convPanel}>
        <CommsListHeader
          title="E-fax"
          sub={notLinked ? `${notLinked} not linked to a patient` : ''}
          navCollapsed={navCollapsed}
          onToggleNav={onToggleNav}
          searchActive={searchOpen}
          onSearch={() => { setSearchOpen(v => !v); setQuery(''); }}
        />
        <div className={listStyles.convTabs}>
          <SegmentedControl items={TABS} value={tab} onValueChange={setTab} size="sm" />
        </div>
        {searchOpen && (
          <div className={styles.listSearch}>
            <SearchBar
              placeholder="Search faxes"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onClose={() => { setSearchOpen(false); setQuery(''); }}
            />
          </div>
        )}

        <div className={listStyles.convList}>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={listStyles.convItem} aria-hidden>
                <Skeleton className={commsStyles.boneAvatar} />
                <div className={listStyles.convInfo}>
                  <Skeleton className={commsStyles.boneLine} />
                  <Skeleton className={commsStyles.boneLineShort} />
                </div>
              </div>
            ))
          ) : list.length === 0 ? (
            <CommsListEmpty viewKey="efax" label={q ? 'No faxes match your search' : tab === 'all' ? undefined : `No ${TABS.find(t => t.key === tab).label} Faxes`} />
          ) : list.map(f => (
            <button
              type="button"
              key={f.id}
              aria-current={selectedId === f.id ? 'true' : undefined}
              className={[listStyles.convItem, selectedId === f.id ? listStyles.selected : ''].join(' ')}
              onClick={() => setSelectedId(f.id)}
            >
              <span className={styles.faxAvatar}><Icon name="solar:printer-linear" size={18} color="currentColor" /></span>
              <div className={listStyles.convInfo}>
                <div className={listStyles.convNameRow}>
                  <div className={[listStyles.convName, f.read ? listStyles.muted : ''].join(' ')}>{f.senderName}</div>
                  <div className={listStyles.convTime}>{formatTime(f.receivedAt)}</div>
                </div>
                <div className={listStyles.convPreviewRow}>
                  <div className={listStyles.convPreview}>
                    {f.documentType} •{' '}
                    {f.linked
                      ? <>Linked to {f.linked.name}</>
                      : <span className={styles.previewOpen}>Not linked</span>}
                  </div>
                  {!f.read && <span className={listStyles.convUnread}>1</span>}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className={styles.listFooter}>
          <Button variant="outline" fullWidth leadingIcon="solar:add-circle-linear" onClick={() => setCreating(true)}>
            Create Test eFax
          </Button>
        </div>
      </div>

      {selected ? (
        <EfaxThread
          key={selected.id}
          fax={selected}
          reading={reading.includes(selected.id)}
          patients={patients}
          me={me}
        />
      ) : (
        <CommsPanelEmpty viewKey="efax" hasConversations={faxes.length > 0} onCreate={() => {}} />
      )}

      {creating && (
        <CreateEfaxDrawer
          patients={patients}
          patientOptions={patientOptions}
          onCreate={create}
          onClose={() => setCreating(false)}
        />
      )}
    </>
  );
}
