import { InlineEditable } from './InlineEditable';
import { sanitizeEmailHtml } from '../../lib/sanitizeHtml';
import { tintSvgMarkup } from './svgTint';
import { paddingCss, bgProps, applyBorder } from './PreviewCanvas.utils';
import { renderLeafBlock } from './PreviewCanvasBlockLeaf';
import { InlineTable } from './PreviewCanvasInlineTable';
import { ContainerResizeHandle } from './PreviewCanvasResize';
import { Reader } from '@usewaypoint/email-builder';
import styles from './EmailBuilder.module.css';

const CONTAINER_V_ALIGN = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
const CONTAINER_H_ALIGN = { left: 'flex-start', center: 'center', right: 'flex-end' };

export function BlockBody({ id, block, ctx, dragAttributes, dragListeners }) {
  const { type, data } = block;
  const props = data?.props || {};
  const style = data?.style || {};

  if (type === 'Heading' || type === 'Text') {
    return (
      <InlineEditable
        blockId={id}
        type={type}
        level={props.level}
        listStyle={props.listStyle}
        text={props.text || ''}
        style={style}
        onCommit={ctx.commitText}
      />
    );
  }

  // Raw HTML escape hatch: the parser emits these when it detects an
  // imported subtree that's too bespoke to faithfully model as blocks
  // (deeply nested table mockups, bar charts assembled from stacked
  // cells, etc.). Users can also drop them in from the components panel
  // for arbitrary HTML they need to keep verbatim. dangerouslySetInnerHTML
  // is safe here: the parser strips <script> before walking and the
  // user is the trust boundary for what they paste.
  if (type === 'RawHtml') {
    return (
      <div
        style={{
          padding: paddingCss(style.padding),
          textAlign: style.blockAlign || style.textAlign,
        }}
        // Preview only: this renders in our origin, so a <script> pasted by
        // one teammate would otherwise execute for everyone who opens the
        // campaign. The exported email still uses the author's raw markup.
        dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(props.html) }}
      />
    );
  }

  if (type === 'Container') {
    const isSelected = ctx.selectedBlockId === id;
    const heightMode = props.heightMode || 'hug';
    // bgProps() routes gradients to backgroundImage and solids to
    // backgroundColor. If the user has a Background Image set, it
    // overrides whatever's in bgColor.
    const containerStyle = {
      position: 'relative',
      ...bgProps(style.backgroundColor),
      ...(style.backgroundImage ? {
        backgroundImage: `url(${style.backgroundImage})`,
        backgroundSize: style.backgroundSize || 'cover',
        backgroundPosition: style.backgroundPosition || 'center',
        backgroundRepeat: style.backgroundRepeat || 'no-repeat',
      } : {}),
      padding: paddingCss(style.padding),
      color: style.color,
      borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
    };
    applyBorder(containerStyle, style);
    // Centred-email + hero-section fidelity. `max-width` paired with
    // auto side margins is the standard centring pattern; `min-height`
    // lets a hero hold its height even when content is short. The parser
    // emits these from CSS classes that the original HTML used; without
    // the fields here they were silently dropped on the canvas.
    if (style.maxWidth) {
      containerStyle.maxWidth = typeof style.maxWidth === 'number' ? `${style.maxWidth}px` : style.maxWidth;
      containerStyle.marginLeft = 'auto';
      containerStyle.marginRight = 'auto';
    }
    if (style.minHeight) {
      containerStyle.minHeight = typeof style.minHeight === 'number' ? `${style.minHeight}px` : style.minHeight;
    }
    // SVG tint for backgroundImage: substitute fills inline and emit
    // as a data-URI so the existing background-image: url(…) path keeps
    // working without changing CSS plumbing.
    if (style.bgSvgRaw && style.bgTintColor) {
      const tinted = tintSvgMarkup(style.bgSvgRaw, style.bgTintColor);
      containerStyle.backgroundImage = `url("data:image/svg+xml;utf8,${encodeURIComponent(tinted)}")`;
      containerStyle.backgroundSize = style.backgroundSize || 'contain';
      containerStyle.backgroundPosition = style.backgroundPosition || 'center';
      containerStyle.backgroundRepeat = style.backgroundRepeat || 'no-repeat';
    }
    if (heightMode === 'fixed' && props.height) {
      // Fixed-height containers position their child content via flex
      // instead of scrolling. contentAlignH/contentAlign (left/center/
      // right + top/middle/bottom) map to justify- and align-items so
      // the user can park content in any of 9 spots. overflow-x: hidden
      // stops a too-wide child (e.g. a background gradient bleed) from
      // forcing a horizontal scrollbar inside the container.
      containerStyle.height = typeof props.height === 'number' ? `${props.height}px` : props.height;
      containerStyle.overflow = 'hidden';
      containerStyle.display = 'flex';
      containerStyle.flexDirection = 'column';
      containerStyle.minWidth = 0;
      containerStyle.justifyContent = CONTAINER_V_ALIGN[props.contentAlign] || 'flex-start';
      containerStyle.alignItems = CONTAINER_H_ALIGN[props.contentAlignH] || 'stretch';
    }
    const isNestTarget = ctx.dropIndicator?.isNest && ctx.dropIndicator?.parentId === id;
    return (
      <div style={containerStyle} className={isNestTarget ? styles.dropNestTarget : undefined}>
        {ctx.renderChildList(id, undefined, props.childrenIds || [], style.gap)}
        {isSelected && <ContainerResizeHandle id={id} block={block} updateBlock={ctx.updateBlock} />}
      </div>
    );
  }

  if (type === 'ColumnsContainer') {
    const isSelected = ctx.selectedBlockId === id;
    const heightMode = props.heightMode || 'hug';
    const cols = props.columns || [];
    const count = props.columnsCount || cols.length || 2;
    const hGap = props.columnsGap ?? 16;
    const vGap = props.rowGap ?? 0;
    const align = props.contentAlignment || 'top';
    const direction = props.direction || 'row';
    const wrap = props.flexWrap || 'nowrap';
    const visible = cols.slice(0, count);
    const columnWidths = props.columnWidths || Array.from({ length: count }, () => Math.round(10000 / count) / 100);
    const colsStyle = {
      position: 'relative',
      display: 'flex',
      flexDirection: direction,
      flexWrap: wrap,
      alignItems: align === 'top' ? 'flex-start' : align === 'middle' ? 'center' : 'flex-end',
      gap: `${vGap}px ${hGap}px`,
      padding: paddingCss(style.padding),
      ...bgProps(style.backgroundColor),
      ...(style.backgroundImage ? {
        backgroundImage: `url(${style.backgroundImage})`,
        backgroundSize: style.backgroundSize || 'cover',
        backgroundPosition: style.backgroundPosition || 'center',
        backgroundRepeat: style.backgroundRepeat || 'no-repeat',
      } : {}),
      borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
    };
    applyBorder(colsStyle, style);
    if (style.bgSvgRaw && style.bgTintColor) {
      const tinted = tintSvgMarkup(style.bgSvgRaw, style.bgTintColor);
      colsStyle.backgroundImage = `url("data:image/svg+xml;utf8,${encodeURIComponent(tinted)}")`;
      colsStyle.backgroundSize = style.backgroundSize || 'contain';
      colsStyle.backgroundPosition = style.backgroundPosition || 'center';
      colsStyle.backgroundRepeat = style.backgroundRepeat || 'no-repeat';
    }
    if (heightMode === 'fixed' && props.height) {
      colsStyle.height = typeof props.height === 'number' ? `${props.height}px` : props.height;
      colsStyle.overflow = 'hidden';
    }
    const isColumn = direction === 'column';
    const totalGap = hGap * (count - 1);
    const isNestTargetCols = ctx.dropIndicator?.isNest && ctx.dropIndicator?.parentId === id;
    return (
      <div style={colsStyle} className={isNestTargetCols ? styles.dropNestTarget : undefined}>
        {visible.map((col, idx) => {
          const w = columnWidths[idx] || (100 / count);
          // In row direction the column-width % drives flex-basis along the
          // main (horizontal) axis. When the user flips direction to column,
          // the main axis is vertical: applying the % there would size each
          // column as a fraction of the parent's height (≈0 in hug mode), so
          // every column would collapse. Stack them at full width instead.
          const colAlign = col?.align || 'left';
          const colValign = col?.valign || 'top';
          const vMap = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
          const isColSelected = ctx.selectedBlockId === id && ctx.selectedColumnIdx === idx;
          const colPad = col?.padding;
          const colBg = col?.backgroundColor;
          const itemStyle = isColumn
            ? { width: '100%', minWidth: 0, textAlign: colAlign, display: 'flex', flexDirection: 'column', justifyContent: vMap[colValign] || 'flex-start' }
            : { flex: `0 0 calc(${w}% - ${totalGap * w / 100}px)`, minWidth: 0, textAlign: colAlign, display: 'flex', flexDirection: 'column', justifyContent: vMap[colValign] || 'flex-start' };
          const colHeight = col?.heightMode || 'hug';
          if (colHeight === 'fill') {
            itemStyle.alignSelf = 'stretch';
          } else if (colHeight === 'custom' && col?.customHeight) {
            itemStyle.height = typeof col.customHeight === 'number' ? `${col.customHeight}px` : col.customHeight;
            itemStyle.overflow = 'hidden';
          }
          if (colPad) {
            itemStyle.padding = `${colPad.top || 0}px ${colPad.right || 0}px ${colPad.bottom || 0}px ${colPad.left || 0}px`;
          }
          if (colBg) itemStyle.backgroundColor = colBg;
          return (
            <div
              key={idx}
              style={itemStyle}
              className={isColSelected ? styles.selectedColumn : undefined}
              onClick={(e) => { e.stopPropagation(); ctx.selectColumn(id, idx); }}
            >
              {ctx.renderChildList(id, idx, col?.childrenIds || [], style.gap)}
            </div>
          );
        })}
        {isSelected && <ContainerResizeHandle id={id} block={block} updateBlock={ctx.updateBlock} />}
      </div>
    );
  }

  const leaf = renderLeafBlock(type, ctx, { id, props, style, block });
  if (leaf) return leaf;

  if (type === 'Table') {
    return <InlineTable id={id} props={props} style={style} commitTable={ctx.commitTable} />;
  }

  // Other primitives: delegate to Reader.
  return <Reader document={ctx.doc} rootBlockId={id} />;
}
