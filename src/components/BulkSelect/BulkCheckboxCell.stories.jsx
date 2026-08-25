import { useState } from 'react';
import { BulkCheckboxCell } from './BulkCheckboxCell';

export default {
  title: 'Core/BulkCheckboxCell',
  component: BulkCheckboxCell,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The sticky-left checkbox `<td>` a row renders in WorklistShell bulk-select mode. The shell owns the state and injects the matching select column; the row draws this cell from the `ctx.bulk` context the shell hands to renderRow. Renders a table cell, so it is shown here inside a one-row table.',
      },
    },
  },
};

function Demo({ initial = false }) {
  const [sel, setSel] = useState(initial);
  return (
    <table style={{ borderCollapse: 'collapse' }}>
      <tbody>
        <tr>
          <BulkCheckboxCell selected={sel} onToggle={() => setSel((v) => !v)} label="Select row" />
          <td style={{ padding: '8px 12px', fontSize: 'var(--font-base)' }}>Ada Lovelace</td>
        </tr>
      </tbody>
    </table>
  );
}

export const Unselected = { render: () => <Demo initial={false} /> };
export const Selected = { render: () => <Demo initial /> };
