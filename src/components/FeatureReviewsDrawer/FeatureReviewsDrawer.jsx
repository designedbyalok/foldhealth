import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext, DragOverlay, KeyboardSensor, MeasuringStrategy, PointerSensor, pointerWithin, rectIntersection,
  useDraggable, useDroppable, useSensor, useSensors,
} from '@dnd-kit/core';
import { Drawer } from '../Drawer/Drawer';
import { Badge } from '../Badge/Badge';
import { Button } from '../Button/Button';
import { ActionButton } from '../ActionButton/ActionButton';
import { AvatarGroup } from '../AvatarGroup/AvatarGroup';
import { Icon } from '../Icon/Icon';
import { DownChevronIcon } from '../Icon/DownChevronIcon';
import { Input } from '../Input/Input';
import { Textarea } from '../Textarea/Textarea';
import { UserPickerPopover } from '../UserPickerPopover/UserPickerPopover';
import { TabStrip } from '../TabStrip/TabStrip';
import { Collapse } from '../Collapse/Collapse';
import { CardSkeleton } from '../CardSkeleton/CardSkeleton';
import { ImagePreviewOverlay } from '../ImagePreviewOverlay/ImagePreviewOverlay';
import { sanitizeRichText } from '../../lib/sanitizeHtml';
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog';
import { EmptyState } from '../EmptyState/EmptyState';
import { toast } from '../Toast/sonnerToast';
import { useAppStore } from '../../store/useAppStore';
import { mySignoff, sameEmail, useReviewerEmail, useReviewerOptions } from './featureReviewHooks';
import { FeatureReviewForm } from './FeatureReviewForm';
import styles from './FeatureReviewsDrawer.module.css';

const DATE_TIME_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
});
const fmt = (iso) => DATE_TIME_FMT.format(new Date(iso));
const DAY_FMT = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

const dayKey = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

function dayLabel(iso) {
  const key = dayKey(iso);
  const now = new Date();
  if (key === dayKey(now)) return 'Today';
  if (key === dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) return 'Yesterday';
  return DAY_FMT.format(new Date(iso));
}

const EMPTY = {
  mine: { title: 'Nothing waiting on you', description: 'Features you need to sign off show up here.' },
  pending: { title: 'Everything is signed off', description: 'No feature is waiting for a review.' },
  signed: { title: 'No signoffs yet', description: 'Signed features show up here with who signed and when.' },
  all: { title: 'No features yet', description: 'Features assigned to you for review show up here.' },
  suggested: { title: 'No suggestions', description: 'New features and bug fixes merged to main show up here to keep or remove.' },
};

const initials = (name) => name.split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();

function goTo(link) {
  window.location.hash = link;
}

// Signed once every reviewer has signed. A parent with no reviewers of its
// own is done when all of its sub-items are.
// Signed once every reviewer on the item has signed and, for a feature, every
// one of its sub-items is signed too.
function isDone(item, subItems) {
  const own = item.reviewers.every(r => r.signedAt);
  if (!subItems.length) return item.reviewers.length > 0 && own;
  return own && subItems.every(c => isDone(c, []));
}

function matches(tab, item, subItems, myEmail) {
  if (tab === 'all' || tab === 'suggested') return true;
  if (tab === 'mine') {
    const mine = mySignoff(item, myEmail);
    return !!mine && !mine.signedAt;
  }
  if (!item.reviewers.length && !subItems.length) return false;
  return tab === 'signed' ? isDone(item, subItems) : !isDone(item, subItems);
}

/**
 * FeatureReviewsDrawer: every feature going into the product, with optional
 * sub-items, its reviewers, a link to the screen to review, and each
 * reviewer's one-click sign-off (with the date and time) and comment. Opened
 * from "Signoff" in the nav bar (titled Design Signoff), grouped by day, newest first by default.
 * Every feature or fix merged to main arrives as a suggestion that the design
 * team (feature_review_managers) keeps for review or removes; they can also
 * add features and change reviewers. Everyone else sees only kept items
 * assigned to them. The database enforces all of it.
 */
export function FeatureReviewsDrawer({ onClose, focusId = null }) {
  const reviews = useAppStore(s => s.featureReviews);
  const managers = useAppStore(s => s.featureReviewManagers);
  const loading = useAppStore(s => s.featureReviewsLoading);
  const fetched = useAppStore(s => s._featureReviewsFetched);
  const fetchFeatureReviews = useAppStore(s => s.fetchFeatureReviews);
  const myEmail = useReviewerEmail();
  const isManager = managers.some(m => sameEmail(m, myEmail));

  useEffect(() => { fetchFeatureReviews({ refresh: true }); }, [fetchFeatureReviews]);

  const approved = useMemo(() => reviews.filter(r => r.status === 'approved'), [reviews]);
  const suggested = useMemo(() => reviews.filter(r => r.status === 'suggested'), [reviews]);

  // One level of nesting. A sub-item whose parent isn't visible to this
  // user (RLS) is shown at the top level.
  const tree = useMemo(() => {
    const ids = new Set(approved.map(r => r.id));
    const kids = new Map();
    for (const r of approved) {
      if (r.parentId && ids.has(r.parentId)) {
        if (!kids.has(r.parentId)) kids.set(r.parentId, []);
        kids.get(r.parentId).push(r);
      }
    }
    for (const list of kids.values()) list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    return approved
      .filter(r => !r.parentId || !ids.has(r.parentId))
      .map(r => ({ item: r, subItems: kids.get(r.id) || [] }));
  }, [approved]);

  // Managers' All tab holds everything: kept items and suggestions alike.
  const filtered = useCallback((tab) => {
    const suggestedGroups = suggested.map(item => ({ item, subItems: [] }));
    if (tab === 'suggested') return suggestedGroups.map(g => ({ ...g, self: true }));
    return (tab === 'all' && isManager ? [...tree, ...suggestedGroups] : tree)
    .map(({ item, subItems }) => {
      const kids = subItems.filter(c => matches(tab, c, [], myEmail));
      const self = matches(tab, item, subItems, myEmail);
      return self || kids.length ? { item, subItems: tab === 'all' ? subItems : kids, self } : null;
    })
    .filter(Boolean);
  }, [tree, suggested, myEmail, isManager]);

  const count = (tab) => filtered(tab).reduce((n, g) => n + (g.self ? 1 : 0) + g.subItems.length, 0);
  const counts = {
    mine: count('mine'), pending: count('pending'), signed: count('signed'),
    all: approved.length + (isManager ? suggested.length : 0), suggested: suggested.length,
  };

  // Opened on one item (from the review box): show it under All.
  const [tab, setTab] = useState(focusId ? 'all' : null);
  // Managers land on everything; reviewers on what's waiting for them.
  const activeTab = tab || (isManager || counts.mine === 0 ? 'all' : 'mine');
  const [newestFirst, setNewestFirst] = useState(true);

  const days = useMemo(() => {
    const sorted = filtered(activeTab).sort((a, b) => (
      (new Date(b.item.createdAt) - new Date(a.item.createdAt)) * (newestFirst ? 1 : -1)
    ));
    const byDay = [];
    for (const g of sorted) {
      const key = dayKey(g.item.createdAt);
      if (byDay.at(-1)?.key !== key) byDay.push({ key, label: dayLabel(g.item.createdAt), groups: [] });
      byDay.at(-1).groups.push(g);
    }
    return byDay;
  }, [filtered, activeTab, newestFirst]);

  const [expanded, setExpanded] = useState(focusId);
  const [form, setForm] = useState(null);
  // Review: go to the item's section and open the floating review box there.
  const startFeatureReview = useAppStore(s => s.startFeatureReview);

  // ── Drag to nest / un-nest (managers, not on the Suggested tab) ──
  const moveFeatureReview = useAppStore(s => s.moveFeatureReview);
  const canDrag = isManager && activeTab !== 'suggested';
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [flashId, setFlashId] = useState(focusId);
  // Bring the focused item into view once it has loaded, then let the flash
  // fade. Keyed on "loaded" (flips once), so refetches don't restart it.
  const focusLoaded = !!focusId && reviews.some(r => r.id === focusId);
  useEffect(() => {
    if (!focusLoaded) return undefined;
    const frame = requestAnimationFrame(() => {
      document.querySelector(`[data-review-id="${focusId}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    const fade = setTimeout(() => setFlashId(v => (v === focusId ? null : v)), 1800);
    return () => { cancelAnimationFrame(frame); clearTimeout(fade); };
  }, [focusId, focusLoaded]);
  const dragItem = dragId ? reviews.find(r => r.id === dragId) : null;
  const drop = dropVerdict(dragItem, overId, reviews);

  const endDrag = () => { setDragId(null); setOverId(null); };
  const onDragEnd = ({ over }) => {
    const verdict = dropVerdict(dragItem, over?.id ?? null, reviews);
    const id = dragId;
    endDrag();
    if (!verdict.ok) return;
    moveFeatureReview(id, verdict.parentId);
    setFlashId(id);
    // Bring the moved row into view at its new place, then let the flash fade.
    requestAnimationFrame(() => {
      document.querySelector(`[data-review-id="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    setTimeout(() => setFlashId(v => (v === id ? null : v)), 1400);
  };

  if (form) {
    return (
      <FeatureReviewForm
        parentId={form.parentId}
        onClose={onClose}
        onDone={(id) => { setForm(null); setTab('all'); if (id) setExpanded(id); }}
      />
    );
  }

  const row = (item, subItems, { child = false, context = false, parent = null } = {}) => (
    <ReviewRow
      key={item.id}
      canDrag={canDrag}
      dropHint={dragId && overId === `row:${item.id}` ? (drop.ok ? 'valid' : 'blocked') : null}
      flash={flashId === item.id}
      item={item}
      childItems={subItems}
      child={child}
      context={context}
      myEmail={myEmail}
      isManager={isManager}
      expanded={expanded === item.id}
      onToggle={() => setExpanded(v => (v === item.id ? null : item.id))}
      onExpand={() => setExpanded(item.id)}
      link={item.link || parent?.link || ''}
      onReview={() => {
        const link = item.link || parent?.link;
        startFeatureReview({ id: item.id, title: item.title, area: item.area || parent?.area, link });
        goTo(link);
        onClose();
      }}
      onAddSubItem={() => setForm({ parentId: item.id })}
    />
  );

  return (
    <Drawer
      title="Design Signoff"
      onClose={onClose}
      noCloseDivider={isManager}
      headerRight={isManager ? (
        <>
          <Button variant="secondary" size="S" leadingIcon="solar:add-circle-linear" onClick={() => setForm({ parentId: null })}>
            Add Feature
          </Button>
          <span className={styles.headerDivider} />
        </>
      ) : undefined}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        measuring={MEASURING}
        onDragStart={({ active }) => setDragId(active.id)}
        onDragOver={({ over }) => setOverId(over?.id ?? null)}
        onDragCancel={endDrag}
        onDragEnd={onDragEnd}
      >
      {/* Tabs and column headers stay pinned under the drawer header. */}
      <div className={styles.stickyTop}>
        <TabStrip
          fullWidth={false}
          activeKey={activeTab}
          onChange={setTab}
          items={[
            { key: 'mine', label: 'To sign', count: counts.mine },
            { key: 'pending', label: 'Pending', count: counts.pending },
            { key: 'signed', label: 'Signed', count: counts.signed },
            { key: 'all', label: 'All', count: counts.all },
            ...(isManager ? [{ key: 'suggested', label: 'Suggested', count: counts.suggested }] : []),
          ]}
          trailing={(
            <Button variant="ghost" size="S" leadingIcon="solar:sort-vertical-linear" onClick={() => setNewestFirst(v => !v)}>
              {newestFirst ? 'Newest first' : 'Oldest first'}
            </Button>
          )}
        />
        {!loading && fetched && days.length > 0 && (
          // Visual column labels only; each row's controls carry their own labels.
          <div className={`${styles.grid} ${styles.head}`} aria-hidden="true">
            <span className={styles.headFeature}>Feature</span>
            <span>Reviewers</span>
            <span>Status</span>
            <span className={styles.headActions}>Actions</span>
          </div>
        )}
        {canDrag && (
          <TopLevelDropZone
            open={!!dragItem?.parentId}
            over={overId === ROOT_DROP}
            lands={dragItem ? dayLabel(dragItem.createdAt) : ''}
          />
        )}
      </div>
      {loading || !fetched ? (
        <div className={styles.padded}><CardSkeleton count={4} /></div>
      ) : days.length === 0 ? (
        <EmptyState icon="solar:clipboard-check-linear" {...EMPTY[activeTab]} />
      ) : (
        <div className={styles.table}>
          {days.map(day => (
            <section key={day.key} aria-label={day.label}>
              <div className={styles.dayRow}>{day.label}</div>
              {day.groups.map(({ item, subItems, self }) => (
                <div key={item.id} className={styles.group}>
                  {row(item, subItems, { context: !self })}
                  {subItems.map(c => row(c, [], { child: true, parent: item }))}
                  {drop.ok && drop.parentId === item.id && <LandingGhost item={dragItem} />}
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
      {/* Portalled: the drawer panel's transform would otherwise make it the
          containing block for this fixed-position card, offsetting and
          clipping it. */}
      {createPortal(
        <DragOverlay dropAnimation={drop.ok ? DROP_FADE : undefined} zIndex={DRAG_LAYER}>
          {dragItem ? <DragPreview item={dragItem} drop={drop} /> : null}
        </DragOverlay>,
        document.body,
      )}
      </DndContext>
    </Drawer>
  );
}

const ROOT_DROP = 'root';
// Re-measure targets during a drag: the landing ghost adds a row, which
// shifts everything below it.
const MEASURING = { droppable: { strategy: MeasuringStrategy.Always } };
// Above the drawer (400/401, plus 10 per nested drawer) and its popovers.
const DRAG_LAYER = 1100;

// Rows are tall and the root zone is short, so prefer what's under the
// pointer and fall back to overlap (keyboard drags have no pointer).
function collisionDetection(args) {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
}

// Accepted drops fade out where they land; a refused drop keeps dnd-kit's
// default glide back to where it came from.
const DROP_FADE = { duration: 160, easing: 'ease-out', keyframes: () => [{ opacity: 1 }, { opacity: 0 }] };

// What dropping `dragItem` on `overId` would do. One level of nesting: only a
// top-level feature can take sub-items, and an item that has sub-items of its
// own can't be nested.
function dropVerdict(dragItem, overId, reviews) {
  if (!dragItem || !overId) return { ok: false, hint: 'Drop onto a feature to nest it' };
  if (overId === ROOT_DROP) {
    return dragItem.parentId
      ? { ok: true, parentId: null, hint: 'Move to the top level' }
      : { ok: false, hint: 'Already at the top level' };
  }
  const target = reviews.find(r => `row:${r.id}` === overId);
  if (!target || target.id === dragItem.id) return { ok: false, hint: 'Drop onto another feature' };
  if (target.parentId) return { ok: false, hint: "Sub-items can't have their own sub-items" };
  if (target.id === dragItem.parentId) return { ok: false, hint: `Already under ${target.title}` };
  if (reviews.some(r => r.parentId === dragItem.id)) {
    return { ok: false, hint: 'Move its sub-items out first' };
  }
  return { ok: true, parentId: target.id, hint: `Nest under ${target.title}` };
}

// Floats just under the column headers instead of pushing the list down, so
// rows don't jump the moment a drag starts.
function TopLevelDropZone({ open, over, lands }) {
  const { setNodeRef } = useDroppable({ id: ROOT_DROP, disabled: !open });
  return (
    <div className={[styles.rootZoneWrap, open ? styles.rootZoneWrapOpen : ''].filter(Boolean).join(' ')} aria-hidden={!open}>
      <div ref={setNodeRef} className={[styles.rootZone, over ? styles.rootZoneOver : ''].filter(Boolean).join(' ')}>
        <Icon name="solar:arrow-left-up-linear" size={16} color="currentColor" />
        <span>
          {over ? 'Release to move to the top level' : 'Drop here to move to the top level'}
          {lands && <span className={styles.rootZoneWhere}>{` · lands under ${lands}`}</span>}
        </span>
      </div>
    </div>
  );
}

// Where a nest drop will land: a dashed copy of the item as the target's last
// sub-item.
function LandingGhost({ item }) {
  return (
    <div className={`${styles.grid} ${styles.row} ${styles.childRow} ${styles.ghostRow}`} aria-hidden="true">
      <div className={`${styles.featureCell} ${styles.childCell}`}>
        <span className={styles.ghostTitle}>
          <Icon name="solar:arrow-right-down-linear" size={14} color="currentColor" />
          {item.title}
        </span>
      </div>
    </div>
  );
}

function DragPreview({ item, drop }) {
  return (
    <div className={styles.dragPreview}>
      <Icon name="custom:drag-handle" size={16} color="var(--neutral-300)" />
      <span className={styles.dragPreviewText}>
        <span className={styles.dragPreviewTitle}>{item.title}</span>
        <span className={drop.ok ? styles.dragHintOk : styles.dragHint}>{drop.hint}</span>
      </span>
    </div>
  );
}

const SHORT_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// When the item was fully signed: the last signature on it or its sub-items.
function signedOn(item, childItems) {
  const times = [item, ...childItems]
    .flatMap(i => i.reviewers.map(r => r.signedAt))
    .filter(Boolean);
  return times.length ? times.sort().at(-1) : null;
}

function ReviewStatus({ item, childItems }) {
  if (item.status === 'suggested') return <Badge tone="primary" size="S" label="Suggested" />;
  if (isDone(item, childItems)) {
    const at = signedOn(item, childItems);
    return (
      <div className={styles.statusCell}>
        <Badge tone="success" size="S" icon="solar:check-circle-linear" label="Signed" />
        {at && <time className={styles.signedOn} dateTime={at} title={fmt(at)}>{SHORT_FMT.format(new Date(at))}</time>}
      </div>
    );
  }
  if (childItems.length && item.reviewers.every(r => r.signedAt)) {
    const kidsDone = childItems.filter(c => isDone(c, [])).length;
    return <Badge tone="grey" size="S" label={`${kidsDone}/${childItems.length} sub-items`} />;
  }
  if (item.reviewers.length > 1) {
    const signed = item.reviewers.filter(r => r.signedAt).length;
    return <Badge tone="warning" size="S" label={`${signed}/${item.reviewers.length} signed`} />;
  }
  return <Badge tone="warning" size="S" label="Pending" />;
}

function ReviewRow({
  item, childItems, child, context, myEmail, isManager, expanded, onToggle, onExpand, onReview, onAddSubItem,
  canDrag, dropHint, flash, link,
}) {
  // Suggestions are kept or removed first; only kept items nest.
  const movable = canDrag && item.status !== 'suggested';
  const drag = useDraggable({ id: item.id, disabled: !movable });
  // Only top-level features take sub-items.
  const dropTarget = useDroppable({ id: `row:${item.id}`, disabled: !movable || child });
  const signOff = useAppStore(s => s.signOffFeatureReview);
  const keep = useAppStore(s => s.keepFeatureReview);
  const remove = useAppStore(s => s.removeFeatureReview);
  const suggestion = item.status === 'suggested';
  const mine = suggestion ? null : mySignoff(item, myEmail);
  const [signing, setSigning] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const fetchComments = useAppStore(s => s.fetchFeatureReviewComments);
  useEffect(() => { if (expanded) fetchComments(item.id); }, [expanded, item.id, fetchComments]);
  const [pickerRect, setPickerRect] = useState(null);
  const [reviewersCell, setReviewersCell] = useState(null);

  const openComment = () => { setCommenting(true); onExpand(); };

  const handleKeep = async () => {
    if (!item.reviewers.length) {
      toast.info('Assign at least one reviewer, then keep it for review.');
      if (reviewersCell) setPickerRect(reviewersCell.getBoundingClientRect());
      return;
    }
    if (await keep(item.id)) toast.success('Kept for review. Its reviewers can see it now.');
  };

  // A feature's sub-items still waiting on me. Signing the feature signs them
  // too, so that's confirmed first.
  const myPendingSubItems = childItems.filter(c => {
    const r = mySignoff(c, myEmail);
    return r && !r.signedAt;
  });
  const [confirmAll, setConfirmAll] = useState(false);

  const signNow = async (withSubItems) => {
    setSigning(true);
    let ok;
    try {
      ok = await signOff(mine.id, { withSubItems });
    } finally {
      setSigning(false);
    }
    setConfirmAll(false);
    if (ok) {
      toast.success(withSubItems
        ? `Signed off ${item.title} and ${myPendingSubItems.length} sub-item${myPendingSubItems.length === 1 ? '' : 's'}`
        : 'Signed off');
    }
  };

  const handleSignOff = () => {
    if (myPendingSubItems.length) setConfirmAll(true);
    else signNow(false);
  };

  const rowCls = [
    styles.grid,
    styles.row,
    child ? styles.childRow : '',
    expanded ? styles.rowExpanded : '',
    context ? styles.contextRow : '',
    drag.isDragging ? styles.rowDragging : '',
    dropHint === 'valid' ? styles.dropTarget : '',
    dropHint === 'blocked' ? styles.dropBlocked : '',
    flash ? styles.rowFlash : '',
  ].filter(Boolean).join(' ');

  const showSignOff = !!mine && !mine.signedAt;
  const showOpen = !suggestion && !!link;

  return (
    <div className={styles.item} data-review-id={item.id}>
      <div
        className={rowCls}
        ref={(el) => { drag.setNodeRef(el); dropTarget.setNodeRef(el); }}
      >
        {movable && (
          <button
            type="button"
            className={styles.dragHandle}
            aria-label={`Move ${item.title}`}
            {...drag.attributes}
            {...drag.listeners}
          >
            <Icon name="custom:drag-handle" size={16} color="var(--neutral-300)" />
          </button>
        )}
        <div className={[styles.featureCell, child ? styles.childCell : ''].filter(Boolean).join(' ')}>
          <button type="button" className={styles.rowMain} aria-expanded={expanded} onClick={onToggle}>
            <DownChevronIcon size={16} className={[styles.chevron, expanded ? styles.chevronOpen : ''].filter(Boolean).join(' ')} />
            <span className={styles.rowText}>
              <span className={styles.rowTitle} title={item.title}>
                {item.title}
                {child && item.kind === 'fix' && <span className={styles.inlineMeta}>Bug fix</span>}
              </span>
              {!child && (item.area || item.kind === 'fix') && (
                <span className={styles.rowMeta}>
                  {item.kind === 'fix' ? 'Bug fix' : null}
                  {item.kind === 'fix' && item.area && !child ? ' · ' : null}
                  {!child ? item.area : null}
                </span>
              )}
            </span>
          </button>
        </div>
        <div ref={setReviewersCell}>
          <ReviewerAvatars
            item={item}
            editable={isManager}
            onEdit={(rect) => setPickerRect(rect)}
          />
          {pickerRect && <ReviewerPicker item={item} anchorRect={pickerRect} onClose={() => setPickerRect(null)} />}
        </div>
        <div><ReviewStatus item={item} childItems={childItems} /></div>
        {suggestion && isManager ? (
          <div className={styles.actions}>
            <ActionButton size="S" icon="solar:trash-bin-minimalistic-linear" tooltip="Remove from the list" tooltipLeft onClick={() => remove(item.id)} />
            <Button variant="secondary" size="S" leadingIcon="solar:check-read-linear" onClick={handleKeep}>Keep</Button>
          </div>
        ) : (
          // Fixed slots (Sign off · divider · comment · divider · open) so each control
          // sits in the same place on every row, present or not.
          <div className={styles.actionSlots}>
            <span className={styles.signOffSlot}>
              {showSignOff && (
                <Button variant="tertiary" size="S" leadingIcon="solar:check-circle-linear" onClick={handleSignOff} disabled={signing}>
                  {signing ? 'Signing…' : 'Sign off'}
                </Button>
              )}
            </span>
            <span>{showSignOff && (mine || showOpen) && <span className={styles.headerDivider} />}</span>
            <span>
              {mine && (
                <ActionButton
                  size="S"
                  icon="solar:chat-line-linear"
                  tooltip={mine.comment ? 'Edit comment' : 'Add comment'}
                  tooltipLeft
                  onClick={openComment}
                />
              )}
            </span>
            <span>{mine && showOpen && <span className={styles.headerDivider} />}</span>
            <span>
              {showOpen && <ActionButton size="S" icon="solar:eye-linear" tooltip="Review: open the section with a comment box" tooltipLeft onClick={onReview} />}
            </span>
          </div>
        )}
      </div>
      <Collapse open={expanded}>
        <ReviewDetail
          item={item}
          child={child}
          myEmail={myEmail}
          isManager={isManager}
          commenting={expanded && commenting}
          onCommentDone={() => setCommenting(false)}
          onAddSubItem={onAddSubItem}
        />
      </Collapse>
      {confirmAll && (
        <ConfirmDialog
          variant="primary"
          icon="solar:check-circle-linear"
          title={`Sign off ${item.title} and its sub-items?`}
          description={`This also signs off the ${myPendingSubItems.length} sub-item${myPendingSubItems.length === 1 ? '' : 's'} assigned to you: ${myPendingSubItems.map(c => c.title).join(', ')}. Each gets today's date and time, and sign-offs can't be undone.`}
          confirmLabel={`Sign off all ${myPendingSubItems.length + 1}`}
          loading={signing}
          onConfirm={() => signNow(true)}
          onCancel={() => setConfirmAll(false)}
        />
      )}
    </div>
  );
}

// Managers change reviewers right from the row: the avatars (or an
// "Assign" icon when there are none) open the picker.
function ReviewerAvatars({ item, editable, onEdit }) {
  const people = item.reviewers.map(r => ({ id: r.id, name: r.name, initials: initials(r.name) }));
  const avatars = people.length > 0 && <AvatarGroup size="XS" variant="staff" max={3} people={people} />;
  if (!editable) return avatars || null;
  if (!people.length) {
    return (
      <ActionButton
        size="S"
        icon="solar:user-plus-linear"
        tooltip="Assign reviewers"
        onClick={e => onEdit(e.currentTarget.getBoundingClientRect())}
      />
    );
  }
  return (
    <button
      type="button"
      className={styles.reviewersButton}
      aria-label={`Change reviewers: ${item.reviewers.map(r => r.name).join(', ')}`}
      onClick={e => onEdit(e.currentTarget.getBoundingClientRect())}
    >
      {avatars}
    </button>
  );
}

const RECENT_REVIEWERS = 5;

function ReviewerPicker({ item, anchorRect, onClose }) {
  const setFeatureReviewers = useAppStore(s => s.setFeatureReviewers);
  const { options, byEmail } = useReviewerOptions();
  const users = useMemo(() => options.map(o => ({ id: o.value, name: o.label, role: o.value })), [options]);
  const selected = useMemo(() => item.reviewers.map(r => r.email.toLowerCase()), [item.reviewers]);
  const signed = new Set(item.reviewers.filter(r => r.signedAt).map(r => r.email.toLowerCase()));
  // Who's on the item comes first; an unassigned item offers the people
  // assigned most recently anywhere instead, since they're the likely picks.
  const reviews = useAppStore(s => s.featureReviews);
  const pinned = useMemo(() => {
    if (selected.length) return { label: 'Assigned', keys: selected };
    const latest = new Map();
    for (const f of reviews) {
      for (const r of f.reviewers) {
        const email = r.email?.toLowerCase();
        const at = new Date(r.assignedAt || 0).getTime();
        if (email && at > (latest.get(email) ?? -1)) latest.set(email, at);
      }
    }
    const keys = [...latest.entries()].sort((a, b) => b[1] - a[1]).slice(0, RECENT_REVIEWERS).map(([email]) => email);
    return keys.length ? { label: 'Recently Assigned', keys } : null;
  }, [selected, reviews]);

  const onSelect = (emails) => {
    const next = emails.map(String);
    const nextSet = new Set(next);
    const inherited = item.reviewers.filter(r => r.inheritedFrom && !nextSet.has(r.email.toLowerCase()));
    if (inherited.length) {
      toast.error(`${inherited[0].name} reviews this through its feature. Change it on the feature.`);
      return;
    }
    if ([...signed].some(e => !nextSet.has(e))) {
      toast.error("A reviewer who has signed off can't be removed.");
      return;
    }
    const current = new Map(item.reviewers.map(r => [r.email.toLowerCase(), r]));
    setFeatureReviewers(item.id, next.map(e => current.get(e) || byEmail.get(e)).filter(Boolean));
  };

  return (
    <UserPickerPopover
      anchorRect={anchorRect}
      users={users}
      selected={selected}
      onSelect={onSelect}
      onClose={onClose}
      title="Reviewers"
      multiple
      pinned={pinned}
    />
  );
}

const COMMENT_TIME = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const EMPTY_COMMENTS = [];

// Where a point was made, as the app's own route (e.g. "#/population/hcc").
const pageOf = (url) => {
  try { const u = new URL(url); return u.hash || u.pathname; } catch { return ''; }
};

// Feedback left with the in-place review box, newest first. Each piece is a
// series of points (one per screen or section), each with its screenshots.
function ReviewComments({ featureId }) {
  const comments = useAppStore(s => s.featureReviewComments[featureId] || EMPTY_COMMENTS);
  const [preview, setPreview] = useState(null);
  if (!comments.length) return null;
  return (
    <section className={styles.reviewComments} aria-label="Review feedback">
      <div className={styles.reviewCommentsTitle}>Review feedback ({comments.length})</div>
      <ul className={styles.reviewCommentList}>
        {comments.map(c => (
          <li key={c.id} className={styles.reviewComment}>
            <div className={styles.reviewerLine}>
              <span className={styles.reviewerName}>{c.authorName}</span>
              <time className={styles.reviewerWhen} dateTime={c.createdAt}>{COMMENT_TIME.format(new Date(c.createdAt))}</time>
            </div>
            <ol className={styles.reviewPoints}>
              {c.points.map((p, i) => (
                <li key={i} className={styles.reviewPoint}>
                  {(c.points.length > 1 || pageOf(p.context.url)) && (
                    <div className={styles.reviewPointHead}>
                      {c.points.length > 1 && <span className={styles.reviewPointNo}>Point {i + 1}</span>}
                      {pageOf(p.context.url) && <span className={styles.reviewPointPage}>{pageOf(p.context.url)}</span>}
                    </div>
                  )}
                  {p.html
                    // Rich text from the review box, sanitized like the app's other rich text.
                    ? <div className={styles.reviewCommentBody} dangerouslySetInnerHTML={{ __html: sanitizeRichText(p.html) }} />
                    : p.text && <p className={styles.reviewCommentBody}>{p.text}</p>}
                  {p.attachments.length > 0 && (
                    <div className={styles.reviewThumbs}>
                      {p.attachments.map(a => (
                        <button
                          key={a.path}
                          type="button"
                          className={styles.reviewThumb}
                          onClick={() => a.url && setPreview({ name: a.name, ext: (a.name.split('.').pop() || 'png').toLowerCase(), fileUrl: a.url })}
                          title={a.selector ? `${a.element || a.name} · ${a.selector}` : a.name}
                          aria-label={`Open ${a.name}`}
                        >
                          {a.url ? <img src={a.url} alt="" /> : <Icon name="solar:gallery-linear" size={16} color="var(--neutral-300)" />}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ul>
      {preview && <ImagePreviewOverlay doc={preview} onClose={() => setPreview(null)} />}
    </section>
  );
}

function ReviewDetail({ item, child, myEmail, isManager, commenting, onCommentDone, onAddSubItem }) {
  return (
    <div className={[styles.detail, child ? styles.childDetail : ''].filter(Boolean).join(' ')}>
      {item.description && <p className={styles.description}>{item.description}</p>}
      <ul className={styles.reviewers}>
        {item.reviewers.map(r => {
          const isMe = sameEmail(r.email, myEmail);
          return (
            <li key={r.id} className={styles.reviewer}>
              <div className={styles.reviewerLine}>
                <Icon
                  name={r.signedAt ? 'solar:check-circle-linear' : 'solar:clock-circle-linear'}
                  size={14}
                  color={r.signedAt ? 'var(--status-success)' : 'var(--neutral-300)'}
                />
                <span className={styles.reviewerName}>{r.name}</span>
                {r.inheritedFrom && <span className={styles.reviewerVia}>via feature</span>}
                <span className={styles.reviewerWhen}>
                  {r.signedAt ? <>Signed <time dateTime={r.signedAt}>{fmt(r.signedAt)}</time></> : 'Awaiting signoff'}
                </span>
              </div>
              {isMe && commenting
                ? <CommentBox signoff={r} onDone={onCommentDone} />
                : r.comment && <p className={styles.comment}>{r.comment}</p>}
            </li>
          );
        })}
        {item.reviewers.length === 0 && <li className={styles.noReviewers}>No reviewers on this item.</li>}
      </ul>
      <ReviewComments featureId={item.id} />
      {isManager && <ManageLink item={item} />}
      {isManager && !child && item.status === 'approved' && (
        <div>
          <Button variant="ghost" size="S" leadingIcon="solar:add-circle-linear" onClick={onAddSubItem}>Add Sub-item</Button>
        </div>
      )}
    </div>
  );
}

function CommentBox({ signoff, onDone }) {
  const commentFeatureReview = useAppStore(s => s.commentFeatureReview);
  // null until the reviewer types, so a newer saved comment shows through.
  const [edited, setEdited] = useState(null);
  const draft = edited ?? signoff.comment;
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    if (draft.trim() === signoff.comment) { onDone(); return; }
    setSaving(true);
    let ok;
    try {
      ok = await commentFeatureReview(signoff.id, draft.trim());
    } finally {
      setSaving(false);
    }
    if (ok) onDone();
  };

  return (
    <div className={styles.commentBox}>
      <Textarea
        autoFocus
        rows={3}
        placeholder="Add a comment for this review"
        value={draft}
        onChange={e => setEdited(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save(); }}
      />
      <div className={styles.commentActions}>
        <Button variant="secondary" size="S" onClick={onDone} disabled={saving}>Cancel</Button>
        <Button variant="primary" size="S" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
      </div>
    </div>
  );
}

function ManageLink({ item }) {
  const updateFeatureReview = useAppStore(s => s.updateFeatureReview);
  const [draft, setDraft] = useState(item.link || '');
  const valid = !draft.trim() || draft.trim().startsWith('#/');

  const save = () => {
    const link = draft.trim();
    if (!valid || link === (item.link || '')) return;
    updateFeatureReview(item.id, { link: link || null });
  };

  return (
    <Input
      label="Link to section"
      placeholder="#/population/pharmacy"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={e => { if (e.key === 'Enter') save(); }}
      errorText={valid ? undefined : 'Use an in-app link starting with #/'}
    />
  );
}
