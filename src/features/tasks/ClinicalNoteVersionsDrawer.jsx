import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Drawer } from '../../components/Drawer/Drawer';
import { Badge } from '../../components/Badge/Badge';
import { Icon } from '../../components/Icon/Icon';
import styles from './ClinicalNoteVersionsDrawer.module.css';

/**
 * ClinicalNoteVersionsDrawer: P3-1 amend history surface.
 *
 * Every UPDATE on `clinical_notes` fires the trigger
 * `clinical_notes_version_snapshot` (see
 * `supabase/clinical_note_versions_migration.sql`) which persists the
 * prior row into `clinical_note_versions`. Until now no UI ever
 * surfaced those rows: the audit trail existed in the DB but a
 * reviewer had no way to see it.
 *
 * This drawer:
 *   • Fetches `clinical_note_versions.eq('note_id', note.id)` on open.
 *   • Renders a reverse-chronological timeline: version #, status pill,
 *     author / reviewer / signer, when it was captured.
 *   • Each row expands to show the payload as pretty JSON, no diff
 *     algorithm yet, just a snapshot so reviewers can verify what
 *     changed field-by-field. (Diff is a follow-up; the raw payload
 *     is enough for compliance walkthroughs.)
 *
 * Props:
 *   • note: the current clinical_notes JS row (needs .id at minimum)
 *   • onClose: dismisses the drawer
 */
export function ClinicalNoteVersionsDrawer({ note, onClose }) {
  const fetchClinicalNoteVersions = useAppStore(s => s.fetchClinicalNoteVersions);
  const versionsById = useAppStore(s => s.clinicalNoteVersionsById);
  const versions = useMemo(
    () => (note?.id ? (versionsById?.[note.id] || []) : []),
    [note?.id, versionsById],
  );
  const [expanded, setExpanded] = useState(() => new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!note?.id) return () => { cancelled = true; };
    setLoaded(false);
    fetchClinicalNoteVersions?.(note.id).finally(() => {
      if (!cancelled) setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [note?.id, fetchClinicalNoteVersions]);

  if (!note) return null;

  const toggle = (versionKey) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(versionKey)) next.delete(versionKey);
      else next.add(versionKey);
      return next;
    });
  };

  return (
    <Drawer title="Amend History" onClose={onClose} width={640}>
      <div className={styles.body}>
        <div className={styles.summary}>
          <span className={styles.summaryLabel}>Note</span>
          <span className={styles.summaryValue}>
            {(note.formType === 'non_visit_note' || note.formType === 'normal_note')
              ? (note.payload?.title || (note.formType === 'normal_note' ? 'Clinical Note' : 'Non-Visit Note'))
              : (note.gapCodes || []).length > 1
                ? 'Consolidated Clinical Note'
                : `${(note.gapCodes || [])[0] || ''} Visit Note`.trim()}
          </span>
        </div>

        {!loaded && (
          <div className={styles.state}>
            <Icon name="solar:refresh-linear" size={20} color="var(--neutral-300)" />
            Loading versions…
          </div>
        )}

        {loaded && versions.length === 0 && (
          <div className={styles.state}>
            <Icon name="solar:notes-linear" size={24} color="var(--neutral-200)" />
            No prior versions: this note hasn&apos;t been amended.
          </div>
        )}

        {loaded && versions.length > 0 && (
          <ol className={styles.timeline}>
            {versions.map(v => {
              const key = `${v.noteId}:${v.version}`;
              const isOpen = expanded.has(key);
              const status = v.status || 'unknown';
              const statusTone = status === 'signed' ? 'success'
                : status === 'submitted' ? 'warning'
                : 'neutral';
              return (
                <li key={key} className={styles.versionRow}>
                  <button
                    type="button"
                    className={styles.versionHeader}
                    onClick={() => toggle(key)}
                    aria-expanded={isOpen}
                  >
                    <span className={styles.versionNumber}>v{v.version}</span>
                    <Badge tone={statusTone} size="sm" label={statusLabel(status)} />
                    <span className={styles.versionMeta}>
                      <span className={styles.versionActor}>
                        {v.signedByName || v.reviewerName || v.authorName || 'Unknown'}
                      </span>
                      <span className={styles.versionWhen}>{fmtWhen(v.signedAt || v.createdAt)}</span>
                    </span>
                    <Icon
                      name={isOpen ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
                      size={16}
                      color="var(--neutral-300)"
                    />
                  </button>
                  {isOpen && (
                    <div className={styles.versionBody}>
                      <pre className={styles.payload}>
                        {JSON.stringify(v.payload, null, 2)}
                      </pre>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Drawer>
  );
}

function statusLabel(status) {
  if (status === 'signed') return 'Signed';
  if (status === 'submitted') return 'Pending Review';
  if (status === 'draft') return 'Draft';
  return status;
}

function fmtWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd}/${d.getFullYear()} · ${hh}:${min}`;
}
