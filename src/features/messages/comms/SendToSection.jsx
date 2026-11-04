import { Select } from '../../../components/Select/Select';
import { Input } from '../../../components/Input/Input';
import { Switch } from '../../../components/Switch/Switch';
import { Collapse } from '../../../components/Collapse/Collapse';
import { Icon } from '../../../components/Icon/Icon';
import { RECIPIENT_TYPES, VERIFICATION_METHODS, INVALID_ATTEMPT_POLICIES } from './sendTo';
import styles from './SendToSection.module.css';

/**
 * Send To + authentication, shared by the patient send drawers (Compose
 * Email, New SMS, Send Assessment, Send Content). Required single-select of
 * the recipient type (default Patient); under it, the resolved contact with
 * the method(s) the drawer needs, or the first failed check; then the
 * Protect Link switch and, when on, the verification settings.
 *
 * @param {{ type: string, protection: object }} props.value
 * @param {function} props.onChange   – (next value) => void
 * @param {object|null} props.contact – contactFor(value.type, …)
 * @param {'email'|'phone'|'both'|'either'} props.need – contact method(s) to show
 * @param {string|null} props.error   – recipientError(…)
 * @param {React.ReactNode} [props.labelEnd] – beside the Send To label (e.g. Cc / Bcc)
 * @param {React.ReactNode} [props.extra]    – under the contact line (e.g. added contacts)
 */
export function SendToSection({ value, onChange, contact, need, error, labelEnd, extra }) {
  const p = value.protection;
  const setP = (patch) => onChange({ ...value, protection: { ...p, ...patch } });
  const methods = need === 'phone' ? ['phone'] : need === 'email' ? ['email'] : ['email', 'phone'];
  const confirmOptions = Array.from({ length: Math.max(1, p.methods.length) }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));

  return (
    <div className={styles.section}>
      <div className={styles.field}>
        <div className={styles.labelRow}>
          <span className={styles.label}>
            Send To
            <span className={styles.required} aria-hidden="true" />
          </span>
          {labelEnd}
        </div>
        <Select
          options={RECIPIENT_TYPES.map(t => ({ value: t, label: t }))}
          value={value.type}
          onValueChange={(type) => onChange({ ...value, type })}
        />
        {error ? (
          <span className={styles.error} role="alert">
            <Icon name="solar:danger-circle-linear" size={14} color="currentColor" />
            {error}
          </span>
        ) : contact && (
          <span className={styles.contact}>
            <span className={styles.contactName}>
              <Icon name="solar:user-linear" size={14} color="currentColor" />
              {contact.name}
            </span>
            {methods.filter(m => contact[m]).map(m => (
              <span key={m} className={styles.contactMethod}>
                <Icon name={m === 'email' ? 'solar:letter-linear' : 'solar:phone-linear'} size={14} color="currentColor" />
                {contact[m]}
              </span>
            ))}
          </span>
        )}
        {extra}
      </div>

      <Switch checked={p.on} onChange={(on) => setP({ on })} label="Protect Link" />

      <Collapse open={p.on}>
        <div className={styles.protection}>
          <Select
            label="Verification Methods"
            required
            multiple
            checkboxes
            badges
            options={VERIFICATION_METHODS.map(m => ({ value: m.value, label: m.label }))}
            value={p.methods}
            onValueChange={(next) => setP({ methods: next, required: Math.min(p.required, Math.max(1, next.length)) })}
            placeholder="Select methods"
          />
          <div className={styles.grid}>
            <Select
              label="Required Confirmations"
              required
              options={confirmOptions}
              value={String(Math.min(p.required, Math.max(1, p.methods.length)))}
              onValueChange={(v) => setP({ required: Number(v) })}
            />
            <Select
              label="Invalid Attempt Policy"
              options={INVALID_ATTEMPT_POLICIES.map(v => ({ value: v, label: v }))}
              value={p.policy}
              onValueChange={(v) => setP({ policy: v })}
            />
          </div>
          <Input
            label="Maximum Total Invalid Attempts"
            type="number"
            min={1}
            value={String(p.maxAttempts)}
            onChange={(e) => setP({ maxAttempts: Math.max(1, Number(e.target.value) || 1) })}
          />
        </div>
      </Collapse>
    </div>
  );
}
