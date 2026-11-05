import rowStyles from '../WorklistShell/WorklistRow.module.css';
import styles from './ProfileTable.module.css';

/** The worklist row (divider, hover tint). */
export const profileRowClass = rowStyles.row;
/** The worklist cell, with text that wraps instead of widening the table. */
export const profileCellClass = `${rowStyles.td} ${styles.cell}`;
