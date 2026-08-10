import React from 'react';
import { Icon } from '../../../components/Icon/Icon';

export default function PaginationBar({
  currentPage,
  totalPages,
  safePage,
  onPageChange,
  pageSize,
  onPageSizeChange,
  goToInput,
  onGoToInputChange,
  onGoToPage,
  buildPages,
}) {
  return (
    <div style={{ height:52, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', borderTop:'0.5px solid var(--neutral-150)', background:'var(--neutral-0)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        {/* Prev */}
        <button className="pg-btn" aria-label="Previous page" disabled={safePage===1} onClick={() => onPageChange(p => Math.max(1,p-1))}
          style={{ opacity: safePage===1 ? 0.4 : 1 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M8.5 10.5L5 7l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        {/* Dynamic page buttons */}
        {buildPages().map((pg, idx) => (
          <button key={idx}
            className={`pg-btn${safePage===pg?' active':''}${pg==='...'?' dots':''}`}
            onClick={() => typeof pg==='number' && onPageChange(pg)}>
            {pg}
          </button>
        ))}
        {/* Next */}
        <button className="pg-btn" aria-label="Next page" disabled={safePage===totalPages} onClick={() => onPageChange(p => Math.min(totalPages,p+1))}
          style={{ opacity: safePage===totalPages ? 0.4 : 1 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5.5 3.5L9 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>

        <div style={{ width:1, height:20, background:'var(--neutral-150)', margin:'0 4px' }} />

        {/* Page size selector */}
        <div style={{ position:'relative', display:'inline-flex' }}>
          <select
            aria-label="Rows per page"
            value={pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
            style={{ height:28, padding:'0 24px 0 10px', border:'0.5px solid var(--neutral-150)', borderRadius:4, background:'var(--neutral-0)', fontSize:12, fontWeight:500, color:'var(--neutral-300)', cursor:'pointer', appearance:'none', fontFamily:'Inter, sans-serif', outline:'none' }}>
            {[5,10,20,50].map(n => <option key={n} value={n}>{n} / Page</option>)}
          </select>
          <Icon name="solar:alt-arrow-down-linear" size={11} color="var(--neutral-300)" style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} />
        </div>

        <div style={{ width:1, height:20, background:'var(--neutral-150)', margin:'0 4px' }} />

        {/* Go to page */}
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:12, color:'var(--neutral-300)', whiteSpace:'nowrap' }}>Go to page</span>
          <input
            type="number"
            min={1} max={totalPages}
            value={goToInput}
            onChange={e => onGoToInputChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onGoToPage(); }}
            placeholder={String(safePage)}
            style={{ width:52, height:28, fontSize:13, textAlign:'center', padding:'0 6px', border:'0.5px solid var(--neutral-150)', borderRadius:4, fontFamily:'Inter, sans-serif', color:'var(--neutral-400)', outline:'none', boxSizing:'border-box' }}
          />
        </div>
      </div>
    </div>
  );
}
