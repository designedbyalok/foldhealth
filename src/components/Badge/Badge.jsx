import { Icon } from '../Icon/Icon';
import { DownChevronIcon } from '../Icon/DownChevronIcon';
import styles from './Badge.module.css';

// Badges always render icons in the linear (line) weight: even if a caller
// hands in a filled/bold Solar name. Coerces `solar:foo-bold` → `solar:foo-linear`.
function toLinear(name) {
  if (typeof name !== 'string') return name;
  return name.replace(/-bold$/, '-linear').replace(/-bold(-duotone|-outline)?$/, '-linear');
}

// Any down-chevron Solar name, regardless of weight, routes to the shared
// DownChevronIcon so the popover-trigger chevron reads the same everywhere.
function isDownChevron(name) {
  return typeof name === 'string' && /alt-arrow-down|arrow-down|angle-down|chevron-down/.test(name);
}

const TONES = new Set(['neutral', 'primary', 'secondary', 'success', 'warning', 'danger', 'info', 'magenta', 'unity']);
const VARIANTS = new Set(['soft', 'outline', 'ghost', 'solid']);
const SIZE_CLASS = { xs: 'sizeXS', sm: 'sizeS', md: 'sizeM', lg: 'sizeL' };
// Icons scale with the badge; unsized badges keep the compact 13px.
const ICON_SIZE = { xs: 12, sm: 14, md: 16, lg: 20 };

// The names from before the variant / tone split, still accepted at runtime
// (one dev warning each) so values from data keep rendering.
const LEGACY_TONE = {
  grey: { tone: 'neutral' },
  white: { tone: 'neutral', variant: 'outline' },
  ghost: { tone: 'neutral', variant: 'ghost' },
  error: { tone: 'danger' },
  green: { tone: 'success' },
  disabled: { disabled: true },
};
const LEGACY_SIZE = { XS: 'xs', S: 'sm', M: 'md', L: 'lg' };
// Feature looks that used to live in this file. Each is the soft look of a
// tone; features now keep their own status → tone maps.
const LEGACY_VARIANT = {
  notification: { tone: 'secondary', variant: 'solid' },
  'lace-high': 'danger', 'lace-medium': 'warning', 'lace-low': 'success',
  'toc-enrolled': 'success', 'toc-engaged': 'info', 'toc-attempted': 'warning', 'toc-new': 'neutral', 'toc-oncall': 'primary',
  'status-ready': 'success', 'status-completed': 'success', 'status-oncall': 'success', 'status-scheduled': 'info',
  'status-queued': 'warning', 'status-failed': 'danger', 'status-review': 'warning',
  'ai-risk': 'danger', 'ai-care': 'primary', 'ai-social': 'warning', 'ai-med': 'success', 'ai-neutral': 'neutral',
  'outreach-48h': 'danger', 'outreach-7d': 'info',
  yes: 'danger', no: 'neutral', overflow: 'neutral',
  'dos-source-documents': 'neutral', 'dos-source-claims': 'primary', 'dos-source-manual': 'secondary',
  'care-plan-none': 'neutral', 'care-plan-updated': 'success', 'care-plan-pending': 'warning',
  'awv-open': 'info', 'awv-new': 'info', 'awv-unable': 'neutral', 'awv-engaged': 'success', 'awv-attempted': 'warning', 'awv-engaged-followup': 'warning',
  'compliance-pass': 'success', 'compliance-fail': 'danger', 'compliance-warn': 'warning', 'compliance-na': 'neutral', 'compliance-emergency': 'danger',
  'priority-critical': 'danger', 'priority-high': 'secondary', 'priority-medium': 'warning', 'priority-low': 'neutral',
  'outreach-appointment': 'info', 'outreach-refill': 'success', 'outreach-care-gap': 'warning', 'outreach-post-visit': 'primary', 'outreach-waitlist': 'neutral',
  'quality-good': 'success', 'quality-fair': 'warning', 'quality-poor': 'danger',
  'sentiment-positive': 'success', 'sentiment-neutral': 'neutral', 'sentiment-negative': 'danger',
  'health-ok': 'success', 'health-degraded': 'warning', 'health-down': 'danger',
};

const warned = new Set();
function warnLegacy(prop, value, next) {
  if (!import.meta.env?.DEV || warned.has(`${prop}=${value}`)) return;
  warned.add(`${prop}=${value}`);
  console.warn(`Badge: ${prop}="${value}" is deprecated; use ${next}. See docs/components/library-contract.mdx.`);
}

function resolveLook({ tone, variant, size, disabled }) {
  let t = tone;
  let v = variant;
  let d = disabled;
  if (LEGACY_TONE[t]) {
    const m = LEGACY_TONE[t];
    warnLegacy('tone', t, m.disabled ? 'disabled' : `tone="${m.tone}"${m.variant ? ` variant="${m.variant}"` : ''}`);
    [t, v, d] = [m.tone, v ?? m.variant, d || m.disabled];
  }
  // An old look name can also arrive through `tone` (a table rewritten from
  // variant= to tone= that still holds one).
  if (!TONES.has(t) && LEGACY_VARIANT[t] && !(v && LEGACY_VARIANT[v])) [t, v] = [undefined, t];
  if (v && !VARIANTS.has(v) && LEGACY_VARIANT[v]) {
    const m = typeof LEGACY_VARIANT[v] === 'string' ? { tone: LEGACY_VARIANT[v] } : LEGACY_VARIANT[v];
    warnLegacy('variant', v, `tone="${m.tone}"${m.variant ? ` variant="${m.variant}"` : ''}`);
    [t, v] = [m.tone, m.variant];
  }
  let z = size;
  if (LEGACY_SIZE[z]) {
    warnLegacy('size', z, `size="${LEGACY_SIZE[z]}"`);
    z = LEGACY_SIZE[z];
  }
  return {
    tone: TONES.has(t) ? t : 'neutral',
    variant: VARIANTS.has(v) ? v : 'soft',
    size: SIZE_CLASS[z] ? z : undefined,
    disabled: Boolean(d),
  };
}

/**
 * Badge: small colored pill for status, category, count, or tag values.
 * Figma "Fold Pixel 1.0" Badge, node 24:1678.
 *
 * Statuses are a feature concern: a feature maps its own values to a tone
 * (see docs/components/library-contract.mdx), the Badge only paints it.
 *
 * @param {'neutral'|'primary'|'secondary'|'success'|'warning'|'danger'|'info'|'magenta'|'unity'} [props.tone='neutral']
 *   Intent. `secondary` is the orange brand accent, `magenta` the Out of Office
 *   pink, `unity` the AI gradient text.
 * @param {'soft'|'outline'|'ghost'|'solid'} [props.variant='soft'] – Emphasis: tinted fill,
 *   white with a border, bare text, or a filled count pill.
 * @param {'xs'|'sm'|'md'|'lg'} [props.size] – 18 / 20 / 24 / 28px. Unset keeps the compact
 *   unsized badge (about 18px) existing rows were built around.
 * @param {boolean} [props.disabled=false] – Muted, for a value that doesn't apply.
 * @param {boolean} [props.hover=false]    – Force the hover look (Storybook demos).
 *
 * Slots: `label`, `dot` (leading dot), `icon` (leading Solar name),
 * `trailingIcon` / `trailingIconElement` (a dismiss button when
 * `onTrailingIconClick` is set), `chevron` (popover-trigger chevron).
 * Badges you can act on (chevron or dismiss) tint on hover; others stay still.
 */
export function Badge({
  tone: toneProp,
  variant: variantProp,
  size: sizeProp,
  disabled: disabledProp = false,
  hover = false,
  label,
  icon,
  trailingIcon,
  trailingIconElement,
  onTrailingIconClick,
  trailingIconLabel,
  chevron = false,
  dot,
  className,
  style,
}) {
  const { tone, variant, size, disabled } = resolveLook({ tone: toneProp, variant: variantProp, size: sizeProp, disabled: disabledProp });
  const interactive = (chevron || onTrailingIconClick) && !disabled;
  const iconPx = ICON_SIZE[size] ?? 13;

  return (
    <span
      className={[
        styles.badge,
        size ? styles[SIZE_CLASS[size]] : '',
        styles[variant],
        disabled ? styles.disabled : '',
        hover ? styles.hover : '',
        interactive ? styles.interactive : '',
        className || '',
      ].filter(Boolean).join(' ')}
      data-tone={tone}
      style={style}
    >
      {dot && <span className={styles.dot} />}
      {icon && (
        isDownChevron(icon)
          ? <DownChevronIcon size={iconPx} color="currentColor" />
          // currentColor: a custom glyph (e.g. custom:barrier) takes the badge's
          // tone like a Solar icon does, instead of its own default fill.
          : <Icon name={toLinear(icon)} size={iconPx} color="currentColor" />
      )}
      {tone === 'unity' && variant !== 'solid' && label != null ? <span className={styles.unityText}>{label}</span> : label}
      {trailingIconElement && (
        onTrailingIconClick ? (
          <button
            type="button"
            className={styles.trailingButton}
            aria-label={trailingIconLabel || 'Remove'}
            onClick={(e) => { e.stopPropagation(); onTrailingIconClick(e); }}
          >
            {trailingIconElement}
          </button>
        ) : trailingIconElement
      )}
      {!trailingIconElement && trailingIcon && (
        onTrailingIconClick ? (
          <button
            type="button"
            className={styles.trailingButton}
            aria-label={trailingIconLabel || 'Remove'}
            onClick={(e) => { e.stopPropagation(); onTrailingIconClick(e); }}
          >
            {isDownChevron(trailingIcon)
              ? <DownChevronIcon size={iconPx} color="currentColor" />
              : <Icon name={toLinear(trailingIcon)} size={iconPx} />}
          </button>
        ) : (
          isDownChevron(trailingIcon)
            ? <DownChevronIcon size={iconPx} color="currentColor" />
            : <Icon name={toLinear(trailingIcon)} size={iconPx} />
        )
      )}
      {!trailingIconElement && !trailingIcon && chevron && (
        <DownChevronIcon size={iconPx} color="currentColor" />
      )}
    </span>
  );
}
