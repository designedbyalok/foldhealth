import { useState, useEffect, useRef, useCallback, useLayoutEffect, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { renderEmailHtml } from './patchEmailHtml';
import { useAppStore } from '../../store/useAppStore';
import { Icon } from '../../components/Icon/Icon';
import { CloseButton } from '../../components/CloseButton/CloseButton';
import { Toggle } from '../../components/Toggle/Toggle';
import { Input } from '../../components/Input/Input';
import { Textarea } from '../../components/Textarea/Textarea';
import { Select as SharedSelect } from '../../components/Select/Select';
import { makeInitialDocument } from './initialDocument';
import { HEADER_PRESETS, FOOTER_PRESETS } from './headerFooterLibrary';
import { PresetLivePreview } from './PresetLivePreview';
import { extractSubtree, fingerprintTree } from './blockHelpers';
import { uploadImage } from './uploadImage';
import { GOOGLE_FONTS, injectGoogleFonts, availableWeights, normalizeWeight } from './googleFonts';
import { ColorPicker } from './ColorPicker';
import { ColorInput } from './ColorInput';
import { parseLineHeight, formatLineHeight, parseLetterSpacing, formatLetterSpacing } from './dimUnits';
import { parseHtmlToDocument, collectUnknownFonts } from './htmlToDocument';
import styles from './EmailBuilder.module.css';

import { getCommonValue } from './PropertiesPanel.utils.jsx';

const RADIUS_TYPES = new Set(['Button', 'Image', 'Container', 'ColumnsContainer']);
const TEXT_TYPES = new Set(['Heading', 'Text', 'Button']);
const BG_IMAGE_TYPES = new Set(['Container', 'ColumnsContainer']);
const BUTTON_STYLE_RADIUS = { rectangle: 0, rounded: 6, pill: 9999 };
const FONT_FAMILIES = GOOGLE_FONTS.map(f => ({ value: f.value, label: f.label }));
const FONT_WEIGHTS_FALLBACK = [
  { value: '400', label: 'Regular 400' },
  { value: '700', label: 'Bold 700' },
];
import { DesignTabBlocksPrimary } from './PropertiesPanelDesignTabBlocksPrimary';
import { DesignTabBlocksSecondary } from './PropertiesPanelDesignTabBlocksSecondary';
import { DesignTabLayout } from './PropertiesPanelDesignTabLayout';
import { DesignTabAppearance } from './PropertiesPanelDesignTabAppearance';
import { AlignBottomIcon, AlignCenterIcon, AlignJustifyIcon, AlignLeftIcon, AlignMiddleIcon, AlignRightIcon, AlignTopIcon, FieldLabel, HeightIcon, IconInput, PadBottomIcon, PadLeftIcon, PadRightIcon, PadTopIcon, PaddingControl, RadiusIcon, Row2, Section, SectionHeading, SelectInput } from './PropertiesPanelFields';

export function DesignTab({ block, updateBlock, id }) {
  const rootFontFamily = useAppStore(s => s.emailDocument?.root?.data?.fontFamily);
  if (!block) {
    return <div className={styles.emptyState}>Select a block</div>;
  }

  const update = (path, value) => {
    updateBlock(id, prev => {
      const next = structuredClone(prev);
      let target = next;
      for (let i = 0; i < path.length - 1; i++) {
        target[path[i]] = target[path[i]] ?? {};
        target = target[path[i]];
      }
      target[path[path.length - 1]] = value;
      return next;
    });
  };

  const isLayout = block.type === 'EmailLayout';
  const data = block.data || {};
  const props = data.props || {};
  const style = data.style || {};
  const padding = (style.padding ?? data.padding) || { top: 16, bottom: 16, left: 16, right: 16 };
  const ctx = { block, updateBlock, id, update, data, props, style, isLayout, padding, rootFontFamily };

  return (
    <div className={styles.designScroll}>
      <DesignTabBlocksPrimary ctx={ctx} />
      <DesignTabBlocksSecondary ctx={ctx} />
      <DesignTabLayout ctx={ctx} />
      <DesignTabAppearance ctx={ctx} />
    </div>
  );
}

export function ColumnDesignTab({ block, updateBlock, id, columnIdx }) {
  if (!block) return <div className={styles.emptyState}>Select a block</div>;
  const props = block.data?.props || {};
  const col = props.columns?.[columnIdx] || {};
  const colPadding = col.padding || { top: 0, right: 0, bottom: 0, left: 0 };

  const updateCol = (key, value) => {
    updateBlock(id, prev => {
      const next = structuredClone(prev);
      next.data = next.data || {};
      next.data.props = next.data.props || {};
      next.data.props.columns = next.data.props.columns || [];
      while (next.data.props.columns.length <= columnIdx) next.data.props.columns.push({ childrenIds: [] });
      next.data.props.columns[columnIdx][key] = value;
      return next;
    });
  };

  return (
    <div className={styles.designScroll}>
      <SectionHeading>Column {columnIdx + 1}</SectionHeading>
      <Section>
        <Row2>
          <div className={styles.fieldCol}>
            <span className={styles.fieldLabel}>Horizontal</span>
            <Toggle
              fullWidth
              size="S"
              items={[
                { key: 'left',   label: '', icon: <AlignLeftIcon /> },
                { key: 'center', label: '', icon: <AlignCenterIcon /> },
                { key: 'right',  label: '', icon: <AlignRightIcon /> },
              ]}
              active={col.align || 'left'}
              onChange={v => updateCol('align', v)}
            />
          </div>
          <div className={styles.fieldCol}>
            <span className={styles.fieldLabel}>Vertical</span>
            <Toggle
              fullWidth
              size="S"
              items={[
                { key: 'top',    label: '', icon: <AlignTopIcon /> },
                { key: 'middle', label: '', icon: <AlignMiddleIcon /> },
                { key: 'bottom', label: '', icon: <AlignBottomIcon /> },
              ]}
              active={col.valign || 'top'}
              onChange={v => updateCol('valign', v)}
            />
          </div>
        </Row2>

        <div className={styles.fieldCol}>
          <span className={styles.fieldLabel}>Height</span>
          <Toggle
            fullWidth
            size="S"
            items={[
              { key: 'hug',    label: 'Hug' },
              { key: 'fill',   label: 'Fill' },
              { key: 'custom', label: 'Custom' },
            ]}
            active={col.heightMode || 'hug'}
            onChange={v => updateCol('heightMode', v)}
          />
        </div>
        {col.heightMode === 'custom' && (
          <IconInput
            label="Value" suffix="px" icon={<HeightIcon />}
            value={col.customHeight ?? 200}
            onChange={v => updateCol('customHeight', parseFloat(v) || 0)}
          />
        )}

        <PaddingControl
          padding={colPadding}
          onChangeSide={(side, value) => {
            updateCol('padding', { ...colPadding, [side]: value });
          }}
          onChangeAll={(value) => {
            updateCol('padding', { top: value, right: value, bottom: value, left: value });
          }}
        />
        <ColorInput
          label="Background"
          value={col.backgroundColor || ''}
          onChange={v => updateCol('backgroundColor', v || '')}
        />
      </Section>
    </div>
  );
}

export function BulkDesignTab({ doc, bulkIds, updateBlock }) {
  const blocks = bulkIds.flatMap(id => { const b = doc?.[id]; return b ? [b] : []; });
  const clearBulk = useAppStore(s => s.setBulkSelectedIds);
  if (blocks.length === 0) return <div className={styles.emptyState}>No blocks selected</div>;

  const types = new Set(blocks.map(b => b.type));
  const allText = blocks.every(b => TEXT_TYPES.has(b.type));
  const allHaveRadius = blocks.every(b => RADIUS_TYPES.has(b.type));

  const bulkUpdate = (pathFn, value) => {
    bulkIds.forEach(id => {
      updateBlock(id, prev => {
        const next = structuredClone(prev);
        let target = next;
        const path = typeof pathFn === 'function' ? pathFn(prev) : pathFn;
        for (let i = 0; i < path.length - 1; i++) {
          target[path[i]] = target[path[i]] ?? {};
          target = target[path[i]];
        }
        target[path[path.length - 1]] = value;
        return next;
      });
    });
  };

  const commonPadding = {
    top: getCommonValue(blocks, b => b.data?.style?.padding?.top),
    bottom: getCommonValue(blocks, b => b.data?.style?.padding?.bottom),
    left: getCommonValue(blocks, b => b.data?.style?.padding?.left),
    right: getCommonValue(blocks, b => b.data?.style?.padding?.right),
  };

  return (
    <div className={styles.designScroll}>
      <div className={styles.bulkHeader}>
        <Icon name="solar:layers-linear" size={14} color="var(--primary-400)" />
        <span>{bulkIds.length} blocks selected</span>
        <CloseButton size={14} onClick={() => clearBulk([])} className={styles.bulkClear} label="Clear bulk selection" />
      </div>

      {/* ── Layout ── */}
      <SectionHeading>Layout</SectionHeading>
      <Section>
        <FieldLabel>Padding</FieldLabel>
        <Row2>
          <IconInput
            suffix="px" icon={<PadLeftIcon />}
            value={commonPadding.left ?? ''} onChange={v => bulkUpdate(['data', 'style', 'padding', 'left'], parseFloat(v) || 0)}
          />
          <IconInput
            suffix="px" icon={<PadTopIcon />}
            value={commonPadding.top ?? ''} onChange={v => bulkUpdate(['data', 'style', 'padding', 'top'], parseFloat(v) || 0)}
          />
        </Row2>
        <Row2>
          <IconInput
            suffix="px" icon={<PadRightIcon />}
            value={commonPadding.right ?? ''} onChange={v => bulkUpdate(['data', 'style', 'padding', 'right'], parseFloat(v) || 0)}
          />
          <IconInput
            suffix="px" icon={<PadBottomIcon />}
            value={commonPadding.bottom ?? ''} onChange={v => bulkUpdate(['data', 'style', 'padding', 'bottom'], parseFloat(v) || 0)}
          />
        </Row2>
        {allHaveRadius && (
          <Row2>
            <IconInput
              label="Radius" suffix="px" icon={<RadiusIcon />}
              value={getCommonValue(blocks, b => b.data?.style?.borderRadius) ?? ''}
              onChange={v => bulkUpdate(['data', 'style', 'borderRadius'], parseFloat(v) || 0)}
            />
          </Row2>
        )}
      </Section>

      {/* ── Color ── */}
      <SectionHeading>Color</SectionHeading>
      <Section>
        <Row2>
          {allText && (
            <ColorInput
              label="Text Color"
              value={getCommonValue(blocks, b => b.type === 'Button' ? b.data?.props?.buttonTextColor : b.data?.style?.color) || ''}
              onChange={v => {
                bulkIds.forEach(id => {
                  const blk = doc[id];
                  const path = blk?.type === 'Button' ? ['data', 'props', 'buttonTextColor'] : ['data', 'style', 'color'];
                  updateBlock(id, prev => {
                    const next = structuredClone(prev);
                    let target = next;
                    for (let i = 0; i < path.length - 1; i++) { target[path[i]] = target[path[i]] ?? {}; target = target[path[i]]; }
                    target[path[path.length - 1]] = v;
                    return next;
                  });
                });
              }}
            />
          )}
          <ColorInput
            label="Background"
            value={getCommonValue(blocks, b => b.type === 'Button' ? b.data?.props?.buttonBackgroundColor : b.data?.style?.backgroundColor) || ''}
            onChange={v => {
              bulkIds.forEach(id => {
                const blk = doc[id];
                const path = blk?.type === 'Button' ? ['data', 'props', 'buttonBackgroundColor'] : ['data', 'style', 'backgroundColor'];
                updateBlock(id, prev => {
                  const next = structuredClone(prev);
                  let target = next;
                  for (let i = 0; i < path.length - 1; i++) { target[path[i]] = target[path[i]] ?? {}; target = target[path[i]]; }
                  target[path[path.length - 1]] = v;
                  return next;
                });
              });
            }}
          />
        </Row2>
      </Section>

      {/* ── Typography (only if all are text-based) ── */}
      {allText && (
        <>
          <SectionHeading>Typography</SectionHeading>
          <Section>
            <Row2>
              <SelectInput
                label="Font Weight"
                value={normalizeWeight(getCommonValue(blocks, b => b.data?.style?.fontWeight))}
                options={availableWeights(getCommonValue(blocks, b => b.data?.style?.fontFamily) || 'Inter')}
                onChange={v => bulkUpdate(['data', 'style', 'fontWeight'], v)}
              />
              <IconInput
                label="Font Size" suffix="px"
                value={getCommonValue(blocks, b => b.data?.style?.fontSize) ?? ''}
                onChange={v => bulkUpdate(['data', 'style', 'fontSize'], parseFloat(v) || 14)}
              />
            </Row2>
            <Row2>
              <div className={styles.fieldCol}>
                <span className={styles.fieldLabelStrong}>Alignment</span>
                <Toggle
                  fullWidth
                  items={[
                    { key: 'left',    label: '', icon: <AlignLeftIcon /> },
                    { key: 'center',  label: '', icon: <AlignCenterIcon /> },
                    { key: 'right',   label: '', icon: <AlignRightIcon /> },
                    { key: 'justify', label: '', icon: <AlignJustifyIcon /> },
                  ]}
                  active={getCommonValue(blocks, b => b.data?.style?.textAlign) || 'left'}
                  size="S"
                  onChange={v => bulkUpdate(['data', 'style', 'textAlign'], v)}
                />
              </div>
            </Row2>
          </Section>
        </>
      )}
    </div>
  );
}

// ── Overlay scrollbar (both axes) ───────────────────────────────────────────
// Wraps a scrollable child and replaces both native scrollbars with thin
// translucent thumbs pinned to the right edge (vertical) and bottom edge
// (horizontal). Both thumbs float over the content with zero width/height

