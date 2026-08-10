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
import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon, ColumnWidthBar, DirectionColIcon, DirectionRowIcon, IconInput, ImageUploader, NavLinkEditor, PlainInput, Row2, Section, SectionHeading, SelectInput, SocialEditor, TableEditor } from './PropertiesPanelFields';

const RADIUS_TYPES = new Set(['Button', 'Image', 'Container', 'ColumnsContainer']);
const BG_IMAGE_TYPES = new Set(['Container', 'ColumnsContainer']);
const BUTTON_STYLE_RADIUS = { rectangle: 0, rounded: 6, pill: 9999 };
const FONT_FAMILIES = GOOGLE_FONTS.map(f => ({ value: f.value, label: f.label }));
const FONT_WEIGHTS_FALLBACK = [
  { value: '400', label: 'Regular 400' },
  { value: '700', label: 'Bold 700' },
];

export function DesignTabBlocksSecondary({ ctx }) {
  const { block, updateBlock, id, update, props, style, isLayout, padding, rootFontFamily } = ctx;
  return (
    <>
      {block.type === 'Avatar' && (
        <>
          <SectionHeading>Avatar</SectionHeading>
          <Section>
            <ImageUploader
              currentUrl={props.imageUrl}
              onChange={v => update(['data', 'props', 'imageUrl'], v)}
            />
            <PlainInput label="Image URL" value={props.imageUrl || ''} onChange={v => update(['data', 'props', 'imageUrl'], v)} />
            <Row2>
              <IconInput label="Size" suffix="px" value={props.size || 64} onChange={v => update(['data', 'props', 'size'], parseFloat(v) || 64)} />
              <SelectInput
                label="Shape"
                value={props.shape || 'circle'}
                options={[{ value: 'circle', label: 'Circle' }, { value: 'square', label: 'Square' }, { value: 'rounded', label: 'Rounded' }]}
                onChange={v => update(['data', 'props', 'shape'], v)}
              />
            </Row2>
          </Section>
        </>
      )}

      {block.type === 'Divider' && (
        <>
          <SectionHeading>Divider</SectionHeading>
          <Section>
            <div className={styles.fieldCol}>
              <span className={styles.fieldLabel}>Orientation</span>
              <Toggle
                fullWidth
                items={[
                  { key: 'horizontal', label: 'Horizontal' },
                  { key: 'vertical',   label: 'Vertical' },
                ]}
                active={props.orientation || 'horizontal'}
                size="S"
                onChange={v => update(['data', 'props', 'orientation'], v)}
              />
            </div>
            <Row2>
              <ColorInput label="Line Color" value={props.lineColor} onChange={v => update(['data', 'props', 'lineColor'], v)} />
              <IconInput label="Thickness" suffix="px" value={props.lineHeight || 1} onChange={v => update(['data', 'props', 'lineHeight'], parseFloat(v) || 1)} />
            </Row2>
            {/* Vertical dividers get an explicit Height field — without it
                the bar collapses to its 24px min-height inside flex layouts. */}
            {props.orientation === 'vertical' && (
              <IconInput
                label="Height" suffix="px"
                value={props.height ?? 40}
                onChange={v => update(['data', 'props', 'height'], parseFloat(v) || 40)}
              />
            )}
            <div className={styles.fieldCol}>
              <span className={styles.fieldLabel}>Style</span>
              <Toggle
                fullWidth
                items={[
                  { key: 'solid', label: 'Solid' },
                  { key: 'dashed', label: 'Dashed' },
                ]}
                active={props.lineStyle || 'solid'}
                size="S"
                onChange={v => update(['data', 'props', 'lineStyle'], v)}
              />
            </div>
            <Row2>
              <div className={styles.fieldCol}>
                <span className={styles.fieldLabel}>Left End</span>
                <Toggle
                  fullWidth
                  items={[
                    { key: 'none', label: '—' },
                    { key: 'circle', label: '●' },
                    { key: 'arrow', label: '◄' },
                  ]}
                  active={props.endLeft || 'none'}
                  size="S"
                  onChange={v => update(['data', 'props', 'endLeft'], v)}
                />
              </div>
              <div className={styles.fieldCol}>
                <span className={styles.fieldLabel}>Right End</span>
                <Toggle
                  fullWidth
                  items={[
                    { key: 'none', label: '—' },
                    { key: 'circle', label: '●' },
                    { key: 'arrow', label: '►' },
                  ]}
                  active={props.endRight || 'none'}
                  size="S"
                  onChange={v => update(['data', 'props', 'endRight'], v)}
                />
              </div>
            </Row2>
          </Section>
        </>
      )}

      {block.type === 'Spacer' && (
        <>
          <SectionHeading>Spacer</SectionHeading>
          <Section>
            <IconInput label="Height" suffix="px" value={props.height || 16} onChange={v => update(['data', 'props', 'height'], parseFloat(v) || 16)} />
          </Section>
        </>
      )}

      {block.type === 'Table' && (
        <>
          <SectionHeading>Table</SectionHeading>
          <Section>
            <TableEditor
              columns={props.columns || []}
              rows={props.rows || []}
              onChangeColumns={cols => update(['data', 'props', 'columns'], cols)}
              onChangeRows={rows => update(['data', 'props', 'rows'], rows)}
            />
            <Row2>
              <ColorInput label="Header BG" value={props.headerBg || '#7C5CFA'} onChange={v => update(['data', 'props', 'headerBg'], v)} />
              <ColorInput label="Header Text" value={props.headerColor || '#FFFFFF'} onChange={v => update(['data', 'props', 'headerColor'], v)} />
            </Row2>
            <Row2>
              <ColorInput label="Border" value={props.borderColor || '#E1E4EA'} onChange={v => update(['data', 'props', 'borderColor'], v)} />
              <ColorInput label="Stripe" value={props.stripedColor || '#F6F4FF'} onChange={v => update(['data', 'props', 'stripedColor'], v)} />
            </Row2>
            <div className={styles.fieldCol}>
              <span className={styles.fieldLabel}>Striped Rows</span>
              <Toggle
                fullWidth
                items={[{ key: 'on', label: 'On' }, { key: 'off', label: 'Off' }]}
                active={props.stripedRows ? 'on' : 'off'}
                size="S"
                onChange={v => update(['data', 'props', 'stripedRows'], v === 'on')}
              />
            </div>
          </Section>
        </>
      )}

      {block.type === 'Social' && (
        <>
          <SectionHeading>Social Links</SectionHeading>
          <Section>
            <SocialEditor
              platforms={props.platforms || []}
              onChange={platforms => update(['data', 'props', 'platforms'], platforms)}
            />
            <Row2>
              <IconInput label="Icon Size" suffix="px" value={props.iconSize || 24} onChange={v => update(['data', 'props', 'iconSize'], parseFloat(v) || 24)} />
              <IconInput label="Gap" suffix="px" value={props.gap || 16} onChange={v => update(['data', 'props', 'gap'], parseFloat(v) || 16)} />
            </Row2>
            <div className={styles.fieldCol}>
              <span className={styles.fieldLabel}>Alignment</span>
              <Toggle
                fullWidth
                items={[
                  { key: 'left',   label: '', icon: <AlignLeftIcon /> },
                  { key: 'center', label: '', icon: <AlignCenterIcon /> },
                  { key: 'right',  label: '', icon: <AlignRightIcon /> },
                ]}
                active={props.alignment || 'center'}
                size="S"
                onChange={v => update(['data', 'props', 'alignment'], v)}
              />
            </div>
          </Section>
        </>
      )}

      {block.type === 'NavBar' && (
        <>
          <SectionHeading>Nav Links</SectionHeading>
          <Section>
            <NavLinkEditor
              links={props.links || []}
              onChange={links => update(['data', 'props', 'links'], links)}
            />
            <Row2>
              <ColorInput label="Link Color" value={props.linkColor || '#7C5CFA'} onChange={v => update(['data', 'props', 'linkColor'], v)} />
              <IconInput label="Font Size" suffix="px" value={props.fontSize || 14} onChange={v => update(['data', 'props', 'fontSize'], parseFloat(v) || 14)} />
            </Row2>
            <Row2>
              <IconInput label="Gap" suffix="px" value={props.gap || 24} onChange={v => update(['data', 'props', 'gap'], parseFloat(v) || 24)} />
              <SelectInput
                label="Weight"
                value={normalizeWeight(props.fontWeight || 'bold')}
                options={availableWeights(style.fontFamily || 'Inter')}
                onChange={v => update(['data', 'props', 'fontWeight'], v)}
              />
            </Row2>
            <div className={styles.fieldCol}>
              <span className={styles.fieldLabel}>Alignment</span>
              <Toggle
                fullWidth
                items={[
                  { key: 'left',   label: '', icon: <AlignLeftIcon /> },
                  { key: 'center', label: '', icon: <AlignCenterIcon /> },
                  { key: 'right',  label: '', icon: <AlignRightIcon /> },
                ]}
                active={props.alignment || 'center'}
                size="S"
                onChange={v => update(['data', 'props', 'alignment'], v)}
              />
            </div>
          </Section>
        </>
      )}

      {block.type === 'ColumnsContainer' && (
        <>
          <SectionHeading>Columns</SectionHeading>
          <Section>
            <Row2>
              <IconInput
                label="Count"
                value={props.columnsCount || 2}
                onChange={v => {
                  const num = Math.max(1, Math.min(6, parseFloat(v) || 2));
                  updateBlock(id, prev => {
                    const next = structuredClone(prev);
                    next.data = next.data || {};
                    next.data.props = next.data.props || {};
                    next.data.props.columnsCount = num;
                    const cols = next.data.props.columns || [];
                    while (cols.length < num) cols.push({ childrenIds: [] });
                    next.data.props.columns = cols;
                    next.data.props.columnWidths = Array.from({ length: num }, () => Math.round(10000 / num) / 100);
                    return next;
                  });
                }}
              />
              <div className={styles.fieldCol}>
                <span className={styles.fieldLabel}>Direction</span>
                <Toggle
                  fullWidth
                  items={[
                    { key: 'row', label: '', icon: <DirectionRowIcon /> },
                    { key: 'column', label: '', icon: <DirectionColIcon /> },
                  ]}
                  active={props.direction || 'row'}
                  size="S"
                  onChange={v => update(['data', 'props', 'direction'], v)}
                />
              </div>
            </Row2>
            <Row2>
              <IconInput label="H Gap" suffix="px" value={props.columnsGap ?? 16} onChange={v => update(['data', 'props', 'columnsGap'], parseFloat(v) || 0)} />
              <IconInput label="V Gap" suffix="px" value={props.rowGap ?? 0} onChange={v => update(['data', 'props', 'rowGap'], parseFloat(v) || 0)} />
            </Row2>
            <div className={styles.fieldCol}>
              <span className={styles.fieldLabel}>Wrap</span>
              <Toggle
                fullWidth
                items={[
                  { key: 'nowrap', label: 'No Wrap' },
                  { key: 'wrap', label: 'Wrap' },
                ]}
                active={props.flexWrap || 'nowrap'}
                size="S"
                onChange={v => update(['data', 'props', 'flexWrap'], v)}
              />
            </div>
            <div className={styles.fieldCol}>
              <span className={styles.fieldLabel}>Column Widths</span>
              <ColumnWidthBar
                count={props.columnsCount || 2}
                widths={props.columnWidths}
                onChange={next => update(['data', 'props', 'columnWidths'], next)}
              />
            </div>
          </Section>
        </>
      )}

    </>
  );
}
