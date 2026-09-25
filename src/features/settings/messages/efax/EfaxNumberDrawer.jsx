import { useState } from 'react';
import { Drawer } from '../../../../components/Drawer/Drawer';
import { Button } from '../../../../components/Button/Button';
import { Input } from '../../../../components/Input/Input';
import { Select } from '../../../../components/Select/Select';
import { efaxDigits, formatEfaxNumber, isValidEfaxNumber } from './efaxFormat';
import styles from './EfaxSettings.module.css';

/**
 * Add / Edit eFax drawer (Settings > Messages > eFax): name, the fax number,
 * and the system users linked to it (who can send from that number).
 *
 * @param {object}   props
 * @param {object}   [props.efax]      – existing number when editing
 * @param {Array}    props.users       – platformUsers [{ id, name }]
 * @param {Array}    props.existing    – all eFax numbers (duplicate check)
 * @param {function} props.onSave      – ({ name, number, linkedUserIds }) => void
 * @param {function} props.onClose
 */
export function EfaxNumberDrawer({ efax, users = [], existing = [], onSave, onClose }) {
  const [name, setName] = useState(efax?.name || '');
  const [number, setNumber] = useState(efax?.number || '');
  const [linkedUserIds, setLinkedUserIds] = useState(efax?.linkedUserIds || []);
  const [numberTouched, setNumberTouched] = useState(false);

  const duplicate = isValidEfaxNumber(number)
    && existing.some(n => n.id !== efax?.id && efaxDigits(n.number) === efaxDigits(number));
  const numberError = duplicate
    ? 'This eFax number is already added'
    : numberTouched && number && !isValidEfaxNumber(number) ? 'Enter a 10-digit fax number' : undefined;
  const canSave = !!name.trim() && isValidEfaxNumber(number) && !duplicate;

  return (
    <Drawer
      title={efax ? 'Edit eFax' : 'Add eFax'}
      onClose={onClose}
      noCloseDivider
      headerRight={(
        <div className={styles.headerRight}>
          <Button
            variant="primary"
            size="M"
            disabled={!canSave}
            onClick={() => onSave({ name: name.trim(), number: formatEfaxNumber(number), linkedUserIds })}
          >
            {efax ? 'Save' : 'Add'}
          </Button>
          <span className={styles.headerDivider} />
        </div>
      )}
    >
      <div className={styles.form}>
        <Input
          label="Name of eFax"
          required
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Primary Office"
          autoFocus
        />
        <Input
          label="eFax Number"
          required
          type="tel"
          inputMode="numeric"
          leadingIcon="solar:printer-linear"
          value={number}
          onChange={e => setNumber(formatEfaxNumber(e.target.value))}
          onBlur={() => setNumberTouched(true)}
          placeholder="(000) 000-0000"
          errorText={numberError}
        />
        <Select
          label="Linked Users"
          multiple
          searchable
          checkboxes
          badges
          searchPlaceholder="Search users"
          options={users.map(u => ({ value: u.id, label: u.name }))}
          value={linkedUserIds}
          onChange={setLinkedUserIds}
          placeholder="Select users"
          helperText="Linked users can send faxes from this number."
        />
      </div>
    </Drawer>
  );
}
