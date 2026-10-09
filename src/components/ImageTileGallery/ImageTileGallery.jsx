import { useRef, useState } from 'react';
import { Icon } from '../Icon/Icon';
import { CloseIcon } from '../Icon/CloseIcon';
import { CheckboxTick } from '../CheckboxTick/CheckboxTick';
import styles from './ImageTileGallery.module.css';

/**
 * Fold Health ImageTileGallery — pick one image from a grid of tiles, or add
 * a new one (like a video call's background picker). The first tile adds an
 * image (click or drop a file); added images can be removed on hover.
 *
 * Props:
 *  - items       [{ id, src, label, removable? }]  Tiles, in order
 *  - selectedId  (string)                        The picked tile
 *  - onSelect    (fn(id))
 *  - onAdd       (fn(file) => Promise)           Omit to hide the Add tile. The
 *                                                 tile shows progress until it
 *                                                 settles; a rejection's message
 *                                                 is shown under the grid.
 *  - onRemove    (fn(id))                        For tiles marked `removable`
 *  - accept      (string)  File input accept list, e.g. ".png,.jpg,.jpeg,.svg"
 *  - acceptMime  (string[]) MIME types allowed
 *  - maxMb       (number)  Largest file allowed
 *  - columns     (number)  Tiles per row (default 4)
 *  - aspectRatio (string)  Tile shape (default '3 / 4', a portrait page)
 *  - addLabel    (string)  Default 'Add new'
 *  - ariaLabel   (string)  Name of the radio group
 */
export function ImageTileGallery({
  items, selectedId, onSelect, onAdd, onRemove,
  accept, acceptMime, maxMb, columns = 4, aspectRatio = '3 / 4', addLabel = 'Add new', ariaLabel = 'Images',
}) {
  const inputRef = useRef(null);
  const [adding, setAdding] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');

  const add = (file) => {
    if (!file || adding) return;
    if (acceptMime && !acceptMime.includes(file.type)) { setError('That file type can’t be used.'); return; }
    if (maxMb && file.size > maxMb * 1024 * 1024) { setError(`That file is over ${maxMb} MB. Choose a smaller image.`); return; }
    setError('');
    setAdding(true);
    Promise.resolve(onAdd(file))
      .catch((e) => setError(e?.message || 'That image couldn’t be added.'))
      .finally(() => setAdding(false));
  };

  return (
    <div className={styles.root}>
      <div
        className={styles.grid}
        role="radiogroup"
        aria-label={ariaLabel}
        style={{ '--tile-columns': columns, '--tile-ratio': aspectRatio }}
      >
        {onAdd && (
          <button
            type="button"
            className={[styles.tile, styles.addTile, dragOver ? styles.addTileOver : ''].filter(Boolean).join(' ')}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); add(e.dataTransfer.files?.[0]); }}
            disabled={adding}
            aria-busy={adding || undefined}
          >
            {adding
              ? <span className={styles.spinner} aria-hidden="true" />
              : <Icon name="solar:add-circle-linear" size={20} color="var(--primary-300)" />}
            <span className={styles.addLabel}>{adding ? 'Adding…' : addLabel}</span>
          </button>
        )}
        {items.map((it) => {
          const selected = it.id === selectedId;
          return (
            <div key={it.id} className={styles.cell}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={it.label}
                title={it.label}
                className={[styles.tile, selected ? styles.tileOn : ''].filter(Boolean).join(' ')}
                onClick={() => onSelect(it.id)}
              >
                <img className={styles.img} src={it.src} alt="" loading="lazy" draggable={false} />
                {selected && <span className={styles.check}><CheckboxTick checked /></span>}
              </button>
              {it.removable && onRemove && (
                <button type="button" className={styles.remove} aria-label={`Remove ${it.label}`} title="Remove" onClick={() => onRemove(it.id)}>
                  <CloseIcon size={11} color="var(--neutral-300)" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {onAdd && (
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className={styles.hiddenInput}
          aria-label={addLabel}
          tabIndex={-1}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; add(f); }}
        />
      )}
      {error && <span className={styles.error} role="alert">{error}</span>}
    </div>
  );
}
