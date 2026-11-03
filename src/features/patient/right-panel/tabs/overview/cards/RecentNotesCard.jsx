import { useEffect, useState } from 'react';
import { DashboardCard, DashboardCardBody, DashboardCardSkeleton } from '../../../../../../components/DashboardCard/DashboardCard';
import { PanelSectionItem } from '../../../../../../components/PanelSection/PanelSection';
import { Badge } from '../../../../../../components/Badge/Badge';
import { Button } from '../../../../../../components/Button/Button';
import { Icon } from '../../../../../../components/Icon/Icon';
import { useAppStore } from '../../../../../../store/useAppStore';
import styles from './overviewCards.module.css';

const VISIBLE = 3;

// Same status vocabulary as the Notes tab and the HEDIS care gap drawer.
function noteStatus(status) {
  if (status === 'signed') return { label: 'Signed', tone: 'success' };
  if (status === 'submitted') return { label: 'Pending Review', tone: 'warning' };
  return { label: 'Draft', tone: 'grey' };
}

function noteTitle(n) {
  if (n.payload?.title) return n.payload.title;
  const codes = n.gapCodes || [];
  if (codes.length > 1) return 'Consolidated Clinical Note';
  if (codes[0]) return `${codes[0]} Visit Note`;
  return n.formType === 'non_visit_note' ? 'Non-Visit Note' : 'Clinical Note';
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

export function RecentNotesCard({ patientId, actions }) {
  const notes = useAppStore(s => s.clinicalNotesByPatient[patientId]);
  const fetchNotes = useAppStore(s => s.fetchClinicalNotesForPatient);
  const openNotePreview = useAppStore(s => s.openNotePreview);
  const setPatientProfileTab = useAppStore(s => s.setPatientProfileTab);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!patientId) return;
    let live = true;
    fetchNotes(patientId).finally(() => { if (live) setFetched(true); });
    return () => { live = false; };
  }, [patientId, fetchNotes]);

  if (!notes && !fetched) return <DashboardCardSkeleton icon="solar:notes-linear" title="Recent Notes" />;

  // Unfinished notes (draft, pending review) first; signed ones after, newest first.
  const STATUS_ORDER = { draft: 0, submitted: 1 };
  const list = [...(notes || [])].sort((a, b) => (STATUS_ORDER[a.status] ?? 2) - (STATUS_ORDER[b.status] ?? 2));
  const unfinished = list.filter(n => n.status !== 'signed').length;
  const openNotes = () => setPatientProfileTab('Notes');

  return (
    <DashboardCard
      icon="solar:notes-linear"
      title="Recent Notes"
      count={unfinished || null}
      actions={(
        <>
          <Button variant="ghost" size="sm" onClick={actions.addNote}>Create note</Button>
          {list.length > VISIBLE && <Button variant="ghost" size="sm" onClick={openNotes}>View all</Button>}
        </>
      )}
    >
      <DashboardCardBody className={styles.listBody}>
        {list.length === 0 ? (
          <p className={styles.empty}>No clinical notes yet.</p>
        ) : list.slice(0, VISIBLE).map(n => {
          const status = noteStatus(n.status);
          return (
            <div key={n.id} className={styles.clickRow}>
              <PanelSectionItem
                inset
                leading={<span className={styles.tile}><Icon name="solar:notes-linear" size={16} /></span>}
                title={(
                  <button type="button" className={`${styles.titleButton} ${styles.stretch}`} onClick={() => openNotePreview(n)}>
                    {noteTitle(n)}
                  </button>
                )}
                meta={[n.authorName, formatDate(n.updatedAt || n.createdAt)]}
                trailing={<span className={styles.statusSlotWide}><Badge tone={status.tone} size="sm" label={status.label} /></span>}
              />
            </div>
          );
        })}
      </DashboardCardBody>
    </DashboardCard>
  );
}
