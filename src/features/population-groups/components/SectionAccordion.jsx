import React from 'react';

/**
 * SectionAccordion: reusable accordion section with gradient header, badge, and chevron.
 *
 * Props:
 *   title        (string): section label
 *   count        (number): badge count
 *   badgeColor   (string): hex or CSS color for the badge background
 *   gradientFrom (string): hex/CSS color for the left side of the header gradient
 *   expanded     (bool): whether the body is visible (only relevant when onToggle provided)
 *   onToggle     (function): if provided, header is clickable and chevron is shown; omit for non-collapsible
 *   children: body content
 */
export default function SectionAccordion({ title, count, badgeColor, gradientFrom, expanded, onToggle, children }) {
  return (
    <div style={{ border: '0.5px solid var(--neutral-150)', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
      {/* Header */}
      <div
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          background: `linear-gradient(to right, ${gradientFrom}, var(--neutral-0))`,
          borderBottom: '0.5px solid var(--neutral-150)',
          cursor: onToggle ? 'pointer' : 'default',
          fontFamily: 'Inter,sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 'var(--font-base)', fontWeight: 500, color: 'var(--neutral-400)' }}>{title}</span>
          <span style={{ background: badgeColor, color: 'var(--neutral-0)', fontSize: 'var(--font-2xs)', fontWeight: 500, borderRadius: 4, padding: '2px 4px', minWidth: 'var(--font-lg)', textAlign: 'center' }}>
            {count}
          </span>
        </div>
        <span style={{ flex: 1 }} />
        {onToggle && (
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            style={{ flexShrink: 0, transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
          >
            <path d="M4 6l4 4 4-4" stroke="var(--neutral-300)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      {/* Body: always shown when no onToggle, otherwise controlled by expanded */}
      {(onToggle ? expanded : true) && children}
    </div>
  );
}
