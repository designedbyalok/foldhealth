import { useCallback, useState, useRef } from 'react';
import { InlineEditable } from './InlineEditable';
import {
  paddingCss,
  EDITABLE_INPUT_BASE_STYLE,
  EDITABLE_DISPLAY_STYLE,
} from './PreviewCanvas.utils';

export function InlineTable({ id, props, style, commitTable }) {
  const cols = props.columns || [];
  const rows = props.rows || [];
  const borderColor = props.borderColor || '#E1E4EA';
  const headerBg = props.headerBg || '#7C5CFA';
  const headerColor = props.headerColor || '#fff';
  const stripedRows = props.stripedRows;
  const stripedColor = props.stripedColor || '#F6F4FF';

  const commitHeader = useCallback((ci, value) => {
    const next = cols.map((c, i) => i === ci ? { ...c, header: value } : c);
    commitTable(id, { columns: next });
  }, [id, cols, commitTable]);

  const commitCell = useCallback((ri, key, value) => {
    const next = rows.map((r, i) => i === ri ? { ...r, [key]: value } : r);
    commitTable(id, { rows: next });
  }, [id, rows, commitTable]);

  return (
    <div style={{ padding: paddingCss(style.padding), overflowX: 'auto', textAlign: style.blockAlign || 'left' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: style.fontSize || 13, fontFamily: 'inherit', minWidth: cols.length > 3 ? cols.length * 120 : undefined }}>
        <thead>
          <tr>
            {cols.map((col, ci) => (
              <th key={ci} style={{ padding: 0, textAlign: 'left', backgroundColor: headerBg, color: headerColor, fontWeight: 600, border: `1px solid ${borderColor}` }}>
                <EditableCell
                  value={col.header}
                  onCommit={v => commitHeader(ci, v)}
                  style={{ color: headerColor, fontWeight: 600 }}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {cols.map((col, ci) => (
                <td key={ci} style={{ padding: 0, border: `1px solid ${borderColor}`, backgroundColor: stripedRows && ri % 2 === 1 ? stripedColor : 'transparent' }}>
                  <EditableCell
                    value={row[col.key] || ''}
                    onCommit={v => commitCell(ri, col.key, v)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditableCell({ value, onCommit, style: extraStyle }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef(null);

  const startEdit = (e) => {
    e.stopPropagation();
    setDraft(value);
    setEditing(true);
    requestAnimationFrame(() => ref.current?.focus());
  };

  const finish = () => {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  };

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={finish}
        onKeyDown={e => { if (e.key === 'Enter') finish(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
        onClick={e => e.stopPropagation()}
        style={{ ...EDITABLE_INPUT_BASE_STYLE, ...extraStyle }}
      />
    );
  }

  return (
    <div
      onDoubleClick={startEdit}
      style={{ ...EDITABLE_DISPLAY_STYLE, ...extraStyle }}
    >
      {value || ' '}
    </div>
  );
}
