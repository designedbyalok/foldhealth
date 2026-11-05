import React from 'react';
import { TableIcon, RetryIcon } from './icons.jsx';

/**
 * FileChipCard: shows the uploaded file name + size with a Reupload button.
 * Used in the File Processing Summary panel after a CSV has been processed.
 *
 * Props:
 *   uploadFile  (File): the browser File object
 *   onReupload  (function): called when the user clicks "Reupload"
 */
export default function FileChipCard({ uploadFile, onReupload }) {
  if (!uploadFile) return null;
  return (
    <div style={{ background: 'var(--neutral-0)', border: '0.5px solid var(--neutral-150)', borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
      <div style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* File icon */}
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--neutral-50)', border: '0.5px solid var(--neutral-150)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <TableIcon />
        </div>

        {/* File info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--font-base)', fontWeight: 500, color: 'var(--neutral-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {uploadFile.name}
          </div>
          <div style={{ fontSize: 'var(--font-sm)', fontWeight: 400, color: 'var(--neutral-200)' }}>
            {uploadFile.size ? (uploadFile.size / (1024 * 1024)).toFixed(1) + ' MB' : '-'}
          </div>
        </div>

        {/* Reupload button */}
        <button
          onClick={onReupload}
          style={{ height: 28, padding: '0 10px', border: '0.5px solid var(--neutral-150)', borderRadius: 6, background: 'var(--neutral-0)', color: 'var(--neutral-300)', fontSize: 'var(--font-sm)', fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, transition: 'background 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--neutral-50)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--neutral-0)'}
        >
          <RetryIcon />
          Reupload
        </button>
      </div>
    </div>
  );
}
