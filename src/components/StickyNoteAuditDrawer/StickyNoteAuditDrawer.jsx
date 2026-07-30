import { useState, useEffect } from 'react';
import { Drawer } from '../Drawer/Drawer';
import { Button } from '../Button/Button';
import { Avatar } from '../Avatar/Avatar';
import { Select } from '../Select/Select';
import { useAppStore } from '../../store/useAppStore';
import styles from './StickyNoteAuditDrawer.module.css';

function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '');
}

export function StickyNoteAuditDrawer({ patientId, note, profileOptions, onClose }) {
  const stickyNoteHistory = useAppStore(s => s.stickyNoteHistory);
  const fetchStickyNoteHistory = useAppStore(s => s.fetchStickyNoteHistory);
  const updateStickyNote = useAppStore(s => s.updateStickyNote);
  const [editText, setEditText] = useState(note?.text || '');
  const [selectedProfile, setSelectedProfile] = useState(note?.ehr_profile || 'Central Profile');

  useEffect(() => { if (patientId) fetchStickyNoteHistory(patientId); }, [patientId]);
  useEffect(() => { setEditText(note?.text || ''); }, [note?.text]);

  const handleSave = async () => {
    if (note?.id && editText.trim()) {
      await updateStickyNote(note.id, { text: editText.trim(), author_name: 'You', ehr_profile: selectedProfile }, patientId);
    }
  };

  const handleDiscard = () => { setEditText(note?.text || ''); };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()} • ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
  };

  const profiles = profileOptions || ['Central Profile', 'APC', 'JADE Health'];

  return (
    <Drawer title="Sticky Note Activity" onClose={onClose} bodyClassName={styles.drawerBody}>
      {/* Top form section */}
      <div className={styles.formSection}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Member Profile</label>
          <Select
            options={profiles.map(p => ({ value: p, label: p }))}
            value={selectedProfile}
            onChange={setSelectedProfile}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="sticky-note-textarea">Sticky Note</label>
          <textarea
            id="sticky-note-textarea"
            className={styles.noteTextarea}
            value={editText}
            onChange={e => setEditText(e.target.value)}
          />
        </div>

        <div className={styles.buttonRow}>
          <Button variant="primary" size="L" onClick={handleSave}>Save</Button>
          <Button variant="secondary" size="L" onClick={handleDiscard}>Discard</Button>
        </div>
      </div>

      {/* History section */}
      <div className={styles.historySection}>
        <h3 className={styles.historyTitle}>Note History</h3>
        <div className={styles.historyList}>
          {stickyNoteHistory.map((entry, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === stickyNoteHistory.length - 1;
            return (
              <div key={entry.id} className={styles.historyItem}>
                {/* Timeline track with connecting line */}
                <div className={styles.timelineTrack}>
                  <div className={`${styles.timelineLineTop} ${isFirst ? styles.timelineLineHidden : styles.timelineLineVisible}`} />
                  <div className={styles.historyAvatar}>
                    <Avatar variant="assignee" initials={getInitials(entry.author_name)} />
                  </div>
                  <div className={`${styles.timelineLineBottom} ${isLast ? styles.timelineLineHidden : styles.timelineLineVisible}`} />
                </div>
                {/* Content */}
                <div className={styles.historyContent}>
                  <div className={styles.historyMeta}>
                    {formatDate(entry.created_at)} • EHR Instance : {entry.ehr_instance}
                  </div>
                  <div className={styles.historyAuthor}>
                    <strong>{entry.author_name}</strong>{' '}
                    <span className={styles.historyAction}>{entry.action}</span>
                  </div>
                  <div className={styles.historyNote}>{entry.note_text}</div>
                </div>
              </div>
            );
          })}
          {stickyNoteHistory.length === 0 && (
            <div className={styles.emptyHistory}>No history yet</div>
          )}
        </div>
      </div>
    </Drawer>
  );
}
