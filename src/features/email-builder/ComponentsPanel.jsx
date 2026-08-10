import { useState, useRef, useEffect, useCallback } from 'react';
import { useDraggable, DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '../../components/Icon/Icon';
import { useAppStore } from '../../store/useAppStore';
import { HEADER_PRESETS, FOOTER_PRESETS } from './headerFooterLibrary';
import { buildParentMap, computeDropPosition } from './blockHelpers';
import styles from './EmailBuilder.module.css';

const COMPONENTS = [
  // Row 1: text-flow basics
  { type: 'Heading',   label: 'Heading',  icon: null, customIcon: 'heading' },
  { type: 'Text',      label: 'Text',     icon: 'solar:text-square-linear' },
  { type: 'Image',     label: 'Image',    icon: 'solar:gallery-linear' },
  { type: 'Button',    label: 'Button',   icon: 'solar:bolt-circle-linear' },
  // Row 2: minor decorations
  { type: 'Social',    label: 'Social',   icon: 'solar:share-circle-linear' },
  { type: 'Divider',   label: 'Divider',  icon: 'solar:minus-square-linear' },
  { type: 'Spacer',    label: 'Spacer',   icon: 'solar:paragraph-spacing-linear' },
  // Row 3: structural
  { type: 'Hero',      label: 'Hero',     icon: 'solar:laptop-minimalistic-linear' },
  { type: 'Container', label: 'Wrapper',  icon: null, customIcon: 'group' },
  { type: 'Accordion', label: 'Accordion', icon: 'solar:list-arrow-down-linear', soon: true },
  // Row 4
  { type: 'NavBar',    label: 'Nav Bar',  icon: 'solar:hamburger-menu-linear' },
  { type: 'Column',    label: 'Column',   icon: null, customIcon: true },
  // Row 5
  { type: 'Section',   label: 'Section',  icon: 'solar:align-vertical-spacing-linear' },
  { type: 'Form',      label: 'Form',     icon: 'solar:document-add-linear', soon: true },
  { type: 'Table',     label: 'Table',    icon: null, customIcon: 'table' },
  { type: 'RawHtml',   label: 'HTML',     icon: 'solar:code-square-linear' },
  // Row 6 — Header & Footer use a preset picker rather than a single block
  { type: 'Header',    label: 'Header',   icon: null, customIcon: 'header', preset: 'header' },
  { type: 'Footer',    label: 'Footer',   icon: null, customIcon: 'footer', preset: 'footer' },
];

// Pre-configured ColumnsContainer templates so the user can drop a layout
// scaffold without manually setting columnsCount/fixedWidths.
const LAYOUTS = [
  { type: 'Layout-2-equal', label: '2 equal',         glyph: [1, 1] },
  { type: 'Layout-1-2',     label: '1 / 2',           glyph: [1, 2] },
  { type: 'Layout-2-1',     label: '2 / 1',           glyph: [2, 1] },
  { type: 'Layout-3-equal', label: '3 equal',         glyph: [1, 1, 1] },
  { type: 'Layout-1-1-2',   label: '1 / 1 / 2',       glyph: [1, 1, 2] },
];

const TYPE_LABELS = {
  EmailLayout: 'Email',
  Heading: 'Heading',
  Text: 'Text',
  Button: 'Button',
  Image: 'Image',
  Avatar: 'Avatar',
  Divider: 'Divider',
  Spacer: 'Spacer',
  Container: 'Wrapper',
  ColumnsContainer: 'Columns',
  Social: 'Social',
  NavBar: 'Nav Bar',
  Table: 'Table',
  RawHtml: 'HTML',
};

const TYPE_ICONS = {
  EmailLayout: 'solar:letter-linear',
  Heading: 'solar:document-text-linear',
  Text: 'solar:text-square-linear',
  Button: 'solar:bolt-circle-linear',
  Image: 'solar:gallery-linear',
  Avatar: 'solar:user-circle-linear',
  Divider: 'solar:minus-square-linear',
  Spacer: 'solar:paragraph-spacing-linear',
  Container: 'solar:layers-linear',
  ColumnsContainer: 'solar:hamburger-menu-linear',
  Social: 'solar:share-circle-linear',
  NavBar: 'solar:hamburger-menu-linear',
  Table: 'solar:widget-2-linear',
  RawHtml: 'solar:code-square-linear',
};

function ColumnIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2.74L11.96 1.99L12 2.74ZM12 29.26L11.96 30.01L12 29.26ZM20 2.74L20.04 1.99L20 2.74ZM20 29.26L20.04 30.01L20 29.26ZM2.67 16H1.92C1.92 19.12 1.92 21.54 2.17 23.42C2.42 25.315 2.95 26.77 4.09 27.91L4.62 27.382L5.15 26.85C4.34 26.04 3.89 24.95 3.65 23.22C3.42 21.46 3.42 19.17 3.42 16H2.67ZM29.33 16H28.58C28.58 19.17 28.58 21.46 28.35 23.22C28.113 24.95 27.66 26.04 26.85 26.85L27.38 27.382L27.911 27.91C29.05 26.77 29.58 25.315 29.83 23.42C30.08 21.54 30.08 19.12 30.08 16H29.33ZM29.33 16H30.08C30.08 12.88 30.08 10.46 29.83 8.59C29.58 6.69 29.05 5.23 27.911 4.09L27.38 4.62L26.85 5.15C27.66 5.96 28.113 7.05 28.35 8.79C28.58 10.54 28.58 12.84 28.58 16H29.33ZM2.67 16H3.42C3.42 12.84 3.42 10.54 3.65 8.79C3.89 7.05 4.34 5.96 5.15 5.15L4.62 4.62L4.09 4.09C2.95 5.23 2.42 6.69 2.17 8.59C1.92 10.46 1.92 12.88 1.92 16H2.67ZM16 2.67V1.92C13.891 1.92 13.46 1.92 11.96 1.99L12 2.74L12.04 3.49C13.49 3.418 13.9 3.42 16 3.42V2.67ZM12 2.74L11.96 1.99C10.48 2.07 8.92 2.21 7.54 2.52C6.19 2.81 4.9 3.28 4.09 4.09L4.62 4.62L5.15 5.15C5.64 4.66 6.57 4.26 7.86 3.98C9.12 3.71 10.59 3.56 12.04 3.49L12 2.74ZM16 29.33V28.58C13.9 28.58 13.49 28.58 12.04 28.51L12 29.26L11.96 30.01C13.46 30.08 13.891 30.08 16 30.08V29.33ZM12 29.26L12.04 28.51C10.59 28.44 9.12 28.3 7.86 28.02C6.57 27.74 5.64 27.34 5.15 26.85L4.62 27.382L4.09 27.91C4.9 28.721 6.19 29.19 7.54 29.49C8.92 29.79 10.48 29.94 11.96 30.01L12 29.26ZM12 2.74H11.25V29.26H12H12.75V2.74H12ZM16 2.67V3.42C18.1 3.42 18.51 3.418 19.96 3.49L20 2.74L20.04 1.99C18.54 1.92 18.11 1.92 16 1.92V2.67ZM20 2.74L19.96 3.49C21.41 3.56 22.88 3.71 24.14 3.98C25.43 4.26 26.36 4.66 26.85 5.15L27.38 4.62L27.911 4.09C27.1 3.28 25.81 2.81 24.461 2.52C23.08 2.21 21.517 2.07 20.04 1.99L20 2.74ZM16 29.33V30.08C18.11 30.08 18.54 30.08 20.04 30.01L20 29.26L19.96 28.51C18.51 28.58 18.1 28.58 16 28.58V29.33ZM20 29.26L20.04 30.01C21.517 29.94 23.08 29.79 24.461 29.49C25.81 29.19 27.1 28.721 27.911 27.91L27.38 27.382L26.85 26.85C26.36 27.34 25.43 27.74 24.14 28.02C22.88 28.3 21.41 28.44 19.96 28.51L20 29.26ZM20 2.74L19.25 2.74L19.25 29.26H20H20.75L20.75 2.74L20 2.74Z" fill={color} />
    </svg>
  );
}

function TableIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.33 10.742H28.67M2.67 19.89H29.33M16 11.22V29.33M13.33 29.33C13.106 29.33 12.88 29.33 12.67 29.33C10.4 29.33 8.68 29.31 7.33 29.09C5.96 28.87 4.98 28.437 4.23 27.599C2.67 25.86 2.67 23.07 2.67 17.48V14.52C2.67 8.93 2.67 6.14 4.23 4.4C5.79 2.67 8.3 2.67 13.33 2.67H18.67C23.69 2.67 26.21 2.67 27.77 4.4C29.33 6.14 29.33 8.93 29.33 14.52V17.48C29.33 23.07 29.33 25.86 27.77 27.599C26.793 28.69 25.44 29.09 23.33 29.244C22.07 29.33 20.55 29.33 18.67 29.33H13.33Z" stroke={color} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GroupIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 12C2 7.29 2 4.93 3.46 3.46C4.93 2 7.29 2 12 2C16.714 2 19.07 2 20.54 3.46C22 4.93 22 7.29 22 12C22 16.714 22 19.07 20.54 20.54C19.07 22 16.714 22 12 22C7.29 22 4.93 22 3.46 20.54C2 19.07 2 16.714 2 12Z" stroke={color} strokeLinecap="round" strokeDasharray="2 2" />
    </svg>
  );
}

function HeaderIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.83 3.13L21.18 2.77L20.83 3.13ZM3.17 3.13L2.82 2.77L3.17 3.13ZM2.01 8L1.51 7.99L2.01 8ZM4.5 4.5C4.22 4.5 4 4.72 4 5C4 5.28 4.22 5.5 4.5 5.5V5V4.5ZM7.5 5.5C7.78 5.5 8 5.28 8 5C8 4.72 7.78 4.5 7.5 4.5V5V5.5ZM10 4.5C9.72 4.5 9.5 4.72 9.5 5C9.5 5.28 9.72 5.5 10 5.5V5V4.5ZM14 5.5C14.28 5.5 14.5 5.28 14.5 5C14.5 4.72 14.28 4.5 14 4.5V5V5.5ZM16.5 4.5C16.22 4.5 16 4.72 16 5C16 5.28 16.22 5.5 16.5 5.5V5V4.5ZM19.5 5.5C19.78 5.5 20 5.28 20 5C20 4.72 19.78 4.5 19.5 4.5V5V5.5ZM10 2V2.5H14V2V1.5H10V2ZM22 9.74H21.5V13.79H22H22.5V9.74H22ZM14 22V21.5H10V22V22.5H14V22ZM2 13.79H2.5V9.74H2H1.5V13.79H2ZM10 22V21.5C8.1 21.5 6.73 21.5 5.68 21.35C4.65 21.21 4.01 20.94 3.53 20.45L3.17 20.8L2.81 21.15C3.51 21.86 4.4 22.19 5.54 22.35C6.67 22.5 8.13 22.5 10 22.5V22ZM2 13.79H1.5C1.5 15.715 1.5 17.2 1.65 18.36C1.8 19.53 2.12 20.44 2.81 21.15L3.17 20.8L3.53 20.45C3.05 19.96 2.78 19.3 2.64 18.23C2.5 17.15 2.5 15.74 2.5 13.79H2ZM22 13.79H21.5C21.5 15.74 21.499 17.15 21.36 18.23C21.22 19.3 20.95 19.96 20.47 20.45L20.83 20.8L21.19 21.15C21.88 20.44 22.2 19.53 22.35 18.36C22.501 17.2 22.5 15.715 22.5 13.79H22ZM14 22V22.5C15.87 22.5 17.326 22.5 18.46 22.35C19.6 22.19 20.49 21.86 21.19 21.15L20.83 20.8L20.47 20.45C19.99 20.94 19.35 21.21 18.32 21.35C17.27 21.5 15.9 21.5 14 21.5V22ZM14 2V2.5C15.9 2.5 17.28 2.501 18.32 2.64C19.36 2.77 20 3.03 20.48 3.49L20.83 3.13L21.18 2.77C20.48 2.1 19.6 1.79 18.45 1.65C17.32 1.499 15.87 1.5 14 1.5V2ZM10 2V1.5C8.13 1.5 6.68 1.499 5.55 1.65C4.4 1.79 3.52 2.1 2.82 2.77L3.17 3.13L3.52 3.49C4 3.03 4.64 2.77 5.68 2.64C6.72 2.501 8.1 2.5 10 2.5V2ZM2 9.74H2.5C2.5 9.11 2.5 8.53 2.51 8.01L2.01 8L1.51 7.99C1.5 8.53 1.5 9.11 1.5 9.74H2ZM2.01 8L2.51 8.01C2.54 5.44 2.72 4.26 3.52 3.49L3.17 3.13L2.82 2.77C1.68 3.88 1.53 5.52 1.51 7.99L2.01 8ZM22 9.74H22.5C22.5 9.11 22.5 8.53 22.49 7.99L21.99 8L21.49 8.01C21.5 8.53 21.5 9.11 21.5 9.74H22ZM21.99 8L22.49 7.99C22.47 5.52 22.32 3.88 21.18 2.77L20.83 3.13L20.48 3.49C21.28 4.26 21.46 5.44 21.49 8.01L21.99 8ZM2.01 8V8.5H21.99V8V7.5H2.01V8ZM4.5 5V5.5H7.5V5V4.5H4.5V5ZM10 5V5.5H14V5V4.5H10V5ZM16.5 5V5.5H19.5V5V4.5H16.5V5Z" fill={color} />
    </svg>
  );
}

function FooterIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.17 20.8L2.81 21.15L3.17 20.8ZM20.83 20.8L21.19 21.15L20.83 20.8ZM4.5 18C4.22 18 4 18.22 4 18.5C4 18.78 4.22 19 4.5 19V18.5V18ZM7.5 19C7.78 19 8 18.78 8 18.5C8 18.22 7.78 18 7.5 18V18.5V19ZM10 18C9.72 18 9.5 18.22 9.5 18.5C9.5 18.78 9.72 19 10 19V18.5V18ZM14 19C14.28 19 14.5 18.78 14.5 18.5C14.5 18.22 14.28 18 14 18V18.5V19ZM16.5 18C16.22 18 16 18.22 16 18.5C16 18.78 16.22 19 16.5 19V18.5V18ZM19.5 19C19.78 19 20 18.78 20 18.5C20 18.22 19.78 18 19.5 18V18.5V19ZM2 15.5L1.5 15.5L2 15.5ZM10 2V2.5H14V2V1.5H10V2ZM22 9.74H21.5V13.79H22H22.5V9.74H22ZM14 22V21.5H10V22V22.5H14V22ZM2 13.79H2.5V9.74H2H1.5V13.79H2ZM10 22V21.5C8.1 21.5 6.73 21.5 5.68 21.35C4.65 21.21 4.01 20.94 3.53 20.45L3.17 20.8L2.81 21.15C3.51 21.86 4.4 22.19 5.54 22.35C6.67 22.5 8.13 22.5 10 22.5V22ZM14 22V22.5C15.87 22.5 17.326 22.5 18.46 22.35C19.6 22.19 20.49 21.86 21.19 21.15L20.83 20.8L20.47 20.45C19.99 20.94 19.35 21.21 18.32 21.35C17.27 21.5 15.9 21.5 14 21.5V22ZM14 2V2.5C15.9 2.5 17.28 2.501 18.32 2.64C19.36 2.77 20 3.03 20.48 3.49L20.83 3.13L21.18 2.77C20.48 2.1 19.6 1.79 18.45 1.65C17.32 1.499 15.87 1.5 14 1.5V2ZM22 9.74H22.5C22.5 7.93 22.5 6.52 22.35 5.43C22.19 4.31 21.87 3.45 21.18 2.77L20.83 3.13L20.48 3.49C20.96 3.95 21.22 4.57 21.36 5.56C21.5 6.58 21.5 7.9 21.5 9.74H22ZM10 2V1.5C8.13 1.5 6.68 1.499 5.55 1.65C4.4 1.79 3.52 2.1 2.82 2.77L3.17 3.13L3.52 3.49C4 3.03 4.64 2.77 5.68 2.64C6.72 2.501 8.1 2.5 10 2.5V2ZM2 9.74H2.5C2.5 7.9 2.5 6.58 2.64 5.56C2.78 4.57 3.04 3.95 3.52 3.49L3.17 3.13L2.82 2.77C2.13 3.45 1.81 4.31 1.65 5.43C1.5 6.52 1.5 7.93 1.5 9.74H2ZM4.5 18.5V19H7.5V18.5V18H4.5V18.5ZM10 18.5V19H14V18.5V18H10V18.5ZM16.5 18.5V19H19.5V18.5V18H16.5V18.5ZM2 13.79H1.5C1.5 14.41 1.5 14.98 1.5 15.5L2 15.5L2.5 15.5C2.5 14.98 2.5 14.41 2.5 13.79H2ZM2 15.5L1.5 15.5C1.52 16.88 1.56 18 1.74 18.9C1.91 19.82 2.23 20.55 2.81 21.15L3.17 20.8L3.53 20.45C3.13 20.03 2.87 19.5 2.72 18.71C2.56 17.91 2.52 16.88 2.5 15.5L2 15.5ZM22 13.79H21.5C21.5 14.41 21.5 14.98 21.5 15.5L22 15.5L22.5 15.5C22.5 14.98 22.5 14.41 22.5 13.79H22ZM22 15.5L21.5 15.5C21.48 16.88 21.44 17.91 21.281 18.71C21.13 19.5 20.87 20.03 20.47 20.45L20.83 20.8L21.19 21.15C21.77 20.55 22.09 19.82 22.26 18.9C22.44 18 22.48 16.88 22.5 15.5L22 15.5ZM2 15.5V16H22V15.5V15H2V15.5Z" fill={color} />
    </svg>
  );
}

// Custom Heading "H" glyph — two vertical strokes joined by a horizontal bar
// with serifs at top and bottom of each stroke. Matches the icon supplied
// by design. Used in both the Components panel tile and the Layers panel.
function HeadingIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M7 12H17M7 5V19M17 5V19M15 19H19M15 5H19M5 19H9M5 5H9"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ComponentsPanel() {
  const [tab, setTab] = useState('components');
  const [renamingId, setRenamingId] = useState(null);
  const [panelWidth, setPanelWidth] = useState(240);
  const [isResizing, setIsResizing] = useState(false);
  const addBlock = useAppStore(s => s.addBlock);
  const showToast = useAppStore(s => s.showToast);
  const emailDocument = useAppStore(s => s.emailDocument);
  const editingCampaignName = useAppStore(s => s.editingCampaignName);
  const selectedBlockId = useAppStore(s => s.selectedBlockId);
  const selectedColumnIdx = useAppStore(s => s.selectedColumnIdx);
  const setSelectedBlockId = useAppStore(s => s.setSelectedBlockId);
  const selectColumn = useAppStore(s => s.selectColumn);
  const removeBlock = useAppStore(s => s.removeBlock);
  const replaceHeaderFooter = useAppStore(s => s.replaceHeaderFooter);
  const panelRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      setTab('layers');
      setRenamingId(e.detail.id);
    };
    window.addEventListener('eb:rename', handler);
    return () => window.removeEventListener('eb:rename', handler);
  }, []);

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startW = panelRef.current?.offsetWidth || panelWidth;
    const onMove = (ev) => {
      const newW = Math.max(240, Math.min(480, startW + ev.clientX - startX));
      setPanelWidth(newW);
    };
    const onUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [panelWidth]);

  // Clicking a Header / Footer tile in the components panel adds a default
  // preset directly — the picker for browsing/changing presets now lives
  // only in the right-panel Template tab (which is what surfaces when the
  // user actually wants to swap an existing header/footer).
  const handleAdd = (item) => {
    if (item.soon) { showToast(`${item.label} — coming soon`); return; }
    if (item.preset === 'header' || item.preset === 'footer') {
      const role = item.preset;
      const list = role === 'header' ? HEADER_PRESETS : FOOTER_PRESETS;
      if (!list.length) return;
      let counter = Date.now();
      const genId = () => `block-${counter++}-${Math.random().toString(36).slice(2, 5)}`;
      const tree = list[0].build(genId, editingCampaignName || 'Welcome');
      replaceHeaderFooter(role, tree);
      return;
    }
    addBlock(item.type);
  };

  return (
    <div ref={panelRef} className={styles.leftPanel} style={{ width: panelWidth }}>
      <div className={styles.tabs}>
        <button
          className={[styles.tab, tab === 'components' ? styles.tabActive : ''].join(' ')}
          onClick={() => setTab('components')}
        >Components</button>
        <button
          className={[styles.tab, tab === 'layers' ? styles.tabActive : ''].join(' ')}
          onClick={() => setTab('layers')}
        >Layers</button>
      </div>

      <div className={styles.panelScrollFlush}>
        {tab === 'components' ? (
          <>
            <p className={styles.sectionHeading}>Content</p>
            <div className={styles.componentGrid}>
              {COMPONENTS.map(c => (
                <DraggableTile key={c.type} item={c} onClick={() => handleAdd(c)} />
              ))}
            </div>

            <p className={styles.sectionHeading}>Layout</p>
            <div className={styles.layoutGrid}>
              {LAYOUTS.map(l => (
                <DraggableLayoutTile key={l.type} layout={l} onClick={() => addBlock(l.type)} />
              ))}
            </div>
          </>
        ) : (
          <LayerList
            doc={emailDocument}
            selectedId={selectedBlockId}
            selectedColumnIdx={selectedColumnIdx}
            onSelect={setSelectedBlockId}
            selectColumn={selectColumn}
            onRemove={removeBlock}
            renamingId={renamingId}
            setRenamingId={setRenamingId}
          />
        )}
      </div>
      <div
        className={[styles.resizeHandle, isResizing ? styles.resizeHandleActive : ''].join(' ')}
        onMouseDown={handleResizeStart}
      />
    </div>
  );
}

function DraggableTile({ item, onClick }) {
  // Soon items can't be added or dragged.
  const draggable = useDraggable({
    id: `__new:${item.type}`,
    disabled: !!item.soon || !!item.preset,
  });
  const { attributes, listeners, setNodeRef, isDragging } = draggable;
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={[styles.componentTile, isDragging ? styles.componentTileDragging : ''].join(' ')}
      onClick={onClick}
      title={item.soon ? `${item.label} — coming soon` : `Add ${item.label}`}
    >
      {item.customIcon === true && <ColumnIcon size={20} color="var(--neutral-300)" />}
      {item.customIcon === 'table' && <TableIcon size={20} color="var(--neutral-300)" />}
      {item.customIcon === 'group' && <GroupIcon size={20} color="var(--neutral-300)" />}
      {item.customIcon === 'header' && <HeaderIcon size={20} color="var(--neutral-300)" />}
      {item.customIcon === 'footer' && <FooterIcon size={20} color="var(--neutral-300)" />}
      {item.customIcon === 'heading' && <HeadingIcon size={20} color="var(--neutral-300)" />}
      {!item.customIcon && <Icon name={item.icon} size={20} color="var(--neutral-300)" />}
      {item.label}
    </button>
  );
}

function DraggableLayoutTile({ layout, onClick }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `__new:${layout.type}`,
  });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={[styles.layoutTile, isDragging ? styles.componentTileDragging : ''].join(' ')}
      onClick={onClick}
      title={`Add ${layout.label} layout`}
    >
      <div className={styles.layoutGlyph}>
        {layout.glyph.map((flex, i) => (
          <div key={i} className={styles.layoutGlyphCol} style={{ flex }} />
        ))}
      </div>
    </button>
  );
}

function layerLabel(block) {
  if (block.data?.alias) return block.data.alias;
  const role = block.data?.role;
  if (role === 'header') return 'Header';
  if (role === 'body') return 'Body';
  if (role === 'footer') return 'Footer';
  if (block.type === 'Heading') {
    // Surface the heading level (H1 / H2 / H3) so users can spot at a
    // glance which heading they're looking at without selecting it.
    const level = (block.data?.props?.level || 'h2').toUpperCase();
    const text = (block.data?.props?.text || '').slice(0, 22);
    return `${level}: ${text}`;
  }
  if (block.type === 'Text') {
    return `${TYPE_LABELS[block.type]}: ${(block.data?.props?.text || '').slice(0, 22)}`;
  }
  return TYPE_LABELS[block.type] || block.type;
}

// Render the right icon for a block in the Layers panel. Roles (header /
// body / footer) and custom-glyph types (Container, ColumnsContainer, Table)
// use the same hand-drawn SVGs the Components panel tiles use, so a block's
// layer-row icon matches the tile you'd drag in from the left.
function LayerIcon({ block, size = 14, color = 'currentColor' }) {
  const role = block.data?.role;
  if (role === 'header') return <HeaderIcon size={size} color={color} />;
  if (role === 'footer') return <FooterIcon size={size} color={color} />;
  if (role === 'body')   return <Icon name="solar:document-text-linear" size={size} color={color} />;
  switch (block.type) {
    case 'Heading':          return <HeadingIcon size={size} color={color} />;
    case 'Container':        return <GroupIcon size={size} color={color} />;
    case 'ColumnsContainer': return <ColumnIcon size={size} color={color} />;
    case 'Table':            return <TableIcon size={size} color={color} />;
    default: {
      const name = TYPE_ICONS[block.type] || 'solar:square-linear';
      return <Icon name={name} size={size} color={color} />;
    }
  }
}

const STRUCTURAL_ROLES = new Set(['header', 'body', 'footer']);

function LayerList({ doc, selectedId, selectedColumnIdx, onSelect, selectColumn, onRemove, renamingId, setRenamingId }) {
  const moveBlock = useAppStore(s => s.moveBlock);
  const updateBlock = useAppStore(s => s.updateBlock);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [layerDropIndicator, setLayerDropIndicator] = useState(null);
  const handleDragOver = useCallback((event) => {
    setLayerDropIndicator(computeDropPosition(event, doc, String(event.active.id)));
  }, [doc]);

  if (!doc) return null;

  const allSortableIds = [];
  const collectIds = (childrenIds) => {
    (childrenIds || []).forEach(id => {
      const block = doc[id];
      if (!block) return;
      allSortableIds.push(id);
      const props = block.data?.props || {};
      if (Array.isArray(props.childrenIds)) collectIds(props.childrenIds);
      if (Array.isArray(props.columns)) props.columns.forEach(c => collectIds(c.childrenIds || []));
    });
  };
  collectIds(doc.root.data.childrenIds || []);

  const handleDragEnd = (event) => {
    const target = layerDropIndicator;
    setLayerDropIndicator(null);
    if (!target) return;
    const activeId = String(event.active.id);
    if (activeId === String(event.over?.id)) return;
    moveBlock(activeId, target);
  };

  const ctx = { doc, selectedId, selectedColumnIdx, onSelect, selectColumn, onRemove, renamingId, setRenamingId, updateBlock, layerDropIndicator };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onDragCancel={() => setLayerDropIndicator(null)}>
      <SortableContext items={allSortableIds} strategy={verticalListSortingStrategy}>
        <div className={styles.layerList}>
          <LayerChildren childrenIds={doc.root.data.childrenIds || []} depth={0} parentId="root" ctx={ctx} />
        </div>
      </SortableContext>
    </DndContext>
  );
}

function LayerDropLine({ depth }) {
  return <div className={styles.layerDropLine} style={{ marginLeft: depth * 16 + 8 }} />;
}

function LayerChildren({ childrenIds, depth, parentId, ctx }) {
  const ind = ctx.layerDropIndicator;
  const showHere = ind && ind.parentId === parentId && (ind.columnIdx ?? undefined) === undefined && !ind.isNest;
  return (
    <>
      {showHere && ind.index === 0 && <LayerDropLine depth={depth} />}
      {(childrenIds || []).map((id, idx) => {
        const block = ctx.doc[id];
        if (!block) return null;
        return (
          <div key={id}>
            <LayerRow id={id} block={block} depth={depth} ctx={ctx} />
            {showHere && ind.index === idx + 1 && <LayerDropLine depth={depth} />}
          </div>
        );
      })}
    </>
  );
}

function ColumnGroup({ parentId, columnIdx, childrenIds, depth, ctx }) {
  const [expanded, setExpanded] = useState(true);
  const label = `Column ${columnIdx + 1}`;
  const isSelected = ctx.selectedId === parentId && ctx.selectedColumnIdx === columnIdx;
  return (
    <>
      <div className={[styles.layerRow, isSelected ? styles.layerRowActive : ''].join(' ')} onClick={() => ctx.selectColumn(parentId, columnIdx)}>
        <span style={{ width: depth * 16, flexShrink: 0 }} />
        <button
          className={styles.layerExpandBtn}
          onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <Icon name={expanded ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-right-linear'} size={12} color="currentColor" />
        </button>
        <Icon name="solar:folder-open-linear" size={14} color="currentColor" />
        <span className={styles.layerRowText}>{label}</span>
      </div>
      {expanded && (
        <LayerChildren childrenIds={childrenIds} depth={depth + 1} parentId={parentId} ctx={ctx} />
      )}
    </>
  );
}

function LayerRow({ id, block, depth, ctx }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [expanded, setExpanded] = useState(true);
  const renameInputRef = useRef(null);
  const isRenaming = ctx.renamingId === id;
  const props = block.data?.props || {};
  const hasChildren = Array.isArray(props.childrenIds) && props.childrenIds.length > 0;
  const hasColumns = block.type === 'ColumnsContainer' && Array.isArray(props.columns) && (props.columnsCount || props.columns.length) > 0;
  const isExpandable = hasChildren || hasColumns;
  const isStructural = STRUCTURAL_ROLES.has(block.data?.role);

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const commitRename = (value) => {
    const trimmed = value.trim();
    ctx.updateBlock(id, prev => ({
      ...prev,
      data: { ...prev.data, alias: trimmed || undefined },
    }));
    ctx.setRenamingId(null);
  };

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={[styles.layerRow, ctx.selectedId === id ? styles.layerRowActive : '', ctx.layerDropIndicator?.isNest && ctx.layerDropIndicator?.parentId === id ? styles.layerRowNestTarget : ''].join(' ')}
        onClick={() => ctx.onSelect(id)}
        onDoubleClick={() => ctx.setRenamingId(id)}
      >
        <span style={{ width: depth * 16, flexShrink: 0 }} />
        {isExpandable ? (
          <button
            className={styles.layerExpandBtn}
            onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <Icon name={expanded ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-right-linear'} size={12} color="currentColor" />
          </button>
        ) : (
          <span style={{ width: 16, flexShrink: 0 }} />
        )}
        <LayerIcon block={block} size={14} color="currentColor" />
        {isRenaming ? (
          <input
            ref={renameInputRef}
            className={styles.layerRenameInput}
            aria-label="Rename layer"
            defaultValue={block.data?.alias || layerLabel(block)}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onBlur={(e) => commitRename(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') commitRename(e.target.value);
              if (e.key === 'Escape') ctx.setRenamingId(null);
            }}
          />
        ) : (
          <span className={styles.layerRowText}>{layerLabel(block)}</span>
        )}
        {!isStructural && (
          <button
            className={styles.layerRemove}
            onClick={(e) => { e.stopPropagation(); ctx.onRemove(id); }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Delete"
          >
            <Icon name="solar:trash-bin-trash-linear" size={14} color="currentColor" />
          </button>
        )}
      </div>
      {expanded && hasChildren && (
        <LayerChildren childrenIds={props.childrenIds} depth={depth + 1} parentId={id} ctx={ctx} />
      )}
      {expanded && hasColumns && props.columns.slice(0, block.data?.props?.columnsCount || props.columns.length).map((col, ci) => (
        <ColumnGroup key={ci} parentId={id} columnIdx={ci} childrenIds={col.childrenIds || []} depth={depth + 1} ctx={ctx} />
      ))}
    </>
  );
}
