import { sanitizeSvg } from '../../lib/sanitizeHtml';
import { tintSvgMarkup } from './svgTint';
import { paddingCss, bgProps, BUTTON_SIZE_STYLES, BUTTON_PRESET_RADIUS, NO_IMAGE_PLACEHOLDER_STYLE } from './PreviewCanvas.utils';
import { ResizeWrap } from './PreviewCanvasResize';

/**
 * Renders one leaf block for the *builder canvas only* — the email that
 * actually gets sent is produced separately by renderEmailHtml(). Because
 * nothing here is navigable, link-shaped blocks (Button, Social, NavBar)
 * render as styled spans rather than anchors that swallow their own clicks;
 * the click still bubbles to the canvas so the block gets selected.
 */
export function renderLeafBlock(type, ctx, { id, props, style, block }) {
  if (type === 'Image') {
    const isSelected = ctx.selectedBlockId === id;
    const imgStyle = {
      display: 'block',
      width: props.width ?? '100%',
      borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
    };
    if (props.height) imgStyle.height = props.height;
    else imgStyle.height = 'auto';
    if (typeof imgStyle.width === 'number') imgStyle.width = `${imgStyle.width}px`;
    if (typeof imgStyle.height === 'number') imgStyle.height = `${imgStyle.height}px`;
    if (props.objectFit && props.objectFit !== 'fill') imgStyle.objectFit = props.objectFit;
    if (props.objectPosition && props.objectPosition !== 'center') imgStyle.objectPosition = props.objectPosition;

    // If we have raw SVG markup (set on upload of an .svg, or extracted
    // from imported inline SVGs in HTML), render it via dangerouslySetInnerHTML.
    // When a tintColor is also set, recolour the fills/strokes in-place.
    const hasSvg = props.svgRaw;
    const content = hasSvg ? (
      <div
        style={{ ...imgStyle, display: 'inline-block', lineHeight: 0 }}
        // svgRaw is fetched from a remote URL (or uploaded), and SVG can carry
        // <script>/on* handlers — sanitize after tinting, so the tint pass
        // can't reintroduce anything the sanitizer would have stripped.
        dangerouslySetInnerHTML={{
          __html: sanitizeSvg(props.tintColor ? tintSvgMarkup(props.svgRaw, props.tintColor) : props.svgRaw),
        }}
      />
    ) : props.url ? (
      <img src={props.url} alt={props.alt || ''} style={imgStyle} />
    ) : (
      <div style={{ ...NO_IMAGE_PLACEHOLDER_STYLE, width: imgStyle.width }}>
        No image
      </div>
    );

    return (
      <div style={{ padding: paddingCss(style.padding), textAlign: style.blockAlign || style.textAlign || 'center', ...bgProps(style.backgroundColor) }}>
        <ResizeWrap id={id} block={block} updateBlock={ctx.updateBlock} isSelected={isSelected} canWidth canHeight>
          {content}
        </ResizeWrap>
      </div>
    );
  }

  // Avatar
  if (type === 'Avatar') {
    const size = props.size || 64;
    const radius = props.shape === 'circle' ? '50%' : props.shape === 'rounded' ? 8 : 0;
    return (
      <div style={{ padding: paddingCss(style.padding), textAlign: style.blockAlign || style.textAlign || 'center' }}>
        {props.imageUrl && <img src={props.imageUrl} alt={props.alt || ''} style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover' }} />}
      </div>
    );
  }

  if (type === 'Divider') {
    const thickness = props.lineHeight || 1;
    const color = props.lineColor || 'var(--neutral-150)';
    const lineStyle = props.lineStyle || 'solid';
    const endLeft = props.endLeft || 'none';
    const endRight = props.endRight || 'none';
    const hasEndpoints = endLeft !== 'none' || endRight !== 'none';
    const markerSize = Math.max(8, thickness * 4);
    const orientation = props.orientation || 'horizontal';

    // Vertical dividers ignore the endpoint markers — they're a horizontal
    // pattern. Render a thin tall bar with an explicit height (defaults to
    // 40px, mirrors patchEmailHtml.js).
    if (orientation === 'vertical') {
      const h = props.height ?? 40;
      return (
        <div style={{ padding: paddingCss(style.padding), display: 'flex', justifyContent: style.blockAlign === 'left' ? 'flex-start' : style.blockAlign === 'right' ? 'flex-end' : 'center' }}>
          <div style={{
            width: `${thickness}px`,
            height: `${h}px`,
            borderLeft: `${thickness}px ${lineStyle} ${color}`,
          }} />
        </div>
      );
    }

    if (!hasEndpoints) {
      return (
        <div style={{ padding: paddingCss(style.padding) }}>
          <hr style={{ width: '100%', border: 'none', borderTop: `${thickness}px ${lineStyle} ${color}`, margin: 0 }} />
        </div>
      );
    }

    return (
      <div style={{ padding: paddingCss(style.padding) }}>
        <svg width="100%" height={markerSize + 2} style={{ display: 'block', overflow: 'visible' }}>
          <line
            x1={endLeft !== 'none' ? markerSize / 2 : 0}
            y1={(markerSize + 2) / 2}
            x2="100%"
            y2={(markerSize + 2) / 2}
            stroke={color}
            strokeWidth={thickness}
            strokeDasharray={lineStyle === 'dashed' ? `${thickness * 6} ${thickness * 4}` : 'none'}
          />
          {endLeft === 'circle' && (
            <circle cx={markerSize / 2} cy={(markerSize + 2) / 2} r={markerSize / 2 - 0.5} fill={color} />
          )}
          {endLeft === 'arrow' && (
            <polygon
              points={`0,${(markerSize + 2) / 2} ${markerSize},${1} ${markerSize},${markerSize + 1}`}
              fill={color}
            />
          )}
          {endRight === 'circle' && (
            <circle cx="100%" cy={(markerSize + 2) / 2} r={markerSize / 2 - 0.5} fill={color} style={{ transform: `translateX(-${markerSize / 2}px)` }} />
          )}
          {endRight === 'arrow' && (
            <polygon
              points={`0,1 0,${markerSize + 1} ${markerSize},${(markerSize + 2) / 2}`}
              fill={color}
              style={{ transform: `translateX(calc(100% - ${markerSize}px))` }}
            />
          )}
        </svg>
      </div>
    );
  }

  if (type === 'Spacer') {
    const isSelected = ctx.selectedBlockId === id;
    const h = props.height || 16;
    return (
      <ResizeWrap id={id} block={block} updateBlock={ctx.updateBlock} isSelected={isSelected} canWidth={false} canHeight>
        <div style={{ height: typeof h === 'number' ? `${h}px` : h, width: '100%' }} />
      </ResizeWrap>
    );
  }

  if (type === 'Button') {
    const sz = BUTTON_SIZE_STYLES[props.size || 'medium'] || BUTTON_SIZE_STYLES.medium;
    const radius = style.borderRadius ?? BUTTON_PRESET_RADIUS[props.buttonStyle || 'rectangle'] ?? 0;
    return (
      <div style={{ padding: paddingCss(style.padding), textAlign: style.blockAlign || style.textAlign || 'center' }}>
        <span
          style={{
            display: 'inline-block',
            padding: sz.padding,
            ...bgProps(props.buttonBackgroundColor || 'var(--primary-300)'),
            color: props.buttonTextColor || 'var(--neutral-0)',
            borderRadius: `${radius}px`,
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: sz.fontSize,
            fontFamily: 'inherit',
            border: props.borderWidth ? `${props.borderWidth}px solid ${props.borderColor || 'transparent'}` : 'none',
          }}
        >
          {props.text || 'Button'}
        </span>
      </div>
    );
  }

  if (type === 'Social') {
    const platforms = props.platforms || [];
    const iconSize = props.iconSize || 24;
    const gap = props.gap || 16;
    const alignment = props.alignment || 'center';
    return (
      <div style={{ padding: paddingCss(style.padding), textAlign: style.blockAlign || alignment, ...bgProps(style.backgroundColor) }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: `${gap}px`,
        }}>
          {platforms.map(p => (
            <span key={p.id} title={p.label} style={{ display: 'inline-flex' }}>
              {p.iconUrl
                ? <img src={p.iconUrl} alt={p.label} width={iconSize} height={iconSize} style={{ display: 'block' }} />
                : <div style={{ width: iconSize, height: iconSize, borderRadius: 4, border: '1px dashed var(--neutral-150)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--neutral-200)' }}>?</div>}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'NavBar') {
    const links = props.links || [];
    const gap = props.gap || 24;
    const alignment = props.alignment || 'center';
    const linkColor = props.linkColor || '#7C5CFA';
    const fontSize = props.fontSize || 14;
    const fontWeight = props.fontWeight || 'bold';
    return (
      <div style={{ padding: paddingCss(style.padding), textAlign: style.blockAlign || alignment, ...bgProps(style.backgroundColor) }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: `${gap}px`,
        }}>
          {links.map((link, i) => (
            <span
              key={i}
              style={{ color: linkColor, fontSize, fontWeight, textDecoration: 'none', fontFamily: 'inherit' }}
            >
              {link.label}
            </span>
          ))}
        </div>
      </div>
    );
  }
  return null;
}
