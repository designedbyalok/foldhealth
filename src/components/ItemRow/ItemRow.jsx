import { Fragment } from 'react';
import { ActionButton } from '../ActionButton/ActionButton';
import styles from './ItemRow.module.css';

/**
 * ItemRow (Figma 2916:53273 / 1075:5235): a bordered row inside a message:
 * a leading icon or avatar, the label, extra content after it (a tag), and
 * icon actions split by dividers, e.g. a file (View File | Download) or a
 * linked patient (View Profile | Change Patient).
 *
 * @param {React.ReactNode} props.leading
 * @param {React.ReactNode} props.label
 * @param {React.ReactNode} [props.after] – shown right after the label
 * @param {'default'|'muted'|'primary'} [props.tone='default'] – muted greys the label (a
 *   placeholder or linked record); primary tints the row purple (a file)
 * @param {Array<{ key: string, icon: string, tooltip: string, onClick: function }>} [props.actions]
 */
export function ItemRow({ leading, label, after, tone = 'default', actions = [] }) {
  return (
    <div className={[styles.row, tone === 'primary' ? styles.primary : ''].join(' ')}>
      <span className={styles.leading}>{leading}</span>
      <span className={styles.main}>
        <span className={[styles.label, tone === 'muted' ? styles.muted : ''].join(' ')}>{label}</span>
        {after}
      </span>
      {actions.map((a, i) => (
        <Fragment key={a.key}>
          {i > 0 && <span className={styles.divider} aria-hidden="true" />}
          <ActionButton icon={a.icon} size="sm" tooltip={a.tooltip} onClick={a.onClick} />
        </Fragment>
      ))}
    </div>
  );
}
