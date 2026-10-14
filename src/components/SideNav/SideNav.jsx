import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '../Icon/Icon';
import { Input } from '../Input/Input';
import styles from './SideNav.module.css';

/* Track the global `data-sidebar-shape` attribute from applySidebarShape
   (lib/theme.js). When the user has opted for the floating shape, every
   SideNav auto-renders a search header + filters items — the floating
   card then has the search strip the user asked for, without touching
   every caller. */
function useFloatingSidebarShape() {
  const [floating, setFloating] = useState(() =>
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-sidebar-shape') === 'floating',
  );
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const check = () => setFloating(
      document.documentElement.getAttribute('data-sidebar-shape') === 'floating',
    );
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-sidebar-shape'] });
    return () => observer.disconnect();
  }, []);
  return floating;
}

const EMPTY_SECTIONS = [];

function renderItemBody(item) {
  return (
    <>
      {item.iconElement
        ? <span className={styles.itemIcon}>{item.iconElement}</span>
        : item.locked
          ? <Icon name="solar:lock-linear" size={16} color="var(--neutral-200)" />
          : item.icon
            ? <Icon name={item.icon} size={16} color="currentColor" />
            : null}
      <span className={styles.itemLabel}>{item.label}</span>
      {item.count != null && <span className={styles.count}>{item.count}</span>}
    </>
  );
}

/**
 * Fold Health SideNav — the shared second-level navigation rail. One root
 * component behind every section sub-nav in the app (Population worklists,
 * Messages/Calls comm panels, Analytics report pages, Settings menu) so
 * they all read and behave identically.
 *
 * Anatomy: optional `header` slot (e.g. a full-width "Create New" Button),
 * then labelled sections of items. The active item is highlighted by ONE
 * sliding indicator that glides between rows (280ms spring) instead of a
 * hard background swap.
 *
 * @param {object}   props
 * @param {Array}    props.sections     – [{ key, label?, items: [{ key, label,
 *                                        icon?, iconElement?, count?, locked? }] }]
 *                                        `icon` is a Solar icon name; pass
 *                                        `iconElement` for a custom SVG node.
 *                                        A section with no items renders just
 *                                        its label (placeholder groups).
 * @param {string}   props.activeKey    – key of the selected item
 * @param {function} props.onSelect     – (key, item) => void. Locked items
 *                                        still fire so callers can toast.
 * @param {ReactNode}[props.header]     – slot rendered above the sections
 * @param {number}   [props.width=200]  – rail width in px
 * @param {'uppercase'|'title'|'sentence'} [props.sectionLabelVariant='uppercase']
 *                                        'sentence': 14px medium, as written (Comms)
 * @param {string}   [props.sortableSection] – key of ONE section whose items
 *                                        can be drag-reordered (8px pointer
 *                                        threshold keeps clicks working)
 * @param {function} [props.onReorder]  – (orderedItemKeys) => void, fired on drop
 * @param {boolean}  [props.loading]    – render skeleton rows instead of items
 * @param {boolean}  [props.collapsed]  – icon-only 56px rail (Figma
 *                                        Communications 1:29533): labels
 *                                        hidden, counts as orange badges on
 *                                        the icons, section labels cut to
 *                                        two letters (or `shortLabel`); the
 *                                        header slot should shrink to match
 * @param {string}   [props.className]
 */
export function SideNav({
  sections = EMPTY_SECTIONS,
  activeKey,
  onSelect,
  header,
  width = 200,
  sectionLabelVariant = 'uppercase',
  sortableSection,
  onReorder,
  loading = false,
  collapsed = false,
  className,
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Floating-shape auto-search header. Only kicks in when the user has
  // opted into the floating sidebar AND the caller hasn't passed its own
  // header, so Comms/Analytics' custom "Create New" headers still win.
  const isFloating = useFloatingSidebarShape();
  const [search, setSearch] = useState('');
  const searchActive = isFloating && !header && !collapsed;
  const q = searchActive ? search.trim().toLowerCase() : '';
  const effectiveSections = useMemo(() => {
    if (!q) return sections;
    return sections
      .map(sec => ({
        ...sec,
        items: (sec.items || []).filter(it => (it.label || '').toLowerCase().includes(q)),
      }))
      .filter(sec => sec.items.length > 0 || (sec.label || '').toLowerCase().includes(q));
  }, [sections, q]);
  const effectiveHeader = searchActive ? (
    <Input
      type="search"
      placeholder="Search"
      /* The leading icon forces Input onto its shell render path from the
         first keystroke. Without a leading slot, `type="search"` flips
         between the bare-input path (empty value) and the shell-wrapper
         path (non-empty value triggers Input's own search-clear glyph).
         React unmounts across that boundary and focus dies after one
         character. */
      leadingIcon="solar:magnifer-linear"
      value={search}
      onChange={e => setSearch(e.target.value)}
    />
  ) : header;

  // Sliding active indicator — measured against the active row after layout,
  // before paint. `animated` switches transitions on one frame after the
  // first placement so the indicator appears in position instead of flying in.
  const itemRefs = useRef(new Map());
  const registerRef = (key, el) => {
    if (el) itemRefs.current.set(key, el);
    else itemRefs.current.delete(key);
  };
  const [indicator, setIndicator] = useState({ top: 0, height: 0, ready: false });
  const [animated, setAnimated] = useState(false);

  useLayoutEffect(() => {
    const el = itemRefs.current.get(activeKey);
    if (!el) {
      setIndicator(i => ({ ...i, ready: false }));
      return;
    }
    setIndicator({ top: el.offsetTop, height: el.offsetHeight, ready: true });
    if (!animated) requestAnimationFrame(() => setAnimated(true));
  }, [activeKey, sections, loading, collapsed]); // eslint-disable-line react-hooks/exhaustive-deps

  const labelCls = [
    styles.sectionLabel,
    sectionLabelVariant === 'uppercase' ? styles.sectionLabelUppercase : '',
    sectionLabelVariant === 'sentence' ? styles.sectionLabelSentence : '',
  ].filter(Boolean).join(' ');

  const itemCls = (item) => [
    styles.item,
    activeKey === item.key ? styles.active : '',
    item.locked ? styles.locked : '',
  ].filter(Boolean).join(' ');

  const renderSection = (section) => {
    const isSortable = sortableSection && section.key === sortableSection && !loading;
    const items = section.items || [];

    const rows = loading
      ? Array.from({ length: Math.max(items.length, 4) }, (_, i) => (
          <div key={`sk-${section.key}-${i}`} className={styles.skeletonItem} aria-hidden>
            <span className={styles.skeletonIcon} />
            <span className={styles.skeletonLabel} />
          </div>
        ))
      : items.map(item => (
          isSortable
            ? (
              <SortableNavItem
                key={item.key}
                item={item}
                className={itemCls(item)}
                registerRef={registerRef}
                onClick={() => onSelect?.(item.key, item)}
              >
                {renderItemBody(item)}
              </SortableNavItem>
            )
            : (
              <div
                key={item.key}
                ref={(el) => registerRef(item.key, el)}
                className={itemCls(item)}
                role="button"
                tabIndex={0}
                title={collapsed ? item.label : undefined}
                aria-label={collapsed ? item.label : undefined}
                onClick={() => onSelect?.(item.key, item)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(item.key, item); } }}
              >
                {renderItemBody(item)}
              </div>
            )
        ));

    const body = isSortable
      ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={({ active, over }) => {
            if (!over || active.id === over.id) return;
            const keys = items.map(i => i.key);
            onReorder?.(arrayMove(keys, keys.indexOf(active.id), keys.indexOf(over.id)));
          }}
        >
          <SortableContext items={items.map(i => i.key)} strategy={verticalListSortingStrategy}>
            {rows}
          </SortableContext>
        </DndContext>
      )
      : rows;

    return (
      <div key={section.key} className={styles.section}>
        {section.label && (
          <div className={labelCls} title={collapsed ? section.label : undefined}>
            {collapsed ? (section.shortLabel || section.label.slice(0, 2)) : section.label}
          </div>
        )}
        {body}
      </div>
    );
  };

  return (
    <aside
      className={[styles.nav, collapsed ? styles.collapsed : '', className || ''].filter(Boolean).join(' ')}
      style={{ width: collapsed ? 56 : width }}
    >
      <span
        className={[styles.activeIndicator, animated ? styles.activeIndicatorAnimated : ''].filter(Boolean).join(' ')}
        aria-hidden
        style={{
          transform: `translateY(${indicator.top}px)`,
          height: indicator.height,
          opacity: indicator.ready ? 1 : 0,
        }}
      />
      {effectiveHeader && <div className={styles.header}>{effectiveHeader}</div>}
      {effectiveSections.map(renderSection)}
    </aside>
  );
}

// One drag-reorderable row. Combines dnd-kit's node ref with the parent's
// indicator-measurement ref.
function SortableNavItem({ item, className, registerRef, onClick, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.key });
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.(e);
    }
  };
  return (
    <div
      ref={(el) => { setNodeRef(el); registerRef(item.key, el); }}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={[className, isDragging ? styles.dragging : ''].filter(Boolean).join(' ')}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}
