import { useLayoutEffect, useRef, useState } from 'react';
import { Badge } from '../../../../../../../components/Badge/Badge';
import { Icon } from '../../../../../../../components/Icon/Icon';
import { PriorityIcon } from '../../../../../../../components/PriorityIcon/PriorityIcon';
import { UnityIcon } from '../../../../../../../components/UnityIcon/UnityIcon';
import styles from './CarePlanView.module.css';

const CHIP_GAP = 4;

function TemplateBadge({
  template,
  templatePriority,
  version,
  templateVersion,
  isActive,
  canRemove,
  onSelect,
  onRemove,
  disabled = false,
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`${styles.appliedTemplateBadge} ${isActive ? styles.appliedTemplateBadgeActive : ''}`}
      aria-pressed={isActive}
      onClick={() => onSelect(template.id)}
      aria-label={`${templatePriority} priority, ${template.name}${templateVersion?.category ? `, ${templateVersion.category}` : ''}${version ? `, version ${version}` : ''}${isActive ? ', filter active' : ''}`}
      title={templateVersion?.title}
    >
      <Badge
        tone={isActive ? 'primary' : 'grey'}
        size="S"
        label={(
          <>
            <PriorityIcon priority={templatePriority} size={12} />
            {template.name}
            {templateVersion?.category && <span className={styles.runVersion}>{templateVersion.category}</span>}
            {version && <span className={styles.runVersion}>V{version}</span>}
            {templateVersion?.pending && <Icon name="solar:refresh-circle-linear" size={12} color="var(--primary-300)" />}
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
 * An earlier run of a reinstated template, or of one moved to another
 * category: done (check mark), its version and category, and selecting it
 * shows that run's goals, interventions and barriers.
 */
function RunBadge({ template, run, isActive, onSelect, disabled = false }) {
  const outcome = run.status === 'completed' ? 'completed' : 'closed';
  const how = run.closeReason === 'episode_end' ? 'Episode ended on its last day'
    : run.closeReason === 'ended_early' ? 'Episode ended early'
      : `Version ${run.version}${run.categoryName ? `, ${run.categoryName}` : ''}, ${outcome} when the template was added again or changed category`;
  return (
    <button
      type="button"
      disabled={disabled}
      className={`${styles.appliedTemplateBadge} ${isActive ? styles.appliedTemplateBadgeActive : ''}`}
      aria-pressed={isActive}
      onClick={() => onSelect(`run:${run.id}`)}
      aria-label={`${template.name}${run.categoryName ? `, ${run.categoryName}` : ''}, version ${run.version}, done (${outcome})${isActive ? ', showing' : ''}`}
      title={how}
    >
      <Badge
        tone={isActive ? 'primary' : 'grey'}
        size="S"
        label={(
          <>
            <Icon name="solar:check-circle-linear" size={12} color={isActive ? 'var(--primary-300)' : 'var(--status-success)'} />
            <span className={styles.runDoneName}>{template.name}</span>
            {run.categoryName && <span className={styles.runVersion}>{run.categoryName}</span>}
            <span className={styles.runVersion}>V{run.version}</span>
          </>
        )}
      />
    </button>
  );
}

// A recommendation's template, applied when the recommended plan is approved.
function RecommendedBadge({ template }) {
  const by = template.automation ? `Matched by automation "${template.automation}". ` : '';
  return (
    <span className={styles.recommendedTemplate} title={`Recommended: applies when the plan is approved. ${by}${template.why || ''}`.trim()}>
      <Badge
        tone="primary"
        size="S"
        label={(
          <>
            <UnityIcon size={12} color="var(--primary-300)" />
            {template.name}
          </>
        )}
      />
    </span>
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
 * `runsByTemplate`: { [templateId]: { version, previous: [{ id, version, status, categoryName }] } }
 * for templates added again. The current run's chip shows its version (V2);
 * each earlier run follows it as a done chip (✓ V1). A selected id of
 * `run:<id>` is an earlier run. `historyTemplates` are templates no longer
 * on the plan (an episode that ended) whose earlier runs still show.
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
  historyTemplates = [],
  // { [templateId]: { title, pending, category } }: the template version each
  // run is on, and the category it went on with.
  templateVersions = {},
  // Past-version view: chips show, nothing filters or removes.
  readOnly = false,
  // A pending recommendation's templates ({ id, name, why, automation }),
  // shown ahead of the applied ones until the plan is approved.
  recommended = [],
}) {
  const chipsRef = useRef(null);
  const measureRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(templates.length);
  const [hasOverflow, setHasOverflow] = useState(false);
  const selectedRunTemplate = typeof templateFilterId === 'string' && templateFilterId.startsWith('run:')
    ? [...templates, ...historyTemplates].find(t => (runsByTemplate[t.id]?.previous || []).some(r => `run:${r.id}` === templateFilterId))
    : null;
  const selected = !expanded && templateFilterId
    ? selectedRunTemplate || templates.find(t => t.id === templateFilterId)
    : null;
  const all = [...templates, ...historyTemplates];
  const ordered = selected ? [selected, ...all.filter(t => t !== selected)] : all;
  const applied = new Set(templates.map(t => t.id));
  // One entry per chip: each template, then its earlier runs right after it.
  const entries = ordered.flatMap(t => [
    ...(applied.has(t.id) ? [{ key: t.id, template: t }] : []),
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

  const recommendedChips = recommended.length > 0 && (
    <span className={styles.recommendedTemplates} aria-label="Recommended templates">
      {recommended.map(t => <RecommendedBadge key={t.id} template={t} />)}
    </span>
  );

  if (entries.length === 0) {
    if (!trailing && !recommendedChips) return null;
    return (
      <div className={styles.templatePriorityBar}>
        <div className={styles.priorityRow}>
          {recommendedChips || <span className={`${styles.priorityChips} ${styles.noTemplates}`}>No templates applied</span>}
          {recommendedChips && <span className={styles.priorityChips} />}
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
      onSelect={live && !readOnly ? onSelect : () => {}}
      disabled={readOnly}
    />
  ) : (
    <TemplateBadge
      key={e.key}
      template={e.template}
      templatePriority={appliedTemplatePriorities[e.template.id] || 'medium'}
      version={runsByTemplate[e.template.id]?.version}
      templateVersion={templateVersions?.[e.template.id]}
      isActive={live && templateFilterId === e.key}
      canRemove={canRemove}
      onSelect={live && !readOnly ? onSelect : () => {}}
      onRemove={live && !readOnly ? onRemove : () => {}}
      disabled={readOnly}
    />
  ));

  return (
    <div className={styles.templatePriorityBar}>
      <div className={styles.priorityRow}>
        {recommendedChips}
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
