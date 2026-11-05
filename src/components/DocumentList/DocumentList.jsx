import { useState } from 'react';
import { Icon } from '../Icon/Icon';
import { Badge } from '../Badge/Badge';
import { ActionButton } from '../ActionButton/ActionButton';
import { MenuPopover } from '../MenuPopover/MenuPopover';
import styles from './DocumentList.module.css';

/**
 * DocumentList: the document table from the HCC Diagnosis Gaps drawer's
 * Documents tab: a dashed "Upload Document" CTA, then rows of file icon +
 * name + meta line, an optional status Badge, and a row menu.
 *
 * @param {object}   props
 * @param {Array}    props.documents   – [{ id, name, meta, status?: { variant, label } }]
 * @param {function} [props.onUpload]  – shows the Upload CTA when set
 * @param {function} [props.onOpen]    – (doc) => void, row click
 * @param {Array}    [props.menuItems] – MenuPopover items for each row's menu
 * @param {function} [props.onMenuSelect] – (key, doc) => void
 * @param {boolean}  [props.showStatus=false] – adds the Status column
 * @param {string}   [props.emptyLabel]
 */
export function DocumentList({
  documents = [],
  onUpload,
  uploadLabel = 'Upload Document',
  onOpen,
  menuItems,
  onMenuSelect,
  showStatus = false,
  emptyLabel = 'No documents yet.',
}) {
  const [rowMenu, setRowMenu] = useState(null); // { doc, anchorRect } | null
  const gridClass = showStatus ? styles.gridWithStatus : styles.grid;
  const hasMenu = !!menuItems?.length;

  return (
    <div className={styles.wrap}>
      {onUpload && (
        <button type="button" className={styles.uploadCta} onClick={onUpload}>
          <Icon name="solar:upload-minimalistic-linear" size={16} color="var(--primary-300)" />
          <span>{uploadLabel}</span>
        </button>
      )}
      <div className={styles.table}>
        <div className={[styles.head, gridClass].join(' ')}>
          <span>Document Name</span>
          {showStatus && <span>Status</span>}
          <span />
        </div>
        {documents.length === 0 ? (
          <div className={styles.empty}>{emptyLabel}</div>
        ) : documents.map(d => (
          <div
            key={d.id}
            className={[styles.row, gridClass, onOpen ? styles.rowClickable : ''].join(' ')}
            role={onOpen ? 'button' : undefined}
            tabIndex={onOpen ? 0 : undefined}
            onClick={onOpen ? () => onOpen(d) : undefined}
            onKeyDown={onOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(d); } } : undefined}
          >
            <div className={styles.cell}>
              <span className={styles.thumb}>
                <Icon name="custom:pdf-file" size={20} color="var(--neutral-400)" />
              </span>
              <div className={styles.cellText}>
                <div className={styles.name}>{d.name}</div>
                {d.meta && <div className={styles.meta}>{d.meta}</div>}
              </div>
            </div>
            {showStatus && (d.status ? <Badge size="md" tone={d.status.variant} label={d.status.label} /> : <span />)}
            <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
              {hasMenu && (
                <ActionButton
                  icon="solar:menu-dots-linear"
                  size="sm"
                  tooltip="More actions"
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    setRowMenu(prev => (prev?.doc.id === d.id ? null : { doc: d, anchorRect: r }));
                  }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
      {rowMenu && (
        <MenuPopover
          anchorRect={rowMenu.anchorRect}
          width={168}
          align="right"
          items={menuItems}
          onClose={() => setRowMenu(null)}
          onSelect={(key) => {
            const doc = rowMenu.doc;
            setRowMenu(null);
            onMenuSelect?.(key, doc);
          }}
        />
      )}
    </div>
  );
}
