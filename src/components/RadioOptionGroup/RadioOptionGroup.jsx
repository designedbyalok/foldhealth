import { RadioButton } from '../RadioButton/RadioButton';
import { Tooltip } from '../Tooltip/Tooltip';
import styles from './RadioOptionGroup.module.css';

/**
 * A labelled group of radios, each with an optional hint line beneath it.
 *
 * @param {string}   props.label     Group label, also the radiogroup's name.
 * @param {Array<{value: string, label: string, hint?: React.ReactNode, disabled?: boolean,
 *   disabledReason?: string}>} props.options
 *   `hint` may be text or a node (e.g. a link); `disabledReason` shows on
 *   hover over a disabled option.
 * @param {string}   props.value     Selected option value.
 * @param {function} props.onChange  Called with the picked value.
 * @param {string}   [props.name]    Shared HTML name for the radios.
 * @param {'plain'|'card'} [props.variant='plain'] – 'card' puts each option in
 *   its own bordered card (the whole card picks it; the picked one is tinted).
 * @param {'vertical'|'horizontal'} [props.orientation='vertical'] – 'horizontal' lays
 *   the options out in one row (short labels, no hints).
 * @param {string}   [props.className] Extra class on the root (e.g. to space the options).
 */
export function RadioOptionGroup({ label, options, value, onChange, name, className, variant = 'plain', orientation = 'vertical' }) {
  const card = variant === 'card';
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      {label && <span className={styles.label}>{label}</span>}
      <div className={[styles.group, orientation === 'horizontal' ? styles.groupHorizontal : ''].filter(Boolean).join(' ')} role="radiogroup" aria-label={label}>
        {options.map(o => {
          const checked = value === o.value;
          const radio = (
            <RadioButton
              name={name}
              value={o.value}
              // On a card the label sits beside the circle with the hint under
              // it, so the circle centres on both lines.
              label={card ? undefined : o.label}
              ariaLabel={card ? o.label : undefined}
              checked={checked}
              disabled={!!o.disabled}
              onChange={() => onChange(o.value)}
            />
          );
          const body = (
            <div
              className={[
                styles.option,
                card ? styles.card : '',
                card && checked ? styles.cardChecked : '',
                card && o.disabled ? styles.cardDisabled : '',
              ].filter(Boolean).join(' ')}
              // A card picks its option from anywhere on it (the radio stays the keyboard target).
              onClick={card && !o.disabled ? () => { if (!checked) onChange(o.value); } : undefined}
            >
              {card ? (
                <>
                  {/* A disabled card explains itself on its radio. */}
                  {o.disabled && o.disabledReason
                    ? <Tooltip label={o.disabledReason} maxWidth={260}><span className={styles.disabledWrap}>{radio}</span></Tooltip>
                    : radio}
                  <div className={styles.cardText}>
                    <span className={[styles.cardLabel, checked ? styles.cardLabelChecked : ''].filter(Boolean).join(' ')}>{o.label}</span>
                    {o.hint && <div className={styles.cardHint}>{o.hint}</div>}
                  </div>
                </>
              ) : (
                <>
                  {o.disabled && o.disabledReason
                    ? <Tooltip label={o.disabledReason} maxWidth={260}><span className={styles.disabledWrap}>{radio}</span></Tooltip>
                    : radio}
                  {o.hint && <div className={styles.hint}>{o.hint}</div>}
                </>
              )}
            </div>
          );
          return <div key={o.value} className={styles.optionWrap}>{body}</div>;
        })}
      </div>
    </div>
  );
}
