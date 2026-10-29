import { useState } from 'react';
import { Popover } from '../Popover/Popover';
import { Input } from '../Input/Input';
import { Button } from '../Button/Button';
import styles from './RenamePopover.module.css';

const GAP = 8;
const EDGE = 8;

/**
 * Name something in place, from a pencil beside its title: a labelled
 * field with Cancel and Save, in a panel under the trigger. Enter saves,
 * Escape or a click outside cancels. Saving an empty name is allowed (the
 * caller decides what that means, e.g. "go back to the default").
 *
 * @param {{ current: HTMLElement }} props.anchorRef  – the panel opens under this
 * @param {string}   props.label
 * @param {string}   [props.value]
 * @param {string}   [props.placeholder]
 * @param {number}   [props.maxLength]
 * @param {number}   [props.width=400]
 * @param {(name: string) => void | Promise<void>} props.onSave – trimmed name
 * @param {() => void} props.onClose
 */
export function RenamePopover({ anchorRef, label, value = '', placeholder, maxLength, width = 400, onSave, onClose }) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try { await onSave(draft.replace(/\s+/g, ' ').trim()); onClose(); } finally { setSaving(false); }
  };

  return (
    <Popover
      anchor={anchorRef}
      onOpenChange={() => onClose()}
      offset={GAP}
      width={Math.min(width, window.innerWidth - EDGE * 2)}
      aria-label={label}
      className={styles.panel}
    >
      <Input
        label={label}
        value={draft}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); save(); } }}
      />
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={saving} onClick={save}>Save</Button>
      </div>
    </Popover>
  );
}
