import { useState } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { Button } from '../../../../../../../../components/Button/Button';
import { Input } from '../../../../../../../../components/Input/Input';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { Checkbox } from '../../../../../../../../components/Checkbox/Checkbox';
import { toast } from '../../../../../../../../components/Toast/sonnerToast';
import styles from './SendLetterDrawer.module.css';

function Field({ label, required, filled, children }) {
  return (
    <div className={`${styles.field} ${filled ? styles.fieldFilled : ''}`}>
      <span className={styles.fieldLabel}>
        {label}
        {required && <span className={styles.reqDot} aria-hidden="true" />}
      </span>
      {children}
    </div>
  );
}

/**
 * SendLetterDrawer: right-side send form for a program letter (Figma 851:37792).
 * Member/company details come prefilled; the mailing address + options are
 * editable before sending.
 *
 * @param {string}   props.letterName – letter being sent (drives the title)
 * @param {function} props.onClose
 * @param {function} [props.onSent]   – called after a successful send
 */
export function SendLetterDrawer({ letterName = 'Letter', memberName, memberId, onClose, onSent }) {
  const [form, setForm] = useState({
    memberName: memberName || 'Annette Brave',
    memberId: memberId || '23094852345',
    companyId: '236278272828',
    sendDate: '06/27/2025',
    street: '4, Privet Drive, apartment 201',
    zip: '90762',
    city: '',
    state: '',
    healthPlan: '',
    shareEfax: false,
  });

  const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleSend = () => {
    toast.success('Letter sent successfully');
    onSent?.();
    onClose?.();
  };

  const headerRight = (
    <>
      <Button onClick={handleSend}>Send</Button>
      <span className={styles.headerDivider} />
    </>
  );

  return (
    <Drawer
      title={`Send ${letterName}`}
      onClose={onClose}
      headerRight={headerRight}
      bodyClassName={styles.body}
      noCloseDivider
    >
      <div className={styles.form}>
        <Field label="Member Name" required filled>
          <Input value={form.memberName} readOnly aria-label="Member Name" />
        </Field>
        <Field label="Fold ID" required>
          <Input value={form.memberId} onChange={set('memberId')} aria-label="Fold ID" />
        </Field>
        <Field label="Company ID" required filled>
          <Input value={form.companyId} readOnly aria-label="Company ID" />
        </Field>
        <Field label="Letter Send Date" required>
          <div className={styles.dateField}>
            <Input value={form.sendDate} onChange={set('sendDate')} aria-label="Letter Send Date" />
            <Icon name="solar:calendar-minimalistic-linear" size={16} color="var(--neutral-300)" className={styles.dateIcon} />
          </div>
        </Field>
        <Field label="Street Address">
          <Input value={form.street} onChange={set('street')} aria-label="Street Address" />
        </Field>
        <Field label="Zip Code">
          <Input value={form.zip} onChange={set('zip')} aria-label="Zip Code" />
        </Field>
        <Field label="City">
          <Input value={form.city} onChange={set('city')} placeholder="Enter City" aria-label="City" />
        </Field>
        <Field label="State">
          <Input value={form.state} onChange={set('state')} placeholder="Enter State" aria-label="State" />
        </Field>
        <Field label="Health Plan">
          <Input value={form.healthPlan} onChange={set('healthPlan')} placeholder="Enter Health Plan" aria-label="Health Plan" />
        </Field>
        <label className={styles.efaxRow}>
          <Checkbox
            checked={form.shareEfax}
            onCheckedChange={(v) => setForm(prev => ({ ...prev, shareEfax: v === true }))}
          />
          <span className={styles.efaxLabel}>Share {letterName} with PCP via eFax</span>
        </label>
      </div>
    </Drawer>
  );
}
