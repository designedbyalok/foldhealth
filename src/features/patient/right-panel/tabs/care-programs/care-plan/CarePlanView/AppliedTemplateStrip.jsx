import { useLayoutEffect, useRef, useState } from 'react';
import { Badge } from '../../../../../../../components/Badge/Badge';
import { Icon } from '../../../../../../../components/Icon/Icon';
import { PriorityIcon } from '../../../../../../../components/PriorityIcon/PriorityIcon';
import styles from './CarePlanView.module.css';

const CHIP_GAP = 4;

function TemplateBadge({
  template,
  templatePriority,
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
      aria-label={`${templatePriority} priority, ${template.name}${isActive ? ', filter active' : ''}`}
    >
      <Badge
        tone={isActive ? 'primary' : 'grey'}
        size="S"
        label={(
          <>
            <PriorityIcon priority={templatePriority} size={12} />
            {template.name}
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
 * Applied templates in priority order (high → medium → low) on one row. When the row
 * overflows, a right-aligned "View More N" reveals the rest; expanded wraps
 * all templates and offers "View Less". Collapsed, the selected template
 * moves to the front so it never hides behind "View More".
 * `trailing` (the Templates action) sits at the row's end, so the strip also
 * renders when nothing is applied yet.
 */
export function AppliedTemplateStrip({
  templates,
  appliedTemplatePriorities,
  templateFilterId,
  canRemove,
  onSelect,
  onRemove,
  trailing = null,
}) {
  const chipsRef = useRef(null);
  const measureRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(templates.length);
  const [hasOverflow, setHasOverflow] = useState(false);
  const selected = !expanded && templateFilterId ? templates.find(t => t.id === templateFilterId) : null;
  const ordered = selected ? [selected, ...templates.filter(t => t !== selected)] : templates;
  const templatesKey = ordered.map(t => t.id).join('|');

  useLayoutEffect(() => {
    const row = chipsRef.current;
    const measure = measureRef.current;
    if (!row || !measure) return undefined;

    const recompute = () => {
      if (expanded) {
        setVisibleCount(templates.length);
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
  }, [templatesKey, expanded, templates.length]);

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

  const shown = expanded ? templates : ordered.slice(0, visibleCount);
  const hiddenCount = Math.max(0, templates.length - visibleCount);

  return (
    <div className={styles.templatePriorityBar}>
      <div className={styles.priorityRow}>
        <div
          ref={chipsRef}
          className={`${styles.priorityChips} ${expanded ? '' : styles.priorityChipsCollapsed}`}
        >
          {shown.map(t => {
            const templatePriority = appliedTemplatePriorities[t.id] || 'medium';
            return (
              <TemplateBadge
                key={t.id}
                template={t}
                templatePriority={templatePriority}
                isActive={templateFilterId === t.id}
                canRemove={canRemove}
                onSelect={onSelect}
                onRemove={onRemove}
              />
            );
          })}
          <span ref={measureRef} className={styles.templateMeasure} aria-hidden="true">
            {ordered.map(t => {
              const templatePriority = appliedTemplatePriorities[t.id] || 'medium';
              return (
                <TemplateBadge
                  key={t.id}
                  template={t}
                  templatePriority={templatePriority}
                  isActive={false}
                  canRemove={canRemove}
                    onSelect={() => {}}
                  onRemove={() => {}}
                />
              );
            })}
            <span className={styles.viewMoreMeasure}>
              View More {templates.length}
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
