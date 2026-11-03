import { useRef, useState } from 'react';
import { Badge } from '../../../components/Badge/Badge';
import { MenuPopover } from '../../../components/MenuPopover/MenuPopover';
import styles from './CisImmunizationsTab.module.css';

const OPTIONS = [
  { value: 2, label: '2 doses', brand: 'Rotarix' },
  { value: 3, label: '3 doses', brand: 'RotaTeq' },
];

/**
 * Small badge + menu for a vaccine's series length (Rotavirus: 2 or 3).
 * Sits inside the vaccine row's toggle button, so it stops its own events
 * from also opening or closing the row.
 *
 * @param {object}   props
 * @param {object}   props.choice    – antigen.seriesChoice: { value, picked, locked }
 * @param {function} props.onChange  – (doses) => void
 */
export function SeriesDosesPicker({ choice, onChange }) {
  const ref = useRef(null);
  const [rect, setRect] = useState(null);
  const toggle = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setRect(rect ? null : ref.current?.getBoundingClientRect() ?? null);
  };
  return (
    <>
      <button
        ref={ref}
        type="button"
        className={styles.seriesPicker}
        aria-haspopup="menu"
        aria-expanded={!!rect}
        aria-label={`Series length: ${choice.value} doses`}
        onClick={toggle}
      >
        <Badge size="sm" label={`${choice.value} doses`} chevron />
      </button>
      {rect && (
        <MenuPopover
          anchorRect={rect}
          anchorRef={ref}
          align="left"
          width={200}
          ariaLabel="Series length"
          items={OPTIONS.map(o => ({
            key: String(o.value),
            label: `${o.label} (${o.brand})`,
            selected: o.value === choice.value,
            disabled: choice.locked && o.value !== 3,
            hint: choice.locked && o.value !== 3 ? 'A RotaTeq dose is recorded, so 3 doses are needed' : undefined,
          }))}
          onSelect={(key) => { setRect(null); if (Number(key) !== choice.value) onChange(Number(key)); }}
          onClose={() => setRect(null)}
        />
      )}
    </>
  );
}
