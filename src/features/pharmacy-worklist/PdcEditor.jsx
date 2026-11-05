import { useRef, useState } from 'react';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { Popover } from '../../components/Popover/Popover';
import { useAppStore } from '../../store/useAppStore';
import { PdcValue } from './PharmacyCells';
import { isActiveGap, pdcSourceText } from './pharmacyWorklist.utils';
import styles from './PdcEditor.module.css';

// Set a gap's PDC by hand, or go back to the calculated one. Fold keeps
// calculating underneath, so Use calculated shows today's number.
export function PdcEditPopover({ gap: g, memberId, anchor, onClose }) {
  const setOverride = useAppStore(s => s.setPharmacyPdcOverride);
  const [draft, setDraft] = useState(g.pdc == null ? '' : String(g.pdc));
  const n = Math.round(Number(draft));
  const valid = draft !== '' && Number.isFinite(n) && n >= 0 && n <= 100;
  const save = () => { if (valid) { setOverride(memberId, g.code, n, g.pdc); onClose(); } };
  return (
    <Popover anchor={anchor} onOpenChange={(open) => { if (!open) onClose(); }} placement="bottom-start" width={240} aria-label={`Set ${g.code} PDC`}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <span className={styles.title}>Set {g.code} PDC</span>
        <span className={styles.source}>{pdcSourceText(g)}</span>
        <span className={styles.inputRow}>
          <Input
            type="number" size="sm" min={0} max={100} value={draft} autoFocus
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); }}
            aria-label={`${g.code} PDC, percent`}
          />
          <span className={styles.unit}>%</span>
        </span>
        <span className={styles.actions}>
          {g.pdcSource === 'Manual' && (
            <Button size="sm" variant="ghost" onClick={() => { setOverride(memberId, g.code, null, g.pdc); onClose(); }}>Use calculated</Button>
          )}
          <span className={styles.spacer} />
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!valid} onClick={save}>Save</Button>
        </span>
      </div>
    </Popover>
  );
}

// The worklist's PDC: the value as before, a pencil on hover, and the editor
// on click.
export function EditablePdc({ gap: g, memberId }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  return (
    <span className={styles.cell}>
      <PdcValue pdc={g.pdc} open={isActiveGap(g.status)} source={g.pdcSource} medications={g.medications} />
      <span ref={ref} className={`${styles.pencil} ${open ? styles.pencilOn : ''}`}>
        <ActionButton icon="solar:pen-linear" size="sm" tooltip="Set PDC by hand" onClick={(e) => { e.stopPropagation(); setOpen(true); }} />
      </span>
      {open && <PdcEditPopover gap={g} memberId={memberId} anchor={ref} onClose={() => setOpen(false)} />}
    </span>
  );
}
