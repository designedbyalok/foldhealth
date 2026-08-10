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
import { AlignBottomIcon, AlignCenterIcon, AlignLeftIcon, AlignMiddleIcon, AlignRightIcon, AlignTopIcon, HeightIcon, IconInput, PaddingControl, RadiusIcon, Row2, Section, SectionHeading, WidthIcon } from './PropertiesPanelFields';

const RADIUS_TYPES = new Set(['Button', 'Image', 'Container', 'ColumnsContainer']);
const BG_IMAGE_TYPES = new Set(['Container', 'ColumnsContainer']);
const BUTTON_STYLE_RADIUS = { rectangle: 0, rounded: 6, pill: 9999 };
const FONT_FAMILIES = GOOGLE_FONTS.map(f => ({ value: f.value, label: f.label }));
const FONT_WEIGHTS_FALLBACK = [
  { value: '400', label: 'Regular 400' },
  { value: '700', label: 'Bold 700' },
];

export function DesignTabLayout({ ctx }) {
  const { block, updateBlock, id, update, data, props, style, isLayout, padding, rootFontFamily } = ctx;
  return (
    <>
      {/* ── Layout ── */}
      <SectionHeading>Layout</SectionHeading>
      <Section>
        {(block.type === 'Image' || block.type === 'Avatar') ? (
          <Row2>
            {(() => {
              // Width: parse the stored value (number = px, "NN%" = percent)
              // into a numeric input + a unit toggle. Commits a number or
              // a "NN%" string back to props.width depending on the unit.
              const wRaw = props.width;
              const wUnit = typeof wRaw === 'string' && wRaw.endsWith('%') ? '%' : 'px';
              const wNum = wUnit === '%' ? parseFloat(wRaw) : (typeof wRaw === 'number' ? wRaw : '');
              return (
                <IconInput
                  label="Width" icon={<WidthIcon />}
                  unit={wUnit}
                  onUnitChange={(next) => {
                    if (next === '%') update(['data', 'props', 'width'], `${wNum || 100}%`);
                    else update(['data', 'props', 'width'], wNum || null);
                  }}
                  value={wNum}
                  onChange={v => {
                    const n = parseFloat(v);
                    if (Number.isNaN(n)) return update(['data', 'props', 'width'], null);
                    update(['data', 'props', 'width'], wUnit === '%' ? `${n}%` : n);
                  }}
                />
              );
            })()}
            {(() => {
              const hRaw = props.height;
              const hUnit = typeof hRaw === 'string' && hRaw.endsWith('%') ? '%' : 'px';
              const hNum = hUnit === '%' ? parseFloat(hRaw) : (typeof hRaw === 'number' ? hRaw : '');
              return (
                <IconInput
                  label="Height" icon={<HeightIcon />}
                  unit={hUnit}
                  onUnitChange={(next) => {
                    if (next === '%') update(['data', 'props', 'height'], `${hNum || 100}%`);
                    else update(['data', 'props', 'height'], hNum || null);
                  }}
                  value={hNum}
                  onChange={v => {
                    const n = parseFloat(v);
                    if (Number.isNaN(n)) return update(['data', 'props', 'height'], null);
                    update(['data', 'props', 'height'], hUnit === '%' ? `${n}%` : n);
                  }}
                />
              );
            })()}
          </Row2>
        ) : null}

        {(block.type === 'Container' || block.type === 'ColumnsContainer') ? (
          <Row2>
            <div className={styles.fieldCol}>
              <span className={styles.fieldLabel}>Height</span>
              <Toggle
                fullWidth
                items={[
                  { key: 'hug', label: 'Hug' },
                  { key: 'fixed', label: 'Fixed' },
                ]}
                active={props.heightMode || 'hug'}
                size="S"
                onChange={v => {
                  update(['data', 'props', 'heightMode'], v);
                  if (v === 'hug') update(['data', 'props', 'height'], null);
                }}
              />
            </div>
            {(props.heightMode === 'fixed') && (
              <IconInput
                label="Value" suffix="px" icon={<HeightIcon />}
                value={props.height || ''}
                onChange={v => update(['data', 'props', 'height'], parseFloat(v) || null)}
              />
            )}
          </Row2>
        ) : null}

        {/* Gap between stacked children. For ColumnsContainer this is the
            vertical spacing inside each column (separate from columnsGap /
            rowGap which space the columns themselves). For Container and
            the root EmailLayout it spaces the top-level children stack. */}
        {(block.type === 'Container' || block.type === 'ColumnsContainer' || isLayout) && (
          <Row2>
            <IconInput
              label="Gap" suffix="px"
              value={(isLayout ? data.gap : style.gap) ?? 0}
              onChange={v => update(isLayout ? ['data', 'gap'] : ['data', 'style', 'gap'], parseFloat(v) || 0)}
            />
          </Row2>
        )}

        {/* Fixed-height containers position their child content via flex
            instead of overflowing. Two 3-button toggles (Horizontal +
            Vertical) map to align-items + justify-content respectively. */}
        {(block.type === 'Container' || block.type === 'ColumnsContainer') && props.heightMode === 'fixed' && (
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
                active={props.contentAlignH || 'left'}
                onChange={v => update(['data', 'props', 'contentAlignH'], v)}
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
                active={props.contentAlign || 'top'}
                onChange={v => update(['data', 'props', 'contentAlign'], v)}
              />
            </div>
          </Row2>
        )}

        {!isLayout && (
          <PaddingControl
            padding={padding}
            onChangeSide={(side, value) => update(['data', 'style', 'padding', side], value)}
            onChangeAll={(value) => update(['data', 'style', 'padding'], { top: value, right: value, bottom: value, left: value })}
          />
        )}

        {/* Block-level horizontal alignment — controls where the rendered
            element sits inside its parent (works for Image/Avatar/Button
            via wrapper text-align, and for Container/ColumnsContainer via
            an inline-block alignment passed to the renderer). Distinct
            from textAlign which only controls text inside the element. */}
        {!isLayout && (
          <div className={styles.fieldCol}>
            <span className={styles.fieldLabel}>Align</span>
            <Toggle
              fullWidth
              items={[
                { key: 'left',   label: '', icon: <AlignLeftIcon /> },
                { key: 'center', label: '', icon: <AlignCenterIcon /> },
                { key: 'right',  label: '', icon: <AlignRightIcon /> },
              ]}
              active={style.blockAlign || 'left'}
              size="S"
              onChange={v => update(['data', 'style', 'blockAlign'], v)}
            />
          </div>
        )}

        {RADIUS_TYPES.has(block.type) && (
          <Row2>
            <IconInput
              label="Radius" suffix="px" icon={<RadiusIcon />}
              value={style.borderRadius ?? (block.type === 'Button' ? BUTTON_STYLE_RADIUS[props.buttonStyle || 'rectangle'] ?? 0 : 0)}
              onChange={v => update(['data', 'style', 'borderRadius'], parseFloat(v) || 0)}
            />
          </Row2>
        )}
      </Section>

    </>
  );
}
