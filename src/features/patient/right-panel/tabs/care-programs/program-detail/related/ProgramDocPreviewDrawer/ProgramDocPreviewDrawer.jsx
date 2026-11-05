import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { FilePreview } from '../../../../../../../../components/FilePreview/FilePreview';
import styles from './ProgramDocPreviewDrawer.module.css';

/**
 * ProgramDocPreviewDrawer: read-only preview for a Program Documents PDF/
 * DOCX upload. Mirrors LetterPreviewDrawer's shell exactly (right-side
 * Drawer, "Preview <Thing>" + "Name: …" subtitle, full-bleed FilePreview) so
 * document previews look and behave the same everywhere in the app.
 */
export function ProgramDocPreviewDrawer({ doc, onClose }) {
  if (!doc) return null;

  return (
    <Drawer
      title={
        <span className={styles.titleWrap}>
          <span className={styles.titleMain}>Preview Document</span>
          <span className={styles.titleSub}>Name: {doc.name}</span>
        </span>
      }
      onClose={onClose}
      bodyClassName={styles.pdfBody}
    >
      <FilePreview className={styles.pdf} src={doc.fileUrl} file={doc.file} name={doc.name} ext={doc.ext} />
    </Drawer>
  );
}
