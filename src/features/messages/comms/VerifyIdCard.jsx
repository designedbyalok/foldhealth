import { useId, useState } from 'react';
import { Checkbox } from '../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { RadioButton } from '../../../components/RadioButton/RadioButton';
import { Select } from '../../../components/Select/Select';
import { Input } from '../../../components/Input/Input';
import { Button } from '../../../components/Button/Button';
import { Link } from '../../../components/Link/Link';
import { Icon } from '../../../components/Icon/Icon';
import { Collapse } from '../../../components/Collapse/Collapse';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import {
  VERIFICATION_METHODS, INVALID_ATTEMPT_POLICIES, verifySummary, usesTimeLock, usesMaxTotal,
} from './sendTo';
import styles from './VerifyIdCard.module.css';

const num = (v, min = 1) => Math.max(min, Number(v) || min);
const firstName = (name) => String(name || '').trim().split(/\s+/)[0];

/** "Verify first name, phone number (both required) to access link." */
function summaryText(v) {
  const { methods, rule } = verifySummary(v);
  return `Verify ${methods}${rule ? ` (${rule})` : ''} to access link.`;
}

/** The Verify identity settings, as label | field rows. */
function VerifySettings({ value: v, onChange }) {
  const set = (patch) => onChange({ ...v, ...patch });
  // An (i) only where the label needs explaining (how verification and the
  // lock work); obvious settings stay plain.
  const row = (text, control, info) => (
    <div className={styles.row}>
      <span className={styles.rowLabel}>
        {text}
        {info && (
          <Tooltip label={info} maxWidth={260}>
            <Icon name="solar:info-circle-linear" size={12} color="var(--neutral-300)" className={styles.rowInfo} aria-label={info} />
          </Tooltip>
        )}
      </span>
      <div className={styles.rowControl}>{control}</div>
    </div>
  );
  return (
    <div className={styles.rows}>
      {row('Verify using', (
        <Select
          multiple
          checkboxes
          badges
          options={VERIFICATION_METHODS.map(m => ({ value: m.value, label: m.label }))}
          value={v.methods}
          onChange={(next) => set({ methods: next, minimum: Math.min(v.minimum, Math.max(1, next.length)) })}
          placeholder="Select methods"
          errorText={!v.methods.length ? 'Choose at least one method.' : undefined}
        />
      ))}
      {row('No. of methods needed to verify', (
        // 1 up to the number of methods chosen.
        <Input
          type="number"
          min={1}
          max={Math.max(1, v.methods.length)}
          value={String(Math.min(v.minimum, Math.max(1, v.methods.length)))}
          onChange={(e) => set({ minimum: Math.min(num(e.target.value), Math.max(1, v.methods.length)) })}
        />
      ), 'How many of the chosen methods the recipient must get right.')}
      {/* The policy first, then only the settings it uses. */}
      {row('On failed attempts', (
        <Select
          options={INVALID_ATTEMPT_POLICIES.map(p => ({ value: p, label: p }))}
          value={v.action}
          onChange={(action) => set({ action })}
        />
      ), 'What happens once the recipient reaches the failed attempts allowed per session.')}
      {usesTimeLock(v.action) && (<>
        {row('Failed attempts per session', (
          <Input type="number" min={1} value={String(v.attemptsPerWindow)} onChange={(e) => set({ attemptsPerWindow: num(e.target.value) })} />
        ), 'Failed attempts allowed within the session duration before the link locks.')}
        {row('Session duration', (
          <Input type="number" min={1} trailingText="Minutes" value={String(v.windowMinutes)} onChange={(e) => set({ windowMinutes: num(e.target.value) })} />
        ), 'The length of a verification session. Failed attempts are counted within each session.')}
        {row('Lock duration (min)', (
          <Input type="number" min={1} trailingText="Minutes" value={String(v.lockMinutes)} onChange={(e) => set({ lockMinutes: num(e.target.value) })} />
        ))}
      </>)}
      {usesMaxTotal(v.action) && row('Total failed attempts allowed', (
        <Input type="number" min={1} value={String(v.maxTotalAttempts)} onChange={(e) => set({ maxTotalAttempts: num(e.target.value) })} />
      ))}
    </div>
  );
}

/**
 * Discard and Save, under the settings. Edits are a draft until Save: Discard
 * drops them, so nothing half-edited goes out with Send.
 */
function SettingsActions({ draft, onSave, onDiscard }) {
  return (
    <div className={styles.actions}>
      <Button variant="outline" size="sm" onClick={onDiscard}>Discard</Button>
      <Button size="sm" disabled={!draft.methods.length} onClick={onSave}>Save</Button>
    </div>
  );
}

function Blockers({ blockers }) {
  return blockers.map(b => (
    <span key={b.name} className={styles.blocker} role="alert">
      {firstName(b.name)} doesn&rsquo;t have any method for verification{b.available.length ? ` except ${b.available.join(', ')}` : ''}. Edit methods or remove user.
    </span>
  ));
}

function EditLink({ onClick }) {
  return (
    <Link onClick={onClick} className={styles.edit}>
      <Icon name="solar:pen-linear" size={14} />
      Edit
    </Link>
  );
}

/**
 * "Protect links" (Figma 3000:1959). Three states:
 *   off      – a card with just the checkbox
 *   on       – a card summarising what the recipient has to verify, with Edit
 *              (ticking goes straight here with the default settings)
 *   editing  – the settings as a draft, with Discard (drops it) and Save (applies it)
 *
 * Place it right under the field it protects inside a <VerifyIdStack>.
 *
 * @param {object}   props.value     – DEFAULT_ID_VERIFICATION's shape
 * @param {function} props.onChange  – (next) => void
 * @param {{name: string, available: string[]}[]} [props.blockers] – verifyBlockers(); blocks Send
 * @param {string} [props.hint] – under the label while it's off
 */
export function VerifyIdCard({ value: v, onChange, blockers = [], hint }) {
  const [editing, setEditing] = useState(null); // the draft while Edit is open
  const label = 'Protect links';

  const toggle = (c) => {
    onChange({ ...v, on: c === true });
    if (c !== true) setEditing(null);
  };
  const check = <Checkbox checked={v.on} onCheckedChange={toggle} aria-label={label} />;

  // Off is a card too, so the choice stands out before it's made.
  if (!v.on) {
    return (
      <label className={`${styles.card} ${styles.offCard}`}>
        {check}
        {hint ? (
          <span className={styles.summaryLines}>
            <span className={styles.offLabel}>{label}</span>
            <span className={styles.desc}>{hint}</span>
          </span>
        ) : <span className={styles.offLabel}>{label}</span>}
      </label>
    );
  }

  if (editing) {
    return (
      <div className={styles.card}>
        <div className={styles.head}>
          {check}
          <span className={styles.title}>{label}</span>
        </div>
        <VerifySettings value={editing} onChange={setEditing} />
        <SettingsActions draft={editing} onSave={() => { onChange({ ...editing, on: true }); setEditing(null); }} onDiscard={() => setEditing(null)} />
      </div>
    );
  }

  return (
    <div className={`${styles.card} ${styles.summaryCard}`}>
      <div className={styles.summaryMain}>
        {check}
        <div className={styles.summaryText}>
          <div className={styles.summaryLines}>
            <span className={styles.title}>{label}</span>
            <span className={styles.desc}>{summaryText(v)}</span>
          </div>
          <Blockers blockers={blockers} />
        </div>
      </div>
      <EditLink onClick={() => setEditing(v)} />
    </div>
  );
}

/**
 * Verify identity as a Yes / No form field, for drawers laid out as
 * label | field rows (the row supplies the label). With Yes, the summary and
 * Edit sit under it as supporting text; Edit opens the settings below.
 *
 * @param {string} [props.className] – extra class on the root (e.g. `display:
 *   contents`, so its parts can sit on the caller's grid)
 * @param {string} [props.detailsClassName] – extra class on the summary line
 * @param {string} [props.editClassName] – extra class on the Edit link (it's its
 *   own element, so a caller's grid can place it)
 * @param {string} [props.settingsClassName] – extra class on the settings box
 */
export function VerifyIdField({ value: v, onChange, blockers = [], className, detailsClassName, editClassName, settingsClassName }) {
  const [editing, setEditing] = useState(null);
  const name = useId();
  const pick = (on) => {
    onChange({ ...v, on });
    if (!on) setEditing(null);
  };
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <div className={styles.yesNo} role="radiogroup" aria-label="Verify identity">
        <RadioButton name={name} value="yes" label="Yes" checked={v.on} onChange={() => pick(true)} />
        <RadioButton name={name} value="no" label="No" checked={!v.on} onChange={() => pick(false)} />
      </div>
      {v.on && !editing && (
        <div className={[styles.details, detailsClassName].filter(Boolean).join(' ')}>
          <span className={styles.desc}>{summaryText(v)}</span>
          <Blockers blockers={blockers} />
        </div>
      )}
      {v.on && !editing && (
        <span className={[styles.fieldEdit, editClassName].filter(Boolean).join(' ')}>
          <EditLink onClick={() => setEditing(v)} />
        </span>
      )}
      {v.on && editing && (
        <div className={[styles.card, settingsClassName].filter(Boolean).join(' ')}>
          <VerifySettings value={editing} onChange={setEditing} />
          <Blockers blockers={blockers} />
          <SettingsActions draft={editing} onSave={() => { onChange({ ...editing, on: true }); setEditing(null); }} onDiscard={() => setEditing(null)} />
        </div>
      )}
    </div>
  );
}

/** The field Verify identity protects, with the card under it at the drawers' 12px field spacing. */
export function VerifyIdStack({ children }) {
  return <div className={styles.stack}>{children}</div>;
}

/**
 * Shows the card when `show` turns true, easing its height open and fading it
 * in (and back out), instead of popping in. Use as a direct child of a column
 * with a 12px gap: it carries that gap itself, so it takes no space while shut.
 */
export function VerifyIdReveal({ show, children }) {
  return (
    <Collapse open={show} className={[styles.reveal, show ? styles.revealOpen : ''].filter(Boolean).join(' ')}>
      <div className={styles.revealInner}>{children}</div>
    </Collapse>
  );
}
