import { useState } from 'react';
import { Icon } from '../../../../../../components/Icon/Icon';
import { UnityPenToolIcon } from '../../../../../../components/Icon/UnityPenToolIcon';
import { Badge } from '../../../../../../components/Badge/Badge';
import { Avatar } from '../../../../../../components/Avatar/Avatar';
import { AvatarGroup } from '../../../../../../components/AvatarGroup/AvatarGroup';
import { ActivityLog, MetaLine, ViewMoreButton } from '../../../../../../components/ActivityLog/ActivityLog';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { historyTimelineStyles as htStyles } from '../../../../../../components/HistoryTimeline/HistoryTimeline';
import { carePlanLogItem } from '../../care-programs/care-plan/lib/carePlanLogItem';
import { activityIcon, STATUS_COLOR } from '../programActivity';
import styles from './ProgramActivityCard.module.css';

const OUTREACH_KINDS = new Set(['call', 'sms', 'email', 'chat', 'virtual', 'inperson', 'outreach']);
const OPENABLE_ITEMS = new Set(['goal', 'intervention', 'barrier']);

const toggleIn = (set, id) => {
  const next = new Set(set);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
};

/**
 * One calendar day in the Program Activity Log (Figma Care-Program-Overview
 * 108:140523): the date on the left, then that day's activities on the shared
 * ActivityLog, entry for entry as the Care Plan History draws them, each with
 * its program badge on the right. The log's own addition is stacking: a
 * program with several activities that day folds into one card (Figma
 * 50:98033) that opens into its entries.
 */
export function ProgramActivityDay({ day, onOpenVersion, versionGlance, onOpenItem }) {
  const [openStacks, setOpenStacks] = useState(() => new Set());
  const [openNotes, setOpenNotes] = useState(() => new Set());
  const [openVersions, setOpenVersions] = useState(() => new Set());

  const programBadge = code => (code ? <Badge tone="primary" size="XS" label={code} /> : null);

  // A signature is two entries, as in the Care Plan History: "Changes in Care
  // Plan", closed by the one-line signed marker. Hovering the first shows
  // "View more", which opens the version's summary card; the card's own open
  // arrow (and the marker's pill) open the version drawer.
  const toEntries = (item, programCode) => {
    if (!item.versionNumber) return [toEntry(item, programCode)];
    const meta = { time: item.time, by: item.actorName || null, role: item.actorRole || null };
    const open = openVersions.has(item.id);
    return [{
      id: `${item.id}-changes`,
      t: 'care_plan_version',
      avatar: <Avatar type="icon" variant="others" size="S" iconName="custom:care-plan" />,
      // The badge sits inside the entry, not in the trailing slot, so
      // hovering anywhere on it reveals "View more".
      render: () => (
        <div className={`${styles.versionEntry} ${open ? styles.versionEntryOpen : ''}`}>
          <div className={styles.versionMain}>
            <MetaLine entry={meta} />
            <div className={htStyles.headlineRow}>
              <span className={htStyles.headline}>Changes in Care Plan</span>
              <span className={styles.hoverReveal}>
                <ViewMoreButton expanded={open} onToggle={() => setOpenVersions(s => toggleIn(s, item.id))} leadingDot />
              </span>
            </div>
            {open && versionGlance?.(item)}
          </div>
          <span className={styles.versionRight}>
            {programBadge(programCode)}
          </span>
        </div>
      ),
    }, toEntry(item, programCode)];
  };

  const toEntry = (item, programCode) => {
    const meta = { time: item.time, by: item.actorName || null, role: item.actorRole || null };
    const trailing = programBadge(programCode);
    if (item.history) {
      // The plan version it happened on, as the Care Plan History's meta line
      // tags it: "v3" plus Current on the version the plan is on now.
      meta.context = item.planVersion == null ? 'Draft' : item.planVersionCurrent ? (
        <span className={styles.versionTag}>
          v{item.planVersion}
          <Badge size="S" tone="grey" label="Current" className={styles.currentBadge} />
        </span>
      ) : `v${item.planVersion}`;
      return {
        ...carePlanLogItem(item.history, {
          meta,
          noteOpen: openNotes.has(item.id),
          onToggleNote: () => setOpenNotes(s => toggleIn(s, item.id)),
        }),
        id: item.id,
        trailing,
        // Activity on a goal, intervention or barrier opens that item.
        trailingHover: OPENABLE_ITEMS.has(item.history.entityType) && item.history.entityId != null && onOpenItem ? (
          <ActionButton
            icon="solar:arrow-right-up-linear"
            size="S"
            tooltip={`Open ${item.history.entityType}`}
            tooltipLeft
            onClick={() => onOpenItem(item)}
          />
        ) : null,
      };
    }
    if (item.versionNumber) {
      // The signed marker (Figma ICD-Import 7121:161868): the Unity pen on the
      // rail, then time • the signature • who. Its pill opens the changes too.
      const role = item.actorRole ? ` (${item.actorRole})` : '';
      return {
        id: item.id,
        t: 'care_plan_signed',
        avatar: (
          <span className={styles.signedRailIcon}>
            <UnityPenToolIcon size={24} />
          </span>
        ),
        render: () => (
          <div className={styles.signedMarker}>
            {item.time && <span className={styles.signedMeta}>{item.time} •</span>}
            <button type="button" className={styles.signedPill} onClick={() => onOpenVersion?.(item)}>
              <span className={styles.signedPillText}>Care Plan Signed as Version {item.versionNumber}</span>
            </button>
            {item.actorName && <span className={styles.signedMeta}>• {item.actorName}{role}</span>}
          </div>
        ),
      };
    }
    const outreach = OUTREACH_KINDS.has(item.activityKind);
    return {
      id: item.id,
      t: outreach ? 'outreach' : 'program_event',
      icon: activityIcon(item.activityKind).icon,
      ...meta,
      title: item.title,
      outcome: item.statusLabel || undefined,
      outcomeColor: STATUS_COLOR[item.statusType] || undefined,
      trailing,
    };
  };

  const entries = day.entries.flatMap((entry) => {
    if (entry.type !== 'group') return toEntries(entry.items[0], entry.programCode);
    if (openStacks.has(entry.key)) {
      return [
        ...entry.items.flatMap(item => toEntries(item, entry.programCode)),
        {
          id: `${entry.key}-collapse`,
          t: 'stack_toggle',
          // No tile: the rail runs on, and the link branches off it.
          avatar: <span className={styles.railGap} aria-hidden />,
          render: () => (
            <button type="button" className={styles.toggleLink} onClick={() => setOpenStacks(s => toggleIn(s, entry.key))} aria-expanded>
              <span className={styles.branch} aria-hidden />
              <Icon name="solar:minimize-square-minimalistic-linear" size={16} color="var(--primary-300)" />
              Collapse
            </button>
          ),
        },
      ];
    }
    const layers = Math.min(2, entry.count - 1);
    const open = () => setOpenStacks(s => toggleIn(s, entry.key));
    return [{
      id: entry.key,
      t: 'stack',
      avatar: <Avatar variant="others" initials={String(entry.count)} size="S" />,
      render: () => (
        <>
          {/* Not a <button>: the avatars' "+N" chip inside is one. */}
          <div
            role="button"
            tabIndex={0}
            className={styles.stack}
            onClick={open}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              open();
            }}
            aria-expanded={false}
            aria-label={`Show ${entry.count} ${entry.programCode} activities`}
          >
            {layers >= 2 && <span className={`${styles.layer} ${styles.layer2}`} aria-hidden />}
            {layers >= 1 && <span className={`${styles.layer} ${styles.layer1}`} aria-hidden />}
            <span className={styles.summaryCard}>
              <span className={styles.summaryText}>
                <span className={styles.programTitle}>{entry.programName}</span>
                <span className={styles.summaryMeta}>
                  {entry.count} {entry.count === 1 ? 'Activity' : 'Activities'}
                  {entry.userCount > 0 && ` • ${entry.userCount} ${entry.userCount === 1 ? 'User' : 'Users'}`}
                </span>
              </span>
              <span className={styles.summaryRight}>
                <AvatarGroup people={entry.users} variant="staff" size="XS" max={3} />
                {programBadge(entry.programCode)}
              </span>
            </span>
          </div>
          <button type="button" className={styles.toggleLink} onClick={open} aria-expanded={false}>
            <span className={styles.branch} aria-hidden />
            <Icon name="solar:maximize-square-minimalistic-linear" size={16} color="var(--primary-300)" />
            See all activities
          </button>
        </>
      ),
    }];
  });

  return (
    <div className={styles.day}>
      <div className={styles.dateCol}>
        <span className={styles.date}>{day.date}</span>
        <Badge tone="grey" size="XS" label={day.day} />
      </div>
      <div className={styles.dayEntries}>
        <ActivityLog entries={entries} relaxed continuous />
      </div>
    </div>
  );
}
