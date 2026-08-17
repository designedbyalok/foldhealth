import { useState } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { Avatar } from '../../../../../../../../components/Avatar/Avatar';
import styles from './LetterHistoryDrawer.module.css';

/**
 * Letter Sent Log — a timeline of letter send events, built dynamically from
 * the letters that carry send metadata (sentVia / lastSent / sentBy).
 * Figma 2334-319026. Built on the shared Drawer.
 */
export function LetterHistoryDrawer({ letters = [], onOpen, onClose }) {
  const [search, setSearch] = useState('');

  const q = search.trim().toLowerCase();
  // A "sent" event = any letter that has been delivered (sentVia set).
  const entries = letters.filter(l => {
    if (!(l.sentVia || []).length) return false;
    if (!q) return true;
    return l.fileName.toLowerCase().includes(q) || (l.sentBy || '').toLowerCase().includes(q);
  });

  return (
    <Drawer title="Letter Sent Log" onClose={onClose} bodyClassName={styles.body}>
      <div className={styles.searchBox}>
        <Icon name="solar:magnifer-linear" size={16} color="var(--neutral-200)" />
        <input aria-label="Search letter history" placeholder="Search History" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {entries.length === 0 ? (
        <div className={styles.empty}>No letters have been sent yet.</div>
      ) : (
        <div className={styles.timeline}>
          {entries.map((l, i) => (
            <div key={l.id} className={styles.entry}>
              <div className={styles.rail}>
                <Avatar type="icon" variant="others" iconName="solar:plain-2-linear" size="M" />
                {i < entries.length - 1 && <span className={styles.line} />}
              </div>
              <div className={styles.entryBody}>
                <div className={styles.meta}>{l.lastSent} · {l.sentBy}</div>
                <div className={styles.channels}>Files Sent via {(l.sentVia || []).join(' & ')}</div>
                <button type="button" className={styles.card} onClick={() => onOpen?.(l)}>
                  <Avatar type="icon" variant="others" iconName="solar:document-text-linear" size="M" />
                  <span className={styles.cardText}>
                    <span className={styles.name}>{l.fileName}</span>
                    <span className={styles.subtype}>{l.fileType}</span>
                  </span>
                  <Icon name="solar:arrow-right-up-linear" size={16} color="var(--neutral-300)" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}
