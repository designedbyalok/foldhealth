import { useLayoutEffect, useRef, useState } from 'react';
import { Badge } from '../../../../../../../components/Badge/Badge';
import { Icon } from '../../../../../../../components/Icon/Icon';
import { PriorityIcon } from '../../../../../../../components/PriorityIcon/PriorityIcon';
import styles from './CarePlanView.module.css';

const CHIP_GAP = 4;

function TemplateBadge({
  template,
  templatePriority,
  version,
  isActive,
  canRemove,
  onSelect,
  onRemove,
}) {
  return (
    <button
      type="button"
      className={`${styles.appliedTemplateBadge} ${isActive ? styles.appliedTemplateBadgeActive : ''}`}
      aria-pressed={isActive}
      onClick={() => onSelect(template.id)}
      aria-label={`${templatePriority} priority, ${template.name}${version ? `, version ${version}` : ''}${isActive ? ', filter active' : ''}`}
    >
      <Badge
        tone={isActive ? 'primary' : 'grey'}
        size="S"
        label={(
          <>
            <PriorityIcon priority={templatePriority} size={12} />
            {template.name}
            {version && <span className={styles.runVersion}>V{version}</span>}
          </>
        )}
        trailingIconElement={canRemove ? (
          <span className={styles.appliedTemplateTrail}>
            {canRemove && (
              <span
                role="button"
                tabIndex={0}
                className={styles.appliedTemplateRemove}
                aria-label={`Remove ${template.name}`}
                onClick={(e) => onRemove(template.id, e)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onRemove(template.id, e); }}
              >
                <Icon name="solar:close-linear" size={12} color="var(--neutral-300)" />
              </span>
            )}
          </span>
        ) : undefined}
      />
    </button>
  );
}

/**
 * An earlier run of a reinstated template: done (check mark), its version,
 * and selecting it shows that run's goals, interventions and barriers.
 */
function RunBadge({ template, run, isActive, onSelect }) {
  const outcome = run.status === 'completed' ? 'completed' : 'closed';
  return (
    <button
      type="button"
      className={`${styles.appliedTemplateBadge} ${isActive ? styles.appliedTemplateBadgeActive : ''}`}
      aria-pressed={isActive}
      onClick={() => onSelect(`run:${run.id}`)}
      aria-label={`${template.name}, version ${run.version}, done (${outcome})${isActive ? ', showing' : ''}`}
      title={`Version ${run.version}, ${outcome === 'completed' ? 'completed' : 'closed'} when the template was added again`}
    >
      <Badge
        tone={isActive ? 'primary' : 'grey'}
        size="S"
        label={(
          <>
            <Icon name="solar:check-circle-linear" size={12} color={isActive ? 'var(--primary-300)' : 'var(--status-success)'} />
            <span className={styles.runDoneName}>{template.name}</span>
            <span className={styles.runVersion}>V{run.version}</span>
          </>
        )}
      />
    </button>
  );
}

/**
 * Applied templates in priority order (high → medium → low) on one row. When the row
 * overflows, a right-aligned "View More N" reveals the rest; expanded wraps
 * all templates and offers "View Less". Collapsed, the selected template
 * moves to the front so it never hides behind "View More".
 * `trailing` (the Templates action) sits at the row's end, so the strip also
 * renders when nothing is applied yet.
 *
 * `runsByTemplate`: { [templateId]: { version, previous: [{ id, version, status }] } }
 * for templates added again. The current run's chip shows its version (V2);
 * each earlier run follows it as a done chip (✓ V1). A selected id of
 * `run:<id>` is an earlier run.
 */
export function AppliedTemplateStrip({
  templates,
  appliedTemplatePriorities,
  templateFilterId,
  canRemove,
  onSelect,
  onRemove,
  trailing = null,
  runsByTemplate = {},
}) {
  const chipsRef = useRef(null);
  const measureRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(templates.length);
  const [hasOverflow, setHasOverflow] = useState(false);
  const selectedRunTemplate = typeof templateFilterId === 'string' && templateFilterId.startsWith('run:')
    ? templates.find(t => (runsByTemplate[t.id]?.previous || []).some(r => `run:${r.id}` === templateFilterId))
    : null;
  const selected = !expanded && templateFilterId
    ? selectedRunTemplate || templates.find(t => t.id === templateFilterId)
    : null;
  const ordered = selected ? [selected, ...templates.filter(t => t !== selected)] : templates;
  // One entry per chip: each template, then its earlier runs right after it.
  const entries = ordered.flatMap(t => [
    { key: t.id, template: t },
    ...(runsByTemplate[t.id]?.previous || []).map(run => ({ key: `run:${run.id}`, template: t, run })),
  ]);
  const templatesKey = entries.map(e => e.key).join('|');

  useLayoutEffect(() => {
    const row = chipsRef.current;
    const measure = measureRef.current;
    if (!row || !measure) return undefined;

    const recompute = () => {
      if (expanded) {
        setVisibleCount(entries.length);
        return;
      }

      const available = row.clientWidth;
      const children = [...measure.children];
      if (children.length < 2 || available === 0) return;

      const badgeEls = children.slice(0, -1);
      const viewMoreWidth = children[children.length - 1].offsetWidth;
      const widths = badgeEls.map(el => el.offsetWidth);

      const fitCount = (limit) => {
        let used = 0;
        let fit = 0;
        for (let i = 0; i < widths.length; i += 1) {
          const needed = used === 0 ? widths[i] : used + CHIP_GAP + widths[i];
          if (needed <= limit) {
            used = needed;
            fit += 1;
          } else {
            break;
          }
        }
        return { fit, used };
      };

      let { fit, used } = fitCount(available);
      if (fit >= widths.length) {
        setHasOverflow(false);
        setVisibleCount(widths.length);
        return;
      }

      const limit = available - CHIP_GAP - viewMoreWidth;
      ({ fit, used } = fitCount(limit));
      while (fit > 1 && used + CHIP_GAP + viewMoreWidth > available) {
        used -= CHIP_GAP + widths[fit - 1];
        fit -= 1;
      }

      setHasOverflow(true);
      setVisibleCount(Math.max(1, fit));
    };

    const ro = new ResizeObserver(recompute);
    ro.observe(row);
    const raf = requestAnimationFrame(recompute);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [templatesKey, expanded, entries.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (templates.length === 0) {
    if (!trailing) return null;
    return (
      <div className={styles.templatePriorityBar}>
        <div className={styles.priorityRow}>
          <span className={`${styles.priorityChips} ${styles.noTemplates}`}>No templates applied</span>
          {trailing}
        </div>
      </div>
    );
  }

  const shown = expanded ? entries : entries.slice(0, visibleCount);
  const hiddenCount = Math.max(0, entries.length - visibleCount);
  const renderEntry = (e, live) => (e.run ? (
    <RunBadge
      key={e.key}
      template={e.template}
      run={e.run}
      isActive={live && templateFilterId === e.key}
      onSelect={live ? onSelect : () => {}}
    />
  ) : (
    <TemplateBadge
      key={e.key}
      template={e.template}
      templatePriority={appliedTemplatePriorities[e.template.id] || 'medium'}
      version={runsByTemplate[e.template.id]?.version}
      isActive={live && templateFilterId === e.key}
      canRemove={canRemove}
      onSelect={live ? onSelect : () => {}}
      onRemove={live ? onRemove : () => {}}
    />
  ));

  return (
    <div className={styles.templatePriorityBar}>
      <div className={styles.priorityRow}>
        <div
          ref={chipsRef}
          className={`${styles.priorityChips} ${expanded ? '' : styles.priorityChipsCollapsed}`}
        >
          {shown.map(e => renderEntry(e, true))}
          <span ref={measureRef} className={styles.templateMeasure} aria-hidden="true">
            {entries.map(e => renderEntry(e, false))}
            <span className={styles.viewMoreMeasure}>
              View More {entries.length}
            </span>
          </span>
        </div>
        {hasOverflow && (
          <button
            type="button"
            className={styles.viewMoreLink}
            onClick={() => setExpanded(v => !v)}
          >
            {expanded ? 'View Less' : `View More ${hiddenCount}`}
          </button>
        )}
        {trailing}
      </div>
    </div>
  );
}
