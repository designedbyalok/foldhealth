import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { EmptyState } from '../EmptyState/EmptyState';
import { toast } from '../Toast/sonnerToast';
import { useAppStore } from '../../store/useAppStore';
import { mySignoff, sameEmail, useReviewerOptions } from './featureReviewHooks';
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
function isDone(item, children) {
  if (item.reviewers.length) return item.reviewers.every(r => r.signedAt);
  return children.length > 0 && children.every(c => isDone(c, []));
}

function matches(tab, item, children, myEmail) {
  if (tab === 'all' || tab === 'suggested') return true;
  if (tab === 'mine') {
    const mine = mySignoff(item, myEmail);
    return !!mine && !mine.signedAt;
  }
  if (!item.reviewers.length && !children.length) return false;
  return tab === 'signed' ? isDone(item, children) : !isDone(item, children);
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
export function FeatureReviewsDrawer({ onClose }) {
  const reviews = useAppStore(s => s.featureReviews);
  const managers = useAppStore(s => s.featureReviewManagers);
  const loading = useAppStore(s => s.featureReviewsLoading);
  const fetched = useAppStore(s => s._featureReviewsFetched);
  const fetchFeatureReviews = useAppStore(s => s.fetchFeatureReviews);
  const myEmail = useAppStore(s => s.currentUserProfile?.email);
  const isManager = managers.some(m => sameEmail(m, myEmail));

  useEffect(() => { fetchFeatureReviews(); }, [fetchFeatureReviews]);

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
      .map(r => ({ item: r, children: kids.get(r.id) || [] }));
  }, [approved]);

  const filtered = useCallback((tab) => (tab === 'suggested' ? suggested.map(item => ({ item, children: [], self: true })) : tree)
    .map(({ item, children }) => {
      const kids = children.filter(c => matches(tab, c, [], myEmail));
      const self = matches(tab, item, children, myEmail);
      return self || kids.length ? { item, children: tab === 'all' ? children : kids, self } : null;
    })
    .filter(Boolean), [tree, suggested, myEmail]);

  const count = (tab) => filtered(tab).reduce((n, g) => n + (g.self ? 1 : 0) + g.children.length, 0);
  const counts = {
    mine: count('mine'), pending: count('pending'), signed: count('signed'), all: approved.length, suggested: suggested.length,
  };

  const [tab, setTab] = useState(null);
  const activeTab = tab || (counts.mine > 0 ? 'mine' : 'all');
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

  const [expanded, setExpanded] = useState(null);
  const [form, setForm] = useState(null);

  if (form) {
    return (
      <FeatureReviewForm
        parentId={form.parentId}
        onClose={onClose}
        onDone={(id) => { setForm(null); setTab('all'); if (id) setExpanded(id); }}
      />
    );
  }

  const row = (item, children, { child = false, context = false } = {}) => (
    <ReviewRow
      key={item.id}
      item={item}
      childItems={children}
      child={child}
      context={context}
      myEmail={myEmail}
      isManager={isManager}
      expanded={expanded === item.id}
      onToggle={() => setExpanded(v => (v === item.id ? null : item.id))}
      onExpand={() => setExpanded(item.id)}
      onOpen={() => { goTo(item.link); onClose(); }}
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
          <div className={`${styles.grid} ${styles.head}`} role="row">
            <span role="columnheader" className={styles.headFeature}>Feature</span>
            <span role="columnheader">Reviewers</span>
            <span role="columnheader">Status</span>
            <span role="columnheader" className={styles.headActions}>Actions</span>
          </div>
        )}
      </div>
      {loading || !fetched ? (
        <div className={styles.padded}><CardSkeleton count={4} /></div>
      ) : days.length === 0 ? (
        <EmptyState icon="solar:clipboard-check-linear" {...EMPTY[activeTab]} />
      ) : (
        <div className={styles.table} role="table" aria-label="Design signoff">
          {days.map(day => (
            <section key={day.key} aria-label={day.label}>
              <div className={styles.dayRow}>{day.label}</div>
              {day.groups.map(({ item, children, self }) => (
                <div key={item.id} className={styles.group}>
                  {row(item, children, { context: !self })}
                  {children.map(c => row(c, [], { child: true }))}
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </Drawer>
  );
}

const SHORT_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// When the item was fully signed: the last reviewer's signature, or the last
// sub-item's for a parent with no reviewers of its own.
function signedOn(item, childItems) {
  const times = (item.reviewers.length ? [item] : childItems)
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
  if (!item.reviewers.length) {
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
  item, childItems, child, context, myEmail, isManager, expanded, onToggle, onExpand, onOpen, onAddSubItem,
}) {
  const signOff = useAppStore(s => s.signOffFeatureReview);
  const keep = useAppStore(s => s.keepFeatureReview);
  const remove = useAppStore(s => s.removeFeatureReview);
  const suggestion = item.status === 'suggested';
  const mine = suggestion ? null : mySignoff(item, myEmail);
  const [signing, setSigning] = useState(false);
  const [commenting, setCommenting] = useState(false);
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

  const handleSignOff = async () => {
    setSigning(true);
    const ok = await signOff(mine.id);
    setSigning(false);
    if (ok) toast.success('Signed off');
  };

  const rowCls = [
    styles.grid,
    styles.row,
    expanded ? styles.rowExpanded : '',
    context ? styles.contextRow : '',
  ].filter(Boolean).join(' ');

  const showSignOff = !!mine && !mine.signedAt;
  const showOpen = !suggestion && !!item.link;

  return (
    <div className={styles.item}>
      <div className={rowCls} role="row">
        <div className={[styles.featureCell, child ? styles.childCell : ''].filter(Boolean).join(' ')} role="cell">
          <button type="button" className={styles.rowMain} aria-expanded={expanded} onClick={onToggle}>
            <DownChevronIcon size={16} className={[styles.chevron, expanded ? styles.chevronOpen : ''].filter(Boolean).join(' ')} />
            <span className={styles.rowText}>
              <span className={styles.rowTitle} title={item.title}>{item.title}</span>
              {(item.area || item.kind === 'fix') && (
                <span className={styles.rowMeta}>
                  {item.kind === 'fix' ? 'Bug fix' : null}
                  {item.kind === 'fix' && item.area && !child ? ' · ' : null}
                  {!child ? item.area : null}
                </span>
              )}
            </span>
          </button>
        </div>
        <div role="cell" ref={setReviewersCell}>
          <ReviewerAvatars
            item={item}
            editable={isManager}
            onEdit={(rect) => setPickerRect(rect)}
          />
          {pickerRect && <ReviewerPicker item={item} anchorRect={pickerRect} onClose={() => setPickerRect(null)} />}
        </div>
        <div role="cell"><ReviewStatus item={item} childItems={childItems} /></div>
        {suggestion && isManager ? (
          <div className={styles.actions} role="cell">
            <ActionButton size="S" icon="solar:trash-bin-minimalistic-linear" tooltip="Remove from the list" tooltipLeft onClick={() => remove(item.id)} />
            <Button variant="secondary" size="S" leadingIcon="solar:check-read-linear" onClick={handleKeep}>Keep</Button>
          </div>
        ) : (
          // Fixed slots (Sign off · divider · comment · divider · open) so each control
          // sits in the same place on every row, present or not.
          <div className={styles.actionSlots} role="cell">
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
              {showOpen && <ActionButton size="S" icon="solar:arrow-right-up-linear" tooltip="Open section" tooltipLeft onClick={onOpen} />}
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

function ReviewerPicker({ item, anchorRect, onClose }) {
  const setFeatureReviewers = useAppStore(s => s.setFeatureReviewers);
  const { options, byEmail } = useReviewerOptions();
  const users = useMemo(() => options.map(o => ({ id: o.value, name: o.label, role: o.value })), [options]);
  const selected = item.reviewers.map(r => r.email.toLowerCase());
  const signed = new Set(item.reviewers.filter(r => r.signedAt).map(r => r.email.toLowerCase()));

  const onSelect = (emails) => {
    const next = emails.map(String);
    if ([...signed].some(e => !next.includes(e))) {
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
    />
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
  const [draft, setDraft] = useState(signoff.comment);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    if (draft.trim() === signoff.comment) { onDone(); return; }
    setSaving(true);
    const ok = await commentFeatureReview(signoff.id, draft.trim());
    setSaving(false);
    if (ok) onDone();
  };

  return (
    <div className={styles.commentBox}>
      <Textarea
        autoFocus
        rows={3}
        placeholder="Add a comment for this review"
        value={draft}
        onChange={e => setDraft(e.target.value)}
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
