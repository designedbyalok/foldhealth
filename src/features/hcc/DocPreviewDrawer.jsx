import { Drawer } from '../../components/Drawer/Drawer';
import { Icon } from '../../components/Icon/Icon';
import { FilePreview } from '../../components/FilePreview/FilePreview';
import { DocEvidenceViewer } from './DiagPanel/DocEvidenceViewer';
import styles from './DocPreviewDrawer.module.css';

// Status pill styling, mirroring the ChartPopover chip.
const STATUS_STYLE = {
  Passed:  { color: 'var(--status-success)', bg: 'var(--status-success-light)', border: 'rgba(0, 155, 83, 0.2)',  icon: 'solar:check-read-linear',    label: 'Passed' },
  Failed:  { color: 'var(--status-error)',   bg: 'var(--status-error-light)',   border: 'rgba(215, 40, 37, 0.2)', icon: 'solar:close-circle-linear',  label: 'Failed' },
  Pending: { color: 'var(--neutral-300)',    bg: 'var(--neutral-50)',           border: 'var(--neutral-150)',     icon: 'solar:clock-circle-linear',  label: 'Pending' },
};

/**
 * DocPreviewDrawer: read-only document preview for non-Support roles
 * (Coder / QA / Compliance). A standard right-side Drawer showing the selected
 * chart's PDF with its current review status and no actions. Figma 9799:173025.
 *
 * @param {object}   props
 * @param {object[]} props.charts    – full document list from getChartDocs
 * @param {string}   [props.initialId] – doc to preview (falls back to the first)
 * @param {object}   props.member
 * @param {function} props.onClose
 * @param {boolean}  [props.showStatus=true] – false for a document with no
 *   review status (e.g. a received eFax): no pill in the header
 */
export function DocPreviewDrawer({ charts, initialId, member, onClose, showStatus = true }) {
  const docs = charts || [];
  if (docs.length === 0) return null;
  const doc = docs.find(d => d.id === initialId) || docs[0];
  const st = STATUS_STYLE[doc.status] || STATUS_STYLE.Pending;

  return (
    <Drawer
      title="Document Preview"
      onClose={onClose}
      bodyClassName={styles.pdfBody}
      headerRight={showStatus ? (
        <span className={styles.statusPill} style={{ color: st.color, background: st.bg, borderColor: st.border }}>
          <Icon name={st.icon} size={12} color={st.color} />
          {st.label}
        </span>
      ) : undefined}
    >
      {(doc.pdf || doc.file) ? (
        <FilePreview className={styles.pdf} src={doc.pdf} file={doc.file} name={doc.n} ext={doc.ext} />
      ) : (
        <DocEvidenceViewer member={member} />
      )}
    </Drawer>
  );
}
