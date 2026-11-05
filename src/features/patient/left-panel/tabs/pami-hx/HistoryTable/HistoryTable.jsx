import { useState } from 'react';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { ConfirmDialog } from '../../../../../../components/ConfirmDialog/ConfirmDialog';
import { WorklistShell } from '../../../../../../components/WorklistShell/WorklistShell';
import styles from '../AddProblemsDrawer/AddProblemsDrawer.module.css';

/**
 * The table in the PAMI/Hx History drawers (Medical, Surgical, Family): the
 * app's WorklistShell, embedded with no header bar and no outer border.
 *
 * `embeddedNoScroll` keeps the table out of a clipping scroller, so the date
 * pickers and condition dropdowns inside its cells open in full.
 *
 * @param {string}   props.label     – Accessible name for the table
 * @param {object[]} props.columns   – WorklistShell column defs
 * @param {object[]} props.rows
 * @param {function} props.renderRow – (row) => <tr>; use historyRowClass and
 *   historyCellClass for the shared row and cell styles, and HistoryDelete in
 *   the Actions column
 */
export function HistoryTable({ label, columns, rows, renderRow }) {
  return (
    <div className={styles.historyTable} role="region" aria-label={label}>
      <WorklistShell
        embedded
        embeddedNoScroll
        header={null}
        minTableWidth={0}
        columns={columns}
        rows={rows}
        renderRow={renderRow}
      />
    </div>
  );
}

/**
 * The Actions column's delete: always visible, and confirms before removing.
 *
 * @param {string}   props.name     – What is being removed, for the labels
 * @param {string}   [props.description]
 * @param {function} props.onRemove – Async; the dialog stays open until it settles
 */
export function HistoryDelete({ name, description = "This removes it from the patient's record and can't be undone.", onRemove }) {
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const remove = async () => {
    setRemoving(true);
    await onRemove();
    setRemoving(false);
    setConfirming(false);
  };
  return (
    <>
      <ActionButton
        icon="solar:trash-bin-trash-linear"
        size="sm"
        tooltip="Remove"
        aria-label={`Remove ${name}`}
        onClick={() => setConfirming(true)}
      />
      {confirming && (
        <ConfirmDialog
          variant="destructive"
          title={`Remove ${name}?`}
          description={description}
          confirmLabel="Remove"
          loading={removing}
          onConfirm={remove}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
