import { useEffect, useMemo } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { useAppStore } from '../../../store/useAppStore';
import { MobileSubHeader } from '../MobileHeader';
import { MobileEmpty } from '../MobileParts';
import common from '../mobile.module.css';
import styles from './care.module.css';

const EMPTY = [];
const ICON = { pdf: 'solar:document-text-linear', image: 'solar:gallery-linear', video: 'solar:play-linear' };
const IMAGE = /^(png|jpe?g|gif|webp|heic)$/i;
const VIDEO = /^(mp4|mov|webm)$/i;

function kindOf(d) {
  const ext = String(d.ext || (/\.([a-z0-9]+)$/i.exec(d.name || '') || [])[1] || '').toLowerCase();
  if (IMAGE.test(ext)) return 'image';
  if (VIDEO.test(ext)) return 'video';
  return 'pdf';
}
function sizeLabel(bytes) {
  const n = Number(bytes);
  if (!n) return null;
  return n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

/**
 * A program's documents (desktop ProgramRelatedFiles "Program Related"):
 * the patient's program_documents for this program, newest first, as the
 * Figma "All Documents" cards (759 page, frame 1041:45833). Tapping one
 * opens the file in the phone's viewer. Uploading stays on a computer.
 */
export function ProgramDocsScreen({ patientId, programCode }) {
  const documents = useAppStore(s => s.programDocuments) || EMPTY;
  const fetchProgramDocuments = useAppStore(s => s.fetchProgramDocuments);
  const patientRow = useAppStore(s => (s.allPatients || []).find(p => String(p.id) === String(patientId)));
  useEffect(() => { fetchProgramDocuments?.(); }, [fetchProgramDocuments]);

  const docs = useMemo(() => {
    const ids = new Set([patientId, patientRow?.memberId].filter(v => v != null).map(String));
    return documents.filter(d => d.programCode === programCode && ids.has(String(d.patientId)));
  }, [documents, programCode, patientId, patientRow]);

  return (
    <div className={common.screen}>
      <MobileSubHeader title="Documents" />
      <div className={common.body}>
        <div className={styles.docs}>
          {docs.length === 0 ? (
            <MobileEmpty icon="solar:folder-with-files-linear" title="No documents yet" />
          ) : docs.map(d => {
            const kind = kindOf(d);
            const url = d.fileUrl || null;
            const meta = [sizeLabel(d.sizeBytes), d.type, d.updatedDate].filter(Boolean).join(' • ');
            const body = (
              <>
                <span className={styles.docThumb}>
                  {kind === 'image' && url
                    ? <img src={url} alt="" className={styles.docImg} />
                    : <Icon name={ICON[kind]} size={32} color="var(--primary-300)" />}
                </span>
                <span className={styles.docText}>
                  <span className={styles.docName}>{d.name || 'Document'}</span>
                  {meta && <span className={styles.meta}>{meta}</span>}
                </span>
              </>
            );
            return url ? (
              <a key={d.id} className={styles.doc} href={url} target="_blank" rel="noreferrer">{body}</a>
            ) : (
              <div key={d.id} className={`${styles.doc} ${styles.docOff}`} aria-label={`${d.name}, file not uploaded yet`}>{body}</div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
