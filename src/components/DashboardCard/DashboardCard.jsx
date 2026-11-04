import { Icon } from '../Icon/Icon';
import { Skeleton } from '../Skeleton/Skeleton';
import styles from './DashboardCard.module.css';

/**
 * DashboardCard: a bordered card for dashboard grids (the patient Overview).
 * Leading icon, title and optional count on the left, actions on the right,
 * then the body and an optional footer strip.
 *
 * `tone="ai"` is the Unity-generated treatment: a soft AI gradient wash, a
 * lilac border and a gradient title. Pair it with `icon="custom:ai"`.
 *
 * The body has no padding of its own so a card can hold edge-to-edge content
 * (tabs, a chart); wrap padded content in `<DashboardCardBody>`.
 *
 * @param {object} props
 * @param {string} [props.icon]                 Solar icon name (or custom:ai)
 * @param {React.ReactNode} props.title
 * @param {React.ReactNode} [props.count]       Muted count after the title
 * @param {React.ReactNode} [props.tabs]        Tabs beside the title
 * @param {React.ReactNode} [props.actions]     Right side of the header
 * @param {'default'|'ai'} [props.tone='default']
 * @param {'M'|'S'} [props.size='M']        S: a 14px title, for cards inside a drawer
 *                                             or side panel where 16px outranks the
 *                                             panel's own heading
 * @param {React.ReactNode} [props.footer]
 * @param {string} [props.className]
 */
export function DashboardCard({ icon, title, count, tabs, actions, tone = 'default', size = 'M', footer, className, children }) {
  const ai = tone === 'ai';
  return (
    <section className={[styles.card, ai ? styles.ai : '', className].filter(Boolean).join(' ')}>
      <header className={styles.header}>
        {icon && <Icon name={icon} size={16} color={ai ? undefined : 'var(--neutral-300)'} />}
        <h3 className={[styles.title, size === 'S' ? styles.titleS : '', ai ? styles.aiTitle : ''].join(' ')}>{title}</h3>
        {count != null && <span className={styles.count}>{count}</span>}
        {tabs && <div className={styles.headerTabs}>{tabs}</div>}
        {actions && <div className={styles.actions}>{actions}</div>}
      </header>
      {children}
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </section>
  );
}

/**
 * Just the card frame, for content that brings its own header (a
 * PanelSection-based widget dropped into a dashboard grid).
 */
export function DashboardCardShell({ flush = false, className, children }) {
  return <section className={[styles.card, flush ? '' : styles.shell, className].filter(Boolean).join(' ')}>{children}</section>;
}

/** Loading placeholder with the card's real header, so the grid doesn't jump when data lands. */
export function DashboardCardSkeleton({ icon, title, rows = 3 }) {
  return (
    <DashboardCard icon={icon} title={title}>
      <div className={styles.skeleton} aria-busy="true" aria-label={`Loading ${title}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={styles.skeletonRow}>
            <Skeleton className={styles.boneTitle} />
            <Skeleton className={styles.boneMeta} />
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}

/** Padded body for a DashboardCard; rows inside share the card's inline inset. */
export function DashboardCardBody({ className, children }) {
  return <div className={[styles.body, className].filter(Boolean).join(' ')}>{children}</div>;
}
